# 2.0.0-beta.1 — 2026-11-15

Retro TV Cart Builder now supports the selected-cart workflow from project creation through a verified USB cartridge.

## Included

- Project setup and external source-library references.
- Networks/shows/artwork, carts, templates and ordered preferred/fallback choices.
- Folder-based media browsing, filtering, bulk metadata and classification.
- Shortage-aware generation and project-local reservations.
- The preserved V1 Studio layout: timeline states/colors, crop/audio details, repeat/adjacency warnings, familiar editing controls, replacements, review states and log.
- Good + next approvals with saved progress, original-source processing and preview cancellation/restart.
- Numbered local builds using approved caches, current-source validation, optional explicit size fitting and retained previous finals.
- Windows drive discovery/protection, verified USB staging, owned-file receipts, rollback and labeling.
- Optional compiled full review without a second-review requirement.
- Remembered machine-specific FFmpeg selection.

## Verification

76 automated checks passed with zero skips, including real FFmpeg and filesystem build/copy/recovery tests. The owner reported the completed workflow working on their Windows machine and committed/pushed the code. No commit hash or independent device-playback measurement is asserted here.

## Deliberately outside this release

Jellyfin export, composite creation/component tracking, content-hash duplicate detection, cross-project locking and generate-all orchestration. This is a source-based desktop release rather than a signed packaged installer.

## Upgrade

Close the app, back up the project, update application files and reopen the same `project.json`. Existing lineups/reviews remain. Do not regenerate or rerun old setup scripts as an upgrade step. See [installation](INSTALL.md).
