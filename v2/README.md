# Retro TV Cart Builder v2 — Media Library organization

Close v2. Extract this package into F:\[WORKSPACE]\retro-tv-cart-builder, replacing matching v2/docs files. Existing projects, source libraries and legacy-v1 are not replaced. Launch v2/Start-RetroTV.cmd and open your project.

Choose Media Library. Select one configured library or all, then Scan folders. Add source folders in Project settings if needed. Scanning inventories references, file sizes and modification dates; no copying, source edits, playback or FFmpeg required.

Search/filter and choose Edit for a details drawer. Set category, network/show associations, year, matching tags, personal labels/notes and exclusion. Select rows on a page for bulk category/include/exclude. Exclusion affects this project only. Included does not mean quality-approved. Missing files retain metadata. Rescan preserves your classifications.

Scanning can be canceled; canceled scans save nothing. Wait for scan completion before editing metadata or changing projects. A metadata snapshot is kept in project data/media-library-previous.json. No source deletion feature.

Playback/trim/crop/audio processing, content duplicate detection, cart generation, repeat enforcement and Studio are future increments. See docs/V2-HANDOFF.md for current state and limitations.

Node 22+ with npm; dependencies unchanged. npm ci then npm test repeats 32 tests. Windows layout and real library scans need your review.
