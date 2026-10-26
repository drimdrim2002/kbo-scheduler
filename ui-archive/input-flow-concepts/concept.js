/*
 * ① 데이터 준비 입력 흐름 컨셉 시안 — 공통 바탕 (정적 시안 전용, 실제 스튜디오 코드와 무관)
 * 2025 실제 설정으로 달력·연전 기간을 그린다. 규칙은 ui/core/calendar-gen.js의 것을 그대로 옮겼다(3연전 우선, 남으면 2·4).
 */
(function () {
  'use strict';
  const C = window.Concept = {};
  const DAY = 86400000, WD = ['일', '월', '화', '수', '목', '금', '토'];
  const dn = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY); };
  const iso = (n) => { const d = new Date(n * DAY); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
  const wd = (n) => new Date(n * DAY).getUTCDay();
  const mo = (n) => new Date(n * DAY).getUTCMonth() + 1;
  const dd = (n) => new Date(n * DAY).getUTCDate();
  const fmt = (n) => mo(n) + '/' + dd(n) + '(' + WD[wd(n)] + ')';
  const short = (n) => mo(n) + '/' + dd(n);
  C.D = { dn, iso, wd, mo, dd, fmt, short, WD };

  // 2025 실제 설정 (ui/core/preset-2025.js DEFAULT_SETTINGS)
  C.S2025 = {
    seasonStart: '2025-03-22', initialEnd: '2025-08-31', seasonEnd: '2025-10-31', restWeekdays: [1],
    restExceptions: ['2025-05-05'],
    blackouts: [{ start: '2025-05-08', end: '2025-05-08', label: '어린이날 3연전 뒤 휴식' }, { start: '2025-07-11', end: '2025-07-16', label: '올스타 휴식기' }],
    holidays: [['2025-05-05', '어린이날·부처님오신날'], ['2025-05-06', '대체공휴일'], ['2025-06-06', '현충일'], ['2025-08-15', '광복절'], ['2025-10-03', '개천절'], ['2025-10-05', '추석 연휴'], ['2025-10-06', '추석'], ['2025-10-07', '추석 연휴'], ['2025-10-08', '추석 대체공휴일'], ['2025-10-09', '한글날']].map(([date, name]) => ({ date, name })),
    gamesPerPair: 16, initialGamesPerPair: 15, homeGamesMajor: 9,
    events: [
      { date: '2025-03-22', kind: 'MATCH', name: '개막전', pairs: [['LG', '롯데'], ['SSG', '두산'], ['KT', '키움'], ['한화', 'KIA'], ['삼성', 'NC']] },
      { date: '2025-05-05', kind: 'STADIUM', name: '어린이날', stadiums: ['잠실', '고척', '대전', '창원', '사직'] }
    ]
  };
  C.TEAMS = [['SSG', '문학경기장'], ['두산', '잠실종합운동장'], ['LG', '잠실종합운동장'], ['KT', '수원KT위즈파크'], ['키움', '고척돔야구장'], ['한화', '한화이글스파크'], ['삼성', '대구삼성라이언즈파크'], ['KIA', '광주챔피언스필드'], ['NC', '창원NC파크'], ['롯데', '사직야구장']].map(([name, stadium]) => ({ name, stadium }));

  /** 경기일인가: 경기 없는 기간 > 휴식일 경기 > 휴식 요일 */
  C.isGameDay = function (S, n) {
    for (const b of S.blackouts) if (n >= dn(b.start) && n <= dn(b.end)) return false;
    if (S.restExceptions.some((x) => dn(x) === n)) return true;
    return !S.restWeekdays.includes(wd(n));
  };
  function split(L) { if (L <= 2) return [L]; const r = L % 3, q = Math.floor(L / 3); if (r === 0) return new Array(q).fill(3); if (r === 1) return new Array(q - 1).fill(3).concat([4]); return [2].concat(new Array(q).fill(3)); }
  /** 연전 기간 만들기(규칙: 경기일이 이어지는 묶음을 3연전 우선으로 나눔) → [{start, len}] */
  C.slots = function (S) {
    const a = dn(S.seasonStart), b = dn(S.initialEnd), runs = []; let cur = null;
    for (let d = a; d <= b; d++) { if (C.isGameDay(S, d)) { if (!cur) cur = { start: d, len: 0 }; cur.len++; } else if (cur) { runs.push(cur); cur = null; } }
    if (cur) runs.push(cur);
    const out = [];
    for (const r of runs) { let d = r.start; for (const len of split(r.len)) { out.push({ start: d, len, weekend: [...Array(len)].some((_, i) => [0, 6].includes(wd(d + i))) }); d += len; } }
    return out;
  };
  C.hist = (slots) => slots.reduce((h, s) => { h[s.len] = (h[s.len] || 0) + 1; return h; }, {});

  /**
   * 월 × 일 달력 띠. opts: { S, from, to, slots, layers:{holiday,black,restex,slot,event,range}, sel(연전 기간 번호), big(셀 크게), onCell(n)→추가 class }
   */
  C.strip = function (o) {
    const S = o.S, L = Object.assign({ holiday: 1, black: 1, restex: 1, slot: 1, event: 1, range: 1 }, o.layers || {});
    const hol = new Map(S.holidays.map((h) => [dn(h.date), h.name]));
    const black = new Map(); for (const b of S.blackouts) for (let d = dn(b.start); d <= dn(b.end); d++) black.set(d, b.label);
    const rex = new Set(S.restExceptions.map(dn));
    const ev = new Map((S.events || []).map((e) => [dn(e.date), e]));
    const slotOf = new Map(); (o.slots || []).forEach((s, i) => { for (let k = 0; k < s.len; k++) slotOf.set(s.start + k, { i, k, s }); });
    const a = dn(S.seasonStart), b = dn(S.initialEnd), e = dn(S.seasonEnd);
    let h = '<div class="strip' + (o.big ? ' big' : '') + '">';
    for (let m = o.from; m <= o.to; m++) {
      h += '<div class="srow"><span class="m">' + m + '월</span><div class="sdays">';
      for (let d = 1; d <= 31; d++) {
        const n = dn('2025-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
        if (mo(n) !== m) { h += '<span class="sd out"></span>'; continue; }
        const cls = ['sd'], tt = [fmt(n)];
        const w = wd(n), inSlot = slotOf.get(n);
        if (L.range && (n < a || n > e)) cls.push('off');
        else if (L.range && n > b) cls.push('re');
        if (L.slot && inSlot) { cls.push('game'); if (inSlot.k === 0) cls.push('ss'); if (inSlot.k === inSlot.s.len - 1) cls.push('se'); if (o.sel === inSlot.i) cls.push('sel'); tt.push(inSlot.s.len + '연전 ' + (inSlot.k + 1) + '일째'); }
        else if (!L.slot && n >= a && n <= b && C.isGameDay(S, n)) cls.push('game');
        else if (n >= a && n <= e) cls.push('rest');
        if (w === 0 || w === 6) cls.push('we');
        if (L.black && black.has(n)) { cls.push('black'); tt.push(black.get(n)); }
        if (L.holiday && hol.has(n)) { cls.push('hol'); tt.push(hol.get(n)); }
        if (L.restex && rex.has(n)) { cls.push('rex'); tt.push('휴식 요일이지만 경기'); }
        if (L.event && ev.has(n)) { cls.push('ev'); tt.push(ev.get(n).name); }
        if (o.onCell) { const x = o.onCell(n); if (x) cls.push(x); }
        const lab = (L.slot && inSlot && inSlot.k === 0 && o.big) ? '<i class="sl">' + inSlot.s.len + '연전</i>' : '';
        h += '<span class="' + cls.join(' ') + '" title="' + tt.join(' · ') + '">' + d + lab + '</span>';
      }
      h += '</div></div>';
    }
    return h + '</div>';
  };
  C.legend = (items) => '<div class="legend">' + items.map(([cls, t]) => '<span><i class="' + cls + '"></i>' + t + '</span>').join('') + '</div>';

  /** 공통 틀: 상단 띠·4단계·① 안의 단계 띠·바닥 */
  C.chrome = function (o) {
    const steps = o.steps || [];
    const band = steps.map((s, i) => {
      const n = i + 1, st = n < o.at ? 'done' : n === o.at ? 'cur' : 'todo';
      return '<span class="bs ' + st + '"><b>' + (st === 'done' ? '✓' : n) + '</b>' + s.name + (s.role ? '<em>' + s.role + '</em>' : '') + '</span>';
    }).join('');
    document.body.insertAdjacentHTML('afterbegin',
      '<header class="top"><span class="logo">KBO</span><b>KBO 일정 편성 · 2025</b><span class="sub">편성 스튜디오</span><span class="pill ' + (o.pill || 'ok') + '">' + (o.pillText || '편성 가능') + '</span><span class="muted">자동 편성 <b>대기</b></span><span class="r">데이터 ▾ &nbsp;&nbsp; 시즌 운영 &nbsp;&nbsp; 설정</span></header>' +
      '<nav class="stepper"><span class="st cur"><i>1</i><div><b>데이터 준비</b><small>' + (o.sum || '') + '</small></div><span class="pill ' + (o.pill || 'ok') + '">' + (o.pillText || '작성 중') + '</span></span><span class="st"><i>2</i><div><b>검토·실행</b><small>통과 10 · 확인 필요 0 · 자동 편성 1회</small></div></span><span class="st"><i>3</i><div><b>결과·수정</b><small>필수 규칙 위반 0건 · 일정 미정 0</small></div></span><span class="st"><i>4</i><div><b>공정성·배포</b><small>이동거리 범위 안 7구단 · 배포 파일 아직 없음</small></div></span></nav>' +
      (o.noBand ? '' : '<div class="band"><span class="mode">' + (o.mode || '새로 입력하기') + '</span><span class="prog">' + o.at + ' / ' + steps.length + '</span>' + band + '<span class="r"><a>처음 질문으로</a><a>▦ 모든 표 보기</a><a>안내 끄기</a></span></div>'));
    document.body.insertAdjacentHTML('beforeend', '<footer class="foot"><span class="btn">‹ 이전: ' + (o.prev || '') + '</span><span class="muted">데이터 준비 · ' + (o.mode || '새로 입력하기') + ' · ' + o.at + ' / ' + steps.length + ' ' + (steps[o.at - 1] ? steps[o.at - 1].name : '') + '</span><span class="r"><span class="muted"><kbd>Ctrl</kbd>+<kbd>Z</kbd> 실행 취소</span><span class="btn pri">다음: ' + (o.next || '') + ' ›</span></span></footer>');
  };
})();
