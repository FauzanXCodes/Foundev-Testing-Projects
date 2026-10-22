/* =========================================================================
   DEWS — Dropout Early-Warning System (policy tool preview)
   Vanilla JS. Synthetic cohort only: demo heuristic scores + localStorage
   interventions. Real model scoring lives in the repo's Python pipeline.
   ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Synthetic demo cohort — NOT real student records.                   *
   * Illustrative rows written for this UI preview; the repo's real data  *
   * is school-level aggregate and withheld (pipeline/data/Data_Readme.md). *
   * ------------------------------------------------------------------ */
  var COHORT = [
    { id: 'SYN-4101', grade: 9,  absences: 31, gpa: -0.8, credits: 68, behavior: 3, outcome: 1 },
    { id: 'SYN-4102', grade: 9,  absences: 6,  gpa:  0.2, credits: 94, behavior: 0, outcome: 0 },
    { id: 'SYN-4103', grade: 9,  absences: 18, gpa: -0.4, credits: 82, behavior: 1, outcome: 1 },
    { id: 'SYN-4104', grade: 9,  absences: 37, gpa: -1.1, credits: 61, behavior: 4, outcome: 1 },
    { id: 'SYN-4105', grade: 9,  absences: 9,  gpa: -0.1, credits: 90, behavior: 0, outcome: 0 },
    { id: 'SYN-4106', grade: 9,  absences: 24, gpa: -0.6, credits: 76, behavior: 2, outcome: 0 },
    { id: 'SYN-4107', grade: 10, absences: 12, gpa: -0.3, credits: 86, behavior: 1, outcome: 0 },
    { id: 'SYN-4108', grade: 10, absences: 34, gpa: -0.9, credits: 64, behavior: 3, outcome: 1 },
    { id: 'SYN-4109', grade: 10, absences: 3,  gpa:  0.4, credits: 97, behavior: 0, outcome: 0 },
    { id: 'SYN-4110', grade: 10, absences: 27, gpa: -0.7, credits: 73, behavior: 2, outcome: 0 },
    { id: 'SYN-4111', grade: 10, absences: 39, gpa: -1.3, credits: 57, behavior: 5, outcome: 1 },
    { id: 'SYN-4112', grade: 10, absences: 15, gpa: -0.2, credits: 88, behavior: 0, outcome: 0 },
    { id: 'SYN-4113', grade: 11, absences: 21, gpa: -0.5, credits: 79, behavior: 1, outcome: 0 },
    { id: 'SYN-4114', grade: 11, absences: 36, gpa: -1.0, credits: 62, behavior: 4, outcome: 1 },
    { id: 'SYN-4115', grade: 11, absences: 7,  gpa:  0.1, credits: 93, behavior: 0, outcome: 0 },
    { id: 'SYN-4116', grade: 11, absences: 29, gpa: -0.8, credits: 70, behavior: 3, outcome: 1 },
    { id: 'SYN-4117', grade: 11, absences: 11, gpa: -0.2, credits: 91, behavior: 1, outcome: 0 },
    { id: 'SYN-4118', grade: 11, absences: 41, gpa: -1.4, credits: 55, behavior: 4, outcome: 1 },
    { id: 'SYN-4119', grade: 12, absences: 17, gpa: -0.4, credits: 84, behavior: 0, outcome: 0 },
    { id: 'SYN-4120', grade: 12, absences: 33, gpa: -0.9, credits: 66, behavior: 2, outcome: 0 },
    { id: 'SYN-4121', grade: 12, absences: 4,  gpa:  0.3, credits: 96, behavior: 0, outcome: 0 },
    { id: 'SYN-4122', grade: 12, absences: 26, gpa: -0.6, credits: 75, behavior: 1, outcome: 1 },
    { id: 'SYN-4123', grade: 12, absences: 13, gpa: -0.3, credits: 87, behavior: 0, outcome: 0 },
    { id: 'SYN-4124', grade: 12, absences: 38, gpa: -1.2, credits: 59, behavior: 3, outcome: 1 }
  ];

  /* Demo heuristic weights (shown in the drawer). */
  var WEIGHTS = { absence: 0.30, gpa: 0.25, credits: 0.25, behavior: 0.20 };
  var SCALE = { absMax: 35, gpaDrop: 1.2, creditGap: 38, behaviorMax: 4 };

  function clamp(n, a, b) { return n < a ? a : (n > b ? b : n); }

  function components(row) {
    return {
      absence: clamp(row.absences / SCALE.absMax, 0, 1),
      gpa: clamp(-row.gpa / SCALE.gpaDrop, 0, 1),
      credits: clamp((100 - row.credits) / SCALE.creditGap, 0, 1),
      behavior: clamp(row.behavior / SCALE.behaviorMax, 0, 1)
    };
  }

  function scoreOf(row) {
    var c = components(row);
    return Math.round(100 * (WEIGHTS.absence * c.absence + WEIGHTS.gpa * c.gpa +
                             WEIGHTS.credits * c.credits + WEIGHTS.behavior * c.behavior));
  }

  function bandOf(score) {
    if (score >= 65) { return 'HIGH'; }
    if (score >= 40) { return 'MED'; }
    return 'LOW';
  }

  COHORT.forEach(function (row) {
    row.score = scoreOf(row);
    row.band = bandOf(row.score);
  });

  var SUGGESTIONS = [
    { type: 'Tutoring check-in', why: 'Weekly subject support for the courses driving credit risk.' },
    { type: 'Mentor assignment', why: 'A trusted adult meets biweekly — relationship-based engagement.' },
    { type: 'Attendance contract', why: 'Clear attendance expectations plus family follow-up loop.' },
    { type: 'Credit recovery plan', why: 'Map remaining credits and enroll in recovery options now.' },
    { type: 'Family outreach', why: 'Home-language outreach to align school and family supports.' }
  ];

  var STORE_KEY = 'dews.interventions.v1';

  var state = {
    grade: 'all',
    band: 'all',
    search: '',
    sort: { key: 'score', dir: -1 },
    openId: null,
    editingTs: null,
    lastFocus: null
  };

  /* ------------------------------------------------------------------ *
   * Utils                                                               *
   * ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function storeGet() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function storeSave(list) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }
  var interventions = storeGet();

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function setMsg(el, text, kind) {
    if (!el) { return; }
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }
  function today() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function csvCell(value) {
    var s = String(value == null ? '' : value);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
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

  function lastInterventionFor(id) {
    var list = interventions.filter(function (iv) { return iv.id === id; });
    if (!list.length) { return null; }
    list.sort(function (a, b) {
      if (a.date === b.date) { return (b.ts || 0) - (a.ts || 0); }
      return a.date < b.date ? 1 : -1;
    });
    return list[0];
  }

  /* ------------------------------------------------------------------ *
   * KPIs                                                                *
   * ------------------------------------------------------------------ */
  function renderKpis() {
    var high = 0, med = 0;
    COHORT.forEach(function (r) {
      if (r.band === 'HIGH') { high++; }
      else if (r.band === 'MED') { med++; }
    });
    setText('kpiCohort', String(COHORT.length));
    setText('kpiHigh', String(high));
    setText('kpiMed', String(med));
    setText('kpiInterv', String(interventions.length));
  }
  function setText(id, text) {
    var el = $(id);
    if (el) { el.textContent = text; }
  }

  /* ------------------------------------------------------------------ *
   * Register: filter / sort / render                                    *
   * ------------------------------------------------------------------ */
  function visibleRows() {
    var rows = COHORT.filter(function (r) {
      if (state.grade !== 'all' && String(r.grade) !== state.grade) { return false; }
      if (state.band !== 'all' && r.band !== state.band) { return false; }
      if (state.search && r.id.toLowerCase().indexOf(state.search) === -1) { return false; }
      return true;
    });
    var key = state.sort.key, dir = state.sort.dir;
    rows.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (typeof av === 'string') {
        var cmp = String(av).localeCompare(String(bv));
        return cmp * dir;
      }
      if (av === bv) { return a.id < b.id ? -1 : 1; }
      return (av < bv ? -1 : 1) * dir;
    });
    return rows;
  }

  function renderRegister() {
    var body = $('registerBody'), empty = $('registerEmpty'),
        table = $('registerTable'), count = $('resultCount');
    if (!body) { return; }
    var rows = visibleRows();

    if (count) { count.textContent = rows.length + ' of ' + COHORT.length + ' shown'; }
    if (empty) { empty.hidden = rows.length > 0; }
    if (table) { table.hidden = rows.length === 0; }

    body.innerHTML = rows.map(function (r) {
      var iv = lastInterventionFor(r.id);
      var trendClass = r.gpa < 0 ? 'trend-down' : 'trend-up';
      var trendSign = r.gpa > 0 ? '+' : '';
      var bandClass = r.band;
      var fillClass = r.band === 'HIGH' ? 'high' : (r.band === 'MED' ? 'med' : 'low');
      var intervHtml = iv
        ? '<span class="has">' + escapeHtml(iv.type) + ' <span class="mono">· ' + escapeHtml(iv.date) + '</span></span>'
        : '<span class="none">—</span>';
      return '<tr tabindex="0" data-id="' + r.id + '" aria-label="Open profile for ' + r.id + '" class="' +
             (state.openId === r.id ? 'is-open' : '') + '">' +
             '<td class="id-cell">' + r.id + '</td>' +
             '<td class="grade-cell">' + r.grade + '</td>' +
             '<td class="num">' + r.absences + '</td>' +
             '<td class="num ' + trendClass + '">' + trendSign + r.gpa.toFixed(1) + '</td>' +
             '<td class="num">' + r.credits + '</td>' +
             '<td class="num"><span class="score-cell"><span class="score-num">' + r.score + '</span>' +
               '<span class="score-track"><span class="score-fill ' + fillClass + '" style="width:' + r.score + '%"></span></span></span></td>' +
             '<td><span class="band-chip ' + bandClass + '">' + r.band + '</span></td>' +
             '<td class="interv-cell' + (iv ? ' has' : '') + '">' + intervHtml + '</td></tr>';
    }).join('');

    all('#registerBody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openDrawer(tr.getAttribute('data-id'), tr); });
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          openDrawer(tr.getAttribute('data-id'), tr);
        }
      });
    });

    updateSortIndicators();
  }

  function updateSortIndicators() {
    all('#registerTable thead th').forEach(function (th) {
      var btn = th.querySelector('.sort-btn');
      if (!btn) { return; }
      if (btn.getAttribute('data-sort') === state.sort.key) {
        th.setAttribute('aria-sort', state.sort.dir === 1 ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    });
  }

  function initFilters() {
    all('.chip[data-grade]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.grade = btn.getAttribute('data-grade');
        all('.chip[data-grade]').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderRegister();
      });
    });
    all('.chip[data-band]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.band = btn.getAttribute('data-band');
        all('.chip[data-band]').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderRegister();
      });
    });

    var search = $('registerSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value.trim().toLowerCase();
        renderRegister();
      });
    }

    var clear = $('clearFiltersBtn');
    if (clear) {
      clear.addEventListener('click', function () {
        state.grade = 'all'; state.band = 'all'; state.search = '';
        if (search) { search.value = ''; }
        all('.chip[data-grade]').forEach(function (b) {
          var on = b.getAttribute('data-grade') === 'all';
          b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        all('.chip[data-band]').forEach(function (b) {
          var on = b.getAttribute('data-band') === 'all';
          b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderRegister();
      });
    }

    all('.sort-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-sort');
        if (state.sort.key === key) { state.sort.dir *= -1; }
        else {
          state.sort.key = key;
          state.sort.dir = (key === 'id' || key === 'grade') ? 1 : -1;
        }
        renderRegister();
      });
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      var s = $('registerSearch');
      if (!s) { return; }
      var regTab = $('tab-register');
      if (regTab && regTab.getAttribute('aria-selected') !== 'true') { regTab.click(); }
      ev.preventDefault();
      s.focus();
      s.select();
    });
  }

  /* ------------------------------------------------------------------ *
   * Exports                                                             *
   * ------------------------------------------------------------------ */
  function initExports() {
    var regBtn = $('exportRegisterCsv');
    if (regBtn) {
      regBtn.addEventListener('click', function () {
        var rows = visibleRows();
        if (!rows.length) {
          regBtn.textContent = 'Nothing to export';
          setTimeout(function () { regBtn.textContent = 'Export register CSV'; }, 1600);
          return;
        }
        var out = [['enrollment', 'grade', 'absences', 'gpa_trend', 'credits_pct',
                    'risk_score', 'band', 'last_intervention', 'synthetic_outcome']];
        rows.forEach(function (r) {
          var iv = lastInterventionFor(r.id);
          out.push([r.id, r.grade, r.absences, r.gpa, r.credits, r.score, r.band,
                    iv ? iv.type + ' ' + iv.date : '', r.outcome]);
        });
        var ok = downloadBlob('dews-register.csv', toCsv(out), 'text/csv;charset=utf-8');
        setExportFeedback(regBtn, ok);
      });
    }

    var ivBtn = $('exportInterventionsCsv');
    if (ivBtn) {
      ivBtn.addEventListener('click', function () {
        if (!interventions.length) {
          ivBtn.textContent = 'No interventions yet';
          setTimeout(function () { ivBtn.textContent = 'Export interventions CSV'; }, 1800);
          return;
        }
        var out = [['enrollment', 'type', 'date', 'owner', 'note', 'logged_at']];
        interventions.slice().sort(function (a, b) {
          return a.date < b.date ? 1 : (a.date > b.date ? -1 : ((b.ts || 0) - (a.ts || 0)));
        }).forEach(function (iv) {
          out.push([iv.id, iv.type, iv.date, iv.owner || '', iv.note || '',
                    new Date(iv.ts || 0).toISOString()]);
        });
        var ok = downloadBlob('dews-interventions.csv', toCsv(out), 'text/csv;charset=utf-8');
        setExportFeedback(ivBtn, ok);
      });
    }
  }
  function setExportFeedback(btn, ok) {
    var original = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', original);
    btn.textContent = ok ? 'Downloaded' : 'Download failed';
    setTimeout(function () { btn.textContent = original; }, 1700);
  }

  /* ------------------------------------------------------------------ *
   * Drawer                                                              *
   * ------------------------------------------------------------------ */
  function rowById(id) {
    for (var i = 0; i < COHORT.length; i++) {
      if (COHORT[i].id === id) { return COHORT[i]; }
    }
    return null;
  }

  function openDrawer(id, tr) {
    var row = rowById(id);
    if (!row) { return; }
    state.openId = id;
    state.editingTs = null;
    state.lastFocus = tr || document.activeElement;

    all('#registerBody tr').forEach(function (r) {
      r.classList.toggle('is-open', r.getAttribute('data-id') === id);
    });

    var drawer = $('drawer'), overlay = $('drawerOverlay');
    if (overlay) { overlay.hidden = false; }
    if (drawer) {
      drawer.classList.add('open');
      drawer.removeAttribute('aria-hidden');
      if ('inert' in drawer) { drawer.inert = false; }
      requestAnimationFrame(function () {
        if (overlay) { overlay.classList.add('open'); }
      });
    }

    renderDrawer(row);
    var closeBtn = $('drawerClose');
    if (closeBtn) { setTimeout(function () { closeBtn.focus(); }, 60); }
  }

  function closeDrawer() {
    var drawer = $('drawer'), overlay = $('drawerOverlay');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      if ('inert' in drawer) { drawer.inert = true; }
    }
    if (overlay) { overlay.classList.remove('open'); }
    var delay = reduceMotion() ? 0 : 280;
    closeDrawer.tick = (closeDrawer.tick || 0) + 1;
    var token = closeDrawer.tick;
    setTimeout(function () {
      /* bail out if the drawer was reopened while we waited */
      if (token !== closeDrawer.tick) { return; }
      if (drawer && drawer.classList.contains('open')) { return; }
      if (overlay) { overlay.hidden = true; }
    }, delay);

    var prevId = state.openId;
    state.openId = null;
    state.editingTs = null;
    all('#registerBody tr').forEach(function (r) { r.classList.remove('is-open'); });

    if (state.lastFocus && document.contains(state.lastFocus)) {
      state.lastFocus.focus();
    } else if (prevId) {
      var row = document.querySelector('#registerBody tr[data-id="' + prevId + '"]');
      if (row) { row.focus(); }
    }
  }

  function renderDrawer(row) {
    setText('drawerId', row.id);

    var iv = lastInterventionFor(row.id);
    var profile = $('drawerProfile');
    if (profile) {
      profile.innerHTML =
        '<dt>Enrollment</dt><dd class="mono">' + row.id + '</dd>' +
        '<dt>Grade</dt><dd>' + row.grade + '</dd>' +
        '<dt>Absences</dt><dd>' + row.absences + ' days' + (row.absences >= 35 ? ' <span class="warn">· chronic</span>' : '') + '</dd>' +
        '<dt>GPA trend</dt><dd class="' + (row.gpa < 0 ? 'warn' : '') + '">' + (row.gpa > 0 ? '+' : '') + row.gpa.toFixed(1) + '</dd>' +
        '<dt>Credits earned</dt><dd class="' + (row.credits < 70 ? 'warn' : '') + '">' + row.credits + '%</dd>' +
        '<dt>Behavior flags</dt><dd>' + row.behavior + '</dd>' +
        '<dt>Outcome label*</dt><dd class="' + (row.outcome === 1 ? 'warn' : '') + '">' +
          (row.outcome === 1 ? 'illustrative dropout' : 'illustrative persistence') + '</dd>' +
        '<dt>Last intervention</dt><dd>' + (iv ? escapeHtml(iv.type) + ' · ' + escapeHtml(iv.date) : '—') + '</dd>';
    }

    var c = components(row);
    var bars = $('factorBars');
    if (bars) {
      var defs = [
        { key: 'absence', name: 'Absence rate', weight: WEIGHTS.absence,
          value: row.absences + ' days',
          pct: Math.round(c.absence * 100),
          why: row.absences >= 30 ? 'Attendance is the strongest signal in this demo score.'
               : (row.absences >= 15 ? 'Absences are above the demo comfort level.' : 'Attendance is within the demo comfort range.') },
        { key: 'gpa', name: 'GPA decline', weight: WEIGHTS.gpa,
          value: (row.gpa > 0 ? '+' : '') + row.gpa.toFixed(1) + ' GPA',
          pct: Math.round(c.gpa * 100),
          why: row.gpa <= -0.8 ? 'Steep year-over-year decline.' : (row.gpa < 0 ? 'Mild decline to watch.' : 'Trend is flat or improving.') },
        { key: 'credits', name: 'Credit shortfall', weight: WEIGHTS.credits,
          value: row.credits + '% earned',
          pct: Math.round(c.credits * 100),
          why: row.credits < 70 ? 'Behind pace for on-time graduation in the demo scale.' : 'On pace on the demo scale.' },
        { key: 'behavior', name: 'Behavior flags', weight: WEIGHTS.behavior,
          value: row.behavior + ' flag' + (row.behavior === 1 ? '' : 's'),
          pct: Math.round(c.behavior * 100),
          why: row.behavior >= 3 ? 'Multiple flags — pair with a mentor check-in.' : 'No heavy flag load in the demo data.' }
      ];
      bars.innerHTML = defs.map(function (d) {
        var level = d.pct >= 66 ? 'high' : (d.pct >= 40 ? 'med' : 'low');
        return '<div class="factor">' +
          '<div class="factor-top"><span class="f-name">' + d.name +
            ' <span class="f-val">(weight ' + Math.round(d.weight * 100) + '%)</span></span>' +
            '<span class="f-val">' + escapeHtml(d.value) + ' → +' +
            (100 * d.weight * d.pct / 100).toFixed(1) + ' pts</span></div>' +
          '<span class="factor-track"><span class="factor-fill ' + level + '" style="width:' + d.pct + '%"></span></span>' +
          '<p class="factor-why">' + escapeHtml(d.why) + '</p></div>';
      }).join('');
    }

    setText('drawerScore', String(row.score));
    var bandEl = $('drawerBand');
    if (bandEl) {
      bandEl.textContent = row.band;
      bandEl.className = 'band-chip ' + row.band;
    }

    var sug = $('suggestionList');
    if (sug) {
      sug.innerHTML = SUGGESTIONS.map(function (s, i) {
        return '<li><span><span class="s-name">' + escapeHtml(s.type) + '</span>' +
          '<span class="s-why">' + escapeHtml(s.why) + '</span></span>' +
          '<button class="btn ghost small" type="button" data-suggest="' + i + '">Use</button></li>';
      }).join('');
      all('#suggestionList [data-suggest]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var s = SUGGESTIONS[Number(btn.getAttribute('data-suggest'))];
          var sel = $('intervType'), note = $('intervNote');
          if (sel) {
            for (var i = 0; i < sel.options.length; i++) {
              if (sel.options[i].text === s.type) { sel.selectedIndex = i; break; }
            }
          }
          if (note && !note.value) { note.value = s.why; }
          cancelEdit();
          if (sel) { sel.focus(); }
          setMsg($('intervMsg'), 'Template loaded into the form below — adjust as needed.', 'success');
        });
      });
    }

    resetIntervForm();
    renderHistory(row);
  }

  function renderHistory(row) {
    var list = $('intervHistory'), empty = $('historyEmpty');
    if (!list) { return; }
    var mine = interventions.filter(function (iv) { return iv.id === row.id; });
    mine.sort(function (a, b) {
      if (a.date === b.date) { return (b.ts || 0) - (a.ts || 0); }
      return a.date < b.date ? 1 : -1;
    });
    if (empty) { empty.hidden = mine.length > 0; }
    list.innerHTML = mine.map(function (iv) {
      var editing = state.editingTs === iv.ts;
      return '<li class="' + (editing ? 'editing' : '') + '">' +
        '<span class="h-top"><span class="h-type">' + escapeHtml(iv.type) + '</span>' +
        '<span class="h-date">' + escapeHtml(iv.date) + '</span></span>' +
        (iv.owner ? '<span class="h-note">' + escapeHtml(iv.owner) + '</span>' : '') +
        (iv.note ? '<span class="h-note">' + escapeHtml(iv.note) + '</span>' : '') +
        '<span class="h-actions">' +
          '<button class="btn ghost small" type="button" data-edit="' + iv.ts + '">Edit</button>' +
          '<button class="btn ghost small danger" type="button" data-del="' + iv.ts + '">Delete</button>' +
        '</span></li>';
    }).join('');

    all('#intervHistory [data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ts = Number(btn.getAttribute('data-del'));
        var removed = interventions.filter(function (iv) { return iv.ts === ts; })[0];
        interventions = interventions.filter(function (iv) { return iv.ts !== ts; });
        persistInterventions();
        renderHistory(row);
        renderRegister();
        renderKpis();
        setMsg($('intervMsg'), 'Deleted ' + (removed ? removed.type : 'intervention') + '.', 'success');
      });
    });
    all('#intervHistory [data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ts = Number(btn.getAttribute('data-edit'));
        var iv = interventions.filter(function (x) { return x.ts === ts; })[0];
        if (!iv) { return; }
        state.editingTs = ts;
        var sel = $('intervType'), dateEl = $('intervDate'),
            owner = $('intervOwner'), note = $('intervNote');
        if (sel) { sel.value = iv.type; }
        if (dateEl) { dateEl.value = iv.date; }
        if (owner) { owner.value = iv.owner || ''; }
        if (note) { note.value = iv.note || ''; }
        setText('formTitle', 'Edit intervention');
        var save = $('intervSave'); if (save) { save.textContent = 'Update intervention'; }
        var cancel = $('intervCancel'); if (cancel) { cancel.hidden = false; }
        renderHistory(row);
        if (sel) { sel.focus(); }
      });
    });
  }

  function persistInterventions() {
    if (!storeSave(interventions)) {
      setMsg($('intervMsg'), 'Could not save — localStorage is blocked in this browser.', 'error');
      return false;
    }
    return true;
  }

  function resetIntervForm() {
    state.editingTs = null;
    var sel = $('intervType'), dateEl = $('intervDate'),
        owner = $('intervOwner'), note = $('intervNote');
    if (sel) { sel.value = ''; sel.removeAttribute('aria-invalid'); }
    if (dateEl) { dateEl.value = today(); dateEl.removeAttribute('aria-invalid'); }
    if (owner) { owner.value = ''; }
    if (note) { note.value = ''; }
    var err = $('intervErr'); if (err) { err.hidden = true; }
    setText('formTitle', 'Log an intervention');
    var save = $('intervSave'); if (save) { save.textContent = 'Save intervention'; }
    var cancel = $('intervCancel'); if (cancel) { cancel.hidden = true; }
  }
  function cancelEdit() { resetIntervForm(); }

  function initInterventionForm() {
    var form = $('intervForm');
    if (!form) { return; }
    var dateEl = $('intervDate');
    if (dateEl && !dateEl.value) { dateEl.value = today(); }
    if (dateEl) { dateEl.max = today(); }

    var cancel = $('intervCancel');
    if (cancel) { cancel.addEventListener('click', function () { resetIntervForm(); setMsg($('intervMsg'), '', ''); }); }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!state.openId) { return; }
      var sel = $('intervType'), date = $('intervDate');
      var err = $('intervErr');
      var problems = [];
      if (sel && !sel.value) { problems.push('choose an intervention type'); sel.setAttribute('aria-invalid', 'true'); }
      else if (sel) { sel.removeAttribute('aria-invalid'); }
      if (date && (!date.value || date.value > today())) {
        problems.push('pick a valid date (today or earlier)');
        if (date) { date.setAttribute('aria-invalid', 'true'); }
      } else if (date) { date.removeAttribute('aria-invalid'); }

      if (problems.length) {
        if (err) { err.textContent = 'Please ' + problems.join(' and ') + '.'; err.hidden = false; }
        return;
      }
      if (err) { err.hidden = true; }

      var payload = {
        id: state.openId,
        type: sel.value,
        date: date.value,
        owner: ($('intervOwner') ? $('intervOwner').value.trim() : ''),
        note: $('intervNote') ? $('intervNote').value.trim() : '',
        ts: state.editingTs || Date.now()
      };

      if (state.editingTs) {
        interventions = interventions.map(function (iv) {
          return iv.ts === state.editingTs ? payload : iv;
        });
      } else {
        interventions.push(payload);
      }
      if (!persistInterventions()) { return; }

      var wasEdit = !!state.editingTs;
      var row = rowById(state.openId);
      resetIntervForm();
      if (row) { renderHistory(row); }
      renderRegister();
      renderKpis();
      setMsg($('intervMsg'), (wasEdit ? 'Updated' : 'Logged') + ' ' + payload.type + ' for ' + payload.id + '.', 'success');
    });
  }

  function initDrawerChrome() {
    var close = $('drawerClose');
    if (close) { close.addEventListener('click', closeDrawer); }
    var overlay = $('drawerOverlay');
    if (overlay) { overlay.addEventListener('click', closeDrawer); }
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        var drawer = $('drawer');
        if (drawer && drawer.classList.contains('open')) { closeDrawer(); }
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Policy lab: precision@k + PR-style curves                            *
   * ------------------------------------------------------------------ */
  function rankedCohort() {
    return COHORT.slice().sort(function (a, b) {
      if (b.score !== a.score) { return b.score - a.score; }
      if (b.absences !== a.absences) { return b.absences - a.absences; }
      return a.id < b.id ? -1 : 1;
    });
  }

  function labMetrics() {
    var ranked = rankedCohort();
    var n = ranked.length;
    var positives = 0;
    ranked.forEach(function (r) { positives += r.outcome; });

    var slider = $('capSlider');
    var pct = slider ? clamp(Number(slider.value), 5, 100) : 25;
    var k = Math.max(1, Math.round(n * pct / 100));
    var tp = 0;
    for (var i = 0; i < k; i++) { tp += ranked[i].outcome; }

    var series = [];
    var running = 0;
    for (var j = 0; j < n; j++) {
      running += ranked[j].outcome;
      series.push({
        share: (j + 1) / n,
        precision: running / (j + 1),
        recall: positives ? running / positives : 0
      });
    }
    return {
      n: n, positives: positives, pct: pct, k: k, tp: tp,
      precision: tp / k,
      recall: positives ? tp / positives : 0,
      missed: positives - tp,
      baseRate: positives / n,
      series: series
    };
  }

  function renderLab() {
    var m = labMetrics();
    setText('capPct', m.pct + '%');
    setText('mFlagged', String(m.k));
    setText('mFlaggedNote', 'of ' + m.n + ' rows');
    setText('mPrecision', m.precision.toFixed(2));
    setText('mRecall', m.recall.toFixed(2));
    setText('mMissed', String(m.missed));
    setText('lgCap', m.pct + '%');

    var interp = $('labInterpretation');
    if (interp) {
      interp.innerHTML = 'Flagging the top <strong>' + m.k + '</strong> of ' + m.n +
        ' rows (capacity ' + m.pct + '%): <strong>' + m.tp + ' of ' + m.positives +
        '</strong> illustrative dropouts captured &mdash; precision@k <strong>' + m.precision.toFixed(2) +
        '</strong>, recall@k <strong>' + m.recall.toFixed(2) + '</strong>. ' +
        (m.pct >= 90
          ? 'At near-universal capacity, precision falls to the cohort base rate (' + m.baseRate.toFixed(2) +
            ') — this is effectively a universal program.'
          : 'Serving everyone would raise recall to 1.00 but dilute precision to the base rate of ' +
            m.baseRate.toFixed(2) + '.');
    }
    drawPrCurve(m);
  }

  function drawPrCurve(m) {
    var canvas = $('prCanvas'), empty = $('prEmpty');
    if (!canvas || !canvas.getContext) {
      if (empty) { empty.hidden = false; }
      return;
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      if (empty) { empty.hidden = false; }
      return;
    }
    if (empty) { empty.hidden = true; }

    var dpr = window.devicePixelRatio || 1;
    var cssW = Math.max(300, canvas.clientWidth || 560);
    var cssH = Math.max(260, Math.round(cssW * 0.64));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var padL = 46, padR = 14, padT = 16, padB = 42;
    var w = cssW - padL - padR, h = cssH - padT - padB;
    var x = function (share) { return padL + share * w; };
    var y = function (val) { return padT + (1 - clamp(val, 0, 1)) * h; };

    ctx.font = '11px "IBM Plex Mono", monospace';

    /* grid + y labels */
    ctx.strokeStyle = '#e3e9ef';
    ctx.fillStyle = '#5d6b7d';
    ctx.lineWidth = 1;
    var g;
    for (g = 0; g <= 4; g++) {
      var gy = y(g / 4);
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + w, gy); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText((g / 4).toFixed(2), padL - 7, gy + 4);
    }
    /* x labels */
    ctx.textAlign = 'center';
    for (g = 0; g <= 4; g++) {
      ctx.fillText((g / 4 * 100) + '%', x(g / 4), padT + h + 17);
    }
    ctx.fillStyle = '#5d6b7d';
    ctx.fillText('share of cohort flagged', padL + w / 2, cssH - 6);

    /* axes */
    ctx.strokeStyle = '#94a3b3';
    ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + h); ctx.lineTo(padL + w, padT + h);
    ctx.stroke();

    /* baseline (random targeting precision = base rate) */
    ctx.strokeStyle = '#9aa8b8';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, y(m.baseRate)); ctx.lineTo(padL + w, y(m.baseRate));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7c8a9b';
    ctx.textAlign = 'left';
    ctx.fillText('baseline ' + m.baseRate.toFixed(2), padL + 6, y(m.baseRate) - 5);

    if (!m.series.length) { return; }

    function plot(key, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      m.series.forEach(function (pt, i) {
        var px = x(pt.share), py = y(pt[key]);
        if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
      });
      ctx.stroke();
    }
    plot('recall', '#e0a02c');
    plot('precision', '#245d8f');

    /* operating point */
    var op = m.series[m.k - 1];
    if (op) {
      var ox = x(op.share), oy = y(op.precision);
      ctx.strokeStyle = '#15293f';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ox, padT); ctx.lineTo(ox, padT + h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#245d8f';
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0a02c';
      ctx.beginPath(); ctx.arc(ox, y(op.recall), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#15293f';
      ctx.textAlign = ox > padL + w * 0.72 ? 'right' : 'left';
      ctx.fillText('k=' + m.k, ox + (ox > padL + w * 0.72 ? -8 : 8), padT + 12);
    }
  }

  function initLab() {
    var slider = $('capSlider');
    if (slider) {
      slider.addEventListener('input', renderLab);
    }
  }

  /* ------------------------------------------------------------------ *
   * Tabs                                                                *
   * ------------------------------------------------------------------ */
  function initTabs() {
    var tabs = all('[role="tab"]');
    if (!tabs.length) { return; }
    function activate(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = $(t.getAttribute('aria-controls'));
        if (panel) { panel.hidden = !on; }
      });
      if (focus) { tab.focus(); }
      if (tab.id === 'tab-lab') { renderLab(); }
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
   * Copy                                                                *
   * ------------------------------------------------------------------ */
  function initCopy() {
    all('.copy-btn').forEach(function (btn) {
      var original = btn.textContent;
      btn.addEventListener('click', function () {
        var target = $(btn.getAttribute('data-copy'));
        if (!target) { return; }
        var done = function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = original; }, 1500);
        };
        var fail = function () {
          btn.textContent = 'Copy failed';
          setTimeout(function () { btn.textContent = original; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(target.textContent).then(done).catch(fail);
        } else {
          try {
            var ta = document.createElement('textarea');
            ta.value = target.textContent;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            ok ? done() : fail();
          } catch (e) { fail(); }
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Init                                                                *
   * ------------------------------------------------------------------ */
  function init() {
    renderKpis();
    renderRegister();
    initFilters();
    initExports();
    initDrawerChrome();
    initInterventionForm();
    initLab();
    initTabs();
    initCopy();

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var labTab = $('tab-lab');
        if (labTab && labTab.getAttribute('aria-selected') === 'true') { renderLab(); }
      }, 160);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
