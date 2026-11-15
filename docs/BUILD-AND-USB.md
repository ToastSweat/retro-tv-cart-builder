# Retro TV Cart Builder v2 — build and USB closeout

Version: 2.0.0-beta.1. Jellyfin export is excluded at the user's request.

## Install and finish a cart
1. Close every app window. Extract this ZIP into F:\[WORKSPACE]\retro-tv-cart-builder, replacing the included v2 and docs files. Run v2\Start-RetroTV.cmd.
2. Open the existing project, saved lineup and Studio. Do not regenerate the lineup or rerun NICK01 setup.
3. If needed, use CHOOSE FFMPEG to select the known working V1 ffmpeg.exe (with ffprobe.exe alongside it). This machine's choice is remembered between launches. No binaries are silently downloaded or selected from project files.
4. Finish Good + next on each clip. The timeline must show every clip GOOD and have no repeat warnings. Existing approvals count. No second viewing, commit revision or optional full-review compilation is required.
5. BUILD FINAL LOCALLY creates a clean numbered cartridge in this project's builds/<cart ID>/FINAL folder. OPEN FINAL FOLDER reveals it. The local size budget defaults to 3600 decimal MB and can be adjusted.
6. For USB: REFRESH DRIVES, choose the exact cartridge drive, verify its letter/label, tick confirmation, then BUILD FINAL + COPY TO SELECTED DRIVE. A native confirmation identifies the target. USB uses 97% of that drive's actual free space, not the local 3600 MB setting. The confirmation resets after success.

The original Studio layout, timeline states/colors, playback/trim/crop/audio controls and notes remain. The familiar final cartridge controls are now connected. You can use Cancel build, which waits for safe cleanup. Editing/project changes and closing the main window are blocked while a build/copy is active.

## Outputs and reuse
- Numbered 0001, 0002… MP4 files, H.264, 618x480, 30fps, AAC stereo at 44.1kHz, using the original V1 audio/crop geometry. Silent sources get a silent audio track for consistent cartridge/full-review playback.
- cartridge.json records per-file hashes, source identity, edits and the approval snapshot; playlist.m3u lists the playback order. No source media is modified.
- Valid approved Studio previews are reused. Missing/incompatible previews are rendered from original media with the approved settings. A matching, verified final build is reused without another encode.
- New finals stage separately; the previous final remains intact until successful validation/commit and is retained in a FINAL-previous-* backup folder. These backups consume project-drive space and may be removed manually when no longer needed.
- Optional BUILD/OPEN FULL REVIEW combines the final numbered files into a separate project-local video and opens it in a playback window. This is a convenience, never an approval gate.

## Size budgeting
Normal builds preserve the approved processing/CRF profile. If all previews exist, their exact total is checked before building. With missing previews, their eventual CRF sizes are unknown; the build validates runtime/space up front, checks actual size as outputs arrive and stops before replacing the final or writing USB if too large. Valid new previews remain cached for retry.

Fit to size budget is explicit and off by default. When needed it calculates a whole-cart bitrate from runtime, budget, 128 kbps audio and container allowance, and uses two-pass video encoding. Alternate budget renders are cached separately; original approved previews remain unchanged. This can reduce quality. Bitrates below 350 kbps video are rejected rather than producing an excessively degraded cartridge; short-cart budget rates are capped at 6000 kbps. Actual final size is always verified. If output still exceeds the limit, nothing is copied; increase the budget, use a larger drive or shorten the lineup.

A local budget is a media-size cap, not a reservation of that much space when all exact preview sizes are known. Missing/budget renders require room for their caches plus a staged final. Optional full review requires another cart-sized amount of local space.

## USB behavior
Only Windows mounted fixed/removable volumes are enumerated. System drives and volumes containing this project or its source libraries are disabled. No drive is auto-selected or formatted.

Copy stages the cartridge, verifies SHA-256 hashes, rechecks the same volume identity, then commits flat numbered MP4 files to its root. The drive label becomes the cart label (NICK01 → NICK1). If changing the label is denied by Windows, verified copying still completes and reports that warning.

A small project/cart receipt identifies files previously written by this app. Only receipt-owned, unchanged files can be replaced. Other MP4 files cause a clear stop: use an empty drive or remove old cartridge media manually. Unrelated text/documents are retained. Updates need sufficient free space to stage a full new copy safely; old files are not deleted to make room. A byte-for-byte matching cartridge is verified and reused even when little free space remains.

Ordinary copy/commit failures roll back to the previous receipt-owned cartridge. Disconnecting a drive or killing the process during a filesystem commit can prevent rollback; .retro-building-* / .retro-previous-* recovery folders may remain. Preserve those folders for recovery rather than deleting them blindly. No software can guarantee rollback after a physically removed device.

## Approval and freshness
Builds reject unreviewed/flagged clips, repeats, changed cart/template definitions, missing sources and sources changed since approval. Source file size/modification stamps and the current approval/edit signature are rechecked before local commit and USB copy. Only affected clips need correction/reapproval. Hash verification covers the exported files; source identity does not implement arbitrary content-hash duplicate detection.

## Verification and acceptance
76 automated tests pass, zero skips. Real FFmpeg tests cover approved-cache reuse, numbered local outputs, original source preservation, silent source audio, full-review concatenation (including apostrophes in paths), explicit two-pass budgeting and output validation. Filesystem tests cover USB staging/hash verification, idempotent reuse, unrelated-file and space protection, disconnected target identity, cancellation, corrupted copies, and rollback after simulated USB/local commit failures. UI tests cover readiness, building progress, edit locking, drive confirmation, copy completion, and the retained V1 controls/layout.

Windows Get-Volume enumeration, Set-Volume labeling, Electron playback and the physical TV cartridge still need the user's real-machine acceptance test. No actual Windows drive has been written or Windows repository commit made from this workspace.

## Scope at this checkpoint
The project/library/template/generate/review/local-build/USB workflow is implemented. Jellyfin export is intentionally omitted. Composite creation/component tracking, content-hash duplicate detection, global cross-project locking and generate-all orchestration remain separate future features; do not claim they are implemented. Current generation remains one selected cart at a time. Existing imported composite media is still blocked by generation until safe component tracking exists.
