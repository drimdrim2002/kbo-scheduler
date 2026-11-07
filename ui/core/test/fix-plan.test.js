/*
 * 결과 고치기(fix-plan.js): 서버로 보낼 고정 · 새로 짤 연전 수 · 실행 전 검사(거짓 위반을 내지 않음) · 서버 오류 알아보기.
 * run-tests.js가 require(...)(test, helpers)로 붙인다.
 */
const fs = require('fs');
const path = require('path');

module.exports = function (test, h) {
  const { assert, eq, K } = h;
  const { Score, FixPlan, Preset2027 } = K;

  /** 2027 기본 제공 결과(2027-rank1, 위반 0)를 2027 편성 조건에 얹은 프로젝트 */
  function rank1() {
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'plans', '2027-rank1.json'), 'utf8'));
    const p = Preset2027.buildProject();
    p.matches = v.matches.map((m) => Object.assign({ pinned: false }, m));
    p.plan = v.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
    const op = p.events.find((e) => e.type === 'OPENING');
    if (op && v.pairs) { op.pairs = v.pairs; op.teams = v.pairs.map((x) => x.home); }
    return p;
  }
  const slotsOfMonths = (p, months) => p.calendar.map((c, i) => i).filter((i) => months.includes(+p.calendar[i].datetime.slice(5, 7)));

  /** 4구단(C·D는 같은 구장) · 3연전 6개 · 경기는 시험마다 직접 놓는다 */
  function tiny(games) {
    const teams = [{ name: 'A', stadium: 'a' }, { name: 'B', stadium: 'b' }, { name: 'C', stadium: 'cd' }, { name: 'D', stadium: 'cd' }];
    const calendar = [0, 1, 2, 3, 4, 5].map((k) => ({ datetime: '2027-04-' + String(5 + k * 3).padStart(2, '0') + ' 00:00:00', consecutive: 3 }));
    const matches = games.map((g, i) => ({ index: i, home: g[0], away: g[1], consecutive: 3, pinned: false, hand: !!g[3] }));
    return { teams, calendar, matches, plan: games.map((g, i) => ({ match: i, calendar: g[2] })), events: [], settings: {} };
  }
  const codes = (r) => r.violations.map((v) => v.code + '@' + v.slot);

  test('결과 고치기: 3·4·7월 고정한 2027 결과 — 실행 전 검사는 위반 0 (고정한 경기만 남겨 채점하면 「KIA 홈 4연속 4/23~7/2」 같은 거짓 위반이 나온다)', () => {
    const p = rank1(), fixed = slotsOfMonths(p, [3, 4, 7]);
    assert(Score.scoreProject(p, {}).feasible, '바탕 결과는 위반 0');
    eq(fixed.length, 18, '3·4·7월 연전 기간 수');
    eq(FixPlan.freeCount(p.calendar.length, fixed), 27, '새로 짤 연전');
    const r = FixPlan.precheck(p, fixed);
    eq(r.violations, [], '진짜 위반 없음');
    // 같은 고정을 그대로 채점기에 넣으면(빈 연전을 건너뛰어 4연속을 잇는다) 거짓 위반이 나온다 — 이 검사가 그것을 하지 않는다는 근거
    const arr = Score.planArrayFrom(p);
    r.pinned.forEach((on, i) => { if (!on) arr[i] = -1; });
    const naive = Score.explain(Score.createContext(Score.buildInput(p)), arr, p).violations;
    assert(naive.some((v) => v.code === 'H0-f' && /4\/23.*7\/2/.test(v.message)), '채점기 그대로면 4/23~7/2 4연속 거짓 위반');
    assert(naive.some((v) => v.code === 'H0-a') || naive.some((v) => v.code === 'H0-c') || naive.some((v) => v.code === 'H0-f'), '비어서 걸리는 규칙');
  });

  test('결과 고치기: 보낼 고정 = 고정한 연전의 모든 경기 + 손으로 놓은 경기 + 정해 둔 대진 · syncPins가 그대로 맞춘다', () => {
    const p = rank1(), fixed = slotsOfMonths(p, [4]);
    const plan = Score.planArrayFrom(p), outside = p.matches.map((m, i) => i).filter((i) => !fixed.includes(plan[i]) && !p.matches[i].eventId);
    const opening = p.matches.map((m, i) => i).filter((i) => p.matches[i].eventId); // 개막 2연전 대진(기본 제공 결과에 고정되어 있음)
    eq(opening.length, 5, '개막 대진 고정');
    const hand = outside[0], stray = outside[1];
    p.matches[hand].hand = true;
    p.matches[stray].pinned = true; // 이유 없이 남은 고정(정해 둔 대진도 손으로 놓은 것도 아님)은 보내지 않는다
    const pins = FixPlan.pinsOf(p, fixed);
    const want = p.matches.map((m, i) => fixed.includes(plan[i]) || i === hand || opening.includes(i));
    eq(pins, want, '고정 = 고정한 연전 · 손으로 놓은 것 · 정해 둔 대진');
    eq(pins.filter(Boolean).length, fixed.length * 5 + 1 + 5, '고정 수');
    assert(!pins[stray], '이유 없는 고정은 보내지 않음');
    assert(FixPlan.syncPins(p, fixed) > 0 && p.matches.every((m, i) => !!m.pinned === pins[i]), 'syncPins');
    eq(FixPlan.syncPins(p, fixed), 0, '두 번째는 바뀌는 것 없음');
    eq(FixPlan.cleanSlots([3, 3, -1, 99, 1.5, 0], 45), [0, 3], '고정 목록 정리');
    eq([0, 3, 4, 10, 11].map(FixPlan.freeLevel), ['zero', 'tiny', 'tiny', 'few', 'none'], '경고 단계(10개 이하 경고 · 4개 이하 못 짤 수 있음)');
  });

  test('결과 고치기: 실행 전 검사 — 고정한 것끼리 생긴 진짜 위반(같은 구단 두 번 · 한 구장 홈 둘 · 같이 쓰는 구장 모두 원정 · 홈 지정 구단 원정)', () => {
    // 1연전: A-B · C-D 고정(정상). 2연전: 손으로 놓은 A-C와 고정 안 한 연전의 A-D가 아니라, 손으로 놓은 A-C · A-D 둘 → A가 두 번
    let r = FixPlan.precheck(tiny([['A', 'B', 0], ['C', 'D', 0], ['A', 'C', 1, true], ['D', 'A', 1, true]]), [0]);
    eq(codes(r), ['H0-a@1'], '한 구단 두 번(손으로 놓은 경기끼리)');
    assert(/A이\(가\) 두 번/.test(r.violations[0].message), r.violations[0].message);
    // 같이 쓰는 구장(cd) 두 구단이 같은 연전에 모두 홈 / 모두 원정
    r = FixPlan.precheck(tiny([['C', 'A', 0], ['D', 'B', 0]]), [0]);
    eq(codes(r), ['H0-b@0'], '한 구장 홈 둘');
    r = FixPlan.precheck(tiny([['A', 'C', 0], ['B', 'D', 0]]), [0]);
    eq(codes(r), ['H0-b@0'], '같이 쓰는 구장 구단 모두 원정');
    // 홈 지정: 2연전(4/8)에 B 홈 지정인데 B가 원정으로 고정
    const p = tiny([['A', 'B', 1], ['C', 'D', 1]]);
    p.events = [{ id: 'e1', type: 'CUSTOM', name: '홈 지정', date: '2027-04-08', mode: 'STADIUM', teams: ['B'], stadiums: ['b'], fix: 'home' }];
    eq(codes(FixPlan.precheck(p, [1])), ['H0-e@1'], '홈 지정 구단 원정');
    eq(codes(FixPlan.precheck(p, [])), [], '고정하지 않으면 엔진이 정할 일');
  });

  test('결과 고치기: 실행 전 검사 — 이어지는 규칙은 실제로 붙어 있는 고정 연전 사이에서만 (사이에 고정 안 한 연전이 있으면 끊김)', () => {
    // A가 0~3연전 내리 홈(B와 맞대결도 내리) — 넷 다 고정이면 4연속 + 같은 대진 연속
    const games = [['A', 'B', 0], ['A', 'B', 1], ['A', 'B', 2], ['A', 'B', 3]];
    const all = FixPlan.precheck(tiny(games), [0, 1, 2, 3]);
    eq(all.violations.filter((v) => v.code === 'H0-f').map((v) => v.message), ['A 홈 4연속 (4/5 3연전 ~ 4/14 3연전)', 'B 원정 4연속 (4/5 3연전 ~ 4/14 3연전)'], '4연속');
    eq(all.violations.filter((v) => v.code === 'H1').map((v) => v.slot), [1, 2, 3], '같은 대진 연속');
    // 2연전을 고정하지 않으면 그 사이에서 끊긴다: 4연속도, 1→2·2→3 연속도 없음(0→1 연속만 남음)
    const gap = FixPlan.precheck(tiny(games), [0, 1, 3]);
    eq(codes(gap), ['H1@1'], '끊긴 뒤에는 보지 않음');
    // 손으로 놓은 경기는 고정 연전과 붙어 있으면 이어서 본다(그 경기도 그 자리에 고정)
    const hand = FixPlan.precheck(tiny([['A', 'B', 0], ['A', 'B', 1], ['A', 'B', 2, true], ['A', 'B', 3]]), [0, 1, 3]);
    assert(hand.violations.some((v) => v.code === 'H0-f'), '손으로 놓은 경기로 이어진 4연속');
    eq(FixPlan.bySlotCount(all.violations), [{ slot: 1, count: 1 }, { slot: 2, count: 1 }, { slot: 3, count: 3 }], '연전 기간별 위반 수');
  });

  test('결과 고치기: 서버가 「고정한 채로 처음부터 짤 수 없음」이라 답하면 알아본다(JobManager.problemFor 문장)', () => {
    assert(FixPlan.isPinnedStartFailure('고정한 3연전 시리즈 195개를 그 자리에 둔 채로는 편성을 처음부터 짤 수 없었습니다. 고정을 몇 개 풀고 다시 시도해 주세요.'));
    assert(!FixPlan.isPinnedStartFailure('2027-05-05 시작 연전 롯데은(는) 홈 구장 지정 구단인데 SSG 원정 시리즈로 고정되어 있습니다.'));
    assert(!FixPlan.isPinnedStartFailure(''));
  });
};
