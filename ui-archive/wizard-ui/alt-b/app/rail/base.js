/*
 * alt-b 단계 레일 — 기반: 상태(Store), 파생 계산(채점·사전 점검·단계 상태), 기능 레지스트리, 라우터, 공통 헬퍼.
 * 화면 코드는 R.screens[이름] = { head, left, right } 형태로 등록한다.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const D = KBO.Dates, Sc = KBO.Score, CG = KBO.CalendarGen, RS = KBO.Reschedule;
  const R = (window.R = { screens: {}, act: {}, inputs: {}, KBO });
  R.NS = 'kbo-wizard-alt-b';

  // ───────── 안전한 localStorage (NFR-8) ─────────
  R.ls = {
    get(k) { try { return window.localStorage.getItem(R.NS + ':' + k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(R.NS + ':' + k, v); return true; } catch (e) { return false; } },
    del(k) { try { window.localStorage.removeItem(R.NS + ':' + k); } catch (e) { /* 무시 */ } }
  };

  // ───────── 포맷 ─────────
  const esc = (R.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  R.fmt = {
    date: (d) => D.fmtDate(d),
    short: (d) => D.fmtShort(d),
    km: (v) => (v == null || !Number.isFinite(Number(v)) ? '-' : Number(v).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
    int: (v) => (v == null || !Number.isFinite(Number(v)) ? '-' : Math.round(v).toLocaleString('ko-KR')),
    num1: (v) => (v == null || !Number.isFinite(v) ? '-' : (Math.round(v * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
    signed: (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + (f || R.fmt.int)(Math.abs(v)),
    range: (a, b) => D.fmtDate(a) + (b != null && b !== a ? '~' + D.fmtDate(b) : '')
  };

  // ───────── 아이콘 (색만으로 구분하지 않도록 모양을 다르게 그린다) ─────────
  const ICONS = {
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.4l7 12.6H1z" fill="currentColor"/><path d="M8 6v3.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11.9" r="1" fill="#fff"/></svg>',
    block: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><rect x="3.8" y="6.9" width="8.4" height="2.2" rx="0.6" fill="#fff"/></svg>',
    todo: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    bad: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>',
    run: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/><path d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    pin: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 1.8h5l-.9 4.3 2.4 2.5H4l2.4-2.5z" fill="currentColor"/><path d="M8 8.6v5.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    chevL: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevR: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevD: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    undo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4L2.5 7l3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 7h6.5a4 4 0 0 1 0 8H7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    redo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 4l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 7H6.5a4 4 0 0 0 0 8H9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.3 4.5V3h3.4v1.5M4.5 4.5l.7 9h5.6l.7-9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    upload: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.5M4.8 5.5L8 2.3l3.2 3.2M2.5 10v3.5h11V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.8 7.5L8 10.7l3.2-3.2M2.5 10v3.5h11V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    link: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.8 9.2l2.4-2.4M7.4 4.6l1.1-1.1a2.6 2.6 0 0 1 3.7 3.7l-1.1 1.1M8.6 11.4l-1.1 1.1a2.6 2.6 0 0 1-3.7-3.7l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    sheet: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 6.2h11M2.5 9.8h11M6.3 6.2v7.3" stroke="currentColor" stroke-width="1.3"/></svg>',
    gear: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    season: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5.5 1.8v2.6M10.5 1.8v2.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 9.5l1.6 1.6L10.8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    rail: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 2.5v11" stroke="currentColor" stroke-width="1.5"/></svg>',
    plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    swap: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h9.5M10 2.5L12.5 5 10 7.5M13 11H3.5M6 8.5L3.5 11 6 13.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    print: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V2.5h7V6M4.5 11.5h-2V6h11v5.5h-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><rect x="4.5" y="9.5" width="7" height="4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    diamond: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.2" y="4.2" width="11.6" height="11.6" rx="1.4" transform="rotate(45 10 10)" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.1" fill="currentColor"/></svg>'
  };
  R.icon = (name, cls) => '<span class="ic ' + (cls || '') + '">' + (ICONS[name] || '') + '</span>';
  const STATUS = {
    ok: { icon: 'ok', text: '완료', cls: 'st-ok' },
    warn: { icon: 'warn', text: '확인 필요', cls: 'st-warn' },
    block: { icon: 'block', text: '차단', cls: 'st-block' },
    todo: { icon: 'todo', text: '작성 중', cls: 'st-todo' },
    run: { icon: 'run', text: '실행 중', cls: 'st-run' }
  };
  R.STATUS = STATUS;
  /** 상태 칩: 아이콘 + 글자 */
  R.st = (kind, text, extra) => { const s = STATUS[kind] || STATUS.todo; return '<span class="stchip ' + s.cls + ' ' + (extra || '') + '">' + R.icon(s.icon) + '<span>' + esc(text == null ? s.text : text) + '</span></span>'; };
  R.stIcon = (kind) => { const s = STATUS[kind] || STATUS.todo; return '<span class="sticon ' + s.cls + '" title="' + s.text + '">' + R.icon(s.icon) + '<span class="sr">' + s.text + '</span></span>'; };
  R.mock = (label) => '<span class="mock" title="이 기능은 시안용 목업입니다">' + esc(label || '목업') + '</span>';
  R.virtual = () => '<span class="vtag" title="화면 확인용으로 일부러 넣은 가상 위반입니다">가상</span>';
  R.team = (name, opts) => {
    const t = R.state().teams.find((x) => x.name === name);
    return '<span class="tm' + (opts && opts.strong ? ' tm-strong' : '') + '"><i style="background:' + esc(t ? t.color : '#888') + '"></i>' + esc(name) + '</span>';
  };

  // ───────── 기능 레지스트리 (FR-F) ─────────
  R.FEATURES = [
    { id: 'T4', group: '① 데이터 준비', name: '지도 마커 끌어서 좌표 조정', desc: '구단과 거리 탭의 지도에서 마커를 끌어 위치를 고칩니다.', req: 'FR-T4', def: false },
    { id: 'T7', group: '① 데이터 준비', name: '거리 행렬 히트맵·대칭 편집', desc: '구단과 거리 탭 아래 접힌 히트맵. 한 칸을 고치면 반대 칸도 같이 바뀝니다.', req: 'FR-T7', def: true },
    { id: 'M2', group: '③ 결과·수정', name: '교환 전 Δ 미리보기', desc: '시리즈 상세에 교환 후보와 Hard·Soft 변화량을 보여 줍니다.', req: 'FR-M2', def: true },
    { id: 'M8', group: '③ 결과·수정', name: '미배정 풀', desc: '시리즈를 잠시 빼 두는 바구니. 캘린더 아래에 붙습니다.', req: 'FR-M8', def: true },
    { id: 'V6', group: '③ 결과·수정', name: '구단 × 슬롯 매트릭스', desc: '결과·수정 단계에 구단(행) × 슬롯(열) 격자 탭을 더합니다.', req: 'FR-V6', def: false },
    { id: 'A4', group: '④ 품질·배포', name: '누적 이동거리 선 차트', desc: '시즌 진행에 따른 구단별 누적 이동거리.', req: 'FR-A4', def: true },
    { id: 'A5', group: '④ 품질·배포', name: '상대 매트릭스', desc: '구단쌍별 편성 경기 수와 홈·원정 분배(10×10).', req: 'FR-A5', def: true },
    { id: 'A8', group: '④ 품질·배포', name: '주중 이동 분석', desc: '주중 → 주말 슬롯 이동 횟수·거리(참고 지표).', req: 'FR-A8', def: true },
    { id: 'A9', group: '④ 품질·배포', name: '혹서기 부담 분석', desc: '7~8월 원정 경기 수와 이동거리, 돔구장 표기.', req: 'FR-A9', def: false },
    { id: 'A10', group: '④ 품질·배포', name: '장거리 연속 원정 경고', desc: '연속 원정 2시리즈 이상이면서 600km를 넘는 구간.', req: 'FR-A10', def: false },
    { id: 'A11', group: '④ 품질·배포', name: '구단별 일정표·인쇄', desc: '구단 운영팀 배포용 일정표와 인쇄 미리보기.', req: 'FR-A11', def: true },
    { id: 'A12', group: '④ 품질·배포', name: '월별 홈경기 히트맵', desc: '구단 × 월 홈경기 수.', req: 'FR-A12', def: false },
    { id: 'D4', group: '④ 품질·배포', name: '일정표 CSV 내보내기', desc: '날짜·원정·홈·구장·상태 CSV.', req: 'FR-D4', def: true },
    { id: 'P2', group: '시즌 운영', name: '결과 미입력 강조', desc: '기준일 이전에 결과가 없는 경기를 강조합니다.', req: 'FR-P2', def: true },
    { id: 'P7', group: '시즌 운영', name: '시즌 진행 현황', desc: '구단별 소화·취소·잔여 경기와 재편성 수용 게이지.', req: 'FR-P7', def: true }
  ];
  R.MUST = [
    { id: 'X1', name: '.xlsx 업로드·미리보기', req: 'FR-X1·X3' }, { id: 'X2', name: '구글 시트 공유 링크 읽기', req: 'FR-X2' },
    { id: 'X8', name: '표 한 건 편집(수정·삽입·삭제)', req: 'FR-X8' }, { id: 'R2', name: '사전 점검', req: 'FR-R2' },
    { id: 'V5', name: '위반 목록·위치 이동', req: 'FR-V4·V5' }, { id: 'M7', name: '스냅샷 저장·복원', req: 'FR-M7' },
    { id: 'A1', name: '필수 차트 3종', req: 'FR-A1~A3' }, { id: 'Q1', name: '구단 지표 비교표·Soft 분해', req: 'FR-Q1~Q3' }
  ];
  const FKEY = 'features:v1';
  function loadFeatures() {
    const out = {};
    for (const f of R.FEATURES) out[f.id] = f.def;
    try { const saved = JSON.parse(R.ls.get(FKEY) || 'null'); if (saved && typeof saved === 'object') for (const k of Object.keys(saved)) if (k in out) out[k] = !!saved[k]; } catch (e) { /* 기본값 */ }
    return out;
  }
  R.features = loadFeatures();
  R.feature = (id) => !!R.features[id];
  R.setFeature = (id, on) => { R.features[id] = !!on; R.ls.set(FKEY, JSON.stringify(R.features)); };
  R.resetFeatures = () => { R.ls.del(FKEY); R.features = loadFeatures(); };

  // ───────── 가상 위반 3건 (plan만 바꾼다) ─────────
  // 37↔87: KT·한화 역방향 맞대결 교환 → KT 원정 4연속(H0-f)
  // 35↔74: 두산·LG 역방향 맞대결 교환 → 5/9 잠실 두 경기(H0-b)
  // 슬롯 16↔18 통째 교환 → 5/27 삼성·롯데 인접 동일 대진(H1)
  R.SEED = { swaps: [[37, 87], [35, 74]], slotSwap: [16, 18] };
  function seedPlan(planList) {
    const pl = planList.map((e) => ({ match: e.match, calendar: e.calendar }));
    for (const [a, b] of R.SEED.swaps) { const t = pl[a].calendar; pl[a].calendar = pl[b].calendar; pl[b].calendar = t; }
    const [x, y] = R.SEED.slotSwap;
    pl.forEach((e) => { if (e.calendar === x) e.calendar = y; else if (e.calendar === y) e.calendar = x; });
    return pl;
  }

  function buildProject() {
    const p = KBO.Preset.buildProject();
    const original = p.plan.map((e) => ({ match: e.match, calendar: e.calendar }));
    p.plan = seedPlan(original);
    p.meta.name = '2025 정규시즌 1차안';
    p.settings.referenceDate = '2025-07-20';
    // 시즌 운영 예시: 7/17까지 완료, 7/18~ 결과 미입력, 취소 3경기
    const games = RS.computeGames(p);
    for (const g of games) if (g.date < '2025-07-18') RS.setGameStatus(p, g, 'PLAYED');
    const cancels = [['2025-04-12', 'RAIN'], ['2025-05-24', 'RAIN'], ['2025-06-21', 'HEAT']];
    for (const [date, reason] of cancels) { const g = games.find((x) => x.date === date); if (g) RS.setGameStatus(p, g, 'CANCELLED', reason); }
    const t0 = '2025-10-18T05:10:00.000Z';
    p.snapshots = [
      { id: 'snap-kbo', name: 'KBO 발표안 (input_2025)', createdAt: '2025-10-18T04:40:00.000Z', plan: original, pins: p.matches.map((m) => !!m.pinned), reschedulePlan: [], matchCount: p.matches.length, slotCount: p.calendar.length },
      { id: 'snap-engine', name: '엔진 1차 결과', createdAt: t0, plan: p.plan.map((e) => ({ match: e.match, calendar: e.calendar })), pins: p.matches.map((m) => !!m.pinned), reschedulePlan: [], matchCount: p.matches.length, slotCount: p.calendar.length }
    ];
    return p;
  }
  R.buildProject = buildProject;
  R.store = new KBO.Store.Store({ storageKey: R.NS + ':project', storage: null, autosaveMs: -1, initial: buildProject });
  R.state = () => R.store.state;

  // ───────── 파생 상태 ─────────
  const cache = { v: -1 };
  R.derived = function () {
    const st = R.state();
    const key = R.store.version + '|' + st.settings.h0eMode;
    if (cache.key === key) return cache;
    cache.key = key;
    cache.slots = st.calendar.map((s, i) => {
      const day = D.dayNum(s.datetime);
      const days = [];
      for (let k = 0; k < s.consecutive; k++) days.push(day + k);
      return { index: i, day, days, date: D.isoDate(day), consecutive: s.consecutive, weekend: s.weekend, holiday: s.holiday, label: D.fmtDate(day) + ' ' + s.consecutive + '연전', month: D.month(day) };
    });
    cache.dayToSlot = new Map();
    cache.slots.forEach((s) => s.days.forEach((d) => cache.dayToSlot.set(d, s.index)));
    cache.input = Sc.buildInput(st);
    cache.ctx = Sc.createContext(cache.input);
    cache.plan = Sc.planArrayFrom(st);
    cache.ex = Sc.explain(cache.ctx, cache.plan, st);
    for (const v of cache.ex.violations) v.virtual = R.virtualKeys ? R.virtualKeys.has(vkey(v)) : false;
    cache.bySlot = cache.slots.map(() => []);
    cache.pool = [];
    for (let m = 0; m < st.matches.length; m++) { const s = cache.plan[m]; if (s >= 0 && s < cache.slots.length) cache.bySlot[s].push(m); else cache.pool.push(m); }
    cache.preflight = preflight(st, cache);
    cache.validation = validateSheets(st);
    cache.steps = stepStatus(st, cache);
    cache._games = null; cache._targets = null;
    return cache;
  };
  function vkey(v) { return v.code + '|' + v.slot + '|' + (v.matches || []).slice().sort((a, b) => a - b).join(','); }
  R.games = () => { const c = R.derived(); if (!c._games) c._games = RS.computeGames(R.state()); return c._games; };
  R.targets = () => { const c = R.derived(); if (!c._targets) c._targets = RS.computeTargets(R.state(), R.games()); return c._targets; };
  R.matchLabel = (m) => { const x = R.state().matches[m]; return x ? x.away + ' @ ' + x.home : '?'; };
  R.stadiumOf = (team) => { const t = R.state().teams.find((x) => x.name === team); return t ? t.stadium : ''; };
  R.shortStadium = (s) => String(s || '').replace('종합운동장', '').replace('경기장', '').replace('야구장', '').replace('챔피언스필드', ' 챔피언스필드').replace('이글스파크', ' 이글스파크').replace('대구삼성라이언즈파크', '대구 라이온즈파크').trim();

  // ───────── 사전 점검 (FR-R2) ─────────
  function lengthHist(items) { const h = { 2: 0, 3: 0, 4: 0 }; for (const it of items) { const k = it.consecutive | 0; h[k] = (h[k] || 0) + 1; } return h; }
  R.lengthHist = lengthHist;
  function preflight(st, c) {
    const N = st.teams.length;
    const half = Math.floor(N / 2);
    const sh = lengthHist(st.calendar), mh = lengthHist(st.matches);
    const items = [];
    const lens = Array.from(new Set(Object.keys(sh).concat(Object.keys(mh)).map(Number))).filter((k) => sh[k] || mh[k]).sort();
    for (const k of lens) {
      const cap = (sh[k] || 0) * half, need = mh[k] || 0;
      const status = need > cap ? 'block' : need < cap ? 'warn' : 'ok';
      let link = { step: 1, tab: need > cap ? 'series' : 'slots' };
      if (status === 'block') {
        const slotRow = st.calendar.findIndex((c2, i) => st.plan.some((p) => p.calendar === i && st.matches[p.match] && st.matches[p.match].consecutive !== c2.consecutive));
        if (slotRow >= 0) link = { step: 1, tab: 'slots', row: slotRow };
        else { const r = st.matches.findIndex((m) => m.consecutive === k); if (r >= 0) link = { step: 1, tab: 'series', row: r }; }
      }
      items.push({ id: 'len' + k, status, title: k + '연전 수급', detail: '시리즈 ' + need + ' / 슬롯 ' + (sh[k] || 0) + ' × ' + half + ' = ' + cap + (status === 'block' ? ' — 시리즈가 ' + (need - cap) + '개 많아 배정 불가' : status === 'warn' ? ' — 빈 자리 ' + (cap - need) + '개(추가 휴식, 감점 없음)' : ' — 정확히 일치'), link });
    }
    items.push({ id: 'teams', status: N % 2 === 0 ? 'ok' : 'block', title: '구단 수', detail: N + '개 구단' + (N % 2 ? ' — 홀수면 매 슬롯 한 구단이 쉬어야 합니다' : ' · 슬롯마다 ' + half + '경기'), link: { step: 1, tab: 'teams' } });
    const dm = new Set(st.distanceMatrix.map((d) => d.from + '|' + d.to));
    let missing = 0;
    for (const a of st.teams) for (const b of st.teams) if (a.name !== b.name && !dm.has(a.name + '|' + b.name)) missing++;
    items.push({ id: 'dist', status: missing ? 'block' : 'ok', title: '거리 행렬', detail: missing ? '누락 ' + missing + '칸' : st.teams.length * (st.teams.length - 1) + '칸 모두 입력 · 추정값 0', link: { step: 1, tab: 'teams' } });
    const evc = eventCheck(st);
    items.push({ id: 'events', status: evc.problems.length ? 'block' : 'ok', title: '이벤트 모순', detail: evc.problems.length ? evc.problems[0] : '개막전 대진 5 · 어린이날 구장 5 — 충돌 없음', link: { step: 1, tab: 'events' } });
    const children = st.events.find((e) => e.type === 'CHILDREN');
    if (children) items.push({ id: 'h0e', status: 'warn', title: 'H0-e 기준 차이', detail: '어린이날 구장 기준(잠실은 두산·LG 중 하나)과 엔진 호환 기준(LG 제외 5구단)이 다릅니다. 현재: ' + (st.settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준'), link: { view: 'settings' } });
    const unknown = st.matches.filter((m) => !st.teams.some((t) => t.name === m.home) || !st.teams.some((t) => t.name === m.away)).length;
    if (unknown) items.push({ id: 'unknown', status: 'block', title: '알 수 없는 구단', detail: '시리즈 ' + unknown + '행의 구단명이 구단 표와 다릅니다', link: { step: 1, tab: 'series', row: st.matches.findIndex((m) => !st.teams.some((t) => t.name === m.home) || !st.teams.some((t) => t.name === m.away)) } });
    const counts = { ok: 0, warn: 0, block: 0 };
    for (const it of items) counts[it.status]++;
    return { items, counts, sh, mh };
  }
  function eventCheck(st) {
    const problems = [];
    const bySlot = new Map();
    for (const ev of st.events) {
      const slot = Sc.resolveEventSlot(ev, st.calendar);
      if (slot < 0) { problems.push(ev.name + ' 날짜가 슬롯 안에 없습니다'); continue; }
      if (!bySlot.has(slot)) bySlot.set(slot, []);
      bySlot.get(slot).push(ev);
    }
    for (const [, evs] of bySlot) {
      const seen = new Map();
      for (const ev of evs) {
        if (ev.mode !== 'MATCH') continue;
        for (const t of [ev.home, ev.away]) { if (seen.has(t)) problems.push(t + ' 구단이 같은 슬롯의 두 대진에 들어 있습니다'); seen.set(t, ev); }
      }
    }
    return { problems, bySlot };
  }
  R.eventCheck = eventCheck;

  // ───────── 시트 검증 (FR-X8 셀 검증과 같은 규칙) ─────────
  function validateSheets(st) {
    const names = new Set(st.teams.map((t) => t.name));
    const errors = [];
    st.calendar.forEach((c, i) => {
      if (!(c.consecutive >= 2 && c.consecutive <= 4)) errors.push({ sheet: 'slots', row: i, col: 'consecutive', msg: '연전은 2~4입니다' });
      if (i > 0) { const prev = st.calendar[i - 1]; if (D.dayNum(prev.datetime) + prev.consecutive > D.dayNum(c.datetime)) errors.push({ sheet: 'slots', row: i, col: 'start', msg: '앞 슬롯과 날짜가 겹칩니다' }); }
    });
    st.matches.forEach((m, i) => {
      if (!names.has(m.home)) errors.push({ sheet: 'series', row: i, col: 'home', msg: "알 수 없는 구단 '" + m.home + "'" });
      if (!names.has(m.away)) errors.push({ sheet: 'series', row: i, col: 'away', msg: "알 수 없는 구단 '" + m.away + "'" });
      if (m.home === m.away) errors.push({ sheet: 'series', row: i, col: 'away', msg: '홈과 원정이 같습니다' });
    });
    return errors;
  }

  // ───────── 단계 상태 (§3.3) ─────────
  function stepStatus(st, c) {
    const ex = c.ex;
    const hard = ex.violations.length;
    const pf = c.preflight;
    const evCount = st.events.length;
    const valErr = c.validation.length;
    const s1 = { status: valErr ? 'block' : 'ok', text: valErr ? '오류 ' + valErr : '완료', summary: st.calendar.length + ' 슬롯 · ' + st.matches.length + ' 시리즈 · 이벤트 ' + evCount };
    let s2;
    if (R.run && R.run.status !== 'DONE') s2 = { status: 'run', text: '실행 중', summary: '엔진 ' + Math.round(R.run.progress * 100) + '% · 입력 잠금' };
    else if (pf.counts.block) s2 = { status: 'block', text: '차단 ' + pf.counts.block, summary: '사전 점검 차단 ' + pf.counts.block + ' · 실행 잠김' };
    else if (pf.counts.warn) s2 = { status: 'warn', text: '경고 ' + pf.counts.warn, summary: '점검 통과 ' + pf.counts.ok + ' · 경고 ' + pf.counts.warn };
    else s2 = { status: 'ok', text: '완료', summary: '점검 통과 ' + pf.counts.ok };
    const assigned = st.matches.length - c.pool.length;
    let s3;
    if (assigned === 0) s3 = { status: 'todo', text: '작성 중', summary: '엔진 실행 전 · 배정 없음' };
    else if (hard) s3 = { status: 'block', text: '위반 ' + hard, summary: 'Hard 위반 ' + hard + '건' + (ex.violations.some((v) => v.virtual) ? ' (가상 포함)' : '') + (c.pool.length ? ' · 미배정 ' + c.pool.length : '') };
    else if (c.pool.length) s3 = { status: 'warn', text: '미배정 ' + c.pool.length, summary: '편성 가능 · 미배정 ' + c.pool.length };
    else s3 = { status: 'ok', text: '완료', summary: '편성 가능 · 미배정 0' };
    const s4 = R.published ? { status: 'ok', text: '완료', summary: '배포본 ' + R.published } : (hard ? { status: 'todo', text: '작성 중', summary: '배포 전 Hard 0 필요' } : { status: 'todo', text: '작성 중', summary: '허용오차 초과 ' + ex.teamMetrics.filter((t) => t.overDistance || t.overMoves || t.overHoliday).length + '구단 · 배포 전' });
    return [s1, s2, s3, s4];
  }

  // ───────── 상태 변경 ─────────
  R.locked = () => !!(R.run && (R.run.status === 'RUNNING' || R.run.status === 'PAUSED'));
  R.commit = function (label, fn, opts) {
    if (R.locked() && !(opts && opts.force)) { R.toast('엔진 실행 중에는 입력과 배정을 바꿀 수 없습니다. 먼저 중지하세요.', 'warn'); return false; }
    const ok = R.store.commit(label, fn, Object.assign({ tags: ['all'] }, opts || {}));
    return ok;
  };
  R.undo = () => { if (R.locked()) return R.toast('엔진 실행 중에는 되돌릴 수 없습니다.', 'warn'); if (!R.store.undo()) R.toast('되돌릴 작업이 없습니다.', 'info'); };
  R.redo = () => { if (R.locked()) return; if (!R.store.redo()) R.toast('다시 실행할 작업이 없습니다.', 'info'); };

  // ───────── 라우터 ─────────
  R.ui = { view: 'wizard', step: 1, tab: { 1: 'season', 2: 'review', 3: 'calendar', 4: 'metrics' }, opsTab: 'games', modal: null, collapsed: R.ls.get('rail') === '1', params: {} };
  R.parseHash = function () {
    const out = {};
    const h = (location.hash || '').replace(/^#/, '');
    for (const part of h.split('&')) { if (!part) continue; const [k, v] = part.split('='); out[decodeURIComponent(k)] = v == null ? '1' : decodeURIComponent(v); }
    const q = (location.search || '').replace(/^\?/, '');
    for (const part of q.split('&')) { if (!part) continue; const [k, v] = part.split('='); if (!(k in out)) out[decodeURIComponent(k)] = v == null ? '1' : decodeURIComponent(v); }
    return out;
  };
  R.hashFor = function (o) {
    const p = [];
    if (o.view === 'ops') { p.push('view=ops'); if (o.opsTab) p.push('tab=' + o.opsTab); }
    else if (o.view === 'settings') p.push('view=settings');
    else { p.push('step=' + o.step); if (o.tab) p.push('tab=' + o.tab); }
    return '#' + p.join('&');
  };
  /** 화면 이동: { view, step, tab } */
  R.go = function (o) {
    const u = R.ui;
    if (o.view) u.view = o.view; else if (o.step) u.view = 'wizard';
    if (o.step) u.step = o.step;
    if (o.tab && u.view === 'wizard') u.tab[u.step] = o.tab;
    if (o.tab && u.view === 'ops') u.opsTab = o.tab;
    const h = R.hashFor({ view: u.view, step: u.step, tab: u.view === 'ops' ? u.opsTab : u.tab[u.step], opsTab: u.opsTab });
    R._silentHash = h;
    if (location.hash !== h) { try { history.replaceState(null, '', h + ''); } catch (e) { location.hash = h; } }
    R.render();
  };

  // ───────── 렌더 스케줄 ─────────
  let pending = false;
  R.render = function () { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; R.renderNow(); }); };
  R.toast = function (msg, kind, ms) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    const ic = { ok: 'ok', bad: 'bad', warn: 'warn', info: 'todo' }[kind || 'info'];
    el.innerHTML = R.icon(ic) + '<span>' + esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms || 3000);
  };
  R.vkey = vkey;
  (function () {
    const st = R.state();
    const ex = Sc.explain(Sc.createContext(Sc.buildInput(st)), Sc.planArrayFrom(st), st);
    R.virtualKeys = new Set(ex.violations.map(vkey));
  })();
  R.store.subscribe(() => R.render());
})();
