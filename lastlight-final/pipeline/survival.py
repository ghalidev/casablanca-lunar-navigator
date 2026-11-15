"""Monte Carlo survival of a generic lander, per landing day (numba).

One draw = one simulated landing: a position error, a terrain-driven tilt, a yaw, then two weeks of hourly
power (vertical panels on the sides of the lander, the real Sun direction and the real horizon at that exact
spot) against a constant load. Death = battery empty. Tip-over (tilt above the limit) = lost at touchdown.
Every random number is a pure function of (site, day, draw), so a window's probability and the ghost landers
shown in 3D come from exactly the same draws.
"""
import numpy as np
from numba import njit, prange

_C1 = np.uint64(0x9E3779B97F4A7C15)
_C2 = np.uint64(0xBF58476D1CE4E5B9)
_C3 = np.uint64(0x94D049BB133111EB)
_S30, _S27, _S31, _S11 = np.uint64(30), np.uint64(27), np.uint64(31), np.uint64(11)
_INV53 = 1.0 / 9007199254740992.0


@njit(cache=True, inline="always")
def _mix(z):
    z = (z ^ (z >> _S30)) * _C2
    z = (z ^ (z >> _S27)) * _C3
    return z ^ (z >> _S31)


@njit(cache=True, inline="always")
def _uniform(state, i):
    return float(_mix(state + np.uint64(i + 1) * _C1) >> _S11) * _INV53


@njit(cache=True, inline="always")
def _gauss(state, i):
    u1 = max(_uniform(state, i), 1e-12)
    u2 = _uniform(state, i + 1)
    return np.sqrt(-2.0 * np.log(u1)) * np.cos(2.0 * np.pi * u2)


@njit(cache=True)
def _draw(seed, site_i, day, draw, h0, n_h, fs, fe, grid_slope, grid_aspect, nx, half, step, sde, sdn, sdu, irr,
          sigma, tilt_limit, tilt_noise, faces, area, eff, batt, load):
    """One landing. Returns (died_h, comm_frac, dx, dy, tilt, yaw); died_h < 0 means it survived the window."""
    state = _mix(np.uint64(seed) ^ (np.uint64(site_i + 1) * _C1) ^ (np.uint64(day + 1) * _C2) ^ (np.uint64(draw + 1) * _C3))
    dx = _gauss(state, 0) * sigma
    dy = _gauss(state, 2) * sigma
    ix = min(max(int(round((dx + half) / step)), 0), nx - 1)
    iy = min(max(int(round((dy + half) / step)), 0), nx - 1)
    cell = iy * nx + ix
    slope = grid_slope[cell]
    tilt = slope + abs(_gauss(state, 4)) * tilt_noise
    yaw = _uniform(state, 6) * 360.0
    lean = grid_aspect[cell] + _gauss(state, 7) * 25.0 if slope > 1.0 else _uniform(state, 9) * 360.0

    # communication: hours with at least half of the Earth's disc in view at this very spot
    comm = 0
    for h in range(n_h):
        if fe[cell, h0 + h] >= 128:
            comm += 1
    comm_frac = comm / n_h

    if tilt > tilt_limit:
        return 0.0, comm_frac, dx, dy, tilt, yaw

    t = np.radians(tilt)
    ct, st = np.cos(t), np.sin(t)
    la = np.radians(lean)
    ux, uy = np.sin(la), np.cos(la)
    kx, ky = -uy, ux  # rotation axis = z x lean direction (horizontal, unit)
    nxs = np.empty(faces)
    nys = np.empty(faces)
    nzs = np.empty(faces)
    for f in range(faces):
        a = np.radians(yaw + 360.0 * f / faces)
        vx, vy, vz = np.sin(a), np.cos(a), 0.0
        kv = kx * vx + ky * vy
        cx, cy, cz = ky * vz - 0.0 * vy, 0.0 * vx - kx * vz, kx * vy - ky * vx  # k x v with k = (kx, ky, 0)
        nxs[f] = vx * ct + cx * st + kx * kv * (1 - ct)
        nys[f] = vy * ct + cy * st + ky * kv * (1 - ct)
        nzs[f] = vz * ct + cz * st
    e = batt
    for h in range(n_h):
        idx = h0 + h
        s = 0.0
        for f in range(faces):
            d = sde[idx] * nxs[f] + sdn[idx] * nys[f] + sdu[idx] * nzs[f]
            if d > 0.0:
                s += d
        p = area * eff * irr[idx] * s * (fs[cell, idx] / 255.0)
        prev = e
        e += p - load
        if e > batt:
            e = batt
        if e <= 0.0:
            return h + prev / max(load - p, 1e-9), comm_frac, dx, dy, tilt, yaw
    return -1.0, comm_frac, dx, dy, tilt, yaw


@njit(parallel=True, cache=True)
def run_windows(seed, site_i, day_hours, n_draws, n_h, fs, fe, grid_slope, grid_aspect, nx, half, step, sde, sdn, sdu, irr,
                sigma, tilt_limit, tilt_noise, faces, area, eff, batt, load):
    """Per landing day: survival probability, share of the window with Earth in view, median days alive."""
    nw = day_hours.shape[0]
    p = np.empty(nw)
    comm = np.empty(nw)
    med = np.empty(nw)
    for w in prange(nw):
        alive = 0
        csum = 0.0
        life = np.empty(n_draws)
        for d in range(n_draws):
            died, c, _dx, _dy, _t, _y = _draw(seed, site_i, w, d, day_hours[w], n_h, fs, fe, grid_slope, grid_aspect, nx, half, step,
                                               sde, sdn, sdu, irr, sigma, tilt_limit, tilt_noise, faces, area, eff, batt, load)
            if died < 0:
                alive += 1
                life[d] = n_h / 24.0
            else:
                life[d] = died / 24.0
            csum += c
        p[w] = alive / n_draws
        comm[w] = csum / n_draws
        med[w] = np.median(life)
    return p, comm, med


@njit(cache=True)
def run_one(seed, site_i, w, hour0, n_draws, n_h, fs, fe, grid_slope, grid_aspect, nx, half, step, sde, sdn, sdu, irr,
            sigma, tilt_limit, tilt_noise, faces, area, eff, batt, load):
    """Every draw of one window, for the ghost landers shown in 3D."""
    out = np.empty((n_draws, 5))
    for d in range(n_draws):
        died, _c, dx, dy, tilt, yaw = _draw(seed, site_i, w, d, hour0, n_h, fs, fe, grid_slope, grid_aspect, nx, half, step,
                                            sde, sdn, sdu, irr, sigma, tilt_limit, tilt_noise, faces, area, eff, batt, load)
        out[d, 0] = dx
        out[d, 1] = dy
        out[d, 2] = tilt
        out[d, 3] = yaw
        out[d, 4] = died
    return out


@njit(parallel=True, cache=True)
def frac_tables(el_c, az_c, rad, hprof, n_az):
    """Share of a body's disc above each grid cell's horizon, for every hour: uint8 [cells, hours] (0..255)."""
    g = hprof.shape[0]
    n = el_c.shape[0]
    out = np.empty((g, n), dtype=np.uint8)
    for c in prange(g):
        for i in range(n):
            f = (az_c[i] % 360.0) / 360.0 * n_az
            i0 = int(f) % n_az
            i1 = (i0 + 1) % n_az
            t = f - np.floor(f)
            hor = hprof[c, i0] * (1 - t) + hprof[c, i1] * t
            x = (el_c[i] - hor) / rad[i]
            if x > 1.0:
                x = 1.0
            elif x < -1.0:
                x = -1.0
            v = 1.0 - (np.arccos(x) - x * np.sqrt(1.0 - x * x)) / np.pi
            out[c, i] = np.uint8(min(max(v, 0.0), 1.0) * 255.0 + 0.5)
    return out


@njit(parallel=True, cache=True)
def run_days_died(seed, site_i, day_hours, n_draws, n_h, fs, fe, grid_slope, grid_aspect, nx, half, step, sde, sdn, sdu, irr,
                  sigma, tilt_limit, tilt_noise, faces, area, eff, batt, load):
    """Death hour of every draw of every landing day (-1 = alive after the window): float32 [days, draws].

    Same draws as run_windows, so the share of -1 in row w is exactly p[w]. The browser rebuilds each draw's
    position, tilt and yaw from the same (seed, site, day, draw) hash; only the death hour has to be shipped.
    """
    nw = day_hours.shape[0]
    out = np.empty((nw, n_draws), dtype=np.float32)
    for w in prange(nw):
        for d in range(n_draws):
            died, _c, _dx, _dy, _t, _y = _draw(seed, site_i, w, d, day_hours[w], n_h, fs, fe, grid_slope, grid_aspect, nx, half, step,
                                               sde, sdn, sdu, irr, sigma, tilt_limit, tilt_noise, faces, area, eff, batt, load)
            out[w, d] = died
    return out
