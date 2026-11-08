# Phase 1.1 — Setup and project settings checkpoint

**Status:** Phase 1.1, including the Explorer-style picker revision, is approved by Shawn. His explicit "confirmed, approved to move on" authorizes Phase 2 hub/navigation only; later workspace implementation remains gated. The current shell is documented in [13-HERMES-PHASE-2-HUB-CHECKPOINT.md](13-HERMES-PHASE-2-HUB-CHECKPOINT.md).

This is a development checkpoint, not the public installer or a replacement deployment. The original Studio launcher and processing engine remain unchanged. Phase 1 approval is recorded in [10-HERMES-PHASE-1-DISCOVERY.md](10-HERMES-PHASE-1-DISCOVERY.md); owner requirements remain in [11-USER-PHASE-1-DECISIONS.md](11-USER-PHASE-1-DECISIONS.md).

### Requested revision: Explorer-style folder browsing

All setup **Browse** buttons now use the native Windows Common Item Dialog in folder mode instead of the older tree-only chooser. It includes Explorer's breadcrumb/address bar at the top: click it to enter/paste a folder path and press Enter. The setup form still accepts typed paths directly. Restart the setup console/launcher to load this backend revision; opening a picker does not save project settings.

The helper uses Windows PowerShell's existing STA runtime and native Shell COM interfaces; no new runtime/package installation is required. Actual cancellation and folder selection passed, including brackets and Unicode. The address bar was confirmed by an owned-window screenshot and UI inspection. Automated background Ctrl+L/paste navigation was not completed, so manual address-entry review remains part of Shawn's check. Explicit file/folder operations performed through Windows' own dialog controls (such as New folder) are user actions, not automatic project initialization.

The picker revision itself was not treated as phase approval. Shawn subsequently confirmed the revision and explicitly approved moving on to Phase 2. No live project migration was performed during these checks.

## Open and try it

Double-click:

```text
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartSetup.cmd
```

The separate setup application opens at `http://127.0.0.1:17872/`. Leave its console open; Ctrl+C stops it. The existing `Start-RetroCartStudio.cmd` still starts the existing Studio separately. Do not use the original Studio launcher as if it were connected to the project selected in this setup application; that integration belongs to later approved workspace phases.

For a launch without opening a browser, or a different port/preferences folder:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartSetup.ps1' -Port 17872 -NoBrowser
```

`-AppDataDir` is an optional isolated-preferences override for development/testing. Normal preferences use `%LOCALAPPDATA%\RetroTVCartBuilder\projects.json`. They remember the last project/recent list, not the media library. No project is auto-initialized on launch.

The current checkpoint requires installed Node.js and Windows PowerShell. The screen checks Node.js, PowerShell, FFmpeg and ffprobe without installing anything. The agreed Windows installer with supplied runtimes, licensing checks, release packaging and deployment remains Phase 6.2 work; it is not claimed delivered here.

## Delivered functionality

### Open an existing project

- Choose the existing project root and click **Inspect project**. For Shawn's current project, select `F:\[VIDEOS]\retro-tv-cart-builder`.
- Inspection reads metadata, displays assets/carts/drafts, locations and compatibility warnings; it does not scan videos or initialize state.
- Click **Open existing project** explicitly. Legacy projects open read-only; only external application preferences change.
- Legacy settings remain locked. **Import a copy** is a separate deliberate action, not an automatic migration.
- Managed projects reopen with their saved settings. Missing/corrupt/newer-schema projects show an actionable error without resetting them or erasing the last selection.

### Create a new project

Choose **Create new**, name it, and select:

| Location | Meaning |
| --- | --- |
| Project data folder | User-owned settings, media records, cart definitions, recipes and review work; separate from the application installation. |
| Composite video folder | Future default for generated multi-part show videos. |
| Builds folder | Future cart outputs/export-ready videos. |
| Cache folder | Disposable previews/intermediates; manual-cleanup policy, no automatic wiping. |
| Library folders | Existing source-media folders registered in place; multiple folders supported, zero allowed initially. |

Use **Browse** or type local absolute Windows paths. **Review changes** validates the input without writing. The locked review shows exact paths, changes, warnings and backup location where applicable. A checkbox and explicit Create/Import/Save action are required to apply it. Editing or leaving the review requires a fresh review.

Fresh projects have empty, compatible CSV headers/configuration folders. They do not depend on Shawn's old media, carts, external curation or private paths. Registering a generic library folder does not infer its category or make it the CommercialRoot.

### Import a metadata copy

Select **Import a copy** after inspecting/opening the source, choose a new empty data folder and review the copy.

The import copies selected authoritative registry/assignment/cart/handpicked metadata, drafts, JSON cart/composite definitions and currently selected curation CSVs. It stages a verified SHA-256 backup of those inputs and referenced current/draft manifest CSVs before publication. The new `STATE/settings.json` points to copied config/curation/catalog files.

**What stays where it is:** original media, existing build outputs, historical manifest references, and saved composite-recipe output paths. CSV/draft references are preserved byte-for-byte; settings are adapted separately. Keep original build locations accessible. The chosen builds/composite/cache folders are future defaults, not permission to relocate existing files.

The backup is **metadata only**, not a full copy of all immutable build history, review proxies, FINAL videos or source media. This is disclosed before confirmation and in the retained receipt. It is not a portable full-project archive.

Older projects without the optional 2000–2002 commercial-curation CSV remain supported; setup warns about the absent optional input and copies only what actually exists. Branding and 1990s commercial curation remain required for legacy imports. No missing metadata is fabricated.

Import outputs include:

- `retro-project.json`: versioned project descriptor and location/policy selections.
- `STATE/`, `config/`, `curation/`: copied durable working metadata.
- `import-receipt.json`: provenance, hashes and explicit backup limitations.
- `backups/<review-token>/receipt.json` plus verified input files.

A fresh managed project can also be copied without any private/legacy curation files.

### Change settings, add libraries, switch projects

- **Settings** edits a managed project's name and future builds/composite/cache locations; library references can be added or removed later. Source files are never removed with a reference row.
- Settings saves back up the descriptor and engine settings first. Existing registry, cart, source, draft and manifest references remain unchanged.
- To change the project data location, use **Copy project data to another folder** from Settings. This uses the same reviewed metadata-copy operation and retains the original for rollback. Reopen the original to return to it; setup does not delete it or move existing video/build references.
- **Switch project** / **Open existing** / **Create new** preserve form values in the current tab or warn before leaving dirty forms. Last selection survives a new server process/browser relaunch.
- Setup blocks duplicate/conflicting setup submissions immediately. Read-only status checks remain available. Failed/uncertain writes are not automatically replayed. If the saved selection does not match the last reviewed target, the uncertainty fence stays in place; **Inspect last-save target** reads that exact target and compares its saved locations/name before offering an explicit Open action. It does not repeat confirmation.

## Protection and validation boundaries

- Local loopback binding, exact Host/Origin checks, per-session mutation token, JSON-only bounded requests, no remote assets and fixed static-asset whitelist. Project/state files are not served as static files.
- Local absolute paths only. UNC/device paths, symlinks/junctions, unsafe Windows names and source/output/install overlaps are rejected. Existing new/import data folders must be empty.
- Missing owned output directories may be created only after confirmation; existing output content is retained.
- Write-permission preflight is preliminary. Real saves surface actual filesystem errors rather than promising ACL success from a preliminary check.
- Import confirmation rechecks selected input membership/hashes and rejects stale, expired or reused review tokens. Metadata reads are bounded; pending reviews have an admission limit and expire.
- Backup destination chains are validated. Each operation directory, backup input and receipt is created exclusively; existing token directories and junction/symlink/hardlink traps are rejected without truncation. Verified partial backups can be retained for inspection after a late backup failure.
- Managed projects reject disagreement between their descriptor library list and engine LibraryRoots before opening or saving. CommercialRoot stays independently pinned; reordering generic library folders does not reassign it.
- Exclusive setup locks coordinate setup processes sharing app data or project target. Stale/foreign locks are not automatically deleted. Inspect a lock only after verifying its owning process is no longer running; never delete another live job's lock.
- Ordinary settings/publication exceptions are tested for rollback. Crash/power-loss atomicity is **not** claimed. If rollback reports a problem, retain the backup path and inspect it; do not reset the project.
- Filesystem checks are not an OS sandbox against hostile concurrent replacement between validation and use. Use user-controlled local project folders and appropriate Windows permissions. Inspection also retains per-file/draft-count limits rather than claiming a comprehensive global traversal/aggregate-memory budget for every read path.
- These locks cover **setup only**. The old Studio/CLI engine does not yet participate in the new setup locks. The setup app does not start rendering/export jobs; comprehensive processing/job coordination remains later scoped work.

## Reused, changed and added

**Reused:** Node/HTML/PowerShell stack, actual metadata schemas, current curation-selection semantics, original media references, IDs, draft pins and immutable build manifests. No render/planner rewrite, database migration or replacement framework.

**New:** setup HTTP server/UI, metadata-only project adapter, descriptor/receipts/backups, path validation, confirmation and setup locks, separate CMD/PowerShell launchers and regression tests under `TOOLKIT/setup/tests`.

**Existing engine changes:** none. The existing Studio/server/index/processing scripts/configs and live state were not edited. The one-time legacy import is not a prerequisite for new users.

## Actual verification

### Dependency-free automated checks

The test files use Node's built-in test runner, real disposable filesystem fixtures and real loopback HTTP where relevant. Controller/DOM fixtures and injected filesystem failures are explicitly not full browser/ACL/hardware tests.

Observed suites at this checkpoint:

- Project storage: 30 tests (including fresh/create/import/persistence, pinned bytes, backup verification and linked-destination preservation, optional 2000–2002 curation compatibility, LibraryRoots authority checks, stale input/membership, token admission/expiry/replay, overlap/unsafe schema, concurrent process locks and ordinary failure rollback).
- UI controller/DOM/transport: 22 tests, including explicit review/acknowledgement, dirty-state handling, read-only legacy, independent import defaults, data-copy action, and HTTP/network uncertainty fencing with exact-target recovery.
- HTTP/security: 12 tests, including token/Origin/Host enforcement, bounded JSON, separate review/confirm, duplicate rejection, diagnostics and static whitelist.
- Launcher: 2 tests, including actual Windows PowerShell launch from the bracketed installation path to an isolated loopback server.
- Explorer picker: 2 tests, including actual PowerShell compilation of the helper and the server's fixed-helper/data-only starting-path boundary. These do not simulate address-bar typing.

Current result after the Explorer-picker revision: **68 tests passed, zero failures or skips** across five suites. The original 66-test checkpoint had an independent rerun and SHA-256 review of its then-seven production files and four test files, with no blocking findings. The picker revision adds one production helper and one test file; its focused independent review passed with no blocking findings and reran both picker tests, including actual PowerShell compilation. The original pin set is historical rather than a claim that the modified server is byte-identical. Browser/native-picker and legacy-preservation checks were performed by the parent agent. Code-review acceptance is not Shawn's phase approval.

To run without the bracket-path glob trap:

```powershell
$env:RETRO_TV_TEST_ROOT = Join-Path $env:LOCALAPPDATA 'RetroTVCartBuilder-TestScratch'
$tests = 'F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\setup\tests'
node "$tests\project-store.test.js"
if ($LASTEXITCODE -ne 0) { throw 'Project storage tests failed' }
node "$tests\ui-contract.test.js"
if ($LASTEXITCODE -ne 0) { throw 'UI tests failed' }
node "$tests\server.test.js"
if ($LASTEXITCODE -ne 0) { throw 'HTTP tests failed' }
node "$tests\launcher.test.js"
if ($LASTEXITCODE -ne 0) { throw 'Launcher tests failed' }
node "$tests\picker.test.js"
if ($LASTEXITCODE -ne 0) { throw 'Explorer picker tests failed' }
```

The storage/HTTP/launcher fixture tests require an explicit absolute disposable `RETRO_TV_TEST_ROOT`. They never default to Shawn's private paths. Do not pass an existing source/project folder as test scratch. Tests clean their own generated subdirectories. Direct `node <test-file>` executes `node:test`; `node --test` with a bracketed absolute path can glob-match nothing and falsely exit successfully with zero tests.

### Real browser/storage/native checks

Performed in installed Edge using scratch-only test tooling (not an app runtime dependency):

- Real GUI create → read-only review → acknowledgement → save → settings backup/root change.
- Explicit managed data-folder copy with original retained.
- A new actual Node process reopened the persisted managed project.
- The real existing project opened read-only with **6,109 assets, 11 cart records and 24 drafts**.
- Real existing metadata imported into a new scratch project. Registry/cart/draft bytes matched the originals; **74 backup inputs** matched their receipt hashes.
- Imported settings retained the original commercial-root authority.
- Existing-destination/newer-schema rejection and missing-last-project recovery preserved state.
- An explicitly injected post-publication selection-save failure, followed by dropped response delivery, retained the uncertain-write fence. Refreshing an unrelated last selection did not clear it; exact-target inspection and explicit Open recovered without a second confirmation request. This is fault-injection evidence, not a naturally occurring production failure.
- No browser page JavaScript errors in those flows.
- Desktop and 400-pixel layout/keyboard checks passed. Screenshots were inspected; no horizontal overflow was detected in the narrow form.
- Actual Windows native folder dialog cancellation and selection passed. The selected scratch folder included brackets and `café`; the Unicode path round-tripped correctly. Automated button invocation was limited to the test process's own dialog.
- **124 protected legacy code/config/state/curation/manifest/owner-decision files** matched their pre-integration hashes. Originals and existing build videos were not written.

No cart rendering, approval changes, finalization, USB copying, ejection or TV playback was performed for Phase 1.1. Previous owner-reported TV acceptance remains recorded separately in Phase 1 decisions.

Temporary integration projects, screenshots and detailed probe output are in active-profile scratch and may be pruned. They are test evidence, not durable backups or required runtime dependencies. No server/test browser/native picker was intentionally left running.

## Shawn's acceptance walkthrough

1. Launch the new setup CMD; identify it as separate from the old Studio.
2. Inspect/open the current project and confirm its legacy/read-only summary. Confirm no original cart review/build state changes.
3. Create an empty project outside the installation/media directories. Review every location and confirm only when correct.
4. Change an output location, add a library reference, review/save, close setup and relaunch. Confirm the saved project/locations return.
5. Try the deliberate data-folder copy and confirm the original remains available. Do not delete it as part of this review.
6. If desired, import a metadata copy of the legacy project into a new data folder. Check the counts, backup disclosure and preserved old-build dependencies. This is optional for new-user operation, not a public setup requirement.
7. Review error behavior for an occupied data folder, missing folder or incompatible project. No generic reset should be offered.

**Approval received:** Shawn replied "confirmed, approved to move on" after the picker revision. This authorizes Phase 2 hub/navigation only, with another demonstration and approval checkpoint before proceeding to Library Manager mockups or any later module implementation.
