# Henna seller image library — owner-requested UX reorganization

Date: 2026-11-12
Scope: `/seller/panel/images`, Figma-derived **seller design-preview route** only.

## Problem addressed
The prior image gallery mixed upload, used/unused filtering, preview and deletion with no clear workflow, and could appear to imply server-backed media management. The user requested a full usability reorganization of the screenshot's library.

## Preview UX contract
1. Three-step guidance: add → inspect → use on a product when real media integration is approved.
2. Clear sample and local-only labels, summary counts, search, used/unused/local filters, deterministic sorting.
3. Selected-image detail panel with preview, sample association, file metadata where available, and a link to the **preview** listing form, explicitly not an automatic image attachment.
4. Only local unassigned images may be removed from the current browser session, with explicit confirmation and object URL cleanup. Sample/used images are not removable.
5. Files accepted for client preview: JPG, PNG or WebP; size > 0 and <= 10 MiB, consistent with previous client behavior. Invalid files are rejected, and mixed batches disclose partial acceptance.
6. Accessible control labels, focus states, responsive layout, empty/no-selection feedback and local notices.
7. All additions/deletions are **client memory only**. No remote upload, crop operation, quality scoring, product-image assignment, server deletion, or durable saving.

## Architectural boundary
This preview route remains behind the existing `HANA_AUTH_UI_PREVIEW=1` gate in `app/seller/panel/[section]/page.tsx`. It is **not** the operational seller dashboard or a proof that the backend supports media management. Current actual backend-connected seller operations use their existing, separate APIs and must not be replaced with mock data.

A production media library requires an explicit API/persistence/evidence contract covering media identity, seller tenancy, upload attestation/scanning, storage, reference assignment, usage checks, safe removal/replacement, authorization, audit and delivery of media. None of those contracts are invented by this frontend change.

## Verification
- Pure unit checks for file acceptance and filter/search/sort without mutation.
- Chromium on the actual Next production build with the preview flag enabled only in the isolated test server: guidance, sample selection, used/unused filters, search and empty state, mixed valid/invalid upload, cancellation/removal of a local preview, mobile breakpoint and no API mutations.
- Full CI including the established backend/mobile/Android jobs must remain green before Stage integration.

Do not merge the parent Draft PR #228 into `main` or deploy Production as a consequence of this preview UX change.
