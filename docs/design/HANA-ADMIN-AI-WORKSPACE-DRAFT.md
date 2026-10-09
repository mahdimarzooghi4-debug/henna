# AI Workspace UX — draft implementation and Figma reconciliation

**Status:** DRAFT PROPOSAL / pending visual Figma review; not an approved Figma frame.
**Source:** accepted ADR-048, ADR-051/053/057, ADR-063 through ADR-067 and v1.1 research contracts.
**Source file:** \`apps/web-marketplace/app/admin/allocation-ai/page.tsx\`.
**Route:** \`/admin/allocation-ai\`.

## What was built

An RTL, responsive, keyboard-friendly Persian Admin AI workspace using Henna's actual typography and CSS color tokens. It groups eight **existing routes** by workflow, prominently distinguishes the existing six-feature experimental workflow from the seven-feature v1.1 research-only contract, and explains the distinct pre-allocation Need Severity and post-allocation Essential Needs Coverage objectives. It never claims a live Production status from a hardcoded dashboard number, computes scores, fabricates a candidate, or invokes side-effecting APIs.

The four journey cards link to existing assessments, outcomes, legacy training, and read-only cross-model comparison; the evidence panel links to training history, Shadow benchmarks, human-reviewed proposals, and research retention. Human governance is stated prominently.

The new v1.1 backend capabilities currently do **not** have an authenticated BFF and Admin intake for seven-feature review, qualitative need severity, full-universe reconciliation and partition preflight, and remain clearly marked unavailable as Web actions. Links to these missing workflows are intentionally NOT provided. The existing \`/admin/allocation-training\` is explicitly marked as six-feature experimental work, and must never masquerade as seven-feature approved model training.

## Figma status and next visual approval

Figma file: \`uREafnhmH5dDRwPraBOmuk\`. The live Figma MCP returned **Starter-plan tool-call limit**, so no screenshot, new Figma node, pixel-perfect match or Code Connect mapping was claimed. There is not yet an authorized immutable node ID for this new AI workspace. The code-first visual treatment is therefore **DRAFT**, with no changes to existing approved/Draft Figma nodes. When Figma read/write access becomes available, prepare and seek explicit design approval of desktop/mobile states (navigation, empty/error, evidence lineage mismatch, abstention, two independent learning objectives, human promotion boundary), then record the exact node IDs in \`HANA-FIGMA-CODE-RECONCILIATION.md\` before claiming Figma fidelity.

## Tests and release boundary

The existing real Chromium Playwright allocation browser suite checks the new workspace, all navigation destinations and mobile overflow, and asserts six/seven feature distinctions and no implied automatic Production promotion.

This PR remains Draft/Open and must not be merged or marked Ready without explicit user instruction. No iOS Native, Stage, Production, AI runtime, banking, wallet, model promotion, new thresholds or unsourced health labels.
