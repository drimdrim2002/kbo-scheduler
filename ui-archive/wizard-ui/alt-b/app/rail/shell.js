/*
 * alt-b 단계 레일 — 골격: 상단 띠, 왼쪽 단계 레일, 작업대(머리·분할·이전/다음), 모달·메뉴 층, 이벤트 위임.
 */
(function () {
  'use strict';
  const R = window.R;
  const esc = R.esc;

  R.STEPS = [
    { n: 1, name: '데이터 준비', task: '시즌 데이터를 가져오고 고친다', tabs: [['season', '시즌 골격'], ['slots', '슬롯'], ['series', '시리즈'], ['events', '이벤트'], ['teams', '구단과 거리']] },
    { n: 2, name: '검토·실행', task: '사전 점검을 통과시키고 엔진을 돌린다', tabs: [] },
    { n: 3, name: '결과·수정', task: '위반을 없애고 일정을 다듬는다', tabs: [['calendar', '캘린더'], ['list', '슬롯 목록'], ['matrix', '구단 × 슬롯', 'V6']] },
    { n: 4, name: '품질·배포', task: '공정성을 확인하고 배포본을 만든다', tabs: [['metrics', '구단 지표'], ['charts', '차트'], ['schedule', '구단별 일정표', 'A11'], ['export', '내보내기']] }
  ];
  R.OPS_TABS = [['games', '경기 기록'], ['reschedule', '재편성']];
  const NUM = ['', '①', '②', '③', '④'];
  R.NUM = NUM;

  function tabsOf(step) { return R.STEPS[step - 1].tabs.filter((t) => !t[2] || R.feature(t[2])); }
  R.tabsOf = tabsOf;
  R.curTab = function () {
    const u = R.ui;
    const tabs = tabsOf(u.step);
    if (!tabs.length) return null;
    if (!tabs.some((t) => t[0] === u.tab[u.step])) u.tab[u.step] = tabs[0][0];
    return u.tab[u.step];
  };
  R.screenKey = function () {
    const u = R.ui;
    if (u.view === 'ops') return 'ops-' + u.opsTab;
    if (u.view === 'settings') return 'settings';
    const t = R.curTab();
    return 'w' + u.step + (t ? '-' + t : '');
  };

  // ───────── 상단 띠 (§3.2) ─────────
  function scoreBadge(d) {
    const ex = d.ex;
    const n = ex.violations.length;
    const mode = R.state().settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준';
    const badge = n === 0
      ? '<span class="badge badge-ok">' + R.icon('ok') + '<b>편성 가능</b></span>'
      : '<button class="badge badge-bad" data-act="go-violations" title="위반 목록으로 이동">' + R.icon('bad') + '<b>Hard 위반 ' + n + '건</b>' + (ex.violations.some((v) => v.virtual) ? '<span class="badge-sub">가상 ' + ex.violations.filter((v) => v.virtual).length + '</span>' : '') + '</button>';
    return '<div class="scorebox">' + badge + '<button class="modechip" data-act="go" data-view="settings" title="H0-e 홈 의무 판정 기준 (설정에서 변경)">H0-e · ' + mode + '</button></div>';
  }
  function enginePill() {
    const r = R.run;
    if (r && r.status === 'RUNNING') return '<div class="engine engine-run" role="status">' + R.icon('run', 'spin') + '<span>엔진 실행 중 <b class="num">' + clock(r.elapsed) + '</b></span><span class="lockchip">' + R.icon('lock') + '입력 잠금</span></div>';
    if (r && r.status === 'PAUSED') return '<div class="engine engine-pause" role="status">' + R.icon('todo') + '<span>일시정지 <b class="num">' + clock(r.elapsed) + '</b></span><span class="lockchip">' + R.icon('lock') + '입력 잠금</span></div>';
    return '<div class="engine" role="status"><span class="dot"></span><span>엔진 대기</span><span class="muted">· 시뮬레이션</span></div>';
  }
  function clock(sec) { sec = Math.floor(sec || 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  R.clock = clock;
  function topBar(d) {
    const st = R.store;
    const u = R.ui;
    return '<header class="top">' +
      '<div class="brand">' + R.icon('diamond', 'brand-ic') + '<b>KBO 일정 편성</b><span class="brand-season">· 2025</span></div>' +
      '<div class="proj"><span class="proj-name">' + esc(R.state().meta.name) + '</span></div>' +
      '<div class="top-r">' + scoreBadge(d) + enginePill() +
      '<div class="tb-group"><button class="ibtn" data-act="undo" ' + (st.canUndo() ? '' : 'disabled') + ' title="실행 취소' + (st.canUndo() ? ': ' + esc(st.undoLabel()) : '') + ' (Ctrl+Z)" aria-label="실행 취소">' + R.icon('undo') + '</button>' +
      '<button class="ibtn" data-act="redo" ' + (st.canRedo() ? '' : 'disabled') + ' title="다시 실행 (Ctrl+Shift+Z)" aria-label="다시 실행">' + R.icon('redo') + '</button></div>' +
      '<nav class="tb-menu" aria-label="메뉴"><button class="tbtn' + (u.menu === 'data' ? ' is-open' : '') + '" data-act="menu" data-menu="data" aria-haspopup="true" aria-expanded="' + (u.menu === 'data') + '">' + R.icon('sheet') + '데이터' + R.icon('chevD', 'sm') + '</button>' +
      '<button class="tbtn' + (u.view === 'ops' ? ' is-on' : '') + '" data-act="go" data-view="ops">' + R.icon('season') + '시즌 운영</button>' +
      '<button class="tbtn' + (u.view === 'settings' ? ' is-on' : '') + '" data-act="go" data-view="settings">' + R.icon('gear') + '설정</button></nav>' +
      '</div></header>';
  }

  // ───────── 단계 레일 ─────────
  function rail(d) {
    const u = R.ui;
    const col = u.collapsed;
    let s = '<nav class="rail' + (col ? ' collapsed' : '') + '" aria-label="편성 단계">';
    s += '<div class="rail-head"><span class="rail-title">편성 단계</span><button class="ibtn rail-tg" data-act="rail-toggle" aria-label="' + (col ? '레일 펼치기' : '레일 접기') + '" title="' + (col ? '레일 펼치기' : '레일 접기') + ' ([)">' + R.icon(col ? 'chevR' : 'chevL') + '</button></div>';
    s += '<ol class="steps">';
    R.STEPS.forEach((stp, i) => {
      const ss = d.steps[i];
      const active = u.view === 'wizard' && u.step === stp.n;
      const locked = R.locked() && (stp.n === 1 || stp.n === 3);
      s += '<li class="step ' + (active ? 'is-active ' : '') + 'st-' + ss.status + '">';
      s += '<button class="step-btn" data-act="go" data-step="' + stp.n + '" aria-current="' + (active ? 'step' : 'false') + '" title="' + esc(NUM[stp.n] + ' ' + stp.name + ' — ' + R.STATUS[ss.status].text + ' · ' + ss.summary) + '">';
      s += '<span class="node"><span class="node-n">' + stp.n + '</span><span class="node-st">' + R.icon(R.STATUS[ss.status].icon) + '</span></span>';
      s += '<span class="step-main"><span class="step-name">' + esc(stp.name) + (locked ? R.icon('lock', 'lk') : '') + '</span><span class="step-sum">' + esc(ss.summary) + '</span></span>';
      s += '<span class="step-st">' + R.st(ss.status, ss.text) + '</span>';
      s += '</button>';
      if (active && !col) {
        const tabs = tabsOf(stp.n);
        if (tabs.length) {
          const cur = R.curTab();
          s += '<ul class="subtabs" role="tablist">';
          for (const [k, label] of tabs) s += '<li><button role="tab" aria-selected="' + (cur === k) + '" class="subtab' + (cur === k ? ' is-on' : '') + '" data-act="go" data-step="' + stp.n + '" data-tab="' + k + '"><span>' + esc(label) + '</span>' + subCount(stp.n, k, d) + '</button></li>';
          s += '</ul>';
        }
      }
      s += '</li>';
    });
    s += '</ol>';
    s += '<div class="rail-extra">';
    s += '<div class="rail-label">시즌 중</div>';
    s += '<button class="extra-btn' + (u.view === 'ops' ? ' is-on' : '') + '" data-act="go" data-view="ops" title="시즌 운영 — 경기 기록·재편성">' + R.icon('season') + '<span class="extra-main"><b>시즌 운영</b><small>경기 기록 · 재편성</small></span></button>';
    if (u.view === 'ops' && !col) {
      s += '<ul class="subtabs">';
      for (const [k, label] of R.OPS_TABS) s += '<li><button class="subtab' + (u.opsTab === k ? ' is-on' : '') + '" data-act="go" data-view="ops" data-tab="' + k + '"><span>' + label + '</span>' + (k === 'games' ? '<span class="cnt">7/20 기준</span>' : '<span class="cnt">' + R.targets().totals.need + '경기</span>') + '</button></li>';
      s += '</ul>';
    }
    s += '<button class="extra-btn' + (u.view === 'settings' ? ' is-on' : '') + '" data-act="go" data-view="settings" title="설정 — 기능 켜기·끄기, H0-e, 엔진">' + R.icon('gear') + '<span class="extra-main"><b>설정</b><small>기능 ' + R.FEATURES.filter((f) => R.feature(f.id)).length + '/' + R.FEATURES.length + ' 켜짐</small></span></button>';
    s += '</div>';
    s += '<div class="rail-foot">' + R.mock() + '<span>표시는 시안용 목업 기능</span></div>';
    return s + '</nav>';
  }
  function subCount(step, tab, d) {
    const st = R.state();
    const err = (sheet) => d.validation.filter((e) => e.sheet === sheet).length;
    if (step === 1) {
      if (tab === 'slots') return err('slots') ? '<span class="cnt cnt-bad">' + R.icon('block') + '오류 ' + err('slots') + '</span>' : '<span class="cnt">' + st.calendar.length + '</span>';
      if (tab === 'series') return err('series') ? '<span class="cnt cnt-bad">' + R.icon('block') + '오류 ' + err('series') + '</span>' : '<span class="cnt">' + st.matches.length + '</span>';
      if (tab === 'events') return '<span class="cnt">' + st.events.length + '</span>';
      if (tab === 'teams') return '<span class="cnt">' + st.teams.length + '</span>';
      if (tab === 'season') return '<span class="cnt">' + R.fmt.short(st.settings.seasonStart) + '~' + R.fmt.short(st.settings.initialEnd) + '</span>';
    }
    if (step === 3) {
      if (tab === 'calendar') return d.ex.violations.length ? '<span class="cnt cnt-bad">' + R.icon('block') + d.ex.violations.length + '</span>' : '<span class="cnt">' + R.icon('ok') + '</span>';
      if (tab === 'list') return '<span class="cnt">' + st.calendar.length + '</span>';
    }
    if (step === 4) {
      if (tab === 'metrics') return '<span class="cnt">' + st.teams.length + '구단</span>';
      if (tab === 'charts') return '<span class="cnt">' + (3 + ['A4', 'A5', 'A8', 'A9', 'A10', 'A12'].filter(R.feature).length) + '</span>';
    }
    return '';
  }

  // ───────── 작업대 ─────────
  R.pane = function (o) {
    return '<section class="pane ' + (o.cls || '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + ' aria-label="' + esc(o.title || '') + '">' +
      (o.title != null ? '<header class="pane-h">' + (o.kicker ? '<span class="kicker' + (o.live ? ' live' : '') + '">' + (o.live ? '<i class="pulse"></i>' : '') + esc(o.kicker) + '</span>' : '') + '<h2>' + esc(o.title) + '</h2>' + (o.sub ? '<span class="pane-sub">' + o.sub + '</span>' : '') + '<div class="pane-tools">' + (o.tools || '') + '</div></header>' : '') +
      (o.bar ? '<div class="pane-bar">' + o.bar + '</div>' : '') +
      '<div class="pane-b' + (o.flush ? ' flush' : '') + (o.noscroll ? ' noscroll' : '') + '"' + (o.sk ? ' data-sk="' + o.sk + '"' : '') + '>' + o.body + '</div>' +
      (o.foot ? '<footer class="pane-f">' + o.foot + '</footer>' : '') + '</section>';
  };
  function work(d) {
    const u = R.ui;
    const key = R.screenKey();
    const scr = R.screens[key] || R.screens[key.split('-')[0]];
    if (!scr) return '<main class="work"><div class="empty">화면 없음: ' + esc(key) + '</div></main>';
    let title, num, desc;
    if (u.view === 'ops') { title = '시즌 운영'; num = ''; desc = '경기 결과와 취소를 기록하고, 남은 경기를 9~10월에 다시 편성한다'; }
    else if (u.view === 'settings') { title = '설정'; num = ''; desc = '기능을 켜고 끄고, 판정 기준과 엔진 연결을 정한다'; }
    else { const stp = R.STEPS[u.step - 1]; title = stp.name; num = NUM[stp.n]; desc = stp.task; }
    const sub = scr.subtitle ? scr.subtitle(d) : '';
    let s = '<main class="work" data-screen="' + key + '">';
    s += '<header class="work-head"><div class="wh-title">' + (num ? '<span class="wh-num">' + num + '</span>' : '') + '<h1>' + esc(title) + (sub ? '<span class="wh-sub"> · ' + esc(sub) + '</span>' : '') + '</h1><p>' + esc(desc) + '</p></div><div class="wh-tools">' + (scr.tools ? scr.tools(d) : '') + '</div></header>';
    if (R.locked() && (key.startsWith('w1') || key.startsWith('w3'))) s += '<div class="lockband" role="status">' + R.icon('lock') + '<b>엔진 실행 중</b> — 입력과 배정이 잠겨 있습니다. 보기만 할 수 있습니다. <button class="lnk" data-act="go" data-step="2">검토·실행으로</button></div>';
    if (scr.strip) s += scr.strip(d);
    if (scr.body) s += scr.body(d);
    else {
      const rhtml = scr.right(d);
      const cls = typeof scr.cls === 'function' ? scr.cls(d) : (scr.cls || '');
      s += '<div class="split ' + cls + (rhtml ? '' : ' solo') + '">' + scr.left(d) + (rhtml ? '<div class="split-link" aria-hidden="true"><span></span></div>' + rhtml : '') + '</div>';
    }
    s += foot(d);
    return s + '</main>';
  }
  function foot(d) {
    const u = R.ui;
    let s = '<footer class="work-foot">';
    if (u.view !== 'wizard') {
      s += '<button class="btn" data-act="go" data-step="' + u.step + '">' + R.icon('chevL') + '위저드로 돌아가기 <span class="muted">(' + NUM[u.step] + ' ' + R.STEPS[u.step - 1].name + ')</span></button>';
      s += '<div class="foot-mid">' + (u.view === 'ops' ? '1차 편성 위저드와 분리된 메뉴입니다' : '바꾼 설정은 바로 반영됩니다') + '</div><span></span>';
      return s + '</footer>';
    }
    const cur = d.steps[u.step - 1];
    if (u.step > 1) s += '<button class="btn" data-act="go" data-step="' + (u.step - 1) + '">' + R.icon('chevL') + '이전: ' + R.STEPS[u.step - 2].name + '</button>'; else s += '<span></span>';
    s += '<div class="foot-mid"><span class="dots">' + R.STEPS.map((x) => '<i class="' + (x.n === u.step ? 'on' : '') + ' st-' + d.steps[x.n - 1].status + '"></i>').join('') + '</span>단계 ' + u.step + ' / 4 · 순서와 상관없이 오갈 수 있습니다</div>';
    if (u.step < 4) s += '<button class="btn btn-primary" data-act="go" data-step="' + (u.step + 1) + '">다음: ' + R.STEPS[u.step].name + ' <span class="next-st st-' + cur.status + '">' + R.icon(R.STATUS[cur.status].icon) + esc(cur.status === 'ok' ? '완료' : cur.text) + '</span>' + R.icon('chevR') + '</button>';
    else s += '<button class="btn btn-primary" data-act="go" data-view="ops">시즌 운영으로' + R.icon('chevR') + '</button>';
    return s + '</footer>';
  }

  // ───────── 메뉴·모달 층 ─────────
  R.modals = {};
  R.menus = {};
  R.openModal = (name, opts) => { R.ui.modal = name; R.ui.modalOpts = opts || {}; R.ui.menu = null; R.render(); };
  R.closeModal = () => { R.ui.modal = null; R.ui.modalOpts = {}; R.render(); };
  function layer() {
    const u = R.ui;
    let s = '';
    if (u.menu === 'data') {
      s += '<div class="menu-scrim" data-act="menu-close"></div><div class="menu" role="menu" style="top:46px;right:' + (u.menuRight || 170) + 'px">' +
        '<div class="menu-h">가져오기 ' + R.mock() + '</div>' +
        '<button role="menuitem" data-act="import" data-src="xlsx">' + R.icon('upload') + '.xlsx 파일 업로드…</button>' +
        '<button role="menuitem" data-act="import" data-src="gsheet">' + R.icon('link') + '구글 시트 공유 링크…</button>' +
        '<div class="menu-h">내보내기</div>' +
        '<button role="menuitem" data-act="export" data-kind="xlsx">' + R.icon('download') + '.xlsx 내보내기 (같은 시트 구성)</button>' +
        '<button role="menuitem" data-act="export" data-kind="template">' + R.icon('sheet') + '빈 양식 받기 (+ 2025 예시)</button>' +
        '<button role="menuitem" data-act="export" data-kind="project">' + R.icon('download') + '프로젝트 JSON</button>' +
        '</div>';
    }
    if (u.menu && u.menu !== 'data' && R.menus[u.menu]) {
      const pos = u.menuPos || { top: 100, left: 100 };
      s += '<div class="menu-scrim" data-act="menu-close"></div><div class="menu pop" role="dialog" style="top:' + pos.top + 'px;' + (pos.right != null ? 'right:' + pos.right + 'px' : 'left:' + pos.left + 'px') + '">' + R.menus[u.menu]() + '</div>';
    }
    if (u.modal && R.modals[u.modal]) s += '<div class="scrim" data-act="modal-scrim"><div class="modal ' + (R.modals[u.modal].cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(R.modals[u.modal].title || '') + '">' + R.modals[u.modal].render() + '</div></div>';
    return s;
  }

  // ───────── 렌더 ─────────
  function saveScroll() {
    const m = {};
    document.querySelectorAll('[data-sk]').forEach((el) => { m[el.getAttribute('data-sk')] = [el.scrollTop, el.scrollLeft]; });
    return m;
  }
  function restoreScroll(m) {
    document.querySelectorAll('[data-sk]').forEach((el) => { const v = m[el.getAttribute('data-sk')]; if (v) { el.scrollTop = v[0]; el.scrollLeft = v[1]; } });
  }
  R.renderNow = function () {
    const d = R.derived();
    const app = document.getElementById('app');
    const sc = saveScroll();
    const ae = document.activeElement;
    const focusKey = ae && ae.getAttribute ? (ae.getAttribute('data-fk') || (ae.id ? '#' + ae.id : null)) : null;
    app.className = 'app' + (R.ui.collapsed ? ' rail-collapsed' : '');
    app.innerHTML = topBar(d) + '<div class="main">' + rail(d) + work(d) + '</div>';
    document.getElementById('layer').innerHTML = layer();
    restoreScroll(sc);
    if (focusKey) {
      const el = focusKey[0] === '#' ? document.getElementById(focusKey.slice(1)) : document.querySelector('[data-fk="' + focusKey + '"]');
      if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
    }
    const key = R.screenKey();
    const scr = R.screens[key];
    if (scr && scr.after) scr.after(d);
    if (R.ui.modal && R.modals[R.ui.modal] && R.modals[R.ui.modal].after) R.modals[R.ui.modal].after();
    if (R.afterRender) R.afterRender.forEach((f) => f());
    if (R.debugScroll) R.debugScroll();
  };

  // ───────── 이벤트 위임 ─────────
  function bind() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.disabled) return;
      const name = el.getAttribute('data-act');
      if (name === 'modal-scrim' && e.target !== el) return;
      const fn = R.act[name];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (R.ui.menu) { R.ui.menu = null; R.render(); return; }
        if (R.ui.modal) { R.closeModal(); return; }
      }
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (typing) { const fn = R.keys[e.target.getAttribute('data-key')]; if (fn) fn(e.target, e); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act][role="button"]:not(button)')) { e.preventDefault(); e.target.click(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) R.redo(); else R.undo(); return; }
      if (e.key === '[' && !e.ctrlKey && !e.metaKey) { R.act['rail-toggle'](); }
    });
    const handleInput = (e) => {
      const el = e.target.closest('[data-in]');
      if (!el) return;
      const fn = R.inputs[el.getAttribute('data-in')];
      if (fn) fn(el, e);
    };
    document.addEventListener('change', handleInput);
    document.addEventListener('input', (e) => { const el = e.target.closest('[data-live]'); if (!el) return; const fn = R.inputs[el.getAttribute('data-live')]; if (fn) fn(el, e); });
  }
  R.keys = {};
  R.bind = bind;

  // ───────── 공통 동작 ─────────
  Object.assign(R.act, {
    go(el) {
      const view = el.getAttribute('data-view');
      const step = el.getAttribute('data-step');
      const tab = el.getAttribute('data-tab');
      R.ui.menu = null;
      const row = el.getAttribute('data-row');
      if (row != null && tab && R.ui.selRow) { R.ui.selRow[tab] = +row; R.ui.scrollRow = 'row-' + tab + '-' + row; R.ui.flashRow = tab + ':' + row; }
      if (view) R.go({ view, tab: tab || undefined });
      else R.go({ step: +step, tab: tab || undefined });
    },
    'rail-toggle'() { R.ui.collapsed = !R.ui.collapsed; R.ls.set('rail', R.ui.collapsed ? '1' : '0'); R.render(); },
    undo() { R.undo(); },
    redo() { R.redo(); },
    menu(el) {
      const name = el.getAttribute('data-menu');
      R.ui.menu = R.ui.menu === name ? null : name;
      const r = el.getBoundingClientRect();
      R.ui.menuRight = Math.max(8, window.innerWidth - r.right);
      R.ui.menuPos = el.getAttribute('data-align') === 'left' ? { top: Math.round(r.bottom + 6), left: Math.round(r.left) } : { top: Math.round(r.bottom + 6), right: Math.max(8, Math.round(window.innerWidth - r.right)) };
      R.render();
    },
    'menu-close'() { R.ui.menu = null; R.render(); },
    'modal-close'() { R.closeModal(); },
    'modal-scrim'() { R.closeModal(); },
    'go-violations'() { R.go({ step: 3, tab: 'calendar' }); },
    export(el) {
      const kind = el.getAttribute('data-kind');
      R.ui.menu = null;
      const label = { xlsx: '2025_KBO_정규시즌_편성.xlsx (시트 6개)', template: 'KBO_편성_빈양식.xlsx + 2025 예시', project: 'kbo-2025-project.json', engine: 'input_2025_engine.json', csv: '구단별_일정표.csv' }[kind] || kind;
      R.toast('내보내기 (목업): ' + label + ' 파일을 만들었다고 가정합니다.', 'ok');
      R.render();
    }
  });
})();
