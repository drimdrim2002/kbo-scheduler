/*
 * alt-a 편성 스튜디오 — 골격: 상단 띠, 단계 스테퍼, 이전/다음, 메뉴, 오버레이, 렌더 루프, 이벤트 위임.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon } = S;
  const { Score } = KBO;

  const STEP_META = {
    1: { name: '데이터 준비', task: '시즌 데이터를 가져오고 한 건씩 고칩니다.' },
    2: { name: '검토·실행', task: '사전 점검을 통과하면 자동 편성을 돌립니다.' },
    3: { name: '결과·수정', task: '위반을 없애고 일정을 다듬습니다.' },
    4: { name: '공정성·배포', task: '공정성을 확인하고 배포 파일을 만듭니다.' }
  };
  S.STEP_META = STEP_META;
  const CIRCLED = ['', '①', '②', '③', '④'];
  const KICON = { ok: 'check', warn: 'warn', block: 'block', todo: 'todo' };
  S.CIRCLED = CIRCLED;

  // ───────── 단계 상태 ─────────
  S.stepStatus = function (n) {
    const app = S.app, st = app.state, c = app.derived();
    if (n === 1) {
      const errs = S.draftErrors ? S.draftErrors() : 0;
      const sum = '연전 기간 ' + st.calendar.length + ' · 시리즈 ' + st.matches.length + ' · 특별 경기 ' + st.events.length;
      if (errs) return { kind: 'warn', text: '칸 오류 ' + errs, summary: sum, next: '칸 오류 ' + errs };
      if (!st.calendar.length || !st.matches.length) return { kind: 'todo', text: '작성 중', summary: sum, next: !st.calendar.length ? '연전 기간 없음' : '시리즈 없음' };
      const fl = S.flowStatus ? S.flowStatus() : null; // ① 단계 흐름: 네 단계가 모두 끝나야 완료
      if (fl && !fl.allDone) return { kind: 'todo', text: '작성 중', summary: sum, next: fl.stop + '단계 「' + fl.steps[fl.stop - 1].name + '」' };
      return { kind: 'ok', text: '완료', summary: sum, next: '입력 완료' };
    }
    if (n === 2) {
      const pf = app.preflight();
      const k = pf.counts;
      if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) {
        return { kind: 'todo', text: S.run.status === 'PAUSED' ? '일시정지' : '편성 중', summary: (S.run.status === 'PAUSED' ? '일시정지' : '더 나은 일정을 찾는 중') + ' · ' + S.fmt.time(S.run.elapsed) + (S.dev() ? ' · 개선 ' + S.run.improvements + '회' : ''), next: '편성 중' };
      }
      const sum = '통과 ' + k.pass + ' · 확인 필요 ' + k.warn + ' · 진행 불가 ' + k.block + (S.lastRun ? ' · 자동 편성 ' + S.lastRun.count + '회' : ' · 자동 편성 1회');
      if (k.block) return { kind: 'block', text: '진행 불가 ' + k.block, summary: sum, next: '진행 불가 ' + k.block };
      if (k.warn) return { kind: 'warn', text: '확인 필요 ' + k.warn, summary: sum, next: '확인 필요 ' + k.warn };
      return { kind: 'ok', text: '통과', summary: sum, next: '점검 통과' };
    }
    if (n === 3) {
      const ex = c.ex;
      const cnt = ex.violations.length;
      const sum = S.term('hardViol') + ' ' + cnt + '건 · 일정 미정 ' + c.pool.length + ' · 고정 ' + st.matches.filter((m) => m.pinned).length;
      if (cnt) return { kind: 'block', text: '위반 ' + cnt, summary: sum, next: S.termPlain('hardViol') + ' ' + cnt };
      if (c.pool.length) return { kind: 'warn', text: '일정 미정 ' + c.pool.length, summary: sum, next: '일정 미정 ' + c.pool.length };
      return { kind: 'ok', text: '편성 가능', summary: sum, next: '편성 가능' };
    }
    const tm = c.ex.teamMetrics;
    const over = tm.filter((t) => t.overDistance).length;
    const sum = '이동거리 범위 밖 ' + over + '구단 · ' + (S.ui.exported ? '배포 파일 만듦' : '배포 파일 아직 없음');
    if (S.ui.exported) return { kind: 'ok', text: '완료', summary: sum, next: '완료' };
    return { kind: 'todo', text: '작성 중', summary: sum, next: '작성 중' };
  };

  // ───────── 상단 띠 ─────────
  /** 고른 시즌 연도: 로고 바로 뒤에 크게. 누르면 연도 고르기(지금 연도는 저장해 두고 넘어감). 아직 안 골랐으면 「시즌 연도를 고르세요」 */
  function yearChip() {
    const empty = S.flowYearChosen && !S.flowYearChosen() && S.g1 && S.g1.mode === 'year';
    if (empty) return '<button class="tb-year empty" data-act="year-pick" title="맨 먼저 시즌 연도를 고릅니다">시즌 연도를 고르세요</button>';
    return '<button class="tb-year" data-act="year-pick" title="눌러서 다른 시즌으로 — 지금 시즌은 이 브라우저에 저장해 두고 넘어갑니다" aria-label="' + S.seasonYear() + ' 시즌 — 눌러서 다른 시즌 고르기">' + S.seasonYear() + ' 시즌' + icon('down') + '</button>';
  }
  function renderTop() {
    const app = S.app, ex = app.derived().ex;
    const n = ex.violations.length;
    const mode = app.state.settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준';
    const badge = ex.feasible
      ? '<span class="badge ok" role="status">' + icon('check') + '편성 가능</span>'
      : '<span class="badge bad" role="status">' + icon('x') + esc(S.term('hardViol')) + ' ' + n + '건</span>';
    const r = S.run;
    let eng;
    if (r && r.status === 'RUNNING') eng = '<span class="eng run"><span class="dot"></span><b>실행 중</b> ' + S.fmt.time(r.elapsed) + '</span><span class="lock-pill">' + icon('lock') + '입력 잠김</span>';
    else if (r && r.status === 'PAUSED') eng = '<span class="eng pause"><span class="dot"></span><b>일시정지</b> ' + S.fmt.time(r.elapsed) + '</span><span class="lock-pill">' + icon('lock') + '입력 잠김</span>';
    else eng = '<span class="eng"><span class="dot"></span>' + (S.dev() ? '엔진 <b>대기</b> · ' + (app.engineConfig.kind === 'REST' ? 'REST' : 'Mock') : '자동 편성 <b>대기</b>') + '</span>';
    return '' +
      '<div class="brand"><span class="brand-mark" aria-hidden="true">KBO</span><span class="brand-name">일정 편성</span>' + yearChip() + '<span class="brand-sub">편성 스튜디오</span></div>' +
      '<span class="tb-sep"></span>' +
      '<div class="tb-group">' + badge +
        (S.dev()
          ? '<button class="chip-mode" data-act="open-settings" data-set="scoring" title="H0-e 홈 의무 판정 모드 — 설정에서 바꿉니다">H0-e ' + esc(mode) + '</button>' +
            '<span class="badge-score" title="BendableLongScore 원점수">' + esc(S.fmt.score(ex.score)) + '</span><span class="dev-pill" title="설정에서 끌 수 있습니다">개발자 모드</span>'
          : '') +
      '</div>' +
      '<span class="tb-sep"></span>' +
      '<div class="tb-group">' + eng + '</div>' +
      '<div class="tb-right">' +
        '<button class="tb-btn' + (S.ui.menu === 'data' ? ' on' : '') + '" data-act="menu" data-menu="data" aria-haspopup="menu">' + icon('db') + '데이터' + icon('down') + '</button>' +
        '<button class="tb-btn' + (S.ui.ops ? ' on' : '') + '" data-act="open-ops">' + icon('ops') + '시즌 운영</button>' +
        '<button class="tb-btn' + (S.ui.drawer === 'settings' ? ' on' : '') + '" data-act="open-settings">' + icon('gear') + '설정</button>' +
      '</div>';
  }

  // ───────── 스테퍼 ─────────
  function renderStepper() {
    let s = '';
    const locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    for (let n = 1; n <= 4; n++) {
      const st = S.stepStatus(n);
      const active = S.ui.step === n;
      const g1 = n === 1 && S.guideUI && S.guideUI.stepSummary ? S.guideUI.stepSummary() : null; // ① 단계별 화면: 「새로 입력하기 · 3 / 9 공휴일」
      const sum = g1 || st.summary;
      s += '<button class="step' + (active ? ' active' : '') + '" data-act="go-step" data-step="' + n + '"' + (active ? ' aria-current="step"' : '') + '>' +
        '<span class="step-no">' + n + '</span>' +
        '<span class="step-name">' + STEP_META[n].name + (locked && n === 1 ? '<span class="step-lock">' + icon('lock') + '잠김</span>' : '') + '</span>' +
        S.stat(st.kind, st.text) +
        '<span class="step-sum" title="' + esc(sum) + '">' + esc(sum) + '</span>' +
        '</button>';
    }
    return s;
  }

  // ───────── 하단 ─────────
  function renderFooter() {
    if (S.ui.ops) {
      return '<button class="btn" data-act="close-ops">' + icon('left') + '1차 편성으로 돌아가기</button>' +
        '<span class="hint">시즌 운영은 1차 편성과 따로 둡니다. 경기 기록 → 재편성 순서로 씁니다.</span>' +
        S.mock('시안 예시: 경기 기록 저장·재편성');
    }
    const n = S.ui.step;
    if (n === 1 && S.guideUI && S.guideUI.footer) { const f = S.guideUI.footer(); if (f) return f; } // ① 단계별 화면: 이전·단계·다음
    const cur = S.stepStatus(n);
    const prev = n > 1 ? '<button class="btn" data-act="go-step" data-step="' + (n - 1) + '">' + icon('left') + '이전: ' + STEP_META[n - 1].name + '</button>' : '<button class="btn" disabled>' + icon('left') + '이전 단계</button>';
    const next = n < 4
      ? '<button class="btn primary" data-act="go-step" data-step="' + (n + 1) + '">다음: ' + STEP_META[n + 1].name + ' <span class="nx">(' + icon(KICON[cur.kind] || 'info') + esc(cur.next) + ')</span>' + icon('right') + '</button>'
      : '<button class="btn primary" data-act="q-view" data-qv="export">배포 파일 내보내기 <span class="nx">(' + icon(KICON[cur.kind] || 'info') + esc(cur.next) + ')</span>' + icon('right') + '</button>';
    return prev + '<span class="hint"><b>' + CIRCLED[n] + ' ' + STEP_META[n].name + '</b> — ' + esc(STEP_META[n].task) + '</span>' +
      '<span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' + next;
  }

  function renderOpsBar() {
    const t = S.ui.ops;
    return '<span class="title">시즌 운영</span>' +
      '<div class="tabs" role="tablist">' +
        '<button role="tab" class="' + (t === 'games' ? 'on' : '') + '" data-act="ops-tab" data-tab="games">' + icon('cal') + '경기 기록</button>' +
        '<button role="tab" class="' + (t === 'reschedule' ? 'on' : '') + '" data-act="ops-tab" data-tab="reschedule">' + icon('bolt') + '재편성</button>' +
        (S.feature('A6') ? '<button role="tab" class="' + (t === 'route' ? 'on' : '') + '" data-act="ops-tab" data-tab="route" data-feature="A6">' + icon('map') + '이동 경로</button>' : '') +
      '</div>' +
      '<span class="pane-desc">' + (t === 'route' ? '구단마다 시즌 이동을 지도 위에 차례로 그립니다. 취소 경기는 따로 표시합니다.' : '취소 경기를 날짜 단위로 기록하고, 잔여·취소 경기를 9~10월에 다시 배치합니다.') + '</span>' +
      '<span style="margin-left:auto" class="small muted">기준일 ' + S.fmt.date(S.app.referenceDate()) + '</span>';
  }

  // ───────── 오버레이 ─────────
  S.modals = {};
  S.drawers = {};
  function renderOverlay() {
    let s = '';
    const u = S.ui;
    if (u.drawer && S.drawers[u.drawer]) s += '<div class="drawer-scrim" data-act="close-drawer"></div>' + S.drawers[u.drawer]();
    if (u.modal && S.modals[u.modal]) s += '<div class="scrim" data-act="scrim">' + S.modals[u.modal]() + '</div>';
    if (u.menu && S.menus[u.menu]) s += S.menus[u.menu]();
    s += '<div class="minw-note">이 화면은 1440px 이상 폭에 맞췄습니다. 창을 넓혀 주세요.</div>';
    return s;
  }

  S.menus = {
    data() {
      const p = S.ui.menuPos || { x: 0, y: 44 };
      return '<div class="menu" role="menu" style="top:' + p.y + 'px;right:' + Math.max(8, window.innerWidth - p.x) + 'px">' +
        '<div class="mh">가져오기</div>' +
        '<button role="menuitem" data-act="import-xlsx">' + icon('upload') + '엑셀 올리기…' + S.mock() + '</button>' +
        '<button role="menuitem" data-act="import-gsheet">' + icon('link') + '구글 시트 연결…' + S.mock() + '</button>' +
        '<div class="msep"></div><div class="mh">내보내기</div>' +
        '<button role="menuitem" data-act="export" data-kind="xlsx">' + icon('download') + '엑셀로 받기' + S.mock() + '</button>' +
        '<button role="menuitem" data-act="export" data-kind="template">' + icon('file') + '빈 엑셀 양식 받기' + S.mock() + '</button>' +
        (S.dev() ? '<button role="menuitem" data-act="export" data-kind="engine">' + icon('bolt') + '엔진 JSON (input 형식)</button>' : '') +
        (S.feature('D4') ? '<button role="menuitem" data-act="export" data-kind="csv">' + icon('table') + '일정표 CSV</button>' : '') +
        '<div class="msep"></div><div class="mh">시즌 데이터 · ' + S.seasonYear() + ' 시즌</div>' +
        '<button role="menuitem" data-act="repo-export">' + icon('download') + '파일로 내려받기(.json)</button>' +
        '<button role="menuitem" data-act="repo-import">' + icon('upload') + '파일 올리기(.json)…</button>' +
        '<button role="menuitem" data-act="year-pick">' + icon('cal') + '시즌 연도 고르기 · 처음부터 다시…</button>' +
      '</div>';
    }
  };

  // ───────── 처음부터 입력하기 · 예시 데이터 확인 창 ─────────
  S.modals.reset = function () {
    const st = S.app.state, kind = S.ui.resetKind || 'blank', ry = S.ui.resetYear || S.seasonYear();
    if (ry !== S.seasonYear()) return resetOtherYear(kind, ry);
    const cnt = (n, unit) => '<b>' + n + '</b>' + unit;
    const now = '연전 기간 ' + cnt(st.calendar.length, '개') + ' · 시리즈 ' + cnt(st.matches.length, '개') + ' · 특별 경기 ' + cnt(st.events.length, '개') + ' · 공휴일 ' + cnt(st.settings.holidays.length, '일') + ' · 휴식일 경기 ' + cnt(st.settings.restExceptions.length, '일') + ' · 휴식기 ' + cnt(st.settings.blackouts.length, '개');
    const blank = kind === 'blank', y = S.seasonYear(), b = S.builtinOf && S.builtinOf(y);
    const title = blank ? y + ' 시즌 처음부터 입력하기' : y === 2025 ? '2025 예시 데이터 다시 불러오기' : y + ' 시즌 ' + (b ? b.tag : '기본 제공') + ' 데이터로 다시';
    return '<div class="modal narrow reset-modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="modal-head">' + icon(blank ? 'plus' : 'db') + '<h3>' + esc(title) + '</h3><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div style="padding:14px;display:flex;flex-direction:column;gap:10px">' +
      (blank
        ? '<p class="small" style="margin:0">지금 들어 있는 표를 모두 비우고, 빈 상태에서 시즌 정보를 처음부터 적습니다. 직접 적는 것은 날짜 몇 개뿐이고, 연전 기간·시리즈 같은 큰 표는 단추로 만듭니다.</p>' +
          '<dl class="props"><dt>비우는 것</dt><dd class="small">시즌 날짜(개막일·종료일) · 휴식일 경기 · 휴식기 · 연전 기간 · 시리즈 · 홈 구장 지정 · 경기 기록 · 중간 저장</dd>' +
          '<dt>남기는 것</dt><dd class="small">구단과 구장 위치, 구장 간 거리 — KBO 10구단은 거의 바뀌지 않습니다. 구단이 바뀌면 1 구단 정보에서 고칩니다.<br>맞대결 ' + st.settings.initialGamesPerPair + '경기(홈 ' + st.settings.homeGamesMajor + ')·휴식 요일 같은 규칙 값도 그대로입니다. 공휴일은 ' + y + '년 법정 공휴일로 다시 넣습니다.</dd>' +
          '<dt>지금 데이터</dt><dd class="small">' + now + '</dd></dl>'
        : (y === 2025 ? '<p class="small" style="margin:0">2025 정규시즌 실제 일정(기본 제공)을 다시 불러옵니다. 결과 화면 시연용 위반 3건과 7월까지의 경기 기록이 함께 들어옵니다.</p>' : '<p class="small" style="margin:0">' + esc(b ? b.label + '(' + b.tag + ')' : '기본 제공 데이터') + '을(를) 다시 불러옵니다.</p>') +
          '<dl class="props"><dt>바뀌는 것</dt><dd class="small">지금 적은 모든 표가 ' + esc(y === 2025 ? '2025 실제 일정' : b ? b.label : '기본 제공 데이터') + '으로 바뀝니다.</dd><dt>지금 데이터</dt><dd class="small">' + now + '</dd></dl>') +
      '<div class="confirm-box">' + icon('info') + '<span>실행 취소(<span class="kbd">Ctrl</span>+<span class="kbd">Z</span>)로 한 번에 되돌릴 수 있습니다.</span></div>' +
      '</div><div class="modal-foot"><span class="small muted">' + (blank ? '비운 뒤에는 시즌 달력에서 개막일부터 적습니다.' : '불러온 뒤에는 시즌 달력에서 시작합니다.') + '</span><span style="margin-left:auto;display:flex;gap:8px"><button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="reset-go" data-kind="' + kind + '">' + icon(blank ? 'plus' : 'db') + (blank ? '표 비우고 처음부터' : '다시 불러오기') + '</button></span></div></div>';
  };
  /** 지금 열지 않은 해를 처음부터 다시 · 기본 제공 데이터로 다시: 그 해로 바꾼 뒤 비운다(지금 해는 저장해 둠) */
  function resetOtherYear(kind, y) {
    const blank = kind === 'blank', b = S.builtinOf && S.builtinOf(y);
    const title = blank ? y + ' 시즌 처음부터 입력하기' : y + ' 시즌 ' + (b ? b.tag : '기본 제공') + ' 데이터로 다시';
    return '<div class="modal narrow reset-modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="modal-head">' + icon(blank ? 'plus' : 'db') + '<h3>' + esc(title) + '</h3><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div style="padding:14px;display:flex;flex-direction:column;gap:10px"><p class="small" style="margin:0">' + (blank ? y + ' 시즌으로 바꾼 뒤 시즌 날짜·연전 묶음·홈 구장 지정·시리즈를 모두 비우고 처음부터 입력합니다. 구단 정보는 그대로 두고 그 해 법정 공휴일을 미리 넣습니다.' : y + ' 시즌으로 바꾼 뒤 ' + esc(b ? b.label : '기본 제공 데이터') + '을(를) 다시 불러옵니다.') + '</p>' +
      '<div class="confirm-box">' + icon('info') + '<span>지금 ' + S.seasonYear() + ' 시즌은 이 브라우저에 저장해 두고 넘어갑니다. 바꾼 뒤 실행 취소(<span class="kbd">Ctrl</span>+<span class="kbd">Z</span>)로 한 번에 되돌릴 수 있습니다.</span></div></div>' +
      '<div class="modal-foot"><span style="margin-left:auto;display:flex;gap:8px"><button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="reset-go" data-kind="' + kind + '">' + icon(blank ? 'plus' : 'db') + (blank ? '처음부터 입력하기' : '다시 불러오기') + '</button></span></div></div>';
  }

  // ───────── 렌더 루프 ─────────
  const els = {};
  const scrollMem = {};
  S.render = function () {
    const u = S.ui;
    S.wide = window.innerWidth >= 1800; S.tall = window.innerHeight >= 900;
    document.querySelectorAll('[data-sk]').forEach((el) => { scrollMem[el.getAttribute('data-sk')] = [el.scrollTop, el.scrollLeft]; });
    document.body.classList.toggle('mode-ops', !!u.ops);
    els.top.innerHTML = renderTop();
    els.stepper.innerHTML = u.ops ? renderOpsBar() : renderStepper();
    els.stepper.className = u.ops ? 'opsbar' : 'stepper';
    els.body.innerHTML = u.ops ? S.ops.render() : S.steps[u.step].render();
    els.footer.innerHTML = renderFooter();
    els.overlay.innerHTML = renderOverlay();
    document.querySelectorAll('[data-sk]').forEach((el) => { const m = scrollMem[el.getAttribute('data-sk')]; if (m) { el.scrollTop = m[0]; el.scrollLeft = m[1]; } });
    const after = S._after; S._after = [];
    for (const fn of after) { try { fn(); } catch (e) { console.error(e); } }
    if (!u.ops && S.steps[u.step].after) S.steps[u.step].after();
    if (u.ops && S.ops.after) S.ops.after();
    if (S.guideAfter) S.guideAfter();
    S.writeHash();
    document.title = '편성 스튜디오 — KBO 일정 편성 · ' + S.seasonYear() + ' 시즌';
    S.checkScroll();
  };
  S._after = [];
  S.afterRender = (fn) => S._after.push(fn);
  let pending = false;
  S.scheduleRender = function () {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; S.render(); }, 0);
  };
  S.go = function (patch) { Object.assign(S.ui, patch); S.ui.menu = null; S.render(); };
  S.toast = (m, k, ms) => { if (!S.quiet) KBO.UI.toast(S.plain(m), k, ms); };
  /** 도로거리 받기 결과 알림(구단 정보 카드·표 아래 단추) */
  S.roadToast = (r) => {
    if (r.ok) S.toast('도로거리 ' + r.ok + '쌍을 받았습니다(카카오모빌리티 길찾기, 양쪽 방향). 실행 취소로 되돌릴 수 있습니다.', 'ok', 5000);
    if (r.failed) S.toast(r.failed + '쌍은 받지 못해 지금 값을 그대로 둡니다 — ' + r.error, 'warn', 7000);
    if (!r.ok && !r.failed) S.toast('받을 거리가 없습니다.', 'info');
  };

  /** 선택 항목을 보이게 스크롤 */
  S.revealSelected = function (sel, container) {
    const box = typeof container === 'string' ? document.querySelector(container) : container;
    const el = box && box.querySelector(sel);
    if (!el || !box) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top + 30 || r.bottom > b.bottom - 4) box.scrollTop += r.top - b.top - b.height / 3;
  };

  // ───────── 공통 동작 ─────────
  Object.assign(S.actions, {
    'go-step': (el) => { S.go({ step: +el.dataset.step, ops: null, sel: null, edit: null }); },
    'open-ops': () => { S.go({ ops: S.ui.ops ? S.ui.ops : 'games', drawer: null }); },
    'close-ops': () => { S.go({ ops: null }); },
    'ops-tab': (el) => { S.go({ ops: el.dataset.tab }); },
    'open-settings': (el) => { S.go({ drawer: S.ui.drawer === 'settings' && !el.dataset.set ? null : 'settings', setTab: el.dataset.set || S.ui.setTab || 'features' }); },
    'close-drawer': () => { S.go({ drawer: null }); },
    'close-modal': () => { S.go({ modal: null }); },
    'scrim': (el, e) => { if (e.target === el) S.go({ modal: null }); },
    'menu': (el) => {
      const r = el.getBoundingClientRect();
      S.ui.menuPos = { x: r.right, y: r.bottom + 4 };
      S.ui.menu = S.ui.menu === el.dataset.menu ? null : el.dataset.menu;
      els.overlay.innerHTML = renderOverlay();
      els.top.innerHTML = renderTop();
      if (S.guideAfter) S.guideAfter();
    },
    'toggle-insp': () => { S.go({ inspOff: !S.ui.inspOff }); },
    'undo': () => { S.app.undo(); },
    'redo': () => { S.app.redo(); },
    'export': (el) => S.doExport(el.dataset.kind),
    'reset-ask': (el) => { if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) { S.toast('자동 편성 중에는 데이터를 바꿀 수 없습니다. 먼저 중지하세요.', 'warn'); return; } S.ui.resetKind = el.dataset.kind || 'blank'; S.ui.resetYear = null; S.go({ modal: 'reset', menu: null }); },
    'reset-go': (el) => {
      const y = S.ui.resetYear || S.seasonYear();
      S.ui.resetYear = null;
      if (y !== S.seasonYear()) S.switchYear(y, { quiet: true, to: 'stay' });
      if (el.dataset.kind === 'example') S.loadBuiltin(y); else S.resetAll();
    }
  });

  S.doExport = function (kind) {
    const app = S.app;
    S.ui.menu = null;
    if (kind === 'project') { app.exportProject(); S.toast('프로젝트 JSON을 내려받았습니다.', 'ok'); }
    else if (kind === 'engine') { app.exportEngine(); S.toast('엔진 호환 JSON(input_2025 형식)을 내려받았습니다.', 'ok'); }
    else if (kind === 'csv') { app.exportCSV(S.ui.team || null); S.toast('일정표 CSV를 내려받았습니다' + (S.ui.team ? ' (' + S.ui.team + ')' : '') + '.', 'ok'); }
    else if (kind === 'xlsx') S.toast('시안 예시: 2025_KBO_편성_배포본.xlsx (시트 6개 · 연전 기간 ' + app.state.calendar.length + ' · 시리즈 ' + app.state.matches.length + ')를 만들었다고 가정합니다.', 'info', 4200);
    else if (kind === 'template') S.toast('시안 예시: 빈 엑셀 양식.xlsx (안내 시트 + 시트별 제목 줄·예시 한 줄)를 받았다고 가정합니다.', 'info', 4200);
    if (kind !== 'template') S.ui.exported = true;
    S.render();
  };

  // ───────── 시작 ─────────
  S.start = function () {
    els.top = document.getElementById('topbar');
    els.stepper = document.getElementById('stepper');
    els.body = document.getElementById('body');
    els.footer = document.getElementById('footer');
    els.overlay = document.getElementById('overlay');
    const q = new URLSearchParams(location.search);
    S.debugScroll = q.get('debug') === 'scroll';
    S.selftestMode = q.get('selftest') === '1';
    if (q.get('fresh') === '1') { S.ls.del(S.KEY + 'features'); }
    S.loadFeatures();
    const app = S.app = new KBO.App({ appId: 'wizard-final', appName: '편성 스튜디오' });
    app.store.autosaveMs = -1;
    app.store.initial = S.seedProject;
    app.store.reset();
    app.state.meta.features = Object.assign({}, S.features);
    for (const v of app.derived().ex.violations) S.virtualSigs.add(S.vsig(v));
    // 기본 월: 첫 위반이 있는 달
    const ex = app.derived().ex;
    const first = ex.violations[0];
    S.ui.month = first ? KBO.Dates.month(app.derived().slots[first.slot].day) : 4;
    // 결과 공유 쪽에서 넘어온 조건·시드(?tol=&hol=&cd=&seed=). 가상 위반 표시를 정한 뒤에 실어, 조건 때문에 생긴 위반은 실제 위반으로 보인다
    const linked = app.applyLinkSettings(location.search);
    if (linked) {
      const tolWord = (km) => (km <= 150 ? '이동거리 거의 똑같게' : km <= 450 ? '이동거리 비슷하게' : '이동거리 달라도 괜찮게');
      const parts = [];
      if (linked.distanceToleranceKm) parts.push(tolWord(linked.distanceToleranceKm));
      if (linked.obligationTeams) parts.push('어린이날 홈 ' + linked.obligationTeams.join('·'));
      if (linked.seed != null && S.dev()) parts.push('시드 ' + linked.seed);
      setTimeout(() => KBO.UI.toast('공유 결과의 조건을 실었어요: ' + parts.join(' · '), 'info', 6000), 0);
    }
    app.subscribe(() => S.scheduleRender());
    // 시즌 연도: 주소의 year= 또는 이 브라우저에서 마지막으로 연 해. 2025를 저장한 적이 없으면 위의 예시 데이터 그대로
    S.autosave.start();
    const hy = +(S.parseHash().year || 0);
    if (hy > 2000) S.repo.setLastYear(hy);
    const by = hy > 2000 ? hy : S.repo.lastYear();
    if (by && (by !== 2025 || S.repo.has(2025))) S.switchYear(by, { boot: true, quiet: true, to: 'stay' });
    app.loadLocalConfig(); // 카카오 지도 키(.env → ui/config.local.json). 없으면 기본 지도
    app.probeRoad(); // 편성 서버의 도로거리 계산(카카오모빌리티 길찾기 중계)이 되는지
    app.setNavigator((target) => S.navTarget(target));
    S.applyRoute(S.parseHash());
    window.addEventListener('hashchange', () => { S.applyRoute(S.parseHash()); S.render(); });
    // 폭·높이 구간(1800px·900px)이 바뀌면 JS로 크기를 정한 차트·달력을 다시 그린다
    window.addEventListener('resize', () => { const w = window.innerWidth >= 1800, t = window.innerHeight >= 900; if (w !== S.wide || t !== S.tall) S.render(); else S.checkScroll(); });
    bindEvents();
    S.booted = true;
    S.render();
    if (S.ui.demo && S.demos[S.ui.demo]) { S.quiet = true; try { S.demos[S.ui.demo](); } finally { S.quiet = false; } }
    setTimeout(() => S.checkScroll(), 300);
    if (q.get('selftest') === '1') { const sc = document.createElement('script'); sc.src = 'app/studio/selftest.js'; document.body.appendChild(sc); }
  };
  S.demos = {};
  /** 점검용 주소 demo=blank: 처음부터 입력하기 상태로 시작한다(빈 표 화면 점검). 주소의 단계·화면은 그대로 둔다 */
  S.demos.blank = function () { S.resetAll({ quiet: true, stay: true }); };

  /** 사전 점검 링크 등에서 입력 위치로 이동 */
  S.navTarget = function (target) {
    const map = { teams: 'teams', distance: 'teams', slots: 'slots', series: 'series', events: 'events', season: 'season' };
    if (target === 'result') S.go({ step: 3, ops: null });
    else if (target === 'review') S.go({ step: 2, ops: null });
    else if (S.g1Open) S.g1Open(map[target] || 'slots', { flash: map[target] || null }); // ① 단계별 화면이면 그 표의 단계로
    else S.go({ step: 1, tab: map[target] || 'slots', ops: null, sel: null, flash: map[target] || null });
  };

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (S.ui.menu && !e.target.closest('.menu') && !(el && el.dataset.act === 'menu')) { S.ui.menu = null; els.overlay.innerHTML = renderOverlay(); els.top.innerHTML = renderTop(); }
      if (!el) return;
      const fn = S.actions[el.dataset.act];
      if (fn) { fn(el, e); }
    });
    const onInput = (e) => {
      const el = e.target.closest('[data-in]');
      if (!el) return;
      const fn = S.inputs[el.dataset.in];
      if (fn) fn(el, e);
    };
    document.addEventListener('change', onInput);
    document.addEventListener('input', (e) => { const el = e.target.closest('[data-live]'); if (!el) return; const fn = S.inputs[el.dataset.live]; if (fn) fn(el, e); });
    document.addEventListener('keydown', (e) => {
      // SVG 차트 요소(role=button)는 Enter/Space로 누른다
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.dataset && e.target.dataset.act && e.target.tagName.toLowerCase() !== 'button') {
        e.preventDefault(); const fn = S.actions[e.target.dataset.act]; if (fn) fn(e.target, e); return;
      }
      if (S.guideOnKey && S.guideOnKey(e) === true) return;
      if (S.onKey && S.onKey(e) === true) return;
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === 'Escape') {
        if (S.ui.menu) { S.ui.menu = null; S.render(); return; }
        if (S.ui.modal) { S.go({ modal: null }); return; }
        if (S.ui.drawer) { S.go({ drawer: null }); return; }
      }
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) S.app.redo(); else S.app.undo(); }
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'y')) { e.preventDefault(); S.app.redo(); }
    });
  }

  // ───────── 3분할 작업 공간 공통 ─────────
  /** opts: { list, main, insp, inspTitle, cls } */
  S.workspace = function (o) {
    const off = S.ui.inspOff;
    const insp = off
      ? '<aside class="insp-rail" aria-label="자세히(접힘)"><button class="btn sm icon ghost" data-act="toggle-insp" title="자세히 펼치기">' + icon('left') + '</button><span class="rail-label">자세히 · ' + esc(o.inspTitle || '') + '</span></aside>'
      : '<aside class="pane insp" aria-label="자세히"><div class="pane-head"><span class="pane-title">' + esc(o.inspTitle || '자세히') + '</span>' + (o.inspHead || '') + '<button class="btn sm icon ghost" style="margin-left:auto" data-act="toggle-insp" title="자세히 접기">' + icon('right') + '</button></div><div class="pane-body" data-sk="insp-' + S.ui.step + (S.ui.ops || '') + '">' + o.insp + '</div>' + (o.inspFoot ? '<div class="pane-foot">' + o.inspFoot + '</div>' : '') + '</aside>';
    return '<div class="workspace' + (off ? ' insp-off' : '') + (o.cls ? ' ' + o.cls : '') + '">' +
      '<nav class="pane list" aria-label="' + esc(o.listLabel || '목록') + '">' + o.list + '</nav>' +
      '<section class="pane main">' + o.main + '</section>' + insp + '</div>';
  };
  S.paneHead = (title, desc, right) => '<div class="pane-head"><span class="pane-title">' + esc(S.plain(title)) + '</span>' + (desc ? '<span class="pane-desc" title="' + esc(S.plain(desc)) + '">' + esc(S.plain(desc)) + '</span>' : '') + (right ? '<span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex:none">' + right + '</span>' : '') + '</div>';
  S.undoButtons = function () {
    const st = S.app.store;
    return '<span class="btn-group">' +
      '<button class="btn sm" data-act="undo" ' + (st.canUndo() ? 'title="실행 취소: ' + esc(S.plain(st.undoLabel())) + '"' : 'disabled') + '>' + icon('undo') + '실행 취소</button>' +
      '<button class="btn sm icon" data-act="redo" ' + (st.canRedo() ? 'title="다시 실행: ' + esc(S.plain(st.redoLabel())) + '"' : 'disabled') + '>' + icon('redo') + '</button></span>';
  };
  S.Score = Score;
})();
