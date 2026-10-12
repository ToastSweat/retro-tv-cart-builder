# Retro TV Cart Builder — Operator Guide

**Current Studio:** v1.8.2  
**Current development root:** `F:\[VIDEOS]\retro-tv-cart-builder`

This is the current practical workflow.

The old export-CSV/apply/rebuild loop is still part of the engine and historical
record, but **Studio is the normal day-to-day operator interface**.

## 1. Start Studio

Existing cart:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'

& "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
    -CartID SNICK1
```

Or double-click:

```text
TOOLKIT\Start-RetroCartStudio.cmd
```

If no `CartID` is supplied, use the cart picker.

Leave the launcher/Node console open while Studio is running.

## 2. Studio draft model

Studio edits a revision-specific mutable draft under:

```text
STATE\studio-drafts\<CartID>-rNNN.json
```

The immutable current manifest is not edited in place.

This means you can audition:

- replacement sources
- trims
- crops
- audio repair levels

without creating a new revision every time you move a slider or reject a test.

## 3. Review one clip

The normal loop is:

```text
select clip
→ preview
→ repair/replace if needed
→ preview again
→ GOOD + NEXT
```

Changing trim/crop/audio/replacement should return the clip to `UNREVIEWED`
until the new processed result is verified.

## 4. Audio repair

Current ladder:

```text
NONE
RESTORE
STRONG
AGGRESSIVE
MAX
```

Every level processes the original source. Repairs are not stacked on top of a
previous repaired proxy.

Use stronger levels only when the lighter level is not sufficient.

If Studio reports that the source contains real encoded-media corruption,
replace the source instead of expecting denoise/restoration to repair broken
packets.

## 5. Crop/reframe

Current crop UI:

- left pane: original source reference
- blue box: exact source region that survives
- drag inside the box to move it
- drag a corner to resize it
- resize is locked to the physical 618x480 TV proportions
- right pane: exact final 618x480 geometry result

Useful buttons:

```text
FIT MAXIMUM TV AREA
AUTO DETECT BORDERS + FIT
NO CROP
REVERT PROPOSAL
APPLY THIS CROP & PREVIEW VIDEO
```

The current render order is:

```text
crop original source pixels
→ correct source sample/pixel aspect ratio
→ fit proportionally to 618x480
→ pad if necessary
→ square-pixel output
```

Do not judge the crop only from numeric source pixels. Use the right-side final
result and the rendered preview.

## 6. Replacements

Studio filters replacement candidates by compatibility and current availability.

Important behavior:

- SHOW replacements are same-network episodes
- branding replacements are same-network compatible branding roles
- commercials stay inside the current commercial pool
- UNIQUE assets already assigned to another active/reserved cart are blocked
- replacement of a source resets trim/crop/audio because those recipes belonged
  to the old source

`Network` is functional.

Example:

```text
NICK != SNICK
```

If a SNICK cart is accidentally configured as `NICK`, Studio will correctly but
undesirably offer regular Nickelodeon replacement pools.

## 7. GOOD

`GOOD` means the current effective clip and its current repair recipe have been
reviewed and accepted.

Unchanged GOOD slots carry forward where the revision logic can prove the
effective output is unchanged.

Changed output requires verification again.

## 8. Commit the draft

When the clip-level draft is ready:

```text
COMMIT DRAFT → NEXT REVISION
```

This creates one new immutable cart revision.

Do not commit a new revision merely because a preview was still rendering or
because a cache artifact failed. Fix the render/build problem first.

## 9. Build Full Review

Use:

```text
BUILD FULL REVIEW
OPEN FULL REVIEW
```

Full Review is for continuous assembled-cart QA:

- pacing
- break rhythm
- transitions
- relative volume
- sequence/order
- start/end behavior

Full Review currently uses:

```text
CACHE\review-v2
```

and uses the same SAR-safe crop/scale/pad geometry as Studio.

Review proxies and the combined movie are built transactionally and validated.

### Current limitation

There is not yet an overall Full Review progress bar.

Click the build once and let it run. Do not click it again merely because the UI
has not visibly advanced.

A future update should show:

```text
clip 14 / 36
encoding proxy
validating
concatenating
overall %
```

## 10. Final Cartridge

Finalization controls are on the main Studio page under **Final Cartridge**.

Current choices:

```text
BUILD FINAL LOCALLY
BUILD FINAL + COPY TO SELECTED DRIVE
```

Studio blocks finalization when:

- any draft change is uncommitted
- any clip is not GOOD

The USB flow also requires explicit drive confirmation.

### Current finalizer behavior

The finalizer:

- verifies current review proxies exist and match the manifest
- checks total size against the target/drive safety limit
- validates an existing `FINAL`
- reuses it if it already matches
- otherwise builds a staging FINAL and publishes it only when complete
- relabels the USB only after a valid local FINAL is ready
- copies only MP4 cartridge files
- shows PowerShell copy progress

It does **not** wipe unrelated files from the selected drive.

### Current concurrency limitation

Studio does not yet have a server-side final-build lock.

Click the final action once and wait for it. Double-clicking can start two
requests. v1.8.2 made the finalizer safer around this, but the UI/server should
still gain a proper single-job lock.

## 11. Creating a new cart

This part is still command/config driven.

Create:

```text
TOOLKIT\config\<CARTID>.json
```

Then:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'

& "$root\TOOLKIT\Initialize-RetroCartLibrary.ps1" `
    -SystemRoot $root

& "$root\TOOLKIT\New-RetroCartPlan.ps1" `
    -CartID <CARTID> `
    -SystemRoot $root

& "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
    -CartID <CARTID>
```

Do not skip the library refresh after adding a config. Episodes declared by the
config are registered during library initialization.

## 12. Multi-part episode blocks

Some shows are stored as separate shorts but should behave as one show block.

Use:

```text
TOOLKIT\Build-RetroCartComposite.ps1
```

Recipe mode example:

```powershell
$root = 'F:\[VIDEOS]\retro-tv-cart-builder'

& "$root\TOOLKIT\Build-RetroCartComposite.ps1" `
    -RecipePath "$root\TOOLKIT\config\composites\SNICK1-composites.json"
```

Auto mode:

- uses stream-copy/remux when the selected primary streams match
- ignores extra secondary streams by explicitly choosing primary video/audio
- uses a high-quality normalized intermediate when primary geometry/codecs do
  not safely match
- validates output duration
- never modifies the originals

Do not delete a composite while an unfinished cart still depends on its
`SourcePath` unless you are prepared to regenerate it before another render.

## 13. Adding handpicked content

Current helpers still exist:

```text
Add-HandpickedBranding.ps1
Add-HandpickedEpisode.ps1
Add-RetroCartSignOff.ps1
```

After adding durable content, refresh the library before expecting Studio or the
planner to see it.

## 14. Durable state

Important:

```text
STATE\
```

Back it up.

The most important files are:

```text
asset-registry.csv
assignments.csv
cart-registry.csv
handpicked-branding.csv
handpicked-episodes.csv
settings.json
studio-drafts\
```

Cache output is regenerable.

## 15. Source media rule

Source media remains user-owned and referenced in place.

The builder does not need to duplicate the user's TV/commercial archive.

If a source path is moved, that broken reference is currently the user's
responsibility. A future product UI should provide missing-source detection and
relinking.

## 16. Current checkpoint note

At the 2026-10-11 checkpoint:

```text
NICK01 r009 BUILT
NICK02 r010 BUILT
NICK03 r002 BUILT
NICK04 r002 BUILT
SNICK1 r002 in progress
```

An abandoned `SNICK r001` pre-rename record exists with released assignments.
Use `SNICK1`.
