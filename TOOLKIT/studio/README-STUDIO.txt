RETRO TV CART STUDIO v1.8.2
============================

PURPOSE
-------
Studio is the normal day-to-day review/workbench UI for Retro TV Cart Builder.

It replaces the old repeated:

  export review CSV
  -> apply
  -> build
  -> reopen

loop for ordinary clip repair.

START
-----
Recommended:

  TOOLKIT\Start-RetroCartStudio.cmd

Or:

  $root = 'F:\[VIDEOS]\retro-tv-cart-builder'

  & "$root\TOOLKIT\Start-RetroCartStudio.ps1" `
      -CartID SNICK1

The launcher derives SystemRoot from the repository layout when SystemRoot is
not supplied.

Leave the launcher/Node console open while Studio is running.

DRAFTS
------
Studio saves revision-specific mutable drafts under:

  STATE\studio-drafts\<CartID>-rNNN.json

The immutable cart manifest is not edited in place.

PREVIEW
-------
Studio renders only the selected effective clip and shows render progress.

Identical in-flight preview requests are deduplicated.

Damaged H.264/AAC source packets are reported as source-media corruption rather
than pretending audio restoration can fix broken encoded packets.

AUDIO
-----
Repair ladder:

  NONE -> RESTORE -> STRONG -> AGGRESSIVE -> MAX

Every level reprocesses the original source.

CROP
----
The current crop UI uses a real blue crop box:

- drag the box to reframe
- drag corners to resize
- corner resize is locked to the physical 618x480 TV ratio
- source sample/pixel aspect ratio is corrected before final fit
- right pane shows the exact final 618x480 geometry

Current render order:

  crop source coded pixels
  -> correct source SAR
  -> proportional fit to 618x480
  -> pad if needed
  -> square-pixel output

Nothing is saved until APPLY THIS CROP & PREVIEW VIDEO is used.

REPLACEMENTS
------------
Compatible READY candidates are filtered by role/network/pool.

SHOW candidates prefer same-show replacements first in the UI ordering.

UNIQUE assets already active/reserved elsewhere are blocked.

NETWORK IDENTITY
----------------
Network is functional.

For example:

  NICK != SNICK

A SNICK cart must be configured as SNICK to receive SNICK branding and episode
replacement candidates.

COMMIT
------
COMMIT DRAFT -> NEXT REVISION creates one new immutable revision containing the
current Studio choices.

FULL REVIEW
-----------
BUILD FULL REVIEW / OPEN FULL REVIEW are available in Studio.

Current Full Review cache:

  CACHE\review-v2

The v1.8.1 builder writes proxies and the combined review transactionally and
uses the same SAR-safe geometry as Studio.

Current limitation:
Full Review does not yet show overall build progress.

FINAL CARTRIDGE
---------------
The main Studio page includes:

  BUILD FINAL LOCALLY
  BUILD FINAL + COPY TO SELECTED DRIVE

Studio refuses finalization when:

- the draft has uncommitted changes
- any clip is not GOOD

The finalizer validates/reuses a matching existing FINAL. A required replacement
FINAL is built in staging first.

The USB is not relabeled until a valid local FINAL is ready.

The current finalizer does not wipe unrelated files from the selected drive.

CURRENT JOB-LIFECYCLE LIMIT
---------------------------
Long-running build/final buttons do not yet have a server-side single-job lock.

Click once and wait.

Future:
- disable button while running
- overall progress
- current phase
- server-side duplicate request rejection

SOURCE MEDIA
------------
Studio references source media in place.

Original source files are not modified.

Derived/cache/final files may be regenerated.

MORE
----
See:

  DOCS\00-CURRENT-CHECKPOINT.md
  DOCS\02-OPERATOR-GUIDE.md
  DOCS\06-KNOWN-ISSUES-AND-ROADMAP.md
  DOCS\09-END-TO-END-PRODUCT-VISION.md
