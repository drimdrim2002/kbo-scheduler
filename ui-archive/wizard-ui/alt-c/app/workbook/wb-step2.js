/*
 * alt-c 편성 워크북 — ② 검토·실행.
 * 검토 시트(입력 요약 + 사전 점검, 조건부 서식), 연전 용량·실행 기록 시트, 작업 창의 엔진 옵션·실행(목업)·점수 추이.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const KBO = window.KBO;
  const D = KBO.Dates;
  const esc = WB.esc, icon = WB.icon;
  const S2 = WB.steps[2] = {};
  const B = () => WB.Book;

  WB.runLog = [
    { at: '10/17(금) 17:55', engine: 'Mock', sec: 45, impr: 168, reason: '개선 없음 15초', score: '[-0/-0]hard/[0/-500/-601233/-15/-73410]soft', feasible: true },
    { at: '10/18(토) 09:12', engine: 'Mock', sec: 60, impr: 214, reason: '시간 제한', score: '[0/0]hard/[0/-400/-573307/-13/-72955]soft', feasible: true }
  ];
  WB.solverOpt = { limit: 60, unimproved: 15, init: 'KEEP', seed: 42 };

  // ───────────── 사전 점검 (워크북 입력 기준) ─────────────
  function preflight() {
    const b = WB.book, app = WB.app;
    const items = [];
    const add = (status, item, value, detail, target) => items.push({ status, item, value, detail, target });
    const N = app.state.teams.length;
    const shared = app.sharedStadiums();
    add(N % 2 === 0 ? 'pass' : 'block', '구단 수', N + '개 (짝수)', N % 2 ? '한 구단이 매 슬롯 쉬게 되어 편성할 수 없습니다.' : '슬롯마다 ' + N / 2 + '개 시리즈가 열립니다.', ['teams', 'A2']);
    add('pass', '공유 구장', shared.size ? Array.from(shared).map(([s, n]) => s.replace('종합운동장', '') + '(' + n.join('·') + ')').join(', ') : '없음', '같은 구장명은 H0-b에서 1개 구장으로 셉니다.', ['teams', 'B3']);
    add('pass', '거리 행렬', N * (N - 1) + '건 입력', '추정 거리 0건 — 프리셋 도로거리', ['teams', 'A2']);
    const ce = (s) => B().counts(s);
    const sheetCheck = (sheet, item) => {
      const c = ce(sheet);
      const first = B().issues().find((x) => x.sheet === sheet && x.level === 'error');
      const cell = first ? WB.colName(B().DEFS[sheet].cols.findIndex((k) => k.key === first.key)) + (first.r + 2) : 'A2';
      add(c.error ? 'block' : c.warn ? 'warn' : 'pass', item, c.error ? '오류 ' + c.error + '건' : c.warn ? '경고 ' + c.warn + '건' : b[sheet].length + '행 · 오류 없음',
        first ? B().DEFS[sheet].name + ' ' + (first.r + 2) + '행: ' + first.msg : c.warn ? '경고는 실행을 막지 않습니다.' : '셀 검증 통과', [sheet, cell]);
    };
    sheetCheck('slots', '슬롯 시트');
    sheetCheck('series', '시리즈 시트');
    const sh = {}, mh = {};
    b.slots.forEach((s) => { if (typeof s.games === 'number') sh[s.games] = (sh[s.games] || 0) + 1; });
    b.series.forEach((s) => { if (typeof s.games === 'number') mh[s.games] = (mh[s.games] || 0) + 1; });
    for (const k of [2, 3, 4]) {
      const s = sh[k] || 0, m = mh[k] || 0, cap = s * N / 2;
      if (m > cap) add('block', k + '연전 용량', '시리즈 ' + m + ' > 수용 ' + cap, '슬롯 ' + s + '개 × ' + N / 2 + ' — 미배정(S0)이나 슬롯 과밀이 불가피합니다.', ['series', 'C2']);
      else if (m < cap) add('warn', k + '연전 용량', '시리즈 ' + m + ' < 수용 ' + cap, '빈 자리는 추가 휴식이며 감점 없음. 연전 분포가 슬롯과 다릅니다.', ['slots', 'B2']);
      else add('pass', k + '연전 용량', '시리즈 ' + m + ' = 슬롯 ' + s + ' × ' + N / 2, '연전 분포가 슬롯과 정확히 일치', ['slots', 'B2']);
    }
    const pairIss = B().issues().filter((x) => x.sheet === 'series' && /구단쌍/.test(x.msg));
    add(pairIss.length ? 'warn' : 'pass', '구단쌍 경기 수', pairIss.length ? pairIss.length + '개 구단쌍 ≠ ' + b.season.initialGamesPerPair : '45쌍 모두 ' + b.season.initialGamesPerPair + '경기', pairIss.length ? pairIss[0].msg : '구단당 ' + b.season.initialGamesPerPair * (N - 1) + '경기', ['series', pairIss.length ? 'C' + (pairIss[0].r + 2) : 'A2']);
    sheetCheck('events', '이벤트 (FR-E5)');
    const misc = ['holidays', 'rest', 'blackouts'].map((s) => ce(s)).reduce((a, c) => ({ error: a.error + c.error, warn: a.warn + c.warn }), { error: 0, warn: 0 });
    add(misc.error ? 'block' : 'pass', '공휴일·예외일·경기 없는 기간', misc.error ? '오류 ' + misc.error + '건' : (b.holidays.length + b.rest.length + b.blackouts.length) + '행 · 오류 없음', '공휴일 중 ' + b.holidays.filter((h) => h.date > b.season.initialEnd).length + '개는 1차 기간 밖(재편성용)', ['holidays', 'A2']);
    const g = B().regenSlots();
    const same = g.slots && g.slots.length === b.slots.length && g.slots.every((s, i) => b.slots[i] && s.datetime.slice(0, 10) === b.slots[i].start && s.consecutive === b.slots[i].games);
    add(same ? 'pass' : 'warn', '슬롯 ↔ 시즌 규칙', same ? '규칙 결과와 같음 (45개)' : '규칙 결과와 다름', same ? '§5.2.1 규칙으로 다시 만들어도 같은 슬롯' : '직접 고친 슬롯이 있습니다. 의도한 것이면 무시하세요.', ['slots', 'A2']);
    const eng = app.state.settings.h0eMode === 'ENGINE';
    add(eng ? 'pass' : 'warn', 'H0-e 판정 모드', eng ? '엔진 호환' : '구장 기준 (D3)', eng ? 'Java 엔진과 1:1 비교' : 'Java 엔진(구단 기준)과 어린이날 감점이 다를 수 있습니다. 설정에서 엔진 호환으로 비교할 수 있습니다.', ['settings']);
    const counts = { pass: 0, warn: 0, block: 0 };
    items.forEach((x) => counts[x.status]++);
    return { items, counts, ok: counts.block === 0 };
  }
  S2.preflight = preflight;

  S2.status = function () {
    if (WB.locked()) return { kind: 'lock', label: '실행 중', short: '실행 중', summary: '엔진 실행 중 ' + WB.mmss(WB.run.elapsed) + ' · 개선 ' + WB.run.impr + '회 · 입력 잠금' };
    const p = preflight();
    const sum = '통과 ' + p.counts.pass + ' · 경고 ' + p.counts.warn + ' · 차단 ' + p.counts.block + ' · 마지막 실행 ' + WB.lastRun.at;
    if (p.counts.block) return { kind: 'block', label: '차단', short: '⛔ 차단 ' + p.counts.block, summary: sum };
    if (p.counts.warn) return { kind: 'warn', label: '확인 필요', short: '⚠ 경고 ' + p.counts.warn, summary: sum };
    return { kind: 'ok', label: '완료', short: '✔ 통과', summary: sum };
  };

  // ───────────── 검토 시트 ─────────────
  function summaryRows() {
    const b = WB.book, app = WB.app;
    const sh = {}; b.slots.forEach((s) => { sh[s.games] = (sh[s.games] || 0) + 1; });
    const games = b.series.reduce((a, s) => a + (typeof s.games === 'number' ? s.games : 0), 0);
    const bl = b.blackouts.reduce((a, x) => a + (B().isISO(x.start) && B().isISO(x.end) ? D.dayNum(x.end) - D.dayNum(x.start) + 1 : 0), 0);
    const sv = (v) => (B().isISO(v) ? D.fmtDate(v) : String(v));
    return [
      ['구단', app.state.teams.length + '개', app.state.teams.map((t) => t.name).join(' · '), ['teams', 'A2']],
      ['시즌 기간', sv(b.season.seasonStart) + ' ~ ' + sv(b.season.initialEnd), '1차 편성 ' + (D.dayNum(b.season.initialEnd) - D.dayNum(b.season.seasonStart) + 1) + '일 · 재편성 ~' + sv(b.season.seasonEnd), ['season', 'B2']],
      ['휴식 요일 · 예외일', b.season.restWeekdays + ' · 예외 ' + b.rest.length + '일', b.rest.map((x) => sv(x.date)).join(', '), ['rest', 'A2']],
      ['경기 없는 기간', b.blackouts.length + '개 · ' + bl + '일', b.blackouts.map((x) => x.name + ' ' + D.fmtShort(x.start) + (x.end !== x.start ? '~' + D.fmtShort(x.end) : '')).join(', '), ['blackouts', 'A2']],
      ['슬롯', b.slots.length + '개', Object.keys(sh).sort().map((k) => k + '연전 ' + sh[k]).join(' · '), ['slots', 'A2']],
      ['시리즈', b.series.length + '개 · ' + games + '경기', '구단쌍 ' + b.season.initialGamesPerPair + '경기 · 홈/원정 ' + b.season.homeGamesMajor + ':' + (b.season.initialGamesPerPair - b.season.homeGamesMajor), ['series', 'A2']],
      ['이벤트', b.events.length + '개', '대진 ' + b.events.filter((e) => e.mode === '대진').length + ' (핀 고정) · 구장 ' + b.events.filter((e) => e.mode === '구장').length + ' (홈 의무)', ['events', 'A2']],
      ['공휴일', b.holidays.length + '개', '1차 기간 ' + b.holidays.filter((h) => h.date <= b.season.initialEnd).length + ' · 재편성 기간 ' + b.holidays.filter((h) => h.date > b.season.initialEnd).length, ['holidays', 'A2']]
    ];
  }

  function reviewModel() {
    const sum = summaryRows();
    const pf = preflight();
    const rows = [];
    rows.push({ sec: '입력 요약', note: '① 데이터 준비의 시트에서 계산' });
    sum.forEach((x) => rows.push({ kind: 'sum', a: '', b: x[0], c: x[1], d: x[2], t: x[3] }));
    rows.push({ blank: true });
    rows.push({ sec: '사전 점검', note: '통과 ' + pf.counts.pass + ' · 경고 ' + pf.counts.warn + ' · 차단 ' + pf.counts.block });
    pf.items.forEach((x) => rows.push({ kind: 'pf', status: x.status, b: x.item, c: x.value, d: x.detail, t: x.target }));
    return { rows, pf };
  }
  const ST_TXT = { pass: '통과', warn: '경고', block: '차단' };
  const ST_CF = { pass: 'cf-ok', warn: 'cf-warn', block: 'cf-bad' };

  function linkLabel(t) {
    if (!t) return '';
    if (t[0] === 'settings') return '설정 › H0-e';
    return B().DEFS[t[0]].name + '!' + t[1];
  }
  function gotoTarget(t) {
    if (!t) return;
    if (t[0] === 'settings') { WB.Settings.open('h0e'); return; }
    WB.ui.gridFocus = 's1-' + t[0];
    WB.go({ step: 1, sheet: t[0], cell: t[1] });
  }

  function reviewGrid() {
    const { rows } = reviewModel();
    const hostW = (document.getElementById('gridhost').clientWidth || 1100) - 38 - 18;
    const dW = Math.max(470, hostW - (82 + 178 + 230 + 136));
    const cols = [{ label: '상태', w: 82 }, { label: '항목', w: 178 }, { label: '값 · 기준', w: 230 }, { label: '세부', w: dW }, { label: '입력 위치', w: 136 }];
    return {
      key: 's2-review', sheet: '검토', cols, rows: rows.length, fill: 0, fieldHead: true, tableCls: '',
      rowCls: (r) => (rows[r].sec ? 'sec' : ''),
      cell: (r, c) => {
        const x = rows[r];
        if (x.blank) return { t: '' };
        if (x.sec) return c === 0 ? { h: '<b>' + esc(x.sec) + '</b>' } : c === 1 ? { t: x.note } : { t: '' };
        if (c === 0) return x.kind === 'pf' ? { h: icon(x.status === 'pass' ? 'ok' : x.status) + ' ' + ST_TXT[x.status], cls: ST_CF[x.status] } : { t: '요약', cls: 'dv' };
        if (c === 1) return { t: x.b, cls: x.kind === 'pf' ? '' : 'dv' };
        if (c === 2) return { t: x.c, cls: 'num' };
        if (c === 3) return { t: x.d, title: x.d };
        return { h: x.t ? '<a class="lnk" data-tgt="' + r + '">' + esc(linkLabel(x.t)) + '</a>' : '' };
      },
      onSelect: (r, c) => fxReview(rows, r, c),
      onActivate: (r) => gotoTarget(rows[r].t)
    };
  }
  function fxReview(rows, r, c) {
    const x = rows[r];
    if (!x || x.blank || x.sec) { WB.fx({ addr: '검토!' + WB.colName(c) + (r + 2), value: x && x.sec ? x.sec : '' }); return; }
    WB.fx({ addr: '검토!' + WB.colName(c) + (r + 2), value: [x.kind === 'pf' ? ST_TXT[x.status] : '요약', x.b, x.c, x.d, linkLabel(x.t)][c], meta: x.t ? 'Enter: 입력 위치(' + esc(linkLabel(x.t)) + ')로 이동' : '',
      msg: x.kind === 'pf' && x.status !== 'pass' ? esc(x.b + ' — ' + x.d) : '', level: x.status === 'block' ? 'error' : x.status === 'warn' ? 'warn' : '' });
  }

  function capacityGrid() {
    const b = WB.book, N = WB.app.state.teams.length;
    const rows = [];
    for (let mo = 3; mo <= 8; mo++) {
      const ss = b.slots.filter((s) => B().isISO(s.start) && +s.start.slice(5, 7) === mo);
      const h = { 2: 0, 3: 0, 4: 0 }; ss.forEach((s) => { h[s.games] = (h[s.games] || 0) + 1; });
      rows.push([mo + '월', ss.length, h[2], h[3], h[4], ss.reduce((a, s) => a + s.games, 0), ss.length * N / 2, ss.filter((s) => (s.weekend === '' ? (B().autoWeights(s) || {}).weekend : s.weekend) === 1).length]);
    }
    const tot = rows.reduce((a, r) => a.map((v, i) => (i ? v + r[i] : '합계')), ['', 0, 0, 0, 0, 0, 0, 0]);
    rows.push(tot);
    const cols = ['월', '슬롯', '2연전', '3연전', '4연전', '경기일', '시리즈 자리', '주말 슬롯'].map((l, i) => ({ label: l, w: i ? 90 : 70, cls: i ? 'n' : '' }));
    return { key: 's2-cap', sheet: '연전 용량', cols, rows: rows.length, fill: 2, rowCls: (r) => (r === rows.length - 1 ? 'tot' : ''), cell: (r, c) => ({ t: rows[r][c] }), onSelect: (r, c) => WB.fx({ addr: '연전 용량!' + WB.colName(c) + (r + 2), value: rows[r][c], meta: cols[c].label }) };
  }

  function logGrid() {
    const rows = WB.runLog.slice().reverse();
    const cols = [{ label: '시각', w: 120 }, { label: '엔진', w: 70 }, { label: '실행 시간', w: 80, cls: 'n' }, { label: '개선 횟수', w: 80, cls: 'n' }, { label: '종료 사유', w: 110 }, { label: '점수 (BendableLongScore)', w: 330, cls: 'mono' }, { label: '결과', w: 110 }];
    return {
      key: 's2-log', sheet: '실행 기록', cols, rows: rows.length, fill: 1,
      cell: (r, c) => { const x = rows[r]; return [{ t: x.at }, { t: x.engine }, { t: x.sec + '초' }, { t: x.impr + '회' }, { t: x.reason }, { t: x.score }, { h: x.feasible ? WB.st('ok', '편성 가능') : WB.st('bad', 'Hard 위반') }][c]; },
      onSelect: (r, c) => WB.fx({ addr: '실행 기록!' + WB.colName(c) + (r + 2), value: rows[r].score, meta: rows[r].at + ' · ' + rows[r].engine + ' ' + WB.mock('목업') })
    };
  }

  // ───────────── 엔진 (목업) ─────────────
  const HARD0 = 46;
  function synth(t) {
    const hard = Math.round(3 + (HARD0 - 3) * Math.exp(-5.5 * t));
    const soft = Math.round(72955 + 11800 * Math.exp(-3.6 * t) + 380 * Math.sin(t * 19) * (1 - t));
    return { hard, soft };
  }
  function trendTo(p) {
    const out = [];
    const n = Math.max(2, Math.round(p * 40));
    for (let i = 0; i <= n; i++) out.push(synth((i / 40)));
    return out;
  }
  S2.freeze = function (val) {
    if (val === 'done') { finish(true); return; }
    const p = Math.max(0.05, Math.min(0.98, +val || 0.6));
    const r = WB.run;
    r.status = 'running'; r.progress = p; r.limit = WB.solverOpt.limit; r.elapsed = Math.round(p * r.limit); r.impr = Math.round(214 * Math.pow(p, 0.6)); r.trend = trendTo(p); r.frozen = true;
  };
  function start() {
    const pf = preflight();
    if (!pf.ok) { WB.toast('사전 점검 차단 항목이 있어 실행할 수 없습니다.', 'bad'); return; }
    const r = WB.run;
    Object.assign(r, { status: 'running', progress: 0, elapsed: 0, limit: WB.solverOpt.limit, impr: 0, trend: [synth(0)], frozen: false });
    tick();
    WB.render();
  }
  function tick() {
    clearTimeout(WB.run.timer);
    WB.run.timer = setTimeout(() => {
      const r = WB.run;
      if (r.status !== 'running') return;
      r.progress = Math.min(1, r.progress + 0.025);
      r.elapsed = r.progress * r.limit;
      r.impr = Math.round(214 * Math.pow(r.progress, 0.6));
      r.trend = trendTo(r.progress);
      if (r.progress >= 1) { finish(); return; }
      if (WB.ui.screen === 'wizard' && WB.ui.step === 2) { renderPane(); WB.renderTop(); WB.renderStepper(); }
      else { WB.renderTop(); WB.renderStepper(); }
      tick();
    }, 250);
  }
  function finish(silent) {
    const r = WB.run;
    clearTimeout(r.timer);
    r.status = 'idle'; r.progress = 0; r.trend = [];
    // 배정이 초기화되어 있으면 엔진 결과(시드 배정)를 반영한다
    const app = WB.app;
    const empty = app.derived().pool.length > 0;
    if (empty && WB.seedPlan) WB.track('엔진 결과 반영', () => app.store.commit('엔진 결과 반영', (s) => { s.plan = JSON.parse(WB.seedPlan); }, { tags: ['plan'] }));
    WB.book.dirty = false;
    WB.lastRun = { at: '10/19(일) ' + new Date().toTimeString().slice(0, 5), sec: WB.solverOpt.limit, impr: 214, reason: '시간 제한' };
    const ex = app.derived().ex;
    WB.runLog.push({ at: WB.lastRun.at, engine: 'Mock', sec: WB.solverOpt.limit, impr: 214, reason: '시간 제한', score: KBO.Score.scoreString(ex.score), feasible: ex.feasible });
    if (silent) return;
    WB.toast('엔진 실행 완료 (목업) — 가상 위반 ' + ex.violations.length + '건을 얹은 결과를 ③에서 확인하세요.', 'ok');
    WB.go({ step: 3 });
  }
  S2.pause = () => { const r = WB.run; if (r.status === 'running') { r.status = 'paused'; clearTimeout(r.timer); } else if (r.status === 'paused') { r.status = 'running'; tick(); } WB.render(); };
  S2.stop = () => { if (!WB.locked()) return; WB.run.progress = 1; finish(); };
  WB.actions['run-start'] = start;
  WB.actions['run-pause'] = S2.pause;
  WB.actions['run-stop'] = S2.stop;
  WB.actions['recheck'] = () => { WB.book._issues = null; WB.render(); WB.toast('사전 점검을 다시 했습니다.', 'ok'); };

  function renderCmd() {
    const lock = WB.locked();
    const pf = preflight();
    const r = WB.run;
    document.getElementById('cmd').innerHTML =
      '<span class="grp"><button class="btn pri" data-act="run-start"' + (lock || !pf.ok ? ' disabled' : '') + ' title="' + (pf.ok ? '엔진 실행' : '차단 항목을 먼저 고치세요') + '">' + icon('play') + '엔진 실행</button>' +
      '<button class="btn" data-act="run-pause"' + (lock ? '' : ' disabled') + '>' + icon(r.status === 'paused' ? 'play' : 'pause') + (r.status === 'paused' ? '재개' : '일시정지') + '</button>' +
      '<button class="btn" data-act="run-stop"' + (lock ? '' : ' disabled') + '>' + icon('stop') + '중지</button></span>' +
      '<span class="vr"></span><button class="btn" data-act="recheck"' + (lock ? ' disabled' : '') + '>' + icon('ok') + '다시 점검</button>' +
      '<span class="vr"></span><span class="note">엔진: Mock (시뮬레이션 엔진, 품질 보장 없음) ' + WB.mock('목업') + '</span>' +
      '<span class="grow"></span><span class="note">마지막 실행 ' + esc(WB.lastRun.at) + ' · ' + WB.lastRun.sec + '초 · 개선 ' + WB.lastRun.impr + '회 · ' + esc(WB.lastRun.reason) + '</span>';
  }
  function renderTabs() {
    const id = WB.ui.sheet[2];
    const pf = preflight();
    const tab = (sid, name, ico, cnt) => '<button class="tab' + (sid === id ? ' on' : '') + '" role="tab" aria-selected="' + (sid === id) + '" data-sheet="' + sid + '">' + icon(ico, 'tico') + name + (cnt || '') + '</button>';
    document.getElementById('tabs').innerHTML =
      tab('review', '검토', 'sheet', pf.counts.block ? '<span class="cnt error">' + icon('block') + pf.counts.block + '</span>' : pf.counts.warn ? '<span class="cnt warn">' + icon('warn') + pf.counts.warn + '</span>' : '') +
      tab('cap', '연전 용량', 'sheet') + tab('log', '실행 기록', 'sheet', '<span class="cnt n">' + WB.runLog.length + '</span>');
  }

  function renderPane() {
    const pane = document.getElementById('pane');
    const r = WB.run, o = WB.solverOpt;
    const lock = WB.locked();
    const pf = preflight();
    let runBox;
    if (lock) {
      const cur = r.trend[r.trend.length - 1] || synth(0);
      runBox = '<div class="callout lock">' + WB.st('lock', r.status === 'paused' ? '일시정지' : '실행 중') + ' 입력이 잠겨 있습니다. ①·③의 편집, 가져오기, 실행 취소가 막힙니다.</div>' +
        '<div class="row" style="margin:8px 0 3px"><b>진행</b><span class="grow"></span><span class="num">' + WB.mmss(r.elapsed) + ' / ' + WB.mmss(r.limit) + ' · ' + Math.round(r.progress * 100) + '%</span></div><div class="prog"><i style="width:' + (r.progress * 100).toFixed(1) + '%"></i></div>' +
        '<dl class="kv" style="margin-top:8px"><dt>개선 횟수</dt><dd>' + r.impr + '회</dd><dt>현재 Hard</dt><dd>' + cur.hard + '건</dd><dt>현재 S4 총 이동거리</dt><dd>' + cur.soft.toLocaleString('ko-KR') + ' km</dd></dl>' +
        '<div class="ph">점수 추이 <small>Hard 위반 수 · ' + HARD0 + ' → ' + cur.hard + '</small></div>' + WB.Charts.spark(r.trend.map((x) => x.hard), paneW(), 46, { color: '#a3221a' }) +
        '<div class="ph">점수 추이 <small>S4 리그 총 이동거리 km · 낮을수록 좋음</small></div>' + WB.Charts.spark(r.trend.map((x) => x.soft), paneW(), 46, { color: '#5b4a99' }) +
        '<div class="note" style="margin-top:6px">개선 해가 나올 때마다(250ms 간격) 캘린더·배지를 갱신합니다. 끝나면 ③ 결과·수정으로 이동합니다.</div>';
    } else if (!pf.ok) {
      const blocks = pf.items.filter((x) => x.status === 'block');
      runBox = '<div class="callout bad">' + WB.st('block', '실행 잠김') + ' 차단 ' + blocks.length + '건을 먼저 고치세요.</div>' + blocks.map((x) => '<div style="margin:4px 0">' + icon('block') + ' <b>' + esc(x.item) + '</b> — ' + esc(x.detail) + '<br><a class="lnk" data-tgt-s="' + esc(x.target.join('|')) + '">' + esc(linkLabel(x.target)) + ' 로 이동</a></div>').join('');
    } else {
      runBox = '<div class="callout ok">' + WB.st('ok', '실행 가능') + ' 차단 항목 없음' + (pf.counts.warn ? ' · 경고 ' + pf.counts.warn + '건은 실행을 막지 않습니다.' : '') + '</div>' +
        '<button class="btn pri" data-act="run-start" style="width:100%;justify-content:center;height:30px;margin-top:4px">' + icon('play') + '엔진 실행 (' + o.limit + '초)</button>' +
        '<div class="ph">점수 추이 <small>마지막 실행 · Hard 위반 수</small></div>' + WB.Charts.spark(trendTo(1).map((x) => x.hard), paneW(), 40, { color: '#8a8a84' }) +
        '<div class="note">' + esc(WB.lastRun.at) + ' · 개선 ' + WB.lastRun.impr + '회 · ' + esc(WB.lastRun.reason) + '</div>';
    }
    pane.innerHTML = '<div class="sec fixed"><div class="sh">' + icon('gear') + '엔진 옵션<span class="grow"></span>' + WB.mock('목업') + '</div><div class="sb" style="flex:none">' +
      field('최대 실행 시간', '<input class="inp num" data-opt="limit" value="' + o.limit + '"' + (lock ? ' disabled' : '') + '> 초') +
      field('개선 없음 종료', '<input class="inp num" data-opt="unimproved" value="' + o.unimproved + '"' + (lock ? ' disabled' : '') + '> 초') +
      field('초기해', '<span class="seg"><button data-init="KEEP" class="' + (o.init === 'KEEP' ? 'on' : '') + '"' + (lock ? ' disabled' : '') + '>현재 배정 유지</button><button data-init="SCRATCH" class="' + (o.init === 'SCRATCH' ? 'on' : '') + '"' + (lock ? ' disabled' : '') + '>처음부터</button></span>') +
      field('시드 · 핀', '<input class="inp num" data-opt="seed" value="' + o.seed + '" style="width:60px"' + (lock ? ' disabled' : '') + '> <span class="note">핀 ' + WB.app.state.matches.filter((m) => m.pinned).length + '개 유지</span>') +
      '</div></div><div class="sec grow"><div class="sh">' + icon('play') + '실행<span class="grow"></span>' + (lock ? WB.st('lock', '입력 잠금') : '') + '</div><div class="sb">' + runBox + '</div></div>';
    pane.querySelectorAll('[data-opt]').forEach((el) => el.addEventListener('change', () => { const v = parseInt(el.value, 10); if (v > 0) WB.solverOpt[el.dataset.opt] = v; renderPane(); renderCmd(); }));
    pane.querySelectorAll('[data-init]').forEach((el) => el.addEventListener('click', () => { WB.solverOpt.init = el.dataset.init; renderPane(); }));
    pane.querySelectorAll('[data-tgt-s]').forEach((el) => el.addEventListener('click', () => gotoTarget(el.dataset.tgtS.split('|'))));
  }
  function field(label, html) { return '<div class="field"><span>' + esc(label) + '</span><span class="row">' + html + '</span></div>'; }
  function paneW() { const p = document.getElementById('pane'); return Math.max(200, (p ? p.clientWidth : 304) - 22); }

  S2.render = function () {
    document.getElementById('main').classList.remove('nopane');
    renderCmd(); renderTabs();
    const id = WB.ui.sheet[2];
    const host = document.getElementById('gridhost');
    const spec = id === 'cap' ? capacityGrid() : id === 'log' ? logGrid() : reviewGrid();
    const g = WB.Grid.mount(host, spec);
    if (id === 'review') {
      const { rows } = reviewModel();
      host.querySelectorAll('[data-tgt]').forEach((a) => a.addEventListener('click', (e) => { e.stopPropagation(); gotoTarget(rows[+a.dataset.tgt].t); }));
    }
    WB.lockOverlay(host);
    spec.onSelect(g.sel.r, g.sel.c);
    renderPane();
    WB.setAgg('<span>' + (id === 'review' ? '검토 시트 — Enter로 입력 위치 이동' : '') + '</span>');
  };
})();
