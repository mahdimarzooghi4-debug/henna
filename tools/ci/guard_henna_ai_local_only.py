#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
SCOPES = [
    ROOT / "src/Hana.Domain/Credit",
    ROOT / "src/Hana.Application/CreditLearning",
    ROOT / "src/Hana.Infrastructure/CreditLearning",
    ROOT / "tools/ai",
]
FORBIDDEN = {
    "System.Net.Http": "network HTTP client",
    "HttpClient": "network HTTP client",
    "HttpRequestMessage": "network HTTP request",
    "HttpWebRequest": "network HTTP request",
    "WebClient": "network client",
    "GrpcChannel": "network gRPC client",
    "RestSharp": "REST client dependency",
    "OpenAI": "external model SDK/provider",
    "Anthropic": "external model SDK/provider",
    "Gemini": "external model SDK/provider",
    "Azure.AI": "external AI SDK/provider",
    "Amazon.Bedrock": "external AI SDK/provider",
    "SemanticKernel": "model orchestration dependency",
    "Ollama": "model API dependency",
    "http://": "network URL",
    "https://": "network URL",
}
PACKAGE_FORBIDDEN = re.compile(
    r'PackageReference[^>]+Include="(?:OpenAI|Anthropic|Azure\.AI\.[^"]+|'
    r'AWSSDK\.Bedrock[^"]*|Microsoft\.SemanticKernel[^"]*|RestSharp|'
    r'Grpc\.Net\.Client|Ollama[^"]*)"',
    re.IGNORECASE,
)

problems: list[str] = []
files: list[Path] = []
for scope in SCOPES:
    if scope.exists():
        files.extend(
            path for pattern in ("*.cs", "*.py")
            for path in scope.rglob(pattern)
            if path.is_file()
        )

for path in files:
    text = path.read_text(encoding="utf-8")
    for token, reason in FORBIDDEN.items():
        if token.lower() in text.lower():
            problems.append(
                f"{path.relative_to(ROOT)}: forbidden {reason}: {token}"
            )

for project in ROOT.rglob("*.csproj"):
    text = project.read_text(encoding="utf-8")
    match = PACKAGE_FORBIDDEN.search(text)
    if match:
        problems.append(
            f"{project.relative_to(ROOT)}: forbidden model/network package: "
            f"{match.group(0)}"
        )

provider_files = [
    ROOT / "src/Hana.Application/CreditLearning/IAllocationProposalProvider.cs",
    ROOT / "src/Hana.Application/CreditLearning/ExperimentalAllocationProposalProvider.cs",
]
for path in provider_files:
    if path.exists():
        problems.append(
            f"{path.relative_to(ROOT)}: replaceable model-provider abstraction is forbidden"
        )

learner = ROOT / "src/Hana.Domain/Credit/ExperimentalAllocationWeightLearner.cs"
if not learner.exists():
    problems.append("Henna-owned learner source is missing")
else:
    text = learner.read_text(encoding="utf-8")
    if 'ModelVersion = "henna-' not in text:
        problems.append("Henna-owned learner must use a henna-* model version")

xgboost_learner = ROOT / "src/Hana.Infrastructure/CreditLearning/HennaXGBoostOfflineLearner.cs"
if not xgboost_learner.exists():
    problems.append("Henna XGBoost offline learner source is missing")
else:
    text = xgboost_learner.read_text(encoding="utf-8")
    if 'ModelVersion = "henna-xgboost-v1-offline"' not in text:
        problems.append("Henna XGBoost learner must use the approved v1 model version")

infra_project = ROOT / "src/Hana.Infrastructure/Hana.Infrastructure.csproj"
if infra_project.exists():
    project_text = infra_project.read_text(encoding="utf-8")
    if 'Include="XGBoostSharp-cpu" Version="0.5.2"' not in project_text:
        problems.append("Henna XGBoost learner must use the pinned CPU-only package")
    if "XGBoostSharp-cuda" in project_text:
        problems.append("CUDA XGBoost package is not approved for Henna v1")


ebm_requirements = ROOT / "tools/ai/requirements-ebm.txt"
if not ebm_requirements.exists():
    problems.append("Henna EBM offline challenger dependency pin is missing")
else:
    requirement_lines = [
        line.strip() for line in ebm_requirements.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if requirement_lines != ["interpret-core==0.7.8"]:
        problems.append(
            "Henna EBM challenger must use exactly interpret-core==0.7.8"
        )

ebm_tool = ROOT / "tools/ai/henna_ebm_challenger.py"
if not ebm_tool.exists():
    problems.append("Henna official EBM offline challenger source is missing")
else:
    ebm_text = ebm_tool.read_text(encoding="utf-8")
    if 'MODEL_VERSION = "henna-ebm-v1-offline"' not in ebm_text:
        problems.append("Henna EBM challenger must use the approved v1 model version")
    if 'INTERPRET_CORE_VERSION = "0.7.8"' not in ebm_text:
        problems.append("Henna EBM challenger must pin the approved InterpretML version")

native_runtime_package = 'Include="libxgboost-2.0.3-linux-x64" Version="1.0.3"'
for relative in [
    "apps/api/Hana.Api/Hana.Api.csproj",
    "apps/workers/Hana.Worker/Hana.Worker.csproj",
    "tests/Hana.Infrastructure.Tests/Hana.Infrastructure.Tests.csproj",
]:
    runtime_project = ROOT / relative
    runtime_text = runtime_project.read_text(encoding="utf-8")
    if native_runtime_package not in runtime_text:
        problems.append(
            f"{relative}: pinned Linux x64 XGBoost native runtime carrier is required"
        )

if problems:
    print("Henna AI local-only guard failed:", file=sys.stderr)
    for problem in problems:
        print(f"- {problem}", file=sys.stderr)
    raise SystemExit(1)

print(
    "Henna AI local-only guard passed: no model/network API dependency in "
    "learning layers and no replaceable remote-provider abstraction."
)
