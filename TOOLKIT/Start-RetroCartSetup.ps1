<#
.SYNOPSIS
Starts the Phase 2 workspace hub and project settings application.
.DESCRIPTION
Does not replace or start the existing TV Studio. Keep this window open while using the hub.
.PARAMETER AppDataDir
Optional application preferences folder, primarily for isolated testing. Project media stays elsewhere.
.PARAMETER NoBrowser
Start the local server without opening a browser.
#>
[CmdletBinding()]
param(
    [ValidateRange(1,65535)][int]$Port = 17872,
    [string]$AppDataDir = '',
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$server = Join-Path $PSScriptRoot 'setup\server.js'
if (-not (Test-Path -LiteralPath $server -PathType Leaf)) { throw "Setup server not found: $server" }
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required for this development checkpoint. The public installer will supply runtime tools in the release phase.' }
$nodeArgs = @($server, '--port', [string]$Port)
if ($AppDataDir) { $nodeArgs += @('--app-data', $AppDataDir) }
$argLine = ($nodeArgs | ForEach-Object {
    if ($_.Contains('"')) { throw 'Double quotes are not allowed inside launcher path arguments.' }
    '"' + ($_ -replace '(\\+)$', '$1$1') + '"'
}) -join ' '
$url = "http://127.0.0.1:$Port/"
$proc = $null
try {
    # Explicit neutral working directory: bracketed repository paths must not be interpreted as wildcards.
    $proc = Start-Process -FilePath $node.Source -ArgumentList $argLine -WorkingDirectory $env:USERPROFILE -NoNewWindow -PassThru
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $ready = $false
    while ($clock.Elapsed.TotalSeconds -lt 20) {
        if ($proc.HasExited) { throw "Setup exited before readiness (code $($proc.ExitCode)). The port may already be in use; see the server message above." }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri ($url + 'api/bootstrap') -TimeoutSec 1
            $boot = $response.Content | ConvertFrom-Json
            if ($boot.phase -eq '2' -and $boot.csrfToken) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 150 }
    }
    if (-not $ready) { throw 'Setup did not become ready within 20 seconds. No project was initialized.' }
    if ($proc.HasExited) { throw 'The setup process exited during startup. Do not use an unrelated server on this port.' }
    Write-Host 'Retro TV - Phase 2 hub and project settings' -ForegroundColor Cyan
    Write-Host $url
    Write-Host 'Leave this window open. Ctrl+C stops this setup server. The original Studio launcher is unchanged.'
    if (-not $NoBrowser) { Start-Process -FilePath $url -WorkingDirectory $env:USERPROFILE }
    Wait-Process -Id $proc.Id
} finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}
