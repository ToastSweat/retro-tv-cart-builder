# Studio layout — alpha.14

Close all app windows. Extract this package into F:\[WORKSPACE]\retro-tv-cart-builder, replacing its v2 and docs files. Reopen the existing project and saved lineup. No regeneration required.

The Studio now uses the window width: lineup on the left, video in the center, editing controls on the right. The video and review actions stay visible while the right panel scrolls independently. Good + next, Save edits, navigation and replacements are beneath the video; trim, crop, audio repair, preview controls and notes are on the right. Smaller windows place the lineup above the player; narrow windows stack the controls below it.

No changes to processing, preset filters, trim semantics, approval/reservations, source media, saved lineups or project data. The existing V1 controls and preview restart behavior from alpha.13 are retained. Final build/export remains next.

Validation: all 68 automated checks pass. The DOM workflow additionally verifies three distinct Studio columns, video/review placement in the center, and trim/crop/audio controls in the right panel. Actual Windows visual review remains with the user.
