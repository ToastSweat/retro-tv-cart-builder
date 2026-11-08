# Phase 3.2 — Library Manager implementation acceptance checkpoint

**Status: corrected v3 implementation passed parent verification and both independent technical re-reviews; Phase 3.2 owner acceptance remains pending. Do not begin Phase 4.** Shawn subsequently reported a scrolling/checkbox usability regression and requested a Collapse toggle. The current UAT correction and its verification status are in [21 — scroll/Collapse revision](21-HERMES-PHASE-3.2-SCROLL-COLLAPSE-UAT-REVISION.md); v3's historical technical approval does not automatically approve that revision.

Shawn approved the [revised Phase 3.1 design](17-HERMES-PHASE-3.1-REVISED-MOCKUP-CHECKPOINT.md), then authorized development with **"yes, pelase proceede"**. This checkpoint covers that implementation, not approval of Cart Builder or the new TV Studio. The [implementation contract](18-HERMES-PHASE-3.2-IMPLEMENTATION-CONTRACT.md) and [integration QA record](19-HERMES-PHASE-3.2-INTEGRATION-QA.md) retain the decisions, discovered failures and corrections.

## Open it

Save any real setup forms before restarting an existing setup console. Stop that console with Ctrl+C, then double-click:

```text
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartSetup.cmd
```

Default address:

```text
http://127.0.0.1:17872/
```

A saved project now opens **directly into the combined workspace**. Library Manager is live. Cart Builder and TV Studio remain labeled placeholders. The original Studio still has its separate launcher and is unchanged.

- For a fresh project, use **Create new** and review/confirm its folders. No private legacy curation is required.
- For the original project, choose **Open existing**, inspect the original data folder, then **Import a copy** into a new empty data folder outside the application installation. Review the locations and confirm. Opening the original without importing is read-only.
- Existing source references are retained in place. Import copies metadata, not source videos or all historical build media. Existing manifests remain pinned to their original paths; keep those locations accessible.
- Settings, project switching and the optional **Approved sample design** link remain accessible. The optional design page is still a separate sample-only mock, not the live Library.

## What is delivered

### Real catalog and durable decisions

- Register individual video references and library locations in place; browse, search, filter, sort, paginate, scan/rescan and cancel scans.
- Category-specific multiple Episode/Commercial classifications, Normal as no special Episode flags, one explicit Branding role and retained per-category proposals.
- Explicit multiple Selection pools, reusable pool definitions, bulk Add/Remove/Replace and deliberate clear-all.
- Stable network/block definitions, editable display names, parent-network distinction, archive/unarchive and dependency-checked deletion. NICK and SNICK are never merged.
- Structured dates and role-appropriate availability, explicit unknown-date policy, show/series, human Notes and source-health reasons.
- Episode and Commercial availability proposals are stored separately in optional schema-1 `availabilityByCategory`. Branding/Other never inherit those restrictions. Historical scalar bounds remain provenance; reading an older catalog performs no migration/write or guess about a previous category.
- One editable human Notes field; its current saved or unsaved summary stays visible while previewing/inspecting. Imported Notes/InferredTags, scalar Pool, Subtype and OriginalID remain read-only provenance.
- Missing-source relink preserves identity, decisions, recipes and history. Removing a scan location stops future scans but keeps asset references. Asset removal never deletes its source; dependency guards and tombstones prevent unsafe removal or silent rescan resurrection.
- Human-readable source/variant associations and ordered composite definitions with explicit recipe pins and history.

The versioned project-owned authority is `STATE/library-catalog.json`. Legacy registry/curation CSVs are not rewritten. Corrupt/unsupported metadata fails closed rather than initializing an empty replacement. Mutations use reviewed context/etags, shared owner-checked locks, verified before-images and staged publication/readback. Do not interpret these protections as malicious-OS-race resistance, filesystem compare-and-swap or power-loss durability guarantees.

### Real media and preparation

- Genuine source playback where the browser supports the source container; rendered preview provides the normalized playback path for other supported video sources.
- Actual probe observations, source reference frames, advisory crop detection and exact final frames.
- Removed-seconds trims and integer **original coded-pixel** crop margins, followed by SAR correction and proportional fit/padding. Visual crop/Fit TV controls use measured source geometry rather than mock percentages.
- Separate **Save recipe**, **Render playable preview** and **Prepare rendered variant** operations. Saving does not encode, mark bad raw media READY or approve a cart.
- All five original audio levels remain: NONE, RESTORE, STRONG, AGGRESSIVE and MAX. Each part's repair starts from its original source. NONE still normalizes through the existing renderer; it is not untouched audio passthrough.
- Ordered composites prepare pinned constituent recipes, assemble derived parts and normalize the result to the TV profile. The final normalization adds one encode per composite; it fixes timestamp/cadence drift without weakening output validation.
- Current prepared variants and composites have explicit planning projections with source-family, ordered constituent, recipe, group and output-integrity pins. Modified/truncated managed outputs cannot retain current readiness or be served as verified outputs.

Target output remains H.264 **618×480**, **30 fps**, yuv420p, square pixels, AAC stereo **44.1 kHz**. Synthetic outputs were independently probed and fully decoded; this is not television/hardware acceptance.

### Real jobs, responsiveness and recovery

Jobs report genuine queued/running stages, current item/count, success/failure/staleness and cancellation. There are no simulate buttons, fake timers or invented percentages. Crop drafting remains responsive during replaceable preview work. Conflicting processing blocks project transitions both in the UI and under cross-process locks.

The live HTTP surface uses a persistent WorkerThread actor for catalog, planning and job services. Expensive catalog work no longer runs on the HTTP event loop. The measured 6,109-record actor fixture completed read/planning in roughly 1.1 seconds and a whole-location mutation in roughly 4.8 seconds while main-thread timers continued firing; maximum recorded timer gaps were below 44 ms. These are captured local fixture measurements, not universal latency promises.

Per-item progress and child PID use exclusively owned runtime files, not full catalog backups for every file. A 13-video scan produced **3** lifecycle catalog backups instead of the reproduced **31**. Runtime progress cannot grant success or output authority.

Cancellation becomes terminal only after the owned native process tree exits. Interrupted worker recovery is explicit and etag-bound; it verifies recorded processes have stopped and never kills/adopts a possibly reused PID or silently accepts retained output. Unexpected service-worker failure fails closed and asks for an application restart rather than automatically replaying commands.

## Selected app-local media backend

Shawn authorized **"Test and pin a separate compatible FFmpeg build for this app, leaving global FFmpeg unchanged."**

The selected pair is **BtbN n8.1.3-25-g611cec792a-20261029**, a maintained 8.1 build. It is pinned by exact executable SHA-256 and vendor archive checksum under `TOOLKIT/runtime/media-backend.json`, with relative portable paths. The full verified extraction, exact archive, GPLv3 license and provenance receipts are retained locally; see [runtime guide](../TOOLKIT/runtime/README.md).

This choice was tested, not assumed: installed 9.0.1, Gyan 9.0.2 and tested master builds crashed in STRONG's `anlmdn` for the selected input. The app-local pair passed **all five unchanged levels three times each** on those exact generated regression bytes, including through the real LibraryStore/LibraryJobs pipeline. Filters were not removed or weakened.

Global codec hashes, command resolution and process PATH matched their pre-pin baseline. Only native children receive the selected bin directory in their own minimal environment. Diagnostics identify the selected pair rather than reporting an unrelated global version. A corrupt/missing present pin fails closed.

The binaries are unsigned; HTTPS/vendor-checksum/exact-byte verification is not Authenticode signing. A source clone intentionally does not contain the large ignored runtime payload. Public installer/bootstrap and complete GPL corresponding-source/distribution packaging remain Phase 6 work; no approved binary release or deployment is claimed.

## Validation record

Parent verification of the corrected v3 candidate:

- **271 tests passed**, zero failures/skips in the final successful complete-suite results across **20 explicitly invoked files**. This includes native renderer/composer tests, output tampering, locks, copy/relaunch persistence, scan tombstones, runtime ownership/recovery, actor responsiveness/shutdown and frontend controller/DOM tests. Initial failed attempts and reruns are qualified below, not erased.
- Actual Edge/HTTP harnesses passed **11 navigation/draft**, **10 complete Library workflow**, **21 isolated-mock** and **6 focused date/form** check groups. Full Library tasks include scan/rescan, category/pool/network changes, native frames/playable preview, repaired planning eligibility, ordered composites, stale-pin updates, responsive crop drafting, safe cancellation, failure/retry, missing-source relink and guarded removal. Date checks cover repeated same-tab saves, all 16 accepted range representations, category availability isolation, reload and genuine in-flight acknowledgement preservation.
- Actual Windows file dialog selected/cancelled correctly with spaces, brackets and Unicode. Its Explorer breadcrumb/address bar was verified. Full-path typing was exercised in File name; direct address-bar editing/clipboard paste was not automated.
- Real legacy metadata resolved read-only: **6,109 assets, 11 carts, 24 Studio drafts**. A disposable managed metadata copy passed human-note persistence across a new instance and Settings changes, while copied legacy CSV/provenance stayed unchanged.
- All **124 protected original files** matched baseline hashes. Original media were not moved, edited, scanned, probed or processed as acceptance fixtures. Native media exercises used generated sources only.
- The approved mock runtime/model remain unchanged. Its browser harness now distinguishes legitimate live-tab polling from mock-page activity; the mock made zero API requests and retained its no-connect/no-media policy.
- Current v3 source/runtime/test approval set is frozen by **103 SHA-256 pins**, including the complete retained codec package membership and archive. No commits were made.

**Recorded test observations:** Windows occasionally returned `EPERM` while renaming a newly staged disposable project directory. The initial failure log was retained; the affected complete suite passed on rerun without a production retry workaround. Cause remains undetermined. One performance-harness startup also needed its explicitly supplied scratch parent created; that prerequisite failure and corrected rerun are retained. These observations are not silently counted as successful original attempts.

Independent v2 verdict was **rejected**, with security/runtime/pin checks passing but three metadata/date blockers. The corrected v3 build uses acknowledgement/view generations to rebind post-save forms, matching range grammars without rewriting saved strings, and category-isolated availability proposals. Actual browser saves now post the visible `Year/1997` as HTTP 200; `Unknown/1997` remains rejected with 400. Episode/Commercial proposals survive category round trips, while Branding/Other show no availability controls or inherited constraints; Branding's structured content year remains a hard filter. The exact v3 set **passed both independent technical re-reviews** with no security, logic or scope blockers. Both reviewers verified all 103 hashes and complete directory membership before/after. The runtime reviewer independently passed all 271 tests across 20 complete suites on their first executions, plus persisted eligibility/tamper/HTTP/lock checks. The UI reviewer independently passed all four Edge harnesses (48 groups), 64 focused component tests and 8 additional actual-service/browser check groups, including all three original failures. Neither final re-review encountered EPERM. These are technical approvals, not owner acceptance, Phase 4 authorization or hardware certification.

The public HTTP planning query remains the existing browse/year projection. Role-availability `availableAt` filtering is exposed by the real LibraryService/LibraryStore planning method for later Cart Builder integration; the focused browser test checks that method against the exact HTTP-persisted project and labels this boundary rather than claiming an additional HTTP filter exists.

## What Shawn should try

Use a managed project or reviewed metadata copy, not the original read-only project as destructive test data.

1. **Layout:** resize both dividers, expand/restore each area, scroll Library and confirm the other areas remain visible. Visit Settings and return with an unsaved Library note.
2. **Register/classify:** open Locations, registration & filters, browse/type a video reference and register it. Inspect it; explicitly set category, classifications, network, pools, dates if known and human notes. Save, reload and inspect again.
3. **Notes/date separation:** put an uncertain year in notes, then apply a hard year filter. Unknown should remain excluded unless explicitly allowed for that query.
4. **Repair:** probe a source, visit Recipe, get its source frame, adjust trim/crop/audio and Save recipe. Separately render/play a preview and prepare a variant. Compare source health with fresh planning eligibility; a processed file is not a cart's GOOD decision.
5. **Composite:** select two appropriate parts, open the group manager, set order/name and save. Prepare the output. Change a saved constituent recipe and verify the group requires explicit pin update before preparing again.
6. **Recovery/impact:** cancel a real preparation, inspect a failed job and Retry, and use Source/Used in to review relink/removal impact. Do not simulate missing originals by moving them; use an owned test copy if testing a missing-source case.
7. **Persistence:** rescan a registered location and relaunch the app. Saved metadata/recipes must survive; scanning must not infer editorial decisions or restore explicitly removed references automatically.

## Boundaries and remaining limits

- Cart Builder/new TV Studio are placeholders. The old planner/Studio continue consuming legacy data until their approved integration phases; Library edits do not silently repin existing carts. The new effective planning projection is the Phase 3.2 integration seam, not a claim that old scalar-Pool readers now understand arrays.
- Dates/flags/pools/relationships are explicit metadata. Legacy classification text is retained for review, not guessed into newly authoritative fields. Further owner curation may be needed.
- Video clips are the supported preparation model. New audio-only filename formats are explicitly rejected; imported legacy references are preserved. Browser source-codec support varies; use the rendered preview when direct playback is unsupported.
- Scans have deliberate depth/file/entry bounds and reject unsafe reparse paths; a large unsupported scan reports the bound rather than partially claiming completion. Choose appropriately scoped registered folders.
- Lost/foreign/invalid runtime and stale locks fail closed and may require inspection/restart. There is no age-based automatic lock deletion, broad cache wipe or blind PID termination.
- Saved decisions persist server-side. Unsaved Library/setup drafts remain in their project-specific tab sessions across navigation; they are not advertised as durable autosave after closing the tab.
- No USB export, cart-generation redesign, new Studio implementation, source migration, hardware playback acceptance, public-release packaging or global backend upgrade was performed.

## Reproduce development gates

Use explicit disposable scratch; never use a real project as test scratch. Windows PowerShell example:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'
$env:RETRO_TV_TEST_ROOT = Join-Path $env:LOCALAPPDATA 'RetroTVCartBuilder-TestScratch'
New-Item -ItemType Directory -Path $env:RETRO_TV_TEST_ROOT -Force | Out-Null
$env:TEMP = $env:RETRO_TV_TEST_ROOT
$env:TMP = $env:RETRO_TV_TEST_ROOT
$env:TMPDIR = $env:RETRO_TV_TEST_ROOT
$names = @('project-store','ui-contract','server','launcher','picker','navigation','library-http','library-store','library-performance','library-jobs','library-jobs-integrity','live-workspace','library-composite','library-media-edge','library-backend','library-backend-native','library-backend-levels','project-transition','library-service')
foreach ($name in $names) {
    node "$root\TOOLKIT\setup\tests\$name.test.js"
    if ($LASTEXITCODE -ne 0) { throw "$name tests failed" }
}
node "$root\TOOLKIT\mockups\library-manager\tests\mockup.test.js"
if ($LASTEXITCODE -ne 0) { throw 'Mock regression failed' }
```

Direct file invocation avoids Node treating `[VIDEOS]` as a glob and succeeding with zero tests. Real browser harnesses require separately installed Playwright and Edge; set `RETRO_TV_PLAYWRIGHT_PATH`, optionally `RETRO_TV_EVIDENCE_DIR`, and leave `RETRO_TV_LEGACY_PROJECT` unset for isolated fixtures. They are `TOOLKIT/setup/tests/browser-navigation.cjs`, `browser-library.cjs`, `browser-library-dates.cjs`, and `TOOLKIT/mockups/library-manager/tests/browser-mockup.cjs`. Playwright is QA tooling, not an app dependency.

Temporary detailed logs/screenshots and exact pins live in the active Hermes profile's `cache/scratch/retro-tv-phase32-evidence`; they are not app runtime dependencies. The selected runtime archive/license are retained durably in `TOOLKIT/runtime`, not only scratch.

## Acceptance gate

After final technical review, Shawn should test this implementation and either approve **Phase 3.2** or request revisions. Implementation, passing tests and the earlier mockup approval do not constitute that acceptance. **Stop before Phase 4.**
