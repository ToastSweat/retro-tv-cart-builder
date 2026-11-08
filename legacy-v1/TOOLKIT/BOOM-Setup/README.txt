AUDIENCE CORRECTION (current package)
If BOOM1 already exists, DO NOT rerun preparation for BOOM1. Close Studio and use:
$setup = 'F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\BOOM-Setup'
& "$setup\Fix-BOOM-Audience.ps1" -CartID BOOM1
This is a read-only preview. Then apply:
& "$setup\Fix-BOOM-Audience.ps1" -CartID BOOM1 -Apply

The fix replaces all 11 ads with unused READY GENERAL_00S selections from the curated general-audience list. It retains the existing Now Showing clips and removes the two redundant preceding NEXT clips. Unchanged manifest rows and their Studio draft entries retain review/crop/audio/notes. Only replaced ad entries are reset. Existing r001 is updated in place, with backups; no new revision, encoding or show composite rebuild. Close Studio first; restart afterward. Only unbuilt DRAFT carts are accepted. An already recorded correction is refused to prevent accidental repeated replacement. Preview may choose different ads if other carts are edited between preview and apply; apply prints its chosen list too.

BOOM2 preparation below now uses only GENERAL_00S and one introduction per show group. Both fresh carts now have 40 clips (12 shows, 11 ads, 17 branding clips).

BOOM1 / BOOM2 setup for the EXISTING Studio

Extract the BOOM-Setup folder into F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT. Keep Prepare-BOOM.ps1 and both JSON files together. Do not replace the application or its settings.

Close Studio before running preparation. Start with BOOM1:

$setup = 'F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\BOOM-Setup'
& "$setup\Prepare-BOOM.ps1" -CartID BOOM1 -CheckOnly
& "$setup\Prepare-BOOM.ps1" -CartID BOOM1

After BOOM1 succeeds, prepare BOOM2:
& "$setup\Prepare-BOOM.ps1" -CartID BOOM2 -CheckOnly
& "$setup\Prepare-BOOM.ps1" -CartID BOOM2

If PowerShell asks whether to run a trusted downloaded script, choose R. Composite building also invokes your existing Build-RetroCartComposite.ps1 and can prompt. Encoding can take time. BOOM1 creates 3 Yogi composites; BOOM2 creates 9 composites (3 Tom and Jerry, 3 Looney Tunes, 3 Huckleberry Hound). Existing valid composite outputs may be reused by the existing builder.

The default paths are your current F:\[VIDEOS] locations. -SystemRoot, -TVRoot and -BrandingRoot can override them. The media backend paths are printed. Bundled ffmpeg 8.1 is preferred; detected ffmpeg 9 is refused due the prior crashes. Explicit -FFmpeg and -FFprobe paths can select your known-good pair.

CheckOnly probes sources and audits current and FINAL manifests plus active/reserved assignments; it writes nothing. Missing sources, ambiguous Looney matches, used media, or insufficient commercials stop preparation. Snapshot availability does not override the live repeat audit. If it stops, send the complete error rather than deleting state or forcing a revision.

Successful setup creates r001, config, composite recipes, reservations and durable handpicked records. Both fresh carts have 40 clips (12 shows, 11 ads, 17 approved branding). Ads are selected from the curated mixed list in order, skipping used or unavailable ones. BOOM2 sees BOOM1 reservations and chooses different ads.

Branding carries GOOD from your completed review. Shows and commercials remain UNREVIEWED. Open the carts using your existing PINNED Studio launcher, then review shows/ads and make crop/audio changes as usual. Preparation does not build final output or deploy USB.

Existing carts/configs are refused. Other cart rows are preserved. Backups are stored under HOTFIXES/<cart>-setup-<timestamp>. A failed setup attempts state rollback. Composite outputs may remain as reusable media; they are not automatically deleted. Keep the terminal error and backup path if rollback reports a problem. Prepare one cart at a time; a later BOOM2 failure does not undo a completed BOOM1.

The audit checks IDs, expanded composite source paths and normalized filename/episode keys. It does not visually identify re-encoded/renamed copies or match overlapping footage by content. Existing .ia.mp4 copies were not selected. All 37 branding files are distinct within the combined shortlist.

See LINEUPS.md for exact shows and research limits. See VALIDATION.txt for testing scope.
