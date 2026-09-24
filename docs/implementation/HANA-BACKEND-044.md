# Backend 044 — Atomic CSV/XLSX Recipient Import

## Scope

Backend 044 activates the Figma batch-upload contract for Organization
recipients.

It imports recipient enrollment records only. It does not:
- allocate credit
- create entitlements
- move balances
- create wallet state
- record usage
- write ledger entries

## Endpoint

`POST /api/v1/organization/recipients/import`

Required:
- valid Hana session
- active organization membership
- role `PORTAL_ADMIN`
- `Idempotency-Key: <non-empty UUID>`
- `multipart/form-data`
- one text field: `programId`
- one file field: `file`

No query parameters are accepted.

## Supported files

- UTF-8 CSV
- XLSX
- maximum compressed/upload file size: 2 MiB
- maximum data rows: 500
- first worksheet only for XLSX
- formulas are rejected
- external reference and phone XLSX cells must be stored as text so Excel
  cannot silently remove leading zeros
- XLSX expanded ZIP content is bounded to protect against zip bombs

Accepted header aliases map to exactly three logical columns:
- `displayName` / نام / نام و عنوان نمایشی
- `externalReference` / شناسه / شناسه موردنیاز
- `phone` / شماره همراه / شماره تلفن همراه

Unknown populated columns are rejected.

## Target program

The entire file targets one `programId`, supplied separately from the file.

New import is accepted only when the tenant-owned program is:
- `REGISTERED`
- `ACTIVE`

DRAFT/PAUSED/ENDED fail with 409. A foreign program ID is 404.

Safe idempotent replay is checked before the program's current status, so a
lost success response can still be replayed after the program later pauses.

## Atomicity

The import is **all-or-nothing**.

Every row is parsed and validated before insertion. If any row has an input
error, no recipient or import-audit record is written.

Existing-recipient conflicts also abort the whole batch. A valid row is never
silently inserted beside a conflicting row.

The target Program row is locked `FOR UPDATE` during the commit transaction,
so its eligible lifecycle state cannot change between the final check and the
recipient insert.

## Row errors

422 is used for input/file errors such as:
- invalid/missing columns
- invalid name/reference/phone
- formula cells
- numeric XLSX identity/phone cells
- duplicate normalized reference inside the file
- row/file limits

409 is used for state/data conflicts such as:
- duplicate recipient already in the target program
- incompatible idempotency-key reuse
- target program becoming ineligible

Error entries contain only:
- row number
- field
- stable error code
- human-readable message

Raw references and phone values are not echoed.

## Privacy

The raw organization reference is normalized only in memory.

For each row:
- only the masked reference is persisted for display
- keyed HMAC-SHA256 reference pseudonym is persisted for duplicate detection
- optional phone is used only for verified Hana-account lookup
- phone is not persisted in Organization storage
- matched account ID remains internal

The existing independent
`OrganizationRecipients:FingerprintKeyBase64` secret is reused only within
the recipient pseudonymization domain, with domain-separated HMAC purposes.
OTP/authentication secrets remain separate.

## Batch idempotency and audit

A committed import has its own
`organization.recipient_imports` record keyed by:

`(organization_id, import_key)`

It stores:
- target program
- keyed batch fingerprint
- row count
- actor account ID
- commit timestamp

No raw file data, recipient reference or phone is stored in the import record.

Each bulk-created recipient also stores:
- `import_key`
- source row number

and is database-linked back to the import audit record.

Same key + same canonical rows/program:
- first commit => 201
- replay => 200 with the original imported recipients

Same key + changed batch/program => 409.

Concurrent equal imports converge on one committed import via the database
primary key and transaction. Different concurrent batches that race on the same
recipient pseudonym leave one winner; the loser rolls back completely and gets
row-level 409 conflicts.

## Matching

All valid optional phones are looked up in one bounded Identity query.

Verified Hana account:
- `MATCHED`
- internal matched account ID

No verified account / no phone:
- `NEEDS_MATCH`

## Database integrity

Adds:
- recipient import audit table
- recipient import key + source row number
- unique tenant/import/row guard
- FK from bulk recipient rows to their import audit record
- composite tenant/program FKs
- explicit FK indexes to keep EF model/snapshot stable

## QA

Real PostgreSQL integration coverage includes:
- 401 / 403
- foreign target 404
- ineligible target 409
- CSV Persian/English headers
- quoted CSV values
- row validation with zero partial writes
- duplicate-inside-file normalization
- successful two-row import
- verified Hana match + unmatched row
- no raw reference/phone/HMAC/audit/financial fields in response
- import audit persistence
- row-to-import persistence linkage
- same-key replay
- changed same-key conflict
- existing-recipient atomic conflict
- replay after target pause
- concurrent equal import convergence
- XLSX text import
- XLSX numeric external-reference rejection
- unsupported file-type rejection

## Next

Frontend 045 can enable the existing Figma CSV/XLSX card, provide a canonical
template download, choose an eligible target program, upload with an
idempotency key, and render row-error reports without exposing raw identity
values.
