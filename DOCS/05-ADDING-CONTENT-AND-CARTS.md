# Retro TV Cart Builder — Adding Content and New Carts

> **Current-state note (2026-10-11):** Cart creation is still config-driven, but
> review/finalization is now Studio-first. Current canonical root is
> `F:\[VIDEOS]\retro-tv-cart-builder`. Multi-part show blocks can use
> `TOOLKIT\Build-RetroCartComposite.ps1`. See `00-CURRENT-CHECKPOINT.md` and
> `02-OPERATOR-GUIDE.md` before following older examples below.


The current system has several different content-ingestion paths. They are not yet unified behind one friendly `Add-Asset` command.

That is an important future cleanup target.

For now, use the path appropriate to the asset type.

## 1. Adding an episode

Episodes are registered from cart config JSON files.

They are **not** discovered by recursively scanning `F:\[VIDEOS]\TV`.

### Step 1: Put the episode in the TV archive

Example:

```text
F:\[VIDEOS]\TV\Some Show\Season 1\Some Show - S01E01.mp4
```

### Step 2: Add it to a cart config

Config files live in:

```text
F:\[VIDEOS]\Retro TV Cart Builder\Toolkit\config\
```

Episode object:

```json
{
  "Order": 1,
  "Series": "Some Show",
  "BrandingKeywords": [
    "Some Show",
    "SomeShow"
  ],
  "Title": "Some Show - S01E01 - Pilot",
  "SourcePath": "F:\\[VIDEOS]\\TV\\Some Show\\Season 1\\Some Show - S01E01 - Pilot.mp4"
}
```

`BrandingKeywords` matters.

Those aliases are used by the branding tag inference and planner to avoid placing show-specific branding beside the wrong show.

### Step 3: Refresh the registry

```powershell
.\Initialize-RetroCartLibrary.ps1
```

The initializer creates a stable `EP-...` AssetID from the episode SourcePath.

## 2. Adding one handpicked branding clip

For one-off bumpers/idents/sign-offs, use the helper.

Recommended handpicked tree:

```text
F:\[VIDEOS]\Commercials\Bumpers-Handpicked\Bumpers\
├── Nickelodeon\
├── SNICK\
├── FOX Kids\
├── Kids WB\
└── ...
```

The file must currently live somewhere under:

```text
F:\[VIDEOS]\Commercials
```

because the helper enforces that root for portability within the current project structure.

Example:

```powershell
.\Add-HandpickedBranding.ps1 `
    -Path 'F:\[VIDEOS]\Commercials\Bumpers-Handpicked\Bumpers\Nickelodeon\Some Nick Bumper.mp4' `
    -Network NICK `
    -Type IDENT `
    -Year 1998 `
    -Notes 'Generic short Nick ident'
```

Then:

```powershell
.\Initialize-RetroCartLibrary.ps1
```

The helper stores the one-off record in:

```text
STATE\handpicked-branding.csv
```

and gives it an `HBR-...` AssetID.

## 3. Adding a sign-off

Place the sign-off under the commercial root, then:

```powershell
.\Add-HandpickedBranding.ps1 `
    -Path 'F:\[VIDEOS]\Commercials\Bumpers-Handpicked\Bumpers\Nickelodeon\Nickelodeon Good Night Sign Off 1996.mp4' `
    -Network NICK `
    -Type SIGN_OFF `
    -CartID NICK01
```

Providing `-CartID` with `-Type SIGN_OFF` updates that cart's JSON with:

```json
"SignOffAssetID": "HBR-..."
```

Refresh:

```powershell
.\Initialize-RetroCartLibrary.ps1
```

### If the cart already exists and does not yet contain the sign-off

```powershell
.\Add-RetroCartSignOff.ps1 -CartID NICK01
```

That creates one new immutable revision with the current cart preserved and the sign-off appended.

Then:

```powershell
.\Build-RetroCartReview.ps1 -CartID NICK01
.\Open-RetroCart.ps1 -CartID NICK01
```

## 4. Adding a large batch of branding

The main branding library is currently driven by curated CSV output rather than a direct add-every-file helper.

Upstream tools preserved in this checkpoint include:

```text
CURATION_TOOLS\Scan-RetroBranding.ps1
CURATION_TOOLS\Build-BrandingReview.ps1
```

The general historical workflow was:

```text
scan archive
→ build review gallery
→ curate status/network/type
→ preserve branding-curation*.csv
→ run Initialize-RetroCartLibrary.ps1
```

The initializer reads the latest `branding-curation*.csv` from:

```text
F:\[VIDEOS]\Commercials\_CURATION_BACKUPS
```

Important curation fields consumed by the initializer include:

```text
Id
RootRelativePath
Status
Type
FileName
Network
DurationSeconds
SourceCollection
Notes
YearGuess
```

Typical status mapping:

```text
KEEP          -> READY
MAYBE         -> MAYBE
NEEDS_CLIPPED -> NEEDS_CLIPPED
SKIP          -> EXCLUDED
```

## 5. Adding commercials

There is not yet a polished single-commercial helper.

Commercials are currently imported from curated CSVs.

This is a known usability gap.

### 90s commercial curation

The initializer identifies the main 90s commercial curation as a `commercial-curation*.csv` file that:
- is not the 2000–2002 file
- contains a `SourcePack` column

Important consumed fields include:

```text
RelativePath
Category
LikelyRole
FileName
DurationSeconds
SourcePack
Notes
ID
Year
```

Recognized READY pools currently include:

```text
KIDS_90S
GENERAL_90S
GENERAL_00S
LATE_NIGHT
PSA
```

### 2000–2002 clean commercials

Latest:

```text
commercial-curation-2000-2002*.csv
```

Recognized READY pools:

```text
KIDS_00S
GENERAL_00S
PSA
```

The upstream commercial scanners/review builders are preserved in `CURATION_TOOLS/`.

Future public release should replace this implicit CSV ingestion with a clearer import/add workflow.

## 6. Creating a new cart

The easiest current method is to copy:

```text
Toolkit\config\NICK01.json
```

to a new file:

```text
Toolkit\config\CN01.json
```

Then edit it.

A template is included in:

```text
EXAMPLES\NEW-CART-TEMPLATE.json
```

Key fields:

```json
{
  "CartID": "CN01",
  "DisplayName": "Cartoon Network, target era description",
  "Network": "CN",
  "CommercialPool": "KIDS_90S",
  "AdsPerBreak": 1,
  "AnchorMinSeconds": 20,
  "StingMaxSeconds": 12,
  "InsertStingAfterShowNumbers": [],
  "UseMatchedNext": false,
  "BreakStyle": "LEAN",
  "Episodes": []
}
```

### `CartID`

Permanent cartridge identity.

Do not rename a cart casually after it has state/history.

### `DisplayName`

Human-readable description.

### `Network`

Must correspond to branding network values in the registry.

### `CommercialPool`

Controls which ads the planner can select.

### `AdsPerBreak`

NICK01 proved that one ad per between-show break feels much better than the original overloaded recipe.

### `AnchorMinSeconds`

Minimum duration used when selecting long opening station branding.

### `StingMaxSeconds`

Used by non-LEAN recipes for short station branding.

### `BrandingKeywords`

Per-episode aliases used for show-specific branding matching.

## 7. Initialize after creating/editing config

Always:

```powershell
.\Initialize-RetroCartLibrary.ps1
```

This registers the config's episodes and updates inferred branding tags using all known show aliases.

Then create the plan:

```powershell
.\New-RetroCartPlan.ps1 -CartID CN01
```

Then:

```powershell
.\Build-RetroCartReview.ps1 -CartID CN01
.\Open-RetroCart.ps1 -CartID CN01
```

## 8. Unique asset consequence

Episodes and commercials are UNIQUE.

Once NICK01 has active assignments, those exact episodes/commercials will not be automatically available to another active/reserved cart.

This is intentional for the current cartridge philosophy.

Branding is REUSABLE.

If future cart strategy wants intentional episode reruns or commercial reuse, do not hack around assignment files manually. Change the reuse policy deliberately and document the migration.

## 9. Adding a new type of content

At present the system understands the broad asset types:

```text
EPISODE
COMMERCIAL
BRANDING
ARCHIVE_MISC
```

Branding has functional subtypes such as:

```text
IDENT
PROMO
BUMPER_IN
BUMPER_OUT
BUMPER_GENERIC
NEXT
SIGN_OFF
...
```

If a future network needs a new functional role, prefer:
- preserving literal archive taxonomy in the registry
- deciding how to use it in the planner

rather than mass-renaming old archive metadata.

That was an important early design choice.

## 10. Recommended future improvement

Before GitHub/public release, create one generic content-management layer that can:

```text
Add Episode
Add Commercial
Add Branding
Add Sign-Off
Reclassify Asset
Re-enable/Re-disable Asset
Preview Asset
```

The planned GUI is a natural place for this.
