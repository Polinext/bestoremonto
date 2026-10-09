/* RIDGELINE — поведение перенесённых секций: параллакс, одометр, метки,
   побуквенная заливка заявления, рельс работ, ужимание финального фото.
   Без зависимостей, один общий rAF-цикл. */
(function () {
  "use strict";
  var root = document.querySelector(".rg-root");
  if (!root) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var subs = [];
  var sub = function (fn) { subs.push(fn); };

  /* прогресс элемента по формуле из документа */
  function progress(el, start, end) {
    var bb = el.getBoundingClientRect(), vh = window.innerHeight;
    var p = {
      "top top": bb.top, "center top": bb.top + bb.height / 2, "bottom top": bb.bottom,
      "top bottom": bb.top - vh, "center bottom": bb.top + bb.height / 2 - vh, "bottom bottom": bb.bottom - vh,
      "top center": bb.top - vh / 2, "center center": bb.top + bb.height / 2 - vh / 2, "bottom center": bb.bottom - vh / 2
    };
    var s = p[start], e = p[end], len = Math.abs(s - e);
    if (!len) return 0;
    return Math.min(1, Math.max(0, 1 - (s + len) / len));
  }
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ───── параллакс фотографий ───── */
  Array.prototype.forEach.call(root.querySelectorAll("[data-rg-drift]"), function (el) {
    var box = el.parentElement;
    var v = 0;
    sub(function () { v = lerp(v, progress(box, "top top", "bottom top"), .18); el.style.setProperty("--drift", v.toFixed(4)); });
  });
  Array.prototype.forEach.call(root.querySelectorAll("[data-rg-drift-c]"), function (el) {
    var box = el.closest(".rg-feature");
    var v = .5;
    sub(function () { v = lerp(v, progress(box, "top bottom", "bottom top"), .18); el.style.setProperty("--drift", v.toFixed(4)); });
  });

  /* ───── одометр: разряды докручиваются по скроллу ───── */
  Array.prototype.forEach.call(root.querySelectorAll("[data-rg-odo]"), function (num) {
    var digits = Array.prototype.slice.call(num.querySelectorAll(".rg-digit"));
    var n = digits.length;
    var cur = digits.map(function () { return 0; });
    sub(function () {
      var p = progress(num, "top bottom", "center center");
      digits.forEach(function (d, i) {
        var target = parseInt(d.getAttribute("data-digit"), 10);
        var lead = (n - 1 - i) * 0.08, span = 1 - (n - 1) * 0.08;
        var r = target * Math.min(1, Math.max(0, (p - lead) / span));
        cur[i] = lerp(cur[i], r, .2);
        d.querySelector(".rg-reel").style.transform = "translate(-50%," + (-cur[i] * 10) + "%)";
      });
    });
  });

  /* ───── заявление: буквы проявляются одна за другой ───── */
  var say = root.querySelector("[data-rg-fill]");
  if (say) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          Array.prototype.forEach.call(child.textContent, function (ch) {
            var s = document.createElement("span");
            s.className = "rg-l"; s.textContent = ch; s.style.opacity = .25;
            frag.appendChild(s);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(say);
    var letters = Array.prototype.slice.call(say.querySelectorAll(".rg-l"));
    sub(function () {
      var p = progress(say, "top bottom", "center center");
      var n = letters.length, c = 0.012, w = 1 - c;
      letters.forEach(function (l, i) {
        var from = i * c * w / Math.max(1, n - 1);
        var v = Math.min(1, Math.max(0, (p - from) / w));
        l.style.opacity = (0.25 + 0.75 * v).toFixed(3);
      });
    });
  }

  /* ───── метки с карточками: открыта одна на странице ───── */
  var markers = Array.prototype.slice.call(root.querySelectorAll("[data-rg-marker]"));
  var openMarker = null;
  function closeAll() { if (openMarker) { openMarker.classList.remove("is-open"); openMarker.querySelector(".rg-disc").setAttribute("aria-expanded", "false"); openMarker = null; } }
  markers.forEach(function (m) {
    var disc = m.querySelector(".rg-disc");
    function open() {
      if (openMarker === m) return;
      closeAll();
      m.classList.add("is-open"); disc.setAttribute("aria-expanded", "true"); openMarker = m;
    }
    m.addEventListener("pointerenter", open);
    disc.addEventListener("focus", open);
    disc.addEventListener("click", function (ev) { ev.stopPropagation(); if (openMarker === m) closeAll(); else open(); });
    m.addEventListener("pointerleave", function () { if (openMarker === m) closeAll(); });
  });
  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  /* ───── рельс работ ───── */
  var rail = root.querySelector("[data-rg-rail]");
  if (rail) {
    var thumb = root.querySelector("[data-rg-thumb]");
    var idx = root.querySelector(".rg-track-i");
    var sync = function () {
      var max = rail.scrollWidth - rail.clientWidth;
      var ratio = max > 0 ? rail.scrollLeft / max : 0;
      var tw = 100 / rail.children.length;
      thumb.style.width = tw + "%";
      thumb.style.transform = "translateX(" + (ratio * (100 / tw - 1) * 100) + "%)";
      idx.textContent = String(Math.round(ratio * (rail.children.length - 1)) + 1).padStart(2, "0");
    };
    rail.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    Array.prototype.forEach.call(rail.querySelectorAll("[data-rg-rail-card]"), function (card, i) {
      card.addEventListener("click", function () {
        rail.scrollTo({ left: rail.scrollWidth / rail.children.length * i, behavior: "smooth" });
      });
    });
    sync();
  }

  /* ───── финальное фото: из полного экрана ужимается в рамку ───── */
  var runway = root.querySelector("[data-rg-runway]");
  var box = root.querySelector("[data-rg-box]");
  if (runway && box && window.matchMedia("(min-width: 1024px)").matches) {
    var sh = 0;
    sub(function () {
      var p = progress(runway, "top bottom", "bottom bottom");
      sh = lerp(sh, Math.min(1, p / 0.8), .18);
      box.style.setProperty("--shrink", sh.toFixed(4));
      box.style.setProperty("--cta-in", Math.min(1, Math.max(0, (p - 0.55) / 0.45)).toFixed(4));
    });
  }

  /* ───── вордмарк подвала раскрывается ───── */
  var wm = root.querySelector("[data-rg-wordmark]");
  if (wm) {
    var v = 0;
    sub(function () {
      var t = progress(wm.parentElement, "top bottom", "bottom bottom");
      v = lerp(v, t, .12);
      wm.style.setProperty("--wm", v.toFixed(4));
    });
  }

  if (reduce) { subs.forEach(function (fn) { fn(); }); return; }
  (function frame() { window.requestAnimationFrame(frame); subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); })();
})();
