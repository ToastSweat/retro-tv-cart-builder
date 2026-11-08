# Phase 3.2 UAT revision — stable scrolling and Expand/Collapse

**Status: parent verification and independent exact-revision review passed with no blocking findings; ready for Shawn to retry the UAT case. Phase 3.2 owner acceptance remains pending; Phase 4 is not authorized.**

This addresses Shawn's report that scrolling jumped upward after registering/scanning a folder, especially in expanded Library view; checkbox changes also jumped, and the expanded area's button should say **Collapse** and restore the combined layout. It supplements the [implementation checkpoint](20-HERMES-PHASE-3.2-LIBRARY-ACCEPTANCE-CHECKPOINT.md).

## Confirmed cause and evidence limits

The live renderer replaced Browse's complete control/result subtree on every jobs poll (normally every 1.5 seconds), on metadata draft updates and on media-row selection. Jobs/results and impact panels were also replaced even when unchanged. Native disclosure state could be overwritten by queued toggle events from detached controls. This is unnecessary DOM churn and can disturb reader position, focus and open panels.

The original real-Edge RED fixture registered a generated folder and performed a genuine scan. It proved control-node replacement in **both expanded and normal layouts**, and failed the expected Collapse label. In that one initial viewport, recorded pixel offsets happened to remain stable; it did not independently reproduce every catastrophic snap-to-zero observed by the owner. Preserve this distinction rather than claiming an exact old failure that the probe did not measure.

## Changes

Only production `TOOLKIT/setup/live-workspace.js` changed; no backend, engine, media or project persistence code changed.

- Browse now retains its existing controls while jobs are polled or progress changes. It rebuilds only for a genuine catalog/view-model change, explicit structural form change or operation state that needs new controls.
- Row checkboxes update selection/count/action availability in place, without replacing the row, its checkbox or registration fields.
- Legitimate Browse changes are built off-document and swapped once. The current native disclosure-open state is read before replacement; delayed events from detached old disclosures are ignored.
- Unchanged job/impact panels remain mounted. Completed job result disclosures remain open while another job advances.
- Same-view updates synchronously retain pane/document offsets and focus, including textarea selection. No delayed scroll-restoration callback fights subsequent user scrolling. Intentional asset/tab/surface navigation remains distinct.
- Explicit registration/group/picker acknowledgements invalidate the necessary form view so retained DOM cannot display a stale cleared proposal. Confirmed relinks rebind the visible proposal after clearing only the acknowledged field.
- Each pane's existing **Expand** button becomes **Collapse** when expanded; clicking it again restores all three areas. `aria-expanded` and `aria-controls` reflect the state. Existing Restore all workspaces remains available. Drafts and divider sizes are retained.

## Tests

Added regression coverage in `tests/live-workspace.test.js` and new `tests/browser-library-scroll.cjs`.

Parent results:
- **31 live-workspace tests passed**: previous date/form/availability/draft/uncertainty cases plus toggle, stable node identity, progress disclosure and acknowledged relink tests.
- Real Edge after a genuine 36-file generated-media scan passed normal/expanded Browse polling, row selection, inspector checkbox, stacked narrow-document scrolling, real rescan progress/terminal refresh and all three Expand/Collapse controls.
- Captured offsets stayed at their prior positions in these cases (e.g. pane 3727, rescan 4248, inspector 614 and narrow document 4641). Retained row controls remained the same connected nodes.
- Existing dates, complete Library and navigation browser harnesses also passed. Independent review verified the final exact revision, including the final proposal-clear alignment.

All media and metadata tests use disposable fixtures. No user project was reset/reimported, no original media was scanned or changed, and existing Studio/processing functions are unchanged.

The exact approval set is `review-pins-v4.json` under active-profile temporary `cache/scratch/retro-tv-phase32-scroll-evidence`: **104 files**. Compared with v3, only the live view, its unit tests and the new scroll harness differ. The other frozen runtime/backend files and all **124 protected originals** match their baselines. Logs/measurements are retained there; they are QA artifacts, not runtime dependencies.

## Independent revision review

The reviewer approved the exact 104-file set and complete directory membership, confirmed only the declared three-file delta from v3, and rechecked all 124 protected-original hashes. All 31 live-workspace tests passed. Browser regressions passed 5 scroll, 6 date, 10 complete-Library and 11 navigation groups. Supplementary real-wheel tests in both layouts advanced the reader position monotonically while genuine jobs polls overlapped; idle polling and checkbox clicks then retained position and control identity. Changed-etag refresh also preserved checkbox drafts, textarea focus/selection/scroll and the next real persisted save. All pane toggles retained nondefault sizes without POST or browser-storage writes.

Qualified observations are retained: the first scroll-harness run kept measured offsets but failed an old-checkbox-handle identity assertion; unchanged retry and the instrumented wheel run passed. Server completion is not proof that the browser has consumed its final catalog acknowledgement, so the reviewer recommended an additional harness synchronization barrier. The initial failure's exact timing was not instrumented and is not claimed conclusively diagnosed. One date-harness attempt also hit the previously documented Windows fixture-publication EPERM before browser startup; unchanged retry passed. Neither observation was hidden as an initially clean run, and neither produced a blocking source finding.

Technical approval is not owner acceptance or authorization to start Phase 4.

## Load the revision

1. Let any running operation finish and save any edits you want to keep. Unsaved in-tab drafts are not durable across reload.
2. Refresh the application tab, using **Ctrl+Shift+R** if necessary.
3. No re-import, new project or repeat scan is needed to load this JavaScript-only correction. The existing setup server serves the updated static asset; a server restart is not required for this change.
4. Retry scrolling and checkboxes in both normal and expanded Library layouts, then use the same Collapse button to return to the combined layout.

No commits were made. Request owner confirmation of this UAT correction after independent review; it is not an automatic Phase 3.2 acceptance or authorization for Phase 4.
