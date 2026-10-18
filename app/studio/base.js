/*
 * alt-a 편성 스튜디오 — 기반: 네임스페이스, 아이콘, 포맷, 기능 레지스트리, 가상 위반 시드, 라우터, 스크롤 점검.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const { Score, Dates } = KBO;

  const S = window.Studio = {
    KBO, app: null, steps: {}, actions: {}, inputs: {}, views: {},
    ui: {
      step: 1, tab: 'slots', sel: null, inspOff: false, month: null, view: 'calendar', teamFilter: [],
      qv: 'metrics', team: null, sort: { key: 'distanceKm', dir: -1 }, softLevel: 'S2',
      ops: null, opsDate: null, opsUnit: null, modal: null, drawer: null, setTab: 'features',
      edit: null, newRows: [], flash: null, imp: null, lastImport: null, exported: false, preflightSel: null
    },
    run: null
  };

  // ───────── 문자열·아이콘 ─────────
  S.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = {
    check: '<path d="M3.5 8.5l3 3 6-7"/>',
    warn: '<path d="M8 2.2l6.2 11.3H1.8z"/><path d="M8 6.4v3.4M8 11.7v.1"/>',
    block: '<circle cx="8" cy="8" r="6"/><path d="M4.8 8h6.4"/>',
    todo: '<circle cx="8" cy="8" r="5.5"/>',
    x: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7"/>',
    pin: '<path d="M6 2.5h4M7 2.5v3.8L4.6 9h6.8L9 6.3V2.5M8 9v4.8"/>',
    upload: '<path d="M8 10.5V3M5 5.5l3-3 3 3M2.8 10.5v2.7h10.4v-2.7"/>',
    download: '<path d="M8 2.8v7.6M5 7.4l3 3 3-3M2.8 10.5v2.7h10.4v-2.7"/>',
    link: '<path d="M6.6 9.4l2.8-2.8M7.2 4.6l1-1a2.5 2.5 0 013.5 3.5l-1 1M8.8 11.4l-1 1a2.5 2.5 0 01-3.5-3.5l1-1"/>',
    file: '<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/>',
    sheet: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M2.5 6h11M2.5 9.5h11M6.5 2.5v11"/>',
    undo: '<path d="M5.5 4L3 6.5 5.5 9"/><path d="M3 6.5h6.5a3 3 0 010 6H7"/>',
    redo: '<path d="M10.5 4L13 6.5 10.5 9"/><path d="M13 6.5H6.5a3 3 0 000 6H9"/>',
    plus: '<path d="M8 3.5v9M3.5 8h9"/>',
    rowAbove: '<path d="M2.5 9.5h11v4h-11zM8 2.5v4.5M5.8 4.7L8 2.5l2.2 2.2"/>',
    rowBelow: '<path d="M2.5 2.5h11v4h-11zM8 9v4.5M5.8 11.3L8 13.5l2.2-2.2"/>',
    trash: '<path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M4.8 4.5l.6 8.8h5.2l.6-8.8"/>',
    left: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
    right: '<path d="M6 3.5L10.5 8 6 12.5"/>',
    down: '<path d="M3.5 6l4.5 4.5L12.5 6"/>',
    play: '<path d="M5 3.2v9.6L12.6 8z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M5.2 3.5v9M10.8 3.5v9"/>',
    stop: '<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none"/>',
    gear: '<circle cx="8" cy="8" r="2.3"/><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/>',
    cal: '<rect x="2.5" y="3.5" width="11" height="10" rx="1"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/>',
    list: '<path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8M2.5 4.5h.6M2.5 8h.6M2.5 11.5h.6"/>',
    grid: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M2.5 8h11M8 2.5v11"/>',
    panel: '<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M10 3v10"/>',
    bookmark: '<path d="M4.5 2.5h7v11L8 11l-3.5 2.5z"/>',
    search: '<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>',
    swap: '<path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13"/>',
    flip: '<path d="M8 2v12M5 5L2.5 8 5 11M11 5l2.5 3L11 11"/>',
    move: '<path d="M2.5 8h11M10.5 5l3 3-3 3"/>',
    pool: '<rect x="2.5" y="5" width="11" height="8.5" rx="1"/><path d="M5 5V3h6v2"/>',
    ops: '<path d="M2.5 13.5h11M4 13.5V8M8 13.5V4.5M12 13.5V7"/>',
    db: '<ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"/>',
    chart: '<path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5"/>',
    table: '<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M2.5 6.5h11M2.5 9.8h11M6 6.5v6.5"/>',
    print: '<path d="M4.5 6V2.5h7V6M4.5 11H3V6.5h10V11h-1.5"/><path d="M4.5 9h7v4.5h-7z"/>',
    team: '<circle cx="6" cy="5.5" r="2.2"/><path d="M2.3 13c.4-2.3 1.8-3.6 3.7-3.6s3.3 1.3 3.7 3.6M10.5 3.6a2 2 0 010 3.8M11.8 9.6c1 .5 1.7 1.7 1.9 3.4"/>',
    map: '<path d="M2.5 4l3.7-1.5 3.6 1.5 3.7-1.5v9.5l-3.7 1.5-3.6-1.5L2.5 13.5z"/><path d="M6.2 2.5v9.5M9.8 4v9.5"/>',
    clock: '<circle cx="8" cy="8" r="5.8"/><path d="M8 4.8V8l2.2 1.4"/>',
    eye: '<path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8z"/><circle cx="8" cy="8" r="1.8"/>',
    info: '<circle cx="8" cy="8" r="5.8"/><path d="M8 7.2v4M8 4.9v.1"/>',
    bolt: '<path d="M9 1.8L3.8 9h4l-1 5.2L12.2 7h-4z"/>',
    filter: '<path d="M2.5 3.5h11L9.2 8.6v4.2l-2.4 1V8.6z"/>',
    target: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/>',
    rule: '<path d="M3 3.5h10M3 8h6M3 12.5h8"/>',
    menu: '<path d="M3 4.5h10M3 8h10M3 11.5h10"/>',
    ext: '<path d="M9.5 2.5h4v4M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4"/>'
  };
  S.icon = (name, cls) => '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" aria-hidden="true">' + (P[name] || '') + '</svg>';

  // 상태: ok(완료·통과) warn(확인 필요·경고) block(차단) todo(작성 중)
  const ST = { ok: ['check', '완료'], warn: ['warn', '확인 필요'], block: ['block', '차단'], todo: ['todo', '작성 중'], bad: ['x', '위반'], info: ['info', '정보'] };
  S.stat = (kind, text, cls) => { const s = ST[kind] || ST.info; return '<span class="st ' + kind + (cls ? ' ' + cls : '') + '">' + S.icon(s[0]) + S.esc(text == null ? s[1] : text) + '</span>'; };
  S.statIcon = (kind) => { const s = ST[kind] || ST.info; return '<span class="st plain ' + kind + '" title="' + s[1] + '">' + S.icon(s[0]) + '</span>'; };
  S.mock = (text) => '<span class="tag mock" title="이 기능은 시안에서 미리 준비한 결과를 보여 주는 목업입니다">' + S.esc(text || '목업') + '</span>';
  S.virt = () => '<span class="tag virt" title="결과 화면 시연을 위해 일부러 넣은 위반입니다. 채점기가 실제로 찾아낸 위반입니다.">가상</span>';

  // ───────── 포맷 (NFR-6) ─────────
  S.fmt = {
    date: (d) => Dates.fmtDate(d),
    short: (d) => Dates.fmtShort(d),
    km: (v) => (v == null || !Number.isFinite(Number(v)) ? '-' : Number(v).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
    int: (v) => (v == null ? '-' : Math.round(v).toLocaleString('ko-KR')),
    num1: (v) => (v == null || !Number.isFinite(v) ? '-' : (Math.round(v * 10) / 10).toLocaleString('ko-KR')),
    signed: (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v)).toLocaleString('ko-KR'),
    signed1: (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + (Math.round(Math.abs(v) * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    neg: (v) => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('ko-KR'),
    time: (ms) => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); },
    clock: (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
    score: (s) => Score.scoreString(s).replace(/-/g, '−')
  };
  S.team = (name) => {
    const t = S.app && S.app.team(name);
    return '<span class="tm"><i style="background:' + S.esc(t ? t.color : '#999') + '"></i>' + S.esc(name) + '</span>';
  };
  S.teamColor = (name) => { const t = S.app && S.app.team(name); return t ? t.color : '#999'; };

  // ───────── 저장소 (try/catch) ─────────
  S.ls = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  };
  S.KEY = 'kbo-wizard:opt-2:';

  // ───────── 기능 켜기·끄기 레지스트리 (§6) ─────────
  S.FEATURES = [
    { id: 'X1', name: '.xlsx 업로드', ref: 'FR-X1', desc: '엑셀 파일을 올려 시트별로 가져온다.', must: true },
    { id: 'X2', name: '구글 시트 공유 링크', ref: 'FR-X2', desc: '공유 링크(보기 전용)로 시트를 읽는다.', must: true },
    { id: 'R2', name: '사전 점검', ref: 'FR-R2', desc: '엔진 실행 전 구조적 불가능을 차단·경고한다.', must: true },
    { id: 'V5', name: '위반 목록', ref: 'FR-V5', desc: '규칙별 위반과 위치 이동.', must: true },
    { id: 'A1', name: '총 이동거리 차트', ref: 'FR-A1', desc: '평균선과 ±300km 허용오차 밴드.', must: true },
    { id: 'A2', name: '이동·휴일·주말 비교 차트', ref: 'FR-A2', desc: '구단별 세 지표의 평균·허용오차.', must: true },
    { id: 'A3', name: '홈/원정 흐름 스트립', ref: 'FR-A3', desc: '구단 × 슬롯, 3연속 초과 강조.', must: true },
    { id: 'M7', name: '스냅샷 저장·복원', ref: 'FR-M7', desc: '배정을 이름 붙여 저장하고 되돌린다.', must: true },
    { id: 'T4', name: '지도 마커 드래그', ref: 'FR-T4', desc: '지도에서 마커를 끌어 좌표를 미세 조정한다.', def: false },
    { id: 'T7', name: '거리 행렬 대칭 편집·히트맵', ref: 'FR-T7', desc: '구단과 거리 탭의 접힌 히트맵.', def: true },
    { id: 'V6', name: '구단 × 슬롯 매트릭스', ref: 'FR-V6', desc: '결과·수정의 세 번째 보기.', def: false },
    { id: 'M2', name: '이동 Δ 미리보기', ref: 'FR-M2', desc: '인스펙터 이동 후보를 적용하면 위반과 공정성이 어떻게 바뀌는지 미리 보여 준다.', def: true },
    { id: 'M8', name: '미배정 풀', ref: 'FR-M8', desc: '시리즈를 풀로 빼고 다시 넣는다.', def: true },
    { id: 'P2', name: '결과 미입력 강조', ref: 'FR-P2', desc: '기준일 이전 예정 경기를 강조한다.', def: true },
    { id: 'P7', name: '시즌 진행 현황', ref: 'FR-P7', desc: '구단별 소화·취소·잔여와 수용 게이지.', def: true },
    { id: 'A4', name: '누적 이동거리 선 차트', ref: 'FR-A4', desc: '시즌 진행에 따른 구단별 누적 거리.', def: true },
    { id: 'A5', name: '상대 매트릭스', ref: 'FR-A5', desc: '구단쌍별 경기 수와 홈/원정 분배.', def: true },
    { id: 'A6', name: '지도 이동 경로 재생', ref: 'FR-A6', desc: '시즌 운영의 이동 경로 탭. 구단별 시즌 이동을 지도 위에 차례로 그린다.', def: true },
    { id: 'A8', name: '주중 이동 분석', ref: 'FR-A8', desc: '주중 → 주말 슬롯 이동(참고).', def: true },
    { id: 'A9', name: '혹서기 부담', ref: 'FR-A9', desc: '7~8월 원정 경기·이동거리, 돔 구단 표기.', def: false },
    { id: 'A10', name: '장거리 연속 원정 경고', ref: 'FR-A10', desc: '연속 원정 구간 거리 합 600km 초과.', def: false },
    { id: 'A11', name: '구단별 일정표·인쇄', ref: 'FR-A11', desc: '구단 운영팀 배포용 인쇄 레이아웃.', def: true },
    { id: 'A12', name: '월별 홈경기 히트맵', ref: 'FR-A12', desc: '구단 × 월 홈경기 수.', def: false },
    { id: 'D4', name: '일정표 CSV', ref: 'FR-D4', desc: '날짜·원정·홈·구장·상태 CSV 내보내기.', def: true }
  ];
  const FKEY = S.KEY + 'features';
  S.features = {};
  S.loadFeatures = function () {
    let saved = {};
    try { saved = JSON.parse(S.ls.get(FKEY) || '{}') || {}; } catch (e) { saved = {}; }
    for (const f of S.FEATURES) S.features[f.id] = f.must ? true : (typeof saved[f.id] === 'boolean' ? saved[f.id] : f.def);
  };
  S.feature = (id) => S.features[id] !== false;
  S.setFeature = function (id, on) {
    const f = S.FEATURES.find((x) => x.id === id);
    if (!f || f.must) return;
    S.features[id] = !!on;
    const out = {};
    for (const x of S.FEATURES) if (!x.must) out[x.id] = S.features[x.id];
    S.ls.set(FKEY, JSON.stringify(out));
    try { S.app.state.meta.features = out; } catch (e) { /* 무시 */ }
  };
  S.resetFeatures = function () { S.ls.del(FKEY); S.loadFeatures(); };

  // ───────── 개발자 모드 · 용어 사전 (W16) ─────────
  // 일반 모드: Hard/Soft, 규칙 코드, 원점수를 화면(DOM)에 만들지 않는다. 개발자 모드: 일반 용어 옆에 함께 보인다.
  const DKEY = S.KEY + 'dev';
  S.devOverride = null; // 해시 dev=1/0 (이 탭에서만)
  S.dev = () => (S.devOverride != null ? S.devOverride : S.ls.get(DKEY) === '1');
  S.setDev = function (on) { S.devOverride = null; S.ls.set(DKEY, on ? '1' : '0'); };
  const TERMS = {
    hard: ['필수 규칙', 'Hard'],
    hardViol: ['필수 규칙 위반', 'Hard'],
    soft: ['공정성·이동 부담', 'Soft'],
    softBreak: ['공정성 점수 구성', 'Soft 분해'],
    score: ['채점 결과', 'BendableLongScore']
  };
  /** 일반 용어. 개발자 모드면 원래 용어를 괄호로 덧붙인다. */
  S.term = (k) => { const t = TERMS[k]; if (!t) return k; return S.dev() ? t[0] + '(' + t[1] + ')' : t[0]; };
  S.termPlain = (k) => (TERMS[k] ? TERMS[k][0] : k);
  // [일반 이름, 짧은 이름]
  S.RULE_NAMES = {
    'H0-a': ['출전 구단 수', '출전 수'], 'H0-b': ['한 구장에 두 경기', '구장 중복'], 'H0-c': ['슬롯별 시리즈 수', '시리즈 수'],
    'H0-d': ['연전 수 불일치', '연전 불일치'], 'H0-e': ['지정 구장 홈 경기', '홈 의무'], 'H0-f': ['홈·원정 4연속 이상', '4연속'],
    'H1': ['같은 대진 연속', '대진 연속'],
    'S0': ['미배정 시리즈', '미배정'], 'S1': ['이동 횟수 고르기', '이동 횟수'], 'S2': ['이동거리 고르기', '이동거리'], 'S3': ['휴일 경기 고르기', '휴일 경기'], 'S4': ['리그 총 이동거리', '총 이동거리'],
    'RH-1': ['구단 하루 1경기', '하루 1경기'], 'RH-2': ['구장 하루 1대진', '구장 1대진'], 'RH-3': ['월요일·경기 없는 날 금지', '쉬는 날'], 'RH-4': ['더블헤더 한도', '더블헤더'], 'RH-5': ['재편성 경기 미배정', '미배정'],
    'RS-1': ['마지막 경기일', '마지막 경기일'], 'RS-2a': ['이동거리 증가 편차', '증가 편차'], 'RS-2b': ['이동거리 증가 합계', '증가 합계'], 'RS-3': ['더블헤더·월요일 경기 수', 'DH·월요일']
  };
  S.ruleName = (code) => { const r = S.RULE_NAMES[code]; return r ? r[0] : (S.dev() ? code : '규칙'); };
  S.ruleShort = (code) => (S.dev() ? code : (S.RULE_NAMES[code] ? S.RULE_NAMES[code][1] : '위반'));
  /** HTML: 일반 모드 = 이름만, 개발자 모드 = 코드 배지 + 이름 */
  S.ruleLabel = (code) => (S.dev() ? '<code class="rc">' + S.esc(code) + '</code>' : '') + S.esc(S.ruleName(code));
  const CODE_RE = /RS-2[ab]|R[HS]-\d|H0-[a-f]|H1(?![0-9])|S[0-4](?![0-9])/g;
  /** 코어·공통 모듈이 만든 문장에서 코드·Hard/Soft를 일반 용어로 바꾼다(일반 모드). */
  S.plain = function (str) {
    let t = String(str == null ? '' : str);
    if (S.dev()) return t;
    t = t.replace(/H0-e 모드/g, '홈 의무 판정 방식');
    t = t.replace(/\s*\((?:RS-2[ab]|R[HS]-\d|H0-[a-f]|H1|S[0-4])(?:[~·,\s]+(?:RS-2[ab]|R[HS]-\d|H0-[a-f]|H1|S[0-4]))*\)/g, '');
    t = t.replace(CODE_RE, (c) => (S.RULE_NAMES[c] ? S.RULE_NAMES[c][0] : '규칙'));
    t = t.replace(/\bHard\b/g, '필수 규칙').replace(/\bSoft\b/g, '공정성·이동 부담').replace(/\bhard\b/g, '필수').replace(/\bsoft\b/g, '공정성');
    return t;
  };
  /** 상태 한 줄: 일반 모드 = 위반 건수, 개발자 모드 = 원점수 함께 */
  S.scoreLine = function (ex) {
    const n = ex.violations.length;
    const base = ex.feasible ? '편성 가능' : S.termPlain('hardViol') + ' ' + n + '건';
    return S.dev() ? base + ' · ' + S.fmt.score(ex.score) : base;
  };

  // ───────── 시연 상태: 2025 프리셋 + 가상 위반 3건 + 경기 기록 ─────────
  S.SEEDS = [
    { kind: 'flip', match: 87, code: 'H0-f', note: '홈·원정 뒤집기 → KT 원정 4연속' },
    { kind: 'flip', match: 74, code: 'H0-b', note: '홈·원정 뒤집기 → 5/9 잠실 중복' },
    { kind: 'swap', slots: [1, 19], code: 'H1', note: '3/25 ↔ 5/27 슬롯 맞바꾸기 → 5/30 동일 대진 연속' }
  ];
  S.REF_DATE = '2025-07-10';
  S.CANCELLED = [
    { date: '2025-04-13', reason: 'RAIN', n: 2 }, { date: '2025-05-17', reason: 'RAIN', n: 1 },
    { date: '2025-06-20', reason: 'DUST', n: 1 }, { date: '2025-07-06', reason: 'HEAT', n: 1 }
  ];
  S.OVERDUE_FROM = '2025-07-08'; // 이날부터 기준일 전까지는 결과 미입력으로 둔다(FR-P2 시연)

  S.seedProject = function () {
    const p = KBO.Preset.buildProject();
    p.meta.name = '2025 정규시즌 1차안';
    const origPlan = JSON.parse(JSON.stringify(p.plan));
    for (const sd of S.SEEDS) {
      if (sd.kind === 'flip') { const m = p.matches[sd.match]; const t = m.home; m.home = m.away; m.away = t; }
      else { const [a, b] = sd.slots; for (const x of p.plan) { if (x.calendar === a) x.calendar = b; else if (x.calendar === b) x.calendar = a; } }
    }
    p.settings.referenceDate = S.REF_DATE;
    // 경기 기록: 기준일 이전 경기는 완료, 일부 취소, 7/8~7/9는 미입력
    const games = KBO.Reschedule.computeGames(p);
    const cancelLeft = {};
    for (const c of S.CANCELLED) cancelLeft[c.date] = { n: c.n, reason: c.reason };
    p.games = [];
    for (const g of games) {
      if (g.date >= S.OVERDUE_FROM) continue;
      const c = cancelLeft[g.date];
      if (c && c.n > 0) { c.n--; p.games.push({ match: g.match, date: g.date, status: 'CANCELLED', reason: c.reason }); }
      else p.games.push({ match: g.match, date: g.date, status: 'PLAYED' });
    }
    // 시드 전 배정을 스냅샷 하나로 남긴다(복원 시연용)
    const tmp = JSON.parse(JSON.stringify(p)); tmp.plan = origPlan;
    const sc = Score.scoreProject(tmp).score;
    p.snapshots = [{ id: 's-engine-1', name: '엔진 1차 결과 — 슬롯 교환 전', createdAt: '2025-01-14T09:12:00.000Z', plan: origPlan, pins: p.matches.map((m) => !!m.pinned), reschedulePlan: [], matchCount: p.matches.length, slotCount: p.calendar.length, score: Score.scoreString(sc), feasible: Score.isFeasible(sc), h0eMode: 'STADIUM' }];
    return p;
  };

  /** 시드 직후 위반의 서명 → 가상 표시 */
  S.virtualSigs = new Set();
  S.vsig = (v) => v.code + '|' + v.slot + '|' + (v.matches || []).slice().sort((a, b) => a - b).join(',');
  S.isVirtual = (v) => S.virtualSigs.has(S.vsig(v));

  // ───────── 라우터 (hash) ─────────
  const ROUTE_KEYS = ['step', 'tab', 'sel', 'month', 'view', 'qv', 'team', 'ops', 'date', 'unit', 'modal', 'drawer', 'demo', 'insp', 'teams', 'set', 'dev', 'devopen', 'leg', 'speed'];
  S.ROUTE_KEYS = ROUTE_KEYS;
  S.parseHash = function () {
    const h = (location.hash || '').replace(/^#/, '');
    const o = {};
    for (const part of h.split('&')) { if (!part) continue; const [k, v] = part.split('='); o[decodeURIComponent(k)] = v == null ? '1' : decodeURIComponent(v); }
    return o;
  };
  S.writeHash = function () {
    const u = S.ui;
    const o = {};
    if (u.ops) {
      o.ops = u.ops;
      if (u.ops === 'games' && u.opsDate) o.date = u.opsDate;
      if (u.ops === 'reschedule' && u.opsUnit) o.unit = u.opsUnit;
      if (u.ops === 'route') { if (u.team) o.team = u.team; if (u.routePos) o.leg = Math.round(u.routePos * 10) / 10; if (u.routeSpeed && u.routeSpeed !== 1) o.speed = u.routeSpeed; }
    }
    else {
      o.step = u.step;
      if (u.step === 1) o.tab = u.tab;
      if (u.step === 3) { o.month = u.month; if (u.view !== 'calendar') o.view = u.view; if (u.teamFilter.length) o.teams = u.teamFilter.join(','); }
      if (u.step === 4) { o.qv = u.qv; if (u.team) o.team = u.team; }
      if (u.step === 2 && u.devOpen && S.dev()) o.devopen = 1;
      if (u.sel) o.sel = u.sel;
    }
    if (S.dev()) o.dev = 1;
    if (u.modal) o.modal = u.modal;
    if (u.drawer) { o.drawer = u.drawer; }
    if (u.inspOff) o.insp = '0';
    const str = Object.keys(o).map((k) => k + '=' + encodeURIComponent(o[k])).join('&');
    try { history.replaceState(null, '', location.pathname + location.search + '#' + str); } catch (e) { /* file:// 일부 환경 */ }
  };
  S.applyRoute = function (o) {
    const u = S.ui;
    if (o.ops) {
      u.ops = ['games', 'reschedule', 'route'].includes(o.ops) ? o.ops : 'games';
      if (u.ops === 'route' && !S.feature('A6')) u.ops = 'games';
      u.opsDate = o.date || u.opsDate; u.opsUnit = o.unit || null;
      if (o.leg != null) u.routePos = Math.max(0, parseFloat(o.leg) || 0);
      if (o.speed) u.routeSpeed = [1, 2, 4].includes(+o.speed) ? +o.speed : 1;
    } else u.ops = null;
    if (o.dev === '1') S.devOverride = true; else if (o.dev === '0') S.devOverride = false;
    u.devOpen = o.devopen === '1';
    if (o.step) u.step = Math.max(1, Math.min(4, parseInt(o.step, 10) || 1));
    if (o.tab) u.tab = o.tab;
    if (o.month) u.month = parseInt(o.month, 10) || u.month;
    if (o.view) u.view = o.view;
    if (o.qv) u.qv = o.qv;
    if (o.team) u.team = o.team;
    if (o.teams) u.teamFilter = o.teams.split(',').filter(Boolean);
    u.sel = o.sel || null;
    u.modal = o.modal || null;
    u.drawer = o.drawer || (o.settings ? 'settings' : null);
    if (o.set) u.setTab = o.set;
    u.inspOff = o.insp === '0';
    u.demo = o.demo || null;
  };

  // ───────── 스크롤 점검 (NFR-W4, AC-P2) ─────────
  S.checkScroll = function () {
    const de = document.documentElement;
    const w = window.innerWidth, h = window.innerHeight;
    const sw = Math.max(de.scrollWidth, document.body.scrollWidth), sh = Math.max(de.scrollHeight, document.body.scrollHeight);
    const pageScroll = sw > w + 1 || sh > h + 1;
    // 두 방향으로 스크롤하는 패널 (2-D 허용 표시가 없는 것)
    const both = [];
    document.querySelectorAll('.pane-body, .modal-body section, .drawer *').forEach((el) => {
      const cs = getComputedStyle(el);
      const sx = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
      const sy = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
      if (sx && sy && !el.classList.contains('xy')) both.push(el.className.split(' ').slice(0, 2).join('.'));
    });
    const res = { w, h, sw, sh, ok: !pageScroll, both };
    de.setAttribute('data-scroll', (res.ok ? 'OK' : 'SCROLL') + ' ' + w + 'x' + h + ' doc ' + sw + 'x' + sh + (both.length ? ' 2D:' + both.join(',') : ''));
    if (S.debugScroll) {
      let el = document.getElementById('dbgScroll');
      if (!el) { el = document.createElement('div'); el.id = 'dbgScroll'; document.body.appendChild(el); }
      el.className = 'dbg-scroll ' + (res.ok ? 'ok' : 'bad');
      el.textContent = (res.ok ? '✔ 페이지 스크롤 0' : '✖ 페이지 스크롤 발생') + ' · 뷰포트 ' + w + '×' + h + ' · 문서 ' + sw + '×' + sh + (both.length ? ' · 2방향 ' + both.length : '');
    }
    return res;
  };
})();
