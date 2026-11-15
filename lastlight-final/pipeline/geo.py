"""Geometry shared by the pipeline: the DEM's polar stereographic frame and local east/north/up vectors."""
import numpy as np

from config import R_MOON_M


def stereo_xy(lat_deg, lon_deg):
    """Planetocentric lat/lon (degrees, east positive) -> metres in the LOLA south-polar stereographic plane.

    Same as PROJ `+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +k=1 +R=1737400`: x = rho sin(lon), y = rho cos(lon).
    """
    lat = np.radians(np.asarray(lat_deg, dtype=float))
    lon = np.radians(np.asarray(lon_deg, dtype=float))
    rho = 2.0 * R_MOON_M * np.tan(np.pi / 4.0 + lat / 2.0)
    return rho * np.sin(lon), rho * np.cos(lon)


def scale_k(lat_deg):
    """Local scale factor of the projection: plane distance = k * ground distance."""
    return 2.0 / (1.0 + np.sin(-np.radians(lat_deg)))


def local_axes_plane(lon_deg):
    """Unit vectors (north, east) of a site, expressed in the stereographic plane.

    North points away from the south pole, along the meridian; east is the direction of increasing longitude.
    """
    lon = np.radians(lon_deg)
    north = np.array([np.sin(lon), np.cos(lon)])
    east = np.array([np.cos(lon), -np.sin(lon)])
    return north, east


def enu_basis(lat_deg, lon_deg):
    """(east, north, up) unit vectors in the Moon body-fixed frame for a planetocentric lat/lon."""
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    return east, north, up
