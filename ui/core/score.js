/*
 * KBO 공통 코어 — JS 채점기.
 * ScoreFormulas.evaluate(Java)를 1:1 포팅한다(§6). BendableLongScore Hard 2단계 · Soft 5단계.
 *  - evaluate(): 탐색용 고속 경로 (형식화 배열, 할당 최소화)
 *  - explain():  화면용 상세 경로 (위반 목록, 구단 지표, Soft 분해)
 * 두 경로의 점수가 같은지는 core/test에서 무작위 배정으로 교차 검증한다.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).score = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  const OBJECTIVE_NAMES = ['moves', 'distance', 'holiday', 'total'];
  const DISTANCE_TOLERANCE_TENTHS = 3000; // 300km
  const MOVE_TOLERANCE = 2;               // Constants.TOLERANCE.TOTAL_MOVE
  const HOLIDAY_TOLERANCE = 1.5;          // Constants.TOLERANCE.HOLIDAY
  const WEEKDAY_MOVE_TOLERANCE = 1.5;     // Constants.TOLERANCE.WEEKDAY_MOVE (점수 미반영, 참고)
  const ENGINE_OBLIGATION = ['두산', '키움', '한화', 'NC', '롯데']; // Constants.HOME_OBLIGATION_CHILDREN

  const HARD_RULES = [
    { code: 'H0-a', level: 0, label: '모든 구단 출전', desc: '연전 기간마다 서로 다른 구단 N개가 모두 출전해야 합니다.' },
    { code: 'H0-b', level: 0, label: '한 구장에 두 경기', desc: '연전 기간마다 서로 다른 구장 N/2곳을 써야 합니다(같이 쓰는 구장은 1곳으로 셈).' },
    { code: 'H0-c', level: 0, label: '기간별 시리즈 수', desc: '연전 기간마다 시리즈가 N/2개여야 합니다.' },
    { code: 'H0-d', level: 0, label: '연전 수 불일치', desc: '시리즈 연전 수와 연전 기간의 연전 수가 같아야 합니다.' },
    { code: 'H0-e', level: 0, label: '지정 구장 홈 경기', desc: '구장을 지정한 특별 경기 날에는 그 구장 연고 구단이 홈이어야 합니다.' },
    { code: 'H0-f', level: 0, label: '홈/원정 4연속 이상', desc: '같은 구단의 홈 또는 원정 연속은 최대 3시리즈입니다.' },
    { code: 'H1', level: 1, label: '같은 대진 연속', desc: '바로 앞 연전과 같은 대진을 이어서 잡을 수 없습니다.' }
  ];
  const SOFT_RULES = [
    { code: 'S0', label: '일정 미정 시리즈', unit: '개' },
    { code: 'S1', label: '이동 횟수 고르게', unit: '' },
    { code: 'S2', label: '이동거리 고르게', unit: '' },
    { code: 'S3', label: '휴일 경기 고르게', unit: '' },
    { code: 'S4', label: '리그 전체 이동거리', unit: 'km' }
  ];
  const RULE_BY_CODE = {};
  for (const r of HARD_RULES) RULE_BY_CODE[r.code] = r;

  /** BigDecimal.movePointRight(1).setScale(0, HALF_UP) */
  function toTenths(distance) {
    if (distance == null || distance === '') return 0;
    const v = Number(distance);
    if (!Number.isFinite(v)) return 0;
    const scaled = Number((v * 10).toFixed(6));
    return scaled >= 0 ? Math.floor(scaled + 0.5) : -Math.floor(-scaled + 0.5);
  }

  function dayNum(str) { return KBO.Dates.dayNum(str); }

  function planArrayFrom(project) {
    const M = project.matches.length;
    const plan = new Int32Array(M).fill(-1);
    const S = project.calendar.length;
    for (const p of project.plan || []) {
      if (p == null || p.match == null) continue;
      const c = p.calendar;
      if (c == null || c < 0 || c >= S) continue;
      if (p.match >= 0 && p.match < M) plan[p.match] = c;
    }
    return plan;
  }

  function planListFrom(arr) {
    const out = [];
    for (let m = 0; m < arr.length; m++) out.push({ match: m, calendar: arr[m] >= 0 ? arr[m] : -1 });
    return out;
  }

  /** 이벤트의 슬롯 인덱스: slot이 유효하고 date와 맞으면 slot, 아니면 date로 찾는다. */
  function resolveEventSlot(ev, calendar) {
    if (ev.date) {
      const idx = KBO.CalendarGen ? KBO.CalendarGen.slotIndexOfDate(calendar, ev.date) : -1;
      if (idx >= 0) return idx;
    }
    if (Number.isInteger(ev.slot) && ev.slot >= 0 && ev.slot < calendar.length) return ev.slot;
    return -1;
  }

  /**
   * 엔진 호환 기준(H0-e)의 연전 기간별 홈 의무 구단 — Java ProblemCodec.applyHomeDesignations와 같은 규칙.
   * - STADIUM 이벤트의 teams(없으면 pairs[].home)를 그 날짜가 든 연전 기간에 모은다(대진 고정 fix 'pairs'도 같다).
   * - 어린이날(CHILDREN)은 teams가 일부(구단 수/2 미만)만 고른 것이 아니면 settings.obligationTeams(구단 수/2개)가 있을 때 그것(teams가 없을 때도).
   * - teams: [](대진 목록도 없음)는 「지정 없음」 — 그 날은 아무것도 지키지 않는다. 어린이날도 같다.
   * - STADIUM 이벤트가 하나도 없으면 예전 방식: 시즌 해 5/5가 든 연전 기간에 obligationTeams(없으면 기본 5구단).
   * @returns [{ slot, teams: [구단 인덱스], eventId, name }] (연전 기간마다 하나)
   */
  function engineObligations(project, teamIndexOpt) {
    const teamIndex = teamIndexOpt || new Map((project.teams || []).map((t, i) => [t.name, i]));
    const cal = project.calendar || [];
    const half = (project.teams || []).length >> 1;
    const legacy = (settings) => {
      const names = settings && settings.obligationTeams;
      return names && names.length === half && names.every((n) => teamIndex.has(n)) ? names : null;
    };
    const oblNames = legacy(project.settings);
    const toIdx = (names) => names.map((n) => teamIndex.get(n)).filter((i) => i != null);
    const evs = (project.events || []).filter((e) => e && e.mode === 'STADIUM');
    if (!evs.length) {
      if (!cal.length) return [];
      const first = cal.reduce((a, c) => (dayNum(c.datetime) < dayNum(a.datetime) ? c : a), cal[0]);
      const slot = resolveEventSlot({ date: String(first.datetime).slice(0, 4) + '-05-05' }, cal);
      return slot < 0 ? [] : [{ slot, teams: toIdx(oblNames || ENGINE_OBLIGATION), eventId: null, name: '어린이날' }];
    }
    const bySlot = new Map();
    for (const ev of evs) {
      let names = (ev.teams || []).filter(Boolean);
      if (!names.length) names = (ev.pairs || []).map((p) => p && p.home).filter(Boolean);
      if (ev.type === 'CHILDREN' && oblNames && (names.length >= half || (!names.length && ev.teams == null))) names = oblNames;
      if (!names.length) continue;
      const slot = resolveEventSlot(ev, cal);
      if (slot < 0) continue;
      let entry = bySlot.get(slot);
      if (!entry) { entry = { slot, teams: [], eventId: ev.id, name: ev.name }; bySlot.set(slot, entry); }
      for (const t of toIdx(names)) if (entry.teams.indexOf(t) < 0) entry.teams.push(t);
    }
    return Array.from(bySlot.values());
  }

  /**
   * 프로젝트(§8) → 채점 입력. 구조적 복제 가능한 평범한 객체라 Worker로 그대로 보낼 수 있다.
   */
  function buildInput(project, overrides) {
    const o = overrides || {};
    const settings = project.settings || {};
    const teams = project.teams.map((t) => ({ name: t.name, stadium: t.stadium || '' }));
    const N = teams.length;
    const teamIndex = new Map(teams.map((t, i) => [t.name, i]));
    const stadiumIndexByName = new Map();
    const stadiumOf = teams.map((t) => {
      if (!stadiumIndexByName.has(t.stadium)) stadiumIndexByName.set(t.stadium, stadiumIndexByName.size);
      return stadiumIndexByName.get(t.stadium);
    });
    const dist = [];
    for (let i = 0; i < N; i++) dist.push(new Array(N).fill(0));
    for (const d of project.distanceMatrix || []) {
      const a = teamIndex.get(d.from);
      const b = teamIndex.get(d.to);
      if (a == null || b == null) continue;
      dist[a][b] = toTenths(d.distance);
    }
    const slots = project.calendar.map((c) => ({
      day: dayNum(c.datetime), consecutive: c.consecutive | 0, weekend: c.weekend | 0, holiday: c.holiday | 0
    }));
    const matches = project.matches.map((m) => ({
      home: teamIndex.has(m.home) ? teamIndex.get(m.home) : -1,
      away: teamIndex.has(m.away) ? teamIndex.get(m.away) : -1,
      consecutive: m.consecutive | 0,
      pinned: !!m.pinned
    }));
    const mode = o.h0eMode || settings.h0eMode || 'STADIUM';
    const h0e = [];
    for (const ev of project.events || []) {
      if (ev.mode !== 'STADIUM') continue;
      const slot = resolveEventSlot(ev, project.calendar);
      if (slot < 0) continue;
      const stadiums = (ev.stadiums || []).filter((s) => stadiumIndexByName.has(s));
      const groups = stadiums.map((s) => teams.map((t, i) => (t.stadium === s ? i : -1)).filter((i) => i >= 0));
      h0e.push({ eventId: ev.id, name: ev.name, slot, stadiums, groups });
    }
    const holidays = [];
    for (const h of settings.holidays || []) {
      const d = dayNum(typeof h === 'string' ? h : h.date);
      if (Number.isFinite(d)) holidays.push(d);
    }
    const numOr = (v, d) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);
    return {
      teams, stadiumOf, dist, slots, matches, h0eMode: mode, h0e, engineObligation: engineObligations(project, teamIndex), holidays,
      longTripTenths: Math.round((settings.longTripKm || 600) * 10),
      // 평준화 허용오차(손잡이). 엔진 ScoreSettings와 같은 의미·기본값
      distanceToleranceTenths: Math.round(numOr(o.distanceToleranceKm != null ? o.distanceToleranceKm : settings.distanceToleranceKm, DISTANCE_TOLERANCE_TENTHS / 10) * 10),
      holidayTolerance: numOr(settings.holidayTolerance, HOLIDAY_TOLERANCE),
      moveTolerance: numOr(settings.moveTolerance, MOVE_TOLERANCE),
      objective: objectiveOf(settings)
    };
  }

  /** settings.objective(목적식 순서 · 허용 차이). 엔진 ProblemCodec.objectiveSettings와 같은 뜻·기본값. 없으면 null(기존 방식) */
  function objectiveOf(settings) {
    const o = settings.objective;
    if (!o || !Array.isArray(o.order)) return null;
    const gapOr = (v, d) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
    return {
      order: o.order.map((n) => OBJECTIVE_NAMES.indexOf(n)),
      moveGap: gapOr(o.moveGap, 4),
      distanceGapTenths: Math.round(gapOr(o.distanceGapKm, 600) * 10),
      holidayGap: gapOr(o.holidayGap, 3)
    };
  }

  /** 가장 많은·적은 구단 차이가 gap 안이면 0. 모든 두 구단을 세어, 끝 값이 아닌 구단이 움직여도 점수가 변한다(엔진 scaledGapPenalty와 같음) */
  function scaledGapPenalty(values, n, gap) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const excess = Math.abs(values[i] - values[j]) - gap;
        if (excess > 0) sum += excess * excess;
      }
    }
    return Math.round(sum * 100);
  }

  function distanceGapPenalty(values, n, gapTenths) {
    let hundredths = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const excess = Math.abs(values[i] - values[j]) - gapTenths;
        if (excess > 0) hundredths += excess * excess;
      }
    }
    return Math.floor(hundredths / 100);
  }

  /** 목적식별 벌점 [이동 횟수, 이동 거리, 주말·공휴일, 전체 거리]를 순위대로 놓는다 */
  function objectiveSoft(ctx, moveCount, distTenths, holidayW, N, sumTenths) {
    const ob = ctx.input.objective;
    const totals = [scaledGapPenalty(moveCount, N, ob.moveGap), distanceGapPenalty(distTenths, N, ob.distanceGapTenths), scaledGapPenalty(holidayW, N, ob.holidayGap), Math.floor(sumTenths / 10)];
    return ob.order.map((i) => totals[i]);
  }

  /** 채점 입력 → 고속 평가용 컨텍스트 (형식화 배열 + 재사용 버퍼) */
  function createContext(input) {
    const N = input.teams.length;
    const S = input.slots.length;
    const M = input.matches.length;
    if (N > 31) throw new Error('구단 수는 31개 이하여야 합니다.');
    const ctx = {
      input, N, S, M,
      home: new Int32Array(M), away: new Int32Array(M), len: new Int32Array(M), pinned: new Uint8Array(M),
      pairKey: new Int32Array(M),
      stadiumOf: Int32Array.from(input.stadiumOf),
      dist: new Int32Array(N * N),
      slotLen: new Int32Array(S), slotHoliday: new Int32Array(S), slotWeekend: new Int32Array(S), slotDay: new Int32Array(S),
      teamsPerDay: N, stadiumsPerDay: N >> 1, seriesPerDay: N >> 1,
      // 재사용 버퍼
      teamMask: new Int32Array(S), stadiumMask: new Int32Array(S), homeMask: new Int32Array(S),
      seriesCount: new Int32Array(S), lengthMismatch: new Int32Array(S),
      slotHead: new Int32Array(S), nextInSlot: new Int32Array(M),
      cellCount: new Int32Array(N * S), cellFirst: new Int32Array(N * S),
      stamp: new Int32Array(N * N), stampGen: 1,
      moveCount: new Float64Array(N), distTenths: new Float64Array(N), holidayW: new Float64Array(N),
      h0e: input.h0e || [], h0eMode: input.h0eMode || 'STADIUM',
      h0eBySlot: null, oblMaskBySlot: new Int32Array(S), oblBySlot: new Array(S),
      distanceToleranceTenths: input.distanceToleranceTenths || DISTANCE_TOLERANCE_TENTHS,
      holidayTolerance: input.holidayTolerance || HOLIDAY_TOLERANCE,
      moveTolerance: input.moveTolerance || MOVE_TOLERANCE
    };
    for (let m = 0; m < M; m++) {
      const mt = input.matches[m];
      ctx.home[m] = mt.home; ctx.away[m] = mt.away; ctx.len[m] = mt.consecutive; ctx.pinned[m] = mt.pinned ? 1 : 0;
      const a = Math.min(mt.home, mt.away);
      const b = Math.max(mt.home, mt.away);
      ctx.pairKey[m] = a * N + b;
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) ctx.dist[i * N + j] = input.dist[i][j];
    for (let s = 0; s < S; s++) {
      const sl = input.slots[s];
      ctx.slotLen[s] = sl.consecutive; ctx.slotHoliday[s] = sl.holiday; ctx.slotWeekend[s] = sl.weekend; ctx.slotDay[s] = sl.day;
    }
    // H0-e: 슬롯별 이벤트 목록
    const bySlot = new Array(S);
    for (const ev of ctx.h0e) {
      if (ev.slot < 0 || ev.slot >= S) continue;
      (bySlot[ev.slot] || (bySlot[ev.slot] = [])).push(ev);
      ev.groupMasks = ev.groups.map((g) => g.reduce((acc, t) => acc | (1 << t), 0));
    }
    ctx.h0eBySlot = bySlot;
    // 엔진 호환 기준: 연전 기간별 홈 의무 구단 마스크
    for (const ob of input.engineObligation || []) {
      if (ob.slot < 0 || ob.slot >= S) continue;
      let mask = 0;
      for (const t of ob.teams) mask |= 1 << t;
      ctx.oblMaskBySlot[ob.slot] = mask;
      ctx.oblBySlot[ob.slot] = ob;
    }
    return ctx;
  }

  function setH0eMode(ctx, mode) { ctx.h0eMode = mode; }

  function popcount(x) {
    x -= (x >>> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
  }

  /** H0-e 슬롯 감점 (구장 기준: 지정 구장마다 연고 구단 홈이 없으면 1 / 엔진 호환: 홈 의무 구단의 원정 시리즈마다 1) */
  function h0ePenaltySlot(ctx, s) {
    let p = 0;
    if (ctx.h0eMode === 'ENGINE') {
      const mask = ctx.oblMaskBySlot[s];
      if (!mask) return 0;
      for (let m = ctx.slotHead[s]; m >= 0; m = ctx.nextInSlot[m]) {
        if (mask & (1 << ctx.away[m])) p++;
      }
      return p;
    }
    const evs = ctx.h0eBySlot[s];
    if (!evs) return 0;
    const hm = ctx.homeMask[s];
    for (const ev of evs) for (const gm of ev.groupMasks) if ((hm & gm) === 0) p++;
    return p;
  }

  function squaredFloorTolerance(values, n, tolerance) {
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[i];
    const mean = sum / n;
    let variance = 0;
    for (let i = 0; i < n; i++) {
      const steps = Math.floor(Math.abs(values[i] - mean) / tolerance);
      variance += steps * steps;
    }
    return variance;
  }

  function distanceVariance(values, n, toleranceTenths) {
    const tol = toleranceTenths || DISTANCE_TOLERANCE_TENTHS;
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[i];
    const mean = Math.trunc(sum / n);
    let hundredths = 0;
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(values[i] - mean);
      if (diff > tol) {
        const ex = diff - tol;
        hundredths += ex * ex;
      }
    }
    return Math.floor(hundredths / 100);
  }

  /**
   * 고속 평가. plan: Int32Array(M) 슬롯 인덱스 또는 -1(미배정).
   * out: 길이 7 배열 [h0, h1, s0, s1, s2, s3, s4] (모두 0 이하)
   */
  function evaluate(ctx, plan, out) {
    const { N, S, M, home, away, len, stadiumOf, slotLen } = ctx;
    const teamMask = ctx.teamMask, stadiumMask = ctx.stadiumMask, homeMask = ctx.homeMask;
    const seriesCount = ctx.seriesCount, lengthMismatch = ctx.lengthMismatch;
    const slotHead = ctx.slotHead, nextInSlot = ctx.nextInSlot;
    const cellCount = ctx.cellCount, cellFirst = ctx.cellFirst;
    teamMask.fill(0); stadiumMask.fill(0); homeMask.fill(0); seriesCount.fill(0); lengthMismatch.fill(0);
    slotHead.fill(-1); cellCount.fill(0);
    let soft0 = 0;
    // 매치 인덱스 오름차순 → 체인을 역순으로 쌓기 위해 뒤에서부터 넣는다(체인이 인덱스 오름차순이 된다)
    for (let m = M - 1; m >= 0; m--) {
      const s = plan[m];
      if (s < 0 || s >= S) continue;
      nextInSlot[m] = slotHead[s];
      slotHead[s] = m;
    }
    for (let m = 0; m < M; m++) {
      const s = plan[m];
      if (s < 0 || s >= S) { soft0++; continue; }
      const h = home[m], a = away[m];
      teamMask[s] |= (1 << h) | (1 << a);
      stadiumMask[s] |= 1 << stadiumOf[h];
      homeMask[s] |= 1 << h;
      seriesCount[s]++;
      if (len[m] !== slotLen[s]) lengthMismatch[s]++;
      let cell = h * S + s;
      if (cellCount[cell]++ === 0) cellFirst[cell] = m;
      if (a !== h) {
        cell = a * S + s;
        if (cellCount[cell]++ === 0) cellFirst[cell] = m;
      }
    }
    let hard0 = 0, hard1 = 0;
    const stamp = ctx.stamp, pairKey = ctx.pairKey;
    for (let s = 0; s < S; s++) {
      if (seriesCount[s] === 0) continue;
      hard0 += Math.abs(popcount(teamMask[s]) - ctx.teamsPerDay);
      hard0 += Math.abs(popcount(stadiumMask[s]) - ctx.stadiumsPerDay);
      hard0 += Math.abs(seriesCount[s] - ctx.seriesPerDay);
      hard0 += lengthMismatch[s];
      if (ctx.h0eBySlot[s] || ctx.oblMaskBySlot[s]) hard0 += h0ePenaltySlot(ctx, s);
      if (s > 0 && seriesCount[s - 1] > 0) {
        const gen = ++ctx.stampGen;
        for (let m = slotHead[s - 1]; m >= 0; m = nextInSlot[m]) stamp[pairKey[m]] = gen;
        for (let m = slotHead[s]; m >= 0; m = nextInSlot[m]) if (stamp[pairKey[m]] === gen) hard1++;
      }
    }
    // 구단 경로 (슬롯 순, 같은 슬롯 안에서는 매치 인덱스 순)
    const dist = ctx.dist, slotHoliday = ctx.slotHoliday;
    const moveCount = ctx.moveCount, distTenths = ctx.distTenths, holidayW = ctx.holidayW;
    let streakTotal = 0;
    for (let t = 0; t < N; t++) {
      let prevLoc = -1, prevHome = false, run = 0, d = 0, mv = 0, hol = 0;
      const base = t * S;
      for (let s = 0; s < S; s++) {
        const c = cellCount[base + s];
        if (c === 0) continue;
        if (c === 1) {
          const m = cellFirst[base + s];
          const isHome = home[m] === t;
          const loc = home[m];
          if (prevLoc < 0) { run = 1; } else {
            const leg = dist[prevLoc * N + loc];
            d += leg; if (leg > 0) mv++;
            if (isHome === prevHome) { run++; if (run > 3) streakTotal++; } else run = 1;
          }
          if (isHome && slotHoliday[s] > 0) hol += slotHoliday[s];
          prevHome = isHome; prevLoc = loc;
        } else {
          for (let m = slotHead[s]; m >= 0; m = nextInSlot[m]) {
            if (home[m] !== t && away[m] !== t) continue;
            const isHome = home[m] === t;
            const loc = home[m];
            if (prevLoc < 0) { run = 1; } else {
              const leg = dist[prevLoc * N + loc];
              d += leg; if (leg > 0) mv++;
              if (isHome === prevHome) { run++; if (run > 3) streakTotal++; } else run = 1;
            }
            if (isHome && slotHoliday[s] > 0) hol += slotHoliday[s];
            prevHome = isHome; prevLoc = loc;
          }
        }
      }
      moveCount[t] = mv; distTenths[t] = d; holidayW[t] = hol;
    }
    hard0 += streakTotal;
    let sumTenths = 0;
    for (let t = 0; t < N; t++) sumTenths += distTenths[t];
    const o = out || new Array(7);
    o[0] = -hard0;
    o[1] = -hard1;
    o[2] = -soft0;
    if (ctx.input.objective) {
      const ranked = objectiveSoft(ctx, moveCount, distTenths, holidayW, N, sumTenths);
      for (let i = 0; i < 4; i++) o[3 + i] = -ranked[i];
      return o;
    }
    o[3] = -squaredFloorTolerance(moveCount, N, ctx.moveTolerance) * 100;
    o[4] = -distanceVariance(distTenths, N, ctx.distanceToleranceTenths);
    o[5] = -squaredFloorTolerance(holidayW, N, ctx.holidayTolerance);
    o[6] = -Math.floor(sumTenths / 10);
    return o;
  }

  /** 사전식 비교. a가 더 좋으면 양수 */
  function compare(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  function toScore(arr, hardLevels) {
    const h = hardLevels || 2;
    return { hard: Array.from(arr.slice(0, h)), soft: Array.from(arr.slice(h)) };
  }

  function flat(score) { return score.hard.concat(score.soft); }

  /** OptaPlanner BendableLongScore 표기 */
  function scoreString(score) {
    return '[' + score.hard.join('/') + ']hard/[' + score.soft.join('/') + ']soft';
  }

  function isFeasible(score) { return score.hard.every((v) => v === 0); }

  // ───────────────────────── 상세 경로 ─────────────────────────

  /**
   * 화면용 상세 채점. 점수, 위반 목록, 구단 지표, Soft 분해, 슬롯 통계를 돌려준다.
   * project: §8 프로젝트(이름 표시용), ctx: createContext 결과, plan: Int32Array
   */
  function explain(ctx, plan, project) {
    const { N, S, M, input } = ctx;
    const teamName = (i) => (input.teams[i] ? input.teams[i].name : '?');
    const slotLabel = (s) => KBO.Dates.fmtDate(ctx.slotDay[s]) + ' ' + ctx.slotLen[s] + '연전';
    const bySlot = [];
    for (let s = 0; s < S; s++) bySlot.push([]);
    const unassigned = [];
    for (let m = 0; m < M; m++) {
      const s = plan[m];
      if (s < 0 || s >= S) unassigned.push(m); else bySlot[s].push(m);
    }
    const violations = [];
    const matchFlags = new Array(M);
    for (let m = 0; m < M; m++) matchFlags[m] = [];
    const slotHard = new Array(S).fill(0);
    let vid = 0;
    function add(v) {
      v.id = 'v' + (vid++);
      v.level = RULE_BY_CODE[v.code].level;
      v.label = RULE_BY_CODE[v.code].label;
      violations.push(v);
      for (const m of v.matches || []) if (matchFlags[m].indexOf(v.code) < 0) matchFlags[m].push(v.code);
      if (v.slot != null && v.slot >= 0) slotHard[v.slot] += v.amount;
    }
    const slotStats = [];
    for (let s = 0; s < S; s++) {
      const list = bySlot[s];
      const teamCount = new Array(N).fill(0);
      const stadiumUse = new Map();
      for (const m of list) {
        teamCount[ctx.home[m]]++;
        if (ctx.away[m] !== ctx.home[m]) teamCount[ctx.away[m]]++;
        const st = ctx.stadiumOf[ctx.home[m]];
        if (!stadiumUse.has(st)) stadiumUse.set(st, []);
        stadiumUse.get(st).push(m);
      }
      const uniqTeams = teamCount.filter((c) => c > 0).length;
      slotStats.push({ slot: s, series: list.length, teams: uniqTeams, stadiums: stadiumUse.size, hard: 0 });
      if (list.length === 0) continue;
      // H0-a
      if (uniqTeams !== ctx.teamsPerDay) {
        const missing = [];
        const dup = [];
        for (let t = 0; t < N; t++) { if (teamCount[t] === 0) missing.push(teamName(t)); else if (teamCount[t] > 1) dup.push(teamName(t)); }
        const parts = [];
        if (missing.length) parts.push('휴식: ' + missing.join('·'));
        if (dup.length) parts.push('중복 출전: ' + dup.join('·'));
        add({ code: 'H0-a', slot: s, matches: list.filter((m) => teamCount[ctx.home[m]] > 1 || teamCount[ctx.away[m]] > 1), amount: Math.abs(uniqTeams - ctx.teamsPerDay),
          message: slotLabel(s) + ' 출전 구단 ' + uniqTeams + '/' + ctx.teamsPerDay + (parts.length ? ' (' + parts.join(', ') + ')' : '') });
      }
      // H0-b
      if (stadiumUse.size !== ctx.stadiumsPerDay) {
        const shared = [];
        const sharedMatches = [];
        for (const [st, ms] of stadiumUse) {
          const owners = new Set(ms.map((m) => ctx.home[m]));
          if (ms.length > 1) { shared.push(input.teams[ctx.home[ms[0]]].stadium + '(' + Array.from(owners).map(teamName).join('·') + ')'); sharedMatches.push(...ms); }
        }
        add({ code: 'H0-b', slot: s, matches: sharedMatches, amount: Math.abs(stadiumUse.size - ctx.stadiumsPerDay),
          message: slotLabel(s) + ' 사용 구장 ' + stadiumUse.size + '/' + ctx.stadiumsPerDay + (shared.length ? ' — 한 구장에 두 경기: ' + shared.join(', ') : '') });
      }
      // H0-c
      if (list.length !== ctx.seriesPerDay) {
        add({ code: 'H0-c', slot: s, matches: list.length > ctx.seriesPerDay ? list.slice() : [], amount: Math.abs(list.length - ctx.seriesPerDay),
          message: slotLabel(s) + ' 시리즈 ' + list.length + '/' + ctx.seriesPerDay + (list.length > ctx.seriesPerDay ? ' (과밀)' : ' (부족)') });
      }
      // H0-d
      for (const m of list) {
        if (ctx.len[m] !== ctx.slotLen[s]) {
          add({ code: 'H0-d', slot: s, matches: [m], amount: 1, message: slotLabel(s) + ' — ' + teamName(ctx.away[m]) + ' vs ' + teamName(ctx.home[m]) + ' ' + ctx.len[m] + '연전 시리즈가 ' + ctx.slotLen[s] + '연전 기간에 있음' });
        }
      }
      // H0-e
      const ob = ctx.h0eMode === 'ENGINE' ? ctx.oblBySlot[s] : null;
      if (ob) {
        for (const m of list) {
          if (ctx.oblMaskBySlot[s] & (1 << ctx.away[m])) {
            add({ code: 'H0-e', slot: s, matches: [m], teams: [ctx.away[m]], amount: 1, eventId: ob.eventId,
              message: slotLabel(s) + ' ' + ob.name + ' — 홈 구장 지정 구단 ' + teamName(ctx.away[m]) + '이(가) 원정 (엔진 호환 기준)' });
          }
        }
      }
      for (const ev of ctx.h0eMode === 'ENGINE' ? [] : ctx.h0eBySlot[s] || []) {
        ev.groups.forEach((g, gi) => {
          const homeTeams = list.filter((m) => g.indexOf(ctx.home[m]) >= 0);
          if (homeTeams.length === 0) {
            const awayMs = list.filter((m) => g.indexOf(ctx.away[m]) >= 0);
            add({ code: 'H0-e', slot: s, matches: awayMs, teams: g.slice(), amount: 1, eventId: ev.eventId,
              message: slotLabel(s) + ' ' + ev.name + ' — ' + ev.stadiums[gi] + ' 연고 구단(' + g.map(teamName).join('·') + ') 중 홈 경기 없음' });
          }
        });
      }
      // H1
      if (s > 0 && bySlot[s - 1].length > 0) {
        const prevPairs = new Set(bySlot[s - 1].map((m) => ctx.pairKey[m]));
        for (const m of list) {
          if (prevPairs.has(ctx.pairKey[m])) {
            const pm = bySlot[s - 1].find((x) => ctx.pairKey[x] === ctx.pairKey[m]);
            add({ code: 'H1', slot: s, matches: [m, pm], amount: 1, message: slotLabel(s) + ' — ' + teamName(ctx.home[m]) + '·' + teamName(ctx.away[m]) + ' 대진이 바로 앞 연전(' + slotLabel(s - 1) + ')에 이어 또 잡힘' });
          }
        }
      }
    }
    // 구단 경로
    const teamMetrics = [];
    const holidayDays = new Set(input.holidays || []);
    for (let t = 0; t < N; t++) {
      const visits = [];
      for (let s = 0; s < S; s++) {
        for (const m of bySlot[s]) if (ctx.home[m] === t || ctx.away[m] === t) visits.push({ slot: s, match: m });
      }
      let prevLoc = -1, prevHome = false, run = 0, d = 0, mv = 0, hol = 0, streak = 0, cum = 0;
      let weekendHome = 0, weekendAway = 0, weekdayMoves = 0, weekdayMoveTenths = 0, holidayHomeGames = 0;
      let homeSeries = 0, awaySeries = 0, homeGames = 0, awayGames = 0, summerAway = 0, summerAwayTenths = 0;
      let maxHomeRun = 0, maxAwayRun = 0;
      const runs = [];
      let curRun = null;
      const out = [];
      for (let k = 0; k < visits.length; k++) {
        const { slot: s, match: m } = visits[k];
        const isHome = ctx.home[m] === t;
        const loc = ctx.home[m];
        const opp = isHome ? ctx.away[m] : ctx.home[m];
        let leg = 0;
        if (prevLoc < 0) { run = 1; } else {
          leg = ctx.dist[prevLoc * N + loc];
          d += leg; if (leg > 0) mv++;
          if (isHome === prevHome) { run++; if (run > 3) streak++; } else run = 1;
          const prevSlot = visits[k - 1].slot;
          if (ctx.slotWeekend[prevSlot] === 0 && ctx.slotWeekend[s] === 1 && leg > 0) { weekdayMoves++; weekdayMoveTenths += leg; }
        }
        cum += leg;
        if (isHome && ctx.slotHoliday[s] > 0) hol += ctx.slotHoliday[s];
        if (!curRun || curRun.home !== isHome) { curRun = { home: isHome, start: k, length: 0, slots: [] }; runs.push(curRun); }
        curRun.length++; curRun.slots.push(s);
        if (isHome) { homeSeries++; homeGames += ctx.len[m]; maxHomeRun = Math.max(maxHomeRun, curRun.length); } else { awaySeries++; awayGames += ctx.len[m]; maxAwayRun = Math.max(maxAwayRun, curRun.length); }
        if (ctx.slotWeekend[s] === 1) { if (isHome) weekendHome++; else weekendAway++; }
        for (let i = 0; i < ctx.slotLen[s]; i++) if (isHome && holidayDays.has(ctx.slotDay[s] + i)) holidayHomeGames++;
        const mon = KBO.Dates.month(ctx.slotDay[s]);
        if (!isHome && (mon === 7 || mon === 8)) { summerAway += ctx.len[m]; }
        if ((mon === 7 || mon === 8) && leg > 0) summerAwayTenths += leg;
        out.push({ slot: s, match: m, home: isHome, opp, loc, legTenths: leg, cumTenths: cum, run: run });
        prevHome = isHome; prevLoc = loc;
      }
      // FR-A10 장거리 연속 원정
      const longTrips = [];
      for (const r of runs) {
        if (r.home || r.length < 2) continue;
        let sum = 0;
        for (let k = r.start; k < r.start + r.length; k++) sum += out[k].legTenths;
        if (sum > input.longTripTenths) longTrips.push({ slots: r.slots.slice(), series: r.length, tenths: sum });
      }
      teamMetrics.push({
        team: t, name: teamName(t),
        distanceTenths: d, distanceKm: d / 10, moves: mv, holidayWeight: hol, streakPenalty: streak,
        weekendHome, weekendAway, weekdayMoves, weekdayMoveKm: weekdayMoveTenths / 10, holidayHomeGames,
        homeSeries, awaySeries, homeGames, awayGames, maxHomeRun, maxAwayRun,
        summerAwayGames: summerAway, summerMoveKm: summerAwayTenths / 10,
        visits: out, runs, longTrips
      });
      // H0-f 위반
      for (const r of runs) {
        if (r.length > 3) {
          const excessSlots = r.slots.slice(3);
          const ms = out.slice(r.start + 3, r.start + r.length).map((v) => v.match);
          add({ code: 'H0-f', slot: excessSlots[0], slots: excessSlots, matches: ms, teams: [t], amount: r.length - 3,
            message: teamName(t) + ' ' + (r.home ? '홈' : '원정') + ' ' + r.length + '연속 (' + slotLabel(r.slots[0]) + ' ~ ' + slotLabel(r.slots[r.slots.length - 1]) + ')' });
        }
      }
    }
    // Soft 분해
    const mv = teamMetrics.map((x) => x.moves);
    const dt = teamMetrics.map((x) => x.distanceTenths);
    const hw = teamMetrics.map((x) => x.holidayWeight);
    const meanMv = N ? mv.reduce((a, b) => a + b, 0) / N : 0;
    const meanHw = N ? hw.reduce((a, b) => a + b, 0) / N : 0;
    const sumDt = dt.reduce((a, b) => a + b, 0);
    const meanDt = N ? Math.trunc(sumDt / N) : 0;
    const s1Items = teamMetrics.map((x) => { const steps = Math.floor(Math.abs(x.moves - meanMv) / ctx.moveTolerance); return { team: x.team, value: x.moves, dev: x.moves - meanMv, steps, contrib: steps * steps * 100 }; });
    const s3Items = teamMetrics.map((x) => { const steps = Math.floor(Math.abs(x.holidayWeight - meanHw) / ctx.holidayTolerance); return { team: x.team, value: x.holidayWeight, dev: x.holidayWeight - meanHw, steps, contrib: steps * steps }; });
    let hundredths = 0;
    const s2Items = teamMetrics.map((x) => {
      const diff = Math.abs(x.distanceTenths - meanDt);
      const ex = diff > ctx.distanceToleranceTenths ? diff - ctx.distanceToleranceTenths : 0;
      hundredths += ex * ex;
      return { team: x.team, value: x.distanceTenths / 10, dev: (x.distanceTenths - meanDt) / 10, excessKm: ex / 10, contrib: (ex * ex) / 100 };
    });
    const soft = [
      -unassigned.length,
      -s1Items.reduce((a, b) => a + b.contrib, 0),
      -Math.floor(hundredths / 100),
      -s3Items.reduce((a, b) => a + b.contrib, 0),
      -Math.floor(sumDt / 10)
    ];
    let hard0 = 0, hard1 = 0;
    for (const v of violations) { if (v.level === 0) hard0 += v.amount; else hard1 += v.amount; }
    for (let s = 0; s < S; s++) slotStats[s].hard = slotHard[s];
    for (const tm of teamMetrics) {
      tm.overDistance = Math.abs(tm.distanceTenths - meanDt) > ctx.distanceToleranceTenths;
      tm.overMoves = s1Items[tm.team].steps > 0;
      tm.overHoliday = s3Items[tm.team].steps > 0;
    }
    const byCode = {};
    for (const r of HARD_RULES) byCode[r.code] = { code: r.code, label: r.label, desc: r.desc, level: r.level, count: 0, amount: 0 };
    for (const v of violations) { byCode[v.code].count++; byCode[v.code].amount += v.amount; }
    const score = { hard: [-hard0, -hard1], soft };
    if (ctx.input.objective) {
      // 순서·허용 차이를 받았으면 score.soft도 엔진과 같이 순위대로. 목적식별 값은 objectiveGaps로 본다
      const ob = ctx.input.objective;
      score.soft = [soft[0]].concat(objectiveSoft(ctx, mv, dt, hw, N, sumDt).map((x) => -x));
      const minOf = (a) => Math.min(...a);
      for (const tm of teamMetrics) {
        tm.overDistance = tm.distanceTenths > minOf(dt) + ob.distanceGapTenths;
        tm.overMoves = tm.moves > minOf(mv) + ob.moveGap;
        tm.overHoliday = tm.holidayWeight > minOf(hw) + ob.holidayGap;
      }
    }
    return {
      score, feasible: hard0 === 0 && hard1 === 0, violations, byCode, matchFlags, slotStats, slotHard, unassigned,
      teamMetrics, h0eMode: ctx.h0eMode,
      objectiveGaps: { moves: Math.max(...mv) - Math.min(...mv), distanceKm: (Math.max(...dt) - Math.min(...dt)) / 10, holiday: Math.max(...hw) - Math.min(...hw), totalKm: Math.floor(sumDt / 10) },
      softBreakdown: {
        S0: { total: soft[0], items: unassigned.map((m) => ({ match: m })) },
        S1: { total: soft[1], mean: meanMv, tolerance: ctx.moveTolerance, items: s1Items },
        S2: { total: soft[2], meanKm: meanDt / 10, toleranceKm: ctx.distanceToleranceTenths / 10, items: s2Items },
        S3: { total: soft[3], mean: meanHw, tolerance: ctx.holidayTolerance, items: s3Items },
        S4: { total: soft[4], items: teamMetrics.map((x) => ({ team: x.team, value: x.distanceTenths / 10 })) }
      },
      league: {
        meanDistanceKm: meanDt / 10, meanMoves: meanMv, meanHoliday: meanHw,
        meanWeekendHome: N ? teamMetrics.reduce((a, b) => a + b.weekendHome, 0) / N : 0,
        totalKm: Math.floor(sumDt / 10)
      }
    };
  }

  /** 편의 함수: 프로젝트 하나를 바로 채점 */
  function scoreProject(project, overrides) {
    const ctx = createContext(buildInput(project, overrides));
    const plan = planArrayFrom(project);
    return explain(ctx, plan, project);
  }

  KBO.Score = {
    DISTANCE_TOLERANCE_TENTHS, MOVE_TOLERANCE, HOLIDAY_TOLERANCE, WEEKDAY_MOVE_TOLERANCE, ENGINE_OBLIGATION,
    HARD_RULES, SOFT_RULES, RULE_BY_CODE,
    toTenths, planArrayFrom, planListFrom, resolveEventSlot, engineObligations, buildInput, createContext, setH0eMode,
    evaluate, explain, compare, toScore, flat, scoreString, isFeasible, scoreProject
  };
});
