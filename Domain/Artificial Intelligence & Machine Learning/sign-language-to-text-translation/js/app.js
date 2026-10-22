/* ============================================================
   SignBridge Studio — translation pipeline lab
   Vanilla JS. Stages 1-4 are a labelled browser demo of the
   library's pipeline; stage 5 defers to the slt CLI.
   ============================================================ */

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------------- static demo data ---------------- */

  var LEXICON = [
    "hello", "yes", "no", "thank", "you", "please", "help",
    "water", "food", "eat", "drink", "name", "good", "bad",
    "happy", "sad", "school", "work", "home", "friend", "family",
    "love", "want", "need", "go", "come", "this", "that",
    "what", "where", "when", "who", "how", "time", "today",
    "tomorrow", "yesterday", "now", "sign", "language",
    "pakistan", "apple", "book", "play", "i", "my", "your"
  ];
  var LEX_SET = {};
  LEXICON.forEach(function (w) { LEX_SET[w] = true; });

  var RULES = [
    { id: "R1", name: "Drop punctuation", why: "restructure_sentence drops SPACE and PUNCTUATION tags" },
    { id: "R2", name: "Drop stopwords {the, so}", why: "PakistanSignLanguage.STOPWORDS" },
    { id: "R3", name: "Drop copular auxiliaries {am, is, are, was, were}", why: "README: meaningless words such as \u201Cam\u201D, \u201Care\u201D" },
    { id: "R4", name: "Split contractions (don\u2019t \u2192 do + not)", why: "each surviving token must map to one sign clip" },
    { id: "R5", name: "Strip commas from numbers", why: "NUMBER tokens lose \u201C,\u201D before mapping" },
    { id: "R6", name: "Lowercase for sign lookup", why: "_apply_rules maps token.lower()" },
    { id: "R7", name: "Negation moves before the verb", why: "gloss keeps NOT next to its verb" },
    { id: "R8", name: "Time words move to the end", why: "README word order: SUBJECT OBJECT VERB TIME" },
    { id: "R9", name: "WH-word moves to the very end", why: "topic-comment gloss order for questions" }
  ];

  var STOPWORDS = { "the": 1, "so": 1 };
  var COPULA = { "am": 1, "is": 1, "are": 1, "was": 1, "were": 1 };
  var WH = { "what": 1, "where": 1, "when": 1, "who": 1, "why": 1, "how": 1, "which": 1, "whose": 1, "whom": 1 };
  var TIME = {
    "today": 1, "tomorrow": 1, "yesterday": 1, "now": 1, "tonight": 1,
    "morning": 1, "afternoon": 1, "evening": 1, "night": 1, "soon": 1,
    "later": 1, "monday": 1, "tuesday": 1, "wednesday": 1,
    "thursday": 1, "friday": 1, "saturday": 1, "sunday": 1
  };
  var CONTRACTIONS = {
    "won't": ["will", "not"], "can't": ["can", "not"], "shan't": ["shall", "not"],
    "i'm": ["i", "am"], "let's": ["let", "us"]
  };
  var LANG_NAMES = { en: "english", ur: "urdu", hi: "hindi" };
  var PUNCT_SET = /^[.,!?;:\u2014\u2013\u06D4\u061F\u060C\u061B\u0964-]+$/;

  /* ---------------- hand-pose glyphs (placeholders) ---------------- */

  var GLYPHS = [
    '<svg class="glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 27V13a2.6 2.6 0 0 1 5.2 0v11"/><path d="M22.2 24V10.5a2.6 2.6 0 0 1 5.2 0V24"/><path d="M27.4 24.5V13a2.6 2.6 0 0 1 5.2 0v12"/><path d="M32.6 27v-6a2.6 2.6 0 0 1 5.2 0v11c0 6.6-5.4 11-12 11s-12-4.4-12-11v-9a2.6 2.6 0 0 1 5.2 0v4"/></g></svg>',
    '<svg class="glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 26V10a2.6 2.6 0 0 1 5.2 0v14"/><path d="M24.2 25c0-2 1.6-3 3.4-3h3.4c2 0 3.4 1.4 3.4 3.4v4.6c0 6.6-5.4 11-12 11h-1.6c-6 0-10.8-4.4-10.8-11V24a2.6 2.6 0 0 1 5.2 0v5"/><path d="M24.2 30h7"/></g></svg>',
    '<svg class="glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 26v-4a2.6 2.6 0 0 1 5.2 0v3"/><path d="M19.2 25v-5a2.6 2.6 0 0 1 5.2 0v5"/><path d="M24.4 25v-5a2.6 2.6 0 0 1 5.2 0v5"/><path d="M29.6 26v-3a2.6 2.6 0 0 1 5.2 0v9c0 6.6-5.4 11-12 11s-12-4.4-12-11v-6a2.6 2.6 0 0 1 5.2 0v3"/></g></svg>'
  ];

  function glyphFor(word) {
    var h = 0;
    for (var i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) % 997;
    return GLYPHS[h % GLYPHS.length];
  }

  /* ---------------- elements ---------------- */

  var inputText = $("input-text");
  var charCount = $("char-count");
  var wordCount = $("word-count");
  var dirNote = $("dir-note");
  var tokenChips = $("token-chips");
  var ruleList = $("rule-list");
  var tokensBefore = $("tokens-before");
  var tokensAfter = $("tokens-after");
  var glossNote = $("gloss-note");
  var mappingBody = $("mapping-body");
  var lexiconGrid = $("lexicon-grid");
  var cliCmd = $("cli-cmd");
  var copyCli = $("copy-cli");
  var copyGloss = $("copy-gloss");
  var downloadTxt = $("download-txt");
  var downloadCsv = $("download-csv");
  var exportStatus = $("export-status");
  var pipelineStatus = $("pipeline-status");
  var resetAll = $("reset-all");

  var DEFAULT_TEXT = "What is your name?";
  var currentLang = "en";
  var latest = { tokens: [], gloss: [], rows: [] };
  var debounceTimer = null;

  /* ---------------- helpers ---------------- */

  function setExportStatus(msg, isError) {
    if (!exportStatus) return;
    exportStatus.textContent = msg || "";
    exportStatus.classList.toggle("is-error", !!isError);
  }

  function setStatus(msg) {
    if (pipelineStatus) pipelineStatus.textContent = msg || "";
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  function flashButton(btn, okText) {
    if (!btn) return;
    var original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = okText;
    window.setTimeout(function () { btn.textContent = original; }, 2000);
  }

  function downloadFile(filename, content, mime) {
    try {
      var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ---------------- tokenizer / tagger (demo) ---------------- */

  function tokenize(text, lang) {
    /* One Unicode-aware token pattern for all three languages:
       numbers (with thousand separators) | words/contractions | punctuation.
       lang stays in the signature so callers can extend it. */
    var re = lang === "en"
      ? /[\p{N}][\p{N},]*(?:\.\p{N}+)?|[A-Za-z0-9]+(?:[\u2019'][A-Za-z0-9]+)*|[.,!?;:\u2014\u2013-]+/gu
      : /[\p{N}][\p{N},]*(?:\.\p{N}+)?|[\p{L}\p{M}\p{N}]+(?:[\u2019'][\p{L}\p{M}\p{N}]+)*|[.,!?;:\u2014\u2013\u06D4\u061F\u060C\u061B\u0964-]+/gu;
    var m = text.match(re);
    return m || [];
  }

  function tagOf(token) {
    if (PUNCT_SET.test(token)) return "PUNCTUATION";
    if (/^[\p{N},.]+$/u.test(token)) return "NUMBER";
    if (LEX_SET[token.toLowerCase()]) return "SUPPORTED_WORD";
    return "WORD";
  }

  function tagClass(tag) {
    if (tag === "SUPPORTED_WORD") return "tag-supp";
    if (tag === "NUMBER") return "tag-num";
    if (tag === "PUNCTUATION") return "tag-punct";
    return "tag-word";
  }

  function tokenizeTag(text, lang) {
    return tokenize(text, lang).map(function (t) {
      return { text: t, tag: tagOf(t) };
    });
  }

  /* ---------------- gloss restructure (English demo) ---------------- */

  function restructureEnglish(tagged) {
    var applied = {};
    RULES.forEach(function (r) { applied[r.id] = 0; });

    var items = tagged.map(function (t) {
      return { text: t.text, orig: t.text, rules: [], moved: false, flag: "" };
    });

    function mark(item, id, note) {
      if (item.rules.indexOf(id) === -1) item.rules.push(id);
      if (applied[id] !== undefined) applied[id]++;
      if (note) item.flag = note;
    }

    /* R4 — contraction split */
    var expanded = [];
    items.forEach(function (item) {
      var lower = item.text.toLowerCase();
      var parts = null;
      if (CONTRACTIONS[lower]) parts = CONTRACTIONS[lower];
      else if (/n't$/i.test(item.text)) parts = [item.text.slice(0, -3), "not"];
      if (parts) {
        mark(item, "R4", "split");
        expanded.push(item);
        parts.slice(1).forEach(function (p) {
          var extra = { text: p, orig: item.orig, rules: ["R4"], moved: false, flag: "split" };
          applied.R4++;
          expanded.push(extra);
        });
        item.text = parts[0];
      } else {
        expanded.push(item);
      }
    });
    items = expanded;

    /* R1 — drop punctuation */
    items = items.filter(function (item) {
      if (PUNCT_SET.test(item.text)) { mark(item, "R1", "dropped"); return false; }
      return true;
    });

    /* R2 — drop stopwords */
    items = items.filter(function (item) {
      if (STOPWORDS[item.text.toLowerCase()]) { mark(item, "R2", "dropped"); return false; }
      return true;
    });

    /* R3 — drop copular auxiliaries */
    items = items.filter(function (item) {
      if (COPULA[item.text.toLowerCase()]) { mark(item, "R3", "dropped"); return false; }
      return true;
    });

    /* R5 / R6 — number commas + lowercase */
    items.forEach(function (item) {
      if (/^\d[\d,]*$/.test(item.text) && item.text.indexOf(",") > -1) {
        item.text = item.text.replace(/,/g, "");
        mark(item, "R5", "");
      }
      if (item.text !== item.text.toLowerCase()) {
        item.text = item.text.toLowerCase();
        mark(item, "R6", "");
      }
    });

    /* R7 — negation placement */
    var notIdx = -1;
    items.forEach(function (item, i) { if (notIdx === -1 && item.text === "not") notIdx = i; });
    if (notIdx > -1) {
      var target = null;
      for (var i = notIdx + 1; i < items.length; i++) {
        var t = items[i].text;
        if (t !== "not" && !WH[t] && !TIME[t]) { target = items[i]; break; }
      }
      if (target) {
        var negItem = items[notIdx];
        items.splice(notIdx, 1);
        var at = items.indexOf(target);
        items.splice(at, 0, negItem);
        if (at !== notIdx) {
          mark(negItem, "R7", "moved before verb");
          negItem.moved = true;
        }
      }
    }

    /* R8 — time words to the end */
    var timed = items.filter(function (it) { return TIME[it.text] === 1; });
    if (timed.length) {
      items = items.filter(function (it) { return TIME[it.text] !== 1; });
      timed.forEach(function (it) {
        mark(it, "R8", "moved to end");
        it.moved = true;
        items.push(it);
      });
    }

    /* R9 — WH-word to the very end */
    var whs = items.filter(function (it) { return WH[it.text] === 1; });
    if (whs.length) {
      items = items.filter(function (it) { return WH[it.text] !== 1; });
      whs.forEach(function (it) {
        mark(it, "R9", "moved to end");
        it.moved = true;
        items.push(it);
      });
    }

    return { gloss: items, applied: applied };
  }

  function restructurePassthrough(tagged) {
    var applied = {};
    RULES.forEach(function (r) { applied[r.id] = 0; });
    var items = [];
    tagged.forEach(function (t) {
      if (t.tag === "PUNCTUATION") { applied.R1++; return; }
      items.push({
        text: t.text, orig: t.text,
        rules: [], moved: false, flag: ""
      });
    });
    return { gloss: items, applied: applied, limited: true };
  }

  /* ---------------- sign selection (demo) ---------------- */

  function selectSigns(gloss) {
    return gloss.map(function (item) {
      var token = item.text;
      if (/^\d+$/.test(token)) {
        var digits = token.split("");
        return {
          token: token,
          rule: "number rule \u00B7 digit-by-digit",
          cls: "is-num",
          clips: digits.map(function (d) { return "pk-hfad-1_" + d; })
        };
      }
      if (LEX_SET[token]) {
        return {
          token: token,
          rule: "direct mapping",
          cls: "",
          clips: ["pk-hfad-1_" + token]
        };
      }
      var letters = token.split("").filter(function (c) { return /[a-z0-9]/.test(c); });
      return {
        token: token,
        rule: "spelling rule \u00B7 char-by-char",
        cls: "is-spell",
        clips: letters.map(function (c) { return "pk-hfad-1_" + c; })
      };
    });
  }

  /* ---------------- rendering ---------------- */

  function emptyState(text) {
    var p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = text;
    return p;
  }

  function renderTokens(tagged) {
    if (!tokenChips) return;
    tokenChips.textContent = "";
    if (!tagged.length) {
      tokenChips.appendChild(emptyState("No tokens found."));
      return;
    }
    tagged.forEach(function (t) {
      var chip = document.createElement("span");
      chip.className = "tok";
      chip.setAttribute("title", "tag: " + t.tag);
      chip.setAttribute("data-tip",
        "tag " + t.tag + (t.tag === "SUPPORTED_WORD"
          ? " \u2014 present in the demo lexicon"
          : t.tag === "PUNCTUATION" ? " \u2014 dropped by gloss rules" : ""));
      var word = document.createElement("span");
      word.textContent = t.text;
      var tag = document.createElement("span");
      tag.className = "tag " + tagClass(t.tag);
      tag.textContent = t.tag;
      chip.appendChild(word);
      chip.appendChild(tag);
      tokenChips.appendChild(chip);
    });
  }

  function renderRules(result, lang) {
    if (!ruleList) return;
    ruleList.textContent = "";
    if (lang !== "en") {
      var li = document.createElement("li");
      li.className = "is-idle";
      li.innerHTML = '<span class="rule-id">\u2014</span>' +
        "<span>English gloss rules are not applied. The library restructures Urdu and Hindi inside its SignLanguage subclass.</span>" +
        '<span class="rule-count">0 applied</span>';
      ruleList.appendChild(li);
      return;
    }
    RULES.forEach(function (r) {
      var count = result.applied[r.id] || 0;
      var li = document.createElement("li");
      if (!count) li.className = "is-idle";
      var idSpan = document.createElement("span");
      idSpan.className = "rule-id";
      idSpan.textContent = r.id;
      var nameSpan = document.createElement("span");
      nameSpan.textContent = r.name + " \u2014 " + r.why;
      var countSpan = document.createElement("span");
      countSpan.className = "rule-count";
      countSpan.textContent = count ? "applied \u00D7" + count : "not applied";
      li.appendChild(idSpan);
      li.appendChild(nameSpan);
      li.appendChild(countSpan);
      ruleList.appendChild(li);
    });
  }

  function renderOrder(tagged, result) {
    if (!tokensBefore || !tokensAfter) return;

    tokensBefore.textContent = "";
    if (!tagged.length) {
      tokensBefore.appendChild(emptyState("Nothing yet."));
    } else {
      tagged.forEach(function (t) {
        var chip = document.createElement("span");
        chip.className = "tok";
        chip.setAttribute("title", "tag: " + t.tag);
        chip.setAttribute("data-tip", "original token \u00B7 tag " + t.tag);
        var word = document.createElement("span");
        word.textContent = t.text;
        chip.appendChild(word);
        tokensBefore.appendChild(chip);
      });
    }

    tokensAfter.textContent = "";
    if (!result.gloss.length) {
      tokensAfter.appendChild(emptyState("No gloss tokens survived the rules."));
    } else {
      result.gloss.forEach(function (g) {
        var chip = document.createElement("span");
        chip.className = "tok" + (g.moved ? " tok-moved" : "");
        var trail = g.rules.length
          ? "rules: " + g.rules.join(", ")
          : "unchanged";
        chip.setAttribute("title", trail);
        chip.setAttribute("data-tip", trail + (g.flag ? " \u00B7 " + g.flag : ""));
        var word = document.createElement("span");
        word.textContent = g.text;
        chip.appendChild(word);
        if (g.moved) {
          var flag = document.createElement("span");
          flag.className = "tok-flag";
          flag.textContent = "moved";
          chip.appendChild(flag);
        }
        tokensAfter.appendChild(chip);
      });
    }

    if (glossNote) {
      if (result.limited) {
        glossNote.hidden = false;
        glossNote.textContent =
          "Tokenization demo limited for Urdu/Hindi: only whitespace splitting and " +
          "punctuation removal run here. Grammar reordering lives in the library's " +
          "SignLanguage.restructure_sentence.";
      } else {
        glossNote.hidden = true;
        glossNote.textContent = "";
      }
    }
  }

  function renderMapping(rows, lang) {
    if (!mappingBody) return;
    mappingBody.textContent = "";

    if (lang !== "en") {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 3;
      td.className = "empty-cell";
      td.textContent = "Sign selection in this lab covers the English demo lexicon only. " +
        "For Urdu/Hindi run the library: slt translate --model-code rule-based --text-lang " +
        LANG_NAMES[lang] + " --sign-lang pk-sl --sign-format video \"<text>\"";
      tr.appendChild(td);
      mappingBody.appendChild(tr);
      return;
    }
    if (!rows.length) {
      var tr0 = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.colSpan = 3;
      td0.className = "empty-cell";
      td0.textContent = "No gloss tokens yet — type in station 01.";
      tr0.appendChild(td0);
      mappingBody.appendChild(tr0);
      return;
    }

    rows.forEach(function (row) {
      var tr = document.createElement("tr");

      var tdTok = document.createElement("td");
      tdTok.className = "tok-cell";
      tdTok.textContent = row.token;

      var tdRule = document.createElement("td");
      var badge = document.createElement("span");
      badge.className = "rule-badge" + (row.cls ? " " + row.cls : "");
      badge.textContent = row.rule;
      tdRule.appendChild(badge);

      var tdClip = document.createElement("td");
      tdClip.className = "clip-cell";
      tdClip.textContent = row.clips.length > 3
        ? row.clips.slice(0, 3).join("  +  ") + "  +" + (row.clips.length - 3) + " more"
        : row.clips.join("  +  ");
      tdClip.title = row.clips.join(", ");

      tr.appendChild(tdTok);
      tr.appendChild(tdRule);
      tr.appendChild(tdClip);
      mappingBody.appendChild(tr);
    });
  }

  function buildLexicon() {
    if (!lexiconGrid) return;
    lexiconGrid.textContent = "";
    LEXICON.slice().sort().forEach(function (word) {
      var card = document.createElement("div");
      card.className = "sign-card";
      card.setAttribute("data-word", word);
      card.innerHTML = glyphFor(word) +
        '<span class="sign-word">' + word + "</span>" +
        '<span class="sign-id">pk-hfad-1_' + word + "</span>";
      lexiconGrid.appendChild(card);
    });
  }

  function highlightLexicon(glossTokens, lang) {
    if (!lexiconGrid) return;
    var used = {};
    if (lang === "en") {
      glossTokens.forEach(function (g) {
        if (LEX_SET[g.text]) used[g.text] = true;
        if (/^\d+$/.test(g.text)) {
          g.text.split("").forEach(function (d) { if (LEX_SET[d]) used[d] = true; });
        }
      });
    }
    var cards = lexiconGrid.querySelectorAll(".sign-card");
    for (var i = 0; i < cards.length; i++) {
      var w = cards[i].getAttribute("data-word");
      cards[i].classList.toggle("is-used", !!used[w]);
    }
  }

  /* ---------------- stage 5 command & export ---------------- */

  function buildCliCommand(text) {
    var flat = text.replace(/\s+/g, " ").trim().replace(/"/g, "'");
    return "slt translate --model-code rule-based --text-lang " +
      LANG_NAMES[currentLang] + " --sign-lang pk-sl --sign-format video \"" +
      flat + "\"";
  }

  function updateCommand(text) {
    if (cliCmd) cliCmd.textContent = buildCliCommand(text);
  }

  function glossText() {
    return latest.gloss.map(function (g) { return g.text; }).join(" ");
  }

  /* ---------------- pipeline run ---------------- */

  function updateCounters(text) {
    if (charCount) {
      charCount.textContent = text.length + (text.length === 1 ? " character" : " characters");
    }
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (wordCount) wordCount.textContent = words + (words === 1 ? " word" : " words");
  }

  function renderEmptyAll() {
    if (tokenChips) {
      tokenChips.textContent = "";
      tokenChips.appendChild(emptyState("Tokens appear here. Type a sentence in station 01."));
    }
    renderRules({ applied: {} }, currentLang);
    if (tokensBefore) { tokensBefore.textContent = ""; tokensBefore.appendChild(emptyState("Nothing yet.")); }
    if (tokensAfter) { tokensAfter.textContent = ""; tokensAfter.appendChild(emptyState("Nothing yet.")); }
    renderMapping([], currentLang);
    highlightLexicon([], "en");
    if (glossNote) { glossNote.hidden = true; }
    latest = { tokens: [], gloss: [], rows: [] };
    setExportStatus("");
  }

  function runPipeline() {
    var text = inputText ? inputText.value : "";
    updateCounters(text);

    if (!text.trim()) {
      renderEmptyAll();
      if (cliCmd) cliCmd.textContent = buildCliCommand("<text>");
      setStatus("Nothing to translate \u2014 type a sentence in station 01.");
      return;
    }

    var tagged = tokenizeTag(text, currentLang);
    renderTokens(tagged);

    var result = currentLang === "en"
      ? restructureEnglish(tagged)
      : restructurePassthrough(tagged);

    renderRules(result, currentLang);
    renderOrder(tagged, result);

    var rows = currentLang === "en" ? selectSigns(result.gloss) : [];
    renderMapping(rows, currentLang);
    highlightLexicon(result.gloss, currentLang);
    updateCommand(text);

    latest = { tokens: tagged, gloss: result.gloss, rows: rows };
    setExportStatus("");

    var lexLabel = currentLang === "en" ? "English ruleset" : "limited demo (" + currentLang + ")";
    setStatus(tagged.length + " tokens \u2192 " + result.gloss.length +
      " gloss tokens \u2192 " + rows.length + " sign clips \u00B7 " + lexLabel);
  }

  function scheduleRun() {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runPipeline, 280);
  }

  /* ---------------- language switching ---------------- */

  function applyLanguage(lang) {
    currentLang = lang;
    if (inputText) {
      inputText.setAttribute("dir", lang === "ur" ? "rtl" : "ltr");
      inputText.setAttribute("lang", lang);
    }
    if (dirNote) {
      dirNote.textContent = lang === "ur"
        ? "Direction: right-to-left (Urdu input)."
        : lang === "hi"
          ? "Direction: left-to-right (Hindi input)."
          : "Direction: left-to-right.";
    }
    runPipeline();
  }

  /* ---------------- station navigation ---------------- */

  function setActiveStation(station) {
    var stations = document.querySelectorAll(".station");
    for (var i = 0; i < stations.length; i++) {
      var active = stations[i] === station;
      stations[i].classList.toggle("is-active", active);
      var head = stations[i].querySelector(".station-head");
      if (head) {
        if (active) head.setAttribute("aria-current", "true");
        else head.removeAttribute("aria-current");
      }
    }
  }

  function initStations() {
    var heads = document.querySelectorAll(".station-head");
    for (var i = 0; i < heads.length; i++) {
      (function (head) {
        head.addEventListener("click", function () {
          var station = head.closest ? head.closest(".station") : null;
          if (station) {
            setActiveStation(station);
            try {
              station.scrollIntoView({
                behavior: prefersReducedMotion() ? "auto" : "smooth",
                block: "center"
              });
            } catch (err) {
              station.scrollIntoView();
            }
          }
        });
      })(heads[i]);
    }
  }

  /* ---------------- events ---------------- */

  if (inputText) {
    inputText.addEventListener("input", function () {
      updateCounters(inputText.value);
      scheduleRun();
    });
  }

  var radios = document.querySelectorAll('input[name="text-lang"]');
  for (var r = 0; r < radios.length; r++) {
    radios[r].addEventListener("change", function (ev) {
      if (ev.target && ev.target.checked) applyLanguage(ev.target.value);
    });
  }

  if (copyCli) {
    copyCli.addEventListener("click", function () {
      copyText(cliCmd ? cliCmd.textContent : "").then(function () {
        flashButton(copyCli, "Copied \u2713");
      }).catch(function () {
        flashButton(copyCli, "Copy failed");
        setExportStatus("Clipboard unavailable \u2014 select the command text and copy it manually.", true);
      });
    });
  }

  var genericCopies = document.querySelectorAll(".copy-generic");
  for (var g = 0; g < genericCopies.length; g++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var cmd = btn.parentNode ? btn.parentNode.querySelector("code") : null;
        if (!cmd) return;
        copyText(cmd.textContent).then(function () {
          flashButton(btn, "Copied \u2713");
        }).catch(function () {
          flashButton(btn, "Copy failed");
        });
      });
    })(genericCopies[g]);
  }

  if (copyGloss) {
    copyGloss.addEventListener("click", function () {
      if (!latest.gloss.length) {
        setExportStatus("Nothing to export yet \u2014 type a sentence first.", true);
        return;
      }
      copyText(glossText()).then(function () {
        flashButton(copyGloss, "Copied \u2713");
        setExportStatus("Gloss copied: " + latest.gloss.length + " tokens.");
      }).catch(function () {
        setExportStatus("Clipboard unavailable \u2014 use Download .txt instead.", true);
      });
    });
  }

  if (downloadTxt) {
    downloadTxt.addEventListener("click", function () {
      if (!latest.gloss.length) {
        setExportStatus("Nothing to export yet \u2014 type a sentence first.", true);
        return;
      }
      var content = latest.gloss.map(function (g) { return g.text; }).join("\n") + "\n";
      var ok = downloadFile("gloss.txt", content);
      setExportStatus(ok
        ? "Saved gloss.txt \u2014 " + latest.gloss.length + " gloss tokens."
        : "Download blocked by the browser.", !ok);
    });
  }

  if (downloadCsv) {
    downloadCsv.addEventListener("click", function () {
      if (!latest.gloss.length) {
        setExportStatus("Nothing to export yet \u2014 type a sentence first.", true);
        return;
      }
      var lines = ["index,original,gloss,rules,moved"];
      latest.gloss.forEach(function (g, i) {
        lines.push([
          i + 1,
          '"' + String(g.orig).replace(/"/g, '""') + '"',
          '"' + String(g.text).replace(/"/g, '""') + '"',
          '"' + g.rules.join(" ") + '"',
          g.moved ? "yes" : "no"
        ].join(","));
      });
      var ok = downloadFile("gloss.csv", lines.join("\n") + "\n", "text/csv;charset=utf-8");
      setExportStatus(ok
        ? "Saved gloss.csv \u2014 " + latest.gloss.length + " rows."
        : "Download blocked by the browser.", !ok);
    });
  }

  if (resetAll) {
    resetAll.addEventListener("click", function () {
      if (inputText) inputText.value = DEFAULT_TEXT;
      var enRadio = document.querySelector('input[name="text-lang"][value="en"]');
      if (enRadio) enRadio.checked = true;
      applyLanguage("en");
      setExportStatus("");
      setStatus("Lab reset \u2014 sample sentence restored.");
      if (inputText) inputText.focus();
    });
  }

  /* ---------------- init ---------------- */

  buildLexicon();
  initStations();
  var initialRadio = document.querySelector('input[name="text-lang"]:checked');
  currentLang = initialRadio ? initialRadio.value : "en";
  applyLanguage(currentLang);
})();
