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

## v1.4.2 — Reusable repaired sign-off recipes

A configured sign-off with repairable source-health state can reuse an approved
repair recipe from a prior FINAL instead of lying that the raw source is READY.

## v1.4.3 — Review-apply transactional preflight

Added preflight before durable state mutation, stale-review detection, SHOW
replacement support, complete repair schema normalization, and verification that
requested repair/replacement operations actually reach the proposed manifest.

## v1.4.4 — Repairable replacements + handpicked episode pool

Selected replacement sources in repairable states can inherit a valid repair
recipe. Added `Add-HandpickedEpisode.ps1` and durable
`STATE\handpicked-episodes.csv` replacement-pool support.

## v1.4.5 — FFmpeg PowerShell argument fix

Stopped using PowerShell's automatic `$args` variable as the FFmpeg argument
array.

## v1.4.6 — Corrupt cache validation

Cached proxies are probed before reuse so interrupted/invalid MP4s are not
treated as valid cache hits.

## v1.4.7 — Direct FFmpeg launch

Avoided a Windows PowerShell native-process output-capture path that could crash
otherwise valid FFmpeg encodes.

## v1.5.0 — Retro TV Cart Studio

Introduced the local Studio app and mutable revision-specific draft layer.

Studio made clip-level repair iterative without forcing a new immutable revision
for every preview attempt.

## v1.5.1–v1.5.4 — Studio preview/launcher/audio hardening

This generation added automatic preview behavior, PowerShell preview rendering,
bracket-safe launcher behavior for `F:\[VIDEOS]\...`, and safer high audio
repair behavior.

## v1.6.0 — Studio UX refinement

Improved the practical clip-review workflow and made Studio the normal
day-to-day repair surface.

## v1.6.1 — Damaged source detection

Added source-health diagnostics so real H.264/AAC corruption produces a concise
replace-the-source message instead of being confused with ordinary noise/level
problems.

## v1.7.0 — Final Cartridge UI

Added final-cartridge controls to Studio:

- build final locally
- enumerate target drives
- explicit target-drive verification
- build + copy to selected drive
- all-GOOD and uncommitted-draft gates

## v1.7.1 — Visual crop guide

Added original-source crop visualization.

## v1.7.2 — Exact final crop preview

Added a second pane that renders the actual crop → fit → pad final geometry.

## v1.8.0 — Real crop box + SAR-safe render geometry

Replaced misleading edge guides with a draggable/resizable crop box locked to
the physical Mini Retro TV proportions.

Updated Studio preview rendering so anamorphic/non-square-pixel source media is
corrected before final fit.

## v1.8.1 — Full Review builder fix

Full Review moved to `CACHE\review-v2`.

Changes include:

- SAR-safe geometry matching Studio
- transactional review proxy encoding
- validation before cache publication
- locked corrupt-cache fallback instead of hard failure
- transactional combined review movie
- concise Studio error display

## v1.8.2 — Final Cartridge reuse

Fixed FINAL deletion/locking failures.

The finalizer now:

- validates an existing FINAL
- reuses it when it matches the current revision
- builds replacements in a staging directory
- refuses clearly when a stale FINAL is genuinely locked
- delays USB relabeling until local FINAL is valid

## Current baseline

**v1.8.2 is the current Studio checkpoint.**

Current working-cart milestone at the 2026-10-11 snapshot:

```text
NICK01 r009 BUILT
NICK02 r010 BUILT
NICK03 r002 BUILT
NICK04 r002 BUILT
SNICK1 r002 in progress
```

NICK01 remains the first completed reference cart, but it is no longer the only
proof that the architecture works.
