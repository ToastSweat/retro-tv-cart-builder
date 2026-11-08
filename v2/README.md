# Retro TV Cart Builder v2 — Preferred Choices

Close v2. Extract this package into F:\[WORKSPACE]\retro-tv-cart-builder, replacing matching v2/docs files, then launch v2/Start-RetroTV.cmd. Existing projects and legacy-v1 are not replaced by this package.

Open Carts & Templates → Templates → edit a template. Each slot has Preferred choices. First choice is preferred; Add alternative adds a fallback. Arrow controls reorder choices or whole slots. Every choice can have its own clip type and show number where relevant. One slot produces one selected clip in future generation, not all its alternatives.

Examples: Coming up next (Show 2) → Bumper in; Promo → Commercial. The same allowed types will control future Studio replacements, with availability/repeat/quality checks retained.

Open a cart to see Prefer/Fallback/Then in sequence preview. Existing single-type slots become one-choice slots automatically. No episode/commercial selection or rendering implemented yet.

Planning schema upgrades from 1 to 2 in memory; first save writes new format and snapshots previous metadata inside project data. Old alpha.3 cannot read new planning files without restoring a previous matching snapshot. Source media untouched.

Node 22+ with npm. Same dependencies as previous package. npm ci then npm test runs all 25 tests. See docs/V2-HANDOFF.md for current implementation and next work.
