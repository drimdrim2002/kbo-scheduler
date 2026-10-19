/*
 * alt-b 단계 레일 — ① 데이터 준비.
 * 가져오기 띠 + 하위 탭(시즌 골격·슬롯·시리즈·이벤트·구단과 거리). 왼쪽은 입력(폼·표 한 건 편집), 오른쪽은 즉시 결과.
 */
(function () {
  'use strict';
  const R = window.R;
  const KBO = R.KBO, D = KBO.Dates, CG = KBO.CalendarGen;
  const esc = R.esc;
  const u = R.ui;
  u.selRow = { slots: 14, series: 11 };
  u.selEvent = 'ev-children';
  u.edit = null; // { sheet, row, col, value, error, fix }
  u.flashRow = null;
  u.seriesTeam = '';

  // ───────── 가져오기 띠 (§4) ─────────
  function importStrip() {
    const li = R.lastImport || { file: '2025_KBO_정규시즌_편성.xlsx', sheets: 6, at: '10/18(토) 14:02', src: 'xlsx' };
    return '<div class="istrip" role="region" aria-label="가져오기·내보내기">' +
      '<span class="istrip-l">' + R.icon('sheet') + '<b>시트로 가져오기</b></span>' +
      '<button class="btn btn-sm btn-primary" data-act="import" data-src="xlsx"' + (R.locked() ? ' disabled' : '') + '>' + R.icon('upload') + '.xlsx 업로드</button>' +
      '<button class="btn btn-sm" data-act="import" data-src="gsheet"' + (R.locked() ? ' disabled' : '') + '>' + R.icon('link') + '구글 시트 연결</button>' +
      '<span class="istrip-sep"></span>' +
      '<button class="btn btn-sm btn-ghost" data-act="export" data-kind="template">' + R.icon('download') + '빈 양식</button>' +
      '<button class="btn btn-sm btn-ghost" data-act="export" data-kind="xlsx">' + R.icon('download') + '.xlsx 내보내기</button>' +
      '<span class="istrip-last">마지막 가져오기 <b>' + esc(li.file) + '</b> · 시트 ' + li.sheets + ' · ' + esc(li.at) + '</span>' + R.mock() + '</div>';
  }

  // ───────── 시즌 띠 (오른쪽 공통) ─────────
  function ribbon(o) {
    const st = R.state();
    const s0 = D.dayNum(o.settings.seasonStart), s1 = D.dayNum(o.settings.initialEnd);
    const hol = new Map((o.settings.holidays || []).map((h) => [D.dayNum(h.date), h.name]));
    const blk = D.expandRanges(o.settings.blackouts || []);
    const exc = new Set((o.settings.restExceptions || []).map((x) => D.dayNum(x)));
    const rest = new Set(o.settings.restWeekdays || [1]);
    const slotOf = new Map();
    (o.slots || []).forEach((sl, i) => { const a = D.dayNum(sl.datetime); for (let k = 0; k < sl.consecutive; k++) slotOf.set(a + k, i); });
    const errRows = new Set(o.errRows || []);
    let s = '<div class="rib" role="img" aria-label="시즌 띠: 경기일·휴식·경기 없는 기간">';
    s += '<div class="rib-row rib-head"><span></span>' + Array.from({ length: 31 }, (_, i) => '<span>' + ((i + 1) % 5 === 0 || i === 0 ? i + 1 : '') + '</span>').join('') + '</div>';
    for (let mo = D.month(s0); mo <= D.month(s1); mo++) {
      s += '<div class="rib-row"><span class="rib-m">' + mo + '월</span>';
      for (let day = 1; day <= 31; day++) {
        const iso = '2025-' + String(mo).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const n = D.dayNum(iso);
        if (D.month(n) !== mo) { s += '<span class="rd none"></span>'; continue; }
        let cls = 'rd';
        let title = D.fmtDate(n);
        if (n < s0 || n > s1) cls += ' off';
        else if (blk.has(n)) { cls += ' blk'; title += ' 경기 없는 기간'; }
        else if (slotOf.has(n)) { const i = slotOf.get(n); cls += ' g ' + (i % 2 ? 'gb' : 'ga'); if (i === o.sel) cls += ' sel'; if (errRows.has(i)) cls += ' err'; if (n === D.dayNum(o.slots[i].datetime)) cls += ' first'; title += ' · ' + (i + 1) + '번 슬롯 ' + o.slots[i].consecutive + '연전'; }
        else if (rest.has(D.weekday(n)) && !exc.has(n)) { cls += ' rest'; title += ' 휴식'; }
        else { cls += ' gap'; title += ' 슬롯 없음'; }
        if (exc.has(n)) { cls += ' exc'; title += ' · 휴식 예외일'; }
        if (hol.has(n)) { cls += ' hol'; title += ' · ' + hol.get(n); }
        s += '<span class="' + cls + '" title="' + esc(title) + '"></span>';
      }
      s += '</div>';
    }
    s += '</div><div class="legend rib-lg"><span><i class="lg lg-ga"></i>경기일(슬롯별 교대 음영)</span><span><i class="lg lg-rest"></i>휴식</span><span><i class="lg lg-blk"></i>경기 없음</span><span><i class="lg lg-hol"></i>공휴일</span>' + (o.sel != null ? '<span><i class="lg lg-sel"></i>선택 행</span>' : '') + (o.errRows && o.errRows.length ? '<span><i class="lg lg-err"></i>오류 행</span>' : '') + '</div>';
    void st;
    return s;
  }
  R.ribbon = ribbon;

  /** 연전 수급 (슬롯 × N/2 vs 시리즈) — 사전 점검과 같은 계산 */
  function balance(d) {
    const pf = d.preflight;
    const half = Math.floor(R.state().teams.length / 2);
    let s = '<div class="bal">';
    for (const k of [2, 3, 4]) {
      const cap = (pf.sh[k] || 0) * half, need = pf.mh[k] || 0;
      if (!cap && !need) continue;
      const st = need > cap ? 'block' : need < cap ? 'warn' : 'ok';
      const max = Math.max(cap, need, 1);
      s += '<div class="bal-row"><span class="bal-k">' + k + '연전</span><div class="bal-bars"><div class="bal-bar cap" style="width:' + (cap / max * 100).toFixed(1) + '%"><span>슬롯 ' + (pf.sh[k] || 0) + '×' + half + ' = ' + cap + '</span></div><div class="bal-bar need ' + st + '" style="width:' + (need / max * 100).toFixed(1) + '%"><span>시리즈 ' + need + '</span></div></div>' + R.st(st, st === 'ok' ? '일치' : st === 'warn' ? '여유 ' + (cap - need) : '부족 ' + (need - cap)) + '</div>';
    }
    return s + '</div>';
  }
  R.balance = balance;

  function kpi(label, value, sub, cls, key) {
    const prev = R._kpiPrev && R._kpiPrev[key];
    const changed = key && prev != null && String(prev) !== String(value);
    if (key) { R._kpiNext = R._kpiNext || {}; R._kpiNext[key] = value; }
    return '<div class="kpi ' + (cls || '') + (changed ? ' bump' : '') + '"><div class="l">' + esc(label) + '</div><div class="v">' + value + '</div>' + (sub ? '<div class="d">' + sub + '</div>' : '') + '</div>';
  }
  R.kpi = kpi;
  R.afterRender = R.afterRender || [];
  R.afterRender.push(() => { if (R._kpiNext) { R._kpiPrev = R._kpiNext; R._kpiNext = null; } });

  function rightPane(title, body, opts) {
    return R.pane(Object.assign({ cls: 'pane-live', title, kicker: '즉시 결과', live: true, body, sk: 'r1' }, opts || {}));
  }

  // ───────── 시즌 골격 ─────────
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  function seasonLeft() {
    const s = R.state().settings;
    const dis = R.locked() ? ' disabled' : '';
    let b = '<p class="hint lead">개막·종료일과 휴식 규칙은 이 폼에서만 정합니다. 공휴일·예외일·경기 없는 기간은 시트로도 가져옵니다.</p>';
    b += '<div class="sect"><div class="sect-h"><h3>기간</h3></div><div class="frow3">' +
      '<div class="field"><label for="f-start">개막일</label><input class="inp" type="date" id="f-start" data-in="setting" data-k="seasonStart" value="' + s.seasonStart + '"' + dis + '></div>' +
      '<div class="field"><label for="f-iend">1차 편성 종료일</label><input class="inp" type="date" id="f-iend" data-in="setting" data-k="initialEnd" value="' + s.initialEnd + '"' + dis + '></div>' +
      '<div class="field"><label for="f-end">시즌 종료일</label><input class="inp" type="date" id="f-end" data-in="setting" data-k="seasonEnd" value="' + s.seasonEnd + '"' + dis + '></div></div></div>';
    b += '<div class="sect"><div class="sect-h"><h3>휴식 요일</h3><span class="hint">여러 개 고를 수 있습니다</span></div><div class="wdays" role="group" aria-label="휴식 요일">' +
      [1, 2, 3, 4, 5, 6, 0].map((w) => '<button class="wd' + (s.restWeekdays.includes(w) ? ' is-on' : '') + '" data-act="restday" data-w="' + w + '" aria-pressed="' + s.restWeekdays.includes(w) + '"' + dis + '>' + WD[w] + '</button>').join('') + '</div></div>';
    b += '<div class="sect"><div class="sect-h"><h3>휴식 예외일</h3><span class="hint">휴식 요일이지만 경기하는 날</span></div><div class="chips">' +
      s.restExceptions.map((x, i) => '<span class="chipx">' + D.fmtDate(x) + '<button aria-label="삭제" data-act="rm-exc" data-i="' + i + '"' + dis + '>×</button></span>').join('') +
      '<span class="addinline"><input class="inp" type="date" id="f-exc" value="2025-06-02"' + dis + '><button class="btn btn-sm" data-act="add-exc"' + dis + '>' + R.icon('plus') + '추가</button></span></div></div>';
    b += '<div class="sect"><div class="sect-h"><h3>경기 없는 기간</h3><span class="hint">' + s.blackouts.length + '건</span></div><table class="tbl tbl-form"><thead><tr><th>이름</th><th>시작</th><th>종료</th><th class="n">일수</th><th></th></tr></thead><tbody>' +
      s.blackouts.map((x, i) => '<tr data-hl="' + i + '"><td><b>' + esc(x.label || x.name || '') + '</b></td><td>' + D.fmtDate(x.start) + '</td><td>' + D.fmtDate(x.end) + '</td><td class="n">' + (D.dayNum(x.end) - D.dayNum(x.start) + 1) + '</td><td class="n"><button class="ibtn sm" data-act="rm-blk" data-i="' + i + '" aria-label="삭제"' + dis + '>' + R.icon('trash') + '</button></td></tr>').join('') +
      '</tbody></table><div class="addrow"><input class="inp" id="f-bname" placeholder="이름 (예: 올스타 브레이크)" value="장마 예비일"' + dis + '><input class="inp" type="date" id="f-bstart" value="2025-07-01"' + dis + '><input class="inp" type="date" id="f-bend" value="2025-07-01"' + dis + '><button class="btn btn-sm" data-act="add-blk"' + dis + '>' + R.icon('plus') + '추가</button></div></div>';
    const hols = s.holidays.filter((h) => h.date >= s.seasonStart && h.date <= s.initialEnd);
    b += '<div class="sect"><div class="sect-h"><h3>공휴일</h3><span class="hint">1차 편성 기간 ' + hols.length + '건 · 전체 ' + s.holidays.length + '건 · 휴일 가중치에 쓰임</span></div><div class="chips">' +
      hols.map((h) => '<span class="chipx hol">' + D.fmtDate(h.date) + ' ' + esc(h.name) + '<button aria-label="삭제" data-act="rm-hol" data-d="' + h.date + '"' + dis + '>×</button></span>').join('') + '</div></div>';
    return R.pane({ title: '시즌 골격', sub: '바꾸면 오른쪽 규칙 초안이 바로 다시 계산됩니다', body: b, sk: 'season' });
  }
  function seasonRight(d) {
    const st = R.state();
    const gen = CG.generateSlots(st.settings);
    const cur = st.calendar;
    let same = 0;
    const curKey = new Set(cur.map((c) => c.datetime + '|' + c.consecutive));
    for (const g of gen.slots) if (curKey.has(g.datetime + '|' + g.consecutive)) same++;
    const diff = gen.slots.length - same + (cur.length - same);
    const gameDays = gen.slots.reduce((a, b) => a + b.consecutive, 0);
    const h = R.lengthHist(gen.slots);
    let b = '<div class="kpis k3">' + kpi('경기일', gameDays + '<small>일</small>', '개막~1차 종료', '', 'gd') + kpi('규칙 초안 슬롯', gen.slots.length + '<small>개</small>', '2·3·4연전 ' + (h[2] || 0) + '·' + (h[3] || 0) + '·' + (h[4] || 0), 'k-teal', 'gs') +
      kpi('현재 슬롯 표와', diff ? diff + '<small>곳 다름</small>' : '일치', diff ? '슬롯 탭에서 확인' : '45개 날짜·연전 동일', diff ? 'k-bad' : 'k-ok', 'gdiff') + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>규칙으로 만든 경기일</h3><span class="hint">3연전 우선 분할 · 휴식 예외일은 경기일</span></div>' + ribbon({ settings: st.settings, slots: gen.slots }) + '</div>';
    if (gen.warnings.length) b += '<div class="sect">' + gen.warnings.map((w) => '<div class="note warn">' + R.icon('warn') + esc(w.message) + '</div>').join('') + '</div>';
    b += '<div class="sect"><div class="note">' + R.icon('todo') + '<span>초안은 바로 반영하지 않습니다. 슬롯 탭의 <b>규칙으로 초안 만들기</b>를 누르면 가져오기와 같은 미리보기를 거칩니다.</span></div></div>';
    return rightPane('규칙 초안 미리보기', b);
  }

  // ───────── 표 공통 (한 건 편집 FR-X8) ─────────
  function cell(sheet, row, col, display, opts) {
    const e = u.edit;
    const o = opts || {};
    if (e && e.sheet === sheet && e.row === row && e.col === col) {
      return '<div class="celledit' + (e.error ? ' bad' : '') + '"><input class="inp" id="celledit" data-fk="celledit" data-key="cell" data-live="cell" value="' + esc(e.value) + '" aria-invalid="' + !!e.error + '" aria-describedby="cellerr"' + (o.list ? ' list="' + o.list + '"' : '') + '>' +
        (e.error ? '<div class="cellerr" id="cellerr" role="alert">' + R.icon('block') + '<span>' + esc(e.error) + '</span>' + (e.fix != null ? '<button class="lnk" data-act="cell-fix">\'' + esc(e.fix) + '\'로 고치기</button>' : '') + '</div>' : '') + '</div>';
    }
    const bad = o.bad;
    return '<button class="cellbtn' + (o.n ? ' n' : '') + (bad ? ' bad' : '') + '" data-act="cell" data-sheet="' + sheet + '" data-row="' + row + '" data-col="' + col + '"' + (R.locked() ? ' disabled' : '') + ' title="' + esc(bad || '눌러서 고치기') + '">' + display + (bad ? ' ' + R.icon('block') : '') + '</button>';
  }
  function rowTools(sheet) {
    const dis = R.locked() ? ' disabled' : '';
    const sel = u.selRow[sheet];
    return '<div class="rowtools"><span class="hint">선택 ' + (sel != null ? (sel + 1) + '행' : '없음') + '</span>' +
      '<button class="btn btn-sm" data-act="row-ins" data-sheet="' + sheet + '" data-pos="above"' + dis + '>' + R.icon('up') + '위에 삽입</button>' +
      '<button class="btn btn-sm" data-act="row-ins" data-sheet="' + sheet + '" data-pos="below"' + dis + '>' + R.icon('down') + '아래 삽입</button>' +
      '<button class="btn btn-sm btn-danger" data-act="row-del" data-sheet="' + sheet + '"' + dis + '>' + R.icon('trash') + '삭제</button></div>';
  }
  function errFor(d, sheet, row, col) { const e = d.validation.find((x) => x.sheet === sheet && x.row === row && x.col === col); return e ? e.msg : null; }

  // ───────── 슬롯 ─────────
  function slotsLeft(d) {
    const st = R.state();
    const hol = CG.holidaySet(st.settings);
    let rows = '';
    st.calendar.forEach((c, i) => {
      const a = D.dayNum(c.datetime);
      const w = CG.slotWeights(a, c.consecutive, hol);
      const errs = d.validation.filter((x) => x.sheet === 'slots' && x.row === i);
      const sel = u.selRow.slots === i;
      rows += '<tr class="' + (sel ? 'sel' : '') + (errs.length ? ' err' : '') + (u.flashRow === 'slots:' + i ? ' flash' : '') + '" data-act="selrow" data-sheet="slots" data-row="' + i + '" id="row-slots-' + i + '">' +
        '<td class="rowno n">' + (i + 1) + '</td>' +
        '<td>' + cell('slots', i, 'start', D.isoDate(a), { bad: errFor(d, 'slots', i, 'start') }) + '</td>' +
        '<td class="muted">' + R.fmt.range(a, a + c.consecutive - 1) + '</td>' +
        '<td class="n">' + cell('slots', i, 'consecutive', c.consecutive, { n: 1, bad: errFor(d, 'slots', i, 'consecutive') }) + '</td>' +
        '<td>' + cell('slots', i, 'weekend', (c.weekend ? '주말' : '주중') + (c.weekend === w.weekend ? '<span class="auto">자동</span>' : '')) + '</td>' +
        '<td class="n">' + cell('slots', i, 'holiday', c.holiday + (c.holiday === w.holiday ? '<span class="auto">자동</span>' : ''), { n: 1 }) + '</td>' +
        '<td class="memo">' + cell('slots', i, 'note', esc(c.note || '') || '<span class="muted">—</span>') + '</td>' +
        '<td>' + (errs.length ? R.st('block', '오류') : R.st('ok', '정상')) + '</td></tr>';
    });
    return R.pane({
      title: '슬롯', sub: st.calendar.length + '행 · 시트 “슬롯”', sk: 'slots', flush: true,
      tools: '<button class="btn btn-sm" data-act="gen-slots"' + (R.locked() ? ' disabled' : '') + '>규칙으로 초안 만들기</button>',
      bar: rowTools('slots') + '<span class="hint bar-r">셀을 눌러 고치고 Enter로 확정 · Esc 취소</span>',
      body: '<table class="tbl tbl-edit"><thead><tr><th class="n">행</th><th>시작일*</th><th>기간</th><th class="n">연전*</th><th>주말</th><th class="n">휴일가중치</th><th>메모</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table>'
    });
  }
  function slotsRight(d) {
    const st = R.state();
    const days = st.calendar.reduce((a, b) => a + b.consecutive, 0);
    const errRows = Array.from(new Set(d.validation.filter((x) => x.sheet === 'slots').map((x) => x.row)));
    const sel = u.selRow.slots;
    const c = st.calendar[sel];
    let b = '<div class="kpis k3">' + kpi('슬롯', st.calendar.length + '<small>개</small>', '주말 ' + st.calendar.filter((x) => x.weekend).length + ' · 주중 ' + st.calendar.filter((x) => !x.weekend).length, '', 's1') +
      kpi('경기일', days + '<small>일</small>', '구단당 ' + days + '경기', '', 's2') +
      kpi('오류', errRows.length ? errRows.length + '<small>행</small>' : '0', errRows.length ? '표에서 빨간 셀' : '모든 행 통과', errRows.length ? 'k-bad' : 'k-ok', 's3') + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>연전 수급</h3><span class="hint">슬롯 × ' + Math.floor(st.teams.length / 2) + '경기 vs 시리즈 · 사전 점검과 같은 계산</span></div>' + balance(d) + '</div>';
    if (c) {
      const ms = d.bySlot[sel] || [];
      b += '<div class="sect"><div class="sect-h"><h3>선택 행에 배정된 시리즈</h3><span class="hint">③ 결과 · ' + ms.length + '/5</span></div><div class="chips">' + ms.map((m) => '<span class="chipx">' + R.team(st.matches[m].away) + ' @ ' + R.team(st.matches[m].home) + '</span>').join('') + (ms.length ? '' : '<span class="hint">배정 없음</span>') + (ms.some((m) => st.matches[m].consecutive !== c.consecutive) ? '<span class="stchip st-block">' + R.icon('block') + '<span>H0-d 연전 불일치</span></span>' : '') + '</div></div>';
    }
    b += '<div class="sect"><div class="sect-h"><h3>시즌 띠</h3>' + (c ? '<span class="hint">선택 ' + (sel + 1) + '행: ' + esc(R.fmt.range(D.dayNum(c.datetime), D.dayNum(c.datetime) + c.consecutive - 1)) + ' ' + c.consecutive + '연전</span>' : '') + '</div>' + ribbon({ settings: st.settings, slots: st.calendar, sel, errRows }) + '</div>';
    return rightPane('슬롯 반영 결과', b);
  }

  // ───────── 시리즈 ─────────
  function seriesLeft(d) {
    const st = R.state();
    const names = st.teams.map((t) => t.name);
    const tf = u.seriesTeam;
    let rows = '';
    let shown = 0;
    st.matches.forEach((m, i) => {
      if (tf && m.home !== tf && m.away !== tf && !(u.edit && u.edit.sheet === 'series' && u.edit.row === i)) return;
      shown++;
      const errs = d.validation.filter((x) => x.sheet === 'series' && x.row === i);
      const sel = u.selRow.series === i;
      rows += '<tr class="' + (sel ? 'sel' : '') + (errs.length ? ' err' : '') + (u.flashRow === 'series:' + i ? ' flash' : '') + '" data-act="selrow" data-sheet="series" data-row="' + i + '" id="row-series-' + i + '">' +
        '<td class="rowno n">' + (i + 1) + '</td>' +
        '<td>' + cell('series', i, 'home', names.includes(m.home) ? R.team(m.home) : esc(m.home), { bad: errFor(d, 'series', i, 'home'), list: 'teamlist' }) + '</td>' +
        '<td>' + cell('series', i, 'away', names.includes(m.away) ? R.team(m.away) : esc(m.away), { bad: errFor(d, 'series', i, 'away'), list: 'teamlist' }) + '</td>' +
        '<td class="n">' + cell('series', i, 'consecutive', m.consecutive, { n: 1 }) + '</td>' +
        '<td class="memo">' + cell('series', i, 'note', esc(m.note || '') || '<span class="muted">—</span>') + '</td>' +
        '<td>' + (errs.length ? R.st('block', '오류') : m.eventId ? '<span class="stchip st-todo">' + R.icon('pin') + '<span>개막 고정</span></span>' : R.st('ok', '정상')) + '</td></tr>';
    });
    const filter = '<label class="inline"><span class="flabel">구단</span><select class="inp" data-in="series-team"><option value="">전체 ' + st.matches.length + '</option>' + names.map((n) => '<option' + (tf === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label>';
    return R.pane({
      title: '시리즈', sub: (tf ? tf + ' 관련 ' + shown + '행 / ' : '') + st.matches.length + '행 · 시트 “시리즈”', sk: 'series', flush: true,
      tools: '<button class="btn btn-sm" data-act="gen-series"' + (R.locked() ? ' disabled' : '') + '>구단쌍 규칙으로 만들기</button>',
      bar: rowTools('series') + '<span class="bar-r">' + filter + '</span>',
      body: '<datalist id="teamlist">' + names.map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist><table class="tbl tbl-edit"><thead><tr><th class="n">행</th><th>홈*</th><th>원정*</th><th class="n">연전*</th><th>메모</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table>'
    });
  }
  function seriesRight(d) {
    const st = R.state();
    const names = st.teams.map((t) => t.name);
    const games = st.matches.reduce((a, b) => a + b.consecutive, 0);
    const per = names.map((n) => st.matches.filter((m) => m.home === n || m.away === n).reduce((a, b) => a + b.consecutive, 0));
    const even = per.every((x) => x === per[0]);
    const sel = st.matches[u.selRow.series];
    const errRows = Array.from(new Set(d.validation.filter((x) => x.sheet === 'series').map((x) => x.row)));
    let b = '<div class="kpis k3">' + kpi('시리즈', st.matches.length + '<small>개</small>', '경기 ' + games, '', 'r1') +
      kpi('구단당 경기', even ? per[0] + '<small>경기</small>' : '불균형', even ? '10구단 모두 같음' : '최소 ' + Math.min(...per) + ' · 최대 ' + Math.max(...per), even ? '' : 'k-bad', 'r2') +
      kpi('오류', errRows.length ? errRows.length + '<small>행</small>' : '0', errRows.length ? (errRows.length === 1 ? (errRows[0] + 1) + '행 확인' : '빨간 셀 확인') : '구단명·연전 통과', errRows.length ? 'k-bad' : 'k-ok', 'r3') + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>연전 수급</h3><span class="hint">시리즈 길이 분포 = 슬롯 분포여야 함</span></div>' + balance(d) + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>구단쌍 경기 수</h3><span class="hint">행 홈 × 열 원정 · 선택 행 강조</span></div><div class="mxbox">' + R.chart.matrix({
      rows: names, cols: names, cell: 30, labelW: 40, fit: true, title: '구단쌍 경기 수',
      value: (i, j) => {
        if (i === j) return null;
        const ms = st.matches.filter((m) => m.home === names[i] && m.away === names[j]);
        const g = ms.reduce((a, b) => a + b.consecutive, 0);
        return { v: g, text: g, sel: sel && sel.home === names[i] && sel.away === names[j], title: names[j] + ' @ ' + names[i] + ' ' + ms.length + '시리즈 ' + g + '경기' };
      }
    }) + '</div></div>';
    return rightPane('시리즈 반영 결과', b);
  }

  // ───────── 이벤트 ─────────
  function eventsLeft(d) {
    const st = R.state();
    const evs = st.events;
    const opening = evs.filter((e) => e.type === 'OPENING');
    const others = evs.filter((e) => e.type !== 'OPENING');
    let b = '<p class="hint lead">대진 지정은 그 슬롯에 대진을 고정(핀)하고, 구장 지정은 그 구장 연고 구단에 홈 경기 의무를 줍니다.</p>';
    b += '<div class="evcard"><div class="evh"><span class="evtype">개막전</span><b>' + D.fmtDate(opening[0] ? opening[0].date : st.settings.seasonStart) + '</b><span class="hint">대진 지정 ' + opening.length + ' · 핀 고정</span><button class="btn btn-sm" data-act="ev-sel" data-id="opening">보기</button></div><ul class="evlist">' +
      opening.map((e) => '<li>' + R.icon('pin') + R.team(e.away) + '<span class="at">@</span>' + R.team(e.home, { strong: true }) + '<span class="hint">' + esc(R.shortStadium(R.stadiumOf(e.home))) + '</span></li>').join('') + '</ul></div>';
    for (const e of others) {
      b += '<div class="evcard' + (u.selEvent === e.id ? ' is-on' : '') + '"><div class="evh"><span class="evtype">' + (e.type === 'CHILDREN' ? '어린이날' : '사용자 정의') + '</span><b>' + esc(e.name) + ' · ' + D.fmtDate(e.date) + '</b><span class="hint">' + (e.mode === 'STADIUM' ? '구장 지정 ' + (e.stadiums || []).length : '대진 지정') + '</span><button class="btn btn-sm" data-act="ev-sel" data-id="' + esc(e.id) + '">보기</button></div>' +
        (e.mode === 'STADIUM' ? '<div class="chips">' + (e.stadiums || []).map((s) => '<span class="chipx">' + esc(R.shortStadium(s)) + '</span>').join('') + '</div>' : '<div class="evlist">' + R.team(e.away) + ' @ ' + R.team(e.home) + '</div>') + '</div>';
    }
    b += '<details class="fold" open><summary>' + R.icon('plus') + '이벤트 추가</summary><div class="fold-b"><div class="frow3"><div class="field"><label>이름</label><input class="inp" id="ev-name" value="광복절 매치"></div><div class="field"><label>날짜</label><input class="inp" type="date" id="ev-date" value="2025-08-15"></div><div class="field"><label>방식</label><select class="inp" id="ev-mode"><option value="MATCH">대진 지정</option><option value="STADIUM">구장 지정</option></select></div></div><div class="frow3" style="margin-top:8px"><div class="field"><label>홈</label><select class="inp" id="ev-home">' + st.teams.map((t) => '<option>' + esc(t.name) + '</option>').join('') + '</select></div><div class="field"><label>원정</label><select class="inp" id="ev-away">' + st.teams.map((t, i) => '<option' + (i === 9 ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select></div><div class="field"><label>&nbsp;</label><button class="btn" data-act="ev-add"' + (R.locked() ? ' disabled' : '') + '>' + R.icon('plus') + '추가</button></div></div></div></details>';
    return R.pane({ title: '특별 이벤트', sub: evs.length + '건 · 시트 “이벤트”', body: b, sk: 'events' });
  }
  function eventsRight(d) {
    const st = R.state();
    const sel = u.selEvent || 'ev-children';
    const ev = st.events.find((e) => e.id === sel) || st.events.find((e) => e.type === 'OPENING');
    const evc = R.eventCheck(st);
    let b = '';
    const isOpen = sel === 'opening' || (ev && ev.type === 'OPENING');
    const evs = isOpen ? st.events.filter((e) => e.type === 'OPENING') : [ev];
    const slot = KBO.Score.resolveEventSlot(evs[0], st.calendar);
    const sl = d.slots[slot];
    b += '<div class="kpis k3">' + kpi('연결된 슬롯', sl ? (slot + 1) + '<small>번</small>' : '없음', sl ? esc(sl.label) : '날짜가 슬롯 밖', sl ? 'k-teal' : 'k-bad', 'e1') +
      kpi('모순', evc.problems.length ? evc.problems.length + '<small>건</small>' : '0', evc.problems.length ? esc(evc.problems[0]) : '같은 슬롯 충돌 없음', evc.problems.length ? 'k-bad' : 'k-ok', 'e2');
    if (isOpen) {
      const pinned = evs.filter((e) => st.matches.some((m, i) => m.eventId === e.id && m.pinned && d.plan[i] === slot)).length;
      b += kpi('대진 고정', pinned + '/' + evs.length, '시리즈 목록에서 찾음', pinned === evs.length ? 'k-ok' : 'k-bad', 'e3') + '</div>';
      b += '<div class="sect"><div class="sect-h"><h3>검사</h3></div><ul class="checks">' +
        '<li>' + R.stIcon('ok') + '<span>같은 구단이 두 대진에 들어 있지 않음 (10개 구단 1번씩)</span></li>' +
        '<li>' + R.stIcon('ok') + '<span>같은 구장 두 번 사용 없음 (잠실: LG 홈)</span></li>' +
        '<li>' + R.stIcon(pinned === evs.length ? 'ok' : 'block') + '<span>대진마다 같은 홈·원정 2연전 시리즈가 목록에 있음</span></li></ul></div>';
    } else {
      const groups = (ev.stadiums || []).map((s) => ({ s, teams: st.teams.filter((t) => t.stadium === s).map((t) => t.name) }));
      const vio = d.ex.violations.filter((v) => v.code === 'H0-e');
      b += kpi('현재 배정', vio.length ? '위반 ' + vio.length : '충족', st.settings.h0eMode === 'ENGINE' ? '엔진 호환 기준' : '구장 기준', vio.length ? 'k-bad' : 'k-ok', 'e3') + '</div>';
      b += '<div class="sect"><div class="sect-h"><h3>홈 경기 의무</h3><span class="hint">구장 기준: 연고 구단 중 하나만 홈이면 충족</span></div><table class="tbl"><thead><tr><th>구장</th><th>연고 구단</th><th>현재 배정 (' + (sl ? esc(sl.label) : '') + ')</th></tr></thead><tbody>' +
        groups.map((g) => {
          const homes = sl ? d.bySlot[slot].filter((m) => g.teams.includes(st.matches[m].home)) : [];
          return '<tr><td><b>' + esc(R.shortStadium(g.s)) + '</b></td><td>' + g.teams.map((t) => R.team(t)).join(' · ') + '</td><td>' + (homes.length ? R.st('ok', R.matchLabel(homes[0])) : R.st('block', '홈 없음')) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      b += '<div class="sect"><div class="note warn">' + R.icon('warn') + '<span>엔진 호환 기준은 LG를 의무 구단에 넣지 않습니다(두산·키움·한화·NC·롯데). 기준 바꾸기는 <button class="lnk" data-act="go" data-view="settings">설정</button>에서.</span></div></div>';
    }
    const map = KBO.MapKit.render({ width: 220, spread: 6, labels: true, grid: false, markers: st.teams.map((t) => ({ id: t.name, lat: t.latitude, lon: t.longitude, label: t.name, color: t.color, size: 5, dim: isOpen ? !evs.some((e) => e.home === t.name) : !(ev.stadiums || []).includes(t.stadium) })) });
    b += '<div class="sect"><div class="sect-h"><h3>' + (isOpen ? '개막전 홈 구장' : '의무 구장') + '</h3></div><div class="minimap">' + map.svg + '</div></div>';
    return rightPane(isOpen ? '개막전 반영 결과' : esc(ev.name) + ' 반영 결과', b);
  }

  // ───────── 구단과 거리 ─────────
  function teamsLeft(d) {
    const st = R.state();
    const shared = new Map();
    for (const t of st.teams) { if (!shared.has(t.stadium)) shared.set(t.stadium, []); shared.get(t.stadium).push(t.name); }
    const sel = u.selTeam || 'KIA';
    let rows = st.teams.map((t) => '<tr class="' + (sel === t.name ? 'sel' : '') + '" data-act="team-sel" data-team="' + esc(t.name) + '"><td><span class="swatch" style="background:' + esc(t.color) + '"></span></td><td><b>' + esc(t.name) + '</b></td><td>' + esc(t.stadium) + (shared.get(t.stadium).length > 1 ? ' <span class="sharedb">공유 구장 · ' + shared.get(t.stadium).filter((n) => n !== t.name).join('·') + '</span>' : '') + '</td><td class="n">' + t.latitude.toFixed(4) + '</td><td class="n">' + t.longitude.toFixed(4) + '</td></tr>').join('');
    let b = '<table class="tbl"><thead><tr><th></th><th>구단</th><th>구장</th><th class="n">위도</th><th class="n">경도</th></tr></thead><tbody>' + rows + '</tbody></table>';
    b += '<div class="addrow pad"><input class="inp" placeholder="구장 이름으로 찾기 (예: 사직, 포항)" id="stadium-q" value="포항"><button class="btn btn-sm" data-act="stadium-find">' + R.icon('plus') + '구단 추가</button><span class="hint">키가 없으면 내장 구장 사전으로 찾습니다</span></div>';
    if (R.feature('T7')) {
      const names = st.teams.map((t) => t.name);
      const dm = new Map(st.distanceMatrix.map((x) => [x.from + '|' + x.to, x.distance]));
      b += '<div class="pad"><details class="fold"' + (u.heatOpen ? ' open' : '') + ' data-in="heat"><summary>거리 행렬 히트맵 <span class="hint">10×10 · 대칭 편집 켜짐 · km</span></summary><div class="fold-b heat">' + R.chart.matrix({
        rows: names, cols: names, cell: 40, labelW: 40, title: '거리 행렬',
        value: (i, j) => (i === j ? null : { v: dm.get(names[i] + '|' + names[j]) || 0, text: Math.round(dm.get(names[i] + '|' + names[j]) || 0), title: names[i] + ' → ' + names[j] + ' ' + R.fmt.km(dm.get(names[i] + '|' + names[j])) + 'km' })
      }) + '</div></details></div>';
    }
    return R.pane({ title: '구단과 거리', sub: st.teams.length + '구단 · UI에서만 입력', body: b, sk: 'teams', flush: true });
  }
  function teamsRight(d) {
    const st = R.state();
    const sel = u.selTeam || 'KIA';
    const t = st.teams.find((x) => x.name === sel);
    const dm = st.distanceMatrix.filter((x) => x.from === sel && x.to !== sel).sort((a, b) => b.distance - a.distance);
    const map = KBO.MapKit.render({ width: 190, spread: 6, labels: true, grid: false, markers: st.teams.map((x) => ({ id: x.name, lat: x.latitude, lon: x.longitude, label: x.name, color: x.color, size: x.name === sel ? 7 : 5, ring: x.name === sel, draggable: R.feature('T4') })), lines: dm.slice(0, 9).map((x) => { const to = st.teams.find((y) => y.name === x.to); return { from: { lat: t.latitude, lon: t.longitude }, to: { lat: to.latitude, lon: to.longitude }, color: 'var(--teal-200)', width: 1.2, curve: 0.08 }; }) });
    let b = '<div class="tsplit"><div class="minimap">' + map.svg + (R.feature('T4') ? '<p class="hint">마커를 끌어 좌표를 고칩니다 ' + R.mock() + '</p>' : '') + '</div><div class="tdist"><div class="sect-h"><h3>' + R.team(sel, { strong: true }) + ' 원정 거리</h3></div>' + R.chart.bars({ items: dm.map((x) => ({ label: x.to, value: x.distance })), width: 200, rowH: 22, labelW: 34, fmt: (v) => R.fmt.km(v), tickFmt: (v) => R.fmt.int(v), title: '구단별 거리' }) + '</div></div>';
    const avg = dm.reduce((a, b) => a + b.distance, 0) / dm.length;
    b = '<div class="kpis k3 kpis-sm">' + kpi('평균 거리', R.fmt.km(avg) + '<small>km</small>', esc(sel) + ' → 9개 구장', '', 't1') + kpi('최장', R.fmt.km(dm[0].distance) + '<small>km</small>', esc(dm[0].to), '', 't2') + kpi('공유 구장', '1<small>곳</small>', '잠실 두산·LG (이동 0)', 'k-teal', 't3') + '</div><div class="sect">' + b + '</div>';
    return rightPane('구장 위치와 거리', b);
  }

  R.screens['w1-season'] = { strip: importStrip, left: seasonLeft, right: seasonRight };
  R.screens['w1-slots'] = { strip: importStrip, left: slotsLeft, right: slotsRight, after: afterTable };
  R.screens['w1-series'] = { strip: importStrip, left: seriesLeft, right: seriesRight, after: afterTable };
  R.screens['w1-events'] = { strip: importStrip, left: eventsLeft, right: eventsRight };
  R.screens['w1-teams'] = { strip: importStrip, left: teamsLeft, right: teamsRight };

  function afterTable() {
    const inp = document.getElementById('celledit');
    if (inp && u.edit && !u.edit.focused) { u.edit.focused = true; try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) { /* 무시 */ } }
    if (u.scrollRow) { const el = document.getElementById(u.scrollRow); if (el) el.scrollIntoView({ block: 'center' }); u.scrollRow = null; }
    if (u.flashRow) { const f = u.flashRow; setTimeout(() => { if (u.flashRow === f) u.flashRow = null; }, 1300); }
  }

  // ───────── 셀 검증·반영 ─────────
  function suggestTeam(v) {
    const names = R.state().teams.map((t) => t.name);
    const up = String(v || '').toUpperCase().replace(/\s/g, '');
    let best = null, bestScore = 0;
    for (const n of names) {
      const N = n.toUpperCase();
      let sc = 0;
      if (up.startsWith(N) || N.startsWith(up)) sc = 3;
      else if (up.includes(N) || N.includes(up)) sc = 2;
      else { let c = 0; for (const ch of N) if (up.includes(ch)) c++; sc = c / Math.max(N.length, up.length); }
      if (sc > bestScore) { bestScore = sc; best = n; }
    }
    return bestScore >= 0.5 ? best : null;
  }
  R.suggestTeam = suggestTeam;
  function parseDate(v) {
    const s = String(v || '').trim();
    let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = /^(\d{1,2})[/.](\d{1,2})/.exec(s);
    if (m) return '2025-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
    return null;
  }
  function validateCell(e) {
    const st = R.state();
    const v = String(e.value).trim();
    e.fix = null;
    if (e.sheet === 'slots') {
      if (e.col === 'consecutive' || e.col === 'holiday') {
        const n = Number(v);
        if (!/^\d+$/.test(v)) return '숫자를 넣으세요';
        if (e.col === 'consecutive' && (n < 2 || n > 4)) { e.fix = n > 4 ? '4' : '2'; return '연전은 2~4입니다 (입력 ' + v + ')'; }
        if (e.col === 'holiday' && n > 3) return '휴일가중치는 0~3입니다';
      }
      if (e.col === 'start') {
        const iso = parseDate(v);
        if (!iso || !Number.isFinite(D.dayNum(iso))) return '날짜 형식이 아닙니다 (예: 2025-05-09, 5/9)';
        if (iso < st.settings.seasonStart || iso > st.settings.initialEnd) return '1차 편성 기간(' + D.fmtDate(st.settings.seasonStart) + '~' + D.fmtDate(st.settings.initialEnd) + ') 밖입니다';
      }
      if (e.col === 'weekend' && !/^(주말|주중|1|0|Y|N|예|아니오)$/i.test(v)) return '주말 또는 주중 (1/0, Y/N)';
    }
    if (e.sheet === 'series') {
      if (e.col === 'home' || e.col === 'away') {
        const names = st.teams.map((t) => t.name);
        if (!names.includes(v)) { const sg = suggestTeam(v); e.fix = sg; return "알 수 없는 구단 '" + v + "'" + (sg ? " — '" + sg + "'인가요?" : ''); }
        const other = e.col === 'home' ? st.matches[e.row].away : st.matches[e.row].home;
        if (v === other) return '홈과 원정이 같습니다';
      }
      if (e.col === 'consecutive') { const n = Number(v); if (!/^\d+$/.test(v) || n < 2 || n > 4) { e.fix = '3'; return '연전은 2~4입니다 (입력 ' + v + ')'; } }
    }
    return null;
  }
  function cellValue(sheet, row, col) {
    const st = R.state();
    if (sheet === 'slots') { const c = st.calendar[row]; if (col === 'start') return D.isoDate(D.dayNum(c.datetime)); if (col === 'weekend') return c.weekend ? '주말' : '주중'; if (col === 'note') return c.note || ''; return String(c[col]); }
    const m = st.matches[row];
    if (col === 'note') return m.note || '';
    return String(m[col]);
  }
  function commitCell() {
    const e = u.edit;
    if (!e) return;
    e.error = validateCell(e);
    if (e.error) { R.render(); return; }
    const v = String(e.value).trim();
    const label = (e.sheet === 'slots' ? '슬롯 ' : '시리즈 ') + (e.row + 1) + '행 ' + ({ start: '시작일', consecutive: '연전', weekend: '주말', holiday: '휴일가중치', note: '메모', home: '홈', away: '원정' }[e.col]) + ' → ' + v;
    const old = cellValue(e.sheet, e.row, e.col);
    u.edit = null;
    if (old === v) { R.render(); return; }
    R.commit(label, (s) => {
      if (e.sheet === 'slots') {
        const c = s.calendar[e.row];
        if (e.col === 'start') c.datetime = parseDate(v) + ' 00:00:00';
        else if (e.col === 'weekend') c.weekend = /^(주말|1|Y|예)$/i.test(v) ? 1 : 0;
        else if (e.col === 'note') c.note = v;
        else c[e.col] = Number(v);
      } else {
        const m = s.matches[e.row];
        if (e.col === 'note') m.note = v; else if (e.col === 'consecutive') m.consecutive = Number(v); else m[e.col] = v;
      }
    });
    u.flashRow = e.sheet + ':' + e.row;
    R.toast(label + ' — 반영했습니다. 오른쪽 결과와 상단 배지를 다시 계산했습니다.', 'ok');
  }
  R.commitCell = commitCell;

  Object.assign(R.act, {
    cell(el, ev) {
      if (ev) ev.stopPropagation();
      if (u.edit) { u.edit = null; }
      const sheet = el.getAttribute('data-sheet'), row = +el.getAttribute('data-row'), col = el.getAttribute('data-col');
      u.selRow[sheet] = row;
      u.edit = { sheet, row, col, value: cellValue(sheet, row, col), error: null };
      R.render();
    },
    'cell-fix'() { const e = u.edit; if (!e || e.fix == null) return; e.value = e.fix; e.error = null; commitCell(); },
    selrow(el, ev) {
      if (ev && ev.target.closest('.cellbtn, .celledit')) return;
      const sheet = el.getAttribute('data-sheet');
      u.selRow[sheet] = +el.getAttribute('data-row');
      if (u.edit && !(u.edit.sheet === sheet && u.edit.row === u.selRow[sheet])) u.edit = null;
      R.render();
    },
    'row-ins'(el) {
      const sheet = el.getAttribute('data-sheet');
      const below = el.getAttribute('data-pos') === 'below';
      const st = R.state();
      const sel = u.selRow[sheet] == null ? 0 : u.selRow[sheet];
      const at = below ? sel + 1 : sel;
      if (sheet === 'slots') {
        const ref = st.calendar[Math.min(sel, st.calendar.length - 1)];
        const day = below ? D.dayNum(ref.datetime) + ref.consecutive : D.dayNum(ref.datetime) - 3;
        const w = CG.slotWeights(day, 3, CG.holidaySet(st.settings));
        R.commit('슬롯 ' + (at + 1) + '행 삽입', (s) => {
          s.calendar.splice(at, 0, { index: at, datetime: D.isoDate(day) + ' 00:00:00', consecutive: 3, weekend: w.weekend, holiday: w.holiday, note: '새 행' });
          s.calendar.forEach((c, i) => { c.index = i; });
          s.plan.forEach((p) => { if (p.calendar >= at) p.calendar++; });
        });
      } else {
        const ref = st.matches[Math.min(sel, st.matches.length - 1)];
        R.commit('시리즈 ' + (at + 1) + '행 삽입', (s) => {
          s.matches.splice(at, 0, { index: at, home: ref.away, away: ref.home, consecutive: ref.consecutive, pinned: false, note: '새 행' });
          s.plan.splice(at, 0, { match: at, calendar: -1 });
          s.matches.forEach((m, i) => { m.index = i; });
          s.plan.forEach((p, i) => { p.match = i; });
          s.games = (s.games || []).map((g) => (g.match != null && g.match >= at ? Object.assign({}, g, { match: g.match + 1 }) : g));
        });
      }
      u.selRow[sheet] = at;
      u.flashRow = sheet + ':' + at;
      u.scrollRow = 'row-' + sheet + '-' + at;
      R.toast((sheet === 'slots' ? '슬롯' : '시리즈') + ' ' + (at + 1) + '행을 삽입했습니다. 실행 취소할 수 있습니다.', 'ok');
    },
    'row-del'(el) {
      const sheet = el.getAttribute('data-sheet');
      const at = u.selRow[sheet];
      if (at == null) return;
      if (sheet === 'slots') {
        R.commit('슬롯 ' + (at + 1) + '행 삭제', (s) => {
          s.calendar.splice(at, 1);
          s.calendar.forEach((c, i) => { c.index = i; });
          s.plan.forEach((p) => { if (p.calendar === at) p.calendar = -1; else if (p.calendar > at) p.calendar--; });
        });
        u.selRow.slots = Math.min(at, R.state().calendar.length - 1);
      } else {
        R.commit('시리즈 ' + (at + 1) + '행 삭제 (' + R.matchLabel(at) + ')', (s) => {
          s.matches.splice(at, 1); s.plan.splice(at, 1);
          s.matches.forEach((m, i) => { m.index = i; });
          s.plan.forEach((p, i) => { p.match = i; });
          s.games = (s.games || []).filter((g) => g.match !== at).map((g) => (g.match != null && g.match > at ? Object.assign({}, g, { match: g.match - 1 }) : g));
        });
        u.selRow.series = Math.min(at, R.state().matches.length - 1);
      }
      u.edit = null;
      R.toast((sheet === 'slots' ? '슬롯' : '시리즈') + ' ' + (at + 1) + '행을 삭제했습니다. 실행 취소(Ctrl+Z)로 되돌릴 수 있습니다.', 'warn');
    },
    'gen-slots'() { R.startImport('rule-slots'); },
    'gen-series'() { R.startImport('rule-series'); },
    restday(el) {
      const w = +el.getAttribute('data-w');
      R.commit('휴식 요일 ' + WD[w] + ' 전환', (s) => { const i = s.settings.restWeekdays.indexOf(w); if (i >= 0) s.settings.restWeekdays.splice(i, 1); else s.settings.restWeekdays.push(w); });
    },
    'rm-exc'(el) { const i = +el.getAttribute('data-i'); R.commit('휴식 예외일 삭제', (s) => { s.settings.restExceptions.splice(i, 1); }); },
    'add-exc'() { const v = document.getElementById('f-exc').value; if (!v) return; R.commit('휴식 예외일 추가 ' + D.fmtDate(v), (s) => { if (!s.settings.restExceptions.includes(v)) s.settings.restExceptions.push(v); s.settings.restExceptions.sort(); }); },
    'rm-blk'(el) { const i = +el.getAttribute('data-i'); R.commit('경기 없는 기간 삭제', (s) => { s.settings.blackouts.splice(i, 1); }); },
    'add-blk'() {
      const name = document.getElementById('f-bname').value || '경기 없음';
      const a = document.getElementById('f-bstart').value, b = document.getElementById('f-bend').value || a;
      if (!a) return;
      if (a > b) return R.toast('시작일이 종료일보다 늦습니다.', 'bad');
      R.commit('경기 없는 기간 추가: ' + name, (s) => { s.settings.blackouts.push({ start: a, end: b, label: name }); s.settings.blackouts.sort((x, y) => (x.start < y.start ? -1 : 1)); });
    },
    'rm-hol'(el) { const dt = el.getAttribute('data-d'); R.commit('공휴일 삭제 ' + D.fmtDate(dt), (s) => { s.settings.holidays = s.settings.holidays.filter((h) => h.date !== dt); }); },
    'ev-sel'(el) { u.selEvent = el.getAttribute('data-id'); R.render(); },
    'ev-add'() {
      const name = document.getElementById('ev-name').value || '사용자 이벤트';
      const date = document.getElementById('ev-date').value;
      const mode = document.getElementById('ev-mode').value;
      const home = document.getElementById('ev-home').value, away = document.getElementById('ev-away').value;
      const id = 'ev-' + Date.now().toString(36);
      R.commit('이벤트 추가: ' + name, (s) => { s.events.push(mode === 'MATCH' ? { id, type: 'CUSTOM', name, date, mode, home, away } : { id, type: 'CUSTOM', name, date, mode, stadiums: [R.stadiumOf(home)] }); });
      u.selEvent = id;
    },
    'team-sel'(el) { u.selTeam = el.getAttribute('data-team'); R.render(); },
    'stadium-find'() {
      const q = document.getElementById('stadium-q').value;
      const res = KBO.MapKit.searchStadiums(q, KBO.Preset.STADIUMS);
      R.toast(res.length ? "'" + q + "' 검색: " + res.slice(0, 3).map((x) => x.name).join(', ') + (res.length > 3 ? ' 외 ' + (res.length - 3) : '') + ' — 시안에서는 추가하지 않습니다.' : "'" + q + "' 결과 없음", 'info');
    }
  });
  R.keys.cell = (el, e) => {
    if (e.key === 'Enter') { e.preventDefault(); u.edit.value = el.value; commitCell(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); u.edit = null; R.render(); }
  };
  R.inputs.cell = (el) => {
    const e = u.edit; if (!e) return;
    e.value = el.value;
    const err = validateCell(e);
    e.error = err;
    // 입력 중에는 전체를 다시 그리지 않고 오류 말풍선만 갱신한다
    const box = el.closest('.celledit');
    if (!box) return;
    box.classList.toggle('bad', !!err);
    el.setAttribute('aria-invalid', String(!!err));
    let bub = box.querySelector('.cellerr');
    if (err) {
      if (!bub) { bub = document.createElement('div'); bub.className = 'cellerr'; bub.id = 'cellerr'; bub.setAttribute('role', 'alert'); box.appendChild(bub); }
      bub.innerHTML = R.icon('block') + '<span>' + esc(err) + '</span>' + (e.fix != null ? '<button class="lnk" data-act="cell-fix">\'' + esc(e.fix) + '\'로 고치기</button>' : '');
    } else if (bub) bub.remove();
  };
  R.inputs.setting = (el) => {
    const k = el.getAttribute('data-k');
    const v = el.value;
    if (!v) return;
    R.commit('시즌 골격: ' + ({ seasonStart: '개막일', initialEnd: '1차 종료일', seasonEnd: '시즌 종료일' }[k]) + ' ' + D.fmtDate(v), (s) => { s.settings[k] = v; });
  };
  R.inputs['series-team'] = (el) => { u.seriesTeam = el.value; R.render(); };
  R.inputs.heat = (el) => { u.heatOpen = el.open; };
  document.addEventListener('toggle', (e) => { if (e.target && e.target.matches && e.target.matches('details[data-in="heat"]')) u.heatOpen = e.target.open; }, true);

  // 스크린샷용 고정 상태: #step=1&tab=series&edit=demo → 12행 원정 셀에 'LGG'를 입력한 상태
  R.demo = R.demo || {};
  R.demo.edit = (v, p) => {
    const tab = p.tab || 'series';
    if (tab === 'slots') { u.selRow.slots = 17; u.edit = { sheet: 'slots', row: 17, col: 'consecutive', value: '5', error: null }; }
    else { u.selRow.series = 11; u.edit = { sheet: 'series', row: 11, col: 'away', value: 'LGG', error: null }; }
    u.edit.error = validateCell(u.edit);
    u.scrollRow = 'row-' + u.edit.sheet + '-' + u.edit.row;
  };
  R.demo.selrow = (v, p) => { const tab = p.tab === 'slots' ? 'slots' : 'series'; u.selRow[tab] = +v - 1; u.scrollRow = 'row-' + tab + '-' + (+v - 1); };
})();
