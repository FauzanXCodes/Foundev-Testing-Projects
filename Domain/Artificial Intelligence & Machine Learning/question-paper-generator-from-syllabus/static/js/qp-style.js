(function () {
  "use strict";

  var STEPS = ["Select syllabus", "Prerequisites", "Generate", "Review", "Export PDF"];

  var COUNT_SPECS = [
    { name: "chapters", noun: "chapter" },
    { name: "selected_prereq_chapter", noun: "prerequisite chapter" },
    { name: "selected_prereq_combined", noun: "prerequisite chapter" },
    { name: "selected_topics", noun: "topic" },
    { name: "subject", noun: "subject" },
    { name: "content_types", noun: "content type" },
    { name: "selected_indexes", noun: "question" },
    { name: "fib_selection", noun: "topic" }
  ];

  function all(sel, root) {
    try {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }

  function one(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  function safe(fn) {
    try {
      fn();
    } catch (e) {
      return;
    }
  }

  function reducedMotion() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function toastHost() {
    var el = document.getElementById("qp-toasts");
    if (!el) {
      el = document.createElement("div");
      el.className = "qp-toasts";
      el.id = "qp-toasts";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }

  window.qpToast = function (message, kind) {
    if (!message) return;
    safe(function () {
      var host = toastHost();
      var node = document.createElement("div");
      node.className = "qp-toast" + (kind === "ok" ? " qp-toast-ok" : "");
      node.textContent = String(message);
      host.appendChild(node);
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 3400);
    });
  };

  function detectStage() {
    var path = window.location.pathname || "";
    if (all('a[href*="download_pdf"], a[href*="download_fib"]').length) return 5;
    if (all('input[name="selected_indexes"]').length) return 4;
    if (
      all('input[name="selected_prereq_chapter"], input[name="selected_topics"], input[name="selected_subtopics"], input[name="selected_prereq_combined"]').length ||
      path.indexOf("/recursive_prereq") === 0 ||
      path === "/prepare_selected_data"
    ) {
      return 2;
    }
    if (all("#boardSelect").length || all('input[name="chapters"]').length || path === "/" || path === "/select") {
      return 1;
    }
    if (all('input[name="fib_selection"]').length || path.indexOf("fib") > -1 || path.indexOf("svg") > -1) {
      return 3;
    }
    if (all('form[action*="generate"]').length) return 3;
    return 0;
  }

  function currentCountSpec() {
    for (var i = 0; i < COUNT_SPECS.length; i++) {
      if (document.querySelector('input[name="' + COUNT_SPECS[i].name + '"]')) {
        return COUNT_SPECS[i];
      }
    }
    return null;
  }

  function updateCounter(el) {
    if (!el) return;
    var spec = currentCountSpec();
    if (!spec) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    var nodes = document.querySelectorAll('input[name="' + spec.name + '"]');
    var count = 0;
    Array.prototype.forEach.call(nodes, function (input) {
      if (input.checked) count += 1;
    });
    el.hidden = false;
    el.textContent = count + " " + spec.noun + (count === 1 ? "" : "s") + " selected";
  }

  function buildProgress() {
    var stage = detectStage();
    if (!stage) return null;
    var bar = document.createElement("div");
    bar.className = "qp-progress";
    bar.id = "qp-progress";

    var inner = document.createElement("div");
    inner.className = "qp-progress-inner";

    var brand = document.createElement("span");
    brand.className = "qp-progress-brand";
    brand.textContent = "ExamForge";

    var list = document.createElement("ol");
    list.className = "qp-steps-list";
    for (var i = 0; i < STEPS.length; i++) {
      var li = document.createElement("li");
      var number = i + 1;
      var dot = document.createElement("span");
      dot.className = "qp-dot";
      dot.textContent = String(number);
      var label = document.createElement("span");
      label.className = "qp-step-label";
      label.textContent = STEPS[i];
      li.appendChild(dot);
      li.appendChild(label);
      if (number < stage) {
        li.className = "qp-done";
      } else if (number === stage) {
        li.className = "qp-current";
        li.setAttribute("aria-current", "step");
      }
      list.appendChild(li);
    }

    var counter = document.createElement("span");
    counter.className = "qp-counter";
    counter.id = "qp-counter";
    counter.hidden = true;

    inner.appendChild(brand);
    inner.appendChild(list);
    inner.appendChild(counter);
    bar.appendChild(inner);

    try {
      document.documentElement.insertBefore(bar, document.body);
    } catch (e) {
      document.body.insertBefore(bar, document.body.firstChild);
    }
    return counter;
  }

  function legacyCopy(text) {
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
  }

  function copyText(text, btn) {
    var done = function () {
      if (btn) {
        var original = btn.getAttribute("data-label") || "copy";
        btn.textContent = "copied";
        btn.classList.add("qp-copied");
        window.setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("qp-copied");
        }, 1600);
      }
      window.qpToast("Copied to clipboard", "ok");
    };
    var fail = function () {
      window.qpToast("Copy blocked here - select the text and copy manually.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        if (legacyCopy(text)) done();
        else fail();
      });
    } else if (legacyCopy(text)) {
      done();
    } else {
      fail();
    }
  }

  function setupCopyButtons() {
    var hosts = [];
    all("pre").forEach(function (pre) {
      if (pre.textContent && pre.textContent.trim()) hosts.push(pre);
    });
    all("code").forEach(function (code) {
      if (!code.closest("pre") && code.textContent && code.textContent.trim()) hosts.push(code);
    });
    hosts.forEach(function (host) {
      if (host.closest("a, button")) return;
      if (host.getAttribute && host.getAttribute("data-qp-copy") === "off") return;
      var after = host.nextElementSibling;
      if (after && after.classList && after.classList.contains("qp-copy-btn")) return;
      var text = host.textContent.trim();
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "qp-copy-btn";
      btn.textContent = "copy";
      btn.setAttribute("data-label", "copy");
      btn.setAttribute("aria-label", "Copy to clipboard: " + text.slice(0, 40));
      btn.addEventListener("click", function () {
        copyText(text, btn);
      });
      host.parentNode.insertBefore(btn, host.nextSibling);
    });
  }

  function removeFormErrors(form) {
    all(".qp-field-error[data-qp-err]", form).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
  }

  function validateSelectForm(form) {
    var issues = [];
    var board = one('select[name="board"]', form);
    var klass = one('select[name="class"]', form);
    var subjects = all('input[name="subject"]', form);

    if (board && board.options.length === 0) {
      issues.push({
        el: board,
        msg: "No textbook list loaded - the textbook source did not respond. Reload the page or try again later."
      });
    } else if (board && !board.value) {
      issues.push({ el: board, msg: "Choose a board before continuing." });
    }
    if (klass && klass.options.length === 0) {
      issues.push({ el: klass, msg: "No classes available for the selected board." });
    } else if (klass && !klass.value) {
      issues.push({ el: klass, msg: "Choose a class before continuing." });
    }
    if (subjects.length) {
      var picked = subjects.some(function (input) {
        return input.checked;
      });
      if (!picked) {
        issues.push({
          el: document.getElementById("subjectsContainer") || subjects[0],
          msg: "Select at least one subject."
        });
      }
    }
    return issues;
  }

  function renderSelectErrors(form, issues) {
    removeFormErrors(form);
    issues.forEach(function (issue) {
      var node = document.createElement("p");
      node.className = "qp-field-error";
      node.setAttribute("data-qp-err", "1");
      node.textContent = issue.msg;
      var host = issue.el && issue.el.closest ? issue.el.closest(".qp-field") : null;
      if (!host && issue.el && issue.el.parentNode) host = issue.el.parentNode;
      if (host) host.appendChild(node);
    });
  }

  function setupSelectFormValidation() {
    var forms = all('form[action="/select"], form[action$="/select"]');
    forms.forEach(function (form) {
      form.addEventListener("submit", function (event) {
        var issues = validateSelectForm(form);
        renderSelectErrors(form, issues);
        if (issues.length) {
          event.preventDefault();
          window.qpToast("Check the highlighted fields before continuing.");
          if (issues[0].el && issues[0].el.focus) issues[0].el.focus();
          return false;
        }
        return true;
      });
      form.addEventListener("change", function () {
        renderSelectErrors(form, validateSelectForm(form));
      });
      form.addEventListener("input", function () {
        var open = all(".qp-field-error[data-qp-err]", form);
        if (open.length) renderSelectErrors(form, validateSelectForm(form));
      });
    });
  }

  function setupAnchorScroll() {
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var anchor = target.closest('a[href^="#"]');
      if (!anchor) return;
      var href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      var id = href.slice(1);
      var destination = document.getElementById(id);
      if (!destination) return;
      event.preventDefault();
      destination.scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "start"
      });
      if (!destination.hasAttribute("tabindex")) destination.setAttribute("tabindex", "-1");
      try {
        destination.focus({ preventScroll: true });
      } catch (e) {
        destination.focus();
      }
      destination.classList.remove("qp-flash-target");
      void destination.offsetWidth;
      destination.classList.add("qp-flash-target");
      window.setTimeout(function () {
        destination.classList.remove("qp-flash-target");
      }, 3400);
      var hint = document.getElementById("qp-mode-hint");
      var modeHint = anchor.getAttribute("data-qp-hint");
      if (hint && modeHint) hint.textContent = modeHint;
      if (modeHint) window.qpToast(modeHint);
    });
  }

  function init() {
    var counter = null;
    safe(function () {
      counter = buildProgress();
    });
    safe(function () {
      updateCounter(counter);
      document.addEventListener("change", function () {
        updateCounter(counter);
      }, true);
      document.addEventListener("input", function () {
        updateCounter(counter);
      }, true);
    });
    safe(setupCopyButtons);
    safe(setupSelectFormValidation);
    safe(setupAnchorScroll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
