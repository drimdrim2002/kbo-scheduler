const root = process.argv[2];
for (const f of ['preset-2025.js','calendar-gen.js','score.js']) require(root + '/ui/core/' + f);
const KBO = globalThis.KBO, Score = KBO.Score;
const lex = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1; return 0; };
for (const name of ['2027-rank1','2027-rank2']) {
  const v = require(root + '/ui/data/plans/' + name + '.json');
  const s = KBO.Preset2027.buildProject();
  s.settings = Object.assign(s.settings, { objective: v.objective });
  s.matches = v.matches.map((m) => Object.assign({ pinned: false }, m));
  s.plan = v.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
  const op = s.events.find((e) => e.type === 'OPENING');
  if (op && v.pairs) { op.pairs = v.pairs; op.teams = v.pairs.map((x) => x.home); op.stadiums = op.teams.map((t) => (s.teams.find((x) => x.name === t) || {}).stadium).filter(Boolean); }
  const ctx = Score.createContext(Score.buildInput(s));
  const plan = Score.planArrayFrom(s), res = [], tmp = new Int32Array(plan.length);
  Score.evaluate(ctx, plan, res); const base = res.slice();
  const M = s.matches.length; let safe = 0, better = 0, worse = 0, kmWorse = [];
  for (let m = 0; m < M; m++) for (let n = m + 1; n < M; n++) {
    const a = s.matches[m], b = s.matches[n];
    if (a.pinned || b.pinned || plan[m] === plan[n] || a.consecutive !== b.consecutive) continue;
    if (a.home === b.home && a.away === b.away) continue;
    tmp.set(plan); tmp[m] = plan[n]; tmp[n] = plan[m]; Score.evaluate(ctx, tmp, res);
    if (res[0] + res[1] !== base[0] + base[1]) continue;
    safe++; const c = lex(res, base); if (c > 0) better++; else if (c < 0) worse++;
    if (res.slice(2,6).every((x,i)=>x===base[2+i])) kmWorse.push(((base[6]-res[6])));
  }
  console.log(name, 'real swaps hard-safe', safe, 'better', better, 'worse', worse, 'only total-km changes', kmWorse.length, kmWorse.slice(0,10).join(','));
}
