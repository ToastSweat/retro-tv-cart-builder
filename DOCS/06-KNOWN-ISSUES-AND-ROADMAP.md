# Retro TV Cart Builder — Known Issues, Limits, and Roadmap

This checkpoint is intentionally honest about what is finished and what is not.

The system is **usable**, but not yet polished enough for a public GitHub release without cleanup.

## Stable enough to build on

The following concepts have been proven through NICK01 and should be treated as mature baseline behavior:

- durable asset/cart/slot identities
- immutable revisions
- unique/reusable asset tracking
- continuous exact-broadcast review movie
- cached normalized proxies
- trim repair
- crop repair
- audio restoration
- contextual replacement
- GOOD carry-forward
- final exact-proxy output
- physical USB copy
- automatic volume label
- handpicked branding/sign-off support

## Current limitations

### 1. Finalizer does not enforce "all green"

The finalizer validates manifest/review/proxy consistency, but it does not ingest the exported browser review CSV and assert every action is `GOOD`.

The operator must currently perform that gate.

Before public release, final build should probably require an explicit approved review-state artifact.

### 2. Content ingestion is inconsistent by asset type

Episodes come from config JSON.

Bulk branding/commercials come from curation CSVs.

One-off branding has a helper.

There is no equivalent polished one-off commercial/episode helper.

This should be unified.

### 3. Paths are still developer-machine defaults

Scripts default to paths such as:

```text
F:\[VIDEOS]\Commercials
F:\[VIDEOS]\Retro TV Cart Builder
F:\[VIDEOS]\Retro TV Builds
```

Many scripts accept root parameters, but the public release should centralize all paths in one setup/config file rather than expecting users to understand every parameter.

### 4. Windows/PowerShell-oriented

The project has been developed and tested around Windows PowerShell.

There are explicit Windows assumptions:
- drive letters
- `Set-Volume`
- `label.exe`
- FAT/FAT32 cartridge naming
- `Invoke-Item`
- PowerShell progress behavior

Cross-platform support is not a current requirement, but it should be stated clearly on GitHub.

### 5. FFmpeg filter availability

v1.4.0+ restoration uses filters including:

```text
adeclip
adeclick
afftdn
anlmdn
dynaudnorm
loudnorm
```

A public release should:
- verify FFmpeg at startup
- verify required filters exist
- display a clear error if the installed FFmpeg build lacks one

### 6. No automatic byte-budget transcoding

The finalizer intentionally refuses an oversized cart.

It does not silently reduce bitrate/quality to force a fit.

That is the correct safety choice for now.

A future size-budget system could calculate target bitrates while preserving reviewed trims/crops/audio repair, but it should be explicit and reviewable.

### 7. No mid-episode commercial insertion

Current carts place ads between episodes/program blocks.

The builder does not cut commercial breaks into the middle of an episode.

This was explicitly deferred.

### 8. Review is local HTML, not a packaged application

This works well, but setup still feels developer-oriented.

The major stretch goal is a desktop wrapper/GUI.

## GUI stretch goal

The UI should initially wrap the existing scripts rather than replace their logic.

Possible buttons:

```text
Refresh Library
Create Cart
Build Review
Open Review
Apply Review
Audit Audio
Append Sign-Off
Build Final
Copy to USB
```

Useful fields:

```text
Cart selector
Current revision
Cart status
Current manifest path
Review status summary
Final size
Target drive
Volume label
Progress/log output
```

The GUI should execute the same durable state/revision pipeline.

That minimizes risk.

## GitHub release goal

The end goal is to make the project available to other owners of the Mini Retro TV or anyone interested in similar pseudo-broadcast cartridges.

Before release:

- create a clean repository
- remove generated caches/builds/state from source control
- add `.gitignore`
- centralize path configuration
- document FFmpeg dependency
- add setup/bootstrap script
- add generic example cart
- avoid shipping copyrighted source media
- clearly separate software from user-provided TV/media archives
- make the curation/import process understandable
- add explicit license
- add screenshots of the reviewer
- add a small sample/demo using user-owned or freely distributable media if possible
- add troubleshooting section
- add state backup/restore section
- add migration/version notes
- validate scripts from a fresh Windows machine/profile

## Clean Git commit plan

A sensible first public-history commit should contain only software/docs, not the accumulated local runtime state.

Potential repo shape:

```text
retro-tv-cart-builder/
├── README.md
├── LICENSE
├── .gitignore
├── docs/
├── toolkit/
│   ├── *.ps1
│   └── config/
│       └── EXAMPLE.json
├── examples/
├── gui/              # future
└── tests/            # future
```

Exclude:

```text
STATE/
CACHE/
INPUT_SNAPSHOTS/
Retro TV Builds/
copyrighted episodes
commercial archive
branding archive
personal curation backups unless explicitly intended as example metadata
```

## High-value next engineering tasks

### A. Approval gate

Make final build require a current approved review CSV or a durable approved flag.

### B. Configuration bootstrap

A setup script that asks once for:
- Commercial root
- TV root
- Builder state root
- Build root
- FFmpeg location

and writes one config file.

### C. Generic asset add/import

Replace special-case content ingestion with a coherent asset manager.

### D. GUI wrapper

Button-driven operation for routine tasks.

### E. Diagnostics

Add a command such as:

```powershell
.\Test-RetroCartEnvironment.ps1
```

to verify:
- FFmpeg/ffprobe
- filters
- paths
- state files
- config JSON validity
- current cart consistency
- free space
- missing source files

### F. Automated sanity tests

Tests around:
- replacement action semantics
- stale replacement handling
- BAD_AUDIO escalation
- cache key stability
- GOOD carry-forward
- finalizer manifest consistency
- unique assignment lifecycle

NICK01 exposed these through expensive manual iterations. Tests should prevent regressions.

## Development rule from this point

The project has reached the stage where a change that forces another full-cart re-review should be treated as expensive.

Prefer:
- small changes
- targeted rebuilds
- migration-safe state changes
- explicit cache versioning
- automated validation
- clear UI state

The goal is now refinement, not endless reinvention.
