# Retro TV Cart Builder v2 — Bulk workflow update

Close v2, extract into F:\[WORKSPACE]\retro-tv-cart-builder replacing matching v2/docs files, launch and open existing project. No project data migration/reset; networks, shows and artwork retained. WebP fix included.

Networks & Shows: editing artwork/details and saving/canceling restores your list position and search. In-session view state only, not stored between app restarts.

Media Library: filter/search a series → Select all matching → Edit selected. Check Networks and Shows, choose values, optionally check matching tags. Add keeps existing assignments/tags; Replace overwrites the selected field; Remove removes only listed values. Unchecked fields stay untouched.

Next filter to a season (e.g. S01E in filenames) → select matching results → Edit selected → check Year only and apply. All other fields remain unchanged. Individual edits still work as before. Notes are not bulk-overwritten.

Selection persists across pages; page checkbox affects that page only. Changing filters clears selection; counter shows total across pages. Bulk operations support up to 50,000 files; narrow filters beyond that. Source media untouched; metadata stays in project.

42 tests passed. Native Windows workflow awaits your review. No new dependencies; Node 22+, same launcher. See docs/V2-HANDOFF.md.


## Classification checkpoint — alpha.7
Media Library has a separate Classification filter: All clips, Needs classification, Classified.
New and legacy clips default to Needs classification; existing metadata is preserved. Legacy missing flags normalize in memory on read and are persisted on the next normal catalog save.
Individual details include a Classified checkbox. Edit selected includes an opt-in Change classification status field, which can be saved together with network/show/year/tags. No fields are required to mark classification complete; commercials and generic branding may have no show. This is an organization checkpoint, not Studio quality approval or generation eligibility. Rescans preserve the flag. Use Needs classification plus search (for example S01) and Select all matching to finish a season and remove it from the queue. All clips remains the default filter.
Validation: 43 automated service/DOM tests pass, including legacy default without read writes, classification persistence/rescan/reopening, bulk season updates dropping from the queue, and individual return to Needs classification. Windows desktop acceptance remains with the user.


## Folder browsing — alpha.8
Choose Library in Media Library, then open indexed folders in Browse folders. Breadcrumb buttons return to ancestors/library root. Include subfolders defaults on and controls both list and Select all matching. Folder counts count all indexed media before other filters, so classified folders remain navigable. Other filters/search continue to apply.
Sort by Title, Folder / path, or Filename (natural numeric ordering). Mark classified is a direct bulk action next to Include/Exclude. No rules or automatic metadata guessing; source files and schema unchanged. Existing project classifications preserved.
Validation: 45 automated tests pass, including folder scope/sibling boundaries, immediate-folder filtering, natural filename sort, scoped bulk classification and UI folder navigation. Windows desktop visual acceptance still required.
