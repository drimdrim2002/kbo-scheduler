/*
 * alt-c 편성 워크북 — 공통 컨트롤러.
 * 유틸, 아이콘, 저장소, 기능 켜기·끄기, 가상 위반 시드, 실행 취소 기록, 계층 UI(토스트·모달·팝업·메뉴·툴팁),
 * 상단 띠·단계 표시·상태 표시줄, 해시 라우터.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const D = KBO.Dates;
  const WB = window.WB = { steps: {}, ui: {}, actions: {} };

  // ───────────── 유틸 ─────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const fmt = {
    int: (v) => (v == null || !Number.isFinite(+v) ? '' : Math.round(v).toLocaleString('ko-KR')),
    km: (v) => (v == null || !Number.isFinite(+v) ? '' : (Math.round(v * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
    n1: (v) => (v == null || !Number.isFinite(+v) ? '' : (Math.round(v * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
    signed: (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + (f || fmt.n1)(Math.abs(v)),
    date: (iso) => (iso ? D.fmtDate(iso) : ''),
    short: (iso) => (iso ? D.fmtShort(iso) : ''),
    score: (s) => KBO.Score.scoreString(s)
  };
  const colName = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const colIndex = (name) => { let n = 0; for (const ch of String(name).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  WB.esc = esc; WB.$ = $; WB.$$ = $$; WB.fmt = fmt; WB.colName = colName; WB.colIndex = colIndex;

  // ───────────── 아이콘 (단색 SVG, 이모지 대신) ─────────────
  const P = {
    ok: '<path d="M2.5 6.5l2.4 2.4L9.8 3.6"/>',
    warn: '<path d="M6 1.6L11 10.4H1z"/><path d="M6 5v2.4M6 8.9v.1"/>',
    block: '<circle cx="6" cy="6" r="4.6"/><path d="M2.8 9.2l6.4-6.4"/>',
    bad: '<path d="M3 3l6 6M9 3L3 9"/>',
    todo: '<circle cx="6" cy="6" r="4.2"/>',
    info: '<circle cx="6" cy="6" r="4.6"/><path d="M6 5.4v3M6 3.6v.1"/>',
    lock: '<rect x="2.4" y="5.4" width="7.2" height="5" rx=".8"/><path d="M4 5.4V4a2 2 0 014 0v1.4"/>',
    pin: '<path d="M4.2 1.8h3.6M5 1.8l-.4 3.4-1.6 1.6h6l-1.6-1.6L7 1.8M6 6.8v3.6"/>',
    up: '<path d="M6 9V2.5M3.4 5L6 2.4 8.6 5M2 10.5h8"/>',
    down: '<path d="M6 2v6.5M3.4 6L6 8.6 8.6 6M2 10.5h8"/>',
    link: '<path d="M5 7l2-2M4.4 8.6l-.8.8a1.7 1.7 0 01-2.4-2.4l1.6-1.6a1.7 1.7 0 012.4 0M7.6 3.4l.8-.8a1.7 1.7 0 012.4 2.4L9.2 6.6a1.7 1.7 0 01-2.4 0"/>',
    undo: '<path d="M3.5 4.5h4a2.5 2.5 0 010 5H5"/><path d="M5.5 2.5l-2 2 2 2"/>',
    redo: '<path d="M8.5 4.5h-4a2.5 2.5 0 000 5H7"/><path d="M6.5 2.5l2 2-2 2"/>',
    play: '<path class="f" d="M3.5 2.2l6 3.8-6 3.8z" fill="currentColor"/>',
    pause: '<path d="M4 2.5v7M8 2.5v7"/>',
    stop: '<rect x="3" y="3" width="6" height="6" fill="currentColor"/>',
    rowins: '<rect x="1.5" y="2" width="9" height="3" /><path d="M1.5 8.5h9M6 6.8v3.4M4.3 8.5h3.4"/>',
    rowdel: '<rect x="1.5" y="2" width="9" height="3"/><path d="M4 7.5l4 3M8 7.5l-4 3"/>',
    wand: '<path d="M2 10L8 4M7 2.2v1.4M9.8 4.4H8.4M9.4 2.6l-1 1M3.6 2.4l.5.9M2.2 4.2l.9.4"/>',
    sheet: '<rect x="1.8" y="1.8" width="8.4" height="8.4"/><path d="M1.8 4.6h8.4M1.8 7.4h8.4M4.6 1.8v8.4"/>',
    chart: '<path d="M2 10.2h8.4M3.4 8.6V6M6 8.6V3M8.6 8.6V5"/>',
    cal: '<rect x="1.8" y="2.6" width="8.4" height="7.6"/><path d="M1.8 5h8.4M4 1.6v2M8 1.6v2"/>',
    grid: '<rect x="1.8" y="1.8" width="8.4" height="8.4"/><path d="M1.8 6h8.4M6 1.8v8.4"/>',
    camera: '<rect x="1.6" y="3.4" width="8.8" height="6.2" rx=".8"/><circle cx="6" cy="6.5" r="1.7"/><path d="M4.2 3.4l.7-1.2h2.2l.7 1.2"/>',
    gear: '<circle cx="6" cy="6" r="1.7"/><path d="M6 1.4v1.4M6 9.2v1.4M1.4 6h1.4M9.2 6h1.4M2.7 2.7l1 1M8.3 8.3l1 1M2.7 9.3l1-1M8.3 3.7l1-1"/>',
    filter: '<path d="M1.8 2.4h8.4L7 6.2v3.6L5 8.8V6.2z"/>',
    caret: '<path d="M3.4 4.8L6 7.4l2.6-2.6"/>',
    left: '<path d="M7.4 2.8L4.2 6l3.2 3.2"/>',
    right: '<path d="M4.6 2.8L7.8 6 4.6 9.2"/>',
    close: '<path d="M3 3l6 6M9 3L3 9"/>',
    search: '<circle cx="5.2" cy="5.2" r="3.2"/><path d="M7.6 7.6l2.6 2.6"/>',
    print: '<path d="M3.4 4.6V1.8h5.2v2.8M3.4 8.4H2V4.6h8v3.8H8.6"/><rect x="3.4" y="7" width="5.2" height="3.2"/>',
    file: '<path d="M3 1.6h4l2 2v6.8H3z"/><path d="M7 1.6v2h2"/>',
    swap: '<path d="M2.4 4h7l-2-2M9.6 8h-7l2 2"/>',
    pool: '<path d="M2 3.4h8M2.6 3.4l.6 6.6h5.6l.6-6.6M4.6 5.4v2.8M7.4 5.4v2.8"/>',
    ops: '<circle cx="6" cy="6" r="4.4"/><path d="M6 3.4V6l1.8 1.2"/>',
    map: '<path d="M1.6 3l2.9-1.2 3 1.2 2.9-1.2v7.4L7.5 10.4l-3-1.2-2.9 1.2z"/><path d="M4.5 1.8v7.4M7.5 3v7.4"/>',
    dot: '<circle cx="6" cy="6" r="2.4" fill="currentColor"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 12 12" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  WB.icon = icon;
  /** 상태 표시: 아이콘 + 글자 (색만으로 구분하지 않는다) */
  const ST_ICON = { ok: 'ok', warn: 'warn', block: 'block', bad: 'bad', todo: 'todo', info: 'info', lock: 'lock', error: 'block', pass: 'ok' };
  WB.st = (kind, text) => '<span class="st ' + (kind === 'error' ? 'bad' : kind === 'pass' ? 'ok' : kind) + '">' + icon(ST_ICON[kind] || 'todo') + esc(text) + '</span>';
  WB.mock = (t) => '<span class="mock" title="이 기능은 시안 단계의 목업입니다">' + esc(t || '목업') + '</span>';
  WB.virt = () => '<span class="virt" title="위반 화면을 보여 주려고 얹은 가상 위반">가상</span>';

  // ───────────── 저장소 (localStorage, 접두어 고정, try/catch) ─────────────
  const PREFIX = 'kbo-wizard-alt-c:';
  const LS = {
    get(k) { try { return window.localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(PREFIX + k, v); return true; } catch (e) { return false; } },
    del(k) { try { window.localStorage.removeItem(PREFIX + k); } catch (e) { /* 무시 */ } },
    clearAll() { try { const ks = []; for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); if (k && k.indexOf(PREFIX) === 0) ks.push(k); } ks.forEach((k) => window.localStorage.removeItem(k)); } catch (e) { /* 무시 */ } }
  };
  WB.LS = LS;

  // ───────────── 기능 켜기·끄기 (FR-F) ─────────────
  const FEATURES = [
    { id: 'FR-X1', name: '.xlsx 업로드', desc: '파일을 올려 시트별 미리보기 후 적용', must: true, where: '① 데이터 준비' },
    { id: 'FR-X2', name: '구글 시트 링크 읽기', desc: '공유 링크(읽기 전용)로 시트 탭을 읽음', must: true, where: '① 데이터 준비' },
    { id: 'FR-X8', name: '한 건 편집', desc: '셀 수정, 행 삽입·삭제, 즉시 검증', must: true, where: '① 데이터 준비' },
    { id: 'FR-R2', name: '사전 점검', desc: '실행 전 차단·경고 항목 점검', must: true, where: '② 검토·실행' },
    { id: 'FR-V4', name: 'Hard 위반 표시', desc: '상단 배지, 셀 테두리·코드', must: true, where: '상단 띠, ③' },
    { id: 'FR-V5', name: '위반 목록', desc: '규칙별 목록, 클릭하면 셀로 이동', must: true, where: '③ 작업 창' },
    { id: 'FR-M6', name: '실행 취소·다시 실행', desc: '편집·이동·가져오기를 되돌림', must: true, where: '명령 띠' },
    { id: 'FR-M7', name: '스냅샷 저장·복원', desc: '이름을 붙여 저장하고 복원', must: true, where: '③ 명령 띠' },
    { id: 'FR-A1', name: '총 이동거리 차트', desc: '평균선과 ±300km 허용 밴드', must: true, where: '④ 지표 시트' },
    { id: 'FR-A2', name: '이동·휴일·주말 비교 차트', desc: '평균과 허용오차 표시', must: true, where: '④ 지표 시트' },
    { id: 'FR-A3', name: '홈/원정 흐름 스트립', desc: '구단 × 슬롯, 3연속 초과 강조', must: true, where: '④ 흐름 시트' },
    { id: 'FR-T4', key: 'T4', name: '지도 마커 드래그', desc: '구장 좌표를 지도에서 끌어 조정', def: false, where: '① 구단과 거리' },
    { id: 'FR-T7', key: 'T7', name: '거리 행렬 히트맵·대칭 편집', desc: '구단과 거리 시트의 접힌 행렬', def: true, where: '① 구단과 거리' },
    { id: 'FR-V6', key: 'V6', name: '구단 × 슬롯 매트릭스', desc: '결과를 구단 행 × 슬롯 열로 보는 시트', def: false, where: '③ 시트 탭' },
    { id: 'FR-M2', key: 'M2', name: '이동 전 Δ 미리보기', desc: '이동 후보마다 Hard/Soft 변화량', def: true, where: '③ 셀 상세' },
    { id: 'FR-M8', key: 'M8', name: '미배정 풀', desc: '시리즈를 풀로 빼고 다시 넣기', def: true, where: '③ 시트 탭' },
    { id: 'FR-P2', key: 'P2', name: '결과 미입력 강조', desc: '기준일 이전 예정 경기를 강조', def: true, where: '시즌 운영' },
    { id: 'FR-P7', key: 'P7', name: '시즌 진행 현황', desc: '구단별 소화·취소·잔여, 수용 게이지', def: true, where: '시즌 운영 작업 창' },
    { id: 'FR-A4', key: 'A4', name: '누적 이동거리 선 차트', desc: '시즌 진행에 따른 구단별 누적', def: true, where: '④ 차트 시트' },
    { id: 'FR-A5', key: 'A5', name: '상대 매트릭스', desc: '구단쌍 경기 수와 홈/원정 분배', def: true, where: '④ 시트 탭' },
    { id: 'FR-A8', key: 'A8', name: '주중 이동 분석', desc: '주중 → 주말 이동 (참고)', def: true, where: '④ 시트 탭' },
    { id: 'FR-A9', key: 'A9', name: '혹서기 부담 분석', desc: '7~8월 원정 경기·이동, 돔 표기', def: false, where: '④ 시트 탭' },
    { id: 'FR-A10', key: 'A10', name: '장거리 연속 원정 경고', desc: '연속 원정 합계 600km 초과 구간', def: false, where: '④ 시트 탭' },
    { id: 'FR-A11', key: 'A11', name: '구단별 일정표·인쇄', desc: '구단 운영팀 배포용 인쇄 미리보기', def: true, where: '④ 시트 탭' },
    { id: 'FR-A12', key: 'A12', name: '월별 홈경기 히트맵', desc: '구단 × 월 홈경기 수', def: false, where: '④ 시트 탭' },
    { id: 'FR-D4', key: 'D4', name: '일정표 CSV 내보내기', desc: '날짜·원정·홈·구장·상태', def: true, where: '④ 명령 띠' }
  ];
  WB.FEATURES = FEATURES;
  let featState = {};
  function loadFeatures() {
    featState = {};
    const raw = LS.get('features');
    if (raw) { try { featState = JSON.parse(raw) || {}; } catch (e) { featState = {}; } }
  }
  WB.loadFeatures = loadFeatures;
  WB.feature = (key) => {
    const f = FEATURES.find((x) => x.key === key || x.id === key);
    if (!f) return true;
    if (f.must) return true;
    return Object.prototype.hasOwnProperty.call(featState, f.key) ? !!featState[f.key] : !!f.def;
  };
  WB.setFeature = (key, on) => {
    const f = FEATURES.find((x) => x.key === key);
    if (!f || f.must) return;
    featState[key] = !!on;
    LS.set('features', JSON.stringify(featState));
  };
  WB.resetFeatures = () => { featState = {}; LS.del('features'); };

  // ───────────── 앱 생성 + 가상 위반 시드 ─────────────
  /** 가상 위반 3건: 매치 60·74 홈/원정 뒤집기(H0-f, H0-b 잠실 중복), 슬롯 15↔19 교환(H1) */
  const SEEDS = [
    { kind: 'flip', match: 60, expect: 'H0-f', note: '홈/원정 뒤집기' },
    { kind: 'flip', match: 74, expect: 'H0-b', note: 'LG 홈으로 뒤집어 잠실 중복' },
    { kind: 'swap', slots: [15, 19], expect: 'H1', note: '5/9 ↔ 5/23 슬롯 교환' }
  ];
  WB.SEEDS = SEEDS;
  const REF_DATE = '2025-08-20';
  function seedProject(p) {
    const clean = JSON.parse(JSON.stringify(p.plan));
    for (const s of SEEDS) {
      if (s.kind === 'flip') { const m = p.matches[s.match]; const t = m.home; m.home = m.away; m.away = t; }
      else for (const q of p.plan) { if (q.calendar === s.slots[0]) q.calendar = s.slots[1]; else if (q.calendar === s.slots[1]) q.calendar = s.slots[0]; }
    }
    p.meta.name = '2025 정규시즌 1차안';
    p.settings.referenceDate = REF_DATE;
    // 시즌 운영 시드: 기준일 3일 전까지 완료, 일부 취소
    const tmp = JSON.parse(JSON.stringify(p));
    const games = KBO.Reschedule.computeGames(tmp);
    const cancel = { '2025-04-12': 'RAIN', '2025-05-17': 'DUST', '2025-06-21': 'RAIN', '2025-07-06': 'RAIN', '2025-07-26': 'HEAT', '2025-08-09': 'GROUND' };
    const recs = [];
    let k = 0;
    for (const g of games) {
      if (g.date >= '2025-08-17') continue;
      if (cancel[g.date] && (k++ % 3 === 0)) recs.push({ match: g.match, date: g.date, status: 'CANCELLED', reason: cancel[g.date] });
      else recs.push({ match: g.match, date: g.date, status: 'PLAYED' });
    }
    p.games = recs;
    const now = Date.UTC(2026, 9, 18, 0, 12);
    p.snapshots = [
      { id: 's-engine', name: '엔진 1차 결과', createdAt: new Date(now).toISOString(), plan: clean, pins: p.matches.map((m) => !!m.pinned), reschedulePlan: [], matchCount: p.matches.length, slotCount: p.calendar.length, score: '[0/0]hard/[0/-400/-573307/-13/-72955]soft', feasible: true },
      { id: 's-import', name: '가져오기 전 — 10/17 18:40', createdAt: new Date(now - 15 * 3600e3).toISOString(), plan: clean, pins: p.matches.map((m) => !!m.pinned), reschedulePlan: [], matchCount: p.matches.length, slotCount: p.calendar.length, score: '[0/0]hard/[0/-400/-573307/-13/-72955]soft', feasible: true }
    ];
    return p;
  }

  WB.createApp = function () {
    const orig = KBO.Preset.buildProject;
    WB.cleanProject = orig;
    KBO.Preset.buildProject = function () { return seedProject(orig()); };
    // 저장소 복원·자동 저장을 끈다 (시안: 매번 같은 시작 상태)
    const app = new KBO.App({ appId: 'wizard-alt-c', appName: '편성 워크북' });
    app.store.storage = KBO.Store.safeStorage(null);
    app.store.undoStack.length = 0;
    app.store.redoStack.length = 0;
    if (app.store.restored) { app.store.state = KBO.Store.normalize(KBO.Preset.buildProject()); app.store.version++; }
    WB.app = app;
    // 가상 위반 표지: 시작 상태의 위반 (규칙+슬롯)
    const ex = app.derived().ex;
    WB.virtualKeys = new Set(ex.violations.map((v) => v.code + '|' + v.slot));
    return app;
  };
  WB.isVirtual = (v) => WB.virtualKeys && WB.virtualKeys.has(v.code + '|' + v.slot);

  // ───────────── 실행 취소 기록 (워크북 + 저장소 통합) ─────────────
  const H = WB.hist = { undo: [], redo: [] };
  WB.pushHist = (e) => { H.undo.push(e); if (H.undo.length > 100) H.undo.shift(); H.redo.length = 0; };
  /** 저장소 변경을 기록과 묶는다: fn이 store.commit을 일으켰으면 기록에 올린다 */
  WB.track = (label, fn) => {
    const st = WB.app.store;
    const n = st.undoStack.length;
    const r = fn();
    if (st.undoStack.length > n) WB.pushHist({ label, store: true });
    return r;
  };
  WB.undo = () => {
    if (WB.locked()) { WB.toast('엔진 실행 중에는 되돌릴 수 없습니다.', 'lock'); return; }
    const e = H.undo.pop();
    if (!e) { WB.toast('되돌릴 작업이 없습니다.'); return; }
    if (e.store) WB.app.store.undo(); else e.undo();
    H.redo.push(e);
    WB.toast('실행 취소: ' + e.label);
    WB.render();
  };
  WB.redo = () => {
    if (WB.locked()) return;
    const e = H.redo.pop();
    if (!e) { WB.toast('다시 실행할 작업이 없습니다.'); return; }
    if (e.store) WB.app.store.redo(); else e.redo();
    H.undo.push(e);
    WB.toast('다시 실행: ' + e.label);
    WB.render();
  };
  WB.undoLabel = () => (H.undo.length ? H.undo[H.undo.length - 1].label : '');

  // ───────────── 엔진(목업) 상태 ─────────────
  WB.run = { status: 'idle', progress: 0, elapsed: 0, limit: 60, impr: 0, trend: [], score: null, timer: null };
  WB.lastRun = { at: '10/18(토) 09:12', sec: 60, impr: 214, reason: '시간 제한' };
  WB.locked = () => WB.run.status === 'running' || WB.run.status === 'paused';

  // ───────────── 계층 UI ─────────────
  const layer = () => document.getElementById('layer');
  let toastHost = null;
  WB.toast = function (msg, kind, action) {
    if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'toasts'; toastHost.setAttribute('role', 'status'); toastHost.setAttribute('aria-live', 'polite'); document.body.appendChild(toastHost); }
    const el = document.createElement('div');
    el.className = 'toast';
    const ik = { ok: 'ok', bad: 'bad', warn: 'warn', lock: 'lock' }[kind] || 'info';
    el.innerHTML = icon(ik) + '<span>' + esc(msg) + '</span>' + (action ? '<button class="act">' + esc(action.label) + '</button>' : '');
    if (action) el.querySelector('.act').onclick = () => { action.fn(); el.remove(); };
    toastHost.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, action ? 6000 : 3000);
  };
  // 공통 컨트롤러가 쓰는 토스트를 워크북 토스트로 바꾼다
  KBO.UI.toast = (m, k) => WB.toast(m, k === 'info' ? '' : k);

  /** 모달: { id, title, width, height, body(html), foot(html), onMount(el), onClose } */
  WB.modal = function (o) {
    WB.closeModal(true);
    const v = document.createElement('div');
    v.className = 'veil';
    v.id = 'modal';
    v.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '" style="width:' + (o.width || 720) + 'px;' + (o.height ? 'height:' + o.height + 'px;' : '') + '">' +
      '<div class="mh"><h2>' + o.title + '</h2><span class="grow"></span>' + (o.head || '') + '<button class="x" data-close aria-label="닫기">' + icon('close') + '</button></div>' +
      '<div class="mb">' + (o.body || '') + '</div>' + (o.foot != null ? '<div class="mf">' + o.foot + '</div>' : '') + '</div>';
    layer().appendChild(v);
    WB.ui.modal = o.id || 'modal';
    WB._modalClose = o.onClose || null;
    v.addEventListener('mousedown', (e) => { if (e.target === v) WB.closeModal(); });
    v.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) WB.closeModal(); });
    if (o.onMount) o.onMount(v.querySelector('.modal'));
    const f = v.querySelector('[autofocus]') || v.querySelector('.modal button.pri') || v.querySelector('.x');
    if (f) setTimeout(() => f.focus(), 0);
    return v.querySelector('.modal');
  };
  WB.closeModal = function (silent) {
    const v = document.getElementById('modal');
    if (!v) return;
    v.remove();
    WB.ui.modal = null;
    const cb = WB._modalClose; WB._modalClose = null;
    if (cb && !silent) cb();
    if (!silent) WB.syncHash();
  };
  /** 팝오버: 앵커 아래에 붙인다 */
  WB.popover = function (anchor, html, opts) {
    WB.closePop();
    const el = document.createElement('div');
    el.className = 'pop';
    el.id = 'pop';
    if (opts && opts.width) el.style.width = opts.width + 'px';
    el.innerHTML = html;
    layer().appendChild(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = Math.min(r.left, window.innerWidth - w - 8), y = r.bottom + 4;
    if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 4);
    el.style.left = Math.max(8, x) + 'px'; el.style.top = y + 'px';
    setTimeout(() => document.addEventListener('mousedown', WB._popOutside, true), 0);
    if (opts && opts.onMount) opts.onMount(el);
    return el;
  };
  WB._popOutside = (e) => { const p = document.getElementById('pop'); if (p && !p.contains(e.target) && !e.target.closest('[data-pop-anchor]')) WB.closePop(); };
  WB.closePop = () => { const p = document.getElementById('pop'); if (p) p.remove(); document.removeEventListener('mousedown', WB._popOutside, true); };

  /** 오른쪽 클릭 메뉴: items [{label, kb, act, disabled, icon} | '-' | {head}] */
  WB.contextMenu = function (x, y, items) {
    WB.closeCtx();
    const el = document.createElement('div');
    el.className = 'ctx'; el.id = 'ctx'; el.setAttribute('role', 'menu');
    el.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : it.head ? '<div class="ch">' + esc(it.head) + '</div>' :
      '<button role="menuitem" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' + (it.icon ? icon(it.icon) : '<span style="width:12px"></span>') + esc(it.label) + (it.kb ? '<span class="kb">' + esc(it.kb) + '</span>' : '') + '</button>').join('');
    layer().appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 4)) + 'px';
    el.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 4)) + 'px';
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; const it = items[+b.dataset.i]; WB.closeCtx(); if (it && it.act) it.act(); });
    el.addEventListener('keydown', (e) => {
      const bs = $$('button:not(:disabled)', el); const i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); WB.closeCtx(); if (WB._ctxReturn) WB._ctxReturn.focus(); }
    });
    WB._ctxReturn = document.activeElement;
    const first = el.querySelector('button:not(:disabled)'); if (first) first.focus();
    setTimeout(() => document.addEventListener('mousedown', WB._ctxOutside, true), 0);
  };
  WB._ctxOutside = (e) => { const c = document.getElementById('ctx'); if (c && !c.contains(e.target)) WB.closeCtx(); };
  WB.closeCtx = () => { const c = document.getElementById('ctx'); if (c) c.remove(); document.removeEventListener('mousedown', WB._ctxOutside, true); };

  /** 메모 풍선(셀 오류·주석) */
  WB.tip = function (rect, title, text, level) {
    WB.hideTip();
    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'tip ' + (level || '');
    el.id = 'tip';
    el.innerHTML = (title ? '<b>' + esc(title) + '</b>' : '') + esc(text);
    layer().appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = rect.right + 8, y = rect.top - 2;
    if (x + w > window.innerWidth - 6) x = Math.max(6, rect.left - w - 8);
    if (y + h > window.innerHeight - 6) y = window.innerHeight - h - 6;
    el.style.left = x + 'px'; el.style.top = y + 'px';
  };
  WB.hideTip = () => { const t = document.getElementById('tip'); if (t) t.remove(); };

  // ───────────── 상단 띠 (P1) ─────────────
  WB.renderTop = function () {
    const app = WB.app;
    const ex = app.derived().ex;
    const nHard = ex.violations.length;
    const mode = app.state.settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준';
    const run = WB.run;
    const eng = run.status === 'running'
      ? '<span class="eng run" title="엔진 실행 중 — 입력이 잠깁니다"><span class="dot"></span>실행 중 ' + mmss(run.elapsed) + ' ' + icon('lock') + '입력 잠금</span>'
      : run.status === 'paused' ? '<span class="eng paused"><span class="dot"></span>일시정지 ' + mmss(run.elapsed) + ' ' + icon('lock') + '입력 잠금</span>'
        : '<span class="eng"><span class="dot"></span>엔진 대기 · Mock</span>';
    const badge = ex.feasible
      ? '<button class="badge ok" data-act="badge" title="Hard 위반 0">' + icon('ok') + '편성 가능 <span class="sub">Feasible</span></button>'
      : '<button class="badge bad" data-act="badge" title="위반 목록으로 이동">' + icon('bad') + 'Hard 위반 ' + nHard + '건 <span class="sub">' + esc(fmt.score(ex.score).split('hard')[0]) + '</span></button>';
    const ops = WB.ui.screen === 'ops';
    document.getElementById('tb').innerHTML =
      '<div class="brand"><span class="logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>KBO 일정 편성 · 2025<span class="doc">— ' + esc(app.state.meta.name) + '.xlsx</span></div>' +
      '<button class="menu" data-act="menu-data" data-pop-anchor aria-haspopup="menu">데이터 ' + icon('caret') + '</button>' +
      '<button class="menu' + (ops ? '' : ' on') + '" data-act="go-wizard">1차 편성</button>' +
      '<button class="menu' + (ops ? ' on' : '') + '" data-act="go-ops">' + icon('ops') + '시즌 운영</button>' +
      '<button class="menu" data-act="settings">' + icon('gear') + '설정</button>' +
      '<span class="grow"></span>' + eng + '<span class="sep"></span>' + badge +
      '<button class="mode" data-act="settings" title="H0-e 홈 의무 판정 모드 (설정에서 변경)">H0-e<b>' + mode + '</b></button>';
  };
  function mmss(sec) { sec = Math.floor(sec || 0); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
  WB.mmss = mmss;

  // ───────────── 단계 표시 ─────────────
  WB.STEP_NAMES = { 1: '데이터 준비', 2: '검토·실행', 3: '결과·수정', 4: '품질·배포' };
  WB.renderStepper = function () {
    const el = document.getElementById('stepper');
    el.classList.toggle('opsbar', WB.ui.screen === 'ops');
    if (WB.ui.screen === 'ops') { el.innerHTML = WB.Ops.header(); return; }
    let h = '';
    for (let i = 1; i <= 4; i++) {
      const s = WB.steps[i].status();
      h += '<button class="step' + (WB.ui.step === i ? ' on' : '') + '" data-step="' + i + '" aria-current="' + (WB.ui.step === i ? 'step' : 'false') + '">' +
        '<span class="no">' + i + '</span><span class="nm">' + WB.STEP_NAMES[i] + ' ' + WB.st(s.kind, s.label) + '</span><span class="sm" title="' + esc(s.summary) + '">' + esc(s.summary) + '</span></button>';
    }
    el.innerHTML = h;
  };

  // ───────────── 상태 표시줄 + 이전/다음 ─────────────
  WB.renderStatus = function () {
    const el = document.getElementById('status');
    const mode = WB.ui.editing ? '편집' : WB.locked() ? '잠금' : '준비';
    let nav = '';
    if (WB.ui.screen === 'ops') {
      nav = '<button class="btn box" data-act="go-wizard">' + icon('left') + '1차 편성 위저드로 돌아가기</button>';
    } else {
      const i = WB.ui.step;
      const cur = WB.steps[i].status();
      nav = (i > 1 ? '<button class="btn box" data-act="prev">' + icon('left') + '이전: ' + WB.STEP_NAMES[i - 1] + '</button>' : '<button class="btn box" disabled>' + icon('left') + '이전 단계</button>') +
        (i < 4 ? '<button class="btn pri" data-act="next">다음: ' + WB.STEP_NAMES[i + 1] + ' (' + icon(ST_ICON[cur.kind] || 'todo') + esc(cur.short.replace(/^[\u26D4\u2714\u26A0\u25CB]\s*/, '')) + ')' + icon('right') + '</button>' : '<button class="btn box" disabled>마지막 단계' + icon('right') + '</button>');
    }
    el.innerHTML = '<span class="mo" title="셀 모드">' + mode + '</span><span class="agg" id="agg">' + (WB.ui.agg || '') + '</span><span class="grow"></span>' +
      '<span>' + (H.undo.length ? '변경 ' + H.undo.length + '건 · 실행 취소 가능' : '변경 없음') + '</span>' +
      '<span>' + WB.mock('목업') + ' 표시 = 시안 단계에서 흉내만 내는 기능</span>' +
      '<span class="nav">' + nav + '</span>';
  };
  WB.setAgg = (html) => { WB.ui.agg = html; const a = document.getElementById('agg'); if (a) a.innerHTML = html; };

  // ───────────── 수식 줄 ─────────────
  /** fx({addr, value, meta, msg, level}) */
  WB.fx = function (o) {
    o = o || {};
    const el = document.getElementById('fx');
    el.innerHTML = '<div class="nb" title="이름 상자">' + esc(o.addr || '') + '</div><div class="fn" aria-hidden="true">fx</div>' +
      '<div class="val"><span class="v">' + (o.valueHtml || esc(o.value == null ? '' : o.value)) + '</span>' + (o.meta ? '<span class="meta">' + o.meta + '</span>' : '') + '</div>' +
      '<div class="msg ' + (o.level || '') + '">' + (o.msg ? (o.level ? icon(o.level === 'error' ? 'block' : o.level === 'lock' ? 'lock' : o.level === 'ok' ? 'ok' : o.level) : '') + '<span>' + o.msg + '</span>' : '') + '</div>';
  };

  // ───────────── 라우터 ─────────────
  WB.parseHash = function () {
    const out = {};
    const h = (location.hash || '').replace(/^#/, '');
    for (const part of h.split('&')) { if (!part) continue; const [k, v] = part.split('='); out[decodeURIComponent(k)] = v == null ? '' : decodeURIComponent(v); }
    return out;
  };
  WB.syncHash = function () {
    const u = WB.ui;
    const parts = [];
    if (u.screen === 'ops') parts.push('ops=' + u.opsSheet);
    else { parts.push('step=' + u.step); parts.push('sheet=' + u.sheet[u.step]); }
    if (u.modal) parts.push('modal=' + u.modal);
    const h = '#' + parts.join('&');
    if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) { /* file:// 일부 환경 */ } }
  };
  /** 화면 이동: { step, sheet, cell, ops } */
  WB.go = function (o) {
    WB.closePop(); WB.closeCtx(); WB.hideTip();
    if (o.ops) { WB.ui.screen = 'ops'; WB.ui.opsSheet = o.ops; }
    else if (o.step) { WB.ui.screen = 'wizard'; WB.ui.step = +o.step; }
    if (o.sheet) WB.ui.sheet[WB.ui.step] = o.sheet;
    if (o.cell) WB.ui.pendingCell = o.cell;
    if (o.flash) WB.ui.flash = o.flash;
    WB.render();
    WB.syncHash();
  };

  WB.render = function () {
    const u = WB.ui;
    document.getElementById('wb').classList.toggle('ops', u.screen === 'ops');
    WB.renderTop();
    WB.renderStepper();
    const mod = u.screen === 'ops' ? WB.Ops : WB.steps[u.step];
    mod.render();
    WB.renderStatus();
    if (WB.debugScroll) WB.debugScroll();
  };
})();
