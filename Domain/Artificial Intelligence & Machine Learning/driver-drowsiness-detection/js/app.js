(function () {
  "use strict";

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };

  var els = {
    earValue: $("#ear-value"),
    statePlate: $("#state-plate"),
    stateDetail: $("#state-detail"),
    led: $("#state-led"),
    ledText: $("#state-led-text"),
    timer: $("#session-timer"),
    clock: $("#clock"),
    clockToggle: $("#clock-toggle"),
    armBtn: $("#alarm-arm"),
    armText: $("#alarm-arm-text"),
    volume: $("#volume"),
    muteBtn: $("#mute-btn"),
    alarmTest: $("#alarm-test"),
    alarmNote: $("#alarm-note"),
    sessionBtn: $("#session-btn"),
    sessionNote: $("#session-note"),
    baseline: $("#baseline"),
    baselineVal: $("#baseline-val"),
    profile: $("#profile"),
    canvas: $("#strip-chart"),
    snapshot: $("#snapshot-btn"),
    needle: $("#gauge-needle"),
    ticks: $("#gauge-ticks"),
    mBlinks: $("#metric-blinks"),
    mAlerts: $("#metric-alerts"),
    mAvg: $("#metric-avg"),
    mClosure: $("#metric-closure")
  };

  if (!els.canvas || !els.earValue || !els.sessionBtn) {
    return;
  }

  var MAX_EAR = 0.45;
  var THRESH = 0.27;
  var THRESH_ALERT = 0.25;
  var BLINK_WINDOW = 0.15;
  var DROWSY_TIME = 1.5;
  var ALERT_TIME = 1.0;
  var SAMPLE_MS = 50;
  var MAX_SAMPLES = 480;

  var PROFILES = {
    steady: { blink: [3000, 5500], mild: null, deep: null },
    normal: { blink: [2200, 4500], mild: [15000, 26000], deep: null },
    drowsy: { blink: [1500, 3000], mild: [11000, 17000], deep: [7000, 12000] }
  };

  var S = {
    running: false,
    profile: "normal",
    baseline: 0.3,
    noise: 0,
    ear: 0,
    state: "idle",
    sessionStart: 0,
    elapsed: 0,
    lastSampleAt: 0,
    nextBlinkAt: 0,
    blinkFrom: 0,
    blinkTo: 0,
    nextMildAt: 0,
    mildFrom: 0,
    mildTo: 0,
    nextDeepAt: 0,
    deepFrom: 0,
    deepTo: 0,
    samples: [],
    belowSince: 0,
    below25Since: 0,
    episodeCounted: false,
    wasBelow: false,
    blinks: 0,
    alerts: 0,
    sum: 0,
    count: 0,
    longest: 0,
    runStart: 0,
    rafId: 0
  };

  var audio = {
    ctx: null,
    master: null,
    armed: true,
    muted: false,
    volume: 0.6,
    loopId: null,
    phase: 0
  };

  var use24 = true;

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    reduceMotion = false;
  }

  /* ---------- storage ---------- */

  function store(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* unavailable */ }
  }

  function recall(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }

  /* ---------- audio ---------- */

  function ensureAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return null; }
    if (!audio.ctx) {
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.volume;
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }
    return audio.ctx;
  }

  function beep(freq, dur, when) {
    var ctx = ensureAudio();
    if (!ctx || audio.muted || audio.volume <= 0) { return; }
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audio.master);
    var start = ctx.currentTime + (when || 0);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.6, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function startAlarmLoop() {
    if (audio.loopId !== null) { return; }
    audio.phase = 0;
    beep(880, 0.12);
    audio.loopId = window.setInterval(function () {
      audio.phase += 1;
      beep(audio.phase % 2 === 0 ? 880 : 660, 0.12);
    }, 200);
  }

  function stopAlarmLoop() {
    if (audio.loopId !== null) {
      window.clearInterval(audio.loopId);
      audio.loopId = null;
    }
  }

  function setAlarmNote(text) {
    if (els.alarmNote) { els.alarmNote.textContent = text || ""; }
  }

  /* ---------- gauge ---------- */

  function gaugePoint(v, radius) {
    var a = Math.PI * (1 - v / MAX_EAR);
    return {
      x: 220 + radius * Math.cos(a),
      y: 240 - radius * Math.sin(a)
    };
  }

  function svgEl(name, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function addTick(v, className, radiusIn) {
    var r = 170;
    var outer = gaugePoint(v, r - 13);
    var inner = gaugePoint(v, r - radiusIn);
    els.ticks.appendChild(svgEl("line", {
      x1: outer.x.toFixed(2), y1: outer.y.toFixed(2),
      x2: inner.x.toFixed(2), y2: inner.y.toFixed(2),
      "class": className
    }));
  }

  function addTickLabel(v, text, className) {
    var pt = gaugePoint(v, 170 - 38);
    var node = svgEl("text", {
      x: pt.x.toFixed(2), y: (pt.y + 4).toFixed(2),
      "text-anchor": "middle", "class": className
    });
    node.textContent = text;
    els.ticks.appendChild(node);
  }

  function buildTicks() {
    if (!els.ticks) { return; }
    var i;
    for (i = 0; i <= 18; i += 1) {
      var val = (i * 25) / 1000;
      var major = i % 2 === 0;
      addTick(val, major ? "tick-line major" : "tick-line", major ? 25 : 19);
      if (i % 4 === 0 && val <= 0.4001) {
        addTickLabel(val, val.toFixed(1), "tick-text");
      }
    }
    addTick(THRESH, "tick-line redline-tick", 27);
    var hotPt = gaugePoint(THRESH, 170 - 38);
    var hotTxt = svgEl("text", {
      x: hotPt.x.toFixed(2), y: hotPt.y.toFixed(2),
      "text-anchor": "middle", "class": "tick-text hot"
    });
    hotTxt.textContent = "0.27";
    els.ticks.appendChild(hotTxt);
  }

  function setNeedle(v) {
    if (!els.needle) { return; }
    var deg = (v / MAX_EAR) * 180 - 180;
    els.needle.setAttribute("transform", "rotate(" + deg.toFixed(2) + " 220 240)");
  }

  var STATE_COPY = {
    idle: "Start the session to drive the simulated signal.",
    normal: "Eyes open — EAR at or above the 0.27 threshold used in blinkDetect.py.",
    warning: "Closure held past the 0.15 s false-blink window — slow blink or the start of a doze.",
    drowsy: "EAR held below 0.27 for 1.5 s (drowsyTime) without reaching the 0.25 alert band.",
    alert: "EAR below 0.25 for about 20 frames — the alarm sounds while armed."
  };

  var STATE_LABEL = {
    idle: "STANDBY",
    normal: "NORMAL",
    warning: "DROWSY WARNING",
    drowsy: "DROWSY",
    alert: "ALERT"
  };

  function setState(next) {
    if (S.state === next) { return; }
    var prev = S.state;
    S.state = next;

    if (els.statePlate) {
      els.statePlate.textContent = STATE_LABEL[next];
      els.statePlate.setAttribute("data-state", next);
    }
    if (els.led) { els.led.setAttribute("data-state", next); }
    if (els.ledText) { els.ledText.textContent = STATE_LABEL[next]; }
    if (els.earValue) { els.earValue.setAttribute("data-state", next); }
    if (els.stateDetail) { els.stateDetail.textContent = STATE_COPY[next]; }

    var sustained = next === "drowsy" || next === "alert";
    if (sustained && prev !== next && !S.episodeCounted) {
      S.episodeCounted = true;
      S.alerts += 1;
      if (els.mAlerts) { els.mAlerts.textContent = String(S.alerts); }
    }

    if (next === "alert" && audio.armed && !audio.muted && S.running) {
      startAlarmLoop();
    } else {
      stopAlarmLoop();
    }
  }

  /* ---------- chart ---------- */

  var chartCtx = null;
  var chartW = 0;
  var chartH = 0;

  function setupChart() {
    var dpr = window.devicePixelRatio || 1;
    var rect = els.canvas.getBoundingClientRect();
    chartW = Math.max(240, Math.round(rect.width || els.canvas.width));
    chartH = Math.max(120, Math.round(rect.height || els.canvas.height));
    els.canvas.width = Math.round(chartW * dpr);
    els.canvas.height = Math.round(chartH * dpr);
    chartCtx = els.canvas.getContext("2d");
    if (chartCtx) {
      chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    drawChart();
  }

  function yFor(v) {
    var pad = 14;
    var t = Math.max(0, Math.min(1, v / MAX_EAR));
    return chartH - pad - t * (chartH - pad * 2);
  }

  function traceColor() {
    if (S.state === "alert") { return "#ff3131"; }
    if (S.state === "drowsy") { return "#ff7a1a"; }
    if (S.state === "warning") { return "#ffb020"; }
    if (S.state === "idle") { return "#6f7d76"; }
    return "#34e06a";
  }

  function drawChart() {
    if (!chartCtx) { return; }
    var ctx = chartCtx;
    ctx.clearRect(0, 0, chartW, chartH);

    ctx.fillStyle = "#06080a";
    ctx.fillRect(0, 0, chartW, chartH);

    ctx.strokeStyle = "rgba(126, 139, 132, 0.16)";
    ctx.lineWidth = 1;
    var gv;
    for (gv = 0.05; gv < MAX_EAR; gv += 0.05) {
      var gy = Math.round(yFor(gv)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(chartW, gy);
      ctx.stroke();
    }
    var gx;
    for (gx = chartW; gx > 0; gx -= 80) {
      ctx.beginPath();
      ctx.moveTo(Math.round(gx) + 0.5, 0);
      ctx.lineTo(Math.round(gx) + 0.5, chartH);
      ctx.stroke();
    }

    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 49, 49, 0.85)";
    ctx.beginPath();
    ctx.moveTo(0, yFor(THRESH));
    ctx.lineTo(chartW, yFor(THRESH));
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 176, 32, 0.8)";
    ctx.beginPath();
    ctx.moveTo(0, yFor(THRESH_ALERT));
    ctx.lineTo(chartW, yFor(THRESH_ALERT));
    ctx.stroke();
    ctx.restore();

    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillStyle = "rgba(255, 49, 49, 0.9)";
    ctx.fillText("0.27", 6, yFor(THRESH) - 5);
    ctx.fillStyle = "rgba(255, 176, 32, 0.9)";
    ctx.fillText("0.25", 6, yFor(THRESH_ALERT) - 5);
    ctx.fillStyle = "rgba(126, 139, 132, 0.8)";
    ctx.fillText("0.45", 6, yFor(MAX_EAR) + 12);
    ctx.fillText("0.00", 6, chartH - 3);

    if (S.samples.length > 1) {
      var step = chartW / MAX_SAMPLES;
      var offset = chartW - (S.samples.length - 1) * step;
      ctx.strokeStyle = traceColor();
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.beginPath();
      S.samples.forEach(function (v, i) {
        var x = offset + i * step;
        var y = yFor(v);
        if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
      });
      ctx.stroke();

      var last = S.samples[S.samples.length - 1];
      var lx = offset + (S.samples.length - 1) * step;
      ctx.fillStyle = traceColor();
      ctx.beginPath();
      ctx.arc(lx, yFor(last), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "11px 'Chakra Petch', sans-serif";
    ctx.fillStyle = "rgba(255, 176, 32, 0.75)";
    ctx.fillText("SIMULATED SIGNAL — NOT WEBCAM EAR", Math.max(10, chartW - 260), chartH - 8);
  }

  function snapshot() {
    var headerH = 52;
    var out = document.createElement("canvas");
    out.width = els.canvas.width;
    out.height = els.canvas.height + Math.round(headerH * (window.devicePixelRatio || 1));
    var dpr = window.devicePixelRatio || 1;
    var octx = out.getContext("2d");
    if (!octx) { return; }
    octx.fillStyle = "#0c0f0e";
    octx.fillRect(0, 0, out.width, headerH * dpr);
    octx.fillStyle = "#ffb020";
    octx.font = "700 " + Math.round(14 * dpr) + "px Rajdhani, sans-serif";
    octx.fillText("COCKPIT · EAR STRIP CHART · SIMULATED SIGNAL (NOT WEBCAM EAR)", 12 * dpr, 22 * dpr);
    octx.fillStyle = "#d3dcd6";
    octx.font = Math.round(12 * dpr) + "px 'Share Tech Mono', monospace";
    octx.fillText(
      new Date().toISOString() + "  ·  state " + STATE_LABEL[S.state] +
      "  ·  EAR " + S.ear.toFixed(3) + "  ·  baseline " + S.baseline.toFixed(3),
      12 * dpr, 42 * dpr
    );
    octx.drawImage(els.canvas, 0, headerH * dpr);

    var url = out.toDataURL("image/png");
    var link = document.createElement("a");
    link.href = url;
    link.download = "cockpit-ear-sim.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSessionNote("Snapshot saved (simulated signal).");
  }

  /* ---------- metrics ---------- */

  function updateMetrics() {
    if (els.mBlinks) { els.mBlinks.textContent = String(S.blinks); }
    if (els.mAvg) { els.mAvg.textContent = S.count ? (S.sum / S.count).toFixed(3) : "—"; }
    if (els.mClosure) { els.mClosure.textContent = (S.longest / 1000).toFixed(2) + " s"; }
  }

  function setSessionNote(text) {
    if (els.sessionNote) { els.sessionNote.textContent = text; }
  }

  function fmtElapsed(ms) {
    var total = Math.floor(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  /* ---------- simulation ---------- */

  function rand(min, max) { return min + Math.random() * (max - min); }

  function schedule(profile, now) {
    var p = PROFILES[profile] || PROFILES.normal;
    S.nextBlinkAt = now + rand(p.blink[0], p.blink[1]);
    S.blinkFrom = 0;
    S.blinkTo = 0;
    S.nextMildAt = p.mild ? now + rand(p.mild[0], p.mild[1]) : Infinity;
    S.mildFrom = 0;
    S.mildTo = 0;
    S.nextDeepAt = p.deep ? now + rand(p.deep[0], p.deep[1]) : Infinity;
    S.deepFrom = 0;
    S.deepTo = 0;
  }

  function envelope(now, from, to) {
    if (!from || now < from || now > to) { return 0; }
    return Math.sin(Math.PI * (now - from) / (to - from));
  }

  function stepSignal(now) {
    var p = PROFILES[S.profile] || PROFILES.normal;
    S.noise = S.noise * 0.94 + (Math.random() - 0.5) * 0.014;
    var v = S.baseline + S.noise;

    if (S.blinkTo && now >= S.blinkTo) {
      S.blinkFrom = 0;
      S.blinkTo = 0;
      S.nextBlinkAt = now + rand(p.blink[0], p.blink[1]);
    }
    if (!S.blinkTo && now >= S.nextBlinkAt) {
      S.blinkFrom = now;
      S.blinkTo = now + rand(90, 140);
    }

    if (p.mild) {
      if (S.mildTo && now >= S.mildTo) {
        S.mildFrom = 0;
        S.mildTo = 0;
        S.nextMildAt = now + rand(p.mild[0], p.mild[1]);
      }
      if (!S.mildTo && now >= S.nextMildAt) {
        S.mildFrom = now;
        S.mildTo = now + rand(1700, 2300);
      }
    }
    if (p.deep) {
      if (S.deepTo && now >= S.deepTo) {
        S.deepFrom = 0;
        S.deepTo = 0;
        S.nextDeepAt = now + rand(p.deep[0], p.deep[1]);
      }
      if (!S.deepTo && now >= S.nextDeepAt) {
        S.deepFrom = now;
        S.deepTo = now + rand(1900, 2600);
      }
    }

    var blinkEnv = envelope(now, S.blinkFrom, S.blinkTo);
    var mildEnv = envelope(now, S.mildFrom, S.mildTo);
    var deepEnv = envelope(now, S.deepFrom, S.deepTo);

    if (deepEnv > 0) {
      v = v * (1 - deepEnv) + 0.06 * deepEnv;
    } else if (mildEnv > 0) {
      var mildFloor = rand(0.252, 0.264);
      v = v * (1 - mildEnv) + mildFloor * mildEnv;
    } else if (blinkEnv > 0) {
      v = v * (1 - blinkEnv) + 0.07 * blinkEnv;
    }

    if (v < 0) { v = 0; }
    if (v > MAX_EAR) { v = MAX_EAR; }
    return v;
  }

  function evaluateState(v, now) {
    if (v >= THRESH) {
      S.belowSince = 0;
      S.below25Since = 0;
      S.episodeCounted = false;
      if (S.wasBelow) {
        S.wasBelow = false;
        if (S.runStart) {
          var dur = now - S.runStart;
          if (dur > S.longest) {
            S.longest = dur;
          }
        }
        S.runStart = 0;
      }
      return "normal";
    }

    if (!S.belowSince) {
      S.belowSince = now;
      S.runStart = now;
    }
    S.wasBelow = true;
    var held = (now - S.belowSince) / 1000;

    if (v < THRESH_ALERT) {
      if (!S.below25Since) { S.below25Since = now; }
    } else {
      S.below25Since = 0;
    }

    var alertHeld = S.below25Since && (now - S.below25Since) / 1000 >= ALERT_TIME;
    if (alertHeld) { return "alert"; }
    if (held >= DROWSY_TIME) { return "drowsy"; }
    if (held >= BLINK_WINDOW) { return "warning"; }
    return "normal";
  }

  function sample(now) {
    var v = stepSignal(now);
    S.ear = v;
    S.samples.push(v);
    if (S.samples.length > MAX_SAMPLES) { S.samples.shift(); }

    S.sum += v;
    S.count += 1;

    var rising = S.wasBelow && v >= THRESH;
    if (rising) {
      S.blinks += 1;
    }

    var next = evaluateState(v, now);
    setState(next);

    if (S.wasBelow || v < THRESH) {
      var runDur = now - (S.runStart || now);
      if (v < THRESH && runDur > S.longest) {
        S.longest = runDur;
      }
    }

    if (els.earValue) { els.earValue.textContent = v.toFixed(3); }
    setNeedle(v);
    updateMetrics();
    if (els.timer) { els.timer.textContent = fmtElapsed(S.elapsed); }
    drawChart();
  }

  function loop() {
    if (!S.running) { return; }
    var now = performance.now();
    S.elapsed = now - S.sessionStart;
    if (now - S.lastSampleAt >= SAMPLE_MS) {
      S.lastSampleAt = now;
      sample(now);
    }
    S.rafId = window.requestAnimationFrame(loop);
  }

  /* ---------- session ---------- */

  function startSession() {
    ensureAudio();
    S.running = true;
    S.sessionStart = performance.now();
    S.lastSampleAt = S.sessionStart;
    S.elapsed = 0;
    S.samples = [];
    S.noise = 0;
    S.ear = S.baseline;
    S.state = "idle";
    S.belowSince = 0;
    S.below25Since = 0;
    S.episodeCounted = false;
    S.wasBelow = false;
    S.runStart = 0;
    S.blinks = 0;
    S.alerts = 0;
    S.sum = 0;
    S.count = 0;
    S.longest = 0;
    schedule(S.profile, S.sessionStart);

    els.sessionBtn.textContent = "Stop session";
    els.sessionBtn.classList.add("is-running");
    setSessionNote("Session running — simulated EAR at baseline " + S.baseline.toFixed(3) + " · profile: " + S.profile + ".");
    setState("normal");
    updateMetrics();
    if (els.mAlerts) { els.mAlerts.textContent = "0"; }
    if (els.mBlinks) { els.mBlinks.textContent = "0"; }
    drawChart();
    S.rafId = window.requestAnimationFrame(loop);
  }

  function stopSession() {
    S.running = false;
    window.cancelAnimationFrame(S.rafId);
    stopAlarmLoop();
    setState("idle");
    els.sessionBtn.textContent = "Start session";
    els.sessionBtn.classList.remove("is-running");
    if (els.timer) { els.timer.textContent = fmtElapsed(S.elapsed); }
    setSessionNote("Session stopped at " + fmtElapsed(S.elapsed) + " — metrics frozen; start again for a fresh run.");
    drawChart();
  }

  function toggleSession() {
    if (S.running) { stopSession(); } else { startSession(); }
  }

  /* ---------- clock ---------- */

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function tickClock() {
    if (!els.clock) { return; }
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    if (use24) {
      els.clock.textContent = pad2(h) + ":" + pad2(m);
    } else {
      var suffix = h < 12 ? "AM" : "PM";
      var h12 = h % 12;
      if (h12 === 0) { h12 = 12; }
      els.clock.textContent = h12 + ":" + pad2(m) + " " + suffix;
    }
  }

  function toggleClock() {
    use24 = !use24;
    store("cockpit.clock24", use24 ? "1" : "0");
    if (els.clockToggle) {
      els.clockToggle.textContent = use24 ? "24H" : "12H";
      els.clockToggle.setAttribute("aria-label", use24 ? "Switch clock to 12-hour format" : "Switch clock to 24-hour format");
    }
    tickClock();
  }

  /* ---------- wiring ---------- */

  els.sessionBtn.addEventListener("click", toggleSession);

  document.addEventListener("keydown", function (ev) {
    if (ev.repeat) { return; }
    var key = ev.key || ev.code;
    if (key !== " " && key !== "Space" && ev.code !== "Space") { return; }
    var t = ev.target;
    if (t) {
      var tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A" || t.isContentEditable) {
        return;
      }
    }
    ev.preventDefault();
    toggleSession();
  });

  if (els.baseline) {
    els.baseline.addEventListener("input", function () {
      S.baseline = Number(els.baseline.value);
      if (els.baselineVal) { els.baselineVal.textContent = S.baseline.toFixed(3); }
    });
  }

  if (els.profile) {
    els.profile.addEventListener("change", function () {
      S.profile = els.profile.value;
      if (S.running) {
        schedule(S.profile, performance.now());
        setSessionNote("Profile switched to \"" + S.profile + "\" — timing re-randomised. Session continues.");
      }
    });
  }

  if (els.clockToggle) {
    els.clockToggle.addEventListener("click", toggleClock);
  }

  if (els.armBtn) {
    els.armBtn.addEventListener("click", function () {
      ensureAudio();
      audio.armed = !audio.armed;
      els.armBtn.classList.toggle("is-armed", audio.armed);
      els.armBtn.setAttribute("aria-pressed", audio.armed ? "true" : "false");
      if (els.armText) { els.armText.textContent = audio.armed ? "Alarm armed" : "Alarm disarmed"; }
      if (!audio.armed) {
        stopAlarmLoop();
        setAlarmNote("Alarm disarmed — the siren will stay silent in ALERT.");
      } else {
        setAlarmNote("Alarm armed — a sustained closure will beep while the session runs.");
      }
    });
  }

  if (els.volume) {
    els.volume.addEventListener("input", function () {
      audio.volume = Number(els.volume.value) / 100;
      if (audio.master) { audio.master.gain.value = audio.volume; }
      if (audio.volume > 0 && audio.muted) {
        audio.muted = false;
        if (els.muteBtn) {
          els.muteBtn.textContent = "Mute";
          els.muteBtn.setAttribute("aria-pressed", "false");
        }
      }
      setAlarmNote(audio.volume === 0 ? "Volume is zero — raise it to hear alarms." : "");
    });
  }

  if (els.muteBtn) {
    els.muteBtn.addEventListener("click", function () {
      audio.muted = !audio.muted;
      els.muteBtn.setAttribute("aria-pressed", audio.muted ? "true" : "false");
      els.muteBtn.textContent = audio.muted ? "Muted" : "Mute";
      if (audio.muted) {
        stopAlarmLoop();
        setAlarmNote("Muted — visual ALERT still flashes; audio is off.");
      } else {
        setAlarmNote("Audio on.");
      }
    });
  }

  if (els.alarmTest) {
    els.alarmTest.addEventListener("click", function () {
      ensureAudio();
      if (audio.muted) {
        setAlarmNote("Alarm test blocked — muted. Press Mute to re-enable audio.");
        return;
      }
      if (audio.volume <= 0) {
        setAlarmNote("Alarm test blocked — volume is at 0.");
        return;
      }
      beep(880, 0.14, 0);
      beep(660, 0.14, 0.22);
      beep(880, 0.2, 0.44);
      setAlarmNote("Alarm test — three beeps sent to the output.");
    });
  }

  if (els.snapshot) {
    els.snapshot.addEventListener("click", snapshot);
  }

  document.addEventListener("click", function (ev) {
    var target = ev.target;
    if (!target || !target.closest) { return; }
    var btn = target.closest(".copy-btn");
    if (!btn) { return; }
    var cmd = btn.getAttribute("data-cmd");
    if (!cmd) { return; }
    var done = function (ok) {
      btn.textContent = ok ? "Copied" : "Failed";
      window.setTimeout(function () { btn.textContent = "Copy"; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(function () { done(true); }, function () { done(fallbackCopy(cmd)); });
    } else {
      done(fallbackCopy(cmd));
    }
  });

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(setupChart, 150);
  });

  /* ---------- init ---------- */

  var savedClock = recall("cockpit.clock24");
  if (savedClock !== null) { use24 = savedClock === "1"; }
  if (els.clockToggle) {
    els.clockToggle.textContent = use24 ? "24H" : "12H";
  }
  tickClock();
  window.setInterval(tickClock, 1000);

  buildTicks();
  setNeedle(S.baseline);
  els.earValue.textContent = S.baseline.toFixed(3);
  els.earValue.setAttribute("data-state", "idle");
  if (els.baselineVal) { els.baselineVal.textContent = S.baseline.toFixed(3); }
  setupChart();
  updateMetrics();
  setAlarmNote("");
})();
