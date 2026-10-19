/*
 * KBO 공통 코어 — 경기 기록·재편성 (§5.8, §6.3).
 *  - 경기(일자) 단위 상태: SCHEDULED(예정) / PLAYED(완료) / CANCELLED(취소)
 *  - 재편성 대상 = 구단쌍 목표 경기 수 − (완료 + 예정) = 잔여 + 취소
 *  - 재편성 문제: 같은 대진(홈 기준)의 대상 경기를 1~3경기 묶음(unit)으로 만들어 재편성 기간에 배치
 *  - Hard: RH-1 구단 하루 1경기(DH 예외) · RH-2 구장 하루 1대진 · RH-3 월요일/금지일 · RH-4 DH 한도 · RH-5 미배정
 *  - Soft: RS-1 마지막 경기일 · RS-2 이동거리 증가분(평준화, 합계) · RS-3 DH·월요일 경기 수
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).reschedule = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  const D = () => KBO.Dates;
  const STATUS = { SCHEDULED: '예정', PLAYED: '완료', CANCELLED: '취소' };
  const REASONS = { RAIN: '우천', HEAT: '폭염', DUST: '미세먼지', GROUND: '그라운드 사정', OTHER: '기타' };
  const HARD_RULES = [
    { code: 'RH-1', level: 0, label: '구단 하루 1경기', desc: '하루에 한 구단은 한 경기만 합니다(DH 허용 시 같은 대진 2경기 예외).' },
    { code: 'RH-2', level: 0, label: '구장 하루 1대진', desc: '하루에 한 구장은 한 대진만 수용합니다.' },
    { code: 'RH-3', level: 0, label: '월요일·경기 없는 날', desc: '월요일 경기 미허용 시 월요일, 경기 없는 날에는 배정할 수 없습니다.' },
    { code: 'RH-4', level: 0, label: '더블헤더 한도', desc: '구단별 더블헤더 수가 설정값 이하여야 합니다.' },
    { code: 'RH-5', level: 1, label: '미배정 재편성 경기', desc: '모든 재편성 대상 경기를 재편성 기간 안에 배정해야 합니다.' }
  ];
  const SOFT_RULES = [
    { code: 'RS-1', label: '마지막 경기일(기간 시작 후 일수)', unit: '일' },
    { code: 'RS-2a', label: '구단별 이동거리 증가분 편차', unit: '' },
    { code: 'RS-2b', label: '이동거리 증가분 합계', unit: 'km' },
    { code: 'RS-3', label: 'DH·월요일 경기 수', unit: '경기' }
  ];
  const SPREAD_STEP_KM = 50;
  const RULE_BY_CODE = {};
  for (const r of HARD_RULES) RULE_BY_CODE[r.code] = r;

  function gameKey(g) {
    return g.unit != null ? 'U:' + g.unit + '|' + g.date + '|' + (g.seq || 0) : 'M:' + g.match + '|' + g.date;
  }

  function statusMap(project) {
    const map = new Map();
    for (const g of project.games || []) map.set(gameKey(g), g);
    return map;
  }

  /** 재편성 묶음이 차지하는 날짜(일 번호) 목록. DH면 첫날에 2경기. */
  function unitDays(startDay, games, dh) {
    const out = [];
    if (dh && games >= 2) {
      out.push(startDay, startDay);
      for (let i = 2; i < games; i++) out.push(startDay + i - 1);
    } else {
      for (let i = 0; i < games; i++) out.push(startDay + i);
    }
    return out;
  }

  /**
   * 확정 일정의 모든 경기(일자 단위). 1차 편성 경기와 재편성 경기를 함께 돌려준다.
   */
  function computeGames(project) {
    const teamByName = new Map(project.teams.map((t) => [t.name, t]));
    const status = statusMap(project);
    const games = [];
    const plan = KBO.Score.planArrayFrom(project);
    project.matches.forEach((m, mi) => {
      const s = plan[mi];
      if (s < 0) return;
      const slot = project.calendar[s];
      const start = D().dayNum(slot.datetime);
      for (let i = 0; i < m.consecutive; i++) {
        const date = D().isoDate(start + i);
        const rec = status.get('M:' + mi + '|' + date);
        games.push({
          key: 'M:' + mi + '|' + date, source: 'INITIAL', match: mi, slot: s, seq: i, date, day: start + i,
          home: m.home, away: m.away, stadium: (teamByName.get(m.home) || {}).stadium || '',
          status: rec ? rec.status : 'SCHEDULED', reason: rec ? rec.reason : undefined, pinned: !!m.pinned
        });
      }
    });
    const rs = project.reschedule || {};
    const units = new Map((rs.units || []).map((u) => [u.id, u]));
    for (const p of rs.plan || []) {
      const u = units.get(p.unit);
      if (!u || !p.start) continue;
      const days = unitDays(D().dayNum(p.start), u.games, p.dh);
      const seen = {};
      days.forEach((d) => {
        const date = D().isoDate(d);
        const seq = seen[date] = (seen[date] || 0) + 1;
        const key = 'U:' + u.id + '|' + date + '|' + (seq - 1);
        const rec = status.get(key);
        games.push({
          key, source: 'RESCHEDULE', unit: u.id, seq: seq - 1, date, day: d, dh: !!p.dh && days.filter((x) => x === d).length > 1,
          home: u.home, away: u.away, stadium: (teamByName.get(u.home) || {}).stadium || '',
          status: rec ? rec.status : 'SCHEDULED', reason: rec ? rec.reason : undefined
        });
      });
    }
    games.sort((a, b) => a.day - b.day || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) || (a.match || 0) - (b.match || 0));
    return games;
  }

  /** 경기 상태 기록 (project.games 갱신). 예정으로 되돌리면 기록을 지운다. */
  function setGameStatus(project, game, status, reason) {
    const key = game.key || gameKey(game);
    project.games = (project.games || []).filter((g) => gameKey(g) !== key);
    if (status && status !== 'SCHEDULED') {
      const rec = game.unit != null
        ? { unit: game.unit, date: game.date, seq: game.seq || 0, status }
        : { match: game.match, date: game.date, status };
      if (status === 'CANCELLED') rec.reason = reason || 'RAIN';
      project.games.push(rec);
    }
  }

  /**
   * FR-P3 재편성 대상 계산 (1차 편성 경기 기준).
   * 반환: { pairs, byTeam, totals, needs: [{home, away, cancelled:[games], remaining}] }
   */
  function computeTargets(project, gamesList) {
    const settings = project.settings || {};
    const target = settings.gamesPerPair || 16;
    const rule = settings.remainingHomeRule || 'FEWER_HOME';
    const games = (gamesList || computeGames(project)).filter((g) => g.source === 'INITIAL');
    const names = project.teams.map((t) => t.name);
    const idx = new Map(names.map((n, i) => [n, i]));
    const N = names.length;
    const cell = () => ({ played: 0, scheduled: 0, cancelled: [], homeGames: 0 });
    const pairHome = []; // pairHome[h][a]
    for (let i = 0; i < N; i++) { pairHome.push([]); for (let j = 0; j < N; j++) pairHome[i].push(cell()); }
    for (const g of games) {
      const h = idx.get(g.home), a = idx.get(g.away);
      if (h == null || a == null) continue;
      const c = pairHome[h][a];
      if (g.status === 'PLAYED') c.played++;
      else if (g.status === 'CANCELLED') c.cancelled.push(g);
      else c.scheduled++;
    }
    const pairs = [];
    const needs = [];
    const teamHomeTotal = new Array(N).fill(0);
    for (let h = 0; h < N; h++) for (let a = 0; a < N; a++) if (h !== a) teamHomeTotal[h] += pairHome[h][a].played + pairHome[h][a].scheduled + pairHome[h][a].cancelled.length;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const ci = pairHome[i][j], cj = pairHome[j][i];
        const played = ci.played + cj.played;
        const scheduled = ci.scheduled + cj.scheduled;
        const cancelled = ci.cancelled.length + cj.cancelled.length;
        const need = Math.max(0, target - played - scheduled);
        let remaining = Math.max(0, need - cancelled);
        // 잔여 경기의 홈 결정(O-1): 이 구단쌍에서 홈 경기가 적은 쪽(또는 많은 쪽)에 하나씩 준다
        const homeCount = [ci.played + ci.scheduled + ci.cancelled.length, cj.played + cj.scheduled + cj.cancelled.length];
        const extra = [0, 0];
        for (let k = 0; k < remaining; k++) {
          const hi = homeCount[0] + extra[0], hj = homeCount[1] + extra[1];
          let pick;
          if (hi === hj) pick = teamHomeTotal[i] <= teamHomeTotal[j] ? 0 : 1;
          else if (rule === 'MORE_HOME') pick = hi > hj ? 0 : 1;
          else pick = hi < hj ? 0 : 1;
          extra[pick]++;
        }
        pairs.push({ a: names[i], b: names[j], target, played, scheduled, cancelled, need, remaining,
          byHome: [{ home: names[i], away: names[j], cancelled: ci.cancelled.length, remaining: extra[0] }, { home: names[j], away: names[i], cancelled: cj.cancelled.length, remaining: extra[1] }] });
        if (ci.cancelled.length + extra[0] > 0) needs.push({ home: names[i], away: names[j], cancelled: ci.cancelled, remaining: extra[0] });
        if (cj.cancelled.length + extra[1] > 0) needs.push({ home: names[j], away: names[i], cancelled: cj.cancelled, remaining: extra[1] });
      }
    }
    const byTeam = names.map((n) => ({ team: n, played: 0, scheduled: 0, cancelled: 0, remaining: 0, need: 0, homeNeed: 0 }));
    for (const p of pairs) {
      for (const side of [p.a, p.b]) {
        const t = byTeam[idx.get(side)];
        t.need += p.need;
      }
    }
    for (const g of games) {
      for (const side of [g.home, g.away]) {
        const t = byTeam[idx.get(side)];
        if (!t) continue;
        if (g.status === 'PLAYED') t.played++; else if (g.status === 'CANCELLED') t.cancelled++; else t.scheduled++;
      }
    }
    for (const n of needs) {
      byTeam[idx.get(n.home)].remaining += n.remaining; byTeam[idx.get(n.away)].remaining += n.remaining;
      byTeam[idx.get(n.home)].homeNeed += n.remaining + n.cancelled.length;
    }
    const totals = {
      remaining: pairs.reduce((s, p) => s + p.remaining, 0),
      cancelled: pairs.reduce((s, p) => s + p.cancelled, 0),
      need: pairs.reduce((s, p) => s + p.need, 0),
      played: pairs.reduce((s, p) => s + p.played, 0),
      scheduled: pairs.reduce((s, p) => s + p.scheduled, 0)
    };
    return { pairs, byTeam, totals, needs };
  }

  /** n경기를 1~3경기 묶음으로 나눈다 (4 → 2+2, 5 → 3+2) */
  function chunk(n) {
    if (n <= 0) return [];
    const parts = Math.ceil(n / 3);
    const base = Math.floor(n / parts);
    const out = [];
    let rest = n - base * parts;
    for (let i = 0; i < parts; i++) out.push(base + (rest-- > 0 ? 1 : 0));
    return out;
  }

  /** FR-P5 재편성 묶음 생성 */
  function buildUnits(targets) {
    const units = [];
    for (const n of targets.needs) {
      const total = n.cancelled.length + n.remaining;
      const parts = chunk(total);
      let ci = 0;
      parts.forEach((g, k) => {
        const sources = [];
        for (let i = 0; i < g; i++) {
          if (ci < n.cancelled.length) { const c = n.cancelled[ci++]; sources.push({ kind: 'CANCELLED', match: c.match, date: c.date, reason: c.reason }); }
          else sources.push({ kind: 'REMAINING' });
        }
        units.push({ id: n.home + '-' + n.away + '-' + (k + 1), home: n.home, away: n.away, games: g, sources });
      });
    }
    return units;
  }

  /** 재편성 기간의 날짜 정보 */
  function windowDays(project) {
    const rs = project.reschedule || {};
    const settings = project.settings || {};
    const start = D().dayNum(rs.start);
    const end = D().dayNum(rs.end);
    const rest = new Set(settings.restWeekdays || [1]);
    const black = D().expandRanges((rs.blackouts || []).concat(settings.blackouts || []));
    const days = [];
    for (let d = start; d <= end; d++) {
      days.push({ day: d, date: D().isoDate(d), weekday: D().weekday(d), monday: rest.has(D().weekday(d)), forbidden: black.has(d) });
    }
    return days;
  }

  /**
   * 재편성 채점 입력 (구조적 복제 가능). plan은 project.reschedule.plan을 묶음 순서로 정렬한 배열.
   */
  function buildInput(project) {
    const rs = project.reschedule || {};
    const scoreInput = KBO.Score.buildInput(project);
    const N = scoreInput.teams.length;
    const idx = new Map(scoreInput.teams.map((t, i) => [t.name, i]));
    const days = windowDays(project);
    const d0 = days.length ? days[0].day : 0;
    const Dn = days.length;
    const games = computeGames(project).filter((g) => g.source === 'INITIAL' && g.status !== 'CANCELLED');
    // 기간 시작 전 마지막 위치, 기간 내 고정 경기
    const lastLoc = new Array(N).fill(-1);
    const lastDay = new Array(N).fill(-Infinity);
    const fixed = [];
    for (const g of games) {
      const h = idx.get(g.home), a = idx.get(g.away);
      if (h == null || a == null) continue;
      if (g.day < d0) {
        for (const t of [h, a]) if (g.day >= lastDay[t]) { lastDay[t] = g.day; lastLoc[t] = h; }
      } else if (g.day - d0 < Dn) {
        fixed.push({ d: g.day - d0, home: h, away: a, match: g.match });
      }
    }
    const units = (rs.units || []).map((u) => ({ id: u.id, home: idx.get(u.home), away: idx.get(u.away), games: u.games }));
    const planById = new Map((rs.plan || []).map((p) => [p.unit, p]));
    const start = units.map((u) => { const p = planById.get(u.id); return p && p.start ? D().dayNum(p.start) - d0 : -1; });
    const dh = units.map((u) => { const p = planById.get(u.id); return p && p.dh ? 1 : 0; });
    return {
      mode: 'RESCHEDULE', teams: scoreInput.teams, stadiumOf: scoreInput.stadiumOf, dist: scoreInput.dist,
      days: days.map((x) => ({ day: x.day, monday: x.monday, forbidden: x.forbidden })),
      d0, allowMonday: rs.allowMonday !== false, allowDH: rs.allowDoubleHeader !== false,
      maxDH: rs.allowDoubleHeader === false ? 0 : (rs.maxDoubleHeaderPerTeam == null ? 3 : rs.maxDoubleHeaderPerTeam),
      units, fixed, lastLoc, start, dh
    };
  }

  function createContext(input) {
    const N = input.teams.length;
    const Dn = input.days.length;
    const U = input.units.length;
    const ctx = {
      input, N, Dn, U,
      uHome: Int32Array.from(input.units.map((u) => u.home)), uAway: Int32Array.from(input.units.map((u) => u.away)),
      uGames: Int32Array.from(input.units.map((u) => u.games)),
      stadiumOf: Int32Array.from(input.stadiumOf), dist: new Int32Array(N * N),
      monday: Uint8Array.from(input.days.map((d) => (d.monday ? 1 : 0))), forbidden: Uint8Array.from(input.days.map((d) => (d.forbidden ? 1 : 0))),
      allowMonday: input.allowMonday, allowDH: input.allowDH, maxDH: input.maxDH,
      fixedTeamDay: new Int32Array(N * Dn), fixedStadiumDay: new Int32Array(64 * Dn),
      teamDay: new Int32Array(N * Dn), stadiumDay: new Int32Array(64 * Dn), dhCount: new Int32Array(N),
      // 경로 계산용: 구단·일자별 위치(경기 없음 = -1)
      locDay: new Int32Array(N * Dn), fixedLocDay: new Int32Array(N * Dn)
    };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) ctx.dist[i * N + j] = input.dist[i][j];
    ctx.fixedLocDay.fill(-1);
    for (const f of input.fixed) {
      ctx.fixedTeamDay[f.home * Dn + f.d]++; ctx.fixedTeamDay[f.away * Dn + f.d]++;
      ctx.fixedStadiumDay[ctx.stadiumOf[f.home] * Dn + f.d]++;
      ctx.fixedLocDay[f.home * Dn + f.d] = f.home; ctx.fixedLocDay[f.away * Dn + f.d] = f.home;
    }
    return ctx;
  }

  /** out: [hard0, hard1, rs1, rs2a, rs2b, rs3] (모두 0 이하) */
  function evaluate(ctx, start, dh, out) {
    const { N, Dn, U, uHome, uAway, uGames, stadiumOf } = ctx;
    const teamDay = ctx.teamDay, stadiumDay = ctx.stadiumDay, locDay = ctx.locDay;
    teamDay.set(ctx.fixedTeamDay);
    stadiumDay.set(ctx.fixedStadiumDay);
    locDay.set(ctx.fixedLocDay);
    ctx.dhCount.fill(0);
    let h0 = 0, unassigned = 0, lastDay = -1, special = 0;
    for (let u = 0; u < U; u++) {
      const s = start[u];
      const g = uGames[u];
      if (s < 0) { unassigned += g; continue; }
      const useDH = dh[u] && g >= 2;
      const span = useDH ? g - 1 : g;
      if (s + span > Dn) { unassigned += g; continue; }
      const h = uHome[u], a = uAway[u], st = stadiumOf[h];
      if (useDH) { ctx.dhCount[h]++; ctx.dhCount[a]++; special++; }
      for (let k = 0; k < span; k++) {
        const d = s + k;
        teamDay[h * Dn + d]++; teamDay[a * Dn + d]++;
        stadiumDay[st * Dn + d]++;
        locDay[h * Dn + d] = h; locDay[a * Dn + d] = h;
        const gamesToday = useDH && k === 0 ? 2 : 1;
        if (ctx.forbidden[d]) h0 += gamesToday;
        if (ctx.monday[d]) { if (!ctx.allowMonday) h0 += gamesToday; special += gamesToday; }
        if (d > lastDay) lastDay = d;
      }
    }
    for (let i = 0; i < N * Dn; i++) if (teamDay[i] > 1) h0 += teamDay[i] - 1;
    for (let i = 0; i < stadiumDay.length; i++) if (stadiumDay[i] > 1) h0 += stadiumDay[i] - 1;
    for (let t = 0; t < N; t++) if (ctx.dhCount[t] > ctx.maxDH) h0 += ctx.dhCount[t] - ctx.maxDH;
    // 이동거리 증가분
    let total = 0, sum = 0;
    const inc = ctx._inc || (ctx._inc = new Float64Array(N));
    for (let t = 0; t < N; t++) {
      let prev = ctx.input.lastLoc[t];
      let d = 0;
      for (let k = 0; k < Dn; k++) {
        const loc = locDay[t * Dn + k];
        if (loc < 0) continue;
        if (prev >= 0) d += ctx.dist[prev * N + loc];
        prev = loc;
      }
      inc[t] = d; sum += d;
    }
    total = Math.floor(sum / 10);
    const mean = N ? sum / N : 0;
    let spread = 0;
    for (let t = 0; t < N; t++) { const steps = Math.floor(Math.abs(inc[t] - mean) / (SPREAD_STEP_KM * 10)); spread += steps * steps; }
    const o = out || new Array(6);
    o[0] = -h0; o[1] = -unassigned; o[2] = -(lastDay + 1); o[3] = -spread; o[4] = -total; o[5] = -special;
    return o;
  }

  function planFromArrays(input, start, dh) {
    return input.units.map((u, i) => ({ unit: u.id, start: start[i] >= 0 ? D().isoDate(input.d0 + start[i]) : null, dh: !!dh[i] }));
  }

  /** 화면용 상세 채점 */
  function explain(project) {
    const input = buildInput(project);
    const ctx = createContext(input);
    const start = Int32Array.from(input.start);
    const dh = Uint8Array.from(input.dh);
    const arr = evaluate(ctx, start, dh, []);
    const names = input.teams.map((t) => t.name);
    const Dn = ctx.Dn;
    const violations = [];
    let vid = 0;
    const add = (v) => { v.id = 'r' + (vid++); v.level = RULE_BY_CODE[v.code].level; v.label = RULE_BY_CODE[v.code].label; violations.push(v); };
    const dateOf = (k) => D().fmtDate(input.d0 + k);
    // 일자별 점유 재구성 (설명용)
    const teamDayUnits = new Map();
    const stadDayUnits = new Map();
    const push = (map, key, val) => { if (!map.has(key)) map.set(key, []); map.get(key).push(val); };
    for (const f of input.fixed) {
      push(teamDayUnits, f.home + ':' + f.d, { fixed: true, home: f.home, away: f.away });
      push(teamDayUnits, f.away + ':' + f.d, { fixed: true, home: f.home, away: f.away });
      push(stadDayUnits, ctx.stadiumOf[f.home] + ':' + f.d, { fixed: true, home: f.home, away: f.away });
    }
    const unitInfo = [];
    for (let u = 0; u < ctx.U; u++) {
      const s = start[u], g = ctx.uGames[u];
      const useDH = dh[u] && g >= 2;
      const span = useDH ? g - 1 : g;
      const info = { unit: input.units[u].id, home: names[ctx.uHome[u]], away: names[ctx.uAway[u]], games: g, start: s >= 0 ? D().isoDate(input.d0 + s) : null, dh: !!useDH, days: [] };
      unitInfo.push(info);
      if (s < 0 || s + span > Dn) continue;
      for (let k = 0; k < span; k++) {
        const d = s + k;
        info.days.push(D().isoDate(input.d0 + d));
        const rec = { unit: info.unit, home: ctx.uHome[u], away: ctx.uAway[u] };
        push(teamDayUnits, ctx.uHome[u] + ':' + d, rec);
        push(teamDayUnits, ctx.uAway[u] + ':' + d, rec);
        push(stadDayUnits, ctx.stadiumOf[ctx.uHome[u]] + ':' + d, rec);
        const gamesToday = useDH && k === 0 ? 2 : 1;
        if (ctx.forbidden[d]) add({ code: 'RH-3', date: D().isoDate(input.d0 + d), units: [info.unit], amount: gamesToday, message: dateOf(d) + ' 경기 없는 날에 ' + info.away + ' @ ' + info.home + ' 배정' });
        if (ctx.monday[d] && !ctx.allowMonday) add({ code: 'RH-3', date: D().isoDate(input.d0 + d), units: [info.unit], amount: gamesToday, message: dateOf(d) + ' 월요일 경기 미허용인데 ' + info.away + ' @ ' + info.home + ' 배정' });
      }
    }
    for (const [key, list] of teamDayUnits) {
      if (list.length < 2) continue;
      const [t, d] = key.split(':').map(Number);
      add({ code: 'RH-1', date: D().isoDate(input.d0 + d), units: list.filter((x) => x.unit).map((x) => x.unit), teams: [t], amount: list.length - 1,
        message: dateOf(d) + ' ' + names[t] + ' 하루 ' + list.length + '경기: ' + list.map((x) => names[x.away] + ' @ ' + names[x.home] + (x.fixed ? '(기존)' : '')).join(', ') });
    }
    for (const [key, list] of stadDayUnits) {
      if (list.length < 2) continue;
      const [, d] = key.split(':').map(Number);
      add({ code: 'RH-2', date: D().isoDate(input.d0 + d), units: list.filter((x) => x.unit).map((x) => x.unit), amount: list.length - 1,
        message: dateOf(d) + ' ' + input.teams[list[0].home].stadium + ' 하루 ' + list.length + '대진: ' + list.map((x) => names[x.away] + ' @ ' + names[x.home]).join(', ') });
    }
    for (let t = 0; t < ctx.N; t++) {
      if (ctx.dhCount[t] > ctx.maxDH) add({ code: 'RH-4', teams: [t], units: [], amount: ctx.dhCount[t] - ctx.maxDH, message: names[t] + ' 더블헤더 ' + ctx.dhCount[t] + '회 (한도 ' + ctx.maxDH + ')' });
    }
    for (const info of unitInfo) {
      if (info.days.length) continue;
      add({ code: 'RH-5', units: [info.unit], amount: info.games, message: info.away + ' @ ' + info.home + ' ' + info.games + '경기 미배정 — ' + unassignedReason(ctx, input, start, dh, input.units.findIndex((u) => u.id === info.unit)) });
    }
    let h0 = 0, h1 = 0;
    for (const v of violations) { if (v.level === 0) h0 += v.amount; else h1 += v.amount; }
    const byCode = {};
    for (const r of HARD_RULES) byCode[r.code] = { code: r.code, label: r.label, desc: r.desc, level: r.level, count: 0, amount: 0 };
    for (const v of violations) { byCode[v.code].count++; byCode[v.code].amount += v.amount; }
    const teamMetrics = names.map((n, t) => {
      let prev = input.lastLoc[t], d = 0, games = 0, last = -1, monday = 0;
      for (let k = 0; k < Dn; k++) {
        const loc = ctx.locDay[t * Dn + k];
        if (loc < 0) continue;
        if (prev >= 0) d += ctx.dist[prev * ctx.N + loc];
        prev = loc; last = k;
      }
      for (const info of unitInfo) {
        if (info.home !== n && info.away !== n) continue;
        games += info.days.length ? info.games : 0;
        for (const day of info.days) if (ctx.monday[D().dayNum(day) - input.d0]) monday++;
      }
      return { team: t, name: n, addedKm: d / 10, games, doubleHeaders: ctx.dhCount[t], mondayGames: monday, lastDate: last >= 0 ? D().isoDate(input.d0 + last) : null };
    });
    const score = { hard: [arr[0], arr[1]], soft: arr.slice(2) };
    if (score.hard[0] !== -h0 || score.hard[1] !== -h1) {
      // 설명 경로와 고속 경로는 같은 정의를 쓴다. 다르면 고속 경로 값을 신뢰하고 표시한다.
      score.mismatch = { explainHard: [-h0, -h1] };
    }
    return { mode: 'RESCHEDULE', score, feasible: arr[0] === 0 && arr[1] === 0, violations, byCode, units: unitInfo, teamMetrics, input };
  }

  /** 미배정 사유: 다른 묶음 배치를 유지한 채 넣을 수 있는 날짜가 있는지 확인 */
  function unassignedReason(ctx, input, start, dh, u) {
    if (u < 0) return '묶음 정보 없음';
    const g = ctx.uGames[u];
    if (g > ctx.Dn) return '재편성 기간이 묶음 경기 수보다 짧음';
    let allowedStarts = 0;
    for (let s = 0; s + g <= ctx.Dn; s++) {
      let ok = true;
      for (let k = 0; k < g; k++) { const d = s + k; if (ctx.forbidden[d] || (ctx.monday[d] && !ctx.allowMonday)) { ok = false; break; } }
      if (ok) allowedStarts++;
    }
    if (!allowedStarts) return '연속 ' + g + '일 경기 가능한 날짜 없음(월요일·경기 없는 날 제외)';
    const base = evaluate(ctx, start, dh, []);
    const trial = Int32Array.from(start);
    for (let s = 0; s + g <= ctx.Dn; s++) {
      trial[u] = s;
      const r = evaluate(ctx, trial, dh, []);
      if (r[0] === base[0]) return '배정 가능한 날짜가 있음 — 재최적화하거나 직접 배치하세요';
    }
    return '두 구단이 함께 비는 날짜가 없음(구단·구장 일정 충돌)';
  }

  /** 재편성 탐색기 (Late Acceptance) */
  function createSearch(input, options) {
    const ctx = createContext(input);
    const random = KBO.MockSolver.rng((options && options.seed) || 42);
    const U = ctx.U, Dn = ctx.Dn;
    const start = Int32Array.from(input.start);
    const dh = Uint8Array.from(input.dh);
    if (options && options.init === 'SCRATCH') { start.fill(-1); dh.fill(0); }
    // 구성: 미배정 묶음을 경기 수 많은 순으로 가장 이른 충돌 없는 날짜에 넣는다
    const order = [];
    for (let u = 0; u < U; u++) if (start[u] < 0) order.push(u);
    order.sort((a, b) => ctx.uGames[b] - ctx.uGames[a]);
    for (const u of order) {
      const base = evaluate(ctx, start, dh, []);
      let placed = false;
      for (let s = 0; s + ctx.uGames[u] <= Dn && !placed; s++) {
        start[u] = s;
        const r = evaluate(ctx, start, dh, []);
        if (r[0] === base[0]) placed = true;
      }
      if (!placed && ctx.allowDH && ctx.uGames[u] >= 2) {
        dh[u] = 1;
        for (let s = 0; s + ctx.uGames[u] - 1 <= Dn && !placed; s++) {
          start[u] = s;
          const r = evaluate(ctx, start, dh, []);
          if (r[0] === base[0]) placed = true;
        }
        if (!placed) dh[u] = 0;
      }
      if (!placed) start[u] = -1;
    }
    const L = 6;
    const cur = evaluate(ctx, start, dh, new Array(L));
    const best = cur.slice();
    const bestStart = Int32Array.from(start);
    const bestDh = Uint8Array.from(dh);
    const lateSize = 300;
    const history = [];
    for (let i = 0; i < lateSize; i++) history.push(cur.slice());
    const cand = new Array(L);
    let iter = 0, improvements = 0;
    const cmp = KBO.MockSolver.cmp;
    let su = -1, sOld = 0, dOld = 0, su2 = -1, sOld2 = 0;
    function propose() {
      if (!U) return false;
      su2 = -1;
      const r = random();
      const u = random.int(U);
      su = u; sOld = start[u]; dOld = dh[u];
      if (r < 0.45) {
        const span = dh[u] && ctx.uGames[u] >= 2 ? ctx.uGames[u] - 1 : ctx.uGames[u];
        if (Dn - span < 0) return false;
        start[u] = start[u] >= 0 && random() < 0.5 ? Math.max(0, Math.min(Dn - span, start[u] + random.int(7) - 3)) : random.int(Dn - span + 1);
        return start[u] !== sOld;
      }
      if (r < 0.55) {
        if (!ctx.allowDH || ctx.uGames[u] < 2) return false;
        dh[u] = dh[u] ? 0 : 1;
        if (start[u] < 0) start[u] = random.int(Math.max(1, Dn - ctx.uGames[u] + 1));
        return true;
      }
      if (r < 0.9) {
        const v = random.int(U);
        if (v === u) return false;
        su2 = v; sOld2 = start[v];
        start[u] = sOld2; start[v] = sOld;
        return true;
      }
      // 미배정 해제/재배정
      start[u] = start[u] >= 0 && random() < 0.2 ? -1 : random.int(Math.max(1, Dn - ctx.uGames[u] + 1));
      return start[u] !== sOld;
    }
    function undo() {
      start[su] = sOld; dh[su] = dOld;
      if (su2 >= 0) start[su2] = sOld2;
    }
    return {
      mode: 'RESCHEDULE', ctx,
      step(n) {
        let improved = false;
        for (let k = 0; k < n; k++) {
          if (!propose()) { undo(); continue; }
          evaluate(ctx, start, dh, cand);
          const slot = iter % lateSize;
          iter++;
          if (cmp(cand, history[slot]) >= 0 || cmp(cand, cur) >= 0) {
            for (let i = 0; i < L; i++) cur[i] = cand[i];
            if (cmp(cur, best) > 0) {
              for (let i = 0; i < L; i++) best[i] = cur[i];
              bestStart.set(start); bestDh.set(dh);
              improvements++; improved = true;
            }
          } else undo();
          const h = history[slot];
          for (let i = 0; i < L; i++) h[i] = cur[i];
        }
        return improved;
      },
      bestScore() { return best.slice(); },
      bestPlanList() { return planFromArrays(input, bestStart, bestDh); },
      bestScoreObject() { return { hard: best.slice(0, 2), soft: best.slice(2) }; },
      improvements() { return improvements; },
      iterations() { return iter; }
    };
  }

  KBO.Reschedule = {
    STATUS, REASONS, HARD_RULES, SOFT_RULES, gameKey, unitDays, computeGames, setGameStatus, computeTargets, chunk, buildUnits,
    windowDays, buildInput, createContext, evaluate, explain, createSearch, planFromArrays
  };
});
