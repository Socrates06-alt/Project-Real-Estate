"""Distance and location privacy helpers."""

import math
import random

EARTH_KM = 6371.0
M_PER_DEG_LAT = 111_320.0


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance between two points on the earth (haversine)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


def blur(lat: float, lng: float, min_m: float = 150, max_m: float = 500) -> tuple[float, float]:
    """Public, approximate spot: the exact one moved 150-500 m in a random direction.

    Made once per pin and stored, so repeated views can't be averaged back to the exact spot.
    """
    angle = random.uniform(0, 2 * math.pi)  # noqa: S311 - privacy offset, not cryptography
    dist = random.uniform(min_m, max_m)  # noqa: S311
    dlat = dist * math.cos(angle) / M_PER_DEG_LAT
    dlng = dist * math.sin(angle) / (M_PER_DEG_LAT * math.cos(math.radians(lat)))
    return round(lat + dlat, 5), round(lng + dlng, 5)
