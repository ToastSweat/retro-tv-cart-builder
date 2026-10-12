# Retro TV Cart Builder — Start Here

**Checkpoint date:** 2026-10-11  
**Current Studio:** v1.8.2  
**Canonical development root:** `F:\[VIDEOS]\retro-tv-cart-builder`

This repository is now past the original NICK1 proof-of-concept checkpoint.

## Current milestone

Built:

```text
NICK01  r009
NICK02  r010
NICK03  r002
NICK04  r002
```

In progress at this snapshot:

```text
SNICK1  r002
```

After SNICK1, the current 20-cart plan moves to:

```text
CN01
```

The first four Nickelodeon carts proved that the workflow scales beyond one
reference build. SNICK1 added a second real branding network (`SNICK`) and
forced multi-part episode composites into a reusable utility.

## What to read first

Current source-of-truth order:

1. `DOCS/00-CURRENT-CHECKPOINT.md`
2. `DOCS/02-OPERATOR-GUIDE.md`
3. `DOCS/06-KNOWN-ISSUES-AND-ROADMAP.md`
4. `DOCS/09-END-TO-END-PRODUCT-VISION.md`
5. actual current scripts and `STATE`
6. older handoff/architecture docs for deeper historical detail

If an old document calls v1.4.1 the "current baseline", that sentence is
historical now.

## Normal launch

For day-to-day cart review, use Studio:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'

& "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
    -CartID SNICK1
```

or double-click:

```text
TOOLKIT\Start-RetroCartStudio.cmd
```

Leave the launcher console open while Studio runs.

## Current durable state

Back up:

```text
STATE\
```

Current important files include:

```text
asset-registry.csv
assignments.csv
cart-registry.csv
handpicked-branding.csv
handpicked-episodes.csv
settings.json
studio-drafts\
```

Do not treat `CACHE` as durable state.

## Important current design rules

- source media is referenced in place and never modified by the builder
- derived/cache/final media may be regenerated
- episodes and commercials are unique where configured that way
- branding is reusable
- cart revisions are immutable
- Studio drafts are mutable until committed
- network identity is functional (`NICK` and `SNICK` are different pools)
- finalization is blocked when draft changes are uncommitted or clips are not GOOD
- Full Review uses transactional `review-v2` cache output
- final cartridge output reuses a matching existing FINAL instead of deleting it blindly
- composite episode files can be regenerated from recipes

## One harmless piece of old state

The snapshot still contains an abandoned:

```text
SNICK r001
```

from before the permanent cart ID became `SNICK1`.

Its assignments have been released. Do not use that cart as the active SNICK
build. The active cart is `SNICK1`.

## The next development direction

Keep using the 20-cart plan to torture-test the engine.

Do not rewrite working engine behavior merely for aesthetics.

The eventual product should become an end-to-end app where a non-power-user can:

```text
register media locations
→ tag/classify assets
→ define shows
→ define channels/blocks
→ choose show/commercial/branding pools
→ generate a broadcast
→ review/repair it
→ export to USB
```

Source media should remain where the user stores it. The app should index it,
not ingest a duplicate library.

See `DOCS/09-END-TO-END-PRODUCT-VISION.md`.

## Historical reference

NICK01 r009 remains the first completed reference build:

```text
36 clips
36 GOOD
0 unresolved
```

Its historical details remain under `EXAMPLES` and
`DOCS/07-NICK1-REFERENCE-BUILD.md`.
