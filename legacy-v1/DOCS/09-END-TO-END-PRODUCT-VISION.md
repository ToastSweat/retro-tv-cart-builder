# Retro TV Cart Builder — End-to-End Product Vision

This is the intended future product experience for somebody who knows the bare
minimum about media files and does not want to live in PowerShell.

The current scripts/Studio are the engine and proving ground.

## Product principle

The application should feel like a **catalog + channel builder**, not like a
media importer.

Source media stays where the user already stores it.

The app indexes it.

## 1. Install

Long-term target:

```text
download installer
→ install
→ launch Retro TV Cart Studio
```

The user should not need to manually understand:

- PowerShell execution policy
- Node.js command lines
- FFmpeg command syntax
- CSV schemas
- JSON cart configs
- internal AssetIDs

Advanced users can still access diagnostics and engine tools.

## 2. Register media locations

The UI should offer:

```text
ADD MEDIA LOCATION
```

Examples:

```text
D:\TV
D:\Commercials
E:\Broadcast Archive
```

This does **not** copy files into the application.

Store:

- absolute path
- file metadata
- hash/fingerprint where useful
- probe metadata
- source health
- tags/classification

If a file disappears:

```text
MISSING SOURCE
```

and offer:

```text
RELINK
```

## 3. Library / Inbox

Newly discovered material appears in an Inbox for classification.

The user can identify:

```text
Episode
Commercial
Branding
Other / Ignore
```

Bulk operations are essential.

Example:

```text
select 80 commercials
→ 1990s
→ Kids
→ General rotation
```

The user should not need to classify every technical field individually.

## 4. Shows

Shows should become first-class entities.

Example:

```text
Show: Ren & Stimpy
Aliases:
  Ren and Stimpy
  Ren & Stimpy Show
Episodes:
  ...
```

This separates the idea of a show from a filename.

Episodes can be assigned to a show and ordered/sequenced.

Multi-part episode groups should be visual.

If two or three source shorts should behave as one broadcast block, Studio can
generate a derived composite automatically.

The user should not need to run the composite utility manually.

## 5. Commercial pools

Commercials should support reusable user-facing tags/pools such as:

```text
90s Kids
2000s Kids
General 90s
Late Night
PSA
Holiday
Food
Toys
Games
```

A channel can select one or more commercial pools.

Advanced rules can later include:

- era ranges
- category balance
- reuse cooldown
- no exact repeat
- brand frequency
- target break length

## 6. Branding pools / channel identity

A normal user should not have to understand internal archive roles.

They should be able to create:

```text
Branding Pool: SNICK
```

and tag clips as belonging to it.

Internally, the system may know roles such as:

```text
IDENT
INTRO
PROMO
BUMPER_IN
BUMPER_OUT
BUMPER_GENERIC
TRANSITION
NEXT
SIGN_OFF
```

but the default channel editor should be higher level.

For example:

```text
Channel: SNICK
Branding Pool: SNICK
```

Then the builder automatically chooses:

- opening/identity
- between-show branding
- matched return bumpers
- closing/sign-off

Advanced Mode can pin a specific opening/sign-off or expose the raw role model.

## 7. Channel / block editor

Creating a channel or programming block should look like:

```text
Name: SNICK
Branding: SNICK
Allowed Shows:
  Are You Afraid of the Dark?
  Ren & Stimpy

Commercial Pools:
  90s Kids

Break Style:
  Lean

Ads Per Break:
  1

Prefer show-matched branding:
  Yes

Opening:
  Auto

Sign-off:
  Auto
```

No JSON required.

Network/block identity must remain exact enough that:

```text
NICK != SNICK
```

when their branding pools differ.

## 8. Build a broadcast

The user chooses a target:

```text
channel/block
duration or episode count
target cartridge size
```

Studio generates a proposed timeline.

The timeline should be directly editable:

- drag shows
- lock a show
- regenerate one break
- replace one commercial
- replace one bumper
- regenerate everything unlocked

The builder should continue honoring:

- UNIQUE assets
- source health
- compatibility
- show matching
- branding pools
- commercial pools
- reuse rules

## 9. Review / repair

Keep the current successful Studio model.

Simple Mode:

```text
looks good
replace
crop/reframe
fix audio
trim
```

Advanced Mode may expose:

```text
AssetID
source status
exact crop pixels
codec/probe information
repair level
tags
raw role
cache identity
```

The source is never destructively edited.

## 10. Full QC

Full Review should become the actual finish line.

Show:

```text
continuous broadcast
timeline
clip boundaries
current show/break
relative volume
build status
approval state
```

It should not look like a second repair workbench.

From here:

```text
APPROVE
→ EXPORT TO USB
```

## 11. Export

The ideal final action:

```text
EXPORT TO USB
```

Flow:

```text
select drive
→ verify drive identity
→ verify capacity
→ build/reuse FINAL
→ label drive
→ copy
→ verify output
→ SAFE TO EJECT
```

Long actions need visible progress and a job lock.

A double-click must never start a second build.

## 12. Source vs derived ownership

This should be visible in the product.

### SOURCE MEDIA

```text
owned by user
indexed in place
never modified
never moved
never silently duplicated
```

### DERIVED MEDIA

```text
owned by Studio
previews
cache
composites
review movies
final cartridge files
```

Studio may delete/regenerate derived media when safe.

## 13. State model

The current CSV/JSON state is excellent for development and debugging.

A mature app will probably benefit from SQLite for relational state while still
exporting human-readable manifests.

Candidate entities:

```text
MediaLocation
Asset
Show
Episode
EpisodePart
Commercial
BrandingAsset
Tag
Network
Block
CommercialPool
BrandingPool
Cart
Revision
Slot
Assignment
RepairRecipe
BuildJob
```

Do not migrate merely because SQLite is fashionable.

Migrate when the UI/data relationships actually justify it, and preserve an
upgrade path from existing durable state.

## 14. Simple Mode vs Advanced Mode

### Simple Mode

For normal users:

```text
Add folder
Tag media
Create show
Create channel
Build
Review
Export
```

### Advanced Mode

For development/power users:

- exact asset metadata
- raw taxonomy
- manual repair values
- cache controls
- diagnostic logs
- revision/state inspection
- explicit source-health tools

The same engine should serve both.

## 15. Development strategy

Do not stop the current 20-cart build to rewrite everything now.

Use the cart plan to discover requirements.

Every real failure is useful evidence.

Then productize behavior that has survived real use.
