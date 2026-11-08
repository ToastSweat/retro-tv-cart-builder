[CmdletBinding()]
param([string]$SystemRoot='F:\[VIDEOS]\retro-tv-cart-builder')
$ErrorActionPreference='Stop'
$s=Get-Content -LiteralPath (Join-Path $SystemRoot 'STATE\settings.json') -Raw | ConvertFrom-Json
$curationPath=Join-Path $s.CurationDir 'branding-curation.csv'
$registry=@(Import-Csv -LiteralPath $s.RegistryPath)
$curation=@(Import-Csv -LiteralPath $curationPath)
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
Copy-Item -LiteralPath $curationPath -Destination "$curationPath.backup-$stamp"
Copy-Item -LiteralPath $s.RegistryPath -Destination "$($s.RegistryPath).backup-$stamp"
$targets=@($registry | Where-Object {
    $_.Network -eq 'CN' -and $_.AssetType -eq 'BRANDING' -and
    $_.Subtype -eq 'BUMPER_IN' -and $_.SourceStatus -eq 'UNREVIEWED' -and
    $_.Title -match 'Courage|Johnny Bravo|Cow and Chicken'
} | Sort-Object Title)
foreach($r in $targets){
    Write-Host "`n$($r.Title)" -ForegroundColor Cyan
    if(-not(Test-Path -LiteralPath $r.SourcePath)){Write-Host 'Missing source; skipped';continue}
    $row=@($curation | Where-Object {$_.Id -eq $r.OriginalID})
    if($row.Count -ne 1){throw "Cannot uniquely resolve curation entry for $($r.AssetID)"}
    # Open the registered source without modifying it.
    Start-Process -FilePath $r.SourcePath -WorkingDirectory $env:TEMP
    $answer=Read-Host 'G = approve as-is, Enter = leave unchanged, Q = stop'
    if($answer -eq 'Q'){break}
    if($answer -eq 'G'){
        $row[0].Status='KEEP';$r.SourceStatus='READY';$r.CuratedStatus='KEEP'
        $curation | Export-Csv -LiteralPath $curationPath -NoTypeInformation -Encoding UTF8
        $registry | Export-Csv -LiteralPath $s.RegistryPath -NoTypeInformation -Encoding UTF8
        Write-Host 'Approved.' -ForegroundColor Green
    }
}
Write-Host 'Review complete. Existing exclusions and repair flags were preserved.'
