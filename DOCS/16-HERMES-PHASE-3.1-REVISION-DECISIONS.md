# Phase 3.1 revision decisions

**Status:** these decisions are incorporated in the revised Phase 3.1 mockup, which Shawn approved with **"approved"**. See [17 — approved revised checkpoint and subsequent implementation authorization](17-HERMES-PHASE-3.1-REVISED-MOCKUP-CHECKPOINT.md). Shawn subsequently authorized Phase 3.2 with **"yes, pelase proceede"**; implementation is underway, with its own acceptance checkpoint still required.

Source: [15-USER-PHASE-3.1-LIBRARY-MOCKUP-FEEDBACK.md](15-USER-PHASE-3.1-LIBRARY-MOCKUP-FEEDBACK.md) and the owner's subsequent clarification answers. The owner's feedback file is not edited.

## Overall application arrangement

The three internal Library Manager columns were Hermes's design choice, not an explicit owner request. The owner confirmed the intended overall surface:

> Library Manager, Cart Builder and TV Studio visible together as resizable areas, with an option to expand one.

The revised mockup must show that combined surface, with expand/restore and accessible resizing. Cart Builder and TV Studio remain clearly marked placeholders: their actual layouts/tools are not authorized ahead of their numbered design phases. Library Manager's internal arrangement may adapt for a compact pane and its expanded view; usability takes priority over retaining the original three internal columns.

The proposed final normal flow is first-time setup → combined workspace, and later launch → saved project's combined workspace. Setup is not repeated each launch, and there is no mandatory workspace entry page before the actual workspace. During approval-gated development the existing live hub/setup remains available; its design link should open the revised mockup directly instead of requiring the Library Manager placeholder page first. This is still mockup review, not a live integration of unimplemented modules.

## Category-specific classifications

The owner confirmed:

> Allow multiple category-specific flags/classifications; Normal means no special episode flags.

- Episode/Show examples: Normal, Crossover, Holiday, Multipart; allow overlapping special flags rather than forcing a mutually exclusive choice. Normal means an empty special-flag selection.
- Commercial examples: Video Game, Toy, Food, Restaurant, Music, Movie, TV, Store; permit multiple explicit subject classifications where applicable.
- Branding retains one explicit primary broadcast role from the established subtype vocabulary, including IDENT, PROMO, INTRO, BUMPER_IN/OUT/GENERIC, TRANSITION, NEXT, SIGN_OFF, MUSIC_VIDEO and OTHER.
- Other starts with unclassified/miscellaneous and suitable non-branding types; provisional choices can be refined during design review.

Classification is structured, manually assigned metadata—not automatic extraction from filenames or notes. It remains separate from notes, network/block, dates, pool membership, source health and cart approval. Legacy Subtype and existing identifiers must not be silently rewritten; later implementation needs a reviewed compatibility mapping.

## Selection pools

A pool is a set of clips Cart Builder may draw from, not the clip's subject or an automatic permission to ignore eligibility rules. Existing CN05 config explicitly selects KIDS_00S and GENERAL_00S with separate 2000–2002 ad-year bounds.

The owner confirmed:

> Yes—allow multiple pool memberships and rename/explain the field clearly.

Use **Selection pools** with clear nearby copy explaining what membership does. A commercial may have Restaurant/Food classifications while belonging to multiple explicitly chosen selection pools. Dates, network/block eligibility and repeat rules remain independent. Do not infer membership from notes or classifications.

The legacy registry's Pool column is scalar. Multi-membership is an approved design extension, not a completed CSV/JSON migration; retain original provenance and decide the compatible storage/write path during Phase 3.2, after the design is approved.

## Network/block definitions

The final reusable app must not be permanently limited to the mockup's fixed NICK/SNICK/CN list. Add a project-level management flow to the revised design:

- Add definitions and edit human-readable names; distinguish network/block identity.
- Preserve stable referenced identities; changing a display name must not rewrite history.
- Show affected assets/cart references before removal. Archive hides a definition from future choices while retaining existing references; delete is blocked until dependencies are resolved.
- Keep NICK and SNICK functionally distinct even when a block has a parent network.

These controls remain illustrative/in-memory in Phase 3.1. No actual network metadata or saved carts are changed by the design revision.

## Review and scope boundary

The owner accepted the prominence of notes/health/relink/dependency impact, the separation of metadata/recipes/variants/cart approval, and the representative states/recovery paths. Preserve those strengths while reducing unnecessary navigation and explaining classification/pools.

Revise and demonstrate the mockup, answer any remaining questions, and resubmit for explicit Phase 3.1 approval. A working prototype or passing tests does not authorize Phase 3.2.
