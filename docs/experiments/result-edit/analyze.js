const fs = require('fs'), path = require('path');
const ROOT = process.argv[2], DIR = process.argv[3];
for (const f of ['calendar-gen', 'preset-2025', 'score']) require(path.join(ROOT, 'ui/core', f + '.js'));
const K = globalThis.KBO;
const sc = JSON.parse(fs.readFileSync(path.join(DIR, 'scenarios.json'), 'utf8'));
const rs = JSON.parse(fs.readFileSync(path.join(DIR, 'results.json'), 'utf8'));
const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui/data/plans/2027-rank1.json'), 'utf8'));
const orig = new Map(v.plan.map((p) => [p.match, p.calendar]));
function stats(s, planList) {
  const p = Object.assign({}, s, { plan: planList });
  const ctx = K.Score.createContext(K.Score.buildInput(p));
  const arr = K.Score.planArrayFrom(p);
  const ex = K.Score.explain(ctx, arr, p);
  const km = ex.teamMetrics.reduce((a, t) => a + t.distanceTenths, 0) / 10;
  return { arr, ex, km };
}
const rows = [];
for (const r of rs) {
  const s = sc.find((x) => x.name === r.name).problem;
  const b = stats(s, s.plan);
  if (r.error) { rows.push(`${r.name} | ${r.init} | 실패: ${r.error.slice(0, 140)}`); continue; }
  const a = stats(s, r.plan);
  const pinnedMoved = s.matches.filter((m, i) => m.pinned && a.arr[i] !== b.arr[i]).length;
  const free = s.matches.map((m, i) => i).filter((i) => !s.matches[i].pinned);
  const changed = free.filter((i) => a.arr[i] !== orig.get(i)).length;
  const desig = s.events.filter((e) => e.id.startsWith('ev-x')).map((e) => {
    const slot = s.calendar.findIndex((c) => c.datetime.slice(0, 10) === e.date);
    const homes = r.plan.filter((q) => q.calendar === slot).map((q) => s.matches[q.match].home);
    return e.teams.every((t) => homes.includes(t));
  });
  const g = a.ex.objectiveGaps, g0 = stats(s, v.plan.map((q) => ({ match: q.match, calendar: q.calendar }))).ex.objectiveGaps;
  const seeds = (r.seedResults || []).map((x) => (x.score && x.score.hard ? x.score.hard.reduce((u, w) => u + w, 0) : '?')).join('/');
  rows.push(`${r.name} | ${r.init} | 위반 ${a.ex.violations.length} (엔진 ${r.scoreString.split('hard')[0]}) | 시드별 hard ${seeds} | 지정 ${desig.every(Boolean) ? '지킴' : '못 지킴'} | 고정 경기 움직임 ${pinnedMoved} | 바뀐 경기 ${changed}/${free.length} | 전체 거리 ${Math.round(g0.totalKm)}→${Math.round(g.totalKm)}km | 이동횟수 격차 ${g0.moves}→${g.moves} · 거리 격차 ${Math.round(g0.distanceKm)}→${Math.round(g.distanceKm)} · 휴일 격차 ${g0.holiday}→${g.holiday} | ${Math.round(r.elapsedMs / 1000)}초`);
}
console.log(rows.join('\n'));
