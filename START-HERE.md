# Retro TV Cart Builder — Checkpoint / Start Here
**Checkpoint date:** 2026-10-10  
**Current toolkit:** v1.4.1  
**Reference cart:** NICK01 → physical cartridge label `NICK1`  
**Reference revision:** r009  
**Reference review result:** 36 clips, 36 `GOOD`, 0 unresolved

This folder is a deliberate stopping-point snapshot of the Retro TV Cart Builder project.

It exists for three reasons:

1. If the original development chat disappears or runs out of context, a new chat can pick up from here.
2. If another developer takes over, they can understand the system without reconstructing months of experiments.
3. Before future GUI/GitHub cleanup changes the project, this preserves the first version that proved the workflow is genuinely usable end-to-end.

## Current milestone

The first physical "VHS" cartridge, **NICK1**, has been built.

NICK01 was reviewed through revision **r009**. The exported final review state in `EXAMPLES/NICK01-r009-review-state.csv` contains:

```text
36 clips
36 GOOD
0 unresolved
```

An earlier revision, around r003, was also rendered to a physical USB cartridge and watched on one of the Mini Retro TVs. That physical viewing pass exposed many of the problems that shaped the current toolkit: overstuffed breaks, wrong-show branding, bad borders, poor audio, awkward transitions, and review-state UX problems.

The r009 / v1.4.1 milestone is therefore more than "one cart finished." It is proof that the builder architecture can survive real viewing, revision, repair, and final physical deployment.

The next phase should be incremental:
- QA NICK1 on the physical TVs.
- Make small fixes only where the real cartridge exposes a problem.
- Build more carts and expand content as needed.
- Reduce command-line friction.
- Eventually make a small desktop GUI that turns the common PowerShell commands into buttons.
- Clean paths/configuration/documentation and publish the project on GitHub.

## What is in this checkpoint

- `CURRENT_TOOLKIT/` — exact extracted v1.4.1 toolkit.
- `VERSIONS/` — every Cart Builder toolkit zip from the original v1 through v1.4.1.
- `DOCS/` — current documentation that supersedes the old first-run text in the toolkit.
- `EXAMPLES/` — NICK01 reference config and final all-green review CSV.
- `PLANNING/` — the broader 20-cartridge plan.
- `CURATION_TOOLS/` — source scanning/review tools used upstream of the Cart Builder.
- `SHAGS_LAB/` — project-diary posts that preserve the development story.
- `ARCHIVE-MANIFEST.csv` — hashes and sizes for all archived toolkit releases.

## Important warning about the toolkit's old README

`CURRENT_TOOLKIT/README-FIRST-RUN.txt` is historically useful, but it was written for the original v1 slice and is no longer authoritative.

For current operation, use:

1. `DOCS/02-OPERATOR-GUIDE.md`
2. `DOCS/05-ADDING-CONTENT-AND-CARTS.md`
3. `DOCS/06-KNOWN-ISSUES-AND-ROADMAP.md`

## Fast handoff to another ChatGPT conversation

Upload or provide:
- this `START-HERE.md`
- `DOCS/01-PROJECT-HANDOFF.md`
- `DOCS/02-OPERATOR-GUIDE.md`
- `DOCS/04-VERSION-HISTORY.md`
- the current `RetroTV-CartBuilder-v1.4.1.zip`

Then say:

> Continue the Retro TV Cart Builder project from this checkpoint. Treat v1.4.1 and the checkpoint documentation as the source of truth. NICK1/r009 is the first completed proof-of-concept cart. Preserve revision/state compatibility unless there is a compelling reason not to.

That should be enough to resume development without needing the original chat.
