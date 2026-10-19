/*
 * alt-c 편성 워크북 — 시트 격자 부품.
 * 열 문자·행 번호·고정 머리글, 선택 셀 테두리, 방향키 이동, Enter/F2 편집·Esc 취소, 셀 바로 검증,
 * 오류 셀 모서리 표식 + 메모 풍선, 행 머리글·오른쪽 클릭 메뉴.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const esc = WB.esc;

  /**
   * spec = {
   *   key, sheet, cols:[{label, w, cls, sortable, sortDir, tag, title}], group:[{text, span, cls}],
   *   fieldHead: true, rows: n, rowH, frozen: n, fill: n,
   *   cell(r,c) → {t|h, cls, mk:{level,title,text}, title},
   *   rowCls(r), rowNo(r), edit:{can(r,c), text(r,c), validate(r,c,text), commit(r,c,text)},
   *   onSelect(r,c), onActivate(r,c), menu(r,c), onHead(c), readOnly, tableCls
   * }
   */
  function mount(host, spec) {
    const ui = WB.ui;
    ui.sel = ui.sel || {};
    ui.scroll = ui.scroll || {};
    const key = spec.key;
    const prev = host.querySelector('.scroller[data-key="' + key + '"]');
    const hadFocus = prev && (prev === document.activeElement || prev.contains(document.activeElement)) || ui.gridFocus === key;
    if (prev) ui.scroll[key] = { t: prev.scrollTop, l: prev.scrollLeft };
    const sel = ui.sel[key] || (ui.sel[key] = { r: 0, c: 0 });
    if (sel.r >= spec.rows) sel.r = Math.max(0, spec.rows - 1);
    if (sel.c >= spec.cols.length) sel.c = Math.max(0, spec.cols.length - 1);

    const rnW = spec.rnW || 38;
    const widths = spec.cols.map((c) => c.w || 90);
    const fill = spec.fill == null ? 3 : spec.fill;
    const total = rnW + widths.reduce((a, b) => a + b, 0) + fill * 72;
    const lefts = [];
    let acc = rnW;
    for (let i = 0; i < widths.length; i++) { lefts.push(acc); acc += widths[i]; }
    const frozen = spec.frozen || 0;
    const rowH = spec.rowH || 22;
    const fz = (c) => (c < frozen ? ' fz" style="left:' + lefts[c] + 'px' : '');

    let h = '<table class="g ' + (spec.tableCls || '') + '" style="width:max(100%, ' + total + 'px)"><colgroup><col style="width:' + rnW + 'px">';
    for (const w of widths) h += '<col style="width:' + w + 'px">';
    for (let i = 0; i < fill; i++) h += '<col style="width:72px">';
    h += '<col></colgroup><thead><tr class="cl"><th class="rn" aria-hidden="true"></th>';
    for (let c = 0; c < spec.cols.length; c++) h += '<th data-hc="' + c + '" class="' + fz(c) + '">' + WB.colName(c) + '</th>';
    for (let i = 0; i < fill; i++) h += '<th>' + WB.colName(spec.cols.length + i) + '</th>';
    h += '<th class="fill"></th></tr>';
    if (spec.group) {
      h += '<tr class="gh"><th class="rn"></th>';
      let c = 0;
      for (const g of spec.group) { h += '<th colspan="' + g.span + '" class="' + (g.cls || '') + (c < frozen ? ' fz" style="left:' + lefts[c] + 'px' : '') + '">' + (g.h || esc(g.text || '')) + '</th>'; c += g.span; }
      h += '<th colspan="' + (fill + 1) + '" class="fill"></th></tr>';
    }
    if (spec.fieldHead !== false) {
      h += '<tr class="fh"><th class="rn">' + (spec.headNo || 1) + '</th>';
      spec.cols.forEach((col, c) => {
        h += '<th data-fc="' + c + '" class="' + (col.hcls || '') + (col.sortable ? ' sortable' : '') + fz(c) + '"' + (col.title ? ' title="' + esc(col.title) + '"' : '') + '>' + (col.h || esc(col.label)) +
          (col.tag ? '<span class="tag ' + (col.tag === '채점' ? 'tag-s' : 'tag-r') + '">' + esc(col.tag) + '</span>' : '') +
          (col.sortDir ? '<span class="srt">' + (col.sortDir === 'asc' ? '▲' : '▼') + '</span>' : '') + '</th>';
      });
      for (let i = 0; i < fill; i++) h += '<th></th>';
      h += '<th class="fill"></th></tr>';
    }
    h += '</thead><tbody>';
    for (let r = 0; r < spec.rows; r++) {
      const rc = spec.rowCls ? spec.rowCls(r) : '';
      h += '<tr data-r="' + r + '" class="' + (rc || '') + '"' + (rowH !== 22 ? ' style="height:' + rowH + 'px"' : '') + '><td class="rn" data-rn="' + r + '">' + (spec.rowNo ? spec.rowNo(r) : (r + 2)) + '</td>';
      for (let c = 0; c < spec.cols.length; c++) {
        const x = spec.cell(r, c) || {};
        const mk = x.mk ? ' mk-' + x.mk.level : '';
        const isF = c < frozen;
        const cls = (spec.cols[c].cls || '') + ' ' + (x.cls || '') + mk + (isF ? ' fz' : '');
        const sty = [];
        if (isF) sty.push('left:' + lefts[c] + 'px');
        if (rowH !== 22) sty.push('height:' + rowH + 'px');
        h += '<td data-c="' + c + '" class="' + cls + '"' + (sty.length ? ' style="' + sty.join(';') + '"' : '') + (x.mk ? ' data-mk="1"' : '') + (x.title ? ' title="' + esc(x.title) + '"' : '') + '>' + (x.h != null ? x.h : esc(x.t == null ? '' : x.t)) + '</td>';
      }
      for (let i = 0; i < fill; i++) h += '<td class="empty"></td>';
      h += '<td class="fill"></td></tr>';
    }
    if (spec.footRows) h += spec.footRows();
    h += '</tbody></table>';

    const sc = document.createElement('div');
    sc.className = 'scroller';
    sc.dataset.key = key;
    sc.tabIndex = 0;
    sc.setAttribute('role', 'grid');
    sc.setAttribute('aria-label', (spec.sheet || '') + ' 시트');
    sc.innerHTML = h;
    host.innerHTML = '';
    if (spec.before) host.insertAdjacentHTML('beforeend', spec.before);
    host.appendChild(sc);
    if (spec.after) host.insertAdjacentHTML('beforeend', spec.after);
    const st = ui.scroll[key];
    if (st) { sc.scrollTop = st.t; sc.scrollLeft = st.l; }
    sc.addEventListener('scroll', () => { ui.scroll[key] = { t: sc.scrollTop, l: sc.scrollLeft }; WB.hideTip(); if (g.editor) placeEditor(); });

    const g = { spec, sc, sel, editor: null, rowH };
    host._grid = g;

    function td(r, c) { const tr = sc.querySelector('tr[data-r="' + r + '"]'); return tr ? tr.children[c + 1] : null; }
    g.td = td;
    function paintSel() {
      sc.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel'));
      sc.querySelectorAll('.c-sel').forEach((e) => e.classList.remove('c-sel'));
      sc.querySelectorAll('.r-sel').forEach((e) => e.classList.remove('r-sel'));
      const cell = td(sel.r, sel.c);
      if (cell) cell.classList.add('sel');
      const hc = sc.querySelector('th[data-hc="' + sel.c + '"]'); if (hc) hc.classList.add('c-sel');
      const fc = sc.querySelector('th[data-fc="' + sel.c + '"]'); if (fc) fc.classList.add('c-sel');
      const rn = sc.querySelector('td[data-rn="' + sel.r + '"]'); if (rn) rn.classList.add('r-sel');
    }
    function ensureVisible() {
      const cell = td(sel.r, sel.c);
      if (!cell) return;
      const head = sc.querySelector('thead');
      const hh = head ? head.offsetHeight : 0;
      const top = cell.offsetTop, bot = top + cell.offsetHeight;
      if (top - hh < sc.scrollTop) sc.scrollTop = Math.max(0, top - hh);
      else if (bot > sc.scrollTop + sc.clientHeight) sc.scrollTop = bot - sc.clientHeight;
      if (sel.c >= frozen) {
        const fzW = frozen ? lefts[frozen - 1] + widths[frozen - 1] : rnW;
        const l = cell.offsetLeft, rr = l + cell.offsetWidth;
        if (l - fzW < sc.scrollLeft) sc.scrollLeft = Math.max(0, l - fzW);
        else if (rr > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = rr - sc.clientWidth;
      }
    }
    function select(r, c, opts) {
      r = Math.max(0, Math.min(spec.rows - 1, r));
      c = Math.max(0, Math.min(spec.cols.length - 1, c));
      sel.r = r; sel.c = c;
      paintSel();
      ensureVisible();
      if (spec.onSelect && !(opts && opts.silent)) spec.onSelect(r, c);
    }
    g.select = select;
    g.paintSel = paintSel;

    // ── 편집 ──
    function canEdit(r, c) { return !spec.readOnly && spec.edit && spec.edit.can && spec.edit.can(r, c); }
    function placeEditor() {
      const cell = td(sel.r, sel.c);
      if (!cell || !g.editor) return;
      const ed = g.editor;
      ed.style.left = (cell.offsetLeft - 1) + 'px';
      ed.style.top = (cell.offsetTop - 1) + 'px';
      ed.style.width = Math.max(cell.offsetWidth + 2, 120) + 'px';
      ed.style.height = (cell.offsetHeight + 2) + 'px';
      validateLive();
    }
    function validateLive() {
      if (!g.editor) return;
      const res = spec.edit.validate ? spec.edit.validate(sel.r, sel.c, g.editor.value) : null;
      g.editor.classList.toggle('bad', !!(res && res.level === 'error'));
      const cell = td(sel.r, sel.c);
      if (res && cell) {
        const rr = g.editor.getBoundingClientRect();
        WB.tip(rr, res.level === 'error' ? '입력 오류' : '확인 필요', res.msg, res.level);
      } else WB.hideTip();
      if (spec.edit.onLive) spec.edit.onLive(sel.r, sel.c, g.editor.value, res);
    }
    function startEdit(initial) {
      if (!canEdit(sel.r, sel.c)) {
        if (spec.readOnly && WB.locked()) WB.toast('엔진 실행 중에는 입력이 잠깁니다.', 'lock');
        return false;
      }
      const ed = document.createElement('input');
      ed.className = 'editor';
      ed.setAttribute('aria-label', '셀 편집');
      ed.value = initial != null ? initial : (spec.edit.text ? spec.edit.text(sel.r, sel.c) : '');
      sc.appendChild(ed);
      g.editor = ed;
      WB.ui.editing = true;
      WB.renderStatus();
      placeEditor();
      ed.focus();
      const n = ed.value.length; ed.setSelectionRange(n, n);
      let done = false;
      ed.addEventListener('input', validateLive);
      ed.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault(); e.stopPropagation();
          done = true; finish(true, e.key === 'Tab' ? (e.shiftKey ? [0, -1] : [0, 1]) : (e.shiftKey ? [-1, 0] : [1, 0]));
        } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done = true; finish(false); }
      });
      ed.addEventListener('blur', () => { if (!done) { done = true; finish(true, null, true); } });
      return true;
    }
    g.startEdit = startEdit;
    function finish(commit, move, fromBlur) {
      const ed = g.editor;
      if (!ed) return;
      const text = ed.value;
      g.editor = null;
      ed.remove();
      WB.hideTip();
      WB.ui.editing = false;
      const r = sel.r, c = sel.c;
      if (move) { sel.r = Math.max(0, Math.min(spec.rows - 1, sel.r + move[0])); sel.c = Math.max(0, Math.min(spec.cols.length - 1, sel.c + move[1])); }
      if (!fromBlur) WB.ui.gridFocus = key;
      if (commit && spec.edit.commit) {
        const orig = spec.edit.text ? spec.edit.text(r, c) : null;
        if (orig !== text) { spec.edit.commit(r, c, text); return; }
      }
      WB.renderStatus();
      if (!fromBlur) { sc.focus({ preventScroll: true }); select(sel.r, sel.c); }
    }

    // ── 마우스 ──
    sc.addEventListener('mousedown', (e) => {
      const cell = e.target.closest('td[data-c]');
      if (cell && !e.target.closest('a,button,input,select')) {
        const r = +cell.parentNode.dataset.r, c = +cell.dataset.c;
        if (g.editor) return;
        if (e.button === 2 && r === sel.r && c === sel.c) return;
        select(r, c);
        WB.ui.gridFocus = key;
        setTimeout(() => sc.focus({ preventScroll: true }), 0);
      } else if (e.target.closest('td.rn[data-rn]')) {
        const r = +e.target.closest('td.rn').dataset.rn;
        select(r, sel.c);
      }
    });
    sc.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('td[data-c]');
      if (!cell) return;
      if (!startEdit() && spec.onActivate) spec.onActivate(sel.r, sel.c);
    });
    sc.addEventListener('click', (e) => {
      const fh = e.target.closest('th[data-fc]');
      if (fh && spec.onHead) spec.onHead(+fh.dataset.fc);
    });
    sc.addEventListener('contextmenu', (e) => {
      if (!spec.menu) return;
      const cell = e.target.closest('td[data-c], td.rn[data-rn]');
      if (!cell) return;
      e.preventDefault();
      const r = +cell.parentNode.dataset.r;
      const c = cell.dataset.c != null ? +cell.dataset.c : sel.c;
      select(r, c);
      const items = spec.menu(r, c, !cell.dataset.c);
      if (items && items.length) WB.contextMenu(e.clientX, e.clientY, items);
    });
    sc.addEventListener('mouseover', (e) => {
      if (g.editor) return;
      const cell = e.target.closest('td[data-mk]');
      if (!cell) return;
      const r = +cell.parentNode.dataset.r, c = +cell.dataset.c;
      const x = spec.cell(r, c);
      if (x && x.mk) WB.tip(cell.getBoundingClientRect(), x.mk.title, x.mk.text, x.mk.level);
    });
    sc.addEventListener('mouseout', (e) => { if (!g.editor && e.target.closest('td[data-mk]')) WB.hideTip(); });

    // ── 키보드 ──
    sc.addEventListener('keydown', (e) => {
      if (g.editor || e.target !== sc) return;
      if (e.isComposing) return;
      const k = e.key;
      const page = Math.max(1, Math.floor((sc.clientHeight - 60) / rowH));
      const mod = e.ctrlKey || e.metaKey;
      if (k === 'ArrowDown') { e.preventDefault(); select(mod ? spec.rows - 1 : sel.r + 1, sel.c); }
      else if (k === 'ArrowUp') { e.preventDefault(); select(mod ? 0 : sel.r - 1, sel.c); }
      else if (k === 'ArrowRight') { e.preventDefault(); select(sel.r, mod ? spec.cols.length - 1 : sel.c + 1); }
      else if (k === 'ArrowLeft') { e.preventDefault(); select(sel.r, mod ? 0 : sel.c - 1); }
      else if (k === 'PageDown') { e.preventDefault(); select(sel.r + page, sel.c); }
      else if (k === 'PageUp') { e.preventDefault(); select(sel.r - page, sel.c); }
      else if (k === 'Home') { e.preventDefault(); select(mod ? 0 : sel.r, 0); }
      else if (k === 'End') { e.preventDefault(); select(mod ? spec.rows - 1 : sel.r, spec.cols.length - 1); }
      else if (k === 'Tab') { e.preventDefault(); select(sel.r, sel.c + (e.shiftKey ? -1 : 1)); }
      else if (k === 'Enter') { e.preventDefault(); if (e.shiftKey) select(sel.r - 1, sel.c); else if (!startEdit() && spec.onActivate) spec.onActivate(sel.r, sel.c); }
      else if (k === 'F2') { e.preventDefault(); startEdit(); }
      else if ((k === 'Delete' || k === 'Backspace') && canEdit(sel.r, sel.c)) { e.preventDefault(); spec.edit.commit(sel.r, sel.c, ''); }
      else if ((k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) && spec.menu) {
        e.preventDefault();
        const cell = td(sel.r, sel.c); const rr = cell.getBoundingClientRect();
        WB.contextMenu(rr.left + 8, rr.bottom, spec.menu(sel.r, sel.c, false));
      } else if (k === 'Escape') { WB.hideTip(); }
      else if (k.length === 1 && !mod && !e.altKey && canEdit(sel.r, sel.c)) { e.preventDefault(); startEdit(k); }
    });
    sc.addEventListener('focus', () => { WB.ui.gridFocus = key; });

    paintSel();
    if (ui.pendingCell) {
      const m = /^([A-Z]+)(\d+)$/.exec(ui.pendingCell);
      ui.pendingCell = null;
      if (m) { const c = WB.colIndex(m[1]); const r = +m[2] - (spec.fieldHead === false ? 1 : 2) - (spec.rowOffset || 0); select(r, c); }
    } else if (spec.ensure !== false) {
      if (!st) ensureVisible();
    }
    if (ui.flash && ui.flash.key === key) {
      const tr = sc.querySelector('tr[data-r="' + ui.flash.r + '"]');
      if (tr) tr.classList.add('flash');
      ui.flash = null;
    }
    if (hadFocus) sc.focus({ preventScroll: true });
    return g;
  }

  /** 시트 주소: 시리즈!B12 */
  function addr(sheet, r, c, fieldHead) { return sheet + '!' + WB.colName(c) + (r + (fieldHead === false ? 1 : 2)); }

  WB.Grid = { mount, addr };
})();
