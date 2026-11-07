// 연전 기간 k개를 비우고 그 경기들을 다시 나눠 넣는 방법이 몇 가지이고, 그중 필수 규칙 위반 0건이 몇 가지인가
const root = process.argv[2];
for (const f of ['preset-2025.js','calendar-gen.js','score.js']) require(root + '/ui/core/' + f);
const KBO = globalThis.KBO, Score = KBO.Score;
const v = require(root + '/ui/data/plans/2027-rank1.json');
const s = KBO.Preset2027.buildProject();
s.settings = Object.assign(s.settings, { objective: v.objective });
s.matches = v.matches.map((m) => Object.assign({ pinned: false }, m));
s.plan = v.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
const op = s.events.find((e) => e.type === 'OPENING');
if (op && v.pairs) { op.pairs = v.pairs; op.teams = v.pairs.map((x) => x.home); op.stadiums = op.teams.map((t) => (s.teams.find((x) => x.name === t) || {}).stadium).filter(Boolean); }
const ctx = Score.createContext(Score.buildInput(s));
const plan = Score.planArrayFrom(s), res = [], tmp = new Int32Array(plan.length);
Score.evaluate(ctx, plan, res); const base = res.slice(); const H = (a) => a[0] + a[1];
const mt = s.matches, S = s.calendar.length;
const bySlot = Array.from({ length: S }, () => []); plan.forEach((c, m) => { if (c >= 0) bySlot[c].push(m); });
const three = []; for (let i = 0; i < S; i++) if (s.calendar[i].consecutive === 3 && !bySlot[i].some(m => mt[m].pinned)) three.push(i);
function run(slots) {
  const games = slots.flatMap(x => bySlot[x]);
  let total = 0, safe = 0, distinct = new Set(), safeDistinct = new Set();
  const assign = new Array(games.length).fill(-1);
  function rec(k) {
    if (k === slots.length) {
      tmp.set(plan); games.forEach((g, i) => tmp[g] = slots[assign[i]]);
      const key = slots.map((_, j) => games.filter((g, i) => assign[i] === j).map(g => mt[g].home + mt[g].away).sort().join()).join('|');
      if (distinct.has(key)) return; distinct.add(key); total++;
      Score.evaluate(ctx, tmp, res); if (H(res) === H(base)) { safe++; safeDistinct.add(key); }
      return;
    }
    // choose a perfect matching (5 games, 10 teams) for slot k from unassigned games
    const free = games.map((g, i) => i).filter(i => assign[i] < 0);
    const pick = (start, used, cnt) => {
      if (cnt === 5) { rec(k + 1); return; }
      for (let q = start; q < free.length; q++) { const i = free[q], g = mt[games[i]];
        if (used.has(g.home) || used.has(g.away)) continue;
        assign[i] = k; used.add(g.home); used.add(g.away);
        pick(q + 1, used, cnt + 1);
        assign[i] = -1; used.delete(g.home); used.delete(g.away); }
    };
    pick(0, new Set(), 0);
  }
  rec(0);
  return { total, safe };
}
// 붙어 있는 3연전 기간 2개·3개·4개
for (const k of [2, 3, 4]) {
  const out = [];
  for (let i = 0; i + k <= three.length; i += 3) { const sl = three.slice(i, i + k); const r = run(sl); out.push(r.total + '/' + r.safe); }
  console.log('연속 ' + k + '개 비우기: 나누는 방법/위반 0건(원래 일정 포함) →', out.join('  '));
}
