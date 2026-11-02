# KWB1 preparation for the existing Retro TV Cart Studio v1.8.2.
# No application code changes, no re-encoding, and no changes to other carts.
[CmdletBinding()]
param(
    [string]$SystemRoot = 'F:\[VIDEOS]\retro-tv-cart-builder',
    [string]$TVRoot = 'F:\[VIDEOS]\TV',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$CartID = 'KWB1'
$plan = @'
{
  "Episodes": [
    {
      "Order": 1,
      "Series": "Animaniacs",
      "BrandingKeywords": [
        "Animaniacs"
      ],
      "Title": "Animaniacs S03E01 Super Strong Warner Siblings, Nutcracker Slappy, Wakko's New Gookie, A Quake, a Quake!",
      "RelativePath": "Animaniacs\\Season 3\\Animaniacs S03E01 Super Strong Warner Siblings, Nutcracker Slappy, Wakko's New Gookie, A Quake, a Quake!.mp4"
    },
    {
      "Order": 2,
      "Series": "Pinky and the Brain",
      "BrandingKeywords": [
        "Pinky and the Brain"
      ],
      "Title": "Pinky and the Brain 02 Of Mouse and Man [Honeyko]",
      "RelativePath": "Pinky and the Brain\\Pinky and the Brain 02 Of Mouse and Man [Honeyko].avi"
    },
    {
      "Order": 3,
      "Series": "Freakazoid!",
      "BrandingKeywords": [
        "Freakazoid!"
      ],
      "Title": "01. Five Day Forecast-Dance of Doom-Handman",
      "RelativePath": "Freakazoid!\\Season 1\\01. Five Day Forecast-Dance of Doom-Handman.mp4"
    },
    {
      "Order": 4,
      "Series": "Earthworm Jim",
      "BrandingKeywords": [
        "Earthworm Jim"
      ],
      "Title": "Earthworm.Jim.S01E01.Sidekicked.DVDRip.X265.Opus",
      "RelativePath": "Earthworm.Jim.1995.Animated.Complete.DVDRip.X265.Opus\\Earthworm.Jim.S01E01.Sidekicked.DVDRip.X265.Opus.mkv"
    },
    {
      "Order": 5,
      "Series": "Animaniacs",
      "BrandingKeywords": [
        "Animaniacs"
      ],
      "Title": "Animaniacs S03E03 Deduces Wild, Rest in Pieces, U.N. Me",
      "RelativePath": "Animaniacs\\Season 3\\Animaniacs S03E03 Deduces Wild, Rest in Pieces, U.N. Me.mp4"
    },
    {
      "Order": 6,
      "Series": "Pinky and the Brain",
      "BrandingKeywords": [
        "Pinky and the Brain"
      ],
      "Title": "Pinky and the Brain 03 Tokyo Grows, That Smarts, Brainstem [Honeyko]",
      "RelativePath": "Pinky and the Brain\\Pinky and the Brain 03 Tokyo Grows, That Smarts, Brainstem [Honeyko].avi"
    },
    {
      "Order": 7,
      "Series": "Freakazoid!",
      "BrandingKeywords": [
        "Freakazoid!"
      ],
      "Title": "02. Candle Jack-Toby Danger In Doomsday Bet-Lobe",
      "RelativePath": "Freakazoid!\\Season 1\\02. Candle Jack-Toby Danger In Doomsday Bet-Lobe.mp4"
    },
    {
      "Order": 8,
      "Series": "Earthworm Jim",
      "BrandingKeywords": [
        "Earthworm Jim"
      ],
      "Title": "Earthworm.Jim.S01E02.The Book of Doom.DVDRip.X265.Opus",
      "RelativePath": "Earthworm.Jim.1995.Animated.Complete.DVDRip.X265.Opus\\Earthworm.Jim.S01E02.The Book of Doom.DVDRip.X265.Opus.mkv"
    },
    {
      "Order": 9,
      "Series": "Animaniacs",
      "BrandingKeywords": [
        "Animaniacs"
      ],
      "Title": "Animaniacs S03E04 A Hard Day's Warner, Gimme a Break  Please Please Please, Get a Life Foundation",
      "RelativePath": "Animaniacs\\Season 3\\Animaniacs S03E04 A Hard Day's Warner, Gimme a Break  Please Please Please, Get a Life Foundation.mp4"
    },
    {
      "Order": 10,
      "Series": "Pinky and the Brain",
      "BrandingKeywords": [
        "Pinky and the Brain"
      ],
      "Title": "Pinky and the Brain 05 Brainania [Honeyko]",
      "RelativePath": "Pinky and the Brain\\Pinky and the Brain 05 Brainania [Honeyko].avi"
    },
    {
      "Order": 11,
      "Series": "Freakazoid!",
      "BrandingKeywords": [
        "Freakazoid!"
      ],
      "Title": "03. Mo-Ron-Sewer Rescue-Big Question-Legends Who Lunch",
      "RelativePath": "Freakazoid!\\Season 1\\03. Mo-Ron-Sewer Rescue-Big Question-Legends Who Lunch.mp4"
    },
    {
      "Order": 12,
      "Series": "Earthworm Jim",
      "BrandingKeywords": [
        "Earthworm Jim"
      ],
      "Title": "Earthworm.Jim.S01E03.Assault And Battery.DVDRip.X265.Opus",
      "RelativePath": "Earthworm.Jim.1995.Animated.Complete.DVDRip.X265.Opus\\Earthworm.Jim.S01E03.Assault And Battery.DVDRip.X265.Opus.mkv"
    }
  ],
  "Ads": [
    "AD-0469471c77c8",
    "AD-2a420d441f7e",
    "AD-35593321cb17",
    "AD-4e38a540cfac",
    "AD-4f9a02518b40",
    "AD-684e7f459882",
    "AD-82bebb51740f",
    "AD-b04389c7d700",
    "AD-b84607b68546",
    "AD-c1feac9540bf",
    "AD-c30ab84d4c0c"
  ],
  "Breaks": [
    {
      "Before": [
        "HBR-08c3edbf3de4"
      ],
      "After": [
        "HBR-435506133d8e"
      ]
    },
    {
      "Before": [
        "HBR-4776cdbd3640"
      ],
      "After": [
        "HBR-df4f5a2b1dbe"
      ]
    },
    {
      "Before": [
        "HBR-d739c7719c0e"
      ],
      "After": [
        "HBR-61f885b8d360"
      ]
    },
    {
      "Before": [
        "HBR-6a248b114196"
      ],
      "After": [
        "HBR-8c756ae48af7"
      ]
    },
    {
      "Before": [
        "HBR-a96ddea629d2"
      ],
      "After": [
        "HBR-c73ca496bc1d"
      ]
    },
    {
      "Before": [],
      "After": [
        "HBR-2241838f5c30"
      ]
    },
    {
      "Before": [
        "HBR-fd285abdb21a"
      ],
      "After": []
    },
    {
      "Before": [],
      "After": [
        "HBR-d286dfd42030"
      ]
    },
    {
      "Before": [],
      "After": [
        "HBR-c417e2042541"
      ]
    },
    {
      "Before": [
        "HBR-34dbfda3acd0"
      ],
      "After": []
    },
    {
      "Before": [],
      "After": [
        "HBR-79c1acb2a80d"
      ]
    }
  ],
  "Opening": "HBR-2109e79b8ffe",
  "Closing": "HBR-e941483c2e62"
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
$configPath = Join-Path $settings.ConfigDir 'KWB1.json'
$revDir = Join-Path $settings.BuildRoot 'KWB1/r001'
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
    throw 'KWB1 or its r001 directory already exists. Stopping; no additional revision or reservations created.'
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
$occupiedIDs = @{}
$occupiedPaths = @{}
function Occupy($Row,[string]$Owner) {
    if ($Row.AssetID) { $occupiedIDs[$Row.AssetID] = $Owner }
    $paths = @([string]$Row.SourcePath)
    if ($byID.ContainsKey([string]$Row.AssetID)) { $paths += [string]$byID[$Row.AssetID].SourcePath }
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
    if ($occupiedIDs.ContainsKey($Asset.AssetID)) { throw "Already used by $($occupiedIDs[$Asset.AssetID]): $($Asset.Title)" }
    if ($usedIDs.ContainsKey($Asset.AssetID)) { throw "Repeated within KWB1: $($Asset.Title)" }
    foreach ($key in @(Source-Keys $Asset.SourcePath @{})) {
        if ($occupiedPaths.ContainsKey($key)) { throw "Source already used by $($occupiedPaths[$key]): $($Asset.Title)" }
        if ($usedPaths.ContainsKey($key)) { throw "Source repeated within KWB1: $($Asset.Title)" }
    }
}
function Probe($Asset) {
    if (-not (Test-Path -LiteralPath $Asset.SourcePath -PathType Leaf)) { throw "Media missing: $($Asset.SourcePath)" }
    $raw = & ffprobe -v error -show_entries 'format=duration:stream=codec_type' -of json $Asset.SourcePath
    if ($LASTEXITCODE -ne 0) { throw "ffprobe failed: $($Asset.SourcePath)" }
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
    if ($ExpectedSubtype -eq 'IDENT') { $role = 'ANCHOR_BRANDING' }
    Add-Slot $Slot $role $asset
}
Branding $plan.Opening 'KWB1-ANCHOR-01' 'IDENT'
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
    Add-Slot ('KWB1-SHOW-{0:D2}' -f [int]$ep.Order) 'SHOW' $asset $ep.Series
    [void]$configEpisodes.Add([pscustomobject][ordered]@{Order=[int]$ep.Order;Series=$ep.Series;BrandingKeywords=@($ep.BrandingKeywords);Title=$ep.Title;SourcePath=$source})
    if ([int]$ep.Order -eq 12) { continue }
    $n = [int]$ep.Order
    $b = $plan.Breaks[$n-1]
    $j = 0
    foreach ($bid in @($b.Before)) { $j++; Branding $bid ('KWB1-BREAK-{0:D2}-PRE-{1:D2}' -f $n,$j) }
    $ad = $byID[[string]$plan.Ads[$n-1]]
    if (-not $ad -or $ad.AssetType -ne 'COMMERCIAL' -or $ad.Pool -notin @('KIDS_90S','GENERAL_90S')) { throw "Commercial missing or unexpected pool: $($plan.Ads[$n-1])" }
    Add-Slot ('KWB1-BREAK-{0:D2}-AD-01' -f $n) 'AD' $ad
    $j = 0
    foreach ($bid in @($b.After)) { $j++; Branding $bid ('KWB1-BREAK-{0:D2}-POST-{1:D2}' -f $n,$j) }
}
Branding $plan.Closing 'KWB1-SIGN-OFF' 'SIGN_OFF'
if ($manifest.Count -ne 41 -or @($manifest | Where-Object Role -eq 'SHOW').Count -ne 12 -or @($manifest | Where-Object Role -eq 'AD').Count -ne 11) { throw 'Unexpected lineup counts.' }
$total = ($manifest | ForEach-Object { [double]::Parse($_.DurationSeconds,[cultureinfo]::InvariantCulture) } | Measure-Object -Sum).Sum
Write-Host ("`nKWB1: 41 clips / 12 shows / 11 commercials / approximately {0:N1} minutes. No repeat conflicts found." -f ($total/60)) -ForegroundColor Green
if ($CheckOnly) { Write-Host 'CHECK ONLY: no files or reservations changed.'; return }
$config = [pscustomobject][ordered]@{
    CartID='KWB1';DisplayName='Kids WB - early 1995-96 lineup';Network='KWB'
    CommercialPool='KIDS_90S';CommercialPools=@('KIDS_90S','GENERAL_90S')
    AdsPerBreak=1;AnchorMinSeconds=20;StingMaxSeconds=12;InsertStingAfterShowNumbers=@()
    UseMatchedNext=$false;BreakStyle='LEAN';Episodes=@($configEpisodes.ToArray())
    SignOffAssetID=$plan.Closing
    Preparation='Fixed reviewed early branding; Prepare-KWB1.ps1. Do not regenerate randomly.'
}
$now = [DateTime]::UtcNow.ToString('o')
$newAssignments = New-Object System.Collections.ArrayList
foreach ($row in $assignments) { [void]$newAssignments.Add($row) }
foreach ($m in $manifest) {
    [void]$newAssignments.Add([pscustomobject][ordered]@{
        AssignmentID=(Stable-ID 'ASG' "KWB1|1|$($m.SlotID)|$($m.AssetID)")
        CartID='KWB1';Revision=1;SlotID=$m.SlotID;AssetID=$m.AssetID
        AssignmentStatus='RESERVED';AssignedUtc=$now;ReleasedUtc='';ReleaseReason=''
    })
}
$newCarts = New-Object System.Collections.ArrayList
foreach ($row in $carts) { [void]$newCarts.Add($row) }
[void]$newCarts.Add([pscustomobject][ordered]@{
    CartID='KWB1';CurrentRevision=1;Status='DRAFT';Network='KWB';DisplayName=$config.DisplayName
    CreatedUtc=$now;UpdatedUtc=$now;ManifestPath=$manifestPath
})
$nextRegistry = New-Object System.Collections.ArrayList
foreach ($row in $registry) { [void]$nextRegistry.Add($row) }
foreach ($row in $newEpisodes) { [void]$nextRegistry.Add($row) }
# Refuse to publish if Studio or another process edited state during preflight.
foreach ($p in $hashes.Keys) {
    if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $hashes[$p]) { throw "State changed during checks: $p. Close Studio and rerun." }
}
if (-not $configExisted -and (Test-Path -LiteralPath $configPath)) { throw 'KWB1 config appeared during checks. Stopping.' }
$backup = Join-Path $SystemRoot ('HOTFIXES/KWB1-setup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
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
    $check = @(Read-Csv $cartPath | Where-Object CartID -eq 'KWB1')
    if ($check.Count -ne 1 -or @(Read-Csv $manifestPath).Count -ne 41) { throw 'Post-write verification failed.' }
} catch {
    $failure = $_
    foreach ($p in $written) {
        if ($backups.ContainsKey($p)) { Copy-Item -LiteralPath $backups[$p] -Destination $p -Force }
        elseif (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
    }
    if (Test-Path -LiteralPath $revDir) { Remove-Item -LiteralPath $revDir -Recurse -Force }
    throw "KWB1 setup failed; state restored from $backup. $failure"
}
Write-Host "`nCREATED KWB1 r001. All 41 assets reserved. Existing carts unchanged." -ForegroundColor Green
Write-Host "Manifest: $manifestPath"
Write-Host "Backup: $backup"
Write-Host 'Open KWB1 in the existing Studio and review normally. No composite build is needed.'
