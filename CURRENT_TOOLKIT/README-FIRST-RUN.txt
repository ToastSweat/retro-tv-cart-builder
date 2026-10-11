RETRO TV CART STUDIO (v1.5.0)
-------------------------------
For normal review/repair work, launch the new Studio instead of doing the CSV/apply/build loop by hand:

    .\Start-RetroCartStudio.ps1 -CartID NICK02

Studio previews one selected clip at a time, supports iterative audio/crop/trim/replacement work, autosaves a draft, and commits once to the next immutable revision. See studio\README-STUDIO.txt.

RETRO TV CART BUILDER v1 — NICK01 REFERENCE BUILD
===================================================

WHAT THIS VERSION DOES
----------------------
This is the first working slice of the cart-builder architecture.

It:
1. Builds a durable master asset registry from your finished curation CSVs.
2. Gives episodes, commercials and branding stable AssetIDs.
3. Tracks CartID + SlotID + revision assignment history.
4. Excludes bad / duplicate / needs-clipping source assets from future automatic builds.
5. Treats episodes and commercials as UNIQUE so an assigned one cannot be selected for another cart.
6. Treats branding as REUSABLE but still logs every cart/revision that used it.
7. Plans NICK01 from the exact episode list we previously agreed on.
8. Uses two unique KIDS_90S ads per between-show break.
9. Uses long Nickelodeon branding as the opening anchor; short branding is used functionally as stings.
10. Creates TV-shaped, audio-leveled review proxies.
11. Concatenates them into ONE clean end-to-end review movie with no inserted title slates.
12. Builds a review HTML page with:
    - normal video scrubbing
    - proportional real-time timeline
    - equal-width clip strip
    - current clip / exact start / exact end
    - START and END jumps
    - BOUNDARY IN / BOUNDARY OUT playback
    - LOOP IN / LOOP OUT
    - review flags and notes
    - non-destructive trim fields
    - compatible replacement dropdown
    - CSV export/import
13. Can apply an exported review CSV to create r002, r003, etc. while preserving history.

THIS VERSION DOES NOT YET
-------------------------
- write the final 4 GB USB output
- calculate the final cart bitrate/byte budget
- automatically perform denoising
- cut commercials into the middle of episodes

Those come AFTER we validate that the NICK01 plan/review workflow feels right.

DEFAULT LOCATIONS
-----------------
Existing archive:
  F:\[VIDEOS]\Commercials

Your curation backups:
  F:\[VIDEOS]\Commercials\_CURATION_BACKUPS

Durable builder state/cache:
  F:\[VIDEOS]\Retro TV Cart Builder

Cart revisions:
  F:\[VIDEOS]\Retro TV Builds\NICK01\r001

FIRST RUN
---------
Extract this toolkit somewhere permanent. Recommended:

  F:\[VIDEOS]\Retro TV Cart Builder\Toolkit

Open PowerShell and:

  Set-Location -LiteralPath 'F:\[VIDEOS]\Retro TV Cart Builder\Toolkit'

Then you can do the whole first run with:

  .\Start-NICK01.ps1

That performs initialization, creates the NICK01 plan, and builds the review assets.

IMPORTANT:
The review build has to normalize twelve full TV episodes plus ads/branding the first time.
That can take a while. The normalized clips are cached; later revisions reuse unchanged work.

If you prefer step-by-step:

  .\Initialize-RetroCartLibrary.ps1

  .\New-RetroCartPlan.ps1 -CartID NICK01

  .\Build-RetroCartReview.ps1 -CartID NICK01

OPEN THE REVIEWER
-----------------
After the build, look under:

  F:\[VIDEOS]\Retro TV Builds\NICK01\r001\REVIEW\

Open:

  cart-review.html

The video beside it:

  NICK01-review.mp4

is the proposed broadcast exactly end-to-end. There are NO review slates inserted into it.

The page knows every exact clip boundary and follows the playhead as you scrub.

REVIEW ACTIONS
--------------
UNREVIEWED
GOOD
REPLACE_THIS_CART
BAD_QUALITY
BAD_AUDIO
NEEDS_CLIPPED
DUPLICATE
WRONG_ERA
WRONG_NETWORK

BAD_QUALITY, BAD_AUDIO, NEEDS_CLIPPED, and DUPLICATE are global source-health findings.
When applied, those assets are taken out of future automatic build pools.

REPLACE_THIS_CART only means "I don't want this asset in this cart."
A good UNIQUE asset removed for that reason is released back into the pool.

EXPORT YOUR REVIEW
------------------
Use "Export Review CSV" in the HTML page.

Move/save that CSV somewhere sensible (the r001 REVIEW folder is ideal).

To apply it:

  .\Apply-RetroCartReview.ps1 `
      -CartID NICK01 `
      -ReviewCsv 'F:\[VIDEOS]\Retro TV Builds\NICK01\r001\REVIEW\NICK01-r001-review-state.csv'

If a slot needs replacing, choose a compatible Replacement Asset in the dashboard before exporting.
The apply script will refuse to silently guess if a replacement-required slot has no replacement selected.

REVISION / USAGE MODEL
----------------------
Permanent IDs:
  AssetID  = source identity
  CartID   = NICK01 forever
  SlotID   = logical position/function in NICK01 forever

Example:
  AssetID: AD-ab12cd34ef56
  CartID:  NICK01
  SlotID:  NICK01-BREAK-03-AD-02

Revisions:
  NICK01\r001
  NICK01\r002
  NICK01\r003
  ...

Old manifests are never overwritten.

If you replace a good commercial:
- its old assignment is RELEASED
- it becomes eligible for another cart again
- the replacement is RESERVED by the new NICK01 revision

If you discover a genuinely bad source:
- SourceStatus becomes BAD_QUALITY / BAD_AUDIO / NEEDS_CLIPPED / DUPLICATE
- it stays out of all future automatic builds

AUDIO / VIDEO REVIEW PROFILE
----------------------------
Review proxies use:

  H.264
  618x480
  30 fps
  yuv420p
  keyframe every ~1 second
  AAC stereo
  44.1 kHz
  ~128 kbps audio
  loudnorm target around -16 LUFS / -1.5 dBTP

Aspect ratio is preserved with letter/pillarboxing rather than stretching.

Noise reduction is NOT applied globally.
If a source has objectionable hiss/hum/noise, mark BAD_AUDIO for now.
A later repair pass can add opt-in DENOISE_LIGHT / DENOISE_STRONG processing without damaging every archival clip.

WHY THERE ARE TWO TIMELINES
---------------------------
The proportional timeline represents real elapsed time.
A 30-second commercial is tiny beside a 22-minute episode.

The equal-width clip strip gives every source clip a clickable target, so you can jump around quickly.

Boundary QA is intentionally first-class:
- START: exact beginning of selected clip
- END: last ~6 seconds
- BOUNDARY IN: previous few seconds -> first few seconds of selected clip
- BOUNDARY OUT: last few seconds -> first few seconds of next clip
- LOOP IN / LOOP OUT: repeat those boundary areas until you're satisfied

BACKUPS
-------
Keep backing up:

  F:\[VIDEOS]\Retro TV Cart Builder\STATE

That folder is the durable memory of the system:
- asset-registry.csv
- assignments.csv
- cart-registry.csv
- settings.json

The generated video folders can always be rebuilt from the source archive + this state.
