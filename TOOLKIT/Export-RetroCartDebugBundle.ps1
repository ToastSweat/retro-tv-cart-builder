# Retro TV Cart Builder - diagnostic bundle exporter
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [Parameter(Mandatory=$true)][string]$ReviewCsv,
    [string]$SystemRoot='F:\[VIDEOS]\Retro TV Cart Builder',
    [string]$OutputDirectory="$HOME\Desktop"
)

$ErrorActionPreference='Stop'

function Copy-IfExists {
    param([string]$Source,[string]$Destination)
    if(-not [string]::IsNullOrWhiteSpace($Source) -and (Test-Path -LiteralPath $Source -PathType Leaf)){
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
    }
}

function To-Text($v){
    if($null -eq $v){return ''}
    return [string]$v
}

if(-not (Test-Path -LiteralPath $ReviewCsv -PathType Leaf)){
    throw "Review CSV not found: $ReviewCsv"
}

$stateDir=Join-Path $SystemRoot 'STATE'
$settingsPath=Join-Path $stateDir 'settings.json'
if(-not (Test-Path -LiteralPath $settingsPath)){throw "settings.json not found: $settingsPath"}

$settings=Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$carts=@(Import-Csv -LiteralPath $settings.CartRegistryPath)
$cart=@($carts | Where-Object {$_.CartID -eq $CartID} | Select-Object -First 1)
if($cart.Count -eq 0){throw "Unknown cart: $CartID"}
$cart=$cart[0]

$currentRev=[int]$cart.CurrentRevision
$currentManifestPath=[string]$cart.ManifestPath
$currentRevDir=Split-Path -Parent $currentManifestPath
$currentManifest=@(Import-Csv -LiteralPath $currentManifestPath)
$currentBySlot=@{};foreach($m in $currentManifest){$currentBySlot[$m.SlotID]=$m}

$review=@(Import-Csv -LiteralPath $ReviewCsv)

$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$bundleName="$CartID-debug-$stamp"
$temp=Join-Path $env:TEMP $bundleName
if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Recurse -Force}
[void][IO.Directory]::CreateDirectory($temp)
[void][IO.Directory]::CreateDirectory((Join-Path $temp 'current'))
[void][IO.Directory]::CreateDirectory((Join-Path $temp 'previous'))
[void][IO.Directory]::CreateDirectory((Join-Path $temp 'state'))

Copy-Item -LiteralPath $ReviewCsv -Destination (Join-Path $temp 'review-export.csv') -Force
Copy-IfExists $currentManifestPath (Join-Path $temp 'current\cart-manifest.csv')
Copy-IfExists (Join-Path $currentRevDir 'changes-from-review.csv') (Join-Path $temp 'current\changes-from-review.csv')
Copy-IfExists (Join-Path $currentRevDir 'REVIEW\review-manifest.csv') (Join-Path $temp 'current\review-manifest.csv')

$configPath=Join-Path $settings.ConfigDir ($CartID.ToUpperInvariant()+'.json')
Copy-IfExists $configPath (Join-Path $temp 'config.json')
Copy-IfExists $settingsPath (Join-Path $temp 'state\settings.json')

# Previous revision metadata, if present.
if($currentRev -gt 1){
    $prevRevName=('r{0:D3}' -f ($currentRev-1))
    $prevDir=Join-Path (Join-Path $settings.BuildRoot $CartID) $prevRevName
    Copy-IfExists (Join-Path $prevDir 'cart-manifest.csv') (Join-Path $temp 'previous\cart-manifest.csv')
    Copy-IfExists (Join-Path $prevDir 'changes-from-review.csv') (Join-Path $temp 'previous\changes-from-review.csv')
    Copy-IfExists (Join-Path $prevDir 'REVIEW\review-manifest.csv') (Join-Path $temp 'previous\review-manifest.csv')
}

# Keep only registry rows relevant to this cart/review.
$wanted=@{}
foreach($m in $currentManifest){if($m.AssetID){$wanted[$m.AssetID]=$true}}
foreach($r in $review){
    if($r.AssetID){$wanted[$r.AssetID]=$true}
    if($r.ReplacementAssetID){$wanted[$r.ReplacementAssetID]=$true}
}
$registry=@(Import-Csv -LiteralPath $settings.RegistryPath)
$registrySubset=@($registry | Where-Object {$wanted.ContainsKey($_.AssetID)})
$registrySubset | Export-Csv -LiteralPath (Join-Path $temp 'state\relevant-assets.csv') -NoTypeInformation -Encoding UTF8

$assignments=@()
if(Test-Path -LiteralPath $settings.AssignmentPath){
    $assignments=@(Import-Csv -LiteralPath $settings.AssignmentPath | Where-Object {$_.CartID -eq $CartID})
}
$assignments | Export-Csv -LiteralPath (Join-Path $temp 'state\cart-assignments.csv') -NoTypeInformation -Encoding UTF8

# Produce a direct requested-vs-current comparison.
$compare=New-Object System.Collections.ArrayList
foreach($r in $review){
    $m=$currentBySlot[$r.SlotID]
    [void]$compare.Add([pscustomobject][ordered]@{
        SlotID=$r.SlotID
        ReviewAssetID=$r.AssetID
        Action=$r.Action
        RequestedReplacement=$r.ReplacementAssetID
        CurrentAssetID=$(if($m){$m.AssetID}else{'<missing slot>'})
        RequestedTrimStart=$r.TrimStart
        CurrentTrimStart=$(if($m){$m.TrimStartSeconds}else{''})
        RequestedTrimEnd=$r.TrimEnd
        CurrentTrimEnd=$(if($m){$m.TrimEndSeconds}else{''})
        RequestedCropLeft=$r.CropLeft
        CurrentCropLeft=$(if($m){$m.CropLeft}else{''})
        RequestedCropRight=$r.CropRight
        CurrentCropRight=$(if($m){$m.CropRight}else{''})
        RequestedCropTop=$r.CropTop
        CurrentCropTop=$(if($m){$m.CropTop}else{''})
        RequestedCropBottom=$r.CropBottom
        CurrentCropBottom=$(if($m){$m.CropBottom}else{''})
        CurrentAudioRepair=$(if($m){$m.AudioRepair}else{''})
        ReviewNotes=$r.Notes
    })
}
$compare | Export-Csv -LiteralPath (Join-Path $temp 'requested-vs-current.csv') -NoTypeInformation -Encoding UTF8

$summary=@"
Retro TV Cart Builder diagnostic bundle
=======================================

CartID: $CartID
Current revision: r$('{0:D3}' -f $currentRev)
Current manifest: $currentManifestPath
Review CSV supplied: $ReviewCsv

This bundle contains METADATA ONLY.
It does not contain TV episodes, commercials, bumpers, review videos, or cached media.

Most useful files:
  review-export.csv
  requested-vs-current.csv
  current\cart-manifest.csv
  current\changes-from-review.csv
  current\review-manifest.csv
  previous\cart-manifest.csv
  state\relevant-assets.csv
  state\cart-assignments.csv
"@
Set-Content -LiteralPath (Join-Path $temp 'README.txt') -Value $summary -Encoding UTF8

[void][IO.Directory]::CreateDirectory($OutputDirectory)
$outZip=Join-Path $OutputDirectory ($bundleName+'.zip')
if(Test-Path -LiteralPath $outZip){Remove-Item -LiteralPath $outZip -Force}

Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $outZip -CompressionLevel Optimal
Remove-Item -LiteralPath $temp -Recurse -Force

Write-Host ""
Write-Host "Diagnostic bundle created:" -ForegroundColor Green
Write-Host $outZip
Write-Host ""
Write-Host "Upload that ZIP. It contains metadata only; no source media."
