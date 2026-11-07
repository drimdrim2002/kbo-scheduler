const root = process.argv[2];
for (const f of ['preset-2025.js','calendar-gen.js','score.js']) require(root + '/ui/core/' + f);
const KBO = globalThis.KBO, Score = KBO.Score;
for (const name of ['2027-rank1','2027-rank2']) {
  const v = require(root + '/ui/data/plans/' + name + '.json');
  const s = KBO.Preset2027.buildProject();
  s.settings = Object.assign(s.settings, { objective: v.objective });
  s.matches = v.matches.map((m) => Object.assign({ pinned: false }, m));
  s.plan = v.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
  s.games = [];
  const op = s.events.find((e) => e.type === 'OPENING');
  if (op && v.pairs) { op.pairs = v.pairs; op.teams = v.pairs.map((x) => x.home); op.stadiums = op.teams.map((t) => (s.teams.find((x) => x.name === t) || {}).stadium).filter(Boolean); }
  const ctx = Score.createContext(Score.buildInput(s));
  const plan = Score.planArrayFrom(s), res = [], tmp = new Int32Array(plan.length);
  Score.evaluate(ctx, plan, res);
  const H = (a) => a[0] + a[1], base = res.slice();
  const M = s.matches.length, S = s.calendar.length;
  console.log(name, 'base', base.join('/'), 'matches', M, 'slots', S, 'pinned', s.matches.filter(m=>m.pinned).length);
  // 1) swap two matches (same length, different slot, not pinned)
  let sw = 0, sw0 = 0, swDist = {}; const zeroSw = [];
  for (let m = 0; m < M; m++) for (let n = m + 1; n < M; n++) {
    const a = s.matches[m], b = s.matches[n];
    if (a.pinned || b.pinned || plan[m] < 0 || plan[n] < 0 || plan[m] === plan[n] || a.consecutive !== b.consecutive) continue;
    tmp.set(plan); tmp[m] = plan[n]; tmp[n] = plan[m]; Score.evaluate(ctx, tmp, res);
    const d = H(res) - H(base); sw++; swDist[d] = (swDist[d]||0)+1;
    if (d === 0) zeroSw.push([m,n, res.slice(2).map((x,i)=>x-base[2+i])]);
  }
  // 2) move one match to another slot (no swap)
  let mv = 0, mv0 = 0;
  for (let m = 0; m < M; m++) { if (s.matches[m].pinned) continue;
    for (let t = 0; t < S; t++) { if (t === plan[m] || s.calendar[t].consecutive !== s.matches[m].consecutive) continue;
      tmp.set(plan); tmp[m] = t; Score.evaluate(ctx, tmp, res); mv++; if (H(res) === H(base)) mv0++; } }
  // 3) swap whole slots (same length)
  let ss = 0, ss0 = 0; const zeroSs = [];
  for (let a = 0; a < S; a++) for (let b = a + 1; b < S; b++) {
    if (s.calendar[a].consecutive !== s.calendar[b].consecutive) continue;
    if (s.matches.some((mm, i) => mm.pinned && (plan[i] === a || plan[i] === b))) continue;
    for (let i = 0; i < plan.length; i++) tmp[i] = plan[i] === a ? b : plan[i] === b ? a : plan[i];
    Score.evaluate(ctx, tmp, res); ss++; if (H(res) === H(base)) { ss0++; zeroSs.push([a,b, res.slice(2).map((x,i)=>x-base[2+i])]); } }
  // 4) flip home/away
  let fl = 0, fl0 = 0;
  for (let m = 0; m < M; m++) { const inp = Score.buildInput(s); const im = inp.matches[m]; const t = im.home; im.home = im.away; im.away = t;
    Score.evaluate(Score.createContext(inp), plan, res); fl++; if (H(res) === H(base)) fl0++; }
  console.log(' match swaps', sw, 'hard-safe', zeroSw.length, 'dist', JSON.stringify(swDist));
  console.log(' single moves', mv, 'hard-safe', mv0);
  console.log(' slot swaps', ss, 'hard-safe', ss0);
  console.log(' home/away flips', fl, 'hard-safe', fl0);
  console.log(' sample safe swaps', JSON.stringify(zeroSw.slice(0,5)), 'safe slot swaps', JSON.stringify(zeroSs.slice(0,5)));
}
