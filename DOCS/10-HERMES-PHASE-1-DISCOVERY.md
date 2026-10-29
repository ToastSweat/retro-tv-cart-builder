# Hermes Phase 1 discovery — review checkpoint

**Status: Phase 1 approved by Shawn. Phase 1.1 setup/settings implementation is tracked separately in [12-HERMES-PHASE-1.1-SETUP-CHECKPOINT.md](12-HERMES-PHASE-1.1-SETUP-CHECKPOINT.md); later phases remain gated.**

Owner responses are recorded in [11-USER-PHASE-1-DECISIONS.md](11-USER-PHASE-1-DECISIONS.md). Section 9 below reconciles those answers and the subsequent scope/installer clarification. These decisions supersede conflicting proposals in this report, not its source findings. The owner's response file has not been edited.

This document records the inspected local working copy, not a release. No overhaul code, migration, source-media edit, live cart edit, export, or deployment was performed during discovery. After reviewing the reconciled decisions, Shawn explicitly replied "i approve" to the request authorizing Phase 1.1 only. That approval does not authorize Phase 2, later workspace modules, or deployment; Phase 1.1 must be demonstrated and separately approved before advancing.

## 1. Scope and evidence levels

Canonical repository: `F:\[VIDEOS]\retro-tv-cart-builder`. Governing requirements: [Retro-TV-Hermes-Overhaul-Handoff.md](../Retro-TV-Hermes-Overhaul-Handoff.md), especially its approval checkpoints and Phase 1 acceptance.

Source inspection covered the installed Node/HTML Studio, PowerShell initializer/planner/review/apply/composite/finalizer, registration/preparation helpers, configs and composite recipes, settings, registries, current manifests/drafts, external curation metadata, hotfix backups and documentation. Local files take precedence over the public repository and older documentation.

Evidence terminology:

- **Executed:** actual tool/runtime result from this discovery.
- **Metadata checked:** parsed records and filesystem presence/size checks, not video decode or human approval.
- **Source finding:** installed control flow inspected; not necessarily reproduced end-to-end.
- **Proposal:** recommended future behavior, not implemented or approved.

Git was clean on `main` at discovery start, commit `f5c4e94`. This report is a new documentation file. The app was not running on the normal Studio port when checked. Installed tools returned Node `v24.14.1`, Windows PowerShell `5.1.26100.9711`, and FFmpeg/ffprobe `9.0.1-full_build-www.gyan.dev`. These are observed prerequisites, not a tested minimum-version support matrix.

## 2. Current cart baseline

Registry status/revision comes from [STATE/cart-registry.csv](../STATE/cart-registry.csv), rows 2–12. Review counts come from current `cart-manifest.csv.ReviewStatus`; saved current drafts agree. Assignment counts use current CartID/revision only. FINAL checks parsed each current `FINAL/cart-final-manifest.csv`, checked its files' sizes against `Bytes`, and compared AssetID/repair recipes against the current manifest.

| Cart | Revision | Recorded status | GOOD / slots | Current assignments | Local FINAL rows/files |
| --- | --- | --- | --- | --- | --- |
| NICK01 | r009 | BUILT | **30 / 36** | 36 ACTIVE | 36 / 36 |
| NICK02 | r010 | BUILT | 36 / 36 | 36 ACTIVE | 36 / 36 |
| NICK03 | r002 | BUILT | 36 / 36 | 36 ACTIVE | 36 / 36 |
| NICK04 | r002 | BUILT | 36 / 36 | 36 ACTIVE | 36 / 36 |
| SNICK | r001 | DRAFT; abandoned predecessor | 0 / 24 | 24 RELEASED | none |
| SNICK1 | r002 | BUILT | 24 / 24 | 24 ACTIVE | 24 / 24 |
| CN01 | r004 | BUILT | 36 / 36 | 36 ACTIVE | 36 / 36 |
| CN02 | r002 | BUILT | 36 / 36 | 36 ACTIVE | 36 / 36 |
| CN03 | r003 | BUILT | 27 / 27 | 27 ACTIVE | 27 / 27 |
| CN04 | r002 | BUILT | 27 / 27 | 27 ACTIVE | 27 / 27 |
| CN05 | r003 | BUILT | 36 / 36 | 36 ACTIVE | 36 / 36 |

**Do not equate BUILT with deployed or human-approved.** The inspected schemas have no verified USB-deployment receipt or television-acceptance field. FINAL existence/size/recipe consistency is not full decode, content-hash or hardware verification.

Important qualifications:

- CN05 is already recorded BUILT, newer than the handoff's reported review activity. Its FINAL README records `Built: 2026-10-28 23:12:19` without a timezone annotation. This discovery did not build it.
- NICK01 contains **six UNREVIEWED** slots despite BUILT and existing FINAL files. All **36** review proxy paths point to missing files under historical `F:\[VIDEOS]\Retro TV Cart Builder\CACHE\review-v1`. Its source files and FINAL files exist. Do not reset, reapprove, migrate, or rebuild it automatically.
- Legacy NICK01 `LIGHT` and `RESTORE` audio tokens normalize equivalently in installed Studio; token differences alone are not new effective edits (`TOOLKIT/studio/server.js:46–51`).
- `SNICK` is the abandoned pre-rename plan; use `SNICK1`. Existing documentation and released assignments agree. Preserve history rather than silently deleting the record.
- An empty CN03 r004 directory does not supersede the registry's r003 pointer.
- The historical roadmap lists **KWB01, KWB02, FOX96, BOOM01, BOOM02, POWER, SCIFI, UPN, HBO, AMC** beyond the ten non-abandoned built carts (`PLANNING/mini_retro_tv_20_cart_manifest_v1.txt:18–24`). These are historical roadmap identifiers, not the newly confirmed targets. Shawn subsequently confirmed **all ten** remaining targets and their initial order: **KWB1, KWB2, FOX1, POWER1, BOOM1, BOOM2, SCIFI1, UPN1, HBO1, AMC1**. Preserve those identifiers literally; do not silently normalize them to the old roadmap names.

## 3. Existing workflow and safe demonstration

### Current normal launch

Double-click:

```text
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartStudio.cmd
```

Leave its console open. It starts local Studio at `http://127.0.0.1:17871/`; choose CN05 from the cart selector. This is the **live application**: editing, GOOD + NEXT, save/build/export buttons can change project state. Merely opening Studio can create a revision-specific draft or derived previews. No live launch was performed for this discovery.

For an explicit CN05 launch from PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartStudio.ps1' -CartID CN05
```

The launcher derives the repository root and uses a neutral process working directory to handle bracketed paths (`Start-RetroCartStudio.ps1:9–28`). The CMD launcher already uses a process-scoped execution-policy bypass; no permanent policy change is required.

### Current workflow, not a replacement design

1. Register branding/commercials through curation imports and handpicked CSVs; episode registration comes from cart configs/handpicked episodes, not a general TV-folder scan.
2. Prepare composite recipes where needed, refresh registry, then plan a cart from config. These are still script/config operations.
3. In Studio, select clips, preview, replace, trim/crop/audio-repair, and use **GOOD + NEXT**. Working decisions autosave into a revision-specific JSON draft.
4. **BUILD FINAL LOCALLY** or deliberate selected-drive export can save changed reviewed drafts internally and prepare required review media. No mandatory second viewing is imposed by installed Studio.
5. The finalizer copies normalized review proxies into numbered FINAL files; optional export copies MP4s and relabels the selected drive. Continuous Full Review playback is optional, though current automatic preparation still renders the continuous review movie as well as proxies.

### Executed discovery demonstration

A disposable metadata snapshot was created under the active Hermes profile's scratch directory. Settings, registry/assignments/cart records, current manifests and drafts were copied; all writable project/build/cache/draft paths were redirected to the snapshot. Original source paths remained read-only inputs. The **installed unmodified** Studio server and preview helper were exercised; no live commit/review/final/export endpoint was called.

Results:

- `/` and `/api/carts` returned HTTP 200; `/api/state` loaded all 11 recorded carts.
- CN05 reported 36 GOOD, no changed clips. Its return-bumper candidates included IDENT; first return slot had 206 compatible candidates, including 107 IDENTs.
- `/api/render` generated and served a real preview of `2002 Scooby Doo The Movie DVD Promo.mp4`, slot `CN05-BREAK-01-AD-01`. ffprobe returned H.264, **618×480**, SAR **1:1**, **yuv420p**, **30/1 fps**, AAC, **44100 Hz**, **2 channels**, duration **15.023311 seconds**. The media endpoint returned HTTP 200. A sampled decoded frame contained recognizable video rather than a blank/error frame; this is not whole-clip visual approval.
- A snapshot-only crop-reset test left `action=GOOD` after changing the recipe: an approval-invalidation defect, not an intended workflow.
- The temporary server was stopped.
- SHA-256 before/after checks matched for **63 protected live source/state/manifest files**. No protected changes were found; original media was not written. Git remained clean before this report was added.

The sample preview/probe files are temporary evidence, not a durable project backup. Scratch may be pruned. No browser visual/click QA, full-cart finalization, USB write, ejection, or television playback was performed.

## 4. Feature inventory

Classification identifies the dominant treatment; a preserved engine can also need a GUI wrapper or narrow repairs.

| Existing capability / required addition | Classification | Treatment |
| --- | --- | --- |
| AssetID, CartID, SlotID and existing immutable manifests | **Reuse unchanged** | Preserve identifiers/history. Do not recalculate existing IDs during import. |
| Source media referenced in place | **Reuse unchanged** | Originals remain user-owned; remove references separately from deleting derived outputs. |
| Source-based audio ladder and TV geometry/encoding contract | **Reuse unchanged** | Retain original-source repair, SAR correction, proportional fit/padding and square pixels. |
| Registry and curation imports | **Wrap in GUI + repair** | Add reconciliation/persistence rules before GUI edits can safely survive refresh. |
| Config planner, media pools and composite utility | **Wrap in GUI + extend** | GUI templates/sequence/pools/composite grouping over existing engines. |
| Revision-specific Studio autosaved drafts | **Reuse + extend** | Preserve recovery; hide routine commits and strengthen stale-write/conflict protection. |
| GOOD + NEXT, replacements, trims, crop and audio workbench | **Reuse + repair** | Keep working tools; invalidate approval for every effective recipe/source change. |
| Exact crop frame and normalized previews | **Reuse + repair** | Keep geometry; stop globally locking crop controls during replaceable preview renders. |
| Show-aware branding selection | **Repair** | Enforce strict show match, then matched short IDENT/branding, then genuinely generic network fallback. |
| Commercial multi-pool/year filtering | **Extend + repair** | Replace cart-prefix special cases with one shared config-driven eligibility rule. |
| Review proxies, optional continuous Full Review, finalizer reuse | **Reuse + repair** | Verify effective recipe/cache readiness; avoid rendering unnecessary continuous movies. |
| USB selection/confirmation and non-wiping copy | **Reuse + extend** | Add copy readback verification, recoverable failure and truthful completion. |
| Reuse/assignment tracking | **Extend + repair** | Explicit scopes, source families/constituents, archived history and deliberate reservation reconciliation. |
| Jobs/progress | **Extend** | Real stage/item progress, cancellation where safe and cross-process project/output locking. |
| First-run/open/create/switch project settings | **New development** | Safe existing-project import; separate install, metadata, builds, composites and caches. |
| Hub with Library Manager / Cart Builder / TV Studio | **New development** | Application shell first; later modules remain separately gated. |
| Library browser, structured tags/notes, relink/dependencies/removal GUI | **New development over existing registry** | Do not invent duplicate metadata authorities or delete sources. |
| Visual cart shelf, sequence/template editor and exhaustion explanation | **New development over existing planner** | Preserve existing reviewed carts when templates change. |
| Verified deployment/hardware acceptance records | **New development** | Distinguish locally built, copy-verified and user-confirmed television playback. |

## 5. Authoritative data, dependencies and backup boundary

### Current locations and ownership

[STATE/settings.json](../STATE/settings.json), lines 2–9, selects CommercialRoot, CurationDir, SystemRoot, BuildRoot, ConfigDir and three registry paths. There are **no separate TV-root, composite-root or cache-root settings**. Episode/composite source/output paths are embedded in configs/recipes; Studio caches/drafts are derived from SystemRoot.

| Data | Authority / refresh behavior |
| --- | --- |
| `Commercials\_CURATION_BACKUPS\branding-curation.csv` | Current branding metadata import. Initializer chooses latest matching filename by mtime, not a pinned input. |
| Same folder: `commercial-curation.csv` | Current 90s/mixed commercial import, selected by `SourcePack` schema among matching files. |
| Same folder: `commercial-curation-2000-2002.csv` | Current 2000–2002 import, latest matching file by mtime. |
| `TOOLKIT/config/*.json` | Cart definitions, configured episodes, pool rules and sign-off choices. |
| `TOOLKIT/config/composites/*.json` | Reproducible multi-part assembly recipes and configured derived outputs. |
| `STATE/handpicked-branding.csv`, `handpicked-episodes.csv` | Additional editable registration sources; import precedence/deduplication matters. |
| `STATE/asset-registry.csv` | Runtime catalog plus preserved adverse SourceStatus overrides and UserNotes. Not a standalone authority for every metadata field. |
| `STATE/assignments.csv`, `cart-registry.csv` | Assignment history and current cart/revision pointers/status. |
| Build revision `cart-manifest.csv` | Immutable committed selections and repair recipes. |
| `STATE/studio-drafts/<Cart>-rNNN.json` | Mutable working review decisions tied to exact revision and manifest path. |
| `INPUT_SNAPSHOTS/*-current.csv` | Copied import inputs, overwritten on refresh; not upstream editable authority. |
| CACHE, composite media, review movies/proxies, FINAL MP4s | Derived media. Existing FINAL outputs may be worth preserving even when historical proxies are missing. |

**Backup STATE alone is insufficient.** A recovery set needs upstream selected curation, settings, configs/recipes, registries/drafts and revision manifests/history. Preserve important existing FINAL output separately. Backups/hotfix folders exist, but their completeness and restoration were not tested.

Initializer refresh preserves UserNotes and existing BAD_QUALITY/BAD_AUDIO/NEEDS_CLIPPED/NEEDS_CROP/DUPLICATE/EXCLUDED flags; it reconstructs other catalog fields from imports. Registry-only title/year/network/subtype/reuse edits can disappear, and registry-only assets can drop out. READY/UNREVIEWED overrides are not explicitly preserved. Upstream branding NEEDS_CROP maps differently from handpicked branding. Sources: `Initialize-RetroCartLibrary.ps1:63–100,152–203,234–285`.

### Metadata inventory checked

- Registry: **6,109** rows — 4,944 BRANDING, 356 COMMERCIAL, 697 ARCHIVE_MISC, 112 EPISODE.
- Source statuses: READY 1,044; UNREVIEWED 4,135; NEEDS_CROP 209; EXCLUDED 620; BAD_AUDIO 76; NEEDS_CLIPPED 14; MAYBE 10; BAD_QUALITY 1. DUPLICATE exists in code but has no current rows.
- Assignments: **1,423** — ACTIVE 330; SUPERSEDED 876; RELEASED 217; no RESERVED rows currently.
- Cart registry: 11 rows, ten BUILT and one abandoned DRAFT. Draft directory has 24 revision-specific JSON files.
- Upstream curation metadata: branding 4,938 rows; 90s/mixed commercials 411; 2000–2002 commercials 642.
- All **6,109 registered source paths** exist by filesystem metadata check. Current manifest AssetIDs resolve. Source existence does not certify decode health. Referenced config/recipe inputs and outputs checked during discovery also exist.

Source health and cart review remain distinct. Current review controls include UNREVIEWED, GOOD, REPLACE_THIS_CART, BAD_QUALITY, BAD_AUDIO, NEEDS_CLIPPED, NEEDS_CROP, DUPLICATE, WRONG_ERA and WRONG_NETWORK. MAYBE and ARCHIVE_MISC are existing schema values that also need reconciliation rather than silent removal.

## 6. Findings and compatibility risks

### R1 — Crop responsiveness regression: reproduced cause

`index.html:40–45` disables **every** button/input/select/textarea in `busy()`. `renderPreview()` calls it for ordinary replaceable preview work (`:101`), disabling crop-fit/apply controls. This is separate from legitimate export locking. Crop pointer handlers are not themselves disabled by that loop; partial interaction does not make applying the edit responsive. A controlled execution of the installed busy function reproduced the global lock. Existing sequence counters ignore some stale browser responses, but server status is keyed only by cart/slot and there is no preview cancellation API.

**Repair proposal:** separate preview/job lifecycles from cart export locks; keep proposal editing/apply responsive; attach recipe/request versions to results; cancel/queue or discard superseded work. No repair implemented.

### R2 — Planner can select wrong-show return branding: source finding

`New-RetroCartPlan.ps1:260–276` first tries matching keywords, then falls through to the whole subtype pool. LEAN calls this for BUMPER_IN (`:352–359`), so an unrelated show's bumper can win before generic fallback. The required intermediate show-matched short IDENT/branding stage is absent. Non-LEAN matching calls have similar exposure (`:363–388`). Studio's IDENT patch does not fix planning.

**Repair proposal:** a strict ordered search with no implicit broadening; shared explanation of eligible/excluded candidates. Keep network/block identity and announcement direction meaningful.

### R3 — Approval invalidation is incomplete: reproduced and source finding

Snapshot API test: patch a slot GOOD with a crop, reset crop via `/api/reset`, and the action remains GOOD. `server.js:589–597` resets recipes/replacement without clearing approval; reset buttons invoke it from `index.html:104,112–113`. Direct API recipe patches can also omit an action reset (`server.js:572–586`). Normal apply/new replacement buttons usually request UNREVIEWED, but correctness must not depend on every caller remembering it.

**Repair proposal:** compare effective source/recipe server-side and clear approval only for meaningful output changes; preserve GOOD for unchanged effective output. Do not silently reapprove legacy NICK01.

### R4 — Direct FINAL is installed, with readiness gaps

Installed `server.js:703–754` automatically commits/prepares on changed draft or absent review manifest, enforces all GOOD, then calls finalizer. A controlled orchestration check verified prepare → readiness check → finalizer ordering for a changed draft **using explicit test doubles**. This is not a real full-cart final build test. The real preview pipeline was exercised separately.

An existing review manifest suppresses preparation for unchanged drafts even if its proxies are missing/stale. Bare finalizer checks slot/AssetID/proxy presence, but not GOOD or complete applied trim/crop/audio equivalence (`Build-RetroCartFinal.ps1:211–233`). NICK01 demonstrates missing historical dependencies. Existing FINAL matching uses metadata and file length, not content hashes/source freshness/full decode (`:163–209`).

**Repair proposal:** one readiness computation for approved effective recipes and available valid derived media; prepare only affected work; retain optional review playback and valid FINAL reuse. Validate standalone engine calls as well as GUI.

### R5 — Metadata refresh can lose future GUI edits

See section 5. Current refresh is not a generic persistent library editor or safe project initializer. It rewrites settings from arguments/defaults, so it must not serve unchanged as existing-project import. A metadata ownership/reconciliation layer and pre-migration backup are needed before Library Manager writes to it.

### R6 — Eligibility differs between entry points

- Only CN05 config explicitly declares kids+general 2000s pools and 2000–2002 ad bounds (`config/CN05.json:5–11`).
- Planner supports configurable multi-pool/bounds for commercials only (`New-RetroCartPlan.ps1:279–291`).
- Studio expands by hardcoded CN03/CN04/CN05 SlotID prefix (`server.js:174–182`), not settings.
- Older generated review UI and PowerShell replacement surfaces retain narrower pools and omit IDENT in return slots (`Build-RetroCartReview.ps1:599–608`; `Apply-RetroCartReview.ps1:414–435,460–466`).
- Episode availability/network-era rules and an explicit unknown-date policy are not generally implemented. Do not apply commercial year rules to branding or silently infer episode air dates.

Executed controlled predicate checks confirmed installed Studio accepts READY CN IDENTs for return slots, accepts both commercial pools only within 2000–2002 for CN05, and excludes non-READY sources. These are function checks, not full UI testing.

### R7 — Reuse model needs extension without rewriting history

Normal planner selections block UNIQUE assets project-wide while RESERVED/ACTIVE and avoid repeated AssetIDs through `Is-Available`/`Pick-One` (`New-RetroCartPlan.ps1:180–200`). **Configured sign-offs are an exception:** they are resolved and appended without those availability/used-this-cart checks (`:395–426`), so this is not a guaranteed cart-wide invariant. The planner does not implement the four independent per-media repeat scopes. Composite source constituents/families are not generally tracked; CN05 preparation has bespoke checks. Moving a path can change path-derived identity; alternate files are not automatically the same source family.

Forced fresh planning appends reservations without the normal supersede/release reconciliation (`:71–75,431–442`). Review apply does reconcile revisions. Do not force a new plan as a generic fix. PowerShell and Node assignment-ID hash algorithms differ; preserve stored IDs rather than recomputing them during migration.

A FINAL manifest currently qualifies as an approved repair example for configured sign-offs (`:88–177`); it does not prove deployment despite the comment's wording. Historical/archived/variant policy requires Shawn's decision.

### R8 — Jobs/locking are incomplete

Studio has an in-memory single-process build guard (`server.js:696–702,773,788–791`); a controlled overlap test verified that guard rejects a second build and releases afterward. It is **not a cross-process project lock**. Direct CLI or another server can conflict on registry/output paths. Registry/manifest updates span sequential writes without a whole-operation rollback transaction. Long-job output is buffered rather than exposed as a full stage/item lifecycle; no user job-cancellation endpoint was found.

### R9 — Export verification and recovery need strengthening

Drive selection and confirmation exist and unrelated files are not wiped. The finalizer relabels after local preparation but **before** USB copy, overwrites same-name files, and has no destination hash/readback verification or actual ejection (`Build-RetroCartFinal.ps1:73–129,330–364`). A failed copy can leave partial output and a changed label. FINAL publication stages first but deletes stale FINAL before moving the replacement, so recovery is not fully transactional (`:282–326`).

### R10 — Composite freshness/source-output protection

Composite reuse accepts existing readable output by duration without verifying recipe/source freshness (`Build-RetroCartComposite.ps1:133–151`). Destination paths are caller/recipe-controlled and need explicit source/output collision and overlap checks. Intermediate normalization uses 48-kHz audio/first-source cadence; downstream review correctly establishes the TV output profile. Preserve that distinction rather than labeling all intermediates final-ready.

### R11 — Helper syntax failure and historical path assumptions

Windows PowerShell parser checked **20 installed .ps1 files**: 19 parsed; `Set-CN03-SignOff.ps1:34` failed with `Missing argument in parameter list` at `Sort-Object DurationSeconds -Descending, Title`. This helper was not executed or fixed. Other scripts retain historical root defaults; callers must pass canonical SystemRoot. Settings do not yet separate install/project/cache/composite locations.

### R12 — Documentation/checkpoint drift

README/October 11 checkpoint still describe SNICK1 in progress and CN01 next; old roadmap treats CN01–05 as future work. These are historical snapshots. Do not overwrite historical evidence or treat earlier Full Review/QC wording as overriding the new handoff's GOOD + NEXT → direct build/export requirement.

## 7. Validation summary and limits

| Check | Actual result |
| --- | --- |
| Installed Node server syntax | PASS: `node --check` |
| Inline Studio JavaScript compilation | PASS: parsed installed script with Node VM |
| PowerShell syntax-only parser | 19/20 parsed; sign-off helper failure recorded above |
| Current CN05 manifest schema audit | PASS: 36 rows, required schema present |
| Current CN05 audio audit | Completed read-only; 7 requested RESTORE repairs reported; formatted output alone is not proxy-quality certification |
| Snapshot HTTP cart/state and real preview | PASS; actual encoded media/probe result in section 3 |
| Installed compatibility predicates / busy controls / build guard | Six controlled checks passed, including regression reproduction and explicit orchestration test doubles |
| Snapshot recipe-reset approval test | Defect reproduced: reset can retain GOOD |
| Live source/state/manifest preservation | 63 protected file SHA-256 comparisons unchanged |
| Registered-source presence | 6,109 checked; none missing by filesystem metadata |
| Current FINAL metadata | Ten built carts' files/recorded bytes/IDs/recipes consistent; no full media hashes/decodes |
| Full Direct FINAL, USB, TV playback | NOT RUN / NOT VERIFIED |

The two read-only PowerShell audit scripts initially hit execution-policy authorization failure. Retrying with the same process-scoped `-ExecutionPolicy Bypass` convention used by the installed launcher succeeded. No system/user policy was changed.

No browser automation package was available in the probed Python/Node environments; no dependencies were installed. Browser layout/click behavior remains for a deliberate UI demonstration/UAT. Do not report API/function checks as visual acceptance.

## 8. Proposed implementation approach — approval required

1. **Keep the current Node local server, HTML workbench, PowerShell engine and CSV/JSON history as the initial architecture.** Inspection does not justify a new engine, framework or database. A future SQLite decision would need concrete concurrency/schema benefit, export compatibility, verified migration and rollback; it is not a prerequisite.
2. Introduce a settings/project adapter with validation and compatibility detection; do not run initialization over existing data. Separate installation from project metadata, source libraries, composites, builds and disposable caches. Import references in place with explicit backup/relink/migration options.
3. Place shared metadata/eligibility/readiness/reuse operations behind clear service boundaries, still calling proven processing scripts. Add atomic publication and cross-process locking at shared mutable resources. These are staged repairs, not a rewritten render engine.
4. Preserve current identifiers/revision/draft links and immutable manifests. If schema extensions are necessary, version them, retain old readers/exports where needed, back up distributed authority first, test on snapshots, and document rollback before touching the real project.
5. Build only the next approved phase: **1.1 setup/settings**, then **2 hub**, then separately approved Library Manager/Cart Builder/TV Studio mockups and implementations. The risks above are a backlog, not permission to implement later modules during setup.
6. Preserve existing carts as working assets throughout; do not use the only live state as destructive test data. Keep final output geometry/audio and original-source repair behavior as regression invariants.

## 9. Confirmed owner decisions — Phase 1 approved

Sources: [11-USER-PHASE-1-DECISIONS.md](11-USER-PHASE-1-DECISIONS.md) and Shawn's subsequent answers to the two scope/installer clarification questions. Those factual answers were not treated as approval. Shawn subsequently gave explicit Phase 1 approval, authorizing Phase 1.1 setup/settings only. No further Phase 1 questions are outstanding.

### A. Immediate carts and baseline exceptions

- **All ten** carts are in remaining scope, initially in this exact order: **KWB1, KWB2, FOX1, POWER1, BOOM1, BOOM2, SCIFI1, UPN1, HBO1, AMC1**. The earlier reference to five is superseded.
- Shawn confirms the first ten carts—NICK1–4, SNICK1, CN1–5—have been copied and played successfully on the television; CN5 was just built. This is **owner-reported deployment/playback confirmation**, not a new agent-performed USB or hardware check. Existing canonical IDs remain unchanged; the supplied shorthand does not authorize renaming old carts.
- Shawn confirms Direct FINAL has worked as expected after the patch. The earlier source/runtime-test limitations remain accurately labeled.
- Preserve/import existing carts as references where practical. Complete historical migration is a nice-to-have, not a prerequisite for a reusable application; Shawn is willing to remake carts if necessary. This does not authorize deleting or resetting existing data. Any necessary destructive migration/rebuild still needs explicit scope, backup and approval. Keep the NICK01 discrepancy visible rather than automatically changing approvals.

### B. Public application, installation and projects

- Build a reusable **Windows 11** application for public GitHub distribution, not a tool dependent on Shawn's private machine, paths, knowledge, media or historical files. Linux/macOS support is out of scope.
- Supply a **Windows installer with a shortcut and required runtime tools**, including Node.js/FFmpeg as appropriate, subject to redistribution/licensing requirements. Packaging/license verification belongs to the release work; bundling is not claimed complete. Users supply/register their own media.
- The legacy-cart import is a one-time compatibility workflow for Shawn. New users must be able to create projects and use the app without any of his old carts, curation backups or project data.
- Separate app installation from project data. Reopen the last project; support Open Existing, Create New and explicit Switch Project without moving original sources.
- Active processing prevents project switching until completion or safe cancellation. Preview work alone must not freeze unrelated editing.

### C. Reuse defaults and historical meaning

- Preserve/import existing uses where practical. Initial defaults remain project-wide uniqueness for episodes/commercials, branding reusable across carts and no repeated selection within a cart unless explicitly allowed, with per-media scope controls.
- **Built-but-not-deployed counts; archived does not count by default.** Expose a setting to change this historical-use behavior. Archiving is not deletion of assignment history, and immutable revisions are not separate broadcast carts. Unarchiving must recompute/show conflicts rather than silently bypass uniqueness.
- Encodes/repairs of the same original and constituent episodes inside composites count as the same underlying use through explicit relationships, not filename guesses.

### D. Library terminology, metadata and dates

- Use broad Episode/Show, Commercial, Branding and Other groups with existing subtypes underneath. Keep structured planning metadata separate from human notes/soft tags; make legacy category/status mapping visible and reversible.
- Notes function as descriptive soft tags, searchable and visible in Library Manager and TV Studio during review. Shawn's example is a Snapple commercial with notes such as `snoop dogg, moon, soft drink`. Do not require a second contradictory metadata field or let notes silently change selection eligibility.
- **Do not infer editorial metadata.** Unknown dates fail a hard date filter unless the owner explicitly allows unknowns for that rule. Do not invent dates, show/network associations or categories from filenames/content/notes. Reading measured technical properties from files is distinct from editorial inference. Existing inferred metadata must not silently become authoritative in the new app.

### E. Edits, variants, missing sources and removal

- Save non-destructive repair recipes. Link optional rendered variants to originals/recipes; retain explicit ordered composite constituents and freshness checks.
- Missing assets retain identity and offer Relink. Removing references shows dependencies and offers deliberate blocking/archiving behavior; it never deletes originals.
- Effective source/recipe changes require affected review approval again; unchanged effective output does not. Reviewed/built dependent carts remain pinned to their existing recipes unless deliberately updated. Show the impact; never propagate changes silently.

## 10. Review and approval gate

**Delivered:** this source-grounded baseline, feature classification, verified metadata/runtime checks, current workflow/launch instructions, risk inventory and proposed approach. A real disposable short preview was generated; no replacement UI or overhaul module has been implemented.

**Reused:** installed Studio/server, render helper, original-source read access, metadata schemas and existing read-only audit scripts. **Changed:** only this documentation in the repository. **Added outside the project:** disposable snapshot/probes/evidence under the active Hermes profile scratch directory. No source media, live settings, CSVs, drafts, current manifests, caches or existing builds were edited.

Shawn reviewed the discovery and supplied the decisions reconciled in section 9. Scope/default questions are resolved, and explicit Phase 1 approval has been received. The owner's decision document remains unchanged.

**Approval received:** Shawn replied "i approve" to the explicit request to approve Phase 1 and authorize Phase 1.1 setup/settings only. Phase 1.1 may now proceed within the handoff's scope. Stop after demonstrating its acceptance criteria and wait for separate approval before Phase 2. No later workspace implementation, mockup phase or deployment is authorized by this approval.
