/*
 * 편성 스튜디오 — ① 데이터 준비 입력 안내: 공통 바탕
 * 안내 내용(할 일 7개와 그 안의 짚어 줄 곳), 할 일마다 데이터로 판단하는 상태, 저장, 주소 키(guide=), 렌더 뒤 고리.
 * 보여 주는 방식(말풍선·체크리스트·따라 하기·번호 점)은 guide-*.js가 S.guideUI로 정한다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO } = S;
  const { CalendarGen } = KBO;
  const app = () => S.app;

  // ───────── 상태 판단 (데이터로) ─────────
  function sheetErrors(key) {
    const sh = S.SHEETS[key], st = app().state;
    const n = sh.rows(st).length;
    let e = 0, w = 0;
    for (let i = 0; i < n; i++) for (const x of sh.rowIssues(st, i)) { if (x.level === 'error') e++; else w++; }
    return { e, w };
  }
  /** 연전 수 맞추기: 연전 수(2·3·4)마다 「기간 수 × 구장 수」와 시리즈 수가 같은지 (오른쪽 자세히의 막대와 같은 계산) */
  S.guideBalance = function () {
    const st = app().state, half = st.teams.length >> 1;
    const sh = CalendarGen.lengthHistogram(st.calendar), mh = CalendarGen.lengthHistogram(st.matches);
    const off = [];
    for (const k of [2, 3, 4]) { const cap = (sh[k] || 0) * half, need = mh[k] || 0; if (cap !== need) off.push(k + '연전'); }
    return off;
  };
  function pairOff() {
    const st = app().state, target = st.settings.initialGamesPerPair;
    const names = st.teams.map((t) => t.name);
    const c = S.viz.pairCounts(st.matches, names);
    let off = 0;
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if ((c.get(names[i] + '|' + names[j]) || 0) + (c.get(names[j] + '|' + names[i]) || 0) !== target) off++;
    return off;
  }
  const res = (ok, text) => ({ ok: !!ok, kind: ok ? 'ok' : 'warn', text });

  // ───────── 안내 내용 ─────────
  // 할 일(task)마다 짚어 줄 곳(spots). target은 화면 요소 선택자, 없으면 가운데에 띄운다.
  const half = () => app().state.teams.length >> 1;
  const pairText = () => { const s = app().state.settings; return s.initialGamesPerPair + '경기(홈 ' + s.homeGamesMajor + ' · 원정 ' + (s.initialGamesPerPair - s.homeGamesMajor) + ')'; };
  S.GUIDE_TASKS = [
    {
      id: 'start', tab: null, title: '시작하기', short: '한꺼번에 가져오거나 하나씩 확인',
      why: '편성에 필요한 시즌 정보를 위에서 아래 순서로 채웁니다. 지금은 2025 실제 일정이 들어 있어서, 바꿀 곳만 고치면 됩니다.',
      spots: [
        { target: '.band', title: '엑셀로 한꺼번에 가져오기', text: () => '엑셀 파일이 있으면 「엑셀 올리기」로 모든 표를 한 번에 가져옵니다. 양식이 없으면 「빈 엑셀 양식」을 받아 채우세요. 가져오기 전에 무엇이 바뀌는지 먼저 보여 드립니다.' },
        { target: '.pane.list', title: '입력 순서', text: () => '왼쪽 목록을 위에서 아래로 차례대로 확인합니다. 초록 체크는 문제 없음, 빨간 표시는 고칠 곳이 있다는 뜻입니다.' }
      ],
      status: () => res(true, '2025 실제 일정이 들어 있음')
    },
    {
      id: 'season', tab: 'season', title: '시즌 기본 설정', short: '개막일·종료일·휴식 요일',
      why: '시즌이 언제 시작하고 끝나는지, 어느 요일에 쉬는지 정합니다. 연전 기간은 이 설정대로 만들어집니다.',
      spots: [
        { target: '.form-grid', title: '개막일과 종료일', text: () => '개막일, 1차 편성 종료일, 시즌 종료일을 적습니다. 2025-03-22나 3/22처럼 적으면 됩니다. 1차 편성 종료일 뒤는 취소된 경기를 다시 넣는 재편성 기간입니다.' },
        { target: '.wd', title: '휴식 요일', text: () => '경기가 없는 요일을 누릅니다. KBO는 보통 월요일에 쉽니다.' }
      ],
      status: () => { const s = app().state.settings; const ok = s.seasonStart < s.initialEnd && s.initialEnd <= s.seasonEnd && s.restWeekdays.length > 0; return res(ok, ok ? '개막 ' + S.fmt.short(s.seasonStart) + ' · 휴식 요일 ' + s.restWeekdays.length + '개' : '날짜 순서를 확인하세요'); }
    },
    {
      id: 'dates', tab: 'holidays', tabs: ['holidays', 'restex', 'blackouts'], title: '공휴일·휴식일 경기·휴식기', short: '쉬는 날과 특별한 날짜',
      why: '공휴일은 휴일 경기를 고르게 나눌 때 씁니다. 휴식일 경기는 휴식 요일이지만 경기를 하는 날, 휴식기는 경기가 없는 기간입니다.',
      spots: [
        { tab: 'season', target: '.season-subs', title: '세 가지 날짜 표', text: () => '공휴일(예: 6/6 현충일), 휴식일 경기(예: 5/5 월요일 어린이날), 휴식기(예: 올스타 휴식기)를 확인합니다. 「표 열기」를 누르면 고칠 수 있습니다.' },
        { tab: 'holidays', target: '#sheetScroll', title: '날짜 표 고치기', text: () => '칸을 두 번 누르거나 Enter를 눌러 고칩니다. 줄을 고르고 「아래에 추가」로 날짜를 더합니다. 오른쪽 시즌 달력에 바로 표시됩니다.' }
      ],
      status: () => { let e = 0; for (const k of ['holidays', 'restex', 'blackouts']) e += sheetErrors(k).e; const s = app().state.settings; return res(!e, e ? '오류 ' + e + '건' : '공휴일 ' + s.holidays.length + ' · 휴식일 경기 ' + s.restExceptions.length + ' · 휴식기 ' + s.blackouts.length); }
    },
    {
      id: 'slots', tab: 'slots', title: '연전 기간', short: '시리즈가 열리는 2~4일 묶음',
      why: '연전 기간은 구장마다 시리즈가 동시에 열리는 2~4일 묶음입니다. 한 줄이 한 기간이고, 자동 편성은 시리즈를 이 기간에 하나씩 넣습니다.',
      spots: [
        { target: '#sheetScroll', title: '한 줄이 한 연전 기간', text: () => half() + '개 구장에서 동시에 시리즈가 열리는 기간입니다. 시작일과 연전 수(2~4)만 맞으면 「기간」은 자동으로 계산됩니다. 주말과 휴일 등급은 휴일 경기를 고르게 나눌 때 씁니다.' },
        { target: '.toolbar [data-act="draft-slots"]', title: '규칙대로 자동 채우기', text: () => '하나씩 적기 어렵다면 이 단추를 누르세요. 시즌 기본 설정(개막일·휴식 요일·휴식기)대로 연전 기간을 만들고, 바꾸기 전에 먼저 보여 드립니다.' },
        { target: '.pane.insp', title: '오른쪽 자세히로 확인', text: () => '시즌 달력에 빈 곳이 없는지 보고, 「연전 수 맞추기」가 모두 「맞음」인지 확인합니다. 줄을 고르면 달력에 그 기간이 표시됩니다.' }
      ],
      status: () => { const e = sheetErrors('slots').e, off = S.guideBalance(); return res(!e && !off.length, e ? '오류 ' + e + '건' : off.length ? off.join('·') + ' 수가 시리즈와 다름' : app().state.calendar.length + '개 · 연전 수 맞음'); }
    },
    {
      id: 'series', tab: 'series', title: '시리즈', short: '맞대결마다 홈·원정·연전 수',
      why: '시리즈는 같은 두 구단이 한 구장에서 치르는 2~4연전입니다. 홈·원정·연전 수만 적고, 날짜는 ② 자동 편성이 정합니다.',
      spots: [
        { target: '#sheetScroll', title: '한 줄이 한 시리즈', text: () => '홈 구단, 원정 구단, 연전 수를 적습니다. 구단 이름이 틀리면 비슷한 이름을 찾아 바꿔 드립니다.' },
        { target: '.toolbar [data-act="draft-series"]', title: '맞대결 규칙대로 자동 채우기', text: () => '맞대결마다 ' + pairText() + '을 연전 기간 수에 맞게 나눠 채웁니다. 바꾸기 전에 먼저 보여 드립니다.' },
        { target: '.pane.insp', title: '맞대결 경기 수 확인', text: () => '오른쪽 표에서 두 구단의 경기 수 합이 모두 ' + app().state.settings.initialGamesPerPair + '인지 봅니다. 다른 곳은 노란 칸과 !로 표시됩니다.' }
      ],
      status: () => { const e = sheetErrors('series').e, off = pairOff(); return res(!e && !off, e ? '오류 ' + e + '건' : off ? '맞대결 ' + off + '곳 경기 수 다름' : app().state.matches.length + '개 · 맞대결 경기 수 맞음'); }
    },
    {
      id: 'events', tab: 'events', title: '특별 경기', short: '개막전·어린이날처럼 미리 정할 경기',
      why: '날짜를 미리 정해야 하는 경기를 적습니다. 대진 지정은 그 날짜의 대진을 고정하고, 구장 지정은 그 구장 구단이 꼭 홈 경기를 하게 합니다.',
      spots: [
        { target: '#sheetScroll', title: '대진 지정과 구장 지정', text: () => '개막전처럼 날짜와 대진을 정한 경기는 「대진 지정」, 어린이날처럼 그 구장 구단이 꼭 홈이어야 하는 날은 「구장 지정」입니다. 날짜는 연전 기간 안에 있어야 합니다.' }
      ],
      status: () => { const e = sheetErrors('events').e; return res(!e, e ? '오류 ' + e + '건' : app().state.events.length + '개'); }
    },
    {
      id: 'teams', tab: 'teams', title: '구단과 거리', short: '구단·구장 위치 (보통 그대로)',
      why: '구단과 구장 위치, 구장 사이 거리입니다. 이동거리를 계산할 때 씁니다. 구단이 바뀌지 않으면 고칠 일이 없습니다.',
      spots: [
        { target: '.pane.main', title: '구단과 구장', text: () => '구단을 고르면 오른쪽에 다른 구장까지 거리가 나옵니다. 잠실처럼 두 구단이 같이 쓰는 구장은 자동으로 알아봅니다.' }
      ],
      status: () => res(true, app().state.teams.length + '구단')
    },
    {
      id: 'next', tab: null, title: '다음 단계로', short: '② 검토·실행에서 한 번 더 점검',
      why: '모두 「문제 없음」이면 다음 단계로 넘어갑니다. ② 검토·실행에서 편성할 수 없는 입력이 있는지 한 번 더 점검합니다.',
      spots: [
        { target: '.footer .btn.primary', title: '다음: 검토·실행', text: () => '이 단추를 누르면 ② 검토·실행으로 갑니다. 입력은 언제든 다시 돌아와 고칠 수 있습니다.' }
      ],
      status: () => { const bad = S.GUIDE_TASKS.filter((t) => t.id !== 'next' && !t.status().ok); return res(!bad.length, bad.length ? bad.map((t) => t.title).join(', ') + ' 확인 필요' : '모두 확인됨'); }
    }
  ];
  /** 펼친 짚어 줄 곳 목록: [{task, spot, tab, n}] — 말풍선·번호 점이 쓴다 */
  S.guideSpots = function () {
    const out = [];
    for (const t of S.GUIDE_TASKS) for (const sp of t.spots) out.push({ task: t, spot: sp, tab: sp.tab || t.tab, n: out.length });
    return out;
  };
  S.guideTaskOfTab = (tab) => S.GUIDE_TASKS.find((t) => t.tab === tab || (t.tabs && t.tabs.includes(tab))) || null;

  // ───────── 저장 (안내 방식마다 따로) ─────────
  /** variant: 'tour' | 'check' | 'follow' | 'spot'. 반환: { get(), set(patch), reset() } — 값은 { seen, at, done:{} } */
  S.guideStore = function (variant) {
    const key = S.KEY + 'guide-' + variant;
    const read = () => { try { return JSON.parse(S.ls.get(key) || 'null') || {}; } catch (e) { return {}; } };
    return {
      get: () => Object.assign({ seen: false, at: 0, done: {} }, read()),
      set(patch) { const v = Object.assign(this.get(), patch); S.ls.set(key, JSON.stringify(v)); return v; },
      reset() { S.ls.del(key); }
    };
  };

  /** 처음 방문 자동 시작 가능 여부: 자가 점검·시연 상태·모달·서랍·시즌 운영이면 띄우지 않는다 */
  S.guideAutoOK = function () {
    const u = S.ui;
    return !S.selftestMode && !u.ops && u.step === 1 && !u.modal && !u.drawer && !u.demo && !u.menu;
  };
  /** 모달·서랍·메뉴가 열려 있으면 안내를 잠시 숨긴다 */
  S.guideBlocked = () => !!(S.ui.modal || S.ui.drawer || S.ui.menu || S.ui.ops);

  /** 안내가 다른 탭을 보여 줄 때: 목록에서 탭을 누른 것과 같게 바꾼다 */
  S.guideGoTab = function (tab) {
    if (!tab) return;
    if (S.ui.step !== 1 || S.ui.tab !== tab) S.go({ step: 1, ops: null, tab, edit: null, cell: null, vizChanged: null });
  };

  /** 화면 요소 위치 (보이는 첫 요소) */
  S.guideRect = function (sel) {
    if (!sel) return null;
    for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return r; }
    return null;
  };

  // ───────── 렌더 고리 ─────────
  // shell.js가 S.render 끝(스크롤 점검 전)에 S.guideAfter()를, 키 입력 때 S.guideOnKey(e)를 부른다.
  S.guideAfter = function () {
    const box = document.getElementById('guide');
    if (!box || !S.guideUI) return;
    try { S.guideUI.after(box); } catch (e) { console.error(e); }
  };
  S.guideOnKey = (e) => (S.guideUI && S.guideUI.onKey ? S.guideUI.onKey(e) : false);
  /** 띠의 「입력 안내」 단추 (안내 방식이 정함) */
  S.guideButton = () => (S.guideUI && S.guideUI.button ? S.guideUI.button() : '');
  window.addEventListener('resize', () => { if (S.app) { S.guideAfter(); S.checkScroll(); } });
})();
