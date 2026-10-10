# Retro TV Cart Builder — Next Chat / Developer Handoff

Use this when context has to move to another conversation.

## Current truth

- Project: Retro TV Cart Builder for My Mini Retro Television USB "VHS" cartridges.
- Current toolkit: **v1.4.1**.
- Reference cart: **NICK01**.
- Physical label: **NICK1**.
- Final reference review: **r009**.
- Final exported review CSV: **36/36 GOOD**.
- A physical NICK1 cartridge has been built.
- An earlier physical test around r003 was watched on-device and drove many of the later fixes.
- User + girlfriend will continue physical QA.
- Architecture is considered usable. Future changes should mostly be small refinements.

## Do not regress these behaviors

- immutable revisions
- stable AssetID/CartID/SlotID
- non-destructive source media
- cache reuse
- GOOD carry-forward
- replacement dropdown auto-sets `REPLACE_THIS_CART`
- keep/repair action clears selected replacement
- BAD_AUDIO = retained source + RESTORE; repeated BAD_AUDIO escalates to STRONG
- cropdetect is suggestion only
- final output uses exact reviewed proxies
- branding reusable; episodes/commercials unique

## Important paths

```text
F:\[VIDEOS]\Commercials
F:\[VIDEOS]\TV
F:\[VIDEOS]\Retro TV Cart Builder
F:\[VIDEOS]\Retro TV Cart Builder\Toolkit
F:\[VIDEOS]\Retro TV Cart Builder\STATE
F:\[VIDEOS]\Retro TV Cart Builder\CACHE\review-v1
F:\[VIDEOS]\Retro TV Builds
```

## Current priorities

1. QA the physical NICK1 cartridge.
2. Fix only real issues found in QA.
3. Build additional carts.
4. Add content as needed.
5. Eventually make a button-driven desktop GUI.
6. Clean/configure/document for GitHub.
7. Add a final all-GOOD approval gate and better environment diagnostics.

## Source of truth in this checkpoint

Read in order:

```text
START-HERE.md
DOCS/01-PROJECT-HANDOFF.md
DOCS/02-OPERATOR-GUIDE.md
DOCS/03-ARCHITECTURE-AND-STATE.md
DOCS/04-VERSION-HISTORY.md
DOCS/05-ADDING-CONTENT-AND-CARTS.md
DOCS/06-KNOWN-ISSUES-AND-ROADMAP.md
```

The old `README-FIRST-RUN.txt` inside the toolkit is historical and partially outdated.

## Current release package

```text
RetroTV-CartBuilder-v1.4.1.zip
```

All earlier releases are archived in `VERSIONS/`.

Preserve compatibility with the current STATE/revision model unless deliberately planning a migration.
