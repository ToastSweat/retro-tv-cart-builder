[CmdletBinding()]
param(
    [string]$SystemRoot = 'F:\[VIDEOS]\retro-tv-cart-builder',
    [string]$CartID = 'CN03'
)

$ErrorActionPreference='Stop'

$settings = Get-Content -LiteralPath (Join-Path $SystemRoot 'STATE\settings.json') -Raw | ConvertFrom-Json
$registry = @(Import-Csv -LiteralPath $settings.RegistryPath)

$choices = @(
    $registry |
    Where-Object {
        $_.AssetType -eq 'BRANDING' -and
        $_.Network -eq 'CN' -and
        $_.Subtype -eq 'SIGN_OFF' -and
        $_.SourceStatus -eq 'READY'
    } |
    ForEach-Object {
        $d=0.0
        [void][double]::TryParse(
            [string]$_.DurationSeconds,
            [System.Globalization.NumberStyles]::Float,
            [cultureinfo]::InvariantCulture,
            [ref]$d
        )
        [pscustomobject]@{
            AssetID=$_.AssetID
            DurationSeconds=$d
            Title=$_.Title
        }
    } |
    Sort-Object DurationSeconds -Descending, Title
)

if($choices.Count -eq 0){
    throw 'No READY CN SIGN_OFF assets are currently registered.'
}

Write-Host ''
Write-Host 'READY Cartoon Network sign-offs:'
Write-Host ''

for($i=0; $i -lt $choices.Count; $i++){
    Write-Host ("[{0}] {1:N1}s  {2}" -f ($i+1),$choices[$i].DurationSeconds,$choices[$i].Title)
}

Write-Host ''
$selection = Read-Host "Choose sign-off number for $CartID (Enter = 1)"
if([string]::IsNullOrWhiteSpace($selection)){ $selection='1' }

$n=0
if(-not [int]::TryParse($selection,[ref]$n) -or $n -lt 1 -or $n -gt $choices.Count){
    throw "Invalid selection: $selection"
}

$chosen=$choices[$n-1]
$configPath=Join-Path $settings.ConfigDir ($CartID.ToUpperInvariant()+'.json')

if(-not (Test-Path -LiteralPath $configPath -PathType Leaf)){
    throw "Config not found: $configPath"
}

$cfg=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

if($cfg.PSObject.Properties.Name -contains 'SignOffAssetID'){
    $cfg.SignOffAssetID=$chosen.AssetID
}else{
    $cfg | Add-Member -NotePropertyName SignOffAssetID -NotePropertyValue $chosen.AssetID
}

$cfg | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $configPath -Encoding UTF8

Write-Host ''
Write-Host "CN03 sign-off configured:"
Write-Host "  $($chosen.AssetID)"
Write-Host "  $($chosen.Title)"
