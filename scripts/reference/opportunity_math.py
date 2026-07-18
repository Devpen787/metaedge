#!/usr/bin/env python3
"""Independent reference math for the MetaEdge opportunity factory.

This file deliberately shares no code with the TypeScript runtime. It uses
Python's standard-library NormalDist for the Bonferroni critical value and is
checked against the same immutable golden vectors as the product implementation.
"""

from __future__ import annotations

import json
import math
import statistics
import sys
from pathlib import Path


def net_benchmark_relative_return_bps(
    entry: float,
    exit_price: float,
    benchmark_entry: float,
    benchmark_exit: float,
    round_trip_cost_bps: float,
) -> float:
    values = (entry, exit_price, benchmark_entry, benchmark_exit)
    if any(not math.isfinite(v) or v <= 0 for v in values):
        raise ValueError("prices must be finite and positive")
    if not math.isfinite(round_trip_cost_bps) or round_trip_cost_bps < 0:
        raise ValueError("cost must be finite and non-negative")
    return (
        ((exit_price / entry - 1) - (benchmark_exit / benchmark_entry - 1))
        * 10_000
        - round_trip_cost_bps
    )


def edge_statistics(values_bps: list[float], alpha: float, trials: int) -> dict[str, float | int | None]:
    if not 0 < alpha < 0.5:
        raise ValueError("alpha must be in (0,0.5)")
    if trials < 1:
        raise ValueError("trials must be positive")
    n = len(values_bps)
    if n == 0:
        return {"n": 0, "mean": None, "sample_std": None, "se": None, "critical_z": None, "lcb": None}
    mean = statistics.fmean(values_bps)
    if n < 2:
        return {"n": n, "mean": mean, "sample_std": None, "se": None, "critical_z": None, "lcb": None}
    sample_std = statistics.stdev(values_bps)
    se = sample_std / math.sqrt(n)
    z = statistics.NormalDist().inv_cdf(1 - alpha / trials)
    return {"n": n, "mean": mean, "sample_std": sample_std, "se": se, "critical_z": z, "lcb": mean - z * se}


def verify(path: Path) -> None:
    fixture = json.loads(path.read_text())
    tolerance = fixture["tolerance"]
    for case in fixture["netReturnCases"]:
        actual = net_benchmark_relative_return_bps(
            case["entry"], case["exit"], case["benchmarkEntry"],
            case["benchmarkExit"], case["roundTripCostBps"],
        )
        assert abs(actual - case["expectedNetRelativeBps"]) <= tolerance, (case["id"], actual)
    for case in fixture["statisticsCases"]:
        actual = edge_statistics(case["valuesBps"], case["alpha"], case["trials"])
        for key, expected in case["expected"].items():
            got = actual[key]
            if expected is None:
                assert got is None, (case["id"], key, got)
            else:
                assert got is not None and abs(float(got) - expected) <= tolerance, (case["id"], key, got)
    print(f"reference parity ok: {len(fixture['netReturnCases']) + len(fixture['statisticsCases'])} vectors")


if __name__ == "__main__":
    fixture_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("tests/fixtures/opportunity_math_golden.json")
    verify(fixture_path)
