"""Training load calculation using Bannister's TRIMP formula."""

import math
from typing import Optional


def calculate_trimp(
    duration_seconds: int,
    avg_hr: float,
    resting_hr: float,
    max_hr: float,
    gender: str = "male",
) -> float:
    """
    Calculate Bannister's TRIMP (Training Impulse).

    TRIMP = duration_min * delta_hr_ratio * k * e^(b * delta_hr_ratio)
    Male:   k=0.64, b=1.92
    Female: k=0.86, b=1.67
    """
    if not duration_seconds or not avg_hr or not resting_hr or not max_hr:
        return 0.0

    duration_min = duration_seconds / 60
    hr_reserve = max_hr - resting_hr
    if hr_reserve <= 0:
        return 0.0

    delta_hr_ratio = (avg_hr - resting_hr) / hr_reserve
    delta_hr_ratio = max(0.0, min(1.0, delta_hr_ratio))

    if gender == "female":
        return duration_min * delta_hr_ratio * 0.86 * math.exp(1.67 * delta_hr_ratio)
    return duration_min * delta_hr_ratio * 0.64 * math.exp(1.92 * delta_hr_ratio)


def estimate_planned_load(
    duration_min: Optional[int],
    intensity: Optional[str],
    hr_zone: Optional[str],
    resting_hr: float,
    max_hr: float,
) -> float:
    """
    Estimate TRIMP for a planned workout based on intensity/zone and duration.
    Uses midpoint HR of the target zone to approximate avg HR.
    """
    if not duration_min or not resting_hr or not max_hr:
        return 0.0

    # Map intensity to approximate HR fraction of reserve
    intensity_map = {"low": 0.55, "moderate": 0.72, "high": 0.88}
    # Map zones to approximate HR fraction of reserve
    zone_map = {
        "zone1": 0.50,
        "zone2": 0.60,
        "zone3": 0.72,
        "zone4": 0.82,
        "zone5": 0.92,
    }

    fraction = zone_map.get(hr_zone or "", intensity_map.get(intensity or "", 0.60))
    estimated_avg_hr = resting_hr + fraction * (max_hr - resting_hr)

    return calculate_trimp(
        duration_seconds=duration_min * 60,
        avg_hr=estimated_avg_hr,
        resting_hr=resting_hr,
        max_hr=max_hr,
    )
