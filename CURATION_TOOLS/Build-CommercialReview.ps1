param(
    [string]$Root = 'F:\[VIDEOS]\Commercials',
    [string]$ScanCsv = '',
    [string]$FFmpegPath = 'ffmpeg'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Root)) {
    throw "Commercial root not found: $Root"
}

if ([string]::IsNullOrWhiteSpace($ScanCsv)) {
    $ScanCsv = Join-Path $Root 'commercial-media-scan.csv'
}

if (-not (Test-Path -LiteralPath $ScanCsv)) {
    throw "Scan CSV not found: $ScanCsv"
}

try {
    & $FFmpegPath -version *> $null
} catch {
    throw "ffmpeg was not found. Install FFmpeg or pass -FFmpegPath with the full path to ffmpeg.exe."
}

$reviewDir = Join-Path $Root '_REVIEW'
$thumbDir  = Join-Path $reviewDir 'thumbs'
New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
New-Item -ItemType Directory -Force -Path $thumbDir | Out-Null

$rows = Import-Csv -LiteralPath $ScanCsv

# One preferred media file per logical asset, scoped to its original source pack.
$logical = $rows |
    Group-Object SourcePack, DuplicateKey |
    ForEach-Object {
        $_.Group |
            Sort-Object `
                @{ Expression = { if ($_.ProbeError) { 1 } else { 0 } } }, `
                @{ Expression = { if ($_.PreferredRepresentation -eq 'True') { 0 } else { 1 } } }, `
                @{ Expression = { if ($_.Extension -eq '.mp4') { 0 } else { 1 } } }, `
                @{ Expression = { if ($_.FileName -like '*.ia.mp4') { 1 } else { 0 } } }, `
                @{ Expression = { [double]$_.SizeBytes } } |
            Select-Object -First 1
    } |
    Sort-Object SourcePack, FileName

Write-Host "Logical assets selected: $($logical.Count)"
Write-Host "Generating review thumbnails. Existing thumbnails will be reused."

$items = @()
for ($i = 0; $i -lt $logical.Count; $i++) {
    $row = $logical[$i]
    $n = $i + 1
    $thumbName = ('thumb_{0:D4}.jpg' -f $n)
    $thumbPath = Join-Path $thumbDir $thumbName

    $duration = 0.0
    [double]::TryParse([string]$row.DurationSeconds, [ref]$duration) | Out-Null

    if (-not (Test-Path -LiteralPath $thumbPath)) {
        $seek = 1.0
        if ($duration -gt 0) {
            $seek = [math]::Min([math]::Max($duration * 0.35, 0.5), 10.0)
        }

        Write-Progress `
            -Activity "Building commercial review gallery" `
            -Status "$n / $($logical.Count): $($row.FileName)" `
            -PercentComplete (($n / [math]::Max($logical.Count,1)) * 100)

        try {
            & $FFmpegPath -hide_banner -loglevel error -y `
                -ss $seek `
                -i $row.FullName `
                -frames:v 1 `
                -vf "scale=320:-2" `
                -q:v 4 `
                -- `
                $thumbPath

            if ($LASTEXITCODE -ne 0) {
                throw "ffmpeg returned exit code $LASTEXITCODE"
            }
        } catch {
            # Leave the thumbnail missing; the HTML will show a placeholder.
        }
    }

    $relativeVideo = '../' + (($row.RelativePath -replace '\\','/'))
    $year = $row.YearFromName
    $suggestion = 'UNREVIEWED'

    if ($row.SourcePack -eq 'Collectionof90sCommercials') {
        $suggestion = 'KIDS_90S'
    }
    elseif ($row.SourcePack -like '*LateNight*') {
        $suggestion = 'SOURCE_ONLY'
    }
    elseif ($row.SourcePack -eq 'ThatGuyWithTheVHS') {
        $suggestion = 'SOURCE_ONLY'
    }
    elseif ($row.LikelyRole -eq 'BUMPER_IDENT_CANDIDATE') {
        $suggestion = 'IDENT_OR_BUMPER'
    }
    elseif ($row.FileName -match '(?i)\bPSA\b|public service') {
        $suggestion = 'PSA'
    }
    elseif ($row.FileName -match '(?i)bumper|ident|station id') {
        $suggestion = 'IDENT_OR_BUMPER'
    }
    elseif ($row.FileName -match '(?i)promo|preview|coming up|tonight on|next on') {
        $suggestion = 'PROMO'
    }
    elseif ($year -match '^\d{4}$') {
        $yi = [int]$year
        if ($yi -ge 1994 -and $yi -le 1999) { $suggestion = 'GENERAL_90S' }
        elseif ($yi -ge 2000 -and $yi -le 2002) { $suggestion = 'GENERAL_00S' }
    }

    $items += [pscustomobject]@{
        id         = $n
        sourcePack = $row.SourcePack
        fileName   = $row.FileName
        relativePath = $row.RelativePath
        video      = $relativeVideo
        thumb      = "thumbs/$thumbName"
        duration   = if ($duration -gt 0) { [math]::Round($duration, 2) } else { $null }
        year       = $year
        role       = $row.LikelyRole
        codec      = $row.VideoCodec
        width      = $row.Width
        height     = $row.Height
        suggestion = $suggestion
        probeError = $row.ProbeError
    }
}

Write-Progress -Activity "Building commercial review gallery" -Completed

$json = $items | ConvertTo-Json -Depth 4 -Compress

$html = @"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Retro TV Commercial Review</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { color-scheme: dark; }
body { font-family: system-ui, sans-serif; margin: 0; background: #111; color: #eee; }
header { position: sticky; top: 0; z-index: 10; background: #181818; padding: 14px 18px; border-bottom: 1px solid #333; }
h1 { margin: 0 0 8px; font-size: 22px; }
.controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
input, select, button { background:#222; color:#eee; border:1px solid #555; padding:7px 9px; border-radius:5px; }
button { cursor:pointer; }
#stats { margin-top:8px; color:#bbb; font-size:13px; }
main { padding:16px; display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:12px; }
.card { border:1px solid #333; background:#181818; border-radius:8px; overflow:hidden; }
.thumb { width:100%; height:180px; object-fit:contain; background:#000; display:block; }
.body { padding:10px; }
.name { font-weight:700; overflow-wrap:anywhere; margin-bottom:6px; }
.meta { font-size:12px; color:#aaa; margin-bottom:8px; }
.row { display:flex; gap:6px; margin-top:7px; align-items:center; }
.row select { flex:1; min-width:0; }
.notes { width:100%; box-sizing:border-box; margin-top:7px; }
.preview { width:100%; max-height:210px; margin-top:8px; background:#000; }
.hidden { display:none !important; }
.suggestion { color:#d6c36a; }
.small { font-size:11px; color:#888; }
a { color:#9dc7ff; }
</style>
</head>
<body>
<header>
  <h1>Retro TV Commercial Review</h1>
  <div class="controls">
    <input id="search" placeholder="Search filename / source…" size="28">
    <select id="packFilter"><option value="">All source packs</option></select>
    <select id="roleFilter"><option value="">All durations/roles</option></select>
    <select id="statusFilter"><option value="">All review statuses</option><option>UNREVIEWED</option><option>REVIEWED</option></select>
    <button id="applySuggestions">Apply suggestions to unreviewed</button>
    <button id="exportCsv">Export curation CSV</button>
    <button id="clearData">Clear saved review</button>
  </div>
  <div id="stats"></div>
</header>
<main id="grid"></main>

<script>
const ITEMS = $json;

const CATEGORIES = [
  "UNREVIEWED",
  "KIDS_90S",
  "KIDS_00S",
  "GENERAL_90S",
  "GENERAL_00S",
  "LATE_NIGHT",
  "PSA",
  "IDENT",
  "BUMPER",
  "PROMO",
  "SOURCE_ONLY",
  "SKIP"
];

const STORAGE_KEY = "retro_tv_commercial_review_v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch(e) { saved = {}; }

const grid = document.getElementById("grid");
const search = document.getElementById("search");
const packFilter = document.getElementById("packFilter");
const roleFilter = document.getElementById("roleFilter");
const statusFilter = document.getElementById("statusFilter");
const stats = document.getElementById("stats");

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  updateStats();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function stateFor(item) {
  if (!saved[item.id]) saved[item.id] = { category:"UNREVIEWED", notes:"" };
  return saved[item.id];
}

function makeOptions(selected) {
  return CATEGORIES.map(c => `<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join("");
}

function render() {
  const q = search.value.trim().toLowerCase();
  const pack = packFilter.value;
  const role = roleFilter.value;
  const sf = statusFilter.value;

  grid.innerHTML = "";
  let shown = 0;

  for (const item of ITEMS) {
    const st = stateFor(item);
    const reviewed = st.category !== "UNREVIEWED";
    const hay = `${item.fileName} ${item.relativePath} ${item.sourcePack} ${item.year || ''}`.toLowerCase();

    if (q && !hay.includes(q)) continue;
    if (pack && item.sourcePack !== pack) continue;
    if (role && item.role !== role) continue;
    if (sf === "UNREVIEWED" && reviewed) continue;
    if (sf === "REVIEWED" && !reviewed) continue;

    shown++;
    const card = document.createElement("article");
    card.className = "card";

    const dur = item.duration == null ? "?" : `${item.duration}s`;
    const dimensions = item.width ? `${item.width}×${item.height}` : "?";
    const thumbFallback = `this.style.display='none';this.nextElementSibling.style.display='block'`;

    card.innerHTML = `
      <img class="thumb" src="${encodeURI(item.thumb)}" onerror="${thumbFallback}">
      <div class="thumb hidden" style="display:none;padding:70px 10px;text-align:center;box-sizing:border-box;">No thumbnail</div>
      <div class="body">
        <div class="name">${esc(item.fileName)}</div>
        <div class="meta">
          ${esc(item.sourcePack)} · ${dur} · ${dimensions} · ${esc(item.codec || "?")}<br>
          Role: ${esc(item.role || "?")}
          ${item.year ? ` · Year: ${esc(item.year)}` : ""}
          <br><span class="suggestion">Suggested: ${esc(item.suggestion)}</span>
        </div>
        <div class="row">
          <select class="category">${makeOptions(st.category)}</select>
          <button class="previewBtn">Preview</button>
        </div>
        <input class="notes" placeholder="Notes / brand / network / year…" value="${esc(st.notes)}">
        <div class="videoSlot"></div>
        <div class="small" style="margin-top:7px">${esc(item.relativePath)}</div>
      </div>`;

    const cat = card.querySelector(".category");
    const notes = card.querySelector(".notes");
    cat.addEventListener("change", () => {
      stateFor(item).category = cat.value;
      save();
    });
    notes.addEventListener("change", () => {
      stateFor(item).notes = notes.value;
      save();
    });

    card.querySelector(".previewBtn").addEventListener("click", (ev) => {
      const slot = card.querySelector(".videoSlot");
      if (slot.innerHTML) {
        slot.innerHTML = "";
        ev.target.textContent = "Preview";
      } else {
        const v = document.createElement("video");
        v.className = "preview";
        v.controls = true;
        v.preload = "metadata";
        v.src = encodeURI(item.video);
        slot.appendChild(v);
        ev.target.textContent = "Close";
        v.play().catch(()=>{});
      }
    });

    grid.appendChild(card);
  }

  stats.textContent = `${shown} shown / ${ITEMS.length} logical assets`;
}

function updateStats() {
  let reviewed = 0;
  const counts = {};
  for (const item of ITEMS) {
    const st = stateFor(item);
    if (st.category !== "UNREVIEWED") reviewed++;
    counts[st.category] = (counts[st.category] || 0) + 1;
  }
  const important = Object.entries(counts)
    .filter(([k,v]) => k !== "UNREVIEWED" && v)
    .map(([k,v]) => `${k}: ${v}`)
    .join(" · ");
  stats.textContent = `${reviewed}/${ITEMS.length} reviewed` + (important ? ` · ${important}` : "");
}

function populateFilters() {
  [...new Set(ITEMS.map(x => x.sourcePack))].sort().forEach(v => {
    const o = document.createElement("option"); o.value=v; o.textContent=v; packFilter.appendChild(o);
  });
  [...new Set(ITEMS.map(x => x.role))].sort().forEach(v => {
    const o = document.createElement("option"); o.value=v; o.textContent=v; roleFilter.appendChild(o);
  });
}

document.getElementById("applySuggestions").addEventListener("click", () => {
  if (!confirm("Apply automatic suggestions to every currently UNREVIEWED item? You can still change them afterward.")) return;
  for (const item of ITEMS) {
    const st = stateFor(item);
    if (st.category !== "UNREVIEWED") continue;
    let s = item.suggestion;
    if (s === "IDENT_OR_BUMPER") s = "BUMPER";
    if (CATEGORIES.includes(s)) st.category = s;
  }
  save();
  render();
});

document.getElementById("exportCsv").addEventListener("click", () => {
  const header = [
    "ID","Category","Notes","Suggestion","SourcePack","FileName","RelativePath",
    "DurationSeconds","Year","LikelyRole","Codec","Width","Height"
  ];
  const quote = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const lines = [header.map(quote).join(",")];

  for (const item of ITEMS) {
    const st = stateFor(item);
    lines.push([
      item.id, st.category, st.notes, item.suggestion, item.sourcePack,
      item.fileName, item.relativePath, item.duration, item.year,
      item.role, item.codec, item.width, item.height
    ].map(quote).join(","));
  }

  const blob = new Blob([lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "commercial-curation.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

document.getElementById("clearData").addEventListener("click", () => {
  if (!confirm("Clear all saved review categories and notes in this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  saved = {};
  render();
  updateStats();
});

[search, packFilter, roleFilter, statusFilter].forEach(el => {
  el.addEventListener(el.tagName === "INPUT" ? "input" : "change", render);
});

populateFilters();
render();
updateStats();
</script>
</body>
</html>
"@

$htmlPath = Join-Path $reviewDir 'commercial-review.html'
Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8

Write-Host ""
Write-Host "Review gallery created:"
Write-Host "  $htmlPath"
Write-Host ""
Write-Host "Open commercial-review.html in your browser."
Write-Host "Your choices are saved in the browser automatically."
Write-Host "When finished (or whenever you want), click 'Export curation CSV' and upload that CSV."
