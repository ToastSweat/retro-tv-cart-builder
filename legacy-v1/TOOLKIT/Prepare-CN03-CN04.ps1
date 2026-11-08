[CmdletBinding()]
param([string]$SystemRoot='F:\[VIDEOS]\retro-tv-cart-builder')
$ErrorActionPreference='Stop'
$settings=Get-Content -LiteralPath (Join-Path $SystemRoot 'STATE\settings.json') -Raw | ConvertFrom-Json
$selection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'CN03-CN04-selections.json') -Raw | ConvertFrom-Json
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backup=Join-Path $SystemRoot "STATE\backups\CN03-CN04-$stamp"
[void][IO.Directory]::CreateDirectory($backup)
foreach($p in @($settings.CartRegistryPath,$settings.AssignmentPath,$settings.RegistryPath)) {
    Copy-Item -LiteralPath $p -Destination $backup
}
foreach($id in @('CN03','CN04')) {
    $p=Join-Path $settings.ConfigDir "$id.json"
    if(Test-Path -LiteralPath $p){Copy-Item -LiteralPath $p -Destination $backup}
}
$carts=@(Import-Csv -LiteralPath $settings.CartRegistryPath)
$existing04=@($carts | Where-Object {$_.CartID -eq 'CN04'})
if($existing04.Count){throw 'CN04 already exists. Stopping to avoid creating another revision.'}
$old03=@($carts | Where-Object {$_.CartID -eq 'CN03'})
if($old03.Count -ne 1){throw 'Expected one existing CN03 registry row.'}
if($old03[0].Status -ne 'DRAFT'){throw 'CN03 is not DRAFT; inspect its state before replacing it.'}
$tv='F:\[VIDEOS]\TV'
function MediaFiles([string]$pattern) {
    $dirs=@(Get-ChildItem -LiteralPath $tv -Directory | Where-Object {$_.Name -like $pattern})
    if($dirs.Count -ne 1){throw "Expected one show folder matching $pattern"}
    return @(Get-ChildItem -LiteralPath $dirs[0].FullName -Recurse -File | Where-Object {$_.Extension -in '.mp4','.mkv','.avi','.m4v'} | Sort-Object FullName)
}
$courage=MediaFiles 'COURAGE the COWARDLY DOG*'
$cow=MediaFiles 'COW and CHICKEN*'
$johnnyFolder=Join-Path $tv 'Johnny Bravo S01-S04 (1997-)\Johnny Bravo S01 (360p re-dvdrip)'
$johnny=@(Get-ChildItem -LiteralPath $johnnyFolder -File -Filter '*.mp4' | Sort-Object Name)
# New release: use its explicit short numbering, independent of the old AVI groups.
$johnnyGroups=@{
    1=@(1,2,3);2=@(4,5,6);3=@(7,8);4=@(9,10,11);5=@(12,13,14);6=@(15,16,17)
}
$johnnySelected=@(foreach($number in 1..17){
    $token='S01E{0:D2} ' -f $number
    $hits=@($johnny | Where-Object {$_.Name.Contains($token)})
    if($hits.Count -ne 1){throw "Expected one new-release file for $token"}
    $hits[0]
})
foreach($file in $johnnySelected){
    Write-Host "Checking new source: $($file.Name)" -ForegroundColor Cyan
    & ffmpeg -hide_banner -v error -xerror -nostdin -i $file.FullName -map 0:v:0 -map 0:a:0 -f null -
    if($LASTEXITCODE -ne 0){throw "New source failed decoding: $($file.FullName). No cart plans were created."}
}
function OneFile($files,[string]$token) {
    $hits=@($files | Where-Object {$_.Name.Contains($token)})
    if($hits.Count -ne 1){throw "Expected exactly one file for $token; found $($hits.Count)"}
    return $hits[0].FullName
}
function Seconds([string]$p) {
    $raw=& ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $p
    if($LASTEXITCODE -ne 0){throw "ffprobe failed: $p"}
    return [double]::Parse(($raw -join '').Trim(),[cultureinfo]::InvariantCulture)
}
$plans=@{}
$recipes=@{}
foreach($id in @('CN03','CN04')) {
    $sel=$selection.$id
    $eps=New-Object 'System.Collections.Generic.List[object]'
    $jobs=New-Object 'System.Collections.Generic.List[object]'
    for($i=0;$i -lt 3;$i++) {
        $cp=OneFile $courage $sel.courage[$i]
        $n=[int]$sel.johnny[$i]
        $jp=@(foreach($number in $johnnyGroups[$n]){
            OneFile $johnny ('S01E{0:D2} ' -f $number)
        })
        if($jp.Count -lt 2 -or $jp.Count -gt 3){throw "Johnny Bravo group $n has $($jp.Count) parts; inspect before continuing."}
        $wp=@(foreach($token in $sel.cow[$i]){OneFile $cow $token})
        $groups=@(
            [pscustomobject]@{Series='Courage the Cowardly Dog';Parts=@($cp);Key='Courage';Keywords=@('Courage')},
            [pscustomobject]@{Series='Johnny Bravo';Parts=$jp;Key=('Johnny-Bravo-MP4-release-group-{0:D2}' -f $n);Keywords=@('Johnny Bravo','Bravo')},
            [pscustomobject]@{Series='Cow and Chicken';Parts=$wp;Key=('Cow-and-Chicken-block-{0:D2}' -f ($i+1));Keywords=@('Cow and Chicken')}
        )
        foreach($g in $groups) {
            $total=0.0
            foreach($part in $g.Parts){$total+=Seconds $part}
            if($total -lt 1100 -or $total -gt 1500){throw "Unexpected show-block duration $total seconds: $($g.Key)"}
            $title=($g.Parts | ForEach-Object {[IO.Path]::GetFileNameWithoutExtension($_)}) -join ' + '
            $source=$g.Parts[0]
            if($g.Parts.Count -gt 1) {
                $source=Join-Path $tv "_RetroTV_Composites\$id\$($g.Key).mkv"
                $jobs.Add([pscustomobject]@{Name=$title;Mode='Normalize';Parts=@($g.Parts);Output=$source})
            }
            $eps.Add([pscustomobject]@{Order=$eps.Count+1;Series=$g.Series;BrandingKeywords=$g.Keywords;Title=$title;SourcePath=$source})
        }
    }
    $plans[$id]=[ordered]@{CartID=$id;DisplayName="Cartoon Network Cartoon Cartoons - $id";Network='CN';CommercialPool='KIDS_00S';AdsPerBreak=1;AnchorMinSeconds=20;StingMaxSeconds=12;InsertStingAfterShowNumbers=@();UseMatchedNext=$false;BreakStyle='LEAN';Episodes=@($eps.ToArray())}
    $recipes[$id]=[ordered]@{Name="$id Cartoon Cartoons composites";Jobs=@($jobs.ToArray())}
}
# All source paths and group durations have passed before config/state mutation.
$registry=@(Import-Csv -LiteralPath $settings.RegistryPath)
$signoffs=@($registry | Where-Object {$_.AssetType -eq 'BRANDING' -and $_.Network -eq 'CN' -and $_.Subtype -eq 'SIGN_OFF' -and $_.SourceStatus -eq 'READY'} | Sort-Object Title)
if(-not $signoffs.Count){throw 'No READY CN sign-off. Register/review one before planning.'}
for($i=0;$i -lt $signoffs.Count;$i++){Write-Host "[$($i+1)] $($signoffs[$i].Title)"}
$answer=Read-Host 'Choose sign-off number for both carts'
$choice=0
if(-not [int]::TryParse($answer,[ref]$choice) -or $choice -lt 1 -or $choice -gt $signoffs.Count){throw 'Invalid sign-off selection.'}
foreach($id in @('CN03','CN04')) {
    $plans[$id]['SignOffAssetID']=$signoffs[$choice-1].AssetID
    $plans[$id] | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $settings.ConfigDir "$id.json") -Encoding UTF8
    $recipeDir=Join-Path $settings.ConfigDir 'composites'
    [void][IO.Directory]::CreateDirectory($recipeDir)
    $rp=Join-Path $recipeDir "$id-Cartoon-Cartoons.json"
    $recipes[$id] | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $rp -Encoding UTF8
    Write-Host "BUILDING $id COMPOSITES" -ForegroundColor Cyan
    & (Join-Path $SystemRoot 'TOOLKIT\Build-RetroCartComposite.ps1') -RecipePath $rp
    foreach($job in $recipes[$id].Jobs){
        $expected=0.0;foreach($p in $job.Parts){$expected+=Seconds $p}
        $actual=Seconds $job.Output
        if([math]::Abs($actual-$expected) -gt 5){throw "Composite duration mismatch: $($job.Output)"}
        # Decode the primary streams; a nonzero exit blocks planning.
        & ffmpeg -v error -xerror -nostdin -i $job.Output -map 0:v:0 -map 0:a:0 -f null -
        if($LASTEXITCODE -ne 0){throw "Composite decode validation failed: $($job.Output)"}
    }
}
& (Join-Path $SystemRoot 'TOOLKIT\Initialize-RetroCartLibrary.ps1') -SystemRoot $SystemRoot
# Release only reservations from the abandoned CN03 current revision.
$assignments=@(Import-Csv -LiteralPath $settings.AssignmentPath)
$now=[DateTime]::UtcNow.ToString('o')
foreach($a in $assignments){
    if($a.CartID -eq 'CN03' -and [int]$a.Revision -eq [int]$old03[0].CurrentRevision -and $a.AssignmentStatus -eq 'RESERVED'){
        $a.AssignmentStatus='RELEASED';$a.ReleasedUtc=$now;$a.ReleaseReason='Lineup replaced with Courage, Johnny Bravo, Cow and Chicken'
    }
}
$assignments | Export-Csv -LiteralPath $settings.AssignmentPath -NoTypeInformation -Encoding UTF8
& (Join-Path $SystemRoot 'TOOLKIT\New-RetroCartPlan.ps1') -CartID CN03 -SystemRoot $SystemRoot -ForceNewRevision
& (Join-Path $SystemRoot 'TOOLKIT\New-RetroCartPlan.ps1') -CartID CN04 -SystemRoot $SystemRoot
Write-Host "DONE: CN03 and CN04 prepared. Backup: $backup" -ForegroundColor Green
Write-Host 'Review CN03 in Studio next. The old CN03 revision remains intact.'
