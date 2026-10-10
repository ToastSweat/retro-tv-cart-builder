# Retro TV Cart Builder v1 -- create a durable cart plan and reserve unique assets
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [string]$SystemRoot = 'F:\[VIDEOS]\Retro TV Cart Builder',
    [switch]$ForceNewRevision
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

$stateDir = Join-Path $SystemRoot 'STATE'
$settingsPath = Join-Path $stateDir 'settings.json'
if (-not (Test-Path -LiteralPath $settingsPath)) { throw "Run Initialize-RetroCartLibrary.ps1 first." }
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$registry = @(Import-Csv -LiteralPath $settings.RegistryPath)
$assignments = @(Read-CsvSafe $settings.AssignmentPath)
$carts = @(Read-CsvSafe $settings.CartRegistryPath)

$configPath = Join-Path $settings.ConfigDir ($CartID.ToUpperInvariant() + '.json')
if (-not (Test-Path -LiteralPath $configPath)) { throw "No cart config found: $configPath" }
$cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$CartID = [string]$cfg.CartID

$currentCart = @($carts | Where-Object {$_.CartID -eq $CartID} | Select-Object -First 1)
if ($currentCart.Count -gt 0 -and -not $ForceNewRevision) {
    $currentManifest = $currentCart[0].ManifestPath
    if ($currentManifest -and (Test-Path -LiteralPath $currentManifest)) {
        Write-Host "Cart $CartID already exists at revision $($currentCart[0].CurrentRevision)."
        Write-Host "Manifest: $currentManifest"
        Write-Host "Use Build-RetroCartReview.ps1 to review it, or -ForceNewRevision only when you intentionally want a fresh plan."
        exit 0
    }
}

$revision = 1
if ($currentCart.Count -gt 0) { $revision = ([int]$currentCart[0].CurrentRevision) + 1 }
$revName = ('r{0:D3}' -f $revision)
$revDir = Join-Path (Join-Path $settings.BuildRoot $CartID) $revName
[void][IO.Directory]::CreateDirectory($revDir)
$manifestPath = Join-Path $revDir 'cart-manifest.csv'

# Deterministic RNG: same cart/revision gives the same plan if state is unchanged.
$seedText = "$CartID|$revision"
$sha = [System.Security.Cryptography.SHA256]::Create()
try {
    $h = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($seedText))
    $seed = [BitConverter]::ToInt32($h,0) -band 0x7fffffff
} finally { $sha.Dispose() }
$rng = New-Object System.Random($seed)

$activeAssignmentAssetIds = @{}
foreach ($a in $assignments) {
    if ($a.AssignmentStatus -in @('RESERVED','ACTIVE')) { $activeAssignmentAssetIds[$a.AssetID] = $true }
}
$usedThisCart = @{}

function Is-Available {
    param($asset)
    if ($asset.SourceStatus -ne 'READY') { return $false }
    if ($asset.ReusePolicy -eq 'UNIQUE' -and $activeAssignmentAssetIds.ContainsKey($asset.AssetID)) { return $false }
    if ($usedThisCart.ContainsKey($asset.AssetID)) { return $false }
    return $true
}

function Pick-One {
    param([object[]]$Candidates)
    $list = @($Candidates | Where-Object { Is-Available $_ } | Sort-Object AssetID)
    if ($list.Count -eq 0) { return $null }
    $pick = $list[$rng.Next(0,$list.Count)]
    $usedThisCart[$pick.AssetID] = $true
    return $pick
}

function Text-MatchesKeywords {
    param($asset, [object[]]$Keywords)
    if (-not $Keywords -or $Keywords.Count -eq 0) { return $false }
    $hay = (([string]$asset.Title) + ' ' + ([string]$asset.Notes) + ' ' + ([string]$asset.InferredTags)).ToLowerInvariant()
    foreach ($k in $Keywords) {
        if ($k -and $hay.Contains(([string]$k).ToLowerInvariant())) { return $true }
    }
    return $false
}

$allShowKeywords = @(
    $cfg.Episodes |
        ForEach-Object { $_.BrandingKeywords } |
        ForEach-Object { $_ } |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
        Sort-Object -Unique
)

function Is-ShowSpecificBranding {
    param($asset)
    return (Text-MatchesKeywords $asset $allShowKeywords)
}

function Is-ProgramSpecificBranding {
    param($asset)
    $hay = (([string]$asset.Title) + ' ' + ([string]$asset.Notes) + ' ' + ([string]$asset.InferredTags)).ToLowerInvariant()

    # Explicit inferred tag wins.
    if($hay.Contains('program_specific')){ return $true }

    # Even if a show was never added to our TV library/config, phrases like
    # "Up next..." or "Now back to..." mean the clip is not generic.
    if($hay -match '\b(up next|next up|coming up|now back|back to|return to|returns to|then)\b'){
        return $true
    }

    return (Is-ShowSpecificBranding $asset)
}

function Pick-Branding {
    param(
        [string[]]$Types,
        [double]$MinSeconds=-1,
        [double]$MaxSeconds=-1,
        [object[]]$MatchKeywords=$null,
        [switch]$PreferGeneric,
        [switch]$AvoidShowSpecific
    )
    $base = @($registry | Where-Object {
        $_.AssetType -eq 'BRANDING' -and $_.Network -eq $cfg.Network -and ($Types -contains $_.Subtype) -and $_.SourceStatus -eq 'READY'
    })
    if ($MinSeconds -ge 0) {
        $base = @($base | Where-Object { $d=0.0; [double]::TryParse($_.DurationSeconds,[ref]$d) -and $d -ge $MinSeconds })
    }
    if ($MaxSeconds -ge 0) {
        $base = @($base | Where-Object { $d=0.0; [double]::TryParse($_.DurationSeconds,[ref]$d) -and $d -le $MaxSeconds })
    }
    if ($MatchKeywords) {
        $matching = @($base | Where-Object { Text-MatchesKeywords $_ $MatchKeywords })
        $p = Pick-One $matching
        if ($p) { return $p }
    }
    if ($AvoidShowSpecific) {
        $base = @($base | Where-Object { -not (Is-ProgramSpecificBranding $_) })
    }
    if ($PreferGeneric) {
        # Generic means genuinely network-generic, not merely "notes are blank".
        # Title/notes/inferred tags are all checked, including unknown-show cues
        # such as "Up next..." and "Now back to...".
        $generic = @($base | Where-Object { -not (Is-ProgramSpecificBranding $_) })
        $p = Pick-One $generic
        if ($p) { return $p }
    }
    return Pick-One $base
}

function Pick-Ad {
    $candidates = @($registry | Where-Object {
        $_.AssetType -eq 'COMMERCIAL' -and $_.Pool -eq $cfg.CommercialPool -and $_.SourceStatus -eq 'READY'
    })
    return Pick-One $candidates
}

function Find-EpisodeAsset($ep) {
    $id = Get-StableId 'EP' $ep.SourcePath
    return @($registry | Where-Object {$_.AssetID -eq $id} | Select-Object -First 1)
}

$manifest = New-Object 'System.Collections.Generic.List[object]'
$position = 0
function Add-Slot {
    param([string]$SlotID,[string]$Role,$asset,[string]$Series='')
    if (-not $asset) { return }
    $script:position += 10
    $manifest.Add([pscustomobject][ordered]@{
        Position=('{0:D4}' -f $script:position)
        SlotID=$SlotID
        Role=$Role
        AssetID=$asset.AssetID
        AssetType=$asset.AssetType
        AssetSubtype=$asset.Subtype
        Title=$asset.Title
        Series=$Series
        Pool=$asset.Pool
        Network=$asset.Network
        SourcePath=$asset.SourcePath
        DurationSeconds=$asset.DurationSeconds
        ReusePolicy=$asset.ReusePolicy
        ReviewStatus='UNREVIEWED'
    })
}

$anchor = Pick-Branding -Types @('IDENT','PROMO') -MinSeconds ([double]$cfg.AnchorMinSeconds) -PreferGeneric
if (-not $anchor) { throw "Could not find a READY long anchor branding asset for $($cfg.Network)." }
Add-Slot "$CartID-ANCHOR-01" 'ANCHOR_BRANDING' $anchor

$episodes = @($cfg.Episodes | Sort-Object Order)
for ($i=0; $i -lt $episodes.Count; $i++) {
    $ep = $episodes[$i]
    $episodeAsset = Find-EpisodeAsset $ep
    if ($episodeAsset.Count -eq 0) { throw "Episode is not registered: $($ep.SourcePath)" }
    if (-not (Is-Available $episodeAsset[0])) { throw "Episode is unavailable or already assigned: $($ep.Title)" }
    $usedThisCart[$episodeAsset[0].AssetID] = $true
    Add-Slot ("$CartID-SHOW-{0:D2}" -f ($i+1)) 'SHOW' $episodeAsset[0] $ep.Series

    if ($i -ge ($episodes.Count-1)) { continue }
    $nextEp = $episodes[$i+1]
    $breakNo = $i+1

    if(([string]$cfg.BreakStyle).ToUpperInvariant() -eq 'LEAN'){
        # Lean fake-broadcast recipe:
        # SHOW -> 1 unique commercial -> 1 short/matched transition -> next SHOW.
        # No stacked NEXT + OUT + ads + IN + STING pileups.
        for ($adNo=1; $adNo -le [int]$cfg.AdsPerBreak; $adNo++) {
            $ad = Pick-Ad
            if (-not $ad) { throw "Ran out of available $($cfg.CommercialPool) commercials while planning break $breakNo." }
            Add-Slot ("$CartID-BREAK-{0:D2}-AD-{1:D2}" -f $breakNo,$adNo) 'AD' $ad
        }

        # Prefer a return bumper that actually names the upcoming show.
        # Otherwise use genuinely generic short network branding.
        $transition = Pick-Branding -Types @('BUMPER_IN') -MatchKeywords @($nextEp.BrandingKeywords)
        if (-not $transition) {
            $transition = Pick-Branding -Types @('BUMPER_IN','BUMPER_GENERIC','IDENT') -MaxSeconds 15 -AvoidShowSpecific -PreferGeneric
        }
        if ($transition) {
            Add-Slot ("$CartID-BREAK-{0:D2}-IN" -f $breakNo) 'BUMPER_IN' $transition
        }
    }
    else {
    if ([bool]$cfg.UseMatchedNext) {
        $nextBrand = Pick-Branding -Types @('NEXT') -MatchKeywords @($nextEp.BrandingKeywords)
        if ($nextBrand) { Add-Slot ("$CartID-BREAK-{0:D2}-NEXT" -f $breakNo) 'NEXT' $nextBrand }
    }

    # If a BRB bumper names a show, it must match the show that just ended.
    # Otherwise use genuinely generic material that does not name another show.
    $outBumper = Pick-Branding -Types @('BUMPER_OUT') -MatchKeywords @($ep.BrandingKeywords)
    if (-not $outBumper) { $outBumper = Pick-Branding -Types @('BUMPER_OUT') -AvoidShowSpecific -PreferGeneric }
    if (-not $outBumper) { $outBumper = Pick-Branding -Types @('BUMPER_GENERIC') -MaxSeconds 12 -AvoidShowSpecific -PreferGeneric }
    if ($outBumper) { Add-Slot ("$CartID-BREAK-{0:D2}-OUT" -f $breakNo) 'BUMPER_OUT' $outBumper }

    for ($adNo=1; $adNo -le [int]$cfg.AdsPerBreak; $adNo++) {
        $ad = Pick-Ad
        if (-not $ad) { throw "Ran out of available $($cfg.CommercialPool) commercials while planning break $breakNo." }
        Add-Slot ("$CartID-BREAK-{0:D2}-AD-{1:D2}" -f $breakNo,$adNo) 'AD' $ad
    }

    # A return bumper may name the upcoming show, never some unrelated show.
    $inBumper = Pick-Branding -Types @('BUMPER_IN') -MatchKeywords @($nextEp.BrandingKeywords)
    if (-not $inBumper) { $inBumper = Pick-Branding -Types @('BUMPER_IN') -AvoidShowSpecific -PreferGeneric }
    if (-not $inBumper) { $inBumper = Pick-Branding -Types @('BUMPER_GENERIC') -MaxSeconds 12 -AvoidShowSpecific -PreferGeneric }
    if ($inBumper) { Add-Slot ("$CartID-BREAK-{0:D2}-IN" -f $breakNo) 'BUMPER_IN' $inBumper }

    if (@($cfg.InsertStingAfterShowNumbers) -contains ($i+1)) {
        $sting = Pick-Branding -Types @('IDENT','BUMPER_GENERIC') -MaxSeconds ([double]$cfg.StingMaxSeconds) -PreferGeneric
        if ($sting) { Add-Slot ("$CartID-STING-{0:D2}" -f ($i+1)) 'STING' $sting }
    }

    }
}

# Optional configured network sign-off.
if($cfg.PSObject.Properties.Name -contains 'SignOffAssetID' -and -not [string]::IsNullOrWhiteSpace([string]$cfg.SignOffAssetID)){
    $signoff=@($registry | Where-Object {$_.AssetID -eq [string]$cfg.SignOffAssetID} | Select-Object -First 1)
    if($signoff.Count -eq 0){throw "Configured SIGN_OFF asset is not registered: $($cfg.SignOffAssetID)"}
    if($signoff[0].SourceStatus -ne 'READY'){throw "Configured SIGN_OFF asset is not READY: $($signoff[0].AssetID) $($signoff[0].Title)"}
    Add-Slot "$CartID-SIGN-OFF" 'SIGN_OFF' $signoff[0]
}

Export-Utf8Csv $manifest $manifestPath

# Reserve/log every asset, including reusable branding, so cart history is complete.
$now = [DateTime]::UtcNow.ToString('o')
$newAssignments = New-Object 'System.Collections.Generic.List[object]'
foreach ($a in $assignments) { $newAssignments.Add($a) }
foreach ($m in $manifest) {
    $newAssignments.Add([pscustomobject][ordered]@{
        AssignmentID=(Get-StableId 'ASG' "$CartID|$revision|$($m.SlotID)|$($m.AssetID)")
        CartID=$CartID; Revision=$revision; SlotID=$m.SlotID; AssetID=$m.AssetID
        AssignmentStatus='RESERVED'; AssignedUtc=$now; ReleasedUtc=''; ReleaseReason=''
    })
}
Export-Utf8Csv $newAssignments $settings.AssignmentPath

$newCartRows = New-Object 'System.Collections.Generic.List[object]'
$found = $false
foreach ($c in $carts) {
    if ($c.CartID -eq $CartID) {
        $found=$true
        $newCartRows.Add([pscustomobject][ordered]@{
            CartID=$CartID; CurrentRevision=$revision; Status='DRAFT'; Network=$cfg.Network
            DisplayName=$cfg.DisplayName; CreatedUtc=$c.CreatedUtc; UpdatedUtc=$now; ManifestPath=$manifestPath
        })
    } else { $newCartRows.Add($c) }
}
if (-not $found) {
    $newCartRows.Add([pscustomobject][ordered]@{
        CartID=$CartID; CurrentRevision=$revision; Status='DRAFT'; Network=$cfg.Network
        DisplayName=$cfg.DisplayName; CreatedUtc=$now; UpdatedUtc=$now; ManifestPath=$manifestPath
    })
}
Export-Utf8Csv $newCartRows $settings.CartRegistryPath

Write-Host ""
Write-Host "Created $CartID $revName"
Write-Host "Manifest: $manifestPath"
Write-Host "Clips: $($manifest.Count)"
Write-Host "Shows: $(@($manifest | Where-Object {$_.Role -eq 'SHOW'}).Count)"
Write-Host "Ads:   $(@($manifest | Where-Object {$_.Role -eq 'AD'}).Count)"
Write-Host "Unique episodes/commercials are now RESERVED and will not be offered to another cart."
