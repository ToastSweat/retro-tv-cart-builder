# Existing Studio cart preparation. No application changes.
[CmdletBinding()]
param(
 [ValidateSet('BOOM1','BOOM2')][string]$CartID='BOOM1',
 [string]$SystemRoot='F:\[VIDEOS]\retro-tv-cart-builder',
 [string]$TVRoot='F:\[VIDEOS]\TV',
 [string]$BrandingRoot='F:\[VIDEOS]\Commercials\Boomerang_Sorted',
 [string]$FFmpeg='',[string]$FFprobe='',[switch]$CheckOnly
)
$ErrorActionPreference='Stop'
function ReadCsv([string]$p){if(Test-Path -LiteralPath $p){return @(Import-Csv -LiteralPath $p)};return @()}
function WriteCsv($rows,[string]$p){$a=@($rows);if(-not $a.Count){throw "Refusing empty state: $p"};$a|Export-Csv -LiteralPath $p -Encoding UTF8 -NoTypeInformation}
function Json($v,[string]$p){$v|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $p -Encoding UTF8}
function Canon([string]$p){return $p.Replace('\','/').ToLowerInvariant()}
function Stable([string]$prefix,[string]$seed){$sha=[Security.Cryptography.SHA256]::Create();try{$s=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($seed.ToLowerInvariant()))).Replace('-','').ToLowerInvariant();return "$prefix-$($s.Substring(0,12))"}finally{$sha.Dispose()}}
$settingsPath=Join-Path $SystemRoot 'STATE/settings.json'
$s=Get-Content -LiteralPath $settingsPath -Raw|ConvertFrom-Json
$regPath=[string]$s.RegistryPath;$asgPath=[string]$s.AssignmentPath;$cartPath=[string]$s.CartRegistryPath
$hbPath=Join-Path $SystemRoot 'STATE/handpicked-branding.csv';$hePath=Join-Path $SystemRoot 'STATE/handpicked-episodes.csv'
$configPath=Join-Path $s.ConfigDir "$CartID.json"
$recipePath=Join-Path $s.ConfigDir "composites/$CartID-composites.json"
$cartDir=Join-Path $s.BuildRoot $CartID;$revDir=Join-Path $cartDir 'r001';$manifestPath=Join-Path $revDir 'cart-manifest.csv'
$registry=@(ReadCsv $regPath);$assignments=@(ReadCsv $asgPath);$carts=@(ReadCsv $cartPath)
if(-not $registry.Count){throw 'Asset registry is empty or missing.'}
if(@($carts|Where-Object CartID -eq $CartID).Count -or (Test-Path -LiteralPath $cartDir)){throw "$CartID already exists. Stopping without creating another revision."}
if(Test-Path -LiteralPath $configPath){throw "Existing config: $configPath. Do not overwrite it."}
$tracked=@($settingsPath,$regPath,$asgPath,$cartPath,$hbPath,$hePath,$configPath,$recipePath)
$hashes=@{};foreach($p in $tracked){$hashes[$p]=if(Test-Path -LiteralPath $p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}else{'MISSING'}}
# Prefer the bundled 8.1 runtime; direct explicit paths can override discovery.
if(-not $FFmpeg){
 $runtime=Join-Path $SystemRoot 'TOOLKIT/runtime'
 $pinned=@();if(Test-Path -LiteralPath $runtime){$pinned=@(Get-ChildItem -LiteralPath $runtime -Recurse -File -Filter ffmpeg.exe|Where-Object FullName -match '8\.1'|Sort-Object FullName)}
 if($pinned.Count){$FFmpeg=$pinned[0].FullName}else{$FFmpeg=(Get-Command ffmpeg -ErrorAction Stop).Source}
}
if(-not $FFprobe){$paired=Join-Path ([IO.Path]::GetDirectoryName($FFmpeg)) 'ffprobe.exe';if(Test-Path -LiteralPath $paired){$FFprobe=$paired}else{$FFprobe=(Get-Command ffprobe -ErrorAction Stop).Source}}
Write-Host "FFmpeg: $FFmpeg";Write-Host "FFprobe: $FFprobe"
$backendInfo=@(& $FFmpeg -version 2>$null)
if(($backendInfo -join " ") -match 'ffmpeg version (?:n)?9\.'){throw 'FFmpeg 9 was selected. Use the bundled 8.1 runtime via -FFmpeg and -FFprobe; preparation stopped before any changes.'}
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'boom-plan.json') -Raw|ConvertFrom-Json
$approved=@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'approved-branding.json') -Raw|ConvertFrom-Json)
if(@($approved|Where-Object Decision -ne 'GOOD').Count){throw 'Branding approval file contains unapproved clips.'}
$byID=@{};foreach($r in $registry){if($byID.ContainsKey($r.AssetID)){throw "Duplicate AssetID: $($r.AssetID)"};$byID[$r.AssetID]=$r}
$recipes=@{};$recipeDir=Join-Path $s.ConfigDir 'composites'
foreach($f in @(Get-ChildItem -LiteralPath $recipeDir -File -Filter '*.json')){foreach($job in (Get-Content -LiteralPath $f.FullName -Raw|ConvertFrom-Json).Jobs){$recipes[(Canon $job.Output)]=@($job.Parts)}}
function Keys([string]$path,$seen){if(-not $path){return};$k=Canon $path;if($seen.ContainsKey($k)){return};$seen[$k]=$true;$k;if($recipes.ContainsKey($k)){foreach($part in $recipes[$k]){Keys $part $seen}}}
function TitleKey([string]$path){
 if(-not $path){return ''};$n=($path.Replace('\','/') -split '/')[-1];$n=[IO.Path]::GetFileNameWithoutExtension($n)
 if($path -match 'Looney Tunes Golden Collection'){$n=$n -replace '^\d+DVD\s*','' -replace '\s+(LT|MM)$','';return 'looney|'+($n.ToLowerInvariant() -replace '[^a-z0-9]','')}
 if($path -match '(?i)The Flintstones|The Jetsons') {if($n -match '(?i)S(\d+)E(\d+)'){$season=[int]$matches[1];$episode=[int]$matches[2];$series=if($path -like '*Flintstones*'){'flintstones'}else{'jetsons'};return "$series|$season|$episode"}}
 # Normalized filename catches alternate containers with the same title.
 return 'file|'+($n.ToLowerInvariant() -replace '[^a-z0-9]','')
}
$occupiedID=@{};$occupiedPath=@{};$occupiedTitle=@{}
function Occupy($r,[string]$owner){
 if($r.AssetID){$occupiedID[$r.AssetID]=$owner}
 $paths=@([string]$r.SourcePath);if($byID.ContainsKey([string]$r.AssetID)){$paths += [string]$byID[$r.AssetID].SourcePath}
 foreach($p in $paths){foreach($k in @(Keys $p @{})){$occupiedPath[$k]=$owner;$tk=TitleKey $k;if($tk){$occupiedTitle[$tk]=$owner}}}
}
foreach($c in $carts){
 if(-not(Test-Path -LiteralPath $c.ManifestPath)){throw "Repeat audit requires current manifest for $($c.CartID): $($c.ManifestPath)"}
 foreach($r in (ReadCsv $c.ManifestPath)){Occupy $r "$($c.CartID) current"}
 $final=Join-Path (Split-Path -Parent $c.ManifestPath) 'FINAL/cart-final-manifest.csv'
 if($c.Status -eq 'BUILT' -and -not(Test-Path -LiteralPath $final)){throw "Repeat audit requires FINAL manifest for $($c.CartID)"}
 if(Test-Path -LiteralPath $final){foreach($r in (ReadCsv $final)){Occupy $r "$($c.CartID) FINAL"}}
}
foreach($a in $assignments){if($a.AssignmentStatus -in @('RESERVED','ACTIVE')){Occupy $a "$($a.CartID) $($a.AssignmentStatus)"}}
$used=@{};$usedTitles=@{};$chosenIDs=@{}
function Free($asset){
 if($occupiedID.ContainsKey($asset.AssetID)){throw "Already used by $($occupiedID[$asset.AssetID]): $($asset.Title)"}
 if($chosenIDs.ContainsKey($asset.AssetID)){throw "Repeated selection: $($asset.Title)"}
 foreach($k in @(Keys $asset.SourcePath @{})){
  if($occupiedPath.ContainsKey($k)){throw "Source used by $($occupiedPath[$k]): $($asset.Title)"}
  if($used.ContainsKey($k)){throw "Repeated source in this cart: $($asset.Title)"}
  $tk=TitleKey $k
  if($occupiedTitle.ContainsKey($tk)){throw "Matching title used by $($occupiedTitle[$tk]): $($asset.Title)"}
  if($usedTitles.ContainsKey($tk)){throw "Matching title repeated in this cart: $($asset.Title)"}
 }
}
$durationCache=@{}
function Probe([string]$path){
 if($durationCache.ContainsKey($path)){return $durationCache[$path]}
 if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "Media missing: $path"}
 $old=$ErrorActionPreference;try{$ErrorActionPreference='Continue';$raw=@(& $FFprobe -v error -show_entries 'format=duration:stream=codec_type' -of json $path 2>$null);$code=$LASTEXITCODE}finally{$ErrorActionPreference=$old}
 if($code -ne 0){throw "ffprobe failed ($code): $path"};$v=($raw -join "`n")|ConvertFrom-Json
 $d=0.0;if(-not[double]::TryParse([string]$v.format.duration,[Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$d) -or $d -le 1){throw "Invalid duration: $path"}
 if(-not @($v.streams|Where-Object codec_type -eq 'video').Count -or -not @($v.streams|Where-Object codec_type -eq 'audio').Count){throw "Missing video or audio: $path"}
 $durationCache[$path]=[math]::Round($d,3);return $durationCache[$path]
}
$newRegistry=New-Object System.Collections.ArrayList
$handBrand=New-Object System.Collections.ArrayList;foreach($r in (ReadCsv $hbPath)){[void]$handBrand.Add($r)}
$handEpisodes=New-Object System.Collections.ArrayList;foreach($r in (ReadCsv $hePath)){[void]$handEpisodes.Add($r)}
function Asset([string]$type,[string]$sub,[string]$title,[string]$path){
 $same=@($registry|Where-Object { (Canon $_.SourcePath) -eq (Canon $path) })
 if($same.Count -gt 1){throw "Multiple registry records for source: $path"}
 $prefix=if($type -eq 'BRANDING'){'HBR'}else{'EP'};$id=Stable $prefix $path
 if($same.Count){$id=$same[0].AssetID;if($same[0].SourceStatus -in @('BAD','BAD_AUDIO','BAD_QUALITY','NEEDS_CROP','NEEDS_CLIPPED','DUPLICATE','EXCLUDED')){throw "Source flagged $($same[0].SourceStatus): $title"}}
 $vals=[ordered]@{};foreach($col in $registry[0].PSObject.Properties.Name){$vals[$col]=''}
 foreach($pair in @{AssetID=$id;AssetType=$type;Subtype=$sub;Title=$title;Network='BOOM';SourcePath=$path;CuratedStatus='KEEP';SourceStatus='READY';ReusePolicy='UNIQUE';SourceCollection='Handpicked';Notes='BOOM preparation; approved branding where applicable'}.GetEnumerator()){$vals[$pair.Key]=$pair.Value}
 return [pscustomobject]$vals
}
$brand=@{};foreach($r in @($approved|Where-Object Cart -eq $CartID)){
 $suffix=$r.SourcePath -split 'Boomerang_Sorted\\',2;if($suffix.Count -ne 2){throw 'Invalid branding source mapping.'}
 $path=Join-Path $BrandingRoot $suffix[1]
 $sub=switch -Regex ($r.ProposedRole){'^OUT:'{'BUMPER_OUT';break};'^IN:'{'BUMPER_IN';break};'^NEXT:'{'NEXT';break};'^NOW SHOWING:'{'INTRO';break};default{'IDENT'}}
 $a=Asset 'BRANDING' $sub $r.Title $path;$brand[$r.ID]=$a
}
$jobs=New-Object System.Collections.ArrayList;$episodes=New-Object System.Collections.ArrayList;$index=0
$looneyFiles=@()
foreach($b in @($plan.Blocks|Where-Object Cart -eq $CartID)){
 $index++;$parts=@()
 foreach($p in @($b.Parts)){$suffix=([string]$p) -split '\\TV\\',2;if($suffix.Count -ne 2){throw "Invalid episode path: $p"};$parts+=Join-Path $TVRoot $suffix[1]}
 foreach($pattern in @($b.Patterns)){
  if(-not $looneyFiles.Count){$looneyFiles=@(Get-ChildItem -LiteralPath (Join-Path $TVRoot 'Looney Tunes Golden Collection') -Recurse -File|Where-Object Extension -match '^\.(avi|mp4|mkv)$')}
  $found=@($looneyFiles|Where-Object BaseName -match $pattern)
  if($found.Count -ne 1){throw "Expected one Looney Tunes file matching '$pattern'; found $($found.Count). No cart created."};$parts+=$found[0].FullName
 }
 $source=$parts[0]
 if($parts.Count -gt 1){$source=Join-Path $TVRoot ('_RetroTV_Composites/'+$CartID+('/{0}-block-{1:D2}.mkv' -f ($b.Series -replace '[^A-Za-z0-9]',''),$index));$recipes[(Canon $source)]=$parts;[void]$jobs.Add([pscustomobject]@{Name=$b.Title;Mode='Normalize';Parts=$parts;Output=$source})}
 $a=Asset 'EPISODE' $b.Series $b.Title $source
 # Audit all component shorts even if a composite does not exist yet.
 Free $a;foreach($p in $parts){[void](Probe $p)}
 [void]$episodes.Add([pscustomobject]@{Asset=$a;Series=$b.Series;Parts=$parts})
}
$manifest=New-Object System.Collections.ArrayList;$pos=0
function Slot([string]$id,[string]$role,$a,[string]$series=''){
 Free $a;$chosenIDs[$a.AssetID]=$true
 foreach($k in @(Keys $a.SourcePath @{})){$used[$k]=$true;$usedTitles[(TitleKey $k)]=$true}
 $script:pos+=10
 $d=if($recipes.ContainsKey((Canon $a.SourcePath))){($recipes[(Canon $a.SourcePath)]|ForEach-Object{Probe $_}|Measure-Object -Sum).Sum}else{Probe $a.SourcePath}
 [void]$manifest.Add([pscustomobject][ordered]@{Position=('{0:D4}' -f $script:pos);SlotID=$id;Role=$role;AssetID=$a.AssetID;AssetType=$a.AssetType;AssetSubtype=$a.Subtype;Title=$a.Title;Series=$series;Pool=$a.Pool;Network=$a.Network;SourcePath=$a.SourcePath;DurationSeconds=$d.ToString([cultureinfo]::InvariantCulture);ReusePolicy='UNIQUE';ReviewStatus=$(if($a.AssetType -eq 'BRANDING'){'GOOD'}else{'UNREVIEWED'});TrimStartSeconds=0;TrimEndSeconds=0;CropLeft=0;CropRight=0;CropTop=0;CropBottom=0;AudioRepair='NONE'})
}
function B([int]$num,[string]$slot,[string]$role){$id='BOOM-BR-{0:D2}' -f $num;if(-not $brand.ContainsKey($id)){throw "Missing approved branding $id"};Slot $slot $role $brand[$id]}
$adIndex=0
function Ad([int]$n){
 foreach($id in $plan.Ads){$a=$byID[$id];if(-not $a -or $a.AssetType -ne 'COMMERCIAL' -or $a.SourceStatus -ne 'READY' -or $a.Pool -notin @('GENERAL_00S','KIDS_00S')){continue}
  try{Free $a}catch{continue};if(-not(Test-Path -LiteralPath $a.SourcePath)){continue}
  Slot ($CartID+('-BREAK-{0:D2}-AD-01' -f $n)) 'AD' $a;return
 };throw 'No unused READY commercial remains in the curated list. No cart created.'
}
if($CartID -eq 'BOOM1'){$opening=1;$ending=27;$next=@(5,6,7,8);$now=@(17,18,0,0);$outs=@(19,20,21,22);$ins=@(23,24,26,25);$idents=@(4,3,2)}
else{$opening=9;$ending=37;$next=@(15,14,16,13);$now=@(0,0,28,0);$outs=@(30,31,29,32);$ins=@(34,35,33,36);$idents=@(10,11,12)}
B $opening "$CartID-ANCHOR-01" 'ANCHOR_BRANDING'
$break=0
for($g=0;$g -lt 4;$g++){
 B $next[$g] ($CartID+('-GROUP-{0:D2}-NEXT' -f ($g+1))) 'NEXT'
 if($now[$g]){B $now[$g] ($CartID+('-GROUP-{0:D2}-INTRO' -f ($g+1))) 'INTRO'}
 for($e=0;$e -lt 3;$e++){
  $n=$g*3+$e+1;$ep=$episodes[$n-1];Slot ($CartID+('-SHOW-{0:D2}' -f $n)) 'SHOW' $ep.Asset $ep.Series
  if($n -eq 12){continue};$break++
  if($e -eq 0){B $outs[$g] ($CartID+('-BREAK-{0:D2}-OUT' -f $break)) 'BUMPER_OUT'}
  Ad $break
  if($e -eq 0){B $ins[$g] ($CartID+('-BREAK-{0:D2}-IN' -f $break)) 'BUMPER_IN'}
  if($e -eq 1 -and $g -lt 3){B $idents[$g] ($CartID+('-BREAK-{0:D2}-ID' -f $break)) 'IDENT'}
 }
}
B $ending "$CartID-CLOSING-ID" 'CLOSING_BRANDING'
$expected=if($CartID -eq 'BOOM1'){42}else{41}
if($manifest.Count -ne $expected -or @($manifest|Where-Object Role -eq 'SHOW').Count -ne 12 -or $break -ne 11){throw 'Lineup counts failed.'}
Write-Host "`n$CartID preflight: $($manifest.Count) clips, 12 show blocks, 11 unique commercials, $($brand.Count) approved branding clips." -ForegroundColor Green
foreach($m in $manifest){Write-Host "$($m.SlotID): $($m.Title)"}
if($CheckOnly){Write-Host 'CHECK ONLY: no files changed or assets reserved. Composite durations are source sums, not encoded output validation.';return}
# Both initial audit and final state check run before publishing any registry changes.
foreach($p in $hashes.Keys){$h=if(Test-Path -LiteralPath $p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}else{'MISSING'};if($h -ne $hashes[$p]){throw "State changed during preflight: $p. Close Studio and retry."}}
$backup=Join-Path $SystemRoot ('HOTFIXES/'+$CartID+'-setup-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'));[void][IO.Directory]::CreateDirectory($backup)
$targets=@($regPath,$asgPath,$cartPath,$hbPath,$hePath,$configPath,$recipePath);$backups=@{}
for($i=0;$i -lt $targets.Count;$i++){if(Test-Path -LiteralPath $targets[$i]){$bp=Join-Path $backup "$i.csv-or-json";Copy-Item -LiteralPath $targets[$i] -Destination $bp;$backups[$targets[$i]]=$bp}}
$written=New-Object System.Collections.ArrayList
$createdRevision=$false
try{
 if($jobs.Count){
  [void][IO.Directory]::CreateDirectory($recipeDir);[void]$written.Add($recipePath);Json ([pscustomobject]@{Name="$CartID cartoon blocks";Jobs=@($jobs.ToArray())}) $recipePath
  & (Join-Path $SystemRoot 'TOOLKIT/Build-RetroCartComposite.ps1') -RecipePath $recipePath -FFmpeg $FFmpeg -FFprobe $FFprobe
  if(-not $?){throw 'Composite builder failed.'}
  foreach($job in $jobs){
   [void]$durationCache.Remove($job.Output);$actual=Probe $job.Output
   $expectedDuration=($job.Parts|ForEach-Object{Probe $_}|Measure-Object -Sum).Sum
   if($actual -lt $expectedDuration*0.97 -or $actual -gt $expectedDuration*1.03){throw "Composite duration mismatch: $($job.Output); expected about $expectedDuration seconds, got $actual. No cart published."}
  }
 }
 # Recheck source state after potentially lengthy composite encoding.
 foreach($p in $hashes.Keys){if($p -eq $recipePath){continue};$h=if(Test-Path -LiteralPath $p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}else{'MISSING'};if($h -ne $hashes[$p]){throw "State changed during encoding: $p. Close Studio and retry."}}
 foreach($m in $manifest){$m.DurationSeconds=(Probe $m.SourcePath).ToString([cultureinfo]::InvariantCulture)}
 foreach($a in @($brand.Values)+@($episodes|ForEach-Object{$_.Asset})){
  $a.DurationSeconds=(Probe $a.SourcePath).ToString([cultureinfo]::InvariantCulture)
  [void]$newRegistry.Add($a)
  if($a.AssetType -eq 'BRANDING'){
   for($i=$handBrand.Count-1;$i -ge 0;$i--){if((Canon $handBrand[$i].SourcePath) -eq (Canon $a.SourcePath)){$handBrand.RemoveAt($i)}}
   [void]$handBrand.Add([pscustomobject][ordered]@{AssetID=$a.AssetID;Network='BOOM';Type=$a.Subtype;Title=$a.Title;SourcePath=$a.SourcePath;DurationSeconds=$a.DurationSeconds;Status='KEEP';Notes='Human approved in BOOM branding review';Year=''})
  }else{
   for($i=$handEpisodes.Count-1;$i -ge 0;$i--){if((Canon $handEpisodes[$i].SourcePath) -eq (Canon $a.SourcePath)){$handEpisodes.RemoveAt($i)}}
   [void]$handEpisodes.Add([pscustomobject][ordered]@{AssetID=$a.AssetID;Network='BOOM';Series=$a.Subtype;Title=$a.Title;SourcePath=$a.SourcePath;DurationSeconds=$a.DurationSeconds;Status='KEEP';BrandingKeywords=$a.Subtype;Notes='BOOM curated episode block';Year=''})
  }
 }
 $replace=@{};foreach($a in $newRegistry){$replace[$a.AssetID]=$true};$merged=@($registry|Where-Object {-not $replace.ContainsKey($_.AssetID)})+@($newRegistry.ToArray())
 $nowUtc=[DateTime]::UtcNow.ToString('o');$newAsg=@($assignments)
 foreach($m in $manifest){$newAsg += [pscustomobject][ordered]@{AssignmentID=(Stable 'ASG' "$CartID|1|$($m.SlotID)|$($m.AssetID)");CartID=$CartID;Revision=1;SlotID=$m.SlotID;AssetID=$m.AssetID;AssignmentStatus='RESERVED';AssignedUtc=$nowUtc;ReleasedUtc='';ReleaseReason=''}}
 $display=if($CartID -eq 'BOOM1'){'Boomerang - Stone Age, Space Age and El Kabong'}else{'Boomerang - Cats, Dogs and Cartoon Chaos'}
 $cfg=[pscustomobject][ordered]@{CartID=$CartID;DisplayName=$display;Network='BOOM';CommercialPool='KIDS_00S';CommercialPools=@('GENERAL_00S','KIDS_00S');AdsPerBreak=1;UseMatchedNext=$false;BreakStyle='LEAN';AnchorMinSeconds=20;StingMaxSeconds=12;InsertStingAfterShowNumbers=@();Episodes=@($episodes|ForEach-Object -Begin {$order=0} -Process {$order++;[pscustomobject]@{Order=$order;Series=$_.Series;BrandingKeywords=@($_.Series);Title=$_.Asset.Title;SourcePath=$_.Asset.SourcePath}});ClosingBrandingAssetID=$brand[('BOOM-BR-{0:D2}' -f $ending)].AssetID;Preparation='Fixed grouped lineup. Use Studio for revisions; do not regenerate randomly.'}
 $newCarts=@($carts)+@([pscustomobject][ordered]@{CartID=$CartID;CurrentRevision=1;Status='DRAFT';Network='BOOM';DisplayName=$display;CreatedUtc=$nowUtc;UpdatedUtc=$nowUtc;ManifestPath=$manifestPath})
 if(Test-Path -LiteralPath $cartDir){throw 'Cart directory appeared during encoding. Stopping.'}
 [void][IO.Directory]::CreateDirectory($revDir);$createdRevision=$true;WriteCsv $manifest $manifestPath
 foreach($pair in @(@($configPath,$cfg),@($regPath,$merged),@($asgPath,$newAsg),@($cartPath,$newCarts),@($hbPath,$handBrand.ToArray()),@($hePath,$handEpisodes.ToArray()))){$p=$pair[0];[void]$written.Add($p);if($p -eq $configPath){Json $pair[1] $p}else{WriteCsv $pair[1] $p}}
 if(@(ReadCsv $manifestPath).Count -ne $expected -or @(ReadCsv $cartPath|Where-Object CartID -eq $CartID).Count -ne 1){throw 'Post-write validation failed.'}
 Json @($approved|Where-Object Cart -eq $CartID) (Join-Path $revDir 'branding-approvals.json')
}catch{
 $failure=$_
 foreach($p in $written){if($backups.ContainsKey($p)){Copy-Item -LiteralPath $backups[$p] -Destination $p -Force}elseif(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p -Force}}
 if($createdRevision -and (Test-Path -LiteralPath $revDir)){Remove-Item -LiteralPath $revDir -Recurse -Force}
 if($createdRevision -and (Test-Path -LiteralPath $cartDir) -and -not @(Get-ChildItem -LiteralPath $cartDir -Force).Count){Remove-Item -LiteralPath $cartDir -Force}
 throw "$CartID preparation failed; state rollback attempted. Backup: $backup. $failure"
}
Write-Host "CREATED $CartID r001. Show blocks and commercials remain UNREVIEWED; branding is GOOD. Backup: $backup" -ForegroundColor Green
