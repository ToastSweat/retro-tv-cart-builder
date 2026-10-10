# Retro TV Cart Builder — Operator Guide

This is the current practical workflow for v1.4.1.

## 1. Prerequisites

Current environment assumptions:

```text
Windows 11 / Windows PowerShell 5.1 compatible
FFmpeg available as `ffmpeg`
FFprobe available as `ffprobe`
Browser capable of opening the generated local HTML reviewer
```

Default toolkit location:

```text
F:\[VIDEOS]\Retro TV Cart Builder\Toolkit
```

Open PowerShell:

```powershell
Set-Location -LiteralPath 'F:\[VIDEOS]\Retro TV Cart Builder\Toolkit'
```

If scripts were downloaded and Windows keeps warning about them:

```powershell
Get-ChildItem -LiteralPath 'F:\[VIDEOS]\Retro TV Cart Builder\Toolkit' -Recurse -File |
    Unblock-File
```

## 2. Initialize or refresh the library

Run:

```powershell
.\Initialize-RetroCartLibrary.ps1
```

This:
- reads the current curated branding/commercial CSVs
- reads all cart config JSONs for episode sources
- loads durable handpicked branding
- refreshes `STATE\asset-registry.csv`
- preserves durable bad/repair source-state flags
- updates path settings

Safe to run again after adding content.

## 3. Create a brand-new cart plan

For a cart that does not already exist:

```powershell
.\New-RetroCartPlan.ps1 -CartID NICK01
```

This creates:

```text
F:\[VIDEOS]\Retro TV Builds\NICK01\r001\cart-manifest.csv
```

and reserves/logs the selected assets.

If the cart already exists, the planner refuses to overwrite it.

`-ForceNewRevision` exists, but use it only when intentionally creating a brand-new plan revision. Normal iteration should go through review/apply so history and repair intent remain coherent.

## 4. First-run NICK01 shortcut

For the historical NICK01 first-run workflow:

```powershell
.\Start-NICK01.ps1
```

That performs:
- initialization
- NICK01 plan creation
- review build

For ongoing work, running the individual commands is clearer.

## 5. Build a review

```powershell
.\Build-RetroCartReview.ps1 -CartID NICK01
```

Output goes under the current revision:

```text
...\NICK01\r00X\REVIEW\
```

Important outputs:

```text
NICK01-review.mp4
review-manifest.csv
cart-review.html
```

The first build can take a while.

Later revisions should reuse cached normalized proxies for unchanged clips.

## 6. Open the reviewer

Use the helper instead of trying to open the path through wildcard-sensitive PowerShell commands:

```powershell
.\Open-RetroCart.ps1 -CartID NICK01
```

This safely uses `Invoke-Item -LiteralPath`.

## 7. Review the broadcast

The review movie is the exact proposed sequence.

Useful actions:

```text
GOOD
REPLACE_THIS_CART
BAD_QUALITY
BAD_AUDIO
NEEDS_CLIPPED
NEEDS_CROP
DUPLICATE
WRONG_ERA
WRONG_NETWORK
UNREVIEWED
```

### Replacement behavior in v1.4.1

Selecting a clip in the replacement dropdown automatically changes Action to:

```text
REPLACE_THIS_CART
```

If you later change the action to a keep/repair state such as:

```text
GOOD
UNREVIEWED
BAD_AUDIO
NEEDS_CLIPPED
NEEDS_CROP
```

the replacement selection is cleared.

This prevents ambiguous CSV rows like:

```text
Action = GOOD
ReplacementAssetID = BR-...
```

## 8. Trimming

Pause at the exact point.

Use:

```text
TRIM START = ELAPSED
TRIM END = REMAINING
```

Non-zero trim fields automatically imply a clipping repair.

The source file is never edited.

## 9. Cropping

For baked black borders:

- inspect the cropdetect suggestion
- click `Use Suggested Crop` if sensible
- or enter left/right/top/bottom manually

Do not blindly trust cropdetect on archival TV footage.

## 10. BAD_AUDIO

Mark the clip:

```text
BAD_AUDIO
```

The next revision keeps that source and processes the audio.

Repair progression:

```text
NONE
→ RESTORE
→ STRONG if BAD_AUDIO is reported again
```

Repaired clips are visibly indicated in the next review and should be listened to again.

## 11. Export the review CSV

**Always export the review CSV before rebuilding/replacing the review page.**

The browser reviewer uses local state, but the CSV is the durable operator artifact.

Example filename:

```text
NICK01-r009-review-state.csv
```

## 12. Find the newest exported review CSV

If exported into Downloads:

```powershell
$review = Get-ChildItem "$HOME\Downloads\NICK01-r*-review-state*.csv" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$review.FullName
```

Read the printed path and verify it is the intended file before applying.

## 13. Apply the review

Typical current command:

```powershell
.\Apply-RetroCartReview.ps1 `
    -CartID NICK01 `
    -ReviewCsv $review.FullName `
    -AutoReplace
```

`-AutoReplace` lets the script choose a compatible READY replacement when a replacement-required row has no valid manual replacement or a chosen replacement has become unusable.

For the old overloaded NICK01 break layout, this was also used:

```powershell
-LeanBreaks
```

`-LeanBreaks` removes legacy:
- NEXT
- BUMPER_OUT
- STING
- ads after AD-01

A newly planned cart whose config already uses `BreakStyle: LEAN` normally does not need `-LeanBreaks`.

Applying a review creates the next immutable revision.

## 14. Audit audio repairs

After an apply that included BAD_AUDIO, run:

```powershell
.\Test-RetroCartAudioRepairs.ps1 -CartID NICK01
```

Expected effective modes:

```text
LIGHT   -> RESTORE   (legacy compatibility)
RESTORE -> RESTORE
STRONG  -> STRONG
```

The audit shows whether a current review proxy was built with the requested repair.

## 15. Rebuild and reopen

```powershell
.\Build-RetroCartReview.ps1 -CartID NICK01
.\Open-RetroCart.ps1 -CartID NICK01
```

Unchanged approved clips carry forward as green `GOOD`.

Changed/replaced/repaired/new clips should remain `UNREVIEWED` so they can be spot-checked.

Repeat:

```text
review
→ export CSV
→ apply
→ audit if needed
→ build
→ open
```

until the cart is clean.

## 16. Final approval

Before final build, visually verify the current reviewer is all green and/or export a final CSV and confirm every row is `GOOD`.

Example PowerShell sanity check:

```powershell
$rows = Import-Csv -LiteralPath $review.FullName
$rows | Group-Object Action | Select-Object Name,Count
```

For the finished NICK01 r009 reference state:

```text
GOOD  36
```

### Important limitation

`Build-RetroCartFinal.ps1` validates that:
- the current manifest has a review build
- every manifest slot exists in `review-manifest.csv`
- the reviewed AssetID matches the current manifest
- every normalized proxy exists

It does **not currently enforce that the browser/exported review state is all GOOD**.

Human approval is still a required gate.

This should be improved before public release.

## 17. Build final output locally

```powershell
.\Build-RetroCartFinal.ps1 -CartID NICK01
```

Output:

```text
F:\[VIDEOS]\Retro TV Builds\NICK01\r00X\FINAL\
```

Contents:
- numbered MP4 files in playback order
- `cart-final-manifest.csv`
- `README.txt`

The finalizer copies the exact reviewed proxies rather than transcoding again.

Default no-drive size ceiling:

```text
3,600,000,000 bytes
```

If the cart is too large, it stops instead of silently lowering quality.

## 18. Build directly to USB

Example:

```powershell
.\Build-RetroCartFinal.ps1 `
    -CartID NICK01 `
    -TargetDrive 'E:\'
```

The finalizer:
- checks available drive space
- uses 97% of free space as a safety limit
- creates the FINAL folder
- copies MP4s to the drive
- shows whole-cart and current-file progress bars
- automatically labels the drive

Default label examples:

```text
NICK01 -> NICK1
NICK02 -> NICK2
CN01   -> CN1
BOOM01 -> BOOM1
SNICK  -> SNICK
FOX96  -> FOX96
```

Override:

```powershell
.\Build-RetroCartFinal.ps1 `
    -CartID NICK01 `
    -TargetDrive 'E:\' `
    -VolumeLabel 'NICKTOON'
```

FAT/FAT32 labels are sanitized and capped at 11 characters.

## 19. If FINAL already exists

The finalizer intentionally refuses to overwrite an existing FINAL directory.

To rebuild:

```powershell
.\Build-RetroCartFinal.ps1 -CartID NICK01 -Force
```

Or to rebuild and copy to USB:

```powershell
.\Build-RetroCartFinal.ps1 `
    -CartID NICK01 `
    -TargetDrive 'E:\' `
    -Force
```

## 20. After final build

The current revision's `RESERVED` assignments become `ACTIVE`.

The cart status becomes:

```text
BUILT
```

That means unique episodes/commercials are now considered consumed by the active cart and should not be selected for another cart.

## 21. Recommended backup after a successful cart

Back up:

```text
F:\[VIDEOS]\Retro TV Cart Builder\STATE\
F:\[VIDEOS]\Retro TV Cart Builder\Toolkit\
F:\[VIDEOS]\Retro TV Builds\<CartID>\<final revision>\
```

The most critical one is `STATE`.

## 22. Quick command sheet

```powershell
Set-Location -LiteralPath 'F:\[VIDEOS]\Retro TV Cart Builder\Toolkit'

# Refresh assets
.\Initialize-RetroCartLibrary.ps1

# New cart only
.\New-RetroCartPlan.ps1 -CartID NICK01

# Build/open review
.\Build-RetroCartReview.ps1 -CartID NICK01
.\Open-RetroCart.ps1 -CartID NICK01

# After exporting review CSV
$review = Get-ChildItem "$HOME\Downloads\NICK01-r*-review-state*.csv" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

.\Apply-RetroCartReview.ps1 `
    -CartID NICK01 `
    -ReviewCsv $review.FullName `
    -AutoReplace

# Audio audit when relevant
.\Test-RetroCartAudioRepairs.ps1 -CartID NICK01

# Rebuild/open
.\Build-RetroCartReview.ps1 -CartID NICK01
.\Open-RetroCart.ps1 -CartID NICK01

# Final
.\Build-RetroCartFinal.ps1 -CartID NICK01

# Or physical USB
.\Build-RetroCartFinal.ps1 -CartID NICK01 -TargetDrive 'E:\'
```
