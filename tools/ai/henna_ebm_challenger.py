#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from importlib import metadata
from pathlib import Path
from typing import Any
from uuid import UUID

import numpy as np
from interpret.glassbox import ExplainableBoostingRegressor

MODEL_VERSION = "henna-ebm-v1-offline"
ARTIFACT_FORMAT = "henna-ebm-portable-json-v1"
INTERPRET_CORE_VERSION = "0.7.8"
FEATURES = (
    "health",
    "hardship",
    "age",
    "size",
    "care",
    "education",
)
FEATURE_TYPES = [[0.5, 1.5, 2.5] for _ in FEATURES]


@dataclass(frozen=True)
class Example:
    household_key: UUID
    reviewer_key: UUID
    scores: tuple[int, int, int, int, int, int]
    target: float
    rubric_version: str
    reviewed_at_utc: datetime
    partition: str


def _utc(value: str, field: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be an ISO-8601 UTC timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ValueError(f"{field} must be UTC")
    return parsed


def _uuid(value: str, field: str) -> UUID:
    try:
        parsed = UUID(value)
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValueError(f"{field} must be a UUID") from exc
    if parsed.int == 0:
        raise ValueError(f"{field} cannot be empty")
    return parsed


def _score(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 3:
        raise ValueError(f"{field} must be an integer in [0,3]")
    return value


def _example(raw: dict[str, Any], cutoff: datetime) -> Example:
    scores = raw.get("scores")
    if not isinstance(scores, dict):
        raise ValueError("scores object is required")
    target = raw.get("reviewedNeedScore")
    if isinstance(target, bool) or not isinstance(target, (int, float)):
        raise ValueError("reviewedNeedScore must be numeric")
    target = float(target)
    if not math.isfinite(target) or target < 0.0 or target > 1.0:
        raise ValueError("reviewedNeedScore must be finite and in [0,1]")
    rubric = raw.get("rubricVersion")
    if not isinstance(rubric, str) or not rubric.strip() or len(rubric) > 120:
        raise ValueError("rubricVersion is required and must be <=120 characters")
    partition = raw.get("partition")
    if partition not in {"TRAINING", "VALIDATION"}:
        raise ValueError("Only TRAINING and VALIDATION rows are accepted; Evaluation is independent")
    reviewed = _utc(raw.get("reviewedAtUtc"), "reviewedAtUtc")
    if reviewed > cutoff:
        raise ValueError("reviewedAtUtc cannot be after cutoffUtc")
    return Example(
        _uuid(raw.get("householdKey"), "householdKey"),
        _uuid(raw.get("reviewerKey"), "reviewerKey"),
        tuple(_score(scores.get(name), f"scores.{name}") for name in FEATURES),
        target,
        rubric,
        reviewed,
        partition,
    )


def _validate(payload: dict[str, Any]) -> tuple[datetime, list[Example]]:
    cutoff = _utc(payload.get("cutoffUtc"), "cutoffUtc")
    raw_examples = payload.get("examples")
    if not isinstance(raw_examples, list) or len(raw_examples) > 500:
        raise ValueError("examples must be an array with at most 500 rows")
    examples = [_example(row, cutoff) for row in raw_examples]
    if len(examples) < 40:
        raise ValueError("At least 40 reviewed rows are required")
    if len({x.household_key for x in examples}) != len(examples):
        raise ValueError("Households must be distinct across Training and Validation")
    if len({x.rubric_version for x in examples}) != 1:
        raise ValueError("One reviewed scoring rubric is required")
    training = sum(x.partition == "TRAINING" for x in examples)
    validation = sum(x.partition == "VALIDATION" for x in examples)
    if training < 30 or validation < 10:
        raise ValueError("At least 30 Training and 10 Validation households are required")
    return cutoff, examples


def _mse(expected: np.ndarray, predicted: np.ndarray) -> float:
    if expected.size == 0 or expected.shape != predicted.shape:
        raise ValueError("Prediction shape is invalid")
    value = float(np.mean(np.square(predicted - expected)))
    if not math.isfinite(value):
        raise ValueError("MSE is not finite")
    return value


def _portable_lookup(model: ExplainableBoostingRegressor) -> list[float]:
    combinations = np.asarray(
        list(itertools.product(range(4), repeat=len(FEATURES))),
        dtype=np.float64,
    )
    predictions = np.asarray(model.predict(combinations), dtype=np.float64)
    if predictions.shape != (4 ** len(FEATURES),) or not np.isfinite(predictions).all():
        raise ValueError("EBM portable lookup predictions are invalid")
    return [float(x) for x in predictions]


def train_payload(payload: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    installed = metadata.version("interpret-core")
    if installed != INTERPRET_CORE_VERSION:
        raise RuntimeError(
            f"interpret-core {INTERPRET_CORE_VERSION} is required; found {installed}"
        )

    cutoff, examples = _validate(payload)
    x = np.asarray([row.scores for row in examples], dtype=np.float64)
    y = np.asarray([row.target for row in examples], dtype=np.float64)
    bags = np.asarray(
        [[1] if row.partition == "TRAINING" else [-1] for row in examples],
        dtype=np.int8,
    )

    parameters = {
        "feature_names": list(FEATURES),
        "feature_types": FEATURE_TYPES,
        "max_bins": 8,
        "max_interaction_bins": 8,
        "interactions": 0,
        "validation_size": 0.15,
        "outer_bags": 1,
        "inner_bags": 0,
        "learning_rate": 0.04,
        "greedy_ratio": 0.0,
        "smoothing_rounds": 0,
        "interaction_smoothing_rounds": 0,
        "max_rounds": 1000,
        "early_stopping_rounds": 50,
        "early_stopping_tolerance": 1e-5,
        "min_samples_leaf": 4,
        "max_leaves": 2,
        "monotone_constraints": None,
        "objective": "rmse",
        "n_jobs": 1,
        "random_state": 0,
    }
    model = ExplainableBoostingRegressor(**parameters)
    model.fit(x, y, bags=bags)

    train_mask = np.asarray([row.partition == "TRAINING" for row in examples])
    validation_mask = ~train_mask
    training_predictions = np.asarray(model.predict(x[train_mask]), dtype=np.float64)
    validation_predictions = np.asarray(model.predict(x[validation_mask]), dtype=np.float64)

    official_model = model.to_jsonable(detail="all")
    portable = {
        "schema": ARTIFACT_FORMAT,
        "modelVersion": MODEL_VERSION,
        "library": {
            "name": "interpret-core",
            "version": installed,
        },
        "featureOrder": list(FEATURES),
        "featureDomain": [0, 1, 2, 3],
        "predictionLookupIndex": "base4(featureOrder)",
        "predictionLookup": _portable_lookup(model),
        "officialInterpretMlModel": official_model,
    }
    artifact_bytes = json.dumps(
        portable,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    artifact_sha = hashlib.sha256(artifact_bytes).hexdigest()

    training_targets = y[train_mask]
    validation_targets = y[validation_mask]
    report = {
        "modelVersion": MODEL_VERSION,
        "artifactFormat": ARTIFACT_FORMAT,
        "artifactSha256": artifact_sha,
        "library": {
            "name": "interpret-core",
            "version": installed,
        },
        "execution": {
            "engine": "HENNA_OWNED_LOCAL",
            "mode": "OFFLINE_RESEARCH_CHALLENGER",
            "networkModelApi": False,
            "dataOrigin": "HENNA_FIRST_PARTY",
        },
        "parameters": {
            key: value for key, value in parameters.items()
            if key not in {"feature_names", "feature_types"}
        },
        "metrics": {
            "trainingCount": int(train_mask.sum()),
            "validationCount": int(validation_mask.sum()),
            "trainingMse": _mse(training_targets, training_predictions),
            "validationMse": _mse(validation_targets, validation_predictions),
            "rubricVersion": examples[0].rubric_version,
            "cutoffUtc": cutoff.isoformat().replace("+00:00", "Z"),
        },
        "governance": {
            "winner": None,
            "approved": False,
            "proposalCreated": False,
            "pilotAuthorized": False,
            "runtimeApplied": False,
        },
    }
    return artifact_bytes, report


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Train Henna's official InterpretML EBM offline research challenger."
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--artifact", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Input root must be a JSON object")
    artifact, report = train_payload(payload)
    _atomic_write(args.artifact, artifact)
    _atomic_write(
        args.report,
        json.dumps(
            report,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8"),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
