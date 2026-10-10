# Retro TV Cart Builder

Build nostalgic USB “TV cartridges” for **My Mini Retro Television** from episodes, commercials, bumpers, promos, and station IDs.

Retro TV Cart Builder turns a folder full of old TV media into a revisioned, reviewable pseudo-broadcast that can be copied to a USB drive and played on the physical Mini Retro TV.

The goal is not to perfectly recreate one exact historical schedule.

The goal is to make something that **feels like television again**.

---

## What It Does

A cart can contain:

- TV episodes
- period commercials
- station IDs
- bumpers
- promos
- transitions
- sign-offs

Instead of manually dragging files onto a flash drive, the toolkit can:

1. Register and track source media
2. Build a proposed cart automatically
3. Normalize everything to a known-good Mini Retro TV format
4. Generate one continuous review video
5. Open a local HTML review interface
6. Record trims, crops, replacements, and audio repairs
7. Create immutable cart revisions
8. Rebuild only the clips that changed
9. Preserve approved clips between revisions
10. Produce the final numbered MP4 files
11. Copy the finished cart directly to USB
12. Automatically label the drive

The first completed reference cart is:

```text
NICK01
```

which becomes the physical USB cartridge:

```text
NICK1
```

The first full proof-of-concept finished at:

```text
r009
36 clips
36 GOOD
0 unresolved
```

---

## Why This Exists

I bought a tiny retro television that plays MP4 files from USB.

Naturally, putting a folder of cartoons on it was not enough.

I wanted little physical “TV cartridges” that felt like someone recorded a block of cable television in the late 90s or early 2000s.

So a Nickelodeon cartridge might contain:

```text
Nickelodeon bumper
Doug
commercial
Nick bumper
Rugrats
commercial
Hey Arnold!
commercial
station ID
...
Nickelodeon sign-off
```

That idea eventually turned into a full cart-building and review system.

---

## Current Status

**Usable proof-of-concept.**

The first physical cartridge has been built and tested through multiple real-device review passes.

The architecture is stable enough that future work should mostly be:

- small refinements
- more carts
- more content
- better setup/configuration
- a button-driven desktop GUI
- cleanup for public release

This repository is still evolving.

---

## Known-Good Playback Profile

The Mini Retro TV has been tested successfully with:

```text
Video: H.264
Resolution: 618x480
Frame rate: 30 fps
Pixel format: yuv420p
Audio: AAC stereo
Sample rate: 44.1 kHz
```

The builder normalizes review/final media to this target.

---

## Core Design

### Source files are never modified

All repairs are non-destructive.

The builder stores instructions such as:

```text
TrimStartSeconds
TrimEndSeconds
CropLeft
CropRight
CropTop
CropBottom
AudioRepair
ReplacementAssetID
```

The original archive remains untouched.

---

### Carts are revisioned

Each cart has immutable revisions:

```text
NICK01
├── r001
├── r002
├── r003
├── ...
└── r009
```

Each review pass creates a new revision instead of rewriting the previous one.

---

### Assets have stable IDs

The system tracks:

```text
AssetID
CartID
SlotID
Revision
```

Examples:

```text
EP-...
AD-...
BR-...
HBR-...

NICK01

NICK01-SHOW-01
NICK01-BREAK-03-AD-01
NICK01-SIGN-OFF
```

This keeps the cart history reproducible even when sources are replaced or repaired.

---

## Review Workflow

The builder creates one continuous review movie plus a local HTML reviewer.

The reviewer includes:

- proportional full-cart timeline
- equal-width clip strip
- click-to-seek cart list
- boundary controls
- loop controls
- elapsed / remaining clip time
- trim controls
- crop suggestions
- replacement dropdown
- notes
- CSV import/export
- visual GOOD state
- audio-repair indicators

Review actions currently include:

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

---

## Audio Repair

`BAD_AUDIO` means:

```text
KEEP THE SOURCE
+
REPROCESS THE AUDIO
```

The first repair pass uses:

```text
RESTORE
```

which includes:

- high-pass cleanup
- low-pass cleanup
- de-clipping
- de-clicking
- adaptive noise reduction
- dynamic level correction
- loudness normalization

If the repaired clip is still bad and is marked `BAD_AUDIO` again, the next revision can escalate to:

```text
STRONG
```

---

## Crop Repair

Old TV captures often contain baked-in black borders.

The reviewer uses FFmpeg `cropdetect` to suggest:

```text
CropLeft
CropRight
CropTop
CropBottom
```

The suggestion is never applied blindly.

A human approves the crop before it becomes part of the next revision.

---

## Cache

Normalized review proxies are cached.

The cache key includes:

- source path
- source file metadata
- trims
- crop
- audio repair
- encode profile

That means later revisions only rebuild the clips that actually changed.

This is important when a cart contains hours of video.

---

## Quick Start

Current development environment is Windows + PowerShell + FFmpeg.

### Requirements

- Windows
- PowerShell
- FFmpeg
- FFprobe
- browser for the local review UI

### Enter the toolkit folder

```powershell
Set-Location -LiteralPath 'F:\[VIDEOS]\Retro TV Cart Builder\Toolkit'
```

### Refresh the library

```powershell
.\Initialize-RetroCartLibrary.ps1
```

### Create a new cart plan

```powershell
.\New-RetroCartPlan.ps1 -CartID NICK01
```

### Build the review

```powershell
.\Build-RetroCartReview.ps1 -CartID NICK01
```

### Open the reviewer

```powershell
.\Open-RetroCart.ps1 -CartID NICK01
```

Review the cart, export the review CSV, then:

```powershell
$review = Get-ChildItem "$HOME\Downloads\NICK01-r*-review-state*.csv" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
```

Apply the review:

```powershell
.\Apply-RetroCartReview.ps1 `
    -CartID NICK01 `
    -ReviewCsv $review.FullName `
    -AutoReplace
```

Rebuild:

```powershell
.\Build-RetroCartReview.ps1 -CartID NICK01
.\Open-RetroCart.ps1 -CartID NICK01
```

Repeat until the cart is approved.

---

## Build The Final Cartridge

Build locally:

```powershell
.\Build-RetroCartFinal.ps1 -CartID NICK01
```

Or build directly to a USB drive:

```powershell
.\Build-RetroCartFinal.ps1 `
    -CartID NICK01 `
    -TargetDrive 'E:\'
```

The USB is automatically labeled.

Example:

```text
NICK01 -> NICK1
CN01   -> CN1
BOOM01 -> BOOM1
```

---

## Adding Handpicked Branding

For a one-off bumper, ID, promo, or sign-off:

```powershell
.\Add-HandpickedBranding.ps1 `
    -Path 'F:\[VIDEOS]\Commercials\Bumpers-Handpicked\Bumpers\Nickelodeon\Some Nick Bumper.mp4' `
    -Network NICK `
    -Type IDENT `
    -Year 1998
```

Then refresh:

```powershell
.\Initialize-RetroCartLibrary.ps1
```

For a sign-off tied to a cart:

```powershell
.\Add-HandpickedBranding.ps1 `
    -Path 'F:\[VIDEOS]\Commercials\Bumpers-Handpicked\Bumpers\Nickelodeon\Nickelodeon Good Night Sign Off 1996.mp4' `
    -Network NICK `
    -Type SIGN_OFF `
    -CartID NICK01
```

If the cart already exists:

```powershell
.\Add-RetroCartSignOff.ps1 -CartID NICK01
```

---

## Project State

Important durable state lives in:

```text
STATE\
├── asset-registry.csv
├── assignments.csv
├── cart-registry.csv
├── settings.json
└── handpicked-branding.csv
```

This is the part of the project that should be backed up most carefully.

Generated review videos can be rebuilt.

Lost state is much more painful.

---

## Current Limitations

The current checkpoint still has some rough edges:

- paths are still biased toward the original development machine
- content ingestion differs by asset type
- final build does not yet enforce an all-GOOD review CSV automatically
- setup is PowerShell-heavy
- no packaged GUI yet
- no automatic bitrate reduction when a cart is too large
- current workflow is Windows-oriented

These are cleanup targets, not fundamental blockers.

---

## Roadmap

Near-term:

- build more carts
- continue real-device QA
- expand the media library
- improve diagnostics
- add final approval enforcement
- centralize configuration
- clean up first-run setup

Stretch goal:

### GUI

A small desktop app with buttons for:

```text
Refresh Library
Create Cart
Build Review
Open Review
Apply Review
Audit Audio
Build Final
Copy To USB
```

The plan is to keep the current scripts as the engine and put a friendlier interface on top.

---

## Planned Cart Library

Current long-term concepts include:

```text
NICK01–NICK04
SNICK

CN01–CN05

KWB01–KWB02
FOX96

BOOM01–BOOM02
POWER

SCIFI
UPN
HBO
AMC
```

---

## Media Is Not Included

This project does **not** include copyrighted TV episodes, commercials, bumpers, promos, or other broadcast media.

You provide your own source media.

The repository is intended to contain the software, configuration examples, and documentation needed to build carts from your own collection.

---

## Documentation

More detailed documentation is planned / maintained separately for:

```text
Operator Guide
Architecture & State
Version History
Adding Content & New Carts
Known Issues & Roadmap
Reference Builds
```

---

## Reference Milestone

The first completed cart:

```text
NICK1
```

started as:

> put some cartoons on a tiny TV

and eventually became:

> maintain a revisioned media database that can automatically construct, normalize, review, repair, validate, and deploy synthetic period cable broadcasts onto physical USB cartridges

Which feels about right.
