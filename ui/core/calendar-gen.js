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

  /** 공휴일 가중치 기본값(주말 하루 = 1 기준). 어린이날은 3, 나머지 공휴일은 2 — 기본값은 KBO 확인 필요 */
  const HOLIDAY_WEIGHT = 2;
  function defaultHolidayWeight(name) { return /어린이날/.test(String(name || '')) ? 3 : HOLIDAY_WEIGHT; }
  /** 날짜(일 번호) → 공휴일 가중치. 저장값에 weight가 없으면 2로 읽는다 */
  function holidayWeights(settings) {
    const map = new Map();
    for (const h of settings.holidays || []) {
      const d = dayNum(typeof h === 'string' ? h : h.date);
      if (!Number.isFinite(d)) continue;
      // 정수로 읽는다(엔진의 휴일 값 Calendar.holiday가 정수라 묶음 합도 정수여야 한다)
      const w = typeof h === 'object' && h.weight != null && Number.isFinite(Number(h.weight)) ? Math.max(0, Math.round(Number(h.weight))) : HOLIDAY_WEIGHT;
      map.set(d, w);
    }
    return map;
  }

  /**
   * 주말 여부와 휴일 가중치(홈 경기 공정성용). 묶음 값 = 든 날의 가중치 합.
   * 하루 가중치 = 공휴일이면 그 날 가중치, 아니면 토·일 1, 평일 0(주말에 겹친 공휴일은 둘 중 큰 값).
   * holidays: Map(날짜 → 가중치) 또는 Set(날짜, 가중치 2).
   */
  function slotWeights(startDay, consecutive, holidays) {
    let weekend = 0;
    let holiday = 0;
    for (let i = 0; i < consecutive; i++) {
      const d = startDay + i;
      const wd = weekday(d);
      const we = wd === 0 || wd === 6 ? 1 : 0;
      if (we) weekend = 1;
      const hw = holidays && holidays.has(d) ? (holidays.get ? holidays.get(d) : HOLIDAY_WEIGHT) : 0;
      holiday += Math.max(we, hw);
    }
    return { weekend, holiday };
  }

  /** 연전 기간마다 주말·휴일 가중치를 설정(공휴일 표)대로 다시 매긴다. 같은 배열을 고쳐서 돌려준다 */
  function applyWeights(calendar, settings) {
    const hw = holidayWeights(settings);
    for (const c of calendar || []) { const w = slotWeights(dayNum(c.datetime), c.consecutive, hw); c.weekend = w.weekend; c.holiday = w.holiday; }
    return calendar;
  }

  /**
   * 연전 묶음이 곧 경기일: 묶음과 휴식 요일에서 휴식기·휴식일 경기를 만든다(개막일~1차 편성 종료일 안에서만 — 그 뒤는 재편성 기간).
   * 휴식 요일이 아닌데 묶음이 없는 날 → 휴식기(사이에 낀 휴식 요일은 이어서 한 기간), 휴식 요일인데 묶음이 있는 날 → 휴식일 경기.
   * 반환: { restExceptions: ['YYYY-MM-DD'], blackouts: [{ start, end, label }] } — 예전 휴식기와 겹치면 그 이름을 쓴다.
   */
  function deriveRestDays(calendar, settings) {
    const out = { restExceptions: [], blackouts: [] };
    const a = dayNum(settings.seasonStart), b = dayNum(settings.initialEnd);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return out;
    const rest = new Set(settings.restWeekdays || [1]);
    const covered = new Set();
    for (const c of calendar || []) { const s = dayNum(c.datetime); for (let k = 0; k < c.consecutive; k++) covered.add(s + k); }
    for (const d of Array.from(covered).sort((x, y) => x - y)) if (d >= a && d <= b && rest.has(weekday(d))) out.restExceptions.push(isoDate(d));
    const old = (settings.blackouts || []).map((x) => ({ a: dayNum(x.start), b: dayNum(x.end || x.start), label: x.label || '' }));
    let cur = null;
    const close = () => { if (!cur) return; const o = old.find((x) => x.label && x.a <= cur.b && x.b >= cur.a); out.blackouts.push({ start: isoDate(cur.a), end: isoDate(cur.b), label: o ? o.label : (cur.b - cur.a >= 3 ? '휴식기' : '경기 없는 날') }); cur = null; };
    for (let d = a; d <= b; d++) {
      if (covered.has(d)) { close(); continue; }
      if (rest.has(weekday(d))) continue; // 휴식 요일은 원래 쉬는 날: 앞뒤 휴식기를 잇기만 한다
      if (cur) cur.b = d; else cur = { a: d, b: d };
    }
    close();
    return out;
  }

  /**
   * 공휴일이 휴식 요일(월)에 들면 그 날 경기를 할지(holidays[].playOnRest). 저장값이 있으면 그대로(false도 존중),
   * 없으면 어린이날(5/5)만 경기 — 2025 5/5(월) 경기를 재현하고, 2027 8/16(월) 대체공휴일 같은 날은 쉰다
   */
  function holidayPlaysOnRest(h) {
    if (h && typeof h === 'object' && typeof h.playOnRest === 'boolean') return h.playOnRest;
    const d = typeof h === 'string' ? h : h && h.date;
    return /^\d{4}-05-05/.test(String(d || ''));
  }

  /** 올스타 휴식기 기본 길이(금~수 6일) */
  const ALL_STAR_DAYS = 6;
  /** 올스타 휴식기 시작 금요일 기본값: 그 해 7월 둘째 금요일(2025 → 7/11) */
  function defaultAllStarStart(year) {
    const first = dayNum(year + '-07-01');
    const fri = first + ((5 - weekday(first) + 7) % 7);
    return isoDate(fri + 7);
  }

  /**
   * 「규칙대로 채우기」에 쓰는 설정: 2025 공식 일정표로 확인한 관행.
   *  - 기본: 화·수·목 / 금·토·일 3연전, 휴식 요일(월) 쉼. 개막은 늘 토요일 → 토·일 2연전(규칙에서 저절로 나옴)
   *  - 휴식 요일에 든 공휴일 중 「휴식 요일이어도 경기」(playOnRest, 없으면 어린이날만)가 켜진 날: 그 날 경기, 그 주 목요일 휴식(어린이날 월·화·수 3연전 → 목 휴식 → 금·토·일)
   *  - 올스타 휴식기: 시작 금요일(allStarStart)부터 allStarDays일(기본 6, 금~수) 쉬고, 뒤 목~일 4연전(규칙에서 저절로 나옴)
   * 지금 묶음에서 만든 휴식기·휴식일 경기는 쓰지 않는다(묶음이 없는 날이 모두 휴식기로 보이기 때문).
   */
  function ruleSettings(settings) {
    const s = Object.assign({}, settings);
    const a = dayNum(settings.seasonStart), b = dayNum(settings.initialEnd);
    const rest = new Set(settings.restWeekdays || [1]);
    const rex = [], black = [];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const play = new Set();
      for (const h of settings.holidays || []) { const d = dayNum(typeof h === 'string' ? h : h.date); if (Number.isFinite(d) && holidayPlaysOnRest(h)) play.add(d); }
      for (const d of play) {
        if (d < a || d > b || !rest.has(weekday(d))) continue;
        rex.push(isoDate(d));
        const thu = d + ((4 - weekday(d) + 7) % 7);
        if (thu <= b) black.push({ start: isoDate(thu), end: isoDate(thu), label: fmtShort(d) + ' 휴식일 경기 뒤 휴식' });
      }
      const as = settings.allStarStart || (Number.isFinite(a) ? defaultAllStarStart(isoDate(a).slice(0, 4)) : '');
      const asd = dayNum(as);
      const asn = Math.max(1, Math.round(Number(settings.allStarDays) || ALL_STAR_DAYS));
      if (Number.isFinite(asd) && asd >= a && asd <= b) black.push({ start: isoDate(asd), end: isoDate(Math.min(b, asd + asn - 1)), label: '올스타 휴식기' });
    }
    s.restExceptions = rex.sort();
    s.blackouts = black;
    return s;
  }

  /**
   * 슬롯 자동 생성. range가 없으면 개막일~1차 편성 종료일.
   * 반환: input_2025.json의 calendar 항목과 같은 모양.
   */
  function generateSlots(settings, range) {
    const start = dayNum((range && range.start) || settings.seasonStart);
    const end = dayNum((range && range.end) || settings.initialEnd);
    const isGame = gameDayPredicate(settings, range);
    const holidays = holidayWeights(settings);
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
   * opts: { initialGamesPerPair (15), homeGamesMajor (9), settings?, events? } — settings.homeTotals가 있으면 홈 73/71 원칙(generateSeriesByHomeTotals)으로 만든다
   * 슬롯 길이 분포를 (N-1)개 라운드(완전 매칭)에 분할하므로 같은 길이 슬롯마다 완전 매칭이 보장된다.
   * 반환: { matches, plan(구성적 초기해, 매치→슬롯), errors, warnings, pairMatrix }
   */
  function generateSeries(teams, slots, opts) {
    const ht = opts && (opts.homeTotals || (opts.settings && opts.settings.homeTotals));
    if (ht) return generateSeriesByHomeTotals(teams, slots, opts, ht);
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
      errors.push('연전 기간 경기일 합(' + totalGames + ')이 맞대결 경기 수 × 상대 수(' + G + ' × ' + (n - 1) + ' = ' + G * (n - 1) + ')와 다릅니다. 연전 기간의 연전 수나 1차 편성 경기 수를 조정하세요.');
      return { matches: [], plan: [], errors, warnings };
    }
    const lengths = slots.map((s) => s.consecutive);
    const groups = partitionLengths(lengths, n - 1, G);
    if (!groups) {
      errors.push('연전 기간 분포를 맞대결당 ' + G + '경기로 나눌 수 없습니다.');
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
      if (chosen < 0) { errors.push('연전 기간 ' + (si + 1) + ' 배정 실패'); continue; }
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
    balanceSharedStadiums(teams, matches, lengths, G, H, pairMatrix, warnings);
    // 인덱스를 슬롯 순서로 재정렬해 사람이 읽기 쉽게 한다(엔진 동작과 무관)
    const idx = matches.map((m, i) => i).sort((x, y) => plan[x] - plan[y] || x - y);
    const sortedMatches = idx.map((i, k) => Object.assign({}, matches[i], { index: k }));
    const sortedPlan = idx.map((i) => plan[i]);
    return { matches: sortedMatches, plan: sortedPlan, errors, warnings, pairMatrix };
  }

  // ───────── 격년 홈 73/71 원칙 (2027~) ─────────

  /** 구단 이름 목록을 사람이 읽는 말로: 한화·롯데·두산 */
  function nameList(names) { return names.join('·'); }

  /**
   * 홈 73/71 기본값. 홈 73 구단은 defaultHomeMoreTeams(홀수 해 한화·SSG·KT·롯데·두산, 짝수 해 LG·NC·KIA·삼성·키움).
   * opts.moreTeams로 홈 73 구단을 직접 줄 수 있다. 홈 73 구단과 개막전 홈 구단은 서로 상관없다.
   * 1차 편성 홈(initial) = 69/66(미편성 홈 4/5): 후반기 첫 4연전을 개막전 홈 구단 구장에서 하면(fourGameHome 'same', 기본) 1차 편성 홈은 모두 3의 배수다.
   * opts.fourGameHome이 'swap'(4연전 홈 바꿈)이면 68/67 — 이때 홈 68 구단 = 개막전 홈 구단이어야 한다. opts.initial이 false면 넣지 않는다(시리즈 생성이 정함).
   * teams: [{ name }] — 이 목록에 있는 이름만 남긴다. 구단 수가 10이 아니면 절반을 위에서부터 고른다.
   */
  const HOME_MORE_ODD = ['한화', 'SSG', 'KT', '롯데', '두산'];
  const HOME_MORE_EVEN = ['LG', 'NC', 'KIA', '삼성', '키움'];
  const CHILDREN_HOSTS_ODD = ['두산', '키움', '한화', '롯데', 'NC'];
  const CHILDREN_HOSTS_EVEN = ['LG', 'SSG', 'KT', '삼성', 'KIA'];
  /** teams가 있으면 그 목록에 있는 이름만 남긴다 */
  function onlyKnown(list, teams) {
    if (!teams) return list.slice();
    const names = teams.map((t) => (typeof t === 'string' ? t : t.name));
    return list.filter((x) => names.includes(x));
  }
  /**
   * 격년제 기본값(새 연도를 만들 때 채우는 값, 사용자가 바꿀 수 있음 — 이미 있는 값은 화면이 덮지 않는다).
   * 홈 73 구단: 홀수 해 한화·SSG·KT·롯데·두산, 짝수 해 LG·NC·KIA·삼성·키움.
   * 어린이날 홈 구단: 홀수 해 두산(잠실)·키움·한화·롯데·NC, 짝수 해 LG(잠실)·SSG·KT·삼성·KIA. 대진(상대)은 기본으로 정하지 않는다.
   */
  function defaultHomeMoreTeams(year, teams) { return onlyKnown(Number(year) % 2 === 1 ? HOME_MORE_ODD : HOME_MORE_EVEN, teams); }
  function defaultChildrenHosts(year, teams) { return onlyKnown(Number(year) % 2 === 1 ? CHILDREN_HOSTS_ODD : CHILDREN_HOSTS_EVEN, teams); }
  function defaultHomeTotals(year, teams, opts) {
    const o = opts || {};
    const names = (teams || []).map((t) => (typeof t === 'string' ? t : t.name));
    const half = names.length >> 1;
    let more = o.moreTeams ? o.moreTeams.slice() : defaultHomeMoreTeams(year, names);
    if (!o.moreTeams && more.length !== half) more = names.slice(0, half);
    const out = { moreTeams: more, more: { total: 73 }, less: { total: 71 } };
    if (o.initial !== false) { const swap = o.fourGameHome === 'swap'; out.more.initial = swap ? 68 : 69; out.less.initial = swap ? 67 : 66; }
    return out;
  }

  /** 다음 해 홈 73/71: 홈 73 구단과 나머지를 맞바꾼다 */
  function flipHomeTotals(ht, teams) {
    const names = (teams || []).map((t) => (typeof t === 'string' ? t : t.name));
    return { moreTeams: names.filter((x) => !(ht.moreTeams || []).includes(x)), more: Object.assign({}, ht.more), less: Object.assign({}, ht.less) };
  }

  /**
   * 구단별 홈 목표: [{ team, total, initial|null }] + 오류. 맞대결 16경기 × 상대 9 = 144 중 홈 total, 1차 편성 15 × 9 = 135 중 홈 initial.
   * 합이 리그 전체 경기 수와 맞지 않으면 오류(한 경기에 홈은 하나).
   */
  function homeTotalsTargets(teams, settings) {
    const s = settings || {};
    const ht = s.homeTotals;
    const errors = [];
    if (!ht) return { targets: null, errors };
    const names = teams.map((t) => t.name);
    const n = names.length, pairs = n * (n - 1) / 2;
    const more = new Set(ht.moreTeams || []);
    const unknown = Array.from(more).filter((x) => !names.includes(x));
    if (unknown.length) errors.push('홈 ' + ((ht.more && ht.more.total) || '') + '경기 구단에 없는 구단이 있습니다: ' + nameList(unknown) + '.');
    const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
    const pick = (side) => ({ total: num(ht[side] && ht[side].total), initial: num(ht[side] && ht[side].initial) });
    const M = pick('more'), L = pick('less');
    const targets = names.map((t) => { const x = more.has(t) ? M : L; return { team: t, total: x.total, initial: x.initial }; });
    const G = s.gamesPerPair || 16, Gi = s.initialGamesPerPair || 15;
    const sum = (k) => targets.reduce((a, t) => a + (t[k] || 0), 0);
    if (targets.some((t) => t.total == null)) errors.push('홈 경기 수(전체)를 정하세요.');
    else if (sum('total') !== G * pairs) errors.push('구단별 홈 경기 수 합(' + sum('total') + ')이 리그 전체 경기 수(맞대결 ' + G + ' × ' + pairs + ' = ' + G * pairs + ')와 다릅니다. 홈 ' + M.total + '경기 구단 ' + more.size + '곳 · 홈 ' + L.total + '경기 구단 ' + (n - more.size) + '곳으로는 맞지 않습니다.');
    const anyInitial = targets.some((t) => t.initial != null);
    if (anyInitial) {
      if (targets.some((t) => t.initial == null)) errors.push('1차 편성 홈 경기 수는 두 무리 모두 정하거나 모두 비워 두세요.');
      else if (sum('initial') !== Gi * pairs) errors.push('구단별 1차 편성 홈 경기 수 합(' + sum('initial') + ')이 1차 편성 경기 수(' + Gi + ' × ' + pairs + ' = ' + Gi * pairs + ')와 다릅니다.');
      else if (targets.some((t) => t.total != null && (t.total - t.initial < 0 || t.total - t.initial > (G - Gi) * (n - 1)))) errors.push('미편성 홈 경기 수(전체 − 1차 편성)가 0~' + (G - Gi) * (n - 1) + '경기를 벗어납니다.');
    }
    return { targets, errors };
  }

  /**
   * 시리즈 생성에 넘길 값: CalendarGen.generateSeries(st.teams, st.calendar, seriesOptions(st)).
   * 낱개로 넘겨도 된다: { initialGamesPerPair, homeGamesMajor, gamesPerPair, homeTotals, fourGameHome, seriesMinLength, events } — 낱개 값이 settings보다 앞선다
   */
  function seriesOptions(project) {
    const s = project.settings || {};
    return { initialGamesPerPair: s.initialGamesPerPair, homeGamesMajor: s.homeGamesMajor, settings: s, events: project.events || [] };
  }

  /** 길이 k의 조합(0..t-1 중 k개)을 모두: 날짜가 퍼지도록 순서를 섞어 쓴다 */
  function combos(t, k) {
    const out = [];
    (function rec(start, cur) { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = start; i < t; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); } })(0, []);
    return out;
  }

  /** 짝 맞추기(각 줄 → 두 구단 중 하나, 구단마다 cap까지). 증가 경로. 실패하면 null */
  function orientEdges(edges, cap) {
    const owner = new Array(edges.length).fill(-1);
    const load = cap.map(() => []);
    function tryEdge(e, seen) {
      for (const t of edges[e]) {
        if (seen.has(t)) continue;
        seen.add(t);
        if (load[t].length < cap[t]) { load[t].push(e); owner[e] = t; return true; }
        for (const e2 of load[t]) {
          const other = edges[e2][0] === t ? edges[e2][1] : edges[e2][0];
          if (seen.has(other)) continue;
          // e2를 다른 쪽으로 넘길 수 있으면 자리를 비운다
          if (shift(e2, other, seen)) { load[t].splice(load[t].indexOf(e2), 1); load[t].push(e); owner[e] = t; return true; }
        }
      }
      return false;
    }
    function shift(e2, to, seen) {
      seen.add(to);
      if (load[to].length < cap[to]) { load[to].push(e2); owner[e2] = to; return true; }
      for (const e3 of load[to]) {
        const other = edges[e3][0] === to ? edges[e3][1] : edges[e3][0];
        if (seen.has(other)) continue;
        if (shift(e3, other, seen)) { load[to].splice(load[to].indexOf(e3), 1); load[to].push(e2); owner[e2] = to; return true; }
      }
      return false;
    }
    for (let e = 0; e < edges.length; e++) if (!tryEdge(e, new Set())) return null;
    return owner;
  }

  /**
   * 홈 73/71 원칙으로 시리즈 만들기 (settings.homeTotals가 있을 때).
   *  - 개막 연전(첫 연전 기간) 말고는 seriesMinLength(기본 3)연전 이상. 묶음 구성은 「개막 2연전 + 4연전 하나 + 나머지 3연전」 또는 「모두 3연전」
   *  - 개막 2연전과 후반기 첫 4연전은 같은 두 구단이 치른다(맞대결 15 = 2 + 4 + 3연전 셋). 4연전 홈은 settings.fourGameHome:
   *      'same'(기본) = 개막전 홈 구단 구장에서 다시 → 개막전 홈 구단 6 + 3연전 하나, 상대 3연전 셋(또는 그 반대로 6 + 0 : 9) = 9 : 6, 1차 편성 홈은 모두 3의 배수(예: 69/66)
   *      'swap' = 홈을 바꿔 → 개막전 홈 구단 2연전 + 3연전 둘, 상대 4연전 + 3연전 하나 = 8 : 7, 1차 편성 홈은 개막전 홈 구단 3k + 2, 상대 3k + 1(예: 68/67)
   *  - 나머지 맞대결은 3연전 다섯 개를 9 : 6으로(다수 홈). 구단마다 1차 편성 홈이 homeTotals의 initial(예: 69/66)이 되도록 다수 홈을 나눈다
   *  - 같이 쓰는 구장(잠실 두산·LG)은 같은 연전 기간에 둘 다 홈이 되지 않게 처음부터 짠다
   *  - 개막전 이벤트(type 'OPENING')의 pairs가 있으면 그 대진을, teams(홈 구단)만 있으면 그 구단을 홈으로 개막 연전 기간에 둔다
   * 맞지 않는 조합이면 errors에 이유와 고칠 곳을 적는다.
   */
  function generateSeriesByHomeTotals(teams, slots, opts, ht) {
    const o = opts || {};
    const settings = Object.assign({}, o.settings || {}, { homeTotals: ht });
    const n = teams.length;
    const G = o.initialGamesPerPair || settings.initialGamesPerPair || 15;
    settings.initialGamesPerPair = G;
    if (o.gamesPerPair) settings.gamesPerPair = o.gamesPerPair;
    const minLen = Math.max(1, Math.round(Number(o.seriesMinLength || settings.seriesMinLength) || 3));
    const errors = [], warnings = [];
    const fail = (msg) => { if (msg) errors.push(msg); return { matches: [], plan: [], errors, warnings, homeTargets: [] }; };
    if (n < 2 || n % 2 !== 0) return fail('구단 수가 짝수여야 합니다(현재 ' + n + ').');
    const names = teams.map((t) => t.name);
    const idx = new Map(names.map((x, i) => [x, i]));
    const lengths = slots.map((c) => c.consecutive);
    const totalGames = lengths.reduce((a, b) => a + b, 0);
    if (totalGames !== G * (n - 1)) return fail('연전 기간 경기일 합(' + totalGames + ')이 맞대결 경기 수 × 상대 수(' + G + ' × ' + (n - 1) + ' = ' + G * (n - 1) + ')와 다릅니다. 연전 기간의 연전 수나 1차 편성 경기 수를 조정하세요.');
    const short = [];
    lengths.forEach((L, i) => { if (i > 0 && L < minLen) short.push(slotLabel(slots[i])); });
    if (short.length) return fail('개막 연전 말고는 ' + minLen + '연전 이상이어야 합니다: ' + short.join(', ') + '. 이 연전 기간을 앞뒤 묶음과 합치거나 경기 없는 날로 바꾸세요.');
    const tg = homeTotalsTargets(teams, settings);
    if (tg.errors.length) { tg.errors.forEach((e) => errors.push(e)); return fail(); }
    // 묶음 구성
    const others = lengths.map((L, i) => [L, i]).filter(([L, i]) => i > 0 && L !== 3);
    const hist = lengthHistogram(slots);
    const histText = Object.keys(hist).sort((a, b) => a - b).map((k) => k + '연전 ' + hist[k]).join(' · ');
    let mode;
    if (lengths[0] === 2 && others.length === 1 && others[0][0] === 4) mode = 'PAIRED';
    else if (lengths[0] === 3 && others.length === 0) mode = 'TRIPLES';
    else return fail('홈 ' + ((ht.more && ht.more.total) || 73) + '/' + ((ht.less && ht.less.total) || 71) + ' 원칙으로 시리즈를 만들려면 연전 묶음이 「개막 2연전 + 4연전 하나 + 나머지 3연전」이거나 모두 3연전이어야 합니다(지금 ' + histText + '). 홈 73/71 설정을 비우면 예전 방식으로 만듭니다.');
    if (G % 3 !== 0) return fail('맞대결 ' + G + '경기는 3연전으로 나눠지지 않습니다. 홈 73/71 원칙은 3의 배수(예: 15)에서만 씁니다.');
    const t = G / 3, majT = Math.ceil(t / 2), minT = t - majT; // 보통 맞대결: 3연전 t개를 majT : minT
    const k = mode === 'PAIRED' ? (G - 6) / 3 : 0; // 개막 맞대결의 3연전 수
    const fourSame = mode === 'PAIRED' && String(o.fourGameHome || settings.fourGameHome || 'same') !== 'swap'; // 4연전도 개막전 홈 구단 구장
    const hostT = mode === 'PAIRED' ? Math.max(0, Math.min(k, Math.round((G / 2 - 2) / 3))) : 0; // 'swap': 개막전 홈 구단의 홈 3연전 수
    // 'same': 개막 맞대결도 다수 홈을 고른다. 개막전 홈 구단이 다수 홈이면 3연전 hostMajJ개, 상대가 다수 홈이면 visMajJ개를 개막전 홈 구단이 홈
    const hostMajJ = majT - 2, visMajJ = k - majT;
    if (fourSame && (hostMajJ < 0 || hostMajJ > k || visMajJ < 0 || visMajJ > k)) return fail('맞대결 ' + G + '경기에서는 후반기 첫 4연전을 개막전 홈 구단 구장에서 할 수 없습니다(맞대결 홈 ' + 3 * majT + ' : ' + 3 * minT + '이 맞지 않음). 4연전 설정을 「홈 바꿈」으로 고르거나 맞대결 경기 수를 바꾸세요.');
    const R = mode === 'PAIRED' && !fourSame ? n - 2 : n - 1; // 다수 홈을 고르는 라운드 수('swap'이면 개막 라운드 제외)
    // 개막전: 홈 구단과 대진
    const opening = (o.events || []).find((e) => e && e.type === 'OPENING' && e.mode === 'STADIUM');
    const evPairs = [];
    const used = new Set();
    for (const pr of (opening && opening.pairs) || []) {
      const h = idx.get(pr.home), a = idx.get(pr.away);
      if (h == null || a == null || h === a) return fail('개막전 대진 ' + (pr.away || '?') + '@' + (pr.home || '?') + '의 구단을 확인하세요.');
      if (used.has(h) || used.has(a)) return fail('개막전 대진에 한 구단이 두 번 들어 있습니다: ' + names[used.has(h) ? h : a] + '.');
      used.add(h); used.add(a); evPairs.push([h, a]);
    }
    let hosts = evPairs.map((p) => p[0]);
    for (const x of (opening && opening.teams) || []) { const i = idx.get(x); if (i != null && !hosts.includes(i) && !used.has(i)) hosts.push(i); }
    if (hosts.length > n / 2) return fail('개막전 홈 구단이 ' + hosts.length + '곳입니다. 한 연전 기간에 홈은 ' + (n / 2) + '곳까지입니다.');
    // 1차 편성 홈 목표
    const sp = new Array(n).fill(0); // 개막 맞대결에서 얻는 홈 경기
    const spHost = fourSame ? 0 : 2 + 3 * hostT, spVisitor = fourSame ? 0 : 4 + 3 * (k - hostT);
    const base = 3 * R * minT, step = 3 * (majT - minT);
    let target = tg.targets.map((x) => x.initial);
    const derived = target.every((v) => v == null);
    if (mode === 'PAIRED') {
      if (!derived && !fourSame && hosts.length < n / 2) {
        // 홈 구단을 다 정하지 않았으면 목표가 「개막전 홈 몫」인 구단으로 채운다
        for (let i = 0; i < n && hosts.length < n / 2; i++) if (!hosts.includes(i) && !used.has(i) && step && (target[i] - spHost - base) % step === 0 && (target[i] - spVisitor - base) % step !== 0) hosts.push(i);
      }
      if (hosts.length < n / 2) {
        // 그래도 모자라면 홈 73 구단 → 나머지 순으로
        const order = names.map((x, i) => i).sort((a, b) => ((ht.moreTeams || []).includes(names[b]) ? 1 : 0) - ((ht.moreTeams || []).includes(names[a]) ? 1 : 0) || a - b);
        for (const i of order) if (hosts.length < n / 2 && !hosts.includes(i) && !used.has(i)) hosts.push(i);
      }
      hosts.forEach((h) => { sp[h] = spHost; });
      for (let i = 0; i < n; i++) if (!hosts.includes(i)) sp[i] = spVisitor;
    }
    if (derived) {
      // 1차 편성 홈을 정하지 않았으면: 다수 홈을 고르게 나누고(남는 몫은 홈 73 구단부터), 그 결과를 목표로 쓴다
      const totalMaj = R * n / 2, each = Math.floor(totalMaj / n);
      let extra = totalMaj - each * n;
      const order = names.map((x, i) => i).sort((a, b) => ((ht.moreTeams || []).includes(names[b]) ? 1 : 0) - ((ht.moreTeams || []).includes(names[a]) ? 1 : 0) || a - b);
      const m0 = new Array(n).fill(each);
      for (const i of order) if (extra > 0) { m0[i]++; extra--; }
      target = m0.map((m, i) => sp[i] + base + step * m);
    }
    // 구단마다 보통 맞대결 다수 홈 수
    const m = target.map((h, i) => (step ? (h - sp[i] - base) / step : (h === sp[i] + base ? 0 : NaN)));
    const bad = m.map((v, i) => (!Number.isInteger(v) || v < 0 || v > R ? i : -1)).filter((i) => i >= 0);
    if (bad.length) {
      if (mode === 'PAIRED' && !fourSame) {
        const wantHost = bad.filter((i) => !hosts.includes(i) && step && Number.isInteger((target[i] - spHost - base) / step));
        const wantVisitor = bad.filter((i) => hosts.includes(i) && step && Number.isInteger((target[i] - spVisitor - base) / step));
        if (wantHost.length || wantVisitor.length) {
          const hostVal = target.find((v, i) => hosts.includes(i) && !bad.includes(i)) || (spHost + base + step * Math.round(R / 2));
          const visVal = target.find((v, i) => !hosts.includes(i) && !bad.includes(i)) || (spVisitor + base + step * Math.round(R / 2));
          let msg = '1차 편성 홈 경기 수를 맞출 수 없습니다. 개막 2연전 + 후반기 첫 4연전(홈 바꿈) 방식에서는 나머지가 모두 3연전이라, 1차 편성 홈을 3으로 나눈 나머지가 ' + (spHost % 3) + '인 수(예: ' + hostVal + ')는 개막전 홈 구단만, ' + (spVisitor % 3) + '인 수(예: ' + visVal + ')는 개막전 원정 구단만 될 수 있습니다.';
          if (wantHost.length) msg += ' 홈 ' + target[wantHost[0]] + '경기로 정한 ' + nameList(wantHost.map((i) => names[i])) + '은(는) 개막전 원정입니다.';
          if (wantVisitor.length) msg += ' 홈 ' + target[wantVisitor[0]] + '경기로 정한 ' + nameList(wantVisitor.map((i) => names[i])) + '은(는) 개막전 홈입니다.';
          msg += ' 홈 ' + ((ht.more && ht.more.total) || 73) + '경기 구단을 개막전 홈 구단(' + nameList(hosts.map((i) => names[i])) + ')으로 바꾸거나, 1차 편성 홈 경기 수를 비워 미편성 경기로 맞추거나, 개막전 홈 구단을 바꾸세요.';
          return fail(msg);
        }
      }
      return fail('1차 편성 홈 경기 수를 맞출 수 없습니다: ' + nameList(bad.map((i) => names[i] + ' ' + target[i])) + '. 3연전 ' + t + '개로 나누는 맞대결에서는 한 맞대결의 홈이 ' + 3 * majT + ' 또는 ' + 3 * minT + '경기라 구단마다 ' + (sp[bad[0]] + base) + '~' + (sp[bad[0]] + base + step * R) + ' 사이에서 ' + step + '씩만 바뀝니다.' + (fourSame ? ' 후반기 첫 4연전을 개막전 홈 구단 구장에서 하면 개막 맞대결도 ' + 3 * majT + ' : ' + 3 * minT + '이라 1차 편성 홈은 이 수들만 됩니다. 4연전에서 홈을 바꾸려면 4연전 설정을 「홈 바꿈」으로 고르세요.' : ''));
    }
    // 같이 쓰는 구장
    const groupsBy = new Map();
    teams.forEach((tm, i) => { if (!groupsBy.has(tm.stadium)) groupsBy.set(tm.stadium, []); groupsBy.get(tm.stadium).push(i); });
    const shared = Array.from(groupsBy.values()).filter((g) => g.length > 1);
    if (shared.some((g) => g.length > 2)) return fail('한 구장을 세 구단 이상이 같이 쓰면 홈 73/71 원칙으로 만들 수 없습니다.');
    // 같이 쓰는 두 구단이 서로 맞붙지 않고 둘 다 개막전 원정이면: 'swap'은 4연전에 둘 다 홈, 'same'은 개막 맞대결 3연전(원정 구단은 셋 중 둘 이상 홈)이 겹친다
    const bothVisitorsMsg = (g) => teams[g[0]].stadium + '을(를) 같이 쓰는 ' + nameList(g.map((i) => names[i])) + '이(가) 둘 다 개막전 원정이면 ' + (fourSame ? '개막 대진 상대와의 3연전에서 둘 다 홈이 되는 연전 기간이 생깁니다' : '후반기 첫 4연전(홈 바꿈)에 둘 다 홈이 됩니다') + '. 한 구단을 개막전 홈으로 하거나 두 구단을 개막전에서 맞붙이세요.';
    for (const g of shared) {
      const [a, b] = g, st = teams[a].stadium;
      if (target[a] + target[b] > totalGames) return fail(st + '을(를) 같이 쓰는 ' + nameList(g.map((i) => names[i])) + '의 1차 편성 홈 합(' + (target[a] + target[b]) + ')이 경기일 ' + totalGames + '일보다 많습니다.');
      if (mode === 'PAIRED') {
        const pairedTogether = evPairs.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
        if (hosts.includes(a) && hosts.includes(b)) return fail(st + '을(를) 같이 쓰는 ' + nameList(g.map((i) => names[i])) + '이(가) 둘 다 개막전 홈입니다. 한 구단만 고르세요.');
        if (!hosts.includes(a) && !hosts.includes(b) && !pairedTogether && evPairs.length >= n / 2) return fail(bothVisitorsMsg(g));
      }
    }
    // 개막 대진 채우기: 정한 대진 + 남은 홈 구단에 남은 원정 구단(같이 쓰는 구장 구단끼리 먼저)
    const openPairs = evPairs.slice();
    if (mode === 'PAIRED' || openPairs.length) {
      const freeHosts = hosts.filter((h) => !openPairs.some((p) => p[0] === h));
      const freeVis = names.map((x, i) => i).filter((i) => !hosts.includes(i) && !openPairs.some((p) => p[1] === i));
      for (const h of freeHosts) {
        if (!freeVis.length) break;
        const g = shared.find((gg) => gg.includes(h));
        const mate = g ? g.find((x) => x !== h) : -1;
        let vi = freeVis.indexOf(mate);
        if (vi < 0) {
          // 같이 쓰는 구장 구단이 둘 다 원정으로 남지 않게: 짝 없는 잠실 구단을 먼저 쓴다
          vi = freeVis.findIndex((v) => shared.some((gg) => gg.includes(v) && gg.every((x) => !hosts.includes(x))));
          if (vi < 0) vi = 0;
        }
        openPairs.push([h, freeVis.splice(vi, 1)[0]]);
      }
      if (mode === 'PAIRED') for (const g of shared) {
        const [a, b] = g;
        if (!hosts.includes(a) && !hosts.includes(b) && !openPairs.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) return fail(bothVisitorsMsg(g));
      }
    }
    // 라운드(완전 매칭): 원형 방식을 구단 순서만 바꿔 써서 첫 라운드가 개막 대진이 되게 한다
    const perm = new Array(n);
    if (openPairs.length === n / 2) openPairs.forEach(([h, a], i) => { perm[i] = h; perm[n - 1 - i] = a; });
    else for (let i = 0; i < n; i++) perm[i] = i;
    const rounds = roundRobin(n).map((r) => r.map(([x, y]) => [perm[x], perm[y]]));
    const isOpenRound = openPairs.length === n / 2;
    // 연전 기간 → 라운드: 개막 라운드(0)는 첫 연전 기간과 (있으면) 4연전, 나머지는 3연전 t개씩. 날짜 순으로, 직전 라운드는 피한다(인접 동일 대진 방지)
    const need = rounds.map((r, ri) => (ri === 0 && mode === 'PAIRED' ? [2, 4].concat(new Array(k).fill(3)) : new Array(t).fill(3)));
    const roundSlots = rounds.map(() => []);
    let lastRound = -1;
    for (let si = 0; si < slots.length; si++) {
      const len = lengths[si];
      let chosen = -1, bestScore = -Infinity;
      for (let r = 0; r < need.length; r++) {
        if (si === 0 && isOpenRound && r !== 0) continue; // 개막 연전 기간은 개막 라운드
        const pos = need[r].indexOf(len);
        if (pos < 0) continue;
        const score = need[r].length * 10 - (r === lastRound ? 1000 : 0) - roundSlots[r].length * 0.01 + ((r * 7 + si) % 5) * 0.001;
        if (score > bestScore) { bestScore = score; chosen = r; }
      }
      if (chosen < 0) return fail('연전 기간 ' + slotLabel(slots[si]) + '을(를) 맞대결에 나누지 못했습니다.');
      need[chosen].splice(need[chosen].indexOf(len), 1);
      roundSlots[chosen].push(si);
      lastRound = chosen;
    }
    // 다수 홈 나누기: 보통 라운드의 맞대결마다 다수 홈(3연전 majT개) 구단을 고른다. 구단 i는 m[i]번
    const regular = rounds.map((r, ri) => ri).filter((ri) => !(mode === 'PAIRED' && !fourSame && ri === 0));
    let major = null; // major[ri][pi] = 다수 홈 구단
    if (step) {
      const sg = shared[0] || null;
      const tries = sg ? regular.length * 2 + 2 : 1;
      for (let attempt = 0; attempt < tries && !major; attempt++) {
        const forced = new Map(); // 'ri:pi' → 구단
        const cnt = new Array(n).fill(0);
        if (sg) {
          const [D, L] = sg;
          const mutual = regular.find((ri) => rounds[ri].some(([x, y]) => (x === D && y === L) || (x === L && y === D)));
          const firstD = attempt % 2 === 0;
          let needD = m[D], needL = m[L];
          if (mutual != null) {
            const pi = rounds[mutual].findIndex(([x, y]) => (x === D && y === L) || (x === L && y === D));
            const w = firstD ? D : L;
            // 서로 맞붙는 라운드의 다수 홈은 더 많이 필요한 쪽(번갈아 시도)
            const pickW = needD === needL ? w : (needD > needL ? D : L);
            forced.set(mutual + ':' + pi, pickW); cnt[pickW]++;
            if (pickW === D) needD--; else needL--;
          }
          const nm = regular.filter((ri) => ri !== mutual);
          const rot = Math.floor(attempt / 2) % Math.max(1, nm.length);
          const order = nm.slice(rot).concat(nm.slice(0, rot));
          if (needD + needL > nm.length && 2 * majT > t) { major = null; return fail(teams[D].stadium + '을(를) 같이 쓰는 ' + nameList(sg.map((i) => names[i])) + '의 다수 홈 맞대결이 너무 많습니다(같은 연전 기간에 둘 다 홈이 됩니다). 두 구단의 1차 편성 홈 경기 수를 줄이세요.'); }
          const pickD = new Set(order.filter((ri, j) => j % 2 === (firstD ? 0 : 1)).slice(0, needD));
          const restForD = order.filter((ri) => !pickD.has(ri));
          while (pickD.size < needD && restForD.length) pickD.add(restForD.shift());
          const pickL = new Set(order.filter((ri) => !pickD.has(ri)).slice(0, needL));
          if (pickL.size < needL) continue;
          for (const ri of nm) {
            rounds[ri].forEach(([x, y], pi) => {
              for (const [me, set] of [[D, pickD], [L, pickL]]) {
                if (x !== me && y !== me) continue;
                const other = x === me ? y : x;
                const key = ri + ':' + pi;
                const w = set.has(ri) ? me : other;
                if (forced.has(key)) { if (forced.get(key) !== w) forced.set(key, -1); return; }
                forced.set(key, w); cnt[w]++;
              }
            });
          }
          if (Array.from(forced.values()).includes(-1)) continue;
        }
        const freeEdges = [], freeKeys = [];
        for (const ri of regular) rounds[ri].forEach(([x, y], pi) => { const key = ri + ':' + pi; if (!forced.has(key)) { freeEdges.push([x, y]); freeKeys.push(key); } });
        const cap = m.map((v, i) => v - cnt[i]);
        if (cap.some((c) => c < 0) || cap.reduce((a, b) => a + b, 0) !== freeEdges.length) continue;
        const own = orientEdges(freeEdges, cap);
        if (!own) continue;
        major = rounds.map(() => []);
        forced.forEach((w, key) => { const [ri, pi] = key.split(':').map(Number); major[ri][pi] = w; });
        freeKeys.forEach((key, e) => { const [ri, pi] = key.split(':').map(Number); major[ri][pi] = own[e]; });
      }
      if (!major) return fail('구단별 다수 홈 맞대결 수(' + nameList(names.map((x, i) => x + ' ' + m[i])) + ')를 맞대결에 나누지 못했습니다. 1차 편성 홈 경기 수를 확인하세요.');
    } else {
      major = rounds.map((r) => r.map(([x]) => x));
    }
    // 라운드 안에서 누가 어느 연전 기간에 홈인지
    const matches = [], plan = [];
    const pairMatrix = [];
    for (let i = 0; i < n; i++) pairMatrix.push(new Array(n).fill(0));
    const push = (h, a, si) => { matches.push({ index: matches.length, home: names[h], away: names[a], consecutive: lengths[si] }); plan.push(si); pairMatrix[h][a] += lengths[si]; };
    const sharedOf = (i) => shared.find((g) => g.includes(i));
    rounds.forEach((pairsR, ri) => {
      const sl = roundSlots[ri];
      if (mode === 'PAIRED' && ri === 0) {
        const s2 = sl.find((si) => lengths[si] === 2), s4 = sl.find((si) => lengths[si] === 4);
        const tri = sl.filter((si) => lengths[si] === 3);
        let sharedRef = null;
        pairsR.forEach(([x, y], pi) => {
          const h = hosts.includes(x) ? x : y, v = h === x ? y : x;
          const hj = fourSame ? (major[0][pi] === h ? hostMajJ : visMajJ) : hostT; // 개막전 홈 구단의 홈 3연전 수
          const pats = combos(tri.length, hj);
          let pat = pats[pi % pats.length];
          // 잠실 두 구단의 3연전 홈이 겹치지 않게 같은 순서의 앞부분을 쓴다(개막전 홈 쪽 홈 = 앞 hj개, 원정 쪽 홈 = 나머지)
          if (sharedOf(h) || sharedOf(v)) { if (!sharedRef) sharedRef = tri.map((s, j) => j); pat = sharedRef.slice(0, hj); }
          push(h, v, s2);
          push(fourSame ? h : v, fourSame ? v : h, s4);
          tri.forEach((si, j) => (pat.includes(j) ? push(h, v, si) : push(v, h, si)));
        });
        return;
      }
      const taken = new Map(); // 같이 쓰는 구장 → 이미 홈인 자리(라운드 안 위치)
      const majPats = combos(sl.length, majT);
      pairsR.forEach(([x, y], pi) => {
        const w = major[ri][pi], l = w === x ? y : x;
        const gW = sharedOf(w), gL = sharedOf(l);
        const isOpen = isOpenRound && sl.includes(0) && openPairs.some((p) => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x));
        const openHost = isOpen ? openPairs.find((p) => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x))[0] : -1;
        let chosen = null;
        for (let q = 0; q < majPats.length && !chosen; q++) {
          const pat = majPats[(ri * 3 + pi + q) % majPats.length];
          const homeW = new Set(pat), homeL = new Set(sl.map((s, j) => j).filter((j) => !homeW.has(j)));
          if (isOpen && !(openHost === w ? homeW : homeL).has(sl.indexOf(0))) continue;
          if (gW && gW !== gL && taken.has(gW) && Array.from(homeW).some((j) => taken.get(gW).has(j))) continue;
          if (gL && gL !== gW && taken.has(gL) && Array.from(homeL).some((j) => taken.get(gL).has(j))) continue;
          chosen = { homeW, homeL };
        }
        if (!chosen) { errors.push('같이 쓰는 구장 홈이 겹치지 않게 나누지 못했습니다(라운드 ' + (ri + 1) + ').'); return; }
        if (gW && gW !== gL) taken.set(gW, chosen.homeW);
        if (gL && gL !== gW) taken.set(gL, chosen.homeL);
        sl.forEach((si, j) => (chosen.homeW.has(j) ? push(w, l, si) : push(l, w, si)));
      });
    });
    if (errors.length) return fail();
    // 확인: 구단별 1차 편성 홈 = 목표, 같이 쓰는 구장 겹침 없음
    const homeOf = new Array(n).fill(0);
    matches.forEach((mm) => { homeOf[idx.get(mm.home)] += mm.consecutive; });
    const off = names.filter((x, i) => homeOf[i] !== target[i]);
    if (off.length) return fail('내부 확인 실패: 1차 편성 홈이 목표와 다릅니다(' + nameList(off) + ').');
    for (const g of shared) {
      const bySlot = new Map();
      matches.forEach((mm, j) => { if (g.includes(idx.get(mm.home))) bySlot.set(plan[j], (bySlot.get(plan[j]) || 0) + 1); });
      if (Array.from(bySlot.values()).some((c) => c > 1)) return fail('내부 확인 실패: ' + teams[g[0]].stadium + ' 홈이 한 연전 기간에 겹칩니다.');
    }
    const homeTargets = names.map((x, i) => {
      const total = tg.targets[i].total;
      return { team: x, initial: target[i], total, remaining: total == null ? null : total - target[i], openingHost: mode === 'PAIRED' ? hosts.includes(i) : null };
    });
    const remMax = ((settings.gamesPerPair || 16) - G) * (n - 1);
    const remBad = homeTargets.filter((h) => h.remaining != null && (h.remaining < 0 || h.remaining > remMax));
    if (remBad.length) warnings.push('미편성 홈 경기 수가 맞지 않는 구단: ' + nameList(remBad.map((h) => h.team + ' ' + h.remaining)) + '.');
    const order = matches.map((mm, i) => i).sort((x, y) => plan[x] - plan[y] || x - y);
    return {
      matches: order.map((i, j) => Object.assign({}, matches[i], { index: j })),
      plan: order.map((i) => plan[i]),
      errors, warnings, pairMatrix, homeTargets, openingPairs: openPairs.map(([h, a]) => ({ home: names[h], away: names[a] }))
    };
  }

  /**
   * 같이 쓰는 구장(잠실 두산·LG) 자리 맞추기.
   * 한 구장은 한 연전 기간에 홈 시리즈를 하나만 열 수 있으므로, 같은 구장 구단들의 홈 k연전 수 합이 k연전 기간 수를 넘으면 편성할 수 없다.
   * 넘치는 만큼 그 구단이 다수 홈(H경기)인 맞대결의 k연전 하나를 홈·원정 바꾼다. k = 2H − G(15·9이면 3연전)일 때만 H:G−H 나눔이 그대로 유지된다.
   */
  function balanceSharedStadiums(teams, matches, lengths, G, H, pairMatrix, warnings) {
    const idxOf = new Map(teams.map((t, i) => [t.name, i]));
    const groups = new Map();
    teams.forEach((t, i) => { if (!groups.has(t.stadium)) groups.set(t.stadium, []); groups.get(t.stadium).push(i); });
    const shared = Array.from(groups.values()).filter((g) => g.length > 1);
    if (!shared.length) return;
    const slotCount = {};
    for (const l of lengths) slotCount[l] = (slotCount[l] || 0) + 1;
    const groupOf = new Map();
    shared.forEach((g, gi) => g.forEach((t) => groupOf.set(t, gi)));
    const homeCount = (g, k) => matches.filter((m) => g.includes(idxOf.get(m.home)) && m.consecutive === k).length;
    const homeSeries = (t) => matches.filter((m) => idxOf.get(m.home) === t).length;
    for (const g of shared) {
      for (const k of Object.keys(slotCount).map(Number)) {
        let over = homeCount(g, k) - slotCount[k];
        if (over <= 0) continue;
        if (k !== 2 * H - G) { warnings.push(teams[g[0]].stadium + ' 구장 홈 ' + k + '연전이 ' + k + '연전 기간 수보다 ' + over + '개 많습니다. 홈·원정을 직접 바꾸거나 연전 기간을 조정하세요.'); continue; }
        while (over > 0) {
          let best = null, bestScore = Infinity;
          for (const m of matches) {
            const h = idxOf.get(m.home), a = idxOf.get(m.away);
            if (!g.includes(h) || g.includes(a) || m.consecutive !== k) continue;
            if (pairMatrix[h][a] !== H) continue; // 홈 구단이 이 맞대결의 다수 홈일 때만 바꿔야 H:G−H 나눔이 유지된다
            const ag = groupOf.get(a);
            if (ag != null && homeCount(shared[ag], k) + 1 > slotCount[k]) continue; // 상대도 같이 쓰는 구장이면 그쪽이 넘치지 않을 때만
            const score = homeSeries(a) * 100 + pairMatrix[a][h]; // 홈 시리즈가 적은 상대에게 홈을 넘겨 고르게
            if (score < bestScore) { bestScore = score; best = m; }
          }
          if (!best) { warnings.push(teams[g[0]].stadium + ' 구장 홈 ' + k + '연전 ' + over + '개를 자동으로 줄이지 못했습니다. 홈·원정을 직접 바꾸세요.'); break; }
          const h = idxOf.get(best.home), a = idxOf.get(best.away);
          best.home = teams[a].name; best.away = teams[h].name;
          pairMatrix[h][a] -= k; pairMatrix[a][h] += k;
          over--;
        }
      }
    }
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
    2026: [['2026-02-16', '설날 연휴'], ['2026-02-17', '설날'], ['2026-02-18', '설날 연휴'], ['2026-03-02', '삼일절 대체공휴일'], ['2026-05-24', '부처님오신날'], ['2026-05-25', '대체공휴일'], ['2026-08-17', '광복절 대체공휴일'], ['2026-09-24', '추석 연휴'], ['2026-09-25', '추석'], ['2026-09-26', '추석 연휴'], ['2026-10-05', '개천절 대체공휴일']],
    // 2027·2028: 검색으로 확인한 값(달력 사이트 등). 인사혁신처 고시로 최종 확인 필요. 시즌 밖인 설날은 아직 넣지 않았다
    2027: [['2027-05-13', '부처님오신날'], ['2027-08-16', '광복절 대체공휴일'], ['2027-09-14', '추석 연휴'], ['2027-09-15', '추석'], ['2027-09-16', '추석 연휴'], ['2027-10-04', '개천절 대체공휴일'], ['2027-10-11', '한글날 대체공휴일']],
    2028: [['2028-05-02', '부처님오신날'], ['2028-10-02', '추석 연휴'], ['2028-10-03', '추석'], ['2028-10-04', '추석 연휴'], ['2028-10-05', '개천절 대체공휴일']]
  };

  function builtinHolidays(year) {
    const fixed = [['01-01', '신정'], ['03-01', '삼일절'], ['05-05', '어린이날'], ['06-06', '현충일'], ['08-15', '광복절'], ['10-03', '개천절'], ['10-09', '한글날'], ['12-25', '성탄절']];
    const map = new Map();
    for (const [md, name] of fixed) map.set(year + '-' + md, name);
    for (const [d, name] of LUNAR[year] || []) {
      map.set(d, map.has(d) ? map.get(d) + '·' + name : name);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([date, name]) => ({ date, name, weight: defaultHolidayWeight(name), playOnRest: holidayPlaysOnRest(date) }));
  }
  /** 내장 공휴일 표에 음력 공휴일·대체공휴일이 들어 있는 연도 */
  const HOLIDAY_YEARS = Object.keys(LUNAR).map(Number);

  KBO.Dates = { dayNum, isoDate, weekday, month, fmtDate, fmtShort, engineDatetime, addDays, expandRanges, WEEKDAY_KO, DAY_MS };
  KBO.CalendarGen = {
    gameDayPredicate, splitRun, slotWeights, generateSlots, slotDays, slotLabel, slotIndexOfDate,
    roundRobin, partitionLengths, generateSeries, lengthHistogram, builtinHolidays, holidaySet,
    HOLIDAY_WEIGHT, HOLIDAY_YEARS, defaultHolidayWeight, holidayWeights, applyWeights, deriveRestDays, defaultAllStarStart, ruleSettings,
    holidayPlaysOnRest, ALL_STAR_DAYS,
    defaultHomeTotals, defaultHomeMoreTeams, defaultChildrenHosts, flipHomeTotals, homeTotalsTargets, seriesOptions, generateSeriesByHomeTotals
  };
});
