(function () {
  "use strict";

  var LS_API = "mt.apiBase";
  var LS_LANG = "mt.language";
  var DEFAULT_API = "http://127.0.0.1:8000";
  var MIN_LEN = 3;
  var MAX_FILE = 20 * 1024 * 1024;
  var TIMEOUT = 30000;
  var HEALTH_TIMEOUT = 8000;
  var POLL_MS = 15000;

  var THEMES = {
    happy:    { accent: "#f7b32b", accent2: "#ffdd8a", rgb: "247,179,43" },
    sad:      { accent: "#5e8bd6", accent2: "#a8c1ec", rgb: "94,139,214" },
    angry:    { accent: "#e63946", accent2: "#ff9aa2", rgb: "230,57,70" },
    fear:     { accent: "#9b6dff", accent2: "#cbb4ff", rgb: "155,109,255" },
    surprise: { accent: "#22d3ee", accent2: "#93ecfa", rgb: "34,211,238" },
    neutral:  { accent: "#a5adbb", accent2: "#dfe3ea", rgb: "165,173,187" },
    disgust:  { accent: "#9aa852", accent2: "#cdd896", rgb: "154,168,82" }
  };

  var EMOTION_TITLE = {
    happy: "Happy", sad: "Sad", angry: "Angry", fear: "Fearful",
    surprise: "Surprised", neutral: "Neutral", disgust: "Disgusted"
  };

  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  var state = {
    activeTab: "text",
    loading: null,
    text: { result: null, songIdx: 0, at: null },
    face: { result: null, songIdx: 0, at: null, file: null, previewUrl: null, stream: null }
  };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }

  function apiBase() {
    var v = (els.apiBase.value || "").trim().replace(/\/+$/, "");
    return v || DEFAULT_API;
  }

  function fetchTimed(url, opts, ms) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || TIMEOUT);
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

  /* ── backend health ───────────────────────────────────── */
  function setPill(pillState, text) {
    els.healthPill.setAttribute("data-state", pillState);
    els.healthText.textContent = text;
  }

  function markOffline(reason) {
    setPill("offline", "offline");
    els.healthDetail.textContent = reason || "";
    els.offlinePanel.hidden = false;
  }

  function markOnline(detail) {
    setPill("online", "connected");
    els.healthDetail.textContent = detail || "";
    els.offlinePanel.hidden = true;
  }

  function checkHealth() {
    setPill("checking", "checking…");
    els.healthDetail.textContent = "";
    return fetchTimed(apiBase() + "/health", { method: "GET" }, HEALTH_TIMEOUT).then(function (res) {
      return res.text().then(function (raw) {
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { data = null; }
        if (res.ok && data && data.status) {
          var bits = [];
          if (data.engine) bits.push(data.engine);
          if (data.model) bits.push(data.model);
          markOnline(bits.join(" · "));
        } else {
          markOffline("unexpected /health payload (HTTP " + res.status + ")");
        }
      });
    }).catch(function () {
      markOffline("no response — start uvicorn, then recheck");
    });
  }

  /* ── emotion theme ────────────────────────────────────── */
  function applyTheme(emotion) {
    var root = document.documentElement;
    var t = emotion && THEMES[emotion];
    if (!t) {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-2");
      root.style.removeProperty("--accent-rgb");
      els.moodChip.hidden = true;
      return;
    }
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--accent-2", t.accent2);
    root.style.setProperty("--accent-rgb", t.rgb);
    els.moodChip.textContent = emotion;
    els.moodChip.hidden = false;
  }

  /* ── loading ──────────────────────────────────────────── */
  function setLoading(mode, msg) {
    state.loading = mode;
    els.orbOverlay.hidden = !mode;
    if (mode) els.orbMsg.textContent = msg || "analyzing…";
    els.textBtn.disabled = mode === "text";
    els.faceBtn.disabled = mode === "face";
  }

  /* ── stage + player rendering ─────────────────────────── */
  function currentSession() {
    return state[state.activeTab];
  }

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString();
  }

  function renderSession() {
    var mode = state.activeTab;
    var sess = state[mode];
    var data = sess.result;

    els.stageKicker.textContent = (mode === "text" ? "TEXT SESSION" : "FACE SESSION") + (data ? "" : " · IDLE");
    els.emoChart.hidden = !(mode === "face" && data && data.all_emotions);

    if (!data) {
      els.emotionTitle.textContent = "Awaiting your mood";
      els.confRow.hidden = true;
      els.confFill.style.width = "0%";
      els.confNum.textContent = "0%";
      els.rawChip.hidden = true;
      els.faceChip.hidden = true;
      els.stageHint.textContent = mode === "text"
        ? "Type how you feel and press “Read my mood”. Results appear only when the backend answers."
        : "Drop in a photo (or use your webcam), then press “Analyze face”. Results appear only when the backend answers.";
      applyTheme(null);
      els.playerBand.hidden = true;
      els.reelWrap.hidden = true;
      return;
    }

    var title = EMOTION_TITLE[data.emotion] || String(data.emotion || "—").replace(/^./, function (c) { return c.toUpperCase(); });
    els.emotionTitle.textContent = title;

    var conf = typeof data.confidence === "number" && isFinite(data.confidence) ? Math.max(0, Math.min(1, data.confidence)) : null;
    if (conf === null) {
      els.confRow.hidden = true;
    } else {
      els.confRow.hidden = false;
      els.confFill.style.width = (conf * 100).toFixed(1) + "%";
      els.confNum.textContent = (conf * 100).toFixed(1) + "%";
      els.confBar.setAttribute("aria-valuenow", String(Math.round(conf * 100)));
    }

    if (mode === "text" && data.raw_label) {
      els.rawChip.textContent = "transformer label: " + data.raw_label;
      els.rawChip.hidden = false;
    } else {
      els.rawChip.hidden = true;
    }

    if (mode === "face" && data.face_detected === false) {
      els.faceChip.textContent = "no face detected — the CNN classified the full image";
      els.faceChip.hidden = false;
    } else {
      els.faceChip.hidden = true;
    }

    applyTheme(data.emotion);

    var songs = Array.isArray(data.songs) ? data.songs : [];
    var extra = songs.length
      ? "Genuine backend response · " + songs.length + " track(s) · received " + fmtTime(sess.at)
      : "Genuine backend response · no tracks returned for this mood · received " + fmtTime(sess.at);
    els.stageHint.textContent = extra;

    if (mode === "face") renderEmoChart(data.all_emotions);

    if (!songs.length) {
      els.playerBand.hidden = true;
      els.reelWrap.hidden = true;
      return;
    }
    if (sess.songIdx >= songs.length) sess.songIdx = 0;
    renderPlayer();
    renderReel();
  }

  function renderEmoChart(all) {
    var box = els.emoBars;
    box.textContent = "";
    if (!all || typeof all !== "object") return;
    var entries = Object.keys(all).map(function (k) {
      return { label: k, value: typeof all[k] === "number" && isFinite(all[k]) ? all[k] : 0 };
    }).sort(function (a, b) { return b.value - a.value; });
    if (!entries.length) return;
    var max = entries[0].value || 1;
    entries.forEach(function (e) {
      var row = document.createElement("div");
      row.className = "bar-row";
      var lab = document.createElement("span");
      lab.className = "bar-label";
      lab.textContent = e.label;
      var track = document.createElement("div");
      track.className = "bar-track";
      var fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width = Math.max(2, (e.value / max) * 100).toFixed(1) + "%";
      track.appendChild(fill);
      var val = document.createElement("span");
      val.className = "bar-val";
      val.textContent = (e.value * 100).toFixed(1) + "%";
      row.appendChild(lab); row.appendChild(track); row.appendChild(val);
      box.appendChild(row);
    });
  }

  function activeSongs() {
    var r = currentSession().result;
    return r && Array.isArray(r.songs) ? r.songs : [];
  }

  function renderPlayer() {
    var songs = activeSongs();
    var sess = currentSession();
    if (!songs.length) { els.playerBand.hidden = true; return; }
    var idx = Math.min(sess.songIdx, songs.length - 1);
    var s = songs[idx];
    els.playerBand.hidden = false;
    els.npPos.textContent = (idx + 1) + " / " + songs.length;
    els.npTitle.textContent = s.title || "Untitled";
    els.npChannel.textContent = s.channel || "Unknown channel";
    els.npDuration.textContent = s.duration ? " · " + s.duration : "";
    if (s.thumbnail) {
      els.npThumb.src = s.thumbnail;
      els.npThumb.alt = (s.title || "Track") + " thumbnail";
      els.npThumb.hidden = false;
    } else {
      els.npThumb.hidden = true;
    }
    els.npLink.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(s.video_id || "");
  }

  function renderReel(scrollActive) {
    var songs = activeSongs();
    var sess = currentSession();
    els.reel.textContent = "";
    if (!songs.length) { els.reelWrap.hidden = true; return; }
    els.reelWrap.hidden = false;
    els.reelCount.textContent = songs.length + " track" + (songs.length === 1 ? "" : "s") + " from the API";

    songs.forEach(function (s, i) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "reel-card" + (i === sess.songIdx ? " is-active" : "");
      card.setAttribute("aria-label", "Play " + (s.title || "track " + (i + 1)));
      if (s.thumbnail) {
        var img = document.createElement("img");
        img.src = s.thumbnail;
        img.alt = "";
        img.loading = "lazy";
        card.appendChild(img);
      }
      var body = document.createElement("div");
      body.className = "reel-body";
      var t = document.createElement("div");
      t.className = "reel-title";
      t.textContent = s.title || "Untitled";
      var m = document.createElement("div");
      m.className = "reel-meta";
      m.textContent = [s.channel || "Unknown channel", s.duration || ""].filter(Boolean).join(" · ");
      body.appendChild(t); body.appendChild(m);
      card.appendChild(body);
      card.addEventListener("click", function () {
        sess.songIdx = i;
        renderPlayer();
        renderReel(false);
      });
      els.reel.appendChild(card);
    });

    if (scrollActive) {
      var activeCard = els.reel.querySelector(".is-active");
      if (activeCard && activeCard.scrollIntoView) {
        activeCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }

  function stepSong(delta) {
    var songs = activeSongs();
    if (!songs.length) return;
    var sess = currentSession();
    sess.songIdx = (sess.songIdx + delta + songs.length) % songs.length;
    renderPlayer();
    renderReel(true);
  }

  function copyPlaylist() {
    var songs = activeSongs();
    if (!songs.length) return;
    var r = currentSession().result;
    var head = "MoodTunes session — " + (r.emotion || "mood") +
      (typeof r.confidence === "number" ? " (" + (r.confidence * 100).toFixed(1) + "%)" : "");
    var lines = [head];
    songs.forEach(function (s, i) {
      lines.push((i + 1) + ". " + (s.title || "Untitled") + " — https://www.youtube.com/watch?v=" + s.video_id);
    });
    var original = els.copyPlaylist.textContent;
    copyText(lines.join("\n")).then(function () {
      els.copyPlaylist.textContent = "Copied!";
      setTimeout(function () { els.copyPlaylist.textContent = original; }, 1500);
    }).catch(function () {
      els.copyPlaylist.textContent = "Copy failed";
      setTimeout(function () { els.copyPlaylist.textContent = original; }, 1500);
    });
  }

  /* ── text mood ────────────────────────────────────────── */
  function submitText() {
    var text = (els.textInput.value || "").trim();
    if (text.length < MIN_LEN) {
      showErr(els.textError, "Enter at least " + MIN_LEN + " characters — the transformer needs some text to read.");
      return;
    }
    clearErr(els.textError);
    setLoading("text", "DistilBERT is reading your words… (first request can be slow while the ~200MB model loads)");

    var payload = { text: text, language: els.langText.value };
    fetchTimed(apiBase() + "/predict-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, TIMEOUT).then(function (res) {
      return res.text().then(function (raw) {
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { data = null; }

        if (!res.ok) {
          var detail = data && data.detail ? data.detail : "HTTP " + res.status;
          showErr(els.textError, "Backend rejected the request — " + detail + ".");
          return;
        }
        if (!data || typeof data.emotion !== "string") {
          showErr(els.textError, "Invalid JSON from /predict-text — expected {emotion, confidence, songs}.");
          return;
        }
        if (!Array.isArray(data.songs)) data.songs = [];
        state.text = { result: data, songIdx: 0, at: Date.now() };
        markOnline("last text response " + fmtTime(state.text.at));
        renderSession();
      });
    }).catch(function (err) {
      var aborted = err && err.name === "AbortError";
      if (aborted) {
        showErr(els.textError, "Timed out after 30 s. If this is the first request, the backend may still be downloading/loading the model — try again in a moment.");
      } else {
        showErr(els.textError, "Cannot reach " + apiBase() + "/predict-text — is uvicorn running? See the setup panel above.");
        markOffline("no response — start uvicorn, then recheck");
      }
    }).finally(function () {
      setLoading(null);
    });
  }

  /* ── files / webcam ───────────────────────────────────── */
  function stopCam() {
    var f = state.face;
    if (f.stream) {
      f.stream.getTracks().forEach(function (t) { t.stop(); });
      f.stream = null;
    }
    els.webcam.srcObject = null;
    els.webcam.hidden = true;
    els.captureBtn.hidden = true;
    els.camBtn.textContent = "Use webcam";
    if (!f.file) els.dropCopy.hidden = false;
  }

  function setFile(file) {
    clearErr(els.faceError);
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      showErr(els.faceError, "That file isn't an image — please use JPEG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_FILE) {
      showErr(els.faceError, "Image is larger than 20 MB — please pick a smaller photo.");
      return;
    }
    var f = state.face;
    if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    f.file = file;
    f.previewUrl = URL.createObjectURL(file);
    els.preview.src = f.previewUrl;
    els.preview.hidden = false;
    els.dropCopy.hidden = true;
    els.removeImg.hidden = false;
  }

  function clearImage() {
    var f = state.face;
    stopCam();
    if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    f.file = null;
    f.previewUrl = null;
    els.preview.removeAttribute("src");
    els.preview.hidden = true;
    els.removeImg.hidden = true;
    els.dropCopy.hidden = false;
    els.fileInput.value = "";
  }

  function toggleCam() {
    if (state.face.stream) { stopCam(); return; }
    clearErr(els.faceError);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showErr(els.faceError, "Camera API unavailable here — serve this page over localhost/https, or drop a photo file instead.");
      return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false
    }).then(function (stream) {
      state.face.stream = stream;
      var v = els.webcam;
      v.srcObject = stream;
      v.hidden = false;
      v.play();
      els.preview.hidden = true;
      els.dropCopy.hidden = true;
      els.captureBtn.hidden = false;
      els.camBtn.textContent = "Stop camera";
    }).catch(function (err) {
      showErr(els.faceError, "Camera unavailable — " + (err && err.message ? err.message : "permission denied") +
        ". Allow camera access in the browser, or drop a photo instead.");
    });
  }

  function captureFrame() {
    var v = els.webcam;
    if (!v.videoWidth || !v.videoHeight) {
      showErr(els.faceError, "Camera isn't streaming yet — wait a beat, then capture again.");
      return;
    }
    var canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    canvas.toBlob(function (blob) {
      stopCam();
      if (!blob) {
        showErr(els.faceError, "Could not capture a frame from the camera.");
        return;
      }
      setFile(new File([blob], "webcam-capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  /* ── face mood ────────────────────────────────────────── */
  function submitFace() {
    var f = state.face;
    if (!f.file) {
      showErr(els.faceError, "Add a photo first — drag & drop one, browse, or capture a webcam frame.");
      return;
    }
    clearErr(els.faceError);
    setLoading("face", "DeepFace + the custom CNN are analyzing the photo…");

    var fd = new FormData();
    fd.append("file", f.file, f.file.name || "capture.jpg");
    fd.append("language", els.langFace.value);

    fetchTimed(apiBase() + "/predict", { method: "POST", body: fd }, TIMEOUT).then(function (res) {
      return res.text().then(function (raw) {
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { data = null; }

        if (!res.ok) {
          var detail = data && data.detail ? data.detail : "HTTP " + res.status;
          showErr(els.faceError, "Backend rejected the image — " + detail + ".");
          return;
        }
        if (!data || typeof data.emotion !== "string") {
          showErr(els.faceError, "Invalid JSON from /predict — expected {emotion, confidence, face_detected, all_emotions, songs}.");
          return;
        }
        if (!Array.isArray(data.songs)) data.songs = [];
        state.face.result = data;
        state.face.songIdx = 0;
        state.face.at = Date.now();
        markOnline("last face response " + fmtTime(state.face.at));
        renderSession();
      });
    }).catch(function (err) {
      var aborted = err && err.name === "AbortError";
      if (aborted) {
        showErr(els.faceError, "Timed out after 30 s. On first use the backend loads face models — try again in a moment.");
      } else {
        showErr(els.faceError, "Cannot reach " + apiBase() + "/predict — is uvicorn running? See the setup panel above.");
        markOffline("no response — start uvicorn, then recheck");
      }
    }).finally(function () {
      setLoading(null);
    });
  }

  /* ── panes / reset ────────────────────────────────────── */
  function setTab(name) {
    state.activeTab = name;
    var isText = name === "text";
    els.paneText.hidden = !isText;
    els.paneFace.hidden = isText;
    els.tabText.classList.toggle("is-active", isText);
    els.tabFace.classList.toggle("is-active", !isText);
    els.tabText.setAttribute("aria-selected", isText ? "true" : "false");
    els.tabFace.setAttribute("aria-selected", isText ? "false" : "true");
    renderSession();
  }

  function clearText() {
    els.textInput.value = "";
    els.charCount.textContent = "0 / 2000";
    clearErr(els.textError);
    state.text = { result: null, songIdx: 0, at: null };
    renderSession();
  }

  function clearFace() {
    clearErr(els.faceError);
    clearImage();
    state.face.result = null;
    state.face.songIdx = 0;
    state.face.at = null;
    els.emoBars.textContent = "";
    renderSession();
  }

  function syncLang(value, source) {
    lsSet(LS_LANG, value);
    if (source !== "text") els.langText.value = value;
    if (source !== "face") els.langFace.value = value;
  }

  /* ── boot ─────────────────────────────────────────────── */
  function init() {
    els = {
      apiBase: $("apiBase"), healthPill: $("healthPill"), healthText: $("healthText"),
      healthDetail: $("healthDetail"), recheckBtn: $("recheckBtn"), offlinePanel: $("offlinePanel"),
      tabText: $("tabText"), tabFace: $("tabFace"), paneText: $("pane-text"), paneFace: $("pane-face"),
      orbOverlay: $("orbOverlay"), orbMsg: $("orbMsg"),
      stageKicker: $("stageKicker"), emotionTitle: $("emotionTitle"),
      confRow: $("confRow"), confFill: $("confFill"), confNum: $("confNum"), confBar: $("confBar"),
      moodChip: $("moodChip"), rawChip: $("rawChip"), faceChip: $("faceChip"), stageHint: $("stageHint"),
      textInput: $("textInput"), charCount: $("charCount"), textError: $("textError"),
      langText: $("langText"), textBtn: $("textBtn"), textClear: $("textClear"),
      dropZone: $("dropZone"), fileInput: $("fileInput"), preview: $("preview"),
      webcam: $("webcam"), dropCopy: $("dropCopy"), camBtn: $("camBtn"),
      captureBtn: $("captureBtn"), removeImg: $("removeImg"),
      langFace: $("langFace"), faceError: $("faceError"), faceBtn: $("faceBtn"), faceClear: $("faceClear"),
      emoChart: $("emoChart"), emoBars: $("emoBars"),
      playerBand: $("playerBand"), prevBtn: $("prevBtn"), nextBtn: $("nextBtn"),
      npThumb: $("npThumb"), npPos: $("npPos"), npTitle: $("npTitle"),
      npChannel: $("npChannel"), npDuration: $("npDuration"), npLink: $("npLink"),
      reelWrap: $("reelWrap"), reel: $("reel"), reelCount: $("reelCount"), copyPlaylist: $("copyPlaylist")
    };

    var savedApi = lsGet(LS_API);
    if (savedApi) els.apiBase.value = savedApi;
    var savedLang = lsGet(LS_LANG);
    if (savedLang) {
      els.langText.value = savedLang;
      els.langFace.value = savedLang;
    }

    els.apiBase.addEventListener("change", function () {
      lsSet(LS_API, els.apiBase.value.trim());
      checkHealth();
    });
    els.apiBase.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); els.apiBase.blur(); }
    });
    els.recheckBtn.addEventListener("click", checkHealth);

    els.tabText.addEventListener("click", function () { setTab("text"); });
    els.tabFace.addEventListener("click", function () { setTab("face"); });

    els.textInput.addEventListener("input", function () {
      els.charCount.textContent = els.textInput.value.length + " / 2000";
    });
    els.textInput.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submitText(); }
    });
    els.textBtn.addEventListener("click", submitText);
    els.textClear.addEventListener("click", clearText);

    els.langText.addEventListener("change", function () { syncLang(els.langText.value, "text"); });
    els.langFace.addEventListener("change", function () { syncLang(els.langFace.value, "face"); });

    els.dropZone.addEventListener("click", function () { els.fileInput.click(); });
    els.dropZone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.fileInput.click(); }
    });
    ["dragenter", "dragover"].forEach(function (evt) {
      els.dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        els.dropZone.classList.add("is-over");
      });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      els.dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        els.dropZone.classList.remove("is-over");
      });
    });
    els.dropZone.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        setFile(e.dataTransfer.files[0]);
      }
    });
    els.fileInput.addEventListener("change", function () {
      if (els.fileInput.files && els.fileInput.files.length) setFile(els.fileInput.files[0]);
    });
    els.camBtn.addEventListener("click", toggleCam);
    els.captureBtn.addEventListener("click", captureFrame);
    els.removeImg.addEventListener("click", clearImage);
    els.faceBtn.addEventListener("click", submitFace);
    els.faceClear.addEventListener("click", clearFace);

    els.prevBtn.addEventListener("click", function () { stepSong(-1); });
    els.nextBtn.addEventListener("click", function () { stepSong(1); });
    els.copyPlaylist.addEventListener("click", copyPlaylist);

    renderSession();
    checkHealth();
    setInterval(checkHealth, POLL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
