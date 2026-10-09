/* BESTOREMONTO — кинематографическая главная.
   Пружинный решатель, общий тикер, скролл-триггеры и побуквенные раскрытия.
   Перенесено из _reference/keld-template.html и адаптировано под содержимое сайта.
   Внешних зависимостей нет. Без JS страница остаётся читаемой (класс .js на html). */
(function () {
  "use strict";

  var scene = document.getElementById("cinema");
  if (!scene) return;

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────── easings ───────── */
  var easeOutExpo = function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var easeOutQuart = function (t) { return 1 - Math.pow(1 - t, 4); };
  var easeOutQuint = function (t) { return 1 - Math.pow(1 - t, 5); };
  var easeInOutSine = function (t) { return (1 - Math.cos(t * Math.PI)) / 2; };

  /* ───────── пружина ───────── */
  function Spring(from, config) {
    this.arr = Array.isArray(from);
    this.pos = this.arr ? from.slice() : [from];
    this.to = this.pos.slice();
    this.from = this.pos.slice();
    this.vel = this.pos.map(function () { return 0; });
    this.config = Object.assign({ tension: 170, friction: 26, mass: 1, precision: 0.01 }, config || {});
    this.done = true; this.elapsed = 0; this.accum = 0; this.delayLeft = 0;
  }
  Spring.prototype.set = function (value, opts) {
    opts = opts || {};
    var next = Array.isArray(value) ? value.slice() : [value];
    var same = next.length === this.to.length && next.every(function (n, i) { return n === this.to[i]; }, this);
    if (same && !opts.immediate) return;
    this.to = next;
    if (opts.immediate || REDUCED) {
      this.pos = this.to.slice(); this.vel.fill(0); this.done = true; return;
    }
    this.from = this.pos.slice();
    this.elapsed = 0; this.accum = 0;
    this.delayLeft = opts.delay || 0;
    this.done = false;
  };
  Spring.prototype.advance = function (dtRaw) {
    if (this.done) return false;
    var dt = Math.min(64, dtRaw), i;
    if (this.delayLeft > 0) {
      var use = Math.min(this.delayLeft, dt);
      this.delayLeft -= use; dt -= use;
      if (dt <= 0) return true;
    }
    var c = this.config;
    if (c.duration) {
      this.elapsed += dt;
      var t = Math.min(1, this.elapsed / c.duration);
      var eased = (c.easing || function (x) { return x; })(t);
      for (i = 0; i < this.pos.length; i += 1) this.pos[i] = this.from[i] + (this.to[i] - this.from[i]) * eased;
      if (t >= 1) this.done = true;
      return true;
    }
    this.accum += dt;
    var steps = Math.floor(this.accum);
    this.accum -= steps;
    for (var s = 0; s < steps; s += 1) {
      for (i = 0; i < this.pos.length; i += 1) {
        var springForce = -c.tension * 0.000001 * (this.pos[i] - this.to[i]);
        var dampingForce = -c.friction * 0.001 * this.vel[i];
        this.vel[i] += (springForce + dampingForce) / c.mass;
        this.pos[i] += this.vel[i];
      }
    }
    var rest = true;
    for (i = 0; i < this.pos.length; i += 1) {
      if (Math.abs(this.vel[i]) >= c.precision / 10 || Math.abs(this.pos[i] - this.to[i]) > c.precision) { rest = false; break; }
    }
    if (rest) { this.pos = this.to.slice(); this.vel.fill(0); this.done = true; }
    return true;
  };
  Spring.prototype.get = function () { return this.arr ? this.pos : this.pos[0]; };

  /* ───────── общий тикер ───────── */
  var anims = [], readers = [];
  function addAnim(springs, render) { anims.push({ springs: springs, render: render, dirty: true }); }
  function addReader(fn) { readers.push(fn); }

  /* ───────── скролл-триггер ───────── */
  function makeTrigger(el, start, end) {
    var startKey = start.split(" ").join("_"), endKey = end.split(" ").join("_");
    var visible = false, grace = 0, progress = 0;
    new IntersectionObserver(function (entries) {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) grace = 10;
    }).observe(el);
    return function () {
      if (!visible) { if (grace <= 0) return progress; grace -= 1; }
      var bb = el.getBoundingClientRect(), ch = window.innerHeight;
      var poses = {
        top_top: bb.top,
        center_top: bb.top + bb.height / 2,
        bottom_top: bb.bottom,
        top_bottom: bb.top - ch,
        center_bottom: bb.top + bb.height / 2 - ch,
        bottom_bottom: bb.bottom - ch,
        top_center: bb.top - ch / 2,
        center_center: bb.top + bb.height / 2 - ch / 2,
        bottom_center: bb.bottom - ch / 2
      };
      var a = poses[startKey], b = poses[endKey], len = Math.abs(a - b);
      if (!len) return progress;
      progress = Math.min(Math.max(0, 1 - (a + len) / len), 1);
      return progress;
    };
  }

  /* ───────── побуквенный движок ───────── */
  var SLIDE = { axis: "x", In: [1, 0, 0], Out: [0, -40, 12] };
  var RISE = { axis: "y", In: [1, 0, 0], Out: [0, 105, 12] };

  function split(host, clip) {
    var text = host.textContent;
    host.textContent = "";
    host.classList.add("letters");
    if (clip) host.classList.add("is-clip");
    var letters = [];
    text.split(" ").forEach(function (word) {
      var w = document.createElement("span");
      w.className = "let-word" + (clip ? " is-clip" : "");
      Array.prototype.forEach.call(word, function (ch) {
        var l = document.createElement("span");
        l.className = "let"; l.textContent = ch;
        w.appendChild(l); letters.push(l);
      });
      host.appendChild(w);
    });
    return letters;
  }

  function makeLetter(el, recipe, config) {
    var s = new Spring(recipe.Out.slice(), config);
    var item = {
      state: false,
      set: function (isIn, delay, immediate) {
        if (item.state === isIn && !immediate) return;
        item.state = isIn;
        s.set(isIn ? recipe.In.slice() : recipe.Out.slice(), { delay: delay || 0, immediate: !!immediate });
      }
    };
    addAnim([s], function () {
      el.style.opacity = s.pos[0];
      el.style.transform = recipe.axis === "x"
        ? "translateX(" + s.pos[1] + "px)"
        : "translateY(" + s.pos[1] + "%)";
      el.style.filter = s.pos[2] > 0.01 ? "blur(" + s.pos[2] + "px)" : "none";
    });
    return item;
  }

  var SETTLE = function (d) { return { duration: d, easing: easeOutExpo }; };
  var TIMING = {
    label: { stagger: 35, config: SETTLE(1500) },
    cta: { stagger: 12, config: SETTLE(800) },
    quote: { stagger: 7, config: SETTLE(1600) }
  };
  var SCROLL_LETTER = { tension: 170, friction: 26 };

  /* Раскрытие по строкам: буквы поднимаются из-под обрезки, когда блок виден. */
  function reveal(host, timing, clip, rootMargin) {
    var lines = Array.prototype.slice.call(host.querySelectorAll("[data-line]"));
    if (!lines.length) return { enable: function () {} };
    var all = [];
    lines.forEach(function (line) {
      split(line, clip !== false).forEach(function (el) {
        all.push(makeLetter(el, RISE, timing.config));
      });
    });
    var enabled = false, inView = false;
    function apply() {
      if (!enabled) { all.forEach(function (L) { L.set(false, 0, true); }); return; }
      if (inView) all.forEach(function (L, i) { L.set(true, i * timing.stagger); });
      else all.forEach(function (L) { L.set(false); });
    }
    new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      apply();
    }, { rootMargin: rootMargin || "0px" }).observe(host);
    return { enable: function (v) { if (enabled !== v) { enabled = v; apply(); } } };
  }

  /* Буквы, привязанные к прогрессу скролла: буква i из n внутри, пока progress > i/n. */
  function progressWords(hosts, config) {
    var all = [];
    hosts.forEach(function (h) {
      split(h, false).forEach(function (l) { all.push(makeLetter(l, SLIDE, config)); });
    });
    return function (p) {
      for (var i = 0; i < all.length; i += 1) all[i].set(p > i / all.length);
    };
  }

  /* ───────── таймлайн ───────── */
  var clamp01 = function (v) { return Math.min(1, Math.max(0, v)); };
  var span = function (p, r) { return clamp01((p - r[0]) / (r[1] - r[0])); };

  /* Фазы заданы в виewport-ах прокрутки трека, а не долями: так видно,
     сколько экранов длится каждая. Трек 1800vh, прокрутка под ним — 1700vh. */
  var TRACK_VH = 1342;
  var TRAVEL = TRACK_VH - 100;
  var at = function (vh) { return vh / TRAVEL; };
  /* Две паузы: слайд основателя держится 160vh (689→849), слайд услуг — 120vh
     (1018→1138). Обе короткие намеренно: длинная задержка читается не как приём,
     а как подвисшая страница. Чтобы и в паузе прокрутка давала отклик,
     фотография продолжает медленно наезжать — диапазоны *Drift длиннее
     соответствующей фазы ровно на паузу. Длину паузы меняют одним числом. */
  var PHASE = {
    intro:        [at(0),    at(520)],
    oneExit:      [at(104),  at(169)],
    twoEnter:     [at(169),  at(234)],
    twoExit:      [at(273),  at(338)],
    threeEnter:   [at(338),  at(403)],
    founder:      [at(520),  at(689)],
    founderDrift: [at(520),  at(849)],
    services:     [at(849),  at(1018)],
    servicesDrift:[at(849),  at(1138)],
    /* Звезда закрывает трек: разрастается на весь экран и передаёт
       эстафету секции «Наши услуги», которая идёт следом тем же цветом. */
    star:         [at(1138), at(1242)],
    /* Логотип проступает во второй половине разворота — когда ромб уже
       заполняет экран и цвет сцены стал сплошным. */
    mark:         [at(1190), at(1242)]
  };
  var GONE_AT = [PHASE.oneExit[1], PHASE.twoExit[1], PHASE.founder[1]];
  var EXIT_SHIFT = 2.5, EXIT_BLUR = 0.75;

  /* ───────── элементы сцены ───────── */
  var $ = function (id) { return document.getElementById(id); };
  var stage = scene.querySelector(".cin-stage");
  var art = $("cin-art");
  var canvas = $("cin-seq");
  var founderImg = $("cin-founder-img");
  var servicesImg = $("cin-services-img");
  var gridInner = $("cin-grid");
  var blocks = Array.prototype.slice.call(scene.querySelectorAll(".cin-block"));
  var exits = blocks.map(function (b) { return b.querySelector(".cin-exit"); });
  var descs = blocks.map(function (b) { return b.querySelector(".cin-desc"); });
  var founderLayer = $("cin-founder");
  var servicesLayer = $("cin-services");
  var star = $("cin-star");
  var mark = $("cin-mark");
  var starTint = $("cin-star-tint");

  var p = new Spring(0, { tension: 90, friction: 26 });
  var track = makeTrigger(scene, "top top", "bottom bottom");
  var trig2 = makeTrigger($("cin-trig-2"), "top top", "bottom bottom");
  var trig3 = makeTrigger($("cin-trig-3"), "top top", "bottom bottom");
  var trigF = makeTrigger($("cin-trig-founder"), "top top", "bottom bottom");

  var words2 = progressWords(Array.prototype.slice.call(exits[1].querySelectorAll(".cin-word")), SCROLL_LETTER);
  var words3 = progressWords(Array.prototype.slice.call(exits[2].querySelectorAll(".cin-word")), SCROLL_LETTER);
  var founderName = progressWords([founderLayer.querySelector(".cin-founder-name")], SCROLL_LETTER);

  /* Первый блок: буквы выезжают после появления страницы. */
  var introGroups = Array.prototype.slice.call(exits[0].querySelectorAll(".cin-word")).map(function (el) {
    var letters = split(el, false).map(function (l) {
      return makeLetter(l, SLIDE, { duration: 750, easing: easeOutQuart });
    });
    return { letters: letters, stagger: 750 / letters.length };
  });

  var founderLead = reveal($("cin-founder-lead"), TIMING.label);
  var founderFoot = reveal($("cin-founder-foot"), TIMING.label);

  /* Счётчики: цифры набегают на размытом падающем барабане. */
  var stats = Array.prototype.slice.call(scene.querySelectorAll(".cin-stat")).map(function (el) {
    var value = parseFloat(el.getAttribute("data-value"));
    var drum = el.querySelector(".cin-drum");
    var suffix = el.getAttribute("data-suffix") || "";
    var s = new Spring(0, { duration: 2200, easing: easeOutQuint });
    addAnim([s], function () {
      var n = s.get(), rest = 1 - n / value;
      drum.style.filter = "blur(" + rest * 0.5 + "rem)";
      drum.style.transform = "translate3d(0," + rest * 1.25 + "rem,0)";
      drum.textContent = Math.floor(n).toLocaleString("ru-RU") + suffix;
    });
    return { value: value, s: s };
  });

  /* ───────── покадровое применение ───────── */
  function apply(v) {
    if (art) art.style.opacity = 1 - span(v, PHASE.founder);
    gridInner.style.opacity = 1 - span(v, PHASE.intro);
    gridInner.style.visibility = span(v, PHASE.intro) < 1 ? "visible" : "hidden";

    for (var i = 0; i < 3; i += 1) {
      blocks[i].style.visibility = v < GONE_AT[i] ? "visible" : "hidden";
    }
    descs[0].style.opacity = 1 - span(v, PHASE.oneExit);
    descs[1].style.opacity = span(v, PHASE.twoEnter) * (1 - span(v, PHASE.twoExit));
    descs[2].style.opacity = span(v, PHASE.threeEnter);
    blocks[2].style.opacity = 1 - span(v, PHASE.founder);

    [[0, PHASE.oneExit], [1, PHASE.twoExit]].forEach(function (pair) {
      var k = easeInOutSine(span(v, pair[1])), el = exits[pair[0]];
      el.style.opacity = 1 - k;
      el.style.transform = "translate3d(" + -EXIT_SHIFT * k + "rem,0,0)";
      el.style.filter = k > 0 ? "blur(" + EXIT_BLUR * k + "rem)" : "none";
    });

    founderLayer.style.transform = "translate3d(0," + (1 - span(v, PHASE.founder)) * 100 + "%,0)";
    servicesLayer.style.clipPath = "inset(" + (1 - span(v, PHASE.services)) * 100 + "% 0 0 0)";
    /* Оба интерьера оседают с небольшого наезда — тот же параллакс, что в референсе. */
    if (founderImg) founderImg.style.transform = "scale(" + (1.12 - 0.12 * span(v, PHASE.founderDrift)) + ")";
    if (servicesImg) servicesImg.style.transform = "scale(" + (1.12 - 0.12 * span(v, PHASE.servicesDrift)) + ")";

    star.style.transform = "scale(" + (0.04 + Math.pow(span(v, PHASE.star), 5) * 16) + ")";
    /* Размер растёт по пятой степени — экран закрывается рывком в самом конце.
       Заливка линейна, поэтому её ускоряем: к 55% разворота ромб уже тёмный,
       иначе на весь экран успевает мелькнуть светлое пятно. */
    starTint.setAttribute("opacity", clamp01(span(v, PHASE.star) / 0.55));
    if (mark) mark.style.opacity = span(v, PHASE.mark);

  }
  addAnim([p], function () { apply(p.get()); });

  /* ───────── флаги: переключаются, а не скрабятся ───────── */
  var flags = {};
  function applyFlags(next) {
    if (flags.founderLead !== next.founderLead) founderLead.enable(next.founderLead);
    if (flags.founderFoot !== next.founderFoot) founderFoot.enable(next.founderFoot);
    if (flags.stats !== next.stats) {
      stats.forEach(function (st) {
        if (next.stats) st.s.set(st.value);
        else st.s.set(0, { immediate: true });
      });
    }
    flags = next;
  }

  var lastRaw = -1;
  addReader(function () {
    var raw = track();
    if (raw !== lastRaw) {
      lastRaw = raw;
      p.set(raw);
      applyFlags({
        founderLead: raw >= PHASE.founder[0],
        founderFoot: span(raw, PHASE.founder) >= 0.9,
        stats: raw >= PHASE.services[0]
      });
    }
    words2(trig2());
    words3(trig3());
    founderName(trigF());
  });

  /* ───────── раскрытия вне трека ───────── */
  Array.prototype.forEach.call(document.querySelectorAll("[data-reveal]"), function (host) {
    var kind = host.getAttribute("data-reveal");
    var ctl = reveal(host, TIMING[kind] || TIMING.label, host.getAttribute("data-clip") !== "false",
      host.getAttribute("data-margin") || "0px 0px -10% 0px");
    ctl.enable(true);
  });

  /* ───────── покадровый пролёт ─────────
     Кадры грузятся и декодируются пачками по шесть и рисуются на canvas по скроллу.
     Пока кадр не пришёл, берётся ближайший загруженный; под canvas лежит постер,
     поэтому первый экран виден сразу и без JS. */
  var drawFrame = null;
  if (canvas) {
    /* Один набор кадров вместо двух: так в выгрузке 53 файла вместо 315,
       и веб-загрузчик GitHub (не больше 100 файлов за раз) в них укладывается.
       Кадры взяты каждый четвёртый из исходных 210. */
    var tier = { count: 53, width: 1920, height: 1080 };
    var base = canvas.getAttribute("data-base");
    canvas.width = tier.width; canvas.height = tier.height;
    var ctx = canvas.getContext("2d");
    var frames = new Array(tier.count).fill(null);
    var painted = -1, failed = 0;

    var nearest = function (index) {
      for (var step = 0; step < tier.count; step += 1) {
        var im = frames[index - step] || frames[index + step];
        if (im) return im;
      }
      return null;
    };
    drawFrame = function (force) {
      var index = Math.min(tier.count - 1, Math.floor(span(p.get(), PHASE.intro) * tier.count));
      if (!force && index === painted) return;
      var im = nearest(index);
      if (!im) return;
      ctx.drawImage(im, 0, 0, tier.width, tier.height);
      painted = index;
      canvas.classList.add("is-ready");
    };

    var cursor = 0;
    var pump = function () {
      var index = cursor; cursor += 1;
      if (index >= tier.count) return Promise.resolve();
      var image = new Image();
      image.decoding = "async";
      image.src = base + "/" + String(index).padStart(3, "0") + ".webp";
      return image.decode().then(function () { frames[index] = image; drawFrame(true); },
                                 function () { failed += 1; })
        .then(pump);
    };
    for (var c = 0; c < 6; c += 1) pump();
  }

  /* ───────── старт ───────── */
  stage.classList.add("is-live");
  window.setTimeout(function () {
    introGroups.forEach(function (g) {
      g.letters.forEach(function (L, i) { L.set(true, i * g.stagger); });
    });
  }, 120);

  var last = performance.now();
  (function frame(time) {
    window.requestAnimationFrame(frame);
    var dt = Math.min(64, Math.max(0, time - last));
    last = time;
    for (var i = 0; i < readers.length; i += 1) {
      try { readers[i](); } catch (err) { console.error(err); }
    }
    for (var j = 0; j < anims.length; j += 1) {
      var a = anims[j], moved = false;
      for (var k = 0; k < a.springs.length; k += 1) if (a.springs[k].advance(dt)) moved = true;
      if (moved || a.dirty) {
        try { a.render(); } catch (err2) { console.error(err2); }
        a.dirty = moved;
      }
    }
    if (drawFrame && !document.hidden) {
      try { drawFrame(false); } catch (err3) { console.error(err3); }
    }
  })(last);
})();
