# Henna allocation learning — foundation

Status: offline evaluation and internal PostgreSQL recording infrastructure; no trained AI,
provider integration, public research ingestion/export endpoint, live event producer, pilot activation
or production deployment yet.

The Domain simulator compares a versioned baseline with proposed six-dimension weights.
It freezes household assessments and geography and compares unrounded POOL_NEEDS shares
in one funding pool governed by one source instruction. Units are rials. These previews
must never be posted to a wallet; settlement rounding and eligibility remain separate.
It does not alter the existing allocation calculator or historic allocations.

The Application proposal-provider interface is the boundary for a future statistical model.
There is deliberately no provider implementation or model credential at this stage.
Any provider output is an untrusted draft, not an approved coefficient version.

## Data and evaluation to add before training

The internal recorder now persists pseudonymous assessment snapshots, source instruction,
formula/dataset version, allocation result, timestamps and structured outcome observations.
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

Start with a simple statistical model when adequate reviewed data exists. A language model
may explain reports, but must not infer diagnoses, replace eligibility review, or decide
payments. No model is claimed to be trained by this foundation.

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
