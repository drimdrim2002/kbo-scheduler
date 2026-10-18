/*
 * alt-a 편성 스튜디오 — ① 데이터 준비
 * 위: 가져오기 띠 / 왼쪽: 시트 목록 / 가운데: 시트 표(한 건 편집) · 시즌 골격 폼 · 구단과 거리 / 오른쪽: 행 인스펙터
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, CalendarGen, Score } = KBO;
  const app = () => S.app;
  const D = () => S.app.derived();

  // ───────── 값 해석 (§4.2) ─────────
  const P = S.parse = {
    date(v) {
      const s = String(v == null ? '' : v).trim();
      let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s);
      if (m) return iso(+m[1], +m[2], +m[3]);
      m = /^(\d{1,2})\/(\d{1,2})(\([^)]*\))?$/.exec(s);
      if (m) return iso(2025, +m[1], +m[2]);
      return null;
      function iso(y, mo, d) { if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; const x = Dates.isoDate(Dates.dayNum(y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'))); return x; }
    },
    bool(v) { const s = String(v).trim().toUpperCase(); if (['1', 'Y', '예', 'TRUE', 'O'].includes(s)) return 1; if (['0', 'N', '아니오', 'FALSE', 'X', ''].includes(s)) return 0; return null; },
    int(v) { const s = String(v).trim(); return /^-?\d+$/.test(s) ? parseInt(s, 10) : null; }
  };
  function suggestTeam(v) {
    const names = app().state.teams.map((t) => t.name);
    const s = String(v).trim();
    const up = s.toUpperCase();
    let best = names.find((n) => n.toUpperCase() === up);
    if (best) return best;
    best = names.find((n) => up.startsWith(n.toUpperCase()) || n.toUpperCase().startsWith(up));
    if (best) return best;
    // 한 글자 차이
    return names.find((n) => lev(n.toUpperCase(), up) <= 1) || null;
  }
  S.suggestTeam = suggestTeam;
  function lev(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(new Array(b.length).fill(0)));
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  }
  const vTeam = (v) => {
    const names = app().state.teams.map((t) => t.name);
    if (names.includes(String(v).trim())) return null;
    const sg = suggestTeam(v);
    return { error: "알 수 없는 구단 '" + v + "'" + (sg ? " — '" + sg + "'인가요?" : ''), fix: sg };
  };
  const vDate = (v) => (P.date(v) ? null : { error: "날짜로 읽을 수 없는 값 '" + v + "' — 2025-06-03, 6/3, 6/3(화) 형식을 씁니다." });
  const vRange = (lo, hi, unit) => (v) => { const n = P.int(v); return n != null && n >= lo && n <= hi ? null : { error: lo + '~' + hi + ' 사이 정수여야 합니다' + (unit ? ' (' + unit + ')' : '') + ". 입력: '" + v + "'", fix: n != null ? String(Math.max(lo, Math.min(hi, n))) : null }; };

  // ───────── 시트 정의 ─────────
  const dateCell = (iso) => (iso ? fmt.date(iso) : '');
  const SHEETS = {
    slots: {
      label: '슬롯', sheet: '슬롯', unit: '슬롯', desc: '시리즈가 열리는 연속 경기일 묶음. 주 입력은 시트 가져오기입니다.',
      rows: (st) => st.calendar,
      cols: [
        { key: 'start', head: '시작일', alias: 'start', req: true, w: 130, get: (r) => r.datetime.slice(0, 10), show: (r) => dateCell(r.datetime.slice(0, 10)), validate: vDate, set: (r, v) => { r.datetime = P.date(v) + ' 00:00:00'; } },
        { key: 'games', head: '연전', alias: 'games', req: true, w: 70, num: true, get: (r) => r.consecutive, validate: vRange(2, 4, '연전'), set: (r, v) => { r.consecutive = P.int(v); } },
        { key: 'weekend', head: '주말', alias: 'weekend', w: 70, num: true, get: (r) => r.weekend, validate: (v) => (P.bool(v) == null ? { error: '1/0, Y/N, 예/아니오로 씁니다.' } : null), set: (r, v) => { r.weekend = P.bool(v); } },
        { key: 'holiday', head: '휴일가중치', alias: 'holiday', w: 96, num: true, get: (r) => r.holiday, validate: vRange(0, 3), set: (r, v) => { r.holiday = P.int(v); } },
        { key: 'days', head: '기간', w: 190, ro: true, show: (r) => { const d = Dates.dayNum(r.datetime); return fmt.date(d) + ' ~ ' + fmt.date(d + r.consecutive - 1); } },
        { key: 'note', head: '메모', alias: 'note', w: 0, get: (r) => r.note || '', set: (r, v) => { r.note = String(v); } }
      ],
      rowIssues(st, i) {
        const r = st.calendar[i], out = [];
        const d = Dates.dayNum(r.datetime);
        if (i > 0) { const p = st.calendar[i - 1]; const pe = Dates.dayNum(p.datetime) + p.consecutive - 1; if (d <= pe) out.push({ level: 'error', col: 'start', msg: '직전 슬롯(' + fmt.date(Dates.dayNum(p.datetime)) + ' ' + p.consecutive + '연전)과 날짜가 겹칩니다.' }); }
        if (r.consecutive < 2 || r.consecutive > 4) out.push({ level: 'error', col: 'games', msg: '연전은 2~4입니다.' });
        if (r.datetime.slice(0, 10) < st.settings.seasonStart || r.datetime.slice(0, 10) > st.settings.initialEnd) out.push({ level: 'warn', col: 'start', msg: '1차 편성 기간(' + fmt.date(st.settings.seasonStart) + '~' + fmt.date(st.settings.initialEnd) + ') 밖입니다.' });
        return out;
      },
      blank: (st, i) => { const p = st.calendar[i] || st.calendar[st.calendar.length - 1]; const d = Dates.dayNum(p.datetime) + p.consecutive; return { index: 0, datetime: Dates.isoDate(d) + ' 00:00:00', consecutive: 3, weekend: 0, holiday: 0, note: '새 행' }; },
      insert(s, at, row) { s.calendar.splice(at, 0, row); s.calendar.forEach((c, k) => { c.index = k; }); for (const p of s.plan) if (p.calendar >= at) p.calendar++; },
      remove(s, at) { s.calendar.splice(at, 1); s.calendar.forEach((c, k) => { c.index = k; }); for (const p of s.plan) { if (p.calendar === at) p.calendar = -1; else if (p.calendar > at) p.calendar--; } },
      assist: { act: 'draft-slots', label: '규칙으로 초안 만들기' }
    },
    series: {
      label: '시리즈', sheet: '시리즈', unit: '시리즈', desc: '같은 두 구단이 같은 구장에서 치르는 2~4연전. 고정·슬롯은 ③에서 다룹니다.',
      rows: (st) => st.matches,
      cols: [
        { key: 'home', head: '홈', alias: 'home', req: true, w: 120, get: (r) => r.home, show: (r) => S.team(r.home) + (r.pinned ? ' <span class="muted" title="개막전 대진 지정으로 고정(③에서 관리)">' + icon('pin') + '</span>' : ''), html: true, validate: (v, r) => vTeam(v) || (String(v).trim() === r.away ? { error: '홈과 원정이 같습니다.' } : null), set: (r, v) => { r.home = String(v).trim(); } },
        { key: 'away', head: '원정', alias: 'away', req: true, w: 120, get: (r) => r.away, show: (r) => S.team(r.away), html: true, validate: (v, r) => vTeam(v) || (String(v).trim() === r.home ? { error: '홈과 원정이 같습니다.' } : null), set: (r, v) => { r.away = String(v).trim(); } },
        { key: 'games', head: '연전', alias: 'games', req: true, w: 70, num: true, get: (r) => r.consecutive, validate: vRange(2, 4, '연전'), set: (r, v) => { r.consecutive = P.int(v); } },
        { key: 'stadium', head: '구장', w: 170, ro: true, show: (r) => esc(((app().team(r.home) || {}).stadium) || '-'), html: true },
        { key: 'slot', head: '현재 배정(③)', w: 150, ro: true, show: (r, i) => { const c = D(); const sl = c.plan[i]; return sl >= 0 ? esc(c.slots[sl].label) : '<span class="muted">미배정</span>'; }, html: true },
        { key: 'pair', head: '구단쌍 경기', w: 100, ro: true, show: (r) => { const n = app().state.matches.filter((m) => (m.home === r.home && m.away === r.away) || (m.home === r.away && m.away === r.home)).reduce((a, m) => a + m.consecutive, 0); return n + '경기'; } },
        { key: 'note', head: '메모', alias: 'note', w: 120, get: (r) => r.note || '', set: (r, v) => { r.note = String(v); } }
      ],
      rowIssues(st, i) {
        const r = st.matches[i], out = [];
        const names = new Set(st.teams.map((t) => t.name));
        if (!names.has(r.home)) out.push({ level: 'error', col: 'home', msg: "알 수 없는 구단 '" + r.home + "'" });
        if (!names.has(r.away)) out.push({ level: 'error', col: 'away', msg: "알 수 없는 구단 '" + r.away + "'" });
        if (r.home === r.away) out.push({ level: 'error', col: 'away', msg: '홈과 원정이 같습니다.' });
        if (r.consecutive < 2 || r.consecutive > 4) out.push({ level: 'error', col: 'games', msg: '연전은 2~4입니다.' });
        return out;
      },
      blank: (st, i) => { const p = st.matches[i] || st.matches[0]; return { index: 0, home: p.home, away: p.away, consecutive: p.consecutive, pinned: false, note: '새 행' }; },
      insert(s, at, row) {
        const oldCal = s.plan.slice().sort((a, b) => a.match - b.match).map((p) => p.calendar);
        s.matches.splice(at, 0, row); s.matches.forEach((m, k) => { m.index = k; });
        oldCal.splice(at, 0, -1);
        s.plan = oldCal.map((c, k) => ({ match: k, calendar: c }));
      },
      remove(s, at) {
        const oldCal = s.plan.slice().sort((a, b) => a.match - b.match).map((p) => p.calendar);
        s.matches.splice(at, 1); s.matches.forEach((m, k) => { m.index = k; });
        oldCal.splice(at, 1);
        s.plan = oldCal.map((c, k) => ({ match: k, calendar: c }));
      },
      assist: { act: 'draft-series', label: '구단쌍 규칙으로 만들기' }
    },
    holidays: {
      label: '공휴일', sheet: '공휴일', unit: '일', parent: 'season', desc: '휴일 가중치 계산에 쓰는 공휴일. 같은 날짜는 한 번만.',
      rows: (st) => st.settings.holidays,
      cols: [
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 130, get: (r) => r.date, show: (r) => dateCell(r.date), validate: vDate, set: (r, v) => { r.date = P.date(v); } },
        { key: 'name', head: '이름', alias: 'name', req: true, w: 200, get: (r) => r.name, validate: (v) => (String(v).trim() ? null : { error: '이름이 비었습니다.' }), set: (r, v) => { r.name = String(v).trim(); } },
        { key: 'slot', head: '속한 슬롯', w: 0, ro: true, show: (r) => { const i = CalendarGen.slotIndexOfDate(app().state.calendar, r.date); return i >= 0 ? D().slots[i].label : '<span class="muted">경기 없음</span>'; }, html: true }
      ],
      rowIssues(st, i) { const r = st.settings.holidays[i]; return st.settings.holidays.some((h, k) => k !== i && h.date === r.date) ? [{ level: 'error', col: 'date', msg: '같은 날짜가 두 번 있습니다.' }] : []; },
      blank: () => ({ date: '2025-06-03', name: '새 공휴일' }),
      insert(s, at, row) { s.settings.holidays.splice(at, 0, row); },
      remove(s, at) { s.settings.holidays.splice(at, 1); }
    },
    restex: {
      label: '휴식예외일', sheet: '휴식예외일', unit: '일', parent: 'season', desc: '휴식 요일이지만 경기를 하는 날. 예: 5/5(월) 어린이날.',
      rows: (st) => st.settings.restExceptions.map((d) => ({ date: d })),
      cols: [
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 130, get: (r) => r.date, show: (r) => dateCell(r.date), validate: vDate, setAt: (s, i, v) => { s.settings.restExceptions[i] = P.date(v); } },
        { key: 'note', head: '메모', alias: 'note', w: 0, ro: true, show: (r) => { const h = (app().state.settings.holidays || []).find((x) => x.date === r.date); return esc(h ? h.name : ''); }, html: true }
      ],
      rowIssues(st, i) { const d = st.settings.restExceptions[i]; return st.settings.restWeekdays.includes(Dates.weekday(d)) ? [] : [{ level: 'warn', col: 'date', msg: '휴식 요일이 아닌 날입니다(효과 없음).' }]; },
      blank: () => '2025-06-02',
      insert(s, at, row) { s.settings.restExceptions.splice(at, 0, typeof row === 'string' ? row : row.date); },
      remove(s, at) { s.settings.restExceptions.splice(at, 1); }
    },
    blackouts: {
      label: '경기없는기간', sheet: '경기없는기간', unit: '건', parent: 'season', desc: '올스타 브레이크처럼 경기를 하지 않는 기간. 하루짜리는 시작 = 종료.',
      rows: (st) => st.settings.blackouts,
      cols: [
        { key: 'start', head: '시작일', alias: 'start', req: true, w: 130, get: (r) => r.start, show: (r) => dateCell(r.start), validate: vDate, set: (r, v) => { r.start = P.date(v); } },
        { key: 'end', head: '종료일', alias: 'end', req: true, w: 130, get: (r) => r.end, show: (r) => dateCell(r.end), validate: vDate, set: (r, v) => { r.end = P.date(v); } },
        { key: 'name', head: '이름', alias: 'name', req: true, w: 0, get: (r) => r.label || '', set: (r, v) => { r.label = String(v).trim(); } }
      ],
      rowIssues(st, i) { const r = st.settings.blackouts[i]; return r.start > r.end ? [{ level: 'error', col: 'end', msg: '시작일이 종료일보다 늦습니다.' }] : []; },
      blank: () => ({ start: '2025-08-18', end: '2025-08-18', label: '새 기간' }),
      insert(s, at, row) { s.settings.blackouts.splice(at, 0, row); },
      remove(s, at) { s.settings.blackouts.splice(at, 1); }
    },
    events: {
      label: '이벤트', sheet: '이벤트', unit: '건', desc: '대진 지정은 그 슬롯에 시리즈를 고정하고, 구장 지정은 연고 구단의 홈 의무입니다.',
      rows: (st) => st.events,
      cols: [
        { key: 'name', head: '이름', alias: 'name', req: true, w: 110, get: (r) => r.name, set: (r, v) => { r.name = String(v).trim(); } },
        { key: 'type', head: '유형', alias: 'type', req: true, w: 90, ro: true, show: (r) => ({ OPENING: '개막전', CHILDREN: '어린이날', CUSTOM: '사용자정의' }[r.type] || r.type) },
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 110, get: (r) => r.date, show: (r) => dateCell(r.date), validate: (v) => vDate(v) || (CalendarGen.slotIndexOfDate(app().state.calendar, P.date(v)) < 0 ? { error: fmt.date(P.date(v)) + '은(는) 어느 슬롯에도 없습니다.' } : null), set: (r, v) => { r.date = P.date(v); } },
        { key: 'mode', head: '방식', alias: 'mode', req: true, w: 70, ro: true, show: (r) => (r.mode === 'MATCH' ? '대진' : '구장') },
        { key: 'home', head: '홈', alias: 'home', w: 90, get: (r) => r.home || '', show: (r) => (r.home ? S.team(r.home) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.home = String(v).trim(); } },
        { key: 'away', head: '원정', alias: 'away', w: 90, get: (r) => r.away || '', show: (r) => (r.away ? S.team(r.away) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.away = String(v).trim(); } },
        { key: 'stadiums', head: '구장', alias: 'stadiums', w: 0, ro: true, show: (r) => esc((r.stadiums || []).join(', ')) , html: true }
      ],
      rowIssues(st, i) {
        const e = st.events[i];
        const out = [];
        if (CalendarGen.slotIndexOfDate(st.calendar, e.date) < 0) out.push({ level: 'error', col: 'date', msg: '날짜가 슬롯 안에 없습니다.' });
        for (const iss of app().checkEvents()) if (iss.events.includes(e.id)) out.push({ level: iss.level === 'block' ? 'error' : 'warn', col: 'name', msg: iss.message });
        return out;
      },
      blank: () => ({ id: 'ev-' + Date.now().toString(36), type: 'CUSTOM', name: '새 이벤트', date: '2025-08-15', mode: 'STADIUM', stadiums: ['사직야구장'] }),
      insert(s, at, row) { s.events.splice(at, 0, row); },
      remove(s, at) { const e = s.events[at]; s.events.splice(at, 1); for (const m of s.matches) if (m.eventId === e.id) { delete m.eventId; m.pinned = false; } }
    }
  };
  S.SHEETS = SHEETS;
  const colLetter = (i) => String.fromCharCode(65 + i);
  const visibleCols = (sh) => sh.cols;

  // ───────── 편집 상태 ─────────
  S.draftErrors = () => (S.ui.edit && S.ui.edit.error ? 1 : 0);
  function rowsOf(key) { return SHEETS[key].rows(app().state); }
  function cellIssue(key, i, colKey) {
    const iss = SHEETS[key].rowIssues(app().state, i);
    return iss.find((x) => x.col === colKey) || null;
  }
  function sheetIssueCount(key) {
    const sh = SHEETS[key];
    const n = rowsOf(key).length;
    let e = 0, w = 0;
    for (let i = 0; i < n; i++) for (const x of sh.rowIssues(app().state, i)) { if (x.level === 'error') e++; else w++; }
    if (S.ui.edit && S.ui.edit.sheet === key && S.ui.edit.error) e++;
    return { e, w };
  }

  // ───────── 가져오기 띠 ─────────
  function renderBand() {
    const li = S.ui.lastImport;
    const locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    return '<div class="band">' +
      '<span class="band-title">' + icon('sheet') + ' 가져오기</span>' +
      '<button class="btn primary sm" data-act="import-xlsx"' + (locked ? ' disabled' : '') + '>' + icon('upload') + '.xlsx 업로드</button>' +
      '<button class="btn sm" data-act="import-gsheet"' + (locked ? ' disabled' : '') + '>' + icon('link') + '구글 시트 연결</button>' +
      '<span class="drop-hint">' + icon('file') + '또는 .xlsx 파일을 여기로 끌어 놓기</span>' +
      '<span class="sep" style="width:1px;height:18px;background:var(--line);margin:0 4px"></span>' +
      '<button class="btn sm" data-act="export" data-kind="template">' + icon('file') + '빈 양식</button>' +
      '<button class="btn sm" data-act="export" data-kind="xlsx">' + icon('download') + '.xlsx 내보내기</button>' +
      '<span class="last">' + (li
        ? S.stat('ok', '적용됨') + '<span>' + esc(li.source) + ' · ' + esc(li.sheets) + ' · ' + esc(li.time) + '</span>' + (li.kind === 'gsheet' ? '<button class="btn xs" data-act="import-gsheet-reload">' + icon('redo') + '다시 불러오기</button>' : '')
        : '<span class="muted">현재 데이터: 2025 프리셋(내장)</span>') + S.mock() + '</span>' +
      '</div>';
  }

  // ───────── 왼쪽 시트 목록 ─────────
  function renderList() {
    const st = app().state, u = S.ui;
    const item = (key, label, cnt, opts) => {
      const o = opts || {};
      const iss = o.issues || { e: 0, w: 0 };
      const statusIco = iss.e ? '<span class="st plain bad" title="오류 ' + iss.e + '">' + icon('x') + iss.e + '</span>' : iss.w ? '<span class="st plain warn" title="경고 ' + iss.w + '">' + icon('warn') + iss.w + '</span>' : '<span class="st plain ok" title="문제 없음">' + icon('check') + '</span>';
      return '<button class="li' + (o.child ? ' child' : '') + (u.tab === key ? ' active' : '') + (u.flash === key ? ' flash' : '') + '" data-act="d-tab" data-tab="' + key + '">' +
        '<span class="ico">' + icon(o.icon || 'sheet') + '</span><span class="li-main">' + esc(label) + (o.sub ? '<span class="li-sub">' + esc(o.sub) + '</span>' : '') + '</span>' +
        '<span class="cnt">' + esc(cnt) + '</span>' + statusIco + '</button>';
    };
    let s = '<div class="pane-head"><span class="pane-title">시즌 데이터</span><span class="pane-desc">시트 6 · UI 입력 2</span></div><div class="pane-body" data-sk="d-list">';
    s += '<div class="label">일정 골격</div>';
    s += item('season', '시즌 골격', '', { icon: 'cal', sub: 'UI 입력 · 개막·종료·휴식 요일' });
    s += item('holidays', '공휴일', st.settings.holidays.length, { child: true, issues: sheetIssueCount('holidays') });
    s += item('restex', '휴식예외일', st.settings.restExceptions.length, { child: true, issues: sheetIssueCount('restex') });
    s += item('blackouts', '경기없는기간', st.settings.blackouts.length, { child: true, issues: sheetIssueCount('blackouts') });
    s += '<div class="label">편성 대상</div>';
    s += item('slots', '슬롯', st.calendar.length, { icon: 'grid', sub: '시트 · 2/3/4연전 ' + histText(st.calendar), issues: sheetIssueCount('slots') });
    s += item('series', '시리즈', st.matches.length, { icon: 'list', sub: '시트 · 구단쌍 45 × 5', issues: sheetIssueCount('series') });
    s += item('events', '이벤트', st.events.length, { icon: 'target', sub: '시트 · 대진 지정 ' + st.events.filter((e) => e.mode === 'MATCH').length + ' · 구장 지정 ' + st.events.filter((e) => e.mode === 'STADIUM').length, issues: sheetIssueCount('events') });
    s += '<div class="label">구단</div>';
    s += item('teams', '구단과 거리', st.teams.length, { icon: 'team', sub: 'UI 입력 · 공유 구장 1 · 거리 90' });
    s += '<div class="list-sep"></div><div class="label">가져오기 기록</div>';
    const hist = (S.importHistory || []).slice().reverse();
    s += hist.map((h) => '<div class="small" style="padding:3px 12px 5px;display:flex;gap:6px;align-items:flex-start"><span class="ico" style="color:var(--text-3)">' + icon(h.kind === 'gsheet' ? 'link' : h.kind === 'preset' ? 'db' : 'upload') + '</span><span><b style="font-weight:600">' + esc(h.source) + '</b><br><span class="muted">' + esc(h.detail) + '</span></span></div>').join('');
    s += '</div>';
    return s;
  }
  function histText(cal) { const h = CalendarGen.lengthHistogram(cal); return [2, 3, 4].map((k) => h[k] || 0).join('/'); }
  S.importHistory = [{ kind: 'preset', source: '2025 프리셋 (내장)', detail: '시트 6개 · 1/14(화) 09:00' }];

  // ───────── 가운데: 시트 표 ─────────
  function renderSheet(key) {
    const sh = SHEETS[key], st = app().state, u = S.ui;
    const rows = sh.rows(st);
    const cols = visibleCols(sh);
    const cur = u.cell && u.cell.sheet === key ? u.cell : null;
    const selRow = cur ? cur.row : -1;
    const locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    let s = '<div class="toolbar">' +
      '<span class="pane-title">' + esc(sh.label) + '</span><span class="muted small">' + rows.length + '행</span>' +
      '<span class="pane-desc" style="max-width:420px">' + esc(sh.desc) + '</span>' +
      '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' +
      '<span class="btn-group">' +
      '<button class="btn sm" data-act="row-ins" data-pos="above"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 행 위에 삽입">' + icon('rowAbove') + '위에 삽입</button>' +
      '<button class="btn sm" data-act="row-ins" data-pos="below"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 행 아래에 삽입">' + icon('rowBelow') + '아래 삽입</button>' +
      '<button class="btn sm danger" data-act="row-del"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 행 삭제">' + icon('trash') + '삭제</button></span>' +
      S.undoButtons() +
      (sh.assist ? '<span class="sep" style="width:1px;height:18px;background:var(--line);margin:0 2px"></span><button class="btn sm" data-act="' + sh.assist.act + '" title="보조 생성 — 결과는 미리보기를 거쳐 반영됩니다">' + icon('bolt') + esc(sh.assist.label) + '</button>' : '') +
      '</span></div>';
    if (locked) s += '<div class="lockbar">' + icon('lock') + '엔진 실행 중에는 입력이 잠깁니다. ② 검토·실행에서 중지하면 다시 고칠 수 있습니다.</div>';
    // 열 너비
    s += '<div class="pane-body xy" data-sk="d-sheet-' + key + '" id="sheetScroll"><table class="sheet" role="grid" aria-label="' + esc(sh.label) + ' 시트"><colgroup><col style="width:44px">' + cols.map((c) => '<col' + (c.w ? ' style="width:' + c.w + 'px"' : '') + '>').join('') + '<col style="width:64px"></colgroup>';
    s += '<thead><tr><th class="rn">행</th>' + cols.map((c, ci) => '<th' + (c.num ? ' class="num"' : '') + ' title="' + esc(c.alias ? c.head + '(' + c.alias + ')' : c.head + ' — 계산값(읽기 전용)') + '"><span class="col">' + (c.ro ? '계산' : colLetter(sheetColIndex(sh, c))) + '</span>' + esc(c.head) + (c.req ? '<span class="req">*</span>' : '') + '</th>').join('') + '<th>검증</th></tr></thead><tbody>';
    rows.forEach((r, i) => {
      const iss = sh.rowIssues(st, i);
      const isNew = r && r._uiNew;
      s += '<tr class="' + (i === selRow ? 'sel' : '') + (isNew ? ' newrow' : '') + '" data-row="' + i + '"><td class="rn">' + (i + 2) + '</td>';
      cols.forEach((c) => {
        const editing = u.edit && u.edit.sheet === key && u.edit.row === i && u.edit.col === c.key;
        const focus = cur && cur.row === i && cur.col === c.key;
        const ci = iss.find((x) => x.col === c.key && x.level === 'error');
        if (editing) {
          const e = u.edit;
          s += '<td class="cell editing' + (e.error ? ' err' : '') + '"><input id="cellEditor" data-edit="1" value="' + esc(e.value) + '" aria-label="' + esc(c.head) + ' 편집" aria-invalid="' + (e.error ? 'true' : 'false') + '">' +
            (e.error ? '<div class="cell-pop" role="alert"><b>' + icon('x') + esc(sh.sheet + ' ' + (i + 2) + '행 · ' + colLetter(sheetColIndex(sh, c)) + '열(' + c.head + ')') + '</b>' + esc(e.error) +
              '<div class="acts">' + (e.fix ? '<button class="btn xs primary" data-act="cell-fix">' + icon('check') + "'" + esc(e.fix) + "'(으)로 바꾸기</button>" : '') + '<button class="btn xs" data-act="cell-cancel">취소 <span class="kbd">Esc</span></button></div></div>' : '') + '</td>';
        } else {
          const val = c.show ? c.show(r, i) : esc(c.get(r));
          s += '<td class="' + (c.ro ? 'ro' : 'cell') + (c.num ? ' num' : '') + (focus ? ' focus' : '') + (ci ? ' err' : '') + '" data-act="cell" data-row="' + i + '" data-col="' + c.key + '"' + (ci ? ' title="' + esc(ci.msg) + '"' : '') + '>' + (c.html || c.show ? (c.html ? val : esc(val)) : val) + (isNew && c.key === cols[0].key ? ' <span class="tag new">새 행</span>' : '') + '</td>';
        }
      });
      const worst = iss.find((x) => x.level === 'error') ? 'bad' : iss.length ? 'warn' : 'ok';
      s += '<td>' + (worst === 'ok' ? '<span class="st plain ok">' + icon('check') + '정상</span>' : worst === 'bad' ? '<span class="st plain bad" title="' + esc(iss.map((x) => x.msg).join(' / ')) + '">' + icon('x') + '오류</span>' : '<span class="st plain warn" title="' + esc(iss.map((x) => x.msg).join(' / ')) + '">' + icon('warn') + '경고</span>') + '</td></tr>';
    });
    s += '</tbody></table></div>';
    s += '<div class="pane-foot small muted">' + icon('info') + '셀을 고르고 <span class="kbd">Enter</span> 또는 더블클릭으로 편집 · 화살표로 이동 · <span class="kbd">Esc</span> 취소 · 편집은 실행 취소 대상입니다. 여러 행 편집·붙여넣기는 엑셀에서 하고 다시 가져옵니다.</div>';
    return s;
  }
  function sheetColIndex(sh, col) { return sh.cols.filter((c) => !c.ro).indexOf(col); }

  // ───────── 시즌 골격 ─────────
  function renderSeason() {
    const st = app().state, set = st.settings;
    const wd = ['일', '월', '화', '수', '목', '금', '토'];
    let s = '<div class="pane-head"><span class="pane-title">시즌 골격</span><span class="pane-desc">개막·종료일과 휴식 요일은 UI에서만 입력합니다. 공휴일·예외일·경기 없는 기간은 왼쪽 하위 시트입니다.</span></div>';
    s += '<div class="pane-body pad" data-sk="d-season">';
    s += '<div class="blk"><div class="blk-head">기간과 휴식 요일</div><div class="blk-body"><div class="form-grid">' +
      '<label class="field"><span>개막일 *</span><input class="input" data-in="season" data-k="seasonStart" value="' + esc(fmt.date(set.seasonStart)) + '"></label>' +
      '<label class="field"><span>1차 편성 종료일 *</span><input class="input" data-in="season" data-k="initialEnd" value="' + esc(fmt.date(set.initialEnd)) + '"></label>' +
      '<label class="field"><span>시즌 종료일 *</span><input class="input" data-in="season" data-k="seasonEnd" value="' + esc(fmt.date(set.seasonEnd)) + '"></label>' +
      '<div class="field"><span>휴식 요일 (복수 선택)</span><div class="wd">' + wd.map((n, i) => '<button class="' + (set.restWeekdays.includes(i) ? 'on' : '') + '" data-act="rest-wd" data-wd="' + i + '" aria-pressed="' + set.restWeekdays.includes(i) + '">' + n + '</button>').join('') + '</div></div>' +
      '</div></div></div>';
    // 시즌 띠
    const hol = new Set(set.holidays.map((h) => Dates.dayNum(h.date)));
    const black = new Set();
    for (const b of set.blackouts) for (let d = Dates.dayNum(b.start); d <= Dates.dayNum(b.end); d++) black.add(d);
    const isGame = CalendarGen.gameDayPredicate(set);
    const slotStart = new Set(D().slots.map((x) => x.day));
    const inSlot = D().dayToSlot;
    s += '<div class="blk" style="margin-top:12px"><div class="blk-head">시즌 띠 <span class="muted small" style="font-weight:400">현재 슬롯 기준 · 3월~10월</span><span class="r legend"><span><i style="background:#D3DFF5"></i>경기일</span><span><i style="background:#A9C1EC"></i>주말</span><span><i style="background:#F7F7F8;border:1px solid #E2E5EA"></i>휴식</span><span><i style="background:repeating-linear-gradient(135deg,#F3D9B5 0 3px,#FBEEDB 3px 6px)"></i>경기 없는 기간</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #B3261E;border-radius:50%;width:8px;height:8px"></i>공휴일</span><span><i style="box-shadow:inset 2px 0 0 #0A1E3C;background:#D3DFF5"></i>슬롯 시작</span></span></div><div class="blk-body"><div class="strip">';
    for (let mo = 3; mo <= 10; mo++) {
      s += '<div class="strip-row"><span class="m">' + mo + '월</span><div class="strip-days">';
      for (let d = 1; d <= 31; d++) {
        const ds = '2025-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const n = Dates.dayNum(ds);
        if (Dates.month(n) !== mo) { s += '<span class="sd out"></span>'; continue; }
        const w = Dates.weekday(n);
        let cls = 'sd';
        if (inSlot.has(n)) cls += ' game' + (w === 0 || w === 6 ? ' we' : '');
        else if (black.has(n)) cls += ' black';
        else if (!isGame(n) || ds > set.initialEnd || ds < set.seasonStart) cls += ' rest';
        if (hol.has(n)) cls += ' hol';
        if (slotStart.has(n)) cls += ' slotstart';
        s += '<span class="' + cls + '" title="' + esc(fmt.date(n)) + '">' + d + '</span>';
      }
      s += '</div></div>';
    }
    s += '</div><div class="small muted" style="margin-top:8px">9~10월은 재편성 기간입니다(시즌 운영 메뉴).</div></div></div>';
    const sub = (k, title, lines) => '<div class="blk"><div class="blk-head">' + icon('sheet') + esc(title) + '<span class="r"><span class="muted small">' + lines.length + '행</span><button class="btn xs" data-act="d-tab" data-tab="' + k + '">시트 열기' + icon('right') + '</button></span></div><div class="blk-body small" style="padding:6px 10px;display:flex;flex-direction:column;gap:2px">' + (lines.length ? lines.slice(0, 4).map((x) => '<div>' + x + '</div>').join('') + (lines.length > 4 ? '<div class="muted">외 ' + (lines.length - 4) + '건</div>' : '') : '<span class="muted">없음</span>') + '</div></div>';
    s += '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px">' +
      sub('holidays', '공휴일', set.holidays.map((h) => '<span class="mono">' + esc(fmt.date(h.date)) + '</span> ' + esc(h.name))) +
      sub('restex', '휴식예외일', set.restExceptions.map((d) => '<span class="mono">' + esc(fmt.date(d)) + '</span> 휴식 요일이지만 경기')) +
      sub('blackouts', '경기없는기간', set.blackouts.map((b) => '<span class="mono">' + esc(fmt.date(b.start) + (b.end !== b.start ? ' ~ ' + fmt.date(b.end) : '')) + '</span> ' + esc(b.label || ''))) + '</div>';
    s += '</div>';
    return s;
  }

  // ───────── 구단과 거리 ─────────
  function renderTeams() {
    const st = app().state, u = S.ui;
    const sel = u.cell && u.cell.sheet === 'teams' ? u.cell.row : -1;
    const shared = app().sharedStadiums();
    let s = '<div class="pane-head"><span class="pane-title">구단과 거리</span><span class="pane-desc">구단 표와 작은 지도로 줄였습니다. 거리 행렬은 접어 둡니다. UI에서만 입력합니다.</span></div>';
    s += '<div class="pane-body pad" data-sk="d-teams"><div style="display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:12px;align-items:start">';
    s += '<div class="blk"><table class="sheet"><colgroup><col style="width:44px"><col style="width:110px"><col><col style="width:86px"><col style="width:86px"></colgroup><thead><tr><th class="rn">#</th><th>구단</th><th>구장</th><th class="num">위도</th><th class="num">경도</th></tr></thead><tbody>' +
      st.teams.map((t, i) => {
        const sh = Array.from(shared.keys()).includes(t.stadium);
        return '<tr class="' + (i === sel ? 'sel' : '') + '"><td class="rn">' + (i + 1) + '</td><td class="cell" data-act="team-sel" data-row="' + i + '">' + S.team(t.name) + '</td><td class="cell" data-act="team-sel" data-row="' + i + '">' + esc(t.stadium) + (sh ? ' <span class="tag shared">공유 구장</span>' : '') + '</td><td class="num mono">' + t.latitude.toFixed(4) + '</td><td class="num mono">' + t.longitude.toFixed(4) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    const markers = st.teams.map((t, i) => ({ id: t.name, lat: t.latitude, lon: t.longitude, x: 0, y: 0, color: t.color, label: t.name, size: i === sel ? 7 : 5, active: i === sel }));
    let mapSvg = '';
    try {
      const proj = KBO.MapKit.projection(250);
      for (const mk of markers) { const p = proj.project(mk.lat, mk.lon); mk.x = p[0]; mk.y = p[1]; }
      mapSvg = KBO.MapKit.render({ width: 250, markers, grid: false, spread: 10, title: '구장 위치' }).svg;
    } catch (e) { mapSvg = '<div class="empty">지도를 그릴 수 없습니다.</div>'; }
    s += '<div class="blk"><div class="blk-head">' + icon('map') + '구장 지도<span class="r"><span class="tag ref">내장 SVG</span></span></div><div class="blk-body mapbox" style="padding:6px">' + mapSvg + '</div>' +
      (S.feature('T4') ? '<div class="pane-foot small" data-feature="T4">' + icon('move') + '마커를 끌어 좌표를 미세 조정합니다 <span class="tag ref">FR-T4</span></div>' : '') + '</div>';
    s += '</div>';
    if (S.feature('T7')) {
      const names = st.teams.map((t) => t.name);
      const values = names.map((a) => names.map((b) => (a === b ? null : app().distanceOf(a, b))));
      s += '<details class="fold" style="margin-top:12px" data-feature="T7"><summary>' + icon('grid') + '거리 행렬 히트맵 <span class="muted">10 × 10 · km · 대칭 편집 켜짐</span></summary><div style="padding:8px 10px" class="chart-box">' +
        KBO.Chart.heatmap({ rows: names, cols: names, values, cellW: 52, cellH: 24, labelW: 50, format: (v) => (v == null ? '' : Math.round(v)), title: '구단 간 이동거리' }) + '</div></details>';
    }
    s += '</div>';
    return s;
  }

  // ───────── 인스펙터 ─────────
  function renderInsp() {
    const u = S.ui, st = app().state, key = u.tab;
    if (key === 'season') {
      const gen = CalendarGen.generateSlots(st.settings);
      const same = !app().slotsOutOfDate();
      const h = CalendarGen.lengthHistogram(gen.slots);
      return { title: '규칙 미리보기', html: '<div class="insp-sec"><h4>규칙으로 만든 슬롯 (§5.2.1)</h4><dl class="props"><dt>슬롯 수</dt><dd><b>' + gen.slots.length + '</b></dd><dt>연전 분포</dt><dd>2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + '</dd><dt>현재 슬롯</dt><dd>' + (same ? S.stat('ok', '같음') : S.stat('warn', '다름')) + '</dd><dt>경기일 구간</dt><dd>' + gen.runs.length + '개</dd></dl>' +
        '<button class="btn sm" style="margin-top:10px" data-act="draft-slots">' + icon('bolt') + '규칙으로 초안 만들기</button><div class="small muted" style="margin-top:6px">바로 반영하지 않고 가져오기 미리보기를 거칩니다.</div></div>' +
        '<div class="insp-sec"><h4>하위 시트</h4>' + ['holidays', 'restex', 'blackouts'].map((k) => '<button class="li" data-act="d-tab" data-tab="' + k + '" style="padding-left:4px"><span class="ico">' + icon('sheet') + '</span><span class="li-main">' + SHEETS[k].label + '</span><span class="cnt">' + rowsOf(k).length + '</span>' + icon('right') + '</button>').join('') + '</div>' };
    }
    if (key === 'teams') {
      const i = u.cell && u.cell.sheet === 'teams' ? u.cell.row : -1;
      if (i < 0) return { title: '구단', html: '<div class="empty"><b>구단을 고르세요</b>표에서 구단을 고르면 구장·좌표·거리를 보여 줍니다.</div>' };
      const t = st.teams[i];
      const others = st.teams.filter((x) => x.name !== t.name).map((x) => ({ n: x.name, d: app().distanceOf(t.name, x.name) })).sort((a, b) => a.d - b.d);
      return { title: '구단 상세', html: '<div class="insp-sec"><div class="insp-title">' + S.team(t.name) + '</div><div class="insp-sub">' + esc(t.stadium) + '</div></div>' +
        '<div class="insp-sec"><h4>속성</h4><dl class="props"><dt>구단명</dt><dd><input class="input sm" value="' + esc(t.name) + '" data-in="team-field" data-row="' + i + '" data-k="name"></dd><dt>구장</dt><dd><input class="input sm" value="' + esc(t.stadium) + '" data-in="team-field" data-row="' + i + '" data-k="stadium"></dd><dt>위도·경도</dt><dd class="mono">' + t.latitude.toFixed(4) + ', ' + t.longitude.toFixed(4) + '</dd><dt>색</dt><dd><span class="tm"><i style="background:' + esc(t.color) + ';width:14px;height:14px"></i>' + esc(t.color) + '</span></dd></dl></div>' +
        '<div class="insp-sec"><h4>다른 구장까지 거리<span class="r">km</span></h4>' + others.map((o) => '<div style="display:flex;justify-content:space-between;height:22px;align-items:center" class="small">' + S.team(o.n) + '<span class="mono">' + fmt.km(o.d) + '</span></div>').join('') + '</div>' };
    }
    const sh = SHEETS[key];
    const i = u.cell && u.cell.sheet === key ? u.cell.row : -1;
    const rows = rowsOf(key);
    if (i < 0 || i >= rows.length) {
      const c = sheetIssueCount(key);
      return { title: sh.label + ' 시트', html: '<div class="insp-sec"><h4>시트 요약</h4><dl class="props"><dt>행 수</dt><dd><b>' + rows.length + '</b></dd><dt>오류</dt><dd>' + (c.e ? S.stat('block', c.e + '건') : S.stat('ok', '0')) + '</dd><dt>경고</dt><dd>' + (c.w ? S.stat('warn', c.w + '건') : S.stat('ok', '0')) + '</dd><dt>열</dt><dd class="small">' + sh.cols.filter((x) => !x.ro).map((x) => x.head + (x.req ? '*' : '')).join(' · ') + '</dd></dl></div><div class="empty"><b>행을 고르세요</b>행을 고르면 값 편집, 검증 결과, 관련 정보가 여기에 나옵니다.</div>' };
    }
    const r = rows[i];
    const iss = sh.rowIssues(st, i);
    let s = '<div class="insp-sec"><div class="insp-title">' + esc(sh.sheet) + ' ' + (i + 2) + '행' + (r && r._uiNew ? '<span class="tag new">새 행</span>' : '') + '</div><div class="insp-sub">시트 행 번호는 머리글을 1행으로 셉니다.</div></div>';
    s += '<div class="insp-sec"><h4>값</h4><dl class="props">' + sh.cols.map((c) => {
      const editing = u.edit && u.edit.sheet === key && u.edit.row === i && u.edit.col === c.key;
      const err = editing && u.edit.error ? u.edit.error : null;
      if (c.ro) return '<dt>' + esc(c.head) + '</dt><dd class="small">' + (c.html ? c.show(r, i) : esc(c.show(r, i))) + '</dd>';
      return '<dt>' + esc(c.head) + (c.req ? ' *' : '') + '</dt><dd><input class="input sm' + (err ? ' err' : '') + '" style="width:100%" value="' + esc(editing ? u.edit.value : c.get(r)) + '" data-in="row-field" data-row="' + i + '" data-col="' + c.key + '">' + (err ? '<span class="small" style="color:var(--bad)">' + icon('x') + esc(err) + '</span>' : '') + '</dd>';
    }).join('') + '</dl></div>';
    s += '<div class="insp-sec"><h4>검증</h4>' + (iss.length || (u.edit && u.edit.error) ? (u.edit && u.edit.error && u.edit.row === i ? '<div class="small" style="color:var(--bad);display:flex;gap:6px">' + icon('x') + '<span>편집 중: ' + esc(u.edit.error) + '</span></div>' : '') + iss.map((x) => '<div class="small" style="display:flex;gap:6px;color:' + (x.level === 'error' ? 'var(--bad)' : 'var(--warn)') + '">' + icon(x.level === 'error' ? 'x' : 'warn') + '<span>' + esc(x.msg) + '</span></div>').join('') : S.stat('ok', '이 행은 문제 없음')) + '</div>';
    s += relatedInfo(key, i, r);
    s += '<div class="insp-sec"><h4>행 동작</h4><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="row-ins" data-pos="above">' + icon('rowAbove') + '위에 삽입</button><button class="btn sm" data-act="row-ins" data-pos="below">' + icon('rowBelow') + '아래 삽입</button><button class="btn sm danger" data-act="row-del">' + icon('trash') + '삭제</button></div></div>';
    return { title: '행 인스펙터', html: s };
  }
  function relatedInfo(key, i, r) {
    const st = app().state, c = D();
    if (key === 'series') {
      const slot = c.plan[i];
      const pairGames = st.matches.filter((m) => (m.home === r.home && m.away === r.away) || (m.home === r.away && m.away === r.home));
      const homeG = pairGames.filter((m) => m.home === r.home).reduce((a, m) => a + m.consecutive, 0);
      const tot = pairGames.reduce((a, m) => a + m.consecutive, 0);
      return '<div class="insp-sec"><h4>관련 정보</h4><dl class="props"><dt>구단쌍</dt><dd>' + esc(r.home + '–' + r.away) + ' ' + tot + '경기 <span class="muted small">(' + esc(r.home) + ' 홈 ' + homeG + ' · ' + esc(r.away) + ' 홈 ' + (tot - homeG) + ')</span></dd><dt>현재 배정</dt><dd>' + (slot >= 0 ? '<button class="btn xs" data-act="sel-match" data-m="' + i + '">' + icon('cal') + esc(c.slots[slot].label) + ' — ③에서 보기</button>' : '<span class="muted">미배정(가져오기 후 엔진 실행 필요)</span>') + '</dd></dl></div>';
    }
    if (key === 'slots') {
      const ms = c.bySlot[i] || [];
      const rule = CalendarGen.slotWeights(Dates.dayNum(r.datetime), r.consecutive, CalendarGen.holidaySet(st.settings));
      return '<div class="insp-sec"><h4>관련 정보</h4><dl class="props"><dt>규칙값</dt><dd>주말 ' + rule.weekend + ' · 휴일 ' + rule.holiday + ' ' + (rule.weekend === r.weekend && rule.holiday === r.holiday ? '<span class="tag auto">자동과 같음</span>' : '<span class="tag ref">수동 값</span>') + '</dd><dt>배정 시리즈</dt><dd class="small">' + (ms.length ? ms.map((m) => esc(app().matchLabel(m))).join(', ') : '<span class="muted">없음</span>') + '</dd></dl></div>';
    }
    if (key === 'events') {
      const slot = Score.resolveEventSlot(r, st.calendar);
      const pinned = st.matches.findIndex((m) => m.eventId === r.id);
      return '<div class="insp-sec"><h4>관련 정보</h4><dl class="props"><dt>슬롯</dt><dd>' + (slot >= 0 ? esc(c.slots[slot].label) : '<span style="color:var(--bad)">없음</span>') + '</dd>' + (r.mode === 'MATCH' ? '<dt>고정 시리즈</dt><dd>' + (pinned >= 0 ? '<span class="tag pin">' + icon('pin') + esc(app().matchLabel(pinned)) + '</span>' : '<span class="muted">엔진 실행 시 고정</span>') + '</dd>' : '<dt>홈 의무</dt><dd class="small">' + esc((r.stadiums || []).map((x) => st.teams.filter((t) => t.stadium === x).map((t) => t.name).join('·')).join(', ')) + '</dd>') + '</dl></div>';
    }
    return '';
  }

  // ───────── 단계 ─────────
  S.steps[1] = {
    render() {
      const u = S.ui;
      if (!SHEETS[u.tab] && u.tab !== 'season' && u.tab !== 'teams') u.tab = 'slots';
      let main;
      if (u.tab === 'season') main = renderSeason();
      else if (u.tab === 'teams') main = renderTeams();
      else main = renderSheet(u.tab);
      const insp = renderInsp();
      return '<div class="stepview">' + renderBand() + S.workspace({ list: renderList(), main, insp: insp.html, inspTitle: insp.title, listLabel: '시트 목록' }) + '</div>';
    },
    after() {
      const ed = document.getElementById('cellEditor');
      if (ed && S.ui.edit && !S.ui.edit._focused) { ed.focus(); const n = ed.value.length; try { ed.setSelectionRange(n, n); } catch (e) { /* 무시 */ } }
      if (S.ui.cell) S.revealRow();
      if (S.ui.flash) setTimeout(() => { S.ui.flash = null; }, 50);
    }
  };
  S.revealRow = function () {
    const box = document.getElementById('sheetScroll');
    const tr = box && box.querySelector('tr.sel');
    if (!tr) return;
    const r = tr.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top + 30 || r.bottom > b.bottom - 4) box.scrollTop += r.top - b.top - b.height / 3;
  };

  // ───────── 동작 ─────────
  function locked() { if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) { S.toast('엔진 실행 중에는 입력이 잠깁니다. 먼저 중지하세요.', 'warn'); return true; } return false; }
  function startEdit(sheet, row, col, initial) {
    const sh = SHEETS[sheet];
    const c = sh.cols.find((x) => x.key === col);
    if (!c || c.ro || locked()) return;
    const r = sh.rows(app().state)[row];
    S.ui.cell = { sheet, row, col };
    S.ui.edit = { sheet, row, col, value: initial != null ? initial : String(c.get(r)), error: null, fix: null };
    S.render();
  }
  S.startEdit = startEdit;
  function commitEdit(moveDown) {
    const e = S.ui.edit;
    if (!e) return;
    const ed = document.getElementById('cellEditor');
    if (ed) e.value = ed.value;
    const sh = SHEETS[e.sheet];
    const c = sh.cols.find((x) => x.key === e.col);
    const r = sh.rows(app().state)[e.row];
    const err = c.validate ? c.validate(e.value, r) : null;
    if (err) { e.error = err.error; e.fix = err.fix || null; S.render(); return; }
    const old = String(c.get(r));
    S.ui.edit = null;
    if (old !== String(e.value)) {
      app().commit(sh.sheet + ' ' + (e.row + 2) + '행 ' + c.head + ': ' + old + ' → ' + e.value, (s) => {
        if (c.setAt) c.setAt(s, e.row, e.value);
        else { const row = sh.rows(s)[e.row]; c.set(row, e.value); }
      }, ['input']);
    }
    if (moveDown) { const n = sh.rows(app().state).length; S.ui.cell = { sheet: e.sheet, row: Math.min(n - 1, e.row + 1), col: e.col }; }
    S.render();
  }
  function insertRow(pos) {
    const u = S.ui, key = u.tab, sh = SHEETS[key];
    if (!sh || !u.cell || u.cell.sheet !== key || locked()) return;
    const at = pos === 'above' ? u.cell.row : u.cell.row + 1;
    const blank = sh.blank(app().state, u.cell.row);
    if (blank && typeof blank === 'object') blank._uiNew = true;
    app().commit(sh.sheet + ' ' + (at + 2) + '행 삽입', (s) => { sh.insert(s, at, blank); }, ['input', 'plan']);
    u.edit = null;
    u.cell = { sheet: key, row: at, col: sh.cols.find((c) => !c.ro).key };
    S.toast(sh.sheet + ' ' + (at + 2) + '행을 ' + (pos === 'above' ? '위에' : '아래에') + ' 삽입했습니다. 값을 고치세요.' + (key === 'series' ? ' 새 시리즈는 미배정 풀로 들어갑니다.' : ''), 'info');
    S.render();
  }
  S.insertRow = insertRow;
  function deleteRow() {
    const u = S.ui, key = u.tab, sh = SHEETS[key];
    if (!sh || !u.cell || u.cell.sheet !== key || locked()) return;
    const at = u.cell.row;
    app().commit(sh.sheet + ' ' + (at + 2) + '행 삭제', (s) => { sh.remove(s, at); }, ['input', 'plan']);
    u.edit = null;
    const n = sh.rows(app().state).length;
    u.cell = n ? { sheet: key, row: Math.min(at, n - 1), col: u.cell.col } : null;
    S.toast(sh.sheet + ' ' + (at + 2) + '행을 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.', 'info');
    S.render();
  }

  Object.assign(S.actions, {
    'd-tab': (el) => { S.go({ step: 1, tab: el.dataset.tab, edit: null, cell: null, ops: null }); },
    'cell': (el, e) => {
      const row = +el.dataset.row, col = el.dataset.col;
      const key = S.ui.tab;
      if (S.ui.edit) { commitEdit(false); if (S.ui.edit) return; }
      const same = S.ui.cell && S.ui.cell.sheet === key && S.ui.cell.row === row && S.ui.cell.col === col;
      if (same && e.detail >= 2) { startEdit(key, row, col); return; }
      S.ui.cell = { sheet: key, row, col };
      S.render();
    },
    'cell-fix': () => { const e = S.ui.edit; if (!e || !e.fix) return; e.value = e.fix; e.error = null; const ed = document.getElementById('cellEditor'); if (ed) ed.value = e.fix; commitEdit(false); },
    'cell-cancel': () => { S.ui.edit = null; S.render(); },
    'row-ins': (el) => insertRow(el.dataset.pos),
    'row-del': () => deleteRow(),
    'team-sel': (el) => { S.ui.cell = { sheet: 'teams', row: +el.dataset.row, col: 'name' }; S.render(); },
    'rest-wd': (el) => {
      if (locked()) return;
      const w = +el.dataset.wd;
      const cur = app().state.settings.restWeekdays.slice();
      const i = cur.indexOf(w); if (i >= 0) cur.splice(i, 1); else cur.push(w);
      app().updateSettings({ restWeekdays: cur.sort() }, '휴식 요일 변경');
      if (app().slotsOutOfDate()) S.toast('휴식 요일을 바꿨습니다. 현재 슬롯과 규칙 결과가 달라졌습니다 — 오른쪽 "규칙으로 초안 만들기"로 확인하세요.', 'warn', 5000);
    }
  });
  S.inputs.season = (el) => {
    if (locked()) return;
    const v = P.date(el.value);
    if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "'", 'bad'); return; }
    app().updateSettings({ [el.dataset.k]: v }, '시즌 골격: ' + el.dataset.k);
  };
  S.inputs['row-field'] = (el) => {
    const key = S.ui.tab, sh = SHEETS[key];
    const row = +el.dataset.row, col = el.dataset.col;
    S.ui.cell = { sheet: key, row, col };
    S.ui.edit = { sheet: key, row, col, value: el.value, error: null, fix: null, _focused: true };
    commitEdit(false);
  };
  S.inputs['team-field'] = (el) => {
    if (locked()) return;
    const i = +el.dataset.row, k = el.dataset.k;
    if (!el.value.trim()) return;
    app().updateTeam(i, { [k]: el.value.trim() });
  };

  // 표 키보드 조작
  S.onKey = function (e) {
    const u = S.ui;
    if (u.ops || u.step !== 1 || u.modal || u.drawer) return false;
    const key = u.tab, sh = SHEETS[key];
    if (!sh) return false;
    if (u.edit) {
      if (e.target.id !== 'cellEditor') return false;
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(true); return true; }
      if (e.key === 'Tab') { e.preventDefault(); commitEdit(false); return true; }
      if (e.key === 'Escape') { e.preventDefault(); u.edit = null; S.render(); return true; }
      return false;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return false;
    if (!u.cell || u.cell.sheet !== key) return false;
    const cols = sh.cols.filter((c) => !c.ro);
    const ci = cols.findIndex((c) => c.key === u.cell.col);
    const n = sh.rows(app().state).length;
    const mv = (dr, dc) => { u.cell = { sheet: key, row: Math.max(0, Math.min(n - 1, u.cell.row + dr)), col: cols[Math.max(0, Math.min(cols.length - 1, ci + dc))].key }; S.render(); };
    if (e.key === 'ArrowDown') { e.preventDefault(); mv(1, 0); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); mv(-1, 0); return true; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); mv(0, -1); return true; }
    if (e.key === 'ArrowRight') { e.preventDefault(); mv(0, 1); return true; }
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(key, u.cell.row, ci >= 0 ? cols[ci].key : cols[0].key); return true; }
    if (e.key === 'Delete' && e.shiftKey) { e.preventDefault(); deleteRow(); return true; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && ci >= 0) { e.preventDefault(); startEdit(key, u.cell.row, cols[ci].key, e.key); return true; }
    return false;
  };

  // ───────── 시연 상태 (P3): 셀 편집 중 + 오류 + 삽입한 새 행 ─────────
  S.demos.edit = function () {
    S.ui.step = 1; S.ui.tab = 'series'; S.ui.ops = null;
    S.ui.cell = { sheet: 'series', row: 10, col: 'home' };
    insertRow('below');
    S.ui.cell = { sheet: 'series', row: 10, col: 'away' };
    S.ui.edit = { sheet: 'series', row: 10, col: 'away', value: 'LGG', error: null, fix: null };
    const r = app().state.matches[10];
    const err = SHEETS.series.cols[1].validate('LGG', r);
    S.ui.edit.error = err.error; S.ui.edit.fix = err.fix;
    S.render();
  };
})();
