/*
 * 편성 스튜디오 — 「운영 방침 설명하기」 설명 창 (운영 방침 화면 머리글 오른쪽 · 실행 중 화면 오른쪽 위 링크 → 오른쪽 서랍)
 *  ① 왜 운영자가 정하나(모두 최고로 만들 수 없음 → 더 좋아질 곳이 없는 균형점 가운데 어디에 설지 고르는 일)
 *  ② 목표 네 개(앞의 셋은 구단 사이 공평함, 전체 이동 거리는 리그 전체의 합) ③ 허용 수준의 뜻과 움직였을 때의 변화 ④ 시험 실행에서 본 수치(예시)
 *  숫자는 지금 정한 허용 수준과 입력에서 센 값(구장 사이 평균 거리·점수 합)만 실제 값이고, 그림의 구단 값은 가상 예다. 2025 숫자(이 엔진·KBO 실제)는 쓰지 않는다(사용자 결정 2026-11-02).
 *  세는 법은 엔진(ScoreFormulas)·ui/core/score.js 그대로다. 허용 수준 입력 구역(plan-flow.js slider)은 여기서 건드리지 않는다.
 *  설정 서랍과 같은 .drawer를 쓰되 뒤를 가리는 막(scrim)은 두지 않아, 읽으면서 방침을 만질 수 있다.
 */
(function () {
  'use strict';
  const S = window.Studio, P = S.planFlow;
  if (!P) return; // ?selftest=1 · ?classic=1 은 예전 화면이라 설명 창이 없다
  const { esc, icon, KBO } = S;
  const num = (v, d) => Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const G = P.GOALS;
  // 시험 실행에서 본 수치(2027 편성 조건, 60초씩 한 번) — 예시일 뿐이며 다시 실행하면 달라질 수 있다. 순서 · 허용 → 횟수 차 / 거리 차 / 점수 차 / 전체
  const TRIALS = [
    { how: '공평 우선 · 허용 4회 · 600km · 3점(기본)', moves: 4, km: 564, hol: 3, total: 58352 },
    { how: '공평 우선 · 허용을 모두 0', moves: 0, km: 500, hol: 7, total: 69344 },
    { how: '이동 거리 균형을 1순위 · 거리 허용 0', moves: 8, km: 109, hol: 9, total: 66556 },
    { how: '주말·공휴일을 1순위 · 점수 허용 0', moves: 4, km: 539, hol: 1, total: 60461 }
  ];

  /** 작은 그림: 구단 10개의 값을 눈금 위에 세로 막대로, 그 위에 「차이」(가장 많은 − 가장 적은)와 「허용」 길이를 나란히 */
  function fig(values, gap, unit, label) {
    const W = 440, H = 96, L = 16, R = 16;
    const lo = Math.min(...values) - 1, hi = Math.max(Math.max(...values), Math.min(...values) + gap) + 1;
    const x = (v) => L + (v - lo) / (hi - lo) * (W - L - R);
    const mn = Math.min(...values), mx = Math.max(...values), over = mx - mn > gap;
    const ticks = [];
    for (let v = Math.ceil(lo); v <= hi; v++) ticks.push('<text x="' + x(v).toFixed(1) + '" y="88" text-anchor="middle" font-size="10" fill="#8A93A3">' + v + '</text>');
    const bars = values.map((v) => '<rect x="' + (x(v) - 2.5).toFixed(1) + '" y="56" width="5" height="16" rx="1.5" fill="#1F5FD6" opacity=".85"/>').join('');
    const dim = (y, a, b, color, text) => '<line x1="' + x(a).toFixed(1) + '" y1="' + y + '" x2="' + x(b).toFixed(1) + '" y2="' + y + '" stroke="' + color + '" stroke-width="2"/>' +
      '<line x1="' + x(a).toFixed(1) + '" y1="' + (y - 5) + '" x2="' + x(a).toFixed(1) + '" y2="' + (y + 5) + '" stroke="' + color + '" stroke-width="2"/>' +
      '<line x1="' + x(b).toFixed(1) + '" y1="' + (y - 5) + '" x2="' + x(b).toFixed(1) + '" y2="' + (y + 5) + '" stroke="' + color + '" stroke-width="2"/>' +
      '<text x="' + ((x(a) + x(b)) / 2).toFixed(1) + '" y="' + (y - 7) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + color + '">' + text + '</text>';
    return '<figure class="xh-fig"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" aria-label="' + esc(label) + '">' +
      '<line x1="' + L + '" y1="74" x2="' + (W - R) + '" y2="74" stroke="#D5DAE3" stroke-width="1"/>' + ticks.join('') + bars +
      dim(18, mn, mx, over ? '#C0392B' : '#13703F', '차이 ' + (mx - mn) + unit + (over ? ' · ' + (mx - mn - gap) + unit + ' 넘음' : ' · 안')) +
      dim(44, mn, mn + gap, '#0B2A5B', '허용 ' + gap + unit) +
      '</svg><figcaption>' + esc(label) + ' — 파란 막대 하나가 구단 하나</figcaption></figure>';
  }

  function body() {
    const ob = P.objective(), f = P.tolFacts(), D = P.DEFAULT_OBJECTIVE;
    const first = G[ob.order[0]].name, second = G[ob.order[1]].name;
    const shared = (KBO.Preset2027 && KBO.Preset2027.SHARED_STADIUM && KBO.Preset2027.SHARED_STADIUM.name) || '같은 구장';
    // 두 그림 모두 가상 예(실제 결과가 아니다). 허용 수준만 지금 정한 값
    const gap = ob.moveGap;
    const inside = [30, 31, 31, 31, 31, 33, 33, 33, 30 + Math.min(gap, 6), 30 + Math.min(gap, 6)].sort((x, y) => x - y);
    const over = inside.slice(0, 9).concat([30 + Math.min(gap, 6) + 2]);
    const row = (t) => '<tr><td>' + esc(t.how) + '</td><td><b>' + num(t.moves) + '</b>회</td><td><b>' + num(t.km) + '</b>km</td><td><b>' + num(t.hol) + '</b>점</td><td><b>' + num(t.total) + '</b>km</td></tr>';
    return '<div class="xh">' +
      '<section><h3>왜 운영자가 정하나</h3><p>네 목표를 모두 최고로 만들 수는 없습니다. 이동 횟수나 거리를 구단마다 비슷하게 맞추면 리그 전체 이동 거리가 늘 수 있고, 주말·공휴일 홈을 먼저 고르게 나누면 이동 횟수·거리 차이가 벌어질 수 있습니다. 하나를 더 얻으려면 다른 것을 내줘야 합니다.<br>' +
      '엔진은 <b>한 목표를 더 좋게 하려면 다른 목표를 내줘야 하는 지점</b>, 곧 <b>더 좋아질 곳이 없는 균형점</b>을 찾습니다. 그런 균형점은 하나가 아니라 여럿이고, 그 가운데 <b>어디에 설지</b>는 엔진이 정하지 못합니다. 어느 목표를 먼저 지키고 목표마다 어디까지 봐줄지 정하는 일, 특정 목표에 무조건 매달리지 않고 수준을 알맞게 두는 일이 운영자의 역할이고 운영의 묘입니다.</p></section>' +

      '<section><h3>목표 네 개는 두 종류</h3><p>앞의 셋은 <b>구단 사이 공평함</b>입니다. 구단마다 값을 세고, <b>가장 많은 구단과 가장 적은 구단의 차이</b>가 작을수록 좋습니다. 허용 수준이 있습니다.<br>' +
      '마지막 <b>전체 이동 거리</b>는 <b>리그 전체의 합</b>입니다. 누가 많고 적은지는 보지 않고, 10구단이 움직인 거리를 모두 더해 짧을수록 좋습니다. 허용 수준이 없습니다.</p>' +
      '<h4>이동 횟수 균형</h4><p class="xh-how">다른 구장으로 옮겨 간 횟수</p><p>구단마다 연전(3연전·2연전)을 날짜순으로 늘어놓고, 앞 연전과 <b>다른 구장</b>에서 다음 연전을 하면 1회로 셉니다. 같은 구장에서 이어지면 0회입니다(예: LG 홈 뒤에 두산 원정 — 둘 다 ' + esc(shared) + '). 홈·원정은 가리지 않고 시즌 합을 냅니다.<br>차이 = 가장 많이 옮긴 구단 − 가장 적게 옮긴 구단.</p>' +
      '<h4>이동 거리 균형</h4><p class="xh-how">옮겨 간 거리의 합(km)</p><p>같은 순서로, 앞 연전 구장에서 다음 연전 구장까지의 거리를 모두 더합니다. 횟수가 같아도 먼 곳을 자주 오가면 거리는 커집니다. 구장 위치가 달라 다른 구장까지의 평균 거리부터 다릅니다(' + esc(f.near.name) + ' ' + num(f.near.km) + 'km · ' + esc(f.far.name) + ' ' + num(f.far.km) + 'km).<br>차이 = 가장 긴 구단 − 가장 짧은 구단(km).</p>' +
      '<h4>주말·공휴일 홈 균형</h4><p class="xh-how">경기 수가 아니라 점수</p><p>홈 연전에 든 날마다 점수를 매겨 더합니다. <b>토·일 1점, 공휴일 2점, 어린이날 3점</b>, 평일 0점(공휴일이 주말과 겹치면 큰 쪽 하나만). 금·토·일 홈 3연전이면 2점, 어린이날이 든 홈 연전이면 그날만 3점입니다. 원정은 0점입니다.<br>차이 = 점수가 가장 높은 구단 − 가장 낮은 구단(점).' +
      (f.even ? '' : ' 이 달력의 점수는 모두 ' + num(f.holTotal) + '점이라 ' + f.n + '구단이면 ' + num(f.holEach, 1) + '점씩입니다. 똑같이 나눌 수 없어 차이는 적어도 1점 남습니다.') + '</p>' +
      '<h4>전체 이동 거리</h4><p class="xh-how">10구단 이동 거리를 모두 더한 값(km)</p><p>구단 사이 차이가 아니라 리그 전체 합입니다. 짧을수록 좋고, 허용 수준은 없습니다. 이 목표를 1순위에 두면 전체가 1km라도 짧은 쪽을 고르므로, 세 균형은 그다음에야 봅니다.</p></section>' +

      '<section class="xh-tol"><h3>허용 수준</h3><p class="xh-how">「이만큼 차이는 괜찮다」고 목표마다 정하는 값 · 지금 ' + num(ob.moveGap) + '회 · ' + num(ob.distanceGapKm) + 'km · ' + num(ob.holidayGap) + '점</p>' +
      '<h4>무엇을 재나</h4><p>세 균형마다 <b>가장 많은 구단 − 가장 적은 구단</b>을 잽니다. 평균과의 거리가 아니라 양 끝 두 구단의 차이입니다. 이 차이가 허용 수준 이하이면 <span class="pf-tag ok">안</span>, 크면 <span class="pf-tag over">넘음</span>입니다.</p>' +
      fig(inside, gap, '회', '가상 예: 구단 10개의 이동 횟수가 ' + Math.min(...inside) + '~' + Math.max(...inside) + '회 · 허용 ' + num(gap) + '회') +
      '<h4>넘으면 어떻게 되나</h4><p>반드시 지키는 규칙이 아닙니다. 엔진은 <b>넘은 만큼을 벌점</b>으로 보고 줄이려 노력합니다. 벌점은 넘은 폭의 제곱이라 2회 넘으면 4, 4회 넘으면 16 — 조금 넘은 것은 가볍게, 많이 넘은 것은 훨씬 무겁게 봅니다(아래 그림은 가상 예). 양 끝 두 구단만이 아니라 <b>모든 구단 둘씩의 차이</b>를 보므로, 한 구단만 허용 쪽으로 조금 다가가도 결과가 나아집니다.</p>' +
      fig(over, gap, '회', '가상 예: 한 구단만 ' + Math.max(...over) + '회 · 허용 ' + num(gap) + '회') +
      '<h4>우선순위와 어떻게 맞물리나</h4><p>1순위(지금 <b>' + esc(first) + '</b>)가 <b>허용 수준 안에 들어오면 만족</b>으로 보고, 그때부터 2순위(<b>' + esc(second) + '</b>)로 결과를 가립니다. 1순위를 넘은 두 결과는 2순위가 아무리 좋아도 1순위를 덜 넘은 쪽을 고릅니다. 즉 허용 수준은 「이 목표는 여기까지만 맞추고 다음 목표로 넘어가라」는 선입니다.</p>' +
      '<h4>좁히면 · 넓히면</h4><p><b>좁히면</b> 그 목표를 맞추느라 다음 순위를 내줍니다. 너무 좁으면 끝까지 못 들어와 「넘음」인 채로 끝날 수 있습니다. 0으로 두면 모든 구단이 똑같아야 합니다. 이동 횟수는 0으로 맞출 수 있지만 그 대신 전체 이동 거리가 늘고 주말·공휴일 차이가 벌어지며, 주말·공휴일 점수는 ' + (f.even ? '연전 단위로 움직여 맞추기 어렵습니다' : '합이 나누어떨어지지 않아 0이 될 수 없습니다') + '.<br>' +
      '<b>넓히면</b> 그 목표는 쉽게 만족되어 엔진이 다음 순위에 힘을 씁니다. 대신 그 목표의 차이는 허용 수준 근처까지 벌어질 수 있고, 기본값의 세 배를 넘기면 사실상 보지 않는 것과 같습니다.<br>' +
      '처음에는 기본값(이동 횟수 ' + num(D.moveGap) + '회 · 이동 거리 ' + num(D.distanceGapKm) + 'km · 주말·공휴일 ' + num(D.holidayGap) + '점)으로 실행해 보고, 결과 화면의 「방침과 견주기」에서 어느 목표가 「넘음」인지 본 뒤에 조금씩 옮기는 것이 쉽습니다.</p></section>' +

      '<section><h3>시험 실행에서 본 수치</h3><p class="xh-how">예시입니다 — 2027 편성 조건으로 방침마다 60초씩 한 번 돌려 본 값이라, 같은 방침으로 다시 실행해도 숫자는 달라질 수 있습니다</p>' +
      '<table class="xh-t"><thead><tr><th>방침</th><th>이동 횟수 차이</th><th>이동 거리 차이</th><th>주말·공휴일 차이</th><th>전체 이동 거리</th></tr></thead><tbody>' + TRIALS.map(row).join('') + '</tbody></table>' +
      '<p style="margin-top:8px">허용을 모두 0으로 두자 이동 횟수 차이는 0회가 됐지만, 그 대신 전체 이동 거리가 약 ' + num(Math.round((TRIALS[1].total - TRIALS[0].total) / 1000) * 1000) + 'km 늘고 주말·공휴일 차이가 ' + num(TRIALS[0].hol) + '점에서 ' + num(TRIALS[1].hol) + '점으로 벌어졌습니다. 거리 균형을 1순위에 두고 허용을 0으로 하자 거리 차이는 ' + num(TRIALS[2].km) + 'km까지 줄었지만 이동 횟수 차이는 ' + num(TRIALS[2].moves) + '회로 늘었습니다. <b>하나를 얻으면 다른 것을 내준다</b>는 것이 이 숫자들에 그대로 보입니다. 어디에 설지는 운영자가 정합니다.</p></section>' +
      '</div>';
  }

  S.drawers.explain = function () {
    return '<aside class="drawer explain" role="dialog" aria-label="운영 방침 설명하기"><div class="pane-head"><span class="pane-title">' + icon('info') + ' 운영 방침 설명하기</span><span class="pane-desc">왜 운영자가 정하나 · 목표 네 개 · 허용 수준 · 시험 실행 수치</span><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-drawer" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div class="pane-body" data-sk="explain">' + body() + '</div></aside>';
  };
  S.drawers.explain.noScrim = true;
})();
