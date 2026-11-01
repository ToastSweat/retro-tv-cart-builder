# Phase 3.1 — revised combined-workspace mockup

**Status: Phase 3.1 approved by Shawn; Phase 3.2 implementation is now authorized and underway.** Following resubmission of the revised mockup and its completed technical review, Shawn replied **"approved"**. Hermes stopped before development, then Shawn separately authorized the next step with **"yes, pelase proceede"**. Phase 3.2 still requires its own demonstration and owner acceptance.

This supersedes the first submission's layout and scalar-pool proposal in [14 — historical first submission](14-HERMES-PHASE-3.1-LIBRARY-MOCKUP-CHECKPOINT.md). Requirements come from [15 — Shawn's feedback](15-USER-PHASE-3.1-LIBRARY-MOCKUP-FEEDBACK.md) and [16 — confirmed revision decisions](16-HERMES-PHASE-3.1-REVISION-DECISIONS.md). The owner's feedback file is unchanged.

## Answers to the feedback

1. **Three sections:** the original three internal Library columns were Hermes's design choice, not something Shawn requested. The revision instead shows **Library Manager, Cart Builder and TV Studio together**, as requested. Library's internal layout adapts to its available width.
2. **Classification:** each category now has its own choices. Episodes allow overlapping Crossover, Holiday, Multipart and Special flags; **Normal means no special flags**. Commercials allow overlapping Video Game, Toy, Food, Restaurant, Music, Movie, TV and Store subjects. Branding keeps exactly one primary established broadcast role. Other provisionally offers Short, Feature, Special, PSA and Misc, with an explicit unclassified state. Switching categories preserves separate proposals rather than translating unrelated choices into one another.
3. **Normal launch flow:** the intended finished application is first-time setup → combined workspace; later launches open the saved project's combined workspace. There should not be a mandatory Setup → Hub → Library entry → Library page chain. During approval-gated development, the existing live hub remains, but its Library design link now opens the combined mockup **directly**.
4. **Networks/blocks:** yes. The mock manager demonstrates adding definitions, editing display names, archiving/unarchiving and dependency-aware deletion. Stable codes are not renamed behind existing references. Referenced definitions cannot be deleted; archive is the non-destructive alternative. NICK and SNICK remain distinct identities, even when a block has a parent network.
5. **Selection pools:** a pool is a set of clips Cart Builder may draw from, **not what the clip depicts**. A restaurant commercial might have Food and Restaurant classifications and belong to both KIDS_00S and GENERAL_00S selection pools. Dates, network/block eligibility and repeat rules still apply independently. The revised field is named **Selection pools**, explains this distinction beside the controls, and permits multiple explicit memberships. Bulk Add/Remove/Replace modes preserve unrelated metadata.

No further blocking clarification is needed before Shawn reviews this revision. Other-category labels remain a proposal that can be refined during this review.

## Open the revised design

If the setup app is already running, save any real forms before restarting its console. Launch the existing separate setup application:

```text
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartSetup.cmd
```

On **Main hub**, choose **Open combined workspace mockup** in the Library Manager row. This opens the design directly in a separate tab; it has no opener handle and receives no active-project context. The approved setup tab retains its unsaved forms.

With the server running at its default port, the direct address is:

```text
http://127.0.0.1:17872/mockups/library-manager/
```

No active project or private media is needed for this page. Do not open the original Studio expecting this mockup; Studio retains its existing separate launcher and behavior.

## Revised layout

- All three application areas appear side by side on desktop. Cart Builder and TV Studio are explicitly **placeholders**, not prematurely implemented or designed modules.
- Drag either divider, or focus it and use Left/Right/Home/End. Resizing is bounded so an area cannot collapse away.
- Each desktop area scrolls independently, with its header retained. Working through a long Library inspector does not move the other areas off-screen.
- Expand any area, then **Restore all workspaces**. Existing sizes and in-memory asset drafts survive.
- Library initially opens in **Explore / browse**, not a full wall of property controls. Inspect a row, or use **Inspect selected**. Compact widths switch Browse/Inspect surfaces; a wide Library shows results and inspector together. Locations & filters are a disclosure.
- At narrow window widths the areas stack vertically. This layout intentionally scrolls as a page rather than forcing three unusably thin columns.
- Notes remain visible while inspecting/previewing. There is still one editable human Notes field, separate from imported provenance.

## Suggested approval walkthrough

1. **Combined layout:** confirm all three areas are visible, resize both dividers, expand/restore each area, and scroll within Library. Try a property draft before expanding another area and verify it is retained on return.
2. **Category-specific choices:** inspect Demo Orbit part 1. Select Holiday and Multipart together; choose Normal to clear the special flags. Switch to Commercial and inspect its different choices, then switch back. Inspect the ident to see the single Branding role. Legacy classification stays visible as read-only provenance.
3. **Pools:** inspect the sample ad. Select multiple pools and read the explanation above the choices. In Browse, select multiple rows → Bulk edit, then compare Add, Remove and Replace. Pool membership must not invent a year, network or content classification.
4. **Networks/blocks:** use Manage networks / blocks (mock). Add a test definition, change its display name and assign it to a sample asset. Inspect the dependency counts and blocked deletion. Archive it: existing references remain visible, but it is unavailable for a new assignment to another asset. An unused definition can be deleted.
5. **Preserved workflows:** try notes search versus a structured year filter, recipe save versus separate preparation, source-health re-review, relink and Used in. Try composite grouping/order, stale-result handling and retry/cancellation.
6. **Review states:** compare Populated, Empty, Missing source, Busy and Error with the top selector. Changing state resets the sample and asks before discarding pending asset drafts. Reload resets everything.

## What remains mock-only

Every sample row/path/cart/technical value and job result is illustrative. All design actions use browser memory only; no actual catalog, media, project metadata, saved carts or network definitions are read or written by the mockup. There is no real scan, playback, probe, processing, filesystem picker, clipboard operation, durable storage or schema migration.

The revised `classificationByCategory` and `pools: string[]` are proposed contracts inside the mockup, **not deployed schema changes**. Historical scalar Pool, Subtype, imported Notes/InferredTags and OriginalID remain provenance; implementing compatible persistence requires separate Phase 3.2 work after approval. Recipe readiness, source health and cart approval remain separate.

## Verification

Parent verification of this revision:

- **125 tests passed, no failures/skips:** storage 30, live-app UI 24, HTTP 13, launcher 2, picker 2, navigation 21, mockup 33. Explicit direct test-file invocation avoids Node treating `[VIDEOS]` as a glob and executing zero tests.
- Actual Edge/HTTP mockup harness: **21 check groups passed**, including real pointer/keyboard resizing, expand/restore, desktop viewport containment, classifications, multiple pools, network/block dependencies, preserved existing workflows and all five states at 400 pixels without horizontal overflow.
- The design performed **zero project/API reads and zero API writes**, produced no page JavaScript errors, and its HTTP policy blocked a deliberately injected API request before it reached the server.
- Actual Edge/HTTP live-navigation harness: **10 check groups passed**, including direct no-opener design access, unrelated form drafts, per-project settings continuity and operation-specific draft clearing.
- **124 protected files** matched their baseline SHA-256 hashes: original state/engine/config/curation/manifest/owner-decision files, plus Shawn's feedback. Existing Studio and original media were not modified.
- Static added-line security checks found no credential assignments, shell-injection pattern, eval or unsafe deserialization. Final review freezes 21 relevant runtime/test files by SHA-256.

Independent review verdict: **passed for the exact 21 pinned files**, with no security, logic or scope blockers. The reviewer independently reran all seven suites sequentially (**125 passed, no failures/skips**), both supplied Edge/HTTP harnesses (**21 mockup and 10 navigation check groups**) and **8 supplemental browser check groups**. Supplemental probes covered actual sticky-header/pane geometry, both divider extremes, invalid Branding/category proposals, bulk Remove/Replace/clear-all, draft-only/child-only network dependencies, inert display-name text and static-route restrictions. Hashes matched before and after review. Passing tests and technical review do not constitute Shawn's design approval.

**Non-blocking test observation:** the reviewer's initial parallel storage-suite run encountered a Windows `EPERM` during directory publication. An isolated storage retry and the complete sequential rerun passed without code changes; the cause remains undetermined. This is recorded for monitoring, not claimed as a diagnosed or fixed issue. Independent logs and probes are in active-profile temporary `cache/scratch/retro-tv-phase31-independent-review`.

### Reproduce the tests

Use an explicitly disposable folder, never a real project as test scratch. In PowerShell:

```powershell
$env:RETRO_TV_TEST_ROOT = Join-Path $env:LOCALAPPDATA 'hermes\profiles\chatgpt\cache\scratch\retro-tv-phase31-review-tests'
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'
foreach ($name in @('project-store','ui-contract','server','launcher','picker','navigation')) {
    node "$root\TOOLKIT\setup\tests\$name.test.js"
    if ($LASTEXITCODE -ne 0) { throw "$name tests failed" }
}
node "$root\TOOLKIT\mockups\library-manager\tests\mockup.test.js"
if ($LASTEXITCODE -ne 0) { throw 'Mockup tests failed' }
```

Optional real browser harnesses: `TOOLKIT/mockups/library-manager/tests/browser-mockup.cjs` and `TOOLKIT/setup/tests/browser-navigation.cjs`. Both require separately installed Playwright, installed Edge and `RETRO_TV_TEST_ROOT`. Set `RETRO_TV_PLAYWRIGHT_PATH` to that Playwright module and `RETRO_TV_EVIDENCE_DIR` to a disposable evidence folder; leave `RETRO_TV_LEGACY_PROJECT` unset for isolated fixtures. Playwright is test tooling, not an application dependency.

Evidence/screenshots and exact review pins are in the active Hermes profile's temporary `cache/scratch/retro-tv-phase31-revision-evidence` folder. They are not runtime dependencies or durable project backups; the repository contains the runnable harnesses.

## Approval gate

**Phase 3.1 acceptance is complete:** Shawn's response to the revised submission was **"approved"**. No requested design revisions remain. Hermes stopped at the handoff's development gate; Shawn subsequently replied **"yes, pelase proceede"**, explicitly authorizing Phase 3.2 implementation. Do not treat that authorization as acceptance of the implementation or permission to begin Phase 4. No commits were made as part of the Phase 3.1 revision.
