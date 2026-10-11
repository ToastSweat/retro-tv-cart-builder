# Append the configured SIGN_OFF to the current cart as a new immutable revision.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [string]$SystemRoot='F:\[VIDEOS]\Retro TV Cart Builder'
)
$ErrorActionPreference='Stop'

function Get-StableId {
    param([string]$Prefix,[string]$Value)
    $sha=[System.Security.Cryptography.SHA256]::Create()
    try{
        $bytes=[Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
        $hex=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
        return "$Prefix-$($hex.Substring(0,12))"
    }finally{$sha.Dispose()}
}
function Export-Utf8Csv {
    param($Rows,[string]$Path)
    $parent=Split-Path -Parent $Path
    if($parent){[void][IO.Directory]::CreateDirectory($parent)}
    $buf=New-Object System.Collections.ArrayList
    foreach($r in $Rows){[void]$buf.Add($r)}
    if($buf.Count -eq 0){Set-Content -LiteralPath $Path -Value $null -Encoding UTF8}
    else{$buf|Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8}
}

$stateDir=Join-Path $SystemRoot 'STATE'
$settings=Get-Content -LiteralPath (Join-Path $stateDir 'settings.json') -Raw | ConvertFrom-Json
$carts=@(Import-Csv -LiteralPath $settings.CartRegistryPath)
$cart=@($carts | Where-Object {$_.CartID -eq $CartID} | Select-Object -First 1)
if($cart.Count -eq 0){throw "Unknown cart: $CartID"}

$configPath=Join-Path $settings.ConfigDir ($CartID.ToUpperInvariant()+'.json')
if(-not (Test-Path -LiteralPath $configPath)){throw "Cart config not found: $configPath"}
$cfg=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if(-not ($cfg.PSObject.Properties.Name -contains 'SignOffAssetID') -or [string]::IsNullOrWhiteSpace([string]$cfg.SignOffAssetID)){
    throw "No SignOffAssetID is configured for $CartID. Register the clip first with Add-HandpickedBranding.ps1 -Type SIGN_OFF -CartID $CartID, then run Initialize-RetroCartLibrary.ps1."
}


function Get-ApprovedRepairRecipe {
    param([string]$AssetID)

    # Reuse only a recipe that was part of a FINAL build. That gives us an
    # approved, actually-deployed example instead of guessing from an
    # unreviewed intermediate manifest.
    $finalManifests=@(
        Get-ChildItem -LiteralPath $settings.BuildRoot -Recurse -File -Filter 'cart-final-manifest.csv' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    )

    foreach($fm in $finalManifests){
        try{
            $hit=@(
                Import-Csv -LiteralPath $fm.FullName |
                Where-Object {$_.AssetID -eq $AssetID} |
                Select-Object -First 1
            )
        }catch{
            continue
        }

        if($hit.Count -gt 0){
            $r=$hit[0]
            $audio=([string]$r.AudioRepair).Trim().ToUpperInvariant()
            if([string]::IsNullOrWhiteSpace($audio)){$audio='NONE'}
            if($audio -eq 'LIGHT'){$audio='RESTORE'}

            return [pscustomobject][ordered]@{
                TrimStartSeconds=$(if([string]::IsNullOrWhiteSpace([string]$r.TrimStartSeconds)){0}else{$r.TrimStartSeconds})
                TrimEndSeconds=$(if([string]::IsNullOrWhiteSpace([string]$r.TrimEndSeconds)){0}else{$r.TrimEndSeconds})
                CropLeft=$(if([string]::IsNullOrWhiteSpace([string]$r.CropLeft)){0}else{$r.CropLeft})
                CropRight=$(if([string]::IsNullOrWhiteSpace([string]$r.CropRight)){0}else{$r.CropRight})
                CropTop=$(if([string]::IsNullOrWhiteSpace([string]$r.CropTop)){0}else{$r.CropTop})
                CropBottom=$(if([string]::IsNullOrWhiteSpace([string]$r.CropBottom)){0}else{$r.CropBottom})
                AudioRepair=$audio
                SourceManifest=$fm.FullName
            }
        }
    }

    return $null
}

function Resolve-ConfiguredSignOff {
    param($Asset,[string]$CartNetwork)

    if(-not $Asset){throw "Configured SIGN_OFF asset could not be resolved."}
    if($Asset.AssetType -ne 'BRANDING'){throw "Configured SIGN_OFF asset must be BRANDING: $($Asset.AssetID)"}
    if($Asset.Network -and $Asset.Network -ne $CartNetwork){
        throw "Configured SIGN_OFF network '$($Asset.Network)' does not match cart network '$CartNetwork'."
    }

    $status=([string]$Asset.SourceStatus).Trim().ToUpperInvariant()
    if($status -eq 'READY'){
        return [pscustomobject][ordered]@{
            Asset=$Asset
            TrimStartSeconds=0
            TrimEndSeconds=0
            CropLeft=0
            CropRight=0
            CropTop=0
            CropBottom=0
            AudioRepair='NONE'
            RepairSource=''
        }
    }

    if($status -in @('NEEDS_CLIPPED','NEEDS_CROP','BAD_AUDIO')){
        $recipe=Get-ApprovedRepairRecipe -AssetID $Asset.AssetID
        if(-not $recipe){
            throw "Configured SIGN_OFF asset $($Asset.AssetID) is $status and no approved repair recipe was found in any FINAL build. Do not force it READY; first finalize an approved repaired use or repair it explicitly."
        }

        Write-Host ("Configured SIGN_OFF is {0}; inheriting approved repair recipe from {1}" -f $status,$recipe.SourceManifest)

        return [pscustomobject][ordered]@{
            Asset=$Asset
            TrimStartSeconds=$recipe.TrimStartSeconds
            TrimEndSeconds=$recipe.TrimEndSeconds
            CropLeft=$recipe.CropLeft
            CropRight=$recipe.CropRight
            CropTop=$recipe.CropTop
            CropBottom=$recipe.CropBottom
            AudioRepair=$recipe.AudioRepair
            RepairSource=$recipe.SourceManifest
        }
    }

    throw "Configured SIGN_OFF asset is not usable: $($Asset.AssetID) status=$status. BAD_QUALITY, DUPLICATE, EXCLUDED, MAYBE, and other non-repairable states are intentionally blocked."
}

$registry=@(Import-Csv -LiteralPath $settings.RegistryPath)
$signoff=@($registry | Where-Object {$_.AssetID -eq [string]$cfg.SignOffAssetID} | Select-Object -First 1)
if($signoff.Count -eq 0){throw "Configured sign-off $($cfg.SignOffAssetID) is not in asset-registry.csv. Run Initialize-RetroCartLibrary.ps1."}
$s=$signoff[0]
$resolved=Resolve-ConfiguredSignOff -Asset $s -CartNetwork $cart[0].Network

$oldRev=[int]$cart[0].CurrentRevision
$oldManifest=@(Import-Csv -LiteralPath $cart[0].ManifestPath)
if(@($oldManifest | Where-Object {$_.Role -eq 'SIGN_OFF'}).Count -gt 0){
    Write-Host "$CartID already has a SIGN_OFF in r$('000'+$oldRev).Substring(('000'+$oldRev).Length-3)."
    exit 0
}

$newRev=$oldRev+1
$revName=('r{0:D3}' -f $newRev)
$newRevDir=Join-Path (Join-Path $settings.BuildRoot $CartID) $revName
[void][IO.Directory]::CreateDirectory($newRevDir)

$newManifest=New-Object 'System.Collections.Generic.List[object]'

# Normalize carried-forward legacy rows to the current manifest schema.
# Export-Csv uses the first object's property set; without this, repair columns
# on the appended SIGN_OFF can be silently omitted.
foreach($m in $oldManifest){
    $audio=([string]$m.AudioRepair).Trim().ToUpperInvariant()
    if([string]::IsNullOrWhiteSpace($audio)){$audio='NONE'}
    if($audio -eq 'LIGHT'){$audio='RESTORE'}

    $newManifest.Add([pscustomobject][ordered]@{
        Position=$m.Position
        SlotID=$m.SlotID
        Role=$m.Role
        AssetID=$m.AssetID
        AssetType=$m.AssetType
        AssetSubtype=$m.AssetSubtype
        Title=$m.Title
        Series=$m.Series
        Pool=$m.Pool
        Network=$m.Network
        SourcePath=$m.SourcePath
        DurationSeconds=$m.DurationSeconds
        ReusePolicy=$m.ReusePolicy
        ReviewStatus=$m.ReviewStatus
        TrimStartSeconds=$(if([string]::IsNullOrWhiteSpace([string]$m.TrimStartSeconds)){0}else{$m.TrimStartSeconds})
        TrimEndSeconds=$(if([string]::IsNullOrWhiteSpace([string]$m.TrimEndSeconds)){0}else{$m.TrimEndSeconds})
        CropLeft=$(if([string]::IsNullOrWhiteSpace([string]$m.CropLeft)){0}else{$m.CropLeft})
        CropRight=$(if([string]::IsNullOrWhiteSpace([string]$m.CropRight)){0}else{$m.CropRight})
        CropTop=$(if([string]::IsNullOrWhiteSpace([string]$m.CropTop)){0}else{$m.CropTop})
        CropBottom=$(if([string]::IsNullOrWhiteSpace([string]$m.CropBottom)){0}else{$m.CropBottom})
        AudioRepair=$audio
    })
}

$maxPos=0
foreach($m in $oldManifest){
    $n=0
    if([int]::TryParse([string]$m.Position,[ref]$n) -and $n -gt $maxPos){$maxPos=$n}
}
$newPos='{0:D4}' -f ($maxPos+10)

$newManifest.Add([pscustomobject][ordered]@{
    Position=$newPos
    SlotID="$CartID-SIGN-OFF"
    Role='SIGN_OFF'
    AssetID=$s.AssetID
    AssetType=$s.AssetType
    AssetSubtype=$s.Subtype
    Title=$s.Title
    Series=''
    Pool=$s.Pool
    Network=$s.Network
    SourcePath=$s.SourcePath
    DurationSeconds=$s.DurationSeconds
    ReusePolicy=$s.ReusePolicy
    ReviewStatus='UNREVIEWED'
    TrimStartSeconds=$resolved.TrimStartSeconds
    TrimEndSeconds=$resolved.TrimEndSeconds
    CropLeft=$resolved.CropLeft
    CropRight=$resolved.CropRight
    CropTop=$resolved.CropTop
    CropBottom=$resolved.CropBottom
    AudioRepair=$resolved.AudioRepair
})

$newManifestPath=Join-Path $newRevDir 'cart-manifest.csv'
Export-Utf8Csv $newManifest $newManifestPath

# Preserve immutable assignment history and carry current reservations forward.
$assignments=@()
if(Test-Path -LiteralPath $settings.AssignmentPath){$assignments=@(Import-Csv -LiteralPath $settings.AssignmentPath)}
$now=[DateTime]::UtcNow.ToString('o')
foreach($a in $assignments){
    if($a.CartID -eq $CartID -and [int]$a.Revision -eq $oldRev -and $a.AssignmentStatus -in @('RESERVED','ACTIVE')){
        $a.AssignmentStatus='SUPERSEDED'
        $a.ReleaseReason="Carried forward to $revName"
        $a.ReleasedUtc=$now
    }
}
$combined=New-Object 'System.Collections.Generic.List[object]'
foreach($a in $assignments){$combined.Add($a)}
foreach($m in $newManifest){
    $combined.Add([pscustomobject][ordered]@{
        AssignmentID=(Get-StableId 'ASG' "$CartID|$newRev|$($m.SlotID)|$($m.AssetID)")
        CartID=$CartID
        Revision=$newRev
        SlotID=$m.SlotID
        AssetID=$m.AssetID
        AssignmentStatus='RESERVED'
        AssignedUtc=$now
        ReleasedUtc=''
        ReleaseReason=''
    })
}
Export-Utf8Csv $combined $settings.AssignmentPath

$newCarts=New-Object 'System.Collections.Generic.List[object]'
foreach($c in $carts){
    if($c.CartID -eq $CartID){
        $newCarts.Add([pscustomobject][ordered]@{
            CartID=$c.CartID
            CurrentRevision=$newRev
            Status='DRAFT'
            Network=$c.Network
            DisplayName=$c.DisplayName
            CreatedUtc=$c.CreatedUtc
            UpdatedUtc=$now
            ManifestPath=$newManifestPath
        })
    }else{$newCarts.Add($c)}
}
Export-Utf8Csv $newCarts $settings.CartRegistryPath

$change=New-Object System.Collections.ArrayList
[void]$change.Add([pscustomobject][ordered]@{
    SlotID="$CartID-SIGN-OFF"
    ReplacementAssetID=$s.AssetID
    Action='ADD_SIGN_OFF'
    Notes='Configured handpicked sign-off appended to current cart'
})
Export-Utf8Csv $change (Join-Path $newRevDir 'changes-from-review.csv')

Write-Host ""
Write-Host "Created $CartID $revName with SIGN_OFF appended."
Write-Host "Sign-off: $($s.Title)"
Write-Host ("Repair recipe: trim {0}/{1}, crop L{2} R{3} T{4} B{5}, audio {6}" -f $resolved.TrimStartSeconds,$resolved.TrimEndSeconds,$resolved.CropLeft,$resolved.CropRight,$resolved.CropTop,$resolved.CropBottom,$resolved.AudioRepair)
Write-Host "Manifest: $newManifestPath"
Write-Host ""
Write-Host "Next:"
Write-Host "  .\Build-RetroCartReview.ps1 -CartID $CartID"
Write-Host "  .\Open-RetroCart.ps1 -CartID $CartID"
