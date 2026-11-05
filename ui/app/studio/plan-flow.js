/*
 * 편성 스튜디오 — 계획 흐름 (시안 ui-archive/plan-flow-concepts, 사용자 확정 2026-10-31)
 *  처음 화면: 결과 확인(2025 · 확정한 해) / 새 계획 만들기(2027). 목적 아래에 연도를 둔다. 실행만 끝난 결과는 확정 전까지 결과 확인에 나오지 않는다(사용자 결정 2026-11-01).
 *  단계 띠 4칸: 값 입력·검증 → 운영 방침·실행 → 현재 결과 분석 → 실행 결과 비교.
 *   1 값 입력·검증: 기존 4단계(구단 정보 → 시즌 기간 → 주요 이벤트 일정 → 확인) 위에 추정값 검토 줄과 말풍선 안내. 「수정」은 기존 달력을 연다.
 *   2 운영 방침: 읽는 순서대로 네 띠 — 머리글(왜 운영자가 정하나 + 목표 넷은 무엇을 재나) → 추천 순서 카드(이동 격차 줄이기 우선·주말·공휴일 격차 줄이기 우선·직접 정하기) + 오른쪽 「지금 순위」 칸(고른 순서 1~4, 직접 정하기면 화살표) → 목표마다 허용 수준(가장 많은·적은 구단 격차, 전체 폭) → settings.objective로 서버에 보낸다. 실행 시간·실행 단추는 아래 줄에만. 값 형식은 그대로.
 *   3 현재 결과 분석: 한 장 대시보드 + 자동 저장한 이름(바꿀 수 있음). 기존 ③·④ 화면은 「일정 자세히 보기」·「구단별 공정성」으로 들어간다.
 *   4 실행 결과 비교: 저장한 버전 둘을 평가 기준마다 비교. 저장한 버전이 있으면 언제든 들어간다.
 *  S.ui.step: 1·3·4는 기존 화면, 2는 여기서 다시 그리고, 5 = 현재 결과 분석, 6 = 실행 결과 비교.
 *  ?classic=1(또는 자가 점검)이면 읽지 않아 예전 화면 그대로다.
 *  버전 저장: 기본 제공 ui/data/plans/*.json + 사용자가 저장한 것은 이 브라우저(P.versions). 온라인 저장소로 옮길 때 P.versions만 바꾼다.
 *   실행이 끝나면 「#0001_이동격차_4회_600km_3점」 이름으로 바로 저장한다. 이름을 바꾼 결과는 남기고, 나머지는 최근 몇 개만 둔다(사용자 결정 2026-11-03).
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
  const P = S.planFlow = { builtin: {}, cmp: [], cmpTab: 'distance', timeSec: 120, calEdit: false, inline: null, calLive: false, customOrder: false, view25: 'compare', runOption: null };
  const YEAR_NEW = 2027, YEAR_VIEW = 2025;
  const isRunning = () => !!(S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED'));
  const num = (v, d) => Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

  // ───────── 평가 기준 ─────────
  const GOALS = {
    moves: { name: '이동 횟수 격차 줄이기', desc: '구단마다 다른 도시로 옮겨 가는 횟수를 비슷하게', unit: '회', metric: 'moves', gap: 'moves', tol: 'moveGap', d: 0 },
    distance: { name: '이동 거리 격차 줄이기', desc: '구단마다 시즌 동안 이동하는 거리를 비슷하게', unit: 'km', metric: 'km', gap: 'distanceKm', tol: 'distanceGapKm', d: 1 },
    holiday: { name: '주말·공휴일 홈 격차 줄이기', desc: '주말 하루 1점 · 공휴일 2점 · 어린이날 3점', unit: '점', metric: 'hol', gap: 'holiday', tol: 'holidayGap', d: 0 },
    total: { name: '전체 이동 거리 줄이기', desc: '10구단 이동 거리를 모두 더한 값', unit: 'km', metric: 'km', gap: 'totalKm', tol: null, d: 0 }
  };
  const DEFAULT_OBJECTIVE = { order: ['moves', 'distance', 'holiday', 'total'], moveGap: 4, distanceGapKm: 600, holidayGap: 3 };
  // 격차는 두 가지다: 이동 횟수·거리의 격차와 주말·공휴일 홈의 격차. 방침은 이 둘 사이의 균형이고, 전체 이동 거리는 언제나 마지막 순위다(사용자 결정 2026-11-02).
  // 카드 이름은 어느 격차를 먼저 줄이는지로 읽힌다. 이름의 「균형·균등·공평」은 쓰지 않는다(사용자 결정 2026-11-02: 수치의 격차다). 「내주는 것」은 단정하지 않고 「~할 수 있음」으로 쓴다.
  const ORDERS = [
    { id: 'balance', name: '이동 격차 줄이기 우선 (기본)', desc: '이동 횟수·거리의 격차를 먼저 줄임', keep: '이동 횟수·거리 격차를 좁힘', give: '주말·공휴일 홈 격차가 벌어질 수 있음', order: ['moves', 'distance', 'holiday', 'total'] },
    { id: 'holiday', name: '주말·공휴일 격차 줄이기 우선', desc: '주말·공휴일 홈의 격차를 먼저 줄임', keep: '주말·공휴일 홈 격차를 좁힘', give: '이동 횟수·거리 격차가 벌어질 수 있음', order: ['holiday', 'moves', 'distance', 'total'] }
  ];
  const LAST = 'total'; // 직접 정하기에서도 늘 마지막
  const shortName = (id) => GOALS[id].name.replace(/ 홈 격차 줄이기$| 격차 줄이기$| 줄이기$/, ''); // 「이동 횟수」 「주말·공휴일」 「전체 이동 거리」
  const objective = () => app().state.settings.objective || DEFAULT_OBJECTIVE;
  const goalValue = (data, id) => data.gaps[GOALS[id].gap];
  const goalShow = (data, id) => num(goalValue(data, id), GOALS[id].d);
  const within = (data, id, ob) => !GOALS[id].tol || goalValue(data, id) <= ob[GOALS[id].tol];

  /** 채점 결과 → 화면용 숫자(저장한 버전과 같은 모양) */
  function dataOf(ex) {
    const teams = {};
    for (const t of ex.teamMetrics) teams[t.name] = { km: t.distanceTenths / 10, moves: t.moves, hol: t.holidayWeight, wk: t.weekendHome, away: t.maxAwayRun };
    return { teams, gaps: ex.objectiveGaps, feasible: ex.feasible, hardCount: (ex.violations || []).length };
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
  /** 확정: 저장한 버전 중 해마다 하나. 버전은 사본이라 값을 고치거나 다시 실행해도 확정한 일정은 그대로다 */
  const fKey = (y) => S.KEY + 'final:' + y;
  P.final = {
    id(y) { return S.ls.get(fKey(y)) || null; },
    set(y, id) { return S.ls.set(fKey(y), id); },
    clear(y) { S.ls.del(fKey(y)); },
    version(y) { const id = P.final.id(y); return id ? P.versions.get(y, id) : null; }
  };
  const canFinal = (v) => v.feasible !== false && !(v.engine && v.engine !== 'REST');
  const BUILTIN_IDS = ['2027-rank1', '2027-rank2', '2025-best'];
  BUILTIN_IDS.forEach((id) => {
    const failed = () => { P.builtinFailed = true; if (S.booted) S.scheduleRender(); };
    if (typeof fetch !== 'function') { P.builtinFailed = true; return; }
    fetch('data/plans/' + id + '.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { P.builtin[id] = j; if (S.booted) S.scheduleRender(); } else failed(); }).catch(failed);
  });
  /** 올린 파일 검사: 문제가 있으면 안내 글, 없으면 null */
  P.checkVersion = function (v, y, teamNames) {
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
    // 값을 담았으면 불러올 때 쓰는 칸이 모두 있어야 한다
    if (v.inputs && !(['teams', 'distanceMatrix', 'calendar', 'events'].every((k) => Array.isArray(v.inputs[k])) && v.inputs.settings && typeof v.inputs.settings === 'object')) return bad;
    const known = new Set(teamNames), n = (v.inputs || preset27()).calendar.length; // 불러올 때 쓰는 달력과 견준다
    if (!v.matches.every((m) => known.has(m.home) && known.has(m.away) && m.consecutive > 0)) return bad;
    if (!v.plan.every((x) => x.match >= 0 && x.match < v.matches.length && x.calendar >= 0 && x.calendar < n)) return bad;
    if (new Set(v.plan.map((x) => x.match)).size !== v.matches.length) return bad; // 경기마다 한 번씩
    return null;
  };
  /** 올린 파일의 숫자는 믿지 않고 그 일정으로 다시 계산해 넣는다. 파일에 적힌 숫자와 달랐으면 true */
  P.rescoreVersion = function (v) {
    const p = JSON.parse(JSON.stringify(app().state));
    applyVersion(p, v);
    const d = dataOf(Score.scoreProject(p, {})), differ = JSON.stringify(canon(d.gaps)) !== JSON.stringify(canon(v.gaps));
    v.teams = d.teams; v.gaps = d.gaps; v.feasible = d.feasible;
    return differ;
  };

  // ───────── 값 묶음 ─────────
  /** 결과를 정하는 입력값(시리즈·배정·실행 설정·검토 표시는 뺀다). 버전에 함께 저장해 그때 값으로 되돌린다 */
  function inputsOf(st) {
    const settings = Object.assign({}, st.settings);
    delete settings.solver; delete settings.objective;
    return JSON.parse(JSON.stringify({ teams: st.teams, distanceMatrix: st.distanceMatrix, calendar: st.calendar, events: st.events, settings }));
  }
  // 저장·불러오기로 칸 차례가 달라져도 같은 값이므로 칸 이름 순으로 적어 견준다
  const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v);
  function inputSig(st) {
    // 같은 구단을 다른 차례로 적은 것은 같은 값으로 본다(개막전 teams·stadiums 순서가 대진 순서를 따라 바뀜)
    const inp = inputsOf(st);
    for (const e of inp.events) { for (const k of ['teams', 'stadiums']) if (Array.isArray(e[k])) e[k].sort(); if (Array.isArray(e.pairs)) e.pairs = e.pairs.map((x) => x.away + '@' + x.home).sort(); }
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
  const KEYS = { 2: ['opening', 'allStar', 'initialEnd'], 3: ['openingHome', 'childrenHome'] };
  const review = (p) => (p || app().state).meta.review || {};
  /** 개막전 홈 구단은 전년도 순위가 정한다(사용자 결정 2026-10-31): 상대만 고칠 수 있고, 표·엑셀·파일로 달라졌으면 그 단계가 끝나지 않는다 */
  const OPENING_HOMES = () => (preset27().events.find((e) => e.type === 'OPENING') || {}).teams || [];
  const sameTeams = (a, b) => (a || []).slice().sort().join() === (b || []).slice().sort().join();
  const openingHomesOk = (p) => sameTeams(((p.events || []).find((e) => e.type === 'OPENING') || {}).teams, OPENING_HOMES());
  const stepReviewed = (p, n) => (n === 1 ? !!(p.meta.flow || {}).teams : (KEYS[n] || []).every((k) => review(p)[k]) && (n !== 3 || openingHomesOk(p)));
  const yearOf = (p) => S.seasonYearOf(p);
  const inPlan = (p) => yearOf(p || app().state) === YEAR_NEW;
  /** 2027은 앞 단계가 끝나야 다음 단계로 간다(뒤로는 언제든 갈 수 있다) */
  S.flowLocked = (n) => S.seasonYear() === YEAR_NEW && n > S.flowStatus().stop;
  const reviewDone = () => S.flowStatus().done.slice(0, 3).every(Boolean);
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
    app().commit('검토: 수락', (s) => { s.meta.review = Object.assign({}, s.meta.review || {}, { [k]: true }); }, ['meta']);
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
      S.toast('바꾼 편성 조건에 지금 결과를 맞추지 못해 처음부터 풉니다.', 'warn', 6000);
      origCalNextFn();
      return;
    }
    app().commit('시리즈를 편성 조건에 맞춤(전 결과 자리 유지)', (x) => {
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
    opening: { why: '3월 넷째 토요일에 2연전으로 엽니다(2024 · 2025 · 2026 모두 같음).' },
    initialEnd: { why: '개막부터 경기일을 세어 135일이 되는 첫 일요일입니다. 남은 경기는 그 뒤에 따로 짭니다.' },
    allStar: { why: '7월 둘째주 토요일을 올스타전으로 잡았고, 그 주 금요일부터 다음주 수요일까지를 올스타전 휴식기로 잡았습니다. 휴식기 바로 뒤 목~일은 4연전으로 묶으며, 휴식기를 수정하면 함께 옮겨집니다.' },
    openingHome: { why: '2026 상위 5팀이 홈(두산은 LG와 구장이 겹쳐 원정, SSG가 이어받음). 대진은 2025 개막 대진을 다시 쓴 1순위 예측입니다.' },
    childrenHome: { why: '어린이날 홈은 해마다 번갈아 가집니다(홀수 해 = 이 5구단).' },
    homeTotals: { why: '남는 홈 경기는 해마다 번갈아 가집니다(2027 = 홀수 해).' }
  };
  S.modals.pfCalChange = function () {
    return '<div class="modal" role="dialog" aria-label="연전이 바뀜" style="width:480px;max-width:94vw"><div class="modal-head"><h3>연전이 바뀌었습니다</h3></div><div class="modal-body" style="padding:14px">' +
      '<p class="pf-d" style="margin:0 0 12px">날짜나 연전 수가 바뀌면 지금 결과에서 이어서 풀 수 없습니다. 지금 결과를 지우고 처음부터 다시 풉니다. 저장한 결과는 그대로 남습니다.</p>' +
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

  const yearsBasis = (label, title, lead, head, rows, note, source) => {
    const tr = (c, b) => '<tr>' + c.map((x) => '<td>' + (b ? '<b>' + esc(x) + '</b>' : esc(x)) + '</td>').join('') + '</tr>';
    return '<div class="modal narrow" role="dialog" aria-label="' + label + '" style="width:720px;max-width:94vw"><div class="modal-head"><h3>' + label + '</h3><span class="muted small">공식 일정 발표(보통 12월 중순) 전 예상입니다</span>' +
      '<button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div><div class="modal-body" style="padding:14px;overflow:auto;max-height:76vh">' +
      '<div class="pf-sec pf-years"><h3>' + title + '</h3><p class="pf-d">' + lead + '</p><table class="pf-t"><thead><tr><th>시즌</th><th>' + head + '</th></tr></thead><tbody>' + rows.map((r, i) => tr(r, i === rows.length - 1)).join('') + '</tbody></table>' +
      (note ? '<div class="pf-note">' + note + '</div>' : '') +
      '<div class="small muted" style="margin-top:6px">출처: ' + source + '</div></div></div></div>';
  };
  S.modals.pfBasisChildren = () => yearsBasis('2027 어린이날 근거', '어린이날 홈 구단', '두 묶음이 해마다 번갈아 홈을 맡습니다. 2027은 홀수 해라 2025와 같은 묶음으로 예상합니다.', '홈 구단', [
    ['2024', 'LG · SSG · KT · 삼성 · KIA'], ['2025', '두산 · 키움 · 한화 · NC · 롯데'], ['2026', 'LG · SSG · KT · 삼성 · KIA'], ['2027 예상', '두산 · 키움 · 한화 · NC · 롯데']
  ], '구장을 같이 쓰는 LG와 두산의 어린이날 맞대결은 두 구단이 번갈아 홈을 맡습니다.', 'KBO 리그 2024 · 2025 실제 일정, 뉴시스 · 국민일보(2026 어린이날 경기)');
  S.modals.pfBasisHomes = () => yearsBasis('2027 홈 경기 수 근거', '홈 73경기 구단', '10구단이 144경기를 치르면 홈과 원정이 72경기씩이지만, 2023부터 다섯 구단은 홈 73경기, 다섯 구단은 홈 71경기로 해마다 번갈아 맡습니다.', '홈 73경기', [
    ['2024', 'LG · NC · KIA · 삼성 · 키움'], ['2025', '한화 · SSG · KT · 롯데 · 두산'], ['2026', 'LG · NC · KIA · 삼성 · 키움'], ['2027 예상', '한화 · SSG · KT · 롯데 · 두산']
  ], '', 'KBO 일정 발표 보도(2024 · 2025 · 2026 시즌)');

  // ───────── 처음 화면 ─────────
  function savedResult27() { const r = S.repo.load(YEAR_NEW); return r && r.project.meta && r.project.meta.result ? r.project.meta.result : app().state.meta.result && inPlan() ? app().state.meta.result : null; }
  const runningNote = () => '<div class="pf-note warn" style="margin:0 0 12px">계획을 실행하는 중입니다. 끝나면 결과 화면으로 넘어갑니다. <button class="pf-link" data-act="pf-stage" data-stage="2">실행 화면으로 ›</button></div>';
  function renderStart() {
    const ours = P.builtin['2025-best'], kbo = kboData();
    const pct = ours ? Math.round((1 - ours.gaps.totalKm / kbo.gaps.totalKm) * 100) : null;
    const step = (n, t, s, est) => '<li><b>' + n + ' ' + t + '</b><span>' + s + (est ? ' <span class="pf-tag est">추정 ' + est + '개</span>' : '') + '</span></li>';
    const res = savedResult27(), stale27 = res && inPlan() && resultStale(app().state), hasResult = res && !stale27, final27 = P.final.version(YEAR_NEW);
    const row = (y, what, act) => '<div class="pf-yr"><div class="y">' + y + '</div><div class="what">' + what + '</div><div class="acts">' + act + '</div></div>';
    const r25 = ours ? '<b class="good">전체 이동 거리 ' + pct + '% 짧음</b><span>KBO ' + num(kbo.gaps.totalKm) + 'km → ' + num(ours.gaps.totalKm) + 'km</span>' : '<span>' + (P.builtinFailed ? '저장된 결과를 읽지 못했습니다' : '저장된 결과를 불러오는 중입니다') + '</span>';
    const C = S.homeCopy; // 처음 화면 카드 문구는 home-copy.js에 모아 둔다
    const new27 = stale27 ? '<b>' + esc(C.staleLine) + '</b><span>' + esc(C.staleNote) + '</span>' : '<b>' + esc(C.newLine) + '</b>';
    return '<div class="pf-start">' + (isRunning() ? runningNote() : '') + '<h1>' + esc(C.heading) + '</h1><div class="pf-choices">' +
      '<div class="pf-ch"><h2>' + esc(C.checkTitle) + '</h2><p class="what">' + esc(C.checkLead) + '</p>' +
      row(2025, '<b>' + esc(C.check2025) + '</b>' + r25, '<button class="btn" data-act="pf-open-2025">' + esc(C.checkButton) + icon('right') + '</button>') +
      (final27 ? row(YEAR_NEW, '<b>' + esc(final27.name) + ' <span class="pf-tag ok">확정</span></b><span>전체 이동 거리 ' + num(final27.gaps.totalKm) + 'km</span>', '<button class="btn" data-act="pf-open-final">' + esc(C.checkButton) + icon('right') + '</button>') : '') +
      '</div>' +
      '<div class="pf-ch"><h2>' + esc(C.title) + '</h2><p class="what">' + esc(C.lead) + '</p>' +
      row(YEAR_NEW, new27, res ? '<button class="btn' + (hasResult ? '' : ' primary') + '" data-act="pf-open-2027">' + esc(C.reviewButton) + icon('right') + '</button>' : '<button class="btn primary" data-act="pf-open-2027">' + esc(C.startButton) + icon('right') + '</button>') +
      '<ul>' + step(1, esc(C.step1), esc(C.step1Note)) + step(2, esc(C.step2), esc(C.step2Note), 3) + step(3, esc(C.step3), esc(C.step3Note), 2) + step(4, esc(C.step4), esc(C.step4Note)) + '</ul>' +
      '<div class="small muted">' + esc(C.bottomNote).replace('{추정}', '<span class="pf-tag est">추정</span>') + '</div>' +
      // 검토 다음이 실행 결과다: 결과는 단계 아래에 둔다
      (hasResult ? row('', '<b>' + esc(C.resultLine) + '</b><span>' + esc(C.resultNote1) + '</span><span>' + esc(C.resultNote2) + '</span>', '<button class="btn primary" data-act="pf-open-2027" data-to="result">' + esc(C.resultButton) + icon('right') + '</button>') : '') +
      '</div></div></div>';
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
  // 설명 창(objective-help.js)이 같은 숫자를 쓴다
  P.GOALS = GOALS; P.objective = objective;
  function render2025() {
    const ours = P.builtin['2025-best'];
    if (!ours) return '<div class="pf-page"><div class="pf-sec">' + (P.builtinFailed ? '<h3>저장된 2025 결과를 읽지 못했습니다</h3><p class="pf-d">편성 서버 주소로 열면 볼 수 있습니다. 2027 새 계획은 지금도 만들 수 있습니다.</p>' : '<h3>결과를 불러오는 중입니다</h3>') + '</div></div>';
    if (P.view25 === 'dash') return '<div class="pf-page">' + dashboard(ours, ours.objective) + '</div>';
    const kbo = kboData(), ob = ours.objective, ids = ob.order;
    const pct = (id) => Math.round((1 - goalValue(ours, id) / goalValue(kbo, id)) * 100);
    const card = (id, k) => { const g = GOALS[id];
      return '<div class="pf-tile win"><span class="pf-rk">' + (k + 1) + '순위</span><div class="k">' + g.name + '<small>' + (g.tol ? '가장 많은·적은 구단 격차' : '10구단 합') + '</small></div>' +
        '<div class="v"><span class="old">KBO ' + goalShow(kbo, id) + g.unit + ' →</span>' + goalShow(ours, id) + '<small>' + g.unit + '</small></div><div class="d">▼ ' + pct(id) + '% ' + (g.tol ? '줄임' : '짧음 (' + num(goalValue(kbo, id) - goalValue(ours, id)) + 'km)') + '</div>' +
        '<div class="s">' + (g.tol ? '허용 ' + num(ob[g.tol]) + g.unit + ' — KBO ' + (within(kbo, id, ob) ? '안' : '<b style="color:var(--bad)">넘음</b>') + ' · 이 엔진 ' + (within(ours, id, ob) ? '<b style="color:var(--ok)">안</b>' : '넘음') : '짧을수록 좋음') + '</div></div>'; };
    const allBetter = ids.every((id) => goalValue(ours, id) <= goalValue(kbo, id));
    const names = Object.keys(ours.teams);
    const worse = [];
    if (Math.min(...vals(ours, 'away')) > Math.min(...vals(kbo, 'away'))) worse.push('가장 긴 연속 원정은 KBO가 ' + rangeText(kbo, 'away') + ', 이 엔진은 ' + rangeText(ours, 'away') + '(규칙 한도 안)');
    return '<div class="pf-page">' +
      '<div class="pf-hero"><div class="big">−' + pct('total') + '<small>%</small></div><div><h2>' + (allBetter ? '평가 기준 4개 모두 KBO보다 나음' : 'KBO 실제와 비교') + '</h2><p>같은 2025 조건에서 비교 · 전체 이동 거리 ' + goalShow(kbo, 'total') + 'km → ' + goalShow(ours, 'total') + 'km · 구단 간 이동 거리 차이 ' + goalShow(kbo, 'distance') + 'km → ' + goalShow(ours, 'distance') + 'km · 꼭 지킬 규칙 모두 지킴</p></div><div class="r"><span class="pf-tag got">저장된 결과 · ' + esc(ours.savedAt) + ' 실행</span></div></div>' +
      '<div class="pf-tiles">' + ids.map(card).join('') + '</div>' +
      '<div class="pf-cols pf-fill" style="grid-template-columns:1.2fr 1fr">' +
      '<div class="pf-sec"><h3>구단별 이동 거리</h3><p class="pf-d">회색 KBO 실제 · 파랑 이 엔진 · 초록 띠 = 이 엔진에서 가장 적은 구단 + 허용 수준</p>' + bars(ours, 'km', ob.distanceGapKm, 1, kbo) + '</div>' +
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
      openingHome: () => evOf(b, 'OPENING').pairs.map((x) => x.home + ' vs ' + x.away).join(' · '),
      childrenHome: () => evOf(b, 'CHILDREN').teams.join(' · ')
    }[key]();
    return '직접 고친 값입니다. 처음 추정값은 ' + was + '였습니다.';
  }
  // 2단계 줄의 「수정」은 화면을 옮기지 않고 그 줄 안에 입력칸을 펼친다(season-calendar.js S.seasonInlineEditor)
  const INLINE = { opening: 'opening', rest: 'rest', allStar: 'allstar', initialEnd: 'initialEnd', rules: 'rules' };
  const inlineEd = (r) => { const k = r.key || r.to; return G.fs === 2 && P.inline && P.inline === k ? '<div class="pf-rv-ed">' + (k === 'rules' ? S.homeTotalsEditor() : S.seasonInlineEditor(INLINE[k])) + '<button class="btn sm" data-act="pf-cal-done">닫기</button></div>' : ''; };
  /** 2단계 아래 달력: 「달력 고치기」를 누르면 수정 화면과 같은 달력으로 바뀐다 */
  const seasonCal = () => {
    const btn = '<button class="btn sm pf-cal-btn' + (P.calLive ? ' primary' : '') + '" data-act="pf-cal-live">' + icon(P.calLive ? 'check' : 'edit') + (P.calLive ? '고치기 끝' : '달력 고치기') + '</button>';
    return P.calLive ? S.seasonStripLive(btn) : S.seasonStripView(false, btn);
  };
  function rv(r0, cur) {
    const note = r0.key ? editedNote(r0.key) : null;
    const r = note ? Object.assign({}, r0, { tag: 'mine', why: note }) : r0;
    const ok = r.key ? !!review()[r.key] : false;
    const tag = r.tag === 'est' ? (ok ? '' : '<span class="pf-tag est">추정 · 확정 아님</span>') : r.tag === 'got' ? '<span class="pf-tag got">' + esc(r.tagText || '2025에서 가져옴') + '</span>' : r.tag === 'rule' ? '<span class="pf-tag blue">규칙대로 자동</span>' : r.tag === 'mine' ? '<span class="pf-tag blue">직접 고침</span>' : '';
    const to = ' data-to="' + (r.key || r.to || '') + '"';
    const acts = r.key
      ? (ok ? '<span class="pf-tag ok">✓ 수락</span><button class="btn sm" data-act="pf-cal"' + to + '>수정</button>' : '<button class="btn sm pf-okb" data-act="pf-ok" data-k="' + r.key + '">✓ 수락</button><button class="btn sm" data-act="pf-cal"' + to + '>수정</button>')
      : '<button class="btn sm" data-act="pf-cal"' + to + '>' + (r.editText || '수정') + '</button>';
    // r.inl = 값을 제목 줄 끝에 붙인다(3단계: 날짜·공휴일 수가 짧아 한 줄을 아낀다)
    return '<div class="pf-rv' + (ok ? ' ok' : cur ? ' cur' : '') + (inlineEd(r) ? ' open' : '') + '"' + (r.key ? ' data-k="' + r.key + '"' : '') + '><div><b class="t">' + esc(r.t) + '</b> ' + (r.inl ? '<span class="v in">' + r.v + '</span> ' + tag : tag + '<div class="v">' + r.v + '</div>') + (r.v2 ? '<div class="v2">' + r.v2 + '</div>' : '') +
      (r.why || r.more ? '<div class="why">' + esc(r.why || '') + (r.more || '') + '</div>' : '') + (r.warn || '') + '</div><div class="acts">' + acts + '</div>' + inlineEd(r) + '</div>';
  }
  const firstOpen = (n) => (KEYS[n] || []).find((k) => !review()[k]);
  function renderSeasonReview() {
    const st = app().state, s = st.settings, gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(st.calendar), cur = firstOpen(2);
    const star = (s.blackouts || []).find((b) => /올스타/.test(b.label || ''));
    const four = st.calendar.find((c) => c.consecutive === 4);
    const ht = s.homeTotals, more = (act) => ' <button class="pf-link" data-act="' + act + '">자세히 ›</button>';
    const rows = [
      { t: '쉬는 요일', to: 'rest', tag: 'got', v: esc(s.restWeekdays.map((w) => '일월화수목금토'[w] + '요일').join('·') || '없음') },
      { key: 'opening', t: '개막일', tag: 'est', v: fmt.date(s.seasonStart) + ' · 개막 2연전', ...BASIS.opening },
      { key: 'allStar', t: '올스타 휴식기·후반기 첫 4연전', tag: 'est', v: star ? fmt.date(star.start) + ' ~ ' + fmt.date(star.end) : '없음', v2: '후반기 첫 4연전 ' + (four ? Dates.fmtDate(four.datetime) + ' ~ ' + Dates.fmtDate(Dates.addDays(four.datetime, 3)) : '없음'), ...BASIS.allStar },
      { key: 'initialEnd', t: '1차 편성 종료일', tag: 'est', v: fmt.date(s.initialEnd) + ' · 경기일 ' + gd.have + '일', ...BASIS.initialEnd },
      // 홈 경기 수: 날짜에 붙는 값이 아니라 시즌 전체의 편성 조건이라 2단계에 둔다(수정은 4 확인의 시리즈 규칙)
      ht ? { t: '홈 경기 수', to: 'rules', tag: 'rule', v: (ht.more && ht.more.total) + '경기: ' + esc(ht.moreTeams.join(' · ')) + ' &nbsp;/&nbsp; ' + (ht.less && ht.less.total) + '경기: 나머지 5구단', ...BASIS.homeTotals, more: more('pf-basis-homes') } : null
    ].filter(Boolean);
    const sum = (KEYS[2].filter((k) => review()[k]).length);
    return '<div class="pf-page">' +
      '<div class="pf-sec"><h3>시즌 기간·연전 묶음<span class="r"><b>' + sum + ' / ' + KEYS[2].length + '</b> 수락</span></h3><p class="pf-d">줄마다 「수락」 또는 「수정」. 개막일과 1차 편성 기간이 정해지면 경기일과 연전 묶음은 규칙대로 자동으로 만들어집니다.</p><div class="pf-rv2">' + rows.map((r) => rv(r, r.key === cur)).join('') + '</div></div>' +
      // 반영 결과 숫자는 머리 줄 오른쪽(1단계 「n / 1 답함」, 2단계 위 구역 「n / 3 수락」과 같은 자리)
      '<div class="pf-sec pf-fill"><h3>반영 결과<span class="r pf-sum">경기일 <b>' + gd.have + '</b> / ' + gd.need + '일<i>·</i>연전 묶음 <b>' + st.calendar.length + '</b>개 <small>(3연전 ' + (h[3] || 0) + ' · 2연전 ' + (h[2] || 0) + ' · 4연전 ' + (h[4] || 0) + ')</small><i>·</i>기간 <b>' + fmt.short(s.seasonStart) + ' ~ ' + fmt.short(s.initialEnd) + '</b></span></h3><p class="pf-d">편성 조건을 수정하면 바로 다시 셉니다.</p>' + seasonCal() +
      '</div></div>';
  }
  function renderHomeReview() {
    const st = app().state, s = st.settings, cur = firstOpen(3);
    const op = (st.events || []).find((e) => e.type === 'OPENING') || {}, ch = (st.events || []).find((e) => e.type === 'CHILDREN') || {};
    const hol = s.holidays.filter((h) => h.date >= s.seasonStart && h.date <= s.initialEnd);
    const hol2 = s.holidays.filter((h) => h.date > s.initialEnd && h.date <= (s.seasonEnd || s.seasonStart.slice(0, 4) + '-10-31'));
    const holLine = (a) => a.map((h) => fmt.short(h.date) + ' ' + esc(h.name)).join(' · ');
    const stad = new Map(st.teams.map((t) => [t.name, t.stadium]));
    // 홈 구단마다 카드 하나. 상대를 정하지 않은 구단은 엔진이 상대를 정한다
    const homeCards = (e) => {
      const list = e.pairs || [], homes = list.map((x) => x.home).concat((e.teams || []).filter((t) => !list.some((x) => x.home === t)));
      if (!homes.length) return '<div class="pf-open-none">지정 없음</div>';
      return '<div class="pf-open">' + homes.map((h) => { const x = list.find((p) => p.home === h); return '<div class="g"><span class="pf-chip">' + esc(h) + '</span><div class="a' + (x ? '' : ' auto') + '">' + (x ? 'vs ' + esc(x.away) : '상대 자동') + '</div><div class="s" title="' + esc(stad.get(h) || '구장 미정') + '">' + esc(stad.get(h) || '구장 미정') + '</div></div>'; }).join('') + '</div>';
    };
    const more = (act) => ' <button class="pf-link" data-act="' + act + '">자세히 ›</button>';
    const homesOk = openingHomesOk(st);
    const rows = [
      { key: 'openingHome', t: '개막 2연전 홈', tag: 'est', inl: true, v: fmt.short(op.date || s.seasonStart), v2: homeCards(op), more: more('pf-basis'), ...BASIS.openingHome, warn: homesOk ? '' : '<div class="pf-note warn">홈 구단이 전년도 순위와 다릅니다(' + esc(OPENING_HOMES().join(' · ')) + '). 되돌려야 다음으로 갈 수 있습니다. <button class="pf-link" data-act="pf-op-reset">전년도 순위대로 되돌리기 ›</button></div>' },
      { key: 'childrenHome', t: '어린이날 홈', tag: 'est', inl: true, v: fmt.short(ch.date || '2027-05-05'), v2: homeCards(ch), ...BASIS.childrenHome, more: more('pf-basis-children') },
      { t: '공휴일·가중치', tag: 'got', tagText: '공휴일 달력', inl: true, v: '1차 편성 기간 ' + hol.length + '일 · 2차 편성 기간 ' + hol2.length + '일', v2: '1차: ' + holLine(hol) + (hol2.length ? '<br>2차: ' + holLine(hol2) : ''), why: (s.seasonStart.startsWith('2027') ? '정부 공휴일 달력 기준입니다(8/16 광복절 대체공휴일은 뺐습니다). ' : '정부 공휴일 달력 그대로입니다. ') + '휴일 가중치는 별도로 설정할 수 있습니다. (예 토요일 1점, 공휴일 2점, 어린이날 3점 등)' },
    ].filter(Boolean);
    const sum = KEYS[3].filter((k) => review()[k]).length;
    return '<div class="pf-page">' +
      '<div class="pf-sec"><h3>주요 일정<span class="r"><b>' + sum + ' / ' + KEYS[3].length + '</b> 수락</span></h3><p class="pf-d">정한 날에 홈 경기를 할 구단을 지정합니다. 나머지 날의 홈·원정은 엔진이 정합니다.</p><div class="pf-rv2">' + rows.map((r) => rv(r, r.key === cur)).join('') + '</div></div>' +
      '<div class="pf-sec pf-fill"><h3>시즌 달력</h3><p class="pf-d">공휴일과 홈 구장을 지정한 날이 시즌 어디쯤인지 봅니다.</p>' + S.seasonStripView(true) + '</div></div>';
  }
  // 1 구단 정보: 2단계와 같은 흰 구역 셋(위 = 질문 줄, 아래 왼쪽 = 구단 표, 오른쪽 = 구장 간 거리표). step-data.js가 표·거리표를 만들어 넘긴다
  const tmZoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pf-zoom')) || 1;
  const tmKey = () => window.innerWidth + 'x' + window.innerHeight + ':' + !!(app().state.meta.flow || {}).teams;
  P.teamsSec = {
    /** 거리표 칸 높이: 처음에는 어림값, 그린 뒤 남거나 넘친 높이로 한 번 고친다(P.tmFit). 창 크기·답 여부마다 따로 */
    cellH() {
      if (P.tmFit && P.tmFit.key === tmKey()) return P.tmFit.h;
      return Math.max(20, Math.min(46, Math.floor(((window.innerHeight - 196) / tmZoom() - 290) / 11)));
    },
    /** 칸 너비: 두 칸 중 오른쪽 구역 안쪽 너비(여백·테두리·구단 이름 칸을 뺀 것)를 구단 수로 나눈다 */
    cellW: (n) => Math.max(30, Math.floor(((window.innerWidth / tmZoom() - 36 - 12) / 2 - 34 - 44 - 14) / Math.max(1, n))),
    render(p) {
      S.afterRender(tmFit);
      return '<div class="pane-body tm-two tm-sec" data-sk="d-teams" style="--tm-r:' + p.rowH + 'px">' + teamsLead() +
        '<div class="tm-wait tm-two-l pf-sec"><h3>구단·구장<span class="r"><b>' + p.teams + '</b>구단</span></h3><p class="pf-d">줄을 누르면 그 구단의 구장 이름과 위치를 고칩니다.</p>' + p.table + p.road + p.popup + '</div>' +
        '<div class="tm-wait tm-two-r pf-sec"><h3>구장 간 거리표<span class="r"><b>' + p.dists + '</b>개 · km</span></h3><p class="pf-d">왼쪽 = 출발 구단, 위 = 도착 구단. 먼 거리는 주황 칸입니다.</p>' +
        (p.heat ? '<div class="tm-dist"><div class="chart-box tm-heat">' + p.heat + '</div></div>' : '') + '<div class="blk tm-mapwrap">' + p.mapBar + '</div></div></div>';
    }
  };
  function tmFit() {
    const pane = document.querySelector('.tm-sec');
    if (!pane || pane.querySelector('.gs-edit, .tm-mapblk')) return; // 고치는 창·지도를 펼치면 넘쳐도 그대로(스크롤)
    const box = pane.getBoundingClientRect(), k = box.height / (pane.offsetHeight || 1) || 1;
    const low = Math.max(...Array.from(pane.children).map((c) => c.getBoundingClientRect().bottom));
    const free = (box.bottom - low) / k - parseFloat(getComputedStyle(pane).paddingBottom), cur = P.teamsSec.cellH(), key = tmKey();
    const want = Math.max(20, Math.min(46, cur + Math.floor(free / 11)));
    const tries = P.tmFit && P.tmFit.key === key ? P.tmFit.tries : 0;
    if (want !== cur && tries < 3) { P.tmFit = { key, h: want, tries: tries + 1 }; S.render(); }
  }
  /** 위 구역: 「바뀐 정보가 있나요?」를 2단계의 검토 줄과 같은 모양으로(답 전 = 지금 볼 줄, 답 뒤 = 수락한 줄) */
  function teamsLead() {
    const st = app().state, ans = (st.meta.flow || {}).teams, SH = KBO.Preset2027.SHARED_STADIUM;
    const changed = st.teams.some((t) => t.stadium === SH.name);
    const acts = ans
      ? '<span class="pf-tag ' + (ans === 'same' ? 'ok">✓ 없어요 — 그대로' : 'blue">있어요 — 고치는 중') + '</span><button class="btn sm" data-act="fl-teams-reask">다시 고르기</button>'
      : '<button class="btn sm pf-okb" data-act="fl-teams-same" title="바로 2단계로 갑니다">✓ 없어요 — 그대로</button><button class="btn sm" data-act="fl-teams-changed" title="고치는 법을 차례로 알려 드립니다">있어요 — 고칠게요</button>';
    const row = '<div class="pf-rv fl-ask tm-ask' + (ans ? ' ok' : ' cur') + '"><div><b class="t">' + (changed ? '그 밖에 바뀐 정보가 있나요?' : '바뀐 정보가 있나요?') + '</b>' +
      (changed ? '<div class="v">이미 고쳐 둔 곳: LG·두산 구장 잠실 → ' + esc(SH.name) + '</div><div class="why">잠실야구장이 2026시즌 뒤 철거되어 2027~2031년 임시로 씁니다. 바로 옆 구장이라 구장 사이 거리는 잠실 값을 그대로 씁니다.</div>'
        : '<div class="why">구단 이름·구장·위치가 작년과 달라진 곳이 있는지 답해 주세요. 「없어요」 → 바로 2단계로. 「있어요」 → 고치는 법을 차례로 알려 드립니다.</div>') +
      '</div><div class="acts">' + acts + '</div></div>';
    return '<div class="tm-two-lead pf-sec"><h3>구단 정보<span class="r"><b>' + (ans ? 1 : 0) + ' / 1</b> 답함</span></h3><p class="pf-d">구장 사이 이동거리는 구장 위치로 계산합니다. 구단 이름·구장·위치가 바뀐 해만 고칩니다.</p>' + row + '</div>';
  }
  /** 4 확인: 2단계와 같은 흰 구역 둘(위 = 확인 줄, 아래 = 시즌 달력) */
  function renderCheck27() {
    const fs = S.flowStatus(), n = fs.done.filter(Boolean).length;
    return S.renderCheck({
      grid: true, noNext: true,
      sec: { title: fs.allDone ? '검토 완료' : '아직 검토할 편성 조건이 남았습니다', count: '<b>' + n + ' / 4</b> 확인', desc: '아래가 맞으면 「다음: 운영 방침·실행」을 누릅니다. 고칠 곳이 있으면 그 줄의 「고치기」로 그 단계에 갑니다.' },
      after: '<div class="pf-sec pf-fill ck-cal"><h3>시즌 달력</h3><p class="pf-d">2·3단계에서 정한 날이 시즌 어디쯤인지 봅니다. 고치려면 위 줄의 「고치기」를 누릅니다.</p>' + S.seasonStripView(true) + '</div>'
    });
  }
  const origStep1 = S.guideUI.renderStep1;
  S.guideUI.renderStep1 = function (R) {
    if (G.mode === 'all') return null;
    if (G.mode === 'year' || G.mode === 'resume') return renderStart();
    if ((G.fs === 2 || G.fs === 3) && !P.calEdit) return S.flowWrap(G.fs === 2 ? renderSeasonReview() : renderHomeReview(), 'pf-rvw');
    if (G.fs === 4) return S.flowWrap(renderCheck27(), 'ck');
    return origStep1(R);
  };
  /** 단계 띠: 기존 모양에 이름만 「값 입력·검증」으로, 끝에 「따라 하기 다시 보기」 */
  const origBand = S.flowBand;
  S.flowBand = function () {
    return origBand().replace(/(<b>\d{4} 시즌 · )[①]? ?데이터 준비/, '$1편성 조건').replace(/<button class="lnk" data-act="fl-resume">[\s\S]*?<\/button>/, '<button class="lnk" data-act="pf-tour-again">' + icon('info') + '따라 하기 다시 보기</button>');
  };

  // ───────── 말풍선 ─────────
  const TOUR = {
    1: { a: '.fl-ask', title: '한 단계씩 검토', text: () => '편성 조건은 미리 채워 두었지만 확정되지 않은 추정값이 섞여 있습니다. 단계마다 설명을 읽고, 맞으면 「수락」, 다르면 「수정」을 누르세요. 먼저 구단 정보입니다. LG·두산 구장은 올림픽 주경기장으로 고쳐 두었습니다. 그 밖에 달라진 것이 없으면 「없어요」.' },
    2: { a: '.pf-rv.cur', title: '추정값 확인', text: () => '「추정」 표시는 확정 전 값입니다. 맞으면 「수락」, KBO 계획과 다르면 「수정」으로 달력에서 바꾸세요. 경기일과 연전 묶음은 바로 다시 계산됩니다.' },
    3: { a: '.pf-rv.cur', title: '개막전 홈 확인', text: () => '홈 구단은 2026 최종 순위로 정해져 바꾸지 않습니다. 대진은 예측이라 신뢰도가 낮습니다. KBO 발표(보통 12월 중순)와 상대가 다르면 「수정」을 누르세요. 후반기 첫 4연전도 따라 바뀝니다.' },
    4: { a: '.footer .btn.primary', title: '다음은 운영 방침', text: () => '네 목표를 모두 최고로 만들 수는 없습니다. 무엇을 먼저 지키고 목표마다 어디까지 봐줄지 정한 뒤 실행합니다. 기본값 그대로 실행해도 됩니다.' }
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

  // ───────── 2 운영 방침·실행 ─────────
  // 화면의 글은 사용자와 합의한 설계(2026-11-02)다. 「충돌」보다 「균형」: 엔진은 한 목표를 더 좋게 하려면 다른 목표를 내줘야 하는 지점을 찾고,
  // 그 가운데 어디에 설지는 운영자가 고른다. 「파레토」 같은 말은 화면에 쓰지 않는다. 2025 숫자(이 엔진·KBO 실제)도 쓰지 않는다.
  P.policyCopy = {
    title: '운영 방침 정하기',
    lead: '이동 격차와 주말·공휴일 홈 격차, 둘 다 최소로 만들 수는 없습니다. 어느 쪽에 무게를 둘지는 운영자의 몫이고, 운영의 묘는 여기서 드러납니다.', // 다듬은 글(사용자 결정 2026-11-04)
    left: '이동 격차 줄이기', right: '주말·공휴일 홈 격차 줄이기', // 가로 띠의 양 끝(카드 이름과 같은 말)
    caption: '카드를 고르면 점이 옮겨 갑니다',
    bridge: '1순위가 아래 허용 수준 안에 들면 만족으로 보고 2순위로 넘어갑니다.',
    levelsTitle: '목표마다 허용 수준',
    levelsLead: '격차를 어디까지 봐줄지 목표마다 정합니다. 좁힐수록 그 격차는 줄고, 다른 쪽 격차는 커질 수 있습니다.'
  };
  /** 머리글 그림: 가로 띠. 왼쪽 끝 「이동 격차 줄이기」, 오른쪽 끝 「주말·공휴일 홈 격차 줄이기」, 고른 방침의 자리에 파란 점(카드를 고르면 옮겨 간다).
   *  누르는 것이 아니라 표시만. 저울 그림을 대신한다(2026-11-04: 저울은 첫 문장과 같은 말을 되풀이했고 접시 이름이 길어져 눌려 보였다) */
  function bandFigure(ob) {
    const C = P.policyCopy;
    const custom = P.customOrder || !ORDERS.some((o) => o.order.join() === ob.order.join());
    const pos = custom ? (ob.order[0] === 'holiday' ? 66 : 34) : ob.order[0] === 'holiday' ? 84 : 16; // 직접 정하기는 1순위가 어느 쪽인지로 안쪽에
    return '<figure class="pf-band" aria-label="지금 방침의 자리: 왼쪽 끝 ' + esc(C.left) + ', 오른쪽 끝 ' + esc(C.right) + '">' +
      '<div class="tr"><span class="now" style="left:' + pos + '%">' + esc(policyName(ob)) + '</span><i class="dot" style="left:' + pos + '%"></i></div>' +
      '<div class="ends"><span>' + esc(C.left) + '</span><span>' + esc(C.right) + '</span></div>' +
      '<figcaption>' + esc(C.caption) + '</figcaption></figure>';
  }
  function orderCards(ob) {
    const key = ob.order.join();
    const hit = ORDERS.find((o) => o.order.join() === key);
    const custom = P.customOrder || !hit;
    const kg = (o) => '<dl class="pf-kg"><div><dt>지키는 것</dt><dd>' + esc(o.keep) + '</dd></div><div><dt>내주는 것</dt><dd>' + esc(o.give) + '</dd></div></dl>';
    // 카드는 고르는 자리(이름 + 지키는 것·내주는 것)만. 고른 순서 1~4는 오른쪽 「지금 순위」 칸 한 곳에 늘 보인다(사용자 결정 2026-11-04: 같은 네 줄을 카드마다 되풀이하지 않는다)
    // 「선택」 표는 제목 왼쪽 같은 줄(2026-11-05: 위 줄에 두니 네 칸의 제목선이 어긋났다)
    const pick = (on) => on ? '<span class="pf-tag blue">선택</span>' : '';
    const card = (o) => { const on = !custom && hit && hit.id === o.id;
      return '<div class="pf-oc' + (on ? ' on' : '') + '" role="button" tabindex="0" data-act="pf-order" data-id="' + o.id + '" aria-pressed="' + on + '"><h4>' + pick(on) + esc(o.name) + '</h4>' + kg(o) + '</div>'; };
    const lastFixed = ob.order[3] === LAST, top = lastFixed ? 2 : 3; // 전체 이동 거리가 마지막이면 그 줄은 움직이지 않는다(옛 버전으로 순서가 다르면 모두 움직일 수 있게)
    const diy = '<div class="pf-oc' + (custom ? ' on' : '') + '" role="button" tabindex="0" data-act="pf-order-custom" aria-pressed="' + custom + '"><h4>' + pick(custom) + '직접 정하기</h4><p>순서는 오른쪽 「지금 순위」에서 화살표로 바꿉니다.</p></div>' // 「늘 마지막」은 지금 순위 칸 마지막 줄에 있어 되풀이하지 않는다(1440×790에서 「마지막」 한 낱말이 줄 끝에 홀로 남았다);
    // 지금 순위: 직접 정하기를 골랐을 때만 화살표가 붙는다
    const now = '<div class="pf-now" id="pf-order-now"><h4>지금 순위</h4><p>' + esc(custom ? '직접 정한 순서' : hit.name.replace(/ \(기본\)$/, '')) + '</p><ol>' +
      ob.order.map((i, k) => '<li><span class="pf-rk">' + (k + 1) + '순위</span><span class="nm">' + GOALS[i].name + '</span>' + (custom && !(lastFixed && i === LAST) ? '<span class="pf-mv"><button data-act="pf-move" data-k="' + k + '" data-d="-1"' + (k === 0 ? ' disabled' : '') + ' aria-label="위로">▲</button><button data-act="pf-move" data-k="' + k + '" data-d="1"' + (k >= top ? ' disabled' : '') + ' aria-label="아래로">▼</button></span>' : lastFixed && i === LAST ? '<span class="pf-last">늘 마지막</span>' : '') + '</li>').join('') + '</ol></div>';
    return ORDERS.map(card).join('') + diy + now;
  }
  // 허용 수준은 폭(가장 많은 구단 − 가장 적은 구단)이지 축 위의 위치가 아니다. 결과가 어디에 놓일지는 실행 전에 모르므로
  // 그림 없이 문장 하나와 숫자로만 받는다. −·+ 한 번의 폭은 지난 결과가 아니라 여기 고정값이다. 값 키·서버로 가는 형식은 그대로다.
  const GAP_STEP = { moveGap: 1, distanceGapKm: 50, holidayGap: 1 };
  const TIME_MIN = 1, TIME_MAX = 5; // 실행 시간(분)
  /** 지금 입력에서 세는 근거(실행 결과가 아니다): 주말·공휴일 점수 합(구단 수로 나누어떨어지는가)과 다른 구장까지의 평균 거리 */
  function tolFacts() {
    const inp = Score.buildInput(app().state), n = inp.teams.length;
    const holTotal = inp.slots.reduce((a, sl) => a + (sl.holiday | 0), 0) * Math.floor(n / 2); // 연전 기간마다 홈 연전이 구단 수의 절반
    const avg = inp.teams.map((t, i) => ({ name: t.name, km: inp.dist[i].reduce((a, b) => a + b, 0) / Math.max(1, n - 1) / 10 })).sort((x, y) => x.km - y.km);
    return { n, holTotal, holEach: holTotal / n, even: n > 0 && holTotal % n === 0, near: avg[0], far: avg[n - 1] };
  }
  P.tolFacts = tolFacts;
  P.DEFAULT_OBJECTIVE = DEFAULT_OBJECTIVE;
  // 줄마다: 좁히면 / 넓히면 두 토막. 내주는 쪽은 단정하지 않는다
  // 머리글의 목표 넷: 무엇을 세는지 한 줄씩. 우선순위를 고르기 전에 읽힌다(사용자 요청 2026-11-04). 「이동 횟수와 이동 거리는 무슨 차이?」에 답하는 자리. 자세한 계산법은 설명 창
  const GOAL_DESC = {
    moves: '다른 구장으로 옮겨 간 횟수. 멀고 가까움은 보지 않음',
    distance: '옮겨 간 거리를 더한 km. 횟수가 같아도 먼 곳을 오가면 커짐',
    holiday: '홈 연전 날짜마다 매긴 점수의 합. 기본은 토·일 1점, 공휴일 2점, 어린이날 3점', // 점수는 1단계 「공휴일·가중치」에서 바꿀 수 있어 「기본은」(2026-11-05)
    total: '10구단이 옮겨 간 거리를 모두 더한 값. 격차가 아니라 합'
  };
  P.GOAL_DESC = GOAL_DESC;
  const goalsLead = () => '<p class="pf-goals-lead"><b>목표는 넷.</b> 앞의 셋은 구단 사이 격차(가장 많은 구단 − 가장 적은 구단)로, 허용 수준을 둡니다. 전체 이동 거리는 리그 전체의 합이라 허용 수준이 없습니다.</p>';
  const goalsTiles = () => '<div class="pf-goals">' + ['moves', 'distance', 'holiday', 'total'].map((id) => '<div class="g' + (id === 'total' ? ' sum' : '') + '"><b>' + esc(GOALS[id].name) + '</b><span>' + esc(GOAL_DESC[id]) + '</span></div>').join('') + '</div>'; // 칸 이름은 목표 이름 그대로 「… 격차 줄이기」(사용자 요청 2026-11-04: 「격차」로만 끝내지 않는다)
  // 줄마다 붙이던 「좁히면·넓히면」 두 토막은 뺐다(2026-11-05: 머리말 「좁힐수록 그 격차는 줄고, 다른 쪽 격차는 커질 수 있습니다」와 같은 말)
  /** 값에 따라 바뀌는 안내는 두 끝에서만: 0이면 반드시 맞추려는 것, 기본값의 3배 이상이면 사실상 보지 않는 것. 그 사이에는 없다 */
  function tolHint(id, ob, f) {
    const g = GOALS[id], v = ob[g.tol], def = DEFAULT_OBJECTIVE[g.tol];
    if (v === 0) return '<div class="pf-th" data-tolstate="zero">' + (id === 'holiday' && !f.even ? '이 목표를 될 수 있는 한 맞추고 다른 목표를 내줍니다(0은 될 수 없어 1점까지)' : '이 목표를 반드시 맞추려 하고 다른 목표를 내줍니다') + '</div>';
    if (v >= def * 3) return '<div class="pf-th" data-tolstate="wide">이 목표는 사실상 보지 않습니다</div>';
    return '';
  }
  function slider(id, ob, f) {
    const g = GOALS[id], tol = ob[g.tol], st = GAP_STEP[g.tol];
    return '<div class="pf-sl" data-goal="' + id + '"><div class="k"><b>' + g.name + '</b></div>' +
      '<div class="pf-st">가장 많은 구단이 가장 적은 구단보다 <span class="n"><button data-act="pf-gap-step" data-k="' + g.tol + '" data-d="-' + st + '" aria-label="' + esc(g.name) + ' 허용 수준 줄이기">−</button>' + '<input value="' + num(tol).replace(/,/g, '') + '" data-in="pf-gap" data-k="' + g.tol + '" inputmode="numeric" aria-label="' + esc(g.name) + ' 허용 수준 숫자">' + '<button data-act="pf-gap-step" data-k="' + g.tol + '" data-d="' + st + '" aria-label="' + esc(g.name) + ' 허용 수준 늘리기">+</button></span>' + g.unit + ' 넘게 많지 않으면 만족</div>' +
      (id === 'holiday' && !f.even ? '<div class="pf-tn">이 달력은 점수가 ' + f.n + '구단에 똑같이 나뉘지 않아, 격차는 가장 좁혀도 1점입니다.</div>' : '') +
      tolHint(id, ob, f) + '</div>';
  }
  /** 「운영 방침 설명하기」 → 설명 창(objective-help.js). 운영 방침 화면(머리글 오른쪽)과 실행 중 화면(오른쪽 위)에만 둔다 */
  const explainBtn = () => '<button class="pf-link' + (S.ui.drawer === 'explain' ? ' on' : '') + '" data-act="pf-explain">' + icon('info') + '운영 방침 설명하기</button>';
  const explainLink = () => '<div class="pf-toprow">' + explainBtn() + '</div>';
  /** 방침 이름: 추천 카드 이름(「(기본)」 뺌) 또는 「직접 정한 순서」 */
  function policyName(ob) {
    const hit = ORDERS.find((o) => o.order.join() === ob.order.join());
    return !P.customOrder && hit ? hit.name.replace(/ \(기본\)$/, '') : '직접 정한 순서';
  }
  P.policyName = policyName;
  // 방침 요약은 아래 줄(실행 단추 옆)과 실행 칸의 「지금 방침」에 둔다. 실행 단추는 아래 줄 하나뿐이다(화면 안에 하나 더 두면 파란 단추가 둘이라 — 사용자 결정 2026-11-03, 2026-11-04에도 유지)
  /** 아래 줄의 실행 시간 입력: 최대 [−] N [+] 분 — 실행 단추 바로 왼쪽 */
  const timeBox = () => { const min = P.timeSec / 60; return '<span class="pf-ftime pf-st">최대 <span class="n"><button data-act="pf-time-step" data-d="-1" aria-label="실행 시간 줄이기"' + (min <= TIME_MIN ? ' disabled' : '') + '>−</button><input value="' + min + '" data-in="pf-time" inputmode="numeric" aria-label="실행 시간(분)"><button data-act="pf-time-step" data-d="1" aria-label="실행 시간 늘리기"' + (min >= TIME_MAX ? ' disabled' : '') + '>+</button></span>분</span>'; };
  const policyText = (ob) => '지금 방침: <b>' + esc(policyName(ob)) + '</b> · 이동 횟수 ' + num(ob.moveGap) + '회 · 이동 거리 ' + num(ob.distanceGapKm) + 'km · 주말·공휴일 ' + num(ob.holidayGap) + '점';
  function renderOptions() {
    const ob = objective(), pf = app().preflight(), f = tolFacts(), C = P.policyCopy;
    const rest = app().engineConfig.kind === 'REST', info = (app().engineConfig && app().engineConfig.info) || {};
    const maxSec = rest && info.maxSeconds ? info.maxSeconds : null;
    return '<div class="pf-page pf-spread">' +
      '<div class="pf-sec pf-head"><div class="t"><h2>' + esc(C.title) + '<span class="r">' + explainBtn() + '</span></h2><p class="pf-d">' + esc(C.lead) + '</p>' + goalsLead() + '</div>' + bandFigure(ob) + goalsTiles() + '</div>' + // 윗줄: 제목·설명 | 띠, 아랫줄: 목표 네 칸 전체 폭(2026-11-04: 띠가 머리글 한가운데 떠 있어 어디와도 줄이 안 맞았다)
      '<div class="pf-pair"><div class="pf-sec"><h3>우선순위</h3><p class="pf-d">어느 격차를 먼저 줄일지 고릅니다. 1순위가 조금이라도 나은 결과를 고르고, 2순위는 1순위가 같을 때만 봅니다. 전체 이동 거리는 늘 마지막이라 세 격차가 같을 때만 봅니다. 반드시 지킬 규칙은 어느 순서든 지킵니다.</p><div class="pf-orders">' + orderCards(ob) + '</div><p class="pf-bridge">' + esc(C.bridge) + '</p></div>' +
      '<div class="pf-sec" id="pf-levels"><h3>' + esc(C.levelsTitle) + '</h3><p class="pf-d">' + esc(C.levelsLead) + '</p>' +
      ['moves', 'distance', 'holiday'].map((id) => slider(id, ob, f)).join('') +
      // 실행에 관한 알림만 이 칸 끝에. 실행 칸은 없앴다(2026-11-04: 방침 요약·시간은 아래 줄에 있어 되풀이였다). 실행 시간 입력은 아래 줄 단추 옆
      (rest ? '' : '<div class="pf-runbar"><span class="grow"></span><span class="pf-tag est" title="편성 서버에 연결되지 않아 브라우저 시험 엔진을 씁니다">시험 엔진 — 결과가 좋지 않습니다</span></div>') +
      (maxSec && maxSec < P.timeSec ? '<div class="pf-note warn">서버 한도가 ' + maxSec + '초라 그 시간까지만 실행합니다.</div>' : '') +
      (pf.ok ? '' : '<div class="pf-note warn">사전 점검에 진행 불가 ' + pf.counts.block + '건이 있어 실행할 수 없습니다. 편성 조건 입력·검증으로 돌아가 고치세요.</div>') + '</div></div></div>';
  }
  /** 결과 화면 맨 위 한 줄: 결과의 실제 격차를 방침의 허용 수준과 목표마다 견준다. 옆에 「수준 다시 정하기」 */
  function policyCheck(data, ob) {
    const items = ob.order.filter((id) => GOALS[id].tol).map((id) => { const g = GOALS[id], v = goalValue(data, id), tol = ob[g.tol], ok = v <= tol;
      return '<span class="it ' + (ok ? 'ok' : 'over') + '">' + esc(shortName(id)) + ' <i>' + (ok ? '✓' : '✗') + '</i> ' + (ok ? '허용 안' : num(v - tol, g.d) + g.unit + ' 넘음') + '</span>'; });
    return '<div class="pf-sec pf-vs"><span class="l"><b>방침과 견주기</b> — ' + items.join(' · ') + '</span><button class="btn sm" data-act="pf-relevel">수준 다시 정하기</button></div>';
  }
  /** 찾는 중 화면: 머리글 한 줄 + 현재 결과 분석과 같은 구성(사용자 결정 2026-11-04). 지킨 규칙 목록은 구단별 한눈에 아래 한 줄로 줄였다 */
  function renderRunning() {
    const c = app().derived(), ex = c.ex, data = dataOf(ex), ob = objective(), r = S.run;
    return '<div class="pf-page">' + explainLink() + '<div class="pf-hero run"><div class="big">찾는 중…</div><div><h2>지금까지 가장 좋은 결과</h2><p>' + fmt.time(r.elapsed) + ' 지남 · ' + (ex.feasible ? '반드시 지킬 규칙을 모두 지키는 중' : '규칙을 맞춰 가는 중') + ' · 더 나은 결과가 나오는 대로 받아 옵니다 · 더 나아지지 않으면 최대 시간 전에 끝납니다</p></div><div class="r"><button class="btn" data-act="run-stop">멈추고 이 결과 쓰기</button></div></div>' +
      dashboard(data, ob) + '</div>';
  }
  const origStep2 = S.steps[2].render;
  S.steps[2].render = function () {
    if (S.seasonYear() !== YEAR_NEW) return origStep2();
    return '<div class="stepview no-band">' + (isRunning() ? renderRunning() : renderOptions()) + '</div>';
  };
  /** 실행이 끝나면(step-review.js finish): 결과를 기록하고 현재 결과 분석으로 */
  S.afterRun = function (ex, run, why) {
    if (S.seasonYear() !== YEAR_NEW) return false;
    // 실행마다 번호를 붙여 바로 저장한다. 방침은 실행을 누른 때의 것(P.runOption), 없으면 지금 순서로 본다
    const st = app().state, ob = st.settings.objective || DEFAULT_OBJECTIVE, option = P.runOption || optionOf(ob), no = nextNo(YEAR_NEW);
    P.runOption = null;
    S.ls.set(noKey(YEAR_NEW), String(no)); // 목록보다 먼저 센다(목록을 못 써도 번호는 다시 쓰지 않는다)
    const res = { at: new Date().toISOString(), elapsedMs: run.elapsed, why, objective: ob, sig: inputSig(st), calSig: calSig(st), engine: app().engineConfig.kind, no, option, name: runName(no, option, ob) };
    const v = storeRun(res, ex);
    res.vid = v ? v.id : null;
    app().store.commit('실행 결과 기록', (s) => { s.meta.result = Object.assign({}, res); }, { tags: ['meta'], undo: false });
    if (v) pickNew(v);
    const instant = Date.now() - run.startedAt < 3000 && why !== '사용자 중지'; // 서버가 같은 조건의 결과를 저장해 두었다가 바로 돌려준 경우(걸린 시간은 그때 실행한 값으로 온다)
    if (!v) noRoom();
    else S.toast((instant ? '같은 조건으로 전에 실행한 결과를 바로 가져왔습니다.' : '실행이 끝났습니다(' + ({ '최대 실행 시간': '고른 최대 시간까지 실행', '개선 없음': '더 나아지지 않아 먼저 끝남', '사용자 중지': '직접 멈춤' }[why] || why) + ').') + ' 「' + v.name + '」(으)로 저장했습니다.', ex.feasible ? 'ok' : 'warn', instant ? 6000 : 5000);
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
  // 전체 이동 거리는 늘 마지막 순위라 이 화면에서 따로 보이지 않는다(사용자 결정 2026-11-04). 이동 횟수·거리는 한 칸에 함께,
  // 주말·공휴일은 따로 — 이 둘은 왼쪽에 위아래로, 오른쪽에 「구단별 한눈에」를 넓게(사용자 결정 2026-11-04).
  // 표는 방침의 순위대로 왼쪽부터, 순위에 없는 두 열은 오른쪽 끝에 두고 열 너비를 같게 한다. 색 채움(엑셀 느낌)은 쓰지 않는다.
  const HEAT_COLS = { moves: ['이동 횟수', 'moves', 0], distance: ['이동 거리', 'km', 1], holiday: ['주말·공휴일 홈(점)', 'hol', 0] };
  const rankOf = (ob, id) => ob.order.indexOf(id) + 1;
  const tolTag = (data, id, ob) => { const ok = within(data, id, ob); return '<span class="pf-tag ' + (ok ? 'ok' : 'over') + '">' + (ok ? '안' : '넘음') + '</span>'; };
  /** 막대 눈금: 가장 적은 구단 + 허용 수준까지 들어가게 */
  function barScale(a, k, tol) {
    const lo = Math.min(...a), hi = Math.max(...a);
    const base = k === 'km' ? Math.floor(lo * 0.9 / 100) * 100 : Math.max(0, Math.floor(lo - 4));
    const top = Math.max(hi, lo + tol) * (k === 'km' ? 1.02 : 1) + (k === 'km' ? 0 : 1);
    return { base, mn: lo, x: (v) => ((v - base) / (top - base) * 100).toFixed(1) + '%' };
  }
  const track = (sc, tol, v) => '<span class="tr"><span class="tol" style="left:' + sc.x(sc.mn) + ';width:calc(' + sc.x(sc.mn + tol) + ' - ' + sc.x(sc.mn) + ')"></span><span class="bar" style="width:' + sc.x(v) + '"></span></span>';
  /** 목표 하나의 구단별 막대(왼쪽 칸에 한 번에 하나만 보일 때): 구단 | 막대 | 숫자 | 평균과 차이. 줄은 많은 순 */
  function goalOne(data, ob, id) {
    const g = GOALS[id], a = vals(data, g.metric), tol = ob[g.tol], sc = barScale(a, g.metric, tol), mean = a.reduce((s, v) => s + v, 0) / a.length;
    const rows = Object.keys(data.teams).sort((p, q) => data.teams[q][g.metric] - data.teams[p][g.metric]);
    return '<div class="pf-tb pf-one"><div class="pf-rw hd"><span></span><span><i></i>' + esc(shortName(id)) + ' (' + g.unit + ')</span><span></span><span>평균과 차이</span></div>' +
      rows.map((t) => { const v = data.teams[t][g.metric], dv = v - mean; return '<div class="pf-rw"><span class="t">' + esc(t) + '</span><span class="ln">' + track(sc, tol, v) + '</span><span class="n">' + num(v, g.d) + '</span><span class="dv">' + (dv >= 0 ? '+' : '−') + num(Math.abs(dv), g.d ? 0 : 1) + '</span></div>'; }).join('') +
      '</div><div class="xs muted" style="margin-top:4px">막대는 ' + num(sc.base) + g.unit + '부터 · 초록 띠 = 가장 적은 구단 + 허용 수준</div>';
  }
  /** 왼쪽 칸에 보일 목표: 고른 것이 방침에 없으면 1순위 */
  const shownGoal = (ids) => (ids.includes(P.dashGoal) ? P.dashGoal : ids[0]);
  /** 구단별 한눈에 정렬(사용자 결정 2026-11-05: 제목을 누르면 그 열로). P.heatSort = null(1순위 많은 순) 또는 { k: 열 값 이름(moves·km·hol·wk·away) 또는 'team', dir: -1 많은 순 · 1 적은 순 }.
   *  열 순서가 아니라 값 이름으로 기억해 방침 순위가 바뀌어도 같은 기준이 남는다 */
  function heatSortOf(cols) {
    const s = P.heatSort;
    return s && (s.k === 'team' || cols.some((c) => c[1] === s.k)) ? s : { k: cols[0][1], dir: -1 };
  }
  const heatSortText = (s, cols) => (s.k === 'team' ? '구단 이름 ' + (s.dir > 0 ? '가나다 순' : '가나다 거꾸로') : cols.find((c) => c[1] === s.k)[0] + ' ' + (s.dir < 0 ? '많은 순' : '적은 순'));
  /** 어긴 것만 보인다(지켰으면 아무것도 없음): 반드시 지킬 규칙 · 허용을 넘은 격차(얼마나 넘었는지) */
  function heatAlert(data, ob, ids) {
    const over = ids.filter((id) => !within(data, id, ob)).map((id) => { const g = GOALS[id]; return esc(shortName(id)) + ' ' + num(goalValue(data, id) - ob[g.tol], g.d) + g.unit + ' 넘음'; });
    const parts = (data.feasible ? [] : ['<b>지키지 못한 규칙 ' + num(data.hardCount || 0) + '건</b>']).concat(over.length ? ['<b>허용을 넘은 격차</b> — ' + over.join(' · ')] : []);
    return parts.length ? '<div class="pf-note warn pf-halert">' + parts.map((p) => '<div>! ' + p + '</div>').join('') + '</div>' : '';
  }
  /** 구단별 한눈에 표: 제목(누르면 정렬) → 격차 줄(늘 맨 위, 정렬과 상관없음) → 구단 줄. 숫자 옆에 열 안 비율 막대, 열마다 가장 많은 구단과 가장 적은 구단만 진하게 */
  function heatTable(data, ob, cols) {
    const names = Object.keys(data.teams), s = heatSortOf(cols);
    const rows = names.slice().sort((p, q) => (s.k === 'team' ? s.dir * p.localeCompare(q, 'ko') : s.dir * (data.teams[p][s.k] - data.teams[q][s.k])));
    const sc = {}; for (const [, k] of cols) { const a = vals(data, k), lo = Math.min(...a), hi = Math.max(...a); sc[k] = { lo, hi, x: (v) => (hi > lo ? 25 + (v - lo) / (hi - lo) * 75 : 100).toFixed(0) + '%' }; }
    const cell = (k, d, v) => { const c = sc[k], cls = v === c.hi && c.hi !== c.lo ? ' hi' : v === c.lo && c.hi !== c.lo ? ' lo' : '';
      return '<td class="c' + cls + '"><div><span class="n">' + num(v, d) + '</span><span class="b"><i style="width:' + c.x(v) + '"></i></span></div></td>'; };
    const th = (label, k) => { const on = s.k === k;
      return '<th' + (on ? ' class="on" aria-sort="' + (s.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '><button data-act="pf-hsort" data-v="' + k + '" title="이 기준으로 줄 세우기">' + label + '<i>' + (on ? (s.dir < 0 ? '▼' : '▲') : '↕') + '</i></button></th>'; };
    const gap = ([, k, d, id]) => { const v = sc[k].hi - sc[k].lo, tol = id ? ob[GOALS[id].tol] : null, over = id && !within(data, id, ob);
      return '<td' + (over ? ' class="over"' : '') + '><b>' + num(v, d) + '</b>' + (id ? '<small>허용 ' + num(tol) + '</small>' : '') + '</td>'; };
    return '<table class="pf-h"><colgroup><col class="tm">' + cols.map(() => '<col>').join('') + '</colgroup><thead><tr>' + th('구단', 'team') + cols.map((c) => th(c[0], c[1])).join('') + '</tr>' +
      '<tr class="gap"><td>격차</td>' + cols.map(gap).join('') + '</tr></thead><tbody>' +
      rows.map((t) => '<tr><td>' + esc(t) + '</td>' + cols.map(([, k, d]) => cell(k, d, data.teams[t][k])).join('') + '</tr>').join('') +
      '</tbody></table>' +
      '<div class="pf-leg"><span><i class="hi"></i>열에서 가장 많은 구단</span><span><i class="lo"></i>가장 적은 구단</span><span>격차 = 그 둘의 차이</span></div>';
  }
  function dashboard(data, ob) {
    const ids = ob.order.filter((id) => GOALS[id].tol);
    const cols = ids.map((id) => HEAT_COLS[id].concat(id)).concat([['주말 홈 시리즈', 'wk', 0], ['가장 긴 연속 원정', 'away', 0]]);
    const heatSec = '<div class="pf-sec pf-heat"><h3>구단별 한눈에</h3>' + heatAlert(data, ob, ids) +
      '<p class="pf-d">제목을 누르면 그 기준으로 줄을 세웁니다 · 지금 <b>' + heatSortText(heatSortOf(cols), cols) + '</b> · 열은 방침 순위대로</p>' + heatTable(data, ob, cols) + '</div>';
    // 왼쪽 위에 목표 셋을 같은 크기 칸으로 나란히(격차·허용), 누른 칸의 구단별 막대를 아래에(처음은 1순위). 셋을 위아래로 두면 홀수라 칸이 고르지 않았다(2026-11-05 대안 다)
    const cur = shownGoal(ids), gc = GOALS[cur];
    const tiles = '<div class="pf-gtiles">' + ids.map((id) => { const g = GOALS[id];
      return '<button class="pf-gtile' + (id === cur ? ' on' : '') + '" data-act="pf-goal" data-v="' + id + '"><span class="hd"><span class="pf-rk">' + rankOf(ob, id) + '순위</span>' + esc(shortName(id)) + tolTag(data, id, ob) + '</span><span class="v"><b>' + goalShow(data, id) + g.unit + '</b><span class="s">허용 ' + num(ob[g.tol]) + g.unit + '</span></span></button>'; }).join('') + '</div>';
    const goalPanel = '<div class="pf-sec pf-goal"><h3>목표별 격차</h3>' + tiles + '<div class="pf-gsub">' + gc.name + ' · 구단별</div>' + goalOne(data, ob, cur) + '</div>';
    return '<div class="pf-dash pf-dash3 pf-fill"><div class="pf-dl">' + goalPanel + '</div>' + heatSec + '</div>'; // 왼쪽 목표 셋 칸 + 고른 목표의 막대, 오른쪽 구단별 한눈에
  }
  /** 점검용 주소 demo=run27: 실행 없이 지금 달력을 결과로 삼아 현재 결과 분석 화면을 본다(저장 목록에는 넣지 않는다) */
  S.demos.run27 = function () {
    const st = app().state, ob = st.settings.objective || DEFAULT_OBJECTIVE, option = optionOf(ob);
    const res = { at: new Date().toISOString(), elapsedMs: 61000, why: '최대 실행 시간', objective: ob, sig: inputSig(st), calSig: calSig(st), engine: 'MOCK', no: 1, option, name: runName(1, option, ob) };
    const v = storeRun(res, app().derived().ex); res.vid = v ? v.id : null;
    app().store.commit('점검용 결과', (s) => { s.meta.result = res; }, { tags: ['meta'], undo: false });
  };
  /** 지금 연결이 아니라 그 결과를 낸 엔진으로 본다(서버에서 낸 버전을 서버 없이 불러와도 시험 엔진 결과가 아니다). 기록이 없는 옛 결과는 지금 연결로 */
  const byTestEngine = (res) => (res.engine ? res.engine !== 'REST' : !res.from && app().engineConfig.kind !== 'REST');
  S.steps[5] = {
    render() {
      if (S.seasonYear() === YEAR_VIEW) return '<div class="stepview no-band">' + render2025() + '</div>';
      const st = app().state, res = st.meta.result;
      if (isRunning()) return '<div class="stepview no-band"><div class="pf-page">' + runningNote() + '</div></div>';
      if (res && resultStale(st)) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>연전이 바뀌었습니다</h3><p class="pf-d">전에 낸 결과는 이 달력에서 쓸 수 없습니다. 처음부터 다시 실행하거나, 실행 결과 비교에서 저장한 버전을 불러오세요.</p><button class="btn primary" data-act="pf-stage" data-stage="2">운영 방침·실행으로' + icon('right') + '</button></div></div></div>';
      if (!res) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>아직 결과가 없습니다</h3><p class="pf-d">운영 방침을 정하고 실행하면 여기에 결과가 나옵니다.</p><button class="btn primary" data-act="pf-stage" data-stage="2">운영 방침·실행으로' + icon('right') + '</button></div></div></div>';
      const ex = app().derived().ex, data = dataOf(ex), ob = res.objective || objective();
      const editedNote2 = inputsEdited(st) ? '<div class="pf-note warn" style="margin:0">편성 조건을 고친 뒤로 아직 실행하지 않아 지키지 못한 규칙이 보일 수 있습니다. 실행하면 이 결과에서 이어서 풉니다. <button class="pf-link" data-act="pf-stage" data-stage="2">운영 방침·실행으로 ›</button></div>' : '';
      return '<div class="stepview no-band"><div class="pf-page">' + policyCheck(data, ob) +
        saveRow(res) +
        editedNote2 + dashboard(data, ob) + '</div></div>';
    }
  };
  /** 3 현재 결과 분석 맨 위 줄: 실행이 끝날 때 저장한 이름(바꿀 수 있음)과 옆에 작은 글 두 줄(실행 시각·걸린 시간·직접 정한 순서 / 남기는지). 줄 높이는 예전 저장 줄과 같다 */
  function saveRow(res) {
    const vid = res.vid || res.from, v = vid ? P.versions.get(YEAR_NEW, vid) : null;
    const test = byTestEngine(res) ? '<span class="pf-tag est" title="편성 서버에 연결되지 않아 브라우저 시험 엔진으로 냈습니다">시험 엔진으로 낸 결과</span>' : '';
    const go = '<button class="btn" data-act="go-step" data-step="3">일정 자세히 보기</button><button class="btn" data-act="go-step" data-step="4">구단별 공정성</button>';
    let head, meta, keep = '';
    if (v && !v.builtin) {
      head = '<span class="small muted">저장한 이름</span><input value="' + esc(v.name) + '" data-in="pf-name" data-id="' + esc(v.id) + '" aria-label="결과 이름">' + (v.kept ? '<span class="pf-tag blue">남김</span>' : '');
      meta = [whenText(v), v.elapsedMs ? '실행 ' + fmt.time(v.elapsedMs) : '', v.note];
      keep = v.kept ? '이름을 바꾼 결과라 지우지 않습니다' : '이름을 바꾸면 지우지 않고 남깁니다(그 밖은 최근 ' + AUTO_KEEP + '개만)';
    } else if (v) {
      head = '<b class="pf-nm">' + esc(v.name) + '</b><span class="small muted">기본 제공</span>';
      meta = [v.note];
    } else if (vid) {
      head = '<b class="pf-nm">' + esc(res.name || '') + '</b><span class="small muted">지운 결과</span>';
      meta = [whenText({ ranAt: res.at })];
    } else {
      head = (res.name ? '<b class="pf-nm">' + esc(res.name) + '</b>' : '') + '<span class="pf-tag over">저장하지 못함</span><button class="btn primary" data-act="pf-save">다시 저장</button>';
      meta = [whenText({ ranAt: res.at }), res.elapsedMs ? '실행 ' + fmt.time(res.elapsedMs) : ''];
      keep = '저장 공간이 모자랐습니다. 실행 결과 비교에서 안 쓰는 결과를 지우세요';
    }
    return '<div class="pf-sec pf-savesec"><div class="pf-save">' + test + head + '<span class="pf-meta">' + meta.filter(Boolean).map(esc).join(' · ') + (keep ? '<br>' + esc(keep) : '') + '</span><span class="grow"></span>' + go + '</div></div>';
  }
  const noRoom = () => S.toast('저장 공간이 모자라 저장하지 못했습니다. 안 쓰는 결과를 지우세요.', 'bad', 6000);
  // ───────── 실행마다 자동 저장 ─────────
  // 이름 「#번호_방침_횟수_거리_점수」: 번호는 네 자리, 2027 실행마다 1씩. 지운 뒤에도 다시 쓰지 않도록 목록과 따로 센다.
  // 허용 수준은 바꾼 것만이 아니라 늘 셋 다 적는다. 이름을 바꾸면(kept) 남길 결과로 보고 지우지 않는다. 나머지는 최근 AUTO_KEEP개만 둔다.
  const AUTO_KEEP = 8;
  const OPTION_LABEL = { balance: '이동격차', holiday: '주말공휴일' }; // 카드 이름이 바뀌어도 이름 규칙은 그대로. 그 밖은 직접정하기
  const noKey = (y) => S.KEY + 'runNo:' + y;
  /** 방침: 추천 카드 id 또는 'custom'(직접 정하기를 눌렀거나 추천 순서와 다르면) */
  function optionOf(ob) { const hit = ORDERS.find((o) => o.order.join() === ob.order.join()); return !P.customOrder && hit ? hit.id : 'custom'; }
  const runName = (no, option, ob) => '#' + String(no).padStart(4, '0') + '_' + (OPTION_LABEL[option] || '직접정하기') + '_' + Math.round(ob.moveGap) + '회_' + Math.round(ob.distanceGapKm) + 'km_' + Math.round(ob.holidayGap) + '점';
  function nextNo(y) { const used = P.versions.list(y).reduce((m, v) => Math.max(m, v.no | 0), 0); return Math.max(Number(S.ls.get(noKey(y))) || 0, used) + 1; }
  /** 이름을 바꾸지 않은 자동 저장 결과는 최근 AUTO_KEEP개만. 확정한 버전·이름을 바꾼 것·예전에 손으로 저장한 것은 그대로 */
  function pruneRuns(list, y) {
    const fin = P.final.id(y), auto = list.filter((v) => v.auto && !v.kept && v.id !== fin);
    const drop = new Set(auto.slice(0, Math.max(0, auto.length - AUTO_KEEP)));
    return list.filter((v) => !drop.has(v));
  }
  const orderText = (ob) => ob.order.map((i) => shortName(i)).join(' → ');
  /** 결과 기록(res) → 버전으로 저장. 못 쓰면 null */
  function storeRun(res, ex) {
    const st = app().state, data = dataOf(ex || app().derived().ex), ob = res.objective;
    const op = (st.events || []).find((e) => e.type === 'OPENING') || {};
    const rec = Object.assign({ id: 'v' + Date.now(), no: res.no, auto: true, option: res.option, name: res.name, year: YEAR_NEW, savedAt: res.at.slice(0, 10), ranAt: res.at, elapsedMs: res.elapsedMs || 0, objective: ob, note: res.option === 'custom' ? '순서: ' + orderText(ob) : '', engine: res.engine, pairs: op.pairs || null, inputs: inputsOf(st) }, data, {
      matches: st.matches.map((m) => ({ index: m.index, home: m.home, away: m.away, consecutive: m.consecutive })), plan: st.plan.map((x) => ({ match: x.match, calendar: x.calendar }))
    });
    return P.versions.put(YEAR_NEW, pruneRuns(P.versions.list(YEAR_NEW).concat([rec]), YEAR_NEW)) ? rec : null;
  }
  /** 방금 저장한 결과를 비교에 넣는다(예전 「버전으로 저장」과 같이) */
  function pickNew(v) { const base = P.versions.all(YEAR_NEW).find((x) => x.id !== v.id); P.cmp = base ? [base.id, v.id] : [v.id]; P.cmpPicked = false; }
  /** 이름 바꾸기: 바뀌었을 때만 남길 결과로. 빈 이름이면 그대로 */
  function renameVersion(y, id, name) {
    const list = P.versions.list(y), v = list.find((x) => x.id === id), n = String(name || '').trim();
    if (!v || !n || n === v.name) return false;
    v.name = n; v.kept = true;
    if (!P.versions.put(y, list)) { noRoom(); return false; }
    return true;
  }
  /** 「11월 3일 14:05」. 시각이 없는 예전 버전은 저장한 날만 */
  const whenText = (v) => { if (!v.ranAt) return v.savedAt || ''; const d = new Date(v.ranAt), p = (x) => String(x).padStart(2, '0'); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  Object.assign(P, { pruneRuns, nextRunNo: nextNo, runName, AUTO_KEEP });
  /** 버전의 값과 일정을 프로젝트에 넣는다. 일정은 그 버전을 만든 값(달력·개막전·어린이날…)에서만 맞으므로 값도 그때로 돌린다. 값을 담지 않은 버전은 처음 제공한 2027 값으로 */
  function applyVersion(s, v) {
    const b = JSON.parse(JSON.stringify(v.inputs || preset27())), solver = s.settings.solver;
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
  }
  function loadVersion(v) {
    if (S.locked && S.locked()) return;
    const base = v.inputs || preset27(), before = app().state;
    const changed = inputSig(before) !== inputSig(base);
    app().commit('버전 불러오기: ' + v.name, (s) => {
      applyVersion(s, v);
      s.meta.result = { at: new Date().toISOString(), elapsedMs: v.elapsedMs, why: '저장한 버전', objective: v.objective, from: v.id, engine: v.engine, sig: inputSig(s), calSig: calSig(s) };
    }, ['teams', 'calendar', 'matches', 'plan', 'games', 'settings', 'events', 'meta']);
    S.toast('「' + v.name + '」을(를) 불러왔습니다.' + (changed ? ' 편성 조건도 그 버전을 만들 때로 돌아갔습니다.' : ''), 'ok', changed ? 5000 : undefined);
    S.go({ step: 5, sel: null });
  }

  // ───────── 기존 ③·④ 화면 문구 ─────────
  const origStep1Render = S.steps[1].render;
  S.steps[1].render = function () {
    return origStep1Render().replace(/③에서/g, '「일정 자세히 보기」에서')
      // 모든 표 보기의 가져오기 띠: 실제로 동작하지 않는 단추를 뺀다. 달력의 엑셀 서식은 실제로 동작하므로 그대로 둔다
      .replace(/<span class="band-title">[\s\S]*?<\/span>\s*<button class="btn primary sm" data-act="import-xlsx"[\s\S]*?<button class="btn sm" data-act="export" data-kind="xlsx"[\s\S]*?<\/button><span class="sep"[^>]*><\/span>/, '');
  };
  // 예전 화면의 번호와 평균 ± 범위는 새 흐름의 말과 다르다. 2027에서는 번호를 빼고, 평균 ± 범위는 「참고 범위」로 부른다(엔진이 맞추는 기준은 허용 차이)
  const origStep3 = S.steps[3].render;
  S.steps[3].render = function () { return origStep3().replace(/④ 공정성·배포로 넘어가세요\.?/g, '「구단별 공정성」에서 구단 사이 균형을 보세요.'); };
  const origStep4 = S.steps[4].render;
  S.steps[4].render = function () {
    if (S.ui.qv === 'export') S.ui.qv = 'metrics'; // 내보내기 화면은 대부분 시안이라 뺀다. 일정표 CSV는 데이터 메뉴에 있다
    const html = origStep4().replace(/③ 달력에서/g, '달력에서').replace(/허용 범위/g, '참고 범위').replace(/<button class="li[^"]*" data-act="q-view" data-qv="export"[\s\S]*?<\/button>/, '');
    return '<div class="pf-note" style="margin:8px 12px 0">이 화면의 범위는 리그 평균을 기준으로 한 참고값입니다. 엔진이 맞추는 기준은 「현재 결과 분석」의 허용 수준입니다.</div>' + html;
  };

  // ───────── 4 실행 결과 비교 ─────────
  /** 순위대로 비교: 허용 안이면 같다고 보고 다음 순위로. 처음으로 갈리는 평가 기준과 이긴 쪽 */
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
      if (all.length < 1) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>저장한 버전이 없습니다</h3><p class="pf-d">실행할 때마다 결과가 여기에 저절로 쌓입니다.</p></div></div></div>';
      P.cmp = P.cmp.filter((id) => all.some((v) => v.id === id));
      if (!P.cmpPicked) for (const v of all) if (P.cmp.length < 2 && !P.cmp.includes(v.id)) P.cmp.push(v.id);
      const ver = (v) => { const on = P.cmp.includes(v.id), isFinal = y === YEAR_NEW && P.final.id(y) === v.id;
        return '<div class="pf-ver' + (on ? ' on' : '') + '"><input type="checkbox" data-in="pf-cmp" data-id="' + esc(v.id) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(v.name) + ' 비교에 넣기"><div><b>' + esc(v.name).replace(/_/g, '_<wbr>') + '</b>' + (isFinal ? ' <span class="pf-tag ok">확정</span>' : '') + (v.feasible === false ? ' <span class="pf-tag over">규칙 어김</span>' : '') + (v.engine && v.engine !== 'REST' ? ' <span class="pf-tag est">시험 엔진</span>' : '') + (v.kept ? ' <span class="pf-tag blue">남김</span>' : '') + (v.note ? '<small>' + esc(v.note) + '</small>' : '') + '<div class="w">' + esc(whenText(v)) + (v.elapsedMs ? ' · 실행 ' + fmt.time(v.elapsedMs) : '') + (v.attempts ? ' · 시도 ' + v.attempts + '번' : '') + (v.builtin ? ' · 기본 제공' : '') + '</div>' +
          '<div class="small" style="margin-top:4px">' + Object.keys(GOALS).map((id) => shortName(id) + ' <b style="font-size:12px">' + goalShow(v, id) + GOALS[id].unit + '</b>').join(' · ') + '</div></div>' +
          '<div class="acts">' + (isFinal ? '<button class="btn sm" data-act="pf-final-off">확정 취소</button>' : y === YEAR_NEW && canFinal(v) ? '<button class="btn sm primary" data-act="pf-final" data-id="' + esc(v.id) + '">확정</button>' : '') + (y === YEAR_NEW ? '<button class="btn sm" data-act="pf-load" data-id="' + esc(v.id) + '">불러오기</button>' : '') + '<button class="btn sm" data-act="pf-export" data-id="' + esc(v.id) + '">내려받기</button>' + (v.builtin ? '' : '<button class="btn sm" data-act="pf-rename" data-id="' + esc(v.id) + '">이름 바꾸기</button>' + (isFinal ? '' : '<button class="btn sm" data-act="pf-del" data-id="' + esc(v.id) + '">지우기</button>')) + '</div></div>'; };
      const list = '<div class="pf-sec pf-vers"><h3>저장한 버전<span class="r"><b>' + P.cmp.length + '개</b> 선택</span></h3><p class="pf-d">두 개를 골라 비교하고, 쓸 일정을 확정합니다. 새로 실행한 것부터 보이고, 이름을 바꾸지 않은 결과는 최근 ' + AUTO_KEEP + '개만 남습니다.</p>' + all.filter((v) => v.builtin).concat(all.filter((v) => !v.builtin).reverse()).map(ver).join('') + // 기본 제공은 맨 위, 나머지는 새것부터
        '<div style="margin-top:10px;display:flex;gap:6px;align-items:center"><button class="btn sm" data-act="pf-import">' + icon('upload') + '받은 버전 올리기</button><span class="xs muted">저장한 버전은 이 브라우저에 있습니다(나중에 온라인으로 옮김).</span></div></div>';
      const [a, b] = P.cmp.map((id) => all.find((v) => v.id === id));
      if (!b) return '<div class="stepview no-band"><div class="pf-page">' + list + '<div class="pf-note">' + (all.length < 2 ? '비교하려면 버전이 두 개 있어야 합니다.' : '비교할 버전을 두 개 고르세요.') + '</div></div></div>';
      const ob = a.objective;
      const sameOb = JSON.stringify(a.objective) === JSON.stringify(b.objective);
      // 순위가 같으면 줄 이름에 한 번, 다르면 버전마다 보인다
      const sameOrder = a.objective.order.join() === b.objective.order.join();
      const rank = (v, id) => '<span class="pf-rk">' + (v.objective.order.indexOf(id) + 1) + '순위</span>';
      const cell = (me, other, id) => { const g = GOALS[id], v = goalValue(me, id), w = goalValue(other, id), obm = me.objective; const inT = within(me, id, obm); return '<td class="' + (v < w ? 'good' : '') + '">' + (sameOrder ? '' : rank(me, id) + ' ') + goalShow(me, id) + g.unit + (g.tol ? ' <span class="pf-tag ' + (inT ? 'ok' : 'over') + '">' + (inT ? '안' : '넘음') + '</span>' : '') + '</td>'; };
      const d = decide(a, b, ob);
      const aBad = a.feasible === false, bBad = b.feasible === false;
      // 반드시 지킬 규칙을 어긴 일정은 숫자가 좋아도 쓸 수 없으므로 순위로 따지지 않는다
      const verdict = aBad && bBad ? '두 버전 모두 반드시 지킬 규칙을 지키지 못해 순위대로 따지지 않고 숫자만 나란히 둡니다.' : aBad || bBad ? '<b>「' + esc((aBad ? a : b).name) + '」은 반드시 지킬 규칙을 지키지 못해 쓸 수 없습니다.</b> 순위대로 따지지 않고 숫자만 나란히 둡니다.' : !sameOb ? '두 버전의 순서·허용 수준이 달라 순위대로 따지지 않고 숫자만 나란히 둡니다.' : d ? '<b>순위대로 따지면</b> — ' + (ob.order.indexOf(d.id) ? '앞 순위는 두 버전 모두 허용 수준 안이라 같다고 봅니다. ' : '') + esc(GOALS[d.id].name) + '에서 <b>이번 실행에서는 「' + esc(d.winner.name) + '」이 ' + num(d.diff, GOALS[d.id].d) + GOALS[d.id].unit + ' ' + (GOALS[d.id].tol ? '작았습니다' : '짧았습니다') + '</b>.' : '<b>순위대로 따지면</b> — 모든 평가 기준이 같습니다.';
      const tab = P.cmpTab, tg = GOALS[tab];
      const tolText = (g) => num(a.objective[g.tol]) + g.unit + (a.objective[g.tol] === b.objective[g.tol] ? '' : ' / ' + num(b.objective[g.tol]) + g.unit); // 다르면 둘 다
      const ruleCell = (v) => '<td>' + (v.feasible === false ? '<span class="pf-tag over">어김</span>' : '<span class="pf-tag ok">모두 지킴</span>') + '</td>';
      return '<div class="stepview no-band"><div class="pf-page"><div class="pf-cols pf-fill" style="grid-template-columns:400px minmax(0,1fr)">' + list +
        '<div style="display:flex;flex-direction:column;gap:12px;min-width:0"><div class="pf-sec"><h3>평가 기준마다 비교</h3><p class="pf-d">' + (sameOrder ? '순위 순' : '두 버전의 순위가 다릅니다') + ' · 초록 = 더 작음</p><table class="pf-t"><thead><tr><th>평가 기준</th><th>' + esc(a.name) + '</th><th>' + esc(b.name) + '</th></tr></thead><tbody><tr><td><b>반드시 지킬 규칙</b></td>' + ruleCell(a) + ruleCell(b) + '</tr>' +
        ob.order.map((id) => '<tr><td>' + (sameOrder ? rank(a, id) + ' ' : '') + '<b>' + GOALS[id].name + '</b> <span class="muted small">' + (GOALS[id].tol ? '격차 · 허용 ' + tolText(GOALS[id]) : '10구단 합') + '</span></td>' + cell(a, b, id) + cell(b, a, id) + '</tr>').join('') +
        '</tbody></table><div class="pf-note blue">' + verdict + '</div><div class="small muted" style="margin-top:6px">같은 조건으로 다시 실행해도 전체 이동 거리가 수천 km씩 달라질 수 있습니다. 이 정도 차이는 두 버전을 각각 다시 실행해 확인하세요.</div></div>' +
        '<div class="pf-sec"><div class="pf-tabs">' + ['moves', 'distance', 'holiday'].map((id) => '<button class="' + (tab === id ? 'on' : '') + '" data-act="pf-cmp-tab" data-v="' + id + '">' + shortName(id) + '</button>').join('') + '</div><h3>구단별 ' + shortName(tab) + '</h3><p class="pf-d">회색 ' + esc(b.name) + ' · 파랑 ' + esc(a.name) + ' · 초록 띠 = 파랑의 가장 적은 구단 + 허용 수준</p>' + bars(a, tg.metric, ob[tg.tol], tg.d, b) + '</div></div></div></div></div>';
    }
  };

  // ───────── 확정 일정 보기 ─────────
  S.steps[7] = {
    render() {
      const v = P.final.version(YEAR_NEW);
      if (!v) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>' + (P.builtinFailed ? '확정한 일정을 읽지 못했습니다' : '확정한 일정을 불러오는 중입니다') + '</h3></div></div></div>';
      return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec" style="padding:8px 14px"><div class="pf-save"><b>' + esc(v.name) + '</b><span class="pf-tag ok">확정</span><span class="small muted" style="flex:1">' + esc(v.note || '') + '</span><button class="btn" data-act="pf-export" data-id="' + esc(v.id) + '">내려받기</button></div></div>' + dashboard(v, v.objective) + '</div></div>';
    }
  };

  // ───────── 단계 띠 · 하단 ─────────
  const STAGES = ['편성 조건 입력·검증', '운영 방침·실행', '현재 결과 분석', '실행 결과 비교'];
  const stageOf = (step) => ({ 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4 })[step] || 1;
  P.stepper = function () {
    const st = app().state, cur = stageOf(S.ui.step), fs = S.flowStatus(), res = freshResult(st), stale = resultStale(st), edited = inputsEdited(st), n = P.versions.all(S.seasonYear()).length;
    const running = isRunning();
    const start = S.ui.step === 1 && (G.mode === 'year' || G.mode === 'resume');
    const sub = {
      1: fs.allDone ? '4단계 검토함' : start ? '' : (G.mode === 'flow' ? G.fs + ' / 4 ' + fs.steps[G.fs - 1].name + ' · 검토 중' : fs.stop + ' / 4에서 멈춤'),
      2: running ? '실행 중' : stale ? '연전이 바뀜 · 다시 실행' : edited ? '편성 조건이 바뀜 · 이어서 실행' : res ? '실행 끝 · ' + fmt.time(res.elapsedMs || 0) : fs.allDone ? '운영 방침 정하기' : '편성 조건 검토를 마치면',
      3: res ? (S.ui.step === 3 ? '일정 자세히' : S.ui.step === 4 ? '구단별 공정성' : '한 장으로 보기') : '실행 뒤',
      4: n ? '저장한 버전 ' + n + '개' : '저장한 버전 없음'
    };
    const done = { 1: fs.allDone, 2: !!res, 3: false, 4: false };
    return STAGES.map((name, i) => { const k = i + 1, active = !start && cur === k;
      return '<button class="step' + (active ? ' active' : '') + '" data-act="pf-stage" data-stage="' + k + '"' + (active ? ' aria-current="step"' : '') + '><span class="step-no">' + k + '</span><span class="step-name">' + name + '</span>' + (done[k] && !active ? S.stat('ok', '완료') : '') + '<span class="step-sum">' + esc(sub[k]) + '</span></button>'; }).join('');
  };
  P.footer = function () {
    const u = S.ui, y = S.seasonYear();
    if (u.step === 5 && y === YEAR_VIEW) return '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button><span class="hint"><b>2025 계획 보기</b> — 같은 조건에서 KBO 실제 일정과 이 엔진의 일정을 비교합니다</span>' + (!P.builtin['2025-best'] ? '' : P.view25 === 'dash' ? '<button class="btn primary" data-act="pf-25" data-v="compare">KBO와 비교로 돌아가기</button>' : '<button class="btn primary" data-act="pf-25" data-v="dash">평가 기준별 자세히 보기' + icon('right') + '</button>');
    if (u.step === 1) {
      if (G.mode === 'year' || G.mode === 'resume') return '<span class="hint"><b>처음 화면</b> — ' + esc(S.homeCopy.footer) + '</span>';
      if (G.mode === 'all') return '<button class="btn" data-act="g1-cal">' + icon('left') + '단계별로 돌아가기</button><span class="hint"><b>모든 표 보기</b> — 표에서 직접 고칩니다. 고치면 바로 저장됩니다</span><span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>';
      if (P.calEdit) return '<span class="hint"><b>달력에서 수정</b> — 고치면 바로 저장됩니다</span><span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span><button class="btn primary" data-act="pf-cal-done">검토로 돌아가기' + icon('right') + '</button>';
      const n = G.fs, steps = S.FLOW_STEPS, st = app().state;
      const prev = n > 1 ? '<button class="btn" data-act="pf-go" data-fs="' + (n - 1) + '">' + icon('left') + '이전: ' + (n - 1) + ' ' + esc(steps[n - 2].name) + '</button>' : '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button>';
      const canNext = n === 4 ? reviewDone() : S.flowStatus().done[n - 1];
      const next = n < 4 ? '<button class="btn primary" data-act="pf-go" data-fs="' + (n + 1) + '"' + (canNext ? '' : ' disabled title="이 단계의 편성 조건을 모두 확인해 주세요"') + '>다음: ' + (n + 1) + ' ' + esc(steps[n].name) + icon('right') + '</button>'
        : '<button class="btn primary" data-act="cal-next"' + (canNext ? '' : ' disabled title="앞 단계를 모두 확인해 주세요"') + '>다음: 운영 방침·실행' + icon('right') + '</button>';
      const hint = { 1: '2025 구단 정보에 LG·두산 구장만 고쳐 두었습니다. 그 밖에 바뀐 것이 있는지 확인합니다', 2: '추정값을 하나씩 확인합니다', 3: '개막전 대진과 어린이날 홈 구단을 확인합니다', 4: S.flowStatus().allDone ? '모든 편성 조건을 검토했습니다. 다음은 운영 방침입니다' : '앞 단계의 편성 조건을 먼저 확인해 주세요' }[n];
      return prev + '<span class="hint"><b>' + n + ' / 4 ' + esc(steps[n - 1].name) + '</b> — ' + hint + '</span><span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' + next;
    }
    if (u.step === 2) { const running = isRunning(), ok = app().preflight().ok; return (running ? '' : '<button class="btn" data-act="pf-stage" data-stage="1">' + icon('left') + '이전: 편성 조건 입력·검증</button>') + '<span class="hint pf-policy">' + (running ? '<b>실행 중</b> — ' : '') + policyText(objective()) + (!running && inputsEdited(app().state) ? ' · 지금 결과에서 이어서' : '') + '</span>' + (running ? '<button class="btn primary" data-act="run-stop">멈추고 이 결과 쓰기</button>' : timeBox() + '<button class="btn primary" data-act="pf-run"' + (ok ? '' : ' disabled title="사전 점검에 진행 불가가 있습니다"') + '>' + icon('play') + '이 방침으로 실행</button>'); } // 실행 시간은 단추 바로 옆, 「이어서」는 편성 조건을 고친 뒤에만(사용자 결정 2026-11-04)
    if (u.step === 5) return '<button class="btn" data-act="pf-stage" data-stage="2">' + icon('left') + '운영 방침 바꿔 다시 실행</button><span class="hint"><b>현재 결과 분석</b> — 평가 기준 4개와 구단별 표를 한 장에 봅니다</span><button class="btn primary" data-act="pf-stage" data-stage="4">실행 결과 비교' + icon('right') + '</button>';
    if (u.step === 7) return '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button><span class="hint"><b>2027 확정 일정</b> — 다른 버전으로 바꾸거나 확정을 취소하려면 실행 결과 비교로 갑니다</span><button class="btn" data-act="pf-stage" data-stage="4">실행 결과 비교' + icon('right') + '</button>';
    if (u.step === 6) return '<button class="btn" data-act="pf-stage" data-stage="3">' + icon('left') + '현재 결과 분석</button><span class="hint"><b>실행 결과 비교</b> — 저장한 버전 두 개를 골라 평가 기준마다 비교합니다</span>';
    if (u.step === 3 || u.step === 4) return '<button class="btn" data-act="go-step" data-step="5">' + icon('left') + '현재 결과 분석</button><span class="hint"><b>' + (u.step === 3 ? '일정 자세히 보기' : '구단별 공정성') + '</b></span>';
    return null;
  };
  // 창이 노트북(1440×790)보다 크면 본문을 통째로 키운다(최대 1.25배, 높이 830마다 1배). 노트북 배치가 그대로 커져 줄 사이가 벌어지는 대신 글자·막대가 커진다
  const fitZoom = () => { const z = Math.max(1, Math.min(1.25, window.innerWidth / 1440, window.innerHeight / 830));
    document.documentElement.style.setProperty('--pf-zoom', z.toFixed(3));
    document.documentElement.classList.toggle('pf-tall', window.innerHeight / z >= 960); }; // 키운 뒤 높이가 960 이상이면 운영 방침 실행 칸의 보조 줄을 펼친다(plan-flow.css html.pf-tall)
  fitZoom();
  window.addEventListener('resize', fitZoom);
  /** body에 표시 클래스(2025 보기 전용이면 단계 띠·상태를 숨김) */
  P.beforeRender = function () {
    document.body.classList.add('pf');
    // 주소를 직접 쳐도 흐름 밖 화면으로 가지 않게: 2025는 비교 화면만, 다른 해는 처음 화면으로
    const y = S.seasonYear(), onHome = S.ui.step === 1 && (G.mode === 'year' || G.mode === 'resume');
    if (y === YEAR_NEW && S.ui.step === 7 && !P.final.id(y)) { S.ui.step = 1; G.mode = 'year'; } // 확정이 없으면 볼 일정도 없다
    if (y === YEAR_NEW && S.ui.step === 1 && !S.ui.ops && G.mode === 'flow' && !P.calEdit && S.flowLocked(G.fs)) G.fs = S.flowStatus().stop; // 주소로도 앞 단계를 건너뛰지 못한다
    if (y === YEAR_NEW && S.ui.step === 2 && !isRunning() && !reviewDone()) { S.ui.step = 1; G.mode = 'flow'; G.fs = S.flowStatus().stop; }
    if (y === YEAR_NEW && !isRunning() && resultStale(app().state)) S.ui.modal = 'pfCalChange'; // 어느 화면에서 바꿨든 여기서 묻는다
    if (y !== YEAR_NEW && !onHome && !isRunning()) {
      S.ui.ops = null;
      if (y === YEAR_VIEW) S.ui.step = 5;
      else { S.ui.step = 1; G.mode = 'year'; }
    }
    const home = S.ui.step === 1 && !S.ui.ops && (G.mode === 'year' || G.mode === 'resume');
    document.body.classList.toggle('pf-home', home);
    document.body.classList.toggle('pf-nores', !freshResult(app().state)); // 실행 전에는 규칙 위반 표시를 띄우지 않는다
    document.body.classList.toggle('pf-ro', home || (S.seasonYear() === YEAR_VIEW && S.ui.step === 5) || (S.seasonYear() === YEAR_NEW && S.ui.step === 7));
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
    'pf-open-final': () => {
      if (S.locked && S.locked()) return;
      open2027();
      S.go({ step: 7, ops: null, modal: null, drawer: null });
    },
    'pf-final': (el) => {
      const v = P.versions.get(YEAR_NEW, el.dataset.id), cur = P.final.version(YEAR_NEW);
      if (!v || !canFinal(v)) return;
      if (!window.confirm((cur ? '지금 확정한 「' + cur.name + '」 대신 ' : '') + '「' + v.name + '」을(를) 2027 일정으로 확정할까요? 처음 화면의 결과 확인에 나옵니다.')) return;
      if (!P.final.set(YEAR_NEW, v.id)) { noRoom(); return; }
      S.toast('「' + v.name + '」을(를) 확정했습니다.', 'ok');
      S.render();
    },
    'pf-final-off': () => {
      const cur = P.final.version(YEAR_NEW);
      if (!window.confirm('「' + (cur ? cur.name : '') + '」 확정을 취소할까요? 결과 확인에서 빠집니다. 버전은 그대로 남습니다.')) return;
      P.final.clear(YEAR_NEW);
      S.toast('확정을 취소했습니다.', 'info');
      S.render();
    },
    'pf-stage': (el) => {
      const k = +el.dataset.stage;
      if (S.seasonYear() !== YEAR_NEW && !isRunning()) open2027();
      if (k === 1) { const fs = S.flowStatus(); if (S.ui.step === 1 && G.mode === 'flow') return; go1(fs.allDone ? 4 : fs.stop); return; }
      if (k === 2 && !isRunning() && !reviewDone()) { S.toast('앞 단계의 편성 조건을 모두 확인해 주세요.', 'warn'); go1(S.flowStatus().stop); return; }
      S.go({ step: { 2: 2, 3: 5, 4: 6 }[k], ops: null, sel: null, edit: null });
    },
    'g1-cal': () => { const fs = S.flowStatus(); go1(fs.allDone ? 4 : fs.stop); }, // 예전처럼 「어디까지 했는지」가 아니라 검토 단계로
    'pf-go': (el) => {
      const n = +el.dataset.fs;
      if (S.flowLocked(n)) { S.toast(G.fs === 1 && !(app().state.meta.flow || {}).teams ? '「바뀐 정보가 있나요?」에 먼저 답해 주세요.' : '이 단계의 편성 조건을 모두 확인해 주세요.', 'warn'); return; }
      go1(n);
    },
    'pf-ok': (el) => confirmKey(el.dataset.k),
    'pf-cal': (el) => {
      const to = el.dataset.to, st = app().state, C = S.cal;
      if (INLINE[to] && G.fs === 2) { P.inline = P.inline === to ? null : to; if (to !== 'rules') { C.edit = { initialEnd: 'initialEnd', allStar: 'allstar', rest: 'rest' }[to] || null; C.pickOpen = to === 'opening'; } S.render(); return; } // 2단계: 줄 안에서 펼치기(다시 누르면 접기)
      if (to === 'rules') { S.flowUI.edit = 'rules'; go1(4); return; } // 시리즈 규칙은 4 확인에서 고친다
      const ev = (t) => (st.events || []).find((e) => e.type === t);
      C.edit = { initialEnd: 'initialEnd', allStar: 'allstar', rest: 'rest' }[to] || null;
      C.pickOpen = to === 'opening';
      const e = to === 'openingHome' ? ev('OPENING') : to === 'childrenHome' ? ev('CHILDREN') : null;
      if (e) C.day = Dates.dayNum(e.date);
      P.calEdit = true;
      S.render();
    },
    'pf-cal-done': () => { P.calEdit = false; P.inline = null; S.cal.edit = null; S.cal.pickOpen = false; S.render(); },
    'pf-cal-live': () => { P.calLive = !P.calLive; if (!P.calLive) S.cal.slotAt = null; S.render(); },
    // 3단계 아래 달력에서 날을 누르면 그 날을 고른 수정 화면으로
    'pf-cal-day': (el) => { S.cal.day = +el.dataset.d; S.cal.edit = null; S.cal.pickOpen = false; P.calEdit = true; S.render(); },
    'pf-basis': () => S.go({ modal: 'pfBasis' }),
    'pf-basis-children': () => S.go({ modal: 'pfBasisChildren' }),
    'pf-basis-homes': () => S.go({ modal: 'pfBasisHomes' }),
    'pf-cal-undo': () => { S.ui.modal = null; app().undo(); S.render(); },
    'pf-cal-clear': () => {
      S.ui.modal = null;
      app().store.commit('연전이 바뀌어 결과 지움', (st) => { delete st.meta.result; }, { tags: ['meta'], undo: false });
      S.toast('결과를 지웠습니다. 편성 조건을 확인한 뒤 처음부터 실행합니다.', 'info', 5000);
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
    'pf-explain': () => { S.go({ drawer: S.ui.drawer === 'explain' ? null : 'explain' }); },
    'pf-tour-ok': () => { S.ls.set(tourKey(G.fs), '1'); S.render(); },
    'pf-tour-again': () => { for (const n of [1, 2, 3, 4]) S.ls.del(tourKey(n)); S.render(); },
    'pf-order': (el) => { const o = ORDERS.find((x) => x.id === el.dataset.id); if (!o) return; P.customOrder = false; app().updateSettings({ objective: Object.assign({}, objective(), { order: o.order.slice() }) }, '평가 기준 순서: ' + o.name); },
    'pf-order-custom': (el, e) => { if (e && e.target.closest('[data-act="pf-move"]')) return; P.customOrder = true; S.render(); },
    'pf-relevel': () => { const jump = () => { const el = document.getElementById('pf-levels'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }; S.afterRender(jump); S.actions['pf-stage']({ dataset: { stage: '2' } }); setTimeout(jump, 50); }, // 그리고 난 뒤 허용 수준 구역으로(뒤따르는 다시 그리기가 있어도 한 번 더)
    'pf-move': (el, e) => {
      if (e) e.stopPropagation();
      const k = +el.dataset.k, d = +el.dataset.d, order = objective().order.slice(), t = order[k];
      if (k + d < 0 || k + d > 3 || order[k] === LAST || (order[3] === LAST && order[k + d] === LAST)) return; // 전체 이동 거리는 늘 마지막
      order[k] = order[k + d]; order[k + d] = t;
      P.customOrder = true;
      app().updateSettings({ objective: Object.assign({}, objective(), { order }) }, '평가 기준 순서 바꾸기');
    },
    'pf-time-step': (el) => { P.timeSec = Math.min(TIME_MAX, Math.max(TIME_MIN, P.timeSec / 60 + +el.dataset.d)) * 60; S.render(); },
    'pf-run': () => {
      const fs = S.flowStatus();
      if (!fs.allDone) { S.toast('편성 조건 입력·검증을 먼저 마쳐 주세요.', 'warn'); go1(fs.stop); return; }
      if (!app().state.settings.objective) app().updateSettings({ objective: Object.assign({}, DEFAULT_OBJECTIVE) }, '운영 방침 기본값');
      if (!S.seriesOkOf(app().state)) { S.calNext(); if (!S.seriesOkOf(app().state)) return; }
      const keep = inputsEdited(app().state); // 값을 고쳤으면 전 결과에서 이어서, 운영 방침만 바꿨거나 결과가 없으면 처음부터 — 사용자 결정 2026-11-01
      app().updateSolverSettings({ timeLimitSec: P.timeSec, unimprovedSec: Math.round(P.timeSec / 2), init: keep ? 'KEEP' : 'SCRATCH' });
      P.runOption = optionOf(objective()); // 이름에 쓸 방침은 실행을 누른 때의 것
      S.startRun();
      // 첫 결과가 오면 전 결과 표시를 지운다(도중에 새로고침해도 섞인 일정을 전 결과로 보이지 않게)
      if (S.run && app().run) { let once = false; app().run.handle.on('best', () => { if (once) return; once = true; if (app().state.meta.result) app().store.commit('전 결과 표시 지우기', (st) => { delete st.meta.result; }, { tags: ['meta'], undo: false }); }); }
    },
    'pf-save': () => { // 자동 저장이 저장 공간 때문에 실패했을 때 같은 번호로 다시
      const r0 = app().state.meta.result;
      if (!r0 || r0.vid || r0.from) return;
      const res = Object.assign({}, r0);
      if (!res.no) { const ob = res.objective || objective(); res.objective = ob; res.no = nextNo(YEAR_NEW); res.option = optionOf(ob); res.name = runName(res.no, res.option, ob); S.ls.set(noKey(YEAR_NEW), String(res.no)); } // 번호가 없는 예전 결과
      const v = storeRun(res);
      if (!v) { noRoom(); return; }
      app().store.commit('실행 결과 저장', (s) => { s.meta.result = Object.assign(res, { vid: v.id }); }, { tags: ['meta'], undo: false });
      pickNew(v);
      S.toast('「' + v.name + '」(으)로 저장했습니다.', 'ok');
      S.render();
    },
    'pf-25': (el) => { P.view25 = el.dataset.v; S.render(); },
    'pf-cmp-tab': (el) => { P.cmpTab = el.dataset.v; S.render(); },
    'pf-goal': (el) => { P.dashGoal = el.dataset.v; S.render(); },
    'pf-hsort': (el) => { // 같은 제목을 다시 누르면 거꾸로. 처음 누르면 숫자는 많은 순, 구단은 가나다 순
      const k = el.dataset.v, th = el.closest('th'), now = th.getAttribute('aria-sort'); // 지금 기준인 열에만 aria-sort가 있다
      P.heatSort = { k, dir: now ? (now === 'ascending' ? -1 : 1) : (k === 'team' ? 1 : -1) }; S.render();
    },
    'pf-load': (el) => { const v = P.versions.get(S.seasonYear(), el.dataset.id); if (v && S.seasonYear() === YEAR_NEW) loadVersion(v); },
    'pf-rename': (el) => {
      const y = S.seasonYear(), v = P.versions.list(y).find((x) => x.id === el.dataset.id);
      if (!v) return;
      const n = window.prompt('새 이름', v.name);
      if (renameVersion(y, v.id, n)) S.render();
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
          const y = S.seasonYear(), st = app().state, err = P.checkVersion(v, y, st.teams.map((x) => x.name));
          if (err) { S.toast('올리지 못했습니다 — ' + err, 'bad', 6000); return; }
          const differ = P.rescoreVersion(v);
          const list = P.versions.list(y);
          v.id = 'v' + Date.now(); v.year = y; v.name = String(v.name || '받은 버전').trim() || '받은 버전'; delete v.builtin; delete v.auto; delete v.no; delete v.kept; list.push(v); // 받은 버전은 번호를 세지 않고 지우지도 않는다
          if (!P.versions.put(y, list)) { noRoom(); return; }
          S.toast('「' + v.name + '」을(를) 올렸습니다.' + (differ ? ' 파일에 적힌 숫자와 달라 일정으로 다시 계산한 숫자를 보여 줍니다.' : ''), differ ? 'warn' : 'ok', differ ? 6000 : undefined); S.render();
        }).catch(() => S.toast('올리지 못했습니다 — 파일을 읽을 수 없습니다.', 'bad', 6000));
      };
      inp.click();
    },
    'cal-next': (el) => {
      const fs = S.flowStatus();
      if (!fs.done.slice(0, 3).every(Boolean)) { S.toast('앞 단계의 편성 조건을 모두 확인해 주세요.', 'warn'); go1(fs.stop); return; }
      origCalNext(el);
    }
  });
  const origSame = S.actions['fl-teams-same'];
  S.actions['fl-teams-same'] = (el) => { origSame(el); P.calEdit = false; };
  S.inputs['pf-gap'] = (el) => {
    const k = el.dataset.k, t = String(el.value).replace(/,/g, '').trim(), v = Math.round(Number(t)); // 화면이 정수로 보이므로 정수로 저장
    if (!t || !Number.isFinite(v) || v < 0) { el.classList.add('err'); S.toast('0 이상인 숫자를 적어 주세요.', 'bad'); return; }
    if (objective()[k] === v) return;
    app().updateSettings({ objective: Object.assign({}, objective(), { [k]: v }) }, '허용 수준 바꾸기');
  };
  S.actions['pf-gap-step'] = (el) => {
    const k = el.dataset.k, v = Math.max(0, objective()[k] + +el.dataset.d);
    if (v === objective()[k]) return;
    app().updateSettings({ objective: Object.assign({}, objective(), { [k]: v }) }, '허용 수준 바꾸기');
  };
  S.inputs['pf-time'] = (el) => {
    const v = Number(String(el.value).trim());
    if (!Number.isInteger(v) || v < TIME_MIN || v > TIME_MAX) { el.classList.add('err'); S.toast(TIME_MIN + '~' + TIME_MAX + '분 사이의 정수를 적어 주세요.', 'bad'); return; }
    P.timeSec = v * 60; S.render();
  };
  S.inputs['pf-name'] = (el) => { if (!String(el.value).trim()) { S.render(); return; } if (renameVersion(YEAR_NEW, el.dataset.id, el.value)) { S.toast('이름을 바꿨습니다. 이 결과는 지우지 않고 남깁니다.', 'ok'); S.render(); } };
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
  S.menus.data = function () {
    return origMenu().replace('파일로 내려받기(.json)', '파일로 내려받기').replace('파일 올리기(.json)…', '파일 올리기…').replace('시즌 연도 고르기 · 처음부터 다시…', '처음 화면으로')
      .replace(/<button role="menuitem"(?:(?!<\/button>)[\s\S])*?class="tag mock"[\s\S]*?<\/button>/g, '') // 시연에서 눌리지 않게, 실제로 동작하지 않는 항목은 뺀다(사용자 결정 2026-11-01)
      .replace(/<div class="mh">가져오기<\/div>(?=<div class="msep">)<div class="msep"><\/div>/, '')
      .replace(/<div class="mh">내보내기<\/div>(?=<div class="msep">)<div class="msep"><\/div>/, '');
  };
})();
