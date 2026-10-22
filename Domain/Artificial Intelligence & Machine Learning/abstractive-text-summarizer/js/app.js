/* FactCheck Studio — static verification desk for the FactCC repository.
   No model runs here: weights are not bundled with the repo and there is no
   server. The only result this page can render is the clearly-labelled
   sample walkthrough. */
(function () {
  "use strict";

  var HISTORY_KEY = "factCheckStudio.history.v1";
  var MAX_CLAIMS = 3;
  var API_BASE = (window.FACTCC_API_BASE || "http://127.0.0.1:5000").replace(/\/+$/, "");

  var DEMO = {
    source:
      "Mercury Transit Pharma said Wednesday that its experimental antibody therapy " +
      "reduced tumor size by 47 percent in a Phase II trial involving 320 patients " +
      "across 14 hospitals. Full results are to be published in a scientific journal " +
      "next spring. Shares of the firm rose 6 percent in after-hours trading after " +
      "the announcement.",
    claim:
      "Mercury Transit Pharma said its antibody therapy shrank tumors by 74 percent " +
      "in a Phase II trial of 320 patients, and shares climbed 6 percent after the " +
      "announcement.",
    label: "INCORRECT",
    confidence: 0.91,
    claimMarks: [
      { type: "inconsistent", needle: "by 74 percent" },
      { type: "supporting", needle: "in a Phase II trial of 320 patients" },
      { type: "supporting", needle: "shares climbed 6 percent" }
    ],
    sourceMarks: [
      { type: "supporting", needle: "its experimental antibody therapy reduced tumor size by 47 percent in a Phase II trial involving 320 patients" }
    ]
  };

  var state = {
    claims: [newClaim()],
    focusIndex: 0,
    history: [],
    lastResult: null
  };

  function newClaim() {
    return { text: "", marks: [] };
  }

  /* ---------- tiny helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function toast(message) {
    var node = $("toast");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () { node.hidden = true; }, 2200);
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

  function downloadJSON(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function countWords(str) {
    var trimmed = str.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  /* ---------- highlight rendering ---------- */

  function buildHighlight(text, marks) {
    var ranges = marks
      .filter(function (m) { return m.start < m.end && m.end <= text.length; })
      .slice()
      .sort(function (a, b) { return a.start - b.start; });
    var safe = [];
    var lastEnd = -1;
    ranges.forEach(function (m) {
      if (m.start >= lastEnd) { safe.push(m); lastEnd = m.end; }
    });
    var html = "";
    var cursor = 0;
    safe.forEach(function (m) {
      html += escapeHTML(text.slice(cursor, m.start));
      html += '<mark class="hl-' + m.type + '">' + escapeHTML(text.slice(m.start, m.end)) + "</mark>";
      cursor = m.end;
    });
    html += escapeHTML(text.slice(cursor));
    return html;
  }

  function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function findMarks(text, specs) {
    var marks = [];
    specs.forEach(function (spec) {
      var idx = text.indexOf(spec.needle);
      if (idx === -1) return;
      marks.push({ type: spec.type, start: idx, end: idx + spec.needle.length, text: spec.needle });
    });
    return marks;
  }

  /* ---------- claims UI ---------- */

  var claimsList = $("claims-list");
  var focusSelect = $("focus-claim");

  function renderClaims() {
    if (!claimsList) return;
    claimsList.textContent = "";
    state.claims.forEach(function (claim, i) {
      claimsList.appendChild(renderClaimRow(claim, i));
    });
    var count = $("claims-count");
    if (count) count.textContent = state.claims.length + " / " + MAX_CLAIMS + " rows";
    var addBtn = $("btn-add-claim");
    if (addBtn) addBtn.disabled = state.claims.length >= MAX_CLAIMS;
    renderFocusSelect();
  }

  function renderClaimRow(claim, i) {
    var row = el("div", "claim-row" + (i === state.focusIndex ? " is-focus" : ""));

    var head = el("div", "claim-row-head");
    head.appendChild(el("span", "claim-label", "Claim " + (i + 1)));

    var tools = el("div", "claim-tools");

    var focusBtn = el("button", "tool-btn tool-focus" + (i === state.focusIndex ? " is-on" : ""), "In focus");
    focusBtn.type = "button";
    focusBtn.setAttribute("aria-label", "Show claim " + (i + 1) + " in the verdict card");
    focusBtn.addEventListener("click", function () {
      state.focusIndex = i;
      renderClaims();
    });
    tools.appendChild(focusBtn);

    var incBtn = el("button", "tool-btn", "Mark selection inconsistent");
    incBtn.type = "button";
    incBtn.title = "Annotate the selected text of this claim as conflicting with the source (your own annotation)";
    incBtn.addEventListener("click", function () { addSelectionMark(i, "inconsistent"); });
    tools.appendChild(incBtn);

    var supBtn = el("button", "tool-btn", "Mark selection supporting");
    supBtn.type = "button";
    supBtn.title = "Annotate the selected text of this claim as supported by the source (your own annotation)";
    supBtn.addEventListener("click", function () { addSelectionMark(i, "supporting"); });
    tools.appendChild(supBtn);

    if (state.claims.length > 1) {
      var delBtn = el("button", "tool-btn tool-remove", "Remove");
      delBtn.type = "button";
      delBtn.setAttribute("aria-label", "Remove claim " + (i + 1));
      delBtn.addEventListener("click", function () { removeClaim(i); });
      tools.appendChild(delBtn);
    }

    head.appendChild(tools);
    row.appendChild(head);

    var ta = el("textarea");
    ta.value = claim.text;
    ta.setAttribute("aria-label", "Claim " + (i + 1) + " text");
    ta.placeholder = "Paste summary sentence " + (i + 1) + " here\u2026";
    ta.addEventListener("input", function () {
      claim.text = ta.value;
      ta.classList.remove("has-error");
      var err = row.querySelector(".claim-error");
      if (err) { err.hidden = true; }
    });
    row.appendChild(ta);

    if (claim.marks.length) {
      var chips = el("div", "mark-chips");
      claim.marks.forEach(function (mark, mi) {
        var chip = el("span", "mark-chip mark-chip-" + mark.type);
        chip.appendChild(document.createTextNode(mark.type + ": \u201C" + mark.text + "\u201D"));
        var x = el("button", "chip-x", "\u2715");
        x.type = "button";
        x.setAttribute("aria-label", "Remove mark " + (mi + 1));
        x.addEventListener("click", function () {
          claim.marks.splice(mi, 1);
          renderClaims();
          renderVerdictPreview();
        });
        chip.appendChild(x);
        chips.appendChild(chip);
      });
      row.appendChild(chips);
    }

    var err = el("p", "inline-error claim-error", "This claim is empty — paste a summary sentence or remove the row.");
    err.hidden = true;
    row.appendChild(err);

    return row;
  }

  function addSelectionMark(index, type) {
    var row = claimsList.children[index];
    if (!row) return;
    var ta = row.querySelector("textarea");
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    if (start == null || end == null || start === end) {
      toast("Select some text in the claim first, then mark it");
      return;
    }
    var text = ta.value;
    var claim = state.claims[index];
    claim.marks = claim.marks.filter(function (m) { return m.end <= start || m.start >= end; });
    claim.marks.push({ type: type, start: start, end: end, text: text.slice(start, end) });
    renderClaims();
    renderVerdictPreview();
    toast("Marked as " + type + " (user annotation)");
  }

  function removeClaim(index) {
    state.claims.splice(index, 1);
    if (state.focusIndex >= state.claims.length) state.focusIndex = state.claims.length - 1;
    if (state.focusIndex < 0) state.focusIndex = 0;
    renderClaims();
  }

  function renderFocusSelect() {
    if (!focusSelect) return;
    focusSelect.textContent = "";
    state.claims.forEach(function (c, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = "Claim " + (i + 1);
      focusSelect.appendChild(opt);
    });
    focusSelect.value = String(state.focusIndex);
  }

  /* ---------- source panel ---------- */

  var sourceText = $("source-text");

  function updateSourceCounters() {
    var value = sourceText ? sourceText.value : "";
    var chars = $("src-chars");
    var words = $("src-words");
    if (chars) chars.textContent = String(value.length);
    if (words) words.textContent = String(countWords(value));
  }

  function setupDropzone() {
    var zone = $("source-drop");
    if (!zone || !sourceText) return;
    ["dragenter", "dragover"].forEach(function (evtName) {
      zone.addEventListener(evtName, function (e) {
        e.preventDefault();
        zone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (evtName) {
      zone.addEventListener(evtName, function (e) {
        e.preventDefault();
        zone.classList.remove("is-dragover");
      });
    });
    zone.addEventListener("drop", function (e) {
      var dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      var file = dt.files[0];
      if (!/\.txt$/i.test(file.name)) {
        toast("Only .txt files can be loaded here");
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        sourceText.value = String(reader.result || "");
        sourceText.classList.remove("has-error");
        var err = $("source-error");
        if (err) err.hidden = true;
        updateSourceCounters();
        toast("Loaded " + file.name);
      };
      reader.onerror = function () { toast("Could not read that file"); };
      reader.readAsText(file);
    });
  }

  /* ---------- validation ---------- */

  function validate() {
    var ok = true;
    var sourceErr = $("source-error");
    if (!sourceText.value.trim()) {
      if (sourceErr) {
        sourceErr.textContent = "The source document is empty — paste text or drop a .txt file.";
        sourceErr.hidden = false;
      }
      sourceText.classList.add("has-error");
      ok = false;
    } else {
      if (sourceErr) sourceErr.hidden = true;
      sourceText.classList.remove("has-error");
    }

    var focusClaim = state.claims[state.focusIndex];
    var rows = claimsList ? claimsList.children : [];
    for (var i = 0; i < state.claims.length; i++) {
      var rowErr = rows[i] ? rows[i].querySelector(".claim-error") : null;
      var ta = rows[i] ? rows[i].querySelector("textarea") : null;
      if (!state.claims[i].text.trim()) {
        if (rowErr) rowErr.hidden = false;
        if (ta) ta.classList.add("has-error");
        if (i === state.focusIndex) ok = false;
      } else {
        if (rowErr) rowErr.hidden = true;
        if (ta) ta.classList.remove("has-error");
      }
    }
    if (focusClaim && !focusClaim.text.trim()) ok = false;
    return ok;
  }

  /* ---------- verdict states ---------- */

  function showVerdictState(which) {
    ["verdict-empty", "verdict-backend", "verdict-result", "verdict-loading"].forEach(function (id) {
      var node = $(id);
      if (node) node.hidden = id !== which;
    });
  }

  function renderResult(label, confidence, supporting, inconsistent, engine) {
    var claim = state.claims[state.focusIndex] || state.claims[0];
    var claimText = claim ? claim.text : "";

    var stamp = $("verdict-stamp");
    if (stamp) stamp.className = "stamp " + (label === "CORRECT" ? "stamp-consistent" : "stamp-inconsistent");
    var stampSpan = stamp ? stamp.querySelector("span") : null;
    if (stampSpan) stampSpan.textContent = label === "CORRECT" ? "Correct" : "Incorrect";

    var confValue = $("conf-value");
    if (confValue) confValue.textContent = Number(confidence).toFixed(2);
    var arcNum = $("arc-num");
    if (arcNum) arcNum.textContent = Number(confidence).toFixed(2);
    var arcFill = $("arc-fill");
    if (arcFill) {
      var len = 151;
      arcFill.style.strokeDashoffset = String(len * (1 - Number(confidence)));
    }
    var factLabel = $("fact-label");
    if (factLabel) factLabel.textContent = label;
    var factIdx = $("fact-claim-index");
    if (factIdx) factIdx.textContent = "Claim " + (state.focusIndex + 1);

    var engineNote = $("engine-note");
    if (engineNote) {
      engineNote.textContent = engine
        ? "Engine: " + engine + " — heuristic, not a neural FactCC checkpoint."
        : "";
      engineNote.hidden = !engine;
    }

    var claimView = $("claim-span-view");
    var sourceView = $("source-span-view");
    if (claimView) {
      claimView.innerHTML = buildHighlight(claimText, (inconsistent || []).map(function (s) {
        return { type: "inconsistent", start: s.start, end: s.end };
      }));
    }
    if (sourceView) {
      sourceView.innerHTML = buildHighlight(sourceText ? sourceText.value : "", (supporting || []).map(function (s) {
        return { type: "supporting", start: s.start, end: s.end };
      }));
    }

    var modelName = ($("model-select") && $("model-select").value === "factccx") ? "FactCCX" : "FactCC";
    state.lastResult = {
      mode: "lexical-backend",
      engine: engine,
      model_selected: modelName,
      label: label,
      confidence: confidence,
      claim_index: state.focusIndex + 1,
      claim: claimText,
      supporting_spans: supporting || [],
      inconsistent_spans: inconsistent || []
    };

    var copyBtn = $("btn-copy-result");
    if (copyBtn) copyBtn.disabled = false;

    showVerdictState("verdict-result");
    var card = $("verdict-result");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function runCheck() {
    if (!validate()) {
      toast("Fill in the source and the focused claim first");
      return;
    }
    state.lastResult = null;
    var copyBtn = $("btn-copy-result");
    if (copyBtn) copyBtn.disabled = true;
    showVerdictState("verdict-loading");

    var claim = state.claims[state.focusIndex] || state.claims[0];
    var base = API_BASE;
    fetch(base + "/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sourceText.value, claim: claim.text })
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
    }).then(function (r) {
      if (!r.ok) {
        throw new Error((r.data && r.data.error) ? r.data.error : "HTTP " + r.status);
      }
      renderResult(r.data.label, r.data.confidence, r.data.supporting_spans, r.data.inconsistent_spans, r.data.engine);
      pushHistory({
        time: new Date().toISOString(),
        model: "Lexical engine",
        claim: claim.text,
        verdict: r.data.label,
        confidence: r.data.confidence,
        mode: "backend"
      });
      toast("Consistency check complete");
    }).catch(function (err) {
      showVerdictState("verdict-backend");
      var msg = $("backend-error-msg");
      if (msg) {
        msg.textContent = "Could not reach the consistency service at " + base +
          " (" + err.message + "). Start it with: python src/api.py — then retry.";
        msg.hidden = false;
      }
      var card = $("verdict-backend");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function runSampleWalkthrough() {
    if (!sourceText) return;
    sourceText.value = DEMO.source;
    sourceText.classList.remove("has-error");
    var sourceErr = $("source-error");
    if (sourceErr) sourceErr.hidden = true;
    updateSourceCounters();

    var claim = state.claims[state.focusIndex] || state.claims[0];
    if (!claim) {
      state.claims = [newClaim()];
      state.focusIndex = 0;
    }
    claim = state.claims[state.focusIndex];
    claim.text = DEMO.claim;
    claim.marks = findMarks(DEMO.claim, DEMO.claimMarks);
    renderClaims();

    var sourceMarks = findMarks(DEMO.source, DEMO.sourceMarks);
    var claimView = $("claim-span-view");
    var sourceView = $("source-span-view");
    if (claimView) claimView.innerHTML = buildHighlight(claim.text, claim.marks);
    if (sourceView) sourceView.innerHTML = buildHighlight(DEMO.source, sourceMarks);

    var stamp = $("verdict-stamp");
    if (stamp) stamp.className = "stamp stamp-inconsistent";
    var stampSpan = stamp ? stamp.querySelector("span") : null;
    if (stampSpan) stampSpan.textContent = "Incorrect";

    var confValue = $("conf-value");
    if (confValue) confValue.textContent = DEMO.confidence.toFixed(2);
    var arcNum = $("arc-num");
    if (arcNum) arcNum.textContent = DEMO.confidence.toFixed(2);
    var arcFill = $("arc-fill");
    if (arcFill) {
      var len = 151;
      arcFill.style.strokeDashoffset = String(len * (1 - DEMO.confidence));
    }
    var factLabel = $("fact-label");
    if (factLabel) factLabel.textContent = DEMO.label;
    var factIdx = $("fact-claim-index");
    if (factIdx) factIdx.textContent = "Claim " + (state.focusIndex + 1);

    var modelName = ($("model-select") && $("model-select").value === "factccx") ? "FactCCX" : "FactCC";
    state.lastResult = {
      mode: "sample-walkthrough",
      note: "Illustrative demonstration data — not a model output. No checkpoint was executed.",
      model_selected: modelName,
      label: DEMO.label,
      confidence: DEMO.confidence,
      claim_index: state.focusIndex + 1,
      claim: claim.text,
      supporting_spans: sourceMarks.map(function (m) {
        return { start: m.start, end: m.end, text: m.text };
      }),
      inconsistent_spans: claim.marks.filter(function (m) { return m.type === "inconsistent"; }).map(function (m) {
        return { start: m.start, end: m.end, text: m.text };
      })
    };

    var copyBtn = $("btn-copy-result");
    if (copyBtn) copyBtn.disabled = false;

    var engineNote = $("engine-note");
    if (engineNote) { engineNote.textContent = ""; engineNote.hidden = true; }
    var rFlag = $("result-flag");
    if (rFlag) rFlag.textContent = "Sample walkthrough";
    var rFlagText = $("result-flag-text");
    if (rFlagText) rFlagText.textContent = "illustrative data, not a model output";
    var rSource = $("result-source");
    if (rSource) rSource.textContent = "Hand-written demonstration pair, offsets resolved in-browser";

    showVerdictState("verdict-result");
    pushHistory({
      time: new Date().toISOString(),
      model: modelName,
      claim: claim.text,
      verdict: DEMO.label,
      confidence: DEMO.confidence,
      mode: "sample"
    });
    toast("Sample walkthrough rendered (demo data)");
  }

  /* ---------- history ---------- */

  function loadHistory() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      state.history = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.history)) state.history = [];
    } catch (e) {
      state.history = [];
    }
  }

  function saveHistory() {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    } catch (e) { /* storage unavailable — history stays in memory */ }
  }

  function pushHistory(entry) {
    state.history.unshift(entry);
    if (state.history.length > 100) state.history.length = 100;
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    var body = $("history-body");
    var empty = $("history-empty");
    if (!body) return;
    body.textContent = "";
    if (!state.history.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    state.history.forEach(function (entry) {
      var tr = document.createElement("tr");

      var tdTime = document.createElement("td");
      tdTime.textContent = formatTime(entry.time);
      tr.appendChild(tdTime);

      var tdModel = document.createElement("td");
      tdModel.textContent = entry.model || "—";
      tr.appendChild(tdModel);

      var tdClaim = document.createElement("td");
      tdClaim.textContent = truncate(entry.claim || "", 90);
      tr.appendChild(tdClaim);

      var tdVerdict = document.createElement("td");
      var span = el("span", "hist-verdict " + (entry.verdict === "CORRECT" ? "v-corr" : "v-inc"), entry.verdict || "—");
      tdVerdict.appendChild(span);
      tr.appendChild(tdVerdict);

      var tdConf = document.createElement("td");
      tdConf.textContent = typeof entry.confidence === "number" ? entry.confidence.toFixed(2) : "—";
      tr.appendChild(tdConf);

      var tdMode = document.createElement("td");
      tdMode.appendChild(el("span", "mode-flag", entry.mode || "sample"));
      tr.appendChild(tdMode);

      body.appendChild(tr);
    });
  }

  function formatTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return iso; }
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n - 1) + "\u2026" : str;
  }

  /* ---------- wiring ---------- */

  function setupEvents() {
    var runBtn = $("btn-run");
    if (runBtn) runBtn.addEventListener("click", runCheck);

    var sampleBtn = $("btn-sample");
    if (sampleBtn) sampleBtn.addEventListener("click", runSampleWalkthrough);

    var resetBtn = $("btn-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (sourceText) { sourceText.value = ""; sourceText.classList.remove("has-error"); }
        var sourceErr = $("source-error");
        if (sourceErr) sourceErr.hidden = true;
        state.claims = [newClaim()];
        state.focusIndex = 0;
        state.lastResult = null;
        var copyBtn = $("btn-copy-result");
        if (copyBtn) copyBtn.disabled = true;
        updateSourceCounters();
        renderClaims();
        showVerdictState("verdict-empty");
        toast("Desk reset (history kept)");
      });
    }

    var copyResultBtn = $("btn-copy-result");
    if (copyResultBtn) {
      copyResultBtn.addEventListener("click", function () {
        if (state.lastResult) {
          copyText(JSON.stringify(state.lastResult, null, 2), "Result JSON copied");
        }
      });
    }

    var copySampleBtn = $("btn-copy-sample");
    if (copySampleBtn) {
      copySampleBtn.addEventListener("click", function () {
        if (state.lastResult) {
          copyText(JSON.stringify(state.lastResult, null, 2), "Result JSON copied");
        }
      });
    }

    var addBtn = $("btn-add-claim");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        if (state.claims.length >= MAX_CLAIMS) return;
        state.claims.push(newClaim());
        state.focusIndex = state.claims.length - 1;
        renderClaims();
        var rows = claimsList ? claimsList.children : [];
        var lastTa = rows.length ? rows[rows.length - 1].querySelector("textarea") : null;
        if (lastTa) lastTa.focus();
      });
    }

    if (focusSelect) {
      focusSelect.addEventListener("change", function () {
        state.focusIndex = parseInt(focusSelect.value, 10) || 0;
        renderClaims();
      });
    }

    if (sourceText) {
      sourceText.addEventListener("input", function () {
        sourceText.classList.remove("has-error");
        var err = $("source-error");
        if (err) err.hidden = true;
        updateSourceCounters();
      });
    }

    var exportBtn = $("btn-export");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        if (!state.history.length) {
          toast("History is empty — nothing to export");
          return;
        }
        downloadJSON("factcc-studio-history.json", {
          exported_at: new Date().toISOString(),
          note: "Sample walkthrough records only — no backend exists to record real model runs.",
          entries: state.history
        });
        toast("History JSON downloaded");
      });
    }

    var copyHistBtn = $("btn-copy-history");
    if (copyHistBtn) {
      copyHistBtn.addEventListener("click", function () {
        if (!state.history.length) {
          toast("History is empty — nothing to copy");
          return;
        }
        copyText(JSON.stringify(state.history, null, 2), "History JSON copied");
      });
    }

    var clearBtn = $("btn-clear-history");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        var err = $("history-error");
        if (!state.history.length) {
          if (err) {
            err.textContent = "History is already empty.";
            err.hidden = false;
            window.setTimeout(function () { if (err) err.hidden = true; }, 2500);
          }
          return;
        }
        state.history = [];
        saveHistory();
        renderHistory();
        toast("History cleared");
      });
    }

    document.querySelectorAll(".inline-copy[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        copyText(btn.getAttribute("data-copy") || "", "Command copied");
      });
    });
  }

  /* ---------- boot ---------- */

  loadHistory();
  renderHistory();
  renderClaims();
  updateSourceCounters();
  setupDropzone();
  setupEvents();
})();
