# Retro TV Cart Builder Hermes overhaul handoff

**Prepared:** October 28, 2026  
**Owner and approver:** Shawn  
**Recipient:** Hermes  
**Purpose:** Improve the existing application so the remaining five carts can be prepared, reviewed, and exported through a coherent GUI.

## Read this first

This is an existing, working broadcast builder. Preserve and reuse its proven functionality. Some work adds missing capabilities; other work reorganizes existing capabilities into a clearer application. Do not assume the project needs a new engine, database, framework, or complete rewrite.

The product should have three workspaces: **Library Manager**, **Cart Builder**, and **TV Studio**, accessible through a central hub. A normal user should be able to complete the workflow without PowerShell commands, hand-editing JSON/CSV, or understanding internal revisions and caches.

The owner wants a phased, collaborative overhaul. Hermes must stop after every numbered phase and subphase, demonstrate what is ready, and wait for explicit approval before advancing. A completed implementation or passing tests are not approval.

**First action:** Read this document and the current local repository, then perform Phase 1 discovery. Do not start implementing the overhaul during discovery.

## Working agreement and approval checkpoints

At the end of each phase or subphase, provide:

1. What was delivered, with a way for Shawn to open or try it.
2. What was reused, changed, and added.
3. Validation results and any remaining limitations.
4. The specific items Shawn should review.
5. A direct request to approve that phase or request revisions.

Then stop. Do not interpret silence, an unrelated reply, or a factual answer as permission to advance. Resolve requested revisions and demonstrate the result again. Proceed only when Shawn explicitly approves the completed phase or authorizes a specific change to the plan.

Mockup approval authorizes implementation of that design; it does not approve the later implementation automatically. Stop between mockups and development even if the next step appears obvious. Also check in during a phase when a consequential unanswered decision changes scope or behavior.

Keep questions focused and grouped. Investigate the code and available state before asking Shawn to supply information already present there. Explain findings plainly and provide exact launch steps when necessary during development.

## Existing system and source of truth

### Current locations

| Item | Current location |
| --- | --- |
| Canonical local repository | `F:\[VIDEOS]\retro-tv-cart-builder` |
| Current builds | `F:\[VIDEOS]\Retro TV Builds` |
| Source television media | `F:\[VIDEOS]\TV` |
| Commercial and branding sources | `F:\[VIDEOS]\Commercials` |
| Derived composites used so far | `F:\[VIDEOS]\TV\_RetroTV_Composites` |
| Persistent project state | Repository `STATE` directory and referenced curation files |
| Public repository | <https://github.com/ToastSweat/retro-tv-cart-builder> |
| Baseline Studio version | v1.8.2, with subsequent local patches |

The live local files and state are authoritative. The uploaded archive and public repository may predate the latest patches. Inventory the installed behavior before modifying it.

Some scripts still contain the historical default `F:\[VIDEOS]\Retro TV Cart Builder`. Explicitly resolve paths through project settings. In PowerShell, use `-LiteralPath` for filesystem operations because `[VIDEOS]` contains wildcard characters.

### Important existing files

Inspect these and their dependencies during discovery:

- `STATE\settings.json`
- `STATE\asset-registry.csv`
- `STATE\assignments.csv`
- `STATE\cart-registry.csv`
- `STATE\handpicked-branding.csv` and `handpicked-episodes.csv`
- `STATE\studio-drafts\`
- `TOOLKIT\Initialize-RetroCartLibrary.ps1`
- `TOOLKIT\New-RetroCartPlan.ps1`
- `TOOLKIT\Build-RetroCartComposite.ps1`
- `TOOLKIT\Build-RetroCartReview.ps1`
- `TOOLKIT\Build-RetroCartFinal.ps1`
- `TOOLKIT\Start-RetroCartStudio.ps1`
- `TOOLKIT\studio\server.js` and `index.html`
- `TOOLKIT\config\` and its composite recipes
- Current documentation, backups, and installed hotfixes

State also depends on curation CSVs referenced by settings, including files under `Commercials\_CURATION_BACKUPS`. Do not assume copying `STATE` alone captures every editable source of metadata. Trace which files are authoritative and how refreshes propagate decisions.

### Functionality to reuse and protect

| Existing capability | Direction for the overhaul |
| --- | --- |
| Media registry and curation imports | Expose through Library Manager and reconcile existing metadata |
| AssetIDs, CartIDs, SlotIDs, assignments, immutable revisions | Preserve identity and history; hide routine mechanics from normal users |
| Config-based planning and media pools | Put behind Cart Builder templates and settings |
| Composite generation | Integrate automatic preparation, progress, and validation |
| Revision-specific autosaved Studio drafts | Preserve review continuity and recovery |
| GOOD + NEXT, replacements, trims, audio repair | Retain in TV Studio with better interaction design |
| Visual crop/reframe and exact final crop preview | Preserve geometry and restore editing responsiveness |
| Review proxies and continuous Full Review | Reuse preparation pipeline; continuous viewing is optional |
| Final build, reuse of valid FINAL, USB copy | Retain validation and make the user flow straightforward |

Existing source-health statuses include `READY`, `UNREVIEWED`, `EXCLUDED`, `BAD_QUALITY`, `BAD_AUDIO`, `NEEDS_CLIPPED`, `NEEDS_CROP`, and `DUPLICATE`. Review actions also include `GOOD`, `REPLACE_THIS_CART`, `WRONG_ERA`, and `WRONG_NETWORK`. Inventory the complete implementation; source health and a cart-specific review decision are different concepts.

Audio repair currently offers `NONE`, `RESTORE`, `STRONG`, `AGGRESSIVE`, and `MAX`. Each level must process the original source rather than repeatedly encoding an already repaired file.

### Recent fixes to account for

- Studio commercial replacements were expanded from kids-only to kids plus general commercials for the active CN carts, with a 2000–2002 range. Shawn confirmed the initial expansion worked.
- CN05 setup added opt-in multiple commercial pools and year bounds to planning, and extended the replacement expansion to CN05. Inspect the installed code rather than assuming identical scripts.
- A Direct FINAL patch was supplied to auto-save changed drafts, prepare required review media, and continue to FINAL/export. Confirm installation and actual behavior. Its user-facing intent is a requirement even if implementation needs refinement.
- Studio bumper replacements originally excluded `IDENT`. The filter was patched to allow idents in return-bumper slots; Shawn confirmed this worked.
- Planner selection still needs inspection: show-matched return bumper, then suitable show-matched short ident/branding, then genuinely generic network branding. Do not assume the Studio filter fix also fixed planning.
- A recent patch disabled editing controls while operations were busy. Shawn reported that crop edits could previously be applied before preview rendering finished and that this loss of responsiveness adds substantial time. Identify the exact cause; do not preserve that regression as intended behavior.

### Cart checkpoint

Nickelodeon carts, SNICK1, and earlier CN carts have been built during this project. CN03 was redesigned to feature Courage, Johnny Bravo, and Cow and Chicken; CN04 uses a different rotation of those shows. The latest reported activity moved from rendering CN04 to reviewing CN05.

CN05 contains The Flintstones, The Jetsons, Scooby-Doo, Where Are You!, and Looney Tunes. Shawn was replacing a generic/wrong-show transition before Jetsons when the missing IDENT choices were fixed.

Exact current revisions, completion states, USB deployments, and the identities of the remaining five carts must be confirmed from live state and Shawn. Do not infer completion from a historical revision number. Do not assume which roadmap carts “the last five” refers to.

## Product rules that apply to every phase

### Media ownership and storage

Register source media in place. Do not modify, move, or silently duplicate originals. Removing an item from the app means removing its reference, subject to dependency handling; it does not mean deleting the original file.

Derived proxies, crop frames, composites, and builds are app-managed outputs. Keep originals, metadata/recipes, and derived media distinguishable. A missing source should produce a clear **Missing source → Relink** workflow, not a destructive reset.

Repairs and edits should remain reproducible recipes wherever possible. Distinguish saving a recipe from rendering processed output. Explain when an operation creates a new file and where it goes.

### Broadcast construction

The goal is a believable period-flavored synthetic broadcast, not exact historical schedule reconstruction. Shows and episodes should fit the selected network and period. Prefer familiar rerun staples; when making claims about frequent airings, use actual broadcast records and distinguish evidence from popularity or inference. Never use fanmade schedules as historical evidence.

Network/block identity is functional: `NICK` and `SNICK` are distinct. Branding should match its position and surrounding shows. A “coming next” clip announcing another show is not interchangeable with a generic ident.

Commercial years, show/episode availability dates, and branding years can affect eligibility. Do not apply one field's date rule to unrelated media accidentally. Unknown dates need an explicit policy, not silent guesses.

### Review and export

**GOOD + NEXT is the human approval workflow.** Once all clips are approved, the user should be able to build locally or export to the selected USB drive directly.

Auto-save/commit internally when needed. Preserve immutable history without requiring the user to press “next revision.” Generate whatever proxies or intermediate manifests the existing finalizer requires automatically. Full Review playback is optional; it must not become a mandatory second viewing of an already reviewed cart.

If a clip changes, invalidate only affected derived work and recompute readiness. Do not silently approve a replacement or changed recipe. Do not create needless revisions when nothing changed.

Retain the established output target: H.264, 618×480, 30 fps, yuv420p, AAC stereo at 44.1 kHz. Preserve source SAR correction, proportional fitting, padding where required, and square-pixel output. Exact crop preview must agree with final rendering.

### Progress and recovery

Every long job needs a visible lifecycle: queued, running stage, current item, item count, useful progress where measurable, success, failure, and safe cancellation where supported. Do not show invented percentages or completion claims.

Prevent duplicate submissions immediately in the GUI and reject conflicting jobs server-side. Shared registries and output paths need appropriate locking across processes or instances, not only within one browser tab.

Editing a crop during a replaceable preview render is different from changing a cart during export. Support responsive editing with cancellation, queuing, or ignoring stale preview results. A stale render must not overwrite a newer recipe.

USB export requires deliberate drive selection and confirmation. Validate local output before copying or relabeling. Do not erase unrelated USB files. Report copy verification and completion accurately; do not claim a device is ejected unless the app actually performs and verifies ejection.

## Phase 1 Documentation handover and discovery

Read the repository, state model, installed patches, and relevant documentation. Demonstrate the current working workflow before proposing replacements.

Deliver a feature inventory showing **reuse unchanged**, **wrap in GUI**, **extend**, **repair**, and **new development**. Identify technical dependencies, authoritative metadata files, path assumptions, current regressions, and compatibility risks.

Discovery questions should cover:

- Which five carts are the immediate target, and which unfinished carts must remain usable?
- Preferred launch/install experience and supported Windows environment.
- Whether the supplied Direct FINAL patch is installed and behaves as intended.
- Project behavior: opening an existing project, creating a new project, and switching projects.
- Initial reuse defaults and what counts as a completed/deployed cart for historical reuse checks.
- Preferred layout and terminology for categories, required metadata, and notes.
- Handling edits, variants, composites, missing files, and dependent carts when assets are removed.

Propose architecture only after inspection. Explain why any framework or database change is necessary and its migration/rollback implications. CSV/JSON may remain if appropriate; SQLite is not a requirement.

**Acceptance:** Shawn agrees with the discovered baseline, scope, answers, and implementation approach. **Stop for approval.**

## Phase 1.1 First-time setup and project settings

Create a clear setup GUI that supports selecting an existing project as well as creating a new one. Explain every location in plain language.

| Location | Purpose |
| --- | --- |
| Project data folder | Settings, metadata, tags, recipes, assignments, cart definitions, drafts, and history |
| Composite video folder | Generated show blocks assembled from multiple source files |
| Builds folder | Cart build outputs and export-ready files |
| Library folders | One or more existing source-media locations registered in place |

Determine where caches and temporary processing files belong and expose a sensible policy. Keep the application installation separate from user-owned project data.

Paths must be changeable in app settings; additional library folders can be added later. Changing a setting does not authorize moving existing files. Show affected references and offer a deliberate relink or managed migration path with rollback when needed.

Validate permissions, missing directories, path overlap, and existing content. Do not initialize empty state over an existing project. Back up before importing or migrating data and report compatibility issues.

**Acceptance:** Setup opens/imports the existing project safely, explains directories, persists selections, supports later changes, and works after relaunch. **Stop for approval.**

## Phase 2 Main hub and workspace navigation

After setup and on subsequent launches, open a main workspace with three clear destinations:

- Library Manager
- Cart Builder
- TV Studio

Provide easy return-to-hub navigation and accessible settings. Show the active project clearly. Preserve edits or explain any unsaved changes during navigation.

For this phase, build the application shell and workspace entry/return paths only. Do not develop the later modules ahead of their approval gates.

**Acceptance:** Shawn can enter each workspace, return to the hub, reopen settings, and identify the active project. **Stop for approval.**

## Phase 3 Library Manager scope

Library Manager organizes and prepares registered media for planning and review. Reuse the existing registry, categorization, source-health knowledge, and processing engine where possible.

Required scope:

- Add/register, scan, rescan, remove references, and relink library locations and assets.
- Browse, search, filter, sort, preview, and inspect media.
- Structured planning metadata: show/series, year or date/range, network/block, media category, subtype, pool membership, and relationships between episode parts.
- Notes and descriptive tags: product, mood, personal observations, uncertainty, and other review aids.
- Established categories and subtypes, including episode/show material, commercials, IDENT, PROMO, INTRO, BUMPER_IN, BUMPER_OUT, BUMPER_GENERIC, TRANSITION, NEXT, SIGN_OFF, MUSIC_VIDEO, and OTHER, mapped to the actual schema discovered in Phase 1.
- Trim/clip, crop/reframe, audio repair, preview, preprocessing, and composite grouping through GUI controls.
- Mark unusable, excluded, duplicate, or needing repair without deleting sources. Show the reason and permit explicit re-review.
- Show readiness and dependencies: where an asset is used/reserved and which carts would be affected by changes.

**Hard metadata drives selection. Soft tags/notes help the human reviewer.** A known year used for filtering belongs in structured metadata; “year uncertain” can be a note with provenance. Do not create contradictory duplicate year fields, and do not let a casual note silently change planning eligibility.

### Phase 3.1 Library Manager layout mockup

Create a navigable layout mockup covering every scoped tool, including properties, preview/editing, category/tag assignment, source health, processing jobs, and dependency handling. Include representative populated, empty, missing-source, busy, and error states.

Identify mock-only controls honestly. Demonstrate the main tasks and collect revisions.

**Acceptance:** Shawn approves the layout and workflows with no remaining requested design revisions. **Stop before development.**

### Phase 3.2 Library Manager implementation

Implement the approved design against actual project data and existing processing functions. Ensure decisions survive rescans, refreshes, navigation, and relaunch. Protect against duplicate registration and metadata loss.

Demonstrate a full path from registering media through categorizing, tagging, previewing, saving a repair, and making an eligible asset available to planning. Also demonstrate exclusion, relinking, and safe removal of a referenced asset.

**Acceptance:** Shawn tests the implementation, requested revisions are resolved, and the workspace is approved. **Stop for approval.**

## Phase 4 Cart Builder

### Phase 4.1 Cart Builder layout mockup

Design a visual cart shelf using VHS-style icons/cards. Support indexing, searching, and sorting by cart number/ID, network, and name. Show readiness/status clearly.

Include creating, updating, duplicating, archiving/removing carts; choosing a template and pools; arranging a sequence; inspecting eligibility and reuse conflicts; and opening a cart in TV Studio. Show an editable timeline or equivalent sequence editor.

Template example: opening ident → show A intro → show A → commercial → show B intro → show B → commercial → repeating blocks → sign-off. Allow explicit assets and automatic selection from eligible pools. Support composite show blocks without requiring command-line preparation.

Show template/network defaults and per-cart overrides, including repeat rules. Do not replace existing reviewed carts merely because a template changes.

**Acceptance:** Shawn approves the complete mockup and task flows. **Stop before development.**

### Phase 4.2 Cart Builder implementation

Implement the approved cart shelf, template editor, lifecycle actions, and planner integration.

For episodes/shows, commercials, bumpers, and idents independently, support policies equivalent to:

| Policy | Meaning |
| --- | --- |
| Repeats allowed | Reuse is permitted subject to other eligibility rules |
| Unique within cart | Do not repeat that asset inside this cart |
| Unique across network | Also exclude uses in other carts for this network/block |
| Unique across project | Also exclude uses throughout the project |

Make precedence between project, network, template, and cart settings visible. Clarify in Phase 1 how historical uses, active reservations, archived carts, variants of the same source, and composite constituent episodes affect uniqueness. Do not count immutable revisions as separate broadcast carts accidentally.

If the pool is exhausted, show which rule excludes the candidates and let Shawn choose how to proceed. Never silently repeat or broaden eligibility. Preview the impact of changing policies without erasing assignment history.

Replacing or removing a cart must reconcile reservations deliberately while preserving history and unrelated carts. Explain whether “remove” archives the cart, deletes generated output, or removes its reference; these are separate actions.

**Acceptance:** Generate an eligible cart entirely through the GUI, demonstrate reuse settings and exhaustion handling, confirm accurate reservations, and hand it to Studio without commands. Resolve revisions and **stop for approval**.

## Phase 5 TV Studio

### Phase 5.1 TV Studio layout mockup

Start with the existing workbench and workflows. Improve clarity, responsiveness, and status feedback rather than discarding working review tools.

Show clip navigation, GOOD + NEXT, replacement selection, trim, crop with exact final preview, audio processing, readiness, jobs, local builds, optional Full Review, and USB export. Surface show-matched replacements and explain unavailable choices.

The primary completion path is **approve clips → build/export**. Internal saves and revisions should be understandable when inspected but not mandatory manual steps. Include cancellation/failure/retry and crop-during-preview interaction in the mockup.

**Acceptance:** Shawn approves the design and intended behavior. **Stop before development.**

### Phase 5.2 TV Studio implementation

Implement the approved design using the proven review/render/finalize components. Preserve drafts, repairs, assignments, output geometry, and finalizer validation.

Restore the ability to set/apply crop while a preview is rendering. Ignore stale render results or cancel superseded jobs safely. Add genuine lifecycle feedback and conflict prevention without freezing unrelated work unnecessarily.

A valid, unchanged reviewed cart should build/export directly. A changed approved draft should save internally, prepare required media, then continue automatically. Review-movie playback remains optional. Failures must preserve review work and expose a useful next action.

**Acceptance:** Complete real review, repair, replacement, local build, and selected-drive export tasks. Verify pending edits, duplicates, stale previews, and failed jobs recover correctly. Resolve requested revisions and **stop for approval**.

## Phase 6.1 User acceptance testing and final approval

Agree on a practical UAT checklist with Shawn. Use representative real media and the remaining carts without sacrificing the existing project as test data.

Cover first-run/import, relaunch, library metadata persistence, categories and tags, source exclusion/relinking, composite generation, templates and reservations, all repeat scopes, review continuity, crop responsiveness, audio repairs, optional Full Review, direct FINAL, and deliberate USB deployment.

Exercise regression cases from this project: bracketed paths; missing registry entries despite existing manifests; unavailable sign-offs; unreviewed branding; IDENT replacement visibility; wrong-show branding; AVI timestamp/decode failures; unequal source SAR; duplicate build clicks; stale caches; and preservation of unrelated USB files.

Record results and issues. Resolve blockers and Shawn's requested revisions, retest affected behavior, and demonstrate the end-to-end workflow. Confirm practical playback on the actual television before declaring hardware compatibility verified.

**Acceptance:** Shawn explicitly provides final product approval. **Stop before deployment.**

## Phase 6.2 Documentation and deployment

Prepare installation/update instructions, setup guide, user guide for all three workspaces, settings and reuse-policy reference, backup/restore guidance, troubleshooting, and release notes. Update repository architecture/state documentation to match the shipped system.

Package a reproducible release with prerequisites, migration behavior, known limitations, and rollback instructions. Do not hide required manual steps in developer notes while claiming command-free normal operation.

Present the concrete release package and deployment steps for approval before replacing the working installation. After deployment is authorized, back up current code and project data, apply only the approved changes, and verify launch, project loading, and representative workflows.

**Acceptance:** Shawn can launch the deployed app, open the existing project, and continue the remaining carts. Provide final documentation, verification results, and any explicitly accepted limitations. Stop for the closing check-in.

## Avoid these shortcuts

Do not delete `STATE`, reset all source statuses, wipe caches without diagnosis, overwrite source media, rebuild all composites unnecessarily, or create another cart/revision as a generic error fix.

Do not require a second human viewing after GOOD + NEXT. Do not leave normal library/cart tasks as command snippets. Do not rebuild proven components merely to match a new GUI framework. Do not assume a downloaded release shares the properties of another release with the same episode titles.

Preserve the working engine, make its capabilities accessible, add the missing management tools, and prove each phase with the owner before proceeding.
