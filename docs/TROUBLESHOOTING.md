# Troubleshooting

## The application does not launch

Run `v2/Start-RetroTV.cmd` and keep the console error. Check Node.js 22+ and npm. A fresh launch needs network access to install the pinned dependencies. If dependencies changed, close the app and run `npm.cmd ci` from `v2`.

Close extra app copies before diagnosing cache-access messages. Launching another window is not a repair for a stuck instance. Preserve your project before reinstalling app files.

## My networks, artwork or carts are missing

Check which project is open and whether `project.json` points to the expected folder. Application-code updates do not include your personal data. See [project recovery](PROJECT-FILES-AND-BACKUPS.md). Do not replace current data with an old snapshot without inspecting it.

## A source library is missing

Use Project settings to locate the existing library. Then rescan if needed. Do not assume a missing file was deleted simply because its drive is disconnected. Source paths remain external to the project.

## Generation leaves unfilled slots

Read the per-slot explanation. Check classification, category, network/show associations, year rules, unknown-year allowance, commercial pool tags, exclusions, source-quality flags, source availability and reservations on other saved lineups. Add an appropriate generic fallback to the assigned template only if you actually want it.

A preview does not reserve files. Saving a lineup does. Discarding an obsolete saved lineup releases its reservations. Repeat checks are project-local and are not universal content-duplicate detection.

## A source will not play

Some formats cannot play directly in the embedded player. Create a compatible preview or use Play/Refresh preview. Choose a known-working FFmpeg executable and keep its matching FFprobe alongside it. The choice is remembered for this machine.

A native FFmpeg crash is different from a normal warning or a bad source. Keep the executable version, selected audio level and diagnostic text. The project previously encountered failures in a particular FFmpeg 9.0.1 build; an existing known-working build is preferable to randomly changing repair settings. Cropping or remuxing cannot promise to repair genuinely damaged media.

## Audio repair fails

The attempted level rolls back to the previous working one. The original source remains unchanged. Try the known working FFmpeg build, a lower repair level, or another source. Keep the error details rather than assuming every decoder warning makes the clip unusable.

## Crop or trim looks wrong

The box is in original-source pixels and accounts for pixel aspect ratio. Fit TV area targets 618×480; border detection is only a proposal. Inspect both panes. Start/end trim values are seconds removed from the original ends; playhead buttons account for already-trimmed playback. Reset if you need to widen an earlier trim.

You can change crop proposals while preview rendering is active. Apply again restarts the preview. Good + next approves the resulting chosen settings; changed settings reset only that clip's approval.

## Build says review is stale or a source changed

Reopen that clip and verify its current source/settings, then approve it again. Source size/modification stamps are checked against approval. Changing a cart/template can require a new generation proposal. No mandatory second viewing or revision is added merely to build an unchanged approved cart.

## The cart is too large

Local builds default to 3600 decimal MB; USB uses 97% of actual free space. These are separate limits. Normal builds do not silently lower quality. Adjust the local budget, use a larger drive, shorten the lineup, or explicitly choose Fit to size budget. Fit mode plans a two-pass bitrate and can reduce quality; very low budgets are rejected. Output size is checked before final replacement/copy.

A USB update needs enough free space to stage the full new copy safely. Existing files are not erased to make room. An already-identical verified cartridge can be reused without staging another copy.

## The drive is disabled or copying is refused

The system drive and volumes containing the project or source libraries are protected. Verify the actual target. Other MP4 files or changed/unowned files must be handled manually; do not point the app at a media-storage volume to work around this protection.

A drive-label warning can occur after a successful verified copy if Windows denies labeling. Read the completion status. Do not disconnect while copying or verifying. Cancel build and wait for cleanup before closing the app or ejecting the device.
