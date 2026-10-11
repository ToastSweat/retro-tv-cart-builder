[CmdletBinding()]
param(
    [string]$SystemRoot = 'F:\[VIDEOS]\retro-tv-cart-builder'
)

$ErrorActionPreference = 'Stop'

function Backup-File {
    param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$BackupRoot)
    if(-not (Test-Path -LiteralPath $Path -PathType Leaf)){ throw "Required file not found: $Path" }
    $rel = $Path.Substring($SystemRoot.Length).TrimStart('\')
    $dest = Join-Path $BackupRoot $rel
    [void][IO.Directory]::CreateDirectory((Split-Path -Parent $dest))
    Copy-Item -LiteralPath $Path -Destination $dest -Force
}

function Replace-Exact {
    param(
        [Parameter(Mandatory=$true)][ref]$Text,
        [Parameter(Mandatory=$true)][string]$Old,
        [Parameter(Mandatory=$true)][string]$New,
        [Parameter(Mandatory=$true)][string]$Label
    )
    if(-not $Text.Value.Contains($Old)){ throw "Hotfix could not find expected code for: $Label. Nothing was written." }
    $Text.Value = $Text.Value.Replace($Old,$New)
}

$finalizer = Join-Path $SystemRoot 'TOOLKIT\Build-RetroCartFinal.ps1'
$launcher  = Join-Path $SystemRoot 'TOOLKIT\Start-RetroCartStudio.ps1'

foreach($f in @($finalizer,$launcher)){
    if(-not (Test-Path -LiteralPath $f -PathType Leaf)){ throw "Required file not found: $f" }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $SystemRoot "HOTFIXES\v1.8.2-$stamp"
[void][IO.Directory]::CreateDirectory($backupRoot)
Backup-File $finalizer $backupRoot
Backup-File $launcher $backupRoot

$f = [IO.File]::ReadAllText($finalizer)

# Add validation/retry helpers before the main state-loading section.
$anchor = '$stateDir=Join-Path $SystemRoot ''STATE'''
$helpers = @'
function To-NumberOrZero($Value){
    $n=0.0
    [void][double]::TryParse(
        ([string]$Value),
        [System.Globalization.NumberStyles]::Float,
        [cultureinfo]::InvariantCulture,
        [ref]$n
    )
    return $n
}

function Remove-DirectoryWithRetry {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [int]$Attempts = 6,
        [int]$DelayMs = 200
    )
    if(-not (Test-Path -LiteralPath $Path)){ return $true }

    for($try=1; $try -le $Attempts; $try++){
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            return $true
        }
        catch {
            if($try -lt $Attempts){ Start-Sleep -Milliseconds $DelayMs }
        }
    }
    return -not (Test-Path -LiteralPath $Path)
}

function Test-FinalMatchesCurrent {
    param(
        [Parameter(Mandatory=$true)][string]$FinalDir,
        [Parameter(Mandatory=$true)]$Manifest,
        [Parameter(Mandatory=$true)]$ReviewBySlot
    )

    $finalManifestPath=Join-Path $FinalDir 'cart-final-manifest.csv'
    if(-not (Test-Path -LiteralPath $finalManifestPath -PathType Leaf)){ return $false }

    try { $rows=@(Import-Csv -LiteralPath $finalManifestPath) }
    catch { return $false }

    if($rows.Count -ne $Manifest.Count){ return $false }
    $bySlot=@{}
    foreach($row in $rows){ $bySlot[$row.SlotID]=$row }

    foreach($m in $Manifest){
        $row=$bySlot[$m.SlotID]
        $reviewRow=$ReviewBySlot[$m.SlotID]
        if(-not $row -or -not $reviewRow){ return $false }
        if($row.AssetID -ne $m.AssetID){ return $false }

        foreach($pair in @(
            @('TrimStartSeconds','TrimStartSeconds'),
            @('TrimEndSeconds','TrimEndSeconds'),
            @('CropLeft','CropLeft'),
            @('CropRight','CropRight'),
            @('CropTop','CropTop'),
            @('CropBottom','CropBottom')
        )){
            if((To-NumberOrZero $row.($pair[0])) -ne (To-NumberOrZero $m.($pair[1]))){ return $false }
        }

        if(([string]$row.AudioRepair).Trim().ToUpperInvariant() -ne ([string]$m.AudioRepair).Trim().ToUpperInvariant()){
            return $false
        }

        $file=Join-Path $FinalDir $row.FileName
        if(-not (Test-Path -LiteralPath $file -PathType Leaf)){ return $false }

        $finalLength=[long](Get-Item -LiteralPath $file).Length
        $proxyLength=[long](Get-Item -LiteralPath $reviewRow.ProxyPath).Length
        if($finalLength -ne $proxyLength){ return $false }
    }

    return $true
}

'@
if(-not $f.Contains($anchor)){ throw "Hotfix could not find finalizer state anchor. Nothing was written." }
$f = $f.Replace($anchor,$helpers + $anchor)

# Delay volume-label mutation until after local FINAL is confirmed ready.
$oldDriveBlock = @'
$limit=$TargetBytes
if(-not [string]::IsNullOrWhiteSpace($TargetDrive)){
    $root=[IO.Path]::GetPathRoot($TargetDrive)
    if([string]::IsNullOrWhiteSpace($root)){ $root=$TargetDrive }
    $di=New-Object IO.DriveInfo($root)
    if(-not $di.IsReady){throw "Target drive is not ready: $TargetDrive"}
    $limit=[long]($di.AvailableFreeSpace * 0.97)
    Write-Host "Target drive free space: $($di.AvailableFreeSpace) bytes"
    Write-Host "Using 97% safety limit:  $limit bytes"

    $effectiveLabel = if([string]::IsNullOrWhiteSpace($VolumeLabel)){
        Get-DefaultVolumeLabel $CartID
    } else {
        $VolumeLabel
    }
    [void](Set-CartridgeVolumeLabel -TargetDrive $TargetDrive -Label $effectiveLabel)
}
'@
$newDriveBlock = @'
$limit=$TargetBytes
$effectiveLabel=''
if(-not [string]::IsNullOrWhiteSpace($TargetDrive)){
    $root=[IO.Path]::GetPathRoot($TargetDrive)
    if([string]::IsNullOrWhiteSpace($root)){ $root=$TargetDrive }
    $di=New-Object IO.DriveInfo($root)
    if(-not $di.IsReady){throw "Target drive is not ready: $TargetDrive"}
    $limit=[long]($di.AvailableFreeSpace * 0.97)
    Write-Host "Target drive free space: $($di.AvailableFreeSpace) bytes"
    Write-Host "Using 97% safety limit:  $limit bytes"

    $effectiveLabel = if([string]::IsNullOrWhiteSpace($VolumeLabel)){
        Get-DefaultVolumeLabel $CartID
    } else {
        $VolumeLabel
    }
}
'@
Replace-Exact ([ref]$f) $oldDriveBlock $newDriveBlock 'delay USB relabel'

# Replace destructive FINAL rebuild with reuse-or-transactional-publish.
$oldFinalBlock = @'
$finalDir=Join-Path $revDir 'FINAL'
if(Test-Path -LiteralPath $finalDir){
    if(-not $Force){throw "FINAL already exists: $finalDir. Use -Force to rebuild it."}
    Remove-Item -LiteralPath $finalDir -Recurse -Force
}
[void][IO.Directory]::CreateDirectory($finalDir)

$finalRows=New-Object 'System.Collections.Generic.List[object]'
foreach($m in $manifest){
    $r=$reviewBySlot[$m.SlotID]
    $role=(Sanitize-FileName $m.Role).Replace(' ','_')
    $title=(Sanitize-FileName $m.Title).Replace(' ','_')
    $name="$($m.Position)_${role}_${title}.mp4"
    $dest=Join-Path $finalDir $name
    Copy-Item -LiteralPath $r.ProxyPath -Destination $dest -Force
    $finalRows.Add([pscustomobject][ordered]@{
        Position=$m.Position;SlotID=$m.SlotID;AssetID=$m.AssetID;Role=$m.Role;Title=$m.Title
        FileName=$name;Bytes=(Get-Item -LiteralPath $dest).Length
        TrimStartSeconds=$m.TrimStartSeconds;TrimEndSeconds=$m.TrimEndSeconds
        CropLeft=$m.CropLeft;CropRight=$m.CropRight;CropTop=$m.CropTop;CropBottom=$m.CropBottom
        AudioRepair=$m.AudioRepair
    })
}
Export-Utf8Csv $finalRows (Join-Path $finalDir 'cart-final-manifest.csv')

$readme=@"
$CartID $revName
Built: $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))
Files are normalized to the tested Mini Retro TV profile:
H.264 / 618x480 / 30 fps / yuv420p / AAC / 44.1 kHz stereo.
Total bytes: $total
"@
Set-Content -LiteralPath (Join-Path $finalDir 'README.txt') -Value $readme -Encoding UTF8
'@
$newFinalBlock = @'
$finalDir=Join-Path $revDir 'FINAL'
$reuseExistingFinal=$false

if(Test-Path -LiteralPath $finalDir){
    $reuseExistingFinal=Test-FinalMatchesCurrent -FinalDir $finalDir -Manifest $manifest -ReviewBySlot $reviewBySlot
    if($reuseExistingFinal){
        Write-Host ""
        Write-Host "Existing FINAL already matches the current revision."
        Write-Host "Reusing: $finalDir"
    }
    elseif(-not $Force){
        throw "FINAL already exists but does not match the current revision: $finalDir. Use -Force to rebuild it."
    }
}

if(-not $reuseExistingFinal){
    $stagingDir="$finalDir.__building-$([guid]::NewGuid().ToString('N').Substring(0,8))"
    [void][IO.Directory]::CreateDirectory($stagingDir)

    try {
        $finalRows=New-Object 'System.Collections.Generic.List[object]'
        foreach($m in $manifest){
            $r=$reviewBySlot[$m.SlotID]
            $role=(Sanitize-FileName $m.Role).Replace(' ','_')
            $title=(Sanitize-FileName $m.Title).Replace(' ','_')
            $name="$($m.Position)_${role}_${title}.mp4"
            $dest=Join-Path $stagingDir $name
            Copy-Item -LiteralPath $r.ProxyPath -Destination $dest -Force
            $finalRows.Add([pscustomobject][ordered]@{
                Position=$m.Position;SlotID=$m.SlotID;AssetID=$m.AssetID;Role=$m.Role;Title=$m.Title
                FileName=$name;Bytes=(Get-Item -LiteralPath $dest).Length
                TrimStartSeconds=$m.TrimStartSeconds;TrimEndSeconds=$m.TrimEndSeconds
                CropLeft=$m.CropLeft;CropRight=$m.CropRight;CropTop=$m.CropTop;CropBottom=$m.CropBottom
                AudioRepair=$m.AudioRepair
            })
        }
        Export-Utf8Csv $finalRows (Join-Path $stagingDir 'cart-final-manifest.csv')

        $readme=@"
$CartID $revName
Built: $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))
Files are normalized to the tested Mini Retro TV profile:
H.264 / 618x480 / 30 fps / yuv420p / AAC / 44.1 kHz stereo.
Total bytes: $total
"@
        Set-Content -LiteralPath (Join-Path $stagingDir 'README.txt') -Value $readme -Encoding UTF8

        if(Test-Path -LiteralPath $finalDir){
            if(-not (Remove-DirectoryWithRetry -Path $finalDir)){
                throw "The existing FINAL is stale but Windows has it locked: $finalDir`n`nClose any video/player/Explorer preview using files in that FINAL folder, then retry. The USB has NOT been relabeled or written."
            }
        }

        Move-Item -LiteralPath $stagingDir -Destination $finalDir -Force
    }
    catch {
        if(Test-Path -LiteralPath $stagingDir){
            [void](Remove-DirectoryWithRetry -Path $stagingDir -Attempts 2 -DelayMs 50)
        }
        throw
    }
}
'@
Replace-Exact ([ref]$f) $oldFinalBlock $newFinalBlock 'reuse/transactional FINAL build'

# Relabel only once FINAL is known-good and immediately before USB copy.
$oldCopyStart = @'
if(-not [string]::IsNullOrWhiteSpace($TargetDrive)){
    $root=[IO.Path]::GetPathRoot($TargetDrive)
    if([string]::IsNullOrWhiteSpace($root)){ $root=$TargetDrive }

    $copyFiles = @(Get-ChildItem -LiteralPath $finalDir -File -Filter '*.mp4' | Sort-Object Name)
'@
$newCopyStart = @'
if(-not [string]::IsNullOrWhiteSpace($TargetDrive)){
    $root=[IO.Path]::GetPathRoot($TargetDrive)
    if([string]::IsNullOrWhiteSpace($root)){ $root=$TargetDrive }

    # Mutate the USB only after the local FINAL has been validated/reused/rebuilt.
    [void](Set-CartridgeVolumeLabel -TargetDrive $TargetDrive -Label $effectiveLabel)

    $copyFiles = @(Get-ChildItem -LiteralPath $finalDir -File -Filter '*.mp4' | Sort-Object Name)
'@
Replace-Exact ([ref]$f) $oldCopyStart $newCopyStart 'late USB relabel'

[IO.File]::WriteAllText($finalizer,$f,(New-Object Text.UTF8Encoding($true)))

$l=[IO.File]::ReadAllText($launcher)
if($l.Contains('Retro TV Cart Studio v1.8.1')){
    $l=$l.Replace('Retro TV Cart Studio v1.8.1','Retro TV Cart Studio v1.8.2')
}
elseif($l.Contains('Retro TV Cart Studio v1.8.0')){
    $l=$l.Replace('Retro TV Cart Studio v1.8.0','Retro TV Cart Studio v1.8.2')
}
[IO.File]::WriteAllText($launcher,$l,(New-Object Text.UTF8Encoding($true)))

Write-Host ""
Write-Host "v1.8.2 Final Cartridge fix installed."
Write-Host ""
Write-Host "  - A valid existing FINAL is reused instead of deleted/rebuilt."
Write-Host "  - New FINAL builds happen in a staging directory, then publish atomically."
Write-Host "  - If a stale FINAL is locked, the build stops with a clear message."
Write-Host "  - The target USB is not relabeled until FINAL is confirmed ready."
Write-Host "  - Your existing review/revision/state are untouched."
Write-Host ""
Write-Host "Restart Studio and use BUILD FINAL + COPY TO SELECTED DRIVE again."
