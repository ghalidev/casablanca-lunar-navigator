"""Terrain horizon by ray marching on the LOLA DEM (numba).

Two rasters are used: a fine one (20 m/px) around the site and a coarse one (240 m/px, 60-90S) for the far field.
Heights are above the 1737.4 km reference sphere. The elevation angle of a terrain point seen from the site is
exact on a sphere (no flat-Moon approximation): el = atan2((R+h) cos(t) - (R+h0), (R+h) sin(t)), t = d / R.
"""
import numpy as np
from numba import njit, prange

from config import R_MOON_M


@njit(cache=True, inline="always")
def _bilinear(a, x, y, x0, y0, res):
    """Bilinear height at plane coordinates (x, y); (x0, y0) is the top-left corner of pixel (0, 0). NaN outside."""
    fc = (x - x0) / res - 0.5
    fr = (y0 - y) / res - 0.5
    c = int(np.floor(fc))
    r = int(np.floor(fr))
    if c < 0 or r < 0 or c + 1 >= a.shape[1] or r + 1 >= a.shape[0]:
        return np.nan
    tx = fc - c
    ty = fr - r
    h00 = a[r, c]
    h01 = a[r, c + 1]
    h10 = a[r + 1, c]
    h11 = a[r + 1, c + 1]
    return (h00 * (1 - tx) + h01 * tx) * (1 - ty) + (h10 * (1 - tx) + h11 * tx) * ty


@njit(cache=True, inline="always")
def sample(near, nx0, ny0, nres, far, fx0, fy0, fres, x, y):
    h = _bilinear(near, x, y, nx0, ny0, nres)
    if np.isnan(h):
        h = _bilinear(far, x, y, fx0, fy0, fres)
    return h


@njit(cache=True)
def _profile(near, nx0, ny0, nres, far, fx0, fy0, fres, sx, sy, k, h0, nvec, evec, out, max_range, near_radius):
    n_az = out.shape[0]
    for i in range(n_az):
        az = np.radians(i * 360.0 / n_az)
        dx = np.cos(az) * nvec[0] + np.sin(az) * evec[0]
        dy = np.cos(az) * nvec[1] + np.sin(az) * evec[1]
        best = -90.0
        d = nres
        while d < max_range:
            h = sample(near, nx0, ny0, nres, far, fx0, fy0, fres, sx + dx * d * k, sy + dy * d * k)
            if np.isnan(h):
                break
            t = d / R_MOON_M
            el = np.degrees(np.arctan2((R_MOON_M + h) * np.cos(t) - (R_MOON_M + h0), (R_MOON_M + h) * np.sin(t)))
            if el > best:
                best = el
            d += max(nres if d < near_radius else fres * 0.5, 0.004 * d)
        out[i] = best
    return out


@njit(cache=True)
def site_height(near, nx0, ny0, nres, far, fx0, fy0, fres, x, y):
    return sample(near, nx0, ny0, nres, far, fx0, fy0, fres, x, y)


@njit(parallel=True, cache=True)
def grid_profiles(near, nx0, ny0, nres, far, fx0, fy0, fres, xs, ys, k, mast, nvec, evec, n_az, max_range, near_radius):
    """Horizon at every (xs[i], ys[i]) plane point; the observer is `mast` metres above the local ground."""
    g = xs.shape[0]
    out = np.empty((g, n_az), dtype=np.float32)
    ground = np.empty(g, dtype=np.float32)
    for i in prange(g):
        h0 = sample(near, nx0, ny0, nres, far, fx0, fy0, fres, xs[i], ys[i])
        ground[i] = h0
        buf = np.empty(n_az)
        _profile(near, nx0, ny0, nres, far, fx0, fy0, fres, xs[i], ys[i], k, h0 + mast, nvec, evec, buf, max_range, near_radius)
        for j in range(n_az):
            out[i, j] = buf[j]
    return out, ground


@njit(parallel=True, cache=True)
def grid_slopes(near, nx0, ny0, nres, far, fx0, fy0, fres, xs, ys, k, nvec, evec, baseline):
    """Terrain slope (deg) and downhill azimuth (deg, clockwise from local north) at every grid point.

    Slope is measured over `baseline` metres (central difference), the resolution the DEM can honestly give.
    """
    g = xs.shape[0]
    slope = np.empty(g, dtype=np.float32)
    aspect = np.empty(g, dtype=np.float32)
    s = baseline * k
    for i in prange(g):
        hn = sample(near, nx0, ny0, nres, far, fx0, fy0, fres, xs[i] + nvec[0] * s, ys[i] + nvec[1] * s)
        hs = sample(near, nx0, ny0, nres, far, fx0, fy0, fres, xs[i] - nvec[0] * s, ys[i] - nvec[1] * s)
        he = sample(near, nx0, ny0, nres, far, fx0, fy0, fres, xs[i] + evec[0] * s, ys[i] + evec[1] * s)
        hw = sample(near, nx0, ny0, nres, far, fx0, fy0, fres, xs[i] - evec[0] * s, ys[i] - evec[1] * s)
        gn = (hn - hs) / (2 * baseline)
        ge = (he - hw) / (2 * baseline)
        slope[i] = np.degrees(np.arctan(np.sqrt(gn * gn + ge * ge)))
        aspect[i] = np.degrees(np.arctan2(-ge, -gn)) % 360.0  # downhill = minus the gradient
    return slope, aspect


def site_profiles(near, near_origin, near_res, far, far_origin, far_res, x, y, k, nvec, evec, masts, n_az, max_range_m, near_radius_m):
    """Horizon profiles (n_az values, degrees) of one site for each mast height, plus the ground height there."""
    xs = np.array([x])
    ys = np.array([y])
    out = []
    ground = 0.0
    for m in masts:
        prof, g = grid_profiles(near, near_origin[0], near_origin[1], near_res, far, far_origin[0], far_origin[1], far_res, xs, ys, k, m, nvec, evec, n_az, max_range_m, near_radius_m)
        out.append(prof[0])
        ground = float(g[0])
    return out, ground
