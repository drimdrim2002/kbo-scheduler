/*
 * 계획 흐름 시안 — 공통 틀과 숫자 (정적 시안 전용, 실제 스튜디오 코드와 무관)
 * 사용자 결정(2026-10-31): 큰 흐름은 ① 값 입력·검증 → ② 엔진 옵션·실행 → ③ 현재 결과 분석 → 실행 결과 비교(저장한 버전끼리, 언제든 들어가는 별도 단계).
 *   2025 = KBO 실제와 우리 결과를 이미 앎 → 우리가 낫다는 점을 강조해 보여 준다(검토 단계 없음, 보기 전용).
 *   2027 = 개막·어린이날·올스타·1차 편성 기간이 추정값 → 「1 구단 정보」부터 사용자가 검토·수정한 뒤 실행(따라 하기로 안내).
 *   목적식 우선순위 = 순서만 정함(위가 조금이라도 나으면 그쪽) · 허용 차이 = 가장 많은 구단과 가장 적은 구단의 차이 ·
 *   넘으면 줄이려 노력(반드시는 아님) · 주말과 공휴일은 한 점수로 합침.
 * 숫자는 모두 실제로 돌려 얻은 값이다(브라우저 채점기로 다시 셈).
 *   2025 실제 = KBO 2025 공식 일정 · 2025 우리 = data/results/default.json(저장된 결과, 10/20 실행)
 *   2027 기본안 = KBO.Preset2027 입력 → 엔진 30초(시드 4개) · 2027 개막 대진 바꾼 안 = 롯데@KT·한화@KIA로 맞바꿔 같은 방식
 */
(function () {
  'use strict';
  const P = window.Plan = {};
  P.TEAMS = ['SSG', '두산', 'LG', 'KT', '키움', '한화', '삼성', 'KIA', 'NC', '롯데'];
  // 구단별 [이동 거리 km, 이동 횟수, 주말·공휴일 홈 점수(주말 1·공휴일 2·어린이날 3), 주말 홈 시리즈, 가장 긴 연속 원정 시리즈]
  P.D = {
    kbo25: { SSG: [6790.7, 36, 26, 12, 2], 두산: [6711.1, 32, 33, 12, 2], LG: [6936.3, 35, 22, 11, 2], KT: [6933.4, 38, 26, 12, 2], 키움: [7234.8, 38, 33, 12, 2], 한화: [7219.7, 38, 27, 11, 2], 삼성: [7230.8, 36, 26, 12, 2], KIA: [8083.6, 36, 24, 11, 3], NC: [7837.2, 35, 29, 11, 2], 롯데: [7978.2, 35, 29, 11, 3] },
    ours25: { SSG: [6077.9, 33, 26, 12, 3], 두산: [6275.0, 32, 29, 11, 3], LG: [6221.0, 32, 26, 12, 3], KT: [6235.5, 32, 26, 12, 3], 키움: [6632.1, 33, 29, 11, 3], 한화: [6357.6, 32, 29, 11, 3], 삼성: [6159.8, 33, 26, 12, 3], KIA: [6378.1, 33, 26, 12, 3], NC: [6462.7, 31, 29, 11, 3], 롯데: [6512.6, 31, 29, 11, 3] },
    v27a: { SSG: [6464.8, 34, 27, 13, 3], 두산: [6081.3, 32, 27, 11, 3], LG: [6265.4, 31, 26, 12, 3], KT: [6219.9, 32, 27, 12, 3], 키움: [6196.5, 34, 27, 11, 3], 한화: [6390.2, 32, 26, 11, 3], 삼성: [6204.9, 33, 26, 11, 3], KIA: [6661.5, 33, 26, 12, 3], NC: [6675.7, 33, 27, 11, 3], 롯데: [6594.0, 31, 26, 11, 3] },
    v27b: { SSG: [6825.2, 34, 28, 12, 3], 두산: [6962.7, 34, 26, 10, 3], LG: [6769.9, 33, 27, 13, 3], KT: [6828.9, 35, 26, 12, 2], 키움: [6803.8, 35, 26, 11, 3], 한화: [6838.1, 35, 27, 12, 3], 삼성: [7057.1, 35, 26, 12, 3], KIA: [7200.0, 34, 28, 13, 3], NC: [6900.6, 32, 26, 11, 3], 롯데: [6806.6, 32, 25, 9, 3] }
  };
  // 엔진이 낸 리그 총 이동 거리(구장 간 거리표 기준, 위 구단별 합과 반올림만 다름)
  P.TOTAL = { kbo25: 72955, ours25: 63312, v27a: 63754, v27b: 68992 };
  /**
   * 목적식 4개. 지금 엔진 순서 그대로(이동 횟수 → 이동 거리 → 주말·공휴일 → 전체 거리).
   * 허용 차이 기본값 = 지금 엔진 기본값(평균 ±2회 · ±300km · ±1.5점)을 「가장 많은·적은 구단 차이」로 옮긴 값.
   */
  P.GOALS = [
    { id: 'moves', i: 1, name: '이동 횟수 균형', desc: '구단마다 다른 도시로 옮겨 가는 횟수를 비슷하게', unit: '회', tol: 4, d: 0 },
    { id: 'dist', i: 0, name: '이동 거리 균형', desc: '구단마다 시즌 동안 이동하는 거리를 비슷하게', unit: 'km', tol: 600, d: 1 },
    { id: 'hol', i: 2, name: '주말·공휴일 홈 균형', desc: '주말·공휴일 홈 경기 점수를 비슷하게 (주말 하루 1점 · 공휴일 2점 · 어린이날 3점)', unit: '점', tol: 3, d: 0 },
    { id: 'total', name: '전체 이동 거리', desc: '10구단 이동 거리를 모두 더한 값을 짧게', unit: 'km', tol: null, d: 0 }
  ];
  P.fmt = (n, d) => Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  P.vals = (set, i) => P.TEAMS.map((t) => P.D[set][t][i]);
  P.gap = (set, i) => { const a = P.vals(set, i); return Math.round((Math.max(...a) - Math.min(...a)) * 10) / 10; };
  P.range = (set, i) => { const a = P.vals(set, i); return [Math.min(...a), Math.max(...a)]; };
  /** 목적식 값: 균형은 차이, 전체 거리는 총합 */
  P.val = (set, g) => (g.id === 'total' ? P.TOTAL[set] : P.gap(set, g.i));
  P.show = (set, g) => P.fmt(P.val(set, g), g.id === 'dist' ? 1 : 0);

  const STAGES = ['값 입력·검증', '엔진 옵션·실행', '현재 결과 분석', '실행 결과 비교'];
  const STEPS = ['구단 정보', '시즌 기간·연전 묶음', '공휴일·홈 구장', '확인'];
  /**
   * o: { year, mode, ro, stage(1~3), sst:{1:'done'|'cur'|'todo'}, ssub:{1:'…'}, at(① 안 1~4), st:{n:'done'|'cur'|'todo'}, sub:{n:'…'},
   *      prev, next, nextDis, hint, right, noStepper, noFoot }
   */
  P.chrome = function (o) {
    const sst = o.sst || {};
    const stepper = o.noStepper ? '' : '<nav class="stepper">' + STAGES.map((n, i) => {
      const k = sst[i + 1] || (i + 1 < o.stage ? 'done' : i + 1 === o.stage ? 'cur' : 'todo');
      return '<span class="st ' + k + '"><i>' + (k === 'done' ? '✓' : i + 1) + '</i><div><b>' + n + '</b><small>' + ((o.ssub || {})[i + 1] || '') + '</small></div></span>';
    }).join('') + '</nav>';
    const st = o.st || {};
    const band = o.at ? '<div class="flow"><div class="lead"><b>' + o.year + ' 시즌 · 값 입력·검증</b><small>' + o.at + ' / 4단계</small></div>' + STEPS.map((n, i) => {
      const k = st[i + 1] || (i + 1 < o.at ? 'done' : i + 1 === o.at ? 'cur' : 'todo');
      return '<span class="fs ' + k + '"><i>' + (k === 'done' ? '✓' : i + 1) + '</i><div><b>' + (i + 1) + ' ' + n + (i + 1 === o.at ? '<span class="here">지금 여기</span>' : '') + '</b><small>' + ((o.sub || {})[i + 1] || (k === 'todo' ? '검토 전' : '')) + '</small></div></span>';
    }).join('') + '<div class="tail"><a>☰ 따라 하기 다시 보기</a></div></div>' : '';
    document.body.insertAdjacentHTML('afterbegin',
      '<header class="top"><span class="logo">KBO</span><b>일정 편성</b>' +
      (o.year ? '<span class="yr">' + o.year + ' 시즌<small>' + (o.mode || '') + '</small></span>' : '') +
      (o.ro ? '<span class="ro">보기 전용 · 고치지 않음</span>' : '') +
      '<span class="sub">편성 스튜디오</span>' + (o.year ? '<span class="home">⌂ 처음 화면</span>' : '') +
      '<span class="r">' + (o.right || '저장한 버전 ▾ &nbsp;&nbsp; 설정') + '</span></header>' + stepper + band);
    if (o.noFoot) return;
    document.body.insertAdjacentHTML('beforeend', '<footer class="foot">' + (o.prev ? '<span class="btn">‹ ' + o.prev + '</span>' : '<span class="btn dis">‹ 이전</span>') +
      '<span class="hint">' + (o.hint || '') + '</span><span class="r">' + (o.next ? '<span class="btn pri' + (o.nextDis ? ' dis' : '') + '">' + o.next + ' ›</span>' : '') + '</span></footer>');
  };

  /** 따라 하기 카드: { n, of, title, text, x, y, side:'l'|'rt'|'t'|'b', w } */
  P.coach = (c) => '<div class="coach ' + (c.side || 'l') + '" style="left:' + c.x + 'px;top:' + c.y + 'px' + (c.w ? ';width:' + c.w + 'px' : '') + '"><div class="h">따라 하기 ' + c.n + ' / ' + c.of + '<span class="dots">' + Array.from({ length: c.of }, (_, i) => '<i class="' + (i + 1 === c.n ? 'on' : i + 1 < c.n ? 'done' : '') + '"></i>').join('') + '</span><span class="x">✕ 닫기</span></div><h4>' + c.title + '</h4><p>' + c.text + '</p><div class="acts"><span class="btn sm">' + (c.btn || '다음 ›') + '</span></div></div>';
  P.ring = (x, y, w, h) => '<div class="ring" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px"></div>';

  /** 검토 줄: { t, v, why, src, tag:'est'|'got', state:'ok'|'cur'|'chg'|'' } */
  P.rv = (r) => '<div class="rv ' + (r.state || '') + '"><div class="t"><b>' + r.t + '</b> ' +
    (r.tag === 'est' ? '<span class="tag est">추정 · 확정 아님</span>' : r.tag === 'got' ? '<span class="tag got">2025에서 가져옴</span>' : r.tag === 'rule' ? '<span class="tag blue">규칙대로 자동</span>' : r.tag === 'cal' ? '<span class="tag got">공휴일 달력</span>' : '') +
    (r.state === 'chg' ? ' <span class="tag blue">고침</span>' : '') +
    '<div class="v">' + r.v + '</div><div class="why">' + (r.why ? '<em>왜 이 값?</em> ' + r.why : '') + (r.src ? ' <em>· 근거:</em> ' + r.src : '') + '</div></div>' +
    '<div class="acts">' + (r.state === 'ok' || r.state === 'chg' ? '<span class="tag ok">✓ 확인함</span><span class="btn sm">다시 고치기</span>' : '<span class="btn sm okb">✓ 맞아요</span><span class="btn sm">고치기</span>') + '</div></div>';

  /** 구단별 막대 + 허용 띠(가장 적은 구단 ~ +허용 차이). sets: [주, 비교?] */
  P.teamBars = function (set, i, tol, unit, set2) {
    const a = P.vals(set, i), b = set2 ? P.vals(set2, i) : null;
    const all = a.concat(b || []), lo = Math.min(...all), hi = Math.max(...all);
    const base = i === 0 ? Math.floor(lo * 0.9 / 100) * 100 : Math.max(0, Math.floor(lo - 4));
    const top = Math.max(hi, Math.min(...a) + (tol || 0)) * (i === 0 ? 1.02 : 1) + (i === 0 ? 0 : 1);
    const x = (v) => ((v - base) / (top - base) * 100).toFixed(1) + '%';
    const mn = Math.min(...a), mean = a.reduce((s, v) => s + v, 0) / a.length;
    return '<div class="tb' + (b ? ' two' : '') + '">' + P.TEAMS.map((t, k) => ({ t, v: a[k], w: b ? b[k] : null })).sort((p, q) => q.v - p.v).map((r) =>
      '<div class="rw"><span class="t">' + r.t + '</span><span class="tr">' + (tol ? '<span class="tolband" style="left:' + x(mn) + ';width:calc(' + x(mn + tol) + ' - ' + x(mn) + ')"></span>' : '') +
      (b ? '<span class="bar b2" style="width:' + x(r.w) + '"></span><span class="bar b3" style="width:' + x(r.v) + '"></span>' : '<span class="bar" style="width:' + x(r.v) + '"></span>') +
      '</span><span class="n">' + P.fmt(r.v, i === 0 ? 1 : 0) + (b ? ' <span class="muted">/ ' + P.fmt(r.w, i === 0 ? 1 : 0) + '</span>' : '') + '</span><span class="dv">평균 ' + (r.v - mean >= 0 ? '+' : '−') + P.fmt(Math.abs(r.v - mean), i === 0 ? 0 : 1) + '</span></div>').join('') + '</div>';
  };
})();
