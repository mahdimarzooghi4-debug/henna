# Frontend 045 — Organization Recipient CSV/XLSX Import

## Scope

Activates the batch-upload card from Figma on:

`/organization/people/add`

The existing single-recipient form remains unchanged.

## Visual implementation

The Figma batch card is kept as a bordered white card with:
- title and explanatory copy
- dashed cream drop zone
- exact local upload icon exported from Figma
- template-download action
- primary batch action

Functional status, target-program selection and result/error states are added
inside the same card without changing the surrounding two-card layout.

## Template

`GET /api/organization/recipients/import`

returns a UTF-8 BOM CSV template with the Backend 044 accepted Persian headers:

- نام و عنوان نمایشی
- شناسه موردنیاز سازمان
- شماره همراه در صورت نیاز

The template contains no sample person row, preventing accidental import of
fake data.

## Browser upload

`POST /api/organization/recipients/import`

Browser multipart contains exactly:
- programId
- file
- idempotencyKey

The BFF:
- requires exact same-origin Origin
- rejects query parameters
- bounds request/file size
- accepts only .csv / .xlsx
- validates program id + UUID idempotency key
- reads only the HttpOnly Hana session cookie
- forwards Bearer server-to-server
- moves idempotencyKey into the upstream header
- forwards only programId + file to Backend 044
- never forwards the browser cookie

## Idempotent retry

The client keeps the same UUID while the selected File object and target
program remain unchanged.

A network retry therefore replays the same batch safely. Selecting another file
or program creates a fresh key. Successful 201/200 clears the attempt.

## Success privacy

Backend 044 returns row recipient DTOs for deterministic replay validation.

The browser BFF validates them but intentionally drops those row DTOs and
returns only:
- importedCount
- matchedCount
- needsMatchCount
- atomic
- importedAtUtc

Raw identifiers, phones, masked recipient rows, tenant/account IDs, HMACs and
audit identifiers are not needed by this screen.

## Error rendering

422/409 row errors are strictly parsed and shown with:
- row number
- stable error code
- human-readable message

No raw identifier or phone is shown.

The UI explicitly states that row/file failures are atomic: zero rows from that
request were committed.

## Target programs

The same server-loaded Program options as Frontend 043 are reused, so only
REGISTERED and ACTIVE programs are offered.

If a selected program disappears or becomes ineligible, the UI requires an
explicit reload. It never silently substitutes another target program.

## Limits

Client and BFF mirror Backend 044:
- CSV/XLSX only
- max 2 MiB file
- Backend-enforced max 500 data rows

Backend remains authoritative for file structure, row count, XLSX formulas,
text identity cells, duplicate policy and transaction atomicity.

## Next

After CI is green, the People & Recipients section has both real single and
bulk enrollment. The next production domain can move to Allocation only after
allocation/entitlement business rules are approved.
