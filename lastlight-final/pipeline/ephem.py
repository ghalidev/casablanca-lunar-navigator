"""Sun and Earth as seen from a lunar site, hour by hour (Skyfield, NAIF SPICE kernels, MOON_ME frame).

Directions are computed once per time step in the Moon's body-fixed mean-Earth frame, then rotated into each
site's local east/north/up. The Earth direction uses the exact site-to-Earth vector (Earth is only 384,000 km
away, so a site's offset from the Moon's centre shifts it by up to ~0.26 deg, a quarter of the Earth's own
angular radius); the Sun, 150 million km away, gets the same treatment at no extra cost.
"""
import numpy as np
from skyfield.api import Loader, PlanetaryConstants

from config import AU_KM, EARTH_RADIUS_KM, FRAME_NAME, R_MOON_M, SUN_RADIUS_KM
from geo import enu_basis


def load_frame(kernel_dir: str):
    load = Loader(kernel_dir)
    ts = load.timescale()
    eph = load("de421.bsp")
    pc = PlanetaryConstants()
    pc.read_text(load("moon_080317.tf"))
    pc.read_text(load("pck00008.tpc"))
    pc.read_binary(load("moon_pa_de421_1900-2050.bpc"))
    return ts, eph, pc.build_frame_named(FRAME_NAME)


def hour_times(ts, start_year: int, end_year_inclusive: int):
    """Hourly UTC grid from Jan 1 of start_year to Dec 31 23:00 of end_year_inclusive."""
    t0 = np.datetime64(f"{start_year}-01-01T00", "h")
    t1 = np.datetime64(f"{end_year_inclusive + 1}-01-01T00", "h")
    hours = np.arange(t0, t1)
    years = hours.astype("datetime64[Y]").astype(int) + 1970
    months = hours.astype("datetime64[M]").astype(int) % 12 + 1
    days = (hours.astype("datetime64[D]") - hours.astype("datetime64[M]").astype("datetime64[D]")).astype(int) + 1
    hod = (hours - hours.astype("datetime64[D]")).astype(int)
    return ts.utc(years, months, days, hod), hours


def body_vectors(ts, eph, frame, t):
    """Moon-centred Sun and Earth position vectors (km) in the MOON_ME frame, shape (3, N) each."""
    moon = eph["moon"]
    sun = moon.at(t).observe(eph["sun"]).frame_xyz(frame).km
    earth = moon.at(t).observe(eph["earth"]).frame_xyz(frame).km
    return sun, earth


def site_sky(sun_me, earth_me, lat_deg, lon_deg, ground_m):
    """Elevation/azimuth (deg) of the Sun and Earth centres, angular radii (deg) and Sun distance (AU) at a site."""
    east, north, up = enu_basis(lat_deg, lon_deg)
    site = up * (R_MOON_M + ground_m) / 1000.0  # km

    def look(vec, radius_km):
        v = vec - site[:, None]
        dist = np.linalg.norm(v, axis=0)
        e, n, u = east @ v, north @ v, up @ v
        el = np.degrees(np.arcsin(u / dist))
        az = np.degrees(np.arctan2(e, n)) % 360.0
        rad = np.degrees(np.arcsin(radius_km / dist))
        return el, az, rad, dist

    sun_el, sun_az, sun_rad, sun_dist = look(sun_me, SUN_RADIUS_KM)
    earth_el, earth_az, earth_rad, _ = look(earth_me, EARTH_RADIUS_KM)
    return {
        "sun_el": sun_el, "sun_az": sun_az, "sun_rad": sun_rad, "sun_au": sun_dist / AU_KM,
        "earth_el": earth_el, "earth_az": earth_az, "earth_rad": earth_rad,
    }


def horizon_at(profile_deg: np.ndarray, az_deg: np.ndarray) -> np.ndarray:
    """Horizon elevation (deg) at arbitrary azimuths, linear interpolation on the circular profile."""
    n = profile_deg.shape[0]
    f = (az_deg % 360.0) / 360.0 * n
    i0 = np.floor(f).astype(int) % n
    i1 = (i0 + 1) % n
    t = f - np.floor(f)
    return profile_deg[i0] * (1 - t) + profile_deg[i1] * t


def disk_fraction(center_el: np.ndarray, horizon_el: np.ndarray, radius_deg: np.ndarray) -> np.ndarray:
    """Share of a disc (angular radius r) above a locally flat horizon at elevation `horizon_el`.

    d = height of the disc's centre above the horizon line. Circular-segment area: 1 at d >= r, 0 at d <= -r,
    0.5 at d = 0. The horizon is taken flat across the disc's width and interpolated at the centre's azimuth.
    """
    d = center_el - horizon_el
    x = np.clip(d / radius_deg, -1.0, 1.0)
    return np.clip(1.0 - (np.arccos(x) - x * np.sqrt(1.0 - x * x)) / np.pi, 0.0, 1.0)
