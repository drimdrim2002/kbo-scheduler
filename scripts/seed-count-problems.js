#!/usr/bin/env node
// SeedCountBench 입력: 편성 스튜디오가 서버에 보내는 프로젝트 그대로(2025 실제 · 2027 예상) + 실행 때 채우는 기본 운영 방침.
//   node scripts/seed-count-problems.js <outDir>   → <outDir>/problem-2025.json, problem-2027.json, problem-2028.json
'use strict';
const fs = require('fs');
const path = require('path');
require('../ui/core/calendar-gen.js');
require('../ui/core/preset-2025.js');
const KBO = globalThis.KBO;

// ui/app/studio/plan-flow.js DEFAULT_OBJECTIVE와 같다(pf-run이 objective가 없으면 이 값을 넣고 실행한다)
const DEFAULT_OBJECTIVE = { order: ['moves', 'distance', 'holiday', 'total'], moveGap: 4, distanceGapKm: 600, holidayGap: 3 };

const out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });
// 2028: 2027 기본 제공 설정에서 날짜만 2028로 옮기고 연전 기간·시리즈를 규칙대로 새로 만든다(스튜디오의 「규칙대로 채우기」와 같은 함수).
// 짝수 해라 홈 73/71·어린이날 홈 구단이 2027과 반대다. 개막전 대진 고정은 없다(이벤트 없음 → 5/5 연전 기간에 obligationTeams).
// 2023·2024 실제 일정(data/baseball/input*.json)은 4연전 기간이 없어 지금 엔진의 초기해 생성기가 받지 않는다.
function build2028() {
  const G = KBO.CalendarGen;
  const p = KBO.Preset2027.buildProject();
  const s = p.settings;
  Object.assign(s, {
    seasonStart: '2028-03-25', initialEnd: '2028-09-03', seasonEnd: '2028-10-29', allStarStart: '2028-07-07',
    blackouts: [{ start: '2028-07-07', end: '2028-07-12', label: '올스타 휴식기' }],
    holidays: G.builtinHolidays(2028), homeTotals: G.defaultHomeTotals(2028, p.teams), obligationTeams: G.defaultChildrenHosts(2028, p.teams)
  });
  const slots = G.generateSlots(G.ruleSettings(s)).slots;
  const calendar = G.applyWeights(slots.map((x, i) => ({ index: i, datetime: x.datetime, consecutive: x.consecutive, weekend: 0, holiday: 0 })), s);
  const g = G.generateSeries(p.teams, calendar, { initialGamesPerPair: s.initialGamesPerPair, homeGamesMajor: s.homeGamesMajor, settings: s, events: [] });
  if (g.errors.length) throw new Error('2028: ' + g.errors.join(', '));
  return Object.assign(p, {
    meta: Object.assign({}, p.meta, { season: 2028, name: '2028 규칙대로 만든 시즌(벤치용)' }),
    events: [], calendar,
    matches: g.matches.map((m) => ({ index: m.index, home: m.home, away: m.away, consecutive: m.consecutive, pinned: false })),
    plan: g.plan.map((c, m) => ({ match: m, calendar: c }))
  });
}
for (const [year, build] of [['2025', KBO.Preset.buildProject], ['2027', KBO.Preset2027.buildProject], ['2028', build2028]]) {
  const p = build();
  if (!p.matches.length) throw new Error(year + ': 시리즈를 만들지 못했습니다');
  p.settings = Object.assign({}, p.settings, { objective: Object.assign({}, DEFAULT_OBJECTIVE) });
  const file = path.join(out, 'problem-' + year + '.json');
  fs.writeFileSync(file, JSON.stringify(p));
  console.log(file, 'calendar', p.calendar.length, 'matches', p.matches.length, 'pinned', p.matches.filter((m) => m.pinned).length);
}
