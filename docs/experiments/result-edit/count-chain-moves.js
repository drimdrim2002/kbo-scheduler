const root = process.argv[2];
for (const f of ['preset-2025.js','calendar-gen.js','score.js']) require(root + '/ui/core/' + f);
const KBO = globalThis.KBO, Score = KBO.Score;
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
Score.evaluate(ctx, plan, res); const base = res.slice(); const H = (a) => a[0] + a[1];
const M = s.matches.length, S = s.calendar.length;
const bySlot = Array.from({ length: S }, () => []); for (let m = 0; m < M; m++) if (plan[m] >= 0) bySlot[plan[m]].push(m);
const mt = s.matches;
let tried = 0, safe = 0, blocked = 0, sizes = {}; const seriesSafe = new Set(); let better = 0;
for (let m = 0; m < M; m++) { if (mt[m].pinned) continue; const a = plan[m];
  for (let b = 0; b < S; b++) { if (b === a || s.calendar[b].consecutive !== mt[m].consecutive) continue;
    // chain: alternate teams
    const chain = new Set([m]); const stack = [m];
    while (stack.length) { const x = stack.pop(); const other = plan[x] === a ? b : a;
      for (const y of bySlot[other]) if (!chain.has(y) && [mt[y].home, mt[y].away].some(t => t === mt[x].home || t === mt[x].away)) { chain.add(y); stack.push(y); } }
    tried++;
    if ([...chain].some(x => mt[x].pinned)) { blocked++; continue; }
    tmp.set(plan); for (const x of chain) tmp[x] = plan[x] === a ? b : a; { const key=(p)=>[...chain].map(x=>mt[x].home+mt[x].away+":"+p[x]).sort().join(); if (key(tmp)===key(plan)) { tried--; continue; } }
    Score.evaluate(ctx, tmp, res);
    if (H(res) === H(base)) { safe++; seriesSafe.add(m); sizes[chain.size] = (sizes[chain.size]||0)+1; let c=0; for (let i=0;i<7;i++){ if(res[i]!==base[i]){c=res[i]>base[i]?1:-1;break;} } if(c>0) better++; }
  } }
console.log(name, 'targets', tried, 'blocked by pin', blocked, 'hard-safe chains', safe, 'better', better, 'series with >=1', seriesSafe.size, 'chain sizes', JSON.stringify(sizes));
}
