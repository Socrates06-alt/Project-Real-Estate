"""Distance and area helpers."""

import math

EARTH_KM = 6371.0


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance between two points on the earth (haversine)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


GRID_DEG = 0.01  # ~1.1 km squares around Chengannur


def flag(lat: float, lng: float) -> tuple[float, float]:
    """The public point for radius search: the centre of the ~1 km grid square the area centre falls in.

    Every property in the same area gets the same flag, so searching can never narrow one down.
    """

    def snap(v: float) -> float:
        return round(math.floor(v / GRID_DEG) * GRID_DEG + GRID_DEG / 2, 4)

    return snap(lat), snap(lng)
