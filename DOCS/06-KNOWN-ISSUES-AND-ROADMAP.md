# Retro TV Cart Builder — Known Issues, Limits, and Roadmap

**Current Studio:** v1.8.2  
**Checkpoint:** 2026-10-11

The project is now a working internal tool, not yet a polished application for
a non-power-user.

The 20-cart build plan should continue serving as the primary torture test.

## Proven baseline

The following concepts have survived real use and should be preserved:

- stable AssetID / CartID / SlotID identities
- immutable cart revisions
- mutable revision-specific Studio drafts
- UNIQUE episode/commercial assignment behavior
- REUSABLE branding
- source-health state separate from per-cart review state
- non-destructive trim/crop/audio repair
- GOOD carry-forward when effective output is unchanged
- same-network replacement filtering
- show-aware branding matching
- lean breaks
- cached normalized proxies
- Full Review continuous QA
- final output from reviewed normalized proxies
- direct USB copy
- source media remains untouched

Do not discard these merely to simplify the UI.

## Current known issues

### 1. Full Review has no overall progress display

BUILD FULL REVIEW can take a long time.

The UI should show at minimum:

```text
current clip / total clips
current clip title
phase: encode / validate / concatenate
overall %
```

### 2. Long-running jobs need a single-job lock

A double-click can currently start duplicate Full Review or Final requests.

Needed:

- disable the triggering button immediately
- visible running state
- server-side job lock
- reject a duplicate request even if the browser sends one

### 3. Full Review is not yet the complete finish line

The natural workflow is:

```text
Build Full Review
→ watch/approve
→ deploy to USB
```

USB deployment controls currently live back on the main Studio page.

A future Full Review/QC screen should include the final approval/export handoff.

### 4. Full Review still carries legacy reviewer ancestry

Studio should be the repair/workbench UI.

Full Review should become a simpler final-QC surface focused on:

- continuous playback
- pacing
- transitions
- order
- volume consistency
- final approval

Editing controls should not make the two interfaces feel like duplicates.

### 5. New-cart creation is still config/command driven

Today the operator still creates JSON and runs initialization/planning commands.

This is acceptable for development but not for the final product.

### 6. Standalone scripts still contain old machine-specific defaults

Studio's launcher derives the repository root correctly.

Several engine scripts still contain historical defaults such as:

```text
F:\[VIDEOS]\Retro TV Cart Builder
```

Current operator docs deliberately pass `-SystemRoot` explicitly.

Long term, all engine entry points should get configuration from one bootstrap
location instead of embedding development-machine assumptions.

### 7. Media import/catalog management is not a UI

The long-term product needs a real library screen.

Important rule:

**Adding media means indexing/referencing its existing location, not copying the
library into the program.**

The application should store paths and metadata.

If the user moves a source file later:

```text
MISSING SOURCE
→ Relink
```

### 8. Source and derived media need explicit lifecycle ownership

Source media:

```text
user-owned
never modified
never moved
never silently duplicated
```

Derived media:

```text
previews
crop stills
review proxies
review movies
composites
FINAL output
```

The app may manage/regenerate derived media.

### 9. Current durable state is CSV/JSON

CSV/JSON has been valuable because it is inspectable and easy to debug.

For a larger end-to-end product, SQLite is a strong future candidate for:

- shows
- episodes
- media locations
- aliases
- tags
- networks/blocks
- commercial pools
- branding roles
- source health
- assignments
- build jobs

Human-readable exports/manifests should remain available even if SQLite becomes
the internal source of truth.

### 10. Windows orientation

Current implementation assumes Windows/PowerShell and local Node/FFmpeg.

Cross-platform support is not a current requirement, but the architecture
should avoid unnecessary Windows-specific coupling when practical.

## Near-term development

Continue building the planned carts.

Next after the Nickelodeon/SNICK phase:

```text
CN01
CN02
CN03
CN04
CN05
```

Cart building should expose:

- new source codec/path edge cases
- new branding taxonomies
- multi-part episode needs
- commercial-pool problems
- transition matching failures
- size-budget problems
- real-device playback quirks

Fix what real carts prove is necessary.

## Near-term Studio improvements

High-value improvements already identified:

- Full Review progress
- build job lock
- final-copy progress visible in Studio, not only PowerShell
- deploy from Full Review finish line
- better long-job cancellation/status
- cleaner QC-only Full Review
- stronger environment diagnostics
- clearer stale/missing source reporting

## Productization direction

The desired non-power-user workflow is:

```text
INSTALL
↓
ADD/REGISTER MEDIA LOCATIONS
↓
CLASSIFY/TAG MEDIA
↓
DEFINE SHOWS
↓
DEFINE CHANNELS / BLOCKS
↓
ASSIGN SHOW + COMMERCIAL + BRANDING POOLS
↓
GENERATE A BROADCAST
↓
REVIEW / REPAIR
↓
FULL QC
↓
EXPORT TO USB
```

See `09-END-TO-END-PRODUCT-VISION.md`.

## Things not to do

Avoid:

- importing/copying an entire media archive into an app-controlled duplicate
  library
- silently modifying source media
- throwing away durable revision history for convenience
- merging NICK/SNICK/etc. into one vague network tag
- making a normal user understand `BUMPER_IN`/`IDENT`/`SIGN_OFF` just to create
  a channel
- rewriting the proven engine before the 20-cart plan has finished exposing its
  real requirements
- lowering output quality blindly just to hit a byte target

## Public-release blockers

Before calling this a friendly public release:

- bootstrap/install dependencies
- remove/centralize machine-specific defaults
- add a media-location/library UI
- add tag/classification UI
- add show/channel/block editors
- add New Cart flow
- add relink/missing-source UX
- add environment health check
- add durable build-job locking
- add tests around state/revision invariants
- sanitize example paths/data
- produce a clean distributable tree separate from live personal STATE
