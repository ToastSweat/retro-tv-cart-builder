# Retro TV Cart Builder v1.4.0 - audio repair audit
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [string]$SystemRoot='F:\[VIDEOS]\Retro TV Cart Builder'
)
$ErrorActionPreference='Stop'

$stateDir=Join-Path $SystemRoot 'STATE'
$settings=Get-Content -LiteralPath (Join-Path $stateDir 'settings.json') -Raw | ConvertFrom-Json
$carts=@(Import-Csv -LiteralPath $settings.CartRegistryPath)
$cart=@($carts|Where-Object{$_.CartID -eq $CartID}|Select-Object -First 1)
if($cart.Count -eq 0){throw "Unknown cart: $CartID"}

$revision=[int]$cart[0].CurrentRevision
$revName=('r{0:D3}' -f $revision)
$manifest=@(Import-Csv -LiteralPath $cart[0].ManifestPath)
$revDir=Split-Path -Parent $cart[0].ManifestPath
$reviewPath=Join-Path $revDir 'REVIEW\review-manifest.csv'
$review=@()
if(Test-Path -LiteralPath $reviewPath){$review=@(Import-Csv -LiteralPath $reviewPath)}
$reviewBySlot=@{};foreach($r in $review){$reviewBySlot[$r.SlotID]=$r}

$rows=New-Object System.Collections.ArrayList
foreach($m in $manifest){
    $requested=([string]$m.AudioRepair).Trim().ToUpperInvariant()
    if([string]::IsNullOrWhiteSpace($requested)){$requested='NONE'}
    $effective=$requested
    if($effective -eq 'LIGHT'){$effective='RESTORE'}

    if($effective -ne 'NONE'){
        $r=$reviewBySlot[$m.SlotID]
        [void]$rows.Add([pscustomobject][ordered]@{
            Position=$m.Position
            SlotID=$m.SlotID
            Title=$m.Title
            ManifestAudioRepair=$requested
            EffectiveAudioRepair=$effective
            ReviewBuilt=$(if($r){'YES'}else{'NO'})
            ReviewAppliedAudioRepair=$(if($r){$r.AppliedAudioRepair}else{''})
            ProxyPath=$(if($r){$r.ProxyPath}else{''})
        })
    }
}

Write-Host ""
Write-Host "$CartID $revName audio repair audit"
Write-Host "================================"
if($rows.Count -eq 0){
    Write-Host "No audio repairs are currently requested in the manifest."
    exit 0
}

$rows | Format-Table -AutoSize
Write-Host ""
Write-Host "Count: $($rows.Count)"
Write-Host ""
Write-Host "Expected behavior in v1.4.0:"
Write-Host "  LIGHT   -> treated as RESTORE (legacy v1.3.x manifests)"
Write-Host "  RESTORE -> declip + declick + denoise + dynamic leveling + loudness normalize"
Write-Host "  STRONG  -> stronger denoise/restoration after BAD_AUDIO is reported again"
Write-Host ""
Write-Host "If ReviewAppliedAudioRepair is blank or does not match EffectiveAudioRepair,"
Write-Host "rebuild the review:"
Write-Host "  .\Build-RetroCartReview.ps1 -CartID $CartID"
