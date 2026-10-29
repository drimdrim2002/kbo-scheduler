/*
 * 홈 구장 지정(연전 기간별 홈 의무 구단) — 브라우저 채점기 엔진 호환 기준 = Java ScoreFormulas.
 * 골든 값 golden/home-designation.json은 Java HomeDesignationGoldenTest가 만든다(같은 파일을 Java도 다시 채점해 확인).
 * run-tests.js가 require(...)(test, helpers)로 붙인다.
 */
const fs = require('fs');
const path = require('path');

module.exports = function (test, h) {
  const { assert, eq, project, K } = h;
  const { Score, Preset, MockSolver } = K;
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'home-designation.json'), 'utf8'));

  /** Java 쪽과 같은 문제: 엔진 입력 원본 달력 + 손잡이 3개 + 그 경우의 events·obligationTeams */
  function caseProject(c) {
    const p = project();
    p.calendar = JSON.parse(JSON.stringify(Preset.ENGINE_INPUT_2025.calendar));
    delete p.settings.obligationTeams;
    Object.assign(p.settings, { distanceToleranceKm: 300, holidayTolerance: 1.5, moveTolerance: 2, h0eMode: 'ENGINE' });
    if (c.obligationTeams) p.settings.obligationTeams = c.obligationTeams.slice();
    p.events = JSON.parse(JSON.stringify(c.events));
    return p;
  }

  test('홈 구장 지정: JS 엔진 호환 기준 = Java (골든 ' + golden.cases.length + '경우 × 배정 ' + golden.plans.length + '개)', () => {
    assert(golden.cases.length >= 6, '골든 경우 수');
    for (const c of golden.cases) {
      const p = caseProject(c);
      const ctx = Score.createContext(Score.buildInput(p));
      golden.plans.forEach((plan, i) => {
        p.plan = plan.map((cal, m) => ({ match: m, calendar: cal }));
        const arr = Int32Array.from(plan);
        eq(Score.evaluate(ctx, arr, []), c.expected[i], c.name + ' 배정 ' + i + ' 고속 경로');
        eq(Score.flat(Score.explain(ctx, arr, p).score), c.expected[i], c.name + ' 배정 ' + i + ' 상세 경로');
      });
    }
  });

  test('홈 구장 지정: 개막 2연전 「홈 구장만」·어린이날 일부 지정 — 고속 = 상세 (무작위 1,000건)', () => {
    const c = golden.cases.find((x) => x.name === 'partial-overlap-custom');
    const p = caseProject(c);
    p.events.push({ id: 'ev-op', type: 'OPENING', name: '개막전', date: '2025-03-22', mode: 'STADIUM', teams: ['LG', 'KT'], fix: 'home' });
    const ctx = Score.createContext(Score.buildInput(p));
    const r = MockSolver.rng(77);
    let h0e = 0;
    for (let k = 0; k < 1000; k++) {
      const plan = new Int32Array(225);
      for (let m = 0; m < 225; m++) plan[m] = r() < 0.04 ? -1 : r.int(45);
      const ex = Score.explain(ctx, plan, p);
      eq(Score.evaluate(ctx, plan, []), Score.flat(ex.score), '#' + k);
      h0e += ex.violations.filter((v) => v.code === 'H0-e').length;
    }
    assert(h0e > 0, 'H0-e 위반이 나와야 함');
  });

  test('홈 구장 지정: 엔진 호환 의무 구단 풀이(이벤트 우선 · 어린이날 예전 설정 · 이벤트 없으면 5/5)', () => {
    const p = project();
    const names = (ob) => ob.teams.map((i) => p.teams[i].name).sort();
    // 2025 프리셋: 개막 지정 + 어린이날 지정
    const both = Score.engineObligations(p);
    eq(both.map((o) => o.slot), [0, 13], '개막·어린이날 연전 기간');
    // 어린이날 일부만 고르면 그 구단만(예전 obligationTeams보다 우선)
    p.events = [{ id: 'c', type: 'CHILDREN', name: '어린이날', date: '2025-05-06', mode: 'STADIUM', teams: ['두산', '한화'] }];
    eq(names(Score.engineObligations(p)[0]), ['두산', '한화'].sort(), '일부 지정');
    // 이벤트가 없으면 5/5가 든 연전 기간에 obligationTeams
    p.events = [];
    const legacy = Score.engineObligations(p);
    eq(legacy.length, 1); eq(legacy[0].slot, 13); eq(names(legacy[0]), p.settings.obligationTeams.slice().sort());
  });
};
