const DATA_URL = 'dataset/Superstore.csv';

let rows = [];
let filtered = [];
let sortState = { key: 'sales', dir: -1 };
let charts = {};

const dataStatus = document.getElementById('dataStatus');
const ordersReadout = document.getElementById('ordersReadout');
const loadPanel = document.getElementById('loadPanel');
const loadMsg = document.getElementById('loadMsg');
const retryBtn = document.getElementById('retryBtn');
const hint = document.getElementById('hint');
const appRoot = document.getElementById('appRoot');
const yearSelects = document.getElementById('yearSelects');
const yearFilter = document.getElementById('yearFilter');
const segmentSelect = document.getElementById('segmentSelect');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const profitToggle = document.getElementById('profitToggle');
const productSearch = document.getElementById('productSearch');
const exportFilteredBtn = document.getElementById('exportFilteredBtn');
const copyInsightBtn = document.getElementById('copyInsightBtn');
const productsTableBody = document.querySelector('#productsTable tbody');

const state = { range: 'all', region: 'all', category: 'all', segment: 'all', year: 'all' };

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
  });
}

function parseCsv(text) {
  const rowsOut = [];
  let field = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rowsOut.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rowsOut.push(row); }
  return rowsOut;
}

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

function parseDate(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((v || '').trim());
  if (!m) return null;
  return new Date(+m[3], +m[1] - 1, +m[2]);
}

function fmtMoney(v) {
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(v) { return (v * 100).toFixed(1) + '%'; }

async function loadData() {
  retryBtn.style.display = 'none';
  hint.style.display = 'none';
  try {
    loadMsg.textContent = 'Fetching dataset/Superstore.csv…';
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const grid = parseCsv(text);
    if (grid.length < 2) throw new Error('Empty dataset');
    const headers = grid[0].map(h => h.trim());
    rows = [];
    for (let i = 1; i < grid.length; i++) {
      if (grid[i].length < headers.length) continue;
      const o = {};
      for (let j = 0; j < headers.length; j++) o[headers[j]] = grid[i][j];
      const d = parseDate(o['Order Date']);
      if (!d) continue;
      o._date = d;
      o._year = d.getFullYear();
      o._month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      o._sales = num(o['Sales']);
      o._profit = num(o['Profit']);
      o._qty = num(o['Quantity']);
      o._discount = num(o['Discount']);
      rows.push(o);
    }
    if (!rows.length) throw new Error('No parseable rows');
    buildFilters();
    loadPanel.style.display = 'none';
    appRoot.style.display = 'block';
    dataStatus.textContent = rows.length.toLocaleString() + ' rows loaded';
    document.getElementById('rowCount').textContent = rows.length.toLocaleString();
    document.getElementById('colCount').textContent = headers.length;
    applyFilters();
    setupActions();
  } catch (e) {
    loadMsg.textContent = 'Load failed: ' + e.message;
    retryBtn.style.display = 'inline-flex';
    if (location.protocol === 'file:') hint.style.display = 'block';
    dataStatus.textContent = 'Load failed';
  }
}

retryBtn.addEventListener('click', loadData);

function distinct(key) {
  return Array.from(new Set(rows.map(r => r[key]))).sort();
}

function buildFilters() {
  const yearChips = document.getElementById('dateChips');
  const latestYear = Math.max.apply(null, rows.map(r => r._year));
  const h1 = yearChips.querySelector('[data-range="2020h1"]');
  const h2 = yearChips.querySelector('[data-range="2020h2"]');
  h1.textContent = latestYear + ' H1';
  h2.textContent = latestYear + ' H2';
  yearFilter.innerHTML = '';
  const years = Array.from(new Set(rows.map(r => r._year))).sort();
  for (const y of years) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    yearFilter.appendChild(opt);
  }

  const regionChips = document.getElementById('regionChips');
  const categoryChips = document.getElementById('categoryChips');
  regionChips.innerHTML = '';
  categoryChips.innerHTML = '';
  makeChip(regionChips, 'All', 'all', 'region');
  for (const r of distinct('Region')) makeChip(regionChips, r, r, 'region');
  makeChip(categoryChips, 'All', 'all', 'category');
  for (const c of distinct('Category')) makeChip(categoryChips, c, c, 'category');

  for (const s of distinct('Segment')) {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    segmentSelect.appendChild(opt);
  }
}

function makeChip(container, label, value, group) {
  const btn = document.createElement('button');
  btn.className = 'chip' + (value === 'all' ? ' active' : '');
  btn.textContent = label;
  btn.dataset.value = value;
  btn.dataset.group = group;
  btn.addEventListener('click', () => {
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state[group] = value;
    applyFilters();
  });
  container.appendChild(btn);
}

document.getElementById('dateChips').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#dateChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  state.range = btn.dataset.range;
  yearSelects.style.display = state.range === 'byyear' ? 'block' : 'none';
  applyFilters();
});

yearFilter.addEventListener('change', () => { state.year = yearFilter.value; applyFilters(); });
segmentSelect.addEventListener('change', () => { state.segment = segmentSelect.value; applyFilters(); });
profitToggle.addEventListener('change', renderSalesChart);
productSearch.addEventListener('input', renderProductsTable);

resetFiltersBtn.addEventListener('click', () => {
  state.range = 'all'; state.region = 'all'; state.category = 'all'; state.segment = 'all'; state.year = 'all';
  document.querySelectorAll('#dateChips .chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  document.getElementById('regionChips').querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  document.getElementById('categoryChips').querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  segmentSelect.value = 'all';
  yearSelects.style.display = 'none';
  applyFilters();
});

function applyFilters() {
  const latestYear = Math.max.apply(null, rows.map(r => r._year));
  filtered = rows.filter(r => {
    if (state.region !== 'all' && r.Region !== state.region) return false;
    if (state.category !== 'all' && r.Category !== state.category) return false;
    if (state.segment !== 'all' && r.Segment !== state.segment) return false;
    if (state.range === '2020h1' && !(r._year === latestYear && r._date.getMonth() < 6)) return false;
    if (state.range === '2020h2' && !(r._year === latestYear && r._date.getMonth() >= 6)) return false;
    if (state.range === 'byyear' && state.year !== 'all' && r._year !== +state.year) return false;
    return true;
  });
  renderAll();
}

function renderAll() {
  renderKpis();
  renderSalesChart();
  renderBarChart('catChart', groupSum(filtered, 'Category'));
  renderBarChart('regionChart', groupSum(filtered, 'Region'));
  renderSubcatChart();
  renderProductsTable();
  ordersReadout.textContent = new Set(filtered.map(r => r['Order ID'])).size.toLocaleString() + ' orders in view';
}

function groupSum(list, key) {
  const m = {};
  for (const r of list) m[r[key]] = (m[r[key]] || 0) + r._sales;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function monthlySeries(list, field) {
  const m = {};
  for (const r of list) m[r._month] = (m[r._month] || 0) + r[field];
  return Object.keys(m).sort().map(k => ({ month: k, value: m[k] }));
}

function renderKpis() {
  const sales = filtered.reduce((s, r) => s + r._sales, 0);
  const profit = filtered.reduce((s, r) => s + r._profit, 0);
  const orders = new Set(filtered.map(r => r['Order ID'])).size;
  const discountBase = filtered.reduce((s, r) => s + r._sales, 0) || 1;
  const wDisc = filtered.reduce((s, r) => s + r._discount * r._sales, 0) / discountBase;
  document.getElementById('kpiSales').textContent = fmtMoney(sales);
  document.getElementById('kpiProfit').textContent = fmtMoney(profit);
  document.getElementById('kpiMargin').textContent = sales ? fmtPct(profit / sales) : '—';
  document.getElementById('kpiOrders').textContent = orders.toLocaleString();
  document.getElementById('kpiDiscount').textContent = fmtPct(wDisc);
  document.getElementById('kpiSalesSub').textContent = filtered.length.toLocaleString() + ' line items';
  document.getElementById('kpiProfitSub').textContent = profit >= 0 ? 'Net positive in filter' : 'Net negative in filter';
  document.getElementById('kpiOrdersSub').textContent = 'Unique Order IDs';
  renderSparkline('sparkSales', monthlySeries(filtered, '_sales').map(s => s.value), '#6ee7b7');
  renderSparkline('sparkProfit', monthlySeries(filtered, '_profit').map(s => s.value), '#93c5fd');
}

function renderSparkline(id, values, color) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth * 2;
  const h = canvas.height = 80;
  ctx.clearRect(0, 0, w, h);
  if (values.length < 2) return;
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const span = (max - min) || 1;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = h - 6 - ((v - min) / span) * (h - 12);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function chartDefaults() {
  return {
    plugins: { legend: { labels: { color: 'rgba(230,234,240,0.85)', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: 'rgba(230,234,240,0.6)' }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y: { ticks: { color: 'rgba(230,234,240,0.6)' }, grid: { color: 'rgba(255,255,255,0.06)' } }
    }
  };
}

function renderSalesChart() {
  if (typeof Chart === 'undefined') return;
  const sales = monthlySeries(filtered, '_sales');
  const profit = monthlySeries(filtered, '_profit');
  const labels = sales.map(s => s.month);
  const data = {
    labels,
    datasets: [
      { label: 'Sales', data: sales.map(s => s.value), borderColor: '#6ee7b7', backgroundColor: 'rgba(110,231,183,0.12)', fill: true, tension: 0.3, pointRadius: 0 },
      ...(profitToggle.checked ? [{ label: 'Profit', data: profit.map(s => s.value), borderColor: '#93c5fd', backgroundColor: 'rgba(147,197,253,0.08)', fill: true, tension: 0.3, pointRadius: 0 }] : [])
    ]
  };
  if (charts.sales) charts.sales.destroy();
  charts.sales = new Chart(document.getElementById('salesChart'), { type: 'line', data, options: chartDefaults() });
}

function renderBarChart(id, entries) {
  if (typeof Chart === 'undefined') return;
  const data = {
    labels: entries.map(e => e[0]),
    datasets: [{ label: 'Sales', data: entries.map(e => Math.round(e[1])), backgroundColor: ['#6ee7b7', '#93c5fd', '#fbbf24', '#f472b6'] }]
  };
  const opts = chartDefaults();
  opts.indexAxis = 'y';
  opts.plugins.legend.display = false;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), { type: 'bar', data, options: opts });
}

function renderSubcatChart() {
  if (typeof Chart === 'undefined') return;
  const m = {};
  for (const r of filtered) m[r['Sub-Category']] = (m[r['Sub-Category']] || 0) + r._profit;
  const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
  const data = {
    labels: entries.map(e => e[0]),
    datasets: [{ label: 'Profit', data: entries.map(e => Math.round(e[1])), backgroundColor: entries.map(e => e[1] >= 0 ? '#6ee7b7' : '#f87171') }]
  };
  const opts = chartDefaults();
  opts.plugins.legend.display = false;
  if (charts.subcat) charts.subcat.destroy();
  charts.subcat = new Chart(document.getElementById('subcatChart'), { type: 'bar', data, options: opts });
}

function productAgg() {
  const m = {};
  for (const r of filtered) {
    const name = r['Product Name'];
    if (!m[name]) m[name] = { name, sales: 0, profit: 0, qty: 0 };
    m[name].sales += r._sales;
    m[name].profit += r._profit;
    m[name].qty += r._qty;
  }
  return Object.values(m).map(p => ({ ...p, margin: p.sales ? p.profit / p.sales : 0 }));
}

function currentProducts() {
  let list = productAgg();
  const q = (productSearch.value || '').toLowerCase();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
  list.sort((a, b) => {
    const k = sortState.key;
    if (k === 'name') return a.name.localeCompare(b.name) * sortState.dir;
    return ((a[k] || 0) - (b[k] || 0)) * sortState.dir;
  });
  return list;
}

function renderProductsTable() {
  const list = currentProducts().slice(0, 10);
  productsTableBody.innerHTML = '';
  for (const p of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + escapeHtml(p.name) + '</td><td>' + fmtMoney(p.sales) + '</td><td>' + fmtMoney(p.profit) + '</td><td>' + fmtPct(p.margin) + '</td><td>' + p.qty.toLocaleString() + '</td>';
    productsTableBody.appendChild(tr);
  }
}

document.querySelectorAll('#productsTable th').forEach(th => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (sortState.key === key) sortState.dir *= -1;
    else { sortState.key = key; sortState.dir = key === 'name' ? 1 : -1; }
    renderProductsTable();
  });
});

function setupActions() {
  exportFilteredBtn.addEventListener('click', () => {
    const list = currentProducts();
    const header = 'product,sales,profit,margin_pct,qty\n';
    const body = list.map(p => '"' + p.name.replace(/"/g, '""') + '",' + p.sales.toFixed(2) + ',' + p.profit.toFixed(2) + ',' + (p.margin * 100).toFixed(1) + ',' + p.qty).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'demandsight_filtered_products.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  copyInsightBtn.addEventListener('click', () => {
    const sales = filtered.reduce((s, r) => s + r._sales, 0);
    const profit = filtered.reduce((s, r) => s + r._profit, 0);
    const top = currentProducts()[0];
    const text = 'DemandSight insight: ' + fmtMoney(sales) + ' sales / ' + fmtMoney(profit) + ' profit across ' +
      filtered.length + ' line items. Top product: ' + (top ? top.name + ' (' + fmtMoney(top.sales) + ')' : 'n/a') + '.';
    navigator.clipboard.writeText(text).catch(() => {});
  });
}

loadData();
