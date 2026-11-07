/*
 * KBO 공통 코어 — 결과 고치기(연전 기간 고정 · 손으로 놓은 경기 · 홈 지정) 계산. DOM 없음.
 *  - pinsOf(project, fixedSlots): 서버로 보낼 고정 = 고정한 연전 기간의 모든 경기 + 손으로 놓은 경기(matches[].hand) + 정해 둔 대진(eventId로 고정된 것)
 *  - freeCount(n, fixedSlots): 새로 짤 연전 기간 수(고정하지 않은 것)
 *  - precheck(project, fixedSlots): 실행 전 검사. 고정한 경기끼리 생긴 「진짜」 위반만 돌려준다.
 *      고정한 경기만 남기고 채점하면 비어 있어서 걸리는 H0-a(모든 구단 출전)·H0-b(구장 수)·H0-c(경기 수)는 보지 않고,
 *      대신 고정한 것끼리 생긴 중복(한 구단 두 번 · 한 구장에 홈 둘 · 같이 쓰는 구장 구단 모두 원정)만 본다(서버 ProblemCodec.checkPinnedSeries와 같은 것).
 *      이어지는 규칙(H0-f 홈/원정 4연속, H1 같은 대진 연속)은 그 구단(그 대진)의 경기가 고정된 연전이 실제로 붙어 있을 때만 잇는다.
 *      고정하지 않은 연전이 사이에 있으면 끊긴 것으로 본다(엔진이 그 연전에서 바꿀 수 있다).
 *  - isPinnedStartFailure(message): 서버가 「고정한 채로는 처음부터 짤 수 없었다」고 답했는가(JobManager.problemFor)
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).fixPlan = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  /** 고정한 연전 기간 목록을 정리한다: 정수 · 범위 안 · 겹침 없음 · 오름차순 */
  function cleanSlots(slots, n) {
    const out = new Set();
    for (const s of slots || []) if (Number.isInteger(s) && s >= 0 && s < n) out.add(s);
    return Array.from(out).sort((a, b) => a - b);
  }

  /** 시리즈마다 배정된 연전 기간(없으면 -1) */
  function planOf(project) { return KBO.Score.planArrayFrom(project); }

  /** 경기마다 보낼 고정 여부(boolean[]) */
  function pinsOf(project, fixedSlots) {
    const fx = new Set(cleanSlots(fixedSlots, project.calendar.length)), plan = planOf(project);
    return project.matches.map((m, i) => !!(m.hand || (m.pinned && m.eventId) || (plan[i] >= 0 && fx.has(plan[i]))));
  }

  /** 프로젝트의 matches[].pinned를 pinsOf대로 맞춘다(그 자리에서 바꿈). 바뀐 경기 수를 돌려준다 */
  function syncPins(project, fixedSlots) {
    const want = pinsOf(project, fixedSlots);
    let n = 0;
    project.matches.forEach((m, i) => { if (!!m.pinned !== want[i]) { m.pinned = want[i]; n++; } });
    return n;
  }

  function freeCount(n, fixedSlots) { return n - cleanSlots(fixedSlots, n).length; }

  /** 연전 기간마다 홈 지정한 구단 이름(구장 지정 이벤트의 teams). { slot: [이름] } */
  function designations(project) {
    const out = {};
    for (const e of project.events || []) {
      if (e.mode !== 'STADIUM' || !Array.isArray(e.teams) || !e.teams.length) continue;
      const s = KBO.Score.resolveEventSlot(e, project.calendar);
      if (s < 0) continue;
      out[s] = (out[s] || []).concat(e.teams.filter((t) => !(out[s] || []).includes(t)));
    }
    return out;
  }

  const md = (datetime) => { const m = /^\d{4}-(\d\d)-(\d\d)/.exec(String(datetime)); return m ? +m[1] + '/' + +m[2] : String(datetime); };
  const slotLabel = (project, s) => md(project.calendar[s].datetime) + ' ' + project.calendar[s].consecutive + '연전';

  /**
   * 실행 전 검사. 돌려주는 값: { violations: [{ code, slot, slots?, matches, teams?, message }], pinned: boolean[] }
   * code는 채점기와 같은 규칙 이름(H0-a 중복 출전 · H0-b 한 구장 · H0-d 연전 수 · H0-e 홈 지정 · H0-f 4연속 · H1 같은 대진 연속)
   */
  function precheck(project, fixedSlots) {
    const pinned = pinsOf(project, fixedSlots), plan = planOf(project);
    const S = project.calendar.length, teams = project.teams.map((t) => t.name);
    const stadium = new Map(project.teams.map((t) => [t.name, t.stadium || '']));
    const owners = new Map();
    for (const t of project.teams) { const k = t.stadium || ''; if (!owners.has(k)) owners.set(k, []); owners.get(k).push(t.name); }
    const bySlot = [];
    for (let s = 0; s < S; s++) bySlot.push([]);
    project.matches.forEach((m, i) => { if (pinned[i] && plan[i] >= 0 && plan[i] < S) bySlot[plan[i]].push(i); });
    const des = designations(project), out = [];
    const M = project.matches;
    for (let s = 0; s < S; s++) {
      const list = bySlot[s], L = project.calendar[s].consecutive;
      if (!list.length) continue;
      const seen = new Map(), homes = new Map(), lab = slotLabel(project, s);
      for (const i of list) {
        const m = M[i];
        if (m.consecutive !== L) out.push({ code: 'H0-d', slot: s, matches: [i], message: lab + ' — ' + m.away + ' vs ' + m.home + ' ' + m.consecutive + '연전 경기가 ' + L + '연전 기간에 있음' });
        for (const t of [m.home, m.away]) { if (!seen.has(t)) seen.set(t, []); seen.get(t).push(i); }
        const st = stadium.get(m.home);
        if (!homes.has(st)) homes.set(st, []);
        homes.get(st).push(i);
      }
      for (const [t, ms] of seen) if (ms.length > 1) out.push({ code: 'H0-a', slot: s, matches: ms.slice(), teams: [t], message: lab + ' — ' + t + '이(가) 두 번 나옴' });
      for (const [st, ms] of homes) if (ms.length > 1) out.push({ code: 'H0-b', slot: s, matches: ms.slice(), message: lab + ' — ' + st + '에서 ' + ms.map((i) => M[i].home).join('·') + ' 모두 홈' });
      for (const t of des[s] || []) {
        const away = list.filter((i) => M[i].away === t);
        if (away.length) out.push({ code: 'H0-e', slot: s, matches: away, teams: [t], message: lab + ' — 홈 지정한 ' + t + '이(가) 원정' });
      }
      if (L === 3) {
        for (const [st, group] of owners) {
          if (group.length < 2 || homes.has(st)) continue;
          if (group.every((t) => seen.has(t))) out.push({ code: 'H0-b', slot: s, matches: list.filter((i) => group.includes(M[i].away)), teams: group.slice(), message: lab + ' — ' + st + '을(를) 쓰는 ' + group.join('·') + ' 모두 원정' });
        }
      }
      // H1: 바로 앞 연전에도 같은 두 구단의 경기가 고정되어 있을 때만
      if (s > 0 && bySlot[s - 1].length) {
        const key = (i) => [M[i].home, M[i].away].sort().join('|');
        const prev = new Map(bySlot[s - 1].map((i) => [key(i), i]));
        for (const i of list) if (prev.has(key(i))) out.push({ code: 'H1', slot: s, matches: [i, prev.get(key(i))], message: lab + ' — ' + M[i].home + '·' + M[i].away + ' 대진이 바로 앞 연전에 이어 또 잡힘' });
      }
    }
    // H0-f: 구단마다 그 구단 경기가 고정된 연전이 이어지는 동안만 홈/원정 연속을 센다
    for (const t of teams) {
      let run = null;
      const close = () => {
        if (run && run.slots.length > 3) {
          const sl = run.slots, ms = run.matches;
          out.push({ code: 'H0-f', slot: sl[3], slots: sl.slice(3), matches: ms.slice(3), teams: [t], message: t + ' ' + (run.home ? '홈' : '원정') + ' ' + sl.length + '연속 (' + slotLabel(project, sl[0]) + ' ~ ' + slotLabel(project, sl[sl.length - 1]) + ')' });
        }
        run = null;
      };
      for (let s = 0; s < S; s++) {
        const mine = bySlot[s].filter((i) => M[i].home === t || M[i].away === t);
        if (mine.length !== 1) { close(); continue; } // 비었거나(엔진이 정함) 두 번(위에서 따로 알림)이면 끊긴 것으로
        const home = M[mine[0]].home === t;
        if (run && run.home === home && run.slots[run.slots.length - 1] === s - 1) { run.slots.push(s); run.matches.push(mine[0]); }
        else { close(); run = { home, slots: [s], matches: [mine[0]] }; }
      }
      close();
    }
    const ORDER = ['H0-a', 'H0-b', 'H0-d', 'H0-e', 'H0-f', 'H1'];
    out.sort((a, b) => a.slot - b.slot || ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
    return { violations: out, pinned };
  }

  /** 위반을 연전 기간별로 센다: [{ slot, count }] (기간 순) */
  function bySlotCount(violations) {
    const m = new Map();
    for (const v of violations) m.set(v.slot, (m.get(v.slot) || 0) + 1);
    return Array.from(m, ([slot, count]) => ({ slot, count })).sort((a, b) => a.slot - b.slot);
  }

  /** 서버 오류가 「고정한 채로는 처음부터 짤 수 없었다」인가(그러면 이어서 풀기로 다시 보낸다) */
  function isPinnedStartFailure(message) {
    return /고정한 \d+연전 시리즈 \d+개를 그 자리에 둔 채로는|처음부터 짤 수 없었습니다/.test(String(message || ''));
  }

  /** 고정을 줄이라는 경고 단계: 'none'(넉넉함) · 'few'(10개 이하: 위반은 없어도 격차가 벌어짐) · 'tiny'(4개 이하: 못 짤 수 있음) · 'zero' */
  function freeLevel(free) { return free <= 0 ? 'zero' : free <= 4 ? 'tiny' : free <= 10 ? 'few' : 'none'; }

  KBO.FixPlan = { cleanSlots, pinsOf, syncPins, freeCount, freeLevel, designations, precheck, bySlotCount, isPinnedStartFailure, slotLabel };
  return KBO;
});
