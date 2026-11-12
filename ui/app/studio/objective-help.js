/*
 * 편성 스튜디오 — 「운영 방침 설명하기」 설명 창 (운영 방침 화면 머리글 오른쪽 · 실행 중 화면 오른쪽 위 링크 → 오른쪽 서랍)
 *  말은 운영 방침 화면과 같다(사용자 결정 2026-11-12): 형평성 = 선수의 이동 부담 + 구단의 휴일 관중, 풀어 쓰면 「구단마다 고르게」.
 *  ① 왜 운영자가 정하나(둘을 함께 가장 좋게 만들 수 없음 → 더 좋아질 곳이 없는 균형점 가운데 어디에 설지 고르는 일)
 *  ② 무엇을 재나(선수 아래 이동 횟수 · 이동 거리 · 모두의 이동 줄이기, 구단 아래 휴일 홈경기) ③ 허용 수준의 뜻 · 고를 수 있는 범위 · 움직였을 때의 변화 ④ 시험 실행에서 본 수치(예시)
 *  숫자는 지금 정한 허용 수준과 입력에서 센 값(구장 사이 평균 거리·점수 합)만 실제 값이고, 그림의 구단 값은 가상 예다. 2025 숫자(이 엔진·KBO 실제)는 쓰지 않는다(사용자 결정 2026-11-02).
 *  세는 법은 엔진(ScoreFormulas)·ui/core/score.js 그대로다. 허용 수준 입력 구역(plan-flow.js levelBox)은 여기서 건드리지 않는다.
 *  설정 서랍과 같은 .drawer를 쓰되 뒤를 가리는 막(scrim)은 두지 않아, 읽으면서 방침을 만질 수 있다.
 */
(function () {
  'use strict';
  const S = window.Studio, P = S.planFlow;
  if (!P) return; // ?selftest=1 · ?classic=1 은 예전 화면이라 설명 창이 없다
  const { esc, icon, KBO } = S;
  const num = (v, d) => Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  // 시험 실행에서 본 수치(2027 편성 조건, 60초씩 한 번) — 예시일 뿐이며 다시 실행하면 달라질 수 있다. 순서 · 허용 → 횟수 차 / 거리 차 / 점수 차 / 전체
  // 숫자는 그때 잰 값 그대로다(새로 재지 않았다). 허용 0과 「이동 거리를 맨 먼저」는 지금 화면에서 고를 수 없는 값·순서라, 표 아래에 그 뜻을 한 줄로 적는다
  const TRIALS = [
    { how: '이동 부담 먼저 · 허용 4회 · 600km · 3점(기본)', moves: 4, km: 564, hol: 3, total: 58352 },
    { how: '이동 부담 먼저 · 허용을 모두 0', moves: 0, km: 500, hol: 7, total: 69344 },
    { how: '이동 거리를 맨 먼저 · 거리 허용 0', moves: 8, km: 109, hol: 9, total: 66556 },
    { how: '휴일 관중 먼저 · 점수 허용 0', moves: 4, km: 539, hol: 1, total: 60461 }
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
    const ob = P.objective(), f = P.tolFacts(), D = P.DEFAULT_OBJECTIVE, L = P.LEVELS, R = P.LEVEL_KEYS.map((k) => P.levelRange(k));
    const clubFirst = ob.order[0] === 'holiday', first = clubFirst ? '구단의 휴일 관중' : '선수의 이동 부담', second = clubFirst ? '선수의 이동 부담' : '구단의 휴일 관중';
    const shared = (KBO.Preset2027 && KBO.Preset2027.SHARED_STADIUM && KBO.Preset2027.SHARED_STADIUM.name) || '같은 구장';
    const three = (v) => L.moveGap.name + ' ' + num(v[0]) + '회 · ' + L.distanceGapKm.name + ' ' + num(v[1]) + 'km · ' + L.holidayGap.name + ' ' + num(v[2]) + '점';
    // 두 그림 모두 가상 예(실제 결과가 아니다). 허용 수준만 지금 정한 값
    const gap = ob.moveGap;
    const inside = [30, 31, 31, 31, 31, 33, 33, 33, 30 + Math.min(gap, 6), 30 + Math.min(gap, 6)].sort((x, y) => x - y);
    const over = inside.slice(0, 9).concat([30 + Math.min(gap, 6) + 2]);
    const row = (t) => '<tr><td>' + esc(t.how) + '</td><td><b>' + num(t.moves) + '</b>회</td><td><b>' + num(t.km) + '</b>km</td><td><b>' + num(t.hol) + '</b>점</td><td><b>' + num(t.total) + '</b>km</td></tr>';
    return '<div class="xh">' +
      '<section><h3>왜 운영자가 정하나</h3><p>운영 방침은 <b>일정의 형평성</b>을 기준으로 정합니다. 형평성은 두 가지로 봅니다. <b>선수의 이동 부담</b>과 <b>구단의 휴일 관중</b>입니다. 둘 다 구단마다 고르게 하려 하지만 함께 가장 좋게 만들 수는 없습니다. 이동 횟수나 거리를 구단마다 비슷하게 맞추면 휴일 홈경기가 고르지 않을 수 있고, 휴일 홈경기를 먼저 고르게 나누면 이동 횟수·거리의 차이가 벌어질 수 있습니다.<br>' +
      '자동 편성은 <b>한쪽을 더 고르게 하려면 다른 쪽을 내줘야 하는 지점</b>, 곧 <b>더 좋아질 곳이 없는 균형점</b>을 찾습니다. 그런 균형점은 하나가 아니라 여럿이고, 그 가운데 <b>어디에 설지</b>는 자동 편성이 정하지 못합니다. 어느 쪽을 먼저 맞추고 어디까지 괜찮다고 볼지 정하는 일, 한쪽에 무조건 매달리지 않고 수준을 알맞게 두는 일이 운영자의 역할입니다.</p></section>' +

      '<section><h3>무엇을 재나</h3><p>선수의 이동 부담은 <b>이동 횟수</b>와 <b>이동 거리</b>로, 구단의 휴일 관중은 <b>휴일 홈경기</b>로 잽니다. 셋 모두 구단마다 값을 세고, <b>가장 많은 구단과 가장 적은 구단의 차이</b>가 작을수록 좋습니다. 이 셋에는 허용 수준이 있습니다.<br>' +
      '선수 쪽에는 하나가 더 있습니다. <b>모두의 이동 줄이기</b>는 구단 사이 차이가 아니라 <b>10구단 이동 거리의 합</b>입니다. 허용 수준이 없고, 늘 마지막에 봅니다.</p>' +
      '<h4>선수 · 이동 횟수</h4><p class="xh-how">다른 구장으로 옮겨 간 횟수</p><p>구단마다 연전(3연전·2연전)을 날짜순으로 늘어놓고, 앞 연전과 <b>다른 구장</b>에서 다음 연전을 하면 1회로 셉니다. 같은 구장에서 이어지면 0회입니다(예: LG 홈 뒤에 두산 원정 — 둘 다 ' + esc(shared) + '). 홈·원정은 가리지 않고 시즌 합을 냅니다.<br>차이 = 가장 많이 옮긴 구단 − 가장 적게 옮긴 구단.</p>' +
      '<h4>선수 · 이동 거리</h4><p class="xh-how">옮겨 간 거리를 더한 값(km)</p><p>같은 순서로, 앞 연전 구장에서 다음 연전 구장까지의 거리를 모두 더합니다. 횟수가 같아도 먼 곳을 자주 오가면 거리는 커집니다. 구장 위치가 달라 다른 구장까지의 평균 거리부터 다릅니다(' + esc(f.near.name) + ' ' + num(f.near.km) + 'km · ' + esc(f.far.name) + ' ' + num(f.far.km) + 'km).<br>차이 = 가장 긴 구단 − 가장 짧은 구단(km).</p>' +
      '<h4>선수 · 모두의 이동 줄이기</h4><p class="xh-how">10구단 이동 거리를 모두 더한 값(km)</p><p>누가 많고 적은지는 보지 않습니다. 구단 사이 차이가 아니라 전체를 줄이는 것이라 짧을수록 좋고, 허용 수준은 없습니다. 늘 마지막이라, 앞의 셋이 같은 결과 사이에서만 전체가 짧은 쪽을 고릅니다. 구단 사이 차이를 좁힐수록 이 합은 늘 수 있습니다.</p>' +
      '<h4>구단 · 휴일 홈경기</h4><p class="xh-how">경기 수가 아니라 점수</p><p>홈 연전에 든 날마다 점수를 매겨 더합니다. 기본은 <b>토·일 1점, 공휴일 2점, 어린이날 3점</b>, 평일 0점입니다(공휴일이 주말과 겹치면 큰 쪽 하나만). 금·토·일 홈 3연전이면 2점, 어린이날이 든 홈 연전이면 그날만 3점입니다. 원정은 0점입니다.<br>차이 = 점수가 가장 높은 구단 − 가장 낮은 구단(점).' +
      (f.even ? '' : ' 이 달력의 점수는 모두 ' + num(f.holTotal) + '점이라 ' + f.n + '구단이면 ' + num(f.holEach, 1) + '점씩입니다. 똑같이 나눌 수 없어 차이는 적어도 1점 남습니다.') + '</p></section>' +

      '<section class="xh-tol"><h3>허용 수준</h3><p class="xh-how">「구단 사이 차이를 여기까지는 괜찮다」고 정하는 값 · 지금 ' + three([ob.moveGap, ob.distanceGapKm, ob.holidayGap]) + '</p>' +
      '<h4>무엇을 재나</h4><p>셋 모두 <b>가장 많은 구단 − 가장 적은 구단</b>을 잽니다. 평균과의 거리가 아니라 양 끝 두 구단의 차이입니다. 이 차이가 허용 수준 이하이면 <span class="pf-tag ok">안</span>, 크면 <span class="pf-tag over">넘음</span>입니다.</p>' +
      fig(inside, gap, '회', '가상 예: 구단 10개의 이동 횟수가 ' + Math.min(...inside) + '~' + Math.max(...inside) + '회 · 허용 ' + num(gap) + '회') +
      '<h4>넘으면 어떻게 되나</h4><p>반드시 지키는 규칙이 아닙니다. 자동 편성은 <b>넘은 만큼을 벌점</b>으로 보고 줄이려 노력합니다. 조금 넘은 것은 가볍게, 많이 넘은 것은 훨씬 무겁게 봅니다(아래 그림은 가상 예). 양 끝 두 구단만이 아니라 <b>모든 구단 둘씩의 차이</b>를 보므로, 한 구단만 허용 쪽으로 조금 다가가도 결과가 나아집니다.</p>' +
      fig(over, gap, '회', '가상 예: 한 구단만 ' + Math.max(...over) + '회 · 허용 ' + num(gap) + '회') +
      '<h4>먼저 맞출 쪽과 어떻게 맞물리나</h4><p>먼저인 쪽(지금 <b>' + esc(first) + '</b>)이 <b>허용 수준 안에 들어오면</b> 그다음 쪽(<b>' + esc(second) + '</b>)을 맞춥니다. 둘 다 들어오면 모두의 이동을 줄입니다. 먼저인 쪽이 허용 수준을 넘은 두 결과는, 그다음 쪽이 아무리 좋아도 먼저인 쪽을 덜 넘은 결과를 고릅니다. 즉 허용 수준은 「이쪽은 여기까지만 맞추고 다음으로 넘어가라」는 선입니다. 반드시 지킬 규칙은 어느 순서든 지킵니다.</p>' +
      '<h4>고를 수 있는 범위</h4><p>' + R.map((m) => m.name + ' ' + num(m.min) + '~' + num(m.max) + m.unit).join(' · ') + '입니다. 숫자가 작을수록 엄격하게 맞추고, 클수록 느슨하게 봅니다. 차이를 아예 없애는 값(0)은 고를 수 없습니다. 그렇게 두면 그 한 가지에만 매달려 다른 쪽을 크게 내주기 때문입니다' + (f.even ? '' : '(휴일 홈경기는 점수 합이 나누어떨어지지 않아 0이 될 수도 없습니다)') + '. 휴일 홈경기의 범위는 1단계에서 휴일 점수를 키우면 함께 커집니다.</p>' +
      '<h4>엄격하게 · 느슨하게</h4><p><b>엄격하게</b>(숫자를 작게) 두면 그 차이를 좁히느라 다른 쪽을 내줍니다. 너무 엄격하면 끝까지 못 들어와 「넘음」인 채로 끝날 수 있습니다.<br>' +
      '<b>느슨하게</b>(숫자를 크게) 두면 그쪽은 쉽게 허용 수준 안에 들어와 자동 편성이 다음 쪽에 힘을 씁니다. 대신 그 차이는 허용 수준 근처까지 벌어질 수 있고, 범위의 느슨한 끝에 가까울수록 그쪽은 덜 보게 됩니다.<br>' +
      '처음에는 기본값(' + three([D.moveGap, D.distanceGapKm, D.holidayGap]) + ')으로 실행해 보고, 결과 화면의 「방침과 견주기」에서 어느 것이 「넘음」인지 본 뒤에 조금씩 옮기는 것이 쉽습니다.</p></section>' +

      '<section><h3>시험 실행에서 본 수치</h3><p class="xh-how">예시입니다 — 2027 편성 조건으로 방침마다 60초씩 한 번 돌려 본 값이라, 같은 방침으로 다시 실행해도 숫자는 달라질 수 있습니다</p>' +
      '<table class="xh-t"><thead><tr><th>방침</th><th>이동 횟수 차이</th><th>이동 거리 차이</th><th>휴일 홈경기 차이</th><th>모두의 이동</th></tr></thead><tbody>' + TRIALS.map(row).join('') + '</tbody></table>' +
      '<p class="xh-how" style="margin-top:6px">허용을 0으로 둔 줄과 「이동 거리를 맨 먼저」 줄은 지금 고를 수 있는 범위보다 더 엄격한 값·다른 순서로 시험한 것입니다. 지금 화면에서는 고를 수 없고, 한쪽을 끝까지 좁히면 다른 쪽이 얼마나 벌어지는지 보여 주는 예로 남겨 둡니다.</p>' +
      '<p style="margin-top:8px">허용을 모두 0으로 두자 이동 횟수 차이는 0회가 됐지만, 그 대신 휴일 홈경기 차이가 ' + num(TRIALS[0].hol) + '점에서 ' + num(TRIALS[1].hol) + '점으로 벌어졌습니다(모두의 이동도 약 ' + num(Math.round((TRIALS[1].total - TRIALS[0].total) / 1000) * 1000) + 'km 늘었습니다). 휴일 관중을 먼저 두고 점수 허용을 0으로 하자 휴일 홈경기 차이는 ' + num(TRIALS[3].hol) + '점까지 줄었고 이동 횟수·거리의 차이는 기본과 비슷했습니다. 이동 거리를 맨 먼저 두고 허용을 0으로 하자 이동 거리 차이는 ' + num(TRIALS[2].km) + 'km까지 줄었지만 이동 횟수 차이는 ' + num(TRIALS[2].moves) + '회, 휴일 홈경기 차이는 ' + num(TRIALS[2].hol) + '점으로 늘었습니다. <b>한쪽을 좁히면 다른 쪽을 내준다</b>는 것이 이 숫자들에 그대로 보입니다. 어디에 설지는 운영자가 정합니다.</p></section>' +
      '</div>';
  }

  S.drawers.explain = function () {
    return '<aside class="drawer explain" role="dialog" aria-label="운영 방침 설명하기"><div class="pane-head"><span class="pane-title">' + icon('info') + ' 운영 방침 설명하기</span><span class="pane-desc">왜 운영자가 정하나 · 무엇을 재나 · 허용 수준 · 시험 실행 수치</span><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-drawer" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div class="pane-body" data-sk="explain">' + body() + '</div></aside>';
  };
  S.drawers.explain.noScrim = true;
})();
