# Development and maintenance

## Runtime

The source application is in `v2/`. It uses Electron 45.2.3, CommonJS main-process modules, a sandboxed preload bridge and plain HTML/CSS/JavaScript rendering. Dependency versions are pinned in `package-lock.json`; development requires Node.js 22+.

From the `v2` directory:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd start
```

The release suite contains 76 tests. Real media tests need FFmpeg/FFprobe; inspect the reported skip count rather than calling a suite with skipped media tests equivalent to a complete run. The release run had zero skips. Electron main/preload/renderer syntax is checked as part of the suite.

## Responsibilities

| Module | Responsibility |
| --- | --- |
| `projects.cjs` | Project structure, source library references and relocation |
| `catalog.cjs`, `artwork.cjs` | Networks/shows and copied artwork |
| `plans.cjs` | Cart definitions, ordered templates and alternatives |
| `media.cjs` | Media indexing, metadata, filters and bulk classification |
| `generation.cjs` | Eligibility, shortages, allocation and project reservations |
| `studio.cjs` | Review state, source findings, replacements and saved progress |
| `processing.cjs`, `crop-tools.cjs`, `playback.cjs` | V1 processing, crop tools, cached playback and bounded media access |
| `cartridge.cjs` | Approval/source validation, local builds, budgets and full reviews |
| `drives.cjs` | Windows volume discovery, verified staging, receipts, commit/rollback and labeling |
| `main.cjs`, `preload.cjs` | Native dialogs, app lifecycle, IPC boundaries and job state |
| `renderer.js`, `studio-v1.css` | Workspaces and the preserved V1 Studio screen |

## Change rules that matter

Preserve the original Studio layout, indicators, audio chains and familiar placement. A tidy-looking redesign is not a substitute for preserving a workflow that has already been tuned. Ask before changing that experience.

Good + next is approval. Do not reintroduce mandatory compiled-video viewing or artificial revisions before build. Cache reuse must correspond to source identity/stamps and processing settings. Changed clips invalidate only affected work.

Project metadata and derived media stay in the project. Source libraries remain unchanged. Usage reservations are project-local. A shared project's metadata must not silently select an arbitrary executable to run; FFmpeg selection is a machine preference made through the native picker.

USB operations must identify the selected volume, reject protected roots, validate receipts and hashes, preserve unrelated files, and retain rollback paths. Physical disconnection/process termination is outside ordinary rollback guarantees.

## Before calling a change ready

Run checks relevant to the change. For build/copy changes, include approval/source freshness, reuse, size gates, canceled/failed encodes, staging, integrity and rollback. For Studio work, include the original-control inventory and placement/status behavior. Preserve the matching lockfile and do not ship personal project data or generated media in the app package.

The owner reported the beta.1 workflow working on Windows and committed/pushed the code. Automated tests do not prove every new Windows/FFmpeg/device combination. Keep a small real cartridge acceptance test when changing formats or drive handling.

## Current boundaries

No composite editor/component reservation model, arbitrary content-hash duplicate detector, implemented cross-project lock or generate-all orchestration. Jellyfin is intentionally excluded. There is no signed installer, automatic updater or bundled FFmpeg in this release. Do not document these as completed features.
