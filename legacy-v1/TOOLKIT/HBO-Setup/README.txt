HBO1 / HBO2 SETUP - existing Retro TV Cart Studio

Extract the HBO-Setup folder into:
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\HBO-Setup
Keep Prepare-HBO.ps1 and both JSON files together. Do not run New-RetroCartPlan afterward.

START WITH HBO1
1. Close Studio and let any other builds finish before creation.
2. Preview (does not write state or reserve assets):

$root = 'F:\[VIDEOS]\retro-tv-cart-builder'
$setup = "$root\TOOLKIT\HBO-Setup"
& "$setup\Prepare-HBO.ps1" -CartID HBO1 -SystemRoot $root -CheckOnly

3. If preflight succeeds, create the cart:

& "$setup\Prepare-HBO.ps1" -CartID HBO1 -SystemRoot $root

4. Open the existing pinned launcher and select HBO1 in Studio.
Review shows and commercials normally. Branding was approved in chat;
crop/audio controls remain available. No repair settings are invented here.

HBO2 LATER
Use the same preview and creation commands with -CartID HBO2.
Only the specified cart is created. Future HBO2 selections are documented,
not reserved while HBO1 is created. Each creation audits live current/FINAL
manifests and ACTIVE/RESERVED assignments, so it stops if its selections have
become occupied. It refuses existing carts instead of making extra revisions.

WHAT IT DOES
- Twelve full episodes per cart, alternating six Spawn and six Tales from the Crypt.
  HBO1 uses Spawn S01E01-E06; HBO2 uses S02E01-E06, in order. Crypt picks differ.
- Eleven different initial commercial choices per cart. Every existing commercial
  pool is included in CommercialPools. Only READY, available files may be selected.
  LATE_NIGHT candidates are tried first, then other READY ads by title.
  Initial choices are placeholders for human selection in Studio, not a claim
  that every ad suits HBO. BAD/NEEDS_* flags are not relaxed.
- Four approved branding clips for HBO1; three for HBO2. No branding repeats.
  Some episode transitions have only commercials; no duplicated filler is added.
- Probes selected media for duration, video and audio. Reports total source runtime.
  Expect roughly 5-6 hours plus breaks per cart; actual duration depends on files.
  No new composites, full decode checks, or video encodes are performed here.
- Shows and ads are UNREVIEWED. Approved branding is GOOD with neutral crop/audio.
- Registers selected episodes and branding in durable handpicked files and the
  registry, writes config/manifest, and reserves all selected assets.
- Creates HOTFIXES backups before writes, checks state hashes for concurrent changes,
  and attempts rollback if a write fails. Keep the backup until cart completion.

REPEAT CHECK LIMITS
Checks IDs, source paths, normalized filenames, TOS titles, Twilight Zone
season/episode identity, Spawn codes, and Crypt codes in the selected filename formats, plus composite parts from existing recipes. It does
not visually fingerprint differently named/re-encoded copies. Check the existing
Studio repeat warnings when replacing assets. No earlier cart is modified.

RUNTIME
Prefers an installed bundled 8.1 FFmpeg runtime and paired ffprobe. Refuses
FFmpeg 9 because this installation previously had audio processing crashes.
Can override with explicit -FFmpeg and -FFprobe paths if necessary.
Do not replace the pinned Studio launcher or use a different FFmpeg for builds.

TROUBLESHOOTING
If PowerShell prompts whether to run a trusted setup script, choose R.
If a manifest/media file is missing or an asset is already used, preparation
stops; send the output. Do not delete old assignments or force reuse.
If the cart already exists, open that cart in Studio; do not rerun setup.

HOTLINE ADS - UPDATED
Before HBO1 preflight, extract the separately supplied HBO-Hotline-Clips folder
into F:\[VIDEOS]\Commercials. The following three files are required:
Hotline-01-Free-Lov.mp4
Hotline-02-200-Hott.mp4
Hotline-03.mp4

HBO1 places these in commercial breaks 1, 4, and 8, respectively, replacing
three automatically chosen ads. All three remain UNREVIEWED for playback/crop
checks in Studio. Their source registration uses stable AD IDs consistent with
the original 90s curation format. The script appends them to the active original
commercial-curation CSV and the registry, with backup/rollback coverage.
No full library rescan is needed; the original compilation stays NEEDS_CLIPPED.
HBO2 does not reuse these three ads. Other commercial slots remain selectable
from all existing pools under the same usage and quality exclusions.

HBO STYLE
These are personal remix carts with advertising between complete episodes.
The feature-presentation openings are used for atmosphere, not as a claim of
an exact historical broadcast. Promos come from different years. No fake
sign-offs or repeated bumpers are added just to fill space.

SIZE LIMIT
Uses your existing finalizer and pinned launcher. No renderer/finalizer files
are replaced, so the 3.9 GB local limit and 98% USB limit fixes remain intact.
