/*
 * alt-a 편성 스튜디오 — ② 검토·실행
 * 왼쪽: 사전 점검 항목 / 가운데: 입력 요약 · 엔진 옵션·실행 · 점수 추이 / 오른쪽: 점검 항목 상세(입력 위치로 이동)
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Score, CalendarGen, Dates } = KBO;
  const app = () => S.app;
  const D = () => S.app.derived();
  const ORDER = { block: 0, warn: 1, pass: 2 };
  const KIND = { pass: 'ok', warn: 'warn', block: 'block' };
  const LBL = { pass: '통과', warn: '경고', block: '차단' };
  const TARGET_LABEL = { teams: '① 구단과 거리', distance: '① 구단과 거리', slots: '① 슬롯', series: '① 시리즈', events: '① 이벤트', result: '③ 결과·수정', season: '① 시즌 골격' };
  // 규칙 설명. 개발자 모드는 코드가 들어간 원문, 일반 모드는 쉬운 문장
  const EXPLAIN = {
    'teams-even': '구단 수가 홀수면 매 슬롯 한 구단이 쉬어야 해서 H0-a(출전 구단 수)를 만족할 수 없습니다.',
    shared: '같은 구장명을 쓰는 구단은 공유 구장으로 봅니다. 한 슬롯에 둘 다 홈이면 H0-b 위반입니다.',
    distance: '이동거리(S2, S4) 계산에 N×(N−1)개 거리가 모두 필요합니다.',
    slots: '슬롯은 ① 슬롯 시트에서 가져옵니다. 규칙으로 만든 초안과 다르면 경고합니다.',
    pairs: '구단쌍마다 1차 편성 경기 수가 같아야 공정합니다(기본 15경기).',
    events: '같은 슬롯에서 한 구단이 두 대진에 나오거나, 구장 지정과 대진 지정이 부딪히면 차단합니다.',
    pins: '고정 시리즈가 연전 수가 다른 슬롯에 있으면 H0-d 위반이 남습니다.',
    cap: 'k연전마다 「k연전 시리즈 수 ≤ k연전 슬롯 수 × (구단 수 / 2)」를 검사합니다. 부족하면 미배정(S0)이나 슬롯 과밀이 불가피해 차단하고, 남으면 빈 자리는 추가 휴식이라 경고만 합니다.'
  };
  const EXPLAIN_PLAIN = {
    'teams-even': '구단 수가 홀수면 매 슬롯 한 구단이 쉬어야 해서, 모든 구단이 슬롯마다 한 경기씩 치른다는 규칙을 지킬 수 없습니다.',
    shared: '같은 구장명을 쓰는 구단은 공유 구장으로 봅니다. 한 슬롯에 두 구단이 모두 홈이면 「한 구장에 두 경기」 위반입니다.',
    distance: '구단 이동거리를 계산하려면 모든 구단 사이의 거리가 필요합니다.',
    slots: EXPLAIN.slots, pairs: EXPLAIN.pairs, events: EXPLAIN.events,
    pins: '고정한 시리즈가 연전 수가 다른 슬롯에 있으면 「연전 수 불일치」 위반이 남습니다.',
    cap: '2·3·4연전마다 「시리즈 수 ≤ 슬롯 수 × (구단 수 / 2)」인지 봅니다. 시리즈가 더 많으면 놓을 자리가 없어 차단하고, 자리가 남으면 그만큼 쉬는 날이 늘 뿐이라 경고만 합니다.'
  };
  const explain = (k) => (S.dev() ? EXPLAIN[k] : EXPLAIN_PLAIN[k]) || '';
  // 실행 시간 프리셋 (W17) → solver.timeLimitSec
  // opt-2: 큰 선택 카드용으로 「언제 쓰나요」(when)와 꼼꼼함(depth 1~3)을 더했다
  // 서버 엔진(멀티스타트) 기준이다. 벤치마크(docs/ENGINE_SEED_BENCHMARK.md)에서 10초면 충분했고 서버 상한은 30초다.
  S.TIME_PRESETS = [
    { sec: 10, name: '빠르게', time: '10초', sub: '입력을 바꾼 뒤 빨리 확인', when: '입력을 조금 고친 뒤 결과를 빨리 볼 때 (대부분 충분)', depth: 1 },
    { sec: 20, name: '보통', time: '20초', sub: '조금 더 꼼꼼히', when: '평소 편성안을 만들 때', depth: 2 },
    { sec: 30, name: '충분히', time: '30초', sub: '배포 직전 최종안', when: '배포 직전 최종안을 만들 때', depth: 3 }
  ];
  /** 예전 프리셋(1·5·30분)으로 저장된 프로젝트를 새 값으로 옮긴다 */
  S.LEGACY_TIME = { 60: 10, 300: 20, 1800: 30 };
  /** 개선 없음 종료 시간: 실행 시간의 절반, 최소 5초 */
  S.unimprovedFor = (sec) => Math.max(5, Math.round(sec / 2));
  /**
   * 실제로 쓸 시작 방식. 지금 일정에 필수 규칙 위반이 있으면 「다듬기」로는 고치기 어려워(서버 30초 안에 위반이 남는다)
   * 「처음부터 새로 짜기」로 바꾼다. forced=true면 사용자 설정(KEEP)과 다르다는 뜻이다.
   */
  S.effectiveInit = function (sv) {
    const chosen = sv.init === 'SCRATCH' ? 'SCRATCH' : 'KEEP';
    if (chosen === 'KEEP' && !D().ex.feasible) return { v: 'SCRATCH', forced: true, chosen };
    return { v: chosen, forced: false, chosen };
  };
  S.INIT_MODES = [
    { v: 'KEEP', name: '지금 일정 다듬기', sub: '현재 배정에서 출발해 위반과 부담을 줄입니다', when: '지금 일정이 거의 맞고 몇 곳만 고칠 때' },
    { v: 'SCRATCH', name: '처음부터 새로 짜기', sub: '고정한 경기만 두고 나머지를 새로 배치합니다', when: '입력을 크게 바꿨거나 새 시즌일 때' }
  ];

  function items() {
    const pf = app().preflight();
    return pf.items.slice().sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  }

  function renderList() {
    const pf = app().preflight();
    const u = S.ui;
    let s = '<div class="pane-head"><span class="pane-title">사전 점검</span><span class="pane-desc">엔진 실행 전 구조 점검</span></div><div class="pane-body" data-sk="p-list">';
    s += '<div style="display:flex;gap:6px;padding:10px 12px 2px">' + S.stat('ok', '통과 ' + pf.counts.pass) + S.stat('warn', '경고 ' + pf.counts.warn) + S.stat('block', '차단 ' + pf.counts.block) + '</div>';
    for (const g of ['block', 'warn', 'pass']) {
      const list = items().filter((x) => x.status === g);
      if (!list.length) continue;
      s += '<div class="label">' + LBL[g] + '<span class="cnt">' + list.length + '</span></div>';
      for (const it of list) {
        const on = u.sel === 'p:' + it.id;
        s += '<button class="li v' + (on ? ' active' : '') + '" data-act="p-sel" data-id="' + esc(it.id) + '"><span class="ico">' + S.statIcon(KIND[it.status]) + '</span><span class="li-main">' + esc(S.plain(it.title)) + '<span class="li-sub">' + esc(S.plain(it.detail)) + '</span></span></button>';
      }
    }
    return s + '</div>';
  }

  function summary() {
    const st = app().state, set = st.settings, c = D();
    const h = CalendarGen.lengthHistogram(st.calendar);
    const games = st.matches.reduce((a, m) => a + m.consecutive, 0);
    const days = Dates.dayNum(set.initialEnd) - Dates.dayNum(set.seasonStart) + 1;
    const shared = app().sharedStadiums();
    const kv = (k, v, s2) => '<div class="kv"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div><div class="s" title="' + esc(s2) + '">' + esc(s2) + '</div></div>';
    return '<div class="kv-row">' +
      kv('구단', st.teams.length, '공유 구장 ' + shared.size + ' (잠실)') +
      kv('1차 편성 기간', fmt.short(set.seasonStart) + '~' + fmt.short(set.initialEnd), days + '일 · 휴식 월요일') +
      kv('슬롯', st.calendar.length, '2·3·4연전 ' + (h[2] || 0) + '·' + (h[3] || 0) + '·' + (h[4] || 0)) +
      kv('경기 없는 기간', set.blackouts.length, set.blackouts.map((b) => fmt.short(b.start) + (b.end !== b.start ? '~' + fmt.short(b.end) : '')).join(', ')) +
      kv('이벤트', st.events.length, '대진 ' + st.events.filter((e) => e.mode === 'MATCH').length + ' · 구장 ' + st.events.filter((e) => e.mode === 'STADIUM').length) +
      kv('시리즈', st.matches.length, games + '경기') +
      kv('구단쌍', '45', set.initialGamesPerPair + '경기씩') +
      kv('고정', st.matches.filter((m) => m.pinned).length, '개막전 대진 지정') + '</div>';
  }

  /** 시뮬레이션 점수 곡선: t(0..1) → [hardSum, softSum] */
  function curve(t) {
    const fin = Score.flat(D().ex.score);
    const fh = fin[0] + fin[1], fs = fin.slice(2).reduce((a, b) => a + b, 0);
    const k = Math.pow(1 - t, 2.4);
    const hard = Math.round(fh + (-58 - fh) * k);
    const soft = Math.round(fs + (-4200000 - fs) * Math.pow(1 - t, 1.6));
    return [hard, soft];
  }
  function buildHistory(upto, limitMs) {
    const h = [];
    const n = Math.max(2, Math.round(upto * 60));
    for (let i = 0; i <= n; i++) { const t = (i / 60); const [a, b] = curve(Math.min(1, t)); h.push({ t: t * (limitMs || 60000), hard: a, soft: b }); }
    return h;
  }

  function trend() {
    const r = S.run && S.run.history ? S.run : S.lastRun;
    if (!r || !r.history || r.history.length < 2) {
      return '<div class="trend" style="flex:1;justify-content:center;align-items:center"><div class="empty"><b>' + icon('chart') + ' 점수 추이</b>실행하면 개선 해를 찾을 때마다 Hard·Soft 점수가 여기에 그려집니다.</div></div>';
    }
    const H = r.history;
    const W = S.wide ? 620 : 410;
    const labels = H.map((x) => fmt.time(x.t));
    const hard = KBO.Chart.line({ series: [{ label: 'Hard 합', color: '#B3261E', values: H.map((x) => x.hard), emphasis: true }], xLabels: labels, xEvery: Math.ceil(H.length / 6), width: W, height: S.wide ? 170 : 150, title: 'Hard 점수 추이', endLabels: false });
    const soft = KBO.Chart.line({ series: [{ label: 'Soft 합', color: '#1F5FD6', values: H.map((x) => Math.round(x.soft / 1000)), emphasis: true }], xLabels: labels, xEvery: Math.ceil(H.length / 6), width: W, height: S.wide ? 170 : 150, title: 'Soft 점수 추이', endLabels: false, format: (v) => fmt.int(v) + 'k' });
    const last = H[H.length - 1];
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="trend"><div class="chart-title"><b class="small">Hard 합</b><span class="mono small" style="color:var(--bad)">' + fmt.neg(last.hard) + '</span><span class="small muted">0이면 편성 가능</span></div>' + hard + '</div>' +
      '<div class="trend"><div class="chart-title"><b class="small">Soft 합</b><span class="mono small" style="color:var(--blue)">' + fmt.neg(last.soft) + '</span><span class="small muted">천 단위</span></div>' + soft + '</div></div>';
  }

  // ───────── opt-2: 큰 선택 카드 ─────────
  /** 실행 시간 그림: 60분 눈금판에 실행 시간만큼 부채꼴을 칠한다(1분 = 6°, 5분 = 30°, 30분 = 180°) */
  function timeGlyph(sec) {
    const deg = Math.max(6, Math.min(360, sec * 6)), r = 13, cx = 18, cy = 20; // 60초 눈금판
    const rad = (d) => (d - 90) * Math.PI / 180;
    const px = (d) => (cx + r * Math.cos(rad(d))).toFixed(2), py = (d) => (cy + r * Math.sin(rad(d))).toFixed(2);
    let ticks = '';
    for (let i = 0; i < 12; i++) { const d = i * 30, r1 = i % 3 === 0 ? r - 3.5 : r - 2; ticks += '<line x1="' + (cx + r1 * Math.cos(rad(d))).toFixed(2) + '" y1="' + (cy + r1 * Math.sin(rad(d))).toFixed(2) + '" x2="' + px(d) + '" y2="' + py(d) + '" stroke="#9AA8C2" stroke-width="1"/>'; }
    return '<svg class="bc-glyph" viewBox="0 0 36 36" aria-hidden="true"><rect x="15" y="2" width="6" height="3" rx="1" fill="#22406F"/><line x1="18" y1="5" x2="18" y2="7" stroke="#22406F" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 1.5) + '" fill="#fff" stroke="#22406F" stroke-width="1.6"/>' + ticks +
      '<path d="M' + cx + ' ' + cy + 'L' + px(0) + ' ' + py(0) + 'A' + r + ' ' + r + ' 0 ' + (deg > 180 ? 1 : 0) + ' 1 ' + px(deg) + ' ' + py(deg) + 'Z" fill="#1F5FD6" fill-opacity=".85"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + px(deg) + '" y2="' + py(deg) + '" stroke="#0A1E3C" stroke-width="1.6" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="1.8" fill="#0A1E3C"/></svg>';
  }
  /** 시작 방식 그림: 다듬기 = 채운 칸 사이 맞바꾸기 화살표, 새로 짜기 = 빈 칸(점선) + 고정 칸 + 다시 짜기 화살표 */
  function initGlyph(v) {
    let s = '<svg class="bc-glyph" viewBox="0 0 36 36" aria-hidden="true">';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = 4 + c * 10, y = 6 + r * 9, pin = r === 0 && c === 0;
      s += v === 'KEEP'
        ? '<rect x="' + x + '" y="' + y + '" width="8" height="7" rx="1" fill="' + ((r === 1 && c === 0) || (r === 1 && c === 2) ? '#1F5FD6' : '#C9D4E6') + '"/>'
        : '<rect x="' + x + '" y="' + y + '" width="8" height="7" rx="1" fill="' + (pin ? '#0A1E3C' : '#fff') + '" stroke="' + (pin ? '#0A1E3C' : '#9AA8C2') + '" stroke-dasharray="' + (pin ? '0' : '2 1.5') + '"/>';
    }
    s += v === 'KEEP'
      ? '<path d="M8 13.5 C 12 10, 24 10, 28 13.5" fill="none" stroke="#0A1E3C" stroke-width="1.5"/><path d="M26 11.2 L28.6 13.8 L25.2 14.6" fill="none" stroke="#0A1E3C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<circle cx="27" cy="27" r="7" fill="#fff"/><path d="M31.5 26 A4.6 4.6 0 1 1 29.4 23" fill="none" stroke="#1F5FD6" stroke-width="1.8" stroke-linecap="round"/><path d="M28 21.4 L30.2 23.4 L27.6 24.6" fill="none" stroke="#1F5FD6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
    return s + '</svg>';
  }

  /** 일반 옵션 (W17): 실행 시간 + 시작 방식. opt-2: 큰 선택 카드 */
  S.reviewSimpleOptions = function (sv, running) {
    const dis = running ? ' disabled' : '';
    const pinned = app().state.matches.filter((m) => m.pinned).length;
    const cur = S.TIME_PRESETS.find((p) => p.sec === sv.timeLimitSec);
    const eff = S.effectiveInit(sv);
    const initV = eff.v;
    const mode = S.INIT_MODES.find((m) => m.v === initV);
    const nViol = D().ex.violations.length;
    const check = '<span class="bc-check" aria-hidden="true">' + icon('check') + '</span>';
    const timeCard = (p) => {
      const on = p.sec === sv.timeLimitSec;
      const stopSec = S.unimprovedFor(p.sec);
      return '<button class="choice bc' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="run-time" data-v="' + p.sec + '"' + dis + ' aria-label="' + esc(p.name + ' ' + p.time + ' — ' + p.when) + '">' + check +
        '<span class="bc-top">' + timeGlyph(p.sec) + '<span class="bc-name"><b>' + esc(p.name) + '</b><span class="bc-time">' + esc(p.time) + '</span></span></span>' +
        '<span class="bc-meter" title="오래 찾을수록 대체로 더 좋은 일정이 나옵니다">꼼꼼함 ' + [1, 2, 3].map((i) => '<i class="' + (i <= p.depth ? 'f' : '') + '"></i>').join('') + '</span>' +
        '<span class="bc-exp">최대 ' + esc(p.time) + ' · 더 나아지지 않으면 ' + esc(stopSec >= 60 ? Math.floor(stopSec / 60) + '분' + (stopSec % 60 ? ' ' + (stopSec % 60) + '초' : '') : stopSec + '초') + ' 뒤 끝</span>' +
        '<span class="bc-when"><em>언제</em>' + esc(p.when) + '</span></button>';
    };
    const initCard = (m) => {
      const on = initV === m.v;
      return '<button class="choice bc' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="solver-init" data-v="' + m.v + '"' + dis + ' aria-label="' + esc(m.name + ' — ' + m.sub) + '">' + check +
        '<span class="bc-top">' + initGlyph(m.v) + '<span class="bc-name wrap"><b>' + esc(m.name) + '</b></span></span>' +
        '<span class="bc-sub">' + esc(m.sub) + '</span>' +
        '<span class="bc-when"><em>언제</em>' + esc(m.when) + '</span></button>';
    };
    return '<div class="simple-opts big">' +
      '<div class="field"><span id="lbl-time">실행 시간 <span class="muted">— 오래 둘수록 더 꼼꼼히 찾습니다</span></span><div class="choices big" role="radiogroup" aria-labelledby="lbl-time">' + S.TIME_PRESETS.map(timeCard).join('') + '</div>' +
        (!cur ? '<span class="small muted">' + icon('info') + '개발자 옵션에서 정한 ' + esc(fmt.time(sv.timeLimitSec * 1000)) + '을 씁니다.</span>' : '') + '</div>' +
      '<div class="field"><span id="lbl-init">시작 방식</span><div class="choices big" role="radiogroup" aria-labelledby="lbl-init">' + S.INIT_MODES.map(initCard).join('') + '</div>' +
        (eff.forced ? '<span class="small muted init-forced">' + icon('info') + '지금 일정에 ' + esc(S.termPlain('hardViol')) + ' ' + nViol + '건이 있어 이번 실행은 「처음부터 새로 짜기」로 합니다. 다듬기는 위반이 없을 때 쓸 수 있습니다.</span>' : '') + '</div>' +
      '</div>' +
      '<div class="keep-line bc-pick">' + icon('play') + '<span><b>' + esc(cur ? cur.name + ' ' + cur.time : '직접 지정 ' + fmt.time(sv.timeLimitSec * 1000)) + '</b> · <b>' + esc(mode.name) + '</b>로 시작합니다. ' + (initV === 'SCRATCH' ? '고정은 개막전·어린이날 시리즈만 유지됩니다.' : '고정한 경기 <b>' + pinned + '개</b>는 그대로 둡니다.') + '</span><span class="muted small">고정은 ③ 결과·수정에서 바꿉니다.</span></div>';
  };

  /** 개발자 옵션 (W17) — 개발자 모드에서만 DOM에 만든다 */
  S.reviewDevOptions = function (sv, running, r) {
    if (!S.dev()) return '';
    const open = !!S.ui.devOpen;
    let s = '<div class="devopt' + (open ? ' open' : '') + '"><button class="devopt-head" data-act="dev-open" aria-expanded="' + open + '">' + icon(open ? 'down' : 'right') + '<b>개발자 옵션</b><span class="muted small">최대 시간 · 개선 없음 종료 · 시드 · 개선 횟수 · Hard/Soft 최고 · 점수 추이</span><span class="tag ref" style="margin-left:auto">개발자 모드</span></button>';
    if (!open) return s + '</div>';
    const best = running ? r.history[r.history.length - 1] : S.lastRun ? S.lastRun.history[S.lastRun.history.length - 1] : null;
    const dis = running ? ' disabled' : '';
    s += '<div class="devopt-body"><div class="opt-row">' +
      '<label class="field"><span>최대 실행 시간</span><span style="display:flex;gap:4px;align-items:center"><input class="input sm" style="width:72px" value="' + sv.timeLimitSec + '" data-in="solver" data-k="timeLimitSec"' + dis + '>초</span></label>' +
      '<label class="field"><span>개선 없음 종료</span><span style="display:flex;gap:4px;align-items:center"><input class="input sm" style="width:64px" value="' + sv.unimprovedSec + '" data-in="solver" data-k="unimprovedSec"' + dis + '>초</span></label>' +
      '<label class="field"><span>시드</span><input class="input sm" style="width:64px" value="' + sv.seed + '" data-in="solver" data-k="seed"' + dis + '></label>' +
      '<div class="field"><span>초기해</span><span class="mono small" style="height:24px;display:flex;align-items:center">init = ' + esc(sv.init || 'KEEP') + '</span></div></div>' +
      '<div class="run-stats" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><div class="k">개선 횟수</div><div class="v">' + (running ? r.improvements : S.lastRun ? S.lastRun.improvements : 0) + '</div></div>' +
      '<div><div class="k">현재 최고 (Hard / Soft 합)</div><div class="v">' + (best ? fmt.neg(best.hard) + ' / ' + fmt.neg(best.soft) : '-') + '</div></div>' +
      '<div><div class="k">원점수 (BendableLongScore)</div><div class="v" style="font-size:12px">' + esc(fmt.score(D().ex.score)) + '</div></div></div>' +
      '<div class="label" style="padding:2px 0 6px">점수 추이 ' + (!running && S.lastRun && S.lastRun.when ? '<span class="tag ref">지난 실행 · ' + esc(S.lastRun.when) + '</span>' : '') + '</div>' + trend() + '</div>';
    return s + '</div>';
  };

  /** 실행 상태 문장 */
  function statusLine(r, running) {
    const n = D().ex.violations.length;
    if (running) {
      if (r.queue != null) return '서버 대기 중 — 앞에 ' + Math.max(0, r.queue - 1) + '건';
      const last = r.history[r.history.length - 1];
      const cnt = last ? Math.max(n, Math.round(-last.hard)) : n;
      return r.status === 'PAUSED' ? '일시정지 — 화면 갱신만 멈춥니다' : (last ? '더 나은 일정을 찾는 중 · ' + S.termPlain('hardViol') + ' ' + cnt + '건' : '엔진 시작 중 · 첫 개선 해를 기다립니다');
    }
    if (S.lastRun) return '끝났습니다(' + S.lastRun.reason + ') · ' + (n ? S.termPlain('hardViol') + ' ' + n + '건 남음' : '편성 가능');
    return '대기 중 — 「편성 시작」을 누르세요';
  }

  /** 지난 실행 결과: 일반 사용자가 할 일 중심 */
  function lastResult() {
    if (!S.lastRun) return '';
    const ex = D().ex, c = D();
    const over = ex.teamMetrics.filter((t) => t.overDistance);
    const n = ex.violations.length;
    const row = (kind, text, act) => '<div class="res-row">' + S.statIcon(kind) + '<span class="grow">' + text + '</span>' + (act || '') + '</div>';
    return '<div class="blk"><div class="blk-head">' + icon('check') + '지난 실행 결과<span class="r small muted">' + esc(S.lastRun.when) + ' · ' + S.lastRun.count + '회째 · ' + esc(fmt.time(S.lastRun.elapsed)) + '</span></div><div class="blk-body res-list">' +
      row(n ? 'block' : 'ok', n ? '<b>' + esc(S.termPlain('hardViol')) + ' ' + n + '건</b> — ' + esc(Array.from(new Set(ex.violations.map((v) => S.ruleName(v.code)))).join(', ')) : esc(S.termPlain('hardViol')) + ' 없음 — 편성 가능', n ? '<button class="btn sm" data-act="go-step" data-step="3">' + icon('right') + '③ 결과·수정에서 고치기</button>' : '') +
      row(c.pool.length ? 'warn' : 'ok', c.pool.length ? '미배정 시리즈 ' + c.pool.length + '개' : '모든 시리즈가 슬롯에 놓였습니다') +
      row(over.length ? 'warn' : 'ok', over.length ? '이동거리가 허용 범위(평균 ±300km)를 넘는 구단 ' + over.length + '개 — ' + esc(over.map((t) => t.name).join(', ')) : '모든 구단 이동거리가 허용 범위 안', '<button class="btn sm" data-act="q-view" data-qv="metrics">' + icon('right') + '④ 지표에서 보기</button>') +
      '</div></div>';
  }

  function renderMain() {
    const st = app().state, sv = st.settings.solver, pf = app().preflight();
    const r = S.run;
    const running = r && (r.status === 'RUNNING' || r.status === 'PAUSED');
    const limit = S.runLimitMs(sv);
    const pct = running ? Math.min(100, Math.round(r.elapsed / r.limit * 100)) : (S.lastRun ? 100 : 0);
    const blocked = !pf.ok;
    const rest = app().engineConfig.kind === 'REST';
    const info = (app().engineConfig && app().engineConfig.info) || {};
    const engineTag = rest
      ? '<span class="tag ok" title="' + esc(app().engine.label) + '">서버 엔진 · OptaPlanner 멀티스타트' + (info.defaultSeeds ? ' ' + info.defaultSeeds + '시드' : '') + '</span>'
      : '<span class="tag ref" title="서버가 없어 브라우저 안 로컬서치를 씁니다">브라우저 시뮬레이션 엔진 — 품질 보장 없음</span>';
    let s = S.paneHead('검토·실행', '입력을 한눈에 확인하고, 사전 점검을 통과하면 편성을 시작합니다.', '');
    s += '<div class="pane-body pad" data-sk="p-main" style="display:flex;flex-direction:column;gap:12px">';
    s += '<div><div class="label" style="padding:0 0 6px">입력 요약</div>' + summary() + '</div>';
    s += '<div class="blk"><div class="blk-head">' + icon('bolt') + '편성 실행' + engineTag + '<span class="r">' +
      (running ? '<span class="lock-pill">' + icon('lock') + '입력 잠김 — ① 데이터 준비 편집 불가</span>' : '') + '</span></div><div class="blk-body engine">';
    // 실행 중에는 진행 막대·경과 시간·상태 문장만 보여 준다(W17)
    if (!running) s += S.reviewSimpleOptions(sv, running);
    else s += '<div class="keep-line">' + icon('clock') + '<span>' + esc((S.TIME_PRESETS.find((p) => p.sec === sv.timeLimitSec) || { name: '직접 지정' }).name) + ' ' + esc(fmt.time(r.limit)) + ' · ' + esc((S.INIT_MODES.find((m) => m.v === (sv.init === 'SCRATCH' ? 'SCRATCH' : 'KEEP')) || {}).name || '') + '</span><span class="muted small">끝나면 ③ 결과·수정으로 갑니다. 그동안 ① 데이터 준비는 잠깁니다.</span></div>';
    if (blocked) s += '<div class="confirm-box" style="border-color:var(--bad-line);background:var(--bad-bg);color:var(--bad)">' + icon('block') + '차단 ' + pf.counts.block + '건 — 왼쪽 목록의 차단 항목을 먼저 고치세요. <button class="btn xs" data-act="p-goto" data-target="' + esc(pf.items.find((x) => x.status === 'block').target) + '">입력 위치로 이동</button></div>';
    s += '<div class="run-line"><div class="run-prog"><div class="progress" role="progressbar" aria-label="편성 진행" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
      '<div class="run-meta"><span class="run-status" aria-live="polite">' + (running ? '<span class="eng-dot' + (r.status === 'PAUSED' ? ' pause' : '') + '"></span>' : S.lastRun ? icon('check') : icon('clock')) + esc(statusLine(r, running)) + '</span><span class="mono small">' + pct + '% · 경과 ' + fmt.time(running ? r.elapsed : S.lastRun ? S.lastRun.elapsed : 0) + ' / ' + fmt.time(running ? r.limit : limit) + '</span></div></div>' +
      '<span class="run-btns">' +
      (running
        ? (r.status === 'PAUSED' ? '<button class="btn" data-act="run-resume">' + icon('play') + '재개</button>' : '<button class="btn" data-act="run-pause">' + icon('pause') + '일시정지</button>') + '<button class="btn danger" data-act="run-stop">' + icon('stop') + '중지</button>'
        : '<button class="btn primary lg go" data-act="run-start"' + (blocked ? ' disabled title="사전 점검 차단 항목이 있습니다"' : '') + '>' + icon('play') + '편성 시작</button>') +
      '</span></div>';
    s += '</div></div>';
    s += S.reviewDevOptions(sv, running, r);
    if (!running) s += lastResult();
    s += '</div>';
    return s;
  }

  function renderInsp() {
    const u = S.ui;
    const list = items();
    let it = u.sel && u.sel.startsWith('p:') ? list.find((x) => 'p:' + x.id === u.sel) : null;
    if (!it) it = list[0];
    if (!it) return { title: '점검 상세', html: '<div class="empty">점검 항목이 없습니다.</div>' };
    const key = Object.keys(EXPLAIN).find((k) => it.id === k) || (it.id.startsWith('cap-') ? 'cap' : null);
    const exp = key ? explain(key) : '';
    let s = '<div class="insp-sec"><div class="insp-title">' + esc(S.plain(it.title)) + '</div><div style="margin-top:6px">' + S.stat(KIND[it.status], LBL[it.status]) + '</div></div>';
    s += '<div class="insp-sec"><h4>결과</h4><div>' + esc(S.plain(it.detail)) + '</div></div>';
    if (exp) s += '<div class="insp-sec"><h4>규칙</h4><div class="small">' + esc(exp) + '</div></div>';
    if (it.id.startsWith('cap-')) {
      const k = +it.id.slice(4);
      const st = app().state;
      const sh = CalendarGen.lengthHistogram(st.calendar), mh = CalendarGen.lengthHistogram(st.matches);
      s += '<div class="insp-sec"><h4>계산</h4><dl class="props"><dt>' + k + '연전 시리즈</dt><dd class="mono">' + (mh[k] || 0) + '</dd><dt>' + k + '연전 슬롯</dt><dd class="mono">' + (sh[k] || 0) + '</dd><dt>슬롯당 수용</dt><dd class="mono">' + (st.teams.length >> 1) + '</dd><dt>수용 합계</dt><dd class="mono">' + (sh[k] || 0) * (st.teams.length >> 1) + '</dd></dl></div>';
    }
    s += '<div class="insp-sec"><h4>입력 위치</h4><button class="btn sm" data-act="p-goto" data-target="' + esc(it.target) + '">' + icon('right') + esc(TARGET_LABEL[it.target] || it.target) + '(으)로 이동</button></div>';
    return { title: '점검 상세', html: s };
  }

  S.steps[2] = {
    render() {
      if (S.lastRun === undefined) S.lastRun = null; // 실제 실행 전에는 지난 실행이 없다
      const sv0 = app().state.settings.solver;
      if (S.LEGACY_TIME[sv0.timeLimitSec] && !app().isRunning()) app().updateSolverSettings({ timeLimitSec: S.LEGACY_TIME[sv0.timeLimitSec], unimprovedSec: S.unimprovedFor(S.LEGACY_TIME[sv0.timeLimitSec]) });
      S.wide = window.innerWidth >= 1800;
      const insp = renderInsp();
      return '<div class="stepview no-band">' + S.workspace({ list: renderList(), main: renderMain(), insp: insp.html, inspTitle: insp.title, listLabel: '사전 점검' }) + '</div>';
    }
  };

  // ───────── 엔진 실행 (목업) ─────────
  let timer = null;
  /** 시연 상태 전용: 실제 실행 없이 잠금만 흉내 낸다 */
  function setLock(on) { app().run = on ? { status: 'RUNNING', handle: { pause() {}, resume() {}, stop() {} } } : null; }
  /** 서버 엔진이면 서버 한도(maxSeconds) 안으로 자른 실행 시간(ms). 진행 막대 기준이다. */
  S.runLimitMs = function (sv) {
    const sec = sv.timeLimitSec || 60;
    const info = app().engineConfig && app().engineConfig.info;
    return (app().engineConfig.kind === 'REST' && info && info.maxSeconds ? Math.min(sec, info.maxSeconds) : sec) * 1000;
  };
  /** app.run.history([{t, score:[h0,h1,s0..]}]) → 추이 차트 형식([{t, hard, soft}]) */
  function historyOf(ar) {
    return (ar.history || []).map((x) => ({ t: x.t, hard: x.score[0] + x.score[1], soft: x.score.slice(2).reduce((a, b) => a + b, 0) }));
  }
  /**
   * 편성 시작: 실제 엔진을 부른다(서버가 있으면 REST 멀티스타트, 없으면 브라우저 Mock).
   * S.run은 화면용 상태이고, 진짜 실행 상태는 app().run이다.
   */
  S.startRun = function () {
    if (S.run && S.run.status !== 'DONE') return;
    if (!app().preflight().ok) { S.toast('사전 점검 차단 항목이 있어 실행할 수 없습니다.', 'bad'); return; }
    const sv = app().state.settings.solver;
    const limit = S.runLimitMs(sv);
    const eff = S.effectiveInit(sv);
    if (eff.forced) S.toast('지금 일정에 ' + S.termPlain('hardViol') + '이 있어 처음부터 새로 짭니다.', 'info', 4000);
    if (!app().solve({ quiet: true, init: eff.v })) return; // 끝·오류 안내는 finish()가 일반 용어로 띄운다
    const ar = app().run;
    const run = S.run = { status: 'RUNNING', elapsed: 0, improvements: 0, history: [], limit, queue: null, seeds: {}, engine: ar.engineLabel, startedAt: Date.now() };
    const alive = () => S.run === run && app().run === ar;
    const sync = () => { if (!alive()) return; run.improvements = ar.improvements || 0; run.history = historyOf(ar); if (ar.elapsedMs) run.elapsed = Math.max(run.elapsed, ar.elapsedMs); };
    const h = ar.handle;
    h.on('queued', (q) => { if (alive()) { run.queue = q.position; run.startedAt = Date.now(); S.render(); } });
    h.on('server-status', () => { if (alive()) { run.queue = null; run.startedAt = Date.now(); S.render(); } });
    h.on('seed-best', (p) => { if (alive()) run.seeds[p.seed] = p; });
    h.on('best', () => { sync(); if (alive()) S.render(); });
    h.on('done', (p) => { sync(); if (alive()) finish(p.reason); });
    h.on('error', (e) => { if (alive()) finish('ERROR', e && e.message); });
    clearInterval(timer);
    timer = setInterval(() => {
      if (!alive()) { clearInterval(timer); return; }
      if (run.status === 'RUNNING' && run.queue == null) { run.elapsed = Math.max(run.elapsed, Date.now() - run.startedAt); S.render(); }
    }, 500);
    S.render();
  };
  function finish(reason, message) {
    clearInterval(timer);
    const r = S.run;
    if (!r) return;
    const why = { TIME_LIMIT: '최대 실행 시간', UNIMPROVED: '개선 없음', STOPPED: '사용자 중지', ERROR: '오류' }[reason] || reason;
    S.lastRun = { history: r.history, elapsed: r.elapsed, improvements: r.improvements, reason: why, count: ((S.lastRun && S.lastRun.count) || 0) + 1, when: '방금 ' + fmt.clock(new Date()), engine: r.engine, seeds: r.seeds };
    S.run = null;
    if (reason === 'ERROR') { S.toast('편성 실패 — ' + (message || '엔진 오류'), 'bad', 7000); S.render(); return; }
    const ex = D().ex;
    S.toast('편성 끝 (' + why + ') — ' + S.scoreLine(ex) + ' · ③ 결과·수정으로 이동합니다.', ex.feasible ? 'ok' : 'warn', 4500);
    S.go({ step: 3, sel: ex.violations.length ? 'v:' + S.vsig(ex.violations[0]) : null });
  }
  Object.assign(S.actions, {
    'run-start': () => S.startRun(),
    'run-pause': () => { if (S.run) { S.run.status = 'PAUSED'; app().pause(); S.render(); } },
    'run-resume': () => { if (S.run) { S.run.status = 'RUNNING'; app().resume(); S.render(); } },
    'run-stop': () => { if (S.run) { if (app().isRunning()) app().stop(); else finish('STOPPED'); } },
    'p-sel': (el) => S.go({ sel: 'p:' + el.dataset.id }),
    'p-goto': (el) => S.navTarget(el.dataset.target),
    'solver-init': (el) => app().updateSolverSettings({ init: el.dataset.v }),
    'run-time': (el) => { const sec = +el.dataset.v; app().updateSolverSettings({ timeLimitSec: sec, unimprovedSec: S.unimprovedFor(sec) }); },
    'dev-open': () => S.go({ devOpen: !S.ui.devOpen })
  });
  S.inputs.solver = (el) => { const v = parseInt(el.value, 10); if (Number.isFinite(v) && v > 0) app().updateSolverSettings({ [el.dataset.k]: v }); };

  // 시연 상태 (P5): 차단 항목 — 시리즈 한 행을 넣어 3연전 용량을 넘긴다
  S.demos.block = function () {
    S.ui.step = 1; S.ui.tab = 'series'; S.ui.cell = { sheet: 'series', row: 10, col: 'home' };
    S.insertRow('below');
    const pf = app().preflight();
    const b = pf.items.find((x) => x.status === 'block');
    S.ui.step = 2; S.ui.sel = b ? 'p:' + b.id : null;
    S.render();
  };
  // 시연 상태 (P5): 실행 중 62%에서 멈춘 화면
  S.demos.running = function () {
    const limit = (app().state.settings.solver.timeLimitSec || 60) * 1000;
    S.run = { status: 'RUNNING', elapsed: Math.round(0.62 * limit), improvements: 41, history: buildHistory(0.62, limit), limit };
    setLock(true);
    S.ui.step = 2; S.ui.ops = null;
    S.render();
  };
})();
