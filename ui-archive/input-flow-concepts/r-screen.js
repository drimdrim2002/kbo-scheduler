/*
 * 추천안 R — 입력은 모두 한 화면(시즌 달력). r-calendar / r-tutorial / r-excel이 같이 쓴다.
 * 왼쪽: 구단 정보(접음) · 시즌 기간 · 공휴일(가중치) · 연전 규칙 / 가운데: 달력(끌어서 묶음, 눌러서 홈 구장) / 오른쪽: 고른 날 · 확인 · 엑셀
 */
(function () {
  'use strict';
  const C = window.Concept;
  const S = Object.assign({}, C.S2025, { restExceptions: [], blackouts: [] }); // 묶음이 곧 경기일: 휴식기·휴식일 경기는 따로 적지 않는다
  const base = C.slots(C.S2025); // 2025 실제 묶음 45개(올스타 휴식기는 묶음이 없는 것으로 표현)
  const W = (h) => (/어린이날/.test(h.name) ? 3 : 2);
  const sel = (o) => (o.sel ? base.findIndex((s) => C.D.iso(s.start) === o.sel) : -1);

  window.renderR = function (o) {
    o = o || {};
    C.chrome({ at: 1, noBand: true, prev: null, next: '검토·실행', mode: '한 화면 입력', sum: '시즌 달력 한 화면 · 경기일 135 / 135', pill: 'ok', pillText: '편성 가능', steps: [{ name: '시즌 달력' }] });
    const hol = S.holidays.filter((h) => h.date <= S.initialEnd);
    const left =
      '<aside class="card" style="width:330px;gap:8px;padding:10px 12px">' +
      '<div class="box" style="padding:8px 12px"><h4 style="margin:0">구단 정보 <span class="r"><span class="stat ok">확인함</span><a class="xs">펼쳐서 고치기 ▾</a></span></h4><div class="xs muted" style="margin-top:2px">10구단 · 구장 위치 · 구장 간 거리 90개(도로 45쌍)</div></div>' +
      '<div class="box blue"><h4>시즌 기간 <span class="r xs">적기</span></h4>' +
      fld('개막일', '3/22(토)') + fld('1차 편성 종료일', '8/31(일)') + fld('시즌 종료일', '10/31(금)') +
      '<div class="line"><span class="k">휴식 요일</span><span class="v wd" style="gap:2px">' + ['일', '월', '화', '수', '목', '금', '토'].map((d) => '<span style="width:22px;height:22px;font-size:11px"' + (d === '월' ? ' class="on"' : '') + '>' + d + '</span>').join('') + '</span></div>' +
      '<div class="xs muted" style="margin-top:4px">1차 편성 15경기 × 9상대 = <b>경기일 135일</b>이 필요합니다. 9월~10월은 재편성 기간입니다.</div></div>' +
      '<div class="box blue"><h4>공휴일 <span class="r"><span class="btn sm">⚡ 법정 공휴일 채우기</span></span></h4>' +
      '<table class="t" style="font-size:12px"><tr><th>날짜</th><th>이름</th><th class="num">가중치</th></tr>' +
      hol.map((h) => '<tr><td class="mono">' + C.D.short(C.D.dn(h.date)) + '</td><td>' + h.name + '</td><td class="num"><span style="border:1px solid var(--line-2);border-radius:3px;padding:0 6px;background:#fff">' + W(h) + '</span></td></tr>').join('') +
      '</table><div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span class="btn sm">+ 줄 추가</span><span class="xs muted">가중치 = 홈 경기 공정성에서 이 날의 가치(주말 하루 1)</span></div>' +
      '<div class="xs" style="margin-top:4px"><span class="stat warn" style="font-size:10px">기본값(공휴일 2 · 어린이날 3)은 KBO 확인 필요</span></div></div>' +
      '<div class="box"><h4>연전 규칙</h4><div class="line"><span class="k">기본</span><span class="v"><b>3연전</b> · 주중 화~목 / 주말 금~일</span></div><div class="line"><span class="k">남는 날</span><span class="v">2일 → 2연전 · 4일 → 4연전</span></div>' +
      '<div style="margin-top:8px"><span class="btn pri big">⚡ 규칙대로 채우기</span></div><div class="xs muted" style="margin-top:6px">채운 뒤 달력에서 끌어서 고칩니다. <span class="stat warn" style="font-size:10px">규칙 문구는 첨부 파일로 확정</span></div></div>' +
      '</aside>';
    const si = sel(o);
    const main =
      '<main class="main" style="margin:12px 0 12px 12px;border-radius:6px 0 0 6px;border-right:0">' +
      '<div class="head" style="padding:8px 14px"><b style="white-space:nowrap">시즌 달력</b><span class="desc" style="white-space:nowrap">3월~8월 · 1차 편성 기간</span>' +
      '<span style="margin-left:10px;display:inline-flex;align-items:center;gap:8px;border:1px solid var(--ok-line);background:var(--ok-bg);border-radius:6px;padding:3px 12px;white-space:nowrap"><span style="font-size:15px;font-weight:700;color:var(--ok)">경기일 135 / 135일</span><span class="stat ok">맞음</span></span>' +
      '<span class="small muted" style="white-space:nowrap">2연전 1 · 3연전 43 · 4연전 1 · 묶음 45개</span></div>' +
      '<div class="body2" style="position:relative;padding:8px 14px 12px" id="rcal">' +
      '<div style="display:flex;justify-content:flex-end;margin-bottom:6px">' + C.legend([['game', '경기일'], ['ss', '묶음 시작'], ['rest', '경기 없음'], ['hol', '공휴일'], ['ev', '홈 구장 지정'], ['sel', '고른 묶음']]) + '</div>' +
      C.strip({ S, from: 3, to: 8, slots: base, big: true, sel: si, onCell: o.onCell }) +
      '<div class="small muted" style="margin-top:10px;display:flex;gap:18px"><span>⟷ 날짜를 <b>끌면</b> 연전 묶음(2·3·4연전)</span><span>▣ 묶음을 <b>누르면</b> 연전 수 바꾸기 · 지우기</span><span>○ 날을 <b>누르면</b> 홈 구장 지정</span><span>7/11~16은 묶음이 없어 경기 없음(올스타)</span></div>' +
      (o.pop || '') +
      '</div></main>';
    const right =
      '<aside class="card" style="width:280px;border-left:1px solid var(--line);border-right:0;gap:10px">' +
      '<div class="box blue"><h4>고른 날 · 5/5(월) <span class="r xs muted">어린이날·부처님오신날</span></h4>' +
      '<div class="line"><span class="k">연전</span><span class="v">5/5(월)~5/7(수) 3연전</span></div><div class="line"><span class="k">공휴일</span><span class="v">가중치 3 <span class="xs muted">(왼쪽 표)</span></span></div>' +
      '<div style="margin-top:8px"><span class="tog"><i class="on"></i><b>홈 구장 지정</b></span><div class="xs muted" style="margin:2px 0 6px">이 날 홈 경기를 해야 하는 구단 5곳을 고릅니다. 상대는 자동 편성이 정합니다.</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px">' + ['SSG', '두산', 'LG', 'KT', '키움', '한화', '삼성', 'KIA', 'NC', '롯데'].map((t) => '<span class="btn sm"' + (['두산', '키움', '한화', 'NC', '롯데'].includes(t) ? ' style="background:var(--navy);color:#fff;border-color:var(--navy)"' : '') + '>' + t + '</span>').join('') + '</div>' +
      '<div class="xs muted" style="margin-top:6px">잠실은 두산·LG 중 하나만. 개막전 3/22도 같은 방법으로.</div></div></div>' +
      '<div class="box ok"><h4>확인</h4><div class="line"><span class="k">경기일 합</span><span class="v">135 / 135 <span class="stat ok">맞음</span></span></div><div class="line"><span class="k">홈 구장 지정</span><span class="v">3/22 개막전 5곳 · 5/5 어린이날 5곳</span></div><div class="line"><span class="k">시리즈</span><span class="v">규칙대로 225개 <span class="stat ok">맞음</span></span></div><div class="xs muted" style="margin-top:4px">맞대결 16경기 = 1차 편성 15(홈 9·원정 6) + 재편성 1. 날짜는 ② 자동 편성이 정합니다. <a>자세히</a></div></div>' +
      '<div class="box"><h4>엑셀로 한꺼번에</h4><div style="display:flex;flex-direction:column;gap:6px"><span class="btn sm">⬇ 지금 데이터로 서식 내려받기</span><span class="btn sm">⬆ 채운 파일 올리기</span></div><div class="xs muted" style="margin-top:6px">시트 4개: 구단 정보 · 시즌 기간과 공휴일 · 연전 기간 · 홈 구장 지정</div></div>' +
      '<div style="margin-top:auto"><span class="btn sm ghost">▶ 따라 하기 다시 보기</span></div>' +
      '</aside>';
    document.querySelector('.body').innerHTML = left + main + right;
  };
  function fld(k, v) { return '<div class="line"><span class="k">' + k + '</span><span class="v"><span style="display:inline-block;border:1px solid var(--line-2);border-radius:4px;padding:1px 8px;background:#fff;min-width:80px">' + v + '</span></span></div>'; }
})();
