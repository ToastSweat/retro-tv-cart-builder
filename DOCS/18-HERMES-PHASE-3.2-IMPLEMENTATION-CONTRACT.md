# Phase 3.2 implementation contract — in progress

**Authorization:** Shawn approved the revised Phase 3.1 layout/workflows, then separately said **"yes, pelase proceede"**. This authorizes Phase 3.2 only, not Phase 4 or acceptance of the implementation. This is an implementation coordination contract, **not a completion report**.

Read the master handoff, owner decisions (11), revision decisions (16), and approved mockup checkpoint (17). Preserve existing Studio/engine/source media/live legacy STATE. Work and demonstrations use disposable managed projects and synthetic media first. No commits without a separate instruction.

## Architecture and ownership

- Keep the approved design mock and its no-IO CSP/tests unchanged.
- Add live Library modules under `TOOLKIT/setup/`; retain setup/project switching/settings and integrate the live combined workspace there.
- Keep Cart Builder and TV Studio as honest placeholders. Their later phase designs/implementation remain gated; old Studio remains separately launched.
- Use `STATE/library-catalog.json`, schemaVersion 1, as project-owned Library authority. Leave descriptor schema 1 and original CSV/curation bytes intact. Legacy projects remain read-only; import a managed copy for editing.
- Never invoke `Initialize-RetroCartLibrary.ps1` as a rescan. Its regeneration/settings rewrite would lose data. New scanning measures source observations, not inferred editorial metadata.
- Reuse the unchanged standalone `TOOLKIT/studio/Render-StudioPreview.ps1` and `TOOLKIT/Build-RetroCartComposite.ps1` through a checked asset-level adapter. Never import/run the Studio server to obtain helper functions or mutate cart review drafts.
- Existing legacy tools continue reading legacy CSVs; new catalog changes do not repin their existing carts. Phase 3.2 exposes a tested effective planning projection with source-family/recipe pins; later Cart Builder must consume it rather than pretending legacy scalar-Pool readers already understand arrays.

## Shared catalog shape

All paths are absolute native paths validated against symlink/junction/source/output collisions. JSON is data, never executable code. All records returned to views are authoritative copies.

`LibraryStore.read(project)` returns:

```text
{ schemaVersion:1, revision:number, etag:string,
  projectFolder, readOnly,
  assets:Asset[], locations:Location[], networks:Network[],
  selectionPools:{value,label}[], groups:Group[], jobs:Job[], warnings:string[] }
```

`project` is a fresh `ProjectStore.inspect()` result; server binds every request to the current active project by exact `projectFolder`. No global implicit project is accepted by a mutation. Wrong/stale project returns 409. No mutation of legacy/read-only projects.

Asset fields (align with approved mock naming):

```text
id, name, category, subtype, classificationByCategory,
pools:string[], network, show, notes, date:{mode,value}, availableFrom, availableTo,
health, reason, path, locationId, missing,
family, sourceId, variantOf,
technical:null|{duration,width,height,sar,hasAudio,videoCodec?,audioCodec?},
recipe:{revision,trimStartSeconds,trimEndSeconds,cropLeft,cropRight,cropTop,cropBottom,audioRepair},
recipeHistory:Recipe[], variants:Variant[],
legacy:{original registry field names/values}, uses:Dependency[]
```

`notes` is human UserNotes only; imported Notes/InferredTags/OriginalID/Subtype/scalar Pool remain read-only `legacy` provenance. Source health is independent of missing-file availability, prepared-output readiness and cart approval. No metadata inference from filenames or notes. Unknown remains unknown. Registered individual assets start Other, Unassigned, Unknown date, UNREVIEWED, empty pools/classifications.

Final-review correction adds optional schema-1 `availabilityByCategory: { 'Episode/Show'?: {availableFrom,availableTo}, Commercial?: {availableFrom,availableTo} }`. Absent-map historical scalars belong only to the saved current eligible category. Reads never migrate/write or guess previous category ownership; saves capture prior eligible proposals before switching categories. Once a map exists, it is authoritative and missing roles do not fall back to scalars. Branding/Other expose no role-availability controls/restrictions. Historical scalar values remain read-only provenance; explicit scalar API writes still update an eligible target role's map. Mixed scalar/map proposals, unknown roles/keys and invalid/reversed bounds reject atomically. Structured content dates and hard-year eligibility remain independent.

Category values: `Episode/Show`, `Commercial`, `Branding`, `Other`. Classification choices and per-category retention follow DOC16. Branding needs one role before saving a Branding proposal. Normal Episode means an empty flag array. Pools remain independent explicit memberships.

Location: `{id,path,removed:boolean}`. Seed declared project library folders, then store explicit registration/removal/relinks in the catalog. Settings library paths are defaults for future registration, not instructions to silently relink existing references. Expose the distinction in the UI.

Network: `{code,name,kind:'Network'|'Block',parentNetwork,archived}`. Preserve codes exactly. Never merge NICK/SNICK. Archive preserves existing references; prevent newly assigning an archived code. Deletion preflights assets, unsaved persistent proposals if any, cart pins and child blocks.

Group: `{id,name,revision,parts:[{assetId,recipeRevision}],history:...}`. Order and source identities are explicit; stale recipe pins require explicit definition update. No filename-based relationship guessing. Preserve unresolved historical references as dependency findings, not deletion permission.

Job: `{id,kind,state,stage,assetId?,groupId?,item,count,createdAt,updatedAt,ownerPid?,snapshot,outputs?,error?}`. States include queued/running/cancel-requested/succeeded/failed/cancelled/stale/interrupted. Actual progress may be absent. No simulate controls or invented percentage/timer completion in the live view.

## Storage interface and transactions

```text
new LibraryStore({installRoot})
read(project) -> catalog snapshot
apply(project,{expectedEtag,operation,payload}) -> {catalog,result}
transact(project, callback, {expectedEtag}={}) -> {catalog,result}
dependencies(project,assetId) -> structured dependency impact
planningCandidates(project,filter) -> effective eligible assets with recipe/source-family pins
```

`transact` is a trusted internal synchronous transaction seam for jobs; callback receives a mutable full catalog document (arrays above) and returns result. It rereads under `projectFolder + '.setup.lock'`, validates before publishing and returns authoritative readback. User actions require expectedEtag; no last-writer-wins. Etag includes relevant CSV/cart/config/draft inputs, not only a numeric sidecar revision. Stable asset IDs survive relink and rescan. Existing effective metadata survives technical refresh.

Single-file publication uses verified before-image backups, an exclusively owned transaction directory, a staged file and atomic replacement with ordinary failure preservation. Reject corrupt/unknown-version catalog; never reset it. No unsupported crash-atomic multi-file claim. Existing external legacy writers do not honor the new lock; detect changed inputs and fail stale, rather than pretending a Node lock controls them.

Supported action operation names:

- `register-asset`: `{path,name?}`; `register-location`: `{path}`; `remove-location`: `{locationId}`.
- `save-metadata`: `{assetId,values}`; `save-recipe`: `{assetId,values}`.
- `bulk-pools`: `{assetIds,mode:'Add'|'Remove'|'Replace',pools}`; `add-pool`: `{value,label}` explicitly creates a reusable selection set rather than limiting fresh projects to sample-era pool IDs.
- `add-network`: `{code,name,kind,parentNetwork?}`; `rename-network`: `{code,name}`; `archive-network`: `{code,archived}`; `delete-network`: `{code}`.
- `relink-asset`: `{assetId,path}`; `relink-location`: `{locationId,path}`; `remove-asset`: `{assetId}`. Responses include impact; referenced removal blocks. Relink preserves identity, recipes/provenance and never rewrites old cart manifests.
- `save-group`: `{id?,name,parts:[{assetId,recipeRevision}]}`; `remove-group`: `{groupId}`.
- `set-relationships`: `{assetId,family,sourceId,variantOf}`.

Actions validate complete proposals before changing any record. Empty arrays mean explicit clearing. Dependency-dangerous operations require the UI to show impact and an explicit confirmation; stale etags invalidate that confirmation.

## Jobs interface and renderer contract

```text
new LibraryJobs({store,installRoot,...optional test tool overrides})
start(project,input) -> Promise<{catalog,result:{jobId}}>
status(project) -> {jobs:[...]}
cancel(project,jobId) -> Promise<{catalog,result}>
retry(project,{jobId,expectedEtag}) -> Promise<{catalog,result}>
hasBlockingJobs(project) -> boolean
resolveMedia(project,{assetId?,jobId?,kind}) -> {path,mime}
close() -> Promise<void>
```

Input: `{expectedEtag,kind,assetId?,groupId?,locationId?,sampleTime?}`. Kinds: `probe`, `scan`, `source-frame`, `final-frame`, `crop-detect`, `preview`, `variant`, `composite`. Engine may return crop proposals in job result without saving them. Source playback is available only for a registered asset. Job outputs are served only by owned job ID, never arbitrary browser-supplied paths.

Render from original source for every audio level. Recipe trim fields mean seconds removed from each end. Crop fields are integer original coded pixels, before SAR correction. Final frames and processed media use the existing crop/SAR/fit/pad geometry and 618×480 / 30fps / yuv420p / AAC stereo 44.1kHz target. NONE still follows the existing renderer's normalization, not untouched passthrough. Source reference display mapping must handle non-square SAR correctly. Do not introduce illustrative percentages as a second stored crop contract.

Each job reserves immutable recipe/group/source inputs and unique checked managed staging/output paths. Reject source/output collisions, duplicate/conflicting submissions and unsafe reparse paths. Probe/check outputs and full-decode representative test outputs before claiming success. Do not reuse a composite merely because an old output has duration >1 second. Apply completion only to matching current recipe/definition/source; stale work must not become current readiness.

Cancellation is requested first, terminal only after the owned child process tree exits. Retain logs/errors and safe retry. Persist lifecycle; interruptions/restart must not turn running into invented success. Never expire another process's lock by age alone. Block project switching/settings changes during conflicting processing, but permit recipe/crop drafting during replaceable preview work. Cross-process conflicts must be enforced by persisted reservations/locks, not only GUI state.

## HTTP contract (parent owns server integration)

All routes retain current exact-host/origin/CSRF rules and no-store behavior. Fixed allowlist only for new live files; mock route policies unchanged.

- GET `/api/library/catalog?projectFolder=...` -> catalog snapshot.
- GET `/api/library/jobs?projectFolder=...` -> `{jobs}`.
- GET `/api/library/dependencies?projectFolder=...&assetId=...` -> impact.
- GET `/api/library/planning?projectFolder=...` -> planning projection; optional validated explicit filters.
- GET `/api/library/media?projectFolder=...&assetId=...&kind=source` or owned `jobId`/output kind -> validated local stream with Range/HEAD support.
- POST `/api/library/action`: `{projectFolder,expectedEtag,operation,payload}` -> `{catalog,result}`.
- POST `/api/library/job`: `{projectFolder,...jobInput}` -> `{catalog,result}`.
- POST `/api/library/cancel`: `{projectFolder,jobId}`; POST `/api/library/retry`: `{projectFolder,jobId,expectedEtag}`.
- POST `/api/library/browse`: `{projectFolder,mode:'file'|'folder',initialPath?}` -> `{cancelled,path?}` using Windows address-bar-capable dialog; path can also be typed.

Missing/stale/readonly/lock conflicts return explicit non-success codes; uncertain writes require readback, not automatic replay. Unknown operation/keys/oversized input fail before action. The live client must retain project-specific drafts across view reconnects and never mount seeded mock data or fake jobs.

## Acceptance still pending

Implementation must demonstrate real disposable-project registration → explicit metadata/notes/classification → preview/recipe → prepared eligible asset; relaunch/rescan persistence; exclusion, missing-source relink and guarded removal; ordered composite and genuine job failure/cancellation/staleness; existing setup/draft and original Studio regressions; unchanged originals; independent review. Stop for Shawn's Phase 3.2 acceptance before Phase 4.
