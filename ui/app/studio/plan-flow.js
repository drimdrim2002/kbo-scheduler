/*
 * 편성 스튜디오 — 계획 흐름 (시안 ui-archive/plan-flow-concepts, 사용자 확정 2026-10-31)
 *  처음 화면: 2025 계획 보기(보기 전용, KBO 실제와 비교) / 2027 새 계획 만들기.
 *  단계 띠 4칸: 값 입력·검증 → 엔진 옵션·실행 → 현재 결과 분석 → 실행 결과 비교.
 *   1 값 입력·검증: 기존 4단계(구단 정보 → 시즌 기간 → 공휴일·홈 구장 → 확인) 위에 추정값 검토 줄과 말풍선 안내. 「고치기」는 기존 달력을 연다.
 *   2 엔진 옵션: 추천 순서 카드 + 허용 차이(가장 많은·적은 구단 차이) → settings.objective로 서버에 보낸다.
 *   3 현재 결과 분석: 한 장 대시보드 + 이름 붙여 버전 저장. 기존 ③·④ 화면은 「일정 자세히 보기」·「구단별 공정성」으로 들어간다.
 *   4 실행 결과 비교: 저장한 버전 둘을 목적식마다 비교. 저장한 버전이 있으면 언제든 들어간다.
 *  S.ui.step: 1·3·4는 기존 화면, 2는 여기서 다시 그리고, 5 = 현재 결과 분석, 6 = 실행 결과 비교.
 *  ?classic=1(또는 자가 점검)이면 읽지 않아 예전 화면 그대로다.
 *  버전 저장: 기본 제공 ui/data/plans/*.json + 사용자가 저장한 것은 이 브라우저(P.versions). 온라인 저장소로 옮길 때 P.versions만 바꾼다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const params = new URLSearchParams(location.search);
  if (params.get('selftest') === '1' || params.get('classic') === '1') return;
  const { KBO, esc, icon, fmt } = S;
  const { Score, Dates, CalendarGen } = KBO;
  const app = () => S.app;
  const G = S.g1;
  const P = S.planFlow = { builtin: {}, cmp: [], cmpTab: 'distance', timeSec: 120, calEdit: false, customOrder: false, view25: 'compare', name: '' };
  const YEAR_NEW = 2027, YEAR_VIEW = 2025;
  const isRunning = () => !!(S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED'));
  const num = (v, d) => Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

  // ───────── 목적식 ─────────
  const GOALS = {
    moves: { name: '이동 횟수 균형', desc: '구단마다 다른 도시로 옮겨 가는 횟수를 비슷하게', unit: '회', metric: 'moves', gap: 'moves', tol: 'moveGap', d: 0 },
    distance: { name: '이동 거리 균형', desc: '구단마다 시즌 동안 이동하는 거리를 비슷하게', unit: 'km', metric: 'km', gap: 'distanceKm', tol: 'distanceGapKm', d: 1 },
    holiday: { name: '주말·공휴일 홈 균형', desc: '주말 하루 1점 · 공휴일 2점 · 어린이날 3점', unit: '점', metric: 'hol', gap: 'holiday', tol: 'holidayGap', d: 0 },
    total: { name: '전체 이동 거리', desc: '10구단 이동 거리를 모두 더한 값', unit: 'km', metric: 'km', gap: 'totalKm', tol: null, d: 0 }
  };
  const DEFAULT_OBJECTIVE = { order: ['moves', 'distance', 'holiday', 'total'], moveGap: 4, distanceGapKm: 600, holidayGap: 3 };
  const ORDERS = [
    { id: 'balance', name: '균형 먼저 (기본)', desc: '구단 사이 공평함을 가장 먼저', order: ['moves', 'distance', 'holiday', 'total'] },
    { id: 'distance', name: '거리 먼저', desc: '리그 전체 이동을 가장 줄이고, 균형은 그다음', order: ['total', 'distance', 'moves', 'holiday'] },
    { id: 'holiday', name: '주말·공휴일 먼저', desc: '흥행 날짜의 홈 경기를 고르게 나누는 것이 먼저', order: ['holiday', 'moves', 'distance', 'total'] }
  ];
  const objective = () => app().state.settings.objective || DEFAULT_OBJECTIVE;
  const goalValue = (data, id) => data.gaps[GOALS[id].gap];
  const goalShow = (data, id) => num(goalValue(data, id), GOALS[id].d);
  const within = (data, id, ob) => !GOALS[id].tol || goalValue(data, id) <= ob[GOALS[id].tol];

  /** 채점 결과 → 화면용 숫자(저장한 버전과 같은 모양) */
  function dataOf(ex) {
    const teams = {};
    for (const t of ex.teamMetrics) teams[t.name] = { km: t.distanceTenths / 10, moves: t.moves, hol: t.holidayWeight, wk: t.weekendHome, away: t.maxAwayRun };
    return { teams, gaps: ex.objectiveGaps, feasible: ex.feasible };
  }
  const vals = (data, k) => Object.keys(data.teams).map((t) => data.teams[t][k]);
  const rangeText = (data, k) => { const a = vals(data, k); return Math.min(...a) + '~' + Math.max(...a); };

  // ───────── 버전 ─────────
  const vKey = (y) => S.KEY + 'plans:' + y;
  P.versions = {
    list(y) { try { return JSON.parse(S.ls.get(vKey(y)) || '[]'); } catch (e) { return []; } },
    put(y, list) { return S.ls.set(vKey(y), JSON.stringify(list)); },
    all(y) {
      const b = BUILTIN_IDS.map((id) => P.builtin[id]).filter((v) => v && v.year === y); // 받은 순서가 아니라 늘 같은 순서로
      return b.concat(P.versions.list(y));
    },
    get(y, id) { return P.versions.all(y).find((v) => v.id === id) || null; }
  };
  const BUILTIN_IDS = ['2027-rank1', '2027-rank2', '2025-best'];
  BUILTIN_IDS.forEach((id) => {
    const failed = () => { P.builtinFailed = true; if (S.booted) S.scheduleRender(); };
    if (typeof fetch !== 'function') { P.builtinFailed = true; return; }
    fetch('data/plans/' + id + '.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { P.builtin[id] = j; if (S.booted) S.scheduleRender(); } else failed(); }).catch(failed);
  });
  /** 올린 파일 검사: 문제가 있으면 안내 글, 없으면 null */
  P.checkVersion = function (v, y, teamNames, slots) {
    const bad = '버전 파일이 아니거나 내용이 잘렸습니다.';
    if (!v || typeof v !== 'object' || !v.teams || !v.gaps || !v.objective || !Array.isArray(v.plan) || !Array.isArray(v.matches)) return bad;
    if (v.year != null && v.year !== y) return '이 파일은 ' + v.year + ' 버전이라 ' + y + '에 올릴 수 없습니다.';
    if (y === YEAR_NEW) {
      const op = v.inputs && Array.isArray(v.inputs.events) ? v.inputs.events.find((e) => e.type === 'OPENING') : null;
      const homes = v.pairs ? v.pairs.map((x) => x.home) : op ? op.teams : null;
      if (homes && !sameTeams(homes, OPENING_HOMES())) return '개막전 홈 구단이 전년도 순위와 다른 버전입니다.';
    }
    const ob = v.objective, order = ob.order;
    if (!Array.isArray(order) || order.slice().sort().join() !== Object.keys(GOALS).sort().join()) return bad;
    if (![ob.moveGap, ob.distanceGapKm, ob.holidayGap].every((x) => Number.isFinite(x) && x >= 0)) return bad;
    if (!Object.keys(GOALS).every((id) => Number.isFinite(goalValue(v, id)))) return bad;
    if (!teamNames.every((t) => v.teams[t] && ['km', 'moves', 'hol', 'wk', 'away'].every((k) => Number.isFinite(v.teams[t][k])))) return bad;
    if (!v.matches.length || v.matches.length !== v.plan.length) return bad;
    const known = new Set(teamNames), n = v.inputs && Array.isArray(v.inputs.calendar) ? v.inputs.calendar.length : slots;
    if (!v.matches.every((m) => known.has(m.home) && known.has(m.away) && m.consecutive > 0)) return bad;
    if (!v.plan.every((x) => x.match >= 0 && x.match < v.matches.length && x.calendar >= 0 && x.calendar < n)) return bad;
    return null;
  };

  // ───────── 값 묶음 ─────────
  /** 결과를 정하는 입력값(시리즈·배정·실행 설정·검토 표시는 뺀다). 버전에 함께 저장해 그때 값으로 되돌린다 */
  function inputsOf(st) {
    const settings = Object.assign({}, st.settings);
    delete settings.solver; delete settings.objective;
    return JSON.parse(JSON.stringify({ teams: st.teams, distanceMatrix: st.distanceMatrix, calendar: st.calendar, events: st.events, settings }));
  }
  function inputSig(st) {
    // 같은 구단을 다른 차례로 적은 것은 같은 값으로 본다(개막전 teams·stadiums 순서가 대진 순서를 따라 바뀜)
    const inp = inputsOf(st);
    for (const e of inp.events) { for (const k of ['teams', 'stadiums']) if (Array.isArray(e[k])) e[k].sort(); if (Array.isArray(e.pairs)) e.pairs = e.pairs.map((x) => x.away + '@' + x.home).sort(); }
    // 저장·불러오기로 칸 차례가 달라져도 같은 값이므로 칸 이름 순으로 적어 견준다
    const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v);
    const t = JSON.stringify(canon(inp));
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) | 0;
    return String(h);
  }
  P.inputSig = inputSig;
  /** 연전 구조(날짜·연전 수). 이것이 바뀌면 전 결과를 이어서 풀 수 없어 지우고 처음부터 푼다(사용자 결정 2026-10-31) */
  const calSig = (st) => JSON.stringify(st.calendar.map((c) => [c.datetime, c.consecutive]));
  P.calSig = calSig;
  const resultStale = (st) => { const r = st.meta.result; return !!(r && r.calSig && r.calSig !== calSig(st)); };
  /** 연전은 그대로인데 값(홈 구장·대진 지정 등)을 고쳤는가 → 다음 실행은 전 결과에서 이어서 푼다 */
  const inputsEdited = (st) => { const r = st.meta.result; return !!(r && r.sig && !resultStale(st) && r.sig !== inputSig(st)); };
  const freshResult = (st) => (st.meta.result && !resultStale(st) ? st.meta.result : null);

  // ───────── 값 검토 상태 ─────────
  const KEYS = { 2: ['opening', 'initialEnd', 'allStar'], 3: ['openingHome', 'childrenHome'] };
  const review = (p) => (p || app().state).meta.review || {};
  /** 개막전 홈 구단은 전년도 순위가 정한다(사용자 결정 2026-10-31): 상대만 고칠 수 있고, 표·엑셀·파일로 달라졌으면 그 단계가 끝나지 않는다 */
  const OPENING_HOMES = () => (preset27().events.find((e) => e.type === 'OPENING') || {}).teams || [];
  const sameTeams = (a, b) => (a || []).slice().sort().join() === (b || []).slice().sort().join();
  const openingHomesOk = (p) => sameTeams(((p.events || []).find((e) => e.type === 'OPENING') || {}).teams, OPENING_HOMES());
  const stepReviewed = (p, n) => (n === 1 ? !!(p.meta.flow || {}).teams : (KEYS[n] || []).every((k) => review(p)[k]) && (n !== 3 || openingHomesOk(p)));
  const yearOf = (p) => S.seasonYearOf(p);
  const inPlan = (p) => yearOf(p || app().state) === YEAR_NEW;
  const origStatus = S.flowStatus;
  /** 2027은 추정값을 검토해야 그 단계가 끝난다(값이 들어 있어도 처음에는 「검토 전」) */
  S.flowStatus = function (p0) {
    const p = p0 || app().state, r = origStatus(p);
    if (!inPlan(p)) return r;
    const done = r.done.slice();
    for (let n = 1; n <= 3; n++) done[n - 1] = done[n - 1] && stepReviewed(p, n);
    done[3] = done[3] && done[0] && done[1] && done[2];
    let stop = done.indexOf(false) + 1;
    if (!stop) stop = 4;
    const steps = r.steps.map((s, i) => Object.assign({}, s, { kind: done[i] ? 'done' : i + 1 === stop ? 'cur' : 'todo', text: r.done[i] && !done[i] ? '검토 전' : s.text }));
    return { steps, stop, allDone: done.every(Boolean), done };
  };
  /** 시리즈가 지금 값을 따르는가: 묶음만 보는 S.seriesOkOf에 개막 대진·후반기 첫 4연전·격년 홈 경기 수를 더한다. 어긋나면 「다음」·실행 때 규칙대로 다시 만든다 */
  function seriesFollows(st) {
    const s = st.settings, op = (st.events || []).find((e) => e.type === 'OPENING') || {}, pairs = op.pairs || [];
    const has = (h, a, n) => st.matches.some((m) => m.home === h && m.away === a && m.consecutive === n);
    const swap = s.fourGameHome === 'swap';
    if (!pairs.every((p) => has(p.home, p.away, 2) && (swap ? has(p.away, p.home, 4) : has(p.home, p.away, 4)))) return false;
    if (!pairs.length && !(op.teams || []).every((t) => st.matches.some((m) => m.home === t && m.consecutive === 2))) return false;
    const ht = s.homeTotals;
    if (ht && ht.more && ht.less && ht.more.initial != null && ht.less.initial != null) {
      const home = {};
      for (const m of st.matches) home[m.home] = (home[m.home] || 0) + m.consecutive;
      if (!st.teams.every((t) => home[t.name] === (ht.moreTeams.includes(t.name) ? ht.more.initial : ht.less.initial))) return false;
    }
    return true;
  }
  /** 새 시리즈를 전 결과 자리에 앉힌다: 같은 시리즈는 그 자리에, 바뀐 시리즈만 같은 길이의 빈 자리로(규칙 위반은 이어서 풀 때 엔진이 고친다) */
  function keepPlan(st, matches) {
    const half = st.teams.length >> 1, free = st.calendar.map(() => half), old = new Map(), out = new Array(matches.length).fill(-1);
    const key = (m) => m.home + '|' + m.away + '|' + m.consecutive;
    for (const x of st.plan) { const k = key(st.matches[x.match]); if (!old.has(k)) old.set(k, []); old.get(k).push(x.calendar); }
    matches.forEach((m, i) => { const q = old.get(key(m)); if (q && q.length) { out[i] = q.shift(); free[out[i]]--; } });
    const busy = st.calendar.map(() => new Set());
    matches.forEach((m, i) => { if (out[i] >= 0) { busy[out[i]].add(m.home); busy[out[i]].add(m.away); } });
    matches.forEach((m, i) => {
      if (out[i] >= 0) return;
      const fit = st.calendar.map((c, n) => n).filter((n) => free[n] > 0 && st.calendar[n].consecutive === m.consecutive);
      const best = fit.find((n) => !busy[n].has(m.home) && !busy[n].has(m.away));
      const n = best != null ? best : fit[0];
      out[i] = n; free[n]--; busy[n].add(m.home); busy[n].add(m.away);
    });
    P.keepPlanLeft = repairRounds(st, matches, out);
    return out;
  }
  /** 연전마다 구단이 한 번씩만 나오게 같은 길이 시리즈끼리 맞바꾼다. 엔진은 연전 묶음째 옮기므로 이 겹침은 스스로 못 고친다. 남은 겹침 수를 돌려준다 */
  function repairRounds(st, matches, plan) {
    const stadium = new Map(st.teams.map((t) => [t.name, t.stadium]));
    const members = st.calendar.map(() => []);
    plan.forEach((c, i) => members[c].push(i));
    const cost = (list) => {
      const seen = new Set(), homes = new Set();
      let n = 0;
      for (const i of list) {
        const m = matches[i];
        for (const t of [m.home, m.away]) { if (seen.has(t)) n++; seen.add(t); }
        const h = stadium.get(m.home);
        if (homes.has(h)) n++;
        homes.add(h);
      }
      return n;
    };
    let seed = 42;
    const rnd = (n) => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed >>> 8) % n; };
    let total = members.reduce((sum, l) => sum + cost(l), 0);
    for (let iter = 0; total > 0 && iter < 40000; iter++) {
      const bad = members.map((l, c) => c).filter((c) => cost(members[c]) > 0);
      const a = bad[rnd(bad.length)], list = members[a], x = rnd(list.length);
      const len = st.calendar[a].consecutive, ca = cost(list);
      let best = null, bestD = Infinity, ties = 0;
      members.forEach((other, b) => {
        if (b === a || st.calendar[b].consecutive !== len) return;
        const cb = cost(other);
        other.forEach((v, y) => {
          const na = list.slice(); na[x] = v;
          const nb = other.slice(); nb[y] = list[x];
          const d = cost(na) + cost(nb) - ca - cb;
          if (d < bestD) { bestD = d; best = [b, y]; ties = 1; } else if (d === bestD && rnd(++ties) === 0) best = [b, y];
        });
      });
      if (!best || (bestD > 0 && rnd(5) !== 0)) continue;
      const [b, y] = best, v = members[b][y], u = list[x];
      list[x] = v; members[b][y] = u; plan[v] = a; plan[u] = b; total += bestD;
    }
    return total;
  }
  P.keepPlan = keepPlan;
  const origSeriesOk = S.seriesOkOf;
  S.seriesOkOf = (p) => origSeriesOk(p) && (!inPlan(p) || seriesFollows(p));
  function confirmKey(k) {
    app().commit('검토: 맞아요', (s) => { s.meta.review = Object.assign({}, s.meta.review || {}, { [k]: true }); }, ['meta']);
  }

  // 「다음」: 전 결과가 있으면 시리즈를 통째로 새로 까는 대신 바뀐 것만 바꾼다
  const origCalNextFn = S.calNext;
  S.calNext = function () {
    const st = app().state;
    if (!inPlan(st) || !st.meta.result || resultStale(st) || S.seriesOkOf(st) || !S.gameDaysCheck().ok || S.locked()) { origCalNextFn(); return; }
    const g = app().generateSeriesPreview();
    if (g.errors.length) { origCalNextFn(); return; }
    const plan = keepPlan(st, g.matches);
    if (P.keepPlanLeft > 0) { // 자리를 맞추지 못하면 이어서 풀 수 없다: 결과를 지우고 처음부터
      app().store.commit('시리즈를 맞추지 못해 결과 지움', (x) => { delete x.meta.result; }, { tags: ['meta'], undo: false });
      S.toast('바꾼 값에 지금 결과를 맞추지 못해 처음부터 풉니다.', 'warn', 6000);
      origCalNextFn();
      return;
    }
    app().commit('시리즈를 값에 맞춤(전 결과 자리 유지)', (x) => {
      x.matches = g.matches.map((m) => Object.assign({ pinned: false }, m));
      x.plan = plan.map((c, m) => ({ match: m, calendar: c }));
      x.games = [];
    }, ['matches', 'plan', 'games']);
    app().applyEvents({ silent: true, label: '특별 경기 대진 고정' });
    S.calBeforeNext();
    S.go({ step: 2, ops: null, sel: null, edit: null });
  };
  // 이어서 풀 때는 지금 일정에 규칙 위반이 있어도 처음부터로 바꾸지 않는다(바뀐 시리즈의 위반을 엔진이 고친다)
  const origEffectiveInit = S.effectiveInit;
  S.effectiveInit = function (sv) { return inPlan() && sv.init === 'KEEP' ? { v: 'KEEP', forced: false, chosen: 'KEEP' } : origEffectiveInit(sv); };
  const isOpeningDay = (d) => { const op = (app().state.events || []).find((e) => e.type === 'OPENING'); return inPlan() && !!op && Dates.dayNum(op.date) === d; };
  const origHomeBox = S.calHomeBox;
  S.calHomeBox = function (d, b) {
    const html = origHomeBox(d, b);
    if (!isOpeningDay(d)) return html;
    return '<div class="sc-note"><b>홈 구단은 고정입니다</b> — 전년도 순위로 정해집니다. 상대 구단만 고칠 수 있습니다.</div>' +
      html.replace(/<button class="sc-tog[\s\S]*?<\/button>/, '').replace(/<div class="sc-seg sc-fix"[\s\S]*?<\/div>/, '').replace(/data-act="cal-home-team"/g, 'disabled').replace(/<div class="sc-note">이 날 홈 구단[\s\S]*?<\/div>/, '').replace(/<div class="sc-note">[^<]*중 하나만 고릅니다[^<]*<\/div>/, '');
  };
  // 잠근 뒤에도 단축키·남은 단추로 들어오는 길을 막는다
  ['cal-home-team', 'cal-home-off', 'cal-home-fix'].forEach((k) => {
    const orig = S.actions[k];
    S.actions[k] = (el, e) => { if (S.cal.day != null && isOpeningDay(S.cal.day)) { S.toast('개막전 홈 구단은 전년도 순위로 정해집니다. 상대 구단만 고칠 수 있습니다.', 'warn', 5000); return; } orig(el, e); };
  });

  // ───────── 근거 ─────────
  const BASIS = {
    opening: { why: '3월 넷째 토요일에 2연전으로 엽니다(2024 · 2025 · 2026 모두 같음).', src: '2027 개막전 예측' },
    initialEnd: { why: '개막부터 경기일을 세어 135일이 되는 첫 일요일입니다. 남은 경기는 그 뒤에 따로 짭니다.', src: '2027 일정 원칙' },
    allStar: { why: '7월 둘째 금요일부터 6일로 잡았습니다.', src: '2027 일정 예상 엑셀' },
    four: { why: '올스타 휴식기 바로 뒤 목~일을 4연전으로 묶습니다. 휴식기를 고치면 함께 옮겨집니다.', src: '2027 원칙' },
    openingHome: { why: '2026 상위 5팀이 홈(두산은 LG와 구장이 겹쳐 원정, SSG가 이어받음). 대진은 2025 개막 대진을 다시 쓴 1순위 예측입니다.', src: '2027 개막전 예측' },
    childrenHome: { why: '어린이날 홈은 해마다 번갈아 가집니다(홀수 해 = 이 5구단).', src: '2027 일정 원칙' },
    homeTotals: { why: '남는 홈 경기는 해마다 번갈아 가집니다(2027 = 홀수 해).', src: '2027 원칙' }
  };
  S.modals.pfCalChange = function () {
    return '<div class="modal" role="dialog" aria-label="연전이 바뀜" style="width:480px;max-width:94vw"><div class="modal-head"><h3>연전이 바뀌었습니다</h3></div><div class="modal-body" style="padding:14px">' +
      '<p class="pf-d" style="margin:0 0 12px">날짜나 연전 수가 바뀌면 지금 결과에서 이어서 풀 수 없습니다. 지금 결과를 지우고 처음부터 다시 풉니다. 이름 붙여 저장한 버전은 그대로 남습니다.</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="pf-cal-undo">바꾸지 않기</button><button class="btn primary" data-act="pf-cal-clear">결과 지우고 계속</button></div></div></div>';
  };
  S.modals.pfBasis = function () {
    const tr = (c) => '<tr>' + c.map((x) => '<td>' + x + '</td>').join('') + '</tr>';
    const conf = (x) => '<span class="pf-tag ' + (x === '높음' ? 'ok' : 'est') + '">' + x + '</span>';
    return '<div class="modal" role="dialog" aria-label="2027 개막전 근거" style="width:860px;max-width:94vw"><div class="modal-head"><h3>2027 개막전 근거</h3><span class="muted small">공식 일정 발표(보통 12월 중순) 전 예상입니다</span>' +
      '<button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div><div class="modal-body" style="padding:14px;overflow:auto;max-height:76vh">' +
      '<div class="pf-sec"><h3>개막일</h3><p class="pf-d">세 해 모두 3월 넷째 토요일입니다.</p><table class="pf-t"><thead><tr><th>시즌</th><th>개막일</th></tr></thead><tbody>' + tr(['2024', '3월 23일(토)']) + tr(['2025', '3월 22일(토)']) + tr(['2026', '3월 28일(토)']) + tr(['<b>2027 예상</b>', '<b>3월 27일(토)</b>']) + '</tbody></table></div>' +
      '<div class="pf-sec" style="margin-top:10px"><h3>홈 구단 ' + conf('높음') + '</h3><p class="pf-d">전년도 상위 5팀이 홈. 2025 개막전에도 두산이 원정, SSG가 홈을 맡았습니다.</p><table class="pf-t"><thead><tr><th>2026 순위</th><th>구단</th><th>개막전</th></tr></thead><tbody>' +
      [['1', 'KT', '홈'], ['2', '삼성', '홈'], ['3', 'KIA', '홈'], ['4', 'LG', '홈'], ['5', '두산', '원정 — LG와 구장이 겹침'], ['6', 'SSG', '홈 — 두산 자리를 이어받음']].map(tr).join('') + '</tbody></table></div>' +
      '<div class="pf-sec" style="margin-top:10px"><h3>대진 ' + conf('낮음~중간') + '</h3><p class="pf-d">1순위 예측: 2025 개막 대진을 다시 씁니다. KBO가 상대 배정 기준을 공개한 적이 없어 패턴으로 추정했습니다.</p><table class="pf-t"><thead><tr><th>구장</th><th>홈 (순위)</th><th>원정 (순위)</th><th>신뢰도</th><th>근거</th></tr></thead><tbody>' +
      [['수원', 'KT (1)', '한화 (9)', '중간', '1위-9위 매칭 2년 연속 · 2025와 같음'], ['대구', '삼성 (2)', '키움 (10)', '중간', '2위-10위 매칭 2년 연속 · 2025와 같음'], ['광주', 'KIA (3)', 'NC (8)', '낮음', '2025와 같음'], ['서울', 'LG (4)', '롯데 (7)', '낮음', '2025와 같음'], ['인천', 'SSG (6)', '두산 (5)', '낮음', '2025와 같음']].map((r) => tr([r[0], r[1], r[2], conf(r[3]), r[4]])).join('') + '</tbody></table>' +
      '<div class="pf-note"><b>1순위로 둔 이유</b> — 2027 홈 5팀이 2025 홈 5팀과 같아 이동 동선 검토가 끝난 편성입니다. 2년 간격으로 같은 대진이 반복된 선례(NC-두산 2024 · 2026)도 있습니다.<br><b>2순위 예측</b> — 삼성-NC · KIA-롯데 · LG-키움 (KT-한화, SSG-두산은 같음).</div>' +
      '<div class="small muted" style="margin-top:6px">출처: KBO 보도자료(2026 일정 발표), 뉴스서울(2024 · 2025 일정 발표), 위키트리(2026 최종 순위), 스포츠경향(올림픽 주경기장 이전)</div></div></div></div>';
  };

  // ───────── 처음 화면 ─────────
  function savedResult27() { const r = S.repo.load(YEAR_NEW); return r && r.project.meta && r.project.meta.result ? r.project.meta.result : app().state.meta.result && inPlan() ? app().state.meta.result : null; }
  const runningNote = () => '<div class="pf-note warn" style="margin:0 0 12px">계획을 실행하는 중입니다. 끝나면 결과 화면으로 넘어갑니다. <button class="pf-link" data-act="pf-stage" data-stage="2">실행 화면으로 ›</button></div>';
  function renderStart() {
    const ours = P.builtin['2025-best'], kbo = kboData();
    const pct = ours ? Math.round((1 - ours.gaps.totalKm / kbo.gaps.totalKm) * 100) : null;
    const step = (n, t, s, est) => '<li><b>' + n + ' ' + t + '</b><span>' + s + (est ? ' <span class="pf-tag est">추정 ' + est + '개</span>' : '') + '</span></li>';
    const res = savedResult27(), hasResult = res && !(inPlan() && resultStale(app().state));
    return '<div class="pf-start">' + (isRunning() ? runningNote() : '') + '<h1>무엇을 할까요?</h1><p class="lead">2025는 결과 확인, 2027은 새 계획 만들기</p><div class="pf-choices">' +
      '<div class="pf-ch"><div class="kick">확인용</div><div class="y">2025<small>계획 보기</small></div><p class="what">KBO 실제 일정과 이 엔진의 일정을 비교합니다.</p>' +
      '<div class="pf-kpi"><div class="k">전체 이동 거리</div>' + (ours ? '<div class="v">' + pct + '% 짧음</div><div class="s">KBO ' + num(kbo.gaps.totalKm) + 'km → ' + num(ours.gaps.totalKm) + 'km</div>' : '<div class="s">' + (P.builtinFailed ? '저장된 결과를 읽지 못했습니다' : '저장된 결과를 불러오는 중입니다') + '</div>') + '</div>' +
      '<div class="grow"></div><div class="acts"><button class="btn" data-act="pf-open-2025">2025 결과 보기' + icon('right') + '</button></div></div>' +
      '<div class="pf-ch go"><div class="kick">새 계획</div><div class="y">2027<small>새 계획 만들기</small></div><p class="what">먼저 미리 채운 2027 값을 4단계로 검토합니다.</p><ul>' +
      step(1, '구단 정보', 'LG·두산 구장 바뀜 · 그 밖에 확인') + step(2, '시즌 기간·연전 묶음', '개막일 · 올스타 휴식기 · 1차 편성 기간', 3) + step(3, '공휴일·홈 구장', '개막전 · 어린이날 홈 구단', 2) + step(4, '확인', '모두 맞으면 다음으로') +
      '</ul><div class="small muted">노란 <span class="pf-tag est">추정</span> 값은 확정 전이라 꼭 확인하세요. 단계마다 말풍선이 안내합니다.</div><div class="grow"></div>' +
      '<div class="acts">' + (hasResult ? '<button class="btn primary" data-act="pf-open-2027" data-to="result">결과 이어서 보기' + icon('right') + '</button><button class="btn" data-act="pf-open-2027">값 다시 검토</button>' : '<button class="btn primary" data-act="pf-open-2027">검토 시작' + icon('right') + '</button>') + '</div></div>' +
      '</div></div>';
  }
  /** 저장해 둔 2027이 개막 대진을 정하기 전 것이고 아직 검토하지 않았으면 기본 제공 값으로 다시 연다 */
  function open2027() {
    const rec = S.repo.load(YEAR_NEW), bad = rec && !rec.project.meta.review && !(rec.project.meta.flow || {}).teams && !((rec.project.events || []).find((e) => e.type === 'OPENING') || {}).basis;
    let fresh = bad ? S.builtinOf(YEAR_NEW).build() : null;
    // 잠실로 저장해 둔 2027은 LG·두산 구장만 고친다(검토한 것은 그대로)
    const SH = KBO.Preset2027.SHARED_STADIUM;
    if (!fresh && rec && rec.project.teams.some((t) => t.stadium === SH.was)) {
      fresh = rec.project;
      fresh.teams = KBO.Preset2027.teams2027(fresh.teams);
      for (const e of fresh.events || []) if (e.stadiums) e.stadiums = e.stadiums.map((x) => (x === SH.was ? SH.name : x));
    }
    if (S.seasonYear() !== YEAR_NEW || fresh) S.switchYear(YEAR_NEW, { quiet: true, to: 'stay', project: fresh || undefined, save: !!fresh });
    S.repo.setLastYear(YEAR_NEW);
  }

  // ───────── 2025 보기 ─────────
  let kboCache = null;
  function kboData() { if (!kboCache) kboCache = dataOf(Score.scoreProject(KBO.Preset.buildProject(), {})); return kboCache; }
  function render2025() {
    const ours = P.builtin['2025-best'];
    if (!ours) return '<div class="pf-page"><div class="pf-sec">' + (P.builtinFailed ? '<h3>저장된 2025 결과를 읽지 못했습니다</h3><p class="pf-d">편성 서버 주소로 열면 볼 수 있습니다. 2027 새 계획은 지금도 만들 수 있습니다.</p>' : '<h3>결과를 불러오는 중입니다</h3>') + '</div></div>';
    if (P.view25 === 'dash') return '<div class="pf-page">' + dashboard(ours, ours.objective, { title: '2025 이 엔진', noSave: true }) + '</div>';
    const kbo = kboData(), ob = ours.objective, ids = ob.order;
    const pct = (id) => Math.round((1 - goalValue(ours, id) / goalValue(kbo, id)) * 100);
    const card = (id, k) => { const g = GOALS[id];
      return '<div class="pf-tile win"><span class="pf-rk">' + (k + 1) + '순위</span><div class="k">' + g.name + '<small>' + (g.tol ? '가장 많은·적은 구단 차이' : '10구단 합') + '</small></div>' +
        '<div class="v"><span class="old">KBO ' + goalShow(kbo, id) + g.unit + ' →</span>' + goalShow(ours, id) + '<small>' + g.unit + '</small></div><div class="d">▼ ' + pct(id) + '% ' + (g.tol ? '줄임' : '짧음 (' + num(goalValue(kbo, id) - goalValue(ours, id)) + 'km)') + '</div>' +
        '<div class="s">' + (g.tol ? '허용 ' + num(ob[g.tol]) + g.unit + ' — KBO ' + (within(kbo, id, ob) ? '안' : '<b style="color:var(--bad)">넘음</b>') + ' · 이 엔진 ' + (within(ours, id, ob) ? '<b style="color:var(--ok)">안</b>' : '넘음') : '짧을수록 좋음') + '</div></div>'; };
    const allBetter = ids.every((id) => goalValue(ours, id) <= goalValue(kbo, id));
    const names = Object.keys(ours.teams);
    const worse = [];
    if (Math.min(...vals(ours, 'away')) > Math.min(...vals(kbo, 'away'))) worse.push('가장 긴 연속 원정은 KBO가 ' + rangeText(kbo, 'away') + ', 이 엔진은 ' + rangeText(ours, 'away') + '(규칙 한도 안)');
    return '<div class="pf-page">' +
      '<div class="pf-hero"><div class="big">−' + pct('total') + '<small>%</small></div><div><h2>' + (allBetter ? '목적식 4개 모두 KBO보다 나음' : 'KBO 실제와 비교') + '</h2><p>같은 2025 조건에서 비교 · 전체 이동 거리 ' + goalShow(kbo, 'total') + 'km → ' + goalShow(ours, 'total') + 'km · 구단 간 이동 거리 차이 ' + goalShow(kbo, 'distance') + 'km → ' + goalShow(ours, 'distance') + 'km · 꼭 지킬 규칙 모두 지킴</p></div><div class="r"><span class="pf-tag got">저장된 결과 · ' + esc(ours.savedAt) + ' 실행</span></div></div>' +
      '<div class="pf-tiles">' + ids.map(card).join('') + '</div>' +
      '<div class="pf-cols" style="grid-template-columns:1.2fr 1fr">' +
      '<div class="pf-sec"><h3>구단별 이동 거리</h3><p class="pf-d">회색 KBO 실제 · 파랑 이 엔진 · 초록 띠 = 이 엔진에서 가장 적은 구단 + 허용 차이</p>' + bars(ours, 'km', ob.distanceGapKm, 1, kbo) + '</div>' +
      '<div class="pf-sec"><h3>구단별 표</h3><p class="pf-d">KBO 실제 → 이 엔진</p><table class="pf-t"><thead><tr><th>구단</th><th>이동 횟수</th><th>주말·공휴일 홈(점)</th><th>주말 홈 시리즈</th><th>가장 긴 연속 원정</th></tr></thead><tbody>' +
      names.map((t) => { const a = kbo.teams[t], b = ours.teams[t]; return '<tr><td><b>' + esc(t) + '</b></td><td>' + a.moves + ' → <b>' + b.moves + '</b></td><td>' + a.hol + ' → <b>' + b.hol + '</b></td><td>' + a.wk + ' → ' + b.wk + '</td><td>' + a.away + ' → ' + b.away + '</td></tr>'; }).join('') +
      '</tbody></table>' + (worse.length ? '<div class="pf-note warn"><b>KBO가 나은 점</b> — ' + esc(worse.join(' · ')) + '</div>' : '') + '</div></div></div>';
  }

  // ───────── 1 값 입력·검증 ─────────
  /** 처음 제공한 2027 값(직접 고쳤는지 견주는 기준) */
  const preset27 = () => P.preset27 || (P.preset27 = S.builtinOf(YEAR_NEW).build());
  const evOf = (p, t) => (p.events || []).find((e) => e.type === t) || {};
  const starOf = (p) => (p.settings.blackouts || []).find((b) => /올스타/.test(b.label || '')) || {};
  /** 추정값 줄: 처음 값과 달라졌으면 「직접 고침」으로 바꿔 보인다 */
  function editedNote(key) {
    const a = app().state, b = preset27();
    const same = {
      opening: () => a.settings.seasonStart === b.settings.seasonStart,
      initialEnd: () => a.settings.initialEnd === b.settings.initialEnd,
      allStar: () => starOf(a).start === starOf(b).start && starOf(a).end === starOf(b).end,
      openingHome: () => JSON.stringify(evOf(a, 'OPENING').pairs || evOf(a, 'OPENING').teams) === JSON.stringify(evOf(b, 'OPENING').pairs || evOf(b, 'OPENING').teams),
      childrenHome: () => (evOf(a, 'CHILDREN').teams || []).slice().sort().join() === (evOf(b, 'CHILDREN').teams || []).slice().sort().join()
    }[key]();
    if (same) return null;
    const was = {
      opening: () => fmt.date(b.settings.seasonStart),
      initialEnd: () => fmt.date(b.settings.initialEnd),
      allStar: () => fmt.date(starOf(b).start) + ' ~ ' + fmt.date(starOf(b).end),
      openingHome: () => evOf(b, 'OPENING').pairs.map((x) => x.away + '@' + x.home).join(' · '),
      childrenHome: () => evOf(b, 'CHILDREN').teams.join(' · ')
    }[key]();
    return '직접 고친 값입니다. 처음 추정값은 ' + was + '였습니다.';
  }
  function rv(r0, cur) {
    const note = r0.key ? editedNote(r0.key) : null;
    const r = note ? Object.assign({}, r0, { tag: 'mine', why: note, src: '', more: '' }) : r0;
    const tag = r.tag === 'est' ? '<span class="pf-tag est">추정 · 확정 아님</span>' : r.tag === 'got' ? '<span class="pf-tag got">' + esc(r.tagText || '2025에서 가져옴') + '</span>' : r.tag === 'rule' ? '<span class="pf-tag blue">규칙대로 자동</span>' : r.tag === 'mine' ? '<span class="pf-tag blue">직접 고침</span>' : '';
    const ok = r.key ? !!review()[r.key] : false;
    const to = ' data-to="' + (r.key || r.to || '') + '"';
    const acts = r.key
      ? (ok ? '<span class="pf-tag ok">✓ 확인함</span><button class="btn sm" data-act="pf-cal"' + to + '>다시 고치기</button>' : '<button class="btn sm pf-okb" data-act="pf-ok" data-k="' + r.key + '">✓ 맞아요</button><button class="btn sm" data-act="pf-cal"' + to + '>고치기</button>')
      : '<button class="btn sm" data-act="pf-cal"' + to + '>' + (r.editText || '고치기') + '</button>';
    return '<div class="pf-rv' + (ok ? ' ok' : cur ? ' cur' : '') + '"' + (r.key ? ' data-k="' + r.key + '"' : '') + '><div><b class="t">' + esc(r.t) + '</b> ' + tag + '<div class="v">' + r.v + '</div>' + (r.v2 ? '<div class="v2">' + r.v2 + '</div>' : '') +
      '<div class="why"><em>왜 이 값?</em> ' + esc(r.why) + (r.src ? ' <em>· 근거:</em> ' + esc(r.src) : '') + (r.more || '') + '</div>' + (r.warn || '') + '</div><div class="acts">' + acts + '</div></div>';
  }
  const firstOpen = (n) => (KEYS[n] || []).find((k) => !review()[k]);
  function renderSeasonReview() {
    const st = app().state, s = st.settings, gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(st.calendar), cur = firstOpen(2);
    const star = (s.blackouts || []).find((b) => /올스타/.test(b.label || ''));
    const four = st.calendar.find((c) => c.consecutive === 4);
    const rows = [
      { key: 'opening', t: '개막일', tag: 'est', v: fmt.date(s.seasonStart) + ' · 개막 2연전', ...BASIS.opening },
      { key: 'initialEnd', t: '1차 편성이 끝나는 날', tag: 'est', v: fmt.date(s.initialEnd) + ' · 경기일 ' + gd.have + '일', ...BASIS.initialEnd },
      { key: 'allStar', t: '올스타 휴식기', tag: 'est', v: star ? fmt.date(star.start) + ' ~ ' + fmt.date(star.end) : '없음', ...BASIS.allStar },
      { t: '후반기 첫 4연전', to: 'allStar', tag: 'rule', v: four ? Dates.fmtDate(four.datetime) + ' ~ ' + Dates.fmtDate(Dates.addDays(four.datetime, 3)) : '없음', ...BASIS.four },
      { t: '쉬는 요일', to: 'rest', tag: 'got', v: esc(s.restWeekdays.map((w) => '일월화수목금토'[w] + '요일').join('·') || '없음'), why: '2025와 같은 관행입니다.', src: '2025 일정' }
    ];
    const sum = (KEYS[2].filter((k) => review()[k]).length);
    return '<div class="pf-page"><div class="pf-cols" style="grid-template-columns:minmax(0,1fr) 340px">' +
      '<div class="pf-sec"><h3>시즌 기간·연전 묶음<span class="r"><b>' + sum + ' / ' + KEYS[2].length + '</b> 확인함</span></h3><p class="pf-d">줄마다 「맞아요」 또는 「고치기」. 개막일과 1차 편성 기간이 정해지면 경기일과 연전 묶음은 규칙대로 자동으로 만들어집니다.</p>' + rows.map((r) => rv(r, r.key === cur)).join('') + '</div>' +
      '<div class="pf-sec"><h3>자동 계산</h3><p class="pf-d">값을 고치면 바로 다시 셉니다.</p><div class="pf-nums">' +
      '<div class="pf-num"><div class="k">경기일</div><div class="v">' + gd.have + '<small> / ' + gd.need + '일</small></div></div><div class="pf-num"><div class="k">연전 묶음</div><div class="v">' + st.calendar.length + '<small>개</small></div><div class="s">3연전 ' + (h[3] || 0) + ' · 2연전 ' + (h[2] || 0) + ' · 4연전 ' + (h[4] || 0) + '</div></div>' +
      '<div class="pf-num" style="grid-column:1/3"><div class="k">기간</div><div class="v" style="font-size:16px">' + fmt.short(s.seasonStart) + ' ~ ' + fmt.short(s.initialEnd) + '</div></div></div>' +
      '<div class="pf-note"><b>달력으로 보기</b> — 「고치기」를 누르면 시즌 달력이 열립니다.</div></div></div></div>';
  }
  function renderHomeReview() {
    const st = app().state, s = st.settings, cur = firstOpen(3);
    const chips = (a) => (a || []).map((t) => '<span class="pf-chip">' + esc(t) + '</span>').join('');
    const op = (st.events || []).find((e) => e.type === 'OPENING') || {}, ch = (st.events || []).find((e) => e.type === 'CHILDREN') || {};
    const hol = s.holidays.filter((h) => h.date >= s.seasonStart && h.date <= s.initialEnd);
    const ht = s.homeTotals;
    const pairs = (op.pairs || []).map((x) => x.away + '@' + x.home).join(' · ');
    const more = ' <button class="pf-link" data-act="pf-basis">자세히 ›</button>';
    const homesOk = openingHomesOk(st);
    const rows = [
      { t: '공휴일', tag: 'got', tagText: '공휴일 달력', v: '1차 편성 기간 안 ' + hol.length + '일', v2: hol.map((h) => fmt.short(h.date) + ' ' + esc(h.name)).join(' · '), why: '정부 공휴일 달력 그대로입니다. 홈 경기 점수는 주말 하루 1점, 공휴일 2점, 어린이날 3점으로 셉니다.' },
      ht ? { t: '홈 경기 수', to: 'rules', tag: 'rule', v: (ht.more && ht.more.total) + '경기: ' + esc(ht.moreTeams.join(' · ')) + ' &nbsp;/&nbsp; ' + (ht.less && ht.less.total) + '경기: 나머지 5구단', ...BASIS.homeTotals } : null,
      { key: 'openingHome', t: '개막 2연전 홈', tag: 'est', v: fmt.short(op.date || s.seasonStart) + ' &nbsp;' + chips(op.teams), v2: pairs ? '대진 ' + esc(pairs) : '', more, ...BASIS.openingHome, warn: homesOk ? '' : '<div class="pf-note warn">홈 구단이 전년도 순위와 다릅니다(' + esc(OPENING_HOMES().join(' · ')) + '). 되돌려야 다음으로 갈 수 있습니다. <button class="pf-link" data-act="pf-op-reset">전년도 순위대로 되돌리기 ›</button></div>' },
      { key: 'childrenHome', t: '어린이날 홈', tag: 'est', v: fmt.short(ch.date || '2027-05-05') + ' &nbsp;' + chips(ch.teams), ...BASIS.childrenHome },
      { t: '후반기 첫 4연전 홈', to: 'rules', tag: 'rule', v: s.fourGameHome === 'swap' ? '개막 대진에서 홈 바꿈' : '개막 대진 그대로', why: '개막 대진을 고치면 함께 바뀝니다.', src: '2027 원칙' }
    ].filter(Boolean);
    const sum = KEYS[3].filter((k) => review()[k]).length;
    return '<div class="pf-page"><div class="pf-cols" style="grid-template-columns:minmax(0,1fr) 340px">' +
      '<div class="pf-sec"><h3>공휴일·홈 구장<span class="r"><b>' + sum + ' / ' + KEYS[3].length + '</b> 확인함</span></h3><p class="pf-d">정한 날에 홈 경기를 할 구단을 지정합니다. 나머지 날의 홈·원정은 엔진이 정합니다.</p>' + rows.map((r) => rv(r, r.key === cur)).join('') + '</div>' +
      '<div class="pf-sec"><h3>개막전 근거</h3><p class="pf-d">공식 발표(보통 12월 중순) 전 예상입니다.</p><div class="small" style="line-height:1.7">홈 구단 <span class="pf-tag ok">신뢰도 높음</span><br>전년도 상위 5팀. 2026 최종 순위 기준.<div style="height:8px"></div>대진 <span class="pf-tag est">신뢰도 낮음~중간</span><br>2025 개막 대진 재사용(1순위 예측).</div><div class="pf-note"><button class="pf-link" data-act="pf-basis">근거 자세히 보기 ›</button></div></div></div></div>';
  }
  const origStep1 = S.guideUI.renderStep1;
  S.guideUI.renderStep1 = function (R) {
    if (G.mode === 'all') return null;
    if (G.mode === 'year' || G.mode === 'resume') return renderStart();
    if ((G.fs === 2 || G.fs === 3) && !P.calEdit) return S.flowWrap(G.fs === 2 ? renderSeasonReview() : renderHomeReview(), 'pf-rvw');
    if (G.fs === 4) return S.flowWrap(S.renderCheck().replace(/다음: [①-④]? ?검토·실행/g, '다음: 엔진 옵션·실행').replace(/<h2>\d{4} 시즌 데이터가 모두 준비됐습니다<\/h2>/, S.flowStatus().allDone ? '<h2>검토 완료</h2>' : '<h2>아직 검토할 값이 남았습니다</h2>'), 'ck');
    if (G.fs === 1 && inPlan()) {
      const SH = KBO.Preset2027.SHARED_STADIUM;
      const changed = app().state.teams.some((t) => t.stadium === SH.name);
      if (changed) return origStep1(R).replace('바뀐 정보가 있나요?', '그 밖에 바뀐 정보가 있나요?').replace('<div class="fl-ask', '<div class="pf-note warn" style="margin-top:0"><b>이미 고쳐 둔 곳</b> — LG·두산 구장: 잠실 → ' + esc(SH.name) + '. 잠실야구장이 2026시즌 뒤 철거되어 2027~2031년 임시로 씁니다. 바로 옆 구장이라 구장 사이 거리는 잠실 값을 그대로 씁니다.</div><div class="fl-ask');
    }
    return origStep1(R);
  };
  /** 단계 띠: 기존 모양에 이름만 「값 입력·검증」으로, 끝에 「따라 하기 다시 보기」 */
  const origBand = S.flowBand;
  S.flowBand = function () {
    return origBand().replace(/(<b>\d{4} 시즌 · )[①]? ?데이터 준비/, '$1값 입력·검증').replace(/<button class="lnk" data-act="fl-resume">[\s\S]*?<\/button>/, '<button class="lnk" data-act="pf-tour-again">' + icon('info') + '따라 하기 다시 보기</button>');
  };

  // ───────── 말풍선 ─────────
  const TOUR = {
    1: { a: '.fl-ask', title: '한 단계씩 검토', text: () => '값은 미리 채워 두었지만 확정되지 않은 추정값이 섞여 있습니다. 단계마다 「왜 이 값?」을 읽고, 맞으면 「맞아요」, 다르면 「고치기」를 누르세요. 먼저 구단 정보입니다. LG·두산 구장은 올림픽 주경기장으로 고쳐 두었습니다. 그 밖에 달라진 것이 없으면 「없어요」.' },
    2: { a: '.pf-rv.cur', title: '추정값 확인', text: () => '노란 표시는 확정 전 값입니다. 맞으면 「맞아요」, KBO 계획과 다르면 「고치기」로 달력에서 바꾸세요. 경기일과 연전 묶음은 바로 다시 계산됩니다.' },
    3: { a: '.pf-rv.cur', title: '개막전 홈 확인', text: () => '홈 구단은 2026 최종 순위로 정해져 바꾸지 않습니다. 대진은 예측이라 신뢰도가 낮습니다. KBO 발표(보통 12월 중순)와 상대가 다르면 「고치기」를 누르세요. 후반기 첫 4연전도 따라 바뀝니다.' },
    4: { a: '.footer .btn.primary', title: '다음은 엔진 옵션', text: () => '무엇을 먼저 맞출지와 구단 사이 차이를 얼마까지 허용할지 정한 뒤 실행합니다. 기본값 그대로 실행해도 됩니다.' }
  };
  const tourKey = (n) => S.KEY + 'tour:plan' + n;
  const origAfter = S.guideUI.after;
  S.guideUI.after = function (el) {
    if (!el) return;
    S.flowTour.suppressed = true;
    if (S.flowTour.cur) { origAfter(el); return; }
    const on = S.ui.step === 1 && !S.ui.ops && G.mode === 'flow' && !P.calEdit && !isRunning() && !S.guideBlocked() && S.seasonYear() === YEAR_NEW;
    const n = G.fs;
    if (!on || S.ls.get(tourKey(n)) === '1') { el.innerHTML = ''; return; }
    const t = TOUR[n], a = document.querySelector(t.a);
    if (!a) { el.innerHTML = ''; return; }
    const r = a.getBoundingClientRect();
    el.innerHTML = '<div class="ct-ring" style="left:' + (r.left - 4) + 'px;top:' + (r.top - 4) + 'px;width:' + (r.width + 8) + 'px;height:' + (r.height + 8) + 'px"></div>' +
      '<div class="ct-card" role="dialog" aria-label="따라 하기 ' + n + ' / 4"><div class="ct-head"><span class="ct-no">따라 하기 ' + n + ' / 4</span><span class="ct-dots">' + [1, 2, 3, 4].map((k) => '<i class="' + (k === n ? 'on' : k < n ? 'done' : '') + '"></i>').join('') + '</span></div>' +
      '<h4>' + esc(t.title) + '</h4><p>' + esc(t.text()) + '</p><div class="ct-acts"><button class="btn xs primary" data-act="pf-tour-ok">알겠어요</button></div></div>';
    const c = el.querySelector('.ct-card'), W = window.innerWidth, H = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
    let left = r.right + 14, top = r.top - 8;
    if (left + cw > W - 8) { left = Math.max(8, Math.min(W - cw - 8, r.left + 60)); top = r.bottom + 10; }
    if (top + ch > H - 8) top = Math.max(8, r.top - ch - 12);
    c.style.left = left + 'px'; c.style.top = top + 'px';
  };

  // ───────── 2 엔진 옵션·실행 ─────────
  function orderCards(ob) {
    const key = ob.order.join();
    const hit = ORDERS.find((o) => o.order.join() === key);
    const custom = P.customOrder || !hit;
    const card = (o) => '<button class="pf-oc' + (!custom && hit && hit.id === o.id ? ' on' : '') + '" data-act="pf-order" data-id="' + o.id + '"><h4>' + (!custom && hit && hit.id === o.id ? '<span class="pf-tag blue">고름</span>' : '') + esc(o.name) + '</h4><p>' + esc(o.desc) + '</p><ol>' + o.order.map((i) => '<li>' + GOALS[i].name + '</li>').join('') + '</ol></button>';
    const diy = '<div class="pf-oc' + (custom ? ' on' : '') + '" data-act="pf-order-custom"><h4>' + (custom ? '<span class="pf-tag blue">고름</span>' : '') + '직접 정하기</h4><p>화살표로 순서를 바꿉니다</p><ol>' +
      ob.order.map((i, k) => '<li>' + GOALS[i].name + (custom ? '<span class="pf-mv"><button data-act="pf-move" data-k="' + k + '" data-d="-1"' + (k === 0 ? ' disabled' : '') + ' aria-label="위로">▲</button><button data-act="pf-move" data-k="' + k + '" data-d="1"' + (k === 3 ? ' disabled' : '') + ' aria-label="아래로">▼</button></span>' : '') + '</li>').join('') + '</ol></div>';
    return ORDERS.map(card).join('') + diy;
  }
  function slider(id, ob) {
    const g = GOALS[id], ref = P.builtin['2025-best'], kbo = kboData();
    const tol = ob[g.tol], ours = ref ? vals(ref, g.metric) : [], kb = vals(kbo, g.metric), all = ours.concat(kb);
    const step = id === 'distance' ? 50 : 1, mn = ours.length ? Math.min(...ours) : Math.min(...kb);
    const pad = id === 'distance' ? 200 : 2;
    const lo = Math.floor((Math.min(...all) - pad) / step) * step, hi = Math.ceil((Math.max(...all) + pad) / step) * step;
    const x = (v) => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
    const maxTol = Math.floor((hi - mn) / step) * step;
    const ticks = []; const every = id === 'distance' ? 400 : 2;
    for (let v = Math.ceil(lo / every) * every; v <= hi; v += every) ticks.push('<span class="tk" style="left:' + x(v) + '">' + num(v) + '</span>');
    return '<div class="pf-sl"><div class="k"><b>' + g.name + '</b><small>가장 많은·적은 구단 차이</small></div><div class="pf-ax"><span class="ln"></span>' +
      '<span class="win" style="left:' + x(mn) + ';width:calc(' + x(Math.min(mn + tol, hi)) + ' - ' + x(mn) + ')"></span>' +
      kb.map((v) => '<span class="dot g" style="left:' + x(v) + '"></span>').join('') + ours.map((v) => '<span class="dot" style="left:' + x(v) + '"></span>').join('') + ticks.join('') +
      '<input type="range" min="0" max="' + maxTol + '" step="' + step + '" value="' + tol + '" data-in="pf-gap" data-live="pf-gap-live" data-k="' + g.tol + '" data-lo="' + lo + '" data-hi="' + hi + '" data-mn="' + mn + '" aria-label="' + esc(g.name) + ' 허용 차이" style="left:' + x(mn) + ';width:calc(100% - ' + x(mn) + ')"></div>' +
      '<div class="v2"><input value="' + num(tol).replace(/,/g, '') + '" data-in="pf-gap" data-k="' + g.tol + '" inputmode="numeric" aria-label="' + esc(g.name) + ' 허용 차이 숫자"> ' + g.unit + '<small>' + (ref ? '2025 이 엔진 ' + goalShow(ref, id) + ' · ' : '') + 'KBO ' + goalShow(kbo, id) + '</small></div></div>';
  }
  function renderOptions() {
    const ob = objective(), pf = app().preflight();
    const rest = app().engineConfig.kind === 'REST', info = (app().engineConfig && app().engineConfig.info) || {};
    const maxSec = rest && info.maxSeconds ? info.maxSeconds : null;
    const times = [60, 120, 180, 300];
    return '<div class="pf-page">' +
      '<div class="pf-sec"><h3>우선순위</h3><p class="pf-d">추천 순서 하나를 고르거나 직접 정합니다. 1순위가 조금이라도 나은 결과를 고르고, 2순위는 1순위가 같을 때만 봅니다. 반드시 지킬 규칙은 어느 순서든 항상 지킵니다.</p><div class="pf-orders">' + orderCards(ob) + '</div></div>' +
      '<div class="pf-sec"><h3>허용 차이</h3><p class="pf-d">초록 창을 끌어 정합니다. 파랑 점 = 2025 이 엔진의 구단 10개, 회색 점 = 2025 KBO 실제. 창 안에 모든 구단이 들어오면 만족으로 보고 다음 순위로 넘어가고, 나가면 나간 만큼 줄이려 노력합니다(반드시 지키는 것은 아님).</p>' +
      ['moves', 'distance', 'holiday'].map((id) => slider(id, ob)).join('') + '</div>' +
      '<div class="pf-sec"><div class="pf-runbar"><div class="grow"><b style="color:var(--navy);font-size:15px">실행</b><div class="small muted">' + (freshResult(app().state) ? '<b>지금 결과에서 이어서 풉니다.</b> ' : '<b>처음부터 풉니다.</b> ') + '고른 시간은 최대치입니다. 고른 시간의 절반 동안 더 나아지지 않으면 먼저 끝납니다. 그동안 지금까지 가장 좋은 결과를 계속 보여 줍니다.</div></div>' +
      '<span class="pf-time">' + times.map((t) => '<button class="' + (P.timeSec === t ? 'on' : '') + '" data-act="pf-time" data-v="' + t + '">최대 ' + t / 60 + '분</button>').join('') + '</span>' +
      (rest ? '' : '<span class="pf-tag est" title="편성 서버에 연결되지 않아 브라우저 시험 엔진을 씁니다">시험 엔진 — 결과가 좋지 않습니다</span>') +
      '<button class="btn primary lg" data-act="pf-run"' + (pf.ok ? '' : ' disabled') + '>' + icon('play') + '최대 ' + P.timeSec / 60 + '분 실행</button></div>' +
      (maxSec && maxSec < P.timeSec ? '<div class="pf-note warn">서버 한도가 ' + maxSec + '초라 그 시간까지만 실행합니다.</div>' : '') +
      (pf.ok ? '' : '<div class="pf-note warn">사전 점검에 진행 불가 ' + pf.counts.block + '건이 있어 실행할 수 없습니다. 값 입력·검증으로 돌아가 고치세요.</div>') + '</div></div>';
  }
  function tiles(data, ob) {
    return '<div class="pf-tiles">' + ob.order.map((id, k) => { const g = GOALS[id], v = goalValue(data, id), ok = within(data, id, ob);
      return '<div class="pf-tile"><span class="pf-rk">' + (k + 1) + '순위</span><div class="k">' + g.name + '</div><div class="v">' + goalShow(data, id) + '<small>' + g.unit + '</small></div>' +
        (g.tol ? '<div class="pf-meter"><i class="' + (ok ? '' : 'over') + '" style="width:' + Math.min(100, ob[g.tol] ? v / ob[g.tol] * 100 : 100).toFixed(0) + '%"></i></div><div class="s">허용 ' + num(ob[g.tol]) + g.unit + ' — ' + (ok ? '<b style="color:var(--ok)">안</b>' : '<b style="color:var(--bad)">넘음</b>') + '</div>' : '<div class="s" style="margin-top:6px">짧을수록 좋음 · 10구단 합</div>') + '</div>'; }).join('') + '</div>';
  }
  // 지킨 규칙으로 읽히는 이름(엔진 규칙 이름은 위반을 가리키는 말이라 ✓ 옆에 두면 반대로 읽힌다)
  const RULE_OK = { 'H0-a': '모든 구단 출전', 'H0-b': '구장 겹침 없음', 'H0-c': '하루 5경기', 'H0-d': '연전 수 맞음', 'H0-e': '지정한 날 홈 구단', 'H0-f': '홈·원정 연속 3시리즈까지', H1: '같은 대진 연속 없음' };
  function rulesList(ex) {
    return '<div class="pf-rules">' + Score.HARD_RULES.map((r) => { const c = ex.byCode[r.code]; const bad = c && c.count > 0;
      return '<div class="pf-rl' + (bad ? ' bad' : '') + '"><i>' + (bad ? '!' : '✓') + '</i><b>' + esc(RULE_OK[r.code] || S.ruleName(r.code)) + '</b><span class="small muted">' + (bad ? c.count + '건' : '') + '</span></div>'; }).join('') + '</div>';
  }
  function renderRunning() {
    const c = app().derived(), ex = c.ex, data = dataOf(ex), ob = objective(), r = S.run;
    return '<div class="pf-page"><div class="pf-hero run"><div class="big">찾는 중…</div><div><h2>지금까지 가장 좋은 결과</h2><p>' + fmt.time(r.elapsed) + ' 지남 · ' + (ex.feasible ? '반드시 지킬 규칙을 모두 지키는 중' : '규칙을 맞춰 가는 중') + ' · 더 나은 결과가 나오는 대로 받아 옵니다 · 더 나아지지 않으면 최대 시간 전에 끝납니다</p></div><div class="r"><button class="btn" data-act="run-stop">멈추고 이 결과 쓰기</button></div></div>' +
      tiles(data, ob) + '<div class="pf-cols" style="grid-template-columns:1.3fr 1fr"><div class="pf-sec"><h3>구단별 이동 거리</h3><p class="pf-d">초록 띠 = 가장 적은 구단 + 허용 차이 ' + num(ob.distanceGapKm) + 'km</p>' + bars(data, 'km', ob.distanceGapKm, 1) + '</div>' +
      '<div class="pf-sec"><h3>반드시 지킴</h3><p class="pf-d">지금 결과 기준</p>' + rulesList(ex) + '</div></div></div>';
  }
  const origStep2 = S.steps[2].render;
  S.steps[2].render = function () {
    if (S.seasonYear() !== YEAR_NEW) return origStep2();
    return '<div class="stepview no-band">' + (isRunning() ? renderRunning() : renderOptions()) + '</div>';
  };
  /** 실행이 끝나면(step-review.js finish): 결과를 기록하고 현재 결과 분석으로 */
  S.afterRun = function (ex, run, why) {
    if (S.seasonYear() !== YEAR_NEW) return false;
    app().store.commit('실행 결과 기록', (s) => { s.meta.result = { at: new Date().toISOString(), elapsedMs: run.elapsed, why, objective: s.settings.objective || DEFAULT_OBJECTIVE, sig: inputSig(s), calSig: calSig(s) }; }, { tags: ['meta'], undo: false });
    P.name = '';
    const instant = Date.now() - run.startedAt < 3000 && why !== '사용자 중지'; // 서버가 같은 조건의 결과를 저장해 두었다가 바로 돌려준 경우(걸린 시간은 그때 실행한 값으로 온다)
    S.toast(instant ? '같은 조건으로 전에 실행한 결과를 바로 가져왔습니다.' : '실행이 끝났습니다(' + ({ '최대 실행 시간': '고른 최대 시간까지 실행', '개선 없음': '더 나아지지 않아 먼저 끝남', '사용자 중지': '직접 멈춤' }[why] || why) + ').', ex.feasible ? 'ok' : 'warn', instant ? 6000 : 4000);
    S.go({ step: 5, sel: null });
    return true;
  };

  // ───────── 막대 ─────────
  /** 구단별 막대(많은 순). tol이 있으면 가장 적은 구단 + tol 띠, other가 있으면 회색 막대로 함께 */
  function bars(data, k, tol, d, other) {
    const names = Object.keys(data.teams), a = names.map((t) => data.teams[t][k]), b = other ? names.map((t) => other.teams[t][k]) : null;
    const all = a.concat(b || []), lo = Math.min(...all), hi = Math.max(...all), mn = Math.min(...a);
    const base = k === 'km' ? Math.floor(lo * 0.9 / 100) * 100 : Math.max(0, Math.floor(lo - 4));
    const top = Math.max(hi, tol ? mn + tol : hi) * (k === 'km' ? 1.02 : 1) + (k === 'km' ? 0 : 1);
    const x = (v) => ((v - base) / (top - base) * 100).toFixed(1) + '%';
    const mean = a.reduce((s, v) => s + v, 0) / a.length;
    const rows = names.map((t, i) => ({ t, v: a[i], w: b ? b[i] : null })).sort((p, q) => q.v - p.v);
    return '<div class="pf-tb' + (b ? ' two' : '') + '">' + rows.map((r) => '<div class="pf-rw"><span class="t">' + esc(r.t) + '</span><span class="tr">' + (tol ? '<span class="tol" style="left:' + x(mn) + ';width:calc(' + x(mn + tol) + ' - ' + x(mn) + ')"></span>' : '') +
      (b ? '<span class="bar g" style="width:' + x(r.w) + '"></span>' : '') + '<span class="bar" style="width:' + x(r.v) + '"></span></span><span class="n">' + num(r.v, d) + (b ? ' <span class="muted">/ ' + num(r.w, d) + '</span>' : '') + '</span><span class="dv">평균 ' + (r.v - mean >= 0 ? '+' : '−') + num(Math.abs(r.v - mean), d ? 0 : 1) + '</span></div>').join('') +
      '</div><div class="xs muted" style="margin-top:4px">막대는 ' + num(base) + (k === 'km' ? 'km' : '') + '부터' + (b ? ' · 숫자는 파랑 / 회색' : '') + '</div>';
  }

  // ───────── 3 현재 결과 분석 ─────────
  function dashboard(data, ob, o) {
    const opt = o || {};
    const panel = (id, k, body) => { const g = GOALS[id], ok = within(data, id, ob);
      return '<div class="pf-sec"><h3><span class="pf-rk">' + (k + 1) + '순위</span>' + g.name + '<span class="r">' + (g.tol ? '차이 <b style="color:var(--navy);font-size:15px">' + goalShow(data, id) + g.unit + '</b> / 허용 ' + num(ob[g.tol]) + g.unit + ' <span class="pf-tag ' + (ok ? 'ok' : 'over') + '">' + (ok ? '안' : '넘음') + '</span>' : '<b style="color:var(--navy);font-size:15px">' + goalShow(data, id) + g.unit + '</b> 10구단 합') + '</span></h3>' + body + '</div>'; };
    const kbo = kboData(), ours = P.builtin['2025-best'];
    const refs = [['2025 KBO 실제', kbo.gaps.totalKm, 'g']].concat(ours ? [['2025 이 엔진', ours.gaps.totalKm, '']] : []).concat(opt.noSave ? [] : [[opt.title || '이 결과', data.gaps.totalKm, '']]);
    const totalBody = '<div class="pf-big3">' + refs.map(([l, v, c]) => '<div class="pf-b ' + c + '"><span>' + esc(l) + '</span><span class="tr"><i style="width:' + (v / 80000 * 100).toFixed(1) + '%"></i></span><span class="n">' + num(v) + 'km</span></div>').join('') + '</div><div class="xs muted" style="margin-top:6px">참고로 2025 숫자를 함께 둡니다(해가 다르면 일정이 다릅니다).</div>';
    const body = (id) => (id === 'total' ? totalBody : bars(data, GOALS[id].metric, ob[GOALS[id].tol], GOALS[id].d));
    const cols = [['이동 거리', 'km', 1], ['이동 횟수', 'moves', 0], ['주말·공휴일 홈(점)', 'hol', 0], ['주말 홈 시리즈', 'wk', 0], ['가장 긴 연속 원정', 'away', 0]];
    const heat = (k, v) => { const a = vals(data, k), mean = a.reduce((s, x) => s + x, 0) / a.length, span = (Math.max(...a) - Math.min(...a)) || 1, z = (v - mean) / span; return z > 0 ? 'rgba(232,140,40,' + (z * 0.9).toFixed(2) + ')' : 'rgba(31,95,214,' + (-z * 0.6).toFixed(2) + ')'; };
    const names = Object.keys(data.teams);
    const allIn = ob.order.every((id) => within(data, id, ob));
    const heatT = '<table class="pf-h"><thead><tr><th>구단</th>' + cols.map((c) => '<th>' + c[0] + '</th>').join('') + '</tr></thead><tbody>' +
      names.map((t) => '<tr><td>' + esc(t) + '</td>' + cols.map(([, k, d]) => '<td style="background:' + heat(k, data.teams[t][k]) + '">' + num(data.teams[t][k], d) + '</td>').join('') + '</tr>').join('') +
      '</tbody><tfoot><tr><td>차이</td>' + cols.map(([, k, d]) => { const a = vals(data, k); return '<td><b>' + num(Math.max(...a) - Math.min(...a), d) + '</b></td>'; }).join('') + '</tr></tfoot></table>' +
      '<div class="pf-leg"><span><i style="background:rgba(232,140,40,.8)"></i>평균보다 많음</span><span><i style="background:rgba(31,95,214,.5)"></i>평균보다 적음</span></div>' +
      '<div class="pf-note ' + (data.feasible && allIn ? 'ok' : 'warn') + '">' + (data.feasible ? '✓ 반드시 지킬 규칙 모두 지킴' : '! 지키지 못한 규칙이 있습니다') + ' · ' + (allIn ? '균형 3가지 모두 허용 차이 안' : '허용 차이를 넘은 균형이 있습니다') + '</div>';
    return '<div class="pf-dash">' + panel(ob.order[0], 0, body(ob.order[0])) + panel(ob.order[1], 1, body(ob.order[1])) +
      '<div class="pf-sec pf-heat"><h3>구단별 한눈에</h3><p class="pf-d">색 = 리그 평균과 차이</p>' + heatT + '</div>' + panel(ob.order[2], 2, body(ob.order[2])) + panel(ob.order[3], 3, body(ob.order[3])) + '</div>';
  }
  S.steps[5] = {
    render() {
      if (S.seasonYear() === YEAR_VIEW) return '<div class="stepview no-band">' + render2025() + '</div>';
      const st = app().state, res = st.meta.result;
      if (isRunning()) return '<div class="stepview no-band"><div class="pf-page">' + runningNote() + '</div></div>';
      if (res && resultStale(st)) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>연전이 바뀌었습니다</h3><p class="pf-d">전에 낸 결과는 이 달력에서 쓸 수 없습니다. 처음부터 다시 실행하거나, 실행 결과 비교에서 저장한 버전을 불러오세요.</p><button class="btn primary" data-act="pf-stage" data-stage="2">엔진 옵션·실행으로' + icon('right') + '</button></div></div></div>';
      if (!res) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>아직 결과가 없습니다</h3><p class="pf-d">엔진 옵션을 정하고 실행하면 여기에 결과가 나옵니다.</p><button class="btn primary" data-act="pf-stage" data-stage="2">엔진 옵션·실행으로' + icon('right') + '</button></div></div></div>';
      const ex = app().derived().ex, data = dataOf(ex), ob = res.objective || objective();
      const name = P.name || suggestName();
      const editedNote2 = inputsEdited(st) ? '<div class="pf-note warn" style="margin:0">값을 고친 뒤로 아직 실행하지 않아 지키지 못한 규칙이 보일 수 있습니다. 실행하면 이 결과에서 이어서 풉니다. <button class="pf-link" data-act="pf-stage" data-stage="2">엔진 옵션·실행으로 ›</button></div>' : '';
      return '<div class="stepview no-band"><div class="pf-page">' +
        '<div class="pf-sec" style="padding:8px 14px"><div class="pf-save">' + (app().engineConfig.kind === 'REST' ? '' : '<span class="pf-tag est" title="편성 서버에 연결되지 않아 브라우저 시험 엔진을 씁니다">시험 엔진으로 낸 결과</span>') + '<span class="small muted">이 결과에 이름을 붙여 저장:</span><input value="' + esc(name) + '" data-in="pf-name" aria-label="버전 이름"><button class="btn primary" data-act="pf-save">버전으로 저장</button><button class="btn" data-act="go-step" data-step="3">일정 자세히 보기</button><button class="btn" data-act="go-step" data-step="4">구단별 공정성</button></div></div>' +
        editedNote2 + dashboard(data, ob) + '</div></div>';
    }
  };
  const noRoom = () => S.toast('저장 공간이 모자라 저장하지 못했습니다. 안 쓰는 버전을 지우세요.', 'bad', 6000);
  function suggestName() { const n = P.versions.list(YEAR_NEW).length; return n ? '2027 계획 ' + (n + 1) : '2027 내 계획'; }
  function saveVersion() {
    const st = app().state, ex = app().derived().ex, data = dataOf(ex), res = st.meta.result || {};
    const op = (st.events || []).find((e) => e.type === 'OPENING') || {};
    const name = (P.name || suggestName()).trim();
    const rec = Object.assign({ id: 'v' + Date.now(), name, year: YEAR_NEW, savedAt: new Date().toISOString().slice(0, 10), elapsedMs: res.elapsedMs || 0, objective: res.objective || objective(), note: (res.objective || objective()).order.map((i) => GOALS[i].name.replace(' 균형', '')).join(' → '), pairs: op.pairs || null, inputs: inputsOf(st) }, data, {
      matches: st.matches.map((m) => ({ index: m.index, home: m.home, away: m.away, consecutive: m.consecutive })), plan: st.plan.map((x) => ({ match: x.match, calendar: x.calendar }))
    });
    const list = P.versions.list(YEAR_NEW); list.push(rec);
    if (!P.versions.put(YEAR_NEW, list)) { noRoom(); return null; }
    S.toast('「' + name + '」을(를) 저장했습니다.', 'ok');
    P.name = '';
    return rec;
  }
  function loadVersion(v) {
    if (S.locked && S.locked()) return;
    // 일정은 그 버전을 만든 값(달력·개막전·어린이날…)에서만 맞으므로 값도 그때로 돌린다. 값을 담지 않은 버전은 처음 제공한 2027 값으로
    const base = v.inputs || preset27(), before = app().state;
    const changed = inputSig(before) !== inputSig(base);
    app().commit('버전 불러오기: ' + v.name, (s) => {
      const b = JSON.parse(JSON.stringify(base)), solver = s.settings.solver;
      s.teams = b.teams; s.distanceMatrix = b.distanceMatrix; s.calendar = b.calendar; s.events = b.events;
      s.settings = Object.assign(b.settings, { solver, objective: v.objective });
      s.matches = v.matches.map((m) => Object.assign({ pinned: false }, m));
      s.plan = v.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
      s.games = [];
      const op = s.events.find((e) => e.type === 'OPENING');
      if (op && v.pairs) {
        op.pairs = v.pairs; op.teams = v.pairs.map((x) => x.home);
        op.stadiums = op.teams.map((t) => (s.teams.find((x) => x.name === t) || {}).stadium).filter(Boolean);
      }
      s.meta.result = { at: new Date().toISOString(), elapsedMs: v.elapsedMs, why: '저장한 버전', objective: v.objective, from: v.id, sig: inputSig(s), calSig: calSig(s) };
    }, ['teams', 'calendar', 'matches', 'plan', 'games', 'settings', 'events', 'meta']);
    S.toast('「' + v.name + '」을(를) 불러왔습니다.' + (changed ? ' 값도 그 버전을 만들 때로 돌아갔습니다.' : ''), 'ok', changed ? 5000 : undefined);
    S.go({ step: 5, sel: null });
  }

  // ───────── 기존 ③·④ 화면 문구 ─────────
  const origStep1Render = S.steps[1].render;
  S.steps[1].render = function () { return origStep1Render().replace(/③에서/g, '「일정 자세히 보기」에서'); };
  // 예전 화면의 번호와 평균 ± 범위는 새 흐름의 말과 다르다. 2027에서는 번호를 빼고, 평균 ± 범위는 「참고 범위」로 부른다(엔진이 맞추는 기준은 허용 차이)
  const origStep3 = S.steps[3].render;
  S.steps[3].render = function () { return origStep3().replace(/④ 공정성·배포로 넘어가세요\.?/g, '「구단별 공정성」에서 구단 사이 균형을 보세요.'); };
  const origStep4 = S.steps[4].render;
  S.steps[4].render = function () {
    const html = origStep4().replace(/③ 달력에서/g, '달력에서').replace(/허용 범위/g, '참고 범위');
    return '<div class="pf-note" style="margin:8px 12px 0">이 화면의 범위는 리그 평균을 기준으로 한 참고값입니다. 엔진이 맞추는 기준은 「현재 결과 분석」의 허용 차이입니다.</div>' + html;
  };

  // ───────── 4 실행 결과 비교 ─────────
  /** 순위대로 비교: 허용 안이면 같다고 보고 다음 순위로. 처음으로 갈리는 목적식과 이긴 쪽 */
  function decide(a, b, ob) {
    for (const id of ob.order) {
      const g = GOALS[id];
      const va = goalValue(a, id), vb = goalValue(b, id), ia = within(a, id, ob), ib = within(b, id, ob);
      if (g.tol && ia && ib) continue;
      if (va !== vb) return { id, winner: va < vb ? a : b, diff: Math.abs(va - vb) };
    }
    return null;
  }
  S.steps[6] = {
    render() {
      const y = S.seasonYear(), all = P.versions.all(y);
      if (all.length < 1) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>저장한 버전이 없습니다</h3><p class="pf-d">현재 결과 분석에서 「버전으로 저장」을 누르면 여기에 쌓입니다.</p></div></div></div>';
      P.cmp = P.cmp.filter((id) => all.some((v) => v.id === id));
      if (!P.cmpPicked) for (const v of all) if (P.cmp.length < 2 && !P.cmp.includes(v.id)) P.cmp.push(v.id);
      const ver = (v) => { const on = P.cmp.includes(v.id);
        return '<div class="pf-ver' + (on ? ' on' : '') + '"><input type="checkbox" data-in="pf-cmp" data-id="' + esc(v.id) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(v.name) + ' 비교에 넣기"><div><b>' + esc(v.name) + '</b><small>' + esc(v.note || '') + '</small><div class="w">' + esc(v.savedAt) + (v.elapsedMs ? ' · 실행 ' + fmt.time(v.elapsedMs) : '') + (v.attempts ? ' · 시도 ' + v.attempts + '번' : '') + (v.builtin ? ' · 기본 제공' : '') + '</div>' +
          '<div class="small" style="margin-top:4px">' + Object.keys(GOALS).map((id) => GOALS[id].name.replace(' 균형', '') + ' <b style="font-size:12px">' + goalShow(v, id) + GOALS[id].unit + '</b>').join(' · ') + '</div></div>' +
          '<div class="acts">' + (y === YEAR_NEW ? '<button class="btn sm" data-act="pf-load" data-id="' + esc(v.id) + '">불러오기</button>' : '') + '<button class="btn sm" data-act="pf-export" data-id="' + esc(v.id) + '">내려받기</button>' + (v.builtin ? '' : '<button class="btn sm" data-act="pf-rename" data-id="' + esc(v.id) + '">이름 바꾸기</button><button class="btn sm" data-act="pf-del" data-id="' + esc(v.id) + '">지우기</button>') + '</div></div>'; };
      const list = '<div class="pf-sec"><h3>저장한 버전<span class="r"><b>' + P.cmp.length + '개</b> 고름</span></h3><p class="pf-d">두 개를 골라 비교합니다.</p>' + all.map(ver).join('') +
        '<div style="margin-top:10px;display:flex;gap:6px;align-items:center"><button class="btn sm" data-act="pf-import">' + icon('upload') + '받은 버전 올리기</button><span class="xs muted">저장한 버전은 이 브라우저에 있습니다(나중에 온라인으로 옮김).</span></div></div>';
      const [a, b] = P.cmp.map((id) => all.find((v) => v.id === id));
      if (!b) return '<div class="stepview no-band"><div class="pf-page">' + list + '<div class="pf-note">' + (all.length < 2 ? '비교하려면 버전이 두 개 있어야 합니다.' : '비교할 버전을 두 개 고르세요.') + '</div></div></div>';
      const ob = a.objective;
      const sameOb = JSON.stringify(a.objective) === JSON.stringify(b.objective);
      const cell = (me, other, id) => { const g = GOALS[id], v = goalValue(me, id), w = goalValue(other, id), obm = me.objective; const inT = within(me, id, obm); return '<td class="' + (v < w ? 'good' : '') + '">' + goalShow(me, id) + g.unit + (g.tol ? ' <span class="pf-tag ' + (inT ? 'ok' : 'over') + '">' + (inT ? '안' : '넘음') + '</span>' : '') + '</td>'; };
      const d = decide(a, b, ob);
      const verdict = !sameOb ? '두 버전의 순서·허용 차이가 달라 순위대로 따지지 않고 숫자만 나란히 둡니다.' : d ? '<b>순위대로 따지면</b> — ' + (ob.order.indexOf(d.id) ? '앞 순위는 두 버전 모두 허용 차이 안이라 같다고 봅니다. ' : '') + esc(GOALS[d.id].name) + '에서 <b>이번 실행에서는 「' + esc(d.winner.name) + '」이 ' + num(d.diff, GOALS[d.id].d) + GOALS[d.id].unit + ' ' + (GOALS[d.id].tol ? '작았습니다' : '짧았습니다') + '</b>.' : '<b>순위대로 따지면</b> — 모든 목적식이 같습니다.';
      const tab = P.cmpTab, tg = GOALS[tab];
      return '<div class="stepview no-band"><div class="pf-page"><div class="pf-cols" style="grid-template-columns:400px minmax(0,1fr)">' + list +
        '<div style="display:flex;flex-direction:column;gap:12px;min-width:0"><div class="pf-sec"><h3>목적식마다 비교</h3><p class="pf-d">순위 순 · 초록 = 더 작음</p><table class="pf-t"><thead><tr><th>목적식</th><th>' + esc(a.name) + '</th><th>' + esc(b.name) + '</th></tr></thead><tbody>' +
        ob.order.map((id) => '<tr><td><b>' + GOALS[id].name + '</b> <span class="muted small">' + (GOALS[id].tol ? '차이 · 허용 ' + num(ob[GOALS[id].tol]) + GOALS[id].unit : '10구단 합') + '</span></td>' + cell(a, b, id) + cell(b, a, id) + '</tr>').join('') +
        '</tbody></table><div class="pf-note blue">' + verdict + '</div><div class="small muted" style="margin-top:6px">같은 조건으로 다시 실행해도 전체 이동 거리가 수천 km씩 달라질 수 있습니다. 이 정도 차이는 두 버전을 각각 다시 실행해 확인하세요.</div></div>' +
        '<div class="pf-sec"><div class="pf-tabs">' + ['moves', 'distance', 'holiday'].map((id) => '<button class="' + (tab === id ? 'on' : '') + '" data-act="pf-cmp-tab" data-v="' + id + '">' + GOALS[id].name.replace(' 균형', '') + '</button>').join('') + '</div><h3>구단별 ' + tg.name.replace(' 균형', '') + '</h3><p class="pf-d">회색 ' + esc(b.name) + ' · 파랑 ' + esc(a.name) + ' · 초록 띠 = 파랑의 가장 적은 구단 + 허용 차이</p>' + bars(a, tg.metric, ob[tg.tol], tg.d, b) + '</div></div></div></div></div>';
    }
  };

  // ───────── 단계 띠 · 하단 ─────────
  const STAGES = ['값 입력·검증', '엔진 옵션·실행', '현재 결과 분석', '실행 결과 비교'];
  const stageOf = (step) => ({ 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4 })[step] || 1;
  P.stepper = function () {
    const st = app().state, cur = stageOf(S.ui.step), fs = S.flowStatus(), res = freshResult(st), stale = resultStale(st), edited = inputsEdited(st), n = P.versions.all(S.seasonYear()).length;
    const running = isRunning();
    const start = S.ui.step === 1 && (G.mode === 'year' || G.mode === 'resume');
    const sub = {
      1: fs.allDone ? '4단계 검토함' : start ? '' : (G.mode === 'flow' ? G.fs + ' / 4 ' + fs.steps[G.fs - 1].name + ' · 검토 중' : fs.stop + ' / 4에서 멈춤'),
      2: running ? '실행 중' : stale ? '연전이 바뀜 · 다시 실행' : edited ? '값이 바뀜 · 이어서 실행' : res ? '실행 끝 · ' + fmt.time(res.elapsedMs || 0) : fs.allDone ? '엔진 옵션 정하기' : '값 검토를 마치면',
      3: res ? (S.ui.step === 3 ? '일정 자세히' : S.ui.step === 4 ? '구단별 공정성' : '한 장으로 보기') : '실행 뒤',
      4: n ? '저장한 버전 ' + n + '개' : '저장한 버전 없음'
    };
    const done = { 1: fs.allDone, 2: !!res, 3: false, 4: false };
    return STAGES.map((name, i) => { const k = i + 1, active = !start && cur === k;
      return '<button class="step' + (active ? ' active' : '') + '" data-act="pf-stage" data-stage="' + k + '"' + (active ? ' aria-current="step"' : '') + '><span class="step-no">' + k + '</span><span class="step-name">' + name + '</span>' + (done[k] && !active ? S.stat('ok', '완료') : '') + '<span class="step-sum">' + esc(sub[k]) + '</span></button>'; }).join('');
  };
  P.footer = function () {
    const u = S.ui, y = S.seasonYear();
    if (u.step === 5 && y === YEAR_VIEW) return '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button><span class="hint"><b>2025 계획 보기</b> — 같은 조건에서 KBO 실제 일정과 이 엔진의 일정을 비교합니다</span>' + (P.view25 === 'dash' ? '<button class="btn primary" data-act="pf-25" data-v="compare">KBO와 비교로 돌아가기</button>' : '<button class="btn primary" data-act="pf-25" data-v="dash">목적식별 자세히 보기' + icon('right') + '</button>');
    if (u.step === 1) {
      if (G.mode === 'year' || G.mode === 'resume') return '<span class="hint"><b>처음 화면</b> — 2025 결과를 확인하거나 2027 새 계획을 만듭니다</span>';
      if (G.mode === 'all') return '<button class="btn" data-act="g1-cal">' + icon('left') + '단계별로 돌아가기</button><span class="hint"><b>모든 표 보기</b> — 표에서 직접 고칩니다. 고치면 바로 저장됩니다</span><span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>';
      if (P.calEdit) return '<span class="hint"><b>달력에서 고치기</b> — 고치면 바로 저장됩니다</span><span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span><button class="btn primary" data-act="pf-cal-done">검토로 돌아가기' + icon('right') + '</button>';
      const n = G.fs, steps = S.FLOW_STEPS, st = app().state;
      const prev = n > 1 ? '<button class="btn" data-act="pf-go" data-fs="' + (n - 1) + '">' + icon('left') + '이전: ' + (n - 1) + ' ' + esc(steps[n - 2].name) + '</button>' : '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button>';
      const canNext = n === 1 ? !!(st.meta.flow || {}).teams : n === 4 ? S.flowStatus().done.slice(0, 3).every(Boolean) : stepReviewed(st, n);
      const next = n < 4 ? '<button class="btn primary" data-act="pf-go" data-fs="' + (n + 1) + '"' + (canNext ? '' : ' disabled title="이 단계의 값을 모두 확인해 주세요"') + '>다음: ' + (n + 1) + ' ' + esc(steps[n].name) + icon('right') + '</button>'
        : '<button class="btn primary" data-act="cal-next"' + (canNext ? '' : ' disabled title="앞 단계를 모두 확인해 주세요"') + '>다음: 엔진 옵션·실행' + icon('right') + '</button>';
      const hint = { 1: '2025 구단 정보에 LG·두산 구장만 고쳐 두었습니다. 그 밖에 바뀐 것이 있는지 확인합니다', 2: '노란 추정값을 하나씩 확인합니다', 3: '개막전 대진과 어린이날 홈 구단을 확인합니다', 4: S.flowStatus().allDone ? '모든 값을 검토했습니다. 다음은 엔진 옵션입니다' : '앞 단계의 값을 먼저 확인해 주세요' }[n];
      return prev + '<span class="hint"><b>' + n + ' / 4 ' + esc(steps[n - 1].name) + '</b> — ' + hint + '</span><span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' + next;
    }
    if (u.step === 2) { const running = isRunning(); return (running ? '' : '<button class="btn" data-act="pf-stage" data-stage="1">' + icon('left') + '이전: 값 입력·검증</button>') + '<span class="hint"><b>엔진 옵션</b> — 추천 순서를 고르고, 허용 차이를 정해 실행합니다</span>' + (running ? '<button class="btn primary" data-act="run-stop">멈추고 이 결과 쓰기</button>' : '<button class="btn primary" data-act="pf-run">최대 ' + P.timeSec / 60 + '분 실행' + icon('right') + '</button>'); }
    if (u.step === 5) return '<button class="btn" data-act="pf-stage" data-stage="2">' + icon('left') + '엔진 옵션 바꿔 다시 실행</button><span class="hint"><b>현재 결과 분석</b> — 목적식 4개와 구단별 표를 한 장에 봅니다</span><button class="btn primary" data-act="pf-stage" data-stage="4">실행 결과 비교' + icon('right') + '</button>';
    if (u.step === 6) return '<button class="btn" data-act="pf-stage" data-stage="3">' + icon('left') + '현재 결과 분석</button><span class="hint"><b>실행 결과 비교</b> — 저장한 버전 두 개를 골라 목적식마다 비교합니다</span>';
    if (u.step === 3 || u.step === 4) return '<button class="btn" data-act="go-step" data-step="5">' + icon('left') + '현재 결과 분석</button><span class="hint"><b>' + (u.step === 3 ? '일정 자세히 보기' : '구단별 공정성') + '</b></span>';
    return null;
  };
  /** body에 표시 클래스(2025 보기 전용이면 단계 띠·상태를 숨김) */
  P.beforeRender = function () {
    document.body.classList.add('pf');
    // 주소를 직접 쳐도 흐름 밖 화면으로 가지 않게: 2025는 비교 화면만, 다른 해는 처음 화면으로
    const y = S.seasonYear(), onHome = S.ui.step === 1 && (G.mode === 'year' || G.mode === 'resume');
    if (y === YEAR_NEW && !isRunning() && resultStale(app().state)) S.ui.modal = 'pfCalChange'; // 어느 화면에서 바꿨든 여기서 묻는다
    if (y !== YEAR_NEW && !onHome && !isRunning()) {
      S.ui.ops = null;
      if (y === YEAR_VIEW) S.ui.step = 5;
      else { S.ui.step = 1; G.mode = 'year'; }
    }
    const home = S.ui.step === 1 && !S.ui.ops && (G.mode === 'year' || G.mode === 'resume');
    document.body.classList.toggle('pf-home', home);
    document.body.classList.toggle('pf-nores', !freshResult(app().state)); // 실행 전에는 규칙 위반 표시를 띄우지 않는다
    document.body.classList.toggle('pf-ro', home || (S.seasonYear() === YEAR_VIEW && S.ui.step === 5));
  };

  // ───────── 동작 ─────────
  const go1 = (n) => { P.calEdit = false; S.flowGo(n); };
  const origCalNext = S.actions['cal-next'];
  Object.assign(S.actions, {
    'pf-home': () => { P.calEdit = false; S.flowPickYear(); },
    'pf-open-2025': () => {
      if (S.locked && S.locked()) return;
      if (S.seasonYear() !== YEAR_VIEW) S.switchYear(YEAR_VIEW, { quiet: true, to: 'stay' });
      S.repo.setLastYear(YEAR_VIEW);
      P.view25 = 'compare';
      S.go({ step: 5, ops: null, modal: null, drawer: null });
    },
    'pf-open-2027': (el) => {
      if (S.locked && S.locked()) return;
      open2027();
      if (el.dataset.to === 'result') { S.go({ step: 5, ops: null }); return; }
      go1(S.flowStatus().stop);
    },
    'pf-stage': (el) => {
      const k = +el.dataset.stage;
      if (S.seasonYear() !== YEAR_NEW && !isRunning()) open2027();
      if (k === 1) { const fs = S.flowStatus(); if (S.ui.step === 1 && G.mode === 'flow') return; go1(fs.allDone ? 4 : fs.stop); return; }
      S.go({ step: { 2: 2, 3: 5, 4: 6 }[k], ops: null, sel: null, edit: null });
    },
    'g1-cal': () => { const fs = S.flowStatus(); go1(fs.allDone ? 4 : fs.stop); }, // 예전처럼 「어디까지 했는지」가 아니라 검토 단계로
    'pf-go': (el) => {
      const n = +el.dataset.fs;
      if (G.fs === 1 && n === 2 && !(app().state.meta.flow || {}).teams) { S.toast('「바뀐 정보가 있나요?」에 먼저 답해 주세요.', 'warn'); return; }
      go1(n);
    },
    'pf-ok': (el) => confirmKey(el.dataset.k),
    'pf-cal': (el) => {
      const to = el.dataset.to, st = app().state, C = S.cal;
      if (to === 'rules') { S.flowUI.edit = 'rules'; go1(4); return; } // 시리즈 규칙은 4 확인에서 고친다
      const ev = (t) => (st.events || []).find((e) => e.type === t);
      C.edit = { initialEnd: 'initialEnd', allStar: 'allstar', rest: 'rest' }[to] || null;
      C.pickOpen = to === 'opening';
      const e = to === 'openingHome' ? ev('OPENING') : to === 'childrenHome' ? ev('CHILDREN') : null;
      if (e) C.day = Dates.dayNum(e.date);
      P.calEdit = true;
      S.render();
    },
    'pf-cal-done': () => { P.calEdit = false; S.render(); },
    'pf-basis': () => S.go({ modal: 'pfBasis' }),
    'pf-cal-undo': () => { S.ui.modal = null; app().undo(); S.render(); },
    'pf-cal-clear': () => {
      S.ui.modal = null;
      app().store.commit('연전이 바뀌어 결과 지움', (st) => { delete st.meta.result; }, { tags: ['meta'], undo: false });
      S.toast('결과를 지웠습니다. 값을 확인한 뒤 처음부터 실행합니다.', 'info', 5000);
      S.render();
    },
    'pf-op-reset': () => {
      const base = preset27().events.find((e) => e.type === 'OPENING');
      app().commit('개막전 홈 구단: 전년도 순위대로', (s) => {
        const op = s.events.find((e) => e.type === 'OPENING');
        const date = s.settings.seasonStart;
        const next = Object.assign(JSON.parse(JSON.stringify(base)), { date, slot: 0 });
        if (op) s.events[s.events.indexOf(op)] = next; else s.events.unshift(next);
        for (const m of s.matches) if (m.eventId === next.id) { delete m.eventId; m.pinned = false; }
      }, ['events', 'pins']);
    },
    'pf-tour-ok': () => { S.ls.set(tourKey(G.fs), '1'); S.render(); },
    'pf-tour-again': () => { for (const n of [1, 2, 3, 4]) S.ls.del(tourKey(n)); S.render(); },
    'pf-order': (el) => { P.customOrder = false; const o = ORDERS.find((x) => x.id === el.dataset.id); app().updateSettings({ objective: Object.assign({}, objective(), { order: o.order.slice() }) }, '목적식 순서: ' + o.name); },
    'pf-order-custom': (el, e) => { if (e && e.target.closest('[data-act="pf-move"]')) return; P.customOrder = true; S.render(); },
    'pf-move': (el, e) => {
      if (e) e.stopPropagation();
      const k = +el.dataset.k, d = +el.dataset.d, order = objective().order.slice(), t = order[k];
      order[k] = order[k + d]; order[k + d] = t;
      P.customOrder = true;
      app().updateSettings({ objective: Object.assign({}, objective(), { order }) }, '목적식 순서 바꾸기');
    },
    'pf-time': (el) => { P.timeSec = +el.dataset.v; S.render(); },
    'pf-run': () => {
      const fs = S.flowStatus();
      if (!fs.allDone) { S.toast('값 입력·검증을 먼저 마쳐 주세요.', 'warn'); go1(fs.stop); return; }
      if (!app().state.settings.objective) app().updateSettings({ objective: Object.assign({}, DEFAULT_OBJECTIVE) }, '엔진 옵션 기본값');
      if (!S.seriesOkOf(app().state)) { S.calNext(); if (!S.seriesOkOf(app().state)) return; }
      const keep = !!freshResult(app().state); // 결과가 있으면(값·엔진 옵션을 고쳤어도) 이어서, 없으면 처음부터 — 사용자 결정 2026-11-01
      app().updateSolverSettings({ timeLimitSec: P.timeSec, unimprovedSec: Math.round(P.timeSec / 2), init: keep ? 'KEEP' : 'SCRATCH' });
      S.startRun();
      // 첫 결과가 오면 전 결과 표시를 지운다(도중에 새로고침해도 섞인 일정을 전 결과로 보이지 않게)
      if (S.run && app().run) { let once = false; app().run.handle.on('best', () => { if (once) return; once = true; if (app().state.meta.result) app().store.commit('전 결과 표시 지우기', (st) => { delete st.meta.result; }, { tags: ['meta'], undo: false }); }); }
    },
    'pf-save': () => {
      const v = saveVersion();
      if (!v) return;
      const base = P.versions.all(YEAR_NEW).find((x) => x.id !== v.id);
      P.cmp = base ? [base.id, v.id] : [v.id]; // 방금 저장한 버전을 바로 비교에 넣는다
      S.go({ step: 6 });
    },
    'pf-25': (el) => { P.view25 = el.dataset.v; S.render(); },
    'pf-cmp-tab': (el) => { P.cmpTab = el.dataset.v; S.render(); },
    'pf-load': (el) => { const v = P.versions.get(S.seasonYear(), el.dataset.id); if (v && S.seasonYear() === YEAR_NEW) loadVersion(v); },
    'pf-rename': (el) => {
      const y = S.seasonYear(), list = P.versions.list(y), v = list.find((x) => x.id === el.dataset.id);
      if (!v) return;
      const n = window.prompt('새 이름', v.name);
      if (n && n.trim()) { v.name = n.trim(); if (!P.versions.put(y, list)) noRoom(); S.render(); }
    },
    'pf-del': (el) => {
      const y = S.seasonYear(), list = P.versions.list(y), v = list.find((x) => x.id === el.dataset.id);
      if (v && window.confirm('「' + v.name + '」을(를) 지울까요? 되돌릴 수 없습니다.')) { if (!P.versions.put(y, list.filter((x) => x !== v))) noRoom(); S.render(); }
    },
    'pf-export': (el) => {
      const v = P.versions.get(S.seasonYear(), el.dataset.id);
      if (!v) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(v)], { type: 'application/json' }));
      a.download = v.name.replace(/[\\/:*?"<>|\s]+/g, '_') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    'pf-import': () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        f.text().then((t) => {
          let v = null;
          try { v = JSON.parse(t); } catch (e) { v = null; }
          const y = S.seasonYear(), st = app().state, err = P.checkVersion(v, y, st.teams.map((x) => x.name), st.calendar.length);
          if (err) { S.toast('올리지 못했습니다 — ' + err, 'bad', 6000); return; }
          const list = P.versions.list(y);
          v.id = 'v' + Date.now(); v.year = y; v.name = String(v.name || '받은 버전').trim() || '받은 버전'; delete v.builtin; list.push(v);
          if (!P.versions.put(y, list)) { noRoom(); return; }
          S.toast('「' + v.name + '」을(를) 올렸습니다.', 'ok'); S.render();
        }).catch(() => S.toast('올리지 못했습니다 — 파일을 읽을 수 없습니다.', 'bad', 6000));
      };
      inp.click();
    },
    'cal-next': (el) => {
      const fs = S.flowStatus();
      if (!fs.done.slice(0, 3).every(Boolean)) { S.toast('앞 단계의 값을 모두 확인해 주세요.', 'warn'); go1(fs.stop); return; }
      origCalNext(el);
    }
  });
  const origSame = S.actions['fl-teams-same'];
  S.actions['fl-teams-same'] = (el) => { origSame(el); P.calEdit = false; };
  S.inputs['pf-gap'] = (el) => {
    const k = el.dataset.k, t = String(el.value).replace(/,/g, '').trim(), v = Math.round(Number(t)); // 화면이 정수로 보이므로 정수로 저장
    if (!t || !Number.isFinite(v) || v < 0) { el.classList.add('err'); S.toast('0 이상인 숫자를 적어 주세요.', 'bad'); return; }
    if (objective()[k] === v) return;
    app().updateSettings({ objective: Object.assign({}, objective(), { [k]: v }) }, '허용 차이 바꾸기');
  };
  /** 끄는 동안 초록 창과 숫자 칸을 따라 움직인다(놓을 때 저장) */
  S.inputs['pf-gap-live'] = (el) => {
    const v = +el.value, row = el.closest('.pf-sl'), d = el.dataset, x = (u) => ((u - d.lo) / (d.hi - d.lo) * 100).toFixed(1) + '%';
    row.querySelector('.win').style.width = 'calc(' + x(Math.min(+d.mn + v, +d.hi)) + ' - ' + x(+d.mn) + ')';
    const box = row.querySelector('input:not([type=range])');
    if (box) box.value = v;
  };
  S.inputs['pf-name'] = (el) => { P.name = el.value; };
  S.inputs['pf-cmp'] = (el) => {
    const id = el.dataset.id;
    P.cmpPicked = true;
    if (el.checked) { P.cmp.push(id); if (P.cmp.length > 2) P.cmp.shift(); } else P.cmp = P.cmp.filter((x) => x !== id);
    S.render();
  };
  // 실행 중 새로고침·창 닫기: 서버 실행을 멈춘다(그대로 두면 다음 실행이 「이미 실행 중」으로 막힌다)
  window.addEventListener('pagehide', () => {
    const ar = S.app && S.app.run, id = ar && ar.handle && ar.handle.jobId;
    // 창이 닫힐 때 연결이 먼저 끊겨 S.run이 이미 비었을 수 있으므로 끝났는지는 엔진 쪽 상태로 본다
    if (!id || ar.status === 'DONE' || S.app.engineConfig.kind !== 'REST') return;
    fetch((S.app.engine.baseUrl || '') + '/api/v1/solve/' + encodeURIComponent(id) + '/stop', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  });
  // 데이터 메뉴의 파일 이름 표시에서 개발 용어를 뺀다
  const origMenu = S.menus.data;
  S.menus.data = function () { return origMenu().replace('파일로 내려받기(.json)', '파일로 내려받기').replace('파일 올리기(.json)…', '파일 올리기…').replace('시즌 연도 고르기 · 처음부터 다시…', '처음 화면으로'); };
})();
