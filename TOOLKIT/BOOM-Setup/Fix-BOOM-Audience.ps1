[CmdletBinding()]
param([ValidateSet('BOOM1','BOOM2')][string]$CartID='BOOM1',[string]$SystemRoot='F:\[VIDEOS]\retro-tv-cart-builder',[string]$FFprobe='',[switch]$Apply)
$ErrorActionPreference='Stop'
function ReadCsv([string]$p){if(-not(Test-Path -LiteralPath $p)){throw "Required file missing: $p"};return @(Import-Csv -LiteralPath $p)}
function Canon([string]$p){return $p.Replace('\','/').ToLowerInvariant()}
function ID([string]$seed){$h=[Security.Cryptography.SHA256]::Create();try{return 'ASG-'+([BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($seed.ToLowerInvariant()))).Replace('-','').ToLowerInvariant().Substring(0,12))}finally{$h.Dispose()}}
$s=Get-Content -LiteralPath (Join-Path $SystemRoot 'STATE/settings.json') -Raw|ConvertFrom-Json
$carts=@(ReadCsv $s.CartRegistryPath);$matchesCart=@($carts|Where-Object CartID -eq $CartID)
if($matchesCart.Count -ne 1){throw "Expected one existing $CartID cart."}
$c=$matchesCart[0];$rev=[int]$c.CurrentRevision;$manifestPath=[string]$c.ManifestPath;$revDir=Split-Path -Parent $manifestPath
if($c.Status -ne 'DRAFT' -or (Test-Path -LiteralPath (Join-Path $revDir 'FINAL'))){throw 'Only an unbuilt DRAFT cart can be corrected in place. No files changed.'}
$configPath=Join-Path $s.ConfigDir "$CartID.json"
$draftPath=Join-Path $SystemRoot ('STATE/studio-drafts/'+$CartID+('-r{0:D3}.json' -f $rev))
$targets=@($manifestPath,$configPath,[string]$s.AssignmentPath,[string]$s.CartRegistryPath,$draftPath)
$hashes=@{};foreach($p in $targets){$hashes[$p]=if(Test-Path -LiteralPath $p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}else{'MISSING'}}
# Also detect a concurrent library edit during preflight.
$hashes[[string]$s.RegistryPath]=(Get-FileHash -LiteralPath $s.RegistryPath -Algorithm SHA256).Hash
$manifest=@(ReadCsv $manifestPath);$assignments=@(ReadCsv $s.AssignmentPath);$registry=@(ReadCsv $s.RegistryPath)
$config=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json
if($config.PSObject.Properties.Name -contains 'AudienceCorrection'){throw 'Audience correction is already recorded. Stopping to avoid replacing the ads twice.'}
$draft=$null
if(Test-Path -LiteralPath $draftPath){
 $draft=Get-Content -LiteralPath $draftPath -Raw|ConvertFrom-Json
 if($draft.version -ne 1 -or $draft.cartId -ne $CartID -or [int]$draft.baseRevision -ne $rev -or -not $draft.slots){throw 'Unexpected Studio draft format. No changes made.'}
 if((Canon ([string]$draft.baseManifestPath)) -ne (Canon $manifestPath)){throw 'Draft points to another manifest. No changes made.'}
}
$adRows=@($manifest|Where-Object Role -eq 'AD');if($adRows.Count -ne 11){throw 'Expected 11 commercial slots. No changes made.'}
$byID=@{};foreach($a in $registry){$byID[$a.AssetID]=$a}
$occupiedIDs=@{};$occupiedPaths=@{};$occupiedTitles=@{}
function TitleKey([string]$t){return ($t.ToLowerInvariant() -replace '[^a-z0-9]','')}
function Occupy($r){
 if($r.AssetID){$occupiedIDs[$r.AssetID]=$true}
 if($r.SourcePath){$occupiedPaths[(Canon $r.SourcePath)]=$true}
 if($r.Title){$occupiedTitles[(TitleKey $r.Title)]=$true}
 if($byID.ContainsKey([string]$r.AssetID)){$a=$byID[$r.AssetID];$occupiedPaths[(Canon $a.SourcePath)]=$true;$occupiedTitles[(TitleKey $a.Title)]=$true}
}
foreach($other in $carts){
 foreach($r in (ReadCsv $other.ManifestPath)){Occupy $r}
 $final=Join-Path (Split-Path -Parent $other.ManifestPath) 'FINAL/cart-final-manifest.csv'
 if($other.Status -eq 'BUILT' -and -not(Test-Path -LiteralPath $final)){throw "Missing FINAL manifest for $($other.CartID); repeat audit incomplete."}
 if(Test-Path -LiteralPath $final){foreach($r in (ReadCsv $final)){Occupy $r}}
}
foreach($a in $assignments){if($a.AssignmentStatus -in @('ACTIVE','RESERVED')){Occupy $a}}
# Audit uncommitted asset choices on every cart, too.
$draftDir=Join-Path $SystemRoot 'STATE/studio-drafts'
foreach($other in $carts){
 $p=Join-Path $draftDir ($other.CartID+('-r{0:D3}.json' -f [int]$other.CurrentRevision))
 if(Test-Path -LiteralPath $p){$d=Get-Content -LiteralPath $p -Raw|ConvertFrom-Json;foreach($prop in $d.slots.PSObject.Properties){$slot=$prop.Value;if($slot.assetId){Occupy ([pscustomobject]@{AssetID=$slot.assetId})}}}
}
if(-not $FFprobe){
 $runtime=Join-Path $SystemRoot 'TOOLKIT/runtime';$pinned=@()
 if(Test-Path -LiteralPath $runtime){$pinned=@(Get-ChildItem -LiteralPath $runtime -Recurse -File -Filter ffprobe.exe|Where-Object FullName -match '8\.1'|Sort-Object FullName)}
 if($pinned.Count){$FFprobe=$pinned[0].FullName}else{$FFprobe=(Get-Command ffprobe -ErrorAction Stop).Source}
}
$preferred=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'general-ads.json') -Raw|ConvertFrom-Json
$chosen=New-Object System.Collections.ArrayList
foreach($id in $preferred){
 $a=$byID[$id]
 if(-not $a -or $a.AssetType -ne 'COMMERCIAL' -or $a.Pool -ne 'GENERAL_00S' -or $a.SourceStatus -ne 'READY'){continue}
 if($occupiedIDs.ContainsKey($a.AssetID) -or $occupiedPaths.ContainsKey((Canon $a.SourcePath)) -or $occupiedTitles.ContainsKey((TitleKey $a.Title))){continue}
 if(-not(Test-Path -LiteralPath $a.SourcePath -PathType Leaf)){continue}
 $oldPref=$ErrorActionPreference
 try{$ErrorActionPreference='Continue';$raw=@(& $FFprobe -v error -show_entries 'format=duration:stream=codec_type' -of json $a.SourcePath 2>$null);$exit=$LASTEXITCODE}finally{$ErrorActionPreference=$oldPref}
 if($exit -ne 0){throw "ffprobe failed for $($a.Title); no changes made."}
 $info=($raw -join "`n")|ConvertFrom-Json;$duration=0.0
 if(-not[double]::TryParse([string]$info.format.duration,[Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$duration) -or $duration -le 1){throw "Invalid duration: $($a.Title)"}
 if(-not @($info.streams|Where-Object codec_type -eq 'video').Count -or -not @($info.streams|Where-Object codec_type -eq 'audio').Count){throw "Missing audio/video: $($a.Title)"}
 [void]$chosen.Add([pscustomobject]@{Asset=$a;Duration=$duration});Occupy $a
 if($chosen.Count -eq 11){break}
}
if($chosen.Count -ne 11){throw "Only $($chosen.Count) suitable unused general-audience ads available; need 11. Nothing changed."}
$remove=@()
foreach($g in 1..4){
 $next=$CartID+('-GROUP-{0:D2}-NEXT' -f $g);$intro=$CartID+('-GROUP-{0:D2}-INTRO' -f $g)
 if(@($manifest|Where-Object SlotID -eq $next).Count -and @($manifest|Where-Object SlotID -eq $intro).Count){$remove+=$next}
}
$changes=New-Object System.Collections.ArrayList
for($i=0;$i -lt 11;$i++){
 $row=$adRows[$i];$a=$chosen[$i].Asset
 [void]$changes.Add([pscustomobject]@{SlotID=$row.SlotID;Old=$row.Title;New=$a.Title;OldAssetID=$row.AssetID;NewAssetID=$a.AssetID})
 Write-Host ("{0}: {1} -> {2}" -f $row.SlotID,$row.Title,$a.Title)
 foreach($name in @('AssetID','AssetType','Title','SourcePath','Network','Pool')){$row.$name=$a.$name}
 $row.AssetSubtype=$a.Subtype;$row.DurationSeconds=$chosen[$i].Duration.ToString([cultureinfo]::InvariantCulture)
 $row.ReviewStatus='UNREVIEWED';$row.AudioRepair='NONE'
 foreach($name in @('TrimStartSeconds','TrimEndSeconds','CropLeft','CropRight','CropTop','CropBottom')){$row.$name=0}
 if($draft){
  $reset=[pscustomobject][ordered]@{slotId=$row.SlotID;baseAssetId=$a.AssetID;assetId=$a.AssetID;action='UNREVIEWED';notes='';trimStartSeconds=0;trimEndSeconds=0;cropLeft=0;cropRight=0;cropTop=0;cropBottom=0;audioRepair='NONE';rejected=@()}
  $draft.slots|Add-Member -NotePropertyName $row.SlotID -NotePropertyValue $reset -Force
 }
}
foreach($slotID in $remove){Write-Host "Remove redundant NEXT: $slotID";if($draft){$draft.slots.PSObject.Properties.Remove($slotID)}}
$kept=@($manifest|Where-Object {$remove -notcontains $_.SlotID})
$config.CommercialPool='GENERAL_00S';$config.CommercialPools=@('GENERAL_00S')
if($config.PSObject.Properties.Name -contains 'AudienceCorrection'){$config.AudienceCorrection='General-audience ads; one show introduction per group'}else{$config|Add-Member -NotePropertyName AudienceCorrection -NotePropertyValue 'General-audience ads; one show introduction per group'}
Write-Host "`n$CartID r$rev : replace 11 ads; remove $($remove.Count) redundant NEXT slots. Preserve other manifest and draft entries."
if(-not $Apply){Write-Host 'PREVIEW ONLY. No files changed. Rerun with -Apply to apply this correction.';return}
foreach($p in $hashes.Keys){$h=if(Test-Path -LiteralPath $p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}else{'MISSING'};if($h -ne $hashes[$p]){throw "File changed during preview: $p. Close Studio and retry."}}
$now=[DateTime]::UtcNow.ToString('o')
foreach($a in $assignments){
 if($a.CartID -eq $CartID -and [int]$a.Revision -eq $rev -and $a.AssignmentStatus -in @('RESERVED','ACTIVE') -and (($remove -contains $a.SlotID) -or @($changes|Where-Object SlotID -eq $a.SlotID).Count)){
  $a.AssignmentStatus='RELEASED';$a.ReleasedUtc=$now;$a.ReleaseReason='General-audience correction before build'
 }
}
$newAssignments=@($assignments)
foreach($change in $changes){$newAssignments += [pscustomobject][ordered]@{AssignmentID=(ID "$CartID|$rev|$($change.SlotID)|$($change.NewAssetID)");CartID=$CartID;Revision=$rev;SlotID=$change.SlotID;AssetID=$change.NewAssetID;AssignmentStatus='RESERVED';AssignedUtc=$now;ReleasedUtc='';ReleaseReason=''}}
$c.UpdatedUtc=$now
if($draft){$draft.updatedUtc=$now}
$backup=Join-Path $SystemRoot ('HOTFIXES/'+$CartID+'-audience-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
[void][IO.Directory]::CreateDirectory($backup);$backups=@{}
for($i=0;$i -lt $targets.Count;$i++){if(Test-Path -LiteralPath $targets[$i]){$bp=Join-Path $backup "$i-original";Copy-Item -LiteralPath $targets[$i] -Destination $bp;$backups[$targets[$i]]=$bp}}
$written=New-Object System.Collections.ArrayList
try{
 [void]$written.Add($manifestPath);$kept|Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding UTF8
 [void]$written.Add($configPath);$config|ConvertTo-Json -Depth 100|Set-Content -LiteralPath $configPath -Encoding UTF8
 [void]$written.Add([string]$s.AssignmentPath);$newAssignments|Export-Csv -LiteralPath $s.AssignmentPath -NoTypeInformation -Encoding UTF8
 [void]$written.Add([string]$s.CartRegistryPath);$carts|Export-Csv -LiteralPath $s.CartRegistryPath -NoTypeInformation -Encoding UTF8
 if($draft){[void]$written.Add($draftPath);$draft|ConvertTo-Json -Depth 100|Set-Content -LiteralPath $draftPath -Encoding UTF8}
 $changes|Export-Csv -LiteralPath (Join-Path $backup 'ad-changes.csv') -NoTypeInformation -Encoding UTF8
 $check=@(ReadCsv $manifestPath)
 if($check.Count -ne $kept.Count -or @($check|Where-Object Role -eq 'AD').Count -ne 11){throw 'Written manifest failed validation.'}
}catch{
 $failure=$_;foreach($p in $written){if($backups.ContainsKey($p)){Copy-Item -LiteralPath $backups[$p] -Destination $p -Force}}
 throw "Correction failed; originals restored from $backup. $failure"
}
Write-Host "CORRECTED $CartID in its current revision. Backup: $backup" -ForegroundColor Green
Write-Host 'Restart Studio. Unchanged shows and branding keep their edits; replacement commercials need review.'
