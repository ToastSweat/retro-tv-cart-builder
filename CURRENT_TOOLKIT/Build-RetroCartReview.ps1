# Retro TV Cart Builder v1 -- normalize proxies, make continuous review video and QA dashboard
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [string]$SystemRoot = 'F:\[VIDEOS]\Retro TV Cart Builder',
    [string]$FFmpeg = 'ffmpeg',
    [string]$FFprobe = 'ffprobe',
    [switch]$ReencodeAll,
    [switch]$SkipCropDetect
)
$ErrorActionPreference = 'Stop'

function Get-StableId {
    param([string]$Prefix, [string]$Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
        $hex = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
        return "$Prefix-$($hex.Substring(0,12))"
    } finally {
        $sha.Dispose()
    }
}

function Export-Utf8Csv {
    param([Parameter(Mandatory=$true)]$Rows, [Parameter(Mandatory=$true)][string]$Path)
    $parent = Split-Path -Parent $Path
    if ($parent) { [void][IO.Directory]::CreateDirectory($parent) }

    # Windows PowerShell 5.1 has a nasty binder bug around Generic.List[object]
    # combined with @(...). Avoid the array-subexpression operator entirely.
    $buffer = New-Object System.Collections.ArrayList
    foreach ($row in $Rows) {
        [void]$buffer.Add($row)
    }

    if ($buffer.Count -eq 0) {
        Set-Content -LiteralPath $Path -Value $null -Encoding UTF8
    } else {
        $buffer | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
    }
}

function Read-CsvSafe {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) { return @(Import-Csv -LiteralPath $Path) }
    return @()
}

foreach ($cmd in @($FFmpeg,$FFprobe)) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd is not on PATH." }
}
$stateDir = Join-Path $SystemRoot 'STATE'
$settings = Get-Content -LiteralPath (Join-Path $stateDir 'settings.json') -Raw | ConvertFrom-Json
$carts = @(Import-Csv -LiteralPath $settings.CartRegistryPath)
$cart = @($carts | Where-Object {$_.CartID -eq $CartID} | Select-Object -First 1)
if ($cart.Count -eq 0) { throw "Unknown cart $CartID. Run New-RetroCartPlan.ps1 first." }
$revision = [int]$cart[0].CurrentRevision
$revDir = Split-Path -Parent $cart[0].ManifestPath
$manifest = @(Import-Csv -LiteralPath $cart[0].ManifestPath)
if ($manifest.Count -eq 0) { throw "Manifest is empty." }

$reviewDir = Join-Path $revDir 'REVIEW'
[void][IO.Directory]::CreateDirectory($reviewDir)
$cacheDir = Join-Path $SystemRoot 'CACHE\review-v1'
[void][IO.Directory]::CreateDirectory($cacheDir)

$profileText = 'review-v1|618x480|30fps|h264-crf20|gop30|aac128|44100-stereo|loudnorm-16|-1.5'
$vf = 'scale=618:480:force_original_aspect_ratio=decrease,pad=618:480:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30'
$af = 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100'

# Audio restoration profiles.
# RESTORE is intentionally much more substantial than the old v1.3.x "LIGHT"
# pass: declip, declick, broadband denoise, dynamic level correction, then final
# loudness normalization.
$audioRepairProfileVersion = 'audio-restore-v2'
$afRepairRestore = 'highpass=f=70,lowpass=f=12500,adeclip,adeclick,afftdn=nr=18:nf=-32:tn=1:gs=8,dynaudnorm=f=250:g=15:p=0.90:m=6:c=1,loudnorm=I=-16:TP=-1.5:LRA=8,aresample=44100'
$afRepairStrong = 'highpass=f=90,lowpass=f=10500,adeclip,adeclick,afftdn=nr=28:nf=-28:tn=1:gs=12,anlmdn=s=0.002:p=0.002:r=0.006:m=11,dynaudnorm=f=200:g=11:p=0.88:m=4:c=1,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100'
$afRepairAggressive = 'highpass=f=100,lowpass=f=9500,adeclip,adeclick,afftdn=nr=34:nf=-27:tn=1:gs=15,anlmdn=s=0.0035:p=0.003:r=0.008:m=13,dynaudnorm=f=180:g=9:p=0.86:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=6,aresample=44100'
$afRepairMax = 'highpass=f=110,lowpass=f=8500,adeclip,adeclick,afftdn=nr=40:nf=-25:tn=1:gs=18,anlmdn=s=0.005:p=0.004:r=0.010:m=15,dynaudnorm=f=160:g=8:p=0.84:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=5,aresample=44100'

function To-DoubleOrZero($value) {
    $d=0.0
    [void][double]::TryParse(([string]$value),[System.Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$d)
    return $d
}
function Get-FileCacheKey(
    [string]$source,[double]$trimStart,[double]$trimEnd,
    [int]$cropLeft,[int]$cropRight,[int]$cropTop,[int]$cropBottom,
    [string]$audioRepair
) {
    $f = Get-Item -LiteralPath $source -ErrorAction Stop

    # Preserve every existing NONE cache key. Only repaired-audio proxies are
    # invalidated when the restoration algorithm changes.
    $audioKey = "audio=$audioRepair"
    if($audioRepair -ne 'NONE'){
        $audioKey += "|repairProfile=$audioRepairProfileVersion"
    }

    return Get-StableId 'PX' ("$source|$($f.Length)|$($f.LastWriteTimeUtc.Ticks)|trim=$trimStart,$trimEnd|crop=$cropLeft,$cropRight,$cropTop,$cropBottom|$audioKey|$profileText")
}
function Get-VideoDimensions([string]$source) {
    $raw = & $FFprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x $source 2>$null
    $s = (($raw -join '').Trim())
    if($s -match '^(\d+)x(\d+)$'){
        return [pscustomobject]@{Width=[int]$matches[1];Height=[int]$matches[2]}
    }
    return $null
}
function Get-CropSuggestion([string]$source,[double]$duration) {
    if($SkipCropDetect){ return $null }
    $dims = Get-VideoDimensions $source
    if(-not $dims){ return $null }

    # Sample multiple regions of the clip so fades/title cards do not dominate.
    $samples = New-Object System.Collections.ArrayList
    if($duration -le 12){
        [void]$samples.Add([pscustomobject]@{Start=[math]::Max(0.3,$duration*0.15);Length=[math]::Max(2,[math]::Min(6,$duration*0.65))})
    } else {
        foreach($fraction in @(0.18,0.50,0.82)){
            $start=[math]::Max(1,[math]::Min($duration-5,$duration*$fraction))
            [void]$samples.Add([pscustomobject]@{Start=$start;Length=[math]::Min(5,[math]::Max(2,$duration-$start-0.2))})
        }
    }

    $counts=@{}
    foreach($sample in $samples){
        $startText=$sample.Start.ToString([cultureinfo]::InvariantCulture)
        $lenText=$sample.Length.ToString([cultureinfo]::InvariantCulture)
        # FFmpeg writes normal diagnostic/cropdetect output to STDERR.
        # Windows PowerShell 5.1 can promote redirected native STDERR into a
        # NativeCommandError when the script-wide ErrorActionPreference is Stop.
        # Temporarily relax it while we intentionally capture FFmpeg's log.
        $oldEap = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $log = & $FFmpeg -hide_banner -loglevel info -nostdin -ss $startText -i $source -t $lenText `
                -vf 'cropdetect=limit=24:round=2:reset=0' -an -f null NUL 2>&1
        }
        finally {
            $ErrorActionPreference = $oldEap
        }

        foreach($line in $log){
            $s=[string]$line
            if($s -match 'crop=(\d+):(\d+):(\d+):(\d+)'){
                $key="$($matches[1]):$($matches[2]):$($matches[3]):$($matches[4])"
                if(-not $counts.ContainsKey($key)){$counts[$key]=0}
                $counts[$key]++
            }
        }
    }
    if($counts.Count -eq 0){ return $null }

    $best=$counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
    $parts=$best.Key.Split(':')
    $w=[int]$parts[0];$h=[int]$parts[1];$x=[int]$parts[2];$y=[int]$parts[3]
    $left=$x;$top=$y;$right=[math]::Max(0,$dims.Width-($x+$w));$bottom=[math]::Max(0,$dims.Height-($y+$h))

    $removedArea = 1.0 - (($w*$h) / [double]($dims.Width*$dims.Height))
    # Ignore microscopic encoder-edge crops; flag meaningful baked borders.
    if($removedArea -lt 0.02 -and ($left+$right+$top+$bottom) -lt 8){ return $null }

    return [pscustomobject]@{
        Left=$left;Right=$right;Top=$top;Bottom=$bottom
        SourceWidth=$dims.Width;SourceHeight=$dims.Height
        CropWidth=$w;CropHeight=$h;RemovedArea=[math]::Round($removedArea,4)
        ConfidenceCount=[int]$best.Value
    }
}
function Has-Audio([string]$source) {
    $s = & $FFprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 $source 2>$null
    return -not [string]::IsNullOrWhiteSpace(($s -join ''))
}
function Test-Duration([string]$source) {
    $oldEap=$ErrorActionPreference
    try{
        # Windows PowerShell 5.1 can promote native STDERR to NativeCommandError
        # when ErrorActionPreference is Stop. Capture it instead so callers can
        # decide whether a broken file should abort or be regenerated.
        $ErrorActionPreference='Continue'
        $raw=@(& $FFprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $source 2>&1)
        $exit=$LASTEXITCODE
    }finally{
        $ErrorActionPreference=$oldEap
    }

    $d=0.0
    $parsed=$false
    foreach($line in $raw){
        $candidate=([string]$line).Trim()
        if([double]::TryParse($candidate,[System.Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$d)){
            $parsed=$true
            break
        }
    }

    [pscustomobject][ordered]@{
        Success=($exit -eq 0 -and $parsed -and $d -gt 0.0)
        Duration=$d
        ExitCode=$exit
        Diagnostic=(@($raw | ForEach-Object {[string]$_}) -join [Environment]::NewLine)
    }
}

function Get-Duration([string]$source) {
    $probe=Test-Duration $source
    if(-not $probe.Success){
        $detail=$probe.Diagnostic
        if([string]::IsNullOrWhiteSpace($detail)){$detail='ffprobe returned no diagnostic output.'}
        throw "Could not read duration: $source (ffprobe exit $($probe.ExitCode)).`n$detail"
    }
    return [double]$probe.Duration
}

$proxyRows = New-Object 'System.Collections.Generic.List[object]'
$index=0
foreach ($m in $manifest) {
    $index++
    $source = $m.SourcePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing source for $($m.SlotID): $source" }

    $trimStart = To-DoubleOrZero $m.TrimStartSeconds
    $trimEnd = To-DoubleOrZero $m.TrimEndSeconds
    $cropLeft=[int](To-DoubleOrZero $m.CropLeft)
    $cropRight=[int](To-DoubleOrZero $m.CropRight)
    $cropTop=[int](To-DoubleOrZero $m.CropTop)
    $cropBottom=[int](To-DoubleOrZero $m.CropBottom)
    $audioRepair=([string]$m.AudioRepair).Trim().ToUpperInvariant()
    if([string]::IsNullOrWhiteSpace($audioRepair)){$audioRepair='NONE'}

    # v1.3.x stored BAD_AUDIO as LIGHT. Treat every existing LIGHT entry as the
    # new real restoration pass so old manifests get fixed without another
    # review/apply cycle.
    if($audioRepair -eq 'LIGHT'){$audioRepair='RESTORE'}

    $sourceDuration = Get-Duration $source
    $effectiveDuration = $sourceDuration - $trimStart - $trimEnd
    if ($trimStart -lt 0 -or $trimEnd -lt 0 -or $effectiveDuration -le 0.10) {
        throw "Invalid trim for $($m.SlotID): start=$trimStart end=$trimEnd sourceDuration=$sourceDuration"
    }

    $cropSuggestion=$null
    if(($cropLeft+$cropRight+$cropTop+$cropBottom) -eq 0){
        $cropSuggestion=Get-CropSuggestion $source $sourceDuration
    }

    $cacheKey = Get-FileCacheKey $source $trimStart $trimEnd $cropLeft $cropRight $cropTop $cropBottom $audioRepair
    $proxy = Join-Path $cacheDir ($cacheKey + '.mp4')
    if ($ReencodeAll -and (Test-Path -LiteralPath $proxy)) { Remove-Item -LiteralPath $proxy -Force }

    # A failed/interrupted FFmpeg run can leave a zero-byte or header-only MP4.
    # Existence alone is not a valid cache hit. Validate cached proxies and
    # automatically discard/rebuild only the corrupt one.
    if (Test-Path -LiteralPath $proxy -PathType Leaf) {
        $cachedProbe=Test-Duration $proxy
        if(-not $cachedProbe.Success){
            Write-Warning ("Discarding corrupt cached proxy for {0}: {1}" -f $m.SlotID,$proxy)
            if(-not [string]::IsNullOrWhiteSpace($cachedProbe.Diagnostic)){
                Write-Host (($cachedProbe.Diagnostic -split "`r?`n" | Select-Object -Last 4) -join [Environment]::NewLine)
            }
            Remove-Item -LiteralPath $proxy -Force
        }
    }

    if (-not (Test-Path -LiteralPath $proxy -PathType Leaf)) {
        Write-Progress -Activity "Normalizing $CartID review proxies" -Status "$index / $($manifest.Count): $($m.Title)" -PercentComplete (($index/[math]::Max(1,$manifest.Count))*100)
        $hasAudio = Has-Audio $source
        if($audioRepair -ne 'NONE' -and -not $hasAudio){
            throw "Audio repair '$audioRepair' requested for $($m.SlotID), but the source has no audio stream. Mark it REPLACE_THIS_CART instead."
        }

        $activeAf=$af
        if($audioRepair -eq 'RESTORE'){$activeAf=$afRepairRestore}
        elseif($audioRepair -eq 'STRONG'){$activeAf=$afRepairStrong}
        elseif($audioRepair -eq 'AGGRESSIVE'){$activeAf=$afRepairAggressive}
        elseif($audioRepair -eq 'MAX'){$activeAf=$afRepairMax}
        elseif($audioRepair -ne 'NONE'){throw "Unknown AudioRepair '$audioRepair' on $($m.SlotID)."}

        if($audioRepair -ne 'NONE'){
            Write-Host ("Audio repair: {0} · {1} · {2}" -f $m.SlotID,$audioRepair,$m.Title)
        }

        $activeVf=$vf
        if(($cropLeft+$cropRight+$cropTop+$cropBottom) -gt 0){
            $cropW=$cropLeft+$cropRight
            $cropH=$cropTop+$cropBottom
            $activeVf="crop=iw-$cropW`:ih-$cropH`:$cropLeft`:$cropTop,$vf"
        }

        $inputArgs = @()
        if ($trimStart -gt 0) { $inputArgs += @('-ss', $trimStart.ToString([cultureinfo]::InvariantCulture)) }
        $inputArgs += @('-i',$source)
        $inputArgs += @('-t',$effectiveDuration.ToString([cultureinfo]::InvariantCulture))

        if ($hasAudio) {
            $ffArgs = @('-hide_banner','-loglevel','error','-nostdin','-y') + $inputArgs + @(
                '-map','0:v:0','-map','0:a:0',
                '-vf',$activeVf,'-af',$activeAf,
                '-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',
                '-r','30','-g','30','-keyint_min','30','-sc_threshold','0',
                '-c:a','aac','-b:a','128k','-ar','44100','-ac','2',
                '-movflags','+faststart',
                $proxy
            )
        } else {
            $ffArgs = @('-hide_banner','-loglevel','error','-nostdin','-y') + $inputArgs + @(
                '-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100',
                '-map','0:v:0','-map','1:a:0',
                '-vf',$activeVf,
                '-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',
                '-r','30','-g','30','-keyint_min','30','-sc_threshold','0',
                '-c:a','aac','-b:a','128k','-ar','44100','-ac','2',
                '-shortest','-movflags','+faststart',
                $proxy
            )
        }
        $oldEap=$ErrorActionPreference
        try{
            # IMPORTANT: launch FFmpeg directly. On Windows PowerShell 5.1,
            # collecting native stdout/stderr into a PowerShell pipeline can
            # destabilize this FFmpeg build during heavy audio filtering.
            # Let FFmpeg write diagnostics directly to the console instead.
            $ErrorActionPreference='Continue'
            & $FFmpeg @ffArgs
            $ffExit=$LASTEXITCODE
        }finally{
            $ErrorActionPreference=$oldEap
        }

        if ($ffExit -ne 0 -or -not (Test-Path -LiteralPath $proxy)) {
            # Do not leave a partial MP4 behind as a future cache hit.
            if(Test-Path -LiteralPath $proxy -PathType Leaf){
                Remove-Item -LiteralPath $proxy -Force -ErrorAction SilentlyContinue
            }
            throw "FFmpeg failed on $source (exit $ffExit). FFmpeg diagnostics were printed directly above."
        }
    }

    $duration = Get-Duration $proxy
    $proxyRows.Add([pscustomobject]@{
        Manifest=$m;ProxyPath=$proxy;Duration=$duration;TrimStart=$trimStart;TrimEnd=$trimEnd
        CropLeft=$cropLeft;CropRight=$cropRight;CropTop=$cropTop;CropBottom=$cropBottom
        AudioRepair=$audioRepair
        CropSuggestion=$cropSuggestion
    })
}
Write-Progress -Activity "Normalizing $CartID review proxies" -Completed

# Build the end-to-end review movie from identical cached proxy encodes.
$concatPath = Join-Path $reviewDir 'concat.txt'
$concatLines = @()
foreach ($p in $proxyRows) {
    $safe = $p.ProxyPath.Replace("'","''")
    $concatLines += "file '$safe'"
}
Set-Content -LiteralPath $concatPath -Value $concatLines -Encoding ASCII
$reviewVideo = Join-Path $reviewDir ($CartID + '-review.mp4')
& $FFmpeg -hide_banner -loglevel error -nostdin -y -f concat -safe 0 -i $concatPath -c copy -movflags +faststart $reviewVideo
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $reviewVideo)) { throw "Could not concatenate review video." }

# Exact timeline based on normalized proxy durations.
$timeline = New-Object 'System.Collections.Generic.List[object]'
$cursor=0.0
foreach ($p in $proxyRows) {
    $m=$p.Manifest
    $start=$cursor
    $end=$start+$p.Duration
    $timeline.Add([pscustomobject][ordered]@{
        Position=$m.Position; SlotID=$m.SlotID; Role=$m.Role; AssetID=$m.AssetID; AssetType=$m.AssetType
        AssetSubtype=$m.AssetSubtype; Title=$m.Title; Series=$m.Series; Pool=$m.Pool; Network=$m.Network
        SourcePath=$m.SourcePath; ProxyPath=$p.ProxyPath; DurationSeconds=([math]::Round($p.Duration,3))
        StartSeconds=([math]::Round($start,3)); EndSeconds=([math]::Round($end,3)); ReusePolicy=$m.ReusePolicy
        ReviewStatus=$m.ReviewStatus
        AppliedTrimStartSeconds=$p.TrimStart; AppliedTrimEndSeconds=$p.TrimEnd
        AppliedCropLeft=$p.CropLeft;AppliedCropRight=$p.CropRight;AppliedCropTop=$p.CropTop;AppliedCropBottom=$p.CropBottom
        AppliedAudioRepair=$p.AudioRepair
        SuggestedCropLeft=$(if($p.CropSuggestion){$p.CropSuggestion.Left}else{0})
        SuggestedCropRight=$(if($p.CropSuggestion){$p.CropSuggestion.Right}else{0})
        SuggestedCropTop=$(if($p.CropSuggestion){$p.CropSuggestion.Top}else{0})
        SuggestedCropBottom=$(if($p.CropSuggestion){$p.CropSuggestion.Bottom}else{0})
        SuggestedCropRemovedArea=$(if($p.CropSuggestion){$p.CropSuggestion.RemovedArea}else{0})
    })
    $cursor=$end
}
$timelineCsv = Join-Path $reviewDir 'review-manifest.csv'
Export-Utf8Csv $timeline $timelineCsv

# Build one global alternatives dataset. JS filters it per slot.
$registry = @(Import-Csv -LiteralPath $settings.RegistryPath)
$assignments = @(Read-CsvSafe $settings.AssignmentPath)
$busy = @{}
foreach ($a in $assignments) {
    if ($a.AssignmentStatus -in @('RESERVED','ACTIVE')) { $busy[$a.AssetID]=$true }
}
$alternatives = @($registry | Where-Object {$_.SourceStatus -eq 'READY'} | ForEach-Object {
    [pscustomobject]@{
        id=$_.AssetID; type=$_.AssetType; subtype=$_.Subtype; title=$_.Title; pool=$_.Pool; network=$_.Network
        duration=$_.DurationSeconds; reuse=$_.ReusePolicy
        available=($_.ReusePolicy -eq 'REUSABLE' -or -not $busy.ContainsKey($_.AssetID))
    }
})

$timelineJson = ConvertTo-Json -InputObject @($timeline | ForEach-Object {
    [pscustomobject]@{
        position=$_.Position; slot=$_.SlotID; role=$_.Role; assetId=$_.AssetID; assetType=$_.AssetType
        subtype=$_.AssetSubtype; title=$_.Title; series=$_.Series; pool=$_.Pool; network=$_.Network
        duration=[double]$_.DurationSeconds; start=[double]$_.StartSeconds; end=[double]$_.EndSeconds
        source=$_.SourcePath; reuse=$_.ReusePolicy; reviewStatus=$_.ReviewStatus
        appliedTrimStart=[double]$_.AppliedTrimStartSeconds; appliedTrimEnd=[double]$_.AppliedTrimEndSeconds
        appliedCropLeft=[int]$_.AppliedCropLeft;appliedCropRight=[int]$_.AppliedCropRight
        appliedCropTop=[int]$_.AppliedCropTop;appliedCropBottom=[int]$_.AppliedCropBottom
        appliedAudioRepair=[string]$_.AppliedAudioRepair
        suggestedCropLeft=[int]$_.SuggestedCropLeft;suggestedCropRight=[int]$_.SuggestedCropRight
        suggestedCropTop=[int]$_.SuggestedCropTop;suggestedCropBottom=[int]$_.SuggestedCropBottom
        suggestedCropRemovedArea=[double]$_.SuggestedCropRemovedArea
    }
}) -Depth 4 -Compress
$altJson = ConvertTo-Json -InputObject $alternatives -Depth 4 -Compress
$timelineJson = $timelineJson.Replace('<','\u003c')
$altJson = $altJson.Replace('<','\u003c')

$template = @'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__CART__ __REV__ Review</title>
<style>
:root{color-scheme:dark;--bg:#0d1012;--panel:#171c20;--edge:#334047;--muted:#a9b6bc;--accent:#73d4c5;--warn:#f2c66d;--bad:#ff8d8d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#edf3f3;font-family:system-ui,Segoe UI,Arial,sans-serif;overflow-x:hidden}
header{position:sticky;top:0;z-index:20;background:#11171bee;border-bottom:1px solid var(--edge);padding:12px 16px}
h1{margin:0;font-size:20px}header p{margin:4px 0 0;color:var(--muted);font-size:12px}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:14px;padding:14px;align-items:start}
.playerPanel,.side{background:var(--panel);border:1px solid var(--edge);border-radius:10px;padding:12px}
video{width:100%;max-height:55vh;background:#000}
#realTimeline{height:48px;background:#080a0b;border:1px solid var(--edge);position:relative;margin-top:10px;cursor:pointer;overflow:hidden}
.segment{position:absolute;top:0;height:100%;border-right:1px solid #0008;background:#2d4747;overflow:hidden;font-size:9px;padding:3px;white-space:nowrap}
.segment:nth-child(3n+1){background:#3e3b55}.segment:nth-child(3n+2){background:#364b3c}
.segment.active{outline:2px solid var(--accent);z-index:3}.playhead{position:absolute;top:0;bottom:0;width:2px;background:#fff;z-index:9;pointer-events:none}
#clipStrip{display:flex;overflow-x:auto;gap:5px;margin-top:8px;padding-bottom:5px}
.clipChip{min-width:145px;max-width:145px;height:72px;border:1px solid var(--edge);background:#20282d;color:#eee;border-radius:6px;padding:6px;text-align:left;cursor:pointer}
.clipChip.active{border:2px solid var(--accent);background:#27403d}.chipRole{font-size:10px;color:var(--accent)}.chipTitle{font-size:11px;line-height:1.2;margin-top:3px;max-height:31px;overflow:hidden}
.current{margin-top:10px;padding:10px;border:1px solid var(--edge);border-radius:8px}.currentTitle{font-size:16px;font-weight:700}.meta{font-size:12px;color:var(--muted);margin-top:4px;overflow-wrap:anywhere}
.buttons{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}button,select,input,textarea{background:#21292e;color:#edf3f3;border:1px solid #53636b;border-radius:5px;padding:7px;font:inherit;font-size:12px}button{cursor:pointer}button:hover{border-color:var(--accent)}
.side{height:calc(100vh - 108px);min-height:520px;overflow:hidden;position:sticky;top:94px;display:flex;flex-direction:column;padding:0}
.reviewTools{flex:0 0 auto;padding:12px 12px 10px;background:var(--panel);border-bottom:1px solid var(--edge);z-index:3}
.reviewTools h2{font-size:16px;margin:0 0 8px}
.clipListWrap{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 12px 12px}
.clipListHeader{position:sticky;top:0;background:var(--panel);padding:8px 0 6px;z-index:2;border-bottom:1px solid #29343a}
.field{margin:8px 0}.field label{display:block;font-size:11px;color:var(--muted);margin-bottom:3px}.field select,.field input,.field textarea{width:100%}
#clipList{margin-top:2px}.listItem{padding:7px;border-top:1px solid #29343a;cursor:pointer;font-size:11px}.listItem.active{background:#253b39}.listItem .r{color:var(--accent);font-weight:700}
.flagged{color:var(--warn)}.bad{color:var(--bad)}
.reviewedGood{background:#193526!important;color:#c9f6d4;border-left:4px solid #58c77a}
.clipChip.reviewedGood{border-color:#58c77a;background:#193526}
.audioRepaired{box-shadow:inset 4px 0 0 #9d7cff}
.clipChip.audioRepaired{border-color:#9d7cff}
.audioRepairNotice{margin:8px 0;padding:9px;border:1px solid #9d7cff;background:#241f39;border-radius:6px;color:#ddd3ff;font-size:12px;line-height:1.35}
.toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
@media(max-width:1050px){body{overflow:auto}.layout{grid-template-columns:1fr}.side{position:static;height:760px;min-height:0}.reviewTools{position:static}}
</style>
</head>
<body>
<header><h1>__CART__ · __REV__ Review</h1><p>Continuous proposed broadcast. No title slates are inserted. Scrub freely; the page tracks the exact clip under the playhead.</p></header>
<div class="layout">
<section class="playerPanel">
<video id="video" controls preload="metadata" src="__VIDEO__"></video>
<div id="realTimeline"><div id="playhead" class="playhead"></div></div>
<div id="clipStrip"></div>
<div class="current">
<div class="currentTitle" id="currentTitle"></div>
<div class="meta" id="currentMeta"></div>
<div class="meta" id="clipClock" style="font-size:14px;color:#edf3f3;margin-top:7px"></div>
<div class="buttons">
<button id="goStart">START</button><button id="goEnd">END</button>
<button id="setTrimStart">TRIM START = ELAPSED</button><button id="setTrimEnd">TRIM END = REMAINING</button>
<button id="boundaryIn">BOUNDARY IN</button><button id="boundaryOut">BOUNDARY OUT</button>
<button id="loopIn">LOOP IN</button><button id="loopOut">LOOP OUT</button><button id="stopLoop">STOP LOOP</button>
</div>
</div>
</section>
<aside class="side">
<div class="reviewTools">
<h2>Review selected clip</h2>
<div class="field"><label>Action / quality state</label><select id="action">
<option>UNREVIEWED</option><option>GOOD</option><option>REPLACE_THIS_CART</option>
<option>BAD_QUALITY</option><option>BAD_AUDIO</option><option>NEEDS_CLIPPED</option><option>NEEDS_CROP</option>
<option>DUPLICATE</option><option>WRONG_ERA</option><option>WRONG_NETWORK</option>
</select></div>
<div id="audioRepairNotice" class="audioRepairNotice" hidden></div>
<div class="field"><label>Replacement asset (optional; filtered to compatible available assets)</label><select id="replacement"><option value="">— none —</option></select></div>
<div class="field"><label>Trim start seconds (remove from beginning)</label><input id="trimStart" type="number" min="0" step="0.01" value="0"></div>
<div class="field"><label>Trim end seconds (remove from end)</label><input id="trimEnd" type="number" min="0" step="0.01" value="0"></div>
<div class="field"><label>Crop pixels — left / right / top / bottom</label>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">
<input id="cropLeft" type="number" min="0" step="1" value="0" title="Left">
<input id="cropRight" type="number" min="0" step="1" value="0" title="Right">
<input id="cropTop" type="number" min="0" step="1" value="0" title="Top">
<input id="cropBottom" type="number" min="0" step="1" value="0" title="Bottom">
</div>
<div class="meta" id="cropSuggestion"></div>
<div class="toolbar"><button id="useSuggestedCrop" type="button">Use Suggested Crop</button></div>
</div>
<div class="field"><label>Notes</label><textarea id="notes" rows="3"></textarea></div>
<div class="toolbar"><button id="exportBtn">Export Review CSV</button><button id="importBtn">Import Review CSV</button><input id="importFile" type="file" accept=".csv" hidden></div>
<div class="meta" id="reviewStats"></div>
</div>
<div class="clipListWrap">
<div class="clipListHeader"><strong>Cart timeline</strong><div class="meta">This list scrolls independently. Review controls stay put.</div></div>
<div id="clipList"></div>
</div>
</aside>
</div>
<script>
'use strict';
const ITEMS=__TIMELINE__;
const ASSETS=__ALTS__;
const CART="__CART__", REV="__REV__", KEY=`retro-cart-review-${CART}-${REV}`;
const video=document.getElementById('video'), timeline=document.getElementById('realTimeline'), playhead=document.getElementById('playhead');
const strip=document.getElementById('clipStrip'), list=document.getElementById('clipList');
const action=document.getElementById('action'), replacement=document.getElementById('replacement'), notes=document.getElementById('notes');
const trimStart=document.getElementById('trimStart'), trimEnd=document.getElementById('trimEnd');
const cropLeft=document.getElementById('cropLeft'),cropRight=document.getElementById('cropRight'),cropTop=document.getElementById('cropTop'),cropBottom=document.getElementById('cropBottom');
let selected=0, loop=null, state={}; try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){state={}}
function st(i){const k=ITEMS[i].slot;if(!state[k])state[k]={action:(ITEMS[i].reviewStatus||'UNREVIEWED'),notes:'',trimStart:'0',trimEnd:'0',cropLeft:'0',cropRight:'0',cropTop:'0',cropBottom:'0',replacement:''};return state[k]}
function save(){localStorage.setItem(KEY,JSON.stringify(state));stats()}
function autoRepairAction(kind){
 const s=st(selected);
 if(['UNREVIEWED','GOOD'].includes(s.action)){s.action=kind;action.value=kind}
}
function fmt(s){s=Math.max(0,Number(s)||0);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),x=(s%60).toFixed(1).padStart(4,'0');return h?`${h}:${String(m).padStart(2,'0')}:${x}`:`${m}:${x}`}
function currentIndex(t){let lo=0,hi=ITEMS.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(t<ITEMS[m].start)hi=m-1;else if(t>=ITEMS[m].end)lo=m+1;else return m}return Math.max(0,Math.min(ITEMS.length-1,lo))}
function compatible(item,a){
 if(!a.available||a.id===item.assetId)return false;
 if(item.role==='AD')return a.type==='COMMERCIAL'&&a.pool===item.pool;
 if(item.role==='SHOW')return a.type==='EPISODE'&&a.network===item.network;
 if(a.type!=='BRANDING'||a.network!==item.network)return false;
 if(item.role==='ANCHOR_BRANDING')return ['IDENT','PROMO','INTRO'].includes(a.subtype)&&Number(a.duration)>=20;
 if(item.role==='STING')return ['IDENT','BUMPER_GENERIC','TRANSITION'].includes(a.subtype)&&Number(a.duration)<=15;
 if(item.role==='BUMPER_OUT')return ['BUMPER_OUT','BUMPER_GENERIC'].includes(a.subtype);
 if(item.role==='BUMPER_IN')return ['BUMPER_IN','BUMPER_GENERIC'].includes(a.subtype);
 if(item.role==='NEXT')return a.subtype==='NEXT';
 return true;
}
function fillReplacement(){
 const item=ITEMS[selected],cur=st(selected);replacement.innerHTML='<option value="">— none / auto-select later —</option>';
 ASSETS.filter(a=>compatible(item,a)).sort((a,b)=>a.title.localeCompare(b.title)).slice(0,200).forEach(a=>{
   const o=document.createElement('option');o.value=a.id;o.textContent=`${a.subtype||a.type} · ${a.title}`;replacement.appendChild(o)
 });replacement.value=cur.replacement||'';
}
function select(i,seek=false){selected=Math.max(0,Math.min(ITEMS.length-1,i));const item=ITEMS[selected],cur=st(selected);
 document.getElementById('currentTitle').textContent=`${item.position} · ${item.role} · ${item.title}`;
 const appliedTrim=(Number(item.appliedTrimStart)||Number(item.appliedTrimEnd))?` · trim ${item.appliedTrimStart}s/${item.appliedTrimEnd}s`:'';
 const appliedCrop=(Number(item.appliedCropLeft)||Number(item.appliedCropRight)||Number(item.appliedCropTop)||Number(item.appliedCropBottom))?` · crop L${item.appliedCropLeft} R${item.appliedCropRight} T${item.appliedCropTop} B${item.appliedCropBottom}`:'';
 const appliedAudio=(item.appliedAudioRepair&&item.appliedAudioRepair!=='NONE')?` · AUDIO REPAIR APPLIED: ${item.appliedAudioRepair}`:'';
 document.getElementById('currentMeta').textContent=`${fmt(item.start)} → ${fmt(item.end)} · ${fmt(item.duration)} · ${item.slot} · ${item.assetId}${appliedTrim}${appliedCrop}${appliedAudio}`;

 const audioNotice=document.getElementById('audioRepairNotice');
 if(item.appliedAudioRepair&&item.appliedAudioRepair!=='NONE'){
   audioNotice.hidden=false;
   audioNotice.textContent=`This clip was previously marked BAD_AUDIO and has been reprocessed with ${item.appliedAudioRepair}. Verify the repaired audio now. If it is still bad, mark BAD_AUDIO again; the next revision escalates the restoration.`;
 }else{
   audioNotice.hidden=true;
   audioNotice.textContent='';
 }

 action.value=cur.action;notes.value=cur.notes||'';trimStart.value=cur.trimStart||'0';trimEnd.value=cur.trimEnd||'0';
 cropLeft.value=cur.cropLeft||'0';cropRight.value=cur.cropRight||'0';cropTop.value=cur.cropTop||'0';cropBottom.value=cur.cropBottom||'0';
 const hasSuggestion=Number(item.suggestedCropLeft)||Number(item.suggestedCropRight)||Number(item.suggestedCropTop)||Number(item.suggestedCropBottom);
 document.getElementById('cropSuggestion').textContent=hasSuggestion?`Suggested baked-border crop: L${item.suggestedCropLeft} R${item.suggestedCropRight} T${item.suggestedCropTop} B${item.suggestedCropBottom} · removes ${(Number(item.suggestedCropRemovedArea)*100).toFixed(1)}% of source frame`:'No meaningful baked border detected.';
 document.getElementById('useSuggestedCrop').disabled=!hasSuggestion;
 fillReplacement();
 document.querySelectorAll('.clipChip,.listItem,.segment').forEach(e=>e.classList.remove('active'));
 document.querySelectorAll(`[data-i="${selected}"]`).forEach(e=>e.classList.add('active'));
 const chip=strip.querySelector(`[data-i="${selected}"]`);if(chip)chip.scrollIntoView({block:'nearest',inline:'center'});
 const li=list.querySelector(`[data-i="${selected}"]`);if(li)li.scrollIntoView({block:'nearest',inline:'nearest'});
 if(seek)video.currentTime=item.start;
}
function build(){
 const total=ITEMS[ITEMS.length-1].end;
 ITEMS.forEach((it,i)=>{
   const seg=document.createElement('div');seg.className='segment';seg.dataset.i=i;seg.style.left=`${it.start/total*100}%`;seg.style.width=`${Math.max(.08,it.duration/total*100)}%`;seg.title=`${it.position} ${it.role} — ${it.title}\n${fmt(it.start)}–${fmt(it.end)}`;seg.onclick=e=>{e.stopPropagation();select(i,true)};timeline.appendChild(seg);
   const b=document.createElement('button');b.className='clipChip';b.dataset.i=i;b.innerHTML=`<div class="chipRole">${it.position} · ${it.role}</div><div class="chipTitle"></div>`;b.querySelector('.chipTitle').textContent=it.title;b.onclick=()=>select(i,true);strip.appendChild(b);
   const li=document.createElement('div');li.className='listItem';li.dataset.i=i;li.innerHTML=`<span class="r">${it.position} ${it.role}</span><br><span></span>`;li.querySelector('span:last-child').textContent=it.title;li.onclick=()=>select(i,true);list.appendChild(li);
 });
 timeline.onclick=e=>{const r=timeline.getBoundingClientRect(),p=(e.clientX-r.left)/r.width;video.currentTime=p*total}
 select(0,false);stats()
}
function stats(){let done=0,bad=0;ITEMS.forEach((it,i)=>{const a=st(i).action;if(a!=='UNREVIEWED')done++;if(['BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE'].includes(a))bad++;
 const repaired=(it.appliedAudioRepair&&it.appliedAudioRepair!=='NONE');
 const el=list.querySelector(`[data-i="${i}"]`);if(el){el.classList.toggle('flagged',a!=='UNREVIEWED'&&a!=='GOOD');el.classList.toggle('bad',['BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE'].includes(a));el.classList.toggle('reviewedGood',a==='GOOD');el.classList.toggle('audioRepaired',repaired);}
 const chip=strip.querySelector(`[data-i="${i}"]`);if(chip){chip.classList.toggle('reviewedGood',a==='GOOD');chip.classList.toggle('audioRepaired',repaired);}});
 const repairedCount=ITEMS.filter(it=>it.appliedAudioRepair&&it.appliedAudioRepair!=='NONE').length;
 document.getElementById('reviewStats').textContent=`Reviewed ${done}/${ITEMS.length} · source problems ${bad} · audio-repaired clips ${repairedCount}`;
}
video.addEventListener('timeupdate',()=>{const total=ITEMS[ITEMS.length-1].end;playhead.style.left=`${Math.min(100,video.currentTime/total*100)}%`;const i=currentIndex(video.currentTime);if(i!==selected)select(i,false);
 const it=ITEMS[i],elapsed=Math.max(0,video.currentTime-it.start),remaining=Math.max(0,it.end-video.currentTime);
 document.getElementById('clipClock').textContent=`CLIP · ${elapsed.toFixed(2)}s elapsed · ${remaining.toFixed(2)}s remaining · ${it.duration.toFixed(2)}s total`;
 if(loop&&video.currentTime>=loop.end){video.currentTime=loop.start;video.play().catch(()=>{})}});
action.onchange=()=>{
 const s=st(selected);
 s.action=action.value;
 const replacementActions=['REPLACE_THIS_CART','BAD_QUALITY','DUPLICATE','WRONG_ERA','WRONG_NETWORK'];
 if(!replacementActions.includes(s.action) && s.replacement){
   s.replacement='';
   replacement.value='';
 }
 save();
};
notes.onchange=()=>{st(selected).notes=notes.value;save()};
function trimChanged(which,value){st(selected)[which]=value;if(Number(value)>0)autoRepairAction('NEEDS_CLIPPED');save()}
trimStart.onchange=()=>trimChanged('trimStart',trimStart.value);trimEnd.onchange=()=>trimChanged('trimEnd',trimEnd.value);
function cropChanged(which,value){st(selected)[which]=value;if(Number(value)>0)autoRepairAction('NEEDS_CROP');save()}
cropLeft.onchange=()=>cropChanged('cropLeft',cropLeft.value);cropRight.onchange=()=>cropChanged('cropRight',cropRight.value);
cropTop.onchange=()=>cropChanged('cropTop',cropTop.value);cropBottom.onchange=()=>cropChanged('cropBottom',cropBottom.value);
document.getElementById('useSuggestedCrop').onclick=()=>{const item=ITEMS[selected],s=st(selected);s.cropLeft=String(item.suggestedCropLeft||0);s.cropRight=String(item.suggestedCropRight||0);s.cropTop=String(item.suggestedCropTop||0);s.cropBottom=String(item.suggestedCropBottom||0);if(s.action==='UNREVIEWED'||s.action==='GOOD')s.action='NEEDS_CROP';save();select(selected,false)};
replacement.onchange=()=>{
 const s=st(selected);
 s.replacement=replacement.value;

 // Choosing a specific replacement is an explicit instruction to replace this
 // cart slot. Do not leave the row as GOOD/UNREVIEWED/etc.
 if(replacement.value){
   s.action='REPLACE_THIS_CART';
   action.value='REPLACE_THIS_CART';
 }

 save();
};
function playRange(a,b,doLoop=false){loop=doLoop?{start:Math.max(0,a),end:Math.min(ITEMS[ITEMS.length-1].end,b)}:{start:Math.max(0,a),end:Math.min(ITEMS[ITEMS.length-1].end,b),once:true};video.currentTime=loop.start;video.play().catch(()=>{})}
video.addEventListener('timeupdate',()=>{if(loop&&loop.once&&video.currentTime>=loop.end){video.pause();loop=null}});
document.getElementById('goStart').onclick=()=>{video.currentTime=ITEMS[selected].start};
document.getElementById('goEnd').onclick=()=>{video.currentTime=Math.max(ITEMS[selected].start,ITEMS[selected].end-6)};
document.getElementById('setTrimStart').onclick=()=>{const it=ITEMS[selected],v=Math.max(0,video.currentTime-it.start).toFixed(2);trimStart.value=v;trimChanged('trimStart',v)};
document.getElementById('setTrimEnd').onclick=()=>{const it=ITEMS[selected],v=Math.max(0,it.end-video.currentTime).toFixed(2);trimEnd.value=v;trimChanged('trimEnd',v)};
document.getElementById('boundaryIn').onclick=()=>playRange(ITEMS[selected].start-4,ITEMS[selected].start+5,false);
document.getElementById('boundaryOut').onclick=()=>playRange(ITEMS[selected].end-5,ITEMS[selected].end+4,false);
document.getElementById('loopIn').onclick=()=>playRange(ITEMS[selected].start-4,ITEMS[selected].start+5,true);
document.getElementById('loopOut').onclick=()=>playRange(ITEMS[selected].end-5,ITEMS[selected].end+4,true);
document.getElementById('stopLoop').onclick=()=>{loop=null};
function csvQ(v){return `"${String(v??'').replace(/"/g,'""')}"`}
document.getElementById('exportBtn').onclick=()=>{
 const hdr=['Position','SlotID','AssetID','Role','Title','Action','Notes','TrimStart','TrimEnd','CropLeft','CropRight','CropTop','CropBottom','ReplacementAssetID'];
 const lines=[hdr.map(csvQ).join(',')];ITEMS.forEach((it,i)=>{const s=st(i);lines.push([it.position,it.slot,it.assetId,it.role,it.title,s.action,s.notes,s.trimStart,s.trimEnd,s.cropLeft,s.cropRight,s.cropTop,s.cropBottom,s.replacement].map(csvQ).join(','))});
 const blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${CART}-${REV}-review-state.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
};
document.getElementById('importBtn').onclick=()=>document.getElementById('importFile').click();
document.getElementById('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;const txt=await f.text();const lines=txt.split(/\r?\n/).filter(Boolean);function parse(s){let a=[],x='',q=false;for(let i=0;i<s.length;i++){let c=s[i];if(c==='"'){if(q&&s[i+1]==='"'){x+='"';i++}else q=!q}else if(c===','&&!q){a.push(x);x=''}else x+=c}a.push(x);return a}const h=parse(lines[0]);for(let n=1;n<lines.length;n++){const v=parse(lines[n]),o={};h.forEach((k,i)=>o[k]=v[i]??'');if(o.SlotID){state[o.SlotID]={action:o.Action||'UNREVIEWED',notes:o.Notes||'',trimStart:o.TrimStart||'0',trimEnd:o.TrimEnd||'0',cropLeft:o.CropLeft||'0',cropRight:o.CropRight||'0',cropTop:o.CropTop||'0',cropBottom:o.CropBottom||'0',replacement:o.ReplacementAssetID||''}}}save();select(selected,false)};
build();
</script></body></html>
'@

$revName=('r{0:D3}' -f $revision)
$html=$template.Replace('__CART__',$CartID).Replace('__REV__',$revName).Replace('__VIDEO__',([IO.Path]::GetFileName($reviewVideo))).Replace('__TIMELINE__',$timelineJson).Replace('__ALTS__',$altJson)
$htmlPath=Join-Path $reviewDir 'cart-review.html'
Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8

Write-Host ""
Write-Host "Review build complete."
Write-Host "Video:     $reviewVideo"
Write-Host "Dashboard: $htmlPath"
Write-Host "Timeline:  $timelineCsv"
Write-Host "Runtime:   $([TimeSpan]::FromSeconds($cursor).ToString())"
Write-Host ""
Write-Host "Open cart-review.html. The right-side cart timeline now scrolls independently while the review controls stay fixed."
Write-Host "Use START/END and BOUNDARY controls for clipping QA. Export Review CSV when you are done."
