# Phase 2 — Hub and workspace navigation checkpoint

**Status:** Phase 2 is approved by Shawn. His explicit "approved. all is working. you may continue" authorizes Phase 3.1 Library Manager layout/workflow mockups only. Phase 3.2 implementation and all later modules remain gated. The design review is tracked in [14-HERMES-PHASE-3.1-LIBRARY-MOCKUP-CHECKPOINT.md](14-HERMES-PHASE-3.1-LIBRARY-MOCKUP-CHECKPOINT.md).

Shawn approved Phase 1.1 and its Explorer-style picker revision with **"confirmed, approved to move on"**. That authorizes only the Phase 2 shell described in `Retro-TV-Hermes-Overhaul-Handoff.md:187–199`. See [the approved setup checkpoint](12-HERMES-PHASE-1.1-SETUP-CHECKPOINT.md) and [owner decisions](11-USER-PHASE-1-DECISIONS.md).

## Launch

Save or cancel any current form before restarting the app. Stop the existing setup console with Ctrl+C, then double-click the same launcher:

```text
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\Start-RetroCartSetup.cmd
```

The filename is retained for compatibility; it now starts the **Phase 2 hub and project settings** application at `http://127.0.0.1:17872/`. Leave its console open.

- With a saved project, launch opens **Main hub**.
- Without a saved project, the approved setup chooser opens. Completing create/open/import leads to the hub.
- A missing or incompatible saved project reports its existing setup error rather than initializing over it.
- The original `Start-RetroCartStudio.cmd` and original engine remain separate and unchanged. The new TV Studio entry page does **not** launch the old Studio or change its selected cart.

This remains a development launcher using installed Node.js/Windows PowerShell, not the public installer. Installer/runtime bundling and deployment remain Phase 6.2 work.

## Delivered

### Main hub

Three clear destinations:

1. **Library Manager**
2. **Cart Builder**
3. **TV Studio**

Each opens a workspace entry page with a working **Back to hub** action. A global **Hub** action is available whenever a project is selected. The selected project name and full folder remain visible in the header, including the legacy/read-only indicator. The hub also exposes the existing recorded counts/locations in a native details disclosure and keeps Switch project accessible.

### Honest workspace entry pages

Every entry explicitly says **Workspace entry only** and **Tools are not implemented yet**. These pages do not scan, plan, reserve assets, review clips, repair media, render, build or export. They contain no simulated media results or fake processing controls.

- Library Manager design remains the separate Phase 3.1 approval checkpoint.
- Cart Builder design/implementation remain Phases 4.1/4.2.
- New TV Studio design/implementation remain Phases 5.1/5.2.

Only the shell and navigation exist in this phase.

### Settings and edit continuity

- **Settings** is reachable from the hub and each entry page.
- Managed projects reopen the approved editable settings form.
- Legacy projects now have an accessible **read-only settings view** with the existing **Import a copy to edit settings** action. No legacy edit form or original-state write is enabled.
- Leaving a dirty form can be cancelled. If navigation is accepted, form values remain in the current tab; the reviewed confirmation is invalidated and must be obtained again before saving.
- Settings drafts are scoped by project folder. Switching to another project and editing its settings does not replace the first project's draft.
- A successful Save/Create/Import clears only the confirmed operation's form. Unrelated Create/Import values and other projects' Settings drafts remain available, with dirty/unload warnings retained. Definite failures and uncertain responses do not clear those drafts or automatically replay confirmation.
- One import wizard is cached per tab. Starting an import from a different source requires explicit confirmation before replacing an edited import form; cancelling retains the old form and does not claim a new copy flow started.
- Cached settings that predate newer saved settings get a warning before review; an unchanged cached form can adopt the current saved values.
- Drafts are **tab-memory only**, not a new durable autosave/history feature. Closing/reloading the tab can lose unsubmitted values; the existing before-unload warning remains. Use explicit Review/Save for persistence.
- If status legitimately reports no active selection while a workspace is open, the UI returns safely to the chooser and retains its cached edits/dirty warning. It does not reset project data. Existing uncertain-write target recovery remains fenced.

## Reused, changed and added

**Reused:** the approved setup/storage adapter, input review/confirmation, distributed metadata import, original IDs/drafts/history references, Explorer-style picker, security guards and existing runtime diagnostics.

**Changed:** `TOOLKIT/setup/app.js`, `index.html`, `style.css`, the shell's phase/readiness/help text in `server.js`, and matching launcher readiness text/check. The backend bootstrap now identifies Phase 2. Existing test assertions were updated for that intentional phase/UI change.

**Added:** controller navigation regressions in `tests/navigation.test.js` and an optional real Edge harness `tests/browser-navigation.cjs`.

**Not changed:** `project-store.js`, the approved native picker helper, original Studio, planning/render/finalizer scripts, source media, live registries/drafts/configs, old revision manifests or existing builds. No new framework/database or project migration was introduced.

## Validation

### Automated tests

Current dependency-free Node suites:

| Suite | Passed |
| --- | ---: |
| Project storage | 30 |
| UI/controller/DOM/transport | 22 |
| HTTP/security | 12 |
| Windows launcher | 2 |
| Explorer picker compilation/integration boundary | 2 |
| Workspace navigation/state continuity | 21 |
| **Total** | **89** |

The navigation suite covers all three entry/return paths without processing requests, Settings/dirty-form continuity, read-only legacy Settings, per-project drafts, safe no-selection fallback, successful-confirmation isolation, failed/uncertain confirmation preservation, edit-path dirty tracking, and explicit replacement of a cached import source. The launcher test starts a real isolated Windows PowerShell/Node server from the bracketed repository path.

The final independent review passed on all 15 pinned production/test files with no blocking security or logic findings. It reran all six suites (**89 passed, no failures/skips**) and the real Edge harness with fixture-only projects. It also checked nullable selection during an unresolved write and read-only Settings across all three workspaces using owned legacy fixtures. Those extra checks passed; adding the combined null/pending-write case as a permanent regression was a non-blocking suggestion. The earlier blanket draft-reset blocker was corrected and explicitly re-reviewed. Technical review acceptance is not Shawn's phase approval.

Run test files directly, avoiding Node's absolute `[VIDEOS]` glob trap:

```powershell
$env:RETRO_TV_TEST_ROOT = Join-Path $env:LOCALAPPDATA 'RetroTVCartBuilder-TestScratch'
$tests = 'F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\setup\tests'
foreach ($name in @('project-store','ui-contract','server','launcher','picker','navigation')) {
    node "$tests\$name.test.js"
    if ($LASTEXITCODE -ne 0) { throw "$name tests failed" }
}
```

Use only a disposable test-scratch directory, never an existing project or media location. Node built-in fixtures/controller tests are not presented as browser or television proof.

### Real browser checks

Actual installed Edge, real HTTP server and real ProjectStore were exercised with disposable metadata and isolated preferences:

- Saved project → hub → each of the three entries → hub.
- No POST/media job calls from workspace entry/return or Settings navigation.
- Dirty-form leave cancellation and restoration of the same draft from a workspace.
- Two real projects with separate unsaved settings; neither descriptor was silently updated.
- A real Settings confirmation retained unrelated pending Create/Import forms and the other project's settings, including the unload warning. A real Create confirmation cleared its own form but retained pending Import/Settings work.
- The explicitly supplied existing legacy project opened read-only; its workspace Settings had no edit form.
- Refresh returned to the hub; desktop and 400-pixel layouts had no horizontal overflow or page JavaScript errors.
- Actual first-run create/setup and settings saves both landed on the hub.
- A new Node process and new Edge instance reopened the saved project at the hub.
- In a disposable preference-loss fixture, removing the selection file produced a safe chooser rather than a null-project rendering crash. Restoring that preference retained the unsaved settings without applying them.

**123 protected original engine/state/config/curation/manifest/owner-decision files** matched their retained hashes. The new setup launcher is intentionally excluded from this legacy set because its Phase 2 readiness/text changed. No source media or existing build videos were written.

The optional reproducible Edge harness requires a separately supplied Playwright installation and the installed Edge channel; neither is a new application dependency:

```powershell
# Set RETRO_TV_PLAYWRIGHT_PATH to your separately installed Playwright module directory.
# RETRO_TV_EVIDENCE_DIR optionally retains screenshots/results outside the disposable fixture.
node "$tests\browser-navigation.cjs"
if ($LASTEXITCODE -ne 0) { throw 'Browser navigation checks failed' }
```

`RETRO_TV_LEGACY_PROJECT` is optional: when explicitly set, that metadata root is opened read-only while app preferences/writes remain in scratch. Leave it unset for fixture-only runs. Temporary screenshots and probe results in Hermes scratch may be pruned; they are not project backups or runtime prerequisites.

## Limits

- Workspace contents are deliberate entry placeholders, not approved module layouts or functioning tools.
- Navigation is client-side; refresh/relaunch returns to the hub rather than deep-linking into a workspace.
- Unsaved form values survive navigation/project switching only within the current tab. There is no promise to recover unsubmitted forms after closing the browser.
- Existing setup limitations remain: local folders only (no UNC/junction projects), metadata-copy rather than full portable archive, setup-only locks, preliminary permission checks, no crash/power-loss atomicity claim, and no comprehensive global inspection-resource budget.
- No cart builds, USB writes/ejection, media repair, or new hardware playback verification were performed for this phase.

## Shawn's approval checklist

1. Restart using the existing setup CMD and confirm a saved project opens at Main hub.
2. Enter **Library Manager**, **Cart Builder**, and **TV Studio**; return to the hub from each. Confirm their tools are clearly labelled not implemented.
3. Open Settings from an entry page; confirm the correct project name/folder remains visible.
4. Type an unsaved managed-project setting, try leaving and cancel once, then navigate away and reopen Settings. Confirm the value remains and is not silently saved.
5. If using the legacy project, inspect the read-only Settings page and confirm originals remain protected.

**Approval received:** Shawn replied "approved. all is working. you may continue" after testing Phase 2. Proceed only to Phase 3.1 Library Manager layout/workflow mockups, then demonstrate and stop for design approval before any Phase 3.2 implementation or later cart/studio work.
