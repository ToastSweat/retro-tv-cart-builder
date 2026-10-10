param(
    [string]$Root = 'F:\[VIDEOS]\Commercials\Commercials (Clean)',
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

$reviewDir = Join-Path $Root '_REVIEW_2000S'
$thumbDir  = Join-Path $reviewDir 'thumbs'
New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
New-Item -ItemType Directory -Force -Path $thumbDir | Out-Null

$rows = Import-Csv -LiteralPath $ScanCsv

# Ignore AppleDouble metadata files and anything ffprobe could not read.
$rows = $rows | Where-Object {
    $_.FileName -notlike '._*' -and
    [string]::IsNullOrWhiteSpace($_.ProbeError)
}

# Derive year from the archive's folder structure: Commercials\2000\...
foreach ($row in $rows) {
    $year = $null
    if ($row.RelativePath -match '\\(200[0-5])\\') {
        $year = [int]$Matches[1]
    }
    elseif ($row.FileName -match '(?<!\d)(200[0-5])(?!\d)') {
        $year = [int]$Matches[1]
    }
    Add-Member -InputObject $row -NotePropertyName ReviewYear -NotePropertyValue $year -Force
}

# Start with 2000-2002 only. These are closest to the era we are currently targeting.
# Only show individual-commercial-length clips (15-75 sec from the previous scan).
$logical = $rows |
    Where-Object {
        $_.ReviewYear -ge 2000 -and $_.ReviewYear -le 2002 -and
        $_.LikelyRole -eq 'INDIVIDUAL_COMMERCIAL_CANDIDATE'
    } |
    Sort-Object ReviewYear, FileName

Write-Host "2000-2002 individual commercial candidates: $($logical.Count)"
Write-Host "Generating review thumbnails. Existing thumbnails will be reused."

# Very rough keyword suggestions. These only reduce clicking; human review wins.
$kidKeywords = @(
    'pokemon','nintendo','n64','game boy','gameboy','playstation','ps2','xbox','sega',
    'cereal','candy','fruit roll','gushers','fruit by the foot','capri sun','lunchables',
    'nerf','hot wheels','barbie','lego','toy','toys','hasbro','mattel','fisher price',
    'nickelodeon','nick jr','cartoon network','disney','kids wb','fox kids',
    'burger king','mcdonald','wendy','taco bell','pizza hut',
    'spongebob','rugrats','powerpuff','dexter','digimon','yu-gi-oh','yugioh',
    'movie trailer','trailer'
)

$items = @()
for ($i = 0; $i -lt $logical.Count; $i++) {
    $row = $logical[$i]
    $n = $i + 1
    $thumbName = ('thumb_{0:D4}.jpg' -f $n)
    $thumbPath = Join-Path $thumbDir $thumbName

    $duration = 0.0
    [double]::TryParse([string]$row.DurationSeconds, [ref]$duration) | Out-Null

    if (-not (Test-Path -LiteralPath $thumbPath)) {
        $seek = if ($duration -gt 0) {
            [math]::Min([math]::Max($duration * 0.35, 0.5), 10.0)
        } else { 1.0 }

        Write-Progress `
            -Activity "Building 2000s commercial review gallery" `
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
            # Missing thumbnail is okay; the gallery will show a placeholder.
        }
    }

    $nameLower = $row.FileName.ToLowerInvariant()
    $suggestion = 'GENERAL_00S'
    foreach ($kw in $kidKeywords) {
        if ($nameLower.Contains($kw)) {
            $suggestion = 'KIDS_00S'
            break
        }
    }

    if ($nameLower -match '\bpsa\b|public service') {
        $suggestion = 'PSA'
    }
    elseif ($nameLower -match 'promo|coming up|tonight on|next on') {
        $suggestion = 'PROMO'
    }

    $relativeVideo = '../' + (($row.RelativePath -replace '\\','/'))

    $items += [pscustomobject]@{
        id           = $n
        year         = [int]$row.ReviewYear
        sourcePack   = $row.SourcePack
        fileName     = $row.FileName
        relativePath = $row.RelativePath
        video        = $relativeVideo
        thumb        = "thumbs/$thumbName"
        duration     = if ($duration -gt 0) { [math]::Round($duration, 2) } else { $null }
        codec        = $row.VideoCodec
        width        = $row.Width
        height       = $row.Height
        suggestion   = $suggestion
    }
}

Write-Progress -Activity "Building 2000s commercial review gallery" -Completed

$json = $items | ConvertTo-Json -Depth 4 -Compress

$htmlTemplate = @'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Retro TV — 2000s Commercial Review</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { color-scheme: dark; }
body { font-family: system-ui, sans-serif; margin:0; background:#111; color:#eee; }
header { position:sticky; top:0; z-index:10; background:#181818; padding:14px 18px; border-bottom:1px solid #333; }
h1 { margin:0 0 8px; font-size:22px; }
.controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
input,select,button { background:#222; color:#eee; border:1px solid #555; padding:7px 9px; border-radius:5px; }
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
</style>
</head>
<body>
<header>
  <h1>Retro TV — 2000s Commercial Review</h1>
  <div class="controls">
    <input id="search" placeholder="Search filename…" size="26">
    <select id="yearFilter">
      <option value="">2000–2002</option>
      <option value="2000">2000</option>
      <option value="2001">2001</option>
      <option value="2002">2002</option>
    </select>
    <select id="statusFilter">
      <option value="">All review statuses</option>
      <option value="UNREVIEWED">Unreviewed</option>
      <option value="REVIEWED">Reviewed</option>
    </select>
    <button id="applySuggestions">Apply suggestions to unreviewed</button>
    <button id="exportCsv">Export curation CSV</button>
    <button id="clearData">Clear saved review</button>
  </div>
  <div id="stats"></div>
</header>
<main id="grid"></main>

<script>
const ITEMS = __ITEMS_JSON__;
const CATEGORIES = [
  "UNREVIEWED",
  "KIDS_00S",
  "GENERAL_00S",
  "PSA",
  "PROMO",
  "NEEDS_CLIPPED",
  "SKIP"
];

const STORAGE_KEY = "retro_tv_commercial_review_2000_2002_v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch(e) { saved = {}; }

const grid = document.getElementById("grid");
const search = document.getElementById("search");
const yearFilter = document.getElementById("yearFilter");
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
  const yf = yearFilter.value;
  const sf = statusFilter.value;
  grid.innerHTML = "";

  let shown = 0;
  for (const item of ITEMS) {
    const st = stateFor(item);
    const reviewed = st.category !== "UNREVIEWED";
    const hay = `${item.fileName} ${item.relativePath}`.toLowerCase();

    if (q && !hay.includes(q)) continue;
    if (yf && String(item.year) !== yf) continue;
    if (sf === "UNREVIEWED" && reviewed) continue;
    if (sf === "REVIEWED" && !reviewed) continue;

    shown++;
    const card = document.createElement("article");
    card.className = "card";

    const dur = item.duration == null ? "?" : `${item.duration}s`;
    const dimensions = item.width ? `${item.width}×${item.height}` : "?";

    card.innerHTML = `
      <img class="thumb" src="${encodeURI(item.thumb)}"
           onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">
      <div class="thumb hidden" style="padding:70px 10px;text-align:center;box-sizing:border-box;">No thumbnail</div>
      <div class="body">
        <div class="name">${esc(item.fileName)}</div>
        <div class="meta">
          ${item.year} · ${dur} · ${dimensions} · ${esc(item.codec || "?")}<br>
          <span class="suggestion">Suggested: ${esc(item.suggestion)}</span>
        </div>
        <div class="row">
          <select class="category">${makeOptions(st.category)}</select>
          <button class="previewBtn">Preview</button>
        </div>
        <input class="notes" placeholder="Brand / product / useful note…" value="${esc(st.notes)}">
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

  stats.textContent = `${shown} shown / ${ITEMS.length} candidates`;
}

function updateStats() {
  let reviewed = 0;
  const counts = {};
  for (const item of ITEMS) {
    const st = stateFor(item);
    if (st.category !== "UNREVIEWED") reviewed++;
    counts[st.category] = (counts[st.category] || 0) + 1;
  }
  const summary = Object.entries(counts)
    .filter(([k,v]) => k !== "UNREVIEWED" && v)
    .map(([k,v]) => `${k}: ${v}`)
    .join(" · ");
  stats.textContent = `${reviewed}/${ITEMS.length} reviewed` + (summary ? ` · ${summary}` : "");
}

document.getElementById("applySuggestions").addEventListener("click", () => {
  if (!confirm("Apply automatic suggestions to all currently unreviewed items?")) return;
  for (const item of ITEMS) {
    const st = stateFor(item);
    if (st.category === "UNREVIEWED" && CATEGORIES.includes(item.suggestion)) {
      st.category = item.suggestion;
    }
  }
  save();
  render();
});

document.getElementById("exportCsv").addEventListener("click", () => {
  const header = ["ID","Category","Notes","Suggestion","Year","FileName","RelativePath","DurationSeconds","Codec","Width","Height"];
  const quote = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const lines = [header.map(quote).join(",")];

  for (const item of ITEMS) {
    const st = stateFor(item);
    lines.push([
      item.id, st.category, st.notes, item.suggestion, item.year,
      item.fileName, item.relativePath, item.duration, item.codec, item.width, item.height
    ].map(quote).join(","));
  }

  const blob = new Blob([lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "commercial-curation-2000-2002.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

document.getElementById("clearData").addEventListener("click", () => {
  if (!confirm("Clear all saved 2000s review data in this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  saved = {};
  render();
  updateStats();
});

[search, yearFilter, statusFilter].forEach(el => {
  el.addEventListener(el.tagName === "INPUT" ? "input" : "change", render);
});

render();
updateStats();
</script>
</body>
</html>
'@

$html = $htmlTemplate.Replace('__ITEMS_JSON__', $json)

$htmlPath = Join-Path $reviewDir 'commercial-review-2000-2002.html'
Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8

Write-Host ""
Write-Host "Done."
Write-Host "2000-2002 candidates: $($items.Count)"
Write-Host "Review gallery:"
Write-Host "  $htmlPath"
Write-Host ""
Write-Host "This gallery uses separate browser storage from the first 411-item review."
