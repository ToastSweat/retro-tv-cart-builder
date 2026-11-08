## 9. Owner decisions needed before Phase 1 acceptance

### A. Immediate carts and baseline exceptions

- Q: Which **five exact CartIDs** are the immediate targets? The old roadmap has ten possibilities listed in section 2; different IDs are also possible.
- A: KWB1, KWB2, FOX1, POWER1, BOOM1, BOOM2, SCIFI1, UPN1, HBO1, AMC1.

- Q: Which existing unfinished/legacy carts must stay immediately usable? Recommendation: preserve every current cart/history, leave abandoned SNICK clearly labeled, and diagnose NICK01 separately without auto-changing approvals.
- A: I dont mind remaking the carts if needed, it's a nice to have to preserve the history.

- Q: Which locally built carts have actually been copied and played successfully on the TV? Is CN05 now finished from your perspective?
- A: the first 10. NICK1-4, SNICK1, CN1-5. CN5 was jsut built, ChatGPT must have given you stale information.

- Q: Have you personally used Direct FINAL successfully after the patch, or still encountered manual save/preparation steps? Code installation and controlled orchestration checks do not answer that.
- A: After the FInal build patch thigns have been working as expected.

### B. Launch and project behavior

- Q: Is this Windows 11 PC the only initial target, or are portable installs/other Windows machines required? Prefer installed shortcut or portable folder/launcher?
- A: Windows 11 only is fine. the plan is to publish this on github so other people can use it, not just me, but we'ren ot using linix or mac, thats unnessisary complexity.

- Q: Recommendation: separate app install from project data; open the last project on relaunch, offer Open Existing/Create New, and expose explicit Switch Project without moving sources. Is that the intended behavior?
- A: That is correct, that is the intended behaviour. THank you for inferring the gap.

- Q: Recommendation: active processing prevents switching that project until a job completes or is safely canceled; preview work alone should not freeze unrelated editing.
- A: I approve.

### C. Reuse defaults and historical meaning

- Q: Recommendation for the first import: preserve all existing active uses; episodes/commercials default unique across project, branding reusable across carts with no repeated selection within a cart unless explicitly allowed. New controls can override per media class/scope.
- A: Yes, if possible preserve and import my existing carts so we can use them as references

- Q: Should built-but-not-deployed and archived built carts count as historical use? Recommendation: distinguish reserved, locally built, copy-verified and TV-confirmed states; built history counts unless deliberately released by the owner. Immutable revisions must not count as separate carts.
- A: built-but-not-deployed should count, archived should not. but you could also add a setting for this behaviour, and default as I described.

- Q: Should different encodes/repairs of the same original and episodes inside composites count as the same underlying use? Recommendation: yes, using explicit source-family/constituent relationships, not guessed filenames.
- A: yes

### D. Library terminology, metadata and dates

- Q: Recommendation: broad Episode/Show, Commercial, Branding, Other groups with the existing subtype vocabulary underneath; structured show/network/block/year/pool metadata separated from descriptive tags and human notes.
- A: yes

- Q: What labels or required fields differ from this preference? The current schema also has ARCHIVE_MISC and MAYBE; mapping must be visible and reversible.
- A: maybe none, i think i had specified that the user could enter notes to act as 'soft tags', basically notes that would be seen in the media library and in the tv studio when an Episode/Show or Commercial was beign reviewed. Eg We have a commercial, it is named AD - 004 Snapple, but the content of the commercial is snoop dog having a snapple on the moon. i might want to add notes like snoop dogg, moon, soft drink . i hope this clarifies otherwise please explicitly ask.

- Q: Recommendation: an unknown date fails a hard date filter unless the owner explicitly allows unknowns for that particular rule. Do not silently invent dates or apply ad bounds to branding/episodes. Approve or revise this policy.
- A: yes, data should not be inferred ever.

### E. Edits, variants, missing sources and removal

- Q: Recommendation: repairs save non-destructive recipes; optional rendered variants remain linked to originals and their recipes. Composites retain explicit ordered constituents and freshness checks.
- A: yes

- Q: Recommendation: a missing asset retains identity and offers Relink; reference removal shows dependent carts and blocks or archives intentionally, never deletes originals. Recipe/source changes require reapproval only where effective reviewed output changes.
- A: yes

- Q: Should dependent reviewed/built carts stay pinned to their existing recipe unless deliberately updated? Recommendation: yes; show the impact rather than propagating edits silently.
- A: yes; show the impact rather than propagating edits silently.

### User Notes
 - I just want to make it expressly said that the point of this is to create a reuable app, not just for me, but for any other human user. Any person with sufficient skill and these files, should be able to use this program. It should not be dependant off of any knowledge or files I have, it should be functional and self contained. Migration of the old carts into the new system is appreciated but I jsut want to call out that this will be a one time functuion and not something any other user will need to do, just me.