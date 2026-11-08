# Retro TV Cart Builder — Architecture and State

> **Current-state note (2026-10-11):** The architecture below remains useful,
> but some cache names/version statements predate Studio v1.8.x. Current Full
> Review uses `CACHE\review-v2`; Studio also uses dedicated preview/crop caches.
> Read `00-CURRENT-CHECKPOINT.md` first for current overrides.


## Overview

The builder is intentionally stateful.

It is not a script that randomly picks files and copies them to a drive every time.

It maintains:
- durable asset identity
- cart identity
- slot identity
- immutable revision history
- assignment/uniqueness state
- global source-health findings
- cached normalized media
- human review decisions

The design goal is reproducibility.

Given the archive, config, durable state, and revision manifest, a cart should be reconstructible without modifying the original source media.

## Initialization inputs

`Initialize-RetroCartLibrary.ps1` currently consumes:

```text
CommercialRoot:
F:\[VIDEOS]\Commercials

Default curation directory:
F:\[VIDEOS]\Commercials\_CURATION_BACKUPS

Default config directory:
<Toolkit>\config
```

It automatically finds:

### Branding curation

Latest file matching:

```text
branding-curation*.csv
```

by modification time.

### 90s commercial curation

It scans `commercial-curation*.csv`, excluding 2000–2002 files, and identifies the original 90s curation by the presence of a `SourcePack` column.

### 2000–2002 curation

Latest file matching:

```text
commercial-curation-2000-2002*.csv
```

This is optional for NICK01.

### Handpicked branding

Durable file:

```text
STATE\handpicked-branding.csv
```

### Episodes

Episodes are not discovered by scanning the TV folder.

They are registered from every cart config JSON in:

```text
Toolkit\config\*.json
```

This is important: adding an episode to a config and rerunning initialization is what makes that episode an asset in the registry.

## Registry mapping

### Curated branding

Typical mapping:

```text
AssetType: BRANDING
ReusePolicy: REUSABLE
Network: from curation
Subtype: branding Type
```

Curated status mapping includes:

```text
KEEP          -> READY
MAYBE         -> MAYBE
NEEDS_CLIPPED -> NEEDS_CLIPPED
SKIP          -> EXCLUDED
```

### Handpicked branding

Registered by `Add-HandpickedBranding.ps1`.

Asset ID prefix:

```text
HBR-
```

Handpicked entries are deduplicated against main curated branding by exact source path when the master registry is refreshed.

### Commercials

90s accepted READY pools currently include:

```text
KIDS_90S
GENERAL_90S
GENERAL_00S
LATE_NIGHT
PSA
```

2000–2002 accepted READY pools currently include:

```text
KIDS_00S
GENERAL_00S
PSA
```

Commercials are `UNIQUE`.

### Episodes

Asset IDs are stable hashes of source paths.

Episodes are `UNIQUE`.

## Inferred branding tags

The initializer builds a vocabulary from `BrandingKeywords` in every cart config.

It combines:
- title/filename
- notes
- subtype
- known show aliases

It also detects phrases such as:

```text
Up Next
Next Up
Coming Up
Later Tonight
Then
Now Back
Back To
Return To
Returns To
```

and marks these as program-specific.

This prevents a clip such as:

```text
Up next Rocko's Modern Life, then My Brother and Me
```

from being treated as generic network branding just because its manual Notes field is blank.

## Cart planning

`New-RetroCartPlan.ps1` is deterministic for a given cart/revision when state is unchanged.

It derives a random seed from:

```text
CartID|Revision
```

Available unique assets must:
- have `SourceStatus=READY`
- not be reserved/active elsewhere
- not already be used in the current cart

Branding is reusable but cannot be selected twice in the same plan through the same availability logic unless specifically carried through revision behavior.

## LEAN break planning

When:

```json
"BreakStyle": "LEAN"
```

the basic between-show structure is:

```text
SHOW
commercial(s)
BUMPER_IN / generic transition
next SHOW
```

For NICK01:

```text
AdsPerBreak = 1
```

The transition prefers a `BUMPER_IN` matching the upcoming show's branding keywords.

Fallback is short generic network branding that is not program-specific.

## Legacy full break planning

The older structure supported:

```text
NEXT
BUMPER_OUT
commercial(s)
BUMPER_IN
STING
```

`Apply-RetroCartReview.ps1 -LeanBreaks` exists to thin an already-reviewed legacy cart without throwing away the review work.

## Revision model

A revision is a complete immutable `cart-manifest.csv`.

A review apply creates the next revision rather than rewriting the old one.

Previous assignments become superseded/released as appropriate.

The current cart registry points at one revision.

This model is the core of the project. Preserve it.

## Cache model

Review proxy path:

```text
STATE-independent cache:
F:\[VIDEOS]\Retro TV Cart Builder\CACHE\review-v1
```

The cache key is derived from:
- source
- file metadata
- trim
- crop
- audio repair
- encoding profile

This allows changed clips to rebuild while unchanged material is reused.

The review profile label intentionally remained `review-v1` after a historical cache regression demonstrated how expensive gratuitous cache-version changes are.

## Review output

Each current revision gets:

```text
REVIEW\
├── <CartID>-review.mp4
├── review-manifest.csv
└── cart-review.html
```

`review-manifest.csv` maps every clip to:
- start/end time in the continuous movie
- source/asset/slot identity
- proxy path
- applied trim
- applied crop
- applied audio repair
- crop suggestions

The HTML embeds timeline data and replacement alternatives.

## Browser state

The reviewer stores working review state in browser localStorage and can export/import CSV.

The CSV is the durable operator handoff.

Always export before:
- rebuilding the reviewer
- changing machines/browsers
- applying the review
- doing anything risky

## GOOD carry-forward

Unchanged clips reviewed GOOD carry that approval into the next revision.

Changed/replaced/repaired/new clips return to UNREVIEWED.

This turns later passes into targeted verification instead of repeated full-cart viewing.

## Replacement safety

Current v1.4.1 rules:

A manually selected replacement is valid only for replacement-bearing actions:

```text
REPLACE_THIS_CART
BAD_QUALITY
DUPLICATE
WRONG_ERA
WRONG_NETWORK
```

Selecting a replacement in the UI automatically sets `REPLACE_THIS_CART`.

Changing to a keep/repair action clears the selected replacement.

During apply, manual replacements are validated.

With `-AutoReplace`, an unusable manual choice can fall back to another compatible READY asset instead of aborting.

Checks include:
- missing asset
- same asset as current slot
- non-READY
- already chosen in current revision
- unique asset busy elsewhere
- wrong commercial pool/type
- wrong branding network/type

A second safety check occurs while the new manifest is built.

## Global source-health behavior

The current apply script writes these review findings back to the registry:

```text
BAD_QUALITY
BAD_AUDIO
NEEDS_CLIPPED
NEEDS_CROP
DUPLICATE
```

These durable flags keep the raw source from silently being selected in future automatic plans.

The current cart can still retain a `BAD_AUDIO`, `NEEDS_CLIPPED`, or `NEEDS_CROP` source because its manifest stores the repair recipe.

## Audio repair cache semantics

Normal audio uses standard loudness normalization.

Repair modes:

```text
NONE
RESTORE
STRONG
```

Legacy:

```text
LIGHT -> interpreted as RESTORE
```

The audio repair profile has its own version string.

Therefore changing the restoration algorithm invalidates repaired proxies without invalidating every normal clip.

## Final build semantics

`Build-RetroCartFinal.ps1` does not transcode the cart again.

It copies the exact normalized per-slot proxy files used in the current review.

It validates:
- current cart exists
- current revision has a review manifest
- each manifest slot appears in the review manifest
- reviewed AssetID equals current manifest AssetID
- proxy files exist
- total byte size fits the target limit

It writes:
- numbered MP4s
- final manifest
- text README

Then it marks current reserved assignments ACTIVE and cart status BUILT.

## The most important invariants

Future development should preserve these unless deliberately migrating state:

1. Original media is never modified.
2. Revisions are immutable.
3. Asset/Cart/Slot identities remain stable.
4. Durable source-health survives registry refreshes.
5. Unique-asset use is tracked.
6. Final media equals reviewed normalized media.
7. Cache keys change only when output meaningfully changes.
8. Human review remains authoritative.
