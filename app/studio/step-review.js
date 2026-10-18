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
  S.TIME_PRESETS = [
    { sec: 60, name: '빠르게', time: '1분', sub: '입력을 바꾼 뒤 빨리 확인' },
    { sec: 300, name: '보통', time: '5분', sub: '대부분 이 정도면 충분' },
    { sec: 1800, name: '충분히', time: '30분', sub: '배포 직전 최종안' }
  ];
  S.INIT_MODES = [
    { v: 'KEEP', name: '지금 일정 다듬기', sub: '현재 배정에서 출발해 위반과 부담을 줄입니다' },
    { v: 'SCRATCH', name: '처음부터 새로 짜기', sub: '고정한 경기만 두고 나머지를 새로 배치합니다' }
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

  /** 일반 옵션 (W17): 실행 시간 + 시작 방식. opt-2가 이 함수만 바꾼다. */
  S.reviewSimpleOptions = function (sv, running) {
    const dis = running ? ' disabled' : '';
    const pinned = app().state.matches.filter((m) => m.pinned).length;
    const cur = S.TIME_PRESETS.find((p) => p.sec === sv.timeLimitSec);
    const choice = (act, v, on, name, extra, sub) => '<button class="choice' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="' + act + '" data-v="' + v + '"' + dis + '><span class="c-dot" aria-hidden="true"></span><span class="c-main"><b>' + esc(name) + '</b>' + (extra ? '<span class="c-time">' + esc(extra) + '</span>' : '') + '<span class="c-sub">' + esc(sub) + '</span></span></button>';
    return '<div class="simple-opts">' +
      '<div class="field"><span id="lbl-time">실행 시간</span><div class="choices" role="radiogroup" aria-labelledby="lbl-time">' +
        S.TIME_PRESETS.map((p) => choice('run-time', p.sec, p.sec === sv.timeLimitSec, p.name, p.time, p.sub)).join('') + '</div>' +
        (!cur ? '<span class="small muted">' + icon('info') + '개발자 옵션에서 정한 ' + esc(fmt.time(sv.timeLimitSec * 1000)) + '을 씁니다.</span>' : '') + '</div>' +
      '<div class="field"><span id="lbl-init">시작 방식</span><div class="choices" role="radiogroup" aria-labelledby="lbl-init">' +
        S.INIT_MODES.map((m) => choice('solver-init', m.v, (sv.init === 'SCRATCH' ? 'SCRATCH' : 'KEEP') === m.v, m.name, '', m.sub)).join('') + '</div></div>' +
      '</div>' +
      '<div class="keep-line">' + icon('pin') + '<span>고정한 경기 <b>' + pinned + '개</b>는 그대로 둡니다.</span><span class="muted small">고정은 ③ 결과·수정에서 바꿉니다.</span></div>';
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
      '<div class="label" style="padding:2px 0 6px">점수 추이 ' + (!running && S.lastRun && S.lastRun.when ? '<span class="tag ref">지난 실행 · ' + esc(S.lastRun.when) + '</span>' : '') + S.mock() + '</div>' + trend() + '</div>';
    return s + '</div>';
  };

  /** 실행 상태 문장 */
  function statusLine(r, running) {
    const n = D().ex.violations.length;
    if (running) {
      const last = r.history[r.history.length - 1];
      const cnt = Math.max(n, Math.round(-last.hard));
      return r.status === 'PAUSED' ? '일시정지 — 다시 시작하면 이어서 찾습니다' : '더 나은 일정을 찾는 중 · ' + S.termPlain('hardViol') + ' ' + cnt + '건';
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
    const limit = (sv.timeLimitSec || 60) * 1000;
    const pct = running ? Math.min(100, Math.round(r.elapsed / r.limit * 100)) : (S.lastRun ? 100 : 0);
    const blocked = !pf.ok;
    let s = S.paneHead('검토·실행', '입력을 한눈에 확인하고, 사전 점검을 통과하면 편성을 시작합니다.', S.mock('엔진 실행'));
    s += '<div class="pane-body pad" data-sk="p-main" style="display:flex;flex-direction:column;gap:12px">';
    s += '<div><div class="label" style="padding:0 0 6px">입력 요약</div>' + summary() + '</div>';
    s += '<div class="blk"><div class="blk-head">' + icon('bolt') + '편성 실행<span class="tag ref">시안용 시뮬레이션 — 결과 품질 보장 없음</span><span class="r">' +
      (running ? '<span class="lock-pill">' + icon('lock') + '입력 잠김 — ① 데이터 준비 편집 불가</span>' : '') + '</span></div><div class="blk-body engine">';
    s += S.reviewSimpleOptions(sv, running);
    if (blocked) s += '<div class="confirm-box" style="border-color:var(--bad-line);background:var(--bad-bg);color:var(--bad)">' + icon('block') + '차단 ' + pf.counts.block + '건 — 왼쪽 목록의 차단 항목을 먼저 고치세요. <button class="btn xs" data-act="p-goto" data-target="' + esc(pf.items.find((x) => x.status === 'block').target) + '">입력 위치로 이동</button></div>';
    s += '<div class="run-line"><div class="run-prog"><div class="progress" role="progressbar" aria-label="편성 진행" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
      '<div class="run-meta"><span class="run-status" aria-live="polite">' + (running ? '<span class="eng-dot' + (r.status === 'PAUSED' ? ' pause' : '') + '"></span>' : S.lastRun ? icon('check') : icon('clock')) + esc(statusLine(r, running)) + '</span><span class="mono small">' + pct + '% · 경과 ' + fmt.time(running ? r.elapsed : S.lastRun ? S.lastRun.elapsed : 0) + ' / ' + fmt.time(running ? r.limit : limit) + '</span></div></div>' +
      '<span class="run-btns">' +
      (running
        ? (r.status === 'PAUSED' ? '<button class="btn" data-act="run-resume">' + icon('play') + '재개</button>' : '<button class="btn" data-act="run-pause">' + icon('pause') + '일시정지</button>') + '<button class="btn danger" data-act="run-stop">' + icon('stop') + '중지</button>'
        : '<button class="btn primary lg" data-act="run-start"' + (blocked ? ' disabled title="사전 점검 차단 항목이 있습니다"' : '') + '>' + icon('play') + '편성 시작</button>') +
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
      if (S.lastRun === undefined) S.lastRun = { history: buildHistory(1), elapsed: 60000, improvements: 68, reason: '최대 실행 시간', count: 1, when: '1/14(화) 09:12' };
      S.wide = window.innerWidth >= 1800;
      const insp = renderInsp();
      return '<div class="stepview no-band">' + S.workspace({ list: renderList(), main: renderMain(), insp: insp.html, inspTitle: insp.title, listLabel: '사전 점검' }) + '</div>';
    }
  };

  // ───────── 엔진 실행 (목업) ─────────
  let timer = null;
  function setLock(on) { app().run = on ? { status: 'RUNNING', handle: { pause() {}, resume() {}, stop() {} } } : null; }
  S.startRun = function () {
    if (S.run && S.run.status !== 'DONE') return;
    if (!app().preflight().ok) { S.toast('사전 점검 차단 항목이 있어 실행할 수 없습니다.', 'bad'); return; }
    const limit = (app().state.settings.solver.timeLimitSec || 60) * 1000;
    S.run = { status: 'RUNNING', elapsed: 0, improvements: 0, history: buildHistory(0, limit), limit };
    setLock(true);
    clearInterval(timer);
    timer = setInterval(() => {
      const r = S.run;
      if (!r || r.status === 'PAUSED') return;
      r.elapsed += r.limit / 30; // 실행 시간과 상관없이 약 6초에 재생한다(목업)
      const t = Math.min(1, r.elapsed / r.limit);
      r.history = buildHistory(t, r.limit);
      r.improvements = Math.round(68 * Math.sqrt(t));
      if (t >= 1) finish('TIME_LIMIT');
      else S.render();
    }, 200);
    S.render();
  };
  function finish(reason) {
    clearInterval(timer);
    const r = S.run;
    const why = { TIME_LIMIT: '최대 실행 시간', STOPPED: '사용자 중지' }[reason];
    S.lastRun = { history: r.history, elapsed: r.elapsed, improvements: r.improvements, reason: why, count: ((S.lastRun && S.lastRun.count) || 0) + 1, when: '방금 ' + fmt.clock(new Date()) };
    S.run = null;
    setLock(false);
    const ex = D().ex;
    S.toast('편성 끝 (' + why + ') — ' + S.scoreLine(ex) + ' · ③ 결과·수정으로 이동합니다.', ex.feasible ? 'ok' : 'warn', 4500);
    S.go({ step: 3, sel: ex.violations.length ? 'v:' + S.vsig(ex.violations[0]) : null });
  }
  Object.assign(S.actions, {
    'run-start': () => S.startRun(),
    'run-pause': () => { if (S.run) { S.run.status = 'PAUSED'; S.render(); } },
    'run-resume': () => { if (S.run) { S.run.status = 'RUNNING'; S.render(); } },
    'run-stop': () => { if (S.run) finish('STOPPED'); },
    'p-sel': (el) => S.go({ sel: 'p:' + el.dataset.id }),
    'p-goto': (el) => S.navTarget(el.dataset.target),
    'solver-init': (el) => app().updateSolverSettings({ init: el.dataset.v }),
    'run-time': (el) => { const sec = +el.dataset.v; app().updateSolverSettings({ timeLimitSec: sec, unimprovedSec: Math.max(15, Math.round(sec / 4)) }); },
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
