# Select the bundled FFmpeg 8.1 backend before starting the existing Studio launcher.
# Windows PowerShell 5.1 compatible. Does not change global PATH or application code.
[CmdletBinding()]
param(
    [string]$CartID = '',
    [string]$SystemRoot = '',
    [int]$Port = 17871
)
$ErrorActionPreference = 'Stop'
$runtimeRoot = Join-Path $PSScriptRoot 'runtime'
$configPath = Join-Path $runtimeRoot 'media-backend.json'
$launcher = Join-Path $PSScriptRoot 'Start-RetroCartStudio.ps1'
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw "Existing Studio launcher missing: $launcher" }
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw "Bundled backend configuration missing: $configPath. Studio was not started; no fallback to system FFmpeg." }
$backend = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
function Resolve-BackendTool($Spec,[string]$Name) {
    if (-not $Spec -or [string]::IsNullOrWhiteSpace([string]$Spec.path)) { throw "No $Name path in $configPath" }
    $base = [IO.Path]::GetFullPath($runtimeRoot).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $path = [IO.Path]::GetFullPath((Join-Path $runtimeRoot ([string]$Spec.path)))
    if (-not $path.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)) { throw "$Name must be inside the bundled runtime folder: $path" }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Bundled $Name missing: $path. Studio was not started; no fallback to system FFmpeg." }
    if ([string]::IsNullOrWhiteSpace([string]$Spec.sha256)) { throw "No checksum configured for bundled $Name." }
    $actualHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if ($actualHash -ne [string]$Spec.sha256) { throw "Bundled $Name checksum mismatch: $path. Restore the bundled backend before launching." }
    return $path
}
$ffmpeg = Resolve-BackendTool $backend.ffmpeg 'ffmpeg'
$ffprobe = Resolve-BackendTool $backend.ffprobe 'ffprobe'
$bin = Split-Path -Parent $ffmpeg
if ((Split-Path -Parent $ffprobe) -ne $bin) { throw 'Bundled ffmpeg and ffprobe must be in the same bin directory.' }
foreach ($tool in @($ffmpeg,$ffprobe)) {
    $versionOutput = @(& $tool -version)
    if ($LASTEXITCODE -ne 0 -or -not $versionOutput.Count -or [string]$versionOutput[0] -notmatch '^ff(?:mpeg|probe) version n?8\.1(?:\.|[-\s])') {
        throw "Expected bundled FFmpeg 8.1 backend, got: $($versionOutput -join ' ')"
    }
    Write-Host ([string]$versionOutput[0]) -ForegroundColor Cyan
}
Write-Host "Media backend: $bin" -ForegroundColor Cyan
Write-Host 'Pinned for this Studio session, including preview, audio processing and child build scripts.'
$oldPath = $env:PATH
$locationPushed = $false
try {
    $env:PATH = $bin + [IO.Path]::PathSeparator + $oldPath
    $neutral = if ($env:TEMP -and (Test-Path -LiteralPath $env:TEMP -PathType Container)) { $env:TEMP } else { $env:WINDIR }
    if (-not $neutral) { throw 'No neutral launch directory is available.' }
    Push-Location -LiteralPath $neutral
    $locationPushed = $true
    # Forward supported Studio parameters without constructing a command string.
    $studioParams = @{CartID=$CartID;SystemRoot=$SystemRoot;Port=$Port}
    & $launcher @studioParams
} finally {
    if ($locationPushed) { Pop-Location }
    $env:PATH = $oldPath
}
