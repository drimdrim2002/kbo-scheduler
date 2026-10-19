/*
 * alt-d — 한 건 편집 표 (FR-X8).
 * 클릭: 행 선택 · 더블클릭/Enter/F2: 셀 편집 · 입력 즉시 검증(셀 옆 오류) · Enter 확정 · Esc 취소 · ↑↓ 행 이동.
 * 행 동작(위에 삽입·아래 삽입·삭제)은 선택한 행 끝에 나타난다. 모든 변경은 실행 취소 대상이다.
 */
(function () {
  'use strict';
  const SP = window.SP;
  const esc = SP.esc;
  const ui = SP.ui;
  const GRIDS = {};
  SP.grids = GRIDS;

  /**
   * cfg: { id, cols: [{ key, label, cls, w, edit, get(row,i) → 표시 HTML, raw(row,i) → 편집 문자열, validate(v,i) → {error, fix, warn}, commit(i, v) }],
   *        rows, caption, note(i) → 셀 경고 {key: msg}, onInsert(i, where), onDelete(i), height }
   */
  SP.grid = function (cfg) {
    GRIDS[cfg.id] = cfg;
    const sel = ui.row[cfg.id];
    const ed = ui.edit && ui.edit.table === cfg.id ? ui.edit : null;
    let h = '<div class="sp-grid-wrap" data-sk="grid-' + cfg.id + '" tabindex="0" data-grid="' + cfg.id + '" aria-label="' + esc(cfg.label || cfg.id) + ' 표, 화살표로 행 이동, Enter로 편집">';
    h += '<table class="sp-table sp-grid" aria-rowcount="' + cfg.rows.length + '"><thead><tr><th class="sp-rn" scope="col">행</th>';
    for (const c of cfg.cols) h += '<th scope="col" class="' + (c.cls || '') + '"' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + esc(c.label) + (c.req ? '<span class="sp-req" title="필수">*</span>' : '') + '</th>';
    h += '<th class="sp-rowact-h" scope="col"><span class="sp-sr">행 동작</span></th></tr></thead><tbody>';
    cfg.rows.forEach((row, i) => {
      const isSel = sel === i;
      const notes = cfg.note ? cfg.note(i, row) || {} : {};
      const flash = ui.flash === 'row-' + cfg.id + '-' + i;
      h += '<tr data-row="' + i + '" class="' + (isSel ? 'sp-sel' : '') + (flash ? ' sp-flash' : '') + (row.__new ? ' sp-new' : '') + '"' + (isSel ? ' aria-selected="true"' : '') + (isSel && ui.scrollRow === cfg.id ? ' data-scroll-into="1"' : '') + '>';
      h += '<th scope="row" class="sp-rn" data-act="gridSel" data-arg="' + cfg.id + ':' + i + '">' + (i + 1) + '</th>';
      for (const c of cfg.cols) {
        const editing = ed && ed.row === i && ed.key === c.key;
        const warn = notes[c.key];
        if (editing) {
          const v = SP.validateEdit(cfg, c, ed.value, i);
          h += '<td class="sp-editing ' + (c.cls || '') + (v.error ? ' sp-cell-bad' : '') + '"><input class="sp-cell-input" data-fk="cell-edit" data-edit-input="1" value="' + esc(ed.value) + '" aria-label="' + esc(c.label) + ' 편집" aria-invalid="' + !!v.error + '" aria-describedby="cell-msg">' +
            '<div class="sp-cell-msg' + (v.error ? ' sp-cell-msg-bad' : v.warn ? ' sp-cell-msg-warn' : '') + '" id="cell-msg" role="alert">' + SP.cellMsgHtml(v) + '</div></td>';
        } else {
          h += '<td class="' + (c.cls || '') + (c.edit ? ' sp-ed' : '') + (warn ? ' sp-cell-warn' : '') + '" data-cell="' + cfg.id + ':' + i + ':' + c.key + '"' + (warn ? ' title="' + esc(warn) + '"' : '') + '>' + c.get(row, i) + (warn ? ' <span class="sp-ic sp-ic-warn" aria-label="경고: ' + esc(warn) + '">⚠</span>' : '') + '</td>';
        }
      }
      h += '<td class="sp-rowact">' + (isSel && !SP.isRunning() ? SP.btn('gridIns', '↑ 위에 삽입', { arg: cfg.id + ':' + i + ':above', cls: 'sp-mini' }) + SP.btn('gridIns', '↓ 아래 삽입', { arg: cfg.id + ':' + i + ':below', cls: 'sp-mini' }) + SP.btn('gridDel', '삭제', { arg: cfg.id + ':' + i, cls: 'sp-mini sp-mini-bad' }) : '') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    ui.scrollRow = null;
    return h;
  };

  SP.validateEdit = function (cfg, col, value, i) {
    if (!col.validate) return {};
    try { return col.validate(value, i) || {}; } catch (e) { return { error: String(e.message || e) }; }
  };
  SP.cellMsgHtml = function (v) {
    if (v.error) return '<span aria-hidden="true">✖</span> ' + esc(v.error) + (v.fix != null ? ' <button type="button" class="sp-link" data-act="editFix" data-arg="' + esc(v.fix) + '">' + esc(v.fixLabel || ('\'' + v.fix + '\'(으)로 고치기')) + '</button>' : '');
    if (v.warn) return '<span aria-hidden="true">⚠</span> ' + esc(v.warn);
    return '<span aria-hidden="true">↵</span> Enter 확정 · Esc 취소';
  };

  function locked() {
    if (SP.isRunning()) { SP.toast('엔진 실행 중에는 입력을 바꿀 수 없습니다. 먼저 중지하세요.', 'warn'); return true; }
    return false;
  }

  SP.startEdit = function (table, row, key, initial) {
    if (locked()) return;
    const cfg = GRIDS[table];
    if (!cfg) return;
    const col = cfg.cols.find((c) => c.key === key && c.edit);
    if (!col) return;
    ui.row[table] = row;
    ui.edit = { table, row, key, value: initial != null ? initial : col.raw(cfg.rows[row], row) };
    SP.render();
  };
  SP.commitEdit = function () {
    const ed = ui.edit;
    if (!ed) return;
    const cfg = GRIDS[ed.table];
    const col = cfg && cfg.cols.find((c) => c.key === ed.key);
    if (!col) { ui.edit = null; SP.render(); return; }
    const v = SP.validateEdit(cfg, col, ed.value, ed.row);
    if (v.error) { SP.render(); return false; }
    const before = col.raw(cfg.rows[ed.row], ed.row);
    ui.edit = null;
    if (String(before) !== String(ed.value).trim()) col.commit(ed.row, String(ed.value).trim());
    else SP.render();
    return true;
  };

  SP.act.gridSel = (el) => { const [t, r] = el.dataset.arg.split(':'); ui.row[t] = Number(r); if (ui.edit && ui.edit.table === t && ui.edit.row !== Number(r)) ui.edit = null; SP.render(); };
  SP.act.gridIns = (el) => {
    if (locked()) return;
    const [t, r, where] = el.dataset.arg.split(':');
    const cfg = GRIDS[t];
    const at = where === 'above' ? Number(r) : Number(r) + 1;
    const res = cfg.onInsert(Number(r), where);
    if (res !== false) { ui.row[t] = at; ui.scrollRow = t; SP.flash('row-' + t + '-' + at); const first = cfg.cols.find((c) => c.edit); if (first && cfg.editAfterInsert !== false) setTimeout(() => SP.startEdit(t, at, cfg.insertFocus || first.key), 0); }
  };
  SP.act.gridDel = (el) => {
    if (locked()) return;
    const [t, r] = el.dataset.arg.split(':');
    const cfg = GRIDS[t];
    const i = Number(r);
    if (cfg.onDelete(i) !== false) { ui.row[t] = Math.min(i, cfg.rows.length - 2); SP.toast((cfg.label || '표') + ' ' + (i + 1) + '행을 삭제했습니다. 실행 취소(⌘Z)로 되돌릴 수 있습니다.', 'info'); }
  };
  SP.act.editFix = (el) => { if (!ui.edit) return; ui.edit.value = el.dataset.arg; SP.commitEdit(); };

  // 셀 클릭/더블클릭
  document.addEventListener('click', (e) => {
    const td = e.target.closest('[data-cell]');
    if (!td || e.target.closest('[data-act]')) return;
    const [t, r] = td.dataset.cell.split(':');
    const row = Number(r);
    if (ui.edit) { if (SP.commitEdit() === false) return; }
    if (ui.row[t] === row && td.classList.contains('sp-ed')) { SP.startEdit(t, row, td.dataset.cell.split(':')[2]); return; }
    ui.row[t] = row;
    SP.render();
  });
  document.addEventListener('dblclick', (e) => {
    const td = e.target.closest('[data-cell]');
    if (!td) return;
    const [t, r, k] = td.dataset.cell.split(':');
    SP.startEdit(t, Number(r), k);
  });
  // 편집 입력: 다시 그리지 않고 메시지만 갱신
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-edit-input]') || !ui.edit) return;
    ui.edit.value = e.target.value;
    const cfg = GRIDS[ui.edit.table];
    const col = cfg.cols.find((c) => c.key === ui.edit.key);
    const v = SP.validateEdit(cfg, col, ui.edit.value, ui.edit.row);
    const msg = e.target.parentElement.querySelector('.sp-cell-msg');
    if (msg) { msg.className = 'sp-cell-msg' + (v.error ? ' sp-cell-msg-bad' : v.warn ? ' sp-cell-msg-warn' : ''); msg.innerHTML = SP.cellMsgHtml(v); }
    e.target.parentElement.classList.toggle('sp-cell-bad', !!v.error);
    e.target.setAttribute('aria-invalid', !!v.error);
  });
  SP.keys.grid = (e) => {
    const t = e.target;
    if (t.matches && t.matches('[data-edit-input]')) {
      if (e.key === 'Enter') { e.preventDefault(); SP.commitEdit(); return true; }
      if (e.key === 'Tab' && ui.edit) {
        e.preventDefault();
        const cfg = GRIDS[ui.edit.table];
        const eds = cfg.cols.filter((c) => c.edit);
        const k = eds.findIndex((c) => c.key === ui.edit.key);
        const row = ui.edit.row;
        if (SP.commitEdit() !== false) { const nx = eds[(k + (e.shiftKey ? eds.length - 1 : 1)) % eds.length]; setTimeout(() => SP.startEdit(cfg.id, row, nx.key), 0); }
        return true;
      }
      return false;
    }
    const wrap = t.closest && t.closest('[data-grid]');
    if (!wrap || ui.edit) return false;
    const id = wrap.dataset.grid;
    const cfg = GRIDS[id];
    if (!cfg) return false;
    const cur = ui.row[id] == null ? -1 : ui.row[id];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ui.row[id] = Math.max(0, Math.min(cfg.rows.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)));
      ui.scrollRow = id;
      SP.render();
      return true;
    }
    if ((e.key === 'Enter' || e.key === 'F2') && cur >= 0) { e.preventDefault(); const first = cfg.cols.find((c) => c.edit); SP.startEdit(id, cur, first.key); return true; }
    if (e.key === 'Delete' && cur >= 0 && e.shiftKey) { e.preventDefault(); SP.act.gridDel({ dataset: { arg: id + ':' + cur } }); return true; }
    return false;
  };
  SP.afterRender.push(() => {
    if (!ui.edit) return;
    const inp = document.querySelector('[data-edit-input]');
    if (inp && document.activeElement !== inp) { inp.focus({ preventScroll: false }); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) { /* 무시 */ } }
  });
})();
