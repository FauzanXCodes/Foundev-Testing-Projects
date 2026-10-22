(function () {
  "use strict";

  var FEATURES = 30;
  var LS_API = "fraudguard.apiBase";
  var LS_TH = "fraudguard.threshold";
  var LS_LOG = "fraudguard.auditLog";
  var LOG_CAP = 200;
  var REQ_TIMEOUT = 20000;
  var PROBE_TIMEOUT = 8000;

  var SAMPLE_ROW = [
    118.0, 1.0,
    -0.35, 1.12, -0.27, 0.86, -0.11, -0.44, 0.62, -0.19, 1.28, -0.85,
    -0.02, 0.71, -1.06, 0.14, -0.22, 1.33, -0.05, 0.08, 0.17, 0.03,
    0.01, -0.14, 0.12, 0.06, -0.09, 0.04,
    89.99, 1.0
  ];

  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  var lastScore = null;
  var lastReqBody = null;
  var batchState = null;   /* { rows:[[..]], scores:[..] } */
  var sortDir = null;      /* null | "desc" | "asc" */
  var auditLog = [];

  /* ── safe storage ─────────────────────────────────────── */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }

  /* ── helpers ──────────────────────────────────────────── */
  function apiBase() {
    var v = (els.apiBase.value || "").trim().replace(/\/+$/, "");
    return v || "http://127.0.0.1:5000";
  }

  var NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
  function parseNum(s) {
    if (typeof s !== "string") return NaN;
    var t = s.trim();
    if (!t || !NUM_RE.test(t)) return NaN;
    var n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  function getThreshold() {
    var v = parseFloat(els.threshold.value);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  }

  function bandFor(score) {
    var t = getThreshold();
    if (score >= t) return "HIGH";
    if (score >= t / 2) return "MEDIUM";
    return "LOW";
  }

  function clamp01(x) { return Math.min(1, Math.max(0, x)); }

  function fetchTimed(url, opts, ms) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || REQ_TIMEOUT);
    var o = Object.assign({}, opts);
    if (ctl) o.signal = ctl.signal;
    return fetch(url, o).finally(function () { clearTimeout(timer); });
  }

  function showErr(el, msg) { el.textContent = msg; el.hidden = false; }
  function clearErr(el) { el.textContent = ""; el.hidden = true; }

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt);
    }
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea");
      ta.value = txt;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? res() : rej(new Error("copy failed"));
    });
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ── status LED ───────────────────────────────────────── */
  function setStatus(state, note) {
    els.statusDot.className = "led led-" + state;
    var labels = { unknown: "UNKNOWN", checking: "CHECKING", on: "ONLINE", off: "OFFLINE" };
    var colors = { unknown: "", checking: "var(--accent)", on: "var(--ok)", off: "var(--danger)" };
    els.statusText.textContent = labels[state] || "UNKNOWN";
    els.statusText.style.color = colors[state] || "";
    els.statusNote.textContent = note || "";
  }

  function markOnline(note) {
    setStatus("on", note);
    els.setupPanel.hidden = true;
  }

  function markOffline(note) {
    setStatus("off", note);
    els.setupUrl.textContent = apiBase();
    els.setupPanel.hidden = false;
  }

  /* Flask exposes no /health — POST a deliberately empty payload:
     any HTTP reply (400 "No feature values available", …) proves the
     service is reachable; only a network failure means offline. */
  function probe(manual) {
    setStatus("checking", "POST " + apiBase() + "/predict (empty probe)");
    var body = JSON.stringify({ features: [] });
    return fetchTimed(apiBase() + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    }, PROBE_TIMEOUT).then(function (res) {
      markOnline("reachable · probe HTTP " + res.status);
    }).catch(function () {
      markOffline(manual ? "probe failed — unreachable or browser-blocked" : "not reachable — train & start the API");
    });
  }

  /* ── gauge ────────────────────────────────────────────── */
  function updateThMarker() {
    var t = getThreshold();
    var cx = 110, cy = 115, r = 90;
    var phi = Math.PI * (1 - t);
    var x1 = cx + (r - 12) * Math.cos(phi), y1 = cy - (r - 12) * Math.sin(phi);
    var x2 = cx + (r + 12) * Math.cos(phi), y2 = cy - (r + 12) * Math.sin(phi);
    els.thLine.setAttribute("x1", x1.toFixed(1));
    els.thLine.setAttribute("y1", y1.toFixed(1));
    els.thLine.setAttribute("x2", x2.toFixed(1));
    els.thLine.setAttribute("y2", y2.toFixed(1));
  }

  var BAND_COLOR = { LOW: "var(--ok)", MEDIUM: "var(--accent)", HIGH: "var(--danger)" };

  function paintGauge(score) {
    els.gaugeFill.style.strokeDashoffset = String(100 - clamp01(score) * 100);
    els.gaugeFill.style.stroke = BAND_COLOR[bandFor(score)];
  }

  function resetGauge() {
    els.gaugeFill.style.strokeDashoffset = "100";
    els.gaugeFill.style.stroke = "";
  }

  function renderScore(score) {
    lastScore = score;
    els.scoreValue.textContent = score.toFixed(4);
    var band = bandFor(score);
    els.bandChip.textContent = band;
    els.bandChip.className = "band-chip band-" + band.toLowerCase();
    paintGauge(score);
  }

  function refreshStoredBands() {
    if (lastScore !== null) renderScore(lastScore);
    renderBatch();
    renderAudit();
  }

  /* ── threshold UI ─────────────────────────────────────── */
  function updateThresholdUI() {
    var t = getThreshold();
    var half = (t / 2);
    els.thresholdValue.textContent = t.toFixed(2);
    els.thLow.textContent = half.toFixed(2);
    els.thRange.textContent = half.toFixed(2) + "–" + t.toFixed(2);
    els.thHigh.textContent = t.toFixed(2);
    document.documentElement.style.setProperty("--thpct", (clamp01(t) * 100).toFixed(1) + "%");
    updateThMarker();
    lsSet(LS_TH, String(t));
    refreshStoredBands();
  }

  /* ── single transaction form ──────────────────────────── */
  function featureInput(i) { return $("f" + i); }

  function collectForm() {
    var values = [], missing = [], invalid = [];
    for (var i = 1; i <= FEATURES; i++) {
      var el = featureInput(i);
      if (!el) { missing.push("F" + i); continue; }
      var n = parseNum(el.value);
      if (el.value.trim() === "") { missing.push("F" + i); }
      else if (!Number.isFinite(n)) { invalid.push("F" + i); }
      else values.push(n);
    }
    return {
      ok: missing.length === 0 && invalid.length === 0,
      values: values,
      missing: missing,
      invalid: invalid
    };
  }

  function clearInvalidMarks() {
    for (var i = 1; i <= FEATURES; i++) {
      var el = featureInput(i);
      if (el) el.classList.remove("is-invalid");
    }
  }

  function markInvalid(ids) {
    ids.forEach(function (id) {
      var el = $(id.replace(/^F/, "f"));
      if (el) el.classList.add("is-invalid");
    });
  }

  function fillFields(nums) {
    for (var i = 1; i <= FEATURES; i++) {
      var el = featureInput(i);
      if (el) el.value = String(nums[i - 1]);
    }
    clearInvalidMarks();
    clearErr(els.formError);
  }

  function applyPasteRow() {
    var raw = els.pasteRow.value || "";
    var tokens = raw.split(/[\s,;]+/).filter(function (t) { return t.length > 0; });
    if (!tokens.length) {
      els.pasteMsg.textContent = "Nothing to parse — paste 30 numbers first.";
      els.pasteMsg.classList.add("is-err");
      return;
    }
    var nums = tokens.map(parseNum);
    var badCount = nums.filter(function (n) { return !Number.isFinite(n); }).length;
    if (tokens.length !== FEATURES || badCount > 0) {
      els.pasteMsg.textContent = "Expected exactly " + FEATURES + " numeric values, got " +
        tokens.length + (badCount ? " (" + badCount + " non-numeric)" : "") + ".";
      els.pasteMsg.classList.add("is-err");
      return;
    }
    fillFields(nums);
    els.pasteMsg.textContent = "Row applied — " + FEATURES + " fields filled.";
    els.pasteMsg.classList.remove("is-err");
  }

  function loadSampleRow() {
    fillFields(SAMPLE_ROW);
    els.pasteMsg.textContent = "SAMPLE ROW LOADED · demo values — not a model output.";
    els.pasteMsg.classList.remove("is-err");
  }

  function clearFields() {
    for (var i = 1; i <= FEATURES; i++) {
      var el = featureInput(i);
      if (el) el.value = "";
    }
    clearInvalidMarks();
    clearErr(els.formError);
    els.pasteRow.value = "";
    els.pasteMsg.textContent = "";
    els.pasteMsg.classList.remove("is-err");
  }

  function submitSingle() {
    var got = collectForm();
    if (!got.ok) {
      clearInvalidMarks();
      markInvalid(got.missing.concat(got.invalid));
      var parts = [];
      if (got.missing.length) parts.push("empty: " + got.missing.join(", "));
      if (got.invalid.length) parts.push("not numeric: " + got.invalid.join(", "));
      showErr(els.formError, "Exactly " + FEATURES + " numeric fields are required — " + parts.join(" · ") + ".");
      return;
    }
    clearErr(els.formError);
    clearInvalidMarks();

    var base = apiBase();
    var req = { features: got.values };
    lastReqBody = req;
    els.reqJson.textContent = JSON.stringify(req);
    els.resJson.textContent = "…";
    els.httpCode.textContent = "";
    clearErr(els.resultError);
    els.scoreBtn.disabled = true;
    setStatus("checking", "POST " + base + "/predict");

    var t0 = Date.now();
    fetchTimed(base + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req)
    }, REQ_TIMEOUT).then(function (res) {
      var latency = Date.now() - t0;
      return res.text().then(function (raw) {
        els.resJson.textContent = raw || "(empty body)";
        els.httpCode.textContent = "HTTP " + res.status;

        var data = null, parseErr = null;
        try { data = JSON.parse(raw); } catch (e) { parseErr = e; }

        if (!res.ok) {
          var msg = (data && data.error) ? data.error : "server returned HTTP " + res.status;
          showErr(els.resultError, "REQUEST REJECTED — " + msg + ". Raw payload shown below.");
          els.scoreValue.textContent = "—";
          resetGauge();
          els.bandChip.textContent = "ERROR";
          els.bandChip.className = "band-chip band-idle";
          els.resultMeta.textContent = "HTTP " + res.status + " · " + latency + " ms · no score returned";
          els.resultSource.textContent = "REJECTED · HTTP " + res.status;
          addLog("single", null, "error", "HTTP " + res.status + ": " + msg);
          markOnline("reachable · HTTP " + res.status);
          return;
        }
        if (parseErr || !data || !Array.isArray(data.scores) || !data.scores.length ||
            typeof data.scores[0] !== "number" || !Number.isFinite(data.scores[0])) {
          showErr(els.resultError, "INVALID JSON — expected {\"scores\":[fraud_probability, …]} from POST /predict. Raw payload shown below.");
          els.scoreValue.textContent = "—";
          resetGauge();
          els.bandChip.textContent = "INVALID";
          els.bandChip.className = "band-chip band-idle";
          els.resultMeta.textContent = "HTTP " + res.status + " · " + latency + " ms · unparseable payload";
          els.resultSource.textContent = "INVALID PAYLOAD";
          addLog("single", null, "error", "invalid JSON payload (HTTP " + res.status + ")");
          markOnline("reachable · HTTP " + res.status);
          return;
        }

        var score = data.scores[0];
        renderScore(score);
        els.resultMeta.textContent = new Date().toLocaleString() + " · " + latency + " ms · HTTP 200 · scores[0]";
        els.resultSource.textContent = "SINGLE TRANSACTION · LIVE API";
        addLog("single", score, "ok", "POST /predict · HTTP 200");
        markOnline("scored · HTTP 200");
      });
    }).catch(function (err) {
      var latency = Date.now() - t0;
      var aborted = err && err.name === "AbortError";
      var msg = aborted
        ? "TIMEOUT — no answer from " + base + "/predict within " + (REQ_TIMEOUT / 1000) + " s."
        : "CONNECTION FAILED — could not reach " + base + "/predict (service down, still training, or blocked by the browser's CORS policy).";
      showErr(els.resultError, msg + " See the setup panel below the top bar.");
      els.scoreValue.textContent = "—";
      resetGauge();
      els.bandChip.textContent = "NO DATA";
      els.bandChip.className = "band-chip band-idle";
      els.resultMeta.textContent = aborted ? "aborted after " + (REQ_TIMEOUT / 1000) + " s" : "network error after " + latency + " ms";
      els.resultSource.textContent = aborted ? "TIMEOUT" : "UNREACHABLE";
      addLog("single", null, "error", aborted ? "timeout" : "connection failed");
      markOffline(aborted ? "timeout" : "connection failed");
    }).finally(function () {
      els.scoreBtn.disabled = false;
    });
  }

  /* ── batch scoring ────────────────────────────────────── */
  function parseBatch() {
    var lines = (els.batchInput.value || "").split(/\r?\n/);
    var rows = [], bad = [];
    lines.forEach(function (line, idx) {
      var t = line.trim();
      if (!t) return;
      var tokens = t.split(/[\s,;]+/).filter(function (x) { return x.length > 0; });
      var nums = tokens.map(parseNum);
      var valid = tokens.length === FEATURES && nums.every(function (n) { return Number.isFinite(n); });
      if (valid) rows.push(nums);
      else bad.push(idx + 1);
    });
    return { rows: rows, bad: bad };
  }

  function scoreBatch() {
    var got = parseBatch();
    if (!got.rows.length) {
      showErr(els.batchError, "No valid rows — each line needs exactly " + FEATURES + " numeric values.");
      els.batchMsg.textContent = "";
      return;
    }
    clearErr(els.batchError);
    var note = "parsed " + got.rows.length + " row(s)" +
      (got.bad.length ? " · skipped invalid line(s) " + got.bad.join(", ") : "") + " · sending as {\"features\":[rows]}";
    els.batchMsg.textContent = note;
    els.batchBtn.disabled = true;
    setStatus("checking", "POST " + apiBase() + "/predict (" + got.rows.length + " rows)");

    var base = apiBase();
    var req = { features: got.rows };
    els.reqJson.textContent = JSON.stringify(req).length > 4000
      ? JSON.stringify({ features: got.rows.length + " rows × " + FEATURES + " values (abbreviated — see CSV export)" })
      : JSON.stringify(req);

    var t0 = Date.now();
    fetchTimed(base + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req)
    }, REQ_TIMEOUT).then(function (res) {
      var latency = Date.now() - t0;
      return res.text().then(function (raw) {
        els.resJson.textContent = raw || "(empty body)";
        els.httpCode.textContent = "HTTP " + res.status;
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { data = null; }

        if (!res.ok) {
          var msg = (data && data.error) ? data.error : "server returned HTTP " + res.status;
          showErr(els.batchError, "BATCH REJECTED — " + msg);
          addLog("batch", null, "error", "HTTP " + res.status + ": " + msg);
          markOnline("reachable · HTTP " + res.status);
          return;
        }
        var scores = data && data.scores;
        if (!Array.isArray(scores) || scores.length !== got.rows.length ||
            scores.some(function (s) { return typeof s !== "number" || !Number.isFinite(s); })) {
          showErr(els.batchError, "INVALID JSON — expected {\"scores\":[…]} with one number per submitted row. Raw payload shown in the JSON viewer.");
          addLog("batch", null, "error", "invalid scores payload");
          markOnline("reachable · HTTP " + res.status);
          return;
        }
        batchState = { rows: got.rows, scores: scores };
        sortDir = null;
        els.sortArrow.textContent = "↕";
        renderBatch();
        els.exportCsv.disabled = false;
        els.resultSource.textContent = "BATCH ×" + got.rows.length + " · LIVE API";
        var max = Math.max.apply(null, scores);
        addLog("batch", max, "ok", "batch ×" + got.rows.length + " rows · " + latency + " ms");
        els.batchMsg.textContent = note + " · answered in " + latency + " ms (HTTP " + res.status + ")";
        markOnline("batch scored · HTTP " + res.status);
      });
    }).catch(function (err) {
      var aborted = err && err.name === "AbortError";
      showErr(els.batchError, aborted
        ? "TIMEOUT — no answer within " + (REQ_TIMEOUT / 1000) + " s."
        : "CONNECTION FAILED — " + base + "/predict is unreachable or blocked by CORS. See the setup panel.");
      addLog("batch", null, "error", aborted ? "timeout" : "connection failed");
      markOffline(aborted ? "timeout" : "connection failed");
    }).finally(function () {
      els.batchBtn.disabled = false;
    });
  }

  function renderBatch() {
    var body = els.batchBody;
    if (!body) return;
    body.textContent = "";
    if (!batchState || !batchState.scores.length) {
      var tr = document.createElement("tr");
      tr.className = "empty-row";
      var td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "No rows scored yet — paste rows above and press SCORE BATCH.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    var order = batchState.scores.map(function (_, i) { return i; });
    if (sortDir === "desc") order.sort(function (a, b) { return batchState.scores[b] - batchState.scores[a]; });
    if (sortDir === "asc") order.sort(function (a, b) { return batchState.scores[a] - batchState.scores[b]; });

    order.forEach(function (rowIdx, k) {
      var score = batchState.scores[rowIdx];
      var band = bandFor(score);
      var tr = document.createElement("tr");
      if (k === 0 && sortDir) tr.className = "is-latest";
      var td1 = document.createElement("td");
      td1.className = "num";
      td1.textContent = String(rowIdx + 1);
      var td2 = document.createElement("td");
      td2.className = "num";
      td2.textContent = score.toFixed(4);
      var td3 = document.createElement("td");
      var chip = document.createElement("span");
      chip.className = "band-chip band-" + band.toLowerCase();
      chip.textContent = band;
      td3.appendChild(chip);
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      body.appendChild(tr);
    });
  }

  function toggleSort() {
    if (!batchState || !batchState.scores.length) return;
    if (sortDir === null) sortDir = "desc";
    else if (sortDir === "desc") sortDir = "asc";
    else sortDir = null;
    els.sortArrow.textContent = sortDir === "desc" ? "↓" : sortDir === "asc" ? "↑" : "↕";
    renderBatch();
  }

  function exportBatchCsv() {
    if (!batchState) return;
    var lines = ["row,score,band"];
    for (var c = 1; c <= FEATURES; c++) lines[0] += ",f" + c;
    batchState.rows.forEach(function (row, i) {
      var score = batchState.scores[i];
      lines.push([i + 1, score.toFixed(6), bandFor(score)].concat(row).map(csvCell).join(","));
    });
    download(stamp("fraudguard-batch") + ".csv", lines.join("\n"));
  }

  /* ── audit log ────────────────────────────────────────── */
  function loadLog() {
    var raw = lsGet(LS_LOG);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(function (e) { return e && typeof e === "object"; }) : [];
    } catch (e) { return []; }
  }

  function stamp(prefix) {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    return prefix + "-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function addLog(mode, score, status, detail) {
    auditLog.unshift({
      t: Date.now(),
      time: new Date().toLocaleString(),
      mode: mode,
      score: score,
      status: status,
      detail: detail
    });
    if (auditLog.length > LOG_CAP) auditLog.length = LOG_CAP;
    lsSet(LS_LOG, JSON.stringify(auditLog));
    renderAudit();
  }

  function renderAudit() {
    els.logCount.textContent = String(auditLog.length);
    els.auditBody.textContent = "";
    if (!auditLog.length) {
      els.auditEmpty.hidden = false;
      return;
    }
    els.auditEmpty.hidden = true;
    auditLog.forEach(function (e) {
      var tr = document.createElement("tr");
      var hasScore = typeof e.score === "number" && Number.isFinite(e.score);
      var band = hasScore ? bandFor(e.score) : "—";
      var cells = [
        e.time || new Date(e.t).toLocaleString(),
        e.mode || "—",
        hasScore ? e.score.toFixed(4) : "—",
        null,
        e.status === "ok" ? "OK" : "ERROR",
        e.detail || ""
      ];
      cells.forEach(function (val, i) {
        var td = document.createElement("td");
        if (i === 2) td.className = "num";
        if (i === 3) {
          var chip = document.createElement("span");
          chip.className = hasScore ? "band-chip band-" + band.toLowerCase() : "band-chip band-idle";
          chip.textContent = band;
          td.appendChild(chip);
        } else {
          td.textContent = val;
        }
        tr.appendChild(td);
      });
      els.auditBody.appendChild(tr);
    });
  }

  function clearAudit() {
    if (!auditLog.length) return;
    if (!window.confirm("Clear all " + auditLog.length + " audit log entries? This cannot be undone.")) return;
    auditLog = [];
    lsSet(LS_LOG, "[]");
    renderAudit();
  }

  function exportAuditCsv() {
    var lines = ["time,mode,score,band,status,detail"];
    auditLog.forEach(function (e) {
      var hasScore = typeof e.score === "number" && Number.isFinite(e.score);
      lines.push([
        e.time || new Date(e.t).toISOString(),
        e.mode,
        hasScore ? e.score.toFixed(6) : "",
        hasScore ? bandFor(e.score) : "",
        e.status,
        e.detail
      ].map(csvCell).join(","));
    });
    download(stamp("fraudguard-audit") + ".csv", lines.join("\n"));
  }

  /* ── tabs / clipboard ─────────────────────────────────── */
  function activateTab(name) {
    var isBatch = name === "batch";
    els.panelBatch.hidden = !isBatch;
    els.panelAudit.hidden = isBatch;
    els.tabBatch.classList.toggle("is-active", isBatch);
    els.tabAudit.classList.toggle("is-active", !isBatch);
    els.tabBatch.setAttribute("aria-selected", isBatch ? "true" : "false");
    els.tabAudit.setAttribute("aria-selected", isBatch ? "false" : "true");
  }

  function copyJson() {
    var txt = "REQUEST (POST /predict)\n" + els.reqJson.textContent +
      "\n\nRESPONSE\n" + els.resJson.textContent;
    var original = "COPY JSON";
    copyText(txt).then(function () {
      els.copyJson.textContent = "COPIED";
      setTimeout(function () { els.copyJson.textContent = original; }, 1400);
    }).catch(function () {
      els.copyJson.textContent = "COPY FAILED";
      setTimeout(function () { els.copyJson.textContent = original; }, 1400);
    });
  }

  /* ── boot ─────────────────────────────────────────────── */
  function init() {
    els = {
      apiBase: $("apiBase"), probeBtn: $("probeBtn"),
      statusDot: $("statusDot"), statusText: $("statusText"), statusNote: $("statusNote"),
      threshold: $("threshold"), thresholdValue: $("thresholdValue"),
      thLow: $("thLow"), thRange: $("thRange"), thHigh: $("thHigh"), thLine: $("thLine"),
      setupPanel: $("setupPanel"), setupUrl: $("setupUrl"), retryBtn: $("retryBtn"),
      pasteRow: $("pasteRow"), pasteApply: $("pasteApply"), pasteMsg: $("pasteMsg"),
      sampleBtn: $("sampleBtn"), txForm: $("txForm"), formError: $("formError"),
      scoreBtn: $("scoreBtn"), clearBtn: $("clearBtn"),
      gaugeFill: $("gaugeFill"), scoreValue: $("scoreValue"), bandChip: $("bandChip"),
      resultMeta: $("resultMeta"), resultError: $("resultError"), resultSource: $("resultSource"),
      jsonViewer: $("jsonViewer"), copyJson: $("copyJson"),
      reqJson: $("reqJson"), resJson: $("resJson"), httpCode: $("httpCode"),
      tabBatch: $("tabBatch"), tabAudit: $("tabAudit"), logCount: $("logCount"),
      panelBatch: $("panel-batch"), panelAudit: $("panel-audit"),
      batchInput: $("batchInput"), batchBtn: $("batchBtn"), batchMsg: $("batchMsg"),
      batchError: $("batchError"), batchBody: $("batchBody"),
      exportCsv: $("exportCsv"), sortScore: $("sortScore"), sortArrow: $("sortArrow"),
      auditBody: $("auditBody"), auditEmpty: $("auditEmpty"),
      exportLog: $("exportLog"), clearLog: $("clearLog")
    };

    var savedApi = lsGet(LS_API);
    if (savedApi) els.apiBase.value = savedApi;
    var savedTh = lsGet(LS_TH);
    if (savedTh !== null && !isNaN(parseFloat(savedTh))) els.threshold.value = savedTh;

    auditLog = loadLog();
    renderAudit();
    renderBatch();
    updateThresholdUI();

    els.apiBase.addEventListener("change", function () {
      lsSet(LS_API, els.apiBase.value.trim());
      els.setupUrl.textContent = apiBase();
      probe(true);
    });
    els.apiBase.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); els.apiBase.blur(); }
    });

    els.probeBtn.addEventListener("click", function () { probe(true); });
    els.retryBtn.addEventListener("click", function () { probe(true); });
    els.threshold.addEventListener("input", updateThresholdUI);

    els.pasteApply.addEventListener("click", applyPasteRow);
    els.pasteRow.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); applyPasteRow(); }
    });
    els.sampleBtn.addEventListener("click", loadSampleRow);
    els.clearBtn.addEventListener("click", clearFields);
    els.txForm.addEventListener("submit", function (e) { e.preventDefault(); submitSingle(); });

    els.batchBtn.addEventListener("click", scoreBatch);
    els.exportCsv.addEventListener("click", exportBatchCsv);
    els.sortScore.addEventListener("click", toggleSort);
    els.tabBatch.addEventListener("click", function () { activateTab("batch"); });
    els.tabAudit.addEventListener("click", function () { activateTab("audit"); });
    els.copyJson.addEventListener("click", copyJson);
    els.exportLog.addEventListener("click", exportAuditCsv);
    els.clearLog.addEventListener("click", clearAudit);

    document.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      var ae = document.activeElement;
      var inBatch = els.panelBatch && !els.panelBatch.hidden && ae && els.panelBatch.contains(ae);
      e.preventDefault();
      if (inBatch) scoreBatch();
      else submitSingle();
    });

    resetGauge();
    probe(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
