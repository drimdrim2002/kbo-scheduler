/*
 * KBO 공통 코어 — 시즌 경기와 재편성 배정 대상 (요구 docs/RESCHEDULE_DAILY_REQUIREMENTS.md §2, 설계 docs/RESCHEDULE_DAILY_ENGINE_DESIGN.md §1.4·§5.1).
 *  - 1차 편성 경기(일자 단위)와 상태: SCHEDULED(예정) / PLAYED(완료) / CANCELLED(취소). 취소 기록은 project.games
 *    — 1차 편성 경기 { match, date, status, reason } · 재편성 경기 { game: 경기 id, date, status, reason }
 *  - 배정 대상 = 구단쌍 목표 경기 수 − (완료 + 예정) = 잔여 + 취소. 잔여 경기 홈은 홈 73/71(settings.homeTotals)에 맞춘다.
 *  - buildTargets: 서버·브라우저 재편성(mode RESCHEDULE)에 보내는 reschedule.targets를 만든다
 *    (취소 `M:<시리즈>|<날짜>` · 잔여 `R:<홈>-<원정>`, 같은 홈·원정 잔여가 둘 이상이면 `R:<홈>-<원정>-<k>`).
 *    서버는 다시 만들지 않고 검사만 하므로, 화면에 보인 배정 대상과 엔진이 푼 문제가 늘 같다.
 *  옛 묶음 방식(reschedule.js: 1~3경기 묶음, RH/RS)은 지웠다. 날짜 단위 재편성의 점수·배정은 reschedule-daily.js.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).seasonGames = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  const D = () => KBO.Dates;
  const STATUS = { SCHEDULED: '예정', PLAYED: '완료', CANCELLED: '취소' };
  const REASONS = { RAIN: '우천', HEAT: '폭염', DUST: '미세먼지', GROUND: '그라운드 사정', OTHER: '기타' };

  /** 기록 키: 1차 편성 경기 `M:<시리즈>|<날짜>`, 재편성 경기 `G:<경기 id>|<날짜>` */
  function gameKey(g) {
    return g.game != null ? 'G:' + g.game + '|' + g.date : 'M:' + g.match + '|' + g.date;
  }

  function statusMap(project) {
    const map = new Map();
    for (const g of project.games || []) if (g && (g.match != null || g.game != null)) map.set(gameKey(g), g);
    return map;
  }

  /** 1차 편성의 모든 경기(일자 단위, 날짜 순). source는 늘 'INITIAL' */
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
    games.sort((a, b) => a.day - b.day || a.match - b.match);
    return games;
  }

  /** 경기 상태 기록(project.games 갱신). 예정으로 되돌리면 기록을 지운다. game: computeGames의 경기 또는 { game, date } */
  function setGameStatus(project, game, status, reason) {
    const key = game.key || gameKey(game);
    project.games = (project.games || []).filter((g) => gameKey(g) !== key);
    if (status && status !== 'SCHEDULED') {
      const rec = game.game != null ? { game: game.game, date: game.date, status } : { match: game.match, date: game.date, status };
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
    const extras = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const ci = pairHome[i][j], cj = pairHome[j][i];
        const need = Math.max(0, target - ci.played - cj.played - ci.scheduled - cj.scheduled);
        const remaining = Math.max(0, need - ci.cancelled.length - cj.cancelled.length);
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
        extras.push({ i, j, extra });
      }
    }
    // 홈 73/71(settings.homeTotals)이 있으면 구단별 전체 홈 수가 그대로 되게 잔여 경기 홈을 고친다(위 규칙은 출발점)
    const homeTotals = settings.homeTotals ? fitHomeTotals(names, settings, extras, teamHomeTotal) : null;
    for (const { i, j, extra } of extras) {
      const ci = pairHome[i][j], cj = pairHome[j][i];
      const played = ci.played + cj.played;
      const scheduled = ci.scheduled + cj.scheduled;
      const cancelled = ci.cancelled.length + cj.cancelled.length;
      const need = Math.max(0, target - played - scheduled);
      const remaining = Math.max(0, need - cancelled);
      pairs.push({ a: names[i], b: names[j], target, played, scheduled, cancelled, need, remaining,
        byHome: [{ home: names[i], away: names[j], cancelled: ci.cancelled.length, remaining: extra[0] }, { home: names[j], away: names[i], cancelled: cj.cancelled.length, remaining: extra[1] }] });
      if (ci.cancelled.length + extra[0] > 0) needs.push({ home: names[i], away: names[j], cancelled: ci.cancelled, remaining: extra[0] });
      if (cj.cancelled.length + extra[1] > 0) needs.push({ home: names[j], away: names[i], cancelled: cj.cancelled, remaining: extra[1] });
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
    return { pairs, byTeam, totals, needs, homeTotals };
  }

  /**
   * 잔여 경기 홈을 구단별 홈 목표(전체 홈 − 1차 편성 홈, 취소분 포함)에 맞춘다. extras[k].extra = [i의 홈, j의 홈]을 그 자리에서 고친다.
   * 넘치는 구단에서 모자란 구단까지 「홈 → 원정」 길을 찾아 그 길의 잔여 경기 홈을 한 칸씩 넘긴다(가운데 구단 수는 그대로).
   * 반환: { ok, message, byTeam: [{ team, total, initial, remainingHome }] }
   */
  function fitHomeTotals(names, settings, extras, teamHomeTotal) {
    const N = names.length;
    const tg = KBO.CalendarGen.homeTotalsTargets(names.map((n) => ({ name: n })), settings);
    const out = { ok: false, message: '', byTeam: [] };
    if (tg.errors.length) { out.message = tg.errors[0]; return out; }
    const want = tg.targets.map((t, i) => t.total - teamHomeTotal[i]);
    const have = new Array(N).fill(0);
    for (const x of extras) { have[x.i] += x.extra[0]; have[x.j] += x.extra[1]; }
    const sumW = want.reduce((a, b) => a + b, 0), sumH = have.reduce((a, b) => a + b, 0);
    if (sumW !== sumH) {
      out.message = '홈 목표로 남은 홈 경기 합(' + sumW + ')이 잔여 경기 수(' + sumH + ')와 다릅니다. 1차 편성 홈 경기 수를 확인하세요.';
    } else {
      // 구단 a가 b를 상대로 잔여 홈을 가진 자리: a → b
      const edgesFrom = (a) => extras.filter((x) => (x.i === a && x.extra[0] > 0) || (x.j === a && x.extra[1] > 0));
      for (let guard = 0; guard < 1000; guard++) {
        const src = have.findIndex((h, i) => h > want[i]);
        if (src < 0) break;
        const prev = new Map([[src, null]]);
        const q = [src];
        let dst = -1;
        while (q.length && dst < 0) {
          const a = q.shift();
          for (const x of edgesFrom(a)) {
            const b = x.i === a ? x.j : x.i;
            if (prev.has(b)) continue;
            prev.set(b, { a, x });
            if (have[b] < want[b]) { dst = b; break; }
            q.push(b);
          }
        }
        if (dst < 0) break;
        for (let b = dst; b !== src;) {
          const { a, x } = prev.get(b);
          if (x.i === a) { x.extra[0]--; x.extra[1]++; } else { x.extra[1]--; x.extra[0]++; }
          b = a;
        }
        have[src]--; have[dst]++;
      }
      const off = names.filter((n, i) => have[i] !== want[i]);
      out.ok = !off.length;
      if (off.length) out.message = '잔여 경기 홈을 홈 목표대로 나누지 못한 구단: ' + off.map((n) => n + '(목표 ' + want[names.indexOf(n)] + ' · 지금 ' + have[names.indexOf(n)] + ')').join(', ') + '.';
    }
    out.byTeam = names.map((n, i) => ({ team: n, total: tg.targets[i].total, initial: teamHomeTotal[i], remainingHome: have[i], remainingTarget: want[i] }));
    return out;
  }


  /**
   * 재편성 배정 대상(reschedule.targets). 홈 73/71이 맞지 않으면 ok=false와 구단별 차이(message)를 돌려준다 — 그때는 실행하지 않는다.
   * 반환: { ok, message, targets, cancelled, remaining, summary(computeTargets 결과) }
   */
  function buildTargets(project, gamesList) {
    const t = computeTargets(project, gamesList);
    const targets = [];
    for (const n of t.needs) {
      for (const c of n.cancelled) targets.push({ id: 'M:' + c.match + '|' + c.date, home: n.home, away: n.away, source: 'CANCELLED', match: c.match, date: c.date, reason: c.reason || 'RAIN' });
      for (let k = 0; k < n.remaining; k++) targets.push({ id: 'R:' + n.home + '-' + n.away + (k ? '-' + (k + 1) : ''), home: n.home, away: n.away, source: 'REMAINING' });
    }
    const ht = t.homeTotals;
    const ok = !ht || ht.ok;
    return { ok, message: ok ? '' : ht.message, targets, cancelled: t.totals.cancelled, remaining: t.totals.remaining, summary: t };
  }

  /** 1차 편성 마지막 경기일(ISO). 경기가 없으면 null */
  function firstRoundLastDate(project) {
    let last = null;
    for (const g of computeGames(project)) if (!last || g.date > last) last = g.date;
    return last;
  }

  KBO.SeasonGames = { STATUS, REASONS, gameKey, computeGames, setGameStatus, computeTargets, fitHomeTotals, buildTargets, firstRoundLastDate };
});
