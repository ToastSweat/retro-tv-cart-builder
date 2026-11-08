# FOX1 preparation for the existing Retro TV Cart Studio v1.8.2.
# No application code changes, no re-encoding, and no changes to other carts.
[CmdletBinding()]
param(
    [string]$SystemRoot = 'F:\[VIDEOS]\retro-tv-cart-builder',
    [string]$TVRoot = 'F:\[VIDEOS]\TV',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$CartID = 'FOX1'
$plan = @'
{
  "Episodes": [
    {
      "Order": 1,
      "Series": "The Tick",
      "BrandingKeywords": [
        "The Tick"
      ],
      "Title": "The Tick - s01e01 - The Tick vs The Idea Men",
      "RelativePath": "The Tick - Complete Animated Series [DVDRip x264 576p]\\The Tick - s01e01 - The Tick vs The Idea Men.mkv"
    },
    {
      "Order": 2,
      "Series": "Batman: The Animated Series",
      "BrandingKeywords": [
        "Batman: The Animated Series"
      ],
      "Title": "Batman.The.Animated.Series.S01E02.On.Leather.Wings.720p.BluRay.x265-HETeam",
      "RelativePath": "Batman the Animated Series\\Season 1\\Batman.The.Animated.Series.S01E02.On.Leather.Wings.720p.BluRay.x265-HETeam.mp4"
    },
    {
      "Order": 3,
      "Series": "X-Men",
      "BrandingKeywords": [
        "X-Men"
      ],
      "Title": "x-men_-_1x01_-_night_of_the_sentinels_-_part_1_[vpc]",
      "RelativePath": "X-Men TAS [HQ] Season 1-5\\X-Men TAS [HQ] Season 1 [vpc]\\x-men_-_1x01_-_night_of_the_sentinels_-_part_1_[vpc].avi"
    },
    {
      "Order": 4,
      "Series": "Spider-Man",
      "BrandingKeywords": [
        "Spider-Man"
      ],
      "Title": "Spider-Man The Animated Series S01E01 Night of the Lizard",
      "RelativePath": "Spider-Man The Animated Series 1994 Complete Seasons 1 to 5 TVRip x264 [i_c]\\Season 1\\Spider-Man The Animated Series S01E01 Night of the Lizard.mkv"
    },
    {
      "Order": 5,
      "Series": "The Tick",
      "BrandingKeywords": [
        "The Tick"
      ],
      "Title": "The Tick - s01e02 - The Tick vs Chairface Chippendale",
      "RelativePath": "The Tick - Complete Animated Series [DVDRip x264 576p]\\The Tick - s01e02 - The Tick vs Chairface Chippendale.mkv"
    },
    {
      "Order": 6,
      "Series": "Batman: The Animated Series",
      "BrandingKeywords": [
        "Batman: The Animated Series"
      ],
      "Title": "Batman.The.Animated.Series.S01E07.Jokers.Favor.720p.BluRay.x265-HETeam",
      "RelativePath": "Batman the Animated Series\\Season 1\\Batman.The.Animated.Series.S01E07.Jokers.Favor.720p.BluRay.x265-HETeam.mp4"
    },
    {
      "Order": 7,
      "Series": "X-Men",
      "BrandingKeywords": [
        "X-Men"
      ],
      "Title": "x-men_-_1x02_-_night_of_the_sentinels_-_part_2_[vpc]",
      "RelativePath": "X-Men TAS [HQ] Season 1-5\\X-Men TAS [HQ] Season 1 [vpc]\\x-men_-_1x02_-_night_of_the_sentinels_-_part_2_[vpc].avi"
    },
    {
      "Order": 8,
      "Series": "Spider-Man",
      "BrandingKeywords": [
        "Spider-Man"
      ],
      "Title": "Spider-Man The Animated Series S01E05 The Menace of Mysterio",
      "RelativePath": "Spider-Man The Animated Series 1994 Complete Seasons 1 to 5 TVRip x264 [i_c]\\Season 1\\Spider-Man The Animated Series S01E05 The Menace of Mysterio.mkv"
    },
    {
      "Order": 9,
      "Series": "The Tick",
      "BrandingKeywords": [
        "The Tick"
      ],
      "Title": "The Tick - s01e03 - The Tick vs Dinosaur Neil",
      "RelativePath": "The Tick - Complete Animated Series [DVDRip x264 576p]\\The Tick - s01e03 - The Tick vs Dinosaur Neil.mkv"
    },
    {
      "Order": 10,
      "Series": "Batman: The Animated Series",
      "BrandingKeywords": [
        "Batman: The Animated Series"
      ],
      "Title": "Batman.The.Animated.Series.S01E14.The.Clock.King.720p.BluRay.x265-HETeam",
      "RelativePath": "Batman the Animated Series\\Season 1\\Batman.The.Animated.Series.S01E14.The.Clock.King.720p.BluRay.x265-HETeam.mp4"
    },
    {
      "Order": 11,
      "Series": "X-Men",
      "BrandingKeywords": [
        "X-Men"
      ],
      "Title": "x-men_-_1x08_-_the_unstoppable_juggernaut_[vpc]",
      "RelativePath": "X-Men TAS [HQ] Season 1-5\\X-Men TAS [HQ] Season 1 [vpc]\\x-men_-_1x08_-_the_unstoppable_juggernaut_[vpc].avi"
    },
    {
      "Order": 12,
      "Series": "Spider-Man",
      "BrandingKeywords": [
        "Spider-Man"
      ],
      "Title": "Spider-Man The Animated Series S01E06 The Sting of the Scorpion",
      "RelativePath": "Spider-Man The Animated Series 1994 Complete Seasons 1 to 5 TVRip x264 [i_c]\\Season 1\\Spider-Man The Animated Series S01E06 The Sting of the Scorpion.mkv"
    }
  ],
  "Ads": [
    "AD-4ce1bde1d765",
    "AD-6d722f4d0e65",
    "AD-3f2fd4448e43",
    "AD-e37dd61b7318",
    "AD-60bfd1eb511e",
    "AD-dfce585c101e",
    "AD-c59627defdf2",
    "AD-d18a2a30d0ad",
    "AD-6089c391d35d",
    "AD-300f21e4e721",
    "AD-353d1fb73008"
  ],
  "Breaks": [
    {
      "Before": [],
      "After": [
        "BR-02ef5bf4644a"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-04bb72b9a8b7"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-04d498eac9e8"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-04f06fab2f1e"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-0571dac6d1c2"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-05ce021365ec"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-074ad0f14215"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-0be531fcef9e"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-0c35bde37c62"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-101feaaa3f12"
      ]
    },
    {
      "Before": [],
      "After": [
        "BR-112ad183e3b8"
      ]
    }
  ],
  "Opening": "BR-86edf0b351f4",
  "Closing": "BR-e0bac86d920c"
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
$configPath = Join-Path $settings.ConfigDir 'FOX1.json'
$revDir = Join-Path $settings.BuildRoot 'FOX1/r001'
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
    throw 'FOX1 or its r001 directory already exists. Stopping; no additional revision or reservations created.'
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
    if ($usedIDs.ContainsKey($Asset.AssetID)) { throw "Repeated within FOX1: $($Asset.Title)" }
    foreach ($key in @(Source-Keys $Asset.SourcePath @{})) {
        if ($occupiedPaths.ContainsKey($key)) { throw "Source already used by $($occupiedPaths[$key]): $($Asset.Title)" }
        if ($usedPaths.ContainsKey($key)) { throw "Source repeated within FOX1: $($Asset.Title)" }
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
    'AD-9ffe83d25886',
    'AD-2f38ef339722',
    'AD-053546be56b3',
    'AD-6b304669dd13',
    'AD-1f34237e2538',
    'AD-386a95ac6e46',
    'AD-d43ef714f6c4',
    'AD-03c912ad499a',
    'AD-256679e56f5f',
    'AD-0046386a0b45',
    'AD-ef1decff3f22',
    'AD-466ac1dcdd0a',
    'AD-e8d74e6390ed',
    'AD-e4d066c9f9a3',
    'AD-c569614e0a37',
    'AD-e97a930f5541',
    'AD-6c380723c3d3',
    'AD-b258c48c3a96',
    'AD-bdd96864fd30'
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
    if (-not $asset -or $asset.AssetType -ne 'BRANDING' -or $asset.Network -ne 'FOX') { throw "FOX branding missing: $ID" }
    if ($ExpectedSubtype -and $asset.Subtype -ne $ExpectedSubtype) { throw "Unexpected subtype for $ID" }
    $role = [string]$asset.Subtype
    if ($role -eq 'BUMPER_GENERIC') { $role = 'BUMPER_IN' }
    if ($ExpectedSubtype -eq 'IDENT') { $role = 'ANCHOR_BRANDING' }
    Add-Slot $Slot $role $asset
}
Branding $plan.Opening 'FOX1-ANCHOR-01' 'PROMO'
foreach ($ep in $plan.Episodes) {
    $source = Join-Path $TVRoot $ep.RelativePath
    $id = Stable-ID 'EP' $source
    $asset = $byID[$id]
    if ($asset) {
        if ($asset.AssetType -ne 'EPISODE' -or $asset.Network -ne 'FOX') { throw "Episode already registered for another network or type: $($ep.Title)" }
    } else {
        $values = [ordered]@{}
        foreach ($col in $registry[0].PSObject.Properties.Name) { $values[$col] = '' }
        foreach ($pair in @{AssetID=$id;AssetType='EPISODE';Subtype=$ep.Series;Title=$ep.Title;Network='FOX';SourcePath=$source;CuratedStatus='MANIFEST';SourceStatus='READY';ReusePolicy='UNIQUE';SourceCollection='TV Library';Notes=$ep.Series}.GetEnumerator()) { $values[$pair.Key] = $pair.Value }
        $asset = [pscustomobject]$values
        [void]$newEpisodes.Add($asset)
    }
    Add-Slot ('FOX1-SHOW-{0:D2}' -f [int]$ep.Order) 'SHOW' $asset $ep.Series
    [void]$configEpisodes.Add([pscustomobject][ordered]@{Order=[int]$ep.Order;Series=$ep.Series;BrandingKeywords=@($ep.BrandingKeywords);Title=$ep.Title;SourcePath=$source})
    if ([int]$ep.Order -eq 12) { continue }
    $n = [int]$ep.Order
    $b = $plan.Breaks[$n-1]
    $j = 0
    foreach ($bid in @($b.Before)) { $j++; Branding $bid ('FOX1-BREAK-{0:D2}-PRE-{1:D2}' -f $n,$j) }
    $ad = Choose-Ad ([string]$plan.Ads[$n-1]) $n
    Add-Slot ('FOX1-BREAK-{0:D2}-AD-01' -f $n) 'AD' $ad
    $j = 0
    foreach ($bid in @($b.After)) { $j++; Branding $bid ('FOX1-BREAK-{0:D2}-POST-{1:D2}' -f $n,$j) }
}
Branding $plan.Closing 'FOX1-CLOSING-ID' 'IDENT'
$manifest[$manifest.Count-1].Role = 'CLOSING_BRANDING'
if ($manifest.Count -ne 36 -or @($manifest | Where-Object Role -eq 'SHOW').Count -ne 12 -or @($manifest | Where-Object Role -eq 'AD').Count -ne 11) { throw 'Unexpected lineup counts.' }
$total = ($manifest | ForEach-Object { [double]::Parse($_.DurationSeconds,[cultureinfo]::InvariantCulture) } | Measure-Object -Sum).Sum
Write-Host ("`nFOX1: 36 clips / 12 shows / 11 commercials / approximately {0:N1} minutes. No repeat conflicts found." -f ($total/60)) -ForegroundColor Green
if ($CheckOnly) { Write-Host 'CHECK ONLY: no files or reservations changed.'; return }
$config = [pscustomobject][ordered]@{
    CartID='FOX1';DisplayName='Fox Kids - mid-1990s lineup';Network='FOX'
    CommercialPool='KIDS_90S';CommercialPools=@('KIDS_90S','GENERAL_90S')
    AdsPerBreak=1;AnchorMinSeconds=20;StingMaxSeconds=12;InsertStingAfterShowNumbers=@()
    UseMatchedNext=$false;BreakStyle='LEAN';Episodes=@($configEpisodes.ToArray())
    ClosingBrandingAssetID=$plan.Closing
    Preparation='Fixed existing Fox Kids branding; Prepare-FOX1.ps1. Do not regenerate randomly.'
}
$now = [DateTime]::UtcNow.ToString('o')
$newAssignments = New-Object System.Collections.ArrayList
foreach ($row in $assignments) { [void]$newAssignments.Add($row) }
foreach ($m in $manifest) {
    [void]$newAssignments.Add([pscustomobject][ordered]@{
        AssignmentID=(Stable-ID 'ASG' "FOX1|1|$($m.SlotID)|$($m.AssetID)")
        CartID='FOX1';Revision=1;SlotID=$m.SlotID;AssetID=$m.AssetID
        AssignmentStatus='RESERVED';AssignedUtc=$now;ReleasedUtc='';ReleaseReason=''
    })
}
$newCarts = New-Object System.Collections.ArrayList
foreach ($row in $carts) { [void]$newCarts.Add($row) }
[void]$newCarts.Add([pscustomobject][ordered]@{
    CartID='FOX1';CurrentRevision=1;Status='DRAFT';Network='FOX';DisplayName=$config.DisplayName
    CreatedUtc=$now;UpdatedUtc=$now;ManifestPath=$manifestPath
})
$nextRegistry = New-Object System.Collections.ArrayList
foreach ($row in $registry) { [void]$nextRegistry.Add($row) }
foreach ($row in $newEpisodes) { [void]$nextRegistry.Add($row) }
# Refuse to publish if Studio or another process edited state during preflight.
foreach ($p in $hashes.Keys) {
    if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $hashes[$p]) { throw "State changed during checks: $p. Close Studio and rerun." }
}
if (-not $configExisted -and (Test-Path -LiteralPath $configPath)) { throw 'FOX1 config appeared during checks. Stopping.' }
$backup = Join-Path $SystemRoot ('HOTFIXES/FOX1-setup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
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
    $check = @(Read-Csv $cartPath | Where-Object CartID -eq 'FOX1')
    if ($check.Count -ne 1 -or @(Read-Csv $manifestPath).Count -ne 36) { throw 'Post-write verification failed.' }
} catch {
    $failure = $_
    foreach ($p in $written) {
        if ($backups.ContainsKey($p)) { Copy-Item -LiteralPath $backups[$p] -Destination $p -Force }
        elseif (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
    }
    if (Test-Path -LiteralPath $revDir) { Remove-Item -LiteralPath $revDir -Recurse -Force }
    throw "FOX1 setup failed; state restored from $backup. $failure"
}
Write-Host "`nCREATED FOX1 r001. All 36 assets reserved. Existing carts unchanged." -ForegroundColor Green
Write-Host "Manifest: $manifestPath"
Write-Host "Backup: $backup"
Write-Host 'Open FOX1 in the existing Studio and review normally. No composite build is needed.'
