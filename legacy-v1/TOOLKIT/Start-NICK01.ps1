# First-run convenience wrapper for the NICK01 reference cart.
[CmdletBinding()]
param(
    [string]$CommercialRoot='F:\[VIDEOS]\Commercials',
    [string]$SystemRoot='F:\[VIDEOS]\Retro TV Cart Builder',
    [string]$BuildRoot='F:\[VIDEOS]\Retro TV Builds'
)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'Initialize-RetroCartLibrary.ps1') -CommercialRoot $CommercialRoot -SystemRoot $SystemRoot -BuildRoot $BuildRoot
if($LASTEXITCODE){exit $LASTEXITCODE}
& (Join-Path $PSScriptRoot 'New-RetroCartPlan.ps1') -CartID NICK01 -SystemRoot $SystemRoot
if($LASTEXITCODE){exit $LASTEXITCODE}
& (Join-Path $PSScriptRoot 'Build-RetroCartReview.ps1') -CartID NICK01 -SystemRoot $SystemRoot
