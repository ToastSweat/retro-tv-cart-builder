# Retro TV Cart Builder

Build nostalgic USB “TV cartridges” for **My Mini Retro Television** from your
own episodes, commercials, bumpers, promos, station IDs, and sign-offs.

The goal is not a forensic recreation of one exact historical broadcast.

The goal is to make something that **feels like television again**.

## Current checkpoint

Current Studio: **v1.8.2**

Completed carts in the current working state:

```text
NICK01  r009  BUILT
NICK02  r010  BUILT
NICK03  r002  BUILT
NICK04  r002  BUILT
```

`SNICK1 r002` is the current in-progress SNICK cartridge at this checkpoint.

The next planned cart is `CN01`.

For exact current-state notes, start with:

```text
DOCS\00-CURRENT-CHECKPOINT.md
```

## What it does

Retro TV Cart Builder can:

- catalog source episodes, commercials, and branding
- assign stable asset IDs
- keep episodes/commercials unique across carts where required
- build period-plausible pseudo-broadcast lineups
- prefer show-matched branding when the archive supports it
- normalize clips for the Mini Retro TV
- preview and repair clips without modifying original media
- trim, crop, restore audio, and replace bad sources
- maintain revision-specific Studio drafts
- commit immutable cart revisions
- build a continuous Full Review movie
- require an all-GOOD committed state before finalization
- build the final numbered MP4 cartridge
- copy directly to a selected USB drive
- label the cartridge volume automatically

The current tested playback profile is:

```text
Video:       H.264
Resolution:  618x480
Frame rate:  30 fps
Pixel format: yuv420p
Audio:       AAC stereo
Sample rate: 44.1 kHz
```

## The important media rule

### Source media stays where the user keeps it

The builder references source files **in place**.

It should not silently move, rewrite, reorganize, or duplicate the user's media
library.

If the user later moves a source file, the reference can break. A future UI
should surface that as a missing source and support relinking.

### Derived media belongs to the builder

The builder may generate disposable/regenerable artifacts:

```text
Studio previews
crop reference stills
Full Review proxies
combined review movies
composite episode sources
FINAL cartridge files
```

The original archive remains untouched.

## Studio-first workflow

For an existing cart, launch Studio:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'

& "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
    -CartID NICK04
```

or double-click:

```text
TOOLKIT\Start-RetroCartStudio.cmd
```

Studio supports:

- clip-by-clip review
- autosaved drafts
- per-clip render progress
- GOOD + NEXT
- replacements
- trim repair
- audio repair
- visual crop/reframe
- exact final crop preview
- commit to next revision
- Full Review build/open
- final cartridge build
- USB selection and guarded deploy

The old CSV/browser/PowerShell review loop still exists as engine/history, but
Studio is the normal day-to-day interface.

## Creating a cart today

Cart creation is not fully productized yet. A new cart still starts from a JSON
config.

After adding/editing a config:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'

& "$root\TOOLKIT\Initialize-RetroCartLibrary.ps1" `
    -SystemRoot $root

& "$root\TOOLKIT\New-RetroCartPlan.ps1" `
    -CartID NICK04 `
    -SystemRoot $root

& "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
    -CartID NICK04
```

The long-term goal is to replace this setup work with an end-to-end library and
channel editor.

## Current break recipe

The current lean fake-broadcast rhythm is roughly:

```text
SHOW
↓
one unique commercial
↓
show-matched return bumper when available,
otherwise genuinely generic network branding
↓
NEXT SHOW
```

The planner preserves literal archive taxonomy but uses branding functionally.

## Network identity matters

`Network` is an exact functional selector, not just a label.

For example:

```text
NICK != SNICK
```

SNICK branding is registered separately, so a SNICK cart needs
`"Network": "SNICK"` to receive the correct openings, bumpers, sign-offs, and
replacement candidates.

## Multi-part episode composites

Some planned show blocks are stored as multiple source shorts.

The reusable utility:

```text
TOOLKIT\Build-RetroCartComposite.ps1
```

can combine 2+ parts into one episode source.

A rebuild recipe for the current SNICK1 Ren & Stimpy composites lives at:

```text
TOOLKIT\config\composites\SNICK1-composites.json
```

This same mechanism is expected to be useful for later Powerpuff Girls,
Dexter's Laboratory, and Looney Tunes blocks.

## Review and repair model

Current review states include:

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

Repairs are stored as instructions, not destructive edits:

```text
TrimStartSeconds
TrimEndSeconds
CropLeft
CropRight
CropTop
CropBottom
AudioRepair
```

Audio repair ladder:

```text
NONE
RESTORE
STRONG
AGGRESSIVE
MAX
```

Each level is rendered from the original source, not stacked on top of a
previous repaired encode.

## Crop model

The current Studio crop UI uses a real draggable/resizable crop box.

The render geometry is:

```text
crop original coded pixels
→ correct source sample/pixel aspect ratio
→ proportional fit to 618x480
→ pad only if necessary
→ setsar=1
```

The crop box is locked to the physical TV display proportions so the source
selection and final rendered framing agree.

## Full Review and cache safety

Full Review uses:

```text
CACHE\review-v2
```

Review proxies are transactionally rendered and validated before becoming
reusable cache entries.

This avoids treating interrupted/corrupt MP4s as valid cached output.

## Final cartridge safety

Studio blocks finalization when:

- the current draft contains uncommitted changes
- any clip is not marked `GOOD`

The finalizer:

- reuses a matching existing `FINAL`
- builds a replacement `FINAL` transactionally when necessary
- delays USB relabeling until local final output is valid
- copies MP4s with progress

It does **not** wipe unrelated files from the target drive.

## Durable state

Back up:

```text
STATE\
```

especially:

```text
asset-registry.csv
assignments.csv
cart-registry.csv
handpicked-branding.csv
handpicked-episodes.csv
settings.json
studio-drafts\
```

`CACHE` can be rebuilt. Durable state is much harder to reconstruct.

## Current limitations

The engine works, but this is not yet a friendly public application.

Known gaps include:

- initial media/catalog setup is still command/config heavy
- several standalone scripts still contain old development-machine defaults
- Full Review does not yet show overall build progress
- long-running build buttons do not yet have server-side concurrency locks
- Full Review itself does not yet contain the final USB deploy controls
- no visual media-library/tagging workflow yet
- no New Channel / New Cart UI yet
- no packaged installer yet
- current implementation is Windows-oriented
- live state is CSV/JSON rather than a dedicated local database

See:

```text
DOCS\06-KNOWN-ISSUES-AND-ROADMAP.md
DOCS\09-END-TO-END-PRODUCT-VISION.md
```

## Planned cart library

```text
NICK01–NICK04
SNICK1

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

## Media is not included

This repository does **not** include copyrighted TV episodes, commercials,
bumpers, promos, or other broadcast media.

You supply your own media.

## Documentation

Start here:

```text
START-HERE.md
DOCS\00-CURRENT-CHECKPOINT.md
DOCS\02-OPERATOR-GUIDE.md
DOCS\03-ARCHITECTURE-AND-STATE.md
DOCS\04-VERSION-HISTORY.md
DOCS\05-ADDING-CONTENT-AND-CARTS.md
DOCS\06-KNOWN-ISSUES-AND-ROADMAP.md
DOCS\09-END-TO-END-PRODUCT-VISION.md
```

Historical NICK1 details remain in:

```text
DOCS\07-NICK1-REFERENCE-BUILD.md
```

## The project in one sentence

This started as:

> put some cartoons on a tiny TV

and became:

> maintain a revisioned media catalog that can construct, normalize, review,
> repair, validate, and deploy synthetic period television broadcasts onto
> physical USB cartridges

Which feels about right.
