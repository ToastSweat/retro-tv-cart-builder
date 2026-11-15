# Studio controls restored — alpha.13

Close every app window. Extract this ZIP into `F:\[WORKSPACE]\retro-tv-cart-builder`, replacing the included v2 and docs files. Start v2\Start-RetroTV.cmd, open the existing project and saved lineup, then Open Studio. Do not regenerate the lineup or rerun test setup. This package contains app code and documentation only.

## Correction
Alpha.12 replaced established V1 controls with simplified controls without agreement. Alpha.13 restores their behavior from the user's uploaded studio.7z. The separate volume and normalization controls have been removed from Studio. The uploaded V1 NONE/RESTORE/STRONG/AGGRESSIVE/MAX audio filter chains are copied exactly; their existing internal loudness processing is retained. NONE is the original V1 base preset, not a promise of unprocessed audio.

Controls beneath the video:
- START HERE / END HERE keep the portion starting/ending at the playhead. Playhead positions account for an already-trimmed preview. The fields show seconds removed from each end, as in V1. RESET TRIM removes both trims. These actions request a fresh preview; Save edits or Good + next persists the result.
- FIT MAXIMUM TV AREA proposes the largest centered 618:480 crop. AUTO DETECT BORDERS + FIT uses V1 cropdetect settings and multiple sample positions on longer sources, then fits inside the detected area. Inspect the proposal before applying; detection can mistake dark picture content for a border.
- The blue crop box can be moved and its corners resized with the TV shape locked, correcting for source pixel aspect ratio. Arrow keys move the focused box; Shift + arrows resize. Manual pixel fields, NO CROP, REVERT PROPOSAL and APPLY THIS CROP & PREVIEW VIDEO are included. Source and exact proposed TV-result images load separately from full video rendering.
- AUDIO − / REPAIR AUDIO +1 & PREVIEW / RESET AUDIO TO ORIGINAL move through the exact V1 presets. Each preview starts from the original source. Failed repairs restore the previous working level in the controls. Source media is never modified.

Studio previews now use the V1 TV geometry: crop original coded pixels, correct pixel aspect, fit/pad to 618x480, 30fps and 44.1kHz audio. Generic Media Library playback continues to use its source-sized compatible preview. Crop controls stay usable during full preview rendering; Apply again cancels/restarts the old render. Choosing FFmpeg also retries loading crop references. Choose the same working FFmpeg executable used with V1 if needed; ffprobe must be beside it. Runtime selection is still session-only.

## Data compatibility
Saved lineups, reservations, reviews and notes remain in the project. Older edit objects get default NONE repair/profile fields in memory. No bulk metadata migration or source edits occur. Alpha.12 preview caches are invalidated because processing changed. Alpha.12's separate gain/normalization settings are reset when saving through these restored controls. Only a changed clip's edits clear that clip's approval; Good + next saves and approves together. No mandatory second watching pass or new revision.

## Validation and remaining work
68 automated tests pass, zero skips. New coverage compares the five audio chains against a checksum of the uploaded V1 filter definitions; real FFmpeg successfully renders every preset, source images, detected borders and exact 618x480 result. Tests check unchanged originals and cropped-picture dimensions. DOM checks cover removed normalization/gain controls, all restored action groups, playhead positions after an edited preview, repair failure rollback, preview restart inputs and preserved review/resume behavior. All existing project/library/planning/generation tests pass.

Actual Windows/Electron visual acceptance and the user's selected Windows FFmpeg build require testing on that machine. V1 is reference code only; it is not modified by this package. Final build/export remains the next checkpoint. Composite support and content-hash duplicate detection remain future work. Do not claim the entire program is finished or any Windows repository commit was made.
