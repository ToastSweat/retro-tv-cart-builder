# Retro TV Cart Builder — Project Handoff

## 1. What this project is

The Retro TV Cart Builder creates physical USB "TV cartridges" for the **My Mini Retro Television**.

The cartridges are deliberately treated like fake period broadcast recordings rather than folders of episodes. A cart mixes:

- TV episodes
- period commercials
- station IDs
- bumpers
- promos
- transitions
- optional sign-offs

The goal is **synthetic nostalgia**, not forensic reconstruction of one exact historical broadcast schedule.

A good cart should feel plausible for the network/block/era:
- the show plausibly aired there
- the episode existed by the target period
- network branding feels appropriate
- commercials fit the broad audience/era
- repeated station branding is fine and authentic
- commercials and episodes should avoid unnecessary reuse across carts

## 2. Hardware findings that shaped the software

The factory startup movie was inspected and gave a known-good playback target:

```text
H.264
618x480
30 fps
yuv420p
AAC
44.1 kHz stereo
```

Factory startup asset observed:

```text
0 MY MINI RETRO TELEVISION.mp4
~11.43 sec
~4.3 MB
```

The device behaves differently depending on where media is played from.

### Internal storage path

Observed behavior:

```text
startup
→ internal video
→ firmware/static channel-change animation
→ next internal video
→ power-off movie
```

### USB path

Observed behavior:

```text
startup
→ "USB drive inserted" OSD
→ USB videos sequentially
```

The USB path does **not** provide the same firmware channel-change animation or power-off movie.

That means the cartridge itself has to provide the broadcast experience. The builder cannot rely on the firmware to make every transition feel like television.

## 3. USB preparation

The project uses small physical USB drives as cartridges. Some larger drives were made Windows/FAT32-friendly by creating a 30 GB partition.

Example DiskPart workflow:

```text
diskpart
list disk
select disk X
clean
create partition primary size=30000
format fs=fat32 quick
assign
exit
```

**Be extremely careful with `select disk X`; `clean` destroys the selected disk's partition table.**

The actual cart media target is much smaller; the builder defaults to a conservative ~3.6 GB size limit when building without a physical target drive.

## 4. Core philosophy

The key design decision is that source files are never destructively edited.

Review findings become **instructions in a revision manifest**:

- trim start/end
- crop edges
- audio repair profile
- replacement asset

Every meaningful change produces a new immutable cart revision.

Example:

```text
NICK01
├── r001
├── r002
├── r003
├── ...
└── r009
```

The original archive remains untouched.

## 5. Current filesystem layout

The development machine uses these defaults:

```text
F:\[VIDEOS]\Commercials\
F:\[VIDEOS]\TV\
F:\[VIDEOS]\Retro TV Cart Builder\
F:\[VIDEOS]\Retro TV Builds\
```

Important builder layout:

```text
F:\[VIDEOS]\Retro TV Cart Builder\
├── Toolkit\
│   ├── Initialize-RetroCartLibrary.ps1
│   ├── New-RetroCartPlan.ps1
│   ├── Build-RetroCartReview.ps1
│   ├── Open-RetroCart.ps1
│   ├── Apply-RetroCartReview.ps1
│   ├── Test-RetroCartAudioRepairs.ps1
│   ├── Build-RetroCartFinal.ps1
│   ├── Add-HandpickedBranding.ps1
│   ├── Add-RetroCartSignOff.ps1
│   └── config\
├── STATE\
│   ├── asset-registry.csv
│   ├── assignments.csv
│   ├── cart-registry.csv
│   ├── settings.json
│   └── handpicked-branding.csv
├── CACHE\
│   └── review-v1\
└── INPUT_SNAPSHOTS\
```

Build output:

```text
F:\[VIDEOS]\Retro TV Builds\
└── NICK01\
    ├── r001\
    ├── ...
    └── r009\
        ├── cart-manifest.csv
        ├── REVIEW\
        │   ├── NICK01-review.mp4
        │   ├── review-manifest.csv
        │   └── cart-review.html
        └── FINAL\
            ├── 0010_....mp4
            ├── ...
            ├── cart-final-manifest.csv
            └── README.txt
```

Because `[VIDEOS]` contains square brackets, prefer `-LiteralPath` in PowerShell.

## 6. Durable identities

The system distinguishes identity from usage.

### `AssetID`

Stable identity for a source asset.

Prefixes currently include:

```text
EP-   episode
AD-   commercial
BR-   curated branding
HBR-  handpicked branding
```

### `CartID`

Permanent cartridge identity:

```text
NICK01
CN01
FOX96
SNICK
...
```

### `SlotID`

Permanent logical position/function in a cart:

```text
NICK01-SHOW-01
NICK01-BREAK-03-AD-01
NICK01-BREAK-03-IN
NICK01-SIGN-OFF
```

### Revision

Immutable build history:

```text
r001
r002
r003
...
```

## 7. Reuse policy

Current rules:

```text
EPISODE     UNIQUE
COMMERCIAL  UNIQUE
BRANDING    REUSABLE
```

Unique means the asset should not be simultaneously consumed by another active/reserved cart.

Branding can repeat across carts because station identity naturally repeats, but every use is still logged.

If a good unique asset is merely removed from one cart, it can become available again.

If a source is globally bad, it remains excluded from future automatic planning.

## 8. Durable state is the important backup

The generated review/final video folders can be rebuilt if the archive and state survive.

The most important backup is:

```text
F:\[VIDEOS]\Retro TV Cart Builder\STATE
```

This contains the project's durable memory.

### `asset-registry.csv`

Master source registry and source-health state.

### `assignments.csv`

Tracks which asset was used by which cart/revision/slot and whether the assignment is reserved, active, superseded, released, etc.

### `cart-registry.csv`

Tracks each cart's current revision, display name, build status, network, and current manifest path.

### `settings.json`

Stores active root/config/registry paths.

### `handpicked-branding.csv`

Durable one-off branding additions that should survive registry refreshes.

## 9. Source-health states vs cart-review actions

These concepts overlap but are not identical.

### Important review actions

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

### Intended semantics

`GOOD`
: Keep the current asset as-is.

`REPLACE_THIS_CART`
: This asset may be fine globally; replace it only in this cart.

`BAD_QUALITY`
: Source is globally bad and should be excluded. Replacement required.

`BAD_AUDIO`
: Keep this source and run opt-in audio restoration. First pass becomes `RESTORE`; if reported bad again after repair, it escalates to `STRONG`.

`NEEDS_CLIPPED`
: Keep source; apply non-destructive start/end trims.

`NEEDS_CROP`
: Keep source; apply non-destructive edge crop.

`DUPLICATE`
: Source is globally excluded as a duplicate. Replacement required.

`WRONG_ERA`
: Replace in this cart.

`WRONG_NETWORK`
: Replace in this cart.

`UNREVIEWED`
: The current output still needs human verification.

## 10. Review philosophy

The review movie contains the proposed broadcast only.

It intentionally does **not** insert diagnostic title cards or slates because the boundaries between real clips are part of what must be judged.

The HTML reviewer provides the metadata/navigation layer instead.

It includes:

- proportional timeline by real elapsed time
- equal-width clip strip
- independent scrollable cart list
- current clip metadata
- START / END
- BOUNDARY IN / BOUNDARY OUT
- LOOP IN / LOOP OUT
- live elapsed/remaining clip time
- trim controls
- crop suggestions/fields
- replacement dropdown
- notes
- CSV import/export
- green `GOOD` state
- purple audio-repair indication

## 11. Non-destructive trim

Trim metadata is stored in the manifest.

The reviewer can set:

```text
TrimStartSeconds
TrimEndSeconds
```

Useful buttons:

```text
TRIM START = ELAPSED
TRIM END = REMAINING
```

The source file is unchanged.

## 12. Non-destructive crop

FFmpeg `cropdetect` samples the source and suggests:

```text
CropLeft
CropRight
CropTop
CropBottom
```

The suggestion is never silently accepted.

Old TV captures frequently contain legitimate black frames, letterboxing, fades, or noisy overscan, so a human approves the crop.

## 13. Audio repair

Audio restoration is opt-in.

Normal clips use:

```text
loudnorm ≈ -16 LUFS / -1.5 dBTP
44.1 kHz stereo
```

`BAD_AUDIO` on a previously unrepaired source produces `AudioRepair=RESTORE`.

RESTORE performs:
- high-pass cleanup
- low-pass cleanup
- de-clipping
- de-clicking
- adaptive FFT denoise
- dynamic level correction
- final loudness normalization

If the repaired clip is still marked `BAD_AUDIO` in a later review, it escalates to `STRONG`, which uses more aggressive denoising/restoration.

Legacy `AudioRepair=LIGHT` from v1.3.x is automatically treated as `RESTORE`.

A source with no audio stream cannot be restored and must be replaced.

## 14. Cache behavior

Normalized proxies live under:

```text
F:\[VIDEOS]\Retro TV Cart Builder\CACHE\review-v1
```

A proxy cache key incorporates:
- source path
- source file size
- source modification time
- trims
- crop
- audio-repair mode
- review encoding profile

The goal is that a revision only re-encodes changed material.

Normal unaffected clips keep existing cache identity when audio repair algorithms change.

Audio-repaired proxies have an independent repair-profile version so repair changes force those clips to rebuild without invalidating the whole cart.

**Do not casually delete the cache.** It can represent hours of work.

## 15. Review encoding profile

Current review/final clips use the tested TV profile:

```text
H.264
618x480
30 fps
yuv420p
AAC stereo
44.1 kHz
~128 kbps audio
CRF 20
~1 second GOP/keyframe interval
```

Video aspect ratio is preserved, then padded to the device frame.

The finalizer copies the exact reviewed normalized proxies rather than doing a surprise final transcode.

## 16. NICK01 reference recipe

NICK01 evolved from a busy first-pass break structure to a deliberately lean one.

Current config:

```text
Network: NICK
CommercialPool: KIDS_90S
AdsPerBreak: 1
BreakStyle: LEAN
UseMatchedNext: false
extra stings: none
```

Current broad rhythm:

```text
ANCHOR
SHOW
1 COMMERCIAL
1 matched/generic short network transition
SHOW
...
SIGN_OFF
```

This is a reference profile, not a universal rule. Other networks can have different cart profiles.

## 17. NICK01 episode lineup

Reference lineup:

1. Doug — Bags a Neematoad
2. Rocko's Modern Life — No Pain, No Gain / Who Give$ a Buck
3. Rugrats — Tommy's First Birthday
4. Rugrats — At The Movies / Slumber Party
5. Hey Arnold! — Downtown as Fruits / Eugene's Bike
6. The Angry Beavers — Born to Be Beavers / Up All Night
7. CatDog — Dog Gone / All You Can't Eat
8. Aaahh!!! Real Monsters — The Switching Hour
9. Doug — Can't Dance / Gets Busted
10. Hey Arnold! — Arnold's Hat / Stoop Kid
11. The Angry Beavers — Muscular Beaver / Fish 'n' Dips
12. Rugrats — Grandpa's Teeth / Momma Trauma

A 1996 Nickelodeon Good Night sign-off was handpicked and configured at the end.

## 18. NICK1 milestone

NICK01 reached revision r009.

The checkpoint's final exported review CSV is verified as:

```text
36 total rows
36 GOOD
0 non-GOOD
```

The physical cartridge label is:

```text
NICK1
```

The user and girlfriend will perform additional physical QA, but the system is now considered usable enough to be the baseline for building additional carts.

## 19. Broader cart plan

The project has a larger ~20-cart concept including:

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

The detailed planning snapshot is preserved in `PLANNING/mini_retro_tv_20_cart_manifest_v1.txt`.

## 20. Current development stance

Do not redesign the architecture casually.

This checkpoint exists because the workflow finally proved itself in practice.

From here:
- prefer small, testable changes
- preserve state/revision compatibility
- preserve immutable history
- preserve cache reuse
- avoid changing semantics silently
- add diagnostics when possible
- make UI intent explicit rather than inferring contradictory CSV state later

The next major architectural improvement should probably be usability around the existing system, not replacement of the system.
