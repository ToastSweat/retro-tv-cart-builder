# Retro TV -- station branding inventory + optional ffprobe media scan
# Compatible with Windows PowerShell 5.1 and PowerShell 7+.
[CmdletBinding()]
param(
    [string]$Root = 'F:\[VIDEOS]\Commercials',
    [string]$InventoryCsv = '',
    [string]$OutputCsv = '',
    [string]$FFprobe = 'ffprobe',
    [switch]$SkipProbe,
    [int]$MaxFiles = 0
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item -LiteralPath $Root -ErrorAction Stop).FullName.TrimEnd([char]'\')
if (-not $InventoryCsv) { $InventoryCsv = "$Root\retro-assets-inventory.csv" }
$reviewDir = "$Root\_BRANDING_REVIEW"
if (-not $OutputCsv) { $OutputCsv = "$reviewDir\branding-media-scan.csv" }
[void][IO.Directory]::CreateDirectory($reviewDir)
if (-not (Test-Path -LiteralPath $InventoryCsv -PathType Leaf)) { throw "Inventory CSV not found: $InventoryCsv" }
if (-not $SkipProbe -and -not (Get-Command $FFprobe -ErrorAction SilentlyContinue)) {
    throw 'ffprobe is not on PATH. Install FFmpeg, pass -FFprobe with its path, or use -SkipProbe.'
}
$videoExtensions = @('.mp4', '.m4v', '.mov', '.avi', '.mkv', '.mpeg', '.mpg', '.wmv', '.webm', '.ts')
$assets = @(Import-Csv -LiteralPath $InventoryCsv | Where-Object {
    (($_.TopFolder -like 'Bumpers-*') -or ($_.TopFolder -eq 'nickelodeon-2004-ready-set-style-sweepstakes-myscene')) -and
    ($videoExtensions -contains $_.Extension.ToLowerInvariant()) -and
    (-not $_.FileName.StartsWith('._'))
})
if ($MaxFiles -gt 0) { $assets = @($assets | Select-Object -First $MaxFiles) }
Write-Host "Branding-source videos in inventory: $($assets.Count)"
Write-Host "Other commercial collections will NOT be rescanned."

function Guess-Network([string]$relative, [string]$name, [string]$topFolder) {
    if ($topFolder -like 'Bumpers-*') {
        if ($name -match '(?i)\bSNICK\b' -or $relative -match '(?i)\\(?:SNICK|SNICK Bumpers)(?:\\|\b)') { return 'SNICK' }
        $m = [regex]::Match($relative, '(?i)^Bumpers-[^\\]+\\Bumpers\\([^\\]+)')
        if ($m.Success) {
            $folder = $m.Groups[1].Value
            if ($folder -match '(?i)^Cartoon Network') { return 'CN' }
            if ($folder -match '(?i)^\[as\]|Adult Swim') { return 'ADULT_SWIM' }
            if ($folder -match '(?i)^Toonami') { return 'TOONAMI' }
            if ($folder -match '(?i)^Nick GAS') { return 'NICK_GAS' }
            if ($folder -match '(?i)^Nickelodeon') { return 'NICK' }
            if ($folder -match '(?i)^FOX Kids') { return 'FOX' }
            if ($folder -match '(?i)^MTV') { return 'MTV' }
        }
    }
    # Flat AdsAndBumps archive -- these are filename guesses, NOT verified provenance.
    if ($name -match '(?i)\bSNICK\b') { return 'SNICK' }
    if ($name -match '(?i)\bNick\s*GAS\b') { return 'NICK_GAS' }
    if ($name -match '(?i)\bNickelodeon\b|\bNick\s*Jr\b') { return 'NICK' }
    if ($name -match '(?i)\bKids.?\s*WB\b|\bWB\s*Kids\b') { return 'KWB' }
    if ($name -match '(?i)\bFOX\s*Kids\b') { return 'FOX' }
    if ($name -match '(?i)\bAdult\s*Swim\b') { return 'ADULT_SWIM' }
    if ($name -match '(?i)\bToonami\b') { return 'TOONAMI' }
    if ($name -match '(?i)\bCartoon\s*Network\b') { return 'CN' }
    if ($name -match '(?i)\bBoomerang\b') { return 'BOOM' }
    if ($name -match '(?i)\bSci.?Fi\s*Channel\b') { return 'SCIFI' }
    if ($name -match '(?i)\bUPN\b') { return 'UPN' }
    if ($name -match '(?i)\bHBO\b') { return 'HBO' }
    if ($name -match '(?i)\bAMC\b') { return 'AMC' }
    if ($name -match '(?i)\bMTV\b') { return 'MTV' }
    if ($name -match '(?i)\bDisney\s*Channel\b') { return 'DISNEY' }
    if ($name -match '(?i)\bPBS\b') { return 'PBS' }
    if ($name -match '(?i)\bABC\b') { return 'ABC' }
    if ($name -match '(?i)\bCBS\b') { return 'CBS' }
    if ($name -match '(?i)\bNBC\b') { return 'NBC' }
    if ($name -match '(?i)\bFOX\b') { return 'FOX_NETWORK' }
    if ($name -match '(?i)\bYTV\b|\bTeletoon\b') { return 'NON_US' }
    return 'UNKNOWN'
}

function Guess-Type([string]$relative, [string]$name) {
    $hint = $relative -replace '_', ' '
    if ($hint -match '(?i)\\(?:CN Ads|Commercials)(?:\\|$)' -and $name -notmatch '(?i)bumper|\bbump\b|promo|ident|\bid\b') { return 'AD' }
    if ($hint -match '(?i)\\(?:CN Music Videos|Music Videos|Cartoon Network Groovies|4 - Theme Songs)(?:\\|$)' -and $name -notmatch '(?i)\bbumper\b|\bpromo\b') { return 'MUSIC_VIDEO' }
    if ($hint -match '(?i)5 - We.ll Be Right Back|\bwe.ll be right back\b|\bwill be right back\b|\bwill return\b|\bstay tuned\b|\bgoing to commercial\b|\bto commercial\b') { return 'BUMPER_OUT' }
    if ($hint -match '(?i)6 - Now Back To|\bnow back\b|\bback to (the |your )?show\b|\bback from commercial\b|\bwelcome back\b|\bhas returned\b') { return 'BUMPER_IN' }
    if ($hint -match '(?i)1 - Coming Up Next|\bup next\b|\bcoming up\b|\bnext on\b|\bcoming next\b|\btonight on\b') { return 'NEXT' }
    if ($hint -match '(?i)2 - Station IDs|\bstation id\b|\bident\b|\bnetwork id\b|\bstation identification\b|\bindent\b') { return 'IDENT' }
    if ($hint -match '(?i)\bsign[ -]?off\b|\bclosedown\b|\bshutdown\b') { return 'SIGN_OFF' }
    if ($hint -match '(?i)\bpromo\b|\bpreview\b|\btrailer\b|\bsweepstakes\b') { return 'PROMO' }
    if ($hint -match '(?i)\bintro\b|\bopening\b|\btheme\b') { return 'INTRO' }
    if ($hint -match '(?i)\bstatic\b|\btransition\b|\binterstitial\b') { return 'TRANSITION' }
    if ($hint -match '(?i)\bbumper\b|\bbump\b|\bpre.show\b|\bpost.show\b') { return 'BUMPER_GENERIC' }
    return 'OTHER'
}

$archiveTag = 'nickelodeon-2004-ready-set-style-sweepstakes-myscene'
$previous = @{}
if (Test-Path -LiteralPath $OutputCsv -PathType Leaf) {
    foreach ($old in (Import-Csv -LiteralPath $OutputCsv)) {
        if ($old.Id) { $previous[$old.Id] = $old }
    }
    Write-Host "Loaded $($previous.Count) prior scan rows; unchanged probes will be reused."
}
$hash = [System.Security.Cryptography.SHA256]::Create()
$utf8 = New-Object System.Text.UTF8Encoding($false)
$result = New-Object 'System.Collections.Generic.List[object]'
$probed = 0; $reused = 0; $missing = 0; $errors = 0
try {
    for ($i=0; $i -lt $assets.Count; $i++) {
        $a = $assets[$i]
        $rel = $a.RelativePath
        $full = "$Root\$rel"
        $id = [BitConverter]::ToString($hash.ComputeHash($utf8.GetBytes($rel.ToLowerInvariant()))).Replace('-','').Substring(0,20).ToLowerInvariant()
        $typeGuess = Guess-Type $rel $a.FileName
        $networkGuess = Guess-Network $rel $a.FileName $a.TopFolder
        $isBumpers = $a.TopFolder -like 'Bumpers-*'
        $isCandidate = $typeGuess -notin @('AD', 'MUSIC_VIDEO') -and ($isBumpers -or $typeGuess -ne 'OTHER')
        $year = ''
        $ym = [regex]::Match($a.FileName, '(?<!\d)(19[89]\d|20[012]\d)(?!\d)')
        if ($ym.Success) { $year = $ym.Groups[1].Value }
        $stamp = ''; $bytes = ''; $duration = ''; $vcodec = ''; $acodec = ''; $width = ''; $height = ''; $fps = ''; $samplerate = ''; $probeError = ''; $isMissing = $false
        $item = Get-Item -LiteralPath $full -ErrorAction SilentlyContinue
        if (-not $item) {
            $missing++; $isMissing = $true; $probeError = 'Missing file (inventory is stale)'
        } else {
            $stamp = [string]$item.LastWriteTimeUtc.Ticks
            $bytes = [string]$item.Length
            $old = $previous[$id]
            $unchanged = $old -and ($old.Bytes -eq $bytes) -and ($old.ModifiedUtcTicks -eq $stamp) -and ($old.ProbeMode -eq 'PROBED')
            if ($unchanged) {
                $reused++
                $duration=$old.DurationSeconds; $vcodec=$old.VideoCodec; $acodec=$old.AudioCodec
                $width=$old.Width; $height=$old.Height; $fps=$old.FrameRate; $samplerate=$old.SampleRate
                $probeError=$old.ProbeError
            } elseif (-not $SkipProbe) {
                $probed++
                try {
                    $raw = & $FFprobe -v error -show_entries 'format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels' -of json $full 2>$null
                    if ($LASTEXITCODE -ne 0 -or -not $raw) { throw "ffprobe exit code $LASTEXITCODE" }
                    $meta = ($raw -join "`n") | ConvertFrom-Json
                    $dv = $meta.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
                    $da = $meta.streams | Where-Object { $_.codec_type -eq 'audio' } | Select-Object -First 1
                    if ($dv) { $vcodec=$dv.codec_name; $width=$dv.width; $height=$dv.height; $fps=$dv.avg_frame_rate }
                    if ($da) { $acodec=$da.codec_name; $samplerate=$da.sample_rate }
                    if ($meta.format.duration) {
                        $d=0.0
                        if ([double]::TryParse([string]$meta.format.duration, [System.Globalization.NumberStyles]::Float, [cultureinfo]::InvariantCulture, [ref]$d)) {
                            $duration = $d.ToString('0.###', [cultureinfo]::InvariantCulture)
                        }
                    }
                } catch { $probeError = $_.Exception.Message; $errors++ }
            }
        }
        $result.Add([pscustomobject][ordered]@{
            Id=$id; RootRelativePath=$rel; FileName=$a.FileName; SourceFolder=$a.TopFolder
            SourceCollection=$(if ($a.TopFolder -eq $archiveTag) { 'AdsAndBumps' } else { 'Google Drive Bumpers' })
            NetworkGuess=$networkGuess; TypeGuess=$typeGuess; IsBrandingCandidate=$isCandidate
            YearGuess=$year; Bytes=$bytes; ModifiedUtcTicks=$stamp; DurationSeconds=$duration
            VideoCodec=$vcodec; AudioCodec=$acodec; Width=$width; Height=$height
            FrameRate=$fps; SampleRate=$samplerate; ProbeError=$probeError
            Missing=$isMissing; ProbeMode=$(if ($isMissing) { 'MISSING' } elseif ($SkipProbe) { 'SKIPPED' } else { 'PROBED' })
        })
        if (($i+1) % 100 -eq 0 -or $i -eq ($assets.Count-1)) {
            Write-Progress -Activity 'Scanning Retro TV branding sources' -Status "$($i+1) / $($assets.Count) | probed $probed | reused $reused | errors $errors" -PercentComplete ((($i+1)/[math]::Max(1,$assets.Count))*100)
        }
        if (($i+1) % 250 -eq 0) { $result | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation -Encoding UTF8 }
    }
} finally { $hash.Dispose() }
$result | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation -Encoding UTF8
Write-Progress -Activity 'Scanning Retro TV branding sources' -Completed
Write-Host ""
Write-Host "Scan saved: $OutputCsv"
Write-Host "Rows: $($result.Count) | new probes: $probed | reused: $reused | missing: $missing | probe errors: $errors"
Write-Host "Likely branding: $( @($result | Where-Object { $_.IsBrandingCandidate }).Count )"
Write-Host 'These are FILENAME/FOLDER guesses, not verified broadcast dates or networks.'
