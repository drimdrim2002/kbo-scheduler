/*
 * 화면 공통 — DOM 헬퍼, 포맷, 토스트, 대화상자, 파일 입출력, 포커스 보존 마운트.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI || (KBO.UI = {});

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** 위임 이벤트: on(root, 'click', '[data-act]', (e, el) => ...) */
  function on(root, type, selector, fn, opts) {
    const handler = (e) => {
      const el = e.target.closest ? e.target.closest(selector) : null;
      if (el && root.contains(el)) fn(e, el);
    };
    root.addEventListener(type, handler, opts);
    return () => root.removeEventListener(type, handler, opts);
  }

  // ───── 포맷 (NFR-6) ─────
  const fmt = {
    date: (d) => KBO.Dates.fmtDate(d),
    short: (d) => KBO.Dates.fmtShort(d),
    km: (v) => (v == null || !Number.isFinite(Number(v)) ? '-' : Number(v).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
    kmUnit: (v) => fmt.km(v) + 'km',
    int: (v) => (v == null ? '-' : Math.round(v).toLocaleString('ko-KR')),
    num1: (v) => (v == null || !Number.isFinite(v) ? '-' : (Math.round(v * 10) / 10).toLocaleString('ko-KR')),
    signed: (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + (f || fmt.num1)(Math.abs(v)),
    slot: (slot) => KBO.CalendarGen.slotLabel(slot),
    score: (s) => KBO.Score.scoreString(s)
  };

  // ───── 토스트 ─────
  let toastHost = null;
  function toast(message, kind, ms) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'k-toasts';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    const el = document.createElement('div');
    el.className = 'k-toast k-toast-' + (kind || 'info');
    const icon = { ok: '✔', bad: '✖', warn: '⚠', info: 'ℹ' }[kind || 'info'];
    el.innerHTML = '<span aria-hidden="true">' + icon + '</span> ' + esc(message);
    toastHost.appendChild(el);
    setTimeout(() => { el.classList.add('k-out'); setTimeout(() => el.remove(), 300); }, ms || 3200);
  }

  // ───── 대화상자 ─────
  /** dialog({ title, body (HTML), actions: [{label, value, kind}], wide }) → Promise<value|null> */
  function dialog(opts) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'k-dialog' + (opts.wide ? ' k-wide' : '');
      const actions = opts.actions || [{ label: '확인', value: true, kind: 'primary' }];
      d.innerHTML = '<form method="dialog"><h2 class="k-dialog-title">' + esc(opts.title || '') + '</h2><div class="k-dialog-body">' + (opts.body || '') + '</div><div class="k-dialog-actions">' +
        actions.map((a, i) => '<button class="k-btn ' + (a.kind ? 'k-btn-' + a.kind : '') + '" value="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></form>';
      document.body.appendChild(d);
      if (opts.onMount) opts.onMount(d);
      d.addEventListener('close', () => {
        const i = d.returnValue === '' ? -1 : Number(d.returnValue);
        const act = actions[i];
        const result = act ? (typeof act.value === 'function' ? act.value(d) : act.value) : null;
        d.remove();
        resolve(result == null ? null : result);
      });
      d.showModal();
    });
  }

  function confirmBox(title, message, okLabel, kind) {
    return dialog({ title, body: '<p>' + esc(message) + '</p>', actions: [{ label: '취소', value: false }, { label: okLabel || '확인', value: true, kind: kind || 'primary' }] }).then((v) => !!v);
  }

  function promptBox(title, label, value) {
    return dialog({
      title, body: '<label class="k-field"><span>' + esc(label) + '</span><input class="k-input" name="v" value="' + esc(value || '') + '" autofocus></label>',
      actions: [{ label: '취소', value: null }, { label: '확인', kind: 'primary', value: (d) => d.querySelector('input[name=v]').value }]
    });
  }

  // ───── 파일 입출력 ─────
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept || '.json,application/json';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, text: String(r.result) });
        r.onerror = () => resolve(null);
        r.readAsText(f, 'utf-8');
      };
      inp.click();
    });
  }

  /**
   * 포커스 보존 마운트: render()가 innerHTML을 바꿔도 [data-fk] 요소의 포커스·선택을 되살린다.
   * tags: 이 화면이 반응할 변경 태그(없으면 모든 변경)
   */
  function mount(el, app, render, tags) {
    const run = () => {
      if (!el.isConnected && el.ownerDocument && !el.ownerDocument.contains(el)) { /* 숨김 상태여도 렌더 */ }
      const active = document.activeElement;
      let key = null, selStart = null, selEnd = null, scroll = null;
      if (active && el.contains(active) && active.dataset && active.dataset.fk) {
        key = active.dataset.fk;
        try { selStart = active.selectionStart; selEnd = active.selectionEnd; } catch (e) { /* 무시 */ }
      }
      const scrollers = $$('[data-scroll-key]', el).map((s) => [s.dataset.scrollKey, s.scrollLeft, s.scrollTop]);
      render(el);
      for (const [k, l, t] of scrollers) { const s = el.querySelector('[data-scroll-key="' + k + '"]'); if (s) { s.scrollLeft = l; s.scrollTop = t; } }
      if (key) {
        const n = el.querySelector('[data-fk="' + CSS.escape(key) + '"]');
        if (n) { n.focus({ preventScroll: true }); try { if (selStart != null) n.setSelectionRange(selStart, selEnd); } catch (e) { /* 무시 */ } }
      }
      void scroll;
    };
    run();
    const off = app.subscribe((change) => {
      if (!tags || !change.tags || change.tags.has('all') || tags.some((t) => change.tags.has(t))) run();
    });
    return { refresh: run, destroy: off };
  }

  /** 아이콘 + 텍스트 상태 칩 (NFR-7: 색만으로 구분하지 않는다) */
  function stateChip(kind, text) {
    const icon = { ok: '✔', bad: '✖', warn: '⚠', info: 'ℹ', block: '⛔' }[kind] || '•';
    return '<span class="k-chip k-chip-' + kind + '"><span aria-hidden="true">' + icon + '</span> ' + esc(text) + '</span>';
  }

  function teamChip(team, extra) {
    if (!team) return '';
    return '<span class="k-team" style="--tc:' + esc(team.color || '#555') + '">' + esc(team.name) + (extra || '') + '</span>';
  }

  /** 대비 좋은 글자색 (WCAG) */
  function textOn(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return '#fff';
    const lin = (c) => { c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
    return L > 0.4 ? '#111' : '#fff';
  }

  Object.assign(UI, { esc, $, $$, on, fmt, toast, dialog, confirmBox, promptBox, download, pickFile, mount, stateChip, teamChip, textOn });
})();
