# Retro TV Cart Builder v2 — handoff

## Current checkpoint — milestone 4A: Media Library organization
2026-11-08. V1 completed the first twenty carts. User moved its existing tree to `legacy-v1/` in the SAME Windows Git repository, `F:\[WORKSPACE]\retro-tv-cart-builder`. The repository was moved from F:\[VIDEOS] to F:\[WORKSPACE] by the user. Archive checkpoint commit was instructed but its success has not been reported. Never claim that commit/push occurred. The archived v1 has absolute paths and is not validated runnable from its new location. Do not automatically migrate or edit it.

The user accepted Project Setup: “no complaints, it seems to work just fine.” Networks & Shows was then explicitly authorized. This package supplies the complete updated `v2/` and this document for `docs/`. It does not contain or overwrite legacy-v1. User and ChatGPT will build incrementally together. No Hermes. Stop after each meaningful milestone for user review; don't implement the entire roadmap at once.

## Accepted product decisions
- App name: Retro TV Cart Builder. Desktop window with native folder pickers.
- One self-contained project owns a collection of carts, properties, artwork, metadata, usage records and generated files.
- Libraries are source-only, external references. No app records or generated files written into source libraries.
- Default asset usage constraints are project-local. Using media in project A does not lock it in B. Future explicit cross-project usage override; source files never modified to implement locks.
- Workflow: Project Setup → networks/shows → carts/templates → Media Library → generate selected/all carts → Studio → Build & Export.
- Networks: long/short names and artwork. Shows can belong to multiple networks. Carts assigned a network, properties, artwork and template.
- Templates: color-coded ident, promo, bumper-in/out/general, commercial and numbered show slots; show slots map to a cart's selected shows.
- Library: network/show classifications, categories, hard sorting tags, notes/soft tags, preview, trim/clip/crop/audio processing, exclusion of bad assets.
- Generation must preflight shortages and explain exclusion reasons, respect joint demand when generating multiple carts, preserve reviewed work unless explicit replacement is chosen.
- Studio mostly retains familiar review/replacement/edit workflow; allow cropping/reprocessing while initial preview is rendering. Approving a clip must not force a second viewing or unnecessary revision before final build.
- Build/export separate, reuse approved results and invalidate only affected work. USB size budget checked before expensive work. Jellyfin export planned.
- Twenty original carts serve as fresh examples; start with NICK01 when organization is implemented. Do not silently import old records.

## Implemented milestone 1: project setup (user accepted)
Electron app with sandboxed renderer, isolated preload API, native folder/open dialogs. Electron version pinned in package+lock. Main process owns filesystem operations. No shell commands or network exposed to renderer. No FFmpeg needed at this milestone.

Welcome: New/Open/Recent. Create: name, parent folder, zero or more named source libraries. New project directory must not already exist. Project structure: project.json; data, artwork, composites, cache, builds, exports. All managed folder names are relative to project home and fixed for this first milestone. Project display name can change without renaming the directory. Settings permits library addition/removal/relinking. Open missing-source projects and locate folders manually. Moving entire project preserves project/library IDs and relative managed folders.

Recent-project navigation is the ONE deliberate app-level exception to project-local data: Electron userData/recent-projects.json stores only recent names and paths. Electron also owns its normal UI runtime cache outside projects; this is not media processing cache. If user requires absolutely zero app-level state, discuss portable preferences next.

Cross-project lock field saved false; no usage tracking/enforcement yet. UI explains this. Networks/shows and cart/template organization are now implemented as described below. No media scanning, generation or encoding implemented. Folder paths configurable by selecting project home, not six independent destinations. Individual folder customization is deferred, not claimed implemented.

## Files
- v2/src/projects.cjs: versioned project schema, validation, safe creation/open/update, stable IDs, source overlap checks, atomic JSON replacement, previous settings backup.
- v2/src/main.cjs: desktop lifecycle, native dialogs, allowlisted IPC, recent list.
- v2/src/preload.cjs: narrow context bridge.
- v2/src/index.html, renderer.js, style.css: actual UI.
- v2/test/projects.test.cjs: filesystem behavior tests.
- v2/Start-RetroTV.cmd: first-run npm ci then desktop launcher. Requires Node 22+ and network for first install. This is source distribution, not yet a packaged standalone exe.

## Validation and limits
Five Node test scenarios passed: create/reopen/update/source protection/isolation; overwrite refusal; relocation/missing library/relink/IDs; overlap/duplicate/name validation; unsupported schema refusal. JavaScript syntax checked. Test results for UI noted in VALIDATION.md.
Native Windows folder dialogs and launcher require user smoke test. No promise of Windows verification from Linux. Don't upload runtime/node_modules into Git. Future cross-project coordination and removable-media identity remain open design work. Missing libraries must be relinked or removed before saving project settings. Single app process serialization; simultaneous independent instances editing same project not supported yet.

## User acceptance check
1. Launch via v2/Start-RetroTV.cmd.
2. Create a temporary project OUTSIDE repository and source libraries; add TV and Commercials folders.
3. Verify no source files were written, moved or altered; check generated project structure.
4. Close app and reopen from Recent/Open. Check settings retained.
5. Close app, move test project, open moved project.json. Check identity/settings retained.
6. Relink a moved/missing test library using settings. No real media move needed for test.
7. Report UI feedback before next milestone.

## Implemented milestone 2: Networks & Shows (user accepted)
Project overview has a Networks & Shows button. Tabs, search, cards, empty states, create/edit editors. Networks have long name, unique short name, optional artwork; shows have unique name, optional artwork, zero/multiple network associations. Stable UUIDs preserve links on rename. Native confirmation before removal, explaining that removing a network unlinks its shows rather than deleting them. Duplicate names and short names rejected case-insensitively. Unsaved editor cancellation prompts before discarding.

Organization stored in data/organization.json, schemaVersion 1, with networks/shows arrays. Existing milestone-1 projects open without migration or immediate writes; organization file created only on saving a first entry. Existing project.json schema remains version 1. project.json is never rewritten by organization actions.

Images chosen by native dialog: PNG/JPEG/WebP, <=15 MB, decoded by Electron nativeImage, <=10000px per dimension. Selected image buffered in main process; renderer only receives a token and preview. On save artwork copied under artwork/networks or artwork/shows with generated names. Metadata keeps relative path. Missing art does not prevent opening. Removing/replacing art retains previous imported files for recovery; no automatic cleanup yet. Each organization change creates a metadata snapshot in data/organization-backup-UUID.json. Project-owned directory junctions pointing outside the project are refused. Artwork source files are never altered.

New files: v2/src/catalog.cjs, v2/test/catalog.test.cjs, v2/test/organization-ui.test.cjs. Test dev dependency jsdom 26.1.0; Electron stays pinned. npm ci updates local dependencies when needed.

11 filesystem/service tests and one DOM integration scenario passed. The DOM scenario uses the actual persistence service behind a mocked desktop bridge, not native Electron dialogs. It covers create/edit network, duplicate validation, shared show assignment, removal/unlink and reopening. Desktop rendering and native artwork dialogs need Windows user check. Earlier Project Setup desktop behavior was user accepted. Do not claim native tests for this milestone.

Acceptance: open existing test project → Networks & Shows → create Nickelodeon/NICK with poster → create Rugrats and assign it → optionally create a second network and associate same show → rename/edit → close/reopen → verify images and relationships → test removal on disposable example.

## Implemented milestone 3: Carts & Templates (awaiting user review)
User accepted Networks & Shows on Nov 8 after closing a duplicate instance; all expected behavior worked. Navigation launch buttons must be neutral, not yellow/selected. This update preserves that correction. Main process now uses Electron single-instance lock: launching a second instance focuses the first.

Project overview now offers Carts & Templates. Cart fields: number/ID (uppercase, unique within project), display name, one network, optional poster, ordered list of distinct shows, optional template. Only shows associated with selected network can be chosen. Changing network removes incompatible shows in the unsaved editor (explained in UI); source show records untouched. Reordering show list changes Show 1/2/etc mappings in live preview.

Reusable template fields: name and ordered list of up to 200 color-coded slots. Types: IDENT, PROMO, BUMPER_IN, BUMPER_OUT, BUMPER_GENERAL, COMMERCIAL, SHOW, INTRO, NEXT, SIGN_OFF. SHOW/INTRO/NEXT refer to a numbered cart show (1–50). Slots can be added/moved/removed; repeated numbered shows allowed. Templates can be shared by multiple carts; editing template changes their sequence references, explained in editor. No inline type editing or drag-and-drop yet; remove/add and arrow ordering are provided. Sequence preview shows labels, mapped show names, and missing-assignment warnings. Missing assignments are permitted at structural-planning stage; generation will need hard preflight later.

Persistence: data/cart-plans.json schemaVersion 1, arrays templates and carts, stable UUIDs for records and slots, project-relative cart artwork. Existing project.json and organization.json schemas unchanged. No automatic seeding or migration. No file writes when merely opening empty planning. Each planning change snapshots prior metadata to data/cart-plans-backup-UUID.json. Previous artwork retained for snapshot recovery.

Linked deletion safeguards: assigned templates cannot be deleted; networks/shows referenced by a cart cannot be removed through app; a show's network association used by a cart cannot be removed until cart is updated. No cart media or generated clips exist yet. Project-repeat rules and cross-project lock execution remain unimplemented, to be discussed with generation/settings.

New source: plans.cjs, plans.test.cjs, planning-ui.test.cjs. Main/preload/UI extended. Alpha.3 package version. Dependency versions unchanged from alpha.2; exact lock included.

20 tests passed: original setup/organization cases plus cart/template CRUD, stable ordering/IDs, preview and missing shows, validation, dependency-safe deletion, project relocation/artwork/source preservation, isolation/schema refusal, and real-filesystem DOM planning workflow. DOM uses a mocked desktop bridge, not native Electron. Native Windows presentation, picker, single-instance focus and confirmations await user check.

Install: close running v2, extract complete package into current repository root, replacing matching v2/docs files. Do not overwrite project folders or legacy-v1. Existing node_modules retained (same dependencies). Launch v2/Start-RetroTV.cmd, open existing project. Native acceptance below.

Acceptance example:
1. Existing network Nickelodeon/NICK; add Rugrats/Doug/etc and associate to NICK if not already done.
2. Carts & Templates → Templates → Add template: ident, Show 1, commercial, bumper in, Show 2, etc. Save.
3. Carts → Add cart NICK01, name, NICK, template, ordered shows and optional poster.
4. Reorder shows and confirm preview mapping; save, close, reopen; verify persisted layout/art.
5. Test duplicate cart code validation and refusal to remove assigned template.
6. Launch app twice; second launch should focus first window.

## Preferred-choice refinement — alpha.4 (awaiting user review)
User praised Carts & Templates and requested A-or-B alternatives with preference order: Coming up next → Bumper in, Promo → Commercial. Accepted design: each slot has an ordered list of allowed choices; first eligible preference wins; same full allowed list constrains future replacement pool. No substitution outside configured choices. Availability, usage/repeat rules, quality and matching must continue to apply to every alternative. No eligible choice must produce shortage in future generation preflight, not a random substitute.

Implemented: template editor supports 1–10 preferred choices per slot, change types, own show number for SHOW/INTRO/NEXT, add/remove/reorder alternatives, and reorder whole slots. Last choice cannot be deleted. Duplicate (type, show number) choices refused. Preview groups choices per slot with Prefer/Fallback/Then labels and per-choice show mapping. Single-type slots behave as one-choice slots.

Planning file schema is now 2. Slots have {id, choices:[{type, showIndex?}]} instead of {id,type,showIndex?}. Schema-1 planning files normalize in memory on read without changing file bytes; IDs/order preserved. First later planning save writes schema 2 and snapshots original metadata. Project/organization schema unchanged. Older alpha.3 does not support schema-2 plans; restore a matching pre-save metadata snapshot if downgrading. All newly delivered code uses normalized choices. Caller input of legacy single-type slots still accepted by save service.

Policy helpers rankCandidates/choosePreferred in plans.cjs are implemented and unit-tested as primitives for future generation/Studio, with caller-supplied matching and eligibility callbacks. They group candidates by preference, expose the full allowed replacement pool, deduplicate identical candidate objects across matching choices, and return null when none eligible. There is still NO actual media generation, usage enforcement or Studio replacement UI in v2: those integrations must use this contract when built. Candidate source ordering is preserved within each choice; scheduling/randomization is not implemented.

25 tests passed: original 20 adapted to normalized choices plus migration byte/ID preservation, alternative persistence/order, matching/eligibility/fallback behavior, replacement inclusion and validation refusal without writes. DOM integration covers alternative add/reorder/save and cart preview. Windows/native acceptance pending.

Acceptance: Templates → edit existing slot → choose Coming up next with show number, add Bumper in as fallback → reorder alternatives and restore order → save → open cart → verify grouped preferred/fallback sequence → close/reopen. Also test Promo → Commercial. Existing single-choice templates should remain usable.

## Milestone 3 acceptance
User accepted Preferred Choices: it works and makes sense, happy with it; also noted the template UI is just shy of clunky. Keep common workflows simple and hide extra detail rather than adding more permanent controls. Then explicitly authorized Media Library import/browse/classification/tags/exclusion, with playback/processing separate.

## Milestone 4A: Media Library organization — alpha.5 (awaiting user review)
Project overview has a neutral Media Library button. Scan configured source library folders (one or all), with progress and cancellation. Native source folders remain defined in Project settings. Scans register references only, not media copies; no FFmpeg, duration probing, thumbnails, playback, rendering, crop/trim or audio processing in this milestone.

Scan supports mp4/mkv/avi/flv/webm/mov/m4v/mpg/mpeg/wmv/ts/m2ts/vob, ignores hidden/dot resource files, skips links/junctions, rejects project/source overlap. Reads path, file size and modification timestamp. New rows start Unclassified and included, not quality-approved. Same library UUID+relative path retains media UUID and metadata on rescan. Removed files retained as missing; restored same-path files regain availability. Library relink with preserved UUID retains classifications. No content hashing or cross-path/content duplicate detection yet; changed contents under same filename retain metadata. Multiple overlapping configured libraries may produce separate references to same physical media; content-identity/dedup must be settled before generation enforces no-repeat rules.

Project data file: data/media-library.json schemaVersion 1. Assets store UUID, libraryId, slash-normalized relativePath, display title, category, networkIds/showIds arrays, optional year, matching tags, personal labels (softTags), notes, excluded/missing flags, size/mtime. Source absolute paths computed from library references at read time. Project/organization/planning schemas unchanged. Atomic metadata writes, rolling data/media-library-previous.json snapshot. Source libraries never receive sidecars or generated files.

UI: 50 rows/page, search title/path/year/tags/notes, filters for library, category, network, show and inclusion/missing/unclassified status. Scan selector independently chooses one or all configured libraries. Each row opens details drawer with title/category/year/matching tags and collapsible networks/shows + personal notes/labels; exclusion flag. No source deletion action. Page selection permits bulk set category/include/exclude; bulk action only modifies that field. Changing pages/filters clears selection to avoid hidden bulk edits. Matching tags are metadata for future generation; personal labels/notes not machine sorting rules.

Scan job runs asynchronously, no metadata commits until scan completes; canceled scans save nothing. Native app close aborts scan. Project mutations and other write operations blocked during scan; read-only views/progress/cancel remain available. Unavailable roots preserve records and produce warnings; permission errors skip missing detection for affected library to avoid false losses. Missing status displayed from scan flag or unavailable/unconfigured library. Source absence does not erase tags or review context.

Network/show deletion now refused if referenced by media; remove corresponding associations in Media Library first. Existing cart relation guards retained. Metadata organization only; no actual repeat/quality/generation eligibility execution yet. UI says Included does not mean reviewed/approved.

New source: media.cjs, media.test.cjs, media-ui.test.cjs. Main/preload/renderer/style extended. Dependencies unchanged, alpha.5.

32 tests passed (25 prior + six media service scenarios + one media UI DOM scenario). Tests verify reference-only scan and source byte preservation, ignored resources, rescan IDs/metadata, bulk metadata, tag normalization, filtering, missing/restored/relinked libraries, cancellation without writes, invalid metadata/schema refusal, pagination, symlink skip, project isolation, and DOM scan/edit/search/exclude/reopen with real persistence and mocked desktop bridge. No Windows native presentation or large-library performance claim. Need user check with a small library first.

Acceptance: open existing project → Media Library → select one configured library → Scan folders → use search/category filter → edit an entry, assign category/network/show/year/tags/notes → save → select a few rows and exclude → rescan → close/reopen and verify persistence. Originals unchanged. Start with a small test library if desired; don't move real media for testing.

## Next work
User review Media Library organization first. Resolve feedback, record acceptance, then agree next milestone for Media Library organization. The accepted overall workflow places Media Library after structural cart setup; generation and Studio come later. Keep this handoff current at every delivered milestone and document what is only proposed versus implemented/tested. Confirm archive commit status separately. Next increment after acceptance: agree media preview/playback and preprocessing scope. Preserve simple browse/list/detail layout.
