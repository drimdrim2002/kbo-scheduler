/*
 * KBO 공통 코어 — 2025 프리셋 (자동 생성 파일: node tools/build-preset.js <input_2025.json>)
 * input_2025.json 원본, 2025 기본 설정·이벤트, 구장 사전, 구단 색상.
 * 2027 기본 데이터(KBO.Preset2027): 「2027 KBO 일정 예상」 연전 기간 45개 · 2027 원칙 설정 · 개막전·어린이날 홈 구장 지정(구단 정보는 2025 것).
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).preset = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  /** data/baseball/input_2025.json 그대로 */
  const ENGINE_INPUT_2025 = /*__ENGINE_INPUT__*/;

  const TEAM_COLORS = {
    SSG: '#CE0E2D', '두산': '#131230', LG: '#C30452', KT: '#1F1F1F', '키움': '#820024',
    '한화': '#E8590C', '삼성': '#074CA1', KIA: '#B8001F', NC: '#315288', '롯데': '#041E42'
  };

  /**
   * 내장 구장 사전 (FR-T2). 1군 9개 구장 + 제2구장 + 신축 구장.
   * aliases는 부분 일치 검색에 쓴다. dome은 혹서기 분석(FR-A9)에 쓴다.
   */
  const STADIUMS = [
    { name: '잠실종합운동장', aliases: ['잠실', '잠실야구장', '서울종합운동장'], city: '서울 송파구', latitude: 37.5121939926003, longitude: 127.072036416245, dome: false, tier: 1 },
    { name: '고척돔야구장', aliases: ['고척', '고척스카이돔', '고척돔'], city: '서울 구로구', latitude: 37.4982926351745, longitude: 126.867136931358, dome: true, tier: 1 },
    { name: '문학경기장', aliases: ['문학', '인천SSG랜더스필드', '랜더스필드', '인천'], city: '인천 미추홀구', latitude: 37.4351300329305, longitude: 126.690903589028, dome: false, tier: 1 },
    { name: '수원KT위즈파크', aliases: ['수원', '위즈파크', 'KT위즈파크'], city: '경기 수원시', latitude: 37.2998406250231, longitude: 127.009700685327, dome: false, tier: 1 },
    { name: '한화이글스파크', aliases: ['대전', '한밭', '이글스파크', '대전한화생명이글스파크'], city: '대전 중구', latitude: 36.3171790770845, longitude: 127.429154900655, dome: false, tier: 1 },
    { name: '대전한화생명볼파크', aliases: ['대전', '볼파크', '한화생명볼파크', '신구장'], city: '대전 중구', latitude: 36.3166, longitude: 127.4282, dome: false, tier: 1 },
    { name: '대구삼성라이언즈파크', aliases: ['대구', '라이온즈파크', '라이언즈파크'], city: '대구 수성구', latitude: 35.8413267013148, longitude: 128.681099646757, dome: false, tier: 1 },
    { name: '광주챔피언스필드', aliases: ['광주', '챔피언스필드', '기아챔피언스필드'], city: '광주 북구', latitude: 35.1681165695629, longitude: 126.889145403371, dome: false, tier: 1 },
    { name: '창원NC파크', aliases: ['창원', 'NC파크', '마산'], city: '경남 창원시', latitude: 35.2225640968556, longitude: 128.582270481598, dome: false, tier: 1 },
    { name: '사직야구장', aliases: ['사직', '부산', '사직구장'], city: '부산 동래구', latitude: 35.1941017214452, longitude: 129.061647044818, dome: false, tier: 1 },
    { name: '포항야구장', aliases: ['포항'], city: '경북 포항시', latitude: 36.0081, longitude: 129.3593, dome: false, tier: 2 },
    { name: '울산문수야구장', aliases: ['울산', '문수'], city: '울산 남구', latitude: 35.5322, longitude: 129.2595, dome: false, tier: 2 },
    { name: '청주야구장', aliases: ['청주'], city: '충북 청주시', latitude: 36.6385, longitude: 127.4703, dome: false, tier: 2 },
    { name: '군산월명야구장', aliases: ['군산', '월명'], city: '전북 군산시', latitude: 35.9767, longitude: 126.7166, dome: false, tier: 2 },
    { name: '이천LG챔피언스파크', aliases: ['이천'], city: '경기 이천시', latitude: 37.2113, longitude: 127.4893, dome: false, tier: 3 },
    { name: '마산야구장', aliases: ['마산'], city: '경남 창원시', latitude: 35.2205, longitude: 128.5800, dome: false, tier: 3 }
  ];

  const DEFAULT_SETTINGS = {
    seasonStart: '2025-03-22',
    initialEnd: '2025-08-31',
    seasonEnd: '2025-10-31',
    restWeekdays: [1],
    restExceptions: ['2025-05-05'],
    blackouts: [
      { start: '2025-05-08', end: '2025-05-08', label: '어린이날 3연전 뒤 휴식' },
      { start: '2025-07-11', end: '2025-07-16', label: '올스타 브레이크' }
    ],
    // §5.2.1 검증 기준: 1차 편성 기간에 영향을 주는 공휴일은 5/5·6/6·8/15다.
    // 6/3(임시공휴일)은 원본 데이터에 반영되지 않아 제외했다.
    // weight = 홈 경기 공정성에서 이 날의 가치(주말 하루 = 1). 기본값 공휴일 2 · 어린이날 3은 KBO 확인 필요
    holidays: [
      { date: '2025-05-05', name: '어린이날·부처님오신날', weight: 3 },
      { date: '2025-05-06', name: '대체공휴일', weight: 2 },
      { date: '2025-06-06', name: '현충일', weight: 2 },
      { date: '2025-08-15', name: '광복절', weight: 2 },
      { date: '2025-10-03', name: '개천절', weight: 2 },
      { date: '2025-10-05', name: '추석 연휴', weight: 2 },
      { date: '2025-10-06', name: '추석', weight: 2 },
      { date: '2025-10-07', name: '추석 연휴', weight: 2 },
      { date: '2025-10-08', name: '추석 대체공휴일', weight: 2 },
      { date: '2025-10-09', name: '한글날', weight: 2 }
    ],
    // 올스타 휴식기 시작 금요일(금~수 6일). 「규칙대로 채우기」가 쓴다
    allStarStart: '2025-07-11',
    gamesPerPair: 16,
    initialGamesPerPair: 15,
    homeGamesMajor: 9,
    remainingHomeRule: 'FEWER_HOME',
    roadFactor: 1.25,
    h0eMode: 'STADIUM',
    obligationTeams: ['두산', '키움', '한화', 'NC', '롯데'],
    // 평준화 허용오차(손잡이). 편차가 이 값 이상이면 감점. 휴일 1.0 = 주말·공휴일 홈 가중치를 정수로 가능한 한 같게
    distanceToleranceKm: 300, holidayTolerance: 1.0, moveTolerance: 2,
    // 개막 연전 말고는 이 길이 이상(홈 73/71 원칙 시리즈 생성이 지킴) · 올스타 휴식기 길이(금~수)
    seriesMinLength: 3, allStarDays: 6,
    referenceDate: '',
    longTripKm: 600,
    solver: { timeLimitSec: 10, unimprovedSec: 5, seed: 42, init: 'KEEP' }
  };

  const DEFAULT_RESCHEDULE = {
    start: '2025-09-01', end: '2025-10-31', allowMonday: true, allowDoubleHeader: true, maxDoubleHeaderPerTeam: 3,
    blackouts: [], units: [], plan: []
  };

  /**
   * 2025 홈 구장 지정: 개막전(3/22)·어린이날(5/5) 모두 그 날 홈 경기를 해야 하는 구단 5곳(구장 지정).
   * 개막전 홈 구장은 2025 공식 일정표(잠실 LG·문학 SSG·수원 KT·대구 삼성·광주 KIA)와 엔진 입력 initialPlan이 같다.
   * 상대는 자동 편성이 정한다. teams는 화면에서 고른 구단(잠실은 두산·LG 중 하나), stadiums는 채점에 쓰는 구장.
   */
  function presetEvents() {
    const stadiumOf = (n) => ENGINE_INPUT_2025.teams.find((t) => t.name === n).stadium;
    const order = ENGINE_INPUT_2025.teams.map((t) => t.name);
    const opening = ENGINE_INPUT_2025.initialPlan.filter((p) => p.datetime.startsWith('2025-03-22')).map((p) => p.home).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const children = ['두산', '키움', '한화', 'NC', '롯데'];
    return [
      { id: 'ev-opening', type: 'OPENING', name: '개막전', slot: 0, date: '2025-03-22', mode: 'STADIUM', teams: opening, stadiums: opening.map(stadiumOf) },
      { id: 'ev-children', type: 'CHILDREN', name: '어린이날', slot: 13, date: '2025-05-05', mode: 'STADIUM', teams: children, stadiums: children.map(stadiumOf) }
    ];
  }

  /** input_2025.json initialPlan → 매치 인덱스별 슬롯 (BaseballApp.setInitialPlan과 같은 FIFO 키 매칭) */
  function planFromInitialPlan(input) {
    const queues = new Map();
    input.matches.forEach((m, i) => {
      const key = m.home + '|' + m.away + '|' + m.consecutive;
      if (!queues.has(key)) queues.set(key, []);
      queues.get(key).push(i);
    });
    const slotByDatetime = new Map(input.calendar.map((c, i) => [c.datetime, i]));
    const plan = new Array(input.matches.length).fill(-1);
    for (const p of input.initialPlan || []) {
      const q = queues.get(p.home + '|' + p.away + '|' + p.consecutive);
      if (!q || !q.length) continue;
      const m = q.shift();
      const slot = slotByDatetime.get(p.datetime);
      plan[m] = slot == null ? -1 : slot;
    }
    return plan;
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /** §8 프로젝트 JSON (2025 프리셋) */
  function buildProject() {
    const input = ENGINE_INPUT_2025;
    const plan = planFromInitialPlan(input);
    const events = presetEvents();
    const matches = input.matches.map((m) => ({ index: m.index, home: m.home, away: m.away, consecutive: m.consecutive, pinned: false }));
    // 개막전 홈 구장 지정: 그 날 홈인 시리즈를 고정한다(서버 자동 편성은 어린이날만 알므로 고정으로 지킨다)
    for (const ev of events) {
      if (ev.mode !== 'STADIUM' || ev.type === 'CHILDREN') continue;
      matches.forEach((m, i) => { if (plan[i] === ev.slot && ev.teams.includes(m.home)) { m.pinned = true; m.eventId = ev.id; } });
    }
    return {
      meta: { schemaVersion: 1, season: 2025, name: '2025 정규시즌 1차안', updatedAt: new Date().toISOString() },
      teams: input.teams.map((t) => ({ index: t.index, name: t.name, stadium: t.stadium, latitude: t.latitude, longitude: t.longitude, color: TEAM_COLORS[t.name] || '#555555' })),
      distanceMatrix: input.distanceMatrix.map((d) => ({ from: d.from, to: d.to, distance: d.distance, estimated: false })),
      settings: clone(DEFAULT_SETTINGS),
      events,
      calendar: KBO.CalendarGen ? KBO.CalendarGen.applyWeights(clone(input.calendar), DEFAULT_SETTINGS) : clone(input.calendar), // 휴일 가중치는 공휴일 표대로 다시 매긴다(엔진 원본 값은 ENGINE_INPUT_2025)
      matches,
      plan: plan.map((c, m) => ({ match: m, calendar: c })),
      games: [],
      reschedule: clone(DEFAULT_RESCHEDULE),
      snapshots: []
    };
  }

  // ───────── 2027 기본 데이터 (예상 일정 · 사용자가 정한 2027 원칙, 모두 스튜디오에서 바꿀 수 있음) ─────────

  /** 「2027 KBO 일정 예상」(2027_kbo_135.md · 엑셀)의 연전 기간: [월-일, 연전 수]. 엑셀 46줄 중 1줄은 올스타 휴식기라 연전 기간은 45개 */
  const SLOTS_2027 = [
    ['03-27', 2], ['03-30', 3], ['04-02', 3], ['04-06', 3], ['04-09', 3], ['04-13', 3], ['04-16', 3], ['04-20', 3], ['04-23', 3], ['04-27', 3],
    ['04-30', 3], ['05-04', 3], ['05-07', 3], ['05-11', 3], ['05-14', 3], ['05-18', 3], ['05-21', 3], ['05-25', 3], ['05-28', 3], ['06-01', 3],
    ['06-04', 3], ['06-08', 3], ['06-11', 3], ['06-15', 3], ['06-18', 3], ['06-22', 3], ['06-25', 3], ['06-29', 3], ['07-02', 3], ['07-06', 3],
    ['07-15', 4], ['07-20', 3], ['07-23', 3], ['07-27', 3], ['07-30', 3], ['08-03', 3], ['08-06', 3], ['08-10', 3], ['08-13', 3], ['08-17', 3],
    ['08-20', 3], ['08-24', 3], ['08-27', 3], ['08-31', 3], ['09-03', 3]
  ];

  /** 2027 홈 73/71: 홈 73 구단(1차 편성 홈 68 · 미편성 홈 5), 나머지 홈 71(67 · 4) */
  const HOME_TOTALS_2027 = { moreTeams: ['한화', 'SSG', 'KT', '롯데', '두산'], more: { total: 73, initial: 68 }, less: { total: 71, initial: 67 } };

  const DEFAULT_SETTINGS_2027 = Object.assign(clone(DEFAULT_SETTINGS), {
    seasonYear: 2027,
    seasonStart: '2027-03-27',
    initialEnd: '2027-09-05',
    seasonEnd: '2027-10-31',
    restWeekdays: [1],
    restExceptions: [],
    blackouts: [{ start: '2027-07-09', end: '2027-07-14', label: '올스타 휴식기' }],
    // 2027 법정 공휴일(시즌 안). 음력·대체공휴일은 인사혁신처 고시로 최종 확인 필요.
    // playOnRest = 휴식 요일(월)이어도 그 날 경기 — 기본은 어린이날만. 8/16(월) 대체공휴일은 기본 경기 없음(켜면 그 날 경기 · 그 주 목 휴식)
    holidays: [
      { date: '2027-05-05', name: '어린이날', weight: 3, playOnRest: true },
      { date: '2027-05-13', name: '부처님오신날', weight: 2, playOnRest: false },
      { date: '2027-06-06', name: '현충일', weight: 2, playOnRest: false },
      { date: '2027-08-15', name: '광복절', weight: 2, playOnRest: false },
      { date: '2027-08-16', name: '광복절 대체공휴일', weight: 2, playOnRest: false },
      { date: '2027-09-14', name: '추석 연휴', weight: 2, playOnRest: false },
      { date: '2027-09-15', name: '추석', weight: 2, playOnRest: false },
      { date: '2027-09-16', name: '추석 연휴', weight: 2, playOnRest: false },
      { date: '2027-10-03', name: '개천절', weight: 2, playOnRest: false },
      { date: '2027-10-04', name: '개천절 대체공휴일', weight: 2, playOnRest: false },
      { date: '2027-10-09', name: '한글날', weight: 2, playOnRest: false },
      { date: '2027-10-11', name: '한글날 대체공휴일', weight: 2, playOnRest: false }
    ],
    allStarStart: '2027-07-09',
    allStarDays: 6,
    homeTotals: HOME_TOTALS_2027,
    seriesMinLength: 3,
    obligationTeams: ['두산', '키움', '한화', '롯데', 'NC']
  });

  const DEFAULT_RESCHEDULE_2027 = Object.assign(clone(DEFAULT_RESCHEDULE), { start: '2027-09-06', end: '2027-10-31' });

  /**
   * 2027 홈 구장 지정. 개막전 3/27: 홈 KT·삼성·KIA·LG·SSG(2026 최종 순위 상위 5개 팀 홈), 기본 대진까지 고정(fix 'pairs').
   * 어린이날 5/5: 홈 두산·키움·한화·롯데·NC(상대는 자동 편성, fix 'home').
   */
  function presetEvents2027() {
    const stadiumOf = (n) => ENGINE_INPUT_2025.teams.find((t) => t.name === n).stadium;
    const order = ENGINE_INPUT_2025.teams.map((t) => t.name);
    const byOrder = (a, b) => order.indexOf(a) - order.indexOf(b);
    const pairs = [{ home: 'KT', away: '한화' }, { home: '삼성', away: 'NC' }, { home: 'KIA', away: '롯데' }, { home: 'LG', away: '키움' }, { home: 'SSG', away: '두산' }];
    const opening = pairs.map((x) => x.home).sort(byOrder);
    const children = ['두산', '키움', '한화', '롯데', 'NC'].sort(byOrder);
    return [
      { id: 'ev-opening', type: 'OPENING', name: '개막전', slot: 0, date: '2027-03-27', mode: 'STADIUM', teams: opening, stadiums: opening.map(stadiumOf), pairs, fix: 'pairs' },
      { id: 'ev-children', type: 'CHILDREN', name: '어린이날', slot: 11, date: '2027-05-05', mode: 'STADIUM', teams: children, stadiums: children.map(stadiumOf), fix: 'home' }
    ];
  }

  /** 2027 연전 기간(휴일 가중치는 공휴일 표대로) */
  function calendar2027(settings) {
    const cal = SLOTS_2027.map(([md, len], i) => ({ index: i, datetime: '2027-' + md + ' 00:00:00', consecutive: len, weekend: 0, holiday: 0 }));
    return KBO.CalendarGen ? KBO.CalendarGen.applyWeights(cal, settings || DEFAULT_SETTINGS_2027) : cal;
  }

  /**
   * §8 프로젝트 JSON (2027 기본 제공 · 예상). 구단·거리는 2025 것. 시리즈는 2027 원칙(generateSeries + homeTotals)으로 만들고,
   * 개막전 대진(fix 'pairs')은 그 연전 기간 시리즈를 고정한다. 원칙이 맞지 않아 시리즈를 못 만들면 시리즈는 비어 있다(오류는 generateSeries로 확인).
   */
  function buildProject2027() {
    const base = buildProject();
    const settings = clone(DEFAULT_SETTINGS_2027);
    const events = presetEvents2027();
    const calendar = calendar2027(settings);
    let matches = [], plan = [];
    if (KBO.CalendarGen) {
      const g = KBO.CalendarGen.generateSeries(base.teams, calendar, { initialGamesPerPair: settings.initialGamesPerPair, homeGamesMajor: settings.homeGamesMajor, settings, events });
      if (!g.errors.length) {
        matches = g.matches.map((m) => ({ index: m.index, home: m.home, away: m.away, consecutive: m.consecutive, pinned: false }));
        plan = g.plan;
        for (const ev of events) {
          if (ev.mode !== 'STADIUM' || ev.fix !== 'pairs') continue;
          matches.forEach((m, i) => { if (plan[i] === ev.slot && (ev.pairs || []).some((x) => x.home === m.home && x.away === m.away)) { m.pinned = true; m.eventId = ev.id; } });
        }
      }
    }
    return {
      meta: { schemaVersion: 1, season: 2027, name: '2027 정규시즌 기본 제공(예상)', updatedAt: new Date().toISOString() },
      teams: base.teams,
      distanceMatrix: base.distanceMatrix,
      settings,
      events,
      calendar,
      matches,
      plan: plan.map((c, m) => ({ match: m, calendar: c })),
      games: [],
      reschedule: clone(DEFAULT_RESCHEDULE_2027),
      snapshots: []
    };
  }

  KBO.Preset2027 = { SLOTS_2027, HOME_TOTALS_2027, DEFAULT_SETTINGS: DEFAULT_SETTINGS_2027, DEFAULT_RESCHEDULE: DEFAULT_RESCHEDULE_2027, presetEvents: presetEvents2027, calendar: calendar2027, buildProject: buildProject2027 };

  KBO.Preset = { ENGINE_INPUT_2025, TEAM_COLORS, STADIUMS, DEFAULT_SETTINGS, DEFAULT_RESCHEDULE, presetEvents, planFromInitialPlan, buildProject };
});
