# Retro TV -- build offline HTML branding review gallery with incremental thumbnails.
# Compatible with Windows PowerShell 5.1 and PowerShell 7+.
[CmdletBinding()]
param(
    [string]$Root = 'F:\[VIDEOS]\Commercials',
    [string]$ScanCsv = '',
    [string]$FFmpeg = 'ffmpeg',
    [int]$MaxNewThumbnails = 250,
    [string[]]$Networks = @('NICK', 'SNICK', 'CN', 'KWB', 'FOX'),
    [switch]$NoThumbnails
)
$ErrorActionPreference = 'Stop'
$Root = (Get-Item -LiteralPath $Root -ErrorAction Stop).FullName.TrimEnd([char]'\')
$reviewDir = "$Root\_BRANDING_REVIEW"
$thumbDir = "$reviewDir\thumbs"
if (-not $ScanCsv) { $ScanCsv = "$reviewDir\branding-media-scan.csv" }
if (-not (Test-Path -LiteralPath $ScanCsv -PathType Leaf)) {
    throw "Scan CSV not found: $ScanCsv`nRun .\Scan-RetroBranding.ps1 first."
}
[void][IO.Directory]::CreateDirectory($reviewDir)
[void][IO.Directory]::CreateDirectory($thumbDir)
$rows = @(Import-Csv -LiteralPath $ScanCsv | Where-Object { $_.Id -and $_.RootRelativePath })
if ($rows.Count -eq 0) { throw 'The branding-media-scan.csv is empty.' }

# The HTML includes ALL scan rows. The thumbnail pass is deliberately selective and incremental.
# Each re-run makes up to MaxNewThumbnails more images; old thumbnails are retained.
$canThumb = -not $NoThumbnails -and $MaxNewThumbnails -gt 0
if ($canThumb -and -not (Get-Command $FFmpeg -ErrorAction SilentlyContinue)) {
    Write-Warning 'ffmpeg not found. Building gallery without new thumbnails.'
    $canThumb = $false
}
$focus = @($rows | Where-Object {
    $_.IsBrandingCandidate -eq 'True' -and $_.Missing -ne 'True' -and ($Networks -contains $_.NetworkGuess)
} | Sort-Object @{Expression={
    switch ($_.TypeGuess) {
        'BUMPER_OUT' { 0 } 'BUMPER_IN' { 1 } 'IDENT' { 2 }
        'NEXT' { 3 } 'BUMPER_GENERIC' { 4 } 'PROMO' { 5 }
        'INTRO' { 6 } default { 7 }
    }
}}, NetworkGuess, FileName)
$created = 0; $failed = 0
if ($canThumb) {
    foreach ($r in $focus) {
        if ($created -ge $MaxNewThumbnails) { break }
        $destination = "$thumbDir\$($r.Id).jpg"
        if (Test-Path -LiteralPath $destination -PathType Leaf) { continue }
        $source = "$Root\$($r.RootRelativePath)"
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $sec = 0.0
        $parsed = [double]::TryParse([string]$r.DurationSeconds, [System.Globalization.NumberStyles]::Float, [cultureinfo]::InvariantCulture, [ref]$sec)
        $seek = if ($parsed -and $sec -gt 0) { [math]::Min([math]::Max($sec*0.33, 0.1), 8.0) } else { 0.5 }
        $seekString = $seek.ToString('0.###',[cultureinfo]::InvariantCulture)
        try {
            & $FFmpeg -hide_banner -loglevel error -nostdin -y -ss $seekString -i $source -frames:v 1 -vf 'scale=320:-2' -q:v 5 $destination 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $destination)) { throw "ffmpeg returned $LASTEXITCODE" }
            $created++
        } catch {
            $failed++
            if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
        }
        if (($created + $failed) % 25 -eq 0) {
            Write-Progress -Activity 'Creating branding review thumbnails' -Status "New: $created / $MaxNewThumbnails | failures: $failed" -PercentComplete ([math]::Min(100,($created/[math]::Max(1,$MaxNewThumbnails))*100))
        }
    }
}
Write-Progress -Activity 'Creating branding review thumbnails' -Completed

# Keep the client payload lean; metadata needed for review/export only.
$items = @($rows | ForEach-Object {
    [pscustomobject]@{
        id=$_.Id; path=$_.RootRelativePath; name=$_.FileName; source=$_.SourceCollection
        network=$_.NetworkGuess; type=$_.TypeGuess
        candidate=($_.IsBrandingCandidate -eq 'True'); year=$_.YearGuess
        bytes=$_.Bytes; duration=$_.DurationSeconds; codec=$_.VideoCodec
        width=$_.Width; height=$_.Height; error=$_.ProbeError; missing=($_.Missing -eq 'True')
        thumb=('thumbs/' + $_.Id + '.jpg')
    }
})
# Avoid ending an inline <script> if an archival filename happens to contain HTML-like text.
$json = ConvertTo-Json -InputObject $items -Depth 5 -Compress
$json = $json.Replace('<', '\u003c')
$template = @'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Retro TV · Branding Review</title>
<style>
:root {color-scheme:dark;--bg:#101315;--panel:#1b2125;--muted:#acb7bc;--edge:#37434a;--accent:#6ccebf;--foreground:#f1f5f5}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;color:var(--foreground);background:var(--bg)}
[hidden]{display:none!important}
header{position:sticky;top:0;z-index:50;background:rgba(20,26,29,.98);padding:14px max(14px,2vw);border-bottom:1px solid var(--edge)}
h1{font-size:23px;letter-spacing:-.025em;margin:0 0 4px}
p{margin:0 0 12px;color:var(--muted);font-size:13px}
.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
button,input,select{border:1px solid #53636b;border-radius:6px;background:#20282c;color:inherit;padding:8px 9px;min-width:0;font:inherit;font-size:13px}
button{cursor:pointer}button:hover{border-color:var(--accent)}
button.primary{background:#1c514c;border-color:#438b80}
input[type=checkbox]{accent-color:var(--accent)}
#search{flex:2;min-width:180px}
.smallcontrol{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px}
.toolbar{margin-top:8px}.toolbar button{font-size:12px}
#stats{font-size:12px;margin-top:8px;color:var(--accent)}
#warning{color:#f6d48b;font-size:12px;margin-top:6px}
main{padding:16px max(14px,2vw);display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--edge);border-radius:10px;overflow:hidden;min-width:0}
.poster{display:block;width:100%;height:172px;object-fit:contain;background:#080b0d}
.posterFallback{width:100%;height:172px;display:flex;align-items:center;justify-content:center;background:#15191c;color:#7b888d;font-size:13px}
.cardBody{padding:11px}.name{font-size:14px;font-weight:650;word-break:break-word;min-height:35px}
.meta{color:var(--muted);font-size:12px;margin-top:5px;line-height:1.5}.path{font-size:11px;color:#84969f;overflow-wrap:anywhere;margin-top:6px}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.fields label{font-size:11px;color:#aebcc2;display:flex;flex-direction:column;gap:4px}
.fields select{width:100%}.fields .wide{grid-column:span 2}
.actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.actions button{flex:1}
.notes{width:100%;margin-top:8px}.preview{width:100%;max-height:220px;background:#050505;margin-top:8px}
a{color:var(--accent)}.hint{color:#f2c778}.error{color:#ffb6b6}
footer{display:flex;justify-content:center;align-items:center;gap:12px;padding:20px}
#pager{font-size:13px;color:var(--muted)}
@media(max-width:660px){header{position:static}main{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
<h1>📺 Retro TV — Branding Review</h1>
<p>Originals stay untouched. Network/type are guesses until you review. Use Export CSV as a durable backup.</p>
<div class="controls">
<input id="search" placeholder="Search filename, path, notes…">
<select id="networkFilter" aria-label="Filter by network"></select>
<select id="typeFilter" aria-label="Filter by type"></select>
<select id="statusFilter" aria-label="Filter by status">
<option value="">All statuses</option><option>UNREVIEWED</option><option>KEEP</option><option>MAYBE</option>
<option>NEEDS_CLIPPED</option><option>SKIP</option>
</select>
<select id="yearFilter" aria-label="Filter by guessed year"><option value="">All years</option></select>
<label class="smallcontrol"><input type="checkbox" id="likelyOnly" checked> Likely branding only</label>
<label class="smallcontrol"><input type="checkbox" id="usOnly" checked> USA only</label>
</div>
<div class="controls toolbar">
<button class="primary" id="exportCsv">Export curation CSV</button>
<button id="importCsv">Import curation CSV</button><input type="file" accept=".csv,text/csv" id="importInput" style="display:none">
<button id="clearData">Clear browser review data</button>
<span id="stats"></span>
</div>
<div id="warning"></div>
</header>
<main id="grid"></main>
<footer><button id="prev">← Previous</button><span id="pager"></span><button id="next">Next →</button></footer>
<script>
'use strict';
const ITEMS = __ITEMS_JSON__;
const STORAGE_KEY = 'retro_tv_branding_review_v1';
const NETS = ['NICK','SNICK','CN','KWB','FOX','BOOM','POWER','SCIFI','UPN','HBO','AMC','TOONAMI','ADULT_SWIM','MTV','NICK_GAS','DISNEY','ABC','CBS','NBC','PBS','FOX_NETWORK','OTHER_US','NON_US','UNKNOWN'];
const TYPES = ['IDENT','BUMPER_OUT','BUMPER_IN','NEXT','PROMO','INTRO','SIGN_OFF','TRANSITION','BUMPER_GENERIC','AD','MUSIC_VIDEO','OTHER'];
const STATUSES = ['UNREVIEWED','KEEP','MAYBE','NEEDS_CLIPPED','SKIP'];
const PAGE_SIZE = 48;
const BY_ID = new Map(ITEMS.map(x=>[x.id,x]));
let saved={}; let storageOK=true; let page=0; let filtered=[];
try { saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}; } catch(e) { storageOK=false; saved={}; }
const el = id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Escape path SEGMENTS: #, %, ?, brackets, Unicode, and spaces must not break file:// URLs.
function localURL(p) { return '../' + String(p).split(/[\\/]/).map(encodeURIComponent).join('/'); }
function getState(item) { return saved[item.id]||{}; }
function value(item,field) { const s=getState(item); return field==='status'?(s.status||'UNREVIEWED'):(s[field]??item[field]); }
function write(item,field,v) {
 const s={...getState(item)};s[field]=v;saved[item.id]=s; persist();
}
function persist() {
 try { localStorage.setItem(STORAGE_KEY,JSON.stringify(saved)); storageOK=true; } catch(e) { storageOK=false; }
 showWarning(); updateStats();
}
function showWarning(extra='') {
 el('warning').textContent = (storageOK?'':'Browser storage is unavailable/full: EXPORT YOUR CURATION CSV before closing. ') + extra;
}
function options(values,v) {return values.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(x)}</option>`).join('');}
function updateFilters(){
 const networks=[...new Set(ITEMS.map(x=>x.network))].sort();
 const allNetworks=[...new Set([...NETS,...networks])];
 el('networkFilter').innerHTML='<option value="">All networks</option>'+options(allNetworks,'');
 el('typeFilter').innerHTML='<option value="">All types</option>'+options([...new Set([...TYPES,...ITEMS.map(x=>x.type)])],'');
 const years=[...new Set(ITEMS.map(x=>x.year).filter(Boolean))].sort();
 el('yearFilter').innerHTML='<option value="">All years</option>'+years.map(y=>`<option>${esc(y)}</option>`).join('');
}
function updateStats(){
 const counts={};for(const item of ITEMS){const s=value(item,'status');counts[s]=(counts[s]||0)+1;}
 const reviewed=ITEMS.length-(counts.UNREVIEWED||0);
 el('stats').textContent=`${reviewed.toLocaleString()}/${ITEMS.length.toLocaleString()} reviewed · KEEP ${counts.KEEP||0} · MAYBE ${counts.MAYBE||0} · CLIP ${counts.NEEDS_CLIPPED||0} · SKIP ${counts.SKIP||0}`;
}
function pickFiltered(){
 const q=el('search').value.toLowerCase().trim(),net=el('networkFilter').value,
 typ=el('typeFilter').value,sta=el('statusFilter').value,yr=el('yearFilter').value,
 likely=el('likelyOnly').checked,usa=el('usOnly').checked;
 filtered=ITEMS.filter(item=>{
  const n=value(item,'network'),t=value(item,'type'),s=value(item,'status');
  if(likely && !item.candidate) return false;
  if(usa && n==='NON_US') return false;
  if(net && n!==net) return false;
  if(typ && t!==typ) return false;
  if(sta && s!==sta) return false;
  if(yr && String(item.year)!==yr) return false;
  if(q && !`${item.name} ${item.path} ${getState(item).notes||''} ${n} ${t}`.toLowerCase().includes(q))return false;
  return true;
 });
}
function updatePager(){
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 page=Math.min(page,pages-1);el('pager').textContent=`Page ${page+1}/${pages} · ${filtered.length.toLocaleString()} matches`;
 el('prev').disabled=page===0;el('next').disabled=page>=pages-1;
}
function render(){
 pickFiltered();updatePager();const grid=el('grid');grid.replaceChildren();
 const items=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 const frag=document.createDocumentFragment();
 for(const item of items){
  const state=getState(item),network=value(item,'network'),type=value(item,'type'),status=value(item,'status');
  const card=document.createElement('article');card.className='card';
  const dur=item.duration?`${Number(item.duration).toFixed(1)}s`:'duration unknown';
  const dims=item.width?`${item.width}×${item.height}`:'resolution unknown';
  const videopath=localURL(item.path);
  card.innerHTML=`
   <img class="poster" loading="lazy" src="${esc('thumbs/'+item.id+'.jpg')}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
   <div class="posterFallback" hidden>No thumbnail yet · Preview still works</div>
   <div class="cardBody">
    <div class="name">${esc(item.name)}</div>
    <div class="meta">${esc(network)} · ${esc(type)} · ${esc(item.year||'year unknown')}<br>${esc(dur)} · ${esc(dims)} · ${esc(item.codec||'codec unknown')} · ${esc(item.source)}</div>
    <div class="fields">
      <label>Network<select class="networkField">${options([...new Set([...NETS,network])],network)}</select></label>
      <label>Type<select class="typeField">${options([...new Set([...TYPES,type])],type)}</select></label>
      <label class="wide">Review status<select class="statusField">${options(STATUSES,status)}</select></label>
    </div>
    <input class="notes" placeholder="Notes (era, show, quality, anything useful)…" value="${esc(state.notes||'')}">
    <div class="actions"><button class="keep">Keep</button><button class="skip">Skip</button><button class="previewBtn">▶ Preview</button></div>
    <div class="videoSlot"></div>
    <div class="path">${esc(item.path)} · <a href="${esc(videopath)}" target="_blank" rel="noopener">Open original</a></div>
    ${item.error?`<div class="error">Scan: ${esc(item.error)}</div>`:''}
  </div>`;
  const statusField=card.querySelector('.statusField');
  card.querySelector('.networkField').addEventListener('change',e=>write(item,'network',e.target.value));
  card.querySelector('.typeField').addEventListener('change',e=>write(item,'type',e.target.value));
  statusField.addEventListener('change',e=>write(item,'status',e.target.value));
  card.querySelector('.notes').addEventListener('change',e=>write(item,'notes',e.target.value));
  card.querySelector('.keep').addEventListener('click',()=>{statusField.value='KEEP';write(item,'status','KEEP')});
  card.querySelector('.skip').addEventListener('click',()=>{statusField.value='SKIP';write(item,'status','SKIP')});
  const previewBtn=card.querySelector('.previewBtn'),slot=card.querySelector('.videoSlot');
  previewBtn.addEventListener('click',()=>{
    if(slot.childNodes.length){slot.replaceChildren();previewBtn.textContent='▶ Preview';return;}
    for(const v of document.querySelectorAll('video'))v.pause();
    const v=document.createElement('video');v.className='preview';v.controls=true;v.preload='metadata';v.src=videopath;
    slot.appendChild(v);previewBtn.textContent='Close preview';v.play().catch(()=>{});
  });
  frag.appendChild(card);
 }
 grid.appendChild(frag);
}
function quoteCsv(v) {return '"'+String(v??'').replace(/"/g,'""')+'"';}
function exportCsv(){
 const header=['Id','Status','Network','Type','Notes','YearGuess','SourceCollection','FileName','RootRelativePath','DurationSeconds','VideoCodec','Width','Height','IsBrandingCandidate','Missing','ProbeError'];
 const lines=[header.map(quoteCsv).join(',')];
 for(const item of ITEMS){ const st=getState(item);
  lines.push([item.id,value(item,'status'),value(item,'network'),value(item,'type'),st.notes||'',item.year,item.source,item.name,item.path,item.duration,item.codec,item.width,item.height,item.candidate,item.missing,item.error].map(quoteCsv).join(','));
 }
 const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='branding-curation.csv';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function parseCsv(text){
 // Minimal RFC4180-style parser: handles UTF-8 BOM, commas, quotes, and embedded line breaks.
 text=text.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(cell!==''||row.length){row.push(cell);rows.push(row)}return rows;
}
function importCsvFile(file){
 if(!file)return;
 const reader=new FileReader();reader.onload=()=>{
  try{
   const rows=parseCsv(String(reader.result||''));const header=rows.shift();
   if(!header||!['Id','Status','Network','Type'].every(x=>header.includes(x)))throw Error('Not a branding curation CSV (Id/Status/Network/Type columns required).');
   const idx=x=>header.indexOf(x);const updates={};let matched=0,unknown=0;
   for(const r of rows){const id=r[idx('Id')],item=BY_ID.get(id);if(!item){unknown++;continue;}
    const status=r[idx('Status')],net=r[idx('Network')],type=r[idx('Type')],notes=idx('Notes')>=0?r[idx('Notes')]:'';
    if(!STATUSES.includes(status)||!net||!type)continue;
    updates[id]={status,network:net,type,notes:notes||''};matched++;
   }
   if(matched===0)throw Error('No matching IDs. Check that this CSV belongs to this branding archive.');
   if(!confirm(`Import ${matched} matching selections? This replaces your current selections for those clips. (${unknown} unmatched rows ignored.)`))return;
   Object.assign(saved,updates);persist();page=0;render();showWarning(`Imported ${matched} records. Export again when finished.`);
  }catch(err){alert(`Import failed: ${err.message}`);}
 };reader.readAsText(file,'UTF-8');
}
updateFilters();showWarning();updateStats();render();
for(const id of ['networkFilter','typeFilter','statusFilter','yearFilter','likelyOnly','usOnly']){
 el(id).addEventListener('change',()=>{page=0;render()});
}
el('search').addEventListener('input',()=>{page=0;render()});
el('prev').addEventListener('click',()=>{page--;render();window.scrollTo(0,0)});
el('next').addEventListener('click',()=>{page++;render();window.scrollTo(0,0)});
el('exportCsv').addEventListener('click',exportCsv);
el('importCsv').addEventListener('click',()=>el('importInput').click());
el('importInput').addEventListener('change',e=>{importCsvFile(e.target.files[0]);e.target.value='';});
el('clearData').addEventListener('click',()=>{
 if(!confirm('Clear ALL branding reviews saved in this browser? Export your CSV first.'))return;
 saved={};persist();render();
});
</script>
</body>
</html>
'@
$html = $template.Replace('__ITEMS_JSON__', $json)
$out = "$reviewDir\branding-review.html"
Set-Content -LiteralPath $out -Value $html -Encoding UTF8
Write-Host "Gallery: $out"
Write-Host "Items: $($items.Count) | new thumbnails: $created | thumb failures: $failed"
Write-Host "Focused thumbnail networks: $($Networks -join ', ')"
Write-Host 'Re-run this script for the next thumbnail batch, or add -Networks TOONAMI,ADULT_SWIM,MTV for future channels.'
Write-Host 'Review state is separate from commercial reviews. Export curation CSV frequently.'
