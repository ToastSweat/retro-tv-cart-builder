# User guide

The workflow is **project → networks/shows → templates/carts → classified library → saved lineup → Studio → build → USB**. You can revisit organization whenever needed, but avoid changing a cart's template midway through reviewing its saved lineup.

## Project and station setup

Create or open a project from the welcome screen. The project hub has **Networks & Shows**, **Carts & Templates**, **Media Library** and **Project settings**.

Create networks with long names, short names and optional artwork. Create shows and associate each with one or more networks. A show association does not copy media and does not imply that every episode is available for every cart.

Project settings lets you add, remove or locate source libraries. Move the whole project folder when relocating it, then open its `project.json`. Locate moved source libraries in settings so their existing IDs and media classifications remain connected.

## Templates and carts

A template is an ordered sequence of clip choices. It can include ident, promo, bumper in/out/general, commercial, sign-off and numbered show/intro/next slots. Numbered show slots refer to the corresponding show in the cart's ordered show list.

A slot can have preferred and fallback choices. For example, **Coming up next 2 → Bumper in → Bumper general** means try those options in order. Those allowed choices also inform Studio's replacement selection.

Create a cart, give it a code/name/network and optional artwork, select its template, and add its shows in the intended order. Template changes affect every cart using that template; use a separate template when a change should apply to one cart only.

## Organize the library

Add source library folders in settings, then scan them in **Media Library**. A scan indexes supported media; it does not copy or alter originals. Browse a library's actual folders and choose whether subfolders are included. Search and filter by category, network, show, classification and status.

For each group of clips, set:

- Category: Show/episode, Commercial, Ident, Promo, Bumper in/out/general, Intro, Next, Sign-off or another available category.
- Network associations and show associations where relevant.
- Year, hard tags, soft tags and notes as needed.
- Classification status and inclusion/exclusion.

Use selection across pages or Select all matching for bulk work. Check your folder/filter scope before selecting all. The bulk editor supports add/replace/remove for association/tag fields. Apply one show's associations broadly, then filter to a season to assign its year.

**Mark classified** is a human workflow marker, not a claim that the video has been watched or approved. Filter to unclassified material to keep a shrinking work queue. Exclusion keeps unwanted source records out of generation without deleting the media.

The embedded player lets you inspect a file while organizing it. If a source format cannot play directly, create a compatible preview with FFmpeg. Destructive source-file editing is not part of this workflow; Studio processing produces project-local derivatives.

### Commercial pools

Generation reads pool tags from commercial hard tags. Recognized pools include `GENERAL_90S`, `GENERAL_00S`, `KIDS_90S`, `KIDS_00S`, `LATE_NIGHT` and `PSA`. Assign appropriate tags, then choose the permitted pools on the cart's generation screen. A Commercial category by itself does not invent a suitable pool association.

## Generate and save a lineup

Open a cart's **Generate / lineup** screen. Choose allowed commercial pools and optional year limits, including whether unknown years are allowed. Click **Check / preview**.

The proposal shows preferred/fallback choices and explains unfilled slots. Resolve missing classification, exclusion/quality flags, unavailable sources, restrictive year/pool rules or reservations elsewhere. Edit cart / Edit assigned template are available here when the definition needs adjustment.

A preview does not reserve clips. **Save lineup** reserves its selected media inside this project. Current generation prevents repeats by registered identity, path and recognized episode identities. It does not detect every renamed or re-encoded duplicate by comparing actual media content.

Generating again proposes a replacement lineup; saving it replaces the active one. To preserve review work, use Studio replacements for individual changes. **Discard saved lineup** releases that lineup's reservations. It does not erase source media or the cart definition.

Generation is one selected cart at a time. Composite assets are not generated until component tracking is implemented. Cross-project locking and global repeat overrides are not implemented.

## Review in Studio

Open the saved lineup. Studio retains the V1 arrangement: timeline on the left; player and replacements in the center; Audio repair, Crop/TV fit, Trim, then Review state and Notes on the right.

The timeline shows review states, green GOOD indicators, audio level, crop details, changed clips, repeat warnings and adjacent same-show warnings. The player has Start/End jumps, Play/Refresh, Good + next and Previous/Next.

**Good + next saves your approval and advances.** It is the approval used for building. You do not have to watch a compiled version again or create a new revision. Navigation resumes from the saved position. Review-state selection and notes save automatically; Save review only is also available.

### Audio, crop and trim

- Audio repair uses the original V1 levels: NONE, RESTORE, STRONG, AGGRESSIVE and MAX. Each render starts from original media, not the previous processed file. NONE retains V1's base audio chain. Failed repair changes roll back to the previous working level.
- The blue crop box identifies the surviving source area. Move it or resize a corner, fit the maximum TV area, detect borders and fit, or propose no crop. Inspect the source and proposed 618×480 result before applying. Detection can mistake dark picture content for a border.
- Crop controls remain usable while a full video preview renders. Apply again to cancel/restart that preview with the new settings.
- Trim fields are seconds removed from the original start/end. The playhead buttons account for an already-trimmed preview. Apply values + preview or reset trim when needed.

Changing a clip's processing clears only that clip's approval. Replacing a clip resets that slot's edits/review. Other clips keep their progress.

### Replacements and source findings

The inline replacement selector uses the template's allowed alternatives and the saved lineup's year/pool rules. Reserved/unavailable candidates are visible but disabled. Use + preview replacement changes the current slot; Reset replacement restores its original saved slot if the old media is still available and unreserved elsewhere.

BAD_QUALITY, BAD_AUDIO, NEEDS_CLIPPED, NEEDS_CROP and DUPLICATE also record source-quality flags in this project's media metadata, excluding that source from future selection. WRONG_ERA, WRONG_NETWORK and REPLACE_THIS_CART remain cart-local. Approving a repaired clip does not erase its source-quality history. These flags never modify originals or another project's records.

## Build locally

Once all clips are GOOD and repeat warnings are resolved, click **BUILD FINAL LOCALLY**. The default local budget is **3600 decimal MB**. The build reuses valid approved previews and renders missing compatible outputs as needed.

The final folder is inside the project's `builds/<cart ID>/FINAL`. It contains numbered MP4 files, a manifest and a playlist. Open final folder reveals it. Existing verified finals are reused; successful replacements retain the previous final in a backup folder.

If output is too large, it stops without silently lowering quality. Increase the local budget, shorten the lineup or explicitly enable **Fit to size budget**. Fitting uses calculated two-pass encoding and can reduce quality. The actual result must still fit. Original previews are retained.

Optional full review compiles a separate playback video. It is never a required review gate.

## Copy to USB

Refresh drives, select the exact cartridge volume and verify its letter/label. The Windows system drive and volumes containing your project/source libraries are disabled. Tick the confirmation and click Build final + copy. Confirm the target in the native dialog.

Copy uses **97% of actual drive free space**, independently of the local-budget field. It stages and hashes files before completion, then labels the drive for the cart where Windows permits. A small receipt tracks app-owned cartridge files for later updates. Unrelated MP4 files require an empty drive or manual cleanup first; the app does not format drives or delete unrelated material to make space.

A matching cartridge is verified and reused. Other updates require room to stage the new copy while the previous one remains. Wait for completion before ejecting the drive. Cancel build waits for cleanup; an unplugged device or killed process can prevent normal rollback.
