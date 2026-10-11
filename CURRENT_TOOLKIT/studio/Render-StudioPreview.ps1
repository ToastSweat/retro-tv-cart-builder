[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Output,
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
    AGGRESSIVE = 'highpass=f=100,lowpass=f=9500,adeclip,adeclick,afftdn=nr=34:nf=-27:tn=1:gs=15,anlmdn=s=0.0035:p=0.003:r=0.008:m=13,dynaudnorm=f=180:g=9:p=0.86:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=6,aresample=44100'
    MAX        = 'highpass=f=110,lowpass=f=8500,adeclip,adeclick,afftdn=nr=40:nf=-25:tn=1:gs=18,anlmdn=s=0.005:p=0.004:r=0.010:m=15,dynaudnorm=f=160:g=8:p=0.84:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=5,aresample=44100'
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

$ffArgs = @('-hide_banner','-loglevel','error','-nostdin','-y')

if ($StartSeconds -gt 0) {
    $ffArgs += @('-ss', $StartSeconds.ToString($inv))
}

$ffArgs += @('-i', $Source)

if ($NoAudio) {
    $ffArgs += @(
        '-f','lavfi',
        '-i','anullsrc=channel_layout=stereo:sample_rate=44100'
    )
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
    $ffArgs += @(
        '-map','0:v:0',
        '-map','1:a:0',
        '-vf',$vf
    )
}

# Use the same encoding profile already proven stable in the cart review builder.
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

if ($NoAudio) {
    $ffArgs += '-shortest'
}

$ffArgs += @('-movflags','+faststart',$Output)

& ffmpeg @ffArgs
$ffExit = $LASTEXITCODE

if ($ffExit -ne 0 -or -not (Test-Path -LiteralPath $Output -PathType Leaf)) {
    Remove-Item -LiteralPath $Output -Force -ErrorAction SilentlyContinue
    Write-Error "Studio preview FFmpeg failed with exit code $ffExit."
    exit 1
}

# Reject partial/header-only MP4s before Studio tries to serve them.
& ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $Output | Out-Null
$probeExit = $LASTEXITCODE
if ($probeExit -ne 0) {
    Remove-Item -LiteralPath $Output -Force -ErrorAction SilentlyContinue
    Write-Error "Studio preview was created but ffprobe could not validate it."
    exit 1
}

exit 0
