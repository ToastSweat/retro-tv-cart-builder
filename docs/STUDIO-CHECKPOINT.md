# Studio checkpoint — alpha.12

## Install and continue
Close every Retro TV Cart Builder window. Extract this ZIP into `F:\[WORKSPACE]\retro-tv-cart-builder`, replacing the included v2 and docs files. Start `v2\Start-RetroTV.cmd` as usual and open your existing project. No project data or media is shipped in this update. Do not rerun test setup or regenerate your saved lineup.

Open Carts & Templates, then your cart's Generate / lineup screen and Open Studio.

## Review workflow
- The saved lineup opens at your last clip. Use Play to watch the original or a cached processed preview.
- Good + next saves edits, approves that clip and advances. Previous, Next and the clip list navigate without approving. Returning later resumes the saved cursor.
- Save edits stores crop, trim, audio and notes. Changing processing clears only this clip's approval. Notes alone retain approval. Good + next can save and approve together; no new revision or repeated viewing is required.
- Trim start/end are seconds in the original; blank end means the end. Crops are pixels removed from the original edges. Volume gain and optional loudness normalization are available. These are not V1 noise restoration presets.
- Apply edits / render preview renders this clip into the project's cache. Controls remain usable. Change crop values and Apply again to cancel the older preview and start with the new values. Cancel preview stops processing. Watch original returns to the source without clearing your unsaved controls.
- If direct playback fails, render a compatible preview. Choose FFmpeg selects your working executable for this session; ffprobe must be beside it. Use the working bundled V1 executable if your PATH version has been crashing. No automatic runtime download or permanent executable setting was added.
- Replace clip searches all allowed template alternatives under the saved lineup's pool/year rules. Reserved candidates show the cart using them and cannot be selected. Replacing frees this slot's old reservation, reserves the new clip and resets only this slot's edits/review.

Library classification and Studio approval are separate. All edits and review data stay in this project. Original media stays untouched. Review changes use backed-up writes to data/generated-carts.json. Existing saved lineups load with default edits and UNREVIEWED status; there is no destructive migration.

## Limits and next checkpoint
Final build, USB/Jellyfin export, preview size budgeting, composite creation/component identity tracking and advanced audio restoration remain to implement. This checkpoint does not export a finished cart. A changed template/cart requires a freshly checked lineup; avoid editing those definitions mid-review. Rechecking and saving a newly generated lineup replaces the active lineup, so preserve review work by using Studio replacements.

Repeat prevention uses project-local asset/path and recognized episode identities. It does not detect every re-encode or renamed duplicate by content. Final-build implementation must revalidate source changes, review approvals and current edit signatures, reuse valid caches and check target size before expensive rendering. Approval must not introduce a second mandatory watching pass.

## Validation
66 automated tests pass with zero skips. Service tests cover persisted approvals/cursor, notes retention, affected-clip invalidation, stale-edit rejection, crop/trim bounds, replacement eligibility/reservations and changed-template protection. The DOM workflow checks entry from a saved lineup, Good + next, resumed position, controls enabled during rendering and a second Apply with changed crop. Real FFmpeg tests validate cropped dimensions, trimmed duration, encoded audio/video, unchanged source bytes and cache reuse. Existing library, planning and generation checks remain passing.

Windows/Electron visual acceptance and the user's actual FFmpeg build remain to be checked on the user's machine. No Windows repository commit or push has been performed here.
