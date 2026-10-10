# Retro TV Cart Builder — GitHub / Public Release Checklist

The project is not ready to publish merely because NICK1 works.

The software works; the repository still needs productization.

## Phase 1 — Freeze the checkpoint

- Preserve v1.4.1.
- Preserve current `STATE`.
- Preserve NICK01 r009.
- Preserve the all-GOOD review CSV.
- Preserve all historical version zips.
- Tag this local milestone conceptually as `first-usable-checkpoint`.

This checkpoint package does that.

## Phase 2 — Create a clean source tree

Do not initialize Git from the live state/build directory.

Create a clean project folder containing only:
- scripts
- example configuration
- documentation
- future GUI code
- tests

Do not commit:
- copyrighted TV episodes
- commercials
- bumpers
- user cache
- active state
- generated review movies
- generated final cartridges

## Phase 3 — Remove machine-specific assumptions

Centralize:

```text
CommercialRoot
TVRoot
SystemRoot
BuildRoot
FFmpeg path
FFprobe path
```

A setup/bootstrap command should write these once.

The user should not need to edit multiple scripts.

## Phase 4 — Make content import understandable

Document or implement:
- add episode
- add commercial
- add branding
- add sign-off
- bulk import/curation
- source-health repair/re-enable behavior

The current mixture of config-driven episodes and CSV-driven commercials/branding is workable internally but too implicit for strangers.

## Phase 5 — Add environment diagnostics

Before any expensive build, a command should verify:
- PowerShell version
- FFmpeg exists
- FFprobe exists
- required filters exist
- configured folders exist
- curation sources exist
- cart configs parse
- source files referenced by configs exist

## Phase 6 — Add final approval safety

Final build should not rely on "I remember everything was green."

Require a durable approval artifact or imported current review CSV and fail if any action is not `GOOD`.

## Phase 7 — GUI wrapper

Keep the proven scripts as the engine initially.

A small Windows app can provide:
- cart selection
- current revision/status
- refresh library
- create plan
- build/open review
- apply exported review
- audit audio
- build final
- target USB selection
- logs/progress

Do not rewrite stable logic just to get buttons.

## Phase 8 — Documentation

Minimum public docs:

```text
README.md
Quick Start
Installation
FFmpeg Setup
Folder Layout
Asset Import
Creating a Cart
Review Actions
Audio/Crop/Trim Repair
Building USB
State Backup/Restore
Troubleshooting
Architecture
Changelog
```

## Phase 9 — Repository hygiene

Add:
- `.gitignore`
- license
- version number strategy
- release notes
- example config
- sanitized screenshots
- no private/local paths in public examples where avoidable

## Phase 10 — Fresh-machine test

The strongest release test:

1. Clone repository on a clean Windows environment.
2. Install FFmpeg.
3. Point setup at a tiny test media library.
4. Initialize.
5. Build one demo cart.
6. Review it.
7. Apply one trim/crop/replacement/audio repair.
8. Rebuild.
9. Finalize to a USB folder/drive.

Anything that requires undocumented tribal knowledge becomes a documentation or software bug.

## Suggested first commit

Possible message:

```text
Initial public release of Retro TV Cart Builder

- revisioned cartridge planning
- HTML broadcast review
- cached Mini Retro TV normalization
- non-destructive trim/crop/audio repair
- replacement and source-health workflow
- final USB cartridge builder
```

Before making that commit, sanitize the source tree rather than committing the live working directory.
