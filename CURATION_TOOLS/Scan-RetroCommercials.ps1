param(
    [string]$Root = 'F:\[VIDEOS]\Commercials',
    [string]$FFprobePath = 'ffprobe'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Root)) {
    throw "Folder not found: $Root"
}

try {
    & $FFprobePath -version *> $null
} catch {
    throw "ffprobe was not found. Install FFmpeg or pass -FFprobePath with the full path to ffprobe.exe."
}

$videoExtensions = @(
    '.mp4', '.m4v', '.mov', '.avi', '.mkv', '.mpg', '.mpeg',
    '.ogv', '.webm', '.3gp', '.wmv'
)

$files = Get-ChildItem -LiteralPath $Root -Recurse -File |
    Where-Object { $videoExtensions -contains $_.Extension.ToLowerInvariant() }

Write-Host "Found $($files.Count) video files. Reading media headers..."

$results = for ($i = 0; $i -lt $files.Count; $i++) {
    $file = $files[$i]

    Write-Progress `
        -Activity "Scanning retro TV assets" `
        -Status "$($i + 1) / $($files.Count): $($file.Name)" `
        -PercentComplete ((($i + 1) / [math]::Max($files.Count, 1)) * 100)

    $relative = $file.FullName.Substring($Root.TrimEnd('\').Length).TrimStart('\')
    $relativeParts = $relative -split '\\'
    $sourcePack = if ($relativeParts.Count -gt 1) { $relativeParts[0] } else { '(root)' }

    $probe = $null
    $probeError = $null

    try {
        $json = & $FFprobePath `
            -v error `
            -show_entries 'format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels' `
            -of json `
            -- `
            $file.FullName 2>&1

        if ($LASTEXITCODE -ne 0) {
            throw ($json -join "`n")
        }

        $probe = ($json -join "`n") | ConvertFrom-Json
    } catch {
        $probeError = $_.Exception.Message
    }

    $duration = $null
    $video = $null
    $audio = $null

    if ($probe) {
        if ($probe.format.duration) {
            $duration = [double]$probe.format.duration
        }

        $video = $probe.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
        $audio = $probe.streams | Where-Object { $_.codec_type -eq 'audio' } | Select-Object -First 1
    }

    $role = 'UNKNOWN'
    if ($null -ne $duration) {
        if ($duration -le 15) {
            $role = 'BUMPER_IDENT_CANDIDATE'
        } elseif ($duration -le 75) {
            $role = 'INDIVIDUAL_COMMERCIAL_CANDIDATE'
        } elseif ($duration -le 300) {
            $role = 'SHORT_BREAK_OR_COMPILATION'
        } else {
            $role = 'LONG_COMPILATION_OR_WOC'
        }
    }

    $year = $null
    if ($file.Name -match '(?<!\d)((?:19|20)\d{2})(?!\d)') {
        $year = $Matches[1]
    }

    $duplicateKey = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $duplicateKey = $duplicateKey -replace '\.ia$', ''

    $nameLower = $file.Name.ToLowerInvariant()
    $preferredRepresentation = (
        $file.Extension.ToLowerInvariant() -eq '.mp4' -and
        $nameLower -notlike '*.ia.mp4'
    )

    [pscustomobject]@{
        SourcePack              = $sourcePack
        RelativePath            = $relative
        FullName                = $file.FullName
        FileName                = $file.Name
        Extension               = $file.Extension.ToLowerInvariant()
        SizeBytes               = $file.Length
        SizeMB                  = [math]::Round($file.Length / 1MB, 2)
        YearFromName            = $year
        DurationSeconds         = if ($null -ne $duration) { [math]::Round($duration, 3) } else { $null }
        DurationMinutes         = if ($null -ne $duration) { [math]::Round($duration / 60, 2) } else { $null }
        LikelyRole              = $role
        VideoCodec              = if ($video) { $video.codec_name } else { $null }
        Width                   = if ($video) { $video.width } else { $null }
        Height                  = if ($video) { $video.height } else { $null }
        FrameRate               = if ($video) { $video.r_frame_rate } else { $null }
        AudioCodec              = if ($audio) { $audio.codec_name } else { $null }
        SampleRate              = if ($audio) { $audio.sample_rate } else { $null }
        Channels                = if ($audio) { $audio.channels } else { $null }
        DuplicateKey            = $duplicateKey
        PreferredRepresentation = $preferredRepresentation
        ProbeError              = $probeError
    }
}

Write-Progress -Activity "Scanning retro TV assets" -Completed

$outFile = Join-Path $Root 'commercial-media-scan.csv'
$results | Export-Csv -LiteralPath $outFile -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "Done."
Write-Host "Report: $outFile"
Write-Host ""
Write-Host "Counts by likely role:"
$results | Group-Object LikelyRole | Sort-Object Count -Descending |
    Format-Table Count, Name -AutoSize

Write-Host "Counts by source pack:"
$results | Group-Object SourcePack | Sort-Object Count -Descending |
    Format-Table Count, Name -AutoSize

$errors = $results | Where-Object { $_.ProbeError }
if ($errors) {
    Write-Host "ffprobe errors: $($errors.Count)"
} else {
    Write-Host "ffprobe errors: 0"
}
