#!/usr/bin/env node
/*
 * 공통 코어 헤드리스 테스트. 사용법: node core/test/run-tests.js
 * AC-1(채점 정합성), AC-2(슬롯 생성), AC-3(시리즈 생성), AC-4(이벤트), AC-5/7(Mock 엔진),
 * AC-6(재채점·실행 취소), AC-8(재편성), AC-11(저장·가져오기) 중 DOM이 필요 없는 부분을 검증한다.
 */
const fs = require('fs');
const path = require('path');
const core = path.resolve(__dirname, '..');
for (const f of ['calendar-gen', 'preset-2025', 'score', 'reschedule', 'mock-solver', 'store', 'engine-adapter', 'svg-chart', 'svg-map']) require(path.join(core, f + '.js'));
const K = globalThis.KBO;
const { Score, CalendarGen, Preset, Reschedule, MockSolver, Store, Engine, Chart, MapKit } = K;

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || '단언 실패'); }
function eq(a, b, msg) { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg || '불일치') + '\n  기대: ' + sb + '\n  실제: ' + sa); }

const project = () => Preset.buildProject();

test('AC-2 슬롯 자동 생성이 input_2025.json calendar 45개와 일치', () => {
  const r = CalendarGen.generateSlots(Preset.DEFAULT_SETTINGS);
  const exp = Preset.ENGINE_INPUT_2025.calendar;
  eq(r.slots.length, 45, '슬롯 수');
  r.slots.forEach((s, i) => eq([s.datetime, s.consecutive, s.weekend, s.holiday], [exp[i].datetime, exp[i].consecutive, exp[i].weekend, exp[i].holiday], '슬롯 ' + i));
});

test('§5.2.1 구간 분할 규칙', () => {
  eq(CalendarGen.splitRun(6), [3, 3]); eq(CalendarGen.splitRun(9), [3, 3, 3]); eq(CalendarGen.splitRun(4), [4]);
  eq(CalendarGen.splitRun(7), [3, 4]); eq(CalendarGen.splitRun(2), [2]); eq(CalendarGen.splitRun(5), [2, 3]);
});

test('AC-3 시리즈 생성: 구단쌍 15경기, 구단 135경기, 연전 2:5/3:215/4:5, 같은 길이 완전 매칭', () => {
  const slots = CalendarGen.generateSlots(Preset.DEFAULT_SETTINGS).slots;
  const g = CalendarGen.generateSeries(Preset.ENGINE_INPUT_2025.teams, slots, { initialGamesPerPair: 15, homeGamesMajor: 9 });
  eq(g.errors, []);
  eq(CalendarGen.lengthHistogram(g.matches), { 2: 5, 3: 215, 4: 5 });
  const pair = {}, team = {};
  for (const m of g.matches) {
    const k = [m.home, m.away].sort().join('|');
    pair[k] = (pair[k] || 0) + m.consecutive;
    team[m.home] = (team[m.home] || 0) + m.consecutive; team[m.away] = (team[m.away] || 0) + m.consecutive;
  }
  eq(Object.keys(pair).length, 45); assert(Object.values(pair).every((v) => v === 15), '구단쌍 15경기');
  assert(Object.values(team).every((v) => v === 135), '구단 135경기');
  // 구성적 초기해는 H0-a~d 위반이 없어야 한다(같은 길이 시리즈가 완전 매칭을 이룬다)
  const p = project();
  p.matches = g.matches.map((m) => Object.assign({ pinned: false }, m));
  p.plan = g.plan.map((c, m) => ({ match: m, calendar: c }));
  p.events = [];
  const ex = Score.scoreProject(p);
  eq(ex.byCode['H0-a'].amount + ex.byCode['H0-c'].amount + ex.byCode['H0-d'].amount, 0, '구성적 초기해 H0-a/c/d');
});

test('AC-1 JS 채점기 = Java ScoreFormulas.evaluate (엔진 호환 모드, 골든 값)', () => {
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'golden-scores.json'), 'utf8'));
  const plans = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'plans.json'), 'utf8'));
  assert(golden.length >= 8, '골든 값 수');
  const base = Array.from(Score.planArrayFrom(project()));
  let mockCount = 0, withEmpty = 0;
  for (const g of golden) {
    const spec = plans.find((p) => p.name === g.name);
    const cal = spec.initialPlan ? base : spec.calendar.map((c) => (c === 9999 ? -1 : c));
    const p = project();
    p.settings.h0eMode = 'ENGINE';
    p.plan = cal.map((c, m) => ({ match: m, calendar: c }));
    const ctx = Score.createContext(Score.buildInput(p));
    const fast = Score.evaluate(ctx, Int32Array.from(cal), []);
    const ex = Score.explain(ctx, Int32Array.from(cal), p);
    eq(fast, g.hard.concat(g.soft), g.name + ' 고속 경로');
    eq(Score.flat(ex.score), g.hard.concat(g.soft), g.name + ' 상세 경로');
    eq(Score.scoreString(ex.score), g.score, g.name + ' 점수 문자열');
    if (g.name.startsWith('mock-')) mockCount++;
    if (ex.slotStats.some((s) => s.series === 0) && cal.some((c) => c >= 0)) withEmpty++;
  }
  assert(mockCount >= 3, 'Mock 결과 3개 이상');
  assert(withEmpty >= 1, '빈 슬롯 배정 1개 이상');
});

test('고속 경로 = 상세 경로 (무작위 3,000건, 두 H0-e 모드)', () => {
  const p = project();
  const r = MockSolver.rng(123);
  for (const mode of ['STADIUM', 'ENGINE']) {
    const ctx = Score.createContext(Score.buildInput(p, { h0eMode: mode }));
    for (let k = 0; k < 1500; k++) {
      const plan = new Int32Array(225);
      for (let m = 0; m < 225; m++) plan[m] = r() < 0.04 ? -1 : r.int(45);
      eq(Score.evaluate(ctx, plan, []), Score.flat(Score.explain(ctx, plan, p).score), mode + ' #' + k);
    }
  }
});

test('AC-4 어린이날 구장 기준/엔진 호환', () => {
  const p = project();
  const plan = Score.planArrayFrom(p);
  const slot = 13;
  const inSlot = (pred) => p.matches.findIndex((m, i) => plan[i] === slot && pred(m));
  // 두산·LG 모두 원정이 되도록: 슬롯 13의 두산 홈 시리즈를, 다른 슬롯의 같은 길이 '두산·LG 무관' 원정 시리즈와 교환
  const doosanHome = inSlot((m) => m.home === '두산');
  assert(doosanHome >= 0, '슬롯 13에 두산 홈 시리즈');
  const swapWith = p.matches.findIndex((m, i) => plan[i] !== slot && plan[i] >= 0 && m.consecutive === 3 && m.away === '두산' && m.home !== 'LG');
  const both = Int32Array.from(plan); { const t = both[doosanHome]; both[doosanHome] = both[swapWith]; both[swapWith] = t; }
  const ctxS = Score.createContext(Score.buildInput(p, { h0eMode: 'STADIUM' }));
  const exBoth = Score.explain(ctxS, both, p);
  const h0eBoth = exBoth.violations.filter((v) => v.code === 'H0-e' && v.slot === slot);
  eq(h0eBoth.length, 1, '두산·LG 모두 원정 → H0-e 1건');
  assert(/잠실/.test(h0eBoth[0].message), '잠실 위반');
  // LG 홈, 두산 원정 → 구장 기준 통과, 엔진 호환 위반 1건
  const lg = Int32Array.from(plan);
  const lgHome = p.matches.findIndex((m, i) => m.home === 'LG' && m.away === '두산' && plan[i] !== slot && m.consecutive === 3);
  { const t = lg[doosanHome]; lg[doosanHome] = lg[lgHome]; lg[lgHome] = t; }
  eq(Score.explain(ctxS, lg, p).violations.filter((v) => v.code === 'H0-e').length, 0, '구장 기준: LG 홈이면 해소');
  const ctxE = Score.createContext(Score.buildInput(p, { h0eMode: 'ENGINE' }));
  eq(Score.explain(ctxE, lg, p).violations.filter((v) => v.code === 'H0-e').length, 1, '엔진 호환: 두산 원정 1건');
});

test('NFR-3/FR-M3 상세 재채점 100ms 이내 (225 시리즈)', () => {
  const p = project();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) Score.scoreProject(p);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  assert(ms < 100, '평균 ' + ms.toFixed(1) + 'ms');
  console.log('    상세 재채점 평균 ' + ms.toFixed(2) + 'ms');
});

test('AC-5 Mock 엔진(메인 스레드 폴백): 1초 안 갱신, 중지 1초 안 종료', async () => {
  const engine = new Engine.MockEngineAdapter({ useWorker: false });
  const p = project();
  const h = engine.solve(p, { timeLimitSec: 30, unimprovedSec: 30, seed: 5, init: 'KEEP' });
  const t0 = Date.now();
  let firstBest = -1, bestCount = 0;
  await new Promise((resolve, reject) => {
    h.on('best', () => { bestCount++; if (firstBest < 0) firstBest = Date.now() - t0; });
    h.on('error', (e) => reject(new Error(e.message)));
    let stopAt = 0;
    h.on('done', (d) => {
      try {
        assert(d.reason === 'STOPPED', '종료 사유 ' + d.reason);
        assert(Date.now() - stopAt < 1000, '중지 지연 ' + (Date.now() - stopAt));
        resolve();
      } catch (e) { reject(e); }
    });
    setTimeout(() => { stopAt = Date.now(); h.stop(); }, 1200);
  });
  assert(firstBest >= 0 && firstBest < 1000, '첫 갱신 ' + firstBest + 'ms');
  assert(bestCount >= 1);
});

test('AC-7 핀 고정 시리즈는 재최적화 후에도 같은 슬롯', async () => {
  const engine = new Engine.MockEngineAdapter({ useWorker: false });
  const p = project();
  const plan = Score.planArrayFrom(p);
  const pinned = [10, 50, 100, 150, 200];
  for (const m of pinned) p.matches[m].pinned = true;
  const before = pinned.map((m) => plan[m]);
  const done = await new Promise((resolve) => engine.solve(p, { timeLimitSec: 1.5, seed: 9, init: 'SCRATCH' }).on('done', resolve));
  const after = new Map(done.plan.map((x) => [x.match, x.calendar]));
  eq(pinned.map((m) => after.get(m)), before, '핀 시리즈 슬롯');
  for (const m of p.matches.map((x, i) => i).filter((i) => p.matches[i].pinned)) eq(after.get(m), plan[m], '개막전 핀 ' + m);
});

test('AC-6 수정 후 실행 취소하면 이전 점수로 정확히 복귀 (Store)', () => {
  const st = new Store.Store({ storageKey: 't', storage: null, initial: project, autosaveMs: -1 });
  const s0 = Score.scoreString(Score.scoreProject(st.state).score);
  st.commit('이동', (s) => { s.plan[30].calendar = 7; }, { tags: ['plan'] });
  const s1 = Score.scoreString(Score.scoreProject(st.state).score);
  assert(s0 !== s1, '이동 후 점수 변화');
  st.undo();
  eq(Score.scoreString(Score.scoreProject(st.state).score), s0, '실행 취소 점수');
  st.redo();
  eq(Score.scoreString(Score.scoreProject(st.state).score), s1, '다시 실행 점수');
  for (let i = 0; i < 60; i++) st.commit('반복 ' + i, (s) => { s.plan[i].calendar = (s.plan[i].calendar + 1) % 45; });
  let n = 0; while (st.undo()) n++;
  assert(n >= 50, '실행 취소 ' + n + '단계');
});

test('AC-8 취소 3경기 기록 → 재편성 대상 48경기, 월요일 미허용이면 월요일 0건', async () => {
  const p = project();
  const games = Reschedule.computeGames(p);
  const pick = [games[30], games[400], games[650]];
  for (const g of pick) Reschedule.setGameStatus(p, g, 'CANCELLED', 'RAIN');
  const t = Reschedule.computeTargets(p);
  eq(t.totals.remaining, 45, '잔여 45'); eq(t.totals.cancelled, 3, '취소 3');
  p.reschedule.units = Reschedule.buildUnits(t);
  eq(p.reschedule.units.reduce((s, u) => s + u.games, 0), 48, '재편성 대상 48경기');
  p.reschedule.allowMonday = false;
  p.reschedule.plan = [];
  const engine = new Engine.MockEngineAdapter({ useWorker: false });
  const done = await new Promise((resolve) => engine.solve(p, { mode: 'RESCHEDULE', timeLimitSec: 2, unimprovedSec: 1, seed: 3, init: 'SCRATCH' }).on('done', resolve));
  p.reschedule.plan = done.plan;
  const ex = Reschedule.explain(p);
  const rg = Reschedule.computeGames(p).filter((g) => g.source === 'RESCHEDULE');
  const unassigned = ex.violations.filter((v) => v.code === 'RH-5');
  eq(rg.length + unassigned.reduce((s, v) => s + v.amount, 0), 48, '배정 + 미배정 = 48');
  for (const v of unassigned) assert(v.message.includes('—'), '미배정 사유');
  eq(rg.filter((g) => K.Dates.weekday(g.day) === 1).length, 0, '월요일 배정 0건');
  assert(rg.every((g) => g.date >= '2025-09-01' && g.date <= '2025-10-31'), '9~10월');
  console.log('    재편성 점수 ' + Score.scoreString(ex.score) + ', 배정 ' + rg.length + '경기');
});

test('재편성 고속 경로 = 설명 경로 (무작위 배치)', () => {
  const p = project();
  const t = Reschedule.computeTargets(p);
  p.reschedule.units = Reschedule.buildUnits(t);
  const r = MockSolver.rng(77);
  for (let k = 0; k < 200; k++) {
    p.reschedule.allowMonday = r() < 0.5;
    p.reschedule.plan = p.reschedule.units.map((u) => ({ unit: u.id, start: r() < 0.1 ? null : K.Dates.addDays('2025-09-01', r.int(58)), dh: r() < 0.2 }));
    const ex = Reschedule.explain(p);
    assert(!ex.score.mismatch, '불일치 #' + k + ' ' + JSON.stringify(ex.score));
  }
});

test('AC-11 프로젝트 내보내기 → 가져오기 동일 상태, 엔진 JSON 재가져오기 점수 동일', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const st = new Store.Store({ storageKey: 'kbo-opus:test', storage, initial: project, autosaveMs: -1 });
  st.commit('이동', (s) => { s.plan[3].calendar = 9; s.matches[7].pinned = true; });
  Reschedule.setGameStatus(st.state, Reschedule.computeGames(st.state)[5], 'CANCELLED', 'HEAT');
  st.addSnapshot('테스트');
  st.save();
  const st2 = new Store.Store({ storageKey: 'kbo-opus:test', storage, initial: project, autosaveMs: -1 });
  assert(st2.restored, '새로고침 복원');
  const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.meta.updatedAt; return c; };
  eq(strip(st2.state), strip(st.state), '복원 상태');
  const exported = st.exportProject();
  const v = Store.validateProject(JSON.parse(exported));
  assert(v.ok, JSON.stringify(v.errors));
  const a = strip(v.project); delete a.meta.exportedAt;
  eq(a, strip(st.state), '가져오기 상태');
  const engineJson = JSON.parse(Store.exportEngine(st.state));
  const ve = Store.validateProject(engineJson);
  assert(ve.ok && ve.format === 'ENGINE');
  eq(Score.flat(Score.scoreProject(ve.project).score), Score.flat(Score.scoreProject(st.state).score), '엔진 JSON 왕복 점수');
});

test('NFR-8 잘못된 JSON은 필드 단위 오류', () => {
  const bad = project();
  bad.teams[2].latitude = 'abc';
  bad.matches[4].home = '없는팀';
  bad.calendar[1].consecutive = 0;
  const v = Store.validateProject(bad);
  assert(!v.ok);
  const paths = v.errors.map((e) => e.path);
  for (const p of ['teams[2].latitude', 'matches[4].home', 'calendar[1].consecutive']) assert(paths.includes(p), p + ' 누락: ' + paths.join(', '));
});

test('저장 실패(용량 초과)에도 동작', () => {
  const storage = { getItem: () => null, setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }, removeItem: () => {} };
  const st = new Store.Store({ storageKey: 'x', storage, initial: project, autosaveMs: -1 });
  const r = st.save();
  assert(!r.ok && st.persistError === '저장 용량 초과');
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
  const st2 = new Store.Store({ storageKey: 'x', storage: throwing, initial: project, autosaveMs: -1 });
  assert(st2.state.teams.length === 10);
});

test('AC-10 사전 검색 "사직" → 사직야구장', () => {
  const r = MapKit.searchStadiums('사직');
  eq(r[0].name, '사직야구장');
  assert(MapKit.searchStadiums('대전').length >= 2, '대전 후보 여럿');
  assert(MapKit.estimateRoadKm({ latitude: 37.5, longitude: 127, stadium: 'a' }, { latitude: 35.2, longitude: 129, stadium: 'b' }, 1.25) > 300);
});

test('CSV·차트·지도 렌더 스모크', () => {
  const csv = Store.exportCSV(project());
  assert(csv.startsWith('﻿날짜,요일,원정,홈,구장,상태'));
  eq(csv.trim().split('\r\n').length, 1 + 675, 'CSV 경기 행 수');
  assert(Chart.bar({ items: [{ label: 'A', value: 3 }, { label: 'B', value: 5, flag: true }], mean: 4, band: { lo: 3, hi: 5 } }).includes('<svg'));
  assert(MapKit.render({ markers: [{ id: 'a', lat: 37.5, lon: 127, label: 'A' }] }).svg.includes('kmap-marker'));
});

test('Worker 소스 생성 (팩토리 직렬화)', () => {
  const src = Engine.workerSource();
  assert(src.includes('workerMain'));
  // 소스를 새 컨텍스트에서 평가해 MockSolver가 살아나는지 확인
  const vm = require('vm');
  const sandbox = { self: { postMessage: () => {} }, setTimeout, clearTimeout, Date, Math };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert(sandbox.self.KBO.MockSolver && typeof sandbox.self.onmessage === 'function');
});

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed++; console.log('✔ ' + t.name); }
    catch (e) { failed++; console.log('✘ ' + t.name + '\n  ' + e.message.split('\n').join('\n  ')); }
  }
  console.log('\n' + passed + ' 통과, ' + failed + ' 실패');
  process.exit(failed ? 1 : 0);
})();
