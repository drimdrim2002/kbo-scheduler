/*
 * KBO 공통 코어 — 날짜 유틸, 슬롯 자동 생성(§5.2.1), 시리즈 목록 생성(FR-S7).
 * DOM에 의존하지 않는다. 브라우저(classic script), Worker, Node에서 같은 파일을 쓴다.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).calendar = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  const DAY_MS = 86400000;
  const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

  /** 'YYYY-MM-DD' 또는 'YYYY-MM-DD hh:mm:ss' → UTC 기준 일 번호 */
  function dayNum(str) {
    if (typeof str === 'number') return str;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
    if (!m) return NaN;
    return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
  }

  function isoDate(n) {
    const d = new Date(n * DAY_MS);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return d.getUTCFullYear() + '-' + mm + '-' + dd;
  }

  /** 0=일 … 6=토 */
  function weekday(n) {
    return new Date(dayNum(n) * DAY_MS).getUTCDay();
  }

  function month(n) {
    return new Date(dayNum(n) * DAY_MS).getUTCMonth() + 1;
  }

  /** NFR-6: M/D(요일) */
  function fmtDate(n) {
    const d = new Date(dayNum(n) * DAY_MS);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + WEEKDAY_KO[d.getUTCDay()] + ')';
  }

  function fmtShort(n) {
    const d = new Date(dayNum(n) * DAY_MS);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
  }

  function engineDatetime(n) {
    return isoDate(dayNum(n)) + ' 00:00:00';
  }

  function addDays(str, k) {
    return isoDate(dayNum(str) + k);
  }

  function expandRanges(ranges) {
    const set = new Set();
    for (const r of ranges || []) {
      const a = dayNum(r.start || r.date);
      const b = dayNum(r.end || r.start || r.date);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      for (let d = Math.min(a, b); d <= Math.max(a, b); d++) set.add(d);
    }
    return set;
  }

  function holidaySet(settings) {
    const set = new Set();
    for (const h of settings.holidays || []) {
      const d = dayNum(typeof h === 'string' ? h : h.date);
      if (Number.isFinite(d)) set.add(d);
    }
    return set;
  }

  /** 경기일 판정기: 경기 없는 기간 > 휴식 예외일 > 휴식 요일 */
  function gameDayPredicate(settings, extra) {
    const rest = new Set(settings.restWeekdays || [1]);
    const exceptions = new Set((settings.restExceptions || []).map(dayNum));
    const blackout = expandRanges(settings.blackouts);
    const extraBlack = extra && extra.blackouts ? expandRanges(extra.blackouts) : null;
    return function (d) {
      if (blackout.has(d) || (extraBlack && extraBlack.has(d))) return false;
      if (exceptions.has(d)) return true;
      return !rest.has(weekday(d));
    };
  }

  /** §5.2.1 규칙 2: 3연전 우선 분할 */
  function splitRun(L) {
    if (L <= 0) return [];
    if (L <= 2) return [L];
    const r = L % 3;
    const q = Math.floor(L / 3);
    if (r === 0) return new Array(q).fill(3);
    if (r === 1) return new Array(q - 1).fill(3).concat([4]);
    return [2].concat(new Array(q).fill(3));
  }

  /** §5.2.1 규칙 3·4: 주말·휴일 가중치 */
  function slotWeights(startDay, consecutive, holidays) {
    let weekend = 0;
    let hasHoliday = false;
    for (let i = 0; i < consecutive; i++) {
      const wd = weekday(startDay + i);
      if (wd === 0 || wd === 6) weekend = 1;
      if (holidays.has(startDay + i)) hasHoliday = true;
    }
    const holiday = weekend ? (hasHoliday ? 3 : 2) : (hasHoliday ? 2 : 0);
    return { weekend, holiday };
  }

  /**
   * 슬롯 자동 생성. range가 없으면 개막일~1차 편성 종료일.
   * 반환: input_2025.json의 calendar 항목과 같은 모양.
   */
  function generateSlots(settings, range) {
    const start = dayNum((range && range.start) || settings.seasonStart);
    const end = dayNum((range && range.end) || settings.initialEnd);
    const isGame = gameDayPredicate(settings, range);
    const holidays = holidaySet(settings);
    const runs = [];
    let cur = null;
    for (let d = start; d <= end; d++) {
      if (isGame(d)) {
        if (!cur) cur = { start: d, length: 0 };
        cur.length++;
      } else if (cur) {
        runs.push(cur);
        cur = null;
      }
    }
    if (cur) runs.push(cur);
    const slots = [];
    const warnings = [];
    for (const run of runs) {
      let d = run.start;
      for (const len of splitRun(run.length)) {
        const w = slotWeights(d, len, holidays);
        if (len === 1) warnings.push({ code: 'SINGLE_DAY', date: isoDate(d), message: fmtDate(d) + ' 하루만 경기일입니다(1연전). 경기 없는 날로 지정하거나 연전 수를 조정하세요.' });
        slots.push({ index: slots.length, datetime: engineDatetime(d), consecutive: len, weekend: w.weekend, holiday: w.holiday });
        d += len;
      }
    }
    return { slots, runs: runs.map((r) => ({ start: isoDate(r.start), length: r.length })), warnings };
  }

  /** 슬롯이 덮는 날짜 목록 */
  function slotDays(slot) {
    const s = dayNum(slot.datetime || slot.date);
    const out = [];
    for (let i = 0; i < slot.consecutive; i++) out.push(s + i);
    return out;
  }

  function slotLabel(slot) {
    const s = dayNum(slot.datetime || slot.date);
    return fmtDate(s) + ' ' + slot.consecutive + '연전';
  }

  /** 날짜가 속한 슬롯 인덱스 (없으면 -1) */
  function slotIndexOfDate(slots, date) {
    const d = dayNum(date);
    for (let i = 0; i < slots.length; i++) {
      const s = dayNum(slots[i].datetime);
      if (d >= s && d < s + slots[i].consecutive) return i;
    }
    return -1;
  }

  /** 원형(circle) 방식 라운드로빈: N-1개의 완전 매칭 */
  function roundRobin(n) {
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(i);
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = ids[i];
        const b = ids[n - 1 - i];
        pairs.push(a < b ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      ids.splice(1, 0, ids.pop());
    }
    return rounds;
  }

  /**
   * 슬롯 길이 목록을 groups개 묶음(각 합 = target)으로 분할한다.
   * 3이 아닌 길이는 한 묶음에 하나씩 먼저 흩고, 막히면 제한 없이 다시 찾는다.
   */
  function partitionLengths(lengths, groups, target) {
    const counts = {};
    for (const l of lengths) counts[l] = (counts[l] || 0) + 1;
    const keys = Object.keys(counts).map(Number).sort((a, b) => Math.abs(b - 3) - Math.abs(a - 3) || b - a);
    const remainingSum = () => keys.reduce((s, k) => s + k * counts[k], 0);

    function pickGroup(remainingGroups, cap) {
      const combo = [];
      let found = null;
      function dfs(ki, sum) {
        if (found) return;
        if (sum === target) {
          if (remainingSum() === target * (remainingGroups - 1)) found = combo.slice();
          return;
        }
        if (ki >= keys.length) return;
        const k = keys[ki];
        const limit = k !== 3 && cap ? Math.min(cap, counts[k]) : counts[k];
        for (let t = Math.min(limit, Math.floor((target - sum) / k)); t >= 0 && !found; t--) {
          for (let i = 0; i < t; i++) combo.push(k);
          counts[k] -= t;
          dfs(ki + 1, sum + k * t);
          counts[k] += t;
          combo.length -= t;
        }
      }
      dfs(0, 0);
      return found;
    }

    const result = [];
    for (let g = groups; g > 0; g--) {
      const combo = pickGroup(g, 1) || pickGroup(g, 0);
      if (!combo) return null;
      for (const l of combo) counts[l]--;
      result.push(combo);
    }
    return result;
  }

  /** 합이 target에 가장 가까운 부분집합의 인덱스 (길이 ≤ 10 가정) */
  function closestSubset(lengths, target) {
    let best = { diff: Infinity, set: [] };
    for (let mask = 0; mask < (1 << lengths.length); mask++) {
      let s = 0;
      const set = [];
      for (let i = 0; i < lengths.length; i++) if (mask & (1 << i)) { s += lengths[i]; set.push(i); }
      const diff = Math.abs(s - target);
      if (diff < best.diff) best = { diff, set };
      if (diff === 0) break;
    }
    return best;
  }

  /**
   * FR-S7 시리즈 목록 생성.
   * opts: { initialGamesPerPair (15), homeGamesMajor (9) }
   * 슬롯 길이 분포를 (N-1)개 라운드(완전 매칭)에 분할하므로 같은 길이 슬롯마다 완전 매칭이 보장된다.
   * 반환: { matches, plan(구성적 초기해, 매치→슬롯), errors, warnings, pairMatrix }
   */
  function generateSeries(teams, slots, opts) {
    const n = teams.length;
    const G = (opts && opts.initialGamesPerPair) || 15;
    const H = (opts && opts.homeGamesMajor != null) ? opts.homeGamesMajor : Math.ceil(G / 2) + 1;
    const errors = [];
    const warnings = [];
    if (n < 2 || n % 2 !== 0) {
      errors.push('구단 수가 짝수여야 합니다(현재 ' + n + ').');
      return { matches: [], plan: [], errors, warnings };
    }
    const rounds = roundRobin(n);
    const totalGames = slots.reduce((s, c) => s + c.consecutive, 0);
    if (totalGames !== G * (n - 1)) {
      errors.push('슬롯 경기일 합(' + totalGames + ')이 구단쌍 경기 수 × 상대 수(' + G + ' × ' + (n - 1) + ' = ' + G * (n - 1) + ')와 다릅니다. 슬롯 연전 수나 1차 편성 경기 수를 조정하세요.');
      return { matches: [], plan: [], errors, warnings };
    }
    const lengths = slots.map((s) => s.consecutive);
    const groups = partitionLengths(lengths, n - 1, G);
    if (!groups) {
      errors.push('슬롯 연전 분포를 구단쌍당 ' + G + '경기로 나눌 수 없습니다.');
      return { matches: [], plan: [], errors, warnings };
    }
    // 슬롯을 날짜 순으로 라운드에 배정한다. 직전 슬롯과 같은 라운드는 피해 H1(인접 동일 대진)을 막는다.
    const roundSlots = groups.map(() => []);
    const need = groups.map((g) => g.slice());
    let lastRound = -1;
    for (let si = 0; si < slots.length; si++) {
      const len = lengths[si];
      let chosen = -1;
      let bestScore = -Infinity;
      for (let r = 0; r < need.length; r++) {
        const pos = need[r].indexOf(len);
        if (pos < 0) continue;
        // 남은 수요가 많은 라운드 우선, 직전 라운드는 피한다(H1 회피)
        const score = need[r].length * 10 - (r === lastRound ? 1000 : 0) - roundSlots[r].length * 0.01 + ((r * 7 + si) % 5) * 0.001;
        if (score > bestScore) { bestScore = score; chosen = r; }
      }
      if (chosen < 0) { errors.push('슬롯 ' + si + ' 배정 실패'); continue; }
      need[chosen].splice(need[chosen].indexOf(len), 1);
      roundSlots[chosen].push(si);
      lastRound = chosen;
    }
    const matches = [];
    const plan = [];
    const pairMatrix = [];
    for (let i = 0; i < n; i++) pairMatrix.push(new Array(n).fill(0));
    for (let r = 0; r < rounds.length; r++) {
      const sl = roundSlots[r];
      const lens = sl.map((s) => lengths[s]);
      for (const [a, b] of rounds[r]) {
        // 다수 홈(major) 결정: 구단 인덱스 차이의 홀짝으로 균형 배분
        const majorFirst = ((b - a) % 2 === 1);
        const major = majorFirst ? a : b;
        const minor = majorFirst ? b : a;
        const sub = closestSubset(lens, H);
        if (sub.diff !== 0 && !warnings.length) warnings.push('홈/원정 분배 ' + H + ':' + (G - H) + '를 정확히 맞출 수 없어 가장 가까운 분배를 사용합니다.');
        const majorSet = new Set(sub.set);
        sl.forEach((s, k) => {
          const home = majorSet.has(k) ? major : minor;
          const away = home === major ? minor : major;
          matches.push({ index: matches.length, home: teams[home].name, away: teams[away].name, consecutive: lengths[s] });
          plan.push(s);
          pairMatrix[home][away] += lengths[s];
        });
      }
    }
    // 인덱스를 슬롯 순서로 재정렬해 사람이 읽기 쉽게 한다(엔진 동작과 무관)
    const idx = matches.map((m, i) => i).sort((x, y) => plan[x] - plan[y] || x - y);
    const sortedMatches = idx.map((i, k) => Object.assign({}, matches[i], { index: k }));
    const sortedPlan = idx.map((i) => plan[i]);
    return { matches: sortedMatches, plan: sortedPlan, errors, warnings, pairMatrix };
  }

  /** 연전 분포 {2:5, 3:215, 4:5} */
  function lengthHistogram(items) {
    const h = {};
    for (const it of items) h[it.consecutive] = (h[it.consecutive] || 0) + 1;
    return h;
  }

  /** 내장 공휴일(법정 공휴일 + 대체공휴일). 음력 공휴일은 수록 연도만 제공한다. */
  const LUNAR = {
    2025: [['2025-01-28', '설날 연휴'], ['2025-01-29', '설날'], ['2025-01-30', '설날 연휴'], ['2025-03-03', '삼일절 대체공휴일'], ['2025-05-05', '부처님오신날'], ['2025-05-06', '대체공휴일'], ['2025-10-05', '추석 연휴'], ['2025-10-06', '추석'], ['2025-10-07', '추석 연휴'], ['2025-10-08', '추석 대체공휴일']],
    2026: [['2026-02-16', '설날 연휴'], ['2026-02-17', '설날'], ['2026-02-18', '설날 연휴'], ['2026-03-02', '삼일절 대체공휴일'], ['2026-05-24', '부처님오신날'], ['2026-05-25', '대체공휴일'], ['2026-08-17', '광복절 대체공휴일'], ['2026-09-24', '추석 연휴'], ['2026-09-25', '추석'], ['2026-09-26', '추석 연휴'], ['2026-10-05', '개천절 대체공휴일']]
  };

  function builtinHolidays(year) {
    const fixed = [['01-01', '신정'], ['03-01', '삼일절'], ['05-05', '어린이날'], ['06-06', '현충일'], ['08-15', '광복절'], ['10-03', '개천절'], ['10-09', '한글날'], ['12-25', '성탄절']];
    const map = new Map();
    for (const [md, name] of fixed) map.set(year + '-' + md, name);
    for (const [d, name] of LUNAR[year] || []) {
      map.set(d, map.has(d) ? map.get(d) + '·' + name : name);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([date, name]) => ({ date, name }));
  }

  KBO.Dates = { dayNum, isoDate, weekday, month, fmtDate, fmtShort, engineDatetime, addDays, expandRanges, WEEKDAY_KO, DAY_MS };
  KBO.CalendarGen = {
    gameDayPredicate, splitRun, slotWeights, generateSlots, slotDays, slotLabel, slotIndexOfDate,
    roundRobin, partitionLengths, generateSeries, lengthHistogram, builtinHolidays, holidaySet
  };
});
