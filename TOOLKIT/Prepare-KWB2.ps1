# KWB2 preparation for the existing Retro TV Cart Studio v1.8.2.
# No application code changes, no re-encoding, and no changes to other carts.
[CmdletBinding()]
param(
    [string]$SystemRoot = 'F:\[VIDEOS]\retro-tv-cart-builder',
    [string]$TVRoot = 'F:\[VIDEOS]\TV',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$CartID = 'KWB2'
$plan = @'
{
  "Episodes": [
    {
      "Order": 1,
      "Series": "Animaniacs",
      "BrandingKeywords": [
        "Animaniacs"
      ],
      "Title": "Animaniacs S03E08 This Pun for Hire, Star Truck, Go Fish, Multiplication Song",
      "RelativePath": "Animaniacs\\Season 3\\Animaniacs S03E08 This Pun for Hire, Star Truck, Go Fish, Multiplication Song.mp4"
    },
    {
      "Order": 2,
      "Series": "Pinky and the Brain",
      "BrandingKeywords": [
        "Pinky and the Brain"
      ],
      "Title": "Pinky and the Brain 09 Snowball [Honeyko]",
      "RelativePath": "Pinky and the Brain\\Pinky and the Brain 09 Snowball [Honeyko].avi"
    },
    {
      "Order": 3,
      "Series": "Tiny Toon Adventures",
      "BrandingKeywords": [
        "Tiny Toon Adventures",
        "Tiny Toons"
      ],
      "Title": "S01E51 - Tiny Toon Music Television",
      "RelativePath": "Tiny Toon Adventures (1990)\\Tiny Toon Adventures - Season 1 (1990 - 1991)\\S01E51 - Tiny Toon Music Television.avi"
    },
    {
      "Order": 4,
      "Series": "Batman: The Animated Series",
      "BrandingKeywords": [
        "Batman: The Animated Series",
        "Batman"
      ],
      "Title": "Batman.The.Animated.Series.S01E03.Heart.of.Ice.720p.BluRay.x265-HETeam",
      "RelativePath": "Batman the Animated Series\\Season 1\\Batman.The.Animated.Series.S01E03.Heart.of.Ice.720p.BluRay.x265-HETeam.mp4"
    },
    {
      "Order": 5,
      "Series": "Animaniacs",
      "BrandingKeywords": [
        "Animaniacs"
      ],
      "Title": "Animaniacs S04E01 One Flew Over the Cuckoo Clock",
      "RelativePath": "Animaniacs\\Season 4\\Animaniacs S04E01 One Flew Over the Cuckoo Clock.mp4"
    },
    {
      "Order": 6,
      "Series": "Pinky and the Brain",
      "BrandingKeywords": [
        "Pinky and the Brain"
      ],
      "Title": "Pinky and the Brain 24 Brinky [Honeyko]",
      "RelativePath": "Pinky and the Brain\\Pinky and the Brain 24 Brinky [Honeyko].avi"
    },
    {
      "Order": 7,
      "Series": "Tiny Toon Adventures",
      "BrandingKeywords": [
        "Tiny Toon Adventures",
        "Tiny Toons"
      ],
      "Title": "S01E19 - Cinemaniacs!",
      "RelativePath": "Tiny Toon Adventures (1990)\\Tiny Toon Adventures - Season 1 (1990 - 1991)\\S01E19 - Cinemaniacs!.avi"
    },
    {
      "Order": 8,
      "Series": "Batman: The Animated Series",
      "BrandingKeywords": [
        "Batman: The Animated Series",
        "Batman"
      ],
      "Title": "Batman.The.Animated.Series.S01E35.Almost.Got.Im.720p.BluRay.x265-HETeam",
      "RelativePath": "Batman the Animated Series\\Season 1\\Batman.The.Animated.Series.S01E35.Almost.Got.Im.720p.BluRay.x265-HETeam.mp4"
    },
    {
      "Order": 9,
      "Series": "Animaniacs",
      "BrandingKeywords": [
        "Animaniacs"
      ],
      "Title": "Animaniacs S05E02 It, Dot The Macadamia Nut, Bully for Skippy",
      "RelativePath": "Animaniacs\\Season 5\\Animaniacs S05E02 It, Dot The Macadamia Nut, Bully for Skippy.mp4"
    },
    {
      "Order": 10,
      "Series": "Pinky and the Brain",
      "BrandingKeywords": [
        "Pinky and the Brain"
      ],
      "Title": "Pinky and the Brain 27 Brain Noir [Honeyko]",
      "RelativePath": "Pinky and the Brain\\Pinky and the Brain 27 Brain Noir [Honeyko].avi"
    },
    {
      "Order": 11,
      "Series": "Tiny Toon Adventures",
      "BrandingKeywords": [
        "Tiny Toon Adventures",
        "Tiny Toons"
      ],
      "Title": "S02E07 - Acme Cable TV",
      "RelativePath": "Tiny Toon Adventures (1990)\\Tiny Toon Adventures - Season 2 (1991 - 1992)\\S02E07 - Acme Cable TV.avi"
    },
    {
      "Order": 12,
      "Series": "Batman: The Animated Series",
      "BrandingKeywords": [
        "Batman: The Animated Series",
        "Batman"
      ],
      "Title": "Batman.The.Animated.Series.S01E26.Perchance.to.Dream.720p.BluRay.x265-HETeam",
      "RelativePath": "Batman the Animated Series\\Season 1\\Batman.The.Animated.Series.S01E26.Perchance.to.Dream.720p.BluRay.x265-HETeam.mp4"
    }
  ],
  "Ads": [
    "AD-5792fb17c0fd",
    "AD-98fbcddb1390",
    "AD-6c76d6f4f1c2",
    "AD-96d9c5143ca1",
    "AD-906cacecd972",
    "AD-ee9d366e1ef1",
    "AD-9d84f1d62cfa",
    "AD-e7bfab0947c1",
    "AD-5dae2d35ab5f",
    "AD-6f8e3230ad8c",
    "AD-8202f4ef9962"
  ],
  "Breaks": [
    {
      "Before": [],
      "After": [
        "BR-59b95b363ecf"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-d1b943477c7e"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-827f2ea6cf1d"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-7b20d2ba4854"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-438a28129297"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-c4a3d4b9b6fe"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-a6243725fb2d"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-3f171b9025f4"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-ba672c5ad85f"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-4b45d1b08a99"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-e5b57e21e727"
      ]
    }
  ],
  "Opening": "HBR-0a03222b3b89",
  "Closing": "BR-e98574d171e1"
}
'@ | ConvertFrom-Json

function Read-Csv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Required CSV missing: $Path" }
    return @(Import-Csv -LiteralPath $Path)
}
function Stable-ID([string]$Prefix, [string]$Seed) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Seed.ToLowerInvariant())
        $hex = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
        return "$Prefix-$($hex.Substring(0,12))"
    } finally { $sha.Dispose() }
}
function Canonical([string]$Path) { return $Path.Replace('\','/').ToLowerInvariant() }
function Write-Csv($Rows,[string]$Path) {
    $buffer = New-Object System.Collections.ArrayList
    foreach ($row in $Rows) { [void]$buffer.Add($row) }
    if (-not $buffer.Count) { throw "Refusing to write an empty state file: $Path" }
    $buffer | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
}
function Write-Json($Value,[string]$Path) {
    $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$settingsPath = Join-Path $SystemRoot 'STATE/settings.json'
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$registryPath = [string]$settings.RegistryPath
$assignmentPath = [string]$settings.AssignmentPath
$cartPath = [string]$settings.CartRegistryPath
$configPath = Join-Path $settings.ConfigDir 'KWB2.json'
$revDir = Join-Path $settings.BuildRoot 'KWB2/r001'
$manifestPath = Join-Path $revDir 'cart-manifest.csv'
$tracked = @($settingsPath,$registryPath,$assignmentPath,$cartPath)
$hashes = @{}
foreach ($p in $tracked) { $hashes[$p] = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }
$configExisted = Test-Path -LiteralPath $configPath
if ($configExisted) { $hashes[$configPath] = (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash }
$registry = @(Read-Csv $registryPath)
$assignments = @(Read-Csv $assignmentPath)
$carts = @(Read-Csv $cartPath)
if (@($carts | Where-Object { $_.CartID -eq $CartID }).Count -or (Test-Path -LiteralPath $revDir)) {
    throw 'KWB2 or its r001 directory already exists. Stopping; no additional revision or reservations created.'
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw 'ffprobe was not found in PATH.' }
$byID = @{}
foreach ($r in $registry) {
    if ($byID.ContainsKey($r.AssetID)) { throw "Duplicate registry AssetID: $($r.AssetID)" }
    $byID[$r.AssetID] = $r
}
# Expand source parts of known composites, including nested recipes.
$recipes = @{}
$recipeDir = Join-Path $settings.ConfigDir 'composites'
if (Test-Path -LiteralPath $recipeDir) {
    foreach ($file in (Get-ChildItem -LiteralPath $recipeDir -File -Filter '*.json')) {
        $recipe = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
        foreach ($job in $recipe.Jobs) { $recipes[(Canonical $job.Output)] = @($job.Parts) }
    }
}
function Source-Keys([string]$Path, $Seen) {
    $key = Canonical $Path
    if (-not $key -or $Seen.ContainsKey($key)) { return }
    $Seen[$key] = $true
    $key
    if ($recipes.ContainsKey($key)) {
        foreach ($part in $recipes[$key]) { Source-Keys $part $Seen }
    }
}
function Episode-Key($Row) {
    $source = [string]$Row.SourcePath
    $title = [IO.Path]::GetFileNameWithoutExtension($source.Replace('\','/'))
    if ($source -match '(?i)Batman[ .:_-]*(?:The[ ._-]*)?Animated[ ._-]*Series') {
        # Strip container/encode labels; use this collection's show+episode number.
        if ($title -match '(?i)S(\d{1,2})E(\d{1,3})') { return ('batman|s{0}e{1}' -f [int]$matches[1],[int]$matches[2]) }
    }
    if ($source -match '(?i)Tiny[ ._-]*Toon') {
        if ($title -match '(?i)S(\d{1,2})E(\d{1,3})') { return ('tinytoons|s{0}e{1}' -f [int]$matches[1],[int]$matches[2]) }
    }
    return ''
}
$occupiedEpisodes = @{}
$occupiedIDs = @{}
$occupiedPaths = @{}
function Occupy($Row,[string]$Owner) {
    $episodeKey = Episode-Key $Row
    if ($episodeKey) { $occupiedEpisodes[$episodeKey] = $Owner }
    if ($Row.AssetID) { $occupiedIDs[$Row.AssetID] = $Owner }
    $paths = @([string]$Row.SourcePath)
    if ($byID.ContainsKey([string]$Row.AssetID)) { $paths += [string]$byID[$Row.AssetID].SourcePath; $episodeKey = Episode-Key $byID[$Row.AssetID]; if ($episodeKey) { $occupiedEpisodes[$episodeKey] = $Owner } }
    foreach ($p in $paths) {
        foreach ($key in @(Source-Keys $p @{})) { $occupiedPaths[$key] = $Owner }
    }
}
foreach ($cart in $carts) {
    if (-not (Test-Path -LiteralPath $cart.ManifestPath -PathType Leaf)) {
        throw "Cannot complete repeat audit: current manifest missing for $($cart.CartID): $($cart.ManifestPath)"
    }
    foreach ($row in (Read-Csv $cart.ManifestPath)) { Occupy $row "$($cart.CartID) current" }
    $final = Join-Path (Split-Path -Parent $cart.ManifestPath) 'FINAL/cart-final-manifest.csv'
    if ($cart.Status -eq 'BUILT' -and -not (Test-Path -LiteralPath $final -PathType Leaf)) {
        throw "Cannot verify deployed assets for $($cart.CartID): FINAL manifest missing: $final"
    }
    if (Test-Path -LiteralPath $final -PathType Leaf) {
        foreach ($row in (Read-Csv $final)) { Occupy $row "$($cart.CartID) FINAL" }
    }
}
foreach ($a in $assignments) {
    if ($a.AssignmentStatus -in @('ACTIVE','RESERVED')) { Occupy $a "$($a.CartID) $($a.AssignmentStatus)" }
}
$usedIDs = @{}
$usedPaths = @{}
function Assert-Free($Asset) {
    $episodeKey = Episode-Key $Asset
    if ($episodeKey -and $occupiedEpisodes.ContainsKey($episodeKey)) { throw "Episode already used by $($occupiedEpisodes[$episodeKey]): $($Asset.Title)" }
    if ($occupiedIDs.ContainsKey($Asset.AssetID)) { throw "Already used by $($occupiedIDs[$Asset.AssetID]): $($Asset.Title)" }
    if ($usedIDs.ContainsKey($Asset.AssetID)) { throw "Repeated within KWB2: $($Asset.Title)" }
    foreach ($key in @(Source-Keys $Asset.SourcePath @{})) {
        if ($occupiedPaths.ContainsKey($key)) { throw "Source already used by $($occupiedPaths[$key]): $($Asset.Title)" }
        if ($usedPaths.ContainsKey($key)) { throw "Source repeated within KWB2: $($Asset.Title)" }
    }
}
function Probe($Asset) {
    if (-not (Test-Path -LiteralPath $Asset.SourcePath -PathType Leaf)) { throw "Media missing: $($Asset.SourcePath)" }
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $raw = @(& ffprobe -v error -show_entries 'format=duration:stream=codec_type' -of json $Asset.SourcePath 2>$null)
        $probeExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($probeExit -ne 0) { throw "ffprobe failed: $($Asset.SourcePath) (exit $probeExit)" }
    $info = ($raw -join "`n") | ConvertFrom-Json
    $duration = 0.0
    if (-not [double]::TryParse([string]$info.format.duration,[Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$duration) -or $duration -le 1) {
        throw "Invalid media duration: $($Asset.SourcePath)"
    }
    if (-not @($info.streams | Where-Object { $_.codec_type -eq 'video' }).Count -or
        -not @($info.streams | Where-Object { $_.codec_type -eq 'audio' }).Count) {
        throw "Media requires a video and audio stream: $($Asset.SourcePath)"
    }
    return [math]::Round($duration,3).ToString([cultureinfo]::InvariantCulture)
}
# Curated alternatives only: food, restaurants, games, and a few toys.
# Original primary ads for later breaks stay reserved for those breaks.
$adAlternatives = @(
    'AD-b258c48c3a96', 'AD-c59627defdf2', 'AD-d18a2a30d0ad',
    'AD-dfce585c101e', 'AD-bdd96864fd30', 'AD-300f21e4e721',
    'AD-353d1fb73008', 'AD-2f38ef339722', 'AD-9ffe83d25886',
    'AD-c569614e0a37', 'AD-6b304669dd13', 'AD-256679e56f5f'
)
function Choose-Ad([string]$PreferredID,[int]$BreakNumber) {
    $candidateIDs = @($PreferredID) + $adAlternatives
    foreach ($candidateID in $candidateIDs) {
        $candidate = $byID[$candidateID]
        if (-not $candidate -or $candidate.AssetType -ne 'COMMERCIAL' -or
            $candidate.Pool -notin @('KIDS_90S','GENERAL_90S') -or
            $candidate.SourceStatus -ne 'READY') { continue }
        if ($candidateID -ne $PreferredID -and @($plan.Ads) -contains $candidateID) { continue }
        try { Assert-Free $candidate }
        catch {
            if ($candidateID -eq $PreferredID) { Write-Host "Planned commercial unavailable: $($_.Exception.Message)" -ForegroundColor Yellow }
            continue
        }
        if (-not (Test-Path -LiteralPath $candidate.SourcePath -PathType Leaf)) { continue }
        if ($candidateID -ne $PreferredID) {
            Write-Host "Break $BreakNumber replacement: $($candidate.Title) [$candidateID]" -ForegroundColor Cyan
        }
        return $candidate
    }
    throw "No unused READY commercial remains in the curated alternative list for break $BreakNumber. No cart or reservations created."
}
$manifest = New-Object System.Collections.ArrayList
$newEpisodes = New-Object System.Collections.ArrayList
$configEpisodes = New-Object System.Collections.ArrayList
$position = 0
function Add-Slot([string]$Slot,[string]$Role,$Asset,[string]$Series='') {
    if ($Asset.SourceStatus -ne 'READY') { throw "Asset is not READY: $($Asset.Title) ($($Asset.SourceStatus))" }
    Assert-Free $Asset
    $duration = Probe $Asset
    $usedIDs[$Asset.AssetID] = $true
    foreach ($key in @(Source-Keys $Asset.SourcePath @{})) { $usedPaths[$key] = $true }
    $script:position += 10
    [void]$manifest.Add([pscustomobject][ordered]@{
        Position=('{0:D4}' -f $script:position); SlotID=$Slot; Role=$Role
        AssetID=$Asset.AssetID; AssetType=$Asset.AssetType; AssetSubtype=$Asset.Subtype
        Title=$Asset.Title; Series=$Series; Pool=$Asset.Pool; Network=$Asset.Network
        SourcePath=$Asset.SourcePath; DurationSeconds=$duration; ReusePolicy='UNIQUE'
        ReviewStatus='UNREVIEWED'; TrimStartSeconds=0; TrimEndSeconds=0
        CropLeft=0; CropRight=0; CropTop=0; CropBottom=0; AudioRepair='NONE'
    })
    Write-Host ("Checked {0}: {1}" -f $Slot,$Asset.Title)
}
function Branding([string]$ID,[string]$Slot,[string]$ExpectedSubtype='') {
    $asset = $byID[$ID]
    if (-not $asset -or $asset.AssetType -ne 'BRANDING' -or $asset.Network -ne 'KWB') { throw "KWB branding missing: $ID" }
    if ($ExpectedSubtype -and $asset.Subtype -ne $ExpectedSubtype) { throw "Unexpected subtype for $ID" }
    $role = [string]$asset.Subtype
    if ($role -eq 'BUMPER_GENERIC') { $role = 'BUMPER_IN' }
    if ($ExpectedSubtype -eq 'IDENT') { $role = 'ANCHOR_BRANDING' }
    Add-Slot $Slot $role $asset
}
Branding $plan.Opening 'KWB2-ANCHOR-01' 'IDENT'
foreach ($ep in $plan.Episodes) {
    $source = Join-Path $TVRoot $ep.RelativePath
    $id = Stable-ID 'EP' $source
    $asset = $byID[$id]
    if ($asset) {
        if ($asset.AssetType -ne 'EPISODE' -or $asset.Network -ne 'KWB') { throw "Episode already registered for another network or type: $($ep.Title)" }
    } else {
        $values = [ordered]@{}
        foreach ($col in $registry[0].PSObject.Properties.Name) { $values[$col] = '' }
        foreach ($pair in @{AssetID=$id;AssetType='EPISODE';Subtype=$ep.Series;Title=$ep.Title;Network='KWB';SourcePath=$source;CuratedStatus='MANIFEST';SourceStatus='READY';ReusePolicy='UNIQUE';SourceCollection='TV Library';Notes=$ep.Series}.GetEnumerator()) { $values[$pair.Key] = $pair.Value }
        $asset = [pscustomobject]$values
        [void]$newEpisodes.Add($asset)
    }
    Add-Slot ('KWB2-SHOW-{0:D2}' -f [int]$ep.Order) 'SHOW' $asset $ep.Series
    [void]$configEpisodes.Add([pscustomobject][ordered]@{Order=[int]$ep.Order;Series=$ep.Series;BrandingKeywords=@($ep.BrandingKeywords);Title=$ep.Title;SourcePath=$source})
    if ([int]$ep.Order -eq 12) { continue }
    $n = [int]$ep.Order
    $b = $plan.Breaks[$n-1]
    $j = 0
    foreach ($bid in @($b.Before)) { $j++; Branding $bid ('KWB2-BREAK-{0:D2}-PRE-{1:D2}' -f $n,$j) }
    $ad = Choose-Ad ([string]$plan.Ads[$n-1]) $n
    Add-Slot ('KWB2-BREAK-{0:D2}-AD-01' -f $n) 'AD' $ad
    $j = 0
    foreach ($bid in @($b.After)) { $j++; Branding $bid ('KWB2-BREAK-{0:D2}-POST-{1:D2}' -f $n,$j) }
}
Branding $plan.Closing 'KWB2-CLOSING-ID' 'IDENT'
$manifest[$manifest.Count-1].Role = 'CLOSING_BRANDING'
if ($manifest.Count -ne 36 -or @($manifest | Where-Object Role -eq 'SHOW').Count -ne 12 -or @($manifest | Where-Object Role -eq 'AD').Count -ne 11) { throw 'Unexpected lineup counts.' }
$total = ($manifest | ForEach-Object { [double]::Parse($_.DurationSeconds,[cultureinfo]::InvariantCulture) } | Measure-Object -Sum).Sum
Write-Host ("`nKWB2: 36 clips / 12 shows / 11 commercials / approximately {0:N1} minutes. No repeat conflicts found." -f ($total/60)) -ForegroundColor Green
if ($CheckOnly) { Write-Host 'CHECK ONLY: no files or reservations changed.'; return }
$config = [pscustomobject][ordered]@{
    CartID='KWB2';DisplayName='Kids WB - 1997-98 rerun lineup';Network='KWB'
    CommercialPool='KIDS_90S';CommercialPools=@('KIDS_90S','GENERAL_90S')
    AdsPerBreak=1;AnchorMinSeconds=20;StingMaxSeconds=12;InsertStingAfterShowNumbers=@()
    UseMatchedNext=$false;BreakStyle='LEAN';Episodes=@($configEpisodes.ToArray())
    ClosingBrandingAssetID=$plan.Closing
    Preparation='Fixed reviewed 1997 branding; Prepare-KWB2.ps1. Do not regenerate randomly.'
}
$now = [DateTime]::UtcNow.ToString('o')
$newAssignments = New-Object System.Collections.ArrayList
foreach ($row in $assignments) { [void]$newAssignments.Add($row) }
foreach ($m in $manifest) {
    [void]$newAssignments.Add([pscustomobject][ordered]@{
        AssignmentID=(Stable-ID 'ASG' "KWB2|1|$($m.SlotID)|$($m.AssetID)")
        CartID='KWB2';Revision=1;SlotID=$m.SlotID;AssetID=$m.AssetID
        AssignmentStatus='RESERVED';AssignedUtc=$now;ReleasedUtc='';ReleaseReason=''
    })
}
$newCarts = New-Object System.Collections.ArrayList
foreach ($row in $carts) { [void]$newCarts.Add($row) }
[void]$newCarts.Add([pscustomobject][ordered]@{
    CartID='KWB2';CurrentRevision=1;Status='DRAFT';Network='KWB';DisplayName=$config.DisplayName
    CreatedUtc=$now;UpdatedUtc=$now;ManifestPath=$manifestPath
})
$nextRegistry = New-Object System.Collections.ArrayList
foreach ($row in $registry) { [void]$nextRegistry.Add($row) }
foreach ($row in $newEpisodes) { [void]$nextRegistry.Add($row) }
# Refuse to publish if Studio or another process edited state during preflight.
foreach ($p in $hashes.Keys) {
    if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $hashes[$p]) { throw "State changed during checks: $p. Close Studio and rerun." }
}
if (-not $configExisted -and (Test-Path -LiteralPath $configPath)) { throw 'KWB2 config appeared during checks. Stopping.' }
$backup = Join-Path $SystemRoot ('HOTFIXES/KWB2-setup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
[void][IO.Directory]::CreateDirectory($backup)
$targets = @($registryPath,$assignmentPath,$cartPath,$configPath)
$backups = @{}
for ($i=0; $i -lt $targets.Count; $i++) {
    $p = $targets[$i]
    if (Test-Path -LiteralPath $p) {
        $bp = Join-Path $backup ("$i-" + [IO.Path]::GetFileName($p))
        Copy-Item -LiteralPath $p -Destination $bp
        $backups[$p] = $bp
    }
}
$written = New-Object System.Collections.ArrayList
try {
    [void][IO.Directory]::CreateDirectory($revDir)
    Write-Csv $manifest $manifestPath
    [void]$written.Add($configPath); Write-Json $config $configPath
    [void]$written.Add($registryPath); Write-Csv $nextRegistry $registryPath
    [void]$written.Add($assignmentPath); Write-Csv $newAssignments $assignmentPath
    [void]$written.Add($cartPath); Write-Csv $newCarts $cartPath
    $check = @(Read-Csv $cartPath | Where-Object CartID -eq 'KWB2')
    if ($check.Count -ne 1 -or @(Read-Csv $manifestPath).Count -ne 36) { throw 'Post-write verification failed.' }
} catch {
    $failure = $_
    foreach ($p in $written) {
        if ($backups.ContainsKey($p)) { Copy-Item -LiteralPath $backups[$p] -Destination $p -Force }
        elseif (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
    }
    if (Test-Path -LiteralPath $revDir) { Remove-Item -LiteralPath $revDir -Recurse -Force }
    throw "KWB2 setup failed; state restored from $backup. $failure"
}
Write-Host "`nCREATED KWB2 r001. All 36 assets reserved. Existing carts unchanged." -ForegroundColor Green
Write-Host "Manifest: $manifestPath"
Write-Host "Backup: $backup"
Write-Host 'Open KWB2 in the existing Studio and review normally. No composite build is needed.'
