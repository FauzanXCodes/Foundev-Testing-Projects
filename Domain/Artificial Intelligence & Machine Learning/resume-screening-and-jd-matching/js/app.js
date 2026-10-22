(function () {
  "use strict";

  var SKILL_KEYWORDS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "sql", "r",
    "go", "rust", "php", "scala", "kotlin", "swift",
    "machine learning", "deep learning", "natural language processing",
    "nlp", "computer vision", "pytorch", "tensorflow", "keras",
    "scikit-learn", "transformers", "huggingface", "opencv", "llm",
    "generative ai", "data science", "neural networks",
    "react", "angular", "vue", "node.js", "django", "flask", "fastapi",
    "rest api", "graphql", "html", "css", "spring boot",
    "pandas", "numpy", "spark", "hadoop", "aws", "azure", "gcp",
    "docker", "kubernetes", "airflow", "etl", "data pipeline",
    "power bi", "tableau", "excel",
    "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
    "git", "github", "ci/cd", "agile", "scrum", "jira", "linux",
    "unit testing", "microservices",
    "communication", "leadership", "teamwork", "problem solving",
    "project management", "time management", "critical thinking",
    "collaboration", "presentation", "stakeholder management"
  ];

  var STOPWORDS = {
    the: 1, and: 1, for: 1, with: 1, that: 1, this: 1, "from": 1, are: 1,
    was: 1, were: 1, will: 1, can: 1, its: 1, "our": 1, "you": 1, "your": 1,
    has: 1, have: 1, had: 1, not: 1, but: 1, any: 1, all: 1, who: 1,
    their: 1, them: 1, they: 1, into: 1, than: 1, then: 1, when: 1,
    what: 1, which: 1, about: 1, more: 1, some: 1, each: 1, per: 1,
    via: 1, using: 1, used: 1, use: 1, well: 1, also: 1, may: 1, must: 1,
    should: 1, would: 1, could: 1, other: 1, others: 1, across: 1,
    "job": 1, "role": 1, "team": 1, "work": 1, "working": 1, "experience": 1,
    "skills": 1, "skill": 1, "strong": 1, "excellent": 1, "including": 1
  };

  var STORAGE_KEY = "tml-state-v1";
  var MAX_CANDIDATES = 8;

  var state = {
    jdText: "",
    skills: [],
    candidates: [],
    threshold: 75,
    results: [],
    compare: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      if (ch === "&") return "&amp;";
      if (ch === "<") return "&lt;";
      if (ch === ">") return "&gt;";
      if (ch === '"') return "&quot;";
      return "&#39;";
    });
  }

  function escRe(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function round1(num) {
    return Math.round(num * 10) / 10;
  }

  function toast(message, kind) {
    var host = $("toasts");
    if (!host || !message) return;
    var node = document.createElement("div");
    node.className = "toast" + (kind ? " is-" + kind : "");
    node.textContent = message;
    host.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 3600);
  }

  function clearToasts() {
    var host = $("toasts");
    if (host) host.innerHTML = "";
  }

  function reducedMotion() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    window.setTimeout(function () {
      el.classList.remove("flash");
    }, 2600);
  }

  function persist() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          jdText: state.jdText,
          skills: state.skills,
          candidates: state.candidates,
          threshold: state.threshold
        })
      );
    } catch (e) {
      return;
    }
  }

  function restore() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      if (typeof data.jdText === "string") state.jdText = data.jdText;
      if (Array.isArray(data.skills)) {
        state.skills = data.skills.filter(function (s) {
          return s && typeof s.name === "string" && s.name.trim();
        }).map(function (s) {
          return { name: s.name, auto: !!s.auto };
        });
      }
      if (Array.isArray(data.candidates)) {
        state.candidates = data.candidates.slice(0, MAX_CANDIDATES).map(function (c, i) {
          return {
            id: c && c.id ? String(c.id) : "c" + Date.now() + "-" + i,
            name: c && typeof c.name === "string" ? c.name : "",
            text: c && typeof c.text === "string" ? c.text : ""
          };
        });
      }
      if (typeof data.threshold === "number" && data.threshold >= 50 && data.threshold <= 95) {
        state.threshold = data.threshold;
      }
    } catch (e) {
      return;
    }
  }

  function copyText(text, done) {
    var fallback = function () {
      try {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        return ok;
      } catch (e) {
        return false;
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        if (fallback()) done();
        else toast("Copy blocked here - select the text and copy manually.", "error");
      });
    } else if (fallback()) {
      done();
    } else {
      toast("Copy blocked here - select the text and copy manually.", "error");
    }
  }

  function findSkills(text) {
    var lower = String(text || "").toLowerCase();
    if (!lower.trim()) return [];
    var found = [];
    SKILL_KEYWORDS.forEach(function (keyword) {
      var re = new RegExp("(^|[^a-z0-9])" + escRe(keyword) + "([^a-z0-9]|$)");
      if (re.test(lower)) found.push(keyword);
    });
    return found;
  }

  function autoExtract() {
    var found = findSkills(state.jdText);
    var manual = state.skills.filter(function (s) {
      return !s.auto;
    });
    var manualNames = {};
    manual.forEach(function (s) {
      manualNames[s.name.toLowerCase()] = true;
    });
    var next = found.filter(function (name) {
      return !manualNames[name.toLowerCase()];
    }).map(function (name) {
      return { name: name, auto: true };
    });
    manual.forEach(function (s) {
      next.push({ name: s.name, auto: false });
    });
    state.skills = next;
    renderSkills();
  }

  function renderSkills() {
    var list = $("skillChips");
    var empty = $("skillEmpty");
    if (!list) return;
    list.innerHTML = "";
    state.skills.forEach(function (skill) {
      var li = document.createElement("li");
      li.className = "chip" + (skill.auto ? "" : " chip-manual");
      li.innerHTML =
        "<span>" + esc(skill.name) + (skill.auto ? "" : " <span class=\"chip-x-note\">manual</span>") + "</span>" +
        '<button type="button" class="chip-x" data-skill="' + esc(skill.name) + '" aria-label="Remove skill ' + esc(skill.name) + '">&times;</button>';
      list.appendChild(li);
    });
    if (empty) empty.hidden = state.skills.length > 0;
  }

  function jdSkillNames() {
    return state.skills.map(function (s) {
      return s.name.toLowerCase();
    });
  }

  function tokenSet(text) {
    var raw = String(text || "").toLowerCase().match(/[a-z0-9+#][a-z0-9+#.]*/g) || [];
    var out = {};
    var count = 0;
    raw.forEach(function (token) {
      var clean = token.replace(/^[.]+|[.]+$/g, "");
      if (clean.length < 2) return;
      if (STOPWORDS[clean]) return;
      if (!out[clean]) {
        out[clean] = true;
        count += 1;
      }
    });
    return { set: out, size: count };
  }

  function tokenCosine(a, b) {
    if (!a.size || !b.size) return 0;
    var shared = 0;
    Object.keys(a.set).forEach(function (token) {
      if (b.set[token]) shared += 1;
    });
    return shared / Math.sqrt(a.size * b.size);
  }

  function skillSetsOverlap(jdSkills, resumeSkills) {
    var jd = {};
    var res = {};
    var union = 0;
    var shared = 0;
    jdSkills.forEach(function (s) {
      jd[s] = true;
    });
    resumeSkills.forEach(function (s) {
      res[s] = true;
    });
    var seen = {};
    Object.keys(jd).concat(Object.keys(res)).forEach(function (s) {
      if (!seen[s]) {
        seen[s] = true;
        union += 1;
      }
    });
    Object.keys(jd).forEach(function (s) {
      if (res[s]) shared += 1;
    });
    return { jaccard: union ? shared / union : 0, shared: shared };
  }

  function bandFor(score) {
    if (score >= state.threshold) return "strong";
    if (score >= state.threshold - 25) return "partial";
    return "weak";
  }

  function bandLabel(band) {
    if (band === "strong") return "Strong";
    if (band === "partial") return "Partial";
    return "Weak";
  }

  function scoreCandidate(candidate) {
    var jdTokens = tokenSet(state.jdText);
    var resTokens = tokenSet(candidate.text);
    var cos = tokenCosine(jdTokens, resTokens);
    var jdSkills = jdSkillNames();
    var resumeSkills = findSkills(candidate.text);
    var overlap = skillSetsOverlap(jdSkills, resumeSkills);
    var score = round1((0.55 * cos + 0.45 * overlap.jaccard) * 100);

    var jdLookup = {};
    state.skills.forEach(function (s) {
      jdLookup[s.name.toLowerCase()] = s.name;
    });
    var resumeLookup = {};
    resumeSkills.forEach(function (s) {
      resumeLookup[s] = s;
    });

    var matched = [];
    var missing = [];
    jdSkills.forEach(function (name) {
      if (resumeLookup[name]) matched.push(jdLookup[name]);
      else missing.push(jdLookup[name]);
    });
    var extra = resumeSkills.filter(function (name) {
      return !jdLookup[name];
    }).map(function (name) {
      return resumeLookup[name] || name;
    });

    matched.sort();
    missing.sort();
    extra.sort();

    var skillPct = jdSkills.length
      ? round1((matched.length / jdSkills.length) * 100)
      : 0;

    var sharedTerms = [];
    Object.keys(jdTokens.set).forEach(function (token) {
      if (resTokens.set[token]) sharedTerms.push(token);
    });
    sharedTerms.sort();
    sharedTerms = sharedTerms.slice(0, 16);

    var strength = score >= 75
      ? "a strong overall match"
      : score >= 55
        ? "a moderate match"
        : "a weak match";
    var summary = "This candidate is " + strength + " for the role (demo score " +
      (score / 100).toFixed(2) + "), matching " + matched.length + " of " +
      jdSkills.length + " required skills (" + skillPct + "%).";

    return {
      id: candidate.id,
      name: candidate.name || "Unnamed candidate",
      score: score,
      cos: round1(cos * 100),
      jac: round1(overlap.jaccard * 100),
      band: bandFor(score),
      skillPct: skillPct,
      matched: matched,
      missing: missing,
      extra: extra,
      terms: sharedTerms,
      summary: summary
    };
  }

  function ringMarkup(score, band) {
    var circumference = 226.2;
    var offset = (circumference * (1 - Math.min(score, 100) / 100)).toFixed(1);
    return (
      '<div class="ring" data-band="' + band + '">' +
      '<svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">' +
      '<circle class="ring-track" cx="46" cy="46" r="36" fill="none" stroke-width="9"></circle>' +
      '<circle class="ring-prog" cx="46" cy="46" r="36" fill="none" stroke-width="9" stroke-dasharray="' +
      circumference + '" stroke-dashoffset="' + offset + '"></circle>' +
      "</svg>" +
      '<span class="ring-val">' + score.toFixed(1) + "%</span>" +
      "</div>"
    );
  }

  function chipsMarkup(items, cssClass, fallback) {
    var body = items.length
      ? items.map(function (item) {
          return '<li class="chip ' + cssClass + '">' + esc(item) + "</li>";
        }).join("")
      : '<li class="chip chip-none">' + fallback + "</li>";
    return '<ul>' + body + "</ul>";
  }

  function questionsFor(missing) {
    return missing.slice(0, 6).map(function (skill) {
      return "How would you assess the candidate's depth in " + skill +
        ", and what concrete project evidence could they show us?";
    });
  }

  function renderResults() {
    var list = $("resultsList");
    var status = $("resultsStatus");
    var emptyMatch = $("resNoMatch");
    var exportBtn = $("exportCsv");
    var clearBtn = $("clearResults");
    if (!list) return;

    var query = ($("resSearch") && $("resSearch").value ? $("resSearch").value : "").trim().toLowerCase();
    var visible = state.results.filter(function (r) {
      if (!query) return true;
      return (r.name + " " + r.summary + " " + r.matched.join(" ")).toLowerCase().indexOf(query) > -1;
    });

    list.innerHTML = "";
    state.results.forEach(function (result) {
      var rank = state.results.indexOf(result) + 1;
      var band = bandFor(result.score);
      var card = document.createElement("article");
      card.className = "rcard is-" + band;
      card.dataset.id = result.id;
      card.dataset.search = (result.name + " " + result.summary).toLowerCase();
      if (visible.indexOf(result) === -1) card.classList.add("is-hidden");

      var questions = questionsFor(result.missing);
      card.innerHTML =
        '<div class="rcard-main">' +
        ringMarkup(result.score, band) +
        '<div class="rcard-id">' +
        '<span class="rank mono">RANK #' + rank + "</span>" +
        "<h3>" + esc(result.name) + "</h3>" +
        '<span class="band band-' + band + '">' + bandLabel(band) + "</span>" +
        '<p class="summary">' + esc(result.summary) + "</p>" +
        '<p class="skill-pct mono">Skills matched: ' + result.skillPct.toFixed(1) + "%</p>" +
        "</div>" +
        '<div class="rcard-tools">' +
        '<label class="cmp-toggle"><input type="checkbox" class="cmp-check" data-id="' + esc(result.id) + '"' +
        (state.compare.indexOf(result.id) > -1 ? " checked" : "") + " /> Compare</label>" +
        '<button type="button" class="btn btn-ghost btn-sm expand" aria-expanded="false">Details</button>' +
        "</div>" +
        "</div>" +
        '<div class="chip-groups">' +
        '<div class="chip-group"><span class="chip-label">matched</span>' + chipsMarkup(result.matched, "chip-ok", "none matched") + "</div>" +
        '<div class="chip-group"><span class="chip-label">missing</span>' + chipsMarkup(result.missing, "chip-miss", "none missing") + "</div>" +
        '<div class="chip-group"><span class="chip-label">extra</span>' + chipsMarkup(result.extra, "chip-extra", "none extra") + "</div>" +
        "</div>" +
        '<div class="detail is-hidden">' +
        "<h4>Matched terms (demo token overlap)</h4>" +
        '<ul class="term-list">' +
        (result.terms.length
          ? result.terms.map(function (t) {
              return "<li>" + esc(t) + "</li>";
            }).join("")
          : "<li>no shared terms</li>") +
        "</ul>" +
        "<h4>Interview focus questions</h4>" +
        '<p class="q-label">Template sentences generated from missing skills - not model output.</p>' +
        (questions.length
          ? '<ol class="q-list">' + questions.map(function (q) {
              return "<li>" + esc(q) + "</li>";
            }).join("") + "</ol>"
          : '<p class="q-label">No missing skills - nothing to probe here.</p>') +
        "</div>";
      list.appendChild(card);
    });

    if (status) {
      status.classList.remove("is-loading");
      status.innerHTML = state.results.length
        ? state.results.length + " candidate(s) ranked by the demo heuristic (token-overlap cosine + skill Jaccard)."
        : "Run screening to rank your candidates.";
    }
    if (emptyMatch) emptyMatch.hidden = !(state.results.length && !visible.length);
    if (exportBtn) exportBtn.disabled = !state.results.length;
    if (clearBtn) clearBtn.disabled = !state.results.length;
    renderCompare();
  }

  function renderCompare() {
    var section = $("compareSection");
    var grid = $("compareGrid");
    if (!section || !grid) return;
    var picked = state.results.filter(function (r) {
      return state.compare.indexOf(r.id) > -1;
    });
    if (picked.length !== 2) {
      section.hidden = true;
      grid.innerHTML = "";
      return;
    }
    section.hidden = false;
    grid.innerHTML = picked.map(function (r) {
      var band = bandFor(r.score);
      return (
        '<article class="cmp-card">' +
        "<h3>" + esc(r.name) + ' <span class="band band-' + band + '">' + bandLabel(band) + "</span></h3>" +
        '<p class="cmp-score">' + r.score.toFixed(1) + "%</p>" +
        '<ul class="cmp-list">' +
        "<li><span>Skills matched</span><span>" + r.skillPct.toFixed(1) + "%</span></li>" +
        "<li><span>Token overlap (demo)</span><span>" + r.cos.toFixed(1) + "%</span></li>" +
        "<li><span>Skill Jaccard (demo)</span><span>" + r.jac.toFixed(1) + "%</span></li>" +
        "<li><span>Matched skills</span><span>" + esc(r.matched.join(", ") || "-") + "</span></li>" +
        "<li><span>Missing skills</span><span>" + esc(r.missing.join(", ") || "-") + "</span></li>" +
        "<li><span>Extra skills</span><span>" + esc(r.extra.join(", ") || "-") + "</span></li>" +
        "</ul></article>"
      );
    }).join("");
  }

  function updateBandUI() {
    var label = $("thresholdVal");
    if (label) label.textContent = state.threshold + "%";
    state.results.forEach(function (r) {
      r.band = bandFor(r.score);
    });
    renderResults();
  }

  function runScreening() {
    var jdError = $("jdError");
    var candError = $("candError");
    if (jdError) jdError.hidden = true;
    if (candError) candError.hidden = true;

    if (!state.jdText.trim()) {
      if (jdError) {
        jdError.textContent = "Paste a job description first (text, .txt file, or the repo sample).";
        jdError.hidden = false;
      }
      var jdText = $("jdText");
      if (jdText) {
        jdText.focus();
        jdText.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
      }
      toast("Add a job description before screening.", "error");
      return;
    }

    var withText = state.candidates.filter(function (c) {
      return c.text.trim();
    });
    if (!withText.length) {
      if (candError) {
        candError.textContent = "Add at least one candidate with resume text before screening.";
        candError.hidden = false;
      }
      var candList = $("candList");
      if (candList) candList.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
      toast("Add resume text to at least one candidate.", "error");
      return;
    }

    var status = $("resultsStatus");
    if (status) {
      status.classList.add("is-loading");
      status.innerHTML = '<span class="spinner" aria-hidden="true"></span> Screening ' +
        withText.length + " candidate(s) with the demo heuristic...";
    }
    var exportBtn = $("exportCsv");
    var clearBtn = $("clearResults");
    if (exportBtn) exportBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;

    window.setTimeout(function () {
      state.results = withText.map(scoreCandidate).sort(function (a, b) {
        return b.score - a.score;
      });
      state.compare = [];
      renderResults();
      var resSection = $("results");
      if (resSection) resSection.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      toast("Screening complete - demo ranking ready.", "ok");
    }, 420);
  }

  function exportCsv() {
    if (!state.results.length) return;
    var rows = [["Rank", "Candidate", "Match Score (%)", "Band", "Skills Matched (%)", "Matched Skills", "Missing Skills", "Extra Skills"]];
    state.results.forEach(function (r, i) {
      rows.push([
        i + 1,
        r.name,
        r.score.toFixed(1),
        bandLabel(bandFor(r.score)),
        r.skillPct.toFixed(1),
        r.matched.join("; "),
        r.missing.join("; "),
        r.extra.join("; ")
      ]);
    });
    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n");
    try {
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "talentmatch_ranking.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      toast("Ranking exported as CSV.", "ok");
    } catch (e) {
      toast("Export failed in this browser.", "error");
    }
  }

  function clearResults() {
    state.results = [];
    state.compare = [];
    var search = $("resSearch");
    if (search) search.value = "";
    renderResults();
    toast("Results cleared.");
  }

  function clearAll() {
    var ok = window.confirm("Clear the job description, skills, candidates and results?");
    if (!ok) return;
    state.jdText = "";
    state.skills = [];
    state.candidates = [];
    state.threshold = 75;
    state.results = [];
    state.compare = [];
    var jdText = $("jdText");
    if (jdText) jdText.value = "";
    var jdStatus = $("jdStatus");
    if (jdStatus) jdStatus.textContent = "Empty - paste text, upload a .txt, or load the sample job description from the repo.";
    var jdFile = $("jdFile");
    if (jdFile) jdFile.value = "";
    var jdFileStatus = $("jdFileStatus");
    if (jdFileStatus) jdFileStatus.textContent = "No file selected yet.";
    var threshold = $("threshold");
    if (threshold) threshold.value = "75";
    var candSearch = $("candSearch");
    if (candSearch) candSearch.value = "";
    var resSearch = $("resSearch");
    if (resSearch) resSearch.value = "";
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      return;
    }
    updateBandUI();
    renderSkills();
    renderCandidates();
    toast("Cleared everything.", "ok");
  }

  function newCandidate() {
    return { id: "c" + Date.now() + "-" + Math.floor(Math.random() * 10000), name: "", text: "" };
  }

  function renderCandidates() {
    var list = $("candList");
    var empty = $("candEmpty");
    var count = $("candCount");
    var addBtn = $("addCand");
    var search = $("candSearch");
    if (!list) return;

    var query = search && search.value ? search.value.trim().toLowerCase() : "";
    list.innerHTML = "";
    var shown = 0;

    state.candidates.forEach(function (candidate) {
      var haystack = (candidate.name + " " + candidate.text).toLowerCase();
      var matches = !query || haystack.indexOf(query) > -1;
      if (matches) shown += 1;
      var article = document.createElement("article");
      article.className = "cand" + (matches ? "" : " is-hidden");
      article.dataset.id = candidate.id;
      article.innerHTML =
        '<div class="cand-top">' +
        '<label class="vh" for="name-' + esc(candidate.id) + '">Candidate name</label>' +
        '<input class="cand-name grow" id="name-' + esc(candidate.id) + '" type="text" placeholder="Candidate name" value="' + esc(candidate.name) + '" />' +
        '<div class="cand-tools">' +
        '<label class="upload-btn">Upload file<input type="file" class="cand-file" accept=".txt,.pdf,.docx" /></label>' +
        '<button type="button" class="icon-btn cand-del" aria-label="Remove candidate ' + esc(candidate.name || "row") + '">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>' +
        "</button></div></div>" +
        '<label class="vh" for="text-' + esc(candidate.id) + '">Resume text for ' + esc(candidate.name || "candidate") + "</label>" +
        '<textarea class="cand-text" id="text-' + esc(candidate.id) + '" rows="5" placeholder="Paste resume text here...">' + esc(candidate.text) + "</textarea>" +
        '<p class="hint cand-hint" hidden></p>';
      list.appendChild(article);
    });

    if (empty) {
      if (state.candidates.length && !shown) {
        empty.hidden = false;
        empty.textContent = "No candidates match your filter.";
      } else {
        empty.hidden = state.candidates.length > 0;
        empty.textContent = "No candidates yet - add a name and paste resume text (or upload a .txt resume).";
      }
    }
    if (count) count.textContent = state.candidates.length + " / " + MAX_CANDIDATES;
    if (addBtn) {
      addBtn.disabled = state.candidates.length >= MAX_CANDIDATES;
      addBtn.title = addBtn.disabled ? "Maximum of " + MAX_CANDIDATES + " candidates" : "";
    }
  }

  function setHint(node, message, kind) {
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
    node.classList.remove("ok", "warn");
    if (kind) node.classList.add(kind);
  }

  function handleResumeFile(file, candidate, hintNode) {
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "txt") {
      var reader = new FileReader();
      reader.onload = function (event) {
        candidate.text = String(event.target.result || "");
        var area = $("text-" + candidate.id);
        if (area) area.value = candidate.text;
        setHint(hintNode, "Loaded " + file.name + " in the browser.", "ok");
        persist();
        toast(file.name + " parsed in the browser.", "ok");
      };
      reader.onerror = function () {
        setHint(hintNode, "Could not read " + file.name + " - paste the text instead.", "warn");
      };
      reader.readAsText(file);
      return;
    }
    if (ext === "pdf" || ext === "docx") {
      setHint(hintNode, "Parsing " + file.name + " needs the backend (pdfplumber/python-docx) - paste the text instead.", "warn");
      toast("PDF/DOCX parsing needs the backend.", "error");
      return;
    }
    setHint(hintNode, "Unsupported file type." + ext + " - use .txt, .pdf or .docx.", "warn");
  }

  function handleJdFile(file) {
    var status = $("jdFileStatus");
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "txt") {
      var reader = new FileReader();
      reader.onload = function (event) {
        var text = String(event.target.result || "");
        state.jdText = text;
        var area = $("jdText");
        if (area) area.value = text;
        autoExtract();
        if (status) {
          status.textContent = "Loaded " + file.name + " in the browser (" + text.length + " characters).";
          status.style.color = "var(--green-ink)";
        }
        updateJdStatus();
        persist();
        toast(file.name + " parsed in the browser.", "ok");
      };
      reader.onerror = function () {
        if (status) status.textContent = "Could not read " + file.name + " - try pasting the text.";
      };
      reader.readAsText(file);
      return;
    }
    if (ext === "pdf" || ext === "docx") {
      if (status) {
        status.textContent = "Parsing " + file.name + " needs the backend (pdfplumber/python-docx) - use the Paste text tab instead.";
        status.style.color = "var(--red-ink)";
      }
      toast("PDF/DOCX parsing needs the backend.", "error");
      return;
    }
    if (status) {
      status.textContent = "Unsupported file type - use .txt, .pdf or .docx.";
      status.style.color = "var(--red-ink)";
    }
  }

  function updateJdStatus() {
    var status = $("jdStatus");
    if (!status) return;
    if (!state.jdText.trim()) {
      status.textContent = "Empty - paste text, upload a .txt, or load the sample job description from the repo.";
      return;
    }
    var found = findSkills(state.jdText).length;
    status.textContent = "Job description: " + state.jdText.length + " characters - " +
      found + " skill(s) detected by the browser demo dictionary.";
  }

  function setJd(text, message) {
    state.jdText = String(text || "");
    var area = $("jdText");
    if (area) area.value = state.jdText;
    autoExtract();
    updateJdStatus();
    if (message) {
      var status = $("jdStatus");
      if (status) status.textContent = message;
    }
    persist();
  }

  function loadSampleJd() {
    var status = $("jdStatus");
    if (status) status.textContent = "Fetching data/sample_job_description.txt ...";
    fetch("data/sample_job_description.txt")
      .then(function (response) {
        if (!response.ok) throw new Error("bad status");
        return response.text();
      })
      .then(function (text) {
        setJd(text, "Loaded data/sample_job_description.txt (the repo sample).");
        toast("Sample JD loaded from the repo.", "ok");
      })
      .catch(function () {
        if (status) {
          status.innerHTML = "";
          var frag = document.createDocumentFragment();
          frag.appendChild(document.createTextNode("Could not fetch the sample (page opened as file://, or the path is missing). Run "));
          var code = document.createElement("code");
          code.textContent = "python -m http.server 8000";
          frag.appendChild(code);
          frag.appendChild(document.createTextNode(" from the project folder, open http://localhost:8000, then click the button again."));
          status.appendChild(frag);
        }
        toast("Sample fetch failed - see the note under the button.", "error");
      });
  }

  function addSkill() {
    var input = $("skillInput");
    var error = $("skillError");
    if (error) error.hidden = true;
    if (!input) return;
    var value = input.value.trim();
    if (!value) {
      if (error) {
        error.textContent = "Type a skill name first.";
        error.hidden = false;
      }
      return;
    }
    var exists = state.skills.some(function (s) {
      return s.name.toLowerCase() === value.toLowerCase();
    });
    if (exists) {
      if (error) {
        error.textContent = '"' + value + '" is already in the list.';
        error.hidden = false;
      }
      return;
    }
    state.skills.push({ name: value, auto: false });
    input.value = "";
    renderSkills();
    persist();
    toast('Skill "' + value + '" added.', "ok");
  }

  function bindTabs() {
    var pasteTab = $("tabPaste");
    var uploadTab = $("tabUpload");
    var panePaste = $("panePaste");
    var paneUpload = $("paneUpload");
    if (!pasteTab || !uploadTab || !panePaste || !paneUpload) return;
    pasteTab.addEventListener("click", function () {
      pasteTab.classList.add("is-active");
      pasteTab.setAttribute("aria-selected", "true");
      uploadTab.classList.remove("is-active");
      uploadTab.setAttribute("aria-selected", "false");
      panePaste.classList.remove("is-hidden");
      paneUpload.classList.add("is-hidden");
    });
    uploadTab.addEventListener("click", function () {
      uploadTab.classList.add("is-active");
      uploadTab.setAttribute("aria-selected", "true");
      pasteTab.classList.remove("is-active");
      pasteTab.setAttribute("aria-selected", "false");
      paneUpload.classList.remove("is-hidden");
      panePaste.classList.add("is-hidden");
    });
  }

  function bindRoleSwitch() {
    var button = $("roleSwitch");
    var note = $("roleNote");
    if (!button) return;
    button.addEventListener("click", function () {
      var pressed = button.getAttribute("aria-pressed") === "true";
      var next = !pressed;
      button.setAttribute("aria-pressed", next ? "true" : "false");
      if (note) {
        note.textContent = next
          ? "This page is a static preview: the matching below is a labelled browser demo."
          : "Real screening runs in Streamlit - copy the command above, then run it locally.";
      }
      if (!next) {
        flash($("runBlock"));
        toast("Real screening runs via: streamlit run app.py");
      }
    });
  }

  function bindWorkbench() {
    var jdText = $("jdText");
    var debounce = null;
    if (jdText) {
      jdText.addEventListener("input", function () {
        state.jdText = jdText.value;
        window.clearTimeout(debounce);
        debounce = window.setTimeout(function () {
          autoExtract();
          updateJdStatus();
          persist();
        }, 450);
        updateJdStatus();
      });
    }

    var loadBtn = $("loadSample");
    if (loadBtn) loadBtn.addEventListener("click", loadSampleJd);

    var extractBtn = $("extractSkills");
    if (extractBtn) {
      extractBtn.addEventListener("click", function () {
        autoExtract();
        persist();
        toast("Skills re-extracted from the job description.", "ok");
      });
    }

    var jdFile = $("jdFile");
    if (jdFile) {
      jdFile.addEventListener("change", function () {
        if (jdFile.files && jdFile.files[0]) handleJdFile(jdFile.files[0]);
      });
    }

    var addSkillBtn = $("addSkill");
    if (addSkillBtn) addSkillBtn.addEventListener("click", addSkill);
    var skillInput = $("skillInput");
    if (skillInput) {
      skillInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          addSkill();
        }
      });
    }

    var chipList = $("skillChips");
    if (chipList) {
      chipList.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var remove = target.closest(".chip-x");
        if (!remove) return;
        var name = remove.getAttribute("data-skill");
        state.skills = state.skills.filter(function (s) {
          return s.name !== name;
        });
        renderSkills();
        persist();
        toast('Skill "' + name + '" removed.');
      });
    }
  }

  function bindCandidates() {
    var addBtn = $("addCand");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        if (state.candidates.length >= MAX_CANDIDATES) {
          toast("Maximum of " + MAX_CANDIDATES + " candidates.", "error");
          return;
        }
        state.candidates.push(newCandidate());
        renderCandidates();
        persist();
        var list = $("candList");
        var rows = list ? list.querySelectorAll(".cand") : [];
        var last = rows[rows.length - 1];
        if (last) {
          var nameInput = last.querySelector(".cand-name");
          if (nameInput) nameInput.focus();
        }
      });
    }

    var search = $("candSearch");
    if (search) search.addEventListener("input", renderCandidates);

    var list = $("candList");
    if (!list) return;

    list.addEventListener("input", function (event) {
      var target = event.target;
      var row = target.closest ? target.closest(".cand") : null;
      if (!row) return;
      var candidate = state.candidates.filter(function (c) {
        return c.id === row.dataset.id;
      })[0];
      if (!candidate) return;
      if (target.classList.contains("cand-name")) {
        candidate.name = target.value;
        persist();
      } else if (target.classList.contains("cand-text")) {
        candidate.text = target.value;
        persist();
      }
    });

    list.addEventListener("change", function (event) {
      var target = event.target;
      if (!target.classList || !target.classList.contains("cand-file")) return;
      var row = target.closest(".cand");
      if (!row || !target.files || !target.files[0]) return;
      var candidate = state.candidates.filter(function (c) {
        return c.id === row.dataset.id;
      })[0];
      if (!candidate) return;
      handleResumeFile(target.files[0], candidate, row.querySelector(".cand-hint"));
    });

    list.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var del = target.closest(".cand-del");
      if (!del) return;
      var row = del.closest(".cand");
      if (!row) return;
      var removed = state.candidates.filter(function (c) {
        return c.id === row.dataset.id;
      })[0];
      state.candidates = state.candidates.filter(function (c) {
        return c.id !== row.dataset.id;
      });
      state.compare = state.compare.filter(function (id) {
        return !removed || id !== removed.id;
      });
      renderCandidates();
      persist();
      toast("Candidate removed.");
    });
  }

  function bindResults() {
    var runBtn = $("runScreening");
    if (runBtn) runBtn.addEventListener("click", runScreening);

    var clearBtn = $("clearResults");
    if (clearBtn) clearBtn.addEventListener("click", clearResults);

    var clearAllBtn = $("clearAll");
    if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll);

    var exportBtn = $("exportCsv");
    if (exportBtn) exportBtn.addEventListener("click", exportCsv);

    var threshold = $("threshold");
    if (threshold) {
      threshold.value = String(state.threshold);
      threshold.addEventListener("input", function () {
        state.threshold = parseInt(threshold.value, 10) || 75;
        updateBandUI();
        persist();
      });
    }
    var thresholdVal = $("thresholdVal");
    if (thresholdVal) thresholdVal.textContent = state.threshold + "%";

    var resSearch = $("resSearch");
    if (resSearch) resSearch.addEventListener("input", renderResults);

    var list = $("resultsList");
    if (list) {
      list.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var expand = target.closest(".expand");
        if (expand) {
          var card = expand.closest(".rcard");
          var detail = card ? card.querySelector(".detail") : null;
          if (!detail) return;
          var open = detail.classList.toggle("is-hidden") === false;
          expand.setAttribute("aria-expanded", open ? "true" : "false");
          expand.textContent = open ? "Hide" : "Details";
        }
      });
      list.addEventListener("change", function (event) {
        var target = event.target;
        if (!target.classList || !target.classList.contains("cmp-check")) return;
        var id = target.getAttribute("data-id");
        if (target.checked) {
          if (state.compare.length >= 2) {
            target.checked = false;
            toast("Compare holds two candidates at a time.", "error");
            return;
          }
          state.compare.push(id);
        } else {
          state.compare = state.compare.filter(function (item) {
            return item !== id;
          });
        }
        renderCompare();
        if (state.compare.length === 2) {
          var section = $("compareSection");
          if (section) section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
        }
      });
    }

    var closeCompare = $("closeCompare");
    if (closeCompare) {
      closeCompare.addEventListener("click", function () {
        state.compare = [];
        var checks = document.querySelectorAll(".cmp-check");
        Array.prototype.forEach.call(checks, function (box) {
          box.checked = false;
        });
        renderCompare();
      });
    }
  }

  function bindGlobalKeys() {
    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runScreening();
      }
      if (event.key === "Escape") clearToasts();
    });
  }

  function init() {
    restore();
    var jdText = $("jdText");
    if (jdText) jdText.value = state.jdText;
    renderSkills();
    renderCandidates();
    updateJdStatus();
    bindTabs();
    bindRoleSwitch();
    bindWorkbench();
    bindCandidates();
    bindResults();
    bindGlobalKeys();
    var copyRun = $("copyRun");
    if (copyRun) {
      copyRun.addEventListener("click", function () {
        var cmd = $("runCommand");
        copyText(cmd ? cmd.textContent.trim() : "streamlit run app.py", function () {
          toast("Command copied: streamlit run app.py", "ok");
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
