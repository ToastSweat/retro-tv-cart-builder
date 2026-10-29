# Phase 3.1 — Library Manager design-review checkpoint

**Status:** navigable mockup built, exercised and independently reviewed; Shawn's layout/workflow approval is pending. **Phase 3.2 is not implemented.**

Shawn approved the working Phase 2 hub with **"approved. all is working. you may continue"**. This authorizes the Library Manager layout/workflow mockup in `Retro-TV-Hermes-Overhaul-Handoff.md:201–224`, not live catalog editing, processing, schema migration or later workspace implementation. See [approved Phase 2](13-HERMES-PHASE-2-HUB-CHECKPOINT.md) and [owner decisions](11-USER-PHASE-1-DECISIONS.md).

## Open the design

Finish/save any real setup form before restarting the app. Stop the setup console with Ctrl+C and double-click:

```text
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartSetup.cmd
```

From **Main hub → Library Manager**, choose **Open Library Manager mockup · sample data only**. It opens a separate tab without an opener handle; the original app tab and its form drafts stay separate.

Direct address after the server starts:

```text
http://127.0.0.1:17872/mockups/library-manager/
```

No selected project or private media is needed for that direct design page. The main app remains the approved Phase 2 shell; the separate page identifies itself as **PHASE 3.1 DESIGN MOCKUP**. Restarting loads the new static routes; refreshing an old server process alone is not sufficient.

The artifact also has classic local HTML/CSS/JS files under `TOOLKIT/mockups/library-manager/`. File-mode opening hides Back to live hub and explains that closing the tab returns to the app. HTTP opening is the primary review path.

## What is and is not real

**Everything in the Library Manager design page is illustrative.** Its ten initial rows, paths, technical values, carts, relationships and job states are invented review samples—not a projection of Shawn's library. The Snapple/notes example illustrates the owner's requested soft-note behavior; it is not a claim about an actual source clip.

- Search, filters, selection, dialogs, draft edits and simulated actions work **in browser memory only**.
- Save properties, Save recipe, registration, relink, removal and jobs are labelled mock/simulation actions. They write no project files or media.
- No video/audio is loaded or played. Preview frames and final-fit panes are labelled layout illustrations.
- No native picker is invoked here. Browse (mock) explains that the approved Explorer-style picker would be used during implementation.
- No API is contacted by the mockup. HTTP policy blocks connections, media, workers, frames and form submission; source code has no persistence, picker, clipboard or processing API surface.
- Reload resets the sample. Changing Design review state explains the reset and requires explicit discard if asset drafts are pending. This is not a durable project autosave.

## Layout and navigation

The primary surface is **browse/inspect**, retaining the approved dark/teal Windows-native vocabulary:

- **Left:** registered sample locations and search/category/source-health/network/year filters.
- **Middle:** sample result list, selection, Add media reference, Bulk edit and Create composite actions.
- **Right:** selected asset, always-visible reviewer-notes summary, and **Properties / Preview & edit / Relationships / Used in / Jobs** tabs.

Desktop uses three columns. Narrower layouts stack the inspector, and the 400-pixel layout stacks the workbench without horizontal overflow. This is a layout proposal for review, not a new framework or database.

### Required design states

Use the **Design review state** selector at the top:

| State | What to review |
| --- | --- |
| Populated | Browse/inspect hierarchy, metadata, notes and ordinary editing actions. |
| Empty | Clear add/register entry points and an empty inspector, not an error/reset. |
| Missing source | Preserved identity/health/recipes/references and visible Relink action. |
| Busy | Indeterminate mock work, stage/item details, crop editing still available, stale-result and cancellation handling. |
| Error | Useful failure explanation and explicit Retry without discarding recipes. |

Job stages advance only through clearly labelled **Simulate** controls. There are no fake encoding timers or invented completion percentages.

## Scope coverage

| Scoped tool or rule | Visible mockup path |
| --- | --- |
| Add/register media reference | Results toolbar → Add media reference (mock): explicit title/path, unknown editorial fields, unreviewed health, duplicate warning. |
| Add/register library location | Left → Add location; typed example path and Browse explanation. |
| Scan/rescan/stop | Manage locations → Scan/Rescan → simulated technical-only result or Stop. No editorial inference or metadata reset. |
| Remove/relink locations | Manage locations → typed Relink; Remove location stops future scans while preserving registered asset references and known availability. |
| Browse/search/filter/sort | Names and notes search; category, health, network and structured year filters; name/health sort. |
| Category/subtype/network/show/pool | Properties, with all established branding subtype choices and distinct NICK/SNICK values. |
| Dates and availability | One Year/date precision control; optional episode/commercial availability bounds are separate and role-specific. Unknown dates fail an active hard filter unless explicitly allowed. |
| Notes/soft tags | One editable human field plus a read-only summary on every inspector tab; searchable but never an eligibility rule. |
| Imported/legacy metadata | Read-only provenance and mapping disclosures; no migration has occurred. |
| Source health, reasons and re-review | Properties → raw source health/reason and explicit Re-review / Mark usable. Raw health, recipe readiness and cart review are separate. |
| Trim/crop/reframe/audio | Preview & edit: removed-seconds trims, survivor-box proposal, fit/detect/no-crop/revert controls, audio ladder and final-fit illustration. |
| Save recipe versus prepare output | Separate Save recipe and Prepare processed variant / preview actions. Saving a recipe neither generates a file nor silently approves bad raw media. |
| Source families and variants | Relationships → readable source/group selectors, optional named group and linked variant navigation; no typing internal asset IDs required. |
| Ordered episode composites | Select both sample parts → Create composite → order/name → Save group definition. Preparation is separate; stale pins require an explicit definition update. |
| Uses/reservations/change impact | Used in shows sample built/reviewed versus reserved uses, linked-source use and pinned recipe impact. Existing carts are not silently updated. |
| Exclude/remove/relink asset | Used in → Exclude or Relink; referenced removal is blocked. Unreferenced removal deletes only the in-memory row, never an original. |
| Jobs/failure/retry/cancel | Jobs tab or preview jobs: queued/running stage, current item/count, sample success, failure/retry, cancel requested and terminal cancelled. |
| Responsive crop/stale results | Busy state → change crop → simulate old result; stale result is ignored while edits remain available. |
| Bulk assignment example | Select rows → Bulk edit: explicit single Pool assignment. Other properties are per-asset in this mockup; broader bulk classification can be revised during design review. |

### Schema/ownership distinctions

- Episode/Show maps conceptually to existing `EPISODE`; Commercial to `COMMERCIAL`; Branding to `BRANDING`; Other retains `ARCHIVE_MISC` compatibility. Legacy `MAYBE` is visible rather than silently discarded.
- Existing episode `Subtype` often carries series text. The mockup's explicit Show/series field is a reviewed UI proposal, not permission to overwrite those existing values.
- The editable human field proposes `UserNotes`; imported `Notes` remains provenance. Historical `InferredTags` is not promoted into authoritative show/year/network/category data.
- Single-valued `Pool` stays single-valued. This does not remove the existing planner's ability to choose multiple commercial pools for a cart.
- Year/range/exact-date controls and relationship fields propose a future contract; no CSV/JSON schema extension or migration was run. Legacy `OriginalID` remains unchanged import provenance, not a repurposed source-asset relationship.
- Crop edge percentages and SVG geometry are **layout guides only**, not the stored render contract. Phase 3.2 must preserve existing source-coded-pixel crops, SAR correction, proportional fitting/padding and the 618×480 final profile. There is no claim of exact preview/render agreement in this mockup.
- Mock jobs illustrate lifecycle and interaction, not production concurrency/idempotency or cross-process locking. Real preparation must retain the engine's validation and implement genuine duplicate/conflict prevention; no mock job is a real processed output.

## Suggested review walkthrough

1. **Notes versus metadata:** search `moon`, inspect the sample ad, edit notes and preview it. Apply a year filter, then explicitly allow unknown dates. Notes containing a year must not populate the structured date.
2. **Register and classify:** add a typed media reference. Confirm it starts unreviewed/unassigned/unknown, explicitly choose a category and add notes, then Save properties (mock). Try the same path again to see duplicate handling.
3. **Recipe versus output:** open Preview & edit, change trim/crop/audio and save the recipe. Confirm that no output or automatic source approval is claimed. Queue a mock preparation separately.
4. **Missing/dependent asset:** select Missing source, relink it in memory, inspect Used in, and try removal. Review the blocked-removal alternatives and pinned-cart explanation.
5. **Parts/variants:** select the two Demo Orbit parts, create a composite, reorder and save its definition. Inspect named source/variant selectors and the separate composite preparation action.
6. **Recovery:** choose Busy; edit crop while the mock job is running, simulate its old result, then retry/cancel. Choose Error and retry. Compare Empty and Populated states.

Useful initial sample IDs: `demo-ad`, `demo-part-1`, `demo-part-2`, `demo-ident`, `demo-next`, `demo-missing`, `demo-audio`, `demo-duplicate`, `demo-excluded`, `demo-maybe`. These are not real AssetIDs or real cart uses.

## Validation and safety evidence

Parent checks currently pass:

- **116 dependency-free tests:** storage 30, live-app UI 23, HTTP 13, launcher 2, Explorer picker 2, hub/navigation 21 and mockup 25.
- Real Edge over HTTP exercised the major mock flows and all five states, including 400-pixel layouts with no horizontal overflow and no page JavaScript errors.
- The design page recorded **zero project/API reads and zero API writes** during actions. A deliberately injected API request was blocked by its HTTP policy before reaching the server.
- The mock tab has no opener handle; the original live-fixture tab retained its unsaved settings, and its persisted descriptor matched the pre-review bytes.
- Windows/backslash and nested location relinks preserve the relative path and preflight a whole batch before changing it. Saved composite-order changes make an in-flight mock result stale; Retry validates and refreshes its inputs from the current definition. Both review regressions were also exercised through actual Edge/HTTP actions after correction.
- Fixed static routes serve only the four known mock assets; arbitrary data paths are not exposed and `/api/library/scan` does not exist.
- The existing hub's browser regression still passed after adding the design link. **123 protected original engine/state/config/curation/manifest/owner-decision files** remain unchanged.

No real library scan, media playback, probe, crop/audio processing, composite generation, source deletion, catalog persistence, cart mutation, USB write or schema migration was performed. Fictional technical values and frames are explicitly not execution evidence. Screenshots/probe logs in active-profile scratch are temporary, not project backups or runtime dependencies.

The final independent review passed on the exact 21 pinned files with no security, logic or named-scope blockers. It independently reran all seven suites (**116 passed, no failures/skips**) and the actual Edge/HTTP harness (**17 check groups passed**), including both corrected workflow regressions and the no-API/live-tab protections. Additional owned-fixture probes covered relink boundaries, retry atomicity and the remaining mock controls. SHA-256 pins matched before/after; technical acceptance is not Shawn's design approval or authorization to begin Phase 3.2.

### Reproduce checks

Use explicit disposable scratch and direct test-file invocation to avoid the bracket-path Node glob trap:

```powershell
$env:RETRO_TV_TEST_ROOT = Join-Path $env:LOCALAPPDATA 'RetroTVCartBuilder-TestScratch'
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'
foreach ($name in @('project-store','ui-contract','server','launcher','picker','navigation')) {
    node "$root\TOOLKIT\setup\tests\$name.test.js"
    if ($LASTEXITCODE -ne 0) { throw "$name tests failed" }
}
node "$root\TOOLKIT\mockups\library-manager\tests\mockup.test.js"
if ($LASTEXITCODE -ne 0) { throw 'Mockup tests failed' }
```

The optional real Edge harness is `TOOLKIT/mockups/library-manager/tests/browser-mockup.cjs`. Supply a separately installed Playwright module through `RETRO_TV_PLAYWRIGHT_PATH` and optionally `RETRO_TV_EVIDENCE_DIR` for retained screenshots/results. Playwright is test tooling, not an app dependency. All fixture writes stay under test scratch. Do not supply a real project as test scratch.

## What Shawn should decide

- Does the three-pane browse/inspect layout and inspector-tab grouping fit how you want to work?
- Are notes, source health, missing-source recovery and dependency impact sufficiently prominent?
- Is the separation between metadata, recipe saving, processed variants and cart approval clear?
- Should any fields or bulk-assignment controls move or expand before implementation?
- Are the five representative states and failure/cancellation paths understandable?

**Approval gate:** request design revisions or explicitly approve Phase 3.1 once no requested revisions remain. Then stop before treating the later implementation as approved. Phase 3.2 may implement only the approved layout/workflows and must have its own real-data demonstration and acceptance checkpoint.
