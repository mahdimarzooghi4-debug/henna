#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "ai"))

from henna_ebm_challenger import (  # noqa: E402
    ARTIFACT_FORMAT,
    INTERPRET_CORE_VERSION,
    MODEL_VERSION,
    train_payload,
)


def build_payload() -> dict:
    cutoff = datetime(2026, 10, 7, 6, 0, tzinfo=timezone.utc)
    weights = [0.35, 0.20, 0.18, 0.12, 0.10, 0.05]
    examples = []
    for i in range(48):
        scores = [0, 0, 0, 0, 0, 0]
        scores[i % 6] = 3
        examples.append(
            {
                "householdKey": str(uuid4()),
                "reviewerKey": str(uuid4()),
                "scores": {
                    "health": scores[0],
                    "hardship": scores[1],
                    "age": scores[2],
                    "size": scores[3],
                    "care": scores[4],
                    "education": scores[5],
                },
                "reviewedNeedScore": weights[i % 6],
                "rubricVersion": "ebm-ci-rubric-v1",
                "reviewedAtUtc": (
                    cutoff - timedelta(minutes=i + 1)
                ).isoformat().replace("+00:00", "Z"),
                "partition": "TRAINING" if i < 36 else "VALIDATION",
            }
        )
    return {
        "cutoffUtc": cutoff.isoformat().replace("+00:00", "Z"),
        "examples": examples,
    }


def main() -> None:
    payload = build_payload()
    household_markers = [x["householdKey"] for x in payload["examples"]]
    artifact_bytes, report = train_payload(payload)
    artifact = json.loads(artifact_bytes)

    assert report["modelVersion"] == MODEL_VERSION
    assert report["artifactFormat"] == ARTIFACT_FORMAT
    assert report["library"]["version"] == INTERPRET_CORE_VERSION
    assert report["execution"]["networkModelApi"] is False
    assert report["execution"]["dataOrigin"] == "HENNA_FIRST_PARTY"
    assert report["metrics"]["trainingCount"] == 36
    assert report["metrics"]["validationCount"] == 12
    assert math.isfinite(report["metrics"]["trainingMse"])
    assert math.isfinite(report["metrics"]["validationMse"])
    assert report["parameters"]["interactions"] == 0
    assert report["parameters"]["monotone_constraints"] is None
    assert report["governance"] == {
        "winner": None,
        "approved": False,
        "proposalCreated": False,
        "pilotAuthorized": False,
        "runtimeApplied": False,
    }

    assert artifact["schema"] == ARTIFACT_FORMAT
    assert artifact["modelVersion"] == MODEL_VERSION
    assert artifact["library"]["version"] == INTERPRET_CORE_VERSION
    assert artifact["featureOrder"] == [
        "health", "hardship", "age", "size", "care", "education"
    ]
    assert len(artifact["predictionLookup"]) == 4096
    assert all(math.isfinite(x) for x in artifact["predictionLookup"])
    assert "officialInterpretMlModel" in artifact
    assert len(report["artifactSha256"]) == 64

    artifact_text = artifact_bytes.decode("utf-8")
    for marker in household_markers:
        assert marker not in artifact_text

    invalid = build_payload()
    invalid["examples"][0]["partition"] = "EVALUATION"
    try:
        train_payload(invalid)
    except ValueError as exc:
        assert "Evaluation is independent" in str(exc)
    else:
        raise AssertionError("EBM challenger accepted an Evaluation row for fitting")

    duplicate = build_payload()
    duplicate["examples"][1]["householdKey"] = duplicate["examples"][0]["householdKey"]
    try:
        train_payload(duplicate)
    except ValueError as exc:
        assert "distinct" in str(exc)
    else:
        raise AssertionError("EBM challenger accepted household overlap")

    print("Henna EBM offline challenger smoke passed")


if __name__ == "__main__":
    main()
