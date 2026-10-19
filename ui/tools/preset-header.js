/*
 * KBO 공통 코어 — 2025 프리셋 (자동 생성 파일: node tools/build-preset.js <input_2025.json>)
 * input_2025.json 원본, 2025 기본 설정·이벤트, 구장 사전, 구단 색상.
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
    // 5/6(대체공휴일)은 5/5 슬롯 안이라 가중치에 영향이 없다. 6/3(임시공휴일)은 원본 데이터에 반영되지 않아 제외했다.
    holidays: [
      { date: '2025-05-05', name: '어린이날·부처님오신날' },
      { date: '2025-05-06', name: '대체공휴일' },
      { date: '2025-06-06', name: '현충일' },
      { date: '2025-08-15', name: '광복절' },
      { date: '2025-10-03', name: '개천절' },
      { date: '2025-10-05', name: '추석 연휴' },
      { date: '2025-10-06', name: '추석' },
      { date: '2025-10-07', name: '추석 연휴' },
      { date: '2025-10-08', name: '추석 대체공휴일' },
      { date: '2025-10-09', name: '한글날' }
    ],
    gamesPerPair: 16,
    initialGamesPerPair: 15,
    homeGamesMajor: 9,
    remainingHomeRule: 'FEWER_HOME',
    roadFactor: 1.25,
    h0eMode: 'STADIUM',
    obligationTeams: ['두산', '키움', '한화', 'NC', '롯데'],
    referenceDate: '',
    longTripKm: 600,
    solver: { timeLimitSec: 10, unimprovedSec: 5, seed: 42, init: 'KEEP' }
  };

  const DEFAULT_RESCHEDULE = {
    start: '2025-09-01', end: '2025-10-31', allowMonday: true, allowDoubleHeader: true, maxDoubleHeaderPerTeam: 3,
    blackouts: [], units: [], plan: []
  };

  function presetEvents() {
    const opening = ENGINE_INPUT_2025.initialPlan.filter((p) => p.datetime.startsWith('2025-03-22'));
    const events = opening.map((p, i) => ({ id: 'ev-open-' + (i + 1), type: 'OPENING', name: '개막전', slot: 0, date: '2025-03-22', mode: 'MATCH', home: p.home, away: p.away }));
    events.push({ id: 'ev-children', type: 'CHILDREN', name: '어린이날', slot: 13, date: '2025-05-05', mode: 'STADIUM', stadiums: ['잠실종합운동장', '고척돔야구장', '한화이글스파크', '창원NC파크', '사직야구장'] });
    return events;
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
    // 개막전 대진 고정 (BaseballApp.setInitialPlan과 동일)
    for (const ev of events) {
      if (ev.mode !== 'MATCH') continue;
      const mi = matches.findIndex((m, i) => m.home === ev.home && m.away === ev.away && plan[i] === ev.slot);
      if (mi >= 0) { matches[mi].pinned = true; matches[mi].eventId = ev.id; }
    }
    return {
      meta: { schemaVersion: 1, season: 2025, name: '2025 정규시즌 1차안', updatedAt: new Date().toISOString() },
      teams: input.teams.map((t) => ({ index: t.index, name: t.name, stadium: t.stadium, latitude: t.latitude, longitude: t.longitude, color: TEAM_COLORS[t.name] || '#555555' })),
      distanceMatrix: input.distanceMatrix.map((d) => ({ from: d.from, to: d.to, distance: d.distance, estimated: false })),
      settings: clone(DEFAULT_SETTINGS),
      events,
      calendar: clone(input.calendar),
      matches,
      plan: plan.map((c, m) => ({ match: m, calendar: c })),
      games: [],
      reschedule: clone(DEFAULT_RESCHEDULE),
      snapshots: []
    };
  }

  KBO.Preset = { ENGINE_INPUT_2025, TEAM_COLORS, STADIUMS, DEFAULT_SETTINGS, DEFAULT_RESCHEDULE, presetEvents, planFromInitialPlan, buildProject };
});
