# Register one handpicked branding clip without rescanning the entire branding archive.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Network,
    [Parameter(Mandatory=$true)][string]$Type,
    [string]$CartID = '',
    [string]$Notes = '',
    [string]$Year = '',
    [string]$SystemRoot = 'F:\[VIDEOS]\Retro TV Cart Builder',
    [string]$CommercialRoot = 'F:\[VIDEOS]\Commercials',
    [string]$FFprobe = 'ffprobe'
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
    $buf=New-Object System.Collections.ArrayList
    foreach($r in $Rows){[void]$buf.Add($r)}
    if($buf.Count -eq 0){Set-Content -LiteralPath $Path -Value $null -Encoding UTF8}
    else{$buf|Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8}
}
function Read-CsvSafe([string]$Path){
    if(Test-Path -LiteralPath $Path -PathType Leaf){return @(Import-Csv -LiteralPath $Path)}
    return @()
}

$item=Get-Item -LiteralPath $Path -ErrorAction Stop
$full=$item.FullName
$commercialFull=[IO.Path]::GetFullPath($CommercialRoot).TrimEnd('\')+'\'
if(-not $full.StartsWith($commercialFull,[StringComparison]::OrdinalIgnoreCase)){
    throw "Handpicked branding must live under $CommercialRoot so the library remains portable.`nCurrent file: $full"
}

$durationRaw=& $FFprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $full
$duration=0.0
if(-not [double]::TryParse((($durationRaw -join '').Trim()),[Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$duration)){
    throw "Could not determine duration with ffprobe: $full"
}

$stateDir=Join-Path $SystemRoot 'STATE'
[void][IO.Directory]::CreateDirectory($stateDir)
$csv=Join-Path $stateDir 'handpicked-branding.csv'
$rows=New-Object 'System.Collections.Generic.List[object]'
$found=$false
$assetId=Get-StableId 'HBR' $full

foreach($r in (Read-CsvSafe $csv)){
    if(([string]$r.SourcePath).Equals($full,[StringComparison]::OrdinalIgnoreCase)){
        $rows.Add([pscustomobject][ordered]@{
            AssetID=$assetId;Network=$Network.ToUpperInvariant();Type=$Type.ToUpperInvariant()
            Title=$item.Name;SourcePath=$full;DurationSeconds=[math]::Round($duration,3)
            Status='KEEP';Notes=$Notes;Year=$Year
        })
        $found=$true
    }else{$rows.Add($r)}
}
if(-not $found){
    $rows.Add([pscustomobject][ordered]@{
        AssetID=$assetId;Network=$Network.ToUpperInvariant();Type=$Type.ToUpperInvariant()
        Title=$item.Name;SourcePath=$full;DurationSeconds=[math]::Round($duration,3)
        Status='KEEP';Notes=$Notes;Year=$Year
    })
}
Export-Utf8Csv $rows $csv

if(-not [string]::IsNullOrWhiteSpace($CartID)){
    $configPath=Join-Path (Join-Path $PSScriptRoot 'config') ($CartID.ToUpperInvariant()+'.json')
    if(-not (Test-Path -LiteralPath $configPath)){throw "Cart config not found: $configPath"}
    $cfg=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if($Type.ToUpperInvariant() -eq 'SIGN_OFF'){
        if($cfg.PSObject.Properties.Name -contains 'SignOffAssetID'){$cfg.SignOffAssetID=$assetId}
        else{$cfg | Add-Member -NotePropertyName SignOffAssetID -NotePropertyValue $assetId}
        $cfg | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath -Encoding UTF8
        Write-Host "Configured $CartID to use this SIGN_OFF."
    }
}

Write-Host ""
Write-Host "Registered handpicked branding:"
Write-Host "  AssetID: $assetId"
Write-Host "  Type:    $($Type.ToUpperInvariant())"
Write-Host "  Network: $($Network.ToUpperInvariant())"
Write-Host "  File:    $full"
Write-Host ""
Write-Host "Now refresh the durable asset registry:"
Write-Host "  .\Initialize-RetroCartLibrary.ps1"
