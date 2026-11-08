# Retro TV Cart Builder v1 -- initialize/refresh durable asset state
[CmdletBinding()]
param(
    [string]$CommercialRoot = 'F:\[VIDEOS]\Commercials',
    [string]$CurationDir = '',
    [string]$SystemRoot = 'F:\[VIDEOS]\Retro TV Cart Builder',
    [string]$BuildRoot = 'F:\[VIDEOS]\Retro TV Builds',
    [string]$ConfigDir = ''
)

$ErrorActionPreference = 'Stop'

function Get-StableId {
    param([string]$Prefix, [string]$Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
        $hex = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
        return "$Prefix-$($hex.Substring(0,12))"
    } finally {
        $sha.Dispose()
    }
}

function Export-Utf8Csv {
    param([Parameter(Mandatory=$true)]$Rows, [Parameter(Mandatory=$true)][string]$Path)
    $parent = Split-Path -Parent $Path
    if ($parent) { [void][IO.Directory]::CreateDirectory($parent) }

    # Windows PowerShell 5.1 has a nasty binder bug around Generic.List[object]
    # combined with @(...). Avoid the array-subexpression operator entirely.
    $buffer = New-Object System.Collections.ArrayList
    foreach ($row in $Rows) {
        [void]$buffer.Add($row)
    }

    if ($buffer.Count -eq 0) {
        Set-Content -LiteralPath $Path -Value $null -Encoding UTF8
    } else {
        $buffer | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
    }
}

function Read-CsvSafe {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) { return @(Import-Csv -LiteralPath $Path) }
    return @()
}

if (-not $CurationDir) { $CurationDir = Join-Path $CommercialRoot '_CURATION_BACKUPS' }
if (-not $ConfigDir) { $ConfigDir = Join-Path $PSScriptRoot 'config' }

foreach ($p in @($CommercialRoot,$CurationDir,$ConfigDir)) {
    if (-not (Test-Path -LiteralPath $p)) { throw "Required path not found: $p" }
}

$stateDir = Join-Path $SystemRoot 'STATE'
$snapshotDir = Join-Path $SystemRoot 'INPUT_SNAPSHOTS'
[void][IO.Directory]::CreateDirectory($stateDir)
[void][IO.Directory]::CreateDirectory($snapshotDir)
[void][IO.Directory]::CreateDirectory($BuildRoot)

function Find-LatestCsv {
    param([scriptblock]$Predicate)
    $candidates = @(Get-ChildItem -LiteralPath $CurationDir -File -Filter '*.csv' | Where-Object $Predicate | Sort-Object LastWriteTime -Descending)
    if ($candidates.Count -eq 0) { return $null }
    return $candidates[0].FullName
}

$brandingCsv = Find-LatestCsv { $_.Name -like 'branding-curation*.csv' }
$commercial00Csv = Find-LatestCsv { $_.Name -like 'commercial-curation-2000-2002*.csv' }

# Identify the original 90s curation by schema instead of relying on the exact backup filename.
$commercial90Csv = $null
foreach ($f in @(Get-ChildItem -LiteralPath $CurationDir -File -Filter 'commercial-curation*.csv' | Sort-Object LastWriteTime -Descending)) {
    if ($f.Name -like '*2000-2002*') { continue }
    $first = @(Import-Csv -LiteralPath $f.FullName | Select-Object -First 1)
    if ($first.Count -gt 0 -and ($first[0].PSObject.Properties.Name -contains 'SourcePack')) {
        $commercial90Csv = $f.FullName
        break
    }
}

if (-not $brandingCsv) { throw "Could not find branding-curation*.csv in $CurationDir" }
if (-not $commercial90Csv) { throw "Could not find the original commercial curation CSV (the one with SourcePack) in $CurationDir" }
if (-not $commercial00Csv) { Write-Warning "No 2000-2002 curation found. NICK01 does not need it, so initialization will continue." }

Write-Host "Branding source:  $brandingCsv"
Write-Host "90s ads source:   $commercial90Csv"
if ($commercial00Csv) { Write-Host "2000s ads source: $commercial00Csv" }

Copy-Item -LiteralPath $brandingCsv -Destination (Join-Path $snapshotDir 'branding-current.csv') -Force
Copy-Item -LiteralPath $commercial90Csv -Destination (Join-Path $snapshotDir 'commercials-90s-current.csv') -Force
if ($commercial00Csv) {
    Copy-Item -LiteralPath $commercial00Csv -Destination (Join-Path $snapshotDir 'commercials-00s-current.csv') -Force
}

$registryPath = Join-Path $stateDir 'asset-registry.csv'
$oldRegistry = @{}
foreach ($x in (Read-CsvSafe $registryPath)) { if ($x.AssetID) { $oldRegistry[$x.AssetID] = $x } }
$rows = New-Object 'System.Collections.Generic.List[object]'

# Build a vocabulary of show aliases from every cart config. These become
# inferred tags when a branding filename/title clearly names a show.
$knownBrandingKeywords = @(
    Get-ChildItem -LiteralPath $ConfigDir -File -Filter '*.json' |
        ForEach-Object {
            $c = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
            @($c.Episodes) | ForEach-Object { @($_.BrandingKeywords) }
        } |
        ForEach-Object { $_ } |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
)

# Durable replacement-pool episodes may also carry branding aliases.
$handpickedEpisodesCsv = Join-Path $stateDir 'handpicked-episodes.csv'
foreach($hep in (Read-CsvSafe $handpickedEpisodesCsv)){
    foreach($kw in @(([string]$hep.BrandingKeywords) -split ';')){
        if(-not [string]::IsNullOrWhiteSpace($kw)){$knownBrandingKeywords += $kw.Trim()}
    }
}
$knownBrandingKeywords=@($knownBrandingKeywords|Sort-Object -Unique)

function Get-InferredTags {
    param([string]$Title,[string]$Notes,[string]$Subtype)

    $hay = ("$Title $Notes").ToLowerInvariant()
    $tags = New-Object System.Collections.ArrayList

    if($Subtype -eq 'NEXT' -or $hay -match '\b(up next|next up|coming up|later tonight|then)\b'){
        [void]$tags.Add('PROGRAM_SPECIFIC')
        [void]$tags.Add('UP_NEXT')
    }
    if($hay -match '\b(now back|back to|back with|return to|returns to)\b'){
        [void]$tags.Add('PROGRAM_SPECIFIC')
        [void]$tags.Add('RETURN')
    }
    if($hay -match '\b(be right back|brb)\b'){
        [void]$tags.Add('BRB')
    }

    foreach($kw in $knownBrandingKeywords){
        if($hay.Contains(([string]$kw).ToLowerInvariant())){
            [void]$tags.Add("SHOW:$kw")
            [void]$tags.Add('PROGRAM_SPECIFIC')
        }
    }

    return (@($tags | Sort-Object -Unique) -join ';')
}

function Add-RegistryRow {
    param(
        [string]$AssetID,[string]$AssetType,[string]$Subtype,[string]$Title,[string]$Pool,[string]$Network,
        [string]$SourcePath,[string]$Duration,[string]$CuratedStatus,[string]$DerivedStatus,[string]$ReusePolicy,
        [string]$SourceCollection,[string]$Notes,[string]$OriginalID,[string]$Year
    )
    $old = $oldRegistry[$AssetID]
    $sourceStatus = $DerivedStatus
    $userNotes = ''
    if ($old) {
        $userNotes = $old.UserNotes
        if ($old.SourceStatus -in @('BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE','EXCLUDED')) {
            $sourceStatus = $old.SourceStatus
        }
    }
    $rows.Add([pscustomobject][ordered]@{
        AssetID=$AssetID; AssetType=$AssetType; Subtype=$Subtype; Title=$Title; Pool=$Pool; Network=$Network
        SourcePath=$SourcePath; DurationSeconds=$Duration; CuratedStatus=$CuratedStatus; SourceStatus=$sourceStatus
        ReusePolicy=$ReusePolicy; SourceCollection=$SourceCollection; Notes=$Notes; UserNotes=$userNotes
        InferredTags=(Get-InferredTags -Title $Title -Notes $Notes -Subtype $Subtype)
        OriginalID=$OriginalID; Year=$Year
    })
}

# Branding
foreach ($r in @(Import-Csv -LiteralPath $brandingCsv)) {
    if (-not $r.Id -or -not $r.RootRelativePath) { continue }
    $status = switch ([string]$r.Status) {
        'KEEP' {'READY'} 'MAYBE' {'MAYBE'} 'NEEDS_CLIPPED' {'NEEDS_CLIPPED'} 'SKIP' {'EXCLUDED'} default {'UNREVIEWED'}
    }
    $full = Join-Path $CommercialRoot $r.RootRelativePath
    Add-RegistryRow -AssetID ("BR-" + $r.Id.Substring(0,[math]::Min(12,$r.Id.Length))) `
        -AssetType 'BRANDING' -Subtype $r.Type -Title $r.FileName -Pool '' -Network $r.Network `
        -SourcePath $full -Duration $r.DurationSeconds -CuratedStatus $r.Status -DerivedStatus $status `
        -ReusePolicy 'REUSABLE' -SourceCollection $r.SourceCollection -Notes $r.Notes -OriginalID $r.Id -Year $r.YearGuess
}

# Handpicked branding added after the original archive curation.
$handpickedBrandingCsv = Join-Path $stateDir 'handpicked-branding.csv'
foreach($r in (Read-CsvSafe $handpickedBrandingCsv)){
    if(-not $r.AssetID -or -not $r.SourcePath){continue}
    $already=@($rows | Where-Object {$_.SourcePath -eq $r.SourcePath} | Select-Object -First 1)
    if($already.Count -gt 0){continue}

    $derived = switch ([string]$r.Status) {
        'KEEP' {'READY'} 'MAYBE' {'MAYBE'} 'NEEDS_CLIPPED' {'NEEDS_CLIPPED'}
        'NEEDS_CROP' {'NEEDS_CROP'} 'SKIP' {'EXCLUDED'} default {'UNREVIEWED'}
    }
    Add-RegistryRow -AssetID $r.AssetID -AssetType 'BRANDING' -Subtype $r.Type -Title $r.Title -Pool '' -Network $r.Network `
        -SourcePath $r.SourcePath -Duration $r.DurationSeconds -CuratedStatus $r.Status -DerivedStatus $derived `
        -ReusePolicy 'REUSABLE' -SourceCollection 'Bumpers-Handpicked' -Notes $r.Notes -OriginalID $r.AssetID -Year $r.Year
}

# 90s commercials
foreach ($r in @(Import-Csv -LiteralPath $commercial90Csv)) {
    if (-not $r.RelativePath) { continue }
    $assetId = Get-StableId 'AD' ("90S|" + $r.RelativePath)
    $readyPools = @('KIDS_90S','GENERAL_90S','GENERAL_00S','LATE_NIGHT','PSA')
    $status = if ($readyPools -contains $r.Category) {'READY'} elseif ($r.Category -eq 'NEEDS_CLIPPED') {'NEEDS_CLIPPED'} elseif ($r.Category -eq 'SKIP') {'EXCLUDED'} else {'UNREVIEWED'}
    $type = if ($readyPools -contains $r.Category) {'COMMERCIAL'} else {'ARCHIVE_MISC'}
    Add-RegistryRow -AssetID $assetId -AssetType $type -Subtype $r.LikelyRole -Title $r.FileName -Pool $r.Category -Network '' `
        -SourcePath (Join-Path $CommercialRoot $r.RelativePath) -Duration $r.DurationSeconds -CuratedStatus $r.Category `
        -DerivedStatus $status -ReusePolicy $(if ($type -eq 'COMMERCIAL') {'UNIQUE'} else {'REUSABLE'}) `
        -SourceCollection $r.SourcePack -Notes $r.Notes -OriginalID $r.ID -Year $r.Year
}

# 2000-2002 commercials
if ($commercial00Csv) {
    $cleanRoot = Join-Path $CommercialRoot 'Commercials (Clean)'
    foreach ($r in @(Import-Csv -LiteralPath $commercial00Csv)) {
        if (-not $r.RelativePath) { continue }
        $assetId = Get-StableId 'AD' ("00S|" + $r.RelativePath)
        $readyPools = @('KIDS_00S','GENERAL_00S','PSA')
        $status = if ($readyPools -contains $r.Category) {'READY'} elseif ($r.Category -eq 'NEEDS_CLIPPED') {'NEEDS_CLIPPED'} elseif ($r.Category -eq 'SKIP') {'EXCLUDED'} else {'UNREVIEWED'}
        $type = if ($readyPools -contains $r.Category) {'COMMERCIAL'} else {'ARCHIVE_MISC'}
        Add-RegistryRow -AssetID $assetId -AssetType $type -Subtype '' -Title $r.FileName -Pool $r.Category -Network '' `
            -SourcePath (Join-Path $cleanRoot $r.RelativePath) -Duration $r.DurationSeconds -CuratedStatus $r.Category `
            -DerivedStatus $status -ReusePolicy $(if ($type -eq 'COMMERCIAL') {'UNIQUE'} else {'REUSABLE'}) `
            -SourceCollection 'Commercials (Clean)' -Notes $r.Notes -OriginalID $r.ID -Year $r.Year
    }
}

# Episodes explicitly declared by cart configs.
foreach ($configFile in @(Get-ChildItem -LiteralPath $ConfigDir -File -Filter '*.json')) {
    $cfg = Get-Content -LiteralPath $configFile.FullName -Raw | ConvertFrom-Json
    foreach ($ep in @($cfg.Episodes)) {
        $id = Get-StableId 'EP' $ep.SourcePath
        Add-RegistryRow -AssetID $id -AssetType 'EPISODE' -Subtype $ep.Series -Title $ep.Title -Pool '' -Network $cfg.Network `
            -SourcePath $ep.SourcePath -Duration '' -CuratedStatus 'MANIFEST' -DerivedStatus 'READY' -ReusePolicy 'UNIQUE' `
            -SourceCollection 'TV Library' -Notes $ep.Series -OriginalID '' -Year ''
    }
}

# Extra episodes registered specifically for replacement pools.
foreach($ep in (Read-CsvSafe $handpickedEpisodesCsv)){
    if(-not $ep.AssetID -or -not $ep.SourcePath){continue}
    $dupe=@($rows|Where-Object{$_.AssetID -eq $ep.AssetID}|Select-Object -First 1)
    if($dupe.Count -gt 0){continue}

    $derived = switch ([string]$ep.Status) {
        'KEEP' {'READY'}
        'NEEDS_CLIPPED' {'NEEDS_CLIPPED'}
        'NEEDS_CROP' {'NEEDS_CROP'}
        'SKIP' {'EXCLUDED'}
        default {'UNREVIEWED'}
    }
    Add-RegistryRow -AssetID $ep.AssetID -AssetType 'EPISODE' -Subtype $ep.Series -Title $ep.Title -Pool '' -Network $ep.Network `
        -SourcePath $ep.SourcePath -Duration $ep.DurationSeconds -CuratedStatus $ep.Status -DerivedStatus $derived `
        -ReusePolicy 'UNIQUE' -SourceCollection 'TV Library Handpicked' -Notes $ep.Notes -OriginalID '' -Year $ep.Year
}

$rows = @($rows | Sort-Object AssetID)
Export-Utf8Csv $rows $registryPath

$assignmentPath = Join-Path $stateDir 'assignments.csv'
if (-not (Test-Path -LiteralPath $assignmentPath)) {
    Export-Utf8Csv @() $assignmentPath
}
$cartRegistryPath = Join-Path $stateDir 'cart-registry.csv'
if (-not (Test-Path -LiteralPath $cartRegistryPath)) {
    Export-Utf8Csv @() $cartRegistryPath
}

$settings = [pscustomobject]@{
    CommercialRoot=$CommercialRoot
    CurationDir=$CurationDir
    SystemRoot=$SystemRoot
    BuildRoot=$BuildRoot
    ConfigDir=$ConfigDir
    RegistryPath=$registryPath
    AssignmentPath=$assignmentPath
    CartRegistryPath=$cartRegistryPath
}
$settings | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateDir 'settings.json') -Encoding UTF8

Write-Host ""
Write-Host "Asset registry refreshed: $registryPath"
Write-Host "Assets: $($rows.Count)"
Write-Host "READY: $(@($rows | Where-Object {$_.SourceStatus -eq 'READY'}).Count)"
Write-Host "State preserved for previously flagged BAD/NEEDS_CLIPPED/DUPLICATE assets."
