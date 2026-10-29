/*
 * ① 데이터 준비 단계 흐름 시안 — 공통 틀 (정적 시안 전용, 실제 스튜디오 코드와 무관)
 * 사용자 결정(2026-10-29): ① 안은 4단계 — 1 구단 정보 → 2 시즌 기간·연전 묶음(같이, 손이 거의 안 가게) → 3 공휴일·홈 구장(2가 끝난 뒤 같은 달력에서) → 4 확인.
 * 맨 먼저 시즌 연도를 고른다(오늘 기준 2년 뒤까지). 고른 연도는 상단 띠에 크게 늘 보이고 모든 단계에 그대로 쓰인다.
 * 그 해 데이터가 있으면 「어디까지 했는지」 한 장, 없으면 1 구단 정보부터 새로 입력. 데이터는 이 브라우저에 연도별로 저장(DB는 나중에).
 */
(function () {
  'use strict';
  const C = window.Concept, D = C.D;
  const F = window.Flow = {};
  F.STEPS = [{ n: 1, name: '구단 정보' }, { n: 2, name: '시즌 기간·연전 묶음' }, { n: 3, name: '공휴일·홈 구장' }, { n: 4, name: '확인' }];
  /** o: { at(1~4, 0이면 어디까지 한 장), st: { 1:'done'|'cur'|'half'|'todo', … }, sub: { 1:'…' }, prev, next, hint, sum, pill, pillText } */
  F.chrome = function (o) {
    const st = o.st || {};
    const band = F.STEPS.map((s) => {
      const k = st[s.n] || (s.n < o.at ? 'done' : s.n === o.at ? 'cur' : 'todo');
      const mark = k === 'done' ? '✓' : s.n;
      return '<span class="fs ' + k + '"><i>' + mark + '</i><div><b>' + s.n + ' ' + s.name + (s.n === o.at ? '<span class="here">지금 여기</span>' : '') + '</b><small>' + ((o.sub || {})[s.n] || '') + '</small></div></span>';
    }).join('');
    const cur = F.STEPS[o.at - 1];
    document.body.insertAdjacentHTML('afterbegin',
      '<header class="top"><span class="logo">KBO</span><b>일정 편성</b>' + (o.noYear ? '<span class="yr empty">시즌 연도를 고르세요</span>' : '<span class="yr" title="눌러서 다른 시즌으로">' + (o.year || 2025) + ' 시즌 <i>▾</i></span>') + '<span class="sub">편성 스튜디오</span><span class="pill ' + (o.pill || 'todo') + '">' + (o.pillText || '작성 중') + '</span><span class="muted">자동 편성 <b>대기</b></span><span class="r">데이터 ▾ &nbsp;&nbsp; 시즌 운영 &nbsp;&nbsp; 설정</span></header>' +
      '<nav class="stepper"><span class="st cur"><i>1</i><div><b>데이터 준비</b><small>' + (o.sum || (cur ? o.at + ' / 4 ' + cur.name : '어디까지 했는지')) + '</small></div><span class="pill ' + (o.pill || 'todo') + '">' + (o.pillText || '작성 중') + '</span></span><span class="st"><i>2</i><div><b>검토·실행</b><small>데이터 준비를 마치면 점검합니다</small></div></span><span class="st"><i>3</i><div><b>결과·수정</b><small>자동 편성 뒤</small></div></span><span class="st"><i>4</i><div><b>공정성·배포</b><small>자동 편성 뒤</small></div></span></nav>' +
      (o.at ? '<div class="flow"><div class="lead"><b>' + (o.year || 2025) + ' 시즌 · ① 데이터 준비</b><small>' + o.at + ' / 4단계</small></div>' + band + '<div class="tail"><a>☰ 어디까지 했는지</a><a>▦ 모든 표 보기</a></div></div>' : ''));
    document.body.insertAdjacentHTML('beforeend', '<footer class="foot">' + (o.prev ? '<span class="btn">‹ 이전: ' + o.prev + '</span>' : '<span class="btn dis">‹ 이전</span>') +
      '<span class="hint">' + (o.hint || '') + '</span><span class="r"><span class="muted"><kbd>Ctrl</kbd>+<kbd>Z</kbd> 실행 취소</span><span class="btn pri' + (o.nextDis ? ' dis' : '') + '">' + (o.next || '') + ' ›</span></span></footer>');
  };
  /** 따라 하기 카드: { n, of, title, text, x, y, side:'l'|'t'|'b' } */
  F.coach = (c) => '<div class="coach ' + (c.side || 'l') + '" style="left:' + c.x + 'px;top:' + c.y + 'px"><div class="h">따라 하기 ' + c.n + ' / ' + c.of + '<span class="dots">' + Array.from({ length: c.of }, (_, i) => '<i class="' + (i + 1 === c.n ? 'on' : i + 1 < c.n ? 'done' : '') + '"></i>').join('') + '</span><span class="x">✕ 닫기</span></div><h4>' + c.title + '</h4><p>' + c.text + '</p><div class="acts"><span class="btn sm">건너뛰기 ›</span></div></div>';
  F.ring = (x, y, w, h) => '<div class="ring" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px"></div>';

  /**
   * 「규칙대로」 설정(실제 스튜디오의 CalendarGen.ruleSettings와 같은 관행): 휴식 요일(월) 공휴일은 그 날 경기 + 그 주 목 휴식,
   * 올스타 휴식기는 7월 둘째 금요일부터 6일. end가 없으면 경기일 135일이 되는 첫 일요일을 1차 편성 종료일로 고른다(이 시안이 제안하는 자동 채움).
   */
  F.ruleSeason = function (year, start, end) {
    const hols = C.holidaysOf(year);
    const a = D.dn(start);
    const rex = [], black = [];
    for (const h of hols) { const d = D.dn(h.date); if (d >= a && D.wd(d) === 1 && D.mo(d) <= 9) { rex.push(h.date); black.push({ start: D.iso(d + 3), end: D.iso(d + 3), label: '휴식일 경기 뒤 휴식' }); } }
    const j1 = D.dn(year + '-07-01'), fri = j1 + ((5 - D.wd(j1) + 7) % 7) + 7;
    black.push({ start: D.iso(fri), end: D.iso(fri + 5), label: '올스타 휴식기' });
    const S = { seasonStart: start, initialEnd: end || '', seasonEnd: year + '-10-31', restWeekdays: [1], restExceptions: rex, blackouts: black, holidays: hols, allStar: D.iso(fri) };
    if (!end) {
      let n = 0;
      for (let d = a; d < a + 220; d++) { if (C.isGameDay(S, d)) n++; if (n >= 135 && D.wd(d) === 0) { S.initialEnd = D.iso(d); S.games = n; break; } }
    }
    return S;
  };
  F.sum = (slots) => slots.reduce((s, x) => s + x.len, 0);
})();
