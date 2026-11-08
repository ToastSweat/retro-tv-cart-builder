# Phase 3.2 — integration QA, not an acceptance checkpoint

**Status: corrected v3 passed both independent technical re-reviews with no blocking findings. Phase 3.2 is ready for Shawn's testing; owner acceptance remains pending. Do not begin Phase 4.** Shawn authorized implementation with **"yes, pelase proceede"** after approving Phase 3.1. See the [implementation acceptance checkpoint](20-HERMES-PHASE-3.2-LIBRARY-ACCEPTANCE-CHECKPOINT.md). Historical failures below remain preserved rather than erased.

## Reading order and current artifacts

1. Master handoff and [owner decisions](11-USER-PHASE-1-DECISIONS.md).
2. [Approved revised mockup](17-HERMES-PHASE-3.1-REVISED-MOCKUP-CHECKPOINT.md), [revision decisions](16-HERMES-PHASE-3.1-REVISION-DECISIONS.md).
3. [Shared implementation contract](18-HERMES-PHASE-3.2-IMPLEMENTATION-CONTRACT.md).
4. This current QA record. Passing component tests below are historical baseline evidence, not final acceptance.

Runtime files now exist under `TOOLKIT/setup/`: `library-store.js`, `library-storage.js`, `library-jobs.js`, `library-media.js`, `library-http.js`, `live-workspace.js`, `live-workspace.css`, and `Select-LibraryFile.ps1`. The setup controller/index/server/launcher integrate the live combined surface. Original Studio and engine scripts are unchanged. The Phase 3.1 mock remains an isolated static example; its browser test was adapted to coexist with legitimate polling in the separate live tab.

## Baseline implementation evidence

- Initial integrated dependency-free/native suite: **201 tests passed** across eleven explicit files before the audit-driven corrections. This is not a final current count.
- Real setup/navigation browser harness: **11 check groups passed**, including real registration, durable metadata, source probe, integer-crop/removed-second recipe, source frame, playable preview, prepared variant, retained drafts and 400px geometry.
- Isolated mock browser regression: **21 check groups passed**; zero API requests from the mock page, zero project write calls. Live-tab polling is measured separately rather than misattributed to the mock.
- Parent's larger `TOOLKIT/setup/tests/browser-library.cjs` initially exposed a composite-profile failure after its earlier tasks passed. After correction, both parent and independent v3 review completed all 10 workflow groups, including cancellation/retry/relink/removal. The initial failed disposable fixtures remain historical evidence.

## Reproduced audit findings and correction ownership

All independent probes used disposable managed metadata and synthetic media. No original library was used as test data. Detailed logs are temporary active-profile scratch artifacts; runnable repository regression tests must carry the durable proof.

| Finding | Reproduced behavior | Correction status / owner |
| --- | --- | --- |
| Health reasons | Whitespace-only reason accepted on source-health change, unlike approved mock. | Corrected; changed-health reason and unchanged-health preservation regressions pass in the catalog suite. |
| Location removal | Historical succeeded probe blocked removal of a scan location although asset references would remain. | Corrected; removal retains assets/history, associates prior individual references and guards active scan snapshots. Component regressions pass. |
| Direct-file stale write | Uncooperative writer changed the catalog after load but before publication; before-image was captured too late. | Publication is now bound to original loaded bytes; independent-child-writer regression passes. No absolute CAS claim against writers racing after the final OS check. |
| Derived-output integrity | Replacing a valid prepared video with nonmedia text left it planning-ready and HTTP-servable. | Immutable output fingerprints now protect planning and serving; real-store same-size/truncated variant/frame/composite tamper regressions pass. Independent v3 default-worker HTTP tamper, HEAD and Range checks passed. |
| Composite planning | Prepared composite had no effective planning projection with ordered constituent pins. | Added separate `composites` projection with ordered source-family/recipe/group/output pins; native short-composite readiness regression passes. |
| Composite cadence | Valid normalized parts could concatenate to a reported 120/1fps stream and fail the strict 30fps output check. | Native RED→GREEN correction verified on retained evidence: final normalization through the unchanged renderer restores 30/1fps, 618×480/SAR1 and AAC 44.1kHz stereo while retaining order and duration bounds. One extra composite normalization encode is required. The correction is preserved in the selected-backend merged build; native and full browser re-review passed. |
| Unicode composite staging | Unicode cache paths failed due to PowerShell 5.1/default JSON decoding and ASCII concat paths. | Both boundaries corrected; real managed Unicode project/cache/output native composition and full decode pass. Selected-backend native and merged re-review passed. |
| Native STRONG repair | Installed FFmpeg 9.0.1 crashed in `anlmdn` for an independent fixture. | Configuration-only fixes did not resolve the input-dependent crash. Owner-authorized app-local maintained-8.1 selection now passes all five unchanged levels three times on the exact crash input, including the real jobs pipeline. Global binaries/PATH and original filters remain unchanged. |
| Interrupted recovery | Lost-owner job stayed permanently blocked after its real child exited; no recovery action. | Explicit checked recovery is implemented and tested against a real live child then confirmed exit. HTTP/UI controls are etag/project bound; final actor/recovery re-review passed. |
| Project-switch race | Another process reserved a job after HTTP's first guard but before `ProjectStore.open(B)`. | Parent fixed transition recheck under app-preferences and sorted managed-project locks; real cross-process regression passes. Start/retry/recover also recheck the active project under the app-preferences lock before synchronous reservation. Final merged re-review passed. |
| Large-library starvation | 500-asset reads took ~10.5s; 6,109-asset reads/status exceeded a 20s bound and blocked timers. | Indexed snapshots and narrow jobs reads pass 6,109-record probes; lightweight context-only project inspection and the persistent off-main-thread service are implemented. Parent actor tests retained responsive main-thread timers during real read, planning and mutation, with recorded maximum gaps below 44 ms. Synchronous catalog CPU cost remains inside the worker; response times vary by dataset/run. No TTL-only authority cache. |
| Scan write amplification | Per-item stage and child-PID updates would retain full-catalog before-images for every probe. | Owned runtime-state publication is implemented; a 13-video real scan now produces 3 lifecycle backups rather than 31. Runtime progress cannot grant success/readiness. |

Additional scan identity checks include associating previously registered individual assets with a newly scanned location and retaining explicit removed-reference decisions instead of silently resurrecting them under new IDs.

## Backend decision after the STRONG crash

Shawn selected **"Test and pin a separate compatible FFmpeg build for this app, leaving global FFmpeg unchanged."** This authorizes verifying candidate artifacts and an app-local codec pair; it does not authorize replacing global binaries/PATH, weakening STRONG's filter or accepting an unreliable level. Candidate selection must be backed by published archive checksum, exact extracted executable pins and repeated native execution of the known failing fixture. Runtime preparation and all-level integration are complete and independently verified. The exact extraction, archive/license and provenance are retained under `TOOLKIT/runtime`; public release/distribution-compliance packaging remains Phase 6, not an approved deployment.

## Parent corrections already exercised

These are narrow verified changes, not a full-phase approval:

- Job service `statusCode` conflicts now remain definite 4xx responses instead of being misreported as uncertain 500 writes.
- HTTP hard-year query values are explicitly validated and converted to the numeric planning contract; no dates are inferred from filenames/notes.
- ProjectStore validates the optional catalog version/shape, reports its asset count without rewriting legacy CSVs, refuses copying active-job sources and locks both managed copy source and destination.
- Project switching/settings confirmation rechecks persisted processing/recovery under shared locks. Legacy source reads do not require writing a lock into the legacy project.
- The actual modern file dialog passed owned-process selection and cancellation, exact Unicode/bracketed full-filename readback, unchanged helper hash and process cleanup. UIAutomation/tree and owned-window capture confirm the Explorer breadcrumb/address bar. Direct address-bar editing/clipboard paste was not automated; full-path entry was exercised in File name. No global SendKeys, clipboard or unrelated-app control was used.
- Server shutdown awaits owned job cleanup; the exact launcher finally block was exercised against an owned Node process tree.
- Live recovery controls do not kill or adopt potentially reused PIDs, do not retry automatically and keep navigation blocked until the recovery fence is released.

## Real legacy metadata proof (disposable copy only)

A parent read-only catalog load resolved the actual legacy project with **6,109 assets, 11 carts and 24 Studio drafts**, without opening the project into user preferences or scanning/probing/processing source media. A separate disposable managed metadata copy then passed: human-note edit, new-instance persistence, unchanged copied legacy CSV and UserNotes provenance, and Settings rename without changing catalog bytes. All **124 protected original hashes** matched before and after. The copy/edit/settings proof took approximately 10.5 seconds in its captured run; this is not a per-request latency or nonblocking claim. The direct read-only cold-ish catalog load took approximately 6.6 seconds on actual distributed metadata, reinforcing the need for the off-thread boundary.

Temporary result: active-profile `cache/scratch/retro-tv-phase32-evidence/real-metadata-copy-results.json`. No original-media playback/probe/render or write was performed. The disposable copy is not a deployment or the owner's selected active project.

## Final technical verification and remaining owner gate

- Corrected v3 has **271 passing tests across 20 complete explicit suites**, plus four real Edge harnesses with **48 passing check groups**. Parent and independent reviewers verified the corrected same-tab form, all 16 accepted range representations and category-isolated availability; v2's technical rejection is resolved, not treated as an earlier approval.
- Both independent reviewers verified the exact **103 pinned files** and complete runtime/test directory membership before/after. No security, logic or scope blockers remain. The runtime reviewer reran all 20 suites cleanly on first execution; the UI reviewer also ran 8 additional focused real-service groups. Earlier unexplained EPERM failures and successful reruns remain recorded; neither final re-review encountered them.
- Native dialog, relaunch/rescan persistence, repaired asset/composite readiness, cancellation/retry/stale recovery, relink/removal and unchanged-original checks are complete within the documented synthetic/disposable scope. Hardware/subjective audio-quality and public-release packaging are not certified.
- Real legacy metadata was read-only and edited only in a disposable managed copy. All **124 original protected hashes** remain unchanged; existing Studio/engine and original media were not used as mutable fixtures.
- **Remaining:** Shawn tests the delivered implementation and approves Phase 3.2 or requests revisions. The [acceptance checkpoint](20-HERMES-PHASE-3.2-LIBRARY-ACCEPTANCE-CHECKPOINT.md) provides launch steps, review tasks and limitations. Stop before Phase 4.

No commits or deployment of a replacement working installation have been authorized.
