/*
 * std 편성 스튜디오 — 입력 결과 시각화 (W15). 순수 함수: 데이터와 선택·변경 정보를 받아 HTML/SVG 문자열을 돌려준다.
 *   S.viz.ribbon(o)     시즌 띠 (월 × 1~31일) — 출처: alt-b app/rail/step1.js ribbon()
 *   S.viz.pairMatrix(o) 구단쌍 경기 수 행렬 (홈 행 × 원정 열) — 출처: alt-b R.chart.matrix + alt-c wb-step1.js "구단쌍 홈 경기 수"
 *   S.viz.balance(o)    연전 분포 ↔ 슬롯 수급 막대 — 출처: alt-b step1.js balance()
 *   S.viz.diff*         변경 칸 계산 (한 건 편집·가져오기 미리보기 강조)
 * alt-a 시각 언어(남색·파랑, 1px 선)로 다시 그렸다. 배치는 step-data.js의 S.inputViz(), import.js의 S.importViz()가 정한다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, CalendarGen } = KBO;
  const V = S.viz = {};

  // ───────── 시즌 띠 ─────────
  /**
   * o: { settings, slots:[{datetime, consecutive}], sel: 슬롯 index, selDays: Set<dayNum>, changed: Set<슬롯 index>,
   *      changedDays: Set<dayNum>, events: [{date, name, sel}], errRows: Set<슬롯 index>, label }
   */
  V.ribbon = function (o) {
    const set = o.settings;
    const s0 = Dates.dayNum(set.seasonStart), s1 = Dates.dayNum(set.initialEnd);
    if (!Number.isFinite(s0) || !Number.isFinite(s1) || s1 < s0) return '<div class="empty rb-empty"><b>시즌 달력을 아직 그릴 수 없습니다</b>시즌 기본 설정에서 개막일과 1차 편성 종료일을 먼저 적어 주세요.</div>';
    const year = String(set.seasonStart).slice(0, 4);
    const hol = new Map((set.holidays || []).map((h) => [Dates.dayNum(h.date), h.name]));
    const blk = new Map();
    for (const b of set.blackouts || []) for (let d = Dates.dayNum(b.start); d <= Dates.dayNum(b.end); d++) blk.set(d, b.label || '경기 없는 기간');
    const exc = new Set((set.restExceptions || []).map((x) => Dates.dayNum(x)));
    const rest = new Set(set.restWeekdays || [1]);
    const slotOf = new Map();
    (o.slots || []).forEach((sl, i) => { const a = Dates.dayNum(sl.datetime); for (let k = 0; k < sl.consecutive; k++) slotOf.set(a + k, i); });
    const evs = new Map();
    for (const e of o.events || []) if (e.date) evs.set(Dates.dayNum(e.date), e);
    const changed = o.changed || new Set(), changedDays = o.changedDays || new Set(), selDays = o.selDays || new Set(), errRows = o.errRows || new Set();
    const m0 = Dates.month(s0), m1 = Dates.month(s1);
    let s = '<div class="rb" role="img" aria-label="' + esc(o.label || '시즌 달력') + ': 경기일·휴식·경기 없는 기간·공휴일">';
    s += '<div class="rb-row rb-head"><span></span>' + Array.from({ length: 31 }, (_, i) => '<span>' + ((i + 1) % 5 === 0 || i === 0 ? i + 1 : '') + '</span>').join('') + '</div>';
    let nGame = 0;
    for (let mo = m0; mo <= m1; mo++) {
      s += '<div class="rb-row"><span class="rb-m">' + mo + '월</span>';
      for (let day = 1; day <= 31; day++) {
        const iso = year + '-' + String(mo).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const n = Dates.dayNum(iso);
        if (Dates.month(n) !== mo) { s += '<span class="rd none"></span>'; continue; }
        let cls = 'rd';
        let title = fmt.date(n);
        if (n < s0 || n > s1) { cls += ' off'; title += ' · 1차 편성 기간 밖'; }
        else if (blk.has(n)) { cls += ' blk'; title += ' · ' + blk.get(n); }
        else if (slotOf.has(n)) {
          const i = slotOf.get(n); nGame++;
          cls += ' g ' + (i % 2 ? 'gb' : 'ga');
          if (i === o.sel) cls += ' sel';
          if (changed.has(i)) cls += ' chg';
          if (errRows.has(i)) cls += ' err';
          if (n === Dates.dayNum(o.slots[i].datetime)) cls += ' first';
          title += ' · ' + (i + 1) + '번째 연전 기간 · ' + o.slots[i].consecutive + '연전';
        } else if (rest.has(Dates.weekday(n)) && !exc.has(n)) { cls += ' rest'; title += ' · 휴식'; }
        else { cls += ' gap'; title += ' · 연전 기간 없음'; }
        if (exc.has(n)) { cls += ' exc'; title += ' · 휴식일 경기'; }
        if (hol.has(n)) { cls += ' hol'; title += ' · ' + hol.get(n); }
        if (evs.has(n)) { const e = evs.get(n); cls += ' ev' + (e.sel ? ' evsel' : ''); title += ' · 특별 경기 ' + e.name; }
        if (selDays.has(n)) cls += ' selday';
        if (changedDays.has(n)) cls += ' chg';
        s += '<span class="' + cls + '" title="' + esc(title) + '"></span>';
      }
      s += '</div>';
    }
    s += '</div>';
    const lg = ['<span><i class="lg ga"></i>경기일 (연전 기간마다 색을 번갈아 칠함)</span>', '<span><i class="lg rest"></i>휴식</span>', '<span><i class="lg blk"></i>경기 없음</span>', '<span><i class="lg hol"></i>공휴일</span>'];
    if (o.sel != null && o.sel >= 0) lg.push('<span><i class="lg sel"></i>선택한 줄</span>');
    if (selDays.size) lg.push('<span><i class="lg selday"></i>선택 날짜</span>');
    if ((o.events || []).length) lg.push('<span><i class="lg ev"></i>특별 경기</span>');
    if (changed.size || changedDays.size) lg.push('<span><i class="lg chg"></i>바뀐 곳</span>');
    if (errRows.size) lg.push('<span><i class="lg err"></i>오류 있는 줄</span>');
    return s + '<div class="legend rb-lg">' + lg.join('') + '</div>';
  };

  // ───────── 구단쌍 경기 수 행렬 ─────────
  /** matches → Map('홈|원정' → 경기 수). 알 수 없는 구단(names 밖)은 뺀다. */
  V.pairCounts = function (matches, names) {
    const ok = new Set(names);
    const m = new Map();
    for (const x of matches) { if (!ok.has(x.home) || !ok.has(x.away) || x.home === x.away) continue; const k = x.home + '|' + x.away; m.set(k, (m.get(k) || 0) + (x.consecutive || 0)); }
    return m;
  };
  /**
   * o: { names, counts: Map, target(15), sel: {home, away}, changed: Set('홈|원정'), before: Map(이전 값, 툴팁용), cell, title }
   * 칸 = 그 홈에서 치르는 경기 수. 두 칸(홈·원정 바꾼 칸)의 합이 target이 아니면 노랑 + '!'.
   */
  V.pairMatrix = function (o) {
    const N = o.names, cw = o.cw || o.cell || 28, ch = o.ch || o.cell || 28, left = 40, top = 20;
    const cs = cw; // 열 폭
    const W = left + N.length * cw + 2, H = top + N.length * ch + 2;
    const cnt = (h, a) => o.counts.get(h + '|' + a) || 0;
    const target = o.target || 15;
    const sel = o.sel || null;
    const changed = o.changed || new Set();
    let off = 0;
    let s = '<svg class="vz-mx" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || '맞대결 경기 수') + ': 가로줄 홈, 세로줄 원정">';
    s += '<text class="vz-corner" x="2" y="12">홈＼원정</text>';
    N.forEach((a, j) => { s += '<text class="vz-col' + (sel && sel.away === a ? ' on' : '') + '" x="' + (left + j * cs + cs / 2 - 1) + '" y="13" text-anchor="middle">' + esc(a) + '</text>'; });
    N.forEach((h, i) => {
      const y = top + i * ch;
      if (sel && sel.home === h) s += '<rect class="vz-rowhi" x="0" y="' + (y - 1) + '" width="' + (W - 1) + '" height="' + ch + '"/>';
      s += '<text class="vz-row' + (sel && sel.home === h ? ' on' : '') + '" x="' + (left - 5) + '" y="' + (y + ch / 2 + 3) + '" text-anchor="end">' + esc(h) + '</text>';
      N.forEach((a, j) => {
        const x = left + j * cs;
        if (h === a) { s += '<rect class="vz-none" x="' + x + '" y="' + y + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" rx="2"/>'; return; }
        const v = cnt(h, a), w = cnt(a, h);
        const bad = v + w !== target;
        if (bad && i < j) off++;
        const isSel = sel && sel.home === h && sel.away === a;
        const isMirror = sel && sel.home === a && sel.away === h;
        const chg = changed.has(h + '|' + a);
        const fill = bad ? '#FFF3D9' : step(v);
        const dark = !bad && v >= 9; // 6~8 칸은 남색 글자(대비 4.5:1 이상)
        const prev = o.before && o.before.has(h + '|' + a) ? o.before.get(h + '|' + a) : null;
        const tip = a + ' vs ' + h + ' — ' + h + ' 홈 ' + v + '경기 · ' + a + ' 홈 ' + w + '경기 · 합 ' + (v + w) + (bad ? ' (목표 ' + target + '와 다름)' : '') + (chg ? ' · 방금 바뀜' + (prev != null ? ' (' + prev + ' → ' + v + ')' : '') : '');
        s += '<g class="vz-cell' + (bad ? ' bad' : '') + (chg ? ' chg' : '') + (isSel ? ' sel' : '') + '" data-pair="' + esc(h + '|' + a) + '" data-v="' + v + '"><title>' + esc(tip) + '</title>' +
          '<rect x="' + x + '" y="' + y + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" rx="2" fill="' + fill + '"' + (bad ? ' stroke="#C98A00" stroke-width="1" stroke-dasharray="2 1.5"' : '') + '/>' +
          (isMirror ? '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (cw - 4) + '" height="' + (ch - 4) + '" rx="1.5" fill="none" stroke="#0A1E3C" stroke-width="1.2" stroke-dasharray="3 2"/>' : '') +
          (isSel ? '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="' + (cw - 3) + '" height="' + (ch - 3) + '" rx="2" fill="none" stroke="#0A1E3C" stroke-width="2.4"/>' : '') +
          (chg ? '<rect x="' + (x - 1) + '" y="' + (y - 1) + '" width="' + cw + '" height="' + ch + '" rx="3" fill="none" stroke="#1F5FD6" stroke-width="2"/><circle cx="' + (x + cw - 5) + '" cy="' + (y + 3) + '" r="2.6" fill="#1F5FD6"/>' : '') +
          '<text class="vz-val' + (dark ? ' inv' : '') + (bad ? ' bad' : '') + '" x="' + (x + cw / 2 - 1) + '" y="' + (y + ch / 2 + 3) + '" text-anchor="middle">' + v + (bad ? '!' : '') + '</text></g>';
      });
    });
    s += '</svg>';
    const lg = '<div class="legend vz-lg"><span><i style="background:' + step(9) + '"></i>9경기</span><span><i style="background:' + step(6) + '"></i>6~8</span><span><i style="background:' + step(3) + '"></i>1~5</span><span><i style="background:' + step(12) + '"></i>10 이상</span>' +
      '<span><i style="background:#FFF3D9;box-shadow:inset 0 0 0 1px #C98A00"></i>! 두 칸 합이 ' + target + '가 아님</span>' +
      (sel ? '<span><i style="box-shadow:inset 0 0 0 2px #0A1E3C;background:#fff"></i>선택한 줄의 맞대결</span>' : '') +
      (changed.size ? '<span><i style="box-shadow:inset 0 0 0 2px #1F5FD6;background:#fff"></i>방금 바뀐 칸</span>' : '') + '</div>';
    return { html: s + lg, off };
  };
  /** 색 단계: 0 / 1~5 / 6~8 / 9 / 10 이상 */
  function step(v) { return v <= 0 ? '#F5F7FA' : v < 6 ? '#D6E1F4' : v < 9 ? '#5F8BDA' : v === 9 ? '#1F3F86' : '#0A1E3C'; }
  V.matrixStep = step;

  // ───────── 연전 수급 ─────────
  /** o: { slots(calendar), matches, teams } — 사전 점검과 같은 계산 */
  V.balance = function (o) {
    const half = Math.floor(o.teams / 2);
    const sh = CalendarGen.lengthHistogram(o.slots), mh = CalendarGen.lengthHistogram(o.matches);
    let s = '<div class="vz-bal">';
    for (const k of [2, 3, 4]) {
      const cap = (sh[k] || 0) * half, need = mh[k] || 0;
      if (!cap && !need) continue;
      const st = need > cap ? 'block' : need < cap ? 'warn' : 'ok';
      const max = Math.max(cap, need, 1);
      s += '<div class="vz-bal-row"><span class="k">' + k + '연전</span><div class="bars">' +
        '<div class="bar cap" style="width:' + (cap / max * 100).toFixed(1) + '%"><span>기간 ' + (sh[k] || 0) + '개 × ' + half + ' = ' + cap + '</span></div>' +
        '<div class="bar need ' + st + '" style="width:' + (need / max * 100).toFixed(1) + '%"><span>시리즈 ' + need + '</span></div></div>' +
        S.stat(st, st === 'ok' ? '맞음' : st === 'warn' ? '여유 ' + (cap - need) : '부족 ' + (need - cap)) + '</div>';
    }
    return s + '</div>';
  };

  // ───────── 변경 계산 ─────────
  V.diffCounts = function (a, b) {
    const out = new Set();
    for (const k of new Set([...a.keys(), ...b.keys()])) if ((a.get(k) || 0) !== (b.get(k) || 0)) out.add(k);
    return out;
  };
  V.diffSlots = function (a, b) {
    const out = new Set();
    const key = (x) => x ? x.datetime + '|' + x.consecutive + '|' + x.weekend + '|' + x.holiday : '';
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (key(a[i]) !== key(b[i]) && i < b.length) out.add(i);
    return out;
  };
  /** 날짜 집합(공휴일·예외일·경기 없는 기간·이벤트) 차이 → dayNum 집합 */
  V.dateSet = function (st, sheet) {
    const out = new Map();
    if (sheet === 'holidays') for (const h of st.settings.holidays) out.set(Dates.dayNum(h.date), h.name);
    else if (sheet === 'restex') for (const d of st.settings.restExceptions) out.set(Dates.dayNum(d), '');
    else if (sheet === 'blackouts') for (const b of st.settings.blackouts) for (let d = Dates.dayNum(b.start); d <= Dates.dayNum(b.end); d++) out.set(d, b.label || '');
    else if (sheet === 'events') for (const e of st.events) if (e.date) out.set(Dates.dayNum(e.date), e.name + '|' + e.mode);
    return out;
  };
  V.diffDates = function (a, b) {
    const out = new Set();
    for (const k of new Set([...a.keys(), ...b.keys()])) if (a.get(k) !== b.get(k) && b.has(k)) out.add(k);
    return out;
  };
  void icon;
})();
