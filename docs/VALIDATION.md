# Preferred choices validation — 2026-11-08

25 automated tests passed on Node 24.22.1: existing project/organization/cart/template tests, two DOM scenarios with actual persistence and mocked desktop bridge, plus preferred-choice migration, ordering, matching/fallback/exclusions/replacement pool, and invalid choice refusal.

Schema-1 file was read without mutation, stable IDs retained; later save wrote schema 2 and exact original was preserved in metadata snapshot. No project or library file rewrite during read.

Main, preload, plans and renderer syntax checked. Package and lock versions match alpha.4, dependencies unchanged. No native Windows execution or visual check claimed for this refinement.

Generation and Studio are not implemented yet. Candidate policy helpers are tested primitives; full usage/quality matching integrations remain future work. Run npm ci and npm test from v2 to repeat tests.
