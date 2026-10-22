(function () {
  "use strict";

  var ROSTER_KEY = "fams_roster_local_v1";
  var REGISTER_KEY = "fams_register_v1";
  var SUBJECT_KEY = "fams_subject_v1";
  var CIRC = 2 * Math.PI * 52;

  var state = {
    step: 1,
    capturedDemo: false,
    captureTimer: null,
    roster: [],
    register: [],
    pendingEnrollment: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function nowTime() {
    var d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  /* ---------- toast ---------- */

  var toastTimer = null;
  function toast(msg, isErr) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3400);
  }

  /* ---------- storage ---------- */

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      var v = raw ? JSON.parse(raw) : fallback;
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { toast("Could not save to localStorage.", true); }
  }

  /* ---------- wizard ---------- */

  function setStep(n) {
    state.step = n;
    ["1", "2", "3"].forEach(function (s) {
      var panel = $("stepPanel" + s);
      if (panel) panel.hidden = String(n) !== s;
      var li = document.querySelector('.step[data-step="' + s + '"]');
      if (li) {
        li.classList.toggle("active", Number(s) === n);
        li.classList.toggle("done", Number(s) < n);
      }
    });
    var pip = $("stepPip");
    if (pip) pip.textContent = "Step " + n + " / 3";
  }

  function enrollSubmit(e) {
    e.preventDefault();
    var enrEl = $("enEnrollment");
    var nameEl = $("enName");
    var errEl = $("enrollError");
    if (!enrEl || !nameEl) return;

    var enr = enrEl.value.trim();
    var name = nameEl.value.trim();

    function fail(msg) {
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      toast(msg, true);
    }

    if (!/^\d{3,12}$/.test(enr)) return fail("Enrollment must be 3-12 digits (the desktop app validates digits only).");
    if (name.length < 2 || !/[A-Za-z]/.test(name)) return fail("Enter the student's name (letters, at least 2 characters).");

    if (errEl) errEl.hidden = true;
    state.pendingEnrollment = { enrollment: enr, name: name };
    state.capturedDemo = false;
    setStep(2);
    toast("Details accepted. Capture samples next.");
  }

  function ringSet(count) {
    var ring = $("ringProg");
    var countEl = $("ringCount");
    if (countEl) countEl.textContent = String(count);
    if (ring) {
      var p = Math.min(1, count / 100);
      ring.style.strokeDashoffset = String(CIRC * (1 - p));
    }
  }

  function demoCapture() {
    if (state.captureTimer) return;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var stepBy = reduced ? 20 : 2;
    var delay = reduced ? 60 : 40;
    var c = 0;
    ringSet(0);
    var stateEl = $("captureState");
    if (stateEl) stateEl.innerHTML = "<strong>Demo walkthrough running.</strong> Animating sample counts only &mdash; no webcam is open in the browser.";

    state.captureTimer = setInterval(function () {
      c = Math.min(100, c + stepBy);
      ringSet(c);
      if (c >= 100) {
        clearInterval(state.captureTimer);
        state.captureTimer = null;
        state.capturedDemo = true;
        if (stateEl) stateEl.innerHTML = "<strong>Demo walkthrough finished (100 sample counts, simulated).</strong> Real capture: <code>python AMS_Run.py</code> &rarr; <strong>Take Images</strong> stops past 70 samples; README suggests 70&ndash;200.";
        toast("Demo capture complete — counts were simulated.");
      }
    }, delay);
  }

  function finishWizard() {
    if (!state.pendingEnrollment) {
      toast("Start from step 1 — enter enrollment and name first.", true);
      setStep(1);
      return;
    }
    var enr = state.pendingEnrollment;
    var local = loadJson(ROSTER_KEY, []);
    var exists = local.some(function (s) { return s.enrollment === enr.enrollment; });
    if (!exists) {
      local.push({ enrollment: enr.enrollment, name: enr.name, date: todayIso(), time: nowTime(), source: "wizard" });
      saveJson(ROSTER_KEY, local);
    }
    mergeRoster();
    ensureRegisterRow(enr.enrollment, enr.name);
    persistRegister();
    renderRegister();
    renderRosterCards();
    var enrEl = $("enEnrollment");
    var nameEl = $("enName");
    if (enrEl) enrEl.value = "";
    if (nameEl) nameEl.value = "";
    ringSet(0);
    state.pendingEnrollment = null;
    state.capturedDemo = false;
    setStep(1);
    toast("Enrolled " + enr.enrollment + " locally. Faces still need the desktop app.");
  }

  function restartWizard() {
    if (state.captureTimer) { clearInterval(state.captureTimer); state.captureTimer = null; }
    state.pendingEnrollment = null;
    state.capturedDemo = false;
    ringSet(0);
    var enrEl = $("enEnrollment");
    var nameEl = $("enName");
    if (enrEl) enrEl.value = "";
    if (nameEl) nameEl.value = "";
    var stateEl = $("captureState");
    if (stateEl) stateEl.innerHTML = "<strong>Not capturing.</strong> The desktop app opens the webcam in <code>take_img()</code> and saves grayscale face crops to <code>TrainingImage/</code> until the sample counter passes <strong>70</strong> (README suggests 70&ndash;200 samples for reliable training).";
    setStep(1);
  }

  /* ---------- roster (real CSV) ---------- */

  function parseCsvLine(line) {
    var out = [];
    var cur = "";
    var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }

  function parseCsv(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    if (!lines.length) return [];
    var head = parseCsvLine(lines[0]).map(function (h) { return h.toLowerCase(); });
    var iE = head.indexOf("enrollment");
    var iN = head.indexOf("name");
    var iT = head.indexOf("time");
    var iD = head.indexOf("date");
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCsvLine(lines[i]);
      var enrollment = iE >= 0 ? (cols[iE] || "") : (cols[0] || "");
      var name = iN >= 0 ? (cols[iN] || "") : (cols[1] || "");
      if (!enrollment && !name) continue;
      rows.push({
        enrollment: enrollment,
        name: name,
        date: iD >= 0 ? (cols[iD] || "") : "",
        time: iT >= 0 ? (cols[iT] || "") : "",
        source: "csv"
      });
    }
    return rows;
  }

  function mergeRoster() {
    var local = loadJson(ROSTER_KEY, []);
    var seen = {};
    var merged = [];
    state.roster.concat(local).forEach(function (s) {
      if (!s || !s.enrollment || seen[s.enrollment]) return;
      seen[s.enrollment] = true;
      merged.push(s);
    });
    state.roster = merged;
  }

  function ensureRegisterRow(enrollment, name) {
    var found = state.register.some(function (r) { return r.enrollment === enrollment; });
    if (!found) {
      state.register.push({ enrollment: enrollment, name: name, time: "", status: "ABSENT" });
    }
  }

  function syncRosterToRegister() {
    state.roster.forEach(function (s) { ensureRegisterRow(s.enrollment, s.name); });
  }

  function loadRosterCsv() {
    var stateEl = $("rosterFetchState");
    fetch("StudentDetails/StudentDetails.csv")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (text) {
        var rows = parseCsv(text);
        state.roster = rows;
        mergeRoster();
        syncRosterToRegister();
        persistRegister();
        renderRosterCards();
        renderRegister();
        if (stateEl) {
          stateEl.className = "fetch-state ok";
          stateEl.textContent = rows.length
            ? "Loaded " + rows.length + " enrolled students from StudentDetails/StudentDetails.csv."
            : "StudentDetails.csv loaded but contained no populated rows yet.";
        }
      })
      .catch(function () {
        renderRosterCards();
        renderRegister();
        if (stateEl) {
          stateEl.className = "fetch-state err";
          stateEl.textContent = "Could not read StudentDetails/StudentDetails.csv (blocked on file:// or missing). Serve this folder: python -m http.server 8000 — then open http://localhost:8000/";
        }
      });
  }

  function renderRosterCards() {
    var box = $("rosterCards");
    var empty = $("rosterEmpty");
    var count = $("rosterCount");
    if (!box) return;
    box.innerHTML = "";
    if (count) count.textContent = state.roster.length + (state.roster.length === 1 ? " student" : " students");
    if (empty) empty.hidden = state.roster.length > 0;
    state.roster.forEach(function (s) {
      var card = document.createElement("div");
      card.className = "id-card";
      card.innerHTML =
        '<span class="id-hole" aria-hidden="true"></span>' +
        '<span class="id-enr">' + esc(s.enrollment) + "</span>" +
        '<span class="id-name">' + esc(s.name || "(unnamed)") + "</span>" +
        '<span class="id-src">' + (s.source === "csv" ? "StudentDetails.csv" : "this browser") + "</span>";
      box.appendChild(card);
    });
  }

  /* ---------- register ---------- */

  function persistRegister() { saveJson(REGISTER_KEY, state.register); }

  function stampSvg(status) {
    var cls = status === "PRESENT" ? "stamp-present" : "stamp-absent";
    return '<svg viewBox="0 0 120 44" class="stamp ' + cls + '" role="button" tabindex="0" aria-label="Status ' + status + ' — activate to toggle">' +
      '<rect x="3" y="3" width="114" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>' +
      '<rect x="9" y="9" width="102" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3"/>' +
      '<text x="60" y="28" text-anchor="middle" font-size="13" letter-spacing="3" fill="currentColor">' + status + "</text>" +
      "</svg>";
  }

  function filteredRegister() {
    var q = ($("regSearch") && $("regSearch").value || "").trim().toLowerCase();
    if (!q) return state.register;
    return state.register.filter(function (r) {
      return (r.enrollment + " " + r.name).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderRegister() {
    var body = $("registerBody");
    var empty = $("registerEmpty");
    if (!body) return;
    var rows = filteredRegister();
    body.innerHTML = "";
    if (empty) empty.hidden = rows.length > 0;
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(r.enrollment) + "</td>" +
        "<td>" + esc(r.name) + "</td>" +
        "<td>" + esc(r.time || "—") + "</td>" +
        '<td class="status-cell">' + stampSvg(r.status) + "</td>";
      tr.querySelector(".stamp").addEventListener("click", function () { toggleStatus(r.enrollment); });
      tr.querySelector(".stamp").addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggleStatus(r.enrollment); }
      });
      body.appendChild(tr);
    });
  }

  function toggleStatus(enrollment) {
    for (var i = 0; i < state.register.length; i++) {
      if (state.register[i].enrollment === enrollment) {
        var r = state.register[i];
        if (r.status === "PRESENT") {
          r.status = "ABSENT";
          r.time = "";
        } else {
          r.status = "PRESENT";
          r.time = nowTime();
        }
        break;
      }
    }
    persistRegister();
    renderRegister();
  }

  function markAllPresent() {
    if (!state.register.length) { toast("Register is empty.", true); return; }
    state.register.forEach(function (r) {
      r.status = "PRESENT";
      if (!r.time) r.time = nowTime();
    });
    persistRegister();
    renderRegister();
    toast("All " + state.register.length + " students marked present.");
  }

  function manualSubmit(e) {
    e.preventDefault();
    var enrEl = $("maEnrollment");
    var nameEl = $("maName");
    var errEl = $("manualError");
    if (!enrEl || !nameEl) return;
    var enr = enrEl.value.trim();
    var name = nameEl.value.trim();

    function fail(msg) {
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      toast(msg, true);
    }

    if (!/^\d{3,12}$/.test(enr)) return fail("Enrollment must be 3-12 digits.");
    if (name.length < 2) return fail("Enter the student's name.");

    if (errEl) errEl.hidden = true;

    var existing = null;
    for (var i = 0; i < state.register.length; i++) {
      if (state.register[i].enrollment === enr) { existing = state.register[i]; break; }
    }
    if (existing) {
      existing.name = name;
      existing.status = "PRESENT";
      existing.time = nowTime();
      toast("Updated existing row for " + enr + " to PRESENT.");
    } else {
      state.register.push({ enrollment: enr, name: name, time: nowTime(), status: "PRESENT" });
      toast("Added " + enr + " to the register as PRESENT.");
    }
    if (!state.roster.some(function (s) { return s.enrollment === enr; })) {
      state.roster.push({ enrollment: enr, name: name, date: todayIso(), time: nowTime(), source: "manual" });
      renderRosterCards();
    }
    persistRegister();
    renderRegister();
    enrEl.value = "";
    nameEl.value = "";
  }

  function buildCsv() {
    var subject = ($("subjectInput") && $("subjectInput").value.trim()) || "register";
    var lines = ["Enrollment,Name,Date,Time,Status"];
    state.register.forEach(function (r) {
      var cells = [r.enrollment, r.name, todayIso(), r.time || "", r.status].map(function (v) {
        var s = String(v == null ? "" : v);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      });
      lines.push(cells.join(","));
    });
    return { csv: lines.join("\n"), subject: subject.replace(/[^\w-]+/g, "_") };
  }

  function exportCsv() {
    if (!state.register.length) { toast("Register is empty — nothing to export.", true); return; }
    var out = buildCsv();
    var blob = new Blob([out.csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = out.subject + "_" + todayIso() + "_register.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Exported register CSV (" + state.register.length + " rows).");
  }

  function copyCsv() {
    if (!state.register.length) { toast("Register is empty — nothing to copy.", true); return; }
    var text = buildCsv().csv;
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast("Register CSV copied.");
      } catch (e) { toast("Copy failed — clipboard unavailable.", true); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Register CSV copied."); }).catch(fallback);
    } else fallback();
  }

  function clearRegister() {
    if (!state.register.length) { toast("Register is already empty."); return; }
    if (!window.confirm("Clear all " + state.register.length + " register rows from this browser?")) return;
    state.register = [];
    persistRegister();
    renderRegister();
    toast("Register cleared.");
  }

  /* ---------- copy buttons ---------- */

  function bindCopyButtons() {
    var btns = document.querySelectorAll("[data-copy]");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy") || "";
        function fallback() {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            toast("Copied: " + text);
          } catch (e) { toast("Copy failed — clipboard unavailable.", true); }
          document.body.removeChild(ta);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast("Copied: " + text); }).catch(fallback);
        } else fallback();
      });
    });
  }

  /* ---------- init ---------- */

  function init() {
    var d = new Date();
    var mast = $("mastDate");
    if (mast) mast.textContent = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    state.register = loadJson(REGISTER_KEY, []);
    if (!Array.isArray(state.register)) state.register = [];

    var subj = $("subjectInput");
    if (subj) {
      try { subj.value = localStorage.getItem(SUBJECT_KEY) || ""; } catch (e) { /* ignore */ }
      subj.addEventListener("input", function () {
        try { localStorage.setItem(SUBJECT_KEY, subj.value); } catch (e) { /* ignore */ }
      });
    }

    var enrollForm = $("enrollForm");
    if (enrollForm) enrollForm.addEventListener("submit", enrollSubmit);

    var demoBtn = $("btnDemoCapture");
    if (demoBtn) demoBtn.addEventListener("click", demoCapture);

    var toTrain = $("btnToTrain");
    if (toTrain) toTrain.addEventListener("click", function () {
      if (!state.pendingEnrollment) {
        toast("Enter enrollment + name on step 1 first.", true);
        setStep(1);
        return;
      }
      setStep(3);
    });

    var finishBtn = $("btnFinishWizard");
    if (finishBtn) finishBtn.addEventListener("click", finishWizard);

    var restartBtn = $("btnRestartWizard");
    if (restartBtn) restartBtn.addEventListener("click", restartWizard);

    var manualForm = $("manualForm");
    if (manualForm) manualForm.addEventListener("submit", manualSubmit);

    var markAll = $("btnMarkAll");
    if (markAll) markAll.addEventListener("click", markAllPresent);

    var regSearch = $("regSearch");
    if (regSearch) regSearch.addEventListener("input", renderRegister);

    var exp = $("btnExportCsv");
    if (exp) exp.addEventListener("click", exportCsv);
    var copyBtn = $("btnCopyCsv");
    if (copyBtn) copyBtn.addEventListener("click", copyCsv);
    var printBtn = $("btnPrint");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
    var clearBtn = $("btnClearRegister");
    if (clearBtn) clearBtn.addEventListener("click", clearRegister);

    bindCopyButtons();
    mergeRoster();
    syncRosterToRegister();
    persistRegister();
    renderRosterCards();
    renderRegister();
    setStep(1);
    ringSet(0);
    loadRosterCsv();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
