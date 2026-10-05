# Henna allocation learning — foundation

Status: Henna-owned experimental offline supervised learner with internal PostgreSQL recording and evaluation;
no external/internal network model API, no production-trained model, no automatic production activation
or production deployment yet.

The Domain simulator compares a versioned baseline with proposed six-dimension weights.
It freezes household assessments and geography and compares unrounded POOL_NEEDS shares
in one funding pool governed by one source instruction. Units are rials. These previews
must never be posted to a wallet; settlement rounding and eligibility remain separate.
It does not alter the existing allocation calculator or historic allocations.

The learner is a Henna-owned in-process statistical implementation. The replaceable
model-provider abstraction has been removed so a remote model cannot be introduced as a
configuration change. It needs independently reviewed labels and no model credential or
network inference endpoint exists. Any learner output is an untrusted draft, not an approved
coefficient version.

## Data and evaluation to add before training

The internal recorder persists pseudonymous assessment snapshots, source instruction,
formula/dataset version, allocation result, timestamps and structured outcome observations.
Only snapshots recorded internally by Henna without attributed/manual-import provenance are
training-eligible. Human-attributed assessment capture remains research/audit material and is
explicitly excluded from labels and training.
Retention controls and connection to actual allocation/purchase event producers remain to implement.
Keep identity mapping and health details outside model datasets. Access must be authorized.
Track credit usage alongside stock availability, delivery/access constraints, essential-needs
coverage and reviewed complaints. Spending alone is not a need label; unused credit does
not automatically mean lower need. Define outcome labels and review their bias first.

Before accepting a candidate, evaluate on held-out time periods, inspect household and
regional impacts, report adequacy and fairness, and account for incomplete observations.
The simulator provides numeric changes only; it does not certify fairness or improvement.

## Human-controlled rollout

Draft -> validated candidate -> offline comparison -> human review -> limited pilot ->
explicit activation. Durable review, reviewer identity and rationale now exist for proposals;
rollback and pilot limits remain to implement before allowing activation. Maintain a fixed
coefficient version for each allocation run; never silently recalculate earlier grants.
Human approval of a coefficient does not override the funding source's instructions.

Start with a simple Henna-owned statistical model when adequate reviewed first-party data
exists. No language-model or remote inference dependency is part of this architecture.
No model may infer eligibility, replace human review, decide payments, or activate itself.
No production model is claimed to be trained by this foundation.

## Internal recording

Set `ConnectionStrings__AllocationLearningDb` only in the operator environment. The API registers
the internal recorder when this separate connection is configured. Apply its separate schema
explicitly with `dotnet run --project apps/api/Hana.Api -- --apply-learning-migrations`.
No migration occurs at ordinary startup. No public ingestion or research export route exists.
Administrative proposal routes are separate from research data ingestion.

`RecordAssessmentAsync` requires a frozen, authorized allocation result in whole rials, a stable
pseudonymous household key, formula/dataset versions and an opaque funding instruction reference.
The caller must not pass names, national identifiers, addresses or diagnoses as references.
It records an existing result; it neither calculates eligibility nor authorizes a payment.

`RecordOutcomeAsync` stores usage, essential-needs coverage in [0,1], stock/delivery/access
barriers and evidence origin. Unknown values remain null. Observation periods must follow
the assessment and end no later than the recording clock. At least one measurement is required.
Repeated event/snapshot IDs fail with a primary-key conflict; callers must handle retries
explicitly and must not generate a new event ID for the same delivery. Overlapping periods
are allowed as distinct evidence; they must not be blindly summed into training labels.

EF writes reject changes/deletions; database constraints enforce ranges and assessment links.
This is application-level append-only protection, not protection against privileged SQL.
Restrict database permissions and implement authorized retention/pseudonym-key deletion before
collecting production household data. A future corrected assessment gets a new snapshot ID.

Integration tests exercise migrations, actual persistence, null preservation, duplicate events,
invalid periods and rewrite rejection when `ConnectionStrings__IdentityDb` points to a test DB.
They create only the isolated `allocation_learning` schema. Local runs without that test variable
omit PostgreSQL integration; the model/snapshot and Domain tests still apply.

## Administrative proposal review

All `/api/v1/admin/allocation-proposals` routes require an active server-side session,
an explicit ADMIN assignment and configured IdentityDb plus AllocationLearningDb. HTTPS is
required outside Development. Responses use `no-store`; database/auth failures fail closed.

| Method / path | Purpose |
| --- | --- |
| POST / | Validate weights and freeze a server-generated pool simulation from 1–500 stored assessment IDs |
| GET / | Paginated proposal list, ordered by creation time |
| GET /{id} | Frozen weights, assessment references, report, rationale and review |
| POST /{id}/review | Record APPROVED or REJECTED with a reason and authenticated reviewer |

Submission requires a new globally unique candidate version, model/proposer version, rationale,
six nonnegative weights summing to one, positive whole-rial pool, dataset version and funding
instruction reference. Stored snapshots must all belong to the same dataset/instruction and
the supported `AllocationWeightProfile.Baseline.Version`; duplicate household assessments are
rejected. Historical formula versions outside this baseline require a separate version resolver.
The simulated pool is a research scenario supplied by the operator, not an authorized budget.

The persisted report is generated from stored assessment data, never accepted from the client.
It reports arithmetic changes only, not fairness or efficacy certification. `ModelVersion` may
identify a manual research proposal; the route does not imply that an AI model generated it.
Each proposal has exactly one final review. The creator cannot review their own proposal;
a second administrator is required. A unique database index resolves concurrent reviews.
Corrections require a new candidate version and proposal, preserving the earlier decision.

All responses explicitly return `active: false`. APPROVED means review accepted, not allocation
activated. There is no activation route, wallet write, retroactive recalculation or frontend
review screen in this increment. Stage review and a controlled pilot remain separate work.

## Experimental supervised weight learner

`ExperimentalAllocationProposalProvider` fits the six weights to independently reviewed
need scores in [0,1] using constrained least-squares coordinate search. It is a small supervised
learning implementation, not an LLM. Targets are reviewed need labels under one scoring rubric,
not purchase volume, unspent credit or the existing formula's own outputs.

Caller-supplied Training and Validation partitions must use entirely different pseudonymous
household keys. At least 30 training and 10 validation examples are required (engineering guard,
not evidence of adequate real-world sample size). Review identities, UTC review times and rubric
versions are required. These supplied identifiers do not prove review authorization: a trusted
label ingestion/audit workflow must verify them before production training.

Fit starts from the versioned baseline; steps transfer 0.01 between weights, keeping the sum at
one and each weight nonnegative. Each weight may move at most 0.05 from baseline. Search is
bounded to 200 iterations. Validation labels never choose the search steps. A candidate is
returned only if held-out mean-squared error improves by at least 1%; otherwise training reports
no acceptable candidate. This threshold is experimental, not a validated business approval rule.

The output contains training and validation errors, sample counts, rubric, UTC cutoff and a
SHA-256 fingerprint covering reviewed inputs, partition, baseline and model version. Keeping
the same inputs and cutoff reproduces the fit. The provider also returns dataset version and
checks that label features match the supplied assessment cases. Geography remains fixed; only
household weights are learned. Held-out performance does not prove fairness or causal impact.

Synthetic tests demonstrate fitting, repeatability, validation separation and fail-closed
handling. They are not training on actual Henna beneficiaries. The provider is not registered
for HTTP training and has no training endpoint yet. The internal workflow below now submits
successful candidates to the proposal queue. Representative/time-separated evaluation, fairness
checks and pilot activation remain future work.

## Reviewed labels and completed training-run audit

The internal `AllocationTrainingWorkflow` connects persisted first-party Henna snapshots,
reviewed labels, the local learner and proposal queue. It rejects any attributed/manual
assessment before labeling and again before training. It is registered when both databases are configured. There is no HTTP label
or training route yet; internal callers must resolve an active session before supplying an actor.
The workflow checks that the supplied actor currently has a server-side ADMIN assignment.

`ReviewNeedAsync` records a 0–1 reviewed need label, reviewer identity, rubric, training/validation
partition and server timestamp against an existing assessment. It cannot rewrite a label;
one snapshot/rubric pair is unique. A correction uses a new rubric version. The reviewer must
establish the label independently under a documented rubric; code cannot establish that a
human judgment was unbiased or prevent a reviewer copying an existing formula's output.

`TrainAsync` consumes 40–500 distinct label IDs from one dataset, supported baseline and funding
instruction. It reconstructs features from stored assessments, rejects labels beyond a supplied
past UTC cutoff and relies on the learner to reject household overlap or mixed rubrics. A completed
run freezes labels, features, review identities, model/baseline versions, pool and input references.
Successful training creates a PENDING_REVIEW proposal plus metrics and a linked PROPOSED audit
in one database transaction. If evaluation reports no improvement, only a NO_IMPROVEMENT audit
is stored. Invalid inputs or infrastructure errors abort without a completed run; they are not
recorded as successful training. Exact repeat of a successful candidate version conflicts with
the existing proposal instead of silently inserting a duplicate.

Proposal detail includes the associated training-run ID and numeric learning metrics for
administrators. Review approval remains inactive. Tests exercise both successful and no-improvement
training on explicitly synthetic labels, PostgreSQL persistence, authorization and audit immutability.
No real Henna household labels have been collected or trained in this increment.

## Administrative web review

`/admin/allocation-proposals` provides a responsive Persian RTL review page using the existing
site font. It loads the real proposal list and detail, shows learned weights, available training
metrics and unrounded rial simulation shares, and requires a reason for approval/rejection.
It handles loading, empty results, authorization errors, service failures and completed decisions.

The Next gateways use the existing HTTP-only session cookie and forward the bearer only from
the server. Mutations require the existing exact same-origin check. Backend ADMIN authorization
remains authoritative. No token enters client JavaScript. Responses are non-cacheable and report
schema is validated before display. Approval still does not activate allocations.

The review page has no label-ingestion or training controls yet; those internal operations need
their own reviewed administrative HTTP contracts. This page is a functional addition using existing
brand styles, not a claimed reproduction of an unseen Figma screen. Browser tests use CI fixtures
to verify review interactions, access denial, empty state and mobile reflow against real Next UI.


## Administrative reviewed labels and experimental training

The `/admin/allocation-training` page uses server-only cookie-to-bearer gateways and the same live session/ADMIN checks as proposal review. It marks only first-party Henna snapshots as training-eligible; attributed/manual rows are visible only as non-training research evidence. Routes under `/api/v1/admin/allocation-proposals/research` list paginated stored assessment features (without household identifiers), append reviewed labels, list up to 500 labels for an exact rubric version, and run the existing audited training workflow. The server chooses the training cutoff in the web gateway; the API validates UTC and rejects future cutoffs. Review identity and review timestamp come from the authenticated server context. Duplicate labels return conflict. No production assessment ingestion or synthetic seeding was added.

Operators select actual persisted labels, with at least 30 training and 10 independent validation households, one dataset/source/baseline/rubric. These are engineering minimums, not evidence of statistical adequacy. Improving candidates stay pending review; non-improvement creates only a training audit. No coefficient activation, payments, or wallet mutation occurs. Training remains bounded and synchronous; a timeout can occur after a committed run, so investigate the recorded proposal before retrying. Production queueing, idempotent job submission and rollout remain future work.


## Attributed assessment capture

`/admin/allocation-assessments` and POST `/api/v1/admin/allocation-proposals/research/assessments` let an authenticated current administrator capture a documented external assessment. All six integer 0–3 scores are required (missing is not zero), along with a stable pseudonymous household UUID, dataset/source versions, positive approved geographic factor, nonnegative whole-rial allocation and a past UTC assessment time. The server fixes the supported baseline version and records the authenticated actor and evidence reference. Existing internal snapshots retain null provenance; new HTTP captures require both fields. This is human-attributed intake, not automatic verification of an external dossier, MPI table or payment decision. The operator must use the approved mapping and source document.

Snapshots remain append-only. The browser retains one snapshot UUID across retries; duplicate IDs return 409 without overwriting. There is no national-ID intake, synthetic production seed, wallet write or automatic ingestion connector. Capture → reviewed label → audited training → independent proposal review is now navigable in the administrative UI. The migration adds nullable provenance fields without fabricating authors for historical snapshots. Production migration, real evidence validation and external-source integration are still separate rollout tasks.


## Completed training run history

`/admin/allocation-training-runs` lists paginated completed runs and reads a report derived from each frozen input snapshot. Authenticated current ADMIN authorization and no-store responses apply to list and detail. The report exposes dataset/model/rubric/source, scenario amount, training/validation counts, cutoff and optional metrics, without raw household features, reviewer identifiers or input JSON. Proposal links open the specific proposal for review. NO_IMPROVEMENT is visible as an audited completed result with no candidate. Missing history does not prove an earlier timed-out request never ran; persistent jobs/idempotent training submission are still future work.


## Henna-owned AI boundary

ADR-042 is normative for this subsystem. The learner code, versioning, training and
candidate weights belong to Henna and run locally inside Henna processes. CreditLearning
source code may not contain HTTP/gRPC model clients, model-provider SDKs or direct network
model URLs. CI enforces this with `tools/ci/guard_henna_ai_local_only.py`.

Administrative HTTP routes are control-plane workflows for authenticated humans; they are
not model APIs and the learner never calls them. Training consumes persisted first-party
Henna records directly from PostgreSQL. Each frozen training run records
`HENNA_OWNED_LOCAL`, `networkModelApi=false` and
`dataOrigin=HENNA_FIRST_PARTY`.

This design supports learning over time without autonomous online self-modification:
new Henna data can enter reviewed datasets, but every new candidate still passes held-out
evaluation and independent human review before any future activation mechanism may use it.
