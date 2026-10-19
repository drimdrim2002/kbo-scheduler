/*
 * alt-c 편성 워크북 — 시작점. 앱 생성, 기본 UI 상태, 해시 적용(스크린샷용 고정 상태 포함), 전역 이벤트, 점검 표시.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const qs = new URLSearchParams(location.search);
  if (qs.get('reset') === '1') WB.LS.clearAll();

  WB.actions = WB.actions || {};
  const A = WB.actions;

  function init() {
    // 기능 상태 (localStorage)
    WB.loadFeatures();
    WB.createApp();
    WB.seedPlan = JSON.stringify(WB.app.state.plan);
    WB.book = WB.Book.fromProject(WB.cleanProject());
    Object.assign(WB.ui, {
      screen: 'wizard', step: 1, sheet: { 1: 'slots', 2: 'review', 3: 'schedule', 4: 'metrics' }, opsSheet: 'games',
      sel: {}, scroll: {}, view3: 'grid', month3: 5, teamFilter: new Set(), pane3: 'viol', schedTeam: 'LG', opsDate: '2025-08-17', opsView: 'list'
    });
    applyHash(WB.parseHash(), true);
    document.getElementById('wb').removeAttribute('aria-busy');
    if (qs.get('debug') === 'scroll') installDebug();
    document.documentElement.setAttribute('data-ready', '1');
  }

  function applyHash(h, first) {
    const u = WB.ui;
    if (h.feat) for (const part of h.feat.split(',')) { const [k, v] = part.split(':'); WB.setFeature(k, v === '1'); }
    if (h.ops) { u.screen = 'ops'; u.opsSheet = h.ops; }
    else if (h.step) { u.screen = 'wizard'; u.step = Math.max(1, Math.min(4, +h.step || 1)); }
    if (h.sheet) u.sheet[u.step] = h.sheet;
    if (h.cell) u.pendingCell = h.cell;
    if (h.view) u.view3 = h.view;
    if (h.month) u.month3 = +h.month;
    if (h.team) u.teamFilter = new Set(h.team.split(',').filter(Boolean));
    if (h.date) u.opsDate = h.date;
    if (h.pane) u.pane3 = h.pane;
    if (h.sched) u.schedTeam = h.sched;
    if (h.opsview) u.opsView = h.opsview;
    if (h.result && WB.Ops) WB.Ops.prepareResult(h.result === 'running' ? 'running' : 'done');
    if (h.run && WB.steps[2].freeze) WB.steps[2].freeze(h.run);
    if (h.vsel && WB.steps[3].selectViolation) { WB.ui.pendingViolation = +h.vsel; }
    WB.render();
    if (h.demo === 'edit') WB.steps[1].demoEdit();
    if (h.demo === 'swap' && WB.steps[3].demoSwap) WB.steps[3].demoSwap();
    if (h.modal) openModal(h.modal, h);
    if (!first) WB.syncHash();
  }
  WB.applyHash = applyHash;

  function openModal(m, h) {
    if (m === 'import') WB.Import.open({ source: 'xlsx', fixed: h && h.fixed === '1', confirm: h && h.confirm === '1' });
    else if (m === 'gsheet') WB.Import.gsheet();
    else if (m === 'rule') WB.Import.open({ source: 'rule-slots' });
    else if (m === 'settings') WB.Settings.open();
    else if (m === 'snap') { const b = document.querySelector('[data-act="snap"]'); if (b) A.snap(b); }
  }
  WB.openModal = openModal;

  // ───────────── 전역 동작 ─────────────
  A['menu-data'] = (el) => {
    WB.popover(el, '<div class="ph2">' + WB.icon('sheet') + '데이터 <span class="grow"></span></div><div class="pb" style="padding:4px 0">' +
      [['import-xlsx', 'up', '.xlsx 업로드…', '목업'], ['import-gsheet', 'link', '구글 시트 연결…', '목업'], ['-'], ['tpl-blank', 'file', '빈 양식 다운로드', ''], ['tpl-2025', 'file', '2025 예시 .xlsx', ''], ['export-xlsx', 'down', '.xlsx 내보내기', ''], ['-'],
        ['export-json', 'down', '프로젝트 JSON 내보내기', ''], ['export-engine', 'down', '엔진 JSON 내보내기 (input_2025 형식)', '']]
        .map((x) => x[0] === '-' ? '<hr style="border:0;border-top:1px solid var(--c-line);margin:3px 0">' : '<button class="btn" style="width:100%;justify-content:flex-start;border-radius:0" data-act="' + x[0] + '">' + WB.icon(x[1]) + WB.esc(x[2]) + (x[3] ? ' ' + WB.mock(x[3]) : '') + '</button>').join('') + '</div>', { width: 280 });
  };
  A['go-wizard'] = () => WB.go({ step: WB.ui.step || 1 });
  A['go-ops'] = () => WB.go({ ops: WB.ui.opsSheet || 'games' });
  A.settings = () => { WB.Settings.open(); WB.syncHash(); };
  A.badge = () => { if (!WB.app.derived().ex.feasible) { WB.ui.pane3 = 'viol'; WB.go({ step: 3 }); } };
  A.prev = () => WB.go({ step: WB.ui.step - 1 });
  A.next = () => WB.go({ step: WB.ui.step + 1 });
  A.undo = () => WB.undo();
  A.redo = () => WB.redo();
  A['import-xlsx'] = () => { WB.closePop(); WB.Import.pickXlsx(); };
  A['import-gsheet'] = () => { WB.closePop(); WB.Import.gsheet(); };
  A['gen-slots'] = () => WB.Import.open({ source: 'rule-slots' });
  A['gen-series'] = () => WB.Import.open({ source: 'rule-series' });
  A['row-above'] = () => WB.steps[1].rowOp('above');
  A['row-below'] = () => WB.steps[1].rowOp('below');
  A['row-del'] = () => WB.steps[1].rowOp('del');
  A['tpl-blank'] = () => { WB.closePop(); WB.toast('빈 양식(KBO_일정입력_양식.xlsx)을 내려받습니다 — 시트 6종 + 안내 시트', 'ok'); };
  A['tpl-2025'] = () => { WB.closePop(); WB.toast('2025 프리셋 예시 파일(2025_일정입력_예시.xlsx)을 내려받습니다', 'ok'); };
  A['export-xlsx'] = () => { WB.closePop(); WB.ui.exported = (WB.ui.exported || 0) + 1; WB.toast('.xlsx 내보내기: 슬롯·시리즈·공휴일·휴식예외일·경기없는기간·이벤트·안내 시트 (목업)', 'ok'); WB.render(); };
  A['export-json'] = () => { WB.closePop(); WB.app.exportProject(); };
  A['export-engine'] = () => { WB.closePop(); WB.app.exportEngine(); };

  document.addEventListener('click', (e) => {
    const t = e.target;
    const act = t.closest('[data-act]');
    if (act && !act.disabled) { const fn = A[act.dataset.act]; if (fn) { e.preventDefault(); fn(act, e); return; } }
    const st = t.closest('[data-step]');
    if (st) { WB.go({ step: +st.dataset.step }); return; }
    const sh = t.closest('[data-sheet]');
    if (sh) { WB.hideTip(); if (WB.ui.screen === 'ops') WB.go({ ops: sh.dataset.sheet }); else WB.go({ sheet: sh.dataset.sheet }); return; }
    const fx = t.closest('[data-fix]');
    if (fx) { const [sheet, r, key, value] = fx.dataset.fix.split('|'); WB.Book.setCell(sheet, +r, key, value); WB.ui.sel['s1-' + sheet] = WB.ui.sel['s1-' + sheet] || { r: +r, c: 0 }; WB.render(); WB.toast('고쳤습니다: ' + value, 'ok', { label: '실행 취소', fn: WB.undo }); return; }
    const gt = t.closest('[data-goto]');
    if (gt) { const [sheet, cell] = gt.dataset.goto.split('|'); WB.ui.gridFocus = 's1-' + sheet; WB.go({ step: 1, sheet, cell }); return; }
    const iss = t.closest('[data-iss]');
    if (iss) { WB.ui.issFilter = iss.dataset.iss; WB.steps[1].renderPane(); return; }
  });

  document.addEventListener('keydown', (e) => {
    const inField = e.target.closest && e.target.closest('input, textarea, select');
    if (e.key === 'Escape') {
      if (document.getElementById('ctx')) { WB.closeCtx(); return; }
      if (document.getElementById('pop')) { WB.closePop(); return; }
      if (document.getElementById('modal') && !inField) { WB.closeModal(); return; }
    }
    if (inField || document.getElementById('modal')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) { e.preventDefault(); WB.undo(); }
    else if (mod && (e.key === 'y' || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) { e.preventDefault(); WB.redo(); }
  });

  // 본문 크기가 바뀌면(창 크기 변경) 측정값을 쓰는 격자·차트를 다시 그린다
  let lastSize = '';
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      const h = document.getElementById('gridhost');
      const k = h.clientWidth + 'x' + h.clientHeight;
      if (k === lastSize) return;
      const first = !lastSize;
      lastSize = k;
      if (!first) { try { WB.render(); } catch (e) { console.error(e); } }
    });
    ro.observe(document.getElementById('gridhost'));
  } else window.addEventListener('resize', () => WB.render());
  window.addEventListener('hashchange', () => applyHash(WB.parseHash()));

  /** 실행 중 입력 잠금 표시 */
  WB.lockOverlay = function (host) {
    if (!WB.locked()) return;
    host.insertAdjacentHTML('beforeend', '<div class="lockveil"></div><div class="lockbanner">' + WB.icon('lock') + '엔진 실행 중 — 입력이 잠겨 있습니다 (읽기 전용)</div>');
  };

  /** ?debug=scroll: 페이지 스크롤 여부를 구석에 표시하고 data-scroll 속성에 남긴다 */
  function installDebug() {
    const el = document.createElement('div');
    el.className = 'dbg';
    document.body.appendChild(el);
    WB.debugScroll = function () {
      requestAnimationFrame(() => {
        const de = document.documentElement;
        const sw = Math.max(de.scrollWidth, document.body.scrollWidth), sh = Math.max(de.scrollHeight, document.body.scrollHeight);
        const bad = sh > window.innerHeight + 1 || sw > window.innerWidth + 1;
        el.className = 'dbg ' + (bad ? 'bad' : 'ok');
        el.textContent = (bad ? '페이지 스크롤 있음 ' : '페이지 스크롤 0 · ') + sw + '×' + sh + ' / ' + window.innerWidth + '×' + window.innerHeight;
        de.setAttribute('data-scroll', (bad ? 'BAD' : 'OK') + ' ' + sw + 'x' + sh + ' vp ' + window.innerWidth + 'x' + window.innerHeight);
      });
    };
    WB.debugScroll();
    setInterval(WB.debugScroll, 500);
  }

  init();
})();
