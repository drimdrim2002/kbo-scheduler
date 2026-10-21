/*
 * KBO 공통 코어 — 탐색 과정 재생 모델.
 * 솔버 트레이스(bench.SolveTrace.toJson())를 "이벤트 i까지 적용한 상태"의 열로 바꾼다. DOM에 의존하지 않는다.
 *
 * 트레이스 형식: { seed, initialScore: {hard, soft} | null,
 *   teams: [{index, name, stadium}], slots: [{id, start, games, weekend, holiday}],
 *   series: [{id, home, away, games, slot}], events: [{elapsedMs, score: {hard, soft}, changes: [[seriesId, fromSlot, toSlot], ...]}] }
 * 슬롯 -1(또는 slots에 없는 id)은 미배정이다.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).replayModel = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  /** 홈 구단 색: teams 순서(index)로 고정한다. 10구단 넘으면 돌려 쓴다. */
  const PALETTE = ['#1F5FD6', '#D9480F', '#13703F', '#8A2BE2', '#B3261E', '#0E7C86', '#9A6700', '#C2255C', '#2F9E44', '#5C5F66'];

  /** 소프트 단계 일반 용어(인덱스 순). 점수는 음수(감점)이므로 화면에는 절댓값을 쓴다. */
  const LEVELS = [
    { key: 'unassigned', label: '슬롯 없는 시리즈', unit: '개' },
    { key: 'moveDev', label: '구단 간 이동 횟수 차이', unit: '' },
    { key: 'distDev', label: '구단 간 이동거리 차이', unit: '' },
    { key: 'holidayDev', label: '주말·공휴일 홈 경기 차이', unit: '' },
    { key: 'totalKm', label: '총 이동거리', unit: 'km' }
  ];

  const MIN_SEC = 20, MAX_SEC = 40, LEAD_MS = 1000, TAIL_RATIO = 0.1;

  function fmtInt(v) { return Math.round(v).toLocaleString('ko-KR'); }

  function check(cond, msg) { if (!cond) throw new Error('트레이스 형식 오류: ' + msg); }

  function normalize(trace) {
    check(trace && typeof trace === 'object', '객체가 아닙니다');
    check(Array.isArray(trace.teams) && trace.teams.length, 'teams가 없습니다');
    check(Array.isArray(trace.slots) && trace.slots.length, 'slots가 없습니다');
    check(Array.isArray(trace.series) && trace.series.length, 'series가 없습니다');
    const events = Array.isArray(trace.events) ? trace.events : [];
    const teams = trace.teams.map((t, i) => ({ index: t.index == null ? i : t.index, name: String(t.name == null ? i : t.name), stadium: t.stadium || '' }));
    const slots = trace.slots.map((s, i) => ({ id: s.id == null ? i : s.id, start: s.start || '', games: s.games || 0, weekend: !!s.weekend, holiday: s.holiday || 0 }));
    const series = trace.series.map((m, i) => ({ id: m.id == null ? i : m.id, home: m.home, away: m.away, games: m.games || 0, slot: m.slot == null ? (m.initialSlot == null ? -1 : m.initialSlot) : m.slot }));
    for (const e of events) { check(e && e.score && Array.isArray(e.score.soft), '이벤트 점수가 없습니다'); check(Array.isArray(e.changes), '이벤트 changes가 없습니다'); }
    return { seed: trace.seed, initialScore: trace.initialScore || null, teams, slots, series, events };
  }

  /** 슬롯별 사용 중인 줄(row) 집합을 만든다. */
  function occupancy(assign, row, slotCount) {
    const occ = new Array(slotCount);
    for (let s = 0; s < slotCount; s++) occ[s] = new Set();
    for (let i = 0; i < assign.length; i++) if (assign[i] >= 0) occ[assign[i]].add(row[i]);
    return occ;
  }
  function lowestFree(set) { let r = 0; while (set.has(r)) r++; return r; }

  /**
   * 변경 목록을 적용(dir=+1)하거나 되돌린다(dir=-1). assign·row를 복사해 새 배열로 돌려준다.
   * 줄 배치: 떠나는 카드의 줄을 먼저 비우고, 들어오는 카드는 그 슬롯의 가장 낮은 빈 줄을 받는다.
   */
  function apply(model, assign, row, changes, dir) {
    const a = Int32Array.from(assign), r = Int32Array.from(row);
    const occ = occupancy(a, r, model.slots.length);
    const moves = [];
    for (const c of changes) {
      const idx = model.seriesIndex.get(c[0]);
      if (idx == null) continue;
      const to = model.slotIndex.has(dir > 0 ? c[2] : c[1]) ? model.slotIndex.get(dir > 0 ? c[2] : c[1]) : -1;
      if (a[idx] >= 0) occ[a[idx]].delete(r[idx]);
      moves.push({ idx, from: a[idx], to });
      a[idx] = to; r[idx] = -1;
    }
    for (const m of moves) { if (m.to >= 0) { const free = lowestFree(occ[m.to]); occ[m.to].add(free); r[m.idx] = free; } }
    return { assign: a, row: r, moved: moves.map((m) => m.idx) };
  }

  function softAbs(score) { return (score && score.soft ? score.soft : []).map((v) => Math.abs(v)); }
  function hardSum(score) { return (score && score.hard ? score.hard : []).reduce((s, v) => s + Math.abs(v), 0); }

  /** 재생 시간 축: 이벤트 간 균등 간격 + 바뀐 시리즈 수에 따른 약간의 가중. 전체 20~40초. */
  function timeline(events) {
    const n = events.length;
    const total = Math.round(Math.min(MAX_SEC, Math.max(MIN_SEC, n * 0.8)) * 1000);
    const times = [0];
    if (!n) return { times, durationMs: total };
    const cmax = Math.max(1, ...events.map((e) => e.changes.length));
    const w = [1];
    for (let i = 1; i < n; i++) w.push(1 + 0.6 * events[i - 1].changes.length / cmax);
    const sum = w.reduce((s, v) => s + v, 0);
    const span = total * (1 - TAIL_RATIO) - LEAD_MS;
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += w[i]; times.push(Math.round(LEAD_MS + span * acc / sum)); }
    return { times, durationMs: total };
  }

  /** 상태 i-1 → i 해설 한 줄 */
  function caption(model, i) {
    const st = model.states[i];
    const km = (s) => (s.soft && s.soft.length >= 5 ? fmtInt(s.soft[4]) + 'km' : null);
    if (i === 0) {
      const k = st.soft.length ? km(st) : null;
      return '시작 상태 · 초기 배정 ' + model.series.filter((m) => m.slot >= 0).length + '개 시리즈' + (k ? ' · 총 이동거리 ' + k : '');
    }
    const prev = model.states[i - 1];
    const ev = model.events[i - 1];
    let desc = '';
    const total = LEVELS.length - 1;
    let first = -1;
    for (let l = 0; l < st.soft.length; l++) if (prev.soft.length && st.soft[l] !== prev.soft[l]) { first = l; break; }
    if (first >= 0) {
      const L = LEVELS[first] || { label: '공정성 ' + (first + 1), unit: '' };
      desc = L.label + ' ' + fmtInt(prev.soft[first]) + ' → ' + fmtInt(st.soft[first]) + L.unit;
      if (first !== total && st.soft.length > total && st.soft[total] !== prev.soft[total]) desc += ' · ' + LEVELS[total].label + ' ' + fmtInt(prev.soft[total]) + ' → ' + fmtInt(st.soft[total]) + 'km';
    } else if (prev.soft.length && st.soft.length > total) desc = LEVELS[total].label + ' ' + fmtInt(st.soft[total]) + 'km 유지';
    const hard = hardSum(ev.score);
    const names = [];
    for (const idx of st.changed) { const t = model.teams[model.series[idx].home]; const nm = t ? t.name : String(model.series[idx].home); if (!names.includes(nm)) names.push(nm); }
    const shown = names.slice(0, 3).join('·') + (names.length > 3 ? ' 외 ' + (names.length - 3) : '');
    return i + '번째 개선 · ' + moveWord(model, prev, ev.changes) + (desc ? ' · ' + desc : '') + (hard ? ' · 필수 규칙 위반 ' + hard + '건' : '') + (shown ? ' · ' + shown : '');
  }

  /**
   * 한 번의 개선이 어떤 수였는지 일상어로. 이벤트의 changes는 받아들인 수 하나가 옮긴 시리즈 전부다.
   * 1개 = 한 시리즈를 다른 날짜로 · 2개가 자리를 바꿈 = 맞바꿈 · 날짜 두 칸의 시리즈가 전부 오감 = 두 날짜를 통째로 맞바꿈 ·
   * 두 칸 사이에서 일부만 오감 = 바꿔 넣음 · 그 밖(세 칸 이상을 도는 수) = 돌려 넣음.
   */
  function moveWord(model, prev, changes) {
    const n = changes.length;
    if (n === 1) return '시리즈 1개를 다른 날짜로';
    const slots = new Set();
    for (const c of changes) { slots.add(c[1]); slots.add(c[2]); }
    if (slots.size !== 2) return '시리즈 ' + n + '개 돌려 넣음';
    if (n === 2) return '시리즈 2개 맞바꿈';
    // 두 칸에 있던 시리즈 수(옮기기 전 상태)와 옮긴 수가 같으면 두 날짜를 통째로 바꾼 것
    let inSlots = 0;
    for (const id of slots) { const k = model.slotIndex.get(id); if (k != null) for (let s = 0; s < prev.assign.length; s++) if (prev.assign[s] === k) inSlots++; }
    return inSlots === n ? '날짜 두 칸 통째로 맞바꿈 (시리즈 ' + n + '개)' : '두 날짜 사이에서 시리즈 ' + n + '개 바꿔 넣음';
  }

  /**
   * 트레이스 → 재생 모델.
   * states[i] = 이벤트 i개를 적용한 상태 { assign(Int32Array 시리즈→슬롯 인덱스, -1 미배정), row(슬롯 안 줄), soft(절댓값), hard(합), moves(누적 이동 수), changed(이번에 바뀐 시리즈 인덱스) }.
   * times[i] = 상태 i가 되는 재생 시각(ms). durationMs = 전체 재생 길이.
   */
  function build(trace) {
    const t = normalize(trace);
    const model = {
      seed: t.seed, teams: t.teams, slots: t.slots, series: t.series, events: t.events, n: t.events.length,
      slotIndex: new Map(t.slots.map((s, i) => [s.id, i])), seriesIndex: new Map(t.series.map((m, i) => [m.id, i])),
      perSlot: Math.max(1, Math.floor(t.teams.length / 2)), states: [], times: [], durationMs: 0, LEVELS, PALETTE
    };
    const assign = new Int32Array(t.series.length), row = new Int32Array(t.series.length);
    const occ = t.slots.map(() => new Set());
    t.series.forEach((m, i) => {
      const s = model.slotIndex.has(m.slot) ? model.slotIndex.get(m.slot) : -1;
      assign[i] = s;
      if (s >= 0) { const free = lowestFree(occ[s]); occ[s].add(free); row[i] = free; } else row[i] = -1;
    });
    const init = t.initialScore;
    model.states.push({ assign, row, soft: softAbs(init), hard: hardSum(init), moves: 0, changed: [], elapsedMs: 0 });
    for (let i = 0; i < t.events.length; i++) {
      const prev = model.states[i], ev = t.events[i];
      const next = apply(model, prev.assign, prev.row, ev.changes, +1);
      model.states.push({ assign: next.assign, row: next.row, soft: softAbs(ev.score), hard: hardSum(ev.score), moves: prev.moves + ev.changes.length, changed: next.moved, elapsedMs: ev.elapsedMs || 0 });
    }
    // 초기 점수가 없으면 첫 이벤트 점수를 시작 점수로 본다(곡선이 비지 않게)
    if (!model.states[0].soft.length && model.states.length > 1) { model.states[0].soft = model.states[1].soft.slice(); model.states[0].hard = model.states[1].hard; }
    const tl = timeline(t.events);
    model.times = tl.times; model.durationMs = tl.durationMs;
    model.captions = model.states.map((_, i) => caption(model, i));
    /** 재생 시각 ms → 적용된 이벤트 수(상태 인덱스) */
    model.indexAt = (ms) => { let i = 0; while (i + 1 < model.times.length && model.times[i + 1] <= ms) i++; return i; };
    /** 상태 i에서 변경 목록을 되돌려 상태 i-1의 배정을 얻는다(검증·되감기용) */
    model.rewind = (i) => (i <= 0 ? null : apply(model, model.states[i].assign, model.states[i].row, model.events[i - 1].changes, -1));
    model.teamColor = (teamIndex) => PALETTE[((teamIndex % PALETTE.length) + PALETTE.length) % PALETTE.length];
    model.slotCounts = (i) => { const c = new Int32Array(t.slots.length); for (const s of model.states[i].assign) if (s >= 0) c[s]++; return c; };
    return model;
  }

  KBO.ReplayModel = { build, normalize, apply, timeline, caption, moveWord, LEVELS, PALETTE, fmtInt };
});
