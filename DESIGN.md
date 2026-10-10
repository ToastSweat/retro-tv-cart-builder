# Retro TV Cart Builder — v1 Design Contract

## Durable identities

- `AssetID`: stable identity of an episode, commercial, or branding source.
- `CartID`: permanent cartridge identity, e.g. `NICK01`.
- `SlotID`: permanent logical slot within a cart, e.g. `NICK01-BREAK-03-AD-02`.
- `Revision`: immutable build history (`r001`, `r002`, ...).

A source being "used" is an assignment, not a permanent property.

## Reuse policy

- Episodes: `UNIQUE`
- Commercials: `UNIQUE`
- Branding: `REUSABLE`, but every use is still logged.

A good unique asset removed from a cart becomes available again.
A globally bad source remains excluded.

## Global source states

`READY`, `UNREVIEWED`, `MAYBE`, `BAD_QUALITY`, `BAD_AUDIO`,
`NEEDS_CLIPPED`, `DUPLICATE`, `EXCLUDED`.

## Review actions

`GOOD`, `REPLACE_THIS_CART`, `BAD_QUALITY`, `BAD_AUDIO`,
`NEEDS_CLIPPED`, `DUPLICATE`, `WRONG_ERA`, `WRONG_NETWORK`.

## Review philosophy

The continuous review movie must contain the proposed broadcast only.
Never add labels/slates between source clips because boundary quality itself is under review.

Labels, boundaries, navigation, flags and replacement controls belong in the HTML reviewer.

## Functional branding roles

Literal archive taxonomy is preserved.
The planner decides how to *use* the asset.

Examples:

- long `IDENT` / `PROMO` -> `ANCHOR_BRANDING`
- short `IDENT` / generic bumper -> `STING`
- `BUMPER_OUT` -> commercial-break exit
- `BUMPER_IN` -> return
- `NEXT` -> upcoming-program transition

This avoids manually relabeling hundreds of short Cartoon Network idents.

## NICK01 v1 recipe

- long Nickelodeon anchor
- 12 preselected episodes in agreed order
- between shows:
  - matched NEXT when available
  - generic BUMPER_OUT
  - 2 unique `KIDS_90S` commercials
  - matched/generic BUMPER_IN
- short station stings after shows 4 and 8
- no mid-episode cuts yet

This recipe is a reference implementation, not a rule every network must follow.
Fox Kids, Cartoon Network, SNICK, etc. can have different profiles based on how their preserved branding actually works.


## v1.1 review/revision behavior

- Right-side review tools are fixed while the clip list scrolls independently.
- Trim Start / Trim End become non-destructive manifest instructions in the next revision.
- Wrong-show bumper prevention uses previous/next show context and rejects unrelated show-specific branding as generic.
- Final cartridge output is copied from the exact normalized per-clip proxies that were reviewed.

## v1.2 crop repair

- `cropdetect` supplies a review suggestion only; cropping is never silently applied.
- Crop repair is stored as four non-destructive manifest values: `CropLeft`, `CropRight`, `CropTop`, `CropBottom`.
- Cache identity includes crop values, so only changed clips are re-encoded.
- `NEEDS_CROP` is a durable source-health state that excludes a source from future automatic selection until repaired.

## v1.3 review findings

- Review UX automatically derives `NEEDS_CLIPPED` from non-zero trim values and provides live per-clip elapsed/remaining seconds.
- Branding selection uses filename/title-derived `InferredTags`; manually blank Notes no longer imply generic.
- Any branding with program-specific language such as `Up Next`, `Coming Up`, `Now Back`, `Back To`, or `Then` is excluded from generic fallback unless it matches the intended show.
- Default NICK-style break recipe is now intentionally lean: one unique ad plus one network transition between programs.
- `Apply-RetroCartReview.ps1 -LeanBreaks` can thin an already-reviewed legacy cart without discarding its review work or revision history.

## v1.3.1 review continuity and handpicked branding
- GOOD is green in review navigation.
- Unchanged GOOD slots carry approval into the next revision.
- Repaired/replaced/new slots remain UNREVIEWED.
- `Add-HandpickedBranding.ps1` registers one-off branding without rescanning the full archive.
- `SignOffAssetID` in cart config appends a network sign-off to future/new revisions.
- Replacement-required actions override trim/crop on the rejected source; trim and crop can coexist when keeping the source.

## v1.3.2 audio repair semantics

- `BAD_AUDIO` is a non-destructive repair request, not an automatic replacement.
- The manifest stores `AudioRepair`, currently `NONE` or `LIGHT`.
- `LIGHT` uses gentle high/low-pass cleanup, `afftdn`, and the standard loudness-normalization pass.
- Audio repair, crop, and trim may all coexist on the same retained source and share one cache/render pass.
- A source with no audio stream cannot be repaired; use `REPLACE_THIS_CART`.
- `BAD_AUDIO` remains a source-health flag so the un-repaired raw asset is excluded from future automatic selection.


## v1.4.0 BAD_AUDIO restoration

`BAD_AUDIO` is a retained-source repair request.

- First BAD_AUDIO report: `AudioRepair=RESTORE`
- Legacy `LIGHT`: treated as `RESTORE`
- BAD_AUDIO reported again after RESTORE/LIGHT: `AudioRepair=STRONG`
- RESTORE: band cleanup, declip, declick, adaptive FFT denoise, dynamic leveling, loudness normalization
- STRONG: stronger spectral cleanup plus non-local-means broadband denoise
- Only repaired-audio cache entries are invalidated when the repair algorithm changes.
- Review UI explicitly marks repaired clips for verification.


## v1.4.1 replacement-dropdown semantics

- Selecting a specific replacement asset automatically changes the review action to `REPLACE_THIS_CART`.
- Changing the action to a keep/repair state clears any selected replacement.
- Replacement-bearing actions are limited to `REPLACE_THIS_CART`, `BAD_QUALITY`, `DUPLICATE`, `WRONG_ERA`, and `WRONG_NETWORK`.
- This prevents contradictory exported rows such as `GOOD + ReplacementAssetID`.
