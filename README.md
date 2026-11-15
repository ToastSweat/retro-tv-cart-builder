# Retro TV Cart Builder

Build a television schedule from local episodes, commercials, idents, promos and bumpers, review it in a desktop Studio, and write a numbered video cartridge to USB.

The current version is **2.0.0-beta.1**. The project → library → template → lineup → Studio → local build → USB workflow is working. V2 keeps the familiar V1 Studio layout and editing controls.

## Start here

1. Follow the [Windows installation guide](docs/INSTALL.md).
2. Create or open a project, then follow the [user guide](docs/USER-GUIDE.md).
3. Keep your [project and backups](docs/PROJECT-FILES-AND-BACKUPS.md) separate from the application code and source media.

Launch `v2/Start-RetroTV.cmd`. This is a source-based Electron desktop application; this release is not a signed Windows installer. Node.js, npm and FFmpeg/FFprobe are required. First launch installs the pinned desktop dependencies through npm.

## What it does

- Self-contained projects referencing external, unchanged media libraries.
- Networks and shows, artwork, carts and reusable ordered templates.
- Preferred slot choices and alternatives, such as Coming up next → Bumper in.
- Folder browsing, filtering, bulk metadata editing and classification.
- Per-cart generation with shortage explanations and project-local reservations.
- Studio playback, Good + next, review states, source-quality flags, replacements, trim, visual crop/TV fit and original V1 audio repair levels.
- Cached previews, local numbered MP4 builds, optional full-review playback and verified USB copying.
- Explicit size-budget fitting when needed; no automatic quality reduction.

Using media in one project does not reserve it in another. Renamed/re-encoded duplicates are not universally detected by content. Composite creation, cross-project locking and generate-all orchestration are not implemented. Jellyfin export is outside this application's current scope.

## Documentation

- [Install and update](docs/INSTALL.md)
- [Use the application](docs/USER-GUIDE.md)
- [Project files, backup and recovery](docs/PROJECT-FILES-AND-BACKUPS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Development and tests](docs/DEVELOPMENT.md)
- [Beta.1 release notes](docs/RELEASE-NOTES-2.0.0-beta.1.md)

The application contains no media library, prepared personal projects or sample episodes. Add your own local media folders.
