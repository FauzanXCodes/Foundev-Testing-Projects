/* =========================================================================
   Underwriting Desk — loan-default-prediction demo worksheet
   Vanilla JS. No backend, no model weights: every score is a documented
   demo heuristic (see the "Show formula" panel).
   ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Repo-derived constants (read from models.py / train_predict.py)     *
   * ------------------------------------------------------------------ */

  /* train_predict.py: submission['loss'] = pred_loss * (P > 0.6) */
  var LOSS_CUT = 0.6;

  /* models.py :: FeatureSelector._make_new_feature — actual coefficients */
  var COMBO_TERMS = {
    comb: {
      cols: ['f528-f527', 'f528-f274', 'f527-f274', 'hasnull', 'f271', 'f2'],
      weights: [8.9039, 2.9559, -2.6462, -0.0391, -7.3605, 1.9536]
    },
    comb1: {
      cols: ['f528-f527', 'f528-f274', 'f527-f274', 'hasnull', 'f271', 'f2',
             'f332', 'f776', 'f336', 'f777', 'f4', 'f5', 'f647'],
      weights: [9.9500765961934405, 3.7781687215318116, -1.8698562077221303,
                -0.066277197757217091, -6.6669154039560761, 2.5128446862308884,
                -2.1690997464054576, -0.092630191672692777, -2.4930731337790117,
                0.65168453290941586, -0.12754136033274549, -0.018338717738365744,
                0.013455903115007804]
    },
    comb2: {
      cols: ['f528-f527', 'f528-f274', 'f527-f274', 'hasnull', 'f271', 'f2',
             'f332', 'f776', 'f336', 'f777', 'f4', 'f5', 'f647',
             'f67', 'f670', 'f598', 'f596'],
      weights: [1.0634560449318777, 0.29053072516872058, -0.40554815884849466,
                0.046776844565513807, -2.4241799177037078, 0.19964143173757548,
                -6.9566421015981108, 0.20513531048071851, -0.34675217706015837,
                0.2350456207924046, -0.066067751148901038, 0.11147667983919719,
                -0.054502336657992208, 0.25678764279409982, 0.34284236736287044,
                0.61539930323510994, -0.75889755596066966]
    }
  };

  /* Transparent DEMO scorecard — heuristic only, not the trained GBM. */
  var DEMO_INTERCEPT = -1.6;
  var DEMO_FACTORS = [
    { key: 'dti',    label: 'Debt-to-income',      formula: '2.20 \u00d7 dti / 50',            w: 2.2,  x: function (v) { return v.dti / 50; } },
    { key: 'late90', label: 'Late 90+ days',        formula: '0.85 \u00d7 count',               w: 0.85, x: function (v) { return v.late90; } },
    { key: 'late60', label: 'Late 60 days',         formula: '0.55 \u00d7 count',               w: 0.55, x: function (v) { return v.late60; } },
    { key: 'late30', label: 'Late 30 days',         formula: '0.28 \u00d7 count',               w: 0.28, x: function (v) { return v.late30; } },
    { key: 'derog',  label: 'Derogatory reports',   formula: '0.60 \u00d7 count',               w: 0.6,  x: function (v) { return v.derog; } },
    { key: 'lines',  label: 'Credit lines open',    formula: '0.28 \u00d7 lines / 12',          w: 0.28, x: function (v) { return v.lines / 12; } },
    { key: 'rate',   label: 'Interest rate (APR)',  formula: '1.20 \u00d7 APR / 30',            w: 1.2,  x: function (v) { return v.rate / 30; } },
    { key: 'term',   label: 'Loan term',            formula: '0.55 \u00d7 (term \u2212 12) / 48', w: 0.55, x: function (v) { return (v.term - 12) / 48; } },
    { key: 'amount', label: 'Loan amount',          formula: '0.75 \u00d7 amount / 60000',      w: 0.75, x: function (v) { return v.amount / 60000; } },
    { key: 'age',    label: 'Age (protective)',     formula: '\u22120.55 \u00d7 clamp((age \u2212 21)/40, 0, 1)', w: -0.55, x: function (v) { return clamp((v.age - 21) / 40, 0, 1); } },
    { key: 'income', label: 'Income (protective)',  formula: '\u22120.95 \u00d7 clamp(income/120000, 0, 1)',      w: -0.95, x: function (v) { return clamp(v.income / 120000, 0, 1); } },
    { key: 'hasnull',label: 'Missing-value flag',   formula: '0.15 \u00d7 hasnull',             w: 0.15, x: function (v) { return v.hasnull; } },
    { key: 'comb',   label: 'comb (blended)',       formula: '0.45 \u00d7 tanh(comb/40) \u00d7 blend', w: 0.45, x: function (v) { return Math.tanh(v.comb / 40) * v.blends.comb; } },
    { key: 'comb1',  label: 'comb1 (blended)',      formula: '0.35 \u00d7 tanh(comb1/40) \u00d7 blend', w: 0.35, x: function (v) { return Math.tanh(v.comb1 / 40) * v.blends.comb1; } },
    { key: 'comb2',  label: 'comb2 (blended)',      formula: '0.30 \u00d7 tanh(comb2/40) \u00d7 blend', w: 0.30, x: function (v) { return Math.tanh(v.comb2 / 40) * v.blends.comb2; } }
  ];

  /* Demo loss severity (mirrors PartialRegressor's exp() + clip to [1,100]) */
  function demoSeverity(res, v) {
    var logSev = 0.85 + 1.9 * res.p + 0.4 * (v.dti / 50) + 0.35 * v.late90 + 0.25 * v.derog;
    return clamp(Math.exp(logSev), 1, 100);
  }

  /* Verdict bands. Decline cut informed by train_predict.py's 0.60 cut. */
  function verdictOf(p) {
    if (p > LOSS_CUT) return 'decline';
    if (p >= 0.45) return 'review';
    return 'approve';
  }
  function bandOf(p) {
    if (p > LOSS_CUT) return 'D';
    if (p >= 0.45) return 'C';
    if (p >= 0.3) return 'B';
    return 'A';
  }

  /* ------------------------------------------------------------------ *
   * Field schema + validation                                           *
   * ------------------------------------------------------------------ */
  var FIELDS = [
    { id: 'fAmount',  name: 'amount',  err: 'err-amount',  label: 'Loan amount',     min: 500,   max: 400000, def: 18000 },
    { id: 'fTerm',    name: 'term',    err: 'err-term',    label: 'Term',            min: 6,     max: 120,    def: 36 },
    { id: 'fRate',    name: 'rate',    err: 'err-rate',    label: 'Interest rate',   min: 0,     max: 60,     def: 11.9 },
    { id: 'fAge',     name: 'age',     err: 'err-age',     label: 'Age',             min: 18,    max: 100,    def: 34 },
    { id: 'fIncome',  name: 'income',  err: 'err-income',  label: 'Annual income',   min: 0,     max: 3000000, def: 64000 },
    { id: 'fDti',     name: 'dti',     err: 'err-dti',     label: 'Debt-to-income',  min: 0,     max: 100,    def: 38 },
    { id: 'fLines',   name: 'lines',   err: 'err-lines',   label: 'Credit lines',    min: 0,     max: 60,     def: 9 },
    { id: 'fDerog',   name: 'derog',   err: 'err-derog',   label: 'Derogatory reports', min: 0,  max: 20,     def: 0 },
    { id: 'fLate30',  name: 'late30',  err: 'err-late30',  label: 'Late 30 days',    min: 0,     max: 60,     def: 1 },
    { id: 'fLate60',  name: 'late60',  err: 'err-late60',  label: 'Late 60 days',    min: 0,     max: 60,     def: 0 },
    { id: 'fLate90',  name: 'late90',  err: 'err-late90',  label: 'Late 90+ days',   min: 0,     max: 60,     def: 0 }
  ];
  var F_DEFAULTS = {};
  FIELDS.forEach(function (f) { F_DEFAULTS[f.name] = f.def; });

  var F_FIELD_IDS = ['f528', 'f527', 'f274', 'f271', 'f2', 'f332', 'f776', 'f336',
                     'f777', 'f4', 'f5', 'f647', 'f67', 'f670', 'f598', 'f596'];

  var STORE_KEYS = { ledger: 'ud.ledger.v1', caseNo: 'ud.caseno.v1' };

  /* ------------------------------------------------------------------ *
   * Small utils                                                         *
   * ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clamp(n, a, b) { return n < a ? a : (n > b ? b : n); }
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  function pad(n, w) { var s = String(n); while (s.length < w) { s = '0' + s; } return s; }

  var currency;
  try {
    currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  } catch (e) { currency = null; }
  function money(n) {
    if (currency) { return currency.format(n); }
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function storeGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function setMsg(el, text, kind) {
    if (!el) { return; }
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }
  function downloadBlob(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return true;
    } catch (e) { return false; }
  }
  function csvCell(value) {
    var s = String(value == null ? '' : value);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  /* ------------------------------------------------------------------ *
   * Reading + validating the worksheet                                  *
   * ------------------------------------------------------------------ */
  function readForm(showErrors) {
    var values = {}, errors = [], i, f, el, raw, num, errEl;
    var focused = document.activeElement;
    for (i = 0; i < FIELDS.length; i++) {
      f = FIELDS[i];
      el = $(f.id);
      errEl = $(f.err);
      raw = el ? String(el.value).trim() : '';
      num = raw === '' ? NaN : Number(raw);
      var msg = '';
      if (raw === '') { msg = f.label + ' is required'; }
      else if (isNaN(num)) { msg = f.label + ' must be a number'; }
      else if (num < f.min || num > f.max) { msg = f.label + ' must be ' + f.min + '\u2013' + f.max; }
      if (msg) {
        errors.push({ field: f, msg: msg });
        /* while a field is focused and merely empty, hold off on the red flag */
        if (showErrors && el !== focused) {
          if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
          if (el) { el.setAttribute('aria-invalid', 'true'); }
        }
      } else {
        values[f.name] = num;
        if (showErrors) {
          if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
          if (el) { el.removeAttribute('aria-invalid'); }
        }
      }
    }
    return { values: values, errors: errors };
  }

  function readFFields() {
    var out = {}, blanks = 0, i, el;
    for (i = 0; i < F_FIELD_IDS.length; i++) {
      el = document.querySelector('.f-input[data-f="' + F_FIELD_IDS[i] + '"]');
      var raw = el ? String(el.value).trim() : '';
      if (raw === '' || isNaN(Number(raw))) { out[F_FIELD_IDS[i]] = 0; blanks++; }
      else { out[F_FIELD_IDS[i]] = Number(raw); }
    }
    out._blanks = blanks;
    return out;
  }

  function readBlends() {
    return {
      comb: blendOf('blend-comb'),
      comb1: blendOf('blend-comb1'),
      comb2: blendOf('blend-comb2')
    };
  }
  function blendOf(id) {
    var el = $(id);
    return el ? clamp(Number(el.value) / 100, 0, 1) : 1;
  }

  /* Evaluate one combo using the ACTUAL models.py coefficients. */
  function comboValue(name, fv, hasnull) {
    var spec = COMBO_TERMS[name], total = 0, i, termVal;
    for (i = 0; i < spec.cols.length; i++) {
      termVal = termValue(spec.cols[i], fv, hasnull);
      total += termVal * spec.weights[i];
    }
    return total;
  }
  function termValue(col, fv, hasnull) {
    if (col === 'hasnull') { return hasnull; }
    if (col === 'f528-f527') { return fv.f528 - fv.f527; }
    if (col === 'f528-f274') { return fv.f528 - fv.f274; }
    if (col === 'f527-f274') { return fv.f527 - fv.f274; }
    return typeof fv[col] === 'number' ? fv[col] : 0;
  }

  function buildContext() {
    var fv = readFFields();
    var hasnull = fv._blanks > 0 ? 1 : 0;
    return {
      fv: fv,
      hasnull: hasnull,
      comb: comboValue('comb', fv, hasnull),
      comb1: comboValue('comb1', fv, hasnull),
      comb2: comboValue('comb2', fv, hasnull),
      blends: readBlends()
    };
  }

  /* ------------------------------------------------------------------ *
   * Demo scoring                                                        *
   * ------------------------------------------------------------------ */
  function score(v, ctx) {
    var factors = [], logit = DEMO_INTERCEPT, i, f, x, c;
    for (i = 0; i < DEMO_FACTORS.length; i++) {
      f = DEMO_FACTORS[i];
      x = f.x({
        dti: v.dti, late90: v.late90, late60: v.late60, late30: v.late30,
        derog: v.derog, lines: v.lines, rate: v.rate, term: v.term,
        amount: v.amount, age: v.age, income: v.income, hasnull: ctx.hasnull,
        comb: ctx.comb, comb1: ctx.comb1, comb2: ctx.comb2, blends: ctx.blends
      });
      c = f.w * x;
      logit += c;
      factors.push({ key: f.key, label: f.label, formula: f.formula, w: f.w, x: x, c: c });
    }
    var p = sigmoid(logit);
    var verdict = verdictOf(p);
    var severity = demoSeverity({ p: p }, v);
    var applied = p > LOSS_CUT;
    var loss = applied ? v.amount * severity / 100 : 0;
    return {
      p: p, logit: logit, factors: factors, verdict: verdict,
      severity: severity, applied: applied, loss: loss
    };
  }

  /* ------------------------------------------------------------------ *
   * Risk dial (SVG built once, needle tweened)                          *
   * ------------------------------------------------------------------ */
  var dial = { cx: 150, cy: 152, r: 116, needle: null, angle: 0, raf: 0 };

  function polar(cx, cy, r, p) {
    var theta = (180 - 180 * clamp(p, 0, 1)) * Math.PI / 180;
    return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
  }
  function arcPath(cx, cy, r, p1, p2) {
    var a = polar(cx, cy, r, p1), b = polar(cx, cy, r, p2);
    var large = (Math.abs((p2 - p1) * 180) > 180) ? 1 : 0;
    return 'M' + a.x.toFixed(2) + ',' + a.y.toFixed(2) +
           ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + b.x.toFixed(2) + ',' + b.y.toFixed(2);
  }
  function buildDial() {
    var svg = $('riskDial');
    if (!svg) { return; }
    var cx = dial.cx, cy = dial.cy, r = dial.r;
    var ns = 'http://www.w3.org/2000/svg';
    var parts = [];

    parts.push('<path d="' + arcPath(cx, cy, r, 0, 1) + '" fill="none" stroke="#e3dbcb" stroke-width="18" stroke-linecap="butt"/>');
    parts.push('<path d="' + arcPath(cx, cy, r, 0, 0.45) + '" fill="none" stroke="#2f5d3a" stroke-width="18" stroke-linecap="butt"/>');
    parts.push('<path d="' + arcPath(cx, cy, r, 0.45, 0.6) + '" fill="none" stroke="#c8912a" stroke-width="18" stroke-linecap="butt"/>');
    parts.push('<path d="' + arcPath(cx, cy, r, 0.6, 1) + '" fill="none" stroke="#a4243b" stroke-width="18" stroke-linecap="butt"/>');

    var t, pt1, pt2, label, lp;
    for (t = 0; t <= 10; t++) {
      pt1 = polar(cx, cy, r - 12, t / 10);
      pt2 = polar(cx, cy, r - (t % 5 === 0 ? 24 : 18), t / 10);
      parts.push('<line x1="' + pt1.x.toFixed(2) + '" y1="' + pt1.y.toFixed(2) +
                 '" x2="' + pt2.x.toFixed(2) + '" y2="' + pt2.y.toFixed(2) +
                 '" stroke="#4a453d" stroke-width="' + (t % 5 === 0 ? 1.6 : 0.9) + '"/>');
      if (t % 5 === 0) {
        lp = polar(cx, cy, r - 38, t / 10);
        label = (t / 10).toFixed(1);
        parts.push('<text x="' + lp.x.toFixed(2) + '" y="' + (lp.y + 4).toFixed(2) +
                   '" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="#7d756a">' + label + '</text>');
      }
    }
    /* the 0.60 decision cut marker */
    var cutA = polar(cx, cy, r - 30, LOSS_CUT);
    var cutB = polar(cx, cy, r + 12, LOSS_CUT);
    parts.push('<line x1="' + cutA.x.toFixed(2) + '" y1="' + cutA.y.toFixed(2) +
               '" x2="' + cutB.x.toFixed(2) + '" y2="' + cutB.y.toFixed(2) +
               '" stroke="#1c1a17" stroke-width="1.6" stroke-dasharray="4 3"/>');
    parts.push('<text x="' + cutB.x.toFixed(2) + '" y="' + (cutB.y - 6).toFixed(2) +
               '" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="#1c1a17">0.60 cut</text>');

    parts.push('<g id="needleG" transform="rotate(0,' + cx + ',' + cy + ')">' +
               '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx - (r - 16)) + '" y2="' + cy +
               '" stroke="#a4243b" stroke-width="3.4" stroke-linecap="round"/>' +
               '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#1c1a17"/>' +
               '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#f4efe6"/></g>');

    svg.innerHTML = parts.join('');
    dial.needle = document.getElementById('needleG');
    dial.angle = 0;
  }

  function setDial(p) {
    var target = clamp(p, 0, 1) * 180;
    if (!dial.needle) { return; }
    if (dial.raf) { cancelAnimationFrame(dial.raf); dial.raf = 0; }
    if (reduceMotion()) {
      dial.angle = target;
      dial.needle.setAttribute('transform', 'rotate(' + target.toFixed(2) + ',' + dial.cx + ',' + dial.cy + ')');
      return;
    }
    var from = dial.angle, delta = target - from, start = 0, dur = 620;
    function step(ts) {
      if (!start) { start = ts; }
      var t = clamp((ts - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      dial.angle = from + delta * eased;
      dial.needle.setAttribute('transform', 'rotate(' + dial.angle.toFixed(2) + ',' + dial.cx + ',' + dial.cy + ')');
      if (t < 1) { dial.raf = requestAnimationFrame(step); } else { dial.raf = 0; }
    }
    dial.raf = requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------ *
   * Rendering the decision pane                                         *
   * ------------------------------------------------------------------ */
  var lastVerdict = null;

  function renderDecision(state) {
    var stampPlate = $('stampPlate'), stamp = $('stamp'), stampText = $('stampText');
    if (!stampPlate || !stamp || !stampText) { return; }

    if (!state.ok) {
      stampPlate.setAttribute('data-verdict', 'none');
      stampText.textContent = 'ON HOLD';
      var sub = $('stampSub');
      if (sub) { sub.textContent = state.errors.length + ' field(s) need fixing \u2014 decision paused'; }
      var st = $('stampTime'); if (st) { st.textContent = 'invalid entry'; }
      var pr = $('pRead'); if (pr) { pr.textContent = '\u2014'; }
      var lr = $('lossRead'); if (lr) { lr.textContent = '\u2014'; }
      var sr = $('sevRead'); if (sr) { sr.textContent = '\u2014'; }
      var ar = $('appliedRead'); if (ar) { ar.textContent = '\u2014'; }
      renderReasons([]);
      renderFormulaTable(null, state.errors);
      lastVerdict = null;
      var fileBtn = $('fileBtn');
      if (fileBtn) { fileBtn.disabled = true; }
      return;
    }

    var res = state.result;

    stampPlate.setAttribute('data-verdict', res.verdict);
    stampText.textContent = res.verdict.toUpperCase();
    if (lastVerdict !== res.verdict) {
      stamp.classList.remove('animate');
      void stamp.offsetWidth; /* reflow to restart the stamp-in animation */
      stamp.classList.add('animate');
      lastVerdict = res.verdict;
    }
    $('stampSub').textContent = 'P(default) ' + res.p.toFixed(3) + ' · loss cut ' + LOSS_CUT.toFixed(2) +
      (res.applied ? ' · loss APPLIED' : ' · loss waived');
    var st2 = $('stampTime');
    if (st2) { st2.textContent = 'scored ' + new Date().toLocaleTimeString(); }

    $('pRead').textContent = res.p.toFixed(2);
    setDial(res.p);

    $('lossRead').textContent = res.applied ? money(res.loss) : money(0);
    $('sevRead').textContent = res.severity.toFixed(2);
    $('appliedRead').textContent = res.applied ? 'P > 0.60 → applied' : 'P ≤ 0.60 → $0';

    renderReasons(res.factors);
    renderFormulaTable(res, []);

    var fb = $('fileBtn');
    if (fb) { fb.disabled = false; }
  }

  function renderReasons(factors) {
    var list = $('reasonList');
    if (!list) { return; }
    list.innerHTML = '';
    if (!factors || !factors.length) {
      list.innerHTML = '<li class="reason-empty">Fix the highlighted fields to compute reason codes.</li>';
      return;
    }
    var picked = factors.slice().sort(function (a, b) { return Math.abs(b.c) - Math.abs(a.c); }).slice(0, 6);
    var max = 0;
    picked.forEach(function (f) { max = Math.max(max, Math.abs(f.c)); });
    max = max || 1;
    picked.forEach(function (f) {
      var li = document.createElement('li');
      var pct = Math.abs(f.c) / max * 50;
      var up = f.c >= 0;
      li.innerHTML =
        '<span class="reason-top">' +
          '<span class="r-label">' + escapeHtml(f.label) + '</span>' +
          '<span class="r-val" style="color:' + (up ? '#a4243b' : '#2f5d3a') + '">' +
            (up ? '+' : '−') + Math.abs(f.c).toFixed(3) + '</span>' +
        '</span>' +
        '<span class="reason-bar"><span class="reason-fill ' + (up ? 'up' : 'down') + '" style="' +
          (up ? 'left:50%;' : 'right:50%;') + 'width:' + pct.toFixed(1) + '%"></span></span>';
      list.appendChild(li);
    });
  }

  function renderFormulaTable(res, errors) {
    var body = $('formulaBody');
    if (!body) { return; }
    body.innerHTML = '';
    if (!res) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4">' + (errors && errors.length
        ? 'Blocked: ' + errors.map(function (e) { return escapeHtml(e.msg); }).join(' · ')
        : 'No valid input yet.') + '</td>';
      body.appendChild(tr);
      return;
    }
    var rows = '<tr><td>intercept</td><td>constant</td><td>1</td><td>' + DEMO_INTERCEPT.toFixed(3) + '</td></tr>';
    res.factors.forEach(function (f) {
      rows += '<tr><td>' + escapeHtml(f.label) + '</td><td>' + escapeHtml(f.formula) +
              '</td><td>' + f.x.toFixed(4) + '</td><td>' +
              (f.c >= 0 ? '+' : '−') + Math.abs(f.c).toFixed(4) + '</td></tr>';
    });
    rows += '<tr class="sum"><td>logit</td><td>intercept + Σ contributions</td><td>—</td><td>' +
            res.logit.toFixed(4) + '</td></tr>';
    rows += '<tr class="sum"><td>P(default)</td><td>1 / (1 + e^−logit)</td><td>—</td><td>' +
            res.p.toFixed(4) + '</td></tr>';
    rows += '<tr class="sum"><td>verdict</td><td>decline if P &gt; 0.60 · review if P ≥ 0.45</td><td>—</td><td>' +
            res.verdict.toUpperCase() + '</td></tr>';
    rows += '<tr class="sum"><td>submission loss</td><td>severity × 1[P &gt; 0.60]</td><td>' +
            res.severity.toFixed(2) + '</td><td>' + (res.applied ? (res.loss).toFixed(2) : '0') + '</td></tr>';
    body.innerHTML = rows;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ------------------------------------------------------------------ *
   * Combos + hasnull rendering                                          *
   * ------------------------------------------------------------------ */
  function renderCombos() {
    var ctx = buildContext();
    ['comb', 'comb1', 'comb2'].forEach(function (name) {
      var valEl = $('val-' + name);
      if (valEl) { valEl.textContent = ctx[name].toFixed(3); }
      var pctEl = $('pct-' + name);
      if (pctEl) { pctEl.textContent = Math.round(ctx.blends[name] * 100) + '%'; }
      var fEl = $('formula-' + name);
      if (fEl) { fEl.innerHTML = formulaHtml(name, ctx); }
    });
    var chip = $('hasnullChip');
    if (chip) { chip.setAttribute('data-null', String(ctx.hasnull)); }
    var hv = $('hasnullValue');
    if (hv) { hv.textContent = String(ctx.hasnull); }
    var hn = $('hasnullNote');
    if (hn) {
      hn.textContent = ctx.hasnull === 1
        ? (ctx.fv._blanks + ' blank f-field(s) → median-imputed to 0')
        : 'all demo f-fields present';
    }
    return ctx;
  }

  function formulaHtml(name, ctx) {
    var spec = COMBO_TERMS[name], out = [], i, tv, term, w;
    for (i = 0; i < spec.cols.length; i++) {
      tv = termValue(spec.cols[i], ctx.fv, ctx.hasnull);
      w = spec.weights[i];
      term = '<b>' + formatWeight(w) + '</b>·(' + escapeHtml(spec.cols[i]) + '=' + formatNum(tv) + ')';
      out.push(term);
    }
    return out.join(' + ') +
      '<span class="total">' + name + ' = ' + ctx[name].toFixed(4) +
      ' &nbsp;·&nbsp; blend ' + Math.round(ctx.blends[name] * 100) + '%' +
      ' &nbsp;·&nbsp; weights verbatim from models.py</span>';
  }
  function formatWeight(w) {
    var s = String(w);
    if (s.length > 12) { s = w.toFixed(4); }
    return s;
  }
  function formatNum(n) {
    return Math.abs(n) < 1e4 ? Number(n.toFixed(4)).toString() : n.toExponential(2);
  }

  /* ------------------------------------------------------------------ *
   * Derived readouts (planned principal / scheduled payment)            *
   * ------------------------------------------------------------------ */
  function renderDerived() {
    var amountEl = $('fAmount'), termEl = $('fTerm'), rateEl = $('fRate');
    if (!amountEl || !termEl || !rateEl) { return; }
    var amount = Number(amountEl.value), term = Number(termEl.value), apr = Number(rateEl.value);
    var planned = $('fPlanned'), payment = $('fPayment');
    if (!(amount > 0) || !(term > 0)) {
      if (planned) { planned.value = '—'; }
      if (payment) { payment.value = '—'; }
      return;
    }
    if (planned) { planned.value = money(amount / term); }
    if (payment) {
      var r = (isNaN(apr) ? 0 : apr) / 100 / 12;
      var pay = r === 0 ? amount / term : amount * r / (1 - Math.pow(1 + r, -term));
      payment.value = money(pay);
    }
  }

  /* ------------------------------------------------------------------ *
   * Full recompute                                                      *
   * ------------------------------------------------------------------ */
  var currentResult = null;

  function recompute(showErrors) {
    renderDerived();
    var ctx = renderCombos();
    var form = readForm(showErrors);
    if (form.errors.length) {
      currentResult = null;
      renderDecision({ ok: false, errors: form.errors });
      setMsg($('caseMsg'), form.errors.length + ' field(s) invalid — fix to score.', 'error');
      return null;
    }
    var res = score(form.values, ctx);
    currentResult = { values: form.values, ctx: ctx, result: res };
    renderDecision({ ok: true, values: form.values, ctx: ctx, result: res });
    if (showErrors) { setMsg($('caseMsg'), '', ''); }
    return currentResult;
  }

  /* ------------------------------------------------------------------ *
   * Tabs                                                                *
   * ------------------------------------------------------------------ */
  function initTabs() {
    var tabs = all('[role="tab"]');
    if (!tabs.length) { return; }
    function activate(tab, focus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        t.tabIndex = selected ? 0 : -1;
        var panel = $(t.getAttribute('aria-controls'));
        if (panel) { panel.hidden = !selected; }
      });
      if (focus) { tab.focus(); }
      if (tab.id === 'tab-batch') { drawHistogram(lastBatchRows); }
    }
    tabs.forEach(function (tab, idx) {
      tab.addEventListener('click', function () { activate(tab, false); });
      tab.addEventListener('keydown', function (ev) {
        var next = -1;
        if (ev.key === 'ArrowRight') { next = (idx + 1) % tabs.length; }
        else if (ev.key === 'ArrowLeft') { next = (idx - 1 + tabs.length) % tabs.length; }
        else if (ev.key === 'Home') { next = 0; }
        else if (ev.key === 'End') { next = tabs.length - 1; }
        if (next >= 0) { ev.preventDefault(); activate(tabs[next], true); }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Portfolio ledger                                                    *
   * ------------------------------------------------------------------ */
  var ledger = storeGet(STORE_KEYS.ledger, []);
  var ledgerSort = { key: 'ts', dir: -1 };

  function saveLedger() { storeSet(STORE_KEYS.ledger, ledger); }

  function renderLedger() {
    var body = $('ledgerBody'), empty = $('ledgerEmpty'), count = $('ledgerCount');
    if (!body) { return; }
    if (count) { count.textContent = ledger.length + (ledger.length === 1 ? ' entry' : ' entries'); }
    body.innerHTML = '';
    if (empty) { empty.hidden = ledger.length > 0; }
    var table = $('ledgerTable');
    if (table) { table.hidden = ledger.length === 0; }

    var sorted = ledger.slice().sort(function (a, b) {
      var k = ledgerSort.key, av = a[k], bv = b[k];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase(); }
      if (av < bv) { return -1 * ledgerSort.dir; }
      if (av > bv) { return 1 * ledgerSort.dir; }
      return 0;
    });

    sorted.forEach(function (entry) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="mono">' + escapeHtml(entry.case) + '</td>' +
        '<td class="mono" style="font-size:12px">' + escapeHtml(entry.when) + '</td>' +
        '<td class="num">' + money(entry.amount) + '</td>' +
        '<td class="num">' + entry.p.toFixed(3) + '</td>' +
        '<td class="num">' + (entry.applied ? money(entry.loss) : money(0)) + '</td>' +
        '<td><span class="verdict-chip ' + entry.verdict + '">' + entry.verdict.toUpperCase() + '</span></td>' +
        '<td class="num" title="Risk band from P(default): A &lt; 0.30, B 0.30–0.45, C 0.45–0.60, D &gt; 0.60">' + entry.band + '</td>' +
        '<td class="num"><button class="row-del" type="button" data-case="' + escapeHtml(entry.case) +
        '" aria-label="Delete decision ' + escapeHtml(entry.case) + '" title="Delete">&times;</button></td>';
      body.appendChild(tr);
    });

    all('#ledgerBody .row-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-case');
        ledger = ledger.filter(function (e) { return e.case !== id; });
        saveLedger();
        renderLedger();
        setMsg($('caseMsg'), 'Removed ' + id + ' from ledger.', 'success');
      });
    });

    all('.sort-btn').forEach(function (btn) {
      var th = btn.closest('th');
      if (!th) { return; }
      if (btn.getAttribute('data-key') === ledgerSort.key) {
        th.setAttribute('aria-sort', ledgerSort.dir === 1 ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    });
  }

  function initLedger() {
    all('.sort-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        if (ledgerSort.key === key) { ledgerSort.dir *= -1; }
        else { ledgerSort.key = key; ledgerSort.dir = (key === 'ts' || key === 'p' || key === 'loss' || key === 'amount') ? -1 : 1; }
        renderLedger();
      });
    });

    var exportCsv = $('exportLedgerCsv');
    if (exportCsv) {
      exportCsv.addEventListener('click', function () {
        if (!ledger.length) { exportCsv.textContent = 'Nothing to export'; setTimeout(function () { exportCsv.textContent = 'Export CSV'; }, 1600); return; }
        var rows = [['case', 'filed', 'amount', 'p_default', 'severity', 'applied', 'expected_loss', 'verdict', 'band']];
        ledger.forEach(function (e) {
          rows.push([e.case, e.when, e.amount, e.p.toFixed(4), e.severity.toFixed(2), e.applied ? 'yes' : 'no', e.loss.toFixed(2), e.verdict, e.band]);
        });
        downloadBlob('underwriting-ledger.csv', toCsv(rows), 'text/csv;charset=utf-8');
      });
    }
    var exportJson = $('exportLedgerJson');
    if (exportJson) {
      exportJson.addEventListener('click', function () {
        if (!ledger.length) { exportJson.textContent = 'Nothing to export'; setTimeout(function () { exportJson.textContent = 'Export JSON'; }, 1600); return; }
        downloadBlob('underwriting-ledger.json', JSON.stringify(ledger, null, 2), 'application/json');
      });
    }
    var clearBtn = $('clearLedgerBtn');
    if (clearBtn) {
      var armed = false, disarmTimer = 0;
      clearBtn.addEventListener('click', function () {
        if (!ledger.length) {
          setMsg($('caseMsg'), 'Ledger is already empty.', '');
          return;
        }
        if (!armed) {
          armed = true;
          clearBtn.textContent = 'Confirm clear';
          clearBtn.classList.add('armed');
          clearTimeout(disarmTimer);
          disarmTimer = setTimeout(function () {
            armed = false; clearBtn.textContent = 'Clear ledger'; clearBtn.classList.remove('armed');
          }, 4000);
          return;
        }
        ledger = [];
        saveLedger();
        renderLedger();
        armed = false;
        clearBtn.textContent = 'Clear ledger';
        clearBtn.classList.remove('armed');
        setMsg($('caseMsg'), 'Ledger cleared.', 'success');
      });
    }
  }

  function fileDecision() {
    var state = recompute(true);
    if (!state) { setMsg($('caseMsg'), 'Cannot file \u2014 fix the highlighted fields first.', 'error'); return; }
    var entry = {
      case: $('caseNo') ? $('caseNo').textContent : 'UD-?',
      when: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ts: Date.now(),
      amount: state.values.amount,
      p: state.result.p,
      severity: state.result.severity,
      applied: state.result.applied,
      loss: state.result.loss,
      verdict: state.result.verdict,
      band: bandOf(state.result.p)
    };
    if (ledger.some(function (e) { return e.case === entry.case; })) {
      var base = entry.case, n = 2;
      while (ledger.some(function (e) { return e.case === base + '\u00b7' + n; })) { n++; }
      entry.case = base + '\u00b7' + n;
    }
    ledger.push(entry);
    if (!saveLedger()) {
      setMsg($('caseMsg'), 'Could not persist (localStorage blocked in this browser).', 'error');
      ledger.pop();
      return;
    }
    renderLedger();
    setMsg($('caseMsg'), 'Filed ' + entry.case + ' — ' + entry.verdict.toUpperCase() +
      ', P ' + entry.p.toFixed(3) + ', expected loss ' + (entry.applied ? money(entry.loss) : money(0)) + '.', 'success');
  }

  function nextCaseNumber() {
    var counter = storeGet(STORE_KEYS.caseNo, 1);
    var label = 'UD-' + pad(counter, 6);
    storeSet(STORE_KEYS.caseNo, counter + 1);
    return label;
  }

  function resetCase(newNumber) {
    FIELDS.forEach(function (f) {
      var el = $(f.id);
      if (el) { el.value = String(f.def); el.removeAttribute('aria-invalid'); }
      var errEl = $(f.err);
      if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    });
    all('.f-input').forEach(function (el) { el.value = '1'; });
    ['blend-comb', 'blend-comb1', 'blend-comb2'].forEach(function (id) {
      var el = $(id); if (el) { el.value = '100'; }
    });
    if (newNumber) {
      var el2 = $('caseNo');
      if (el2) { el2.textContent = nextCaseNumber(); }
    }
    lastVerdict = null;
    var stamp = $('stamp');
    if (stamp) { stamp.classList.remove('animate'); }
    recompute(true);
  }

  /* ------------------------------------------------------------------ *
   * Batch                                                               *
   * ------------------------------------------------------------------ */
  var lastBatchRows = [];

  function parseCsv(text) {
    var rows = [], row = [], field = '', i = 0, inQuotes = false, ch;
    text = String(text).replace(/^\uFEFF/, '');
    while (i < text.length) {
      ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') { i++; }
        row.push(field); field = '';
        if (row.some(function (c) { return String(c).trim() !== ''; })) { rows.push(row); }
        row = []; i++; continue;
      }
      field += ch; i++;
    }
    row.push(field);
    if (row.some(function (c) { return String(c).trim() !== ''; })) { rows.push(row); }
    return rows;
  }

  var HEADER_MAP = {
    id: 'id', rowid: 'id', loanid: 'id',
    amount: 'amount', loanamount: 'amount',
    term: 'term', termmonths: 'term', months: 'term',
    rate: 'rate', interestrate: 'rate', apr: 'rate',
    age: 'age',
    income: 'income', annualincome: 'income',
    dti: 'dti', debttodti: 'dti', debttoratio: 'dti',
    lines: 'lines', creditlines: 'lines', openlines: 'lines',
    derog: 'derog', derogatory: 'derog',
    late30: 'late30', late_30: 'late30', late30days: 'late30',
    late60: 'late60', late_60: 'late60', late60days: 'late60',
    late90: 'late90', late_90: 'late90', late90days: 'late90', late90plus: 'late90'
  };
  function normHeader(h) { return String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }

  var BATCH_DEFAULTS = { term: 36, rate: 0, age: 34, income: 0, dti: 0, lines: 0, derog: 0, late30: 0, late60: 0, late90: 0 };

  function scoreBatch(text, ctx) {
    var grid = parseCsv(text);
    if (grid.length < 2) { return { error: 'Paste a header row plus at least one data row.' }; }
    var header = grid[0].map(normHeader);
    var idx = {};
    header.forEach(function (h, i) {
      var mapped = HEADER_MAP[h];
      if (mapped && typeof idx[mapped] === 'undefined') { idx[mapped] = i; }
    });
    if (typeof idx.id === 'undefined') { return { error: 'Missing required column: id' }; }
    if (typeof idx.amount === 'undefined') { return { error: 'Missing required column: amount' }; }

    var results = [], rowErrors = [], r, cells;
    for (r = 1; r < grid.length; r++) {
      cells = grid[r];
      var id = String(cells[idx.id] || '').trim();
      if (!id) { rowErrors.push('row ' + r + ': empty id'); continue; }
      var amount = Number(String(cells[idx.amount] || '').replace(/[$,\s]/g, ''));
      if (!isFinite(amount) || amount <= 0) { rowErrors.push('row ' + r + ' (' + id + '): invalid amount'); continue; }
      var v = { amount: amount }, missing = 0;
      ['term', 'rate', 'age', 'income', 'dti', 'lines', 'derog', 'late30', 'late60', 'late90'].forEach(function (key) {
        var raw = typeof idx[key] === 'undefined' ? '' : String(cells[idx[key]] || '').trim();
        var num = raw === '' ? NaN : Number(raw);
        if (!isFinite(num)) { v[key] = BATCH_DEFAULTS[key]; missing++; }
        else { v[key] = clamp(num, key === 'rate' ? 0 : -1e9, key === 'rate' ? 60 : 1e9); }
      });
      var rowHasNull = missing > 0 ? 1 : 0;
      var rowCtx = { hasnull: rowHasNull, comb: ctx.comb, comb1: ctx.comb1, comb2: ctx.comb2, blends: ctx.blends, fv: ctx.fv };
      var res = score(v, rowCtx);
      results.push({ id: id, p: res.p, severity: res.severity, applied: res.applied, loss: res.loss, hasnull: rowHasNull });
    }
    if (!results.length) { return { error: 'No scorable rows. ' + (rowErrors[0] || '') }; }
    return { rows: results, rowErrors: rowErrors };
  }

  function renderBatch(results, rowErrors) {
    lastBatchRows = results;
    var msg = $('batchMsg');
    var stats = $('batchStats');
    var empty = $('batchEmpty');
    var tbody = $('batchTableBody');
    var exportBtn = $('exportSubmissionBtn');
    if (!tbody) { return; }

    if (stats) { stats.hidden = false; }
    if (empty) { empty.hidden = true; }
    if (exportBtn) { exportBtn.disabled = false; }

    var sum = 0, over = 0, applied = 0;
    results.forEach(function (r) {
      sum += r.p;
      if (r.p > LOSS_CUT) { over++; }
      if (r.applied) { applied++; }
    });
    setText('statRows', String(results.length));
    setText('statMean', (sum / results.length).toFixed(3));
    setText('statOver', String(over));
    setText('statApplied', String(applied));

    var show = results.slice(0, 100);
    tbody.innerHTML = show.map(function (r) {
      return '<tr><td class="mono">' + escapeHtml(r.id) + '</td>' +
             '<td class="num">' + (r.applied ? r.loss.toFixed(2) : '0.00') + '</td>' +
             '<td class="num">' + r.p.toFixed(3) + '</td>' +
             '<td>' + (r.applied ? '<span class="verdict-chip decline">APPLIED</span>' : '<span class="verdict-chip approve">WAIVED</span>') + '</td></tr>';
    }).join('') + (results.length > show.length
      ? '<tr><td colspan="4" class="mono muted" style="text-align:center">showing first ' + show.length + ' of ' + results.length + ' rows — download exports include all rows</td></tr>'
      : '');

    var note = 'Scored ' + results.length + ' row(s) with the demo heuristic.';
    if (rowErrors && rowErrors.length) { note += ' ' + rowErrors.length + ' row(s) skipped: ' + rowErrors[0]; }
    setMsg(msg, note, rowErrors && rowErrors.length ? 'error' : 'success');

    drawHistogram(results);
  }

  function setText(id, text) {
    var el = $(id);
    if (el) { el.textContent = text; }
  }

  function drawHistogram(rows) {
    var canvas = $('histCanvas'), empty = $('histEmpty');
    if (!canvas || !canvas.getContext) { return; }
    if (!rows || !rows.length) {
      if (empty) { empty.hidden = false; }
      canvas.style.display = 'none';
      return;
    }
    if (empty) { empty.hidden = true; }
    canvas.style.display = 'block';
    var ctx = canvas.getContext('2d');
    if (!ctx) { if (empty) { empty.hidden = false; empty.textContent = 'Canvas drawing is unavailable in this browser.'; } return; }

    var dpr = window.devicePixelRatio || 1;
    var cssW = Math.max(280, canvas.clientWidth || 640);
    var cssH = 240;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var bins = new Array(10).fill(0), i;
    for (i = 0; i < rows.length; i++) {
      bins[clamp(Math.floor(rows[i].p * 10), 0, 9)]++;
    }
    var maxBin = Math.max.apply(null, bins) || 1;
    var padL = 34, padR = 8, padT = 12, padB = 34;
    var w = cssW - padL - padR, h = cssH - padT - padB;

    ctx.strokeStyle = '#cfc5b4';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + h); ctx.lineTo(padL + w, padT + h); ctx.stroke();

    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#7d756a';
    ctx.textAlign = 'right';
    ctx.fillText(String(maxBin), padL - 6, padT + 8);
    ctx.fillText('0', padL - 6, padT + h + 4);
    ctx.textAlign = 'center';
    ctx.fillText('P(default) bins (0.0 → 1.0)', padL + w / 2, cssH - 6);

    var gap = 4, bw = (w - gap * 9) / 10;
    for (i = 0; i < 10; i++) {
      var bh = bins[i] / maxBin * h;
      var x = padL + i * (bw + gap);
      var y = padT + h - bh;
      ctx.fillStyle = (i + 1) / 10 > LOSS_CUT ? '#a4243b' : ((i + 1) / 10 >= 0.45 ? '#c8912a' : '#2f5d3a');
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = 'rgba(28,26,23,.35)';
      ctx.strokeRect(x, y, bw, bh);
      if (bins[i] > 0) {
        ctx.fillStyle = '#4a453d';
        ctx.textAlign = 'center';
        ctx.fillText(String(bins[i]), x + bw / 2, y - 4);
      }
    }
    /* 0.60 cut marker */
    var cutX = padL + 0.6 * w;
    ctx.strokeStyle = '#1c1a17';
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(cutX, padT); ctx.lineTo(cutX, padT + h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#1c1a17';
    ctx.textAlign = 'left';
    ctx.fillText('0.60', cutX + 3, padT + 10);
  }

  function runBatch() {
    var textarea = $('batchInput');
    if (!textarea) { return; }
    var text = textarea.value;
    if (!text.trim()) {
      setMsg($('batchMsg'), 'Nothing to score — paste CSV rows or load the sample first.', 'error');
      return;
    }
    var ctx = buildContext();
    var progress = $('batchProgress'), bar = $('batchBar');
    if (progress) { progress.hidden = false; }
    if (bar) { bar.style.width = '15%'; }

    setTimeout(function () {
      var out = scoreBatch(text, ctx);
      if (bar) { bar.style.width = '70%'; }
      setTimeout(function () {
        if (out.error) {
          setMsg($('batchMsg'), out.error, 'error');
          if (bar) { bar.style.width = '0%'; }
          if (progress) { progress.hidden = true; }
          return;
        }
        renderBatch(out.rows, out.rowErrors);
        if (bar) { bar.style.width = '100%'; }
        setTimeout(function () {
          if (progress) { progress.hidden = true; }
          if (bar) { bar.style.width = '0%'; }
        }, 400);
      }, 60);
    }, 60);
  }

  var SAMPLE_CSV = [
    'id,amount,term,rate,age,income,dti,lines,derog,late30,late60,late90',
    'T-1001,24000,48,14.9,41,72000,44,12,1,2,1,0',
    'T-1002,8000,24,9.9,27,39000,29,5,0,0,0,0',
    'T-1003,45000,60,17.5,23,26000,58,17,2,4,2,1',
    'T-1004,15000,36,10.5,52,120000,21,8,0,0,0,0',
    'T-1005,31000,48,13.2,36,54000,47,14,1,1,1,0',
    'T-1006,5500,12,8.4,64,96000,12,4,0,0,0,0',
    'T-1007,60000,60,19.9,29,44000,66,21,3,5,3,2',
    'T-1008,12000,36,11.2,45,68000,35,10,0,1,0,0'
  ].join('\n');

  function initBatch() {
    var btn = $('scoreBatchBtn');
    if (btn) { btn.addEventListener('click', runBatch); }

    var sample = $('loadSampleBtn');
    if (sample) {
      sample.addEventListener('click', function () {
        var ta = $('batchInput');
        if (ta) { ta.value = SAMPLE_CSV; }
        var name = $('batchFileName');
        if (name) { name.hidden = false; name.textContent = 'sample: 8 demo rows loaded'; }
        setMsg($('batchMsg'), 'Sample loaded — press Score batch.', 'success');
      });
    }

    var clear = $('batchClearBtn');
    if (clear) {
      clear.addEventListener('click', function () {
        var ta = $('batchInput'); if (ta) { ta.value = ''; }
        var name = $('batchFileName'); if (name) { name.hidden = true; name.textContent = ''; }
        lastBatchRows = [];
        var tbody = $('batchTableBody'); if (tbody) { tbody.innerHTML = ''; }
        var stats = $('batchStats'); if (stats) { stats.hidden = true; }
        var empty = $('batchEmpty'); if (empty) { empty.hidden = false; }
        var ex = $('exportSubmissionBtn'); if (ex) { ex.disabled = true; }
        drawHistogram([]);
        setMsg($('batchMsg'), 'Batch cleared.', '');
      });
    }

    var fileInput = $('batchFile');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) { readBatchFile(fileInput.files[0]); }
      });
    }
    var drop = $('batchDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (evName) {
        drop.addEventListener(evName, function (e) { e.preventDefault(); drop.classList.add('over'); });
      });
      ['dragleave', 'drop'].forEach(function (evName) {
        drop.addEventListener(evName, function (e) { e.preventDefault(); drop.classList.remove('over'); });
      });
      drop.addEventListener('drop', function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files[0]) { readBatchFile(files[0]); }
      });
    }

    var exportBtn = $('exportSubmissionBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (!lastBatchRows.length) { return; }
        var rows = [['id', 'loss']];
        lastBatchRows.forEach(function (r) {
          rows.push([r.id, r.applied ? r.loss.toFixed(2) : '0.00']);
        });
        var ok = downloadBlob('submission.csv', toCsv(rows), 'text/csv;charset=utf-8');
        setMsg($('batchMsg'), ok ? 'submission.csv downloaded (' + lastBatchRows.length + ' rows).' : 'Download failed — browser blocked the file.', ok ? 'success' : 'error');
      });
    }
  }

  function readBatchFile(file) {
    var msg = $('batchMsg');
    if (file.size > 2 * 1024 * 1024) {
      setMsg(msg, 'File too large for this demo (2 MB max). Paste rows instead.', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var ta = $('batchInput');
      if (ta) { ta.value = String(reader.result || ''); }
      var name = $('batchFileName');
      if (name) { name.hidden = false; name.textContent = file.name + ' · ' + file.size + ' bytes loaded'; }
      setMsg(msg, 'Loaded ' + file.name + ' — press Score batch.', 'success');
    };
    reader.onerror = function () { setMsg(msg, 'Could not read that file.', 'error'); };
    try { reader.readAsText(file); }
    catch (e) { setMsg(msg, 'Could not read that file.', 'error'); }
  }

  /* ------------------------------------------------------------------ *
   * Copy buttons                                                        *
   * ------------------------------------------------------------------ */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function initCopy() {
    all('.copy-btn').forEach(function (btn) {
      var original = btn.textContent;
      btn.addEventListener('click', function () {
        var target = $(btn.getAttribute('data-copy'));
        if (!target) { return; }
        copyText(target.textContent).then(function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = original; }, 1500);
        }).catch(function () {
          btn.textContent = 'Copy failed';
          setTimeout(function () { btn.textContent = original; }, 1500);
        });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Wiring                                                              *
   * ------------------------------------------------------------------ */
  function initForm() {
    var form = $('caseForm');
    if (form) {
      form.addEventListener('input', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('f-input')) {
          renderCombos();
          recompute(false);
          return;
        }
        recompute(true);
      });
      form.addEventListener('submit', function (e) { e.preventDefault(); });
      form.addEventListener('blur', function (e) {
        if (e.target && e.target.type === 'number') { recompute(true); }
      }, true);
    }

    ['blend-comb', 'blend-comb1', 'blend-comb2'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('input', function () {
          renderCombos();
          recompute(false);
        });
      }
    });

    var resetF = $('resetFBtn');
    if (resetF) {
      resetF.addEventListener('click', function () {
        all('.f-input').forEach(function (el) { el.value = '1'; });
        renderCombos();
        recompute(false);
        setMsg($('caseMsg'), 'f-fields reset to demo defaults.', 'success');
      });
    }

    var resetBtn = $('resetBtn');
    if (resetBtn) { resetBtn.addEventListener('click', function () { resetCase(false); setMsg($('caseMsg'), 'Case reset to defaults.', 'success'); }); }

    var newCase = $('newCaseBtn');
    if (newCase) { newCase.addEventListener('click', function () { resetCase(true); setMsg($('caseMsg'), 'New case opened.', 'success'); }); }

    var fileBtn = $('fileBtn');
    if (fileBtn) { fileBtn.addEventListener('click', fileDecision); }

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var single = $('tab-single');
        if (single && single.getAttribute('aria-selected') === 'true') {
          e.preventDefault();
          fileDecision();
        }
      }
    });
  }

  function initBoot() {
    var boot = $('boot');
    if (!boot) { return; }
    var hide = function () { boot.classList.add('done'); setTimeout(function () { boot.remove(); }, 400); };
    if (document.readyState === 'complete') { setTimeout(hide, 150); }
    else { window.addEventListener('load', function () { setTimeout(hide, 150); }); }
    setTimeout(hide, 2500); /* never trap the user behind the loader */
  }

  function init() {
    initBoot();
    buildDial();
    initTabs();
    initLedger();
    initBatch();
    initCopy();
    initForm();
    renderLedger();
    recompute(true);

    var caseEl = $('caseNo');
    if (caseEl && caseEl.textContent === 'UD-000001') {
      caseEl.textContent = 'UD-' + pad(storeGet(STORE_KEYS.caseNo, 1), 6);
      storeSet(STORE_KEYS.caseNo, storeGet(STORE_KEYS.caseNo, 1) + 1);
    }

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { drawHistogram(lastBatchRows); }, 180);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
