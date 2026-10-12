# Retro TV Cart Builder — Current Checkpoint

**Checkpoint date:** 2026-10-11  
**Current Studio:** v1.8.2  
**Canonical development root:** `F:\[VIDEOS]\retro-tv-cart-builder`  
**Build root:** `F:\[VIDEOS]\Retro TV Builds`

This file is the current-state override for the repository. If an older document
describes v1.4.x behavior as "current", treat that section as historical unless
this checkpoint explicitly agrees with it.

## Current cart status

| Cart | Revision | Status | Network |
| --- | ---: | --- | --- |
| NICK01 | r009 | BUILT | NICK |
| NICK02 | r010 | BUILT | NICK |
| NICK03 | r002 | BUILT | NICK |
| NICK04 | r002 | BUILT | NICK |
| SNICK1 | r002 | IN PROGRESS at this checkpoint | SNICK |

`SNICK1` is the permanent ID for the SNICK cartridge going forward.

An abandoned pre-rename `SNICK r001` plan still exists in this snapshot. Its
assignments have been released, so it should not block asset selection. Do not
use it as the active cart.

After SNICK1, the 20-cart plan continues with `CN01`.

## Current day-to-day workflow

The normal review workflow is now **Studio-first**.

Launch:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'

& "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
    -CartID NICK04
```

or double-click:

```text
TOOLKIT\Start-RetroCartStudio.cmd
```

Studio currently provides:

- cart picker
- revision-specific autosaved drafts
- per-clip preview rendering
- preview progress
- GOOD + NEXT review flow
- compatible replacement selection
- trim preview/reset
- audio repair ladder
- real visual crop box
- exact final 618x480 crop result
- source-media corruption diagnostics
- commit draft to next immutable revision
- BUILD FULL REVIEW
- OPEN FULL REVIEW
- BUILD FINAL LOCALLY
- removable-drive selection
- guarded BUILD FINAL + COPY TO SELECTED DRIVE

Initial cart creation is still partly config/PowerShell driven. That is a
known productization gap, not the intended final UX.

## Important v1.8.x behavior

### Studio crop geometry

The current visual pipeline is:

```text
crop original coded pixels
→ correct source sample/pixel aspect ratio
→ proportional fit to 618x480
→ pad only when necessary
→ square-pixel 618x480 output
```

The crop box is locked to the physical Mini Retro TV display ratio.

### Full Review cache

Full Review now uses:

```text
CACHE\review-v2
```

Review proxies and the combined review movie are written transactionally and
validated before they become reusable output. Locked/corrupt old cache entries
no longer need to be manually trusted or reused.

### Final cartridge

Studio refuses a final build when:

- there are uncommitted Studio draft changes, or
- any clip is not `GOOD`.

The finalizer now:

- validates an existing `FINAL`
- reuses it when it already matches the current manifest/review proxies
- builds replacements in a staging directory
- does not relabel the USB until a valid local FINAL exists
- copies MP4s to the selected drive with PowerShell copy progress

The target drive is **not wiped**. Existing unrelated files are not
automatically removed.

## Source media vs derived media

This distinction is now a project invariant.

### Source media

User-owned source media is referenced **in place**.

The project should never silently:

- move it
- modify it
- reorganize it
- duplicate the entire library into an application-managed store

If the user moves a file later, the reference can break. A future product UI
should report `MISSING SOURCE` and offer relinking.

### Derived media

The builder may create and manage regenerable artifacts such as:

- Studio preview proxies
- crop reference stills
- Full Review proxies
- combined review movies
- composite episode sources
- FINAL cartridge files

Derived media may be rebuilt from durable state plus source media.

## Composite episodes

`TOOLKIT\Build-RetroCartComposite.ps1` is the reusable multi-part episode
utility.

SNICK1 introduced this requirement because some Ren & Stimpy half-hours exist
as two separate source shorts.

The original 20-cart plan will need the same concept later for:

- Powerpuff Girls
- Dexter's Laboratory
- Looney Tunes

The SNICK1 rebuild recipe is:

```text
TOOLKIT\config\composites\SNICK1-composites.json
```

When primary streams match, the utility can remux/concatenate without
re-encoding. When they do not, it builds a high-quality normalized intermediate
without intentionally cropping picture content.

## Network identity is functional

`Network` is not just display metadata.

The planner and Studio use exact network identity when selecting branding and
replacement candidates.

Example:

```text
NICK   ≠ SNICK
```

SNICK branding is registered as `Network=SNICK`, so a SNICK cart must use that
network value if it should receive SNICK openings, bumpers, sign-offs, and
replacement choices.

## Durable state

The important state is under:

```text
STATE\
├── asset-registry.csv
├── assignments.csv
├── cart-registry.csv
├── handpicked-branding.csv
├── handpicked-episodes.csv
├── settings.json
└── studio-drafts\
```

Back this up.

`CACHE` is disposable/regenerable. `STATE` is not.

## Current known UX gaps

The next meaningful Studio/product improvements include:

- Full Review overall progress bar
- current phase / clip count while Full Review builds
- disable build/final buttons while a job is active
- server-side job locking so a double-click cannot start duplicate builds
- USB deploy controls from the Full Review finish line
- New Cart UI instead of JSON + planner commands
- media-location/library UI
- tagging/classification UI
- show entities and episode grouping
- channel/block editor
- branding/commercial pool editor
- missing-source relink workflow
- packaged non-command-line setup
- eventual durable database layer, likely SQLite, while preserving exportable
  human-readable manifests

See `09-END-TO-END-PRODUCT-VISION.md` for the intended end state.

## Source-of-truth order

For current work, prefer:

1. actual live scripts and current `STATE`
2. this checkpoint
3. `02-OPERATOR-GUIDE.md`
4. `06-KNOWN-ISSUES-AND-ROADMAP.md`
5. `04-VERSION-HISTORY.md`
6. older architecture/handoff documents for historical detail

Do not let an old v1.4.x sentence override current v1.8.2 behavior.
