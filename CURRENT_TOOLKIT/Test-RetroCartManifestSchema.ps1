# Retro TV Cart Builder v1.4.3 - current manifest schema check
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [string]$SystemRoot='F:\[VIDEOS]\Retro TV Cart Builder'
)
$ErrorActionPreference='Stop'

$settings=Get-Content -LiteralPath (Join-Path (Join-Path $SystemRoot 'STATE') 'settings.json') -Raw | ConvertFrom-Json
$carts=@(Import-Csv -LiteralPath $settings.CartRegistryPath)
$cart=@($carts|Where-Object{$_.CartID -eq $CartID}|Select-Object -First 1)
if($cart.Count -eq 0){throw "Unknown cart: $CartID"}
$rows=@(Import-Csv -LiteralPath $cart[0].ManifestPath)
if($rows.Count -eq 0){throw "Current manifest is empty."}

$required=@('Position','SlotID','Role','AssetID','AssetType','AssetSubtype','Title','Series','Pool','Network','SourcePath','DurationSeconds','ReusePolicy','ReviewStatus','TrimStartSeconds','TrimEndSeconds','CropLeft','CropRight','CropTop','CropBottom','AudioRepair')
$actual=@($rows[0].PSObject.Properties.Name)
$missing=@($required|Where-Object{$_ -notin $actual})

Write-Host ""
Write-Host "$CartID current manifest: $($cart[0].ManifestPath)"
Write-Host "Rows: $($rows.Count)"
if($missing.Count){
    Write-Host "Legacy/incomplete schema. Missing:" -ForegroundColor Yellow
    foreach($m in $missing){Write-Host "  $m"}
    Write-Host ""
    Write-Host "v1.4.3 Apply-RetroCartReview will normalize the next revision automatically."
}else{
    Write-Host "Manifest schema is current." -ForegroundColor Green
}
