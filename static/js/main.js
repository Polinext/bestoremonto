/* BESTOREMONTO — поведение интерфейса. Без зависимостей. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ───────── шапка ───────── */
  function initHeader() {
    var header = $('[data-header]');
    if (!header) return;
    var lastY = window.scrollY;
    var ticking = false;
    function update() {
      var y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 24);
      // прячем шапку при прокрутке вниз, показываем при прокрутке вверх
      var hide = y > 480 && y > lastY + 4 && !document.body.classList.contains('menu-open');
      if (y < lastY - 4 || y < 480) header.classList.remove('is-hidden');
      else if (hide) header.classList.add('is-hidden');
      lastY = y;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    update();
  }

  /* ───────── мобильное меню ───────── */
  function initMenu() {
    var menu = $('[data-menu]');
    var openBtn = $('[data-menu-open]');
    if (!menu || !openBtn) return;
    var closeBtn = $('[data-menu-close]', menu);
    var mainEl = $('main');

    function focusables() {
      return $$('a[href], button:not([disabled])', menu);
    }
    function open() {
      menu.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      document.documentElement.style.overflow = 'hidden';
      if (mainEl) mainEl.setAttribute('inert', '');
      closeBtn.focus();
    }
    function close(returnFocus) {
      menu.hidden = true;
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      document.documentElement.style.overflow = '';
      if (mainEl) mainEl.removeAttribute('inert');
      if (returnFocus !== false) openBtn.focus();
    }
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', function () { close(); });
    menu.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { close(); return; }
      if (ev.key !== 'Tab') return;
      var items = focusables();
      var first = items[0];
      var last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { close(false); }); });
    window.matchMedia('(min-width: 1100px)').addEventListener('change', function (mq) {
      if (mq.matches && !menu.hidden) close(false);
    });
  }

  /* ───────── появление при прокрутке ───────── */
  function initReveal() {
    var items = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window) || !items.length) return;
    document.documentElement.classList.add('reveal-ready');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) {
      // то, что уже на экране при загрузке, показываем сразу
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
      else io.observe(el);
    });
  }

  /* ───────── фильтры портфолио ───────── */
  function initFilters() {
    var catalog = $('[data-catalog]');
    if (!catalog) return;
    var form = $('[data-filters]', catalog);
    var cards = $$('[data-project]', catalog);
    var countEl = $('[data-result-count]', catalog);
    var empty = $('[data-empty]', catalog);
    var grid = $('[data-grid]', catalog);
    var resets = $$('[data-reset]', catalog);
    var toggle = $('[data-filters-toggle]', catalog);
    var activeCountEl = $('[data-active-count]', catalog);
    if (!form || !cards.length) return;

    var inputs = $$('input[type="checkbox"]', form);
    var groups = [];
    inputs.forEach(function (i) { if (groups.indexOf(i.name) === -1) groups.push(i.name); });

    function plural(n, one, few, many) {
      var m = n % 100;
      if (m >= 11 && m <= 19) return many;
      m = n % 10;
      if (m === 1) return one;
      if (m >= 2 && m <= 4) return few;
      return many;
    }

    function selection() {
      var sel = {};
      groups.forEach(function (g) {
        sel[g] = inputs.filter(function (i) { return i.name === g && i.checked; }).map(function (i) { return i.value; });
      });
      return sel;
    }

    // Внутри группы — «или», между группами — «и».
    function matches(card, sel, skipGroup) {
      return groups.every(function (g) {
        if (g === skipGroup || !sel[g].length) return true;
        return sel[g].indexOf(card.getAttribute('data-f-' + g)) !== -1;
      });
    }

    function apply(updateUrl) {
      var sel = selection();
      var shown = 0;
      cards.forEach(function (card) {
        var ok = matches(card, sel);
        card.hidden = !ok;
        if (ok) { shown += 1; card.classList.add('is-in'); }
      });

      // счётчики на чипах: сколько проектов будет, если добавить этот вариант
      inputs.forEach(function (input) {
        var n = cards.filter(function (card) {
          return matches(card, sel, input.name) && card.getAttribute('data-f-' + input.name) === input.value;
        }).length;
        var chip = input.closest('.chip');
        $('[data-count]', chip).textContent = n;
        chip.classList.toggle('is-empty', n === 0);
        chip.classList.toggle('is-checked', input.checked);
      });

      var active = inputs.filter(function (i) { return i.checked; }).length;
      countEl.textContent = shown
        ? (active ? 'Найдено: ' : '') + shown + ' ' + plural(shown, 'проект', 'проекта', 'проектов')
        : 'Проекты не найдены';
      empty.hidden = shown !== 0;
      grid.hidden = shown === 0;
      resets.forEach(function (b) { if (!b.closest('[data-empty]')) b.hidden = active === 0; });
      if (activeCountEl) activeCountEl.textContent = active ? String(active) : '';

      if (updateUrl) {
        var params = new URLSearchParams(window.location.search);
        groups.forEach(function (g) {
          if (sel[g].length) params.set(g, sel[g].join(','));
          else params.delete(g);
        });
        var qs = params.toString().replace(/%2C/g, ',');
        history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
      }
    }

    // состояние из адресной строки
    var params = new URLSearchParams(window.location.search);
    groups.forEach(function (g) {
      var values = (params.get(g) || '').split(',').filter(Boolean);
      inputs.forEach(function (i) { if (i.name === g && values.indexOf(i.value) !== -1) i.checked = true; });
    });

    form.addEventListener('change', function () { apply(true); });
    resets.forEach(function (btn) {
      btn.addEventListener('click', function () {
        inputs.forEach(function (i) { i.checked = false; });
        apply(true);
        (inputs[0] || form).focus();
      });
    });
    // визуальный фокус для браузеров без :has()
    inputs.forEach(function (input) {
      input.addEventListener('focus', function () { if (input.matches(':focus-visible')) input.closest('.chip').classList.add('is-focus'); });
      input.addEventListener('blur', function () { input.closest('.chip').classList.remove('is-focus'); });
    });
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        form.classList.toggle('is-open', open);
      });
    }
    apply(false);
  }

  /* ───────── галерея проекта ───────── */
  function initLightbox() {
    var dialog = $('[data-lightbox]');
    var buttons = $$('[data-lightbox-index]');
    if (!dialog || !buttons.length || typeof dialog.showModal !== 'function') return;
    var imgEl = $('[data-lb-img]', dialog);
    var capEl = $('[data-lb-caption]', dialog);
    var counter = $('[data-lb-counter]', dialog);
    var prevBtn = $('[data-lb-prev]', dialog);
    var nextBtn = $('[data-lb-next]', dialog);
    var index = 0;
    var opener = null;

    function show(i) {
      index = (i + buttons.length) % buttons.length;
      var b = buttons[index];
      imgEl.src = b.getAttribute('data-full');
      imgEl.alt = b.getAttribute('data-alt') || '';
      capEl.textContent = b.getAttribute('data-caption') || '';
      counter.textContent = (index + 1) + ' / ' + buttons.length;
      // заранее подгружаем соседние изображения
      [index + 1, index - 1].forEach(function (n) {
        var nb = buttons[(n + buttons.length) % buttons.length];
        (new Image()).src = nb.getAttribute('data-full');
      });
    }
    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () {
        opener = b;
        show(i);
        dialog.showModal();
        document.documentElement.style.overflow = 'hidden';
      });
    });
    var single = buttons.length < 2;
    prevBtn.hidden = single;
    nextBtn.hidden = single;
    prevBtn.addEventListener('click', function () { show(index - 1); });
    nextBtn.addEventListener('click', function () { show(index + 1); });
    $('[data-lb-close]', dialog).addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      document.documentElement.style.overflow = '';
      if (opener) opener.focus();
    });
    dialog.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') show(index - 1);
      if (ev.key === 'ArrowRight') show(index + 1);
    });
    // свайп на сенсорных экранах
    var startX = null;
    dialog.addEventListener('pointerdown', function (ev) { startX = ev.clientX; });
    dialog.addEventListener('pointerup', function (ev) {
      if (startX === null) return;
      var dx = ev.clientX - startX;
      if (Math.abs(dx) > 50 && !single) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* ───────── форма заявки (выводится, только если настроен endpoint) ───────── */
  function initLeadForm() {
    var form = $('[data-lead-form]');
    if (!form) return;
    var status = $('[data-form-status]', form);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.checkValidity()) {
        status.textContent = 'Заполните обязательные поля и подтвердите согласие.';
        form.reportValidity();
        return;
      }
      var button = $('button[type="submit"]', form);
      button.disabled = true;
      status.textContent = 'Отправляем…';
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        status.textContent = 'Заявка отправлена. Менеджер свяжется с вами.';
        form.reset();
      }).catch(function () {
        status.textContent = 'Не удалось отправить заявку. Позвоните нам или напишите в WhatsApp.';
      }).then(function () { button.disabled = false; });
    });
  }

  initHeader();
  initMenu();
  /* ───────── шкала этапов ───────── */
  function initSteps() {
    document.querySelectorAll("[data-steps]").forEach(function (root) {
      var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
      var panels = Array.prototype.slice.call(root.querySelectorAll('[role="tabpanel"]'));
      var rail = root.querySelector(".steps-rail");
      var fill = root.querySelector(".steps-rail-fill");
      var num = root.querySelector(".steps-n");
      if (!tabs.length) return;

      function select(index, focus) {
        tabs.forEach(function (tab, i) {
          var on = i === index;
          tab.setAttribute("aria-selected", on ? "true" : "false");
          tab.tabIndex = on ? 0 : -1;
          panels[i].hidden = !on;
        });
        /* Ширину заливки считаем по реальной геометрии: offsetLeft у точки
           отсчитывается от своей кнопки, а не от линии. */
        var dot = tabs[index].querySelector(".steps-dot");
        if (fill && dot && rail) {
          var railBox = rail.getBoundingClientRect();
          var dotBox = dot.getBoundingClientRect();
          fill.style.width = Math.max(0, dotBox.left + dotBox.width / 2 - railBox.left) + "px";
        }
        if (num) num.textContent = tabs[index].getAttribute("data-n");
        if (focus) tabs[index].focus();
        /* на узком экране подтягиваем активную вкладку в видимую часть полосы */
        if (focus && tabs[index].scrollIntoView) {
          tabs[index].scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }

      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { select(i, false); });
        tab.addEventListener("keydown", function (event) {
          var last = tabs.length - 1, next = null;
          if (event.key === "ArrowRight") next = i === last ? 0 : i + 1;
          else if (event.key === "ArrowLeft") next = i === 0 ? last : i - 1;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = last;
          if (next === null) return;
          event.preventDefault();
          select(next, true);
        });
      });

      select(0, false);
      window.addEventListener("resize", function () {
        var active = tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; });
        select(active < 0 ? 0 : active, false);
      });
    });
  }

  /* ───────── аккордеон «How a job goes» ─────────
     Открыт один шаг. Высота содержимого измеряется и анимируется, отступы
     карточки едут через --p, как описано в документе. */
  function initRlSteps() {
    var steps = Array.prototype.slice.call(document.querySelectorAll("[data-rl-step]"));
    if (!steps.length) return;
    var open = 0;

    function paint(animate) {
      steps.forEach(function (step, i) {
        var on = i === open;
        var clip = step.querySelector(".rl-clip");
        var row = step.querySelector(".rl-row");
        var target = on ? step.querySelector(".rl-detail").offsetHeight : 0;
        step.classList.toggle("is-open", on);
        row.setAttribute("aria-expanded", on ? "true" : "false");
        step.style.setProperty("--p", on ? 1 : 0);
        if (!animate) { clip.style.transition = "none"; }
        else { clip.style.transition = "height .45s " + getComputedStyle(document.documentElement).getPropertyValue("--ease"); }
        clip.style.height = target + "px";
      });
    }

    steps.forEach(function (step, i) {
      step.querySelector(".rl-row").addEventListener("click", function () {
        open = open === i ? -1 : i;
        paint(true);
      });
    });
    paint(false);
    window.requestAnimationFrame(function () { paint(false); });
    window.addEventListener("resize", function () { paint(false); });
    if ("ResizeObserver" in window) {
      steps.forEach(function (step) {
        new ResizeObserver(function () { paint(false); }).observe(step.querySelector(".rl-detail"));
      });
    }
  }

  initRlSteps();
  initSteps();
  initReveal();
  initFilters();
  initLightbox();
  initLeadForm();
})();
