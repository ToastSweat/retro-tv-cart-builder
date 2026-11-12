# Bulk workflow validation

42 tests passed (Node 24.22.1): existing 37 plus three bulk service cases and two DOM workflow scenarios.

Verified: all filtered results across 50-row pages; whole-show network/show assignment, season-only year change, additive/replacement/removal semantics, tag deduplication, preservation of notes/individual details/other fields, invalid bulk requests leave disk unchanged. UI tests covered selection across pages, all matching, multi-field bulk edit, subsequent season-year edit. Organization editor test simulates scroll/focus, verifies same position and search retained after artwork/save.

Existing WebP fix and project isolation/source-preservation tests retained. Native Windows visual scroll/layout acceptance pending; DOM uses simulated scrolling and mocked desktop bridge backed by real persistence. No media data schema change/dependency changes. No real user's source files modified.

Run npm ci then npm test in v2 to repeat. See V2-HANDOFF.md for acceptance workflow.


## Classification checkpoint — alpha.7
Media Library has a separate Classification filter: All clips, Needs classification, Classified.
New and legacy clips default to Needs classification; existing metadata is preserved. Legacy missing flags normalize in memory on read and are persisted on the next normal catalog save.
Individual details include a Classified checkbox. Edit selected includes an opt-in Change classification status field, which can be saved together with network/show/year/tags. No fields are required to mark classification complete; commercials and generic branding may have no show. This is an organization checkpoint, not Studio quality approval or generation eligibility. Rescans preserve the flag. Use Needs classification plus search (for example S01) and Select all matching to finish a season and remove it from the queue. All clips remains the default filter.
Validation: 43 automated service/DOM tests pass, including legacy default without read writes, classification persistence/rescan/reopening, bulk season updates dropping from the queue, and individual return to Needs classification. Windows desktop acceptance remains with the user.


## Folder browsing — alpha.8
Choose Library in Media Library, then open indexed folders in Browse folders. Breadcrumb buttons return to ancestors/library root. Include subfolders defaults on and controls both list and Select all matching. Folder counts count all indexed media before other filters, so classified folders remain navigable. Other filters/search continue to apply.
Sort by Title, Folder / path, or Filename (natural numeric ordering). Mark classified is a direct bulk action next to Include/Exclude. No rules or automatic metadata guessing; source files and schema unchanged. Existing project classifications preserved.
Validation: 45 automated tests pass, including folder scope/sibling boundaries, immediate-folder filtering, natural filename sort, scoped bulk classification and UI folder navigation. Windows desktop visual acceptance still required.
