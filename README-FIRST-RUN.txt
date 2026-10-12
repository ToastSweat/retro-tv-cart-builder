RETRO TV CART BUILDER — CURRENT FIRST RUN / QUICK START
=======================================================

CURRENT STUDIO
--------------
Retro TV Cart Studio v1.8.2

CURRENT DEVELOPMENT ROOT
------------------------
F:\[VIDEOS]\retro-tv-cart-builder

IMPORTANT
---------
This file replaces the original v1 first-run instructions.

The original command-heavy review workflow still exists under the hood, but
normal review work should now happen in Studio.

SOURCE MEDIA
------------
Your episode/commercial/branding files remain where you already keep them.

The builder references source paths. It does not need to copy your whole media
library into the repo.

If you later move a source file and break the path, that source must be relinked
or the config/registry refreshed.

EXISTING CART
-------------
The easiest launch is:

  TOOLKIT\Start-RetroCartStudio.cmd

Double-click it, choose a cart, and leave the console window open.

Or:

  $root = 'F:\[VIDEOS]\retro-tv-cart-builder'

  & "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
      -CartID SNICK1

NEW CART — CURRENT DEVELOPMENT WORKFLOW
---------------------------------------
New-cart creation is not fully in the GUI yet.

1. Add/edit:

   TOOLKIT\config\<CARTID>.json

2. Refresh the library:

   $root = 'F:\[VIDEOS]\retro-tv-cart-builder'

   & "$root\TOOLKIT\Initialize-RetroCartLibrary.ps1" `
       -SystemRoot $root

3. Create the plan:

   & "$root\TOOLKIT\New-RetroCartPlan.ps1" `
       -CartID <CARTID> `
       -SystemRoot $root

4. Launch Studio:

   & "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
       -CartID <CARTID>

STUDIO REVIEW
-------------
For each clip:

- preview
- replace bad material if needed
- repair audio if needed
- trim if needed
- crop/reframe if needed
- verify the rendered result
- mark GOOD

Studio autosaves the draft.

When the draft is ready, commit it as the next immutable revision.

FULL REVIEW
-----------
Use:

  BUILD FULL REVIEW
  OPEN FULL REVIEW

This creates the continuous assembled-cart QA view.

The Full Review build does not yet have an overall progress bar. Do not assume
the first click failed merely because the build takes time.

FINAL CARTRIDGE
---------------
Return to the main Studio page and use the Final Cartridge section.

Studio will not finalize when:
- there are uncommitted draft changes
- any clip is not GOOD

You can:

  BUILD FINAL LOCALLY

or select a drive, confirm it, and use:

  BUILD FINAL + COPY TO SELECTED DRIVE

The drive is relabeled only after a valid local FINAL exists.

The finalizer copies cartridge MP4s. It does NOT wipe unrelated files from the
target drive.

IMPORTANT CURRENT UI LIMIT
--------------------------
Long-running build/final actions do not yet have a server-side concurrency lock.

Click BUILD FULL REVIEW or BUILD FINAL once and let it finish. A future Studio
update will disable/lock these actions while a job is running.

MULTI-PART EPISODES
-------------------
If a "show block" is made from multiple source shorts, use:

  TOOLKIT\Build-RetroCartComposite.ps1

SNICK1 has a reusable example recipe:

  TOOLKIT\config\composites\SNICK1-composites.json

DURABLE STATE
-------------
Back up:

  STATE\

Especially:
  asset-registry.csv
  assignments.csv
  cart-registry.csv
  handpicked-branding.csv
  handpicked-episodes.csv
  settings.json
  studio-drafts\

CACHE is regenerable. STATE is not.

POWERSHELL DOWNLOAD WARNING
---------------------------
If Windows marks copied/downloaded scripts as Internet files, you may see
"Run only scripts that you trust."

After you have reviewed/trusted the repository, you can remove that marker with:

  Get-ChildItem -LiteralPath 'F:\[VIDEOS]\retro-tv-cart-builder' -Recurse -File |
      Unblock-File

MORE
----
Read:

  START-HERE.md
  DOCS\00-CURRENT-CHECKPOINT.md
  DOCS\02-OPERATOR-GUIDE.md
  DOCS\06-KNOWN-ISSUES-AND-ROADMAP.md
