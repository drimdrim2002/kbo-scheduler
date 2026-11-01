/*
 * 시연 흐름 시안 — 공통 틀과 숫자 (정적 시안 전용, 실제 스튜디오 코드와 무관)
 * 사용자 결정(2026-10-31): 들어가면 「2025 계획 보기(확인용)」 / 「2027 새 계획 만들기」 중 고른다. 연도는 2025·2027만.
 * 숫자는 모두 실제로 돌려 얻은 값이다(2026-10-31, 이 브랜치 엔진 · 브라우저 채점기로 다시 셈).
 *   2025 실제 = KBO 2025 공식 일정 · 2025 우리 = data/results/default.json(엔진 30초, 같은 2025 입력, 개막 대진 같음)
 *   2027 = KBO.Preset2027 입력 → 엔진 SCRATCH 30초(시드 4개)
 */
(function () {
  'use strict';
  const T = window.Demo = {};
  T.TEAMS = ['SSG', '두산', 'LG', 'KT', '키움', '한화', '삼성', 'KIA', 'NC', '롯데'];
  // 구단별 총 이동 거리(km)
  T.KM_2025_ACTUAL = { SSG: 6790.7, 두산: 6711.1, LG: 6936.3, KT: 6933.4, 키움: 7234.8, 한화: 7219.7, 삼성: 7230.8, KIA: 8083.6, NC: 7837.2, 롯데: 7978.2 };
  T.KM_2025_OURS = { SSG: 6077.9, 두산: 6275.0, LG: 6221.0, KT: 6235.5, 키움: 6632.1, 한화: 6357.6, 삼성: 6159.8, KIA: 6378.1, NC: 6462.7, 롯데: 6512.6 };
  T.KM_2027 = { SSG: 6464.8, 두산: 6081.3, LG: 6265.4, KT: 6219.9, 키움: 6196.5, 한화: 6390.2, 삼성: 6204.9, KIA: 6661.5, NC: 6675.7, 롯데: 6594.0 };
  T.fmt = (n, d) => Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

  /** o: { year, mode('보기 전용'|'새 계획'), ro, right, hint, prev, next, nextDis, noFoot } */
  T.chrome = function (o) {
    document.body.insertAdjacentHTML('afterbegin',
      '<header class="top"><span class="logo">KBO</span><b>일정 편성</b>' +
      (o.year ? '<span class="yr">' + o.year + ' 시즌<small>' + (o.mode || '') + '</small></span>' : '') +
      (o.ro ? '<span class="ro">보기 전용 · 고치지 않음</span>' : '') +
      '<span class="sub">편성 스튜디오</span>' + (o.year ? '<span class="home">⌂ 처음 화면</span>' : '') +
      '<span class="r">' + (o.right || '설정') + '</span></header>');
    if (o.noFoot) return;
    document.body.insertAdjacentHTML('beforeend', '<footer class="foot">' + (o.prev ? '<span class="btn">‹ ' + o.prev + '</span>' : '<span></span>') +
      '<span class="hint">' + (o.hint || '') + '</span><span class="r">' + (o.next ? '<span class="btn pri' + (o.nextDis ? ' dis' : '') + '">' + o.next + ' ›</span>' : '') + '</span></footer>');
  };

  /** 구단별 이동 거리 막대: 두 값(a 회색, b 파랑) */
  T.bars = function (a, b, la, lb) {
    if (!b) return T.bar1(a);
    const max = Math.max(...T.TEAMS.map((t) => Math.max(a[t], b[t])));
    const rows = T.TEAMS.slice().sort((x, y) => a[y] - a[x]).map((t) =>
      '<div class="br"><span class="t">' + t + '</span><span class="tr"><span class="b1" style="width:' + (a[t] / max * 100).toFixed(1) + '%"></span><span class="b2" style="width:' + (b[t] / max * 100).toFixed(1) + '%"></span></span><span class="v">' + T.fmt(a[t]) + '<br>' + T.fmt(b[t]) + '</span></div>').join('');
    return '<div class="leg"><span><i style="background:#C9CFD9"></i>' + la + '</span><span><i style="background:var(--blue)"></i>' + lb + '</span><span class="r muted">단위 km · 시즌 전체(1차 편성)</span></div><div class="bars" style="margin-top:6px">' + rows + '</div>';
  };

  /** 한 값만: 파랑 막대 */
  T.bar1 = function (a) {
    const max = Math.max(...T.TEAMS.map((t) => a[t]));
    return '<div class="bars">' + T.TEAMS.slice().sort((x, y) => a[y] - a[x]).map((t) => '<div class="br"><span class="t">' + t + '</span><span class="tr" style="height:12px"><span class="b2" style="top:2px;width:' + (a[t] / max * 100).toFixed(1) + '%"></span></span><span class="v">' + T.fmt(a[t]) + '</span></div>').join('') + '</div>';
  };

  /** 2027 규칙 점검표(엔진 결과를 채점기로 다시 확인한 것) */
  T.RULES_2027 = [
    ['개막 2연전 홈', '3/27(토)·28(일) 홈 KT·삼성·KIA·LG·SSG — 한화@KT · NC@삼성 · 롯데@KIA · 키움@LG · 두산@SSG'],
    ['어린이날 홈', '5/5(수) 홈 두산·키움·한화·롯데·NC (격년제, 2027 = 홀수 해)'],
    ['후반기 첫 4연전', '7/15(목)~18(일) 개막 대진 그대로, 개막전 홈 구장에서'],
    ['홈 경기 73 / 71', '한화·SSG·KT·롯데·두산 73(1차 편성 69 + 잔여 4) · 나머지 71(66 + 5)'],
    ['3연전 이상만', '개막 2연전 하나만 빼고 3연전 43개 · 4연전 1개'],
    ['경기일 135일', '3/27~9/5 · 올스타 휴식기 7/9~7/14 · 월요일 휴식'],
    ['맞대결 경기 수', '모든 두 구단이 1차 편성에서 15경기씩(잔여 1경기는 9/7 뒤)'],
    ['하루 5경기', '매 경기일 10구단이 모두 한 경기씩'],
    ['연속 홈·원정 3시리즈까지', '어느 구단도 홈이나 원정이 4시리즈 이상 이어지지 않음 · 같은 대진 연속 없음'],
    ['잠실 겹침 없음', '두산·LG가 같은 날 잠실 홈을 쓰지 않음']
  ];
  T.rules = (list, wait) => '<div class="rules">' + list.map(([k, v]) => '<div class="rl' + (wait ? ' wait' : '') + '"><i>' + (wait ? '…' : '✓') + '</i><b>' + k + '</b><span>' + v + '</span></div>').join('') + '</div>';
})();
