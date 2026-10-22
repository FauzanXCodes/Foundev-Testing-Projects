(function () {
  "use strict";

  var STORAGE_KEY = "scu_incidents_v1";
  var ROLE_KEY = "scu_role_v1";
  var TYPES = ["no_helmet", "seatbelt", "wrong_turn"];
  var TYPE_LABELS = { no_helmet: "no_helmet", seatbelt: "seatbelt", wrong_turn: "wrong_turn" };
  var ROLE_LABELS = { officer: "Traffic Officer", admin: "Administrator", public: "Public" };

  var state = {
    role: "officer",
    incidents: [],
    demoTimer: null,
    counters: { no_helmet: 0, seatbelt: 0, wrong_turn: 0 },
    camCounters: {}
  };

  function $(id) { return document.getElementById(id); }
  function $sel(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- toast ---------- */

  var toastTimer = null;
  function toast(msg, isErr) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  /* ---------- clock ---------- */

  function pad(n) { return String(n).padStart(2, "0"); }

  function tickClock() {
    var tEl = $("clockTime");
    var dEl = $("clockDate");
    if (!tEl || !dEl) return;
    var d = new Date();
    tEl.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    dEl.textContent = d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  }

  /* ---------- persistence ---------- */

  function loadIncidents() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveIncidents() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.incidents));
    } catch (e) {
      toast("Could not persist to localStorage (storage full or blocked).", true);
    }
  }

  /* ---------- ids ---------- */

  function nextId(type, source, camera) {
    var prefix = source === "manual" ? "MAN" : "CAM" + camera;
    var key = prefix + type;
    state.camCounters[key] = (state.camCounters[key] || 0) + 1;
    var n = String(state.camCounters[key]).padStart(4, "0");
    return prefix + " / " + type.toUpperCase() + " / " + n;
  }

  /* ---------- counters / gauges ---------- */

  function recomputeCounters() {
    var c = { no_helmet: 0, seatbelt: 0, wrong_turn: 0 };
    for (var i = 0; i < state.incidents.length; i++) {
      var t = state.incidents[i].type;
      if (c[t] !== undefined) c[t]++;
    }
    state.counters = c;
  }

  function renderCounters(pulseType) {
    var map = { no_helmet: "countNoHelmet", seatbelt: "countSeatbelt", wrong_turn: "countWrongTurn" };
    Object.keys(map).forEach(function (t) {
      var el = $(map[t]);
      if (el) el.textContent = String(state.counters[t] || 0);
      var gauge = $sel('.lamp-gauge[data-gauge="' + t + '"]');
      if (gauge) gauge.classList.toggle("is-live", (state.counters[t] || 0) > 0);
      if (pulseType === t && gauge) {
        var lamp = $sel(".lamp-red", gauge);
        if (lamp) {
          lamp.classList.remove("pulse");
          void lamp.offsetWidth;
          lamp.classList.add("pulse");
        }
      }
    });
  }

  /* ---------- incidents ---------- */

  function addIncident(inc) {
    inc.id = nextId(inc.type, inc.source, inc.camera);
    inc.timestamp = inc.timestamp || new Date().toISOString();
    state.incidents.unshift(inc);
    if (state.incidents.length > 300) state.incidents.length = 300;
    recomputeCounters();
    saveIncidents();
    renderCounters(inc.type);
    renderFeed();
    renderLogTable();
    renderStats();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString();
    } catch (e) { return iso; }
  }

  /* ---------- feed render ---------- */

  function renderFeed() {
    var list = $("feedList");
    var empty = $("feedEmpty");
    var countEl = $("feedCount");
    if (!list) return;
    if (countEl) countEl.textContent = String(state.incidents.length);
    list.innerHTML = "";
    if (empty) empty.hidden = state.incidents.length > 0;

    var slice = state.incidents.slice(0, 40);
    for (var i = 0; i < slice.length; i++) {
      var inc = slice[i];
      var card = document.createElement("article");
      card.className = "incident src-" + esc(inc.source);
      card.innerHTML =
        '<div class="incident-top">' +
          '<span class="incident-id">' + esc(inc.id) + "</span>" +
          '<span class="badge badge-' + esc(inc.source) + '">' + (inc.source === "demo" ? "Demo" : "Manual") + "</span>" +
        "</div>" +
        '<div class="incident-meta">' +
          "<span>CAM <b>" + esc(inc.camera) + "</b></span>" +
          "<span>type <b>" + esc(TYPE_LABELS[inc.type] || inc.type) + "</b></span>" +
          "<span>conf <b>" + esc(Number(inc.confidence).toFixed(2)) + "</b></span>" +
          "<span>" + esc(fmtTime(inc.timestamp)) + "</span>" +
          "<span>by <b>" + esc(inc.officer || "system") + "</b></span>" +
        "</div>" +
        (inc.note ? '<p class="incident-note">' + esc(inc.note) + "</p>" : "");
      list.appendChild(card);
    }
  }

  /* ---------- log table ---------- */

  function filteredIncidents() {
    var q = ($("logSearch") && $("logSearch").value || "").trim().toLowerCase();
    var ft = $("logFilterType") ? $("logFilterType").value : "";
    var fs = $("logFilterSource") ? $("logFilterSource").value : "";
    return state.incidents.filter(function (inc) {
      if (ft && inc.type !== ft) return false;
      if (fs && inc.source !== fs) return false;
      if (q) {
        var hay = (inc.id + " " + inc.camera + " " + inc.type + " " + (inc.note || "") + " " + (inc.officer || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderLogTable() {
    var body = $("logTableBody");
    var note = $("logEmptyNote");
    if (!body) return;
    var rows = filteredIncidents();
    body.innerHTML = "";
    if (note) note.hidden = rows.length > 0;
    for (var i = 0; i < rows.length; i++) {
      var inc = rows[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(inc.id) + "</td>" +
        "<td>CAM " + esc(inc.camera) + "</td>" +
        "<td>" + esc(inc.type) + "</td>" +
        "<td>" + esc(Number(inc.confidence).toFixed(2)) + "</td>" +
        "<td>" + esc(fmtTime(inc.timestamp)) + "</td>" +
        "<td>" + esc(inc.officer || "system") + "</td>" +
        "<td>" + (inc.source === "demo" ? '<span class="badge badge-demo">demo</span>' : '<span class="badge badge-manual">manual</span>') + "</td>";
      body.appendChild(tr);
    }
  }

  /* ---------- stats ---------- */

  function renderStats() {
    var typeBox = $("statsTypeBars");
    var camBox = $("statsCameraBars");
    if (!typeBox || !camBox) return;

    var byType = { no_helmet: 0, seatbelt: 0, wrong_turn: 0 };
    var byCam = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (var i = 0; i < state.incidents.length; i++) {
      var inc = state.incidents[i];
      if (byType[inc.type] !== undefined) byType[inc.type]++;
      if (byCam[inc.camera] !== undefined) byCam[inc.camera]++;
    }

    function bars(container, data, labelFn, cls) {
      var max = 1;
      Object.keys(data).forEach(function (k) { if (data[k] > max) max = data[k]; });
      container.innerHTML = "";
      Object.keys(data).forEach(function (k) {
        var row = document.createElement("div");
        row.className = "bar-row";
        var pct = Math.round((data[k] / max) * 100);
        row.innerHTML =
          '<span class="bar-label">' + esc(labelFn(k)) + "</span>" +
          '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
          '<span class="bar-val">' + data[k] + "</span>";
        container.appendChild(row);
      });
    }

    bars(typeBox, byType, function (k) { return TYPE_LABELS[k] || k; }, "");
    bars(camBox, byCam, function (k) { return "CAM " + k; }, "amber");
  }

  /* ---------- export ---------- */

  function downloadBlob(filename, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportJson() {
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob("violation-log-" + stamp + ".json", "application/json", JSON.stringify(state.incidents, null, 2));
    toast("Exported " + state.incidents.length + " incidents as JSON.");
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCsv() {
    var head = ["id", "type", "camera_id", "confidence", "timestamp", "officer", "source", "note"];
    var lines = [head.join(",")];
    for (var i = 0; i < state.incidents.length; i++) {
      var inc = state.incidents[i];
      lines.push([inc.id, inc.type, inc.camera, inc.confidence, inc.timestamp, inc.officer || "", inc.source, inc.note || ""].map(csvCell).join(","));
    }
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob("violation-log-" + stamp + ".csv", "text/csv", lines.join("\n"));
    toast("Exported " + state.incidents.length + " incidents as CSV.");
  }

  function copyLog() {
    var text = JSON.stringify(state.incidents, null, 2);
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast("Log JSON copied to clipboard.");
      } catch (e) {
        toast("Copy failed — clipboard unavailable.", true);
      }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("Log JSON copied to clipboard.");
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  function clearLog() {
    if (!state.incidents.length) { toast("Log is already empty."); return; }
    if (!window.confirm("Clear all " + state.incidents.length + " logged incidents from this preview?")) return;
    state.incidents = [];
    state.camCounters = {};
    recomputeCounters();
    saveIncidents();
    renderCounters();
    renderFeed();
    renderLogTable();
    renderStats();
    toast("Incident log cleared.");
  }

  /* ---------- demo feed ---------- */

  var DEMO_NOTES = [
    "Rider without helmet near junction line (sample)",
    "Front passenger strap not visible (sample)",
    "Two-wheeler exited roundabout on red (sample)",
    "Helmet detected off-head on pillion (sample)",
    "Seatbelt unfastened, driver side (sample)",
    "Wrong-turn into one-way arm (sample)"
  ];

  function demoStep() {
    var r = Math.random();
    var type = r < 0.55 ? "no_helmet" : (r < 0.82 ? "seatbelt" : "wrong_turn");
    var camera = 1 + Math.floor(Math.random() * 4);
    var conf = 0.61 + Math.random() * 0.33;
    addIncident({
      type: type,
      camera: camera,
      confidence: Math.round(conf * 100) / 100,
      timestamp: new Date().toISOString(),
      officer: null,
      source: "demo",
      note: DEMO_NOTES[Math.floor(Math.random() * DEMO_NOTES.length)]
    });
    var dc = $("demoCount");
    var n = state.incidents.filter(function (i) { return i.source === "demo"; }).length;
    if (dc) dc.textContent = n + " simulated";
  }

  function demoToggle() {
    var btn = $("btnDemoToggle");
    var label = $("btnDemoLabel");
    if (state.demoTimer) {
      clearInterval(state.demoTimer);
      state.demoTimer = null;
      if (label) label.textContent = "Play simulated feed";
      if (btn) btn.classList.remove("running");
      toast("Demo feed paused.");
    } else {
      state.demoTimer = setInterval(demoStep, 3600);
      if (label) label.textContent = "Pause simulated feed";
      if (btn) btn.classList.add("running");
      demoStep();
      toast("Demo feed running — sample incidents only, not model output.");
    }
  }

  /* ---------- manual form ---------- */

  function manualSubmit(e) {
    e.preventDefault();
    var errEl = $("manualError");
    var typeEl = $("mType");
    var camEl = $("mCamera");
    var confEl = $("mConfidence");
    var noteEl = $("mNote");
    if (!typeEl || !camEl || !confEl) return;

    function fail(msg) {
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      toast(msg, true);
    }

    var type = typeEl.value;
    var camera = parseInt(camEl.value, 10);
    var confRaw = confEl.value.trim();
    var conf = Number(confRaw);

    if (TYPES.indexOf(type) === -1) return fail("Pick a valid violation type.");
    if (!(camera >= 1 && camera <= 4)) return fail("Camera must be between 1 and 4.");
    if (confRaw === "" || isNaN(conf) || conf < 0 || conf > 1) return fail("Confidence must be a number between 0 and 1 (e.g. 0.85).");

    if (errEl) errEl.hidden = true;
    addIncident({
      type: type,
      camera: camera,
      confidence: Math.round(conf * 100) / 100,
      timestamp: new Date().toISOString(),
      officer: ROLE_LABELS[state.role] || state.role,
      source: "manual",
      note: noteEl && noteEl.value.trim() ? noteEl.value.trim() : ""
    });
    confEl.value = "";
    if (noteEl) noteEl.value = "";
    toast("Manual violation recorded (client-side preview).");
  }

  /* ---------- camera chips ---------- */

  function chipClick(e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    if (state.role === "public") {
      toast("Detection toggles are Traffic Officer / Administrator controls in the desktop app.", true);
      return;
    }
    if (chip.classList.contains("chip-helmet")) {
      var on = chip.classList.toggle("on");
      chip.textContent = on ? "Helmet ON" : "Helmet OFF";
      toast("CAM " + chip.getAttribute("data-cam") + " helmet detection " + (on ? "ON" : "OFF") + " (UI mirror — desktop app owns the real toggle).");
    } else if (chip.classList.contains("chip-stub")) {
      toast("Seatbelt / roundabout detectors are commented stubs in source/main_app.py — nothing to enable yet.", true);
    }
  }

  /* ---------- roles / tabs ---------- */

  function setRole(role) {
    if (!ROLE_LABELS[role]) role = "officer";
    state.role = role;
    document.body.setAttribute("data-role", role);
    try { localStorage.setItem(ROLE_KEY, role); } catch (e) { /* ignore */ }

    $all(".role-card").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-role-btn") === role ? "true" : "false");
    });
    var label = $("activeRoleLabel");
    if (label) label.textContent = ROLE_LABELS[role];

    if (role !== "admin" && activeTab === "stats") switchTab("wall");
    renderStats();
  }

  var activeTab = "wall";

  function switchTab(tab) {
    if (tab === "stats" && state.role !== "admin") {
      toast("Stats are an Administrator view.", true);
      return;
    }
    activeTab = tab;
    $all(".tab").forEach(function (t) {
      var on = t.getAttribute("data-tab") === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    var panels = { wall: "panelWall", log: "panelLog", stats: "panelStats" };
    Object.keys(panels).forEach(function (k) {
      var p = $(panels[k]);
      if (p) {
        p.classList.toggle("active", k === tab);
        p.hidden = k !== tab;
      }
    });
  }

  /* ---------- init ---------- */

  function init() {
    state.incidents = loadIncidents();
    recomputeCounters();

    tickClock();
    setInterval(tickClock, 1000);

    var savedRole = null;
    try { savedRole = localStorage.getItem(ROLE_KEY); } catch (e) { /* ignore */ }
    setRole(savedRole || "officer");

    renderCounters();
    renderFeed();
    renderLogTable();
    renderStats();

    var nDemo = state.incidents.filter(function (i) { return i.source === "demo"; }).length;
    var dc = $("demoCount");
    if (dc) dc.textContent = nDemo + " simulated";

    $all(".role-card").forEach(function (btn) {
      btn.addEventListener("click", function () { setRole(btn.getAttribute("data-role-btn")); });
    });

    $all(".tab").forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.getAttribute("data-tab")); });
    });

    var demoBtn = $("btnDemoToggle");
    if (demoBtn) demoBtn.addEventListener("click", demoToggle);

    var form = $("manualForm");
    if (form) form.addEventListener("submit", manualSubmit);

    var wall = $sel(".cam-grid");
    if (wall) wall.addEventListener("click", chipClick);

    var logBody = $("logTableBody");
    if (logBody) logBody.addEventListener("click", function () { /* rows are informational */ });

    ["logSearch", "logFilterType", "logFilterSource"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", renderLogTable);
      if (el) el.addEventListener("change", renderLogTable);
    });

    var ej = $("btnExportJson");
    if (ej) ej.addEventListener("click", exportJson);
    var ec = $("btnExportCsv");
    if (ec) ec.addEventListener("click", exportCsv);
    var cp = $("btnCopyLog");
    if (cp) cp.addEventListener("click", copyLog);
    var cl = $("btnClearLog");
    if (cl) cl.addEventListener("click", clearLog);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
