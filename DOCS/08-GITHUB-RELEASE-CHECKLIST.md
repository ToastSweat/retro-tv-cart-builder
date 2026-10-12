# Retro TV Cart Builder — GitHub / Public Release Checklist

The engine is usable internally. A friendly public release still requires
productization.

**Current Studio checkpoint:** v1.8.2

## Already proven / partially complete

The repository already has working implementations for:

- durable revision/state model
- cached normalized preview/review media
- non-destructive trim/crop/audio repair
- compatible replacements
- show-aware branding matching
- Studio draft workflow
- Full Review
- all-GOOD / uncommitted-draft final-build gates
- local FINAL creation
- removable-drive selection
- direct USB copy
- automatic cartridge labeling
- composite episode utility

Do not redo these solely for a cleaner architecture.

## 1. Preserve working history

Before major productization:

- preserve v1.8.2
- preserve current durable STATE backup
- preserve NICK01 r009 reference data
- preserve completed NICK02/NICK03/NICK04 state
- preserve the SNICK1 transition/composite lessons
- preserve historical release/update notes

## 2. Separate a distributable tree from live personal state

The development working tree currently contains real durable state and local
absolute paths.

A public distributable should contain:

- engine/scripts
- Studio
- docs
- sanitized examples
- tests
- bootstrap/install assets

Do not ship personal:

- active STATE
- media
- cache
- review movies
- FINAL cartridges
- machine-specific build paths

## 3. Centralize environment/bootstrap

Remaining machine assumptions should be replaced by one setup/configuration
flow.

Needs to resolve:

```text
media locations
SystemRoot / app data root
BuildRoot
FFmpeg
FFprobe
Node/runtime if still required
```

Several standalone scripts still contain historical default paths even though
the Studio launcher now derives the repo root correctly.

## 4. Build the media-library UI

The application must index source media **in place**.

Do not copy a user's whole library into app storage.

Required concepts:

- media locations
- scan/rescan
- Inbox
- classify episode/commercial/branding
- bulk tagging
- source health
- missing-source detection
- relink

## 5. Add show entities

A show should exist independently of filenames.

Needs:

- show name
- aliases
- episodes
- episode parts
- grouping multi-part shorts into one broadcast block

The current composite utility should become an internal derived-media feature.

## 6. Add channel/block editor

A non-power-user should configure:

```text
channel/block name
branding pool
allowed shows
commercial pools
break style
ads per break
show-matched branding preference
opening: Auto
sign-off: Auto
```

Advanced Mode can expose raw branding subtypes and pinned assets.

## 7. Add job lifecycle/progress

Before public release:

- Full Review progress
- final-copy progress in Studio
- disable buttons while running
- server-side duplicate-job rejection
- cancellation where safe
- clear success/failure state

## 8. Make Full Review the finish line

Full Review should become a focused QC view.

Ideal flow:

```text
Build Full Review
→ watch
→ approve
→ export to USB
```

## 9. Add environment diagnostics

Before expensive work, validate:

- required runtime/tools
- FFmpeg/FFprobe
- required filters/codecs
- configured media locations
- config/database health
- source files
- write permissions
- target drive

## 10. Decide durable application storage

CSV/JSON is excellent for current development.

SQLite is a likely future fit for the end-to-end application, but only after the
library/channel UI requirements stabilize.

Preserve human-readable export/manifests and provide an upgrade path from
existing state.

## 11. Repository hygiene

Public release should include:

- `.gitignore`
- license
- version strategy
- release notes/changelog
- sanitized sample data
- screenshots
- no copyrighted media
- no personal active state
- no generated caches/builds
- no timestamped local hotfix backup directories

## 12. Fresh-machine test

Release candidate test:

1. install on a clean Windows machine
2. add a tiny media location
3. classify a few assets
4. define one show
5. define one channel
6. generate a cart
7. repair one clip
8. Full Review
9. final build
10. export to USB
11. close/reopen app and confirm state survives

Anything requiring undocumented tribal knowledge is a product or documentation
bug.

## Definition of "friendly public release"

A person who understands folders and video files, but does not know PowerShell,
FFmpeg, JSON, or CSV, can complete the entire workflow without a terminal.
