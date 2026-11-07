# Copy completed USB-ready FINAL clips into ShagTV/<CartID>.
[CmdletBinding()]
param(
    [string]$SystemRoot = 'F:\[VIDEOS]\retro-tv-cart-builder',
    [string]$Destination = 'F:\[VIDEOS]\ShagTV',
    [switch]$VerifyHash
)
$ErrorActionPreference = 'Stop'
$settings = Get-Content -LiteralPath (Join-Path $SystemRoot 'STATE/settings.json') -Raw | ConvertFrom-Json
$carts = @(Import-Csv -LiteralPath $settings.CartRegistryPath)
$copied = 0; $unchanged = 0; $completed = 0; $skipped = 0

foreach ($cart in ($carts | Sort-Object CartID)) {
    if ($cart.Status -ne 'BUILT') {
        Write-Host "Skipping $($cart.CartID): current revision is $($cart.Status)."
        $skipped++; continue
    }
    $cartID = [string]$cart.CartID
    if ($cartID -notmatch '^[A-Za-z0-9_-]+$') { throw "Unexpected cart ID: $cartID" }
    $finalDir = Join-Path (Split-Path -Parent $cart.ManifestPath) 'FINAL'
    $finalManifest = Join-Path $finalDir 'cart-final-manifest.csv'
    if (-not (Test-Path -LiteralPath $finalManifest -PathType Leaf)) {
        Write-Warning "Skipping ${cartID}: current FINAL manifest not found."
        $skipped++; continue
    }
    $rows = @(Import-Csv -LiteralPath $finalManifest | Sort-Object Position)
    if (-not $rows.Count) { throw "Empty FINAL manifest: $finalManifest" }
    $targetDir = Join-Path $Destination $cartID
    if ([IO.Path]::GetFullPath($targetDir).TrimEnd('\','/') -eq [IO.Path]::GetFullPath($finalDir).TrimEnd('\','/')) {
        throw 'Source and destination must be different folders.'
    }
    # Validate the entire cart before starting its copy.
    $expected = @{}
    foreach ($row in $rows) {
        $name = [string]$row.FileName
        if (-not $name -or [IO.Path]::GetFileName($name) -ne $name -or [IO.Path]::GetExtension($name) -ne '.mp4' -or $expected.ContainsKey($name)) {
            throw "Invalid or duplicate FINAL filename for ${cartID}: $name"
        }
        $expected[$name] = $true
        $source = Join-Path $finalDir $name
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing FINAL clip: $source" }
        $info = Get-Item -LiteralPath $source
        if ($info.Length -le 0 -or ($row.Bytes -and $info.Length -ne [long]$row.Bytes)) { throw "FINAL clip size does not match manifest: $source" }
    }
    # Never mix stale files from a different revision into a cart folder.
    if (Test-Path -LiteralPath $targetDir) {
        $extra = @(Get-ChildItem -LiteralPath $targetDir -File -Filter '*.mp4' | Where-Object { -not $expected.ContainsKey($_.Name) })
        if ($extra.Count) {
            Write-Warning "Skipping ${cartID}: $targetDir contains clips absent from the current FINAL. Move that old cart folder elsewhere, then rerun. Nothing was deleted."
            $skipped++; continue
        }
    }
    [void][IO.Directory]::CreateDirectory($targetDir)
    Write-Host "`n$cartID r$('{0:D3}' -f [int]$cart.CurrentRevision): $($rows.Count) clips -> $targetDir" -ForegroundColor Cyan
    $index = 0
    foreach ($row in $rows) {
        $index++
        $source = Join-Path $finalDir $row.FileName
        $target = Join-Path $targetDir $row.FileName
        $sourceInfo = Get-Item -LiteralPath $source
        Write-Progress -Activity "Copying $cartID" -Status "$index / $($rows.Count): $($row.FileName)" -PercentComplete (($index-1)*100/$rows.Count)
        $same = $false
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            $targetInfo = Get-Item -LiteralPath $target
            $same = $targetInfo.Length -eq $sourceInfo.Length -and $targetInfo.LastWriteTimeUtc -eq $sourceInfo.LastWriteTimeUtc
            if ($same -and $VerifyHash) {
                $same = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
            }
        }
        if ($same) { $unchanged++; continue }
        $temporary = Join-Path $targetDir ('shagtv-copy-' + [guid]::NewGuid().ToString('N') + '.partial')
        try {
            # .NET file operations use literal paths, including [VIDEOS].
            [IO.File]::Copy($source,$temporary,$false)
            if ((Get-Item -LiteralPath $temporary).Length -ne $sourceInfo.Length) { throw "Copy size mismatch: $source" }
            if ($VerifyHash -and (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash) { throw "Copy checksum mismatch: $source" }
            if (Test-Path -LiteralPath $target) { [IO.File]::Replace($temporary,$target,[NullString]::Value) }
            else { [IO.File]::Move($temporary,$target) }
            [IO.File]::SetLastWriteTimeUtc($target,$sourceInfo.LastWriteTimeUtc)
            $copied++
        }
        finally {
            if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        }
    }
    Write-Progress -Activity "Copying $cartID" -Completed
    $completed++
}
Write-Host "`nDone. Carts copied/checked: $completed. Files copied: $copied. Unchanged: $unchanged. Carts skipped: $skipped." -ForegroundColor Green
Write-Host "Destination: $Destination"
