"""Sanity tests for the numerical core. Run: pipeline/.venv/bin/python -m pytest pipeline  (or python pipeline/test_core.py)"""
import numpy as np

import ephem
import horizon
from config import R_MOON_M
from geo import local_axes_plane, scale_k, stereo_xy


def _flat():
    far = np.zeros((400, 400), dtype=np.float32)
    near = np.zeros((400, 400), dtype=np.float32)
    return near, (-4000.0, 4000.0), 20.0, far, (-48000.0, 48000.0), 240.0


def test_flat_moon_horizon_is_the_curvature_dip():
    near, no, nr, far, fo, fr = _flat()
    nv, ev = local_axes_plane(0.0)
    prof, ground = horizon.site_profiles(near, no, nr, far, fo, fr, 0.0, 0.0, 1.0, nv, ev, (2.0,), 720, 40000.0, 3000.0)
    dip = -np.degrees(np.sqrt(2 * 2.0 / R_MOON_M))  # geometric dip of an observer 2 m up
    assert abs(prof[0].mean() - dip) < 0.02 and ground == 0.0


def test_a_wall_sets_the_horizon():
    near, no, nr, far, fo, fr = _flat()
    near[:, 250:] = 100.0  # a 100 m cliff 1000 m east of the origin (x = -4000 + 250*20)
    nv, ev = local_axes_plane(0.0)  # lon 0: north = +y, east = +x
    prof, _ = horizon.site_profiles(near, no, nr, far, fo, fr, 0.0, 0.0, 1.0, nv, ev, (0.0,), 720, 40000.0, 3000.0)
    east = prof[0][180]  # azimuth 90 deg
    assert abs(east - np.degrees(np.arctan(100.0 / 1000.0))) < 0.3
    assert prof[0][0] < 0.1  # north is open


def test_disk_fraction_limits():
    r = np.array([0.27])
    f = lambda c, h: float(ephem.disk_fraction(np.array([c]), np.array([h]), r)[0])
    assert f(1.0, 0.0) == 1.0 and f(-1.0, 0.0) == 0.0 and abs(f(0.0, 0.0) - 0.5) < 1e-9


def test_stereographic_pole_and_scale():
    x, y = stereo_xy(-90.0 + 1e-9, 0.0)
    assert abs(x) < 1e-3 and abs(y) < 1e-3
    assert abs(scale_k(-90.0) - 1.0) < 1e-9 and 1.0 < scale_k(-80.0) < 1.02


if __name__ == "__main__":
    for n, fn in list(globals().items()):
        if n.startswith("test_"):
            fn()
            print("ok", n)
