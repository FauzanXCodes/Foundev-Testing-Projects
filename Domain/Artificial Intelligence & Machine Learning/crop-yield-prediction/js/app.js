/* YieldSight — static console for the PyCrop crop-yield-prediction repo.
   The repository has no HTTP server, no bundled weights, and no processed
   histograms, so every number drawn here is a deterministic in-browser
   SAMPLE series — always labelled as such — and "Run prediction" only
   explains what a real pipeline run requires. */
(function () {
  "use strict";

  var LS_KEY = "yieldsight.console.v1";

  var REGIONS = [
    "Story County, Iowa", "Kossuth County, Iowa", "Palo Alto County, Iowa",
    "Sioux County, Iowa", "Plymouth County, Iowa",
    "McLean County, Illinois", "Champaign County, Illinois", "Iroquois County, Illinois",
    "LaSalle County, Illinois",
    "Renville County, Minnesota", "Martin County, Minnesota", "Freeborn County, Minnesota",
    "Polk County, Minnesota",
    "Hamilton County, Nebraska", "Merrick County, Nebraska", "York County, Nebraska",
    "White County, Indiana", "Jasper County, Indiana", "Pulaski County, Indiana",
    "Darke County, Ohio", "Pickaway County, Ohio",
    "Knox County, Missouri", "Adair County, Missouri",
    "Cass County, North Dakota", "Grand Forks County, North Dakota",
    "Minnehaha County, South Dakota", "Brookings County, South Dakota",
    "Poinsett County, Arkansas", "Cross County, Arkansas",
    "Washington County, Mississippi", "Bolivar County, Mississippi",
    "Iowa", "Illinois", "Minnesota", "Nebraska", "Indiana"
  ];

  var TRAIN_YEARS = { start: 2009, end: 2015 };

  var state = {
    region: "Story County, Iowa",
    y0: 2008,
    y1: 2024,
    model: "cnn",
    gp: true,
    bins: 32,
    tab: "forecast",
    show: { actual: true, predicted: true, band: true },
    series: [],
    metrics: null,
    hoverIndex: -1
  };

  /* ---------- helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function toast(message) {
    var node = $("toast");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () { node.hidden = true; }, 2200);
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function copyText(text, okMessage) {
    function fallback() {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(area);
      toast(ok ? okMessage : "Copy failed — select the text manually");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMessage); }, fallback);
    } else {
      fallback();
    }
  }

  function hashStr(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- deterministic sample series ---------- */

  function computeSeries() {
    var out = [];
    var base = 36 + (hashStr(state.region) % 160) / 10;
    var phase = (hashStr(state.region + ":phase") % 628) / 100;
    var errScale = (state.model === "cnn" ? 1.35 : 1.55) * (state.gp ? 0.85 : 1);
    var halfBase = state.gp ? 1.0 : 1.5;
    var span = Math.max(1, state.y1 - state.y0);

    for (var y = state.y0; y <= state.y1; y++) {
      var rActual = mulberry32(hashStr(state.region + ":" + y));
      var actual = base + (y - 2000) * 0.12 + Math.sin(y * 0.9 + phase) * 1.6 + (rActual() - 0.5) * 3.2;

      var rPred = mulberry32(hashStr(state.model + (state.gp ? "|gp" : "") + state.region + ":" + y));
      var predicted = actual + (rPred() - 0.5) * 2 * errScale;

      var edge = 0;
      if (y < TRAIN_YEARS.start) edge = TRAIN_YEARS.start - y;
      if (y > TRAIN_YEARS.end) edge = y - TRAIN_YEARS.end;
      var rBand = mulberry32(hashStr("band" + state.region + ":" + y));
      var half = halfBase + (edge / span) * 2.4 + (rBand() - 0.5) * 0.4;

      out.push({
        year: y,
        actual: round1(actual),
        predicted: round1(predicted),
        lower: round1(predicted - half),
        upper: round1(predicted + half)
      });
    }
    return out;
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  function computeMetrics(series) {
    if (!series.length) return null;
    var n = series.length;
    var se = 0, ae = 0, mean = 0, sst = 0;
    series.forEach(function (p) { mean += p.actual; });
    mean /= n;
    series.forEach(function (p) {
      var d = p.predicted - p.actual;
      se += d * d;
      ae += Math.abs(d);
      sst += (p.actual - mean) * (p.actual - mean);
    });
    var rmse = Math.sqrt(se / n);
    var mae = ae / n;
    var r2 = sst > 1e-9 ? 1 - se / sst : null;
    return { rmse: rmse, mae: mae, r2: r2 };
  }

  /* ---------- chart ---------- */

  var chart = {
    ctx: null,
    canvas: null,
    frame: null,
    tip: null,
    width: 0,
    height: 0,
    plot: null
  };

  var COLORS = {
    grid: "rgba(64,45,28,0.18)",
    axis: "rgba(64,45,28,0.55)",
    text: "#7c6c50",
    actual: "#4d6b2b",
    predicted: "#a86a00",
    band: "rgba(217,142,4,0.18)",
    bandEdge: "rgba(217,142,4,0.45)",
    hover: "rgba(64,45,28,0.35)"
  };

  function initChart() {
    chart.canvas = $("yield-chart");
    chart.frame = $("chart-frame");
    chart.tip = $("chart-tip");
    if (!chart.canvas || !chart.frame) return;
    try {
      chart.ctx = chart.canvas.getContext("2d");
    } catch (e) {
      chart.ctx = null;
    }
    if (!chart.ctx) {
      var fallback = $("chart-fallback");
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = "This browser cannot create a canvas surface, so the chart cannot be drawn. " +
          "The tables and exports below still work.";
      }
      if (chart.canvas) chart.canvas.style.display = "none";
      return;
    }

    chart.canvas.addEventListener("mousemove", onChartMove);
    chart.canvas.addEventListener("mouseleave", function () {
      state.hoverIndex = -1;
      if (chart.tip) chart.tip.hidden = true;
      drawChart();
    });
    chart.canvas.addEventListener("touchstart", onChartTouch, { passive: true });
    chart.canvas.addEventListener("touchmove", onChartTouch, { passive: true });

    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () { measureAndDraw(); });
      ro.observe(chart.frame);
    } else {
      window.addEventListener("resize", measureAndDraw);
    }
    measureAndDraw();
  }

  function measureAndDraw() {
    if (!chart.ctx || !chart.frame) return;
    var rect = chart.frame.getBoundingClientRect();
    chart.width = Math.max(200, Math.round(rect.width));
    chart.height = Math.max(160, Math.round(rect.height));
    var dpr = window.devicePixelRatio || 1;
    chart.canvas.width = Math.round(chart.width * dpr);
    chart.canvas.height = Math.round(chart.height * dpr);
    chart.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  }

  function computePlot() {
    var series = state.series;
    var padL = 54, padR = 18, padT = 16, padB = 34;
    var plotW = chart.width - padL - padR;
    var plotH = chart.height - padT - padB;

    var yMin = Infinity, yMax = -Infinity;
    series.forEach(function (p) {
      if (state.show.band) {
        yMin = Math.min(yMin, p.lower);
        yMax = Math.max(yMax, p.upper);
      }
      if (state.show.actual) {
        yMin = Math.min(yMin, p.actual);
        yMax = Math.max(yMax, p.actual);
      }
      if (state.show.predicted) {
        yMin = Math.min(yMin, p.predicted);
        yMax = Math.max(yMax, p.predicted);
      }
    });
    if (!isFinite(yMin)) { yMin = 30; yMax = 60; }
    if (yMax - yMin < 4) { var mid = (yMax + yMin) / 2; yMin = mid - 2; yMax = mid + 2; }
    var padY = (yMax - yMin) * 0.12;
    yMin -= padY;
    yMax += padY;

    var n = series.length;
    function xOf(year) {
      if (n <= 1) return padL + plotW / 2;
      return padL + ((year - state.y0) / (state.y1 - state.y0 || 1)) * plotW;
    }
    function yOf(val) {
      return padT + (1 - (val - yMin) / (yMax - yMin)) * plotH;
    }
    return { padL: padL, padR: padR, padT: padT, padB: padB, plotW: plotW, plotH: plotH, yMin: yMin, yMax: yMax, xOf: xOf, yOf: yOf };
  }

  function drawChart() {
    if (!chart.ctx || !state.series.length) return;
    var ctx = chart.ctx;
    var p = computePlot();
    chart.plot = p;
    ctx.clearRect(0, 0, chart.width, chart.height);

    // gridlines + y labels
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    var steps = 5;
    for (var i = 0; i <= steps; i++) {
      var val = p.yMin + ((p.yMax - p.yMin) * i) / steps;
      var y = p.yOf(val);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(p.padL, y);
      ctx.lineTo(p.padL + p.plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(val.toFixed(0), p.padL - 8, y);
    }

    // x labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    var n = state.series.length;
    var every = Math.max(1, Math.ceil(n / 9));
    state.series.forEach(function (pt, idx) {
      if (idx % every !== 0 && idx !== n - 1) return;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(String(pt.year), p.xOf(pt.year), p.padT + p.plotH + 8);
    });

    // axis lines
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.padL, p.padT);
    ctx.lineTo(p.padL, p.padT + p.plotH);
    ctx.lineTo(p.padL + p.plotW, p.padT + p.plotH);
    ctx.stroke();

    // uncertainty band
    if (state.show.band) {
      ctx.beginPath();
      state.series.forEach(function (pt, idx) {
        var x = p.xOf(pt.year), y = p.yOf(pt.upper);
        if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      for (var j = state.series.length - 1; j >= 0; j--) {
        var pt2 = state.series[j];
        ctx.lineTo(p.xOf(pt2.year), p.yOf(pt2.lower));
      }
      ctx.closePath();
      ctx.fillStyle = COLORS.band;
      ctx.fill();
      ctx.strokeStyle = COLORS.bandEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // actual line
    if (state.show.actual) {
      drawSeries(ctx, p, "actual", COLORS.actual, false, 2.2);
    }

    // predicted line
    if (state.show.predicted) {
      drawSeries(ctx, p, "predicted", COLORS.predicted, true, 2);
    }

    // hover marker
    if (state.hoverIndex >= 0 && state.hoverIndex < state.series.length) {
      var hp = state.series[state.hoverIndex];
      var hx = p.xOf(hp.year);
      ctx.strokeStyle = COLORS.hover;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, p.padT);
      ctx.lineTo(hx, p.padT + p.plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      if (state.show.actual) dot(ctx, hx, p.yOf(hp.actual), COLORS.actual);
      if (state.show.predicted) dot(ctx, hx, p.yOf(hp.predicted), COLORS.predicted);
    }
  }

  function drawSeries(ctx, p, key, color, dashed, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [7, 5] : []);
    ctx.beginPath();
    state.series.forEach(function (pt, idx) {
      var x = p.xOf(pt.year), y = p.yOf(pt[key]);
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    state.series.forEach(function (pt) {
      dot(ctx, p.xOf(pt.year), p.yOf(pt[key]), color);
    });
  }

  function dot(ctx, x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function pointerYear(evt, canvasEl) {
    var rect = canvasEl.getBoundingClientRect();
    var x = (evt.clientX != null ? evt.clientX : 0) - rect.left;
    if (!state.series.length || !chart.plot) return -1;
    var p = chart.plot;
    var n = state.series.length;
    if (n === 1) return 0;
    var frac = (x - p.padL) / (p.plotW || 1);
    var year = state.y0 + frac * (state.y1 - state.y0);
    var idx = Math.round(year - state.y0);
    return Math.max(0, Math.min(n - 1, idx));
  }

  function onChartMove(evt) {
    handleHover(evt, chart.canvas);
  }

  function onChartTouch(evt) {
    if (!evt.touches || !evt.touches.length) return;
    handleHover(evt.touches[0], chart.canvas);
  }

  function handleHover(evt, canvasEl) {
    var idx = pointerYear(evt, canvasEl);
    if (idx < 0) return;
    state.hoverIndex = idx;
    drawChart();
    showTip(idx, canvasEl);
  }

  function showTip(idx, canvasEl) {
    var tip = chart.tip;
    if (!tip || !chart.plot) return;
    var pt = state.series[idx];
    var lines = [];
    lines.push('<span class="tip-year">' + pt.year + "</span>");
    lines.push("Region: " + escapeHTML(state.region));
    if (state.show.actual) lines.push("Actual: " + pt.actual.toFixed(1) + " bu/ac");
    if (state.show.predicted) lines.push("Predicted: " + pt.predicted.toFixed(1) + " bu/ac");
    if (state.show.band) lines.push("Band: " + pt.lower.toFixed(1) + " – " + pt.upper.toFixed(1));
    lines.push('<span class="tip-sample">illustrative sample — not a model output</span>');
    tip.innerHTML = lines.join("<br>");
    tip.hidden = false;

    var p = chart.plot;
    var x = p.xOf(pt.year);
    var y = p.yOf(state.show.actual ? pt.actual : pt.predicted);
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    var left = x + 14;
    if (left + tw > chart.width - 6) left = x - tw - 14;
    if (left < 6) left = 6;
    var top = y - th - 12;
    if (top < 6) top = y + 14;
    if (top + th > chart.height - 6) top = chart.height - th - 6;
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }

  /* ---------- recompute flow ---------- */

  var recomputeTimer = null;

  function recompute(animate) {
    state.series = computeSeries();
    state.metrics = computeMetrics(state.series);
    renderMetrics();
    renderSession();
    updateSubtitle();

    var loading = $("chart-loading");
    if (animate && !reducedMotion() && loading) {
      loading.hidden = false;
      window.clearTimeout(recomputeTimer);
      recomputeTimer = window.setTimeout(function () {
        loading.hidden = true;
        state.hoverIndex = -1;
        if (chart.tip) chart.tip.hidden = true;
        measureAndDraw();
      }, 260);
    } else {
      if (loading) loading.hidden = true;
      state.hoverIndex = -1;
      if (chart.tip) chart.tip.hidden = true;
      measureAndDraw();
    }
    saveState();
  }

  function renderMetrics() {
    var m = state.metrics;
    var rmseEl = $("metric-rmse");
    var maeEl = $("metric-mae");
    var r2El = $("metric-r2");
    if (!m) {
      if (rmseEl) rmseEl.textContent = "—";
      if (maeEl) maeEl.textContent = "—";
      if (r2El) r2El.textContent = "—";
      return;
    }
    if (rmseEl) rmseEl.textContent = m.rmse.toFixed(2);
    if (maeEl) maeEl.textContent = m.mae.toFixed(2);
    if (r2El) r2El.textContent = m.r2 == null ? "—" : m.r2.toFixed(2);
  }

  function updateSubtitle() {
    var sub = $("chart-subtitle");
    if (sub) sub.textContent = state.region + " · bushels per acre · " + state.y0 + "–" + state.y1;
  }

  function renderSession() {
    var regionEl = $("session-region");
    var yearsEl = $("session-years");
    var modelEl = $("session-model");
    var gpEl = $("session-gp");
    if (regionEl) regionEl.textContent = state.region;
    if (yearsEl) yearsEl.textContent = state.y0 + "–" + state.y1;
    if (modelEl) modelEl.textContent = state.model === "cnn" ? "CNN" : "RNN";
    if (gpEl) gpEl.textContent = state.gp ? "on (use_gp=True)" : "off (use_gp=False)";
  }

  function updateCommands() {
    var engineerCmd = "python run.py engineer --num_bins " + state.bins;
    var trainCmd = "python run.py train_" + state.model + (state.gp ? " --use_gp True" : " --use_gp False");
    var eng = $("cmd-engineer");
    var tr = $("cmd-train");
    var miniEng = $("mini-engineer-cmd");
    var miniTr = $("mini-train-cmd");
    var note = $("engineer-bins-note");
    if (eng) eng.textContent = engineerCmd;
    if (tr) tr.textContent = trainCmd;
    if (miniEng) miniEng.textContent = engineerCmd;
    if (miniTr) miniTr.textContent = trainCmd;
    if (note) note.textContent = String(state.bins);
  }

  /* ---------- tabs ---------- */

  var TABS = ["forecast", "pipeline", "method"];

  function switchTab(name, focusTab) {
    if (TABS.indexOf(name) === -1) return;
    state.tab = name;
    TABS.forEach(function (t) {
      var btn = $("tab-" + t);
      var panel = $("panel-" + t);
      if (btn) {
        var selected = t === name;
        btn.setAttribute("aria-selected", selected ? "true" : "false");
        btn.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) btn.focus();
      }
      if (panel) panel.hidden = t !== name;
    });
    if (name === "forecast") {
      window.setTimeout(measureAndDraw, 30);
    }
    saveState();
  }

  function setupTabs() {
    TABS.forEach(function (t) {
      var btn = $("tab-" + t);
      if (!btn) return;
      btn.addEventListener("click", function () { switchTab(t, false); });
      btn.addEventListener("keydown", function (e) {
        var idx = TABS.indexOf(t);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          switchTab(TABS[(idx + 1) % TABS.length], true);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          switchTab(TABS[(idx - 1 + TABS.length) % TABS.length], true);
        } else if (e.key === "Home") {
          e.preventDefault();
          switchTab(TABS[0], true);
        } else if (e.key === "End") {
          e.preventDefault();
          switchTab(TABS[TABS.length - 1], true);
        }
      });
    });
  }

  /* ---------- CSV export ---------- */

  function exportCSV() {
    if (!state.series.length) {
      toast("Nothing charted yet");
      return;
    }
    var safeRegion = state.region.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "region";
    var rows = [];
    rows.push("region,year,model,use_gp,series_type,actual_bu_ac,predicted_bu_ac,band_lower_bu_ac,band_upper_bu_ac");
    state.series.forEach(function (p) {
      rows.push([
        csvEscape(state.region),
        p.year,
        state.model,
        state.gp,
        "illustrative_sample",
        p.actual.toFixed(1),
        p.predicted.toFixed(1),
        p.lower.toFixed(1),
        p.upper.toFixed(1)
      ].join(","));
    });
    var blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "yieldsight-sample-" + safeRegion + "-" + state.y0 + "-" + state.y1 + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Sample series CSV downloaded");
  }

  function csvEscape(value) {
    var s = String(value);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ---------- persistence ---------- */

  function saveState() {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        region: state.region,
        y0: state.y0,
        y1: state.y1,
        model: state.model,
        gp: state.gp,
        bins: state.bins,
        tab: state.tab,
        show: state.show
      }));
    } catch (e) { /* storage unavailable */ }
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (typeof saved.region === "string" && saved.region.trim()) state.region = saved.region;
      if (typeof saved.y0 === "number") state.y0 = clamp(saved.y0, 2000, 2024);
      if (typeof saved.y1 === "number") state.y1 = clamp(saved.y1, 2000, 2024);
      if (state.y0 > state.y1) { var t = state.y0; state.y0 = state.y1; state.y1 = t; }
      if (saved.model === "cnn" || saved.model === "rnn") state.model = saved.model;
      if (typeof saved.gp === "boolean") state.gp = saved.gp;
      if ([16, 32, 64].indexOf(saved.bins) !== -1) state.bins = saved.bins;
      if (TABS.indexOf(saved.tab) !== -1) state.tab = saved.tab;
      if (saved.show && typeof saved.show === "object") {
        state.show = {
          actual: saved.show.actual !== false,
          predicted: saved.show.predicted !== false,
          band: saved.show.band !== false
        };
      }
    } catch (e) { /* ignore corrupt state */ }
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------- controls wiring ---------- */

  function setupControls() {
    var regionInput = $("region-input");
    var datalist = $("region-list");
    if (datalist) {
      REGIONS.forEach(function (r) {
        var opt = document.createElement("option");
        opt.value = r;
        datalist.appendChild(opt);
      });
    }
    if (regionInput) {
      regionInput.value = state.region;
      regionInput.addEventListener("change", function () {
        var v = regionInput.value.trim();
        var err = $("run-error");
        if (!v) {
          if (err) {
            err.textContent = "Enter a county or state name — it seeds the illustrative series.";
            err.hidden = false;
          }
          regionInput.value = state.region;
          return;
        }
        if (err) err.hidden = true;
        state.region = v;
        recompute(true);
      });
      regionInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          regionInput.blur();
        }
      });
    }

    var yFrom = $("year-from");
    var yTo = $("year-to");
    var yFromLabel = $("year-from-label");
    var yToLabel = $("year-to-label");

    function syncYears(source) {
      var a = parseInt(yFrom.value, 10);
      var b = parseInt(yTo.value, 10);
      if (a > b) {
        if (source === "from") { b = a; yTo.value = String(b); }
        else { a = b; yFrom.value = String(a); }
      }
      state.y0 = a;
      state.y1 = b;
      if (yFromLabel) yFromLabel.textContent = String(a);
      if (yToLabel) yToLabel.textContent = String(b);
      recompute(true);
    }

    if (yFrom) {
      yFrom.value = String(state.y0);
      yFrom.addEventListener("input", function () { syncYears("from"); });
    }
    if (yTo) {
      yTo.value = String(state.y1);
      yTo.addEventListener("input", function () { syncYears("to"); });
    }
    if (yFromLabel) yFromLabel.textContent = String(state.y0);
    if (yToLabel) yToLabel.textContent = String(state.y1);

    var modelSelect = $("model-select");
    if (modelSelect) {
      modelSelect.value = state.model;
      modelSelect.addEventListener("change", function () {
        state.model = modelSelect.value;
        updateCommands();
        recompute(true);
      });
    }

    var gpToggle = $("gp-toggle");
    if (gpToggle) {
      gpToggle.checked = state.gp;
      gpToggle.addEventListener("change", function () {
        state.gp = gpToggle.checked;
        updateCommands();
        recompute(true);
      });
    }

    var binsSelect = $("bins-select");
    if (binsSelect) {
      binsSelect.value = String(state.bins);
      binsSelect.addEventListener("change", function () {
        state.bins = parseInt(binsSelect.value, 10) || 32;
        updateCommands();
        saveState();
      });
    }

    var runBtn = $("btn-run");
    if (runBtn) {
      runBtn.addEventListener("click", function () {
        var err = $("run-error");
        var regionInputNow = $("region-input");
        var regionVal = regionInputNow ? regionInputNow.value.trim() : "";
        if (!regionVal) {
          if (err) {
            err.textContent = "Enter a county or state name first — it seeds the illustrative series.";
            err.hidden = false;
          }
          if (regionInputNow) regionInputNow.focus();
          return;
        }
        if (err) err.hidden = true;
        state.region = regionVal;
        recompute(false);
        switchTab("pipeline", false);
        var card = $("backend-card");
        if (card) {
          card.focus();
          card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" });
        }
        toast("No backend here — showing the real pipeline stages");
      });
    }

    var gotoPipeline = $("btn-goto-pipeline");
    if (gotoPipeline) {
      gotoPipeline.addEventListener("click", function () { switchTab("pipeline", true); });
    }

    var csvBtn = $("btn-csv");
    if (csvBtn) csvBtn.addEventListener("click", exportCSV);

    document.querySelectorAll(".legend-toggle").forEach(function (btn) {
      var key = btn.getAttribute("data-series");
      if (key && Object.prototype.hasOwnProperty.call(state.show, key)) {
        btn.classList.toggle("is-on", state.show[key]);
        btn.setAttribute("aria-pressed", state.show[key] ? "true" : "false");
      }
      btn.addEventListener("click", function () {
        if (!key || !Object.prototype.hasOwnProperty.call(state.show, key)) return;
        state.show[key] = !state.show[key];
        btn.classList.toggle("is-on", state.show[key]);
        btn.setAttribute("aria-pressed", state.show[key] ? "true" : "false");
        drawChart();
        saveState();
      });
    });

    document.querySelectorAll(".btn-copy[data-copy-cmd]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-copy-cmd");
        var target = targetId ? $(targetId) : null;
        if (target && target.textContent) {
          copyText(target.textContent, "Command copied");
        }
      });
    });
  }

  /* ---------- boot ---------- */

  loadState();
  setupTabs();
  setupControls();
  updateCommands();
  initChart();
  switchTab(state.tab, false);
  recompute(false);
})();
