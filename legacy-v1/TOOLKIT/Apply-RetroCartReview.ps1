# Retro TV Cart Builder v1 -- apply exported review state and optional replacements
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CartID,
    [Parameter(Mandatory=$true)][string]$ReviewCsv,
    [string]$SystemRoot = 'F:\[VIDEOS]\Retro TV Cart Builder',
    [switch]$AutoReplace,
    [switch]$LeanBreaks,
    [switch]$PreflightOnly
)
$ErrorActionPreference='Stop'

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

if (-not (Test-Path -LiteralPath $ReviewCsv -PathType Leaf)) { throw "Review CSV not found: $ReviewCsv" }
$stateDir=Join-Path $SystemRoot 'STATE'
$settings=Get-Content -LiteralPath (Join-Path $stateDir 'settings.json') -Raw | ConvertFrom-Json
$registry=@(Import-Csv -LiteralPath $settings.RegistryPath)
$registryById=@{}; foreach($r in $registry){$registryById[$r.AssetID]=$r}
$carts=@(Import-Csv -LiteralPath $settings.CartRegistryPath)
$cart=@($carts|Where-Object{$_.CartID -eq $CartID}|Select-Object -First 1)
if($cart.Count -eq 0){throw "Unknown cart: $CartID"}
$oldRev=[int]$cart[0].CurrentRevision
$oldManifestPath=$cart[0].ManifestPath
$oldManifest=@(Import-Csv -LiteralPath $oldManifestPath)
$review=@(Import-Csv -LiteralPath $ReviewCsv)
$reviewBySlot=@{};foreach($x in $review){$reviewBySlot[$x.SlotID]=$x}

$configPath=Join-Path $settings.ConfigDir ($CartID.ToUpperInvariant()+'.json')
$cfg=$null
if(Test-Path -LiteralPath $configPath){$cfg=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json}

# Guard against applying a stale review CSV to a different revision.
$reviewLeaf=Split-Path -Leaf $ReviewCsv
if($reviewLeaf -match '-r(?<rev>\d{3})-review-state'){
    $reviewRevision=[int]$Matches['rev']
    if($reviewRevision -ne $oldRev){
        throw "Review CSV is for r$('{0:D3}' -f $reviewRevision), but $CartID is currently r$('{0:D3}' -f $oldRev)."
    }
}

$staleReview=New-Object System.Collections.ArrayList
foreach($m in $oldManifest){
    $x=$reviewBySlot[$m.SlotID]
    if(-not $x){
        [void]$staleReview.Add([pscustomobject]@{SlotID=$m.SlotID;Problem='slot missing from review CSV'})
    } elseif([string]$x.AssetID -ne [string]$m.AssetID){
        [void]$staleReview.Add([pscustomobject]@{SlotID=$m.SlotID;Problem="review asset $($x.AssetID) != current $($m.AssetID)"})
    }
}
if($staleReview.Count -gt 0){
    $staleReview | Format-Table -AutoSize
    throw "Review CSV does not match the current manifest."
}


function Get-ApprovedRepairRecipe {
    param([string]$AssetID)

    # Reuse only a recipe that was part of a FINAL build. That gives us an
    # approved, actually-deployed example instead of guessing from an
    # unreviewed intermediate manifest.
    $finalManifests=@(
        Get-ChildItem -LiteralPath $settings.BuildRoot -Recurse -File -Filter 'cart-final-manifest.csv' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    )

    foreach($fm in $finalManifests){
        try{
            $hit=@(
                Import-Csv -LiteralPath $fm.FullName |
                Where-Object {$_.AssetID -eq $AssetID} |
                Select-Object -First 1
            )
        }catch{
            continue
        }

        if($hit.Count -gt 0){
            $r=$hit[0]
            $audio=([string]$r.AudioRepair).Trim().ToUpperInvariant()
            if([string]::IsNullOrWhiteSpace($audio)){$audio='NONE'}
            if($audio -eq 'LIGHT'){$audio='RESTORE'}

            return [pscustomobject][ordered]@{
                TrimStartSeconds=$(if([string]::IsNullOrWhiteSpace([string]$r.TrimStartSeconds)){0}else{$r.TrimStartSeconds})
                TrimEndSeconds=$(if([string]::IsNullOrWhiteSpace([string]$r.TrimEndSeconds)){0}else{$r.TrimEndSeconds})
                CropLeft=$(if([string]::IsNullOrWhiteSpace([string]$r.CropLeft)){0}else{$r.CropLeft})
                CropRight=$(if([string]::IsNullOrWhiteSpace([string]$r.CropRight)){0}else{$r.CropRight})
                CropTop=$(if([string]::IsNullOrWhiteSpace([string]$r.CropTop)){0}else{$r.CropTop})
                CropBottom=$(if([string]::IsNullOrWhiteSpace([string]$r.CropBottom)){0}else{$r.CropBottom})
                AudioRepair=$audio
                SourceManifest=$fm.FullName
            }
        }
    }

    return $null
}

function Resolve-ConfiguredSignOff {
    param($Asset,[string]$CartNetwork)

    if(-not $Asset){throw "Configured SIGN_OFF asset could not be resolved."}
    if($Asset.AssetType -ne 'BRANDING'){throw "Configured SIGN_OFF asset must be BRANDING: $($Asset.AssetID)"}
    if($Asset.Network -and $Asset.Network -ne $CartNetwork){
        throw "Configured SIGN_OFF network '$($Asset.Network)' does not match cart network '$CartNetwork'."
    }

    $status=([string]$Asset.SourceStatus).Trim().ToUpperInvariant()
    if($status -eq 'READY'){
        return [pscustomobject][ordered]@{
            Asset=$Asset
            TrimStartSeconds=0
            TrimEndSeconds=0
            CropLeft=0
            CropRight=0
            CropTop=0
            CropBottom=0
            AudioRepair='NONE'
            RepairSource=''
        }
    }

    if($status -in @('NEEDS_CLIPPED','NEEDS_CROP','BAD_AUDIO')){
        $recipe=Get-ApprovedRepairRecipe -AssetID $Asset.AssetID
        if(-not $recipe){
            throw "Configured SIGN_OFF asset $($Asset.AssetID) is $status and no approved repair recipe was found in any FINAL build. Do not force it READY; first finalize an approved repaired use or repair it explicitly."
        }

        Write-Host ("Configured SIGN_OFF is {0}; inheriting approved repair recipe from {1}" -f $status,$recipe.SourceManifest)

        return [pscustomobject][ordered]@{
            Asset=$Asset
            TrimStartSeconds=$recipe.TrimStartSeconds
            TrimEndSeconds=$recipe.TrimEndSeconds
            CropLeft=$recipe.CropLeft
            CropRight=$recipe.CropRight
            CropTop=$recipe.CropTop
            CropBottom=$recipe.CropBottom
            AudioRepair=$recipe.AudioRepair
            RepairSource=$recipe.SourceManifest
        }
    }

    throw "Configured SIGN_OFF asset is not usable: $($Asset.AssetID) status=$status. BAD_QUALITY, DUPLICATE, EXCLUDED, MAYBE, and other non-repairable states are intentionally blocked."
}

$signOffAssetId=''
if($cfg -and ($cfg.PSObject.Properties.Name -contains 'SignOffAssetID')){$signOffAssetId=[string]$cfg.SignOffAssetID}
$signOffPending=(-not [string]::IsNullOrWhiteSpace($signOffAssetId) -and @($oldManifest | Where-Object {$_.Role -eq 'SIGN_OFF'}).Count -eq 0)

function To-DoubleOrZero($value){
    $d=0.0
    [void][double]::TryParse(([string]$value),[System.Globalization.NumberStyles]::Float,[cultureinfo]::InvariantCulture,[ref]$d)
    return $d
}
function Normalize-AudioRepair([string]$value){
    $a=([string]$value).Trim().ToUpperInvariant()
    if([string]::IsNullOrWhiteSpace($a)){$a='NONE'}
    if($a -eq 'LIGHT'){$a='RESTORE'}
    return $a
}
function Get-NextAudioRepair([string]$value){
    $normalized=Normalize-AudioRepair $value
    switch($normalized){
        'NONE'       { return 'RESTORE' }
        'RESTORE'    { return 'STRONG' }
        'STRONG'     { return 'AGGRESSIVE' }
        'AGGRESSIVE' { return 'MAX' }
        'MAX'        { return 'MAX' }
        default      { return 'RESTORE' }
    }
}

# Stage source-health findings in memory. Nothing durable is written until
# the entire proposed revision passes preflight and verification.
$globalBad=@('BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE')
$pendingSourceStatus=@{}
$pendingSourceNotes=@{}
foreach($x in $review){
    if($globalBad -contains $x.Action){
        $pendingSourceStatus[[string]$x.AssetID]=[string]$x.Action
        if($x.Notes){$pendingSourceNotes[[string]$x.AssetID]=[string]$x.Notes}
    }
}
function Get-EffectiveSourceStatus($asset){
    if(-not $asset){return ''}
    if($pendingSourceStatus.ContainsKey([string]$asset.AssetID)){
        return [string]$pendingSourceStatus[[string]$asset.AssetID]
    }
    return [string]$asset.SourceStatus
}

$oldManifestBySlot=@{}
foreach($om in $oldManifest){$oldManifestBySlot[[string]$om.SlotID]=$om}

function Get-ReviewRepairRecipeForAsset([string]$AssetID){
    $rx=@(
        $review |
        Where-Object {
            [string]$_.AssetID -eq $AssetID -and
            $_.Action -in @('NEEDS_CROP','NEEDS_CLIPPED','BAD_AUDIO')
        } |
        Select-Object -First 1
    )
    if($rx.Count -eq 0){return $null}

    $rr=$rx[0]
    $om=$oldManifestBySlot[[string]$rr.SlotID]
    if(-not $om){return $null}

    $trimStart=To-DoubleOrZero $om.TrimStartSeconds
    $trimEnd=To-DoubleOrZero $om.TrimEndSeconds
    $cropLeft=[int](To-DoubleOrZero $om.CropLeft)
    $cropRight=[int](To-DoubleOrZero $om.CropRight)
    $cropTop=[int](To-DoubleOrZero $om.CropTop)
    $cropBottom=[int](To-DoubleOrZero $om.CropBottom)
    $audio=([string]$om.AudioRepair).Trim().ToUpperInvariant()
    if([string]::IsNullOrWhiteSpace($audio)){$audio='NONE'}
    if($audio -eq 'LIGHT'){$audio='RESTORE'}

    switch([string]$rr.Action){
        'NEEDS_CLIPPED' {
            $addStart=To-DoubleOrZero $rr.TrimStart
            $addEnd=To-DoubleOrZero $rr.TrimEnd
            if($addStart -le 0 -and $addEnd -le 0){return $null}
            $trimStart += $addStart
            $trimEnd += $addEnd
        }
        'NEEDS_CROP' {
            $addLeft=[int](To-DoubleOrZero $rr.CropLeft)
            $addRight=[int](To-DoubleOrZero $rr.CropRight)
            $addTop=[int](To-DoubleOrZero $rr.CropTop)
            $addBottom=[int](To-DoubleOrZero $rr.CropBottom)
            if(($addLeft+$addRight+$addTop+$addBottom) -le 0){return $null}
            $cropLeft += $addLeft
            $cropRight += $addRight
            $cropTop += $addTop
            $cropBottom += $addBottom
        }
        'BAD_AUDIO' {
            $audio=Get-NextAudioRepair $audio
        }
    }

    return [pscustomobject][ordered]@{
        TrimStartSeconds=$trimStart
        TrimEndSeconds=$trimEnd
        CropLeft=$cropLeft
        CropRight=$cropRight
        CropTop=$cropTop
        CropBottom=$cropBottom
        AudioRepair=$audio
        Source="same review: $($rr.SlotID)"
    }
}

function Test-RepairRecipeForStatus($recipe,[string]$status){
    if(-not $recipe){return $false}
    switch($status){
        'NEEDS_CROP' {
            return (([int](To-DoubleOrZero $recipe.CropLeft)+[int](To-DoubleOrZero $recipe.CropRight)+[int](To-DoubleOrZero $recipe.CropTop)+[int](To-DoubleOrZero $recipe.CropBottom)) -gt 0)
        }
        'NEEDS_CLIPPED' {
            return ((To-DoubleOrZero $recipe.TrimStartSeconds) -gt 0 -or (To-DoubleOrZero $recipe.TrimEndSeconds) -gt 0)
        }
        'BAD_AUDIO' {
            $a=([string]$recipe.AudioRepair).Trim().ToUpperInvariant()
            if($a -eq 'LIGHT'){$a='RESTORE'}
            return ($a -in @('RESTORE','STRONG','AGGRESSIVE','MAX'))
        }
        default { return $true }
    }
}

function Get-ReplacementRepairRecipe($asset){
    if(-not $asset){return $null}
    $status=(Get-EffectiveSourceStatus $asset).ToUpperInvariant()

    if($status -eq 'READY'){
        return [pscustomobject][ordered]@{
            TrimStartSeconds=0;TrimEndSeconds=0
            CropLeft=0;CropRight=0;CropTop=0;CropBottom=0
            AudioRepair='NONE';Source='READY source'
        }
    }

    if($status -notin @('NEEDS_CROP','NEEDS_CLIPPED','BAD_AUDIO')){return $null}

    $sameReview=Get-ReviewRepairRecipeForAsset -AssetID ([string]$asset.AssetID)
    if(Test-RepairRecipeForStatus $sameReview $status){return $sameReview}

    $approved=Get-ApprovedRepairRecipe -AssetID ([string]$asset.AssetID)
    if(Test-RepairRecipeForStatus $approved $status){
        return [pscustomobject][ordered]@{
            TrimStartSeconds=$approved.TrimStartSeconds
            TrimEndSeconds=$approved.TrimEndSeconds
            CropLeft=$approved.CropLeft
            CropRight=$approved.CropRight
            CropTop=$approved.CropTop
            CropBottom=$approved.CropBottom
            AudioRepair=$approved.AudioRepair
            Source="FINAL: $($approved.SourceManifest)"
        }
    }
    return $null
}

# Track currently occupied UNIQUE assets so auto replacement cannot steal something from another cart.
$assignments=@(Read-CsvSafe $settings.AssignmentPath)
$busy=@{}
foreach($a in $assignments){
    if($a.AssignmentStatus -in @('RESERVED','ACTIVE')){
        $busy[$a.AssetID]=$true
    }
}
$chosenThisRevision=@{}

function Is-ReplacementAvailable($asset){
    if(-not $asset){return $false}
    if(-not (Get-ReplacementRepairRecipe $asset)){return $false}
    if($chosenThisRevision.ContainsKey($asset.AssetID)){return $false}
    if($asset.ReusePolicy -eq 'UNIQUE' -and $busy.ContainsKey($asset.AssetID)){return $false}
    return $true
}
function AssetText($asset){ return (([string]$asset.Title)+' '+([string]$asset.Notes)+' '+([string]$asset.InferredTags)).ToLowerInvariant() }
function Matches-Keywords($asset,[object[]]$keywords){
    if(-not $keywords){return $false}
    $hay=AssetText $asset
    foreach($k in $keywords){
        if($k -and $hay.Contains(([string]$k).ToLowerInvariant())){return $true}
    }
    return $false
}
$allShowKeywords=@()
if($cfg){
    $allShowKeywords=@($cfg.Episodes|ForEach-Object{$_.BrandingKeywords}|ForEach-Object{$_}|Where-Object{$_}|Sort-Object -Unique)
}
function Is-ShowSpecific($asset){
    if(-not $allShowKeywords -or $allShowKeywords.Count -eq 0){return $false}
    return (Matches-Keywords $asset $allShowKeywords)
}
function Is-ProgramSpecific($asset){
    $hay=AssetText $asset
    if($hay.Contains('program_specific')){return $true}
    if($hay -match '\b(up next|next up|coming up|now back|back to|return to|returns to|then)\b'){return $true}
    return (Is-ShowSpecific $asset)
}
function Will-LeanDrop($m){
    if(-not $LeanBreaks){return $false}
    if($m.Role -in @('NEXT','BUMPER_OUT','STING')){return $true}
    if($m.Role -eq 'AD' -and $m.SlotID -match '-AD-(0[2-9]|[1-9][0-9])$'){return $true}
    return $false
}
function Get-EpisodeKeywordsForSeries([string]$series){
    if(-not $cfg -or [string]::IsNullOrWhiteSpace($series)){return @()}
    $ep=@($cfg.Episodes|Where-Object{$_.Series -eq $series}|Select-Object -First 1)
    if($ep.Count -eq 0){return @()}
    return @($ep[0].BrandingKeywords)
}
function Find-AdjacentShow([int]$manifestIndex,[int]$direction){
    $j=$manifestIndex+$direction
    while($j -ge 0 -and $j -lt $oldManifest.Count){
        if($oldManifest[$j].Role -eq 'SHOW'){return $oldManifest[$j]}
        $j += $direction
    }
    return $null
}
function Get-ReplacementProblem($asset,$m){
    if(-not $asset){return 'asset does not exist in the registry'}
    if($asset.AssetID -eq $m.AssetID){return 'replacement is the same asset already in the slot'}
    $effectiveStatus=Get-EffectiveSourceStatus $asset
    $repairRecipe=Get-ReplacementRepairRecipe $asset
    if(-not $repairRecipe){return "asset status is $effectiveStatus and no usable repair recipe is available"}
    if($chosenThisRevision.ContainsKey($asset.AssetID)){return 'asset was already chosen as a replacement in this revision'}
    if($asset.ReusePolicy -eq 'UNIQUE' -and $busy.ContainsKey($asset.AssetID)){return 'UNIQUE asset is already reserved/active elsewhere'}

    if($m.Role -eq 'AD'){
        if($asset.AssetType -ne 'COMMERCIAL'){return 'replacement is not a commercial'}
        if($asset.Pool -ne $m.Pool){return "replacement is not from commercial pool $($m.Pool)"}
    }
    elseif($m.Role -eq 'SHOW'){
        if($asset.AssetType -ne 'EPISODE'){return 'replacement is not an episode'}
        if($asset.Network -ne $m.Network){return "replacement network '$($asset.Network)' does not match '$($m.Network)'"}
    }
    else{
        if($asset.AssetType -ne 'BRANDING'){return 'replacement is not branding'}
        if($asset.Network -ne $m.Network){return "replacement network '$($asset.Network)' does not match '$($m.Network)'"}
    }
    return $null
}

function Pick-AutoReplacement($m,[int]$manifestIndex){
    # Never "replace" a slot with the exact same asset it already contains.
    $candidates=@($registry|Where-Object{(Is-ReplacementAvailable $_) -and $_.AssetID -ne $m.AssetID})
    if($m.Role -eq 'AD'){
        $c=@($candidates|Where-Object{$_.AssetType -eq 'COMMERCIAL' -and $_.Pool -eq $m.Pool}|Sort-Object AssetID)
        if($c.Count){return $c[0]}
        return $null
    }
    if($m.Role -eq 'SHOW'){
        $c=@($candidates|Where-Object{$_.AssetType -eq 'EPISODE' -and $_.Network -eq $m.Network}|Sort-Object AssetID)
        if($c.Count){return $c[0]}
        return $null
    }

    $base=@($candidates|Where-Object{$_.AssetType -eq 'BRANDING' -and $_.Network -eq $m.Network})
    if($m.Role -eq 'ANCHOR_BRANDING'){
        $c=@($base|Where-Object{$_.Subtype -in @('IDENT','PROMO','INTRO') -and (To-DoubleOrZero $_.DurationSeconds) -ge 20}|Sort-Object AssetID)
        if($c.Count){return $c[0]}
    }
    elseif($m.Role -eq 'STING'){
        $c=@($base|Where-Object{$_.Subtype -in @('IDENT','BUMPER_GENERIC','TRANSITION') -and (To-DoubleOrZero $_.DurationSeconds) -le 15 -and -not (Is-ProgramSpecific $_)}|Sort-Object AssetID)
        if($c.Count){return $c[0]}
    }
    elseif($m.Role -eq 'BUMPER_OUT'){
        $prev=Find-AdjacentShow $manifestIndex -1
        $kw=if($prev){Get-EpisodeKeywordsForSeries $prev.Series}else{@()}
        $match=@($base|Where-Object{$_.Subtype -in @('BUMPER_OUT','BUMPER_GENERIC') -and (Matches-Keywords $_ $kw)}|Sort-Object AssetID)
        if($match.Count){return $match[0]}
        $generic=@($base|Where-Object{$_.Subtype -in @('BUMPER_OUT','BUMPER_GENERIC') -and -not (Is-ProgramSpecific $_)}|Sort-Object AssetID)
        if($generic.Count){return $generic[0]}
    }
    elseif($m.Role -eq 'BUMPER_IN'){
        $next=Find-AdjacentShow $manifestIndex 1
        $kw=if($next){Get-EpisodeKeywordsForSeries $next.Series}else{@()}
        $match=@($base|Where-Object{$_.Subtype -in @('BUMPER_IN','BUMPER_GENERIC') -and (Matches-Keywords $_ $kw)}|Sort-Object AssetID)
        if($match.Count){return $match[0]}
        $generic=@($base|Where-Object{$_.Subtype -in @('BUMPER_IN','BUMPER_GENERIC') -and -not (Is-ProgramSpecific $_)}|Sort-Object AssetID)
        if($generic.Count){return $generic[0]}
    }
    elseif($m.Role -eq 'NEXT'){
        $next=Find-AdjacentShow $manifestIndex 1
        $kw=if($next){Get-EpisodeKeywordsForSeries $next.Series}else{@()}
        $match=@($base|Where-Object{$_.Subtype -eq 'NEXT' -and (Matches-Keywords $_ $kw)}|Sort-Object AssetID)
        if($match.Count){return $match[0]}
    }
    return $null
}

$changeRows=New-Object System.Collections.ArrayList
$unresolved=New-Object System.Collections.ArrayList

for($i=0;$i -lt $oldManifest.Count;$i++){
    $m=$oldManifest[$i]
    $x=$reviewBySlot[$m.SlotID]
    if(-not $x){continue}

    # If the user is simplifying the cart, removed break clutter does not need
    # a replacement/trim resolution. Global source-health flags were already
    # recorded above.
    if(Will-LeanDrop $m){continue}

    $trimStart=To-DoubleOrZero $x.TrimStart
    $trimEnd=To-DoubleOrZero $x.TrimEnd
    $needsTrim=($trimStart -gt 0 -or $trimEnd -gt 0)

    $cropLeft=[int](To-DoubleOrZero $x.CropLeft)
    $cropRight=[int](To-DoubleOrZero $x.CropRight)
    $cropTop=[int](To-DoubleOrZero $x.CropTop)
    $cropBottom=[int](To-DoubleOrZero $x.CropBottom)
    $needsCrop=(($cropLeft+$cropRight+$cropTop+$cropBottom) -gt 0)

    $needsAudioRepair=($x.Action -eq 'BAD_AUDIO')
    $replacementReason=$x.Action -in @('REPLACE_THIS_CART','BAD_QUALITY','DUPLICATE','WRONG_ERA','WRONG_NETWORK')
    if($x.Action -eq 'NEEDS_CLIPPED' -and -not $needsTrim){
        [void]$unresolved.Add([pscustomobject]@{Position=$m.Position;SlotID=$m.SlotID;Role=$m.Role;Title=$m.Title;Problem='NEEDS_CLIPPED but TrimStart/TrimEnd are both 0'})
        continue
    }
    if($x.Action -eq 'NEEDS_CROP' -and -not $needsCrop){
        [void]$unresolved.Add([pscustomobject]@{Position=$m.Position;SlotID=$m.SlotID;Role=$m.Role;Title=$m.Title;Problem='NEEDS_CROP but all crop values are 0'})
        continue
    }

    # Only replacement actions are allowed to consume ReplacementAssetID.
    # The browser may retain a previously-selected replacement even after the
    # reviewer changes the Action to NEEDS_CROP / NEEDS_CLIPPED / GOOD.
    $replacementId=''
    $staleReplacementId=[string]$x.ReplacementAssetID
    if($replacementReason){
        $replacementId=$staleReplacementId
    }
    elseif(-not [string]::IsNullOrWhiteSpace($staleReplacementId)){
        Write-Warning "$($m.SlotID): ignoring stale ReplacementAssetID '$staleReplacementId' because Action is $($x.Action)."
    }

    if($replacementReason -and ($needsTrim -or $needsCrop)){
        Write-Warning "$($m.SlotID): $($x.Action) requires replacement. Entered trim/crop values belong to the rejected source and will not be applied to its replacement."
    }

    # A replacement chosen in the browser may no longer be valid by apply time.
    # Example: the chosen branding asset is also used elsewhere in this review
    # and was marked BAD_AUDIO/NEEDS_CROP, which changes its global SourceStatus.
    if($replacementReason -and -not [string]::IsNullOrWhiteSpace($replacementId)){
        $manualAsset=$registryById[$replacementId]
        $problem=Get-ReplacementProblem $manualAsset $m
        if($problem){
            if($AutoReplace){
                Write-Warning "$($m.SlotID): selected replacement '$replacementId' is not usable ($problem). Falling back to AutoReplace."
                $replacementId=''
            }
            else{
                [void]$unresolved.Add([pscustomobject]@{
                    Position=$m.Position;SlotID=$m.SlotID;Role=$m.Role;Title=$m.Title
                    Problem="Selected replacement $replacementId is not usable: $problem"
                })
                continue
            }
        }
        else{
            $chosenThisRevision[$replacementId]=$true
        }
    }

    if($replacementReason -and [string]::IsNullOrWhiteSpace($replacementId) -and $AutoReplace){
        $pick=Pick-AutoReplacement $m $i
        if($pick){
            $replacementId=$pick.AssetID
            $chosenThisRevision[$pick.AssetID]=$true
            Write-Host ("Auto replacement: {0} {1} -> {2}" -f $m.Position,$m.Title,$pick.Title)
        }
    }
    if($replacementReason -and [string]::IsNullOrWhiteSpace($replacementId)){
        [void]$unresolved.Add([pscustomobject]@{Position=$m.Position;SlotID=$m.SlotID;Role=$m.Role;Title=$m.Title;Problem="$($x.Action) needs a replacement"})
        continue
    }

    if($replacementId -or $needsTrim -or $needsCrop -or $needsAudioRepair){
        [void]$changeRows.Add([pscustomobject]@{
            SlotID=$m.SlotID;ReplacementAssetID=$replacementId;TrimStart=$trimStart;TrimEnd=$trimEnd
            CropLeft=$cropLeft;CropRight=$cropRight;CropTop=$cropTop;CropBottom=$cropBottom
            AudioRepair=$(if($needsAudioRepair){'AUTO'}else{''})
            Action=$x.Action;Notes=$x.Notes
        })
    }
}

if($unresolved.Count -gt 0){
    Write-Host ""
    Write-Host "Review has unresolved changes:" -ForegroundColor Yellow
    $unresolved | Format-Table -AutoSize
    Write-Host ""
    Write-Host "For NEEDS_CLIPPED, enter Trim Start and/or Trim End in the reviewer."
    Write-Host "For NEEDS_CROP, use the suggested crop button or enter crop pixels manually."
    Write-Host "For replacements, either select one in the reviewer or rerun this command with -AutoReplace."
    Write-Host ""
    Write-Host "NO CART REVISION OR DURABLE SOURCE-STATE CHANGES WERE COMMITTED." -ForegroundColor Yellow
    exit 2
}

if($changeRows.Count -eq 0 -and -not $LeanBreaks -and -not $signOffPending){
    Write-Host "No replacements, trims, crops, or layout changes requested. Global source-state updates (if any) were saved."
    exit 0
}

$changeBySlot=@{};foreach($c in $changeRows){$changeBySlot[$c.SlotID]=$c}
$newRev=$oldRev+1
$revName=('r{0:D3}' -f $newRev)
$newRevDir=Join-Path (Join-Path $settings.BuildRoot $CartID) $revName
$newManifest=New-Object 'System.Collections.Generic.List[object]'

for($i=0;$i -lt $oldManifest.Count;$i++){
    $m=$oldManifest[$i]
    $c=$changeBySlot[$m.SlotID]

    if($c -and -not [string]::IsNullOrWhiteSpace([string]$c.ReplacementAssetID)){
        $a=$registryById[$c.ReplacementAssetID]

        # Final safety check at manifest-build time. A candidate can become
        # unusable after review-state/source-health updates. With -AutoReplace,
        # recover here rather than aborting the whole revision.
        $lateProblem=$null
        if(-not $a){$lateProblem="asset does not exist in the registry"}
        elseif($a.AssetID -eq $m.AssetID){$lateProblem="replacement is the same asset already in the slot"}
        elseif(-not (Get-ReplacementRepairRecipe $a)){$lateProblem="asset status is $(Get-EffectiveSourceStatus $a) and no usable repair recipe is available"}
        elseif($m.Role -eq 'AD' -and ($a.AssetType -ne 'COMMERCIAL' -or $a.Pool -ne $m.Pool)){
            $lateProblem="replacement is not a READY commercial from pool $($m.Pool)"
        }
        elseif($m.Role -eq 'SHOW' -and ($a.AssetType -ne 'EPISODE' -or $a.Network -ne $m.Network)){
            $lateProblem="SHOW replacement must be a READY EPISODE on network $($m.Network)"
        }
        elseif($m.Role -ne 'AD' -and $m.Role -ne 'SHOW' -and ($a.AssetType -ne 'BRANDING' -or $a.Network -ne $m.Network)){
            $lateProblem="branding replacement is not on network $($m.Network)"
        }

        if($lateProblem){
            if($AutoReplace){
                Write-Warning "$($m.SlotID): replacement '$($c.ReplacementAssetID)' became unusable at manifest build time ($lateProblem). Picking another replacement."
                $pick=Pick-AutoReplacement $m $i
                if(-not $pick){throw "No compatible READY replacement could be found for $($m.SlotID) after '$($c.ReplacementAssetID)' became unusable."}
                $a=$pick
                $c.ReplacementAssetID=$pick.AssetID
                $chosenThisRevision[$pick.AssetID]=$true
                Write-Host ("Auto replacement (late fallback): {0} {1} -> {2}" -f $m.Position,$m.Title,$pick.Title)
            }
            else{
                throw "Replacement is not usable for $($m.SlotID): $lateProblem"
            }
        }

        $replacementRecipe=Get-ReplacementRepairRecipe $a
        if(-not $replacementRecipe){throw "Replacement recipe unexpectedly unavailable for $($a.AssetID)."}

        if((Get-EffectiveSourceStatus $a) -ne 'READY'){
            Write-Host ("Repairable replacement: {0} will inherit {1}" -f $a.Title,$replacementRecipe.Source)
        }

        $newManifest.Add([pscustomobject][ordered]@{
            Position=$m.Position;SlotID=$m.SlotID;Role=$m.Role;AssetID=$a.AssetID;AssetType=$a.AssetType;AssetSubtype=$a.Subtype
            Title=$a.Title;Series=$m.Series;Pool=$a.Pool;Network=$a.Network;SourcePath=$a.SourcePath;DurationSeconds=$a.DurationSeconds
            ReusePolicy=$a.ReusePolicy;ReviewStatus='UNREVIEWED'
            TrimStartSeconds=$replacementRecipe.TrimStartSeconds;TrimEndSeconds=$replacementRecipe.TrimEndSeconds
            CropLeft=$replacementRecipe.CropLeft;CropRight=$replacementRecipe.CropRight
            CropTop=$replacementRecipe.CropTop;CropBottom=$replacementRecipe.CropBottom
            AudioRepair=$replacementRecipe.AudioRepair
        })
    } else {
        $oldTrimStart=To-DoubleOrZero $m.TrimStartSeconds
        $oldTrimEnd=To-DoubleOrZero $m.TrimEndSeconds
        $oldCropLeft=[int](To-DoubleOrZero $m.CropLeft)
        $oldCropRight=[int](To-DoubleOrZero $m.CropRight)
        $oldCropTop=[int](To-DoubleOrZero $m.CropTop)
        $oldCropBottom=[int](To-DoubleOrZero $m.CropBottom)
        $oldAudioRepair=([string]$m.AudioRepair).Trim().ToUpperInvariant()
        if([string]::IsNullOrWhiteSpace($oldAudioRepair)){$oldAudioRepair='NONE'}
        if($c){
            # Review trims/crops are additive. BAD_AUDIO is an explicit request
            # for restoration. First report -> RESTORE. If the user reports bad
            # audio again after a prior repair -> STRONG.
            $oldTrimStart += [double]$c.TrimStart
            $oldTrimEnd += [double]$c.TrimEnd
            $oldCropLeft += [int]$c.CropLeft
            $oldCropRight += [int]$c.CropRight
            $oldCropTop += [int]$c.CropTop
            $oldCropBottom += [int]$c.CropBottom

            if(([string]$c.AudioRepair).ToUpperInvariant() -eq 'AUTO'){
                $oldAudioRepair=Get-NextAudioRepair $oldAudioRepair
            }
        }
        $rv=$reviewBySlot[$m.SlotID]
        $carryReview='UNREVIEWED'
        if(-not $c -and $rv -and $rv.Action -eq 'GOOD'){$carryReview='GOOD'}

        $newManifest.Add([pscustomobject][ordered]@{
            Position=$m.Position;SlotID=$m.SlotID;Role=$m.Role;AssetID=$m.AssetID;AssetType=$m.AssetType;AssetSubtype=$m.AssetSubtype
            Title=$m.Title;Series=$m.Series;Pool=$m.Pool;Network=$m.Network;SourcePath=$m.SourcePath;DurationSeconds=$m.DurationSeconds
            ReusePolicy=$m.ReusePolicy;ReviewStatus=$carryReview;TrimStartSeconds=$oldTrimStart;TrimEndSeconds=$oldTrimEnd
            CropLeft=$oldCropLeft;CropRight=$oldCropRight;CropTop=$oldCropTop;CropBottom=$oldCropBottom;AudioRepair=$oldAudioRepair
        })
    }
}
if($LeanBreaks){
    $leanManifest = New-Object 'System.Collections.Generic.List[object]'
    foreach($m in $newManifest){
        if(Will-LeanDrop $m){ continue }
        $leanManifest.Add($m)
    }
    $newManifest = $leanManifest
}

if($signOffPending){
    $s=$registryById[$signOffAssetId]
    if(-not $s){throw "Configured SIGN_OFF asset is not registered: $signOffAssetId. Run Initialize-RetroCartLibrary.ps1 after registering it."}
    $resolved=Resolve-ConfiguredSignOff -Asset $s -CartNetwork $cart[0].Network

    $maxPos=0
    foreach($m in $newManifest){$n=0;if([int]::TryParse([string]$m.Position,[ref]$n)){if($n -gt $maxPos){$maxPos=$n}}}
    $newPos='{0:D4}' -f ($maxPos+10)

    $newManifest.Add([pscustomobject][ordered]@{
        Position=$newPos;SlotID="$CartID-SIGN-OFF";Role='SIGN_OFF';AssetID=$s.AssetID;AssetType=$s.AssetType;AssetSubtype=$s.Subtype
        Title=$s.Title;Series='';Pool=$s.Pool;Network=$s.Network;SourcePath=$s.SourcePath;DurationSeconds=$s.DurationSeconds
        ReusePolicy=$s.ReusePolicy;ReviewStatus='UNREVIEWED';TrimStartSeconds=$resolved.TrimStartSeconds;TrimEndSeconds=$resolved.TrimEndSeconds
        CropLeft=$resolved.CropLeft;CropRight=$resolved.CropRight;CropTop=$resolved.CropTop;CropBottom=$resolved.CropBottom;AudioRepair=$resolved.AudioRepair
    })
    $changeRows.Add([pscustomobject]@{
        SlotID="$CartID-SIGN-OFF";ReplacementAssetID=$s.AssetID;TrimStart=$resolved.TrimStartSeconds;TrimEnd=$resolved.TrimEndSeconds
        CropLeft=$resolved.CropLeft;CropRight=$resolved.CropRight;CropTop=$resolved.CropTop;CropBottom=$resolved.CropBottom;AudioRepair=$resolved.AudioRepair;Action='ADD_SIGN_OFF';Notes='Configured handpicked sign-off with inherited approved repair recipe'
    })
}

# Verify the proposed manifest matches the exported review before writing anything.
$newBySlot=@{};foreach($nm in $newManifest){$newBySlot[$nm.SlotID]=$nm}
$oldBySlot=@{};foreach($om in $oldManifest){$oldBySlot[$om.SlotID]=$om}
$verifyErrors=New-Object System.Collections.ArrayList
$verifiedReplacementCount=0
$verifiedCropCount=0
$verifiedTrimCount=0
$verifiedAudioCount=0

function Almost-Equal([double]$a,[double]$b){return [math]::Abs($a-$b) -lt 0.0001}

foreach($c in $changeRows){
    if($c.Action -eq 'ADD_SIGN_OFF'){continue}
    $om=$oldBySlot[$c.SlotID]
    $nm=$newBySlot[$c.SlotID]
    if(-not $nm){
        [void]$verifyErrors.Add("$($c.SlotID): missing from proposed manifest")
        continue
    }

    if(-not [string]::IsNullOrWhiteSpace([string]$c.ReplacementAssetID)){
        if([string]$nm.AssetID -ne [string]$c.ReplacementAssetID){
            [void]$verifyErrors.Add("$($c.SlotID): replacement mismatch")
        }else{
            $ra=$registryById[[string]$c.ReplacementAssetID]
            $rr=Get-ReplacementRepairRecipe $ra
            if(-not $rr){
                [void]$verifyErrors.Add("$($c.SlotID): replacement repair recipe unavailable")
            }elseif(
                -not (Almost-Equal (To-DoubleOrZero $nm.TrimStartSeconds) (To-DoubleOrZero $rr.TrimStartSeconds)) -or
                -not (Almost-Equal (To-DoubleOrZero $nm.TrimEndSeconds) (To-DoubleOrZero $rr.TrimEndSeconds)) -or
                [int](To-DoubleOrZero $nm.CropLeft) -ne [int](To-DoubleOrZero $rr.CropLeft) -or
                [int](To-DoubleOrZero $nm.CropRight) -ne [int](To-DoubleOrZero $rr.CropRight) -or
                [int](To-DoubleOrZero $nm.CropTop) -ne [int](To-DoubleOrZero $rr.CropTop) -or
                [int](To-DoubleOrZero $nm.CropBottom) -ne [int](To-DoubleOrZero $rr.CropBottom) -or
                ([string]$nm.AudioRepair).ToUpperInvariant() -ne ([string]$rr.AudioRepair).ToUpperInvariant()
            ){
                [void]$verifyErrors.Add("$($c.SlotID): replacement repair recipe mismatch")
            }else{$verifiedReplacementCount++}
        }
        continue
    }

    $oldTrimStart=To-DoubleOrZero $om.TrimStartSeconds
    $oldTrimEnd=To-DoubleOrZero $om.TrimEndSeconds
    $addTrimStart=To-DoubleOrZero $c.TrimStart
    $addTrimEnd=To-DoubleOrZero $c.TrimEnd
    if($addTrimStart -gt 0 -or $addTrimEnd -gt 0){
        if(-not (Almost-Equal (To-DoubleOrZero $nm.TrimStartSeconds) ($oldTrimStart+$addTrimStart)) -or
           -not (Almost-Equal (To-DoubleOrZero $nm.TrimEndSeconds) ($oldTrimEnd+$addTrimEnd))){
            [void]$verifyErrors.Add("$($c.SlotID): trim mismatch")
        }else{$verifiedTrimCount++}
    }

    $oldL=[int](To-DoubleOrZero $om.CropLeft);$oldR=[int](To-DoubleOrZero $om.CropRight)
    $oldT=[int](To-DoubleOrZero $om.CropTop);$oldB=[int](To-DoubleOrZero $om.CropBottom)
    $addL=[int](To-DoubleOrZero $c.CropLeft);$addR=[int](To-DoubleOrZero $c.CropRight)
    $addT=[int](To-DoubleOrZero $c.CropTop);$addB=[int](To-DoubleOrZero $c.CropBottom)
    if(($addL+$addR+$addT+$addB) -gt 0){
        if([int](To-DoubleOrZero $nm.CropLeft) -ne ($oldL+$addL) -or
           [int](To-DoubleOrZero $nm.CropRight) -ne ($oldR+$addR) -or
           [int](To-DoubleOrZero $nm.CropTop) -ne ($oldT+$addT) -or
           [int](To-DoubleOrZero $nm.CropBottom) -ne ($oldB+$addB)){
            [void]$verifyErrors.Add("$($c.SlotID): crop mismatch")
        }else{$verifiedCropCount++}
    }

    if(([string]$c.AudioRepair).ToUpperInvariant() -eq 'AUTO'){
        $prior=([string]$om.AudioRepair).Trim().ToUpperInvariant()
        if([string]::IsNullOrWhiteSpace($prior)){$prior='NONE'}
        if($prior -eq 'LIGHT'){$prior='RESTORE'}
        $want=Get-NextAudioRepair $prior
        $got=([string]$nm.AudioRepair).Trim().ToUpperInvariant()
        if($got -eq 'LIGHT'){$got='RESTORE'}
        if($got -ne $want){
            [void]$verifyErrors.Add("$($c.SlotID): audio repair mismatch; expected $want, got $got")
        }else{$verifiedAudioCount++}
    }
}

if($verifyErrors.Count -gt 0){
    Write-Host ""
    Write-Host "PROPOSED REVISION FAILED INTERNAL VERIFICATION:" -ForegroundColor Red
    foreach($e in $verifyErrors){Write-Host "  - $e"}
    throw "No state was committed."
}

Write-Host ""
Write-Host "Review apply preflight passed:" -ForegroundColor Green
Write-Host "  Replacements verified: $verifiedReplacementCount"
Write-Host "  Crops verified:        $verifiedCropCount"
Write-Host "  Trims verified:        $verifiedTrimCount"
Write-Host "  Audio repairs verified:$verifiedAudioCount"
Write-Host "  Proposed revision:     $revName"

if($PreflightOnly){
    Write-Host ""
    Write-Host "PREVIEW ONLY -- NO STATE CHANGED." -ForegroundColor Cyan
    exit 0
}

# Commit staged source-health changes only after preflight succeeds.
$changedRegistry=$false
foreach($assetId in $pendingSourceStatus.Keys){
    $a=$registryById[$assetId]
    if($a){
        $a.SourceStatus=$pendingSourceStatus[$assetId]
        if($pendingSourceNotes.ContainsKey($assetId)){$a.UserNotes=$pendingSourceNotes[$assetId]}
        $changedRegistry=$true
    }
}

[void][IO.Directory]::CreateDirectory($newRevDir)
$newManifestPath=Join-Path $newRevDir 'cart-manifest.csv'
Export-Utf8Csv $newManifest $newManifestPath

# Close old live reservations and create a complete new revision assignment snapshot.
$now=[DateTime]::UtcNow.ToString('o')
foreach($a in $assignments){
    if($a.CartID -eq $CartID -and [int]$a.Revision -eq $oldRev -and $a.AssignmentStatus -in @('RESERVED','ACTIVE')){
        $newSlot=@($newManifest|Where-Object{$_.SlotID -eq $a.SlotID}|Select-Object -First 1)
        if($newSlot.Count -gt 0 -and $newSlot[0].AssetID -eq $a.AssetID){
            $a.AssignmentStatus='SUPERSEDED'
            $a.ReleaseReason="Carried forward to $revName"
        }else{
            $a.AssignmentStatus='RELEASED'
            $rv=$reviewBySlot[$a.SlotID]
            $a.ReleaseReason=$(if($rv){$rv.Action}else{"Replaced in $revName"})
        }
        $a.ReleasedUtc=$now
    }
}
$combined=New-Object 'System.Collections.Generic.List[object]';foreach($a in $assignments){$combined.Add($a)}
foreach($m in $newManifest){
    $combined.Add([pscustomobject][ordered]@{
        AssignmentID=(Get-StableId 'ASG' "$CartID|$newRev|$($m.SlotID)|$($m.AssetID)")
        CartID=$CartID;Revision=$newRev;SlotID=$m.SlotID;AssetID=$m.AssetID;AssignmentStatus='RESERVED';AssignedUtc=$now;ReleasedUtc='';ReleaseReason=''
    })
}
Export-Utf8Csv $combined $settings.AssignmentPath

$newCarts=New-Object 'System.Collections.Generic.List[object]'
foreach($c in $carts){
    if($c.CartID -eq $CartID){
        $newCarts.Add([pscustomobject][ordered]@{
            CartID=$c.CartID;CurrentRevision=$newRev;Status='DRAFT';Network=$c.Network;DisplayName=$c.DisplayName
            CreatedUtc=$c.CreatedUtc;UpdatedUtc=$now;ManifestPath=$newManifestPath
        })
    }else{$newCarts.Add($c)}
}
Export-Utf8Csv $newCarts $settings.CartRegistryPath

$appliedPath=Join-Path $newRevDir 'changes-from-review.csv'
Export-Utf8Csv $changeRows $appliedPath

if($changedRegistry){
    Export-Utf8Csv $registry $settings.RegistryPath
}

Write-Host ""
Write-Host "Created $CartID $revName."
if($LeanBreaks){ Write-Host "Lean breaks applied: removed NEXT, BUMPER_OUT, STING, and extra ads beyond AD-01." }
if($signOffPending){ Write-Host "Configured SIGN_OFF appended to the end of the cart." }
Write-Host "Manifest: $newManifestPath"
Write-Host "Changes:  $appliedPath"
Write-Host ("Verified: {0} replacements, {1} crops, {2} trims, {3} audio repairs." -f $verifiedReplacementCount,$verifiedCropCount,$verifiedTrimCount,$verifiedAudioCount)
Write-Host "Good UNIQUE assets that were replaced are RELEASED back to the pool."
Write-Host "BAD / DUPLICATE / NEEDS_CLIPPED / NEEDS_CROP sources remain excluded from future automatic builds."
Write-Host ""
Write-Host "Next:"
Write-Host "  .\Build-RetroCartReview.ps1 -CartID $CartID"
Write-Host "Only changed/retrimmed clips need new proxies; unchanged clips are reused from cache."
