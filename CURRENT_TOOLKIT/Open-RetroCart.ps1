# Open the current review dashboard for a cart safely when paths contain [brackets].
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [string]$SystemRoot='F:\[VIDEOS]\Retro TV Cart Builder'
)
$ErrorActionPreference='Stop'

$registry=Join-Path $SystemRoot 'STATE\cart-registry.csv'
if(-not (Test-Path -LiteralPath $registry)){throw "Cart registry not found: $registry"}

$cart=@(Import-Csv -LiteralPath $registry | Where-Object {$_.CartID -eq $CartID} | Select-Object -First 1)
if($cart.Count -eq 0){throw "Unknown cart: $CartID"}

$revDir=Split-Path $cart[0].ManifestPath -Parent
$review=Join-Path $revDir 'REVIEW\cart-review.html'

if(-not (Test-Path -LiteralPath $review)){
    throw "Current cart revision has no review dashboard yet: $review`nRun .\Build-RetroCartReview.ps1 -CartID $CartID first."
}

Write-Host "Opening $CartID revision $($cart[0].CurrentRevision):"
Write-Host $review
Invoke-Item -LiteralPath $review
