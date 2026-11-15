# Studio V1 preservation correction — alpha.15

## Install
Close all app windows. Extract this package into F:\[WORKSPACE]\retro-tv-cart-builder, replacing the included v2 and docs files. Reopen your existing project and saved lineup, then Open Studio. No lineup regeneration or test setup is required. Existing library data, lineups, reservations, edits, approvals and notes are retained. The archived V1 is untouched.

## Source of truth
The user's uploaded studio.7z is the reference. The actual V1 screen markup and scoped CSS are reused, retaining its layout, placement and labels. The earlier alpha.12–14 Studio redesigns are superseded. Do not redesign Studio or remove working behavior without an explicit user request. Changes required by V2 data storage/IPC are adapters, not an invitation to simplify the UI.

## Restored screen and behavior
| V1 feature | V2 alpha.15 |
| --- | --- |
| Left timeline: position, role, title and review state | Restored, with original GOOD color and active-row treatment |
| Audio level, crop values and changed-clip bullet on timeline | Restored |
| Orange repeat warning with cart/position/status | Restored from project-local identity reservations |
| Back-to-back show warning | Restored using assigned show IDs |
| Player metadata and status/audio/crop badges | Restored above player |
| Start/End playback jumps, Play/Refresh, Good + next, Previous/Next | Restored beneath player |
| Replacement selector, Use + preview, Reset replacement | Restored in the card under player; search/paging also supports larger V2 pools |
| Audio repair card | Original first card on right; exact five V1 filter chains retained |
| Crop card | Original second card, source/proposed TV-result panes side by side, TV fit, detection, drag/resize, apply/reset |
| Trim card | Original third card, seconds removed from each end, playhead actions, Apply values + preview, Reset |
| Review-state selector and notes | Original fourth card; all ten V1 states restored; changes save automatically |
| Studio log, errors and render percentage | Restored in familiar locations |
| Header cart selection and Save review only | Switches among saved V2 lineups; saves directly without artificial revisions |
| Crop/reprocess before a render finishes | Retained; cancels/restarts older preview when applied |
| Final cartridge/full-review controls | Locations retained, explicitly disabled because V2 build/export remains pending |

Good + next approves only the current clip and resumes at the next clip. Preview editing actions save to the project before rendering as in the V1 draft workflow. Navigation saves pending edits/notes. Repair failures roll back to the previous working audio level and review state. Only the affected clip loses approval when processing or replacement changes. Reset replacement restores the original saved slot, resets its review and checks that its identity has not since been reserved elsewhere.

## Necessary V2 differences and remaining work
V2 owns project-local data instead of V1's global CSV/draft/revision files. Save review only writes the existing saved lineup; it does not create a new revision. SAVED/UNSAVED badges reflect that model. A saved lineup is required to enter Studio; the header lists saved lineups only. Template-compatible alternatives and the saved lineup's year/pool restrictions remain authoritative for replacements. Reserved candidates are visible but disabled.

BAD_QUALITY, BAD_AUDIO, NEEDS_CLIPPED, NEEDS_CROP and DUPLICATE findings add STUDIO_STATUS flags to this project's media record and prevent future generation/replacement eligibility. WRONG_ERA, WRONG_NETWORK and REPLACE_THIS_CART remain cart-local findings. Marking GOOD does not automatically clear a recorded source-quality finding. Project flags can be inspected/removed in library soft tags. No source media or other project's metadata is edited. Quality flags and the corresponding lineup review are written together with backups.

Automatic previews use the unchanged V1 audio chains and TV geometry already ported in alpha.13. Normalization is internal to those original chains; no separate gain/normalization controls return. Choose FFmpeg still selects the executable for the running session; ffprobe must be beside it. Preview cache and all metadata remain inside the project.

Full review compilation, final build, target-drive discovery/copy, size budgeting and Jellyfin export have not yet been implemented in V2. Their visible disabled controls state this; do not claim full V1 end-to-end parity. Composites and content-hash duplicate detection are also pending. Repeat warnings use IDs, paths and recognized episode identities, not arbitrary content equality.

## Validation
71 tests pass with zero skips. The parity test checks that every original screen control ID has a corresponding element, verifies original right-hand card order, timeline state/color rules and audio/crop details, flags/repeat/back-to-back warnings, inline replacement location, jump controls, explicit disabled build controls, review-state saves and Good + next advancement. Service tests cover project-only quality findings, generation exclusion, original replacement reset, repeat-audit ownership and invalid-state rejection. Prior real FFmpeg tests still validate all five V1 presets, crop geometry, border detection, trim and unchanged originals.

No actual Windows/Electron visual acceptance was performed here. The user must check the restored screen on their machine. No Windows Git commit or push has been performed. V1-CONTROL-INVENTORY.json and V1-CONTROL-ID-MAP.json record the source UI inventory used by the automated parity check; V1-REFERENCE.txt records original source hashes.
