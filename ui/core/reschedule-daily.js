/*
 * KBO 공통 코어 — 날짜 단위 재편성 (docs/RESCHEDULE_DAILY_ENGINE_DESIGN.md).
 *  - 서버(Java reschedule 패키지 + web/RescheduleCodec·RescheduleJobs)와 같은 계산식·같은 문장. 같은 일정이면 점수·평가 숫자·
 *    규칙 위반·못 넣은 이유가 글자까지 같아야 한다(golden: core/test/golden/reschedule-golden.json). 어긋나면 오류다.
 *  - 배정기(initialize·search)는 서버보다 약한 간단한 배정이다. 배정 결과는 서버와 달라도 되고, 고칠 곳 확인은 서버만 한다.
 *  - 입력: 1차 편성 프로젝트 + reschedule { start, end, lastDayToleranceDays, maxConsecutiveDays, maxDoubleHeadersPerTeam,
 *    order, targets[], plan[] }, games[](취소 기록). 결과: 서버 /api/v1/solve mode=RESCHEDULE의 done과 같은 모양.
 * 지금 화면은 아직 옛 묶음 방식(reschedule.js)을 쓴다. 새 결과 화면을 만들 때 이 모듈로 옮긴다.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).rescheduleDaily = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  const D = () => KBO.Dates;
  const CRITERIA = ['lastDay', 'fairness', 'addedDistance', 'monday', 'doubleHeader'];
  const LAST_DAY = 0, FAIR_MOVES = 1, FAIR_DISTANCE = 2, ADDED_DISTANCE = 3, MONDAY = 4, DOUBLE_HEADER = 5;
  const LEVEL_NAMES = ['lastDay', 'fairMoves', 'fairDistance', 'addedDistance', 'monday', 'doubleHeader'];
  const DEFAULTS = { lastDayToleranceDays: 3, maxConsecutiveDays: 6, maxDoubleHeadersPerTeam: 2, moveGap: 4, distanceGapKm: 600 };
  const MAX_WINDOW_DAYS = 120;
  const NO_DAY = null;
  const OK = 0, OK_DH = 1, TEAM_BUSY = 2, STADIUM_BUSY = 3, RUN_LIMIT = 4, DH_LIMIT = 5, PINNED_DAY = 6;
  const CODE_ORDER = ['RUN_LIMIT', 'TEAM_BUSY', 'STADIUM_BUSY', 'DH_LIMIT', 'PINNED_DAY', 'SEARCH'];

  // ---- 글 ----
  /** 마지막 글자 받침(한글) 또는 읽는 소리(영문 끝 L·M·N·R, 숫자 0·1·3·6·7·8·9). 엔진 Korean.hasBatchim과 같다 */
  function hasBatchim(word) {
    if (!word) return false;
    const c = word.charCodeAt(word.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0;
    const ch = word[word.length - 1];
    const u = ch.toUpperCase();
    return u === 'L' || u === 'M' || u === 'N' || u === 'R' || (ch >= '0' && ch <= '9' && '0136789'.indexOf(ch) >= 0);
  }
  const topic = (w) => w + (hasBatchim(w) ? '은' : '는');
  const subject = (w) => w + (hasBatchim(w) ? '이' : '가');
  /** 9/20 */
  function label(day) { const s = D().isoDate(day); return Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10)); }
  const km = (tenths) => tenths / 10;
  /** 2025-08-27 → 8/27(읽을 수 없으면 그대로). 엔진 RescheduleCodec.shortDate와 같다 */
  function shortDate(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(D().dayNum(iso)) ? label(D().dayNum(iso)) : iso; }

  function fail(msg) { const e = new Error(msg); e.userMessage = true; throw e; }
  function parseDay(v, what) {
    const s = v == null ? '' : String(v);
    const d = /^\d{4}-\d{2}-\d{2}/.test(s) ? D().dayNum(s.slice(0, 10)) : NaN;
    if (!Number.isFinite(d)) fail(subject(what) + ' 올바른 날짜가 아닙니다: ' + s);
    return d;
  }
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d));

  // ---- 입력 읽기 (엔진 RescheduleCodec.parse와 같은 검사·같은 문장) ----
  function parse(project, override) {
    const ov = override || {};
    const scoreInput = KBO.Score.buildInput(project);
    const ctx0 = KBO.Score.createContext(scoreInput);
    const plan = KBO.Score.planArrayFrom(project);
    for (let m = 0; m < project.matches.length; m++) if (plan[m] < 0) fail('1차 편성이 끝난 버전을 골라 주세요. 배정되지 않은 연전이 있습니다.');
    KBO.Score.evaluate(ctx0, plan);
    const teams = scoreInput.teams;
    const N = teams.length;
    const idx = new Map(teams.map((t, i) => [t.name, i]));
    const stadiumOf = scoreInput.stadiumOf;
    const dist = scoreInput.dist;
    // 1차 편성 날짜별 경기(원래 일정)
    const series = project.matches.map((m, i) => {
      const slot = project.calendar[plan[i]];
      return { index: i, home: idx.get(m.home), away: idx.get(m.away), start: D().dayNum(slot.datetime), len: m.consecutive | 0, slot: plan[i] };
    });
    let firstRoundLast = -Infinity;
    for (const s of series) firstRoundLast = Math.max(firstRoundLast, s.start + s.len - 1);
    const cancelledFirst = new Set(), cancelledResched = new Set();
    for (const r of project.games || []) {
      if (!r || r.status !== 'CANCELLED') continue;
      if (r.game != null) cancelledResched.add(String(r.game) + '|' + r.date);
      else if (r.match != null) cancelledFirst.add(Number(r.match) + '|' + r.date);
    }
    const rs = project.reschedule;
    if (!rs) fail('재편성 기간과 배정할 경기가 없습니다.');
    const start = rs.start == null ? firstRoundLast + 1 : parseDay(rs.start, '기간 시작일');
    const end = ov.end != null ? ov.end : parseDay(rs.end, '마감일');
    if (start <= firstRoundLast) fail('재편성 기간은 1차 편성이 끝난 다음 날(' + label(firstRoundLast + 1) + ')부터 잡을 수 있습니다.');
    if (end < start) fail('마감일이 시작일보다 앞입니다.');
    const windowDays = end - start + 1;
    if (windowDays > MAX_WINDOW_DAYS) fail('재편성 기간은 ' + MAX_WINDOW_DAYS + '일까지 잡을 수 있습니다.');
    const settings = settingsOf(project, rs, ov);
    const days = [];
    for (let i = 0; i < windowDays; i++) days.push({ index: i, day: start + i, date: D().isoDate(start + i), monday: D().weekday(start + i) === 1 });

    const targets = rs.targets;
    if (!Array.isArray(targets)) fail('배정할 경기 목록이 없습니다.');
    const planByGame = new Map();
    for (const p of rs.plan || []) if (p && p.game != null && p.date != null) planByGame.set(String(p.game), p);
    const gamesPerPair = num((project.settings || {}).gamesPerPair, 16);
    const pairGames = []; for (let i = 0; i < N; i++) pairGames.push(new Array(N).fill(0));
    const homeGames = new Array(N).fill(0);
    const matchByCancelledKey = new Map();
    for (const s of series) {
      pairGames[Math.min(s.home, s.away)][Math.max(s.home, s.away)] += s.len;
      homeGames[s.home] += s.len;
      for (let k = 0; k < s.len; k++) {
        const key = s.index + '|' + D().isoDate(s.start + k);
        if (cancelledFirst.has(key)) matchByCancelledKey.set(key, s);
      }
    }
    const seen = new Set(), covered = new Set();
    const games = [], played = [];
    const playedByDay = new Map();
    for (const t of targets) {
      if (!t || typeof t !== 'object') fail('배정할 경기 목록의 항목이 올바르지 않습니다.');
      const id = t.id == null ? '' : String(t.id);
      const home = idx.get(t.home), away = idx.get(t.away);
      const source = t.source == null ? '' : String(t.source);
      if (!id || seen.has(id)) fail('배정할 경기의 이름이 비어 있거나 겹칩니다: ' + id);
      seen.add(id);
      if (home == null || away == null || home === away) fail('배정할 경기의 구단이 올바르지 않습니다: ' + id);
      if (source === 'CANCELLED') {
        const key = num(t.match, -1) + '|' + (t.date == null ? '' : t.date);
        const s = matchByCancelledKey.get(key);
        if (!s || 'M:' + key !== id) fail('취소 표시가 없는 경기가 배정 대상에 들어 있습니다: ' + teams[home].name + '–' + teams[away].name + ' ' + shortDate(t.date == null ? '' : String(t.date)));
        if (s.home !== home || s.away !== away) fail('취소 경기의 홈·원정이 1차 편성과 다릅니다: ' + id);
        covered.add(key);
      } else if (source === 'REMAINING') {
        pairGames[Math.min(home, away)][Math.max(home, away)]++;
        homeGames[home]++;
      } else fail('배정할 경기의 종류가 올바르지 않습니다: ' + id);
      const game = { id: games.length, key: id, home, away, source, pinned: false, day: -1 };
      const entry = planByGame.get(id);
      if (entry) {
        const d = parseDay(entry.date, '발표한 일정의 날짜');
        const cancelled = cancelledResched.has(id + '|' + D().isoDate(d));
        if (!cancelled && d < start) {
          if (d <= firstRoundLast) fail('발표한 일정의 날짜가 1차 편성 기간 안에 있습니다: ' + id);
          played.push({ game: id, date: D().isoDate(d) });
          if (!playedByDay.has(d)) playedByDay.set(d, []);
          playedByDay.get(d).push([home, away]);
          continue;
        }
        if (!cancelled) {
          if (d > end) fail('발표한 일정이 마감일(' + label(end) + ') 뒤에 있습니다: ' + teams[home].name + '–' + teams[away].name + ' ' + label(d) + '. 마감일을 늦춰 주세요.');
          game.day = d - start;
          game.pinned = true;
        }
      }
      games.push(game);
    }
    for (const [key, s] of matchByCancelledKey) {
      if (!covered.has(key)) fail('취소한 경기가 배정 대상에 빠져 있습니다: ' + teams[s.home].name + '–' + teams[s.away].name + ' ' + shortDate(key.slice(key.indexOf('|') + 1)));
    }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      if (pairGames[i][j] !== gamesPerPair) fail(teams[i].name + '–' + teams[j].name + '의 경기 수가 ' + gamesPerPair + '경기가 되지 않습니다(지금 ' + pairGames[i][j] + '경기).');
    }
    checkHomeTotals(project.settings, teams, homeGames);
    const hist = histories(N, series, cancelledFirst, playedByDay, start, ctx0, stadiumOf, dist);
    const ctx = { teams, N, stadiumOf, dist, days, games, hist, settings, played, start, end, firstRoundLast };
    const broken = violations(ctx);
    if (broken.length) fail('발표한 일정이 꼭 지키는 규칙을 어깁니다. ' + broken[0].text + ' 설정을 바꾸거나 발표 일정을 확인해 주세요.');
    return ctx;
  }

  function settingsOf(project, rs, ov) {
    const s = project.settings || {};
    const ob = s.objective || null;
    const moveGap = ob ? num(ob.moveGap, DEFAULTS.moveGap) : DEFAULTS.moveGap;
    const distanceGapKm = ob ? num(ob.distanceGapKm, DEFAULTS.distanceGapKm) : DEFAULTS.distanceGapKm;
    let movesFirst = true;
    if (ob && Array.isArray(ob.order) && ob.order.includes('moves') && ob.order.includes('distance')) movesFirst = ob.order.indexOf('moves') < ob.order.indexOf('distance');
    const order = Array.isArray(rs.order) ? rs.order.map(String) : CRITERIA.slice();
    const tol = Math.trunc(num(rs.lastDayToleranceDays, DEFAULTS.lastDayToleranceDays));
    const run = ov.maxConsecutive != null ? ov.maxConsecutive : Math.trunc(num(rs.maxConsecutiveDays, DEFAULTS.maxConsecutiveDays));
    const dh = ov.maxDoubleHeaders != null ? ov.maxDoubleHeaders : Math.trunc(num(rs.maxDoubleHeadersPerTeam, DEFAULTS.maxDoubleHeadersPerTeam));
    if (order.length !== CRITERIA.length || !CRITERIA.every((c) => order.includes(c))) fail('기준 순서에는 다섯 기준이 한 번씩 들어 있어야 합니다.');
    if (tol < 0 || tol > 60) fail('마지막 경기일 허용 일수는 0~60일이어야 합니다.');
    if (run < 1 || run > 60) fail('연속 경기일 상한은 1~60일이어야 합니다.');
    if (dh < 0 || dh > 30) fail('더블헤더 상한은 0~30번이어야 합니다.');
    const distanceGapTenths = Math.round(distanceGapKm * 10);
    if (moveGap < 0 || distanceGapTenths < 0) fail('이동 허용 차이는 0 이상이어야 합니다.');
    const levels = [];
    for (const name of order) {
      if (name === 'lastDay') levels.push(LAST_DAY);
      else if (name === 'fairness') { levels.push(movesFirst ? FAIR_MOVES : FAIR_DISTANCE); levels.push(movesFirst ? FAIR_DISTANCE : FAIR_MOVES); }
      else if (name === 'addedDistance') levels.push(ADDED_DISTANCE);
      else if (name === 'monday') levels.push(MONDAY);
      else levels.push(DOUBLE_HEADER);
    }
    return { lastDayToleranceDays: tol, maxConsecutiveDays: run, maxDoubleHeaders: dh, levels, levelNames: levels.map((l) => LEVEL_NAMES[l]), moveGap, distanceGapTenths };
  }

  function checkHomeTotals(settings, teams, homeGames) {
    const ht = settings && settings.homeTotals;
    if (!ht || !ht.more || !ht.less || ht.more.total == null || ht.less.total == null) return;
    const more = new Set(ht.moreTeams || []);
    const off = [];
    teams.forEach((t, i) => {
      const target = num((more.has(t.name) ? ht.more : ht.less).total, -1);
      if (target >= 0 && homeGames[i] !== target) off.push(t.name + ' 목표 ' + target + ' · 지금 ' + homeGames[i]);
    });
    if (off.length) fail('잔여 경기의 홈을 목표대로 나눌 수 없습니다. ' + off.join(', ') + '. 1차 편성 홈 경기 수를 확인해 주세요.');
  }

  /** 기간 앞을 구단마다 접는다. 이동은 1차 원래 일정(KBO.Score 경로, 취소 포함), 연속·마지막 경기일은 실제로 치른 날만 */
  function histories(N, series, cancelledFirst, playedByDay, start, ctx0, stadiumOf, dist) {
    const out = [];
    const playedDays = playedByDay.size ? Array.from(playedByDay.keys()).sort((a, b) => a - b) : [];
    for (let t = 0; t < N; t++) {
      // 마지막 연전(슬롯 순, 같은 슬롯이면 시리즈 번호 순)의 구장
      let lastSlot = -1, lastIndex = -1, location = -1;
      const daysPlayed = new Set();
      for (const s of series) {
        if (s.home !== t && s.away !== t) continue;
        if (s.slot > lastSlot || (s.slot === lastSlot && s.index > lastIndex)) { lastSlot = s.slot; lastIndex = s.index; location = s.home; }
        for (let k = 0; k < s.len; k++) if (!cancelledFirst.has(s.index + '|' + D().isoDate(s.start + k))) daysPlayed.add(s.start + k);
      }
      let moves = ctx0.moveCount[t], distance = ctx0.distTenths[t], dh = 0;
      for (const d of playedDays) {
        let count = 0, at = -1;
        for (const [h, a] of playedByDay.get(d)) if (h === t || a === t) { count++; if (at < 0) at = h; }
        if (!count) continue;
        dh += count - 1;
        daysPlayed.add(d);
        if (location >= 0) {
          distance += dist[location][at];
          if (stadiumOf[location] !== stadiumOf[at]) moves++;
        }
        location = at;
      }
      let run = 0;
      for (let d = start - 1; daysPlayed.has(d); d--) run++;
      let last = NO_DAY;
      for (const d of daysPlayed) if (last === NO_DAY || d > last) last = d;
      out.push({ teamIndex: t, baseMoves: moves, baseDistanceTenths: distance, startLocation: location, runAtStart: run, lastPlayedDay: last, doubleHeadersUsed: dh });
    }
    return out;
  }

  // ---- 채점 (엔진 RescheduleScoreFormulas.totals와 같다) ----
  function totals(ctx) {
    const { N, days, games, hist, settings: st, stadiumOf, dist } = ctx;
    const Dn = days.length;
    const count = new Int32Array(N * Dn);
    const first = new Array(N * Dn).fill(null), second = new Array(N * Dn).fill(null);
    const stadiums = Math.max(0, ...stadiumOf) + 1;
    const stadiumMatchupCount = new Int32Array(stadiums * Dn);
    const matchupDay = new Map();
    const t = { ruleViolations: 0, unplaced: 0, levelPenalty: [0, 0, 0, 0, 0, 0], mondayGames: 0, doubleHeaderTotal: 0, addedTenthsTotal: 0 };
    let stadiumExtra = 0;
    for (const g of games) {
      if (g.day < 0) { t.unplaced++; continue; }
      const d = g.day;
      if (days[d].monday) t.mondayGames++;
      for (const team of [g.home, g.away]) {
        const cell = team * Dn + d;
        const c = count[cell]++;
        if (c === 0 || g.id < first[cell].id) { if (c > 0) second[cell] = first[cell]; first[cell] = g; }
        else if (c === 1 || g.id < second[cell].id) second[cell] = g;
      }
      const key = (g.home * N + g.away) * Dn + d;
      const n = (matchupDay.get(key) || 0) + 1;
      matchupDay.set(key, n);
      if (n === 1) {
        const sc = stadiumOf[g.home] * Dn + d;
        if (stadiumMatchupCount[sc] > 0) stadiumExtra++;
        stadiumMatchupCount[sc]++;
      }
    }
    for (const n of matchupDay.values()) if (n > 1) t.doubleHeaderTotal += n - 1;
    let violations = stadiumExtra;
    t.lastDay = new Array(N); t.moves = new Array(N); t.distanceTenths = new Array(N); t.addedTenths = new Array(N); t.addedMoves = new Array(N); t.doubleHeaders = new Array(N);
    for (let team = 0; team < N; team++) {
      const h = hist[team];
      let run = h.runAtStart, prev = h.startLocation, added = 0, moves = 0, dh = 0, lastIndex = -1;
      for (let d = 0; d < Dn; d++) {
        const cell = team * Dn + d;
        const c = count[cell];
        if (c === 0) { run = 0; continue; }
        const f = first[cell], s = second[cell];
        if (c === 2 && f.home === s.home && f.away === s.away) dh++;
        else if (c >= 2) { violations += c - 1; dh += c - 1; }
        run++;
        if (run > st.maxConsecutiveDays) violations++;
        lastIndex = d;
        const loc = f.home;
        if (prev >= 0) { added += dist[prev][loc]; if (stadiumOf[prev] !== stadiumOf[loc]) moves++; }
        prev = loc;
      }
      const dhTotal = dh + h.doubleHeadersUsed;
      if (dhTotal > st.maxDoubleHeaders) violations += dhTotal - st.maxDoubleHeaders;
      t.doubleHeaders[team] = dh; t.addedTenths[team] = added; t.addedMoves[team] = moves; t.addedTenthsTotal += added;
      t.moves[team] = h.baseMoves + moves; t.distanceTenths[team] = h.baseDistanceTenths + added;
      t.lastDay[team] = lastIndex >= 0 ? days[lastIndex].day : h.lastPlayedDay;
    }
    t.ruleViolations = violations;
    t.levelPenalty[LAST_DAY] = lastDayPenalty(t.lastDay, st.lastDayToleranceDays);
    t.levelPenalty[FAIR_MOVES] = scaledGapPenalty(t.moves, st.moveGap);
    t.levelPenalty[FAIR_DISTANCE] = distanceGapPenalty(t.distanceTenths, st.distanceGapTenths);
    t.levelPenalty[ADDED_DISTANCE] = t.addedTenthsTotal;
    t.levelPenalty[MONDAY] = t.mondayGames;
    t.levelPenalty[DOUBLE_HEADER] = t.doubleHeaderTotal;
    return t;
  }

  function lastDayPenalty(last, tol) {
    let sum = 0;
    for (let i = 0; i < last.length; i++) {
      if (last[i] === NO_DAY) continue;
      for (let j = i + 1; j < last.length; j++) {
        if (last[j] === NO_DAY) continue;
        const ex = Math.abs(last[i] - last[j]) - tol;
        if (ex > 0) sum += ex * ex;
      }
    }
    return sum;
  }
  function scaledGapPenalty(values, gap) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) { const ex = Math.abs(values[i] - values[j]) - gap; if (ex > 0) sum += ex * ex; }
    return Math.round(sum * 100);
  }
  function distanceGapPenalty(values, gapTenths) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) { const ex = Math.abs(values[i] - values[j]) - gapTenths; if (ex > 0) sum += ex * ex; }
    return sum;
  }

  /** { hard: [-위반, -못 넣은 경기], soft: 기준 순서대로 } */
  function scoreOf(t, st) {
    return { hard: [-t.ruleViolations, -t.unplaced], soft: st.levels.map((l) => -t.levelPenalty[l]) };
  }
  function scoreString(score) {
    const z = (v) => (v === 0 ? 0 : v);
    return '[' + score.hard.map(z).join('/') + ']hard/[' + score.soft.map(z).join('/') + ']soft';
  }
  function compareScore(a, b) {
    const fa = a.hard.concat(a.soft), fb = b.hard.concat(b.soft);
    for (let i = 0; i < fa.length; i++) if (fa[i] !== fb[i]) return fa[i] - fb[i];
    return 0;
  }

  // ---- 규칙 위반 문장 (엔진 RuleCheck와 같다) ----
  function violations(ctx) {
    const { N, days, games, hist, settings: st, teams, stadiumOf } = ctx;
    const Dn = days.length;
    const byTeamDay = [];
    for (let i = 0; i < N; i++) { const row = []; for (let d = 0; d < Dn; d++) row.push([]); byTeamDay.push(row); }
    const sorted = games.slice().sort((a, b) => a.id - b.id);
    for (const g of sorted) if (g.day >= 0) { byTeamDay[g.home][g.day].push(g); byTeamDay[g.away][g.day].push(g); }
    const out = [];
    for (let t = 0; t < N; t++) for (let d = 0; d < Dn; d++) {
      const list = byTeamDay[t][d];
      const ok = list.length <= 1 || (list.length === 2 && list[0].home === list[1].home && list[0].away === list[1].away);
      if (!ok) out.push({ code: 'DH-1', team: teams[t].name, from: days[d].date, to: days[d].date, text: subject(teams[t].name) + ' ' + label(days[d].day) + '에 ' + list.length + '경기를 합니다. 한 구단은 하루 1경기(더블헤더 날은 같은 상대와 2경기)만 합니다.' });
    }
    for (let d = 0; d < Dn; d++) {
      const homes = [], matchups = [];
      for (const g of sorted) {
        if (g.day !== d) continue;
        const s = stadiumOf[g.home];
        while (homes.length <= s) { homes.push([]); matchups.push([]); }
        const mk = teams[g.home].name + '-' + teams[g.away].name;
        if (!matchups[s].includes(mk)) { matchups[s].push(mk); homes[s].push(g.home); }
      }
      for (let s = 0; s < homes.length; s++) {
        if (matchups[s].length > 1) {
          const host = homes[s][0];
          out.push({ code: 'DH-2', team: teams[host].name, from: days[d].date, to: days[d].date, text: teams[host].stadium + '에서 ' + label(days[d].day) + '에 ' + matchups[s].length + '대진이 열립니다. 한 구장은 하루 1대진만 엽니다.' });
        }
      }
    }
    for (let t = 0; t < N; t++) {
      const name = teams[t].name, h = hist[t];
      let run = h.runAtStart, runStart = 0, inWindow = false, dh = h.doubleHeadersUsed;
      for (let d = 0; d <= Dn; d++) {
        const playedDay = d < Dn && byTeamDay[t][d].length > 0;
        if (playedDay) {
          if (run === 0) runStart = d;
          run++;
          inWindow = true;
          if (byTeamDay[t][d].length >= 2) dh += byTeamDay[t][d].length - 1;
          continue;
        }
        if (inWindow && run > st.maxConsecutiveDays) {
          const from = days[runStart].day - (runStart === 0 ? h.runAtStart : 0);
          const to = days[d - 1].day;
          out.push({ code: 'DH-4', team: name, from: D().isoDate(from), to: D().isoDate(to), text: subject(name) + ' ' + label(from) + '~' + label(to) + ' ' + run + '일 연속 경기합니다. 연속 경기일 상한은 ' + st.maxConsecutiveDays + '일입니다.' });
        }
        run = 0;
        inWindow = false;
      }
      if (dh > st.maxDoubleHeaders) out.push({ code: 'DH-5', team: name, from: null, to: null, text: name + '의 더블헤더가 ' + dh + '번입니다. 더블헤더 상한은 ' + st.maxDoubleHeaders + '번입니다.' });
    }
    return out;
  }

  // ---- 점유표 (엔진 DayGrid와 같은 검사 순서) ----
  function Grid(ctx, pinnedOnly) {
    const N = ctx.N, Dn = ctx.days.length;
    this.ctx = ctx; this.N = N; this.Dn = Dn;
    this.maxRun = ctx.settings.maxConsecutiveDays; this.maxDh = ctx.settings.maxDoubleHeaders;
    this.runAtStart = ctx.hist.map((h) => h.runAtStart);
    this.dh = ctx.hist.map((h) => h.doubleHeadersUsed);
    this.count = new Int32Array(N * Dn);
    this.first = new Array(N * Dn).fill(null); this.second = new Array(N * Dn).fill(null);
    const stadiums = Math.max(0, ...ctx.stadiumOf) + 1;
    this.stadiumGames = new Int32Array(stadiums * Dn);
    this.stadiumHome = new Int32Array(stadiums * Dn).fill(-1);
    this.dayOf = new Int32Array(ctx.games.length).fill(-1);
    this.blockedTeam = -1;
    for (const g of ctx.games) if (g.day >= 0 && (!pinnedOnly || g.pinned)) this.place(g, g.day);
  }
  Grid.prototype._add = function (t, d, g) {
    const cell = t * this.Dn + d, c = this.count[cell]++;
    if (c === 0) this.first[cell] = g;
    else if (c === 1) { if (g.id < this.first[cell].id) { this.second[cell] = this.first[cell]; this.first[cell] = g; } else this.second[cell] = g; }
  };
  Grid.prototype._drop = function (t, d, g) {
    const cell = t * this.Dn + d;
    if (this.count[cell] <= 0) return;
    if (this.first[cell] === g) { this.first[cell] = this.second[cell]; this.second[cell] = null; } else if (this.second[cell] === g) this.second[cell] = null;
    this.count[cell]--;
  };
  Grid.prototype._isDh = function (h, a, d) {
    const ch = h * this.Dn + d, ca = a * this.Dn + d;
    return this.count[ch] === 2 && this.count[ca] === 2 && this.first[ch].home === this.second[ch].home && this.first[ch].away === this.second[ch].away;
  };
  Grid.prototype.place = function (g, d) {
    this._add(g.home, d, g); this._add(g.away, d, g);
    if (this._isDh(g.home, g.away, d)) { this.dh[g.home]++; this.dh[g.away]++; }
    const sc = this.ctx.stadiumOf[g.home] * this.Dn + d;
    this.stadiumGames[sc]++; this.stadiumHome[sc] = g.home;
    this.dayOf[g.id] = d;
  };
  Grid.prototype.remove = function (g) {
    const d = this.dayOf[g.id];
    if (d < 0) return;
    if (this._isDh(g.home, g.away, d)) { this.dh[g.home]--; this.dh[g.away]--; }
    this._drop(g.home, d, g); this._drop(g.away, d, g);
    const sc = this.ctx.stadiumOf[g.home] * this.Dn + d;
    if (--this.stadiumGames[sc] <= 0) { this.stadiumGames[sc] = 0; this.stadiumHome[sc] = -1; }
    this.dayOf[g.id] = -1;
  };
  Grid.prototype.runThrough = function (t, d) {
    let left = 0, i = d - 1;
    while (i >= 0 && this.count[t * this.Dn + i] > 0) { left++; i--; }
    if (i < 0) left += this.runAtStart[t];
    let right = 0;
    for (let j = d + 1; j < this.Dn && this.count[t * this.Dn + j] > 0; j++) right++;
    return left + 1 + right;
  };
  Grid.prototype.check = function (g, d) {
    const h = g.home, a = g.away, Dn = this.Dn;
    const hc = this.count[h * Dn + d], ac = this.count[a * Dn + d];
    this.blockedTeam = -1;
    if (hc === 0 && ac === 0) {
      const sh = this.stadiumHome[this.ctx.stadiumOf[h] * Dn + d];
      if (sh >= 0) { this.blockedTeam = sh; return STADIUM_BUSY; }
      if (this.runThrough(h, d) > this.maxRun) { this.blockedTeam = h; return RUN_LIMIT; }
      if (this.runThrough(a, d) > this.maxRun) { this.blockedTeam = a; return RUN_LIMIT; }
      return OK;
    }
    const fh = this.first[h * Dn + d];
    if (hc === 1 && ac === 1 && fh === this.first[a * Dn + d] && fh.home === g.home && fh.away === g.away) {
      if (fh.pinned) { this.blockedTeam = h; return PINNED_DAY; }
      if (this.dh[h] >= this.maxDh) { this.blockedTeam = h; return DH_LIMIT; }
      if (this.dh[a] >= this.maxDh) { this.blockedTeam = a; return DH_LIMIT; }
      return OK_DH;
    }
    this.blockedTeam = hc > 0 ? h : a;
    return TEAM_BUSY;
  };
  Grid.prototype.canPlace = function (g, d) { return this.check(g, d) <= OK_DH; };
  /** 경기들을 새 날로(-1이면 비움) 옮겨도 규칙을 지키는가. 표는 되돌린다 */
  Grid.prototype.doable = function (list, targets) {
    const before = list.map((g) => this.dayOf[g.id]);
    if (list.some((g) => g.pinned)) return false;
    for (const g of list) this.remove(g);
    let ok = true, placed = 0;
    for (; placed < list.length; placed++) {
      const d = targets[placed];
      if (d < 0) continue;
      if (!this.canPlace(list[placed], d)) { ok = false; break; }
      this.place(list[placed], d);
    }
    for (let i = 0; i < placed; i++) if (targets[i] >= 0) this.remove(list[i]);
    list.forEach((g, i) => { if (before[i] >= 0) this.place(g, before[i]); });
    return ok;
  };

  // ---- 못 넣은 경기와 이유 (엔진 RescheduleDiagnosis와 같은 문장) ----
  function reasonText(code, team, days, dayCount, g, ctx) {
    const st = ctx.settings;
    const when = days === dayCount ? '기간의 모든 날' : '기간 ' + dayCount + '일 중 ' + days + '일';
    if (code === 'RUN_LIMIT') return when + '은 넣으면 ' + team + '의 연속 경기일이 상한(' + st.maxConsecutiveDays + '일)을 넘습니다.';
    if (code === 'TEAM_BUSY') return when + '은 ' + subject(team) + ' 이미 다른 경기를 합니다.';
    if (code === 'STADIUM_BUSY') return when + '은 ' + ctx.teams[g.home].stadium + '에서 다른 경기가 열립니다.';
    if (code === 'DH_LIMIT') return st.maxDoubleHeaders === 0 ? when + '은 더블헤더로만 넣을 수 있는데 더블헤더를 쓰지 않게 정해 두었습니다.' : when + '은 더블헤더로만 넣을 수 있는데 ' + team + '의 더블헤더가 이미 상한(' + st.maxDoubleHeaders + '번)입니다.';
    if (code === 'PINNED_DAY') return when + '은 더블헤더로만 넣을 수 있는데 그날 경기가 이미 발표되었습니다.';
    return when + '은 넣을 자리가 있는데 아직 넣지 못했습니다. 다시 실행해 보세요.';
  }
  const CODE_OF = { [OK]: 'SEARCH', [OK_DH]: 'SEARCH', [TEAM_BUSY]: 'TEAM_BUSY', [STADIUM_BUSY]: 'STADIUM_BUSY', [RUN_LIMIT]: 'RUN_LIMIT', [DH_LIMIT]: 'DH_LIMIT', [PINNED_DAY]: 'PINNED_DAY' };

  function teamLimits(ctx, grid) {
    const { N, days, games, settings: st, teams, hist } = ctx;
    const Dn = days.length, maxRun = st.maxConsecutiveDays;
    const need = new Array(N).fill(0);
    const forced = []; for (let i = 0; i < N; i++) forced.push(new Uint8Array(Dn));
    for (const g of games) {
      need[g.home]++; need[g.away]++;
      if (g.pinned && g.day >= 0) { forced[g.home][g.day] = 1; forced[g.away][g.day] = 1; }
    }
    const out = [];
    for (let t = 0; t < N; t++) {
      let dp = new Array(maxRun + 1).fill(-1);
      dp[Math.min(grid.runAtStart[t], maxRun)] = 0;
      for (let d = 0; d < Dn; d++) {
        const next = new Array(maxRun + 1).fill(-1);
        for (let r = 0; r <= maxRun; r++) {
          if (dp[r] < 0) continue;
          if (!forced[t][d]) next[0] = Math.max(next[0], dp[r]);
          if (r + 1 <= maxRun) next[r + 1] = Math.max(next[r + 1], dp[r] + 1);
        }
        dp = next;
      }
      const best = Math.max(0, ...dp);
      const capacity = best + Math.max(0, st.maxDoubleHeaders - hist[t].doubleHeadersUsed);
      if (need[t] > capacity) out.push({ team: teams[t].name, capacity, need: need[t], text: topic(teams[t].name) + ' 이 기간에 최대 ' + capacity + '경기까지 할 수 있는데 넣어야 할 경기가 ' + need[t] + '경기입니다.' });
    }
    return out;
  }

  function explain(ctx) {
    const grid = new Grid(ctx, false);
    const limits = teamLimits(ctx, grid);
    const teams = ctx.teams, Dn = ctx.days.length;
    const out = [];
    for (const g of ctx.games.slice().sort((a, b) => a.id - b.id)) {
      if (g.day >= 0) continue;
      const counts = new Map(), teamOf = new Map(), order = [];
      for (let d = 0; d < Dn; d++) {
        const code = CODE_OF[grid.check(g, d)];
        const team = code === 'SEARCH' || grid.blockedTeam < 0 ? '' : teams[grid.blockedTeam].name;
        const key = code + '|' + team;
        if (!counts.has(key)) { counts.set(key, 0); order.push(key); }
        counts.set(key, counts.get(key) + 1);
        teamOf.set(key, team);
      }
      const teamIndex = (name) => teams.findIndex((t) => t.name === name);
      const keys = order.slice().sort((x, y) => (counts.get(y) - counts.get(x)) || (CODE_ORDER.indexOf(x.slice(0, x.indexOf('|'))) - CODE_ORDER.indexOf(y.slice(0, y.indexOf('|')))) || (teamIndex(teamOf.get(x)) - teamIndex(teamOf.get(y))));
      const reasons = [];
      let search = false;
      for (const k of keys) {
        const code = k.slice(0, k.indexOf('|'));
        if (code === 'SEARCH') search = true;
        reasons.push({ code, team: teamOf.get(k), days: counts.get(k), text: reasonText(code, teamOf.get(k), counts.get(k), Dn, g, ctx) });
      }
      const matchup = teams[g.home].name + '–' + teams[g.away].name;
      let text = search ? matchup + ' 1경기를 아직 넣지 못했습니다.' : matchup + ' 1경기를 넣을 날이 없습니다.';
      for (const l of limits) if (l.team === teams[g.home].name || l.team === teams[g.away].name) text += ' ' + l.text;
      for (let i = 0; i < Math.min(2, reasons.length); i++) text += ' ' + reasons[i].text;
      out.push({ game: g.key, home: teams[g.home].name, away: teams[g.away].name, reasons, text });
    }
    return { unplaced: out, teamLimits: limits };
  }

  // ---- 결과 모양 (엔진 RescheduleJobs.report와 같다) ----
  function planJson(ctx) {
    const per = new Map();
    for (const g of ctx.games) if (g.day >= 0) { const k = g.home + '-' + g.away + '|' + g.day; per.set(k, (per.get(k) || 0) + 1); }
    const out = ctx.games.map((g) => ({ game: g.key, date: g.day < 0 ? null : ctx.days[g.day].date, doubleHeader: g.day >= 0 && (per.get(g.home + '-' + g.away + '|' + g.day) || 0) > 1, fixed: g.pinned }));
    for (const p of ctx.played) out.push({ game: p.game, date: p.date, doubleHeader: false, fixed: true, played: true });
    return out;
  }
  function spread(values) { return values.length ? Math.max(...values) - Math.min(...values) : 0; }
  function lastDaySpread(last) {
    const v = last.filter((x) => x !== NO_DAY);
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
  }
  function metrics(ctx, t) {
    const tt = t || totals(ctx);
    const st = ctx.settings;
    const sp = lastDaySpread(tt.lastDay);
    const names = ctx.teams.map((x) => x.name);
    return {
      lastDay: { byTeam: names.map((n, i) => ({ team: n, date: tt.lastDay[i] === NO_DAY ? null : D().isoDate(tt.lastDay[i]) })), spreadDays: sp, toleranceDays: st.lastDayToleranceDays, within: sp <= st.lastDayToleranceDays },
      fairness: {
        byTeam: names.map((n, i) => ({ team: n, moves: tt.moves[i], distanceKm: km(tt.distanceTenths[i]), firstRoundMoves: ctx.hist[i].baseMoves, firstRoundDistanceKm: km(ctx.hist[i].baseDistanceTenths) })),
        movesSpread: spread(tt.moves), moveGap: st.moveGap, distanceSpreadKm: km(spread(tt.distanceTenths)), distanceGapKm: km(st.distanceGapTenths),
        firstRoundMovesSpread: spread(ctx.hist.map((h) => h.baseMoves)), firstRoundDistanceSpreadKm: km(spread(ctx.hist.map((h) => h.baseDistanceTenths)))
      },
      addedDistance: { totalKm: km(tt.addedTenthsTotal), byTeam: names.map((n, i) => ({ team: n, km: km(tt.addedTenths[i]), moves: tt.addedMoves[i] })) },
      mondayGames: tt.mondayGames,
      doubleHeaders: { total: tt.doubleHeaderTotal, byTeam: names.map((n, i) => ({ team: n, count: tt.doubleHeaders[i] })) },
      unplaced: tt.unplaced
    };
  }
  function report(ctx) {
    const t = totals(ctx);
    const score = scoreOf(t, ctx.settings);
    const ex = explain(ctx);
    return {
      mode: 'RESCHEDULE', engine: 'browser', plan: planJson(ctx), score, scoreString: scoreString(score), levels: ctx.settings.levelNames.slice(),
      metrics: metrics(ctx, t), violations: violations(ctx), unplaced: ex.unplaced, teamLimits: ex.teamLimits,
      period: { start: D().isoDate(ctx.start), end: D().isoDate(ctx.end) }
    };
  }

  /** 화면에서 고친 일정 [{game, date}]을 고정되지 않은 경기에 적용한다 */
  function applyPlan(ctx, plan) {
    const byDate = new Map(ctx.days.map((d) => [d.date, d.index]));
    const byGame = new Map();
    for (const p of plan || []) if (p && p.game != null) byGame.set(String(p.game), p.date == null ? null : String(p.date));
    for (const g of ctx.games) if (!g.pinned) { const d = byGame.get(g.key); g.day = d == null || !byDate.has(d) ? -1 : byDate.get(d); }
  }

  /** 채점: 엔진 /api/v1/score mode=RESCHEDULE와 같은 결과 */
  function score(project, plan) {
    const ctx = parse(project);
    applyPlan(ctx, plan);
    return report(ctx);
  }

  // ---- 간단한 배정 (서버보다 약하다. 배정 결과는 서버와 달라도 된다) ----
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    const f = () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    f.int = (n) => Math.floor(f() * n);
    return f;
  }

  function blockers(grid, g, d) {
    const out = [];
    const add = (x) => { if (x && !out.includes(x)) out.push(x); };
    for (const t of [g.home, g.away]) { add(grid.first[t * grid.Dn + d]); add(grid.second[t * grid.Dn + d]); }
    const host = grid.stadiumHome[grid.ctx.stadiumOf[g.home] * grid.Dn + d];
    if (host >= 0) { add(grid.first[host * grid.Dn + d]); add(grid.second[host * grid.Dn + d]); }
    return out.some((x) => x.pinned) ? null : out;
  }
  function relocate(grid, g, except, r) {
    const off = r.int(grid.Dn);
    let dh = -1;
    for (let k = 0; k < grid.Dn; k++) {
      const d = (off + k) % grid.Dn;
      if (d === except) continue;
      const c = grid.check(g, d);
      if (c === OK) { grid.place(g, d); return d; }
      if (c === OK_DH && dh < 0) dh = d;
    }
    if (dh >= 0) grid.place(g, dh);
    return dh;
  }

  function construct(ctx, free, r) {
    const grid = new Grid(ctx, true);
    const n = free.length, Dn = ctx.days.length;
    const done = new Uint8Array(n);
    let remaining = n;
    while (remaining > 0) {
      let pick = -1, pickCount = Infinity, ties = 0;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        let c = 0;
        for (let d = 0; d < Dn; d++) if (grid.canPlace(free[i], d)) c++;
        if (c < pickCount) { pick = i; pickCount = c; ties = 1; } else if (c === pickCount && r.int(++ties) === 0) pick = i;
      }
      const g = free[pick];
      done[pick] = 1; remaining--;
      if (pickCount === 0) { repair(grid, g, r); continue; }
      let anyNormal = false;
      for (let d = 0; d < Dn; d++) if (grid.check(g, d) === OK) { anyNormal = true; break; }
      let best = -1, bestLoss = Infinity, bt = 0;
      for (let d = 0; d < Dn; d++) {
        const c = grid.check(g, d);
        if (c > OK_DH || (anyNormal && c !== OK)) continue;
        let loss = 0;
        for (let i = 0; i < n; i++) {
          const o = free[i];
          if (done[i] || o === g) continue;
          const related = o.home === g.home || o.home === g.away || o.away === g.home || o.away === g.away || ctx.stadiumOf[o.home] === ctx.stadiumOf[g.home];
          if (related && grid.canPlace(o, d)) loss++;
        }
        if (loss < bestLoss) { best = d; bestLoss = loss; bt = 1; } else if (loss === bestLoss && r.int(++bt) === 0) best = d;
      }
      grid.place(g, best);
    }
    return { grid, days: free.map((g) => grid.dayOf[g.id]) };
  }
  function repair(grid, g, r) {
    const Dn = grid.Dn, off = r.int(Dn);
    for (let k = 0, tries = 0; k < Dn && tries < 200; k++) {
      const d = (off + k) % Dn;
      const bl = blockers(grid, g, d);
      if (!bl || !bl.length || bl.length > 2) continue;
      tries++;
      const before = bl.map((x) => grid.dayOf[x.id]);
      bl.forEach((x) => grid.remove(x));
      if (grid.canPlace(g, d)) {
        grid.place(g, d);
        const moved = [];
        let all = true;
        for (const x of bl) { const m = relocate(grid, x, d, r); moved.push(m); if (m < 0) { all = false; break; } }
        if (all) return;
        bl.forEach((x, i) => { if (moved[i] != null && moved[i] >= 0) grid.remove(x); });
        grid.remove(g);
      }
      bl.forEach((x, i) => grid.place(x, before[i]));
    }
  }

  /** 첫 배정: 여러 번 만들어 못 넣은 경기가 가장 적고, 같으면 점수가 높은 것. @return 못 넣은 경기 수 */
  function initialize(ctx, seed, restarts) {
    const free = ctx.games.filter((g) => !g.pinned);
    free.forEach((g) => { g.day = -1; });
    const r = rng(seed == null ? 1 : seed);
    let best = null, bestUnplaced = Infinity, bestScore = null;
    for (let k = 0; k < Math.max(1, restarts || 10); k++) {
      const { days } = construct(ctx, free, rng(r.int(0x7fffffff) + 1));
      free.forEach((g, i) => { g.day = days[i]; });
      const t = totals(ctx);
      const sc = scoreOf(t, ctx.settings);
      if (!best || t.unplaced < bestUnplaced || (t.unplaced === bestUnplaced && compareScore(sc, bestScore) > 0)) { best = days; bestUnplaced = t.unplaced; bestScore = sc; }
    }
    free.forEach((g, i) => { g.day = best[i]; });
    return bestUnplaced;
  }

  /**
   * 브라우저 탐색기(MockSolver.runDriver가 돌린다): 첫 배정 뒤, 옮기기·맞바꾸기를 규칙 검사로 거르고 나빠지지 않으면 받아들인다.
   * input: { project, seed }
   */
  function createSearch(input, options) {
    const ctx = parse(input.project);
    const seed = (options && options.seed) || 1;
    initialize(ctx, seed, 10);
    const r = rng(seed * 7 + 3);
    const free = ctx.games.filter((g) => !g.pinned);
    let current = scoreOf(totals(ctx), ctx.settings);
    let best = current, bestDays = ctx.games.map((g) => g.day), improvements = 0, iter = 0;
    let grid = new Grid(ctx, false);
    return {
      mode: 'RESCHEDULE',
      ctx,
      step(batch) {
        let improved = false;
        for (let b = 0; b < (batch || 64) && free.length; b++) {
          iter++;
          let list, targets;
          if (r() < 0.6) {
            const g = free[r.int(free.length)];
            list = [g]; targets = [r.int(ctx.days.length)];
          } else {
            const a = free[r.int(free.length)], c = free[r.int(free.length)];
            if (a === c || a.day < 0 || c.day < 0 || a.day === c.day) continue;
            list = [a, c]; targets = [c.day, a.day];
          }
          if (list.every((g, i) => g.day === targets[i]) || !grid.doable(list, targets)) continue;
          const before = list.map((g) => g.day);
          list.forEach((g, i) => { g.day = targets[i]; });
          const sc = scoreOf(totals(ctx), ctx.settings);
          if (compareScore(sc, current) >= 0) {
            list.forEach((g) => grid.remove(g));
            list.forEach((g) => { if (g.day >= 0) grid.place(g, g.day); });
            current = sc;
            if (compareScore(sc, best) > 0) { best = sc; bestDays = ctx.games.map((g) => g.day); improvements++; improved = true; }
          } else list.forEach((g, i) => { g.day = before[i]; });
        }
        return improved;
      },
      bestPlanList() {
        const now = ctx.games.map((g) => g.day);
        ctx.games.forEach((g, i) => { g.day = bestDays[i]; });
        const p = planJson(ctx);
        ctx.games.forEach((g, i) => { g.day = now[i]; });
        return p;
      },
      bestScoreObject() { return { hard: best.hard.slice(), soft: best.soft.slice() }; },
      improvements() { return improvements; },
      iterations() { return iter; }
    };
  }

  /** 끝난 브라우저 결과를 서버 done과 같은 모양으로(고칠 곳 확인은 서버만: 못 넣은 경기가 있으면 「~해 보세요」만) */
  function finishPayload(project, payload) {
    const rep = score(project, payload.plan);
    const fixes = rep.unplaced.length ? [{ code: 'TRY', confirmed: false, text: '마감일을 늦추거나 연속 경기일·더블헤더 상한을 늘려 보세요' }] : [];
    return Object.assign({}, payload, rep, { fixes, notice: '인터넷 연결 없이 만든 간단한 결과입니다. 연결된 상태에서 다시 실행하면 더 다듬어집니다' });
  }

  /** 화면 점검(설계 §6.4의 6): 결과에 실려 온 점수와 브라우저 채점이 다르면 오류. 같으면 null */
  function crossCheck(project, payload) {
    try {
      const rep = score(project, payload.plan);
      if (!payload.scoreString || rep.scoreString === payload.scoreString) return null;
      return '재편성 점수가 서버와 브라우저에서 다르게 계산되었습니다: ' + payload.scoreString + ' / ' + rep.scoreString;
    } catch (e) {
      return '재편성 결과를 다시 채점하지 못했습니다: ' + e.message;
    }
  }

  KBO.RescheduleDaily = {
    CRITERIA, LEVEL_NAMES, DEFAULTS,
    parse, totals, scoreOf, scoreString, compareScore, violations, explain, metrics, report, planJson, applyPlan, score,
    initialize, createSearch, finishPayload, crossCheck, Grid, josa: { hasBatchim, topic, subject }
  };
});
