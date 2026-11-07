// 결과 고치기 흐름 실험 문제 만들기: 2027 기본 값 + 2027-rank1 결과 + (연전 고정 · 홈 지정 · 손으로 놓기)
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2], OUT = process.argv[3];
for (const f of ['calendar-gen', 'preset-2025', 'score']) require(path.join(ROOT, 'ui/core', f + '.js'));
const K = globalThis.KBO;
const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui/data/plans/2027-rank1.json'), 'utf8'));
function base() {
  const s = K.Preset2027.buildProject();
  s.matches = v.matches.map((m) => Object.assign({ pinned: false }, m));
  s.plan = v.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
  const op = s.events.find((e) => e.type === 'OPENING');
  op.pairs = v.pairs; op.teams = v.pairs.map((x) => x.home);
  op.stadiums = op.teams.map((t) => (s.teams.find((x) => x.name === t) || {}).stadium).filter(Boolean);
  s.settings.objective = v.objective;
  delete s.snapshots; delete s.reschedule; delete s.games;
  return s;
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const slotOf = (s, m) => s.plan.find((p) => p.match === m).calendar;
function build(name, fixed, designations, hands) {
  const s = base();
  for (const d of designations) {
    const date = s.calendar[d.slot].datetime.slice(0, 10);
    s.events.push({ id: 'ev-x' + d.slot, type: 'CUSTOM', name: '지정 ' + d.slot, date, mode: 'STADIUM', teams: d.teams,
      stadiums: d.teams.map((t) => s.teams.find((x) => x.name === t).stadium), fix: 'home' });
  }
  const fixedSet = new Set(fixed);
  for (const p of s.plan) if (fixedSet.has(p.calendar)) s.matches[p.match].pinned = true;
  const handList = [];
  for (const h of hands) {
    const m = h.match != null ? h.match : s.plan.filter((p) => p.calendar === h.fromSlot).map((p) => p.match).find((x) => s.matches[x].consecutive === 3);
    s.plan.find((p) => p.match === m).calendar = h.to; s.matches[m].pinned = true; handList.push({ match: m, to: h.to, label: s.matches[m].away + '@' + s.matches[m].home });
  }
  const ctx = K.Score.createContext(K.Score.buildInput(s));
  const plan = K.Score.planArrayFrom(s);
  const ex = K.Score.explain(ctx, plan, s);
  // 고정한 것끼리만의 위반(실행 전 검사): 고정·손으로 놓은 경기만 남기고 나머지는 빼서 채점
  const only = Int32Array.from(plan); s.matches.forEach((m, i) => { if (!m.pinned) only[i] = -1; });
  const exFixed = K.Score.explain(ctx, only, s).violations.filter((x) => !['H0-a','H0-b','H0-c'].includes(x.code)); const exFixedAll = K.Score.explain(ctx, only, s).violations.filter((x) => !['H0-a','H0-c'].includes(x.code)).map((x) => x.code + ' ' + (x.message||x.msg||'').slice(0,60));
  return { name, fixed, designations, hands: handList, problem: s, startViolations: ex.violations.length,
    startCodes: [...new Set(ex.violations.map((x) => x.code))], fixedOnlyViolations: exFixed.length, fixedOnlyDetail: exFixedAll, pinnedCount: s.matches.filter((m) => m.pinned).length };
}
const MA = range(0, 10); // 3·4월에 시작하는 연전
const S = [
  build('S1 3·4월 고정 + 6/8 SSG 홈', MA, [{ slot: 21, teams: ['SSG'] }], []),
  build('S2 S1 + 손으로 1경기(6/18 KIA-한화 → 6/29)', MA, [{ slot: 21, teams: ['SSG'] }], [{ match: 86, to: 27 }]),
  build('S3 S1 + 손으로 3경기', MA, [{ slot: 21, teams: ['SSG'] }], [{ match: 86, to: 27 }, { fromSlot: 15, to: 19 }, { fromSlot: 33, to: 38 }]),
  build('S4 3·4월 고정 + 6/8 다섯 구단 홈', MA, [{ slot: 21, teams: ['SSG', '두산', '삼성', '한화', 'KIA'] }], []),
  build('S5 3·4월 + 7월 고정(띄엄띄엄) + 6/8 SSG 홈', MA.concat(range(28, 34)), [{ slot: 21, teams: ['SSG'] }], []),
  build('S6 3·4월 고정 + 5/11 SSG 홈(경계 가까이)', MA, [{ slot: 13, teams: ['SSG'] }], []),
  build('S7 7월까지 고정 + 8/10 SSG 홈(10개 남음)', range(0, 34), [{ slot: 37, teams: ['SSG'] }], []),
  build('S8 8/20까지 고정 + 8/27 SSG 홈(4개 남음)', range(0, 40), [{ slot: 42, teams: ['SSG'] }], []),
];
fs.writeFileSync(OUT, JSON.stringify(S));
for (const x of S) console.log(x.name, '| 시작 위반', x.startViolations, x.startCodes.join(','), '| 고정끼리 위반', x.fixedOnlyViolations, JSON.stringify(x.fixedOnlyDetail), '| 고정 경기', x.pinnedCount, '| 손', JSON.stringify(x.hands));
