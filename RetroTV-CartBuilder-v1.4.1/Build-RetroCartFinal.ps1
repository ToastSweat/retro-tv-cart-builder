# Retro TV Cart Builder v1.1 -- create the clean numbered cartridge folder from the approved current review proxies
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [string]$SystemRoot = 'F:\[VIDEOS]\Retro TV Cart Builder',
    [long]$TargetBytes = 3600000000,
    [string]$TargetDrive = '',
    [string]$VolumeLabel = '',
    [switch]$Force
)
$ErrorActionPreference='Stop'

function Export-Utf8Csv {
    param([Parameter(Mandatory=$true)]$Rows, [Parameter(Mandatory=$true)][string]$Path)
    $parent = Split-Path -Parent $Path
    if ($parent) { [void][IO.Directory]::CreateDirectory($parent) }
    $buffer = New-Object System.Collections.ArrayList
    foreach ($row in $Rows) { [void]$buffer.Add($row) }
    if ($buffer.Count -eq 0) { Set-Content -LiteralPath $Path -Value $null -Encoding UTF8 }
    else { $buffer | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8 }
}
function Sanitize-FileName([string]$s){
    foreach($c in [IO.Path]::GetInvalidFileNameChars()){ $s=$s.Replace([string]$c,'_') }
    $s=$s -replace '\s+',' '
    $s=$s.Trim(' ','_','.')
    if($s.Length -gt 100){$s=$s.Substring(0,100).Trim()}
    return $s
}

function Get-DefaultVolumeLabel([string]$CartID){
    # Friendly cartridge labels: NICK01 -> NICK1, CN05 -> CN5, BOOM02 -> BOOM2.
    # Labels without a trailing zero-padded number (SNICK, POWER, FOX96, etc.)
    # remain unchanged.
    if($CartID -match '^(.*?)(0([1-9]))$'){
        return ($matches[1] + $matches[3]).ToUpperInvariant()
    }
    return $CartID.ToUpperInvariant()
}

function Set-CartridgeVolumeLabel {
    param(
        [Parameter(Mandatory=$true)][string]$TargetDrive,
        [Parameter(Mandatory=$true)][string]$Label
    )

    $root=[IO.Path]::GetPathRoot($TargetDrive)
    if([string]::IsNullOrWhiteSpace($root)){ $root=$TargetDrive }
    if($root -notmatch '^([A-Za-z]):\\?$'){
        throw "Cannot determine drive letter from TargetDrive: $TargetDrive"
    }

    $driveLetter=$matches[1].ToUpperInvariant()

    # FAT/FAT32 volume labels are limited to 11 characters.
    $safe=($Label -replace '[\\/:*?"<>|.+,;=\\[\\]]','').Trim()
    if([string]::IsNullOrWhiteSpace($safe)){ throw "Volume label became empty after sanitizing." }
    if($safe.Length -gt 11){ $safe=$safe.Substring(0,11) }

    try {
        Set-Volume -DriveLetter $driveLetter -NewFileSystemLabel $safe -ErrorAction Stop
    }
    catch {
        # Fallback for systems where Set-Volume is unavailable/restricted.
        $labelExe = Join-Path $env:SystemRoot 'System32\label.exe'
        & $labelExe "$driveLetter`:" $safe
        if($LASTEXITCODE -ne 0){ throw "Could not set volume label to '$safe' on $driveLetter`:." }
    }

    Write-Host "Volume label: $driveLetter`: -> $safe"
    return $safe
}

function Copy-FileWithOverallProgress {
    param(
        [Parameter(Mandatory=$true)][string]$Source,
        [Parameter(Mandatory=$true)][string]$Destination,
        [Parameter(Mandatory=$true)][long]$OverallBytesBefore,
        [Parameter(Mandatory=$true)][long]$OverallBytesTotal,
        [Parameter(Mandatory=$true)][int]$FileIndex,
        [Parameter(Mandatory=$true)][int]$FileCount
    )

    $bufferSize = 4MB
    $buffer = New-Object byte[] $bufferSize
    $sourceInfo = Get-Item -LiteralPath $Source
    $fileSize = [long]$sourceInfo.Length
    $fileCopied = [long]0

    $src = [System.IO.File]::Open($Source, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    try {
        $dst = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try {
            while (($read = $src.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $dst.Write($buffer, 0, $read)
                $fileCopied += $read

                $overallCopied = $OverallBytesBefore + $fileCopied
                $overallPct = if ($OverallBytesTotal -gt 0) { [math]::Min(100, ($overallCopied / $OverallBytesTotal) * 100) } else { 100 }
                $filePct = if ($fileSize -gt 0) { [math]::Min(100, ($fileCopied / $fileSize) * 100) } else { 100 }

                $overallGB = [math]::Round($overallCopied / 1GB, 2)
                $totalGB = [math]::Round($OverallBytesTotal / 1GB, 2)

                Write-Progress `
                    -Id 1 `
                    -Activity "Copying $CartID to cartridge" `
                    -Status ("File {0}/{1} · {2:N2}/{3:N2} GiB" -f $FileIndex,$FileCount,$overallGB,$totalGB) `
                    -PercentComplete $overallPct

                Write-Progress `
                    -Id 2 `
                    -ParentId 1 `
                    -Activity $sourceInfo.Name `
                    -Status ("{0:N1}% · {1:N1}/{2:N1} MB" -f $filePct,($fileCopied/1MB),($fileSize/1MB)) `
                    -PercentComplete $filePct
            }
        }
        finally {
            $dst.Dispose()
        }
    }
    finally {
        $src.Dispose()
    }

    # Preserve last-write time for easier comparison/debugging.
    try {
        (Get-Item -LiteralPath $Destination).LastWriteTime = $sourceInfo.LastWriteTime
    } catch {}
}

$stateDir=Join-Path $SystemRoot 'STATE'
$settings=Get-Content -LiteralPath (Join-Path $stateDir 'settings.json') -Raw | ConvertFrom-Json
$carts=@(Import-Csv -LiteralPath $settings.CartRegistryPath)
$cart=@($carts|Where-Object{$_.CartID -eq $CartID}|Select-Object -First 1)
if($cart.Count -eq 0){throw "Unknown cart: $CartID"}

$revision=[int]$cart[0].CurrentRevision
$revName=('r{0:D3}' -f $revision)
$revDir=Split-Path -Parent $cart[0].ManifestPath
$manifest=@(Import-Csv -LiteralPath $cart[0].ManifestPath)
$reviewManifestPath=Join-Path $revDir 'REVIEW\review-manifest.csv'
if(-not (Test-Path -LiteralPath $reviewManifestPath)){
    throw "Current revision has no review build. Run Build-RetroCartReview.ps1 -CartID $CartID first."
}
$review=@(Import-Csv -LiteralPath $reviewManifestPath)
$reviewBySlot=@{};foreach($r in $review){$reviewBySlot[$r.SlotID]=$r}

foreach($m in $manifest){
    $r=$reviewBySlot[$m.SlotID]
    if(-not $r){throw "Review manifest is missing slot $($m.SlotID). Rebuild review first."}
    if($r.AssetID -ne $m.AssetID){throw "Review is stale for $($m.SlotID). Rebuild review first."}
    if(-not (Test-Path -LiteralPath $r.ProxyPath)){throw "Missing normalized proxy: $($r.ProxyPath)"}
}

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

$total=[long]0
foreach($m in $manifest){
    $r=$reviewBySlot[$m.SlotID]
    $total += (Get-Item -LiteralPath $r.ProxyPath).Length
}
Write-Host ""
Write-Host "Current normalized cart size: $total bytes"
Write-Host "Allowed target size:          $limit bytes"
if($total -gt $limit){
    $gb=[math]::Round($total/1GB,2)
    $limGb=[math]::Round($limit/1GB,2)
    throw "Cart is too large ($gb GiB > $limGb GiB). Stop here; do not lower quality blindly. We need a size-budget pass."
}

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

if(-not [string]::IsNullOrWhiteSpace($TargetDrive)){
    $root=[IO.Path]::GetPathRoot($TargetDrive)
    if([string]::IsNullOrWhiteSpace($root)){ $root=$TargetDrive }

    $copyFiles = @(Get-ChildItem -LiteralPath $finalDir -File -Filter '*.mp4' | Sort-Object Name)
    $copyTotal = [long](($copyFiles | Measure-Object -Property Length -Sum).Sum)
    $copiedBefore = [long]0

    Write-Host ""
    Write-Host "Copying cartridge files to $root ..."
    Write-Host "Files: $($copyFiles.Count)"
    Write-Host ("Data:  {0:N2} GiB" -f ($copyTotal/1GB))

    for($i=0; $i -lt $copyFiles.Count; $i++){
        $f = $copyFiles[$i]
        $dest = Join-Path $root $f.Name

        Copy-FileWithOverallProgress `
            -Source $f.FullName `
            -Destination $dest `
            -OverallBytesBefore $copiedBefore `
            -OverallBytesTotal $copyTotal `
            -FileIndex ($i+1) `
            -FileCount $copyFiles.Count

        $copiedBefore += [long]$f.Length
    }

    Write-Progress -Id 2 -ParentId 1 -Activity "File copy" -Completed
    Write-Progress -Id 1 -Activity "Copying $CartID to cartridge" -Completed
    Write-Host "Copy complete."
}

# Mark current assignments ACTIVE and the cart BUILT.
$assignmentPath=$settings.AssignmentPath
$assignments=@()
if(Test-Path -LiteralPath $assignmentPath){$assignments=@(Import-Csv -LiteralPath $assignmentPath)}
foreach($a in $assignments){
    if($a.CartID -eq $CartID -and [int]$a.Revision -eq $revision -and $a.AssignmentStatus -eq 'RESERVED'){
        $a.AssignmentStatus='ACTIVE'
    }
}
Export-Utf8Csv $assignments $assignmentPath

$now=[DateTime]::UtcNow.ToString('o')
foreach($c in $carts){
    if($c.CartID -eq $CartID){
        $c.Status='BUILT'
        $c.UpdatedUtc=$now
    }
}
Export-Utf8Csv $carts $settings.CartRegistryPath

Write-Host ""
Write-Host "FINAL CART BUILT:"
Write-Host "  $finalDir"
Write-Host "Files: $($manifest.Count)"
Write-Host "Size:  $total bytes"
if($TargetDrive){Write-Host "Copied MP4s to: $TargetDrive"}
