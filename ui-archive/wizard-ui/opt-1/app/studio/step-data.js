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
        { key: 'start', head: '시작일', alias: 'start', req: true, w: 112, get: (r) => r.datetime.slice(0, 10), show: (r) => dateCell(r.datetime.slice(0, 10)), validate: vDate, set: (r, v) => { r.datetime = P.date(v) + ' 00:00:00'; } },
        { key: 'games', head: '연전', alias: 'games', req: true, w: 58, num: true, get: (r) => r.consecutive, validate: vRange(2, 4, '연전'), set: (r, v) => { r.consecutive = P.int(v); } },
        { key: 'weekend', head: '주말', alias: 'weekend', w: 58, num: true, get: (r) => r.weekend, validate: (v) => (P.bool(v) == null ? { error: '1/0, Y/N, 예/아니오로 씁니다.' } : null), set: (r, v) => { r.weekend = P.bool(v); } },
        { key: 'holiday', head: '휴일가중치', alias: 'holiday', w: 86, num: true, get: (r) => r.holiday, validate: vRange(0, 3), set: (r, v) => { r.holiday = P.int(v); } },
        { key: 'days', head: '기간', w: 170, ro: true, show: (r) => { const d = Dates.dayNum(r.datetime); return fmt.date(d) + ' ~ ' + fmt.date(d + r.consecutive - 1); } },
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
        { key: 'home', head: '홈', alias: 'home', req: true, w: 96, get: (r) => r.home, show: (r) => S.team(r.home) + (r.pinned ? ' <span class="muted" title="개막전 대진 지정으로 고정(③에서 관리)">' + icon('pin') + '</span>' : ''), html: true, validate: (v, r) => vTeam(v) || (String(v).trim() === r.away ? { error: '홈과 원정이 같습니다.' } : null), set: (r, v) => { r.home = String(v).trim(); } },
        { key: 'away', head: '원정', alias: 'away', req: true, w: 96, get: (r) => r.away, show: (r) => S.team(r.away), html: true, validate: (v, r) => vTeam(v) || (String(v).trim() === r.home ? { error: '홈과 원정이 같습니다.' } : null), set: (r, v) => { r.away = String(v).trim(); } },
        { key: 'games', head: '연전', alias: 'games', req: true, w: 58, num: true, get: (r) => r.consecutive, validate: vRange(2, 4, '연전'), set: (r, v) => { r.consecutive = P.int(v); } },
        { key: 'stadium', head: '구장', w: 150, ro: true, show: (r) => esc(((app().team(r.home) || {}).stadium) || '-'), html: true },
        { key: 'slot', head: '현재 배정(③)', w: 126, ro: true, show: (r, i) => { const c = D(); const sl = c.plan[i]; return sl >= 0 ? esc(c.slots[sl].label) : '<span class="muted">미배정</span>'; }, html: true },
        { key: 'pair', head: '구단쌍 경기', w: 86, ro: true, show: (r) => { const n = app().state.matches.filter((m) => (m.home === r.home && m.away === r.away) || (m.home === r.away && m.away === r.home)).reduce((a, m) => a + m.consecutive, 0); return n + '경기'; } },
        { key: 'note', head: '메모', alias: 'note', w: 90, get: (r) => r.note || '', set: (r, v) => { r.note = String(v); } }
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
        { key: 'name', head: '이름', alias: 'name', req: true, w: 104, get: (r) => r.name, set: (r, v) => { r.name = String(v).trim(); } },
        { key: 'type', head: '유형', alias: 'type', req: true, w: 80, ro: true, show: (r) => ({ OPENING: '개막전', CHILDREN: '어린이날', CUSTOM: '사용자정의' }[r.type] || r.type) },
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 100, get: (r) => r.date, show: (r) => dateCell(r.date), validate: (v) => vDate(v) || (CalendarGen.slotIndexOfDate(app().state.calendar, P.date(v)) < 0 ? { error: fmt.date(P.date(v)) + '은(는) 어느 슬롯에도 없습니다.' } : null), set: (r, v) => { r.date = P.date(v); } },
        { key: 'mode', head: '방식', alias: 'mode', req: true, w: 56, ro: true, show: (r) => (r.mode === 'MATCH' ? '대진' : '구장') },
        { key: 'home', head: '홈', alias: 'home', w: 80, get: (r) => r.home || '', show: (r) => (r.home ? S.team(r.home) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.home = String(v).trim(); } },
        { key: 'away', head: '원정', alias: 'away', w: 80, get: (r) => r.away || '', show: (r) => (r.away ? S.team(r.away) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.away = String(v).trim(); } },
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
      '<span class="pane-desc" title="' + esc(sh.desc) + '">' + esc(sh.desc) + '</span>' +
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
    s += '<div class="pane-foot small muted" style="white-space:nowrap;overflow:hidden">' + icon('info') + '<span style="overflow:hidden;text-overflow:ellipsis" title="여러 행 편집·붙여넣기는 엑셀에서 하고 다시 가져옵니다.">셀 선택 → <span class="kbd">Enter</span>·더블클릭 편집 · 화살표 이동 · <span class="kbd">Esc</span> 취소 · 고친 값은 오른쪽 그림에 바로 반영 · 실행 취소 가능</span></div>';
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
    // opt-1: 시즌 띠는 오른쪽 큰 그림(규칙으로 만든 경기일)으로 옮겼다
    const sub = (k, title, lines) => '<div class="blk"><div class="blk-head">' + icon('sheet') + esc(title) + '<span class="r"><span class="muted small">' + lines.length + '행</span><button class="btn xs" data-act="d-tab" data-tab="' + k + '">시트 열기' + icon('right') + '</button></span></div><div class="blk-body small" style="padding:6px 10px;display:flex;flex-direction:column;gap:2px">' + (lines.length ? lines.slice(0, 6).map((x) => '<div>' + x + '</div>').join('') + (lines.length > 6 ? '<div class="muted">외 ' + (lines.length - 6) + '건</div>' : '') : '<span class="muted">없음</span>') + '</div></div>';
    s += '<div class="o1-subs">' +
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
      const values = names.map((a) => names.map((b) => (a === b ? null : (app().distanceOf(a, b) || {}).distance)));
      s += '<details class="fold" style="margin-top:12px" data-feature="T7"><summary>' + icon('grid') + '거리 행렬 히트맵 <span class="muted">10 × 10 · km · 대칭 편집 켜짐</span></summary><div style="padding:8px 10px" class="chart-box">' +
        KBO.Chart.heatmap({ rows: names, cols: names, values, cellW: 58, cellH: 24, labelW: 50, format: (v) => (v == null ? '' : Number(v).toFixed(1)), title: '구단 간 이동거리' }) + '</div></details>';
    }
    s += '</div>';
    return s;
  }

  // ───────── 입력 결과 시각화 배치 (W15) — opt-1은 이 함수와 S.steps[1].render의 배치를 바꾼다 ─────────
  const V = () => S.viz;
  function vizSnap(sheet) {
    const st = app().state;
    if (sheet === 'series') return V().pairCounts(st.matches, st.teams.map((t) => t.name));
    if (sheet === 'slots') return st.calendar.map((c) => Object.assign({}, c));
    if (['holidays', 'restex', 'blackouts', 'events'].includes(sheet)) return V().dateSet(st, sheet);
    return null;
  }
  /** 편집·삽입·삭제 전후를 비교해 바뀐 칸을 기억한다(다음 편집이나 실행 취소 전까지 강조) */
  S.trackViz = function (sheet, fn) {
    const before = vizSnap(sheet);
    const r = fn();
    if (before == null) return r;
    const after = vizSnap(sheet);
    const keys = sheet === 'series' ? V().diffCounts(before, after) : sheet === 'slots' ? V().diffSlots(before, after) : V().diffDates(before, after);
    S.ui.vizChanged = keys.size ? { sheet, keys, before, ver: D().version } : null;
    return r;
  };
  function vizChanged(sheet) {
    const vc = S.ui.vizChanged;
    return vc && vc.sheet === sheet && vc.ver === D().version ? vc : null;
  }
  // ───────── opt-1 입력 분할형: 본문 오른쪽 큰 그림 ─────────
  /** 선택 행 index (현재 탭의 행일 때만) */
  function selRow(key) { const c = S.ui.cell; return c && c.sheet === key ? c.row : -1; }
  /** 행 인스펙터 상태: 'none'(선택 없음) · 'open' · 'rail'(접힘) */
  function inspState(key) {
    if (key === 'season') return 'none';
    const i = selRow(key);
    if (i < 0) return 'none';
    if (key !== 'teams' && i >= rowsOf(key).length) return 'none';
    // 사용자가 정한 값(o1Insp: 'open'·'closed')이 없으면 넓은 화면(1800 이상)은 열고, 1440처럼 좁은 화면은 접힌 띠로 둔다
    const pref = S.ui.o1Insp;
    if (pref === 'closed') return 'rail';
    if (pref === 'open') return 'open';
    return window.innerWidth >= 1800 ? 'open' : 'rail';
  }
  S.o1InspState = () => inspState(S.ui.tab);
  /** 그림 칸의 대략 크기(px) — CSS .o1-split(1.2fr : 1fr)과 같은 비율로 계산한다 */
  function vizBox(key) {
    const W = window.innerWidth, H = window.innerHeight, wide = W >= 1800, tall = H >= 900;
    const st = inspState(key);
    const inspW = st === 'open' ? (wide ? 360 : 320) : st === 'rail' ? 30 : 0;
    const mainW = W - (wide ? 260 : 232) - inspW;
    const vizW = Math.floor(mainW / 2.2);
    const vizH = H - 44 - 56 - 40 - 46 - 38; // 상단·스테퍼·하단·가져오기 띠·패널 머리
    const sig = W + 'x' + H + '|' + st;
    const m = S._o1Meas;
    if (m && m.sig === sig) return { w: m.w, h: m.h, wide, tall, sig };
    return { w: vizW - 32, h: vizH - 24, wide, tall, sig };
  }
  /** 그린 뒤 실제 그림 칸 크기를 재고, 어림값과 많이 다르면 한 번 더 그린다(창 크기 변경 포함) */
  function measureViz() {
    const el = document.querySelector('.o1-viz-body');
    if (!el) return;
    const cs = getComputedStyle(el);
    const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
    const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const sig = window.innerWidth + 'x' + window.innerHeight + '|' + inspState(S.ui.tab);
    const used = S._o1Used;
    S._o1Meas = { sig, w, h };
    if (used && used.sig === sig && (Math.abs(used.w - w) > 6 || Math.abs(used.h - h) > 6) && S._o1Fix !== sig + w + h) { S._o1Fix = sig + w + h; S.render(); }
  }
  window.addEventListener('resize', () => {
    if (!S.ui || S.ui.step !== 1 || S.ui.ops || !document.querySelector('.o1-viz-body')) return;
    const ed = document.getElementById('cellEditor'); if (ed && S.ui.edit) S.ui.edit.value = ed.value; // 입력 중인 값 보존
    S.render();
  });
  S.o1VizBox = vizBox;
  /** 큰 구단쌍 행렬: 폭과 높이 안에 들어가게 칸 크기를 고른다 */
  S.o1Matrix = function (o, w, h) {
    const n = o.names.length;
    const left = w >= 560 ? 58 : 50, top = h >= 420 ? 30 : 26;
    const cw = Math.max(26, Math.min(70, Math.floor((w - left - 2) / n)));
    const ch = Math.max(20, Math.min(cw, 52, Math.floor((h - top - 2) / n)));
    const fs = ch >= 40 ? 15 : ch >= 30 ? 13 : ch >= 24 ? 12 : 11;
    const mx = V().pairMatrix(Object.assign({}, o, { cw, ch, left, top, fs, lfs: Math.min(14, fs) }));
    const W = left + n * cw + 2;
    mx.html = mx.html.replace('<svg class="vz-mx"', '<svg class="vz-mx" style="width:' + W + 'px"');
    return mx;
  };
  /** 큰 시즌 띠: 달 수와 높이로 칸 높이를 정한다 */
  function bigRibbon(o, h, w) {
    const set = o.settings;
    const cellW = (w - 34 - 2 - 30 * 2) / 31; // 달 이름 34px, 칸 사이 2px
    const nums = cellW >= 13;
    const months = Dates.month(Dates.dayNum(set.initialEnd)) - Dates.month(Dates.dayNum(set.seasonStart)) + 1;
    const rh = Math.max(20, Math.min(S.tall ? 42 : 34, Math.floor((h - 16) / Math.max(1, months)) - 3));
    return '<div class="rb-wrap' + (nums ? '' : ' nonum') + (nums && cellW < 16 ? ' tight' : '') + '" style="--rd-h:' + rh + 'px">' + V().ribbon(Object.assign({ nums, big: true }, o)) + '</div>';
  }
  const sec = (title, right, body, cls) => '<div class="o1-sec' + (cls ? ' ' + cls : '') + '"><h4>' + icon('chart') + esc(title) + (right ? '<span class="r">' + right + '</span>' : '') + '</h4>' + body + '</div>';
  /** 날짜 시트(공휴일·예외일·경기 없는 기간·이벤트)의 칩 목록 — 누르면 그 행을 고른다 */
  function dateChips(key, row, vc) {
    const st = app().state;
    const col = SHEETS[key].cols.find((c) => !c.ro).key;
    let items = [];
    if (key === 'holidays') items = st.settings.holidays.map((h) => ({ d: h.date, t: fmt.short(h.date) + ' ' + h.name }));
    else if (key === 'restex') items = st.settings.restExceptions.map((d) => ({ d, t: fmt.short(d) + ' 휴식 요일이지만 경기' }));
    else if (key === 'blackouts') items = st.settings.blackouts.map((b) => ({ d: b.start, t: fmt.short(b.start) + (b.end !== b.start ? '~' + fmt.short(b.end) : '') + ' ' + (b.label || '') }));
    else if (key === 'events') items = st.events.map((e) => ({ d: e.date, t: fmt.short(e.date) + ' ' + e.name + ' · ' + (e.mode === 'MATCH' ? (e.home || '?') + '–' + (e.away || '?') : '구장 ' + (e.stadiums || []).length + '곳') }));
    if (!items.length) return '';
    const chg = vc ? vc.keys : new Set();
    return '<div class="o1-chips">' + items.map((x, i) => '<button class="o1-chip' + (i === row ? ' on' : '') + (x.d && chg.has(Dates.dayNum(x.d)) ? ' chg' : '') + '" data-act="cell" data-row="' + i + '" data-col="' + col + '" title="' + (i + 2) + '행 고르기">' + esc(x.t) + '</button>').join('') + '</div>';
  }
  /**
   * 오른쪽 큰 그림 칸의 내용. { title, sum(머리 오른쪽), html, kind }
   * std는 인스펙터 위쪽에 같은 그림을 작게 두었다. 그리기는 S.viz를 그대로 쓰고 크기 인자만 더 준다.
   */
  S.inputViz = function (key) {
    const st = app().state;
    const row = selRow(key);
    const b = vizBox(key);
    S._o1Used = b;
    const half = st.teams.length >> 1;
    const balance = () => sec('연전 수급', '슬롯 × ' + half + ' ↔ 시리즈', V().balance({ slots: st.calendar, matches: st.matches, teams: st.teams.length, compact: !b.tall }), 'bal');
    if (key === 'series') {
      const names = st.teams.map((t) => t.name);
      const counts = V().pairCounts(st.matches, names);
      const r = row >= 0 ? st.matches[row] : null;
      const vc = vizChanged('series');
      const mh = b.h - 104 - (b.tall ? 178 : 84) - (vc ? 26 : 0) - (r && vc ? 22 : 0); // 제목·범례·안내 + 연전 수급(낮은 화면은 한 줄 요약)
      const mx = S.o1Matrix({ names, counts, target: st.settings.initialGamesPerPair, sel: r ? { home: r.home, away: r.away } : null, changed: vc ? vc.keys : null, before: vc ? vc.before : null, arrow: b.w >= 470, title: '구단쌍 경기 수' }, b.w, mh);
      let note = mx.off ? '<div class="vz-note warn">' + icon('warn') + '구단쌍 ' + mx.off + '개의 경기 수 합이 ' + st.settings.initialGamesPerPair + '가 아닙니다.</div>' : '<div class="vz-note ok">' + icon('check') + '모든 구단쌍 ' + st.settings.initialGamesPerPair + '경기 (홈 9 · 원정 6)</div>';
      if (vc) note += '<div class="vz-note chg">' + icon('info') + '방금 바뀐 칸 ' + vc.keys.size + ': ' + Array.from(vc.keys).slice(0, 3).map((k) => { const [h, a] = k.split('|'); return esc(h + ' 홈 × ' + a) + ' ' + (vc.before.get(k) || 0) + '→' + (counts.get(k) || 0); }).join(', ') + '</div>';
      const selTxt = r ? '선택 ' + (row + 2) + '행 · ' + esc(r.home) + ' 홈 × ' + esc(r.away) : '행 홈 × 열 원정';
      return { title: '구단쌍 경기 수', kind: 'matrix', html: sec('구단쌍 경기 수', selTxt, '<div class="o1-mx">' + mx.html + '</div>' + note, 'mx') + balance() };
    }
    if (key === 'season') {
      const gen = CalendarGen.generateSlots(st.settings);
      const diff = V().diffSlots(st.calendar, gen.slots);
      const h = CalendarGen.lengthHistogram(gen.slots);
      const same = !app().slotsOutOfDate();
      const stats = '<div class="o1-stats"><div><span>규칙으로 만든 슬롯</span><b>' + gen.slots.length + '</b></div><div><span>연전 분포</span><b>' + [2, 3, 4].map((k) => k + '연전 ' + (h[k] || 0)).join(' · ') + '</b></div><div><span>경기일 구간</span><b>' + gen.runs.length + '개</b></div><div><span>현재 슬롯</span><b>' + (same ? S.stat('ok', '같음') : S.stat('warn', diff.size + '곳 다름')) + '</b></div></div>' +
        '<div class="o1-acts"><button class="btn sm" data-act="draft-slots">' + icon('bolt') + '규칙으로 초안 만들기</button><span class="small muted">바로 반영하지 않고 가져오기 미리보기를 거칩니다.</span></div>';
      return { title: '규칙으로 만든 경기일', kind: 'ribbon', html: sec('규칙으로 만든 경기일', '현재 슬롯과 ' + (diff.size ? '<b style="color:var(--warn)">' + diff.size + '곳 다름</b>' : '같음'), bigRibbon({ settings: st.settings, slots: gen.slots, changed: diff, chgLabel: '현재 슬롯과 다른 곳', label: '규칙으로 만든 경기일' }, b.h - 150 - 70, b.w) + '<div class="small muted o1-foot">개막·종료일, 휴식 요일, 하위 시트(공휴일·예외일·경기 없는 기간)를 고치면 바로 다시 그립니다. 9~10월은 재편성 기간입니다(시즌 운영 메뉴).</div>', 'rb') + sec('규칙 미리보기', '', stats) };
    }
    if (!{ slots: 1, holidays: 1, restex: 1, blackouts: 1, events: 1 }[key]) return null;
    const o = { settings: st.settings, slots: st.calendar, label: '시즌 띠' };
    let right = '';
    const vc = vizChanged(key);
    if (key === 'slots') {
      o.sel = row >= 0 ? row : null;
      if (vc) o.changed = vc.keys;
      const errRows = new Set(); st.calendar.forEach((c, i) => { if (SHEETS.slots.rowIssues(st, i).some((x) => x.level === 'error')) errRows.add(i); });
      o.errRows = errRows;
      const c = row >= 0 ? st.calendar[row] : null;
      right = c ? '선택 ' + (row + 2) + '행 · ' + esc(fmt.short(c.datetime.slice(0, 10))) + ' ' + c.consecutive + '연전' : '경기일 ' + st.calendar.reduce((a, x) => a + x.consecutive, 0) + '일';
    } else {
      if (vc) o.changedDays = vc.keys;
      const sd = new Set();
      if (key === 'holidays' && row >= 0 && st.settings.holidays[row]) sd.add(Dates.dayNum(st.settings.holidays[row].date));
      if (key === 'restex' && row >= 0 && st.settings.restExceptions[row]) sd.add(Dates.dayNum(st.settings.restExceptions[row]));
      if (key === 'blackouts' && row >= 0 && st.settings.blackouts[row]) { const bl = st.settings.blackouts[row]; for (let d = Dates.dayNum(bl.start); d <= Dates.dayNum(bl.end); d++) sd.add(d); }
      if (key === 'events') o.events = st.events.map((e, i) => ({ date: e.date, name: e.name, sel: i === row }));
      o.selDays = sd;
      right = { holidays: '공휴일 ' + st.settings.holidays.length + '일', restex: '예외일 ' + st.settings.restExceptions.length + '일', blackouts: '경기 없는 기간 ' + st.settings.blackouts.length + '건', events: '이벤트 ' + st.events.length + '건' }[key];
      if (row >= 0) right = '선택 ' + (row + 2) + '행 · ' + right;
    }
    const reserve = key === 'slots' ? (b.tall ? 178 : 84) + 64 : 64 + 96;
    let body = bigRibbon(o, b.h - reserve - (vc ? 26 : 0), b.w);
    if (vc) body += '<div class="vz-note chg">' + icon('info') + '방금 바뀐 ' + (key === 'slots' ? '슬롯 ' + vc.keys.size + '개' : '날짜 ' + vc.keys.size + '일') + '을 파란 테두리로 표시했습니다.</div>';
    const extra = key === 'slots' ? balance() : sec(SHEETS[key].label + ' 목록', '누르면 그 행을 고릅니다', dateChips(key, row, vc), 'chips');
    return { title: '시즌 띠', kind: 'ribbon', html: sec('시즌 띠', right, body, 'rb') + extra };
  };
  /** 오른쪽 그림 칸 (본문 안 분할) */
  function renderVizPane(key) {
    const v = S.inputViz(key);
    if (!v) return '';
    const c = key === 'season' ? null : sheetIssueCount(key);
    const sum = c ? (c.e ? S.stat('block', '오류 ' + c.e) : S.stat('ok', '오류 0')) + (c.w ? S.stat('warn', '경고 ' + c.w) : '') : '';
    return '<section class="o1-viz" data-o1-viz="' + v.kind + '" aria-label="입력 결과 그림"><div class="pane-head"><span class="pane-title">' + icon('chart') + ' 입력 결과</span><span class="tag live">즉시 반영</span><span class="pane-desc">' + esc(key === 'season' ? '시즌 골격' : SHEETS[key].label + ' 시트') + ' → ' + esc(v.title) + '</span><span style="margin-left:auto;display:flex;gap:6px;flex:none">' + sum + '</span></div>' +
      '<div class="pane-body o1-viz-body" data-sk="o1-viz-' + key + '">' + v.html + '</div></section>';
  }

  // ───────── 인스펙터 (opt-1: 행을 골랐을 때만 연다) ─────────
  function renderInsp() { return renderInspBase(); }
  function renderInspBase() {
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
      const others = st.teams.filter((x) => x.name !== t.name).map((x) => ({ n: x.name, d: (app().distanceOf(t.name, x.name) || {}).distance })).sort((a, b) => a.d - b.d);
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
      let left;
      if (u.tab === 'season') left = renderSeason();
      else if (u.tab === 'teams') left = renderTeams();
      else left = renderSheet(u.tab);
      // opt-1: 본문 = 왼쪽 시트 표 | 오른쪽 큰 그림 (구단과 거리는 std처럼 본문 하나)
      const viz = u.tab === 'teams' ? '' : renderVizPane(u.tab);
      const main = viz ? '<div class="o1-split"><div class="o1-left">' + left + '</div>' + viz + '</div>' : left;
      const ist = inspState(u.tab);
      const anim = ist === 'open' && S._o1PrevInsp !== 'open';
      S._o1PrevInsp = ist;
      let insp = '';
      if (ist === 'open') {
        const b = renderInsp();
        insp = '<aside class="pane insp o1-insp' + (anim ? ' slide' : '') + '" aria-label="행 인스펙터"><div class="pane-head"><span class="pane-title">' + esc(b.title) + '</span>' +
          '<span style="margin-left:auto;display:flex;gap:2px"><button class="btn sm ghost" data-act="o1-unsel" title="행 선택 해제 (Esc)">' + icon('x') + '선택 해제</button>' +
          '<button class="btn sm icon ghost" data-act="o1-insp-close" title="인스펙터 접기 — 행 선택과 그림 강조는 그대로" aria-label="인스펙터 접기">' + icon('right') + '</button></span></div>' +
          '<div class="pane-body" data-sk="insp-1">' + b.html + '</div></aside>';
      } else if (ist === 'rail') {
        const r = selRow(u.tab);
        const label = u.tab === 'teams' ? '구단 ' + ((app().state.teams[r] || {}).name || '') : SHEETS[u.tab].sheet + ' ' + (r + 2) + '행';
        insp = '<aside class="insp-rail o1-rail" aria-label="행 인스펙터(접힘)"><button class="btn sm icon ghost" data-act="o1-insp-open" title="행 인스펙터 펼치기" aria-label="행 인스펙터 펼치기">' + icon('left') + '</button><span class="rail-label">행 인스펙터 · ' + esc(label) + '</span></aside>';
      }
      const cls = 'workspace ws-o1 o1-st-' + ist + (u.tab === 'teams' ? ' o1-teams' : '');
      return '<div class="stepview">' + renderBand() + '<div class="' + cls + '"><nav class="pane list" aria-label="시트 목록">' + renderList() + '</nav><section class="pane main">' + main + '</section>' + insp + '</div></div>';
    },
    after() {
      const ed = document.getElementById('cellEditor');
      if (ed && S.ui.edit && !S.ui.edit._focused) { ed.focus(); const n = ed.value.length; try { ed.setSelectionRange(n, n); } catch (e) { /* 무시 */ } }
      if (S.ui.cell) S.revealRow();
      if (S.ui.flash) setTimeout(() => { S.ui.flash = null; }, 50);
      measureViz();
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
      S.trackViz(e.sheet, () => app().commit(sh.sheet + ' ' + (e.row + 2) + '행 ' + c.head + ': ' + old + ' → ' + e.value, (s) => {
        if (c.setAt) c.setAt(s, e.row, e.value);
        else { const row = sh.rows(s)[e.row]; c.set(row, e.value); }
      }, ['input']));
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
    S.trackViz(key, () => app().commit(sh.sheet + ' ' + (at + 2) + '행 삽입', (s) => { sh.insert(s, at, blank); }, ['input', 'plan']));
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
    S.trackViz(key, () => app().commit(sh.sheet + ' ' + (at + 2) + '행 삭제', (s) => { sh.remove(s, at); }, ['input', 'plan']));
    u.edit = null;
    const n = sh.rows(app().state).length;
    u.cell = n ? { sheet: key, row: Math.min(at, n - 1), col: u.cell.col } : null;
    S.toast(sh.sheet + ' ' + (at + 2) + '행을 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.', 'info');
    S.render();
  }

  Object.assign(S.actions, {
    'd-tab': (el) => { S.go({ step: 1, tab: el.dataset.tab, edit: null, cell: null, ops: null, vizChanged: null }); },
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
    'o1-insp-close': () => { S.go({ o1Insp: 'closed' }); },
    'o1-insp-open': () => { S.go({ o1Insp: 'open' }); },
    'o1-unsel': () => { S.go({ cell: null, edit: null }); },
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
    if (!sh) {
      const tg = (e.target.tagName || '').toLowerCase();
      if (key === 'teams' && e.key === 'Escape' && u.cell && u.cell.sheet === 'teams' && tg !== 'input') { e.preventDefault(); u.cell = null; S.render(); return true; } // opt-1: 구단 선택 해제
      return false;
    }
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
    if (e.key === 'Escape') { e.preventDefault(); u.cell = null; S.render(); return true; } // opt-1: 선택 해제 → 인스펙터 닫힘
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
