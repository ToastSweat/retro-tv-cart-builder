[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Output,
    [string]$StatusFile = '',
    [double]$StartSeconds = 0,
    [Parameter(Mandatory=$true)][double]$DurationSeconds,
    [int]$CropLeft = 0,
    [int]$CropRight = 0,
    [int]$CropTop = 0,
    [int]$CropBottom = 0,
    [ValidateSet('NONE','RESTORE','STRONG','AGGRESSIVE','MAX')]
    [string]$AudioRepair = 'NONE',
    [switch]$NoAudio
)

$ErrorActionPreference = 'Continue'
$inv = [System.Globalization.CultureInfo]::InvariantCulture

$audioFilters = @{
    NONE       = 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100'
    RESTORE    = 'highpass=f=70,lowpass=f=12500,adeclip,adeclick,afftdn=nr=18:nf=-32:tn=1:gs=8,dynaudnorm=f=250:g=15:p=0.90:m=6:c=1,loudnorm=I=-16:TP=-1.5:LRA=8,aresample=44100'
    STRONG     = 'highpass=f=90,lowpass=f=10500,adeclip,adeclick,afftdn=nr=28:nf=-28:tn=1:gs=12,anlmdn=s=0.002:p=0.002:r=0.006:m=11,dynaudnorm=f=200:g=11:p=0.88:m=4:c=1,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100'
    AGGRESSIVE = 'highpass=f=100,lowpass=f=9500,adeclip,adeclick,afftdn=nr=36:nf=-27:tn=1:gs=15,afftdn=nr=18:nf=-34:tn=1:gs=8,dynaudnorm=f=180:g=9:p=0.86:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=6,aresample=44100'
    MAX        = 'highpass=f=120,lowpass=f=8000,adeclip,adeclick,afftdn=nr=48:nf=-24:tn=1:gs=20,afftdn=nr=26:nf=-31:tn=1:gs=12,dynaudnorm=f=160:g=7:p=0.84:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=5,aresample=44100'
}

function Write-Status([bool]$success, $ffmpegExit, [string]$diagnostic) {
    if ([string]::IsNullOrWhiteSpace($StatusFile)) { return }
    $obj = [ordered]@{
        success = $success
        ffmpegExit = $ffmpegExit
        audioRepair = $AudioRepair
        source = $Source
        output = $Output
        diagnostic = $diagnostic
    }
    $obj | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StatusFile -Encoding UTF8
}

$vf = 'scale=618:480:force_original_aspect_ratio=decrease,pad=618:480:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30'
if (($CropLeft + $CropRight + $CropTop + $CropBottom) -gt 0) {
    $cropW = $CropLeft + $CropRight
    $cropH = $CropTop + $CropBottom
    $vf = "crop=iw-$cropW`:ih-$cropH`:$CropLeft`:$CropTop,$vf"
}

$outDir = Split-Path -Parent $Output
if ($outDir) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
Remove-Item -LiteralPath $Output -Force -ErrorAction SilentlyContinue

# Let FFmpeg write its own report file. This gives us useful diagnostics without
# routing its live stderr through a PowerShell pipeline (which caused the earlier
# native crash in the cart builder).
$reportDir = if ($env:TEMP -and (Test-Path -LiteralPath $env:TEMP)) { $env:TEMP } else { $outDir }
$reportName = "retrotv-studio-$([guid]::NewGuid().ToString('N')).log"
$reportPath = Join-Path $reportDir $reportName
$oldReport = $env:FFREPORT
$env:FFREPORT = "file=$reportName`:level=32"

$ffArgs = @('-hide_banner','-loglevel','error','-report','-nostdin','-y')

if ($StartSeconds -gt 0) {
    $ffArgs += @('-ss', $StartSeconds.ToString($inv))
}

$ffArgs += @('-i', $Source)

if ($NoAudio) {
    $ffArgs += @('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100')
}

$ffArgs += @('-t', $DurationSeconds.ToString($inv))

if (-not $NoAudio) {
    $ffArgs += @(
        '-map','0:v:0',
        '-map','0:a:0',
        '-vf',$vf,
        '-af',$audioFilters[$AudioRepair]
    )
} else {
    $ffArgs += @('-map','0:v:0','-map','1:a:0','-vf',$vf)
}

$ffArgs += @(
    '-c:v','libx264',
    '-preset','medium',
    '-crf','20',
    '-pix_fmt','yuv420p',
    '-r','30',
    '-g','30',
    '-keyint_min','30',
    '-sc_threshold','0',
    '-c:a','aac',
    '-b:a','128k',
    '-ar','44100',
    '-ac','2'
)

if ($NoAudio) { $ffArgs += '-shortest' }

$ffArgs += @('-movflags','+faststart',$Output)

$oldLoc = Get-Location
try {
    Set-Location -LiteralPath $reportDir
    & ffmpeg @ffArgs
    $ffExit = $LASTEXITCODE
} finally {
    Set-Location -LiteralPath $oldLoc.Path
    if ($null -eq $oldReport) { Remove-Item Env:FFREPORT -ErrorAction SilentlyContinue }
    else { $env:FFREPORT = $oldReport }
}

$diagnostic = ''
if (Test-Path -LiteralPath $reportPath) {
    try {
        $lines = Get-Content -LiteralPath $reportPath -ErrorAction SilentlyContinue
        $diagnostic = (($lines | Select-Object -Last 18) -join [Environment]::NewLine).Trim()
    } catch {}
}

if ($ffExit -ne 0 -or -not (Test-Path -LiteralPath $Output -PathType Leaf)) {
    Remove-Item -LiteralPath $Output -Force -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($diagnostic)) {
        $diagnostic = 'FFmpeg did not leave a report. The original native exit code is shown above.'
    }
    Write-Status $false $ffExit $diagnostic
    Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
    exit 1
}

& ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $Output | Out-Null
$probeExit = $LASTEXITCODE
if ($probeExit -ne 0) {
    Remove-Item -LiteralPath $Output -Force -ErrorAction SilentlyContinue
    Write-Status $false $probeExit 'FFmpeg returned success, but ffprobe could not validate the preview MP4.'
    Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Status $true $ffExit ''
Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
exit 0
