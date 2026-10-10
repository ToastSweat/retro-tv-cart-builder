# Retro TV Cart Builder — Version History

This changelog is reconstructed from the actual archived toolkit packages preserved in this checkpoint.

All release zips are under `VERSIONS/`.

## v1 — Initial working architecture

The first usable slice introduced:

- durable asset registry
- stable `AssetID`, `CartID`, and `SlotID`
- immutable cart revisions
- assignment tracking
- unique episodes/commercials
- reusable branding
- NICK01 reference config/plan
- normalized Mini Retro TV review proxies
- one continuous review movie
- local HTML reviewer
- two timeline styles
- boundary controls
- review actions/notes
- replacement dropdown
- CSV export/import
- first non-destructive trim fields

At this point there was no final USB builder yet.

## v1.0.1 — PowerShell 5.1 planner CSV hotfix

Fixed:

```text
Export-Utf8Csv : Argument types do not match
```

caused by a Windows PowerShell 5.1 binder issue involving `Generic.List[object]`.

Initialization became safe to rerun without resetting state.

## v1.0.2 — Second PowerShell 5.1 CSV hotfix

Fixed the same class of binder failure after expensive review proxy normalization.

Important lesson preserved here:

**Do not delete the cache after a late-stage script failure unless there is a specific reason.**

Previously normalized clips could be reused.

## v1.1.0 — First full review lessons

Major functional release based on the first full NICK01 review.

Added/improved:

- independently scrolling cart timeline while review controls stay fixed
- trim values actually applied into new revision manifests
- wrong-show bumper prevention
- contextual branding replacement logic
- `-AutoReplace`
- exact reviewed-proxy finalizer
- final numbered MP4 output
- optional direct USB copy
- conservative final size check

This was the point where the system started becoming a full review → revision → final pipeline.

## v1.1.1 — Cache regression hotfix

v1.1.0 had changed the cache profile label from:

```text
review-v1
```

to:

```text
review-v1.1
```

even though the actual encode settings had not changed.

Because profile text is part of the cache key, everything started re-encoding.

v1.1.1 restored the original profile label.

Lesson: cache identity should only change when output changes.

## v1.1.2 — USB copy progress

Final USB copy gained two PowerShell progress bars:

- overall cartridge progress
- current file progress

Copying is performed in 4 MB chunks so progress updates during large episode files.

## v1.1.3 — Automatic cartridge volume labels

Direct-to-USB builds began automatically labeling the drive.

Examples:

```text
NICK01 -> NICK1
CN01   -> CN1
BOOM02 -> BOOM2
SNICK  -> SNICK
FOX96  -> FOX96
```

Added optional `-VolumeLabel`.

## v1.2.0 — Non-destructive crop system

Added:

- FFmpeg `cropdetect` suggestions
- left/right/top/bottom crop metadata
- manual crop controls
- `Use Suggested Crop`
- `NEEDS_CROP`
- crop-aware cache keys
- `Open-RetroCart.ps1`

Cropdetect is advisory only.

This release also fixed the annoying `[VIDEOS]` path-opening problem by using `Invoke-Item -LiteralPath`.

## v1.2.1 — cropdetect / PowerShell STDERR hotfix

Windows PowerShell 5.1 interpreted FFmpeg's normal cropdetect STDERR output as a terminating `NativeCommandError` because the script used:

```text
$ErrorActionPreference = 'Stop'
```

The hotfix temporarily relaxes error handling around the FFmpeg probe, captures the log, and restores the original setting.

## v1.3.0 — Real-world viewing changes

This release was explicitly driven by actually watching NICK01.

Added:

- trim fields automatically imply `NEEDS_CLIPPED`
- live per-clip elapsed/remaining/total time
- `TRIM START = ELAPSED`
- `TRIM END = REMAINING`
- title/filename-based branding tag inference
- program-specific phrase detection
- leaner NICK-style break recipe
- `-LeanBreaks` for thinning already-reviewed legacy carts

The old break structure was judged too busy in real viewing.

The new target rhythm became:

```text
SHOW
1 commercial
1 network transition
next SHOW
```

## v1.3.1 — Review continuity + handpicked sign-off

Added:

- green GOOD clips
- unchanged GOOD status carried into next revision
- changed/new/repaired clips remain UNREVIEWED
- `Add-HandpickedBranding.ps1`
- durable `STATE\handpicked-branding.csv`
- `SignOffAssetID` in cart config
- configured sign-off appended to fresh/apply-created revisions

Historical note: this release still treated `BAD_AUDIO` as replacement-required. That semantic was corrected immediately afterward.

## v1.3.2 — BAD_AUDIO becomes repair, not replacement

Changed `BAD_AUDIO` to:

```text
KEEP SOURCE + AUDIO REPAIR
```

Added `AudioRepair=LIGHT`.

The original LIGHT pass used:
- high-pass
- low-pass
- mild FFT denoise
- loudness normalization

Audio repair could coexist with trim/crop.

A source with no audio stream still requires replacement.

## v1.3.3 — Sign-off recovery helper

Added:

```powershell
.\Add-RetroCartSignOff.ps1 -CartID NICK01
```

This handles the case where a sign-off was configured after the current revision already existed.

It creates a new immutable revision preserving the current manifest and appending only the sign-off as UNREVIEWED.

## v1.3.4 — Stale replacement safety

Review CSVs could contain:

```text
Action = NEEDS_CROP
ReplacementAssetID = BR-...
```

Older apply behavior could honor the replacement despite the action.

v1.3.4 restricted replacement IDs to replacement-bearing actions and ignored contradictory stale IDs with warnings.

This was a safety improvement, but later revealed the reviewer itself needed stronger intent semantics.

## v1.3.5 — Invalid manual replacement fallback

A manually selected replacement could become non-READY before apply completed.

The concrete NICK01 case involved a branding asset selected as a replacement in one slot while that same source was marked `BAD_AUDIO` elsewhere in the review.

With `-AutoReplace`, invalid manual selections now fall back to compatible READY assets rather than immediately aborting.

Also prevented automatic replacement from selecting the same asset already in the slot.

## v1.3.6 — Second-stage replacement fallback

v1.3.5 fixed the early validation stage, but a later manifest-build hard stop still existed.

v1.3.6 added equivalent recovery at manifest-build time.

With `-AutoReplace`, invalid replacements can be recovered both before and during new-manifest construction.

## v1.4.0 — BAD_AUDIO restoration fixed properly

This release acknowledged that v1.3.x LIGHT repair was technically present but too weak for many real archival audio problems.

Introduced:

### RESTORE

- high-pass cleanup
- low-pass cleanup
- de-clipping
- de-clicking
- stronger adaptive FFT denoise
- dynamic level correction
- final loudness normalization
- 44.1 kHz output

### STRONG

If a clip already repaired with LIGHT/RESTORE is marked `BAD_AUDIO` again, it escalates to stronger restoration including more aggressive spectral/broadband denoising.

Also added:

```powershell
.\Test-RetroCartAudioRepairs.ps1 -CartID NICK01
```

Review UI gained explicit repaired-audio indicators.

Audio repair acquired its own cache profile version so repaired clips could be forced to rebuild without invalidating every normal cached clip.

Legacy `LIGHT` is interpreted as `RESTORE`.

## v1.4.1 — Replacement dropdown semantics fixed

The reviewer itself was finally made authoritative about replacement intent.

Selecting a replacement now immediately sets:

```text
Action = REPLACE_THIS_CART
```

Changing the action away from a replacement-bearing action clears the replacement selection.

Replacement-bearing actions:

```text
REPLACE_THIS_CART
BAD_QUALITY
DUPLICATE
WRONG_ERA
WRONG_NETWORK
```

Keep/repair states clear replacement intent:

```text
GOOD
UNREVIEWED
BAD_AUDIO
NEEDS_CLIPPED
NEEDS_CROP
```

This prevents future exported CSVs from containing contradictory replacement state.

## Current baseline

**v1.4.1 is the checkpoint baseline.**

NICK01 reached r009 under this generation of the workflow and finished with 36/36 clips marked GOOD.

Future versions should be incremental and preserve state/revision compatibility where practical.
