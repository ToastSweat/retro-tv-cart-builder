# Register one episode as a durable replacement-pool asset without adding it
# to a cart's planned lineup.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Network,
    [Parameter(Mandatory=$true)][string]$Series,
    [string]$Title = '',
    [string[]]$BrandingKeywords = @(),
    [string]$Notes = '',
    [string]$Year = '',
    [string]$SystemRoot = 'F:\[VIDEOS]\Retro TV Cart Builder',
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
    foreach($row in $Rows){[void]$buf.Add($row)}
    if($buf.Count -eq 0){Set-Content -LiteralPath $Path -Value $null -Encoding UTF8}
    else{$buf|Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8}
}
function Read-CsvSafe([string]$Path){
    if(Test-Path -LiteralPath $Path -PathType Leaf){return @(Import-Csv -LiteralPath $Path)}
    return @()
}

$item=Get-Item -LiteralPath $Path -ErrorAction Stop
$full=$item.FullName
if([string]::IsNullOrWhiteSpace($Title)){$Title=$item.BaseName}

$durationRaw=& $FFprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $full
$duration=0.0
if(-not [double]::TryParse((($durationRaw -join '').Trim()),[Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$duration)){
    throw "Could not determine duration with ffprobe: $full"
}

$stateDir=Join-Path $SystemRoot 'STATE'
[void][IO.Directory]::CreateDirectory($stateDir)
$csv=Join-Path $stateDir 'handpicked-episodes.csv'
$rows=New-Object 'System.Collections.Generic.List[object]'
$assetId=Get-StableId 'EP' $full
$found=$false
$keywordText=(@($BrandingKeywords|Where-Object{$_}) -join ';')

foreach($row in (Read-CsvSafe $csv)){
    if(([string]$row.SourcePath).Equals($full,[StringComparison]::OrdinalIgnoreCase)){
        $rows.Add([pscustomobject][ordered]@{
            AssetID=$assetId
            Network=$Network.ToUpperInvariant()
            Series=$Series
            Title=$Title
            SourcePath=$full
            DurationSeconds=[math]::Round($duration,3)
            Status='KEEP'
            BrandingKeywords=$keywordText
            Notes=$Notes
            Year=$Year
        })
        $found=$true
    }else{
        $rows.Add($row)
    }
}
if(-not $found){
    $rows.Add([pscustomobject][ordered]@{
        AssetID=$assetId
        Network=$Network.ToUpperInvariant()
        Series=$Series
        Title=$Title
        SourcePath=$full
        DurationSeconds=[math]::Round($duration,3)
        Status='KEEP'
        BrandingKeywords=$keywordText
        Notes=$Notes
        Year=$Year
    })
}
Export-Utf8Csv $rows $csv

Write-Host ""
Write-Host "Registered handpicked episode:"
Write-Host "  AssetID: $assetId"
Write-Host "  Network: $($Network.ToUpperInvariant())"
Write-Host "  Series:  $Series"
Write-Host "  Title:   $Title"
Write-Host "  File:    $full"
Write-Host ""
Write-Host "Now refresh the durable asset registry:"
Write-Host "  .\Initialize-RetroCartLibrary.ps1"
