/* TrendCast — stock-price-trend-predictor research terminal */
(function () {
  "use strict";

  var DATASETS = {
    daily: { path: "data/processed/daily-rolling-binary-curated.csv", label: "daily-rolling-binary-curated.csv", rows: "4,127" },
    weekly: { path: "data/processed/weekly-rolling-binary-curated.csv", label: "weekly-rolling-binary-curated.csv", rows: "855" }
  };

  var FEATURE_FAMILIES = [
    {
      id: "trend",
      name: "TREND / RESEARCH",
      items: [
        { name: "research", sig: "research(series, length=3)", desc: "Today's value minus the previous n-day simple moving average (shifted by 1) — the exact feature from Preis, Moat & Stanley (2014)." },
        { name: "sma", sig: "sma(series, length=6)", desc: "Simple moving average over a rolling window." },
        { name: "ema", sig: "ema(series, length=6)", desc: "Exponential moving average, span=length, adjust=False." }
      ]
    },
    {
      id: "momentum",
      name: "MOMENTUM / CHANGE",
      items: [
        { name: "delta", sig: "delta(series, length=3)", desc: "Absolute difference between two values `length` periods apart (series.diff)." },
        { name: "pct_change", sig: "pct_change(series, length=3)", desc: "Percentage change between two values `length` periods apart." }
      ]
    },
    {
      id: "lag",
      name: "LAG",
      items: [
        { name: "lag", sig: "lag(series, length=1) → lag_1 … lag_{n-1}", desc: "Builds lag_i = series.shift(i) columns. The curated CSVs persist lag_1 (a one-step lag of the target direction series)." }
      ]
    },
    {
      id: "target",
      name: "TARGET ENCODING",
      items: [
        { name: "target_binary", sig: "target_binary(series)", desc: "Converts close-price pct_change to binary labels: up = 1, down = 0 — the `Target` column in the curated CSVs." },
        { name: "target_bins", sig: "target_bins(series, bins=6)", desc: "Buckets pct_change into N discrete bins for multi-class experiments." }
      ]
    }
  ];

  var KEYWORDS = ["debt","color","stocks","restaurant","portfolio","inflation","housing","dow jones","revenue","economics","credit","markets","return","unemployment","money","religion","cancer","growth","investment","hedge","marriage","bonds","headlines","profit","society","leverage","loss","cash","office","fine","stock market","banking","crisis","happy","car","nasdaq","gains","finance","sell","invest","fed","house","metals","travel","returns","gain","default","present","holiday","water","rich","risk","gold","success","oil","war","economy","chance","lifestyle","greed","food","movie","nyse","ore","opportunity","health","earnings","arts","culture","bubble","buy","trader","tourism","politics","energy","consume","consumption","freedom","dividend","world","conflict","kitchen","forex","home","cash","transaction","garden","fond","train","labor","fun","environment","ring"];

  var RAW_DAILY_SAMPLE = ["arts.csv","banking.csv","bonds.csv","bubble.csv","buy.csv","cancer.csv","car.csv","cash.csv","chance.csv","color.csv","conflict.csv","consume.csv","consumption.csv","credit.csv","crisis.csv"];

  var state = {
    tab: "trends",
    dsKey: "daily",
    headers: [],
    rows: [],
    selected: {},
    chart: null,
    fetched: { daily: false, weekly: false }
  };

  function $(id) { return document.getElementById(id); }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast(okMsg || "COPIED"); }
      catch (e) { toast("COPY FAILED"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg || "COPIED"); }, fallback);
    } else { fallback(); }
  }

  /* ---------- tabs ---------- */
  var TAB_ORDER = ["trends", "features", "pipeline", "keywords"];

  function showTab(name) {
    if (TAB_ORDER.indexOf(name) === -1) return;
    state.tab = name;
    TAB_ORDER.forEach(function (t) {
      var btn = $("tab-" + t);
      var panel = $("panel-" + t);
      if (!btn || !panel) return;
      var on = t === name;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    });
    try { localStorage.setItem("trendcast-tab", name); } catch (e) { /* storage unavailable */ }
    if (name === "features") ensureCorrelations();
  }

  function initTabs() {
    TAB_ORDER.forEach(function (t) {
      var btn = $("tab-" + t);
      if (btn) btn.addEventListener("click", function () { showTab(t); });
    });
    document.querySelectorAll("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () { showTab(b.getAttribute("data-goto")); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) showTab(TAB_ORDER[n - 1]);
    });
    var saved = null;
    try { saved = localStorage.getItem("trendcast-tab"); } catch (e) { /* ignore */ }
    if (saved) showTab(saved);
  }

  /* ---------- clock ---------- */
  function initClock() {
    var el = $("meta-clock");
    if (!el) return;
    function tick() {
      var d = new Date();
      function p(n) { return (n < 10 ? "0" : "") + n; }
      el.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- CSV parsing ---------- */
  function parseCSV(text) {
    var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (!lines.length) return { headers: [], rows: [] };
    var headers = lines[0].split(",");
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var parts = lines[i].split(",");
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var v = parts[j];
        var num = Number(v);
        obj[headers[j]] = (v !== "" && !isNaN(num)) ? num : v;
      }
      rows.push(obj);
    }
    return { headers: headers, rows: rows };
  }

  /* ---------- data loading ---------- */
  function setStatus(msg, busy) {
    var el = $("trends-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "status" + (busy ? " status--busy" : "");
  }

  function loadDataset(dsKey) {
    state.dsKey = dsKey;
    var meta = DATASETS[dsKey];
    var errBox = $("trends-error");
    var dsBtns = document.querySelectorAll(".chip--ds");
    dsBtns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-ds") === dsKey);
    });
    var md = $("meta-dataset"); if (md) md.textContent = meta.label;
    var mr = $("meta-rows"); if (mr) mr.textContent = state.fetched[dsKey] ? String(state.rows.length) : "--";

    setStatus("LOADING " + meta.label + " ...", true);
    if (errBox) errBox.hidden = true;

    fetch(meta.path)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var parsed = parseCSV(text);
        if (!parsed.headers.length) throw new Error("empty CSV");
        state.headers = parsed.headers;
        state.rows = parsed.rows;
        state.fetched[dsKey] = true;
        buildDefaultSelection();
        renderChips();
        renderChart();
        renderStats();
        renderPreview();
        setStatus("LOADED " + meta.label + " — " + parsed.rows.length + " rows x " + parsed.headers.length + " cols", false);
        if (mr) mr.textContent = String(parsed.rows.length);
        state.chart && state.chart.resize();
      })
      .catch(function (err) {
        state.headers = [];
        state.rows = [];
        state.selected = {};
        if (errBox) errBox.hidden = false;
        var chips = $("chips-row"); if (chips) chips.hidden = true;
        var stats = $("stats-grid"); if (stats) stats.hidden = true;
        var chartEmpty = $("chart-empty"); if (chartEmpty) chartEmpty.hidden = false;
        if (state.chart) { state.chart.destroy(); state.chart = null; }
        setStatus("FETCH FAILED: " + err.message, false);
        if (mr) mr.textContent = "--";
      });
  }

  function buildDefaultSelection() {
    state.selected = {};
    var defaults = state.dsKey === "daily"
      ? ["debt", "stock_market", "crisis", "Target"]
      : ["debt", "stock_market", "Target"];
    state.headers.forEach(function (h) {
      if (h === "index") return;
      state.selected[h] = defaults.indexOf(h) !== -1;
    });
  }

  /* ---------- chips ---------- */
  function renderChips() {
    var wrap = $("column-chips");
    var row = $("chips-row");
    if (!wrap || !row) return;
    row.hidden = false;
    wrap.innerHTML = "";
    state.headers.forEach(function (h) {
      if (h === "index") return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.selected[h] ? " active" : "") + (h === "Target" ? " chip--target" : "");
      b.textContent = h;
      b.setAttribute("aria-pressed", state.selected[h] ? "true" : "false");
      b.addEventListener("click", function () {
        state.selected[h] = !state.selected[h];
        b.classList.toggle("active", state.selected[h]);
        b.setAttribute("aria-pressed", state.selected[h] ? "true" : "false");
        renderChart();
      });
      wrap.appendChild(b);
    });
  }

  function setAllChips(pred) {
    state.headers.forEach(function (h) {
      if (h === "index") return;
      state.selected[h] = pred(h);
    });
    renderChips();
    renderChart();
  }

  /* ---------- chart ---------- */
  var PALETTE = ["#00e676","#69f0ae","#00e5ff","#ffd740","#ff8a65","#b388ff","#f48fb1","#80cbc4","#aed581","#ffab40","#40c4ff","#e6ee9c","#ce93d8","#a5d6a7","#ffb74d"];
  var TARGET_COLOR = "#ffb300";

  var crosshairPlugin = {
    id: "trendcastCrosshair",
    afterDatasetsDraw: function (chart) {
      var active = chart.tooltip && chart.tooltip.getActiveElements && chart.tooltip.getActiveElements();
      if (!active || !active.length) return;
      var x = active[0].element.x;
      var yAxis = chart.scales.y;
      var ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, yAxis.top);
      ctx.lineTo(x, yAxis.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,230,118,0.55)";
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();
    }
  };

  function selectedColumns() {
    return state.headers.filter(function (h) { return h !== "index" && state.selected[h]; });
  }

  function renderChart() {
    var canvas = $("trends-chart");
    var emptyEl = $("chart-empty");
    var fallbackEl = $("chart-fallback");
    if (!canvas) return;

    var cols = selectedColumns();
    if (typeof Chart === "undefined") {
      if (state.chart) { state.chart.destroy(); state.chart = null; }
      if (fallbackEl) fallbackEl.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
      return;
    }
    if (fallbackEl) fallbackEl.hidden = true;

    if (!cols.length || !state.rows.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (state.chart) { state.chart.destroy(); state.chart = null; }
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var labels = state.rows.map(function (r) { return String(r.index); });
    var datasets = cols.map(function (c, i) {
      var isTarget = c === "Target";
      return {
        label: c,
        data: state.rows.map(function (r) { return r[c]; }),
        borderColor: isTarget ? TARGET_COLOR : PALETTE[i % PALETTE.length],
        backgroundColor: "transparent",
        borderWidth: isTarget ? 1.4 : 1.2,
        pointRadius: 0,
        pointHitRadius: 6,
        stepped: isTarget ? "after" : false,
        tension: 0
      };
    });

    var gridColor = "rgba(0,230,118,0.1)";
    var tickColor = "#4e8a66";

    if (state.chart) {
      state.chart.data.labels = labels;
      state.chart.data.datasets = datasets;
      state.chart.update();
      return;
    }

    state.chart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels: labels, datasets: datasets },
      plugins: [crosshairPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              maxTicksLimit: 12,
              font: { family: "'IBM Plex Mono', monospace", size: 10 },
              callback: function (val, idx) {
                var row = state.rows[idx];
                return row ? row.index : "";
              }
            },
            title: { display: true, text: "index (trading-day / week sequence)", color: tickColor, font: { family: "'IBM Plex Mono', monospace", size: 10 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { family: "'IBM Plex Mono', monospace", size: 10 } }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: "#b9f6ca",
              boxWidth: 10,
              boxHeight: 2,
              font: { family: "'IBM Plex Mono', monospace", size: 10 }
            }
          },
          tooltip: {
            backgroundColor: "#03150b",
            borderColor: "rgba(0,230,118,0.4)",
            borderWidth: 1,
            titleColor: "#00e676",
            bodyColor: "#b9f6ca",
            titleFont: { family: "'Fira Code', monospace", size: 11 },
            bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
            displayColors: true,
            callbacks: {
              title: function (items) {
                if (!items.length) return "";
                var row = state.rows[items[0].dataIndex];
                return "index " + (row ? row.index : "?");
              }
            }
          }
        }
      }
    });
  }

  /* ---------- stats + preview ---------- */
  function renderStats() {
    var grid = $("stats-grid");
    if (!grid) return;
    if (!state.rows.length) { grid.hidden = true; return; }
    grid.hidden = false;
    $("stat-rows").textContent = String(state.rows.length);
    $("stat-cols").textContent = String(state.headers.length);
    var first = state.rows[0].index, last = state.rows[state.rows.length - 1].index;
    $("stat-range").textContent = first + " → " + last;
    var up = 0, down = 0;
    state.rows.forEach(function (r) {
      if (r.Target === 1) up++;
      else if (r.Target === 0) down++;
    });
    $("stat-up").textContent = String(up);
    $("stat-down").textContent = String(down);
  }

  function renderPreview() {
    var table = $("preview-table");
    if (!table) return;
    var head = "<thead><tr>" + state.headers.map(function (h) {
      return '<th scope="col">' + escapeHtml(h) + "</th>";
    }).join("") + "</tr></thead>";
    var body = state.rows.slice(0, 25).map(function (r) {
      return "<tr>" + state.headers.map(function (h) {
        var v = r[h];
        var cls = typeof v === "number" ? ' class="num"' : "";
        return "<td" + cls + ">" + escapeHtml(String(v)) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    table.innerHTML = head + "<tbody>" + body + "</tbody>";
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- download current view ---------- */
  function downloadView() {
    if (!state.rows.length) { toast("NO DATA LOADED"); return; }
    var cols = state.headers.filter(function (h) { return h === "index" || state.selected[h]; });
    if (!cols.length) cols = state.headers.slice();
    var lines = [cols.join(",")];
    state.rows.forEach(function (r) {
      lines.push(cols.map(function (c) { return r[c]; }).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trendcast-view-" + state.dsKey + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("CSV EXPORTED (" + state.rows.length + " rows)");
  }

  /* ---------- features tab ---------- */
  function renderFeatureFamilies() {
    var wrap = $("feature-families");
    if (!wrap) return;
    FEATURE_FAMILIES.forEach(function (fam) {
      var box = document.createElement("div");
      box.className = "fam";
      var head = document.createElement("div");
      head.className = "fam__head";
      head.innerHTML = "<h3>" + escapeHtml(fam.name) + "</h3><span class='fam__count'>src/features/build_features.py</span>";
      box.appendChild(head);
      var ul = document.createElement("ul");
      ul.className = "fam__list";
      fam.items.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "fam__item";
        var name = document.createElement("div");
        name.className = "fam__name";
        name.textContent = item.name;
        var desc = document.createElement("div");
        desc.className = "fam__desc";
        desc.innerHTML = escapeHtml(item.desc) + "<span class='fam__sig'>" + escapeHtml(item.sig) + "</span>";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "copy-btn";
        btn.textContent = "COPY";
        btn.setAttribute("aria-label", "Copy feature name " + item.name);
        btn.addEventListener("click", function () { copyText(item.name, "COPIED: " + item.name); });
        li.appendChild(name);
        li.appendChild(desc);
        li.appendChild(btn);
        ul.appendChild(li);
      });
      box.appendChild(ul);
      wrap.appendChild(box);
    });
  }

  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 3) return NaN;
    var sx = 0, sy = 0;
    for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
    var mx = sx / n, my = sy / n;
    var num = 0, dx = 0, dy = 0;
    for (i = 0; i < n; i++) {
      var a = xs[i] - mx, b = ys[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    var den = Math.sqrt(dx * dy);
    return den === 0 ? NaN : num / den;
  }

  var corrDone = false;
  function ensureCorrelations() {
    var statusEl = $("corr-status");
    var wrap = $("corr-wrap");
    var empty = $("corr-empty");
    if (corrDone && wrap && !wrap.hidden) return;

    if (!state.rows.length) {
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = false;
      if (statusEl) statusEl.textContent = "";
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.hidden = false;
    if (statusEl) statusEl.textContent = "COMPUTING PEARSON CORRELATIONS OVER " + state.rows.length + " ROWS...";

    var numericCols = state.headers.filter(function (h) { return h !== "index" && h !== "Target"; });
    var target = state.rows.map(function (r) { return r.Target; });
    var tbody = $("corr-table") ? $("corr-table").querySelector("tbody") : null;
    if (!tbody) return;
    tbody.innerHTML = "";

    function addRow(col, isTarget) {
      var vals = [], pairsX = [], pairsY = [];
      state.rows.forEach(function (r, i) {
        var v = r[col];
        if (typeof v === "number" && !isNaN(v)) {
          vals.push(v);
          if (typeof target[i] === "number") { pairsX.push(v); pairsY.push(target[i]); }
        }
      });
      var mean = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : NaN;
      var r = isTarget ? NaN : pearson(pairsX, pairsY);
      var tr = document.createElement("tr");
      var corrCell = isTarget ? "— (this is the target)" : (isNaN(r) ? "n/a" : (r >= 0 ? '<span class="corr-pos">' : '<span class="corr-neg">') + r.toFixed(4) + "</span>");
      tr.innerHTML =
        "<td><code>" + escapeHtml(col) + "</code></td>" +
        "<td>" + (isTarget ? "binary up/down label" : "keyword series (adjusted 0–1)") + "</td>" +
        "<td>" + vals.length + "</td>" +
        "<td>" + (vals.length ? Math.min.apply(null, vals).toFixed(3) : "—") + "</td>" +
        "<td>" + (vals.length ? Math.max.apply(null, vals).toFixed(3) : "—") + "</td>" +
        "<td>" + (isNaN(mean) ? "—" : mean.toFixed(4)) + "</td>" +
        "<td>" + corrCell + "</td>";
      tbody.appendChild(tr);
    }

    addRow("Target", true);
    numericCols.forEach(function (c) { addRow(c, false); });

    corrDone = true;
    if (statusEl) statusEl.textContent = "DONE — correlations computed client-side from " + state.rows.length + " rows of " + DATASETS[state.dsKey].label + " (Pearson).";
  }

  /* ---------- keywords tab ---------- */
  function renderKeywords() {
    var grid = $("keyword-grid");
    if (!grid) return;
    KEYWORDS.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = k;
      b.addEventListener("click", function () { copyText(k, "COPIED: " + k); });
      grid.appendChild(b);
    });
    var raw = $("raw-files");
    if (raw) {
      RAW_DAILY_SAMPLE.forEach(function (f) {
        var s = document.createElement("span");
        s.className = "chip";
        s.textContent = f;
        raw.appendChild(s);
      });
      var more = document.createElement("span");
      more.className = "chip";
      more.style.borderColor = "rgba(255,179,0,0.4)";
      more.style.color = "#ffb300";
      more.textContent = "… 93 files total (one per keyword)";
      raw.appendChild(more);
    }
  }

  /* ---------- init ---------- */
  function init() {
    initTabs();
    initClock();
    renderFeatureFamilies();
    renderKeywords();

    document.querySelectorAll(".chip--ds").forEach(function (b) {
      b.addEventListener("click", function () { loadDataset(b.getAttribute("data-ds")); });
    });
    var retry = $("btn-retry");
    if (retry) retry.addEventListener("click", function () { loadDataset(state.dsKey); });
    var dl = $("btn-download-csv");
    if (dl) dl.addEventListener("click", downloadView);
    var all = $("btn-chips-all");
    if (all) all.addEventListener("click", function () { setAllChips(function () { return true; }); });
    var kws = $("btn-chips-keywords");
    if (kws) kws.addEventListener("click", function () {
      setAllChips(function (h) { return h !== "Target" && h !== "lag_1"; });
    });
    var none = $("btn-chips-none");
    if (none) none.addEventListener("click", function () { setAllChips(function () { return false; }); });
    var copyKw = $("btn-copy-keywords");
    if (copyKw) copyKw.addEventListener("click", function () { copyText(KEYWORDS.join("\n"), "COPIED 93 KEYWORDS"); });
    document.querySelectorAll(".copy-btn[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () { copyText(b.getAttribute("data-copy"), "COMMANDS COPIED"); });
    });

    loadDataset("daily");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
