[CmdletBinding()]
param([string]$SystemRoot='F:\[VIDEOS]\retro-tv-cart-builder')
$ErrorActionPreference='Stop'
$s=Get-Content -LiteralPath (Join-Path $SystemRoot 'STATE\settings.json') -Raw | ConvertFrom-Json
$carts=@(Import-Csv -LiteralPath $s.CartRegistryPath)
if(@($carts | Where-Object {$_.CartID -eq 'CN05'}).Count){throw 'CN05 already exists. Stopping without creating another revision.'}
$cfgPath=Join-Path $s.ConfigDir 'CN05.json'
$recipePath=Join-Path $s.ConfigDir 'composites\CN05-composites.json'
$cfg=Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
$recipe=Get-Content -LiteralPath $recipePath -Raw | ConvertFrom-Json
$registry=@(Import-Csv -LiteralPath $s.RegistryPath)
$assignments=@(Import-Csv -LiteralPath $s.AssignmentPath)
$sourcePaths=@($cfg.Episodes | Where-Object {$_.Series -ne 'Looney Tunes'} | Select-Object -ExpandProperty SourcePath)
foreach($job in $recipe.Jobs){$sourcePaths+=@($job.Parts)}
foreach($p in $sourcePaths){if(-not(Test-Path -LiteralPath $p -PathType Leaf)){throw "Missing source: $p"}}
# Inspect current manifests, not abandoned revisions. Do not release anything.
$occupied=@{}
foreach($cart in $carts){
 if(Test-Path -LiteralPath $cart.ManifestPath){
  foreach($m in (Import-Csv -LiteralPath $cart.ManifestPath)){
   if($m.Role -eq 'SHOW'){$occupied[$m.SourcePath]=$cart.CartID}
  }
 }
}
# Expand known recipes so a new composite path cannot hide reused source shorts.
foreach($rp in (Get-ChildItem -LiteralPath (Join-Path $s.ConfigDir 'composites') -File -Filter '*.json')){
 $r=Get-Content -LiteralPath $rp.FullName -Raw | ConvertFrom-Json
 foreach($job in $r.Jobs){
  if($occupied.ContainsKey([string]$job.Output)){
   foreach($p in $job.Parts){$occupied[[string]$p]=$occupied[[string]$job.Output]}
  }
 }
}
foreach($p in $sourcePaths){if($occupied.ContainsKey($p)){throw "Source already belongs to current cart $($occupied[$p]): $p. No reservations were changed."}}
function Seconds([string]$p){
 $raw=& ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $p
 if($LASTEXITCODE -ne 0){throw "ffprobe failed: $p"}
 return [double]::Parse(($raw -join '').Trim(),[cultureinfo]::InvariantCulture)
}
foreach($p in $sourcePaths){
 $d=Seconds $p
 if($d -le 1){throw "Invalid source duration: $p"}
}
$signoffs=@($registry | Where-Object {$_.AssetType -eq 'BRANDING' -and $_.Network -eq 'CN' -and $_.Subtype -eq 'SIGN_OFF' -and $_.SourceStatus -eq 'READY'} | Sort-Object Title)
if(-not $signoffs.Count){throw 'No live READY CN sign-off. No plan created.'}
for($i=0;$i -lt $signoffs.Count;$i++){Write-Host "[$($i+1)] $($signoffs[$i].Title)"}
$choice=0;$answer=Read-Host 'Choose CN05 sign-off number'
if(-not [int]::TryParse($answer,[ref]$choice) -or $choice -lt 1 -or $choice -gt $signoffs.Count){throw 'Invalid selection.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backup=Join-Path $SystemRoot "HOTFIXES\CN05-setup-$stamp"
[void][IO.Directory]::CreateDirectory($backup)
foreach($p in @($s.CartRegistryPath,$s.RegistryPath,$s.AssignmentPath,$cfgPath)){Copy-Item -LiteralPath $p -Destination $backup}
$cfg | Add-Member -NotePropertyName SignOffAssetID -NotePropertyValue $signoffs[$choice-1].AssetID -Force
$cfg | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $cfgPath -Encoding UTF8
# Small backwards-compatible pool extension. Other configs retain single-pool behavior.
$planner=Join-Path $SystemRoot 'TOOLKIT\New-RetroCartPlan.ps1'
$server=Join-Path $SystemRoot 'TOOLKIT\studio\server.js'
$originalPlanner=Get-Content -LiteralPath $planner -Raw
$originalServer=Get-Content -LiteralPath $server -Raw
$plannerText=$originalPlanner
$serverText=$originalServer
$old='$_.AssetType -eq ''COMMERCIAL'' -and $_.Pool -eq $cfg.CommercialPool -and $_.SourceStatus -eq ''READY'''
$new=@'
$_.AssetType -eq 'COMMERCIAL' -and $_.SourceStatus -eq 'READY' -and
        ($(if($cfg.CommercialPools){@($cfg.CommercialPools) -contains $_.Pool}else{$_.Pool -eq $cfg.CommercialPool})) -and
        ($(if($cfg.AdYearMin){[int]$_.Year -ge [int]$cfg.AdYearMin}else{$true})) -and
        ($(if($cfg.AdYearMax){[int]$_.Year -le [int]$cfg.AdYearMax}else{$true}))
'@
if($plannerText.Contains($old)){$plannerText=$plannerText.Replace($old,$new)}
elseif(-not $plannerText.Contains('if($cfg.CommercialPools)')){throw 'Planner version differs; stopping before patching code.'}
# Add CN05 to the existing expanded Studio pools, preserving Direct FINAL patch.
if($serverText.Contains('/^CN0[34]-/')){
 $serverText=$serverText.Replace('/^CN0[34]-/','/^CN0[345]-/')
}elseif(-not $serverText.Contains('/^CN0[345]-/')){
 throw 'Expected expanded commercial-pool Studio patch not found. Code unchanged; share this error.'
}
Copy-Item -LiteralPath $planner -Destination $backup
Copy-Item -LiteralPath $server -Destination $backup
# Parse the PowerShell patch before publication.
$tokens=$null;$parseErrors=$null
[void][Management.Automation.Language.Parser]::ParseInput($plannerText,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw "Planner patch parse failed: $($parseErrors[0].Message)"}
$serverText | & node --check
if($LASTEXITCODE -ne 0){throw 'Studio patch syntax check failed. Code unchanged.'}
[IO.File]::WriteAllText($planner,$plannerText,(New-Object Text.UTF8Encoding($true)))
[IO.File]::WriteAllText($server,$serverText,(New-Object Text.UTF8Encoding($false)))
# Validate each new source fully before building composites or reserving assets.
$i=0
foreach($p in $sourcePaths){
 $i++;Write-Host "Checking source $i / $($sourcePaths.Count): $([IO.Path]::GetFileName($p))" -ForegroundColor Cyan
 & ffmpeg -hide_banner -v error -xerror -nostdin -i $p -map 0:v:0 -map 0:a:0 -f null -
 if($LASTEXITCODE -ne 0){throw "Source decode check failed: $p. No CN05 plan created."}
}
& (Join-Path $SystemRoot 'TOOLKIT\Build-RetroCartComposite.ps1') -RecipePath $recipePath
foreach($job in $recipe.Jobs){
 $expected=0.0;foreach($p in $job.Parts){$expected+=Seconds $p}
 $actual=Seconds $job.Output
 if([math]::Abs($actual-$expected) -gt 5){throw "Composite duration mismatch: $($job.Output)"}
 & ffmpeg -hide_banner -v error -xerror -nostdin -i $job.Output -map 0:v:0 -map 0:a:0 -f null -
 if($LASTEXITCODE -ne 0){throw "Composite decode failed: $($job.Output)"}
}
& (Join-Path $SystemRoot 'TOOLKIT\Initialize-RetroCartLibrary.ps1') -SystemRoot $SystemRoot
& (Join-Path $SystemRoot 'TOOLKIT\New-RetroCartPlan.ps1') -CartID CN05 -SystemRoot $SystemRoot
$registered=@(Import-Csv -LiteralPath $s.CartRegistryPath | Where-Object {$_.CartID -eq 'CN05'})
if($registered.Count -ne 1 -or -not(Test-Path -LiteralPath $registered[0].ManifestPath)){throw 'CN05 registry/manifest verification failed. Do not rerun planning; share output.'}
Write-Host "DONE: CN05 r$($registered[0].CurrentRevision) is ready for Studio. Backup: $backup" -ForegroundColor Green
