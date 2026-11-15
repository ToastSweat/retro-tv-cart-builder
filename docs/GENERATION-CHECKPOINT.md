# Generation checkpoint — alpha.10

## Install / try

Close v2, extract this ZIP into `F:\[WORKSPACE]\retro-tv-cart-builder`, replace matching app/docs files, and reopen. This package does not contain or overwrite your project data. No dependency changes; use the normal launcher.

1. Open your Retro TV project.
2. Go to Carts & Templates → NICK01 → **Generate / lineup**.
3. Expand **Prepare the agreed NICK01 test setup** → **Preview setup changes**.
4. Inspect the category-repair count, then **Apply test setup**. Against the uploaded snapshot this changes 3,808 classified TV records from Unclassified to Show / episode. Specials/extras/sample directories, S00/M movie-style filenames and composite paths are skipped. No other media fields change.
5. The setup assigns Rugrats, Hey Arnold!, Doug, Rocko's Modern Life in that order, copies the original template to **NICK01 — generation test**, fixes intros to the following show and next-program alternatives to shows 2/3/4, and removes the final NEXT alternative where no following show exists. The original shared template is unchanged. Existing artwork is retained. Two data files are backed up together before setup writes.
6. KIDS_90S and GENERAL_90S are selected for this cart's first check. Click **Check / preview**.
7. Review selected clips, preferred/fallback labels and any unfilled slots. **Save lineup** is available only for a complete result. Preview alone reserves nothing.

## Expected NICK01 inventory result

The supplied project was checked on an isolated copy with file-presence checks replaced by an explicit metadata-only test stub. That check fills **15 of 19 slots** and reports **four show-entry shortages**, at positions 2, 6, 11 and 15. No actual Windows source path was checked here. The application will check source presence on your PC, so missing/offline libraries can add shortages.

Usable NICK bumper-ins are for Real Monsters and Ren & Stimpy, not this four-show lineup. Other matching show-entry clips have repair/exclusion/classification flags. The generator does not silently substitute unrelated-show branding or revive clips requiring repair.

The next content decision is whether those four copied-template slots should allow **Bumper general** as an additional fallback. That is not added automatically. You can already edit the copied template in Carts & Templates → Templates, add Bumper general after the existing choices in those four slots, save, and check again. Alternatively classify/repair matching show-entry media. The original template remains unchanged either way.

This is a short four-episode template test, not a claim to recreate V1's entire long NICK01 broadcast. Repeating a rotation or adding slots remains an explicit template edit.

## Rules in this checkpoint

- Classified, included, present media only.
- Respect V1_STATUS BAD_*, NEEDS_*, EXCLUDED and MAYBE labels, even if exclusion was manually unchecked. Repair workflow is future work; do not clear a flag just to force a build.
- Match category and network. SHOW requires the numbered show assignment. INTRO/NEXT require an explicit show association or an unambiguously resolvable legacy SHOW tag. Generic bumper in/out is allowed; show-specific bumpers must match the adjacent show. Show-specific promos/idents must target a show selected for the cart. Unknown program-specific tags do not silently act as generic branding.
- Commercials need an allowed pool tag; their blank network is intentional. Year limits apply to all clip types, using original release years; unknown years have an explicit allow checkbox.
- Preferred choices precede alternatives. The allocator considers constrained slots and backtracks to avoid consuming rare media needed elsewhere. Search is bounded; an exhausted search reports the limitation rather than allowing an incomplete save. This is a practical allocator, not an optimizer for an absolute minimum number of fallbacks.
- Repeat policy is fixed to project-wide blocking in this first checkpoint. User-configurable exceptions come later.

## Usage / repeat boundaries

A single `data/generated-carts.json` stores one active lineup per cart and its reservations. Saving a new lineup replaces that cart's previous reservations in one backed-up write; preflight excludes other carts' reservations and blocks duplicates within the proposal. Each run can select a different lineup. Its saved snapshot is stable until replaced/discarded.

Identity checks cover asset IDs, normalized source paths, show/title identity ignoring file extension, and recognized episode numbers/segment ranges. This blocks common AVI/MP4 duplicates and overlapping recognized episode bundles. It does **not** fingerprint video content or guarantee detection of renamed/re-encoded duplicate commercials in different files. The UI states that limitation. Content duplicate detection still needs design.

Composites in `_RetroTV_Composites` are deliberately unavailable until component tracking is implemented. No V1 assignment history or cross-project reservations are inferred/imported. A project with crossProjectUsageLock enabled is blocked rather than pretending to enforce unsupported cross-project locking.

Media Library shows **Reserved by …** on matching records. Those are project reservations, not changes to originals. Removing a cart with a saved lineup is blocked until **Discard saved lineup…** releases it. Discard requires an in-app confirmation. Template/cart changes produce a stale-lineup warning; regeneration is required before future build integration. Media/plan/project changes after preview invalidate Save. Selected source existence/size/modification time are rechecked at save.

## Persistence / recovery

Generation reads/validates current project data. All generated state lives inside the project. Setup writes only cart-plans.json and media-library.json, with a `generation-setup-backup-UUID` copy of the original files. Generation save/discard writes only generated-carts.json, with a `generation-backup-UUID` snapshot. No source media, artwork, exports, organization records or old V1 files are modified. Setup is opt-in through the button, never automatic on opening a project.

To undo setup: close the app, restore the two matching JSON files from its setup backup to the project's data folder, and reopen. To undo a later lineup change, restore generated-carts.json from its generation backup; if this was the first save, no prior generated-carts.json existed, so remove the new generated-carts.json while the app is closed. Do not restore old snapshots over later work without reviewing what would be lost.

## Validation and limits

60 automated tests pass. New coverage includes source availability, safe read-only preview, preferred alternatives and constrained allocation, quality/pool/show rules, own-cart regeneration vs other-cart locks, episode duplicate/segment overlap detection, stale-preview/source checks, save/release persistence, setup backups and untouched shared templates, and the GUI preview/save/invalidate/release path.

The supplied project's metadata audit is included as NICK01-INVENTORY-CHECK.json. It is explicitly not a source-file/decode test. Desktop visual acceptance is still required on Windows. A real test lineup was generated and saved only in temporary local fixtures.

## Next checkpoint

Resolve the NICK01 entry-slot fallback decision, then connect one saved lineup to Studio's playback/classify/replace/edit workflow. Studio must keep Good + next meaningful, permit crop/reprocess before an initial render finishes, preserve review progress, and invalidate only affected edits. No artificial mandatory second viewing/revision.

Full decode/runtime probing, composites, content fingerprints, repeat exceptions, crop/trim/audio repair, final encoding, USB size checks and export remain future work. This build does not claim to implement Studio or final deployment.


## Editing from generation — alpha.11

Generation now has Edit cart and Edit assigned template buttons. They open the actual current records using the existing editors; no guessed IDs, duplicate cart definitions or automatic template changes. Save or Cancel returns to this cart's generation screen and retains its commercial-pool/year inputs, including deliberately empty pools. A preview must be checked again after returning, so an old proposal cannot be saved following a template edit. The standard cart/template list editors still work.

For NICK01: Generate / lineup → Edit assigned template → in slots 2, 6, 11, 15 choose Bumper general in the alternative selector and click Add alternative → Save template → Check / preview. This adds generic branding as the final fallback behind the existing bumper-in/intro preferences. Do not re-run Prepare test setup just to edit a slot.

Installation changes only v2 source and docs. It does not replace project data or change templates until you save in the app. No app data migration or dependency change.

Validation: all 60 automated tests pass; the generation GUI test now opens and saves both assigned-template and cart editors, persists an alternative, returns to generation, preserves pool choices, and checks/saves/releases the lineup. Actual Windows visual acceptance remains with the user.
