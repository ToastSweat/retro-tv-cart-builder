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

$registry=@(Import-Csv -LiteralPath $settings.RegistryPath)
$signoff=@($registry | Where-Object {$_.AssetID -eq [string]$cfg.SignOffAssetID} | Select-Object -First 1)
if($signoff.Count -eq 0){throw "Configured sign-off $($cfg.SignOffAssetID) is not in asset-registry.csv. Run Initialize-RetroCartLibrary.ps1."}
$s=$signoff[0]
if($s.SourceStatus -ne 'READY'){throw "Configured sign-off is not READY: $($s.AssetID) $($s.Title)"}
if($s.AssetType -ne 'BRANDING'){throw "Configured sign-off must be BRANDING: $($s.AssetID)"}
if($s.Network -and $s.Network -ne $cart[0].Network){throw "Sign-off network '$($s.Network)' does not match cart network '$($cart[0].Network)'."}

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
foreach($m in $oldManifest){$newManifest.Add($m)}

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
    TrimStartSeconds=0
    TrimEndSeconds=0
    CropLeft=0
    CropRight=0
    CropTop=0
    CropBottom=0
    AudioRepair='NONE'
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
Write-Host "Manifest: $newManifestPath"
Write-Host ""
Write-Host "Next:"
Write-Host "  .\Build-RetroCartReview.ps1 -CartID $CartID"
Write-Host "  .\Open-RetroCart.ps1 -CartID $CartID"
