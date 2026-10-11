RETRO TV CART STUDIO v1.5.0
============================

WHY THIS EXISTS
---------------
The old review loop required:

  review -> export CSV -> preflight -> apply -> build -> open -> review again

That is fine for immutable revision history, but terrible for iterative clip repair.
Studio adds a DRAFT layer in front of revision commits.

START
-----
From the Toolkit folder:

  .\Start-RetroCartStudio.ps1 -CartID NICK02

Or double-click:

  Start-RetroCartStudio.cmd

The .cmd launcher opens a cart picker if no CartID was supplied.
Leave the launcher/Node console open while Studio is running.

DRAFT BEHAVIOR
--------------
Changes are saved under:

  STATE\studio-drafts\<CartID>-rNNN.json

The current immutable cart manifest is not edited in place.

For a selected clip you can change one thing, render only that clip, listen/watch,
and change it again without creating r010, r011, r012 just to audition repairs.

AUDIO
-----
Audio repair levels:

  NONE -> RESTORE -> STRONG -> AGGRESSIVE -> MAX

REPAIR AUDIO +1 & PREVIEW moves up one level and immediately rebuilds only the
selected clip. AUDIO - moves down. RESET AUDIO TO ORIGINAL returns to NONE.

Every level reprocesses the original source with that level's recipe. The app
does not repeatedly filter a previous repaired proxy.

CROP
----
Crop values in Studio are ABSOLUTE pixels removed from the original source.
They are not additive deltas.

APPLY CROP & PREVIEW rebuilds only the selected clip.
AUTO DETECT runs cropdetect and fills a suggestion.
RESET CROP TO ORIGINAL sets all four crop values to zero.

REPLACEMENTS
------------
The replacement dropdown is filtered to compatible READY assets and avoids
already-reserved UNIQUE assets. Selecting a replacement resets trim/crop/audio
repair because those recipes belonged to the old source.

COMMIT
------
COMMIT DRAFT -> NEXT REVISION creates one new immutable revision containing the
current absolute Studio recipes and replacement choices, then updates the cart
registry and assignment snapshot.

BUILD FULL REVIEW / OPEN FULL REVIEW are available in Studio so normal use no
longer requires the command-line review sequence.
