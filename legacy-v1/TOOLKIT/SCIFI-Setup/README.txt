SCIFI1 / SCIFI2 SETUP - existing Retro TV Cart Studio

Extract the SCIFI-Setup folder into:
F:\[VIDEOS]\retro-tv-cart-builder\TOOLKIT\SCIFI-Setup
Keep the three setup files together. Do not run New-RetroCartPlan afterward.

START WITH SCIFI1
1. Close Studio and let any other builds finish before creation.
2. Preview (does not write state or reserve assets):

$root = 'F:\[VIDEOS]\retro-tv-cart-builder'
$setup = "$root\TOOLKIT\SCIFI-Setup"
& "$setup\Prepare-SCIFI.ps1" -CartID SCIFI1 -SystemRoot $root -CheckOnly

3. If preflight succeeds, create the cart:

& "$setup\Prepare-SCIFI.ps1" -CartID SCIFI1 -SystemRoot $root

4. Open the existing pinned launcher and select SCIFI1 in Studio.
Review shows and commercials normally. Branding was approved in chat;
crop/audio controls remain available. The x5zJY4jydcQ ident in SCIFI2 is rough
and still needs Studio cleanup. No repair settings are invented by this setup.

SCIFI2 LATER
Use the same preview and creation commands with -CartID SCIFI2.
Only the specified cart is created. Future SCIFI2 selections are documented,
not reserved while SCIFI1 is created. Each creation audits live current/FINAL
manifests and ACTIVE/RESERVED assignments, so it stops if its selections have
become occupied. It refuses existing carts instead of making extra revisions.

WHAT IT DOES
- Twelve full episodes per cart, alternating six TOS and six original Twilight Zone.
- Eleven different initial commercial choices per cart. Every existing commercial
  pool is included in CommercialPools. Only READY, available files may be selected.
  Initial choices are placeholders for human selection in Studio, not a claim
  that every ad suits Sci-Fi. BAD/NEEDS_* flags are not relaxed.
- Five approved branding clips for SCIFI1; four for SCIFI2. No branding repeats.
  Some episode transitions have only commercials; no duplicated filler is added.
- Probes selected media for duration, video and audio. Reports total source runtime.
  Expect roughly 7.5 hours plus breaks per cart; actual duration depends on files.
  No new composites, full decode checks, or video encodes are performed here.
- Shows and ads are UNREVIEWED. Approved branding is GOOD with neutral crop/audio.
- Registers selected episodes and branding in durable handpicked files and the
  registry, writes config/manifest, and reserves all selected assets.
- Creates HOTFIXES backups before writes, checks state hashes for concurrent changes,
  and attempts rollback if a write fails. Keep the backup until cart completion.

REPEAT CHECK LIMITS
Checks IDs, source paths, normalized filenames, TOS titles and Twilight Zone
season/episode identity, plus composite parts from existing recipes. It does
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
