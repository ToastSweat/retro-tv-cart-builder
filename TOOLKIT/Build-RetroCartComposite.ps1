# Retro TV Cart Builder - reusable multi-part episode composite utility
# Combines 2+ source clips into one durable episode source.
# Auto mode uses stream-copy when the selected primary streams match,
# otherwise it normalizes to a common square-pixel canvas at high quality.

[CmdletBinding()]
param(
    [string]$RecipePath = '',
    [string[]]$Parts = @(),
    [string]$Output = '',
    [ValidateSet('Auto','CopyOnly','Normalize')]
    [string]$Mode = 'Auto',
    [switch]$Force,
    [string]$FFmpeg = 'ffmpeg',
    [string]$FFprobe = 'ffprobe',
    [ValidateRange(0,51)]
    [int]$Crf = 16,
    [ValidateSet('ultrafast','superfast','veryfast','faster','fast','medium','slow','slower','veryslow')]
    [string]$Preset = 'slow'
)

$ErrorActionPreference = 'Stop'

foreach($cmd in @($FFmpeg,$FFprobe)){
    if(-not (Get-Command $cmd -ErrorAction SilentlyContinue)){
        throw "$cmd is not on PATH."
    }
}

function Get-RatioValue {
    param([string]$Value,[double]$Fallback=1.0)
    if([string]::IsNullOrWhiteSpace($Value) -or $Value -eq 'N/A'){ return $Fallback }
    if($Value -match '^([0-9.]+)[:/]([0-9.]+)$'){
        $a=[double]$matches[1]
        $b=[double]$matches[2]
        if($a -gt 0 -and $b -gt 0){ return $a/$b }
    }
    $n=0.0
    if([double]::TryParse(
        $Value,
        [System.Globalization.NumberStyles]::Float,
        [cultureinfo]::InvariantCulture,
        [ref]$n
    ) -and $n -gt 0){
        return $n
    }
    return $Fallback
}

function Get-EvenInt {
    param([double]$Value)
    $n=[int][math]::Round($Value)
    if($n -lt 2){$n=2}
    if(($n % 2) -ne 0){$n++}
    return $n
}

function Get-MediaProfile {
    param([Parameter(Mandatory=$true)][string]$Path)

    if(-not (Test-Path -LiteralPath $Path -PathType Leaf)){
        throw "Source file not found: $Path"
    }

    $raw = & $FFprobe -v error `
        -show_entries 'stream=index,codec_type,codec_name,width,height,pix_fmt,r_frame_rate,sample_aspect_ratio,sample_rate,channels,channel_layout' `
        -of json `
        $Path

    if($LASTEXITCODE -ne 0){ throw "ffprobe failed: $Path" }

    $j = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
    $video = @($j.streams | Where-Object {$_.codec_type -eq 'video'} | Sort-Object index | Select-Object -First 1)
    $audio = @($j.streams | Where-Object {$_.codec_type -eq 'audio'} | Sort-Object index | Select-Object -First 1)

    if($video.Count -eq 0){ throw "No video stream found: $Path" }
    if($audio.Count -eq 0){ throw "No audio stream found: $Path" }

    $v=$video[0]
    $a=$audio[0]
    $sar=Get-RatioValue ([string]$v.sample_aspect_ratio) 1.0
    $fps=Get-RatioValue ([string]$v.r_frame_rate) 30.0

    return [pscustomobject][ordered]@{
        Path=$Path
        VideoCodec=[string]$v.codec_name
        Width=[int]$v.width
        Height=[int]$v.height
        PixelFormat=[string]$v.pix_fmt
        FrameRateText=[string]$v.r_frame_rate
        FrameRate=$fps
        SarText=$(if([string]::IsNullOrWhiteSpace([string]$v.sample_aspect_ratio)){'1:1'}else{[string]$v.sample_aspect_ratio})
        Sar=$sar
        AudioCodec=[string]$a.codec_name
        SampleRate=[int]$a.sample_rate
        Channels=[int]$a.channels
        ChannelLayout=[string]$a.channel_layout
        DisplayWidth=(Get-EvenInt ([double]$v.width * $sar))
    }
}

function Get-ProfileSignature {
    param($Profile)
    return "v:$($Profile.VideoCodec):$($Profile.Width)x$($Profile.Height):$($Profile.PixelFormat):$($Profile.FrameRateText):sar=$($Profile.SarText)|a:$($Profile.AudioCodec):$($Profile.SampleRate):$($Profile.Channels):$($Profile.ChannelLayout)"
}

function Get-Duration {
    param([Parameter(Mandatory=$true)][string]$Path)

    $raw = & $FFprobe -v error `
        -show_entries format=duration `
        -of default=nw=1:nk=1 `
        $Path

    if($LASTEXITCODE -ne 0){ return 0.0 }

    $d=0.0
    [void][double]::TryParse(
        (($raw -join '').Trim()),
        [System.Globalization.NumberStyles]::Float,
        [cultureinfo]::InvariantCulture,
        [ref]$d
    )
    return $d
}

function Escape-ConcatPath {
    param([Parameter(Mandatory=$true)][string]$Path)
    $p=$Path.Replace('\','/')
    return $p.Replace("'","'\''")
}

function Test-CompositeDuration {
    param(
        [Parameter(Mandatory=$true)][string[]]$SourceParts,
        [Parameter(Mandatory=$true)][string]$Candidate
    )

    $expected=0.0
    foreach($p in $SourceParts){ $expected += Get-Duration $p }
    $actual=Get-Duration $Candidate

    if($actual -le 1){
        throw "Composite validation failed: output duration could not be read."
    }

    if($expected -gt 1 -and $actual -lt ($expected * 0.97)){
        throw ("Composite looks truncated: expected about {0:N1}s, got {1:N1}s." -f $expected,$actual)
    }

    return [pscustomobject]@{Expected=$expected;Actual=$actual}
}

function Build-CopyComposite {
    param(
        [Parameter(Mandatory=$true)][string[]]$SourceParts,
        [Parameter(Mandatory=$true)][string]$Destination,
        [Parameter(Mandatory=$true)][string]$WorkDir
    )

    $normalized=@()
    for($i=0;$i -lt $SourceParts.Count;$i++){
        $tmp=Join-Path $WorkDir ("part-{0:D2}.mkv" -f ($i+1))

        # Select only the primary video and primary audio.
        # This safely ignores commentary/alternate audio tracks without re-encoding.
        & $FFmpeg -hide_banner -loglevel warning -nostdin -y `
            -i $SourceParts[$i] `
            -map 0:v:0 `
            -map 0:a:0 `
            -map_metadata -1 `
            -c copy `
            $tmp

        if($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $tmp -PathType Leaf)){
            throw "No-loss remux failed: $($SourceParts[$i])"
        }
        $normalized += $tmp
    }

    $list=Join-Path $WorkDir 'concat.txt'
    $lines=@('ffconcat version 1.0')
    foreach($p in $normalized){
        $lines += "file '$(Escape-ConcatPath $p)'"
    }
    $lines | Set-Content -LiteralPath $list -Encoding ASCII

    & $FFmpeg -hide_banner -loglevel warning -nostdin -y `
        -f concat -safe 0 -i $list `
        -map 0:v:0 `
        -map 0:a:0 `
        -c copy `
        $Destination

    if($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Destination -PathType Leaf)){
        throw "No-loss concat failed."
    }
}

function Build-NormalizedComposite {
    param(
        [Parameter(Mandatory=$true)][string[]]$SourceParts,
        [Parameter(Mandatory=$true)]$Profiles,
        [Parameter(Mandatory=$true)][string]$Destination
    )

    $targetWidth=[int](($Profiles | Measure-Object -Property DisplayWidth -Maximum).Maximum)
    $targetHeight=[int](($Profiles | Measure-Object -Property Height -Maximum).Maximum)
    $targetWidth=Get-EvenInt $targetWidth
    $targetHeight=Get-EvenInt $targetHeight

    # Use the first clip's cadence as the common output cadence.
    $targetFpsText=[string]$Profiles[0].FrameRateText
    if([string]::IsNullOrWhiteSpace($targetFpsText) -or $targetFpsText -eq '0/0'){
        $targetFpsText='30'
    }

    $ffInputs=@()
    foreach($p in $SourceParts){
        $ffInputs += @('-i',$p)
    }

    $filters=@()
    $concatInputs=''
    for($i=0;$i -lt $Profiles.Count;$i++){
        $displayWidth=[int]$Profiles[$i].DisplayWidth

        # Convert coded non-square pixels to their displayed square-pixel width,
        # then pad to a common canvas. We never crop picture content here.
        $filters += "[$i`:v:0]scale=$displayWidth`:$($Profiles[$i].Height):flags=lanczos,setsar=1,pad=$targetWidth`:$targetHeight`:(ow-iw)/2:(oh-ih)/2:black,fps=$targetFpsText[v$i]"
        $filters += "[$i`:a:0]aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo[a$i]"
        $concatInputs += "[v$i][a$i]"
    }
    $filters += "${concatInputs}concat=n=$($Profiles.Count):v=1:a=1[v][a]"
    $filterComplex=$filters -join ';'

    $ffArgs=@(
        '-hide_banner','-loglevel','warning','-nostdin','-y'
    )
    $ffArgs += $ffInputs
    $ffArgs += @(
        '-filter_complex',$filterComplex,
        '-map','[v]',
        '-map','[a]',
        '-c:v','libx264',
        '-preset',$Preset,
        '-crf',[string]$Crf,
        '-pix_fmt','yuv420p',
        '-c:a','aac',
        '-b:a','192k',
        '-ar','48000',
        '-ac','2',
        $Destination
    )

    & $FFmpeg @ffArgs

    if($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Destination -PathType Leaf)){
        throw "Normalized concat failed."
    }
}

function Build-CompositeJob {
    param(
        [Parameter(Mandatory=$true)][string[]]$SourceParts,
        [Parameter(Mandatory=$true)][string]$Destination,
        [ValidateSet('Auto','CopyOnly','Normalize')]
        [string]$JobMode='Auto',
        [switch]$JobForce
    )

    if($SourceParts.Count -lt 2){ throw "A composite requires at least two source parts." }

    $destParent=Split-Path -Parent $Destination
    if([string]::IsNullOrWhiteSpace($destParent)){ throw "Output must include a parent directory: $Destination" }
    [void][IO.Directory]::CreateDirectory($destParent)

    foreach($p in $SourceParts){
        if(-not (Test-Path -LiteralPath $p -PathType Leaf)){ throw "Source file not found: $p" }
    }

    if((Test-Path -LiteralPath $Destination -PathType Leaf) -and -not $JobForce){
        $d=Get-Duration $Destination
        if($d -gt 1){
            Write-Host ""
            Write-Host "GOOD existing composite:"
            Write-Host "  $Destination"
            return
        }
    }

    $profiles=@()
    foreach($p in $SourceParts){ $profiles += Get-MediaProfile $p }

    $signatures=@($profiles | ForEach-Object { Get-ProfileSignature $_ })
    $allMatch=(@($signatures | Select-Object -Unique).Count -eq 1)

    Write-Host ""
    Write-Host "Composite:"
    Write-Host "  $Destination"
    for($i=0;$i -lt $SourceParts.Count;$i++){
        Write-Host ("  [{0}] {1}" -f ($i+1),$SourceParts[$i])
        Write-Host ("      {0}" -f $signatures[$i])
    }

    $selectedMode=$JobMode
    if($JobMode -eq 'Auto'){
        $selectedMode=$(if($allMatch){'CopyOnly'}else{'Normalize'})
    }

    if($selectedMode -eq 'CopyOnly' -and -not $allMatch){
        throw "Primary video/audio streams do not match. CopyOnly cannot safely combine this job. Use -Mode Auto or -Mode Normalize."
    }

    $workDir=Join-Path $destParent ('.composite-work-' + [guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($workDir)
    $ext=[IO.Path]::GetExtension($Destination)
    if([string]::IsNullOrWhiteSpace($ext)){$ext='.mkv'}
    $temp=Join-Path $workDir ('output.partial' + $ext)

    try {
        if($selectedMode -eq 'CopyOnly'){
            Write-Host "Mode: NO-LOSS STREAM COPY"
            Build-CopyComposite -SourceParts $SourceParts -Destination $temp -WorkDir $workDir
        }
        else {
            Write-Host "Mode: HIGH-QUALITY NORMALIZE"
            Write-Host "  No picture content will be cropped."
            Write-Host "  Video encode: H.264 CRF $Crf / preset $Preset"
            Build-NormalizedComposite -SourceParts $SourceParts -Profiles $profiles -Destination $temp
        }

        $check=Test-CompositeDuration -SourceParts $SourceParts -Candidate $temp

        if(Test-Path -LiteralPath $Destination){
            Remove-Item -LiteralPath $Destination -Force
        }
        Move-Item -LiteralPath $temp -Destination $Destination -Force

        Write-Host ("GOOD: {0}" -f $Destination)
        Write-Host ("Duration: {0:N1}s (source total {1:N1}s)" -f $check.Actual,$check.Expected)
    }
    finally {
        Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if(-not [string]::IsNullOrWhiteSpace($RecipePath)){
    if(-not (Test-Path -LiteralPath $RecipePath -PathType Leaf)){
        throw "Recipe not found: $RecipePath"
    }

    $recipe=Get-Content -LiteralPath $RecipePath -Raw | ConvertFrom-Json
    $jobs=@($recipe.Jobs)
    if($jobs.Count -eq 0){ throw "Recipe contains no Jobs: $RecipePath" }

    foreach($job in $jobs){
        $jobMode=$(if([string]::IsNullOrWhiteSpace([string]$job.Mode)){$Mode}else{[string]$job.Mode})
        Build-CompositeJob `
            -SourceParts @($job.Parts) `
            -Destination ([string]$job.Output) `
            -JobMode $jobMode `
            -JobForce:$Force
    }
}
else {
    if($Parts.Count -lt 2){ throw "Supply -Parts with at least two files, or use -RecipePath." }
    if([string]::IsNullOrWhiteSpace($Output)){ throw "Supply -Output, or use -RecipePath." }

    Build-CompositeJob `
        -SourceParts $Parts `
        -Destination $Output `
        -JobMode $Mode `
        -JobForce:$Force
}
