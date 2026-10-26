/*
 * 추천안 R — 입력은 모두 한 화면(시즌 달력). r-calendar / r-tutorial / r-excel / r-2027이 같이 쓴다.
 * 왼쪽: 구단 정보(접음) · 시즌 기간(연도 고르기) · 공휴일(가중치) · 연전 규칙 / 가운데: 달력(끌어서 묶음, 눌러서 홈 구장) / 오른쪽: 고른 날 · 확인 · 엑셀
 * 연전 규칙은 「2025 KBO 정규시즌 경기 일정」 공식 표(PDF)에서 읽은 관행이다.
 */
(function () {
  'use strict';
  const C = window.Concept;
  const base = C.slots(C.S2025); // 2025 실제 묶음 45개(올스타 휴식기는 묶음이 없는 것으로 표현)
  const W = (h) => (/어린이날/.test(h.name) ? 3 : 2);
  const WDN = ['일', '월', '화', '수', '목', '금', '토'];

  window.renderR = function (o) {
    o = o || {};
    const blank = !!o.blank, year = o.year || 2025;
    const S = o.S || Object.assign({}, C.S2025, { restExceptions: [], blackouts: [] }); // 묶음이 곧 경기일: 휴식기·휴식일 경기는 따로 적지 않는다
    const slots = blank ? [] : base;
    const have = slots.reduce((s, x) => s + x.len, 0), hist = C.hist(slots);
    const cnt = have === 135 ? '<span class="stat ok">맞음</span>' : '<span class="stat todo">' + (135 - have) + '일 남음</span>';
    const cntStyle = have === 135 ? 'border:1px solid var(--ok-line);background:var(--ok-bg);color:var(--ok)' : 'border:1px solid var(--line-2);background:var(--surface-2);color:var(--text-2)';
    C.chrome({ at: 1, noBand: true, prev: null, next: '검토·실행', mode: '한 화면 입력', sum: '시즌 달력 한 화면 · 경기일 ' + have + ' / 135', pill: blank ? 'todo' : 'ok', pillText: blank ? '작성 중' : '편성 가능', steps: [{ name: '시즌 달력' }] });
    const hol = (blank ? C.holidaysOf(year) : S.holidays).filter((h) => h.date.slice(5) >= '03' && h.date.slice(5) <= (blank ? '08-31' : S.initialEnd.slice(5)));
    const dv = (iso) => (iso ? C.D.short(C.D.dn(iso)) + '(' + WDN[C.D.wd(C.D.dn(iso))] + ')' : '');
    const left =
      '<aside class="card" style="width:330px;gap:8px;padding:10px 12px">' +
      '<div class="box" style="padding:8px 12px"><h4 style="margin:0">구단 정보 <span class="r"><span class="stat ok">확인함</span><a class="xs">펼쳐서 고치기 ▾</a></span></h4><div class="xs muted" style="margin-top:2px">10구단 · 구장 위치 · 구장 간 거리 90개(도로 45쌍)</div></div>' +
      '<div class="box blue"><h4>시즌 기간 <span class="r xs">적기</span></h4>' +
      '<div class="line"><span class="k">시즌 연도</span><span class="v"><span style="display:inline-block;border:1px solid var(--line-2);border-radius:4px;padding:1px 8px;background:#fff;font-weight:600">' + year + ' ▾</span> <span class="xs muted">고르면 주말·공휴일이 달력에 표시됩니다</span></span></div>' +
      fld('개막일', dv(S.seasonStart), blank) + fld('1차 편성 종료일', dv(S.initialEnd), blank) + fld('시즌 종료일', dv(S.seasonEnd), blank) +
      '<div class="line"><span class="k">휴식 요일</span><span class="v wd" style="gap:2px">' + WDN.map((d) => '<span style="width:22px;height:22px;font-size:11px"' + (d === '월' ? ' class="on"' : '') + '>' + d + '</span>').join('') + '</span></div>' +
      '<div class="xs muted" style="margin-top:4px">1차 편성 15경기 × 9상대 = <b>경기일 135일</b>이 필요합니다. 그 뒤는 미편성 45경기 + 우천 취소분을 넣는 재편성 기간입니다.</div></div>' +
      '<div class="box"><h4>연전 규칙 <span class="r"><span class="stat ok" style="font-size:10px">2025 공식 일정표로 확인</span></span></h4>' +
      '<div class="line"><span class="k">기본</span><span class="v">화·수·목 <b>3연전</b> / 금·토·일 <b>3연전</b> · 월요일 휴식</span></div>' +
      '<div class="line"><span class="k">개막</span><span class="v">늘 토요일 → 토·일 <b>2연전</b>, 월 휴식</span></div>' +
      '<div class="line"><span class="k">월요일 공휴일</span><span class="v">그 날 경기, 목요일 휴식(어린이날 월·화·수)</span></div>' +
      '<div class="line"><span class="k">올스타 휴식기</span><span class="v">금~수 6일 · 뒤 목~일 <b>4연전</b></span></div>' +
      '<div style="margin-top:8px"><span class="btn pri big">⚡ 규칙대로 채우기</span></div><div class="xs muted" style="margin-top:6px">채운 뒤 달력에서 끌어서 고칩니다. 묶음이 없는 날이 경기 없는 날입니다.</div></div>' +
      '<div class="box blue"><h4>공휴일 <span class="r"><span class="btn sm">⚡ 법정 공휴일 채우기</span></span></h4>' +
      '<table class="t" style="font-size:12px"><tr><th>날짜</th><th>이름</th><th class="num">가중치</th></tr>' +
      hol.map((h) => '<tr><td class="mono">' + dv(h.date) + '</td><td>' + h.name + '</td><td class="num"><span style="border:1px solid var(--line-2);border-radius:3px;padding:0 6px;background:#fff">' + W(h) + '</span></td></tr>').join('') +
      '</table><div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span class="btn sm">+ 줄 추가</span><span class="xs muted">가중치 = 홈 경기 공정성에서 이 날의 가치(주말 하루 1)</span></div>' +
      '<div class="xs" style="margin-top:4px"><span class="stat warn" style="font-size:10px">기본값(공휴일 2 · 어린이날 3)은 KBO 확인 필요</span>' + (blank ? ' <span class="xs muted">' + year + '년 음력 공휴일·대체공휴일은 내장 표에서</span>' : '') + '</div></div>' +
      '</aside>';
    const si = o.sel ? slots.findIndex((s) => C.D.iso(s.start) === o.sel) : -1;
    const main =
      '<main class="main" style="margin:12px 0 12px 12px;border-radius:6px 0 0 6px;border-right:0">' +
      '<div class="head" style="padding:8px 14px"><b style="white-space:nowrap">' + year + ' 시즌 달력</b><span class="desc" style="white-space:nowrap">3월~8월 · 1차 편성 기간</span>' +
      '<span style="margin-left:10px;display:inline-flex;align-items:center;gap:8px;border-radius:6px;padding:3px 12px;white-space:nowrap;' + cntStyle + '"><span style="font-size:15px;font-weight:700">경기일 ' + have + ' / 135일</span>' + cnt + '</span>' +
      '<span class="small muted" style="white-space:nowrap">' + (blank ? '아직 묶음이 없습니다 — 「규칙대로 채우기」나 끌어서 만듭니다' : '2연전 ' + (hist[2] || 0) + ' · 3연전 ' + (hist[3] || 0) + ' · 4연전 ' + (hist[4] || 0) + ' · 묶음 ' + slots.length + '개') + '</span></div>' +
      '<div class="body2" style="position:relative;padding:8px 14px 12px" id="rcal">' +
      '<div style="display:flex;justify-content:flex-end;margin-bottom:6px">' + C.legend([['game', '경기일'], ['ss', '묶음 시작'], ['rest', '경기 없음'], ['hol', '공휴일(빨강)'], ['sat', '토요일(파랑)'], ['ev', '홈 구장 지정'], ['sel', '고른 묶음']]) + '</div>' +
      C.strip({ S, year, from: 3, to: 8, slots, big: true, sel: si, onCell: o.onCell, noGame: blank, layers: blank ? { range: 0, event: 0 } : {} }) +
      '<div class="small muted" style="margin-top:10px;display:flex;gap:18px"><span>⟷ 날짜를 <b>끌면</b> 연전 묶음(2·3·4연전)</span><span>▣ 묶음을 <b>누르면</b> 연전 수 바꾸기 · 지우기</span><span>○ 날을 <b>누르면</b> 홈 구장 지정</span>' + (blank ? '<span>주말·공휴일은 연도에서 자동(공식 일정표처럼 토 파랑 · 일·공휴일 빨강)</span>' : '<span>7/11~16은 묶음이 없어 경기 없음(올스타)</span>') + '</div>' +
      (o.pop || '') +
      '</div></main>';
    const pick = blank ?
      '<div class="box"><h4>고른 날</h4><div class="small muted">달력에서 날을 누르면 여기서 홈 구장을 지정합니다(개막전·어린이날). 공휴일은 왼쪽 표에서 적습니다.</div></div>' :
      '<div class="box blue"><h4>고른 날 · 5/5(월) <span class="r xs muted">어린이날·부처님오신날</span></h4>' +
      '<div class="line"><span class="k">연전</span><span class="v">5/5(월)~5/7(수) 3연전</span></div><div class="line"><span class="k">공휴일</span><span class="v">가중치 3 <span class="xs muted">(왼쪽 표)</span></span></div>' +
      '<div style="margin-top:8px"><span class="tog"><i class="on"></i><b>홈 구장 지정</b></span><div class="xs muted" style="margin:2px 0 6px">이 날 홈 경기를 해야 하는 구단 5곳을 고릅니다. 상대는 자동 편성이 정합니다.</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px">' + ['SSG', '두산', 'LG', 'KT', '키움', '한화', '삼성', 'KIA', 'NC', '롯데'].map((t) => '<span class="btn sm"' + (['두산', '키움', '한화', 'NC', '롯데'].includes(t) ? ' style="background:var(--navy);color:#fff;border-color:var(--navy)"' : '') + '>' + t + '</span>').join('') + '</div>' +
      '<div class="xs muted" style="margin-top:6px">잠실은 두산·LG 중 하나만. 개막전 3/22도 같은 방법으로.</div></div></div>';
    const right =
      '<aside class="card" style="width:280px;border-left:1px solid var(--line);border-right:0;gap:10px">' + pick +
      '<div class="box ' + (blank ? '' : 'ok') + '"><h4>확인</h4><div class="line"><span class="k">경기일 합</span><span class="v">' + have + ' / 135 ' + cnt + '</span></div><div class="line"><span class="k">홈 구장 지정</span><span class="v">' + (blank ? '<span class="stat todo">아직 없음</span>' : '3/22 개막전 5곳 · 5/5 어린이날 5곳') + '</span></div><div class="line"><span class="k">시리즈</span><span class="v">' + (blank ? '<span class="stat todo">묶음 45개 뒤 규칙으로</span>' : '규칙대로 225개 <span class="stat ok">맞음</span>') + '</span></div><div class="xs muted" style="margin-top:4px">맞대결 16경기 = 1차 편성 15(홈 9·원정 6) + 미편성 1(홈 정해 둠, 재편성에서). 날짜는 ② 자동 편성이 정합니다. <a>자세히</a></div></div>' +
      '<div class="box"><h4>엑셀로 한꺼번에</h4><div style="display:flex;flex-direction:column;gap:6px"><span class="btn sm">⬇ 지금 데이터로 서식 내려받기</span><span class="btn sm">⬆ 채운 파일 올리기</span></div><div class="xs muted" style="margin-top:6px">시트 4개: 구단 정보 · 시즌 기간과 공휴일 · 연전 기간 · 홈 구장 지정</div></div>' +
      '<div style="margin-top:auto"><span class="btn sm ghost">▶ 따라 하기 다시 보기</span></div>' +
      '</aside>';
    document.querySelector('.body').innerHTML = left + main + right;
  };
  function fld(k, v, blank) {
    return '<div class="line"><span class="k">' + k + '</span><span class="v"><span style="display:inline-block;border:1px ' + (v ? 'solid var(--line-2)' : 'dashed var(--line-3)') + ';border-radius:4px;padding:1px 8px;background:#fff;min-width:80px;' + (v ? '' : 'color:var(--text-3)') + '">' + (v || '적어 주세요') + '</span>' + (blank && !v ? '' : '') + '</span></div>';
  }
})();
