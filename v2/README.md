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


## Embedded Media Library player — alpha.9

Media rows now say Watch / edit. Opening details displays an embedded player above the existing fields. Standard controls provide Play/pause, seek, volume, fullscreen and native playback options. Playback does not classify or quality-approve a file. Existing metadata, exclusions and V1-import labels are untouched.

Original media streams directly through an opaque, selection-scoped token with byte-range seeking. Sources are resolved by catalog ID and must remain within a configured library after realpath resolution; arbitrary renderer paths are not accepted. Playback tokens expire when the drawer/selection/project closes. The CSP allows media only through the registered protocol, without broad file or network access.

If the browser cannot decode a file, Create compatible preview renders H.264/AAC MP4 with FFmpeg. It starts a background job with encoded-time progress, supports cancellation, and keeps the metadata fields usable. Full-file conversion must finish before that fallback is playable. A successful preview is cached under project/cache/library-playback, keyed by source identity, path, size and modification time. Reopening reuses it. No original is edited; this is a viewing proxy, not an export or audio repair. Closing the drawer cancels unfinished work and removes partial outputs.

FFmpeg is tried from PATH. Choose FFmpeg… lets the user select their known working executable (including the pinned V1 runtime) if PATH is missing or unsuitable. This executable choice lasts for the current app session; no FFmpeg binary is bundled or downloaded. Encoding uses limited threads, no shell, and no audio enhancement. A decode/encode error remains visible and doesn't mark the file bad or classified automatically. Old completed cache entries are retained; cache-management UI remains future work.

Validation: 52 automated tests pass, including service streaming/range/head behavior, token expiry and traversal denial, library link escape denial, cache invalidation, missing FFmpeg/cancel cleanup, real AVI → H.264/AAC conversion and cache reuse, source byte preservation, and DOM player/conversion/form-save/close behavior. Two existing DOM test helpers now wait for async buttons instead of relying only on fixed short delays. Actual Electron/Windows decoding and fullscreen were not exercised here and require user acceptance.

Technical references: https://www.electronjs.org/docs/latest/api/protocol and https://ffmpeg.org/ffmpeg.html .


## Cart generation — alpha.10

Implemented Generate / lineup with explicit NICK01 setup preview/apply, category cleanup, copied template targeting fixes, commercial pool and optional year rules, read-only shortage/preference preview, source presence checks, backed-up lineup save, project-local reservations, Media Library reservation labels, stale preview/plan warnings, and release. See docs/GENERATION-CHECKPOINT.md for full instructions, identity limits and recovery. Uploaded-project metadata audit: 3,808 category repairs, 15/19 slots filled, four show-entry shortages. No Windows source access was claimed. 60 automated tests passed. Studio/composites/encoding/export are still not implemented.


## Editing from generation — alpha.11

Generation now has Edit cart and Edit assigned template buttons. They open the actual current records using the existing editors; no guessed IDs, duplicate cart definitions or automatic template changes. Save or Cancel returns to this cart's generation screen and retains its commercial-pool/year inputs, including deliberately empty pools. A preview must be checked again after returning, so an old proposal cannot be saved following a template edit. The standard cart/template list editors still work.

For NICK01: Generate / lineup → Edit assigned template → in slots 2, 6, 11, 15 choose Bumper general in the alternative selector and click Add alternative → Save template → Check / preview. This adds generic branding as the final fallback behind the existing bumper-in/intro preferences. Do not re-run Prepare test setup just to edit a slot.

Installation changes only v2 source and docs. It does not replace project data or change templates until you save in the app. No app data migration or dependency change.

Validation: all 60 automated tests pass; the generation GUI test now opens and saves both assigned-template and cart editors, persists an alternative, returns to generation, preserves pool choices, and checks/saves/releases the lineup. Actual Windows visual acceptance remains with the user.
