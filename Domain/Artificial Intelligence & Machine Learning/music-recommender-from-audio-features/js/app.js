const FEATURES = ['bpm','energy','danceability ','dB','liveness','valence','duration','acousticness','speechiness ','popularity'];

const API_BASE = (window.MUSIC_API_BASE || 'http://127.0.0.1:5000').replace(/\/+$/, '');
let apiMode = false;

let rawData = [];
let normalizedData = [];
let artistsList = [];
let genresList = [];
let yearRange = {min: 2000, max: 2023};
let currentSeed = null;
let currentRecs = [];

const loadPanel = document.getElementById('loadPanel');
const appRoot = document.getElementById('appRoot');
const loadMessage = document.getElementById('loadMessage');
const retryBtn = document.getElementById('retryBtn');
const serverHint = document.getElementById('serverHint');
const datasetBadge = document.getElementById('datasetBadge');
const loadStatus = document.getElementById('loadStatus');

const artistInput = document.getElementById('artistInput');
const artistDropdown = document.getElementById('artistDropdown');
const songSelect = document.getElementById('songSelect');
const songSearch = document.getElementById('songSearch');
const excludeSelfToggle = document.getElementById('excludeSelfToggle');
const sortToggle = document.getElementById('sortToggle');
const resetAllBtn = document.getElementById('resetAllBtn');
const featuredMatch = document.getElementById('featuredMatch');
const featuredBtn = document.getElementById('featuredBtn');

const heroResult = document.getElementById('heroResult');
const seedVinyl = document.getElementById('seedVinyl');
const seedTitle = document.getElementById('seedTitle');
const seedMeta = document.getElementById('seedMeta');
const seedGenre = document.getElementById('seedGenre');
const recsList = document.getElementById('recsList');
const copyListBtn = document.getElementById('copyListBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');

const comparisonPanel = document.getElementById('comparisonPanel');
const compSeed = document.getElementById('compSeed');
const compMatch = document.getElementById('compMatch');
const similaritySentence = document.getElementById('similaritySentence');
const dnaChart = document.getElementById('dnaChart');
const closeComparisonBtn = document.getElementById('closeComparisonBtn');

const genreChips = document.getElementById('genreChips');
const yearStart = document.getElementById('yearStart');
const yearEnd = document.getElementById('yearEnd');
const artistBarChart = document.getElementById('artistBarChart');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i+1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === '\n' && !inQuotes) {
      rows.push(current);
      current = '';
      continue;
    }
    if (ch === '\r' && !inQuotes) {
      if (text[i+1] === '\n') continue;
      rows.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) rows.push(current);
  return rows;
}

function splitRow(row) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i+1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ';' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

async function probeApi() {
  try {
    const opts = { method: 'GET' };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(1500);
    const res = await fetch(API_BASE + '/api/health', opts);
    if (!res.ok) return false;
    const data = await res.json();
    return !!(data && data.status === 'ok');
  } catch (e) {
    return false;
  }
}

async function loadData() {
  try {
    apiMode = await probeApi();
    loadMessage.textContent = apiMode
      ? 'Backend online — fetching data/best_songs_spotify_2000_2023.csv for local browse…'
      : 'Fetching data/best_songs_spotify_2000_2023.csv…';
    const res = await fetch('data/best_songs_spotify_2000_2023.csv');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    const headers = splitRow(rows[0]);
    rawData = [];
    for (let i = 1; i < rows.length; i++) {
      const parts = splitRow(rows[i]);
      if (parts.length < headers.length) continue;
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = parts[j];
      }
      rawData.push(obj);
    }
    if (rawData.length === 0) throw new Error('Empty dataset');
    buildNormalized();
    buildMeta();
    loadPanel.style.display = 'none';
    appRoot.style.display = 'block';
    datasetBadge.textContent = rawData.length.toLocaleString() + ' songs · 10 audio features · ' + (apiMode ? 'backend cosine API' : 'browser cosine engine');
    loadStatus.textContent = apiMode ? 'Loaded (backend online)' : 'Loaded (browser engine)';
    setupUI();
  } catch (e) {
    loadMessage.textContent = 'Load failed: ' + e.message;
    retryBtn.style.display = 'inline-flex';
    serverHint.style.display = 'block';
    loadStatus.textContent = 'Failed';
  }
}

retryBtn.addEventListener('click', loadData);

function buildNormalized() {
  const mins = {};
  const maxs = {};
  for (let f of FEATURES) {
    let minv = Infinity, maxv = -Infinity;
    for (let i = 0; i < rawData.length; i++) {
      const v = parseFloat(rawData[i][f]);
      if (isNaN(v)) continue;
      if (v < minv) minv = v;
      if (v > maxv) maxv = v;
    }
    mins[f] = minv === Infinity ? 0 : minv;
    maxs[f] = maxv === -Infinity ? 1 : maxv;
  }
  normalizedData = rawData.map((row, idx) => {
    const nrow = {...row, _idx: idx};
    for (let f of FEATURES) {
      const v = parseFloat(row[f]);
      const minv = mins[f], maxv = maxs[f];
      if (maxv === minv) nrow['_n_' + f] = 0;
      else nrow['_n_' + f] = (v - minv) / (maxv - minv);
    }
    return nrow;
  });
}

function buildMeta() {
  const artistSet = new Set();
  const genreSet = new Set();
  let ymin = 3000, ymax = 1900;
  for (let i = 0; i < rawData.length; i++) {
    const a = (rawData[i]['artist'] || '').toString().trim();
    if (a) artistSet.add(a);
    const g = (rawData[i]['top genre'] || '').toString().trim();
    if (g) genreSet.add(g);
    const y = parseInt(rawData[i]['year']);
    if (!isNaN(y)) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  }
  artistsList = Array.from(artistSet).sort((a,b) => a.localeCompare(b));
  genresList = Array.from(genreSet).sort((a,b) => a.localeCompare(b));
  yearRange = {min: ymin === 3000 ? 2000 : ymin, max: ymax === 1900 ? 2023 : ymax};
}

function setupUI() {
  // artist typeahead
  artistInput.addEventListener('input', () => {
    const q = artistInput.value.toLowerCase();
    artistDropdown.innerHTML = '';
    if (!q) { artistDropdown.classList.remove('show'); return; }
    const matches = artistsList.filter(a => a.toLowerCase().includes(q)).slice(0, 12);
    for (let m of matches) {
      const div = document.createElement('div');
      div.className = 'typeahead-item';
      div.textContent = m;
      div.addEventListener('click', () => {
        artistInput.value = m;
        artistDropdown.classList.remove('show');
        populateSongs(m);
      });
      artistDropdown.appendChild(div);
    }
    if (matches.length) artistDropdown.classList.add('show');
    else artistDropdown.classList.remove('show');
  });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('artistTypeahead').contains(e.target)) {
      artistDropdown.classList.remove('show');
    }
  });

  songSelect.addEventListener('change', () => {
    if (!songSelect.value) return;
    const seed = findSeed(artistInput.value, songSelect.value);
    if (seed) computeRecommendations(seed);
  });
  songSearch.addEventListener('input', () => {
    const q = songSearch.value.toLowerCase();
    const artist = artistInput.value;
    if (!artist) return;
    const songs = getSongsForArtist(artist).filter(s => (s.title||'').toLowerCase().includes(q));
    populateSongSelect(songs);
  });

  excludeSelfToggle.addEventListener('change', recompute);
  sortToggle.addEventListener('change', recompute);
  resetAllBtn.addEventListener('click', resetAll);

  copyListBtn.addEventListener('click', copyList);
  downloadCsvBtn.addEventListener('click', downloadCsv);
  closeComparisonBtn.addEventListener('click', () => { comparisonPanel.style.display = 'none'; });

  // featured
  const hasFlowers = rawData.find(r => (r.title||'').toLowerCase() === 'flowers');
  const hasTheClimb = rawData.find(r => (r.title||'').toLowerCase().includes('the climb'));
  if (hasFlowers && hasTheClimb) {
    featuredMatch.style.display = 'flex';
    featuredBtn.addEventListener('click', () => {
      artistInput.value = (hasFlowers.artist||'').toString();
      populateSongs(artistInput.value);
      setTimeout(() => {
        for (let i=0; i<songSelect.options.length; i++) {
          if ((songSelect.options[i].text||'').toLowerCase() === 'flowers') { songSelect.selectedIndex = i; break; }
        }
        const seed = findSeed(artistInput.value, 'flowers');
        if (seed) computeRecommendations(seed);
      }, 50);
    });
  }

  // tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // genre chips
  genreChips.innerHTML = '';
  const allChip = document.createElement('button');
  allChip.className = 'genre-chip-btn active';
  allChip.textContent = 'All';
  allChip.dataset.genre = 'all';
  genreChips.appendChild(allChip);
  for (let g of genresList.slice(0, 18)) {
    const b = document.createElement('button');
    b.className = 'genre-chip-btn';
    b.textContent = g;
    b.dataset.genre = g;
    genreChips.appendChild(b);
  }
  genreChips.querySelectorAll('.genre-chip-btn').forEach(b => {
    b.addEventListener('click', () => {
      genreChips.querySelectorAll('.genre-chip-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      applyFilters();
    });
  });

  // year range
  yearStart.innerHTML = '';
  yearEnd.innerHTML = '';
  for (let y = yearRange.min; y <= yearRange.max; y++) {
    const o1 = document.createElement('option'); o1.value = y; o1.textContent = y; yearStart.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = y; o2.textContent = y; yearEnd.appendChild(o2);
  }
  yearStart.value = yearRange.min;
  yearEnd.value = yearRange.max;
  yearStart.addEventListener('change', applyFilters);
  yearEnd.addEventListener('change', applyFilters);

  buildArtistBarChart();
}

function getSongsForArtist(artist) {
  const a = (artist||'').toLowerCase();
  return rawData.filter(r => (r.artist||'').toLowerCase() === a);
}

function populateSongs(artist) {
  const songs = getSongsForArtist(artist);
  songSelect.innerHTML = '<option value="">Select a song…</option>';
  for (let s of songs) {
    const opt = document.createElement('option');
    opt.value = (s.title||'').toLowerCase();
    opt.textContent = s.title + ' (' + s.year + ')';
    songSelect.appendChild(opt);
  }
  songSearch.value = '';
}

function populateSongSelect(songs) {
  songSelect.innerHTML = '<option value="">Select a song…</option>';
  for (let s of songs) {
    const opt = document.createElement('option');
    opt.value = (s.title||'').toLowerCase();
    opt.textContent = s.title + ' (' + s.year + ')';
    songSelect.appendChild(opt);
  }
}

function findSeed(artist, titleLower) {
  for (let i=0; i<normalizedData.length; i++) {
    if ((normalizedData[i].artist||'').toLowerCase() === (artist||'').toLowerCase() && 
        (normalizedData[i].title||'').toLowerCase() === titleLower) {
      return normalizedData[i];
    }
  }
  return null;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let f of FEATURES) {
    const va = a['_n_' + f] || 0, vb = b['_n_' + f] || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function computeRecommendations(seed) {
  currentSeed = seed;
  if (apiMode) {
    try {
      const res = await fetch(API_BASE + '/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: seed.artist,
          title: seed.title,
          limit: 10,
          excludeSelf: excludeSelfToggle.checked
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.recommendations)) throw new Error('Malformed response');
      let recs = data.recommendations.map(r => ({ row: r, sim: r.similarity }));
      if (sortToggle.checked) recs.reverse();
      currentRecs = recs.slice(0, 10);
      renderHero(seed, currentRecs);
      return;
    } catch (e) {
      apiMode = false;
      datasetBadge.textContent = rawData.length.toLocaleString() + ' songs · 10 audio features · browser cosine engine (backend unreachable)';
      loadStatus.textContent = 'Loaded (browser engine)';
    }
  }
  const results = [];
  for (let i=0; i<normalizedData.length; i++) {
    const row = normalizedData[i];
    if (excludeSelfToggle.checked && row._idx === seed._idx) continue;
    const sim = cosineSim(seed, row);
    results.push({row, sim});
  }
  results.sort((x,y) => sortToggle.checked ? x.sim - y.sim : y.sim - x.sim);
  currentRecs = results.slice(0, 10);
  renderHero(seed, currentRecs);
}

function recompute() {
  if (!currentSeed) return;
  computeRecommendations(currentSeed);
}

function renderHero(seed, recs) {
  heroResult.style.display = 'block';
  seedTitle.textContent = seed.title;
  seedMeta.textContent = seed.artist + ' · ' + seed.year;
  seedGenre.innerHTML = '<span class="genre-chip">' + seed['top genre'] + '</span>';
  seedVinyl.style.filter = 'hue-rotate(' + Math.round(parseFloat(seed.valence)||0) + 'deg) saturate(' + (1.2 + (parseFloat(seed.energy)||0)/100) + ')';

  recsList.innerHTML = '';
  for (let i=0; i<recs.length; i++) {
    const r = recs[i];
    const card = document.createElement('div');
    card.className = 'crate-card';
    const hue = Math.round(parseFloat(r.row.valence)||0);
    const warm = 1.1 + (parseFloat(r.row.energy)||0)/120;
    card.style.setProperty('--c1', 'hsl(' + hue + ', 70%, 55%)');
    card.style.setProperty('--c2', 'hsl(' + (hue+25) + ', 65%, 48%)');
    card.innerHTML = '<div class="crate-top"><div><div class="crate-title">' + escapeHtml(r.row.title) + '</div><div class="crate-meta">' + escapeHtml(r.row.artist) + ' · ' + r.row.year + '</div></div><span class="genre-chip">' + escapeHtml(r.row['top genre']) + '</span></div>' +
      '<div class="sleeve" style="filter: saturate(' + warm + ')"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between"><span style="color:var(--muted);font-size:13px">Similarity</span><span style="font-family:IBM Plex Mono,monospace">' + (r.sim*100).toFixed(1) + '%</span></div>' +
      '<div class="sim-bar" style="width:' + Math.max(6, r.sim*100) + '%"></div>' +
      '<button class="btn-ghost" style="align-self:flex-start">Why this match</button>';
    card.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      showComparison(seed, r.row, r.sim);
    });
    card.addEventListener('click', () => showComparison(seed, r.row, r.sim));
    recsList.appendChild(card);
  }
}

function showComparison(seed, match, sim) {
  comparisonPanel.style.display = 'block';
  compSeed.textContent = seed.title + ' — ' + seed.artist;
  compMatch.textContent = match.title + ' — ' + match.artist;
  similaritySentence.textContent = 'These tracks share ' + (sim*100).toFixed(1) + '% cosine similarity across the 10 normalized audio features based on min-max scaling over the full dataset.';
  dnaChart.innerHTML = '';
  for (let f of FEATURES) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'dna-row';
    const label = document.createElement('div');
    label.className = 'dna-label';
    label.textContent = f.replace(' ', '');
    const bars = document.createElement('div');
    bars.className = 'dna-bars';
    const b1 = document.createElement('div');
    b1.className = 'dna-bar';
    b1.style.width = Math.max(4, (parseFloat(seed[f])||0) * 100 / (getMaxRaw(f)||1)) + '%';
    const b2 = document.createElement('div');
    b2.className = 'dna-bar match';
    b2.style.width = Math.max(4, (parseFloat(match[f])||0) * 100 / (getMaxRaw(f)||1)) + '%';
    bars.appendChild(b1); bars.appendChild(b2);
    rowDiv.appendChild(label); rowDiv.appendChild(bars);
    dnaChart.appendChild(rowDiv);
  }
  comparisonPanel.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function getMaxRaw(f) {
  let m = 0;
  for (let i=0; i<rawData.length; i++) {
    const v = Math.abs(parseFloat(rawData[i][f])||0);
    if (v > m) m = v;
  }
  return m || 1;
}

function copyList() {
  if (!currentRecs.length) return;
  const lines = currentRecs.map((r,i) => (i+1) + '. ' + r.row.title + ' - ' + r.row.artist + ' (' + (r.sim*100).toFixed(1) + '%)');
  navigator.clipboard.writeText(lines.join('\n')).catch(()=>{});
}

function downloadCsv() {
  if (!currentRecs.length || !currentSeed) return;
  const header = 'seed_title;seed_artist;title;artist;year;top_genre;similarity\n';
  const rows = currentRecs.map(r => currentSeed.title + ';' + currentSeed.artist + ';' + r.row.title + ';' + r.row.artist + ';' + r.row.year + ';' + r.row['top genre'] + ';' + (r.sim*100).toFixed(3));
  const blob = new Blob([header + rows.join('\n')], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'groove_recommendations.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function resetAll() {
  artistInput.value = '';
  songSelect.innerHTML = '<option value="">Select a song…</option>';
  songSearch.value = '';
  artistDropdown.classList.remove('show');
  heroResult.style.display = 'none';
  comparisonPanel.style.display = 'none';
  currentSeed = null;
  currentRecs = [];
}

function applyFilters() {
  const activeGenre = document.querySelector('.genre-chip-btn.active')?.dataset.genre || 'all';
  const ys = parseInt(yearStart.value), ye = parseInt(yearEnd.value);
  // update artists list visibility conceptually - just rebuild bar chart filtered
  buildArtistBarChart(activeGenre, ys, ye);
}

function buildArtistBarChart(genreFilter='all', ys=null, ye=null) {
  const counts = {};
  for (let i=0; i<rawData.length; i++) {
    const r = rawData[i];
    if (genreFilter !== 'all' && r['top genre'] !== genreFilter) continue;
    const y = parseInt(r.year);
    if (ys && !isNaN(y) && y < ys) continue;
    if (ye && !isNaN(y) && y > ye) continue;
    const a = r.artist;
    counts[a] = (counts[a]||0) + 1;
  }
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 20);
  artistBarChart.innerHTML = '';
  const maxv = entries.length ? entries[0][1] : 1;
  for (let e of entries) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = '<div class="bar-label">' + escapeHtml(e[0]) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + (e[1]/maxv*100) + '%"></div></div><div class="bar-value">' + e[1] + '</div>';
    artistBarChart.appendChild(row);
  }
}

function escapeHtml(s) {
  return (s||'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

loadData();
