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
    bool(v) { const s = String(v).trim().toUpperCase(); if (['1', 'Y', '예', 'TRUE', 'O', '주말'].includes(s)) return 1; if (['0', 'N', '아니오', 'FALSE', 'X', '', '주중'].includes(s)) return 0; return null; },
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
  const vRange = (lo, hi, unit) => (v) => { const n = P.int(v); return n != null && n >= lo && n <= hi ? null : { error: lo + '~' + hi + ' 사이 숫자여야 합니다' + (unit ? ' (' + unit + ')' : '') + ". 입력한 값: '" + v + "'", fix: n != null ? String(Math.max(lo, Math.min(hi, n))) : null }; };

  // ───────── 시트 정의 ─────────
  const dateCell = (iso) => (iso ? fmt.date(iso) : '');
  const SHEETS = {
    slots: {
      label: '연전 기간', sheet: S.SHEET_NAMES.slots, unit: '기간', get desc() { return (app().state.teams.length >> 1) + '개 구장에서 동시에 시리즈가 열리는 2~4일입니다. 보통 엑셀 파일로 한꺼번에 받습니다.'; },
      rows: (st) => st.calendar,
      cols: [
        { key: 'start', head: '시작일', alias: 'start', req: true, w: 130, get: (r) => r.datetime.slice(0, 10), show: (r) => dateCell(r.datetime.slice(0, 10)), validate: vDate, set: (r, v) => { r.datetime = P.date(v) + ' 00:00:00'; } },
        { key: 'games', head: '연전 수', alias: 'games', req: true, w: 70, num: true, get: (r) => r.consecutive, validate: vRange(2, 4, '연전 수'), set: (r, v) => { r.consecutive = P.int(v); } },
        { key: 'weekend', head: '주말', alias: 'weekend', w: 70, get: (r) => (r.weekend ? '주말' : '주중'), validate: (v) => (P.bool(v) == null ? { error: '주말 또는 주중으로 씁니다(1/0, 예/아니오도 됩니다).' } : null), set: (r, v) => { r.weekend = P.bool(v); } },
        { key: 'holiday', head: '휴일 등급', alias: 'holiday', w: 96, num: true, get: (r) => r.holiday, validate: vRange(0, 3, '휴일 등급'), set: (r, v) => { r.holiday = P.int(v); } },
        { key: 'days', head: '기간', w: 190, ro: true, show: (r) => { const d = Dates.dayNum(r.datetime); return fmt.date(d) + ' ~ ' + fmt.date(d + r.consecutive - 1); } },
        { key: 'note', head: '메모', alias: 'note', w: 0, get: (r) => r.note || '', set: (r, v) => { r.note = String(v); } }
      ],
      rowIssues(st, i) {
        const r = st.calendar[i], out = [];
        const d = Dates.dayNum(r.datetime);
        if (i > 0) { const p = st.calendar[i - 1]; const pe = Dates.dayNum(p.datetime) + p.consecutive - 1; if (d <= pe) out.push({ level: 'error', col: 'start', msg: '앞 연전 기간(' + fmt.date(Dates.dayNum(p.datetime)) + ' ' + p.consecutive + '연전)과 날짜가 겹칩니다.' }); }
        if (r.consecutive < 2 || r.consecutive > 4) out.push({ level: 'error', col: 'games', msg: '연전 수는 2~4입니다.' });
        if (r.datetime.slice(0, 10) < st.settings.seasonStart || r.datetime.slice(0, 10) > st.settings.initialEnd) out.push({ level: 'warn', col: 'start', msg: '1차 편성 기간(' + fmt.date(st.settings.seasonStart) + '~' + fmt.date(st.settings.initialEnd) + ')을 벗어났습니다.' });
        return out;
      },
      blank: (st, i) => { const p = st.calendar[i] || st.calendar[st.calendar.length - 1]; const d = Dates.dayNum(p.datetime) + p.consecutive; return { index: 0, datetime: Dates.isoDate(d) + ' 00:00:00', consecutive: 3, weekend: 0, holiday: 0, note: '새 줄' }; },
      insert(s, at, row) { s.calendar.splice(at, 0, row); s.calendar.forEach((c, k) => { c.index = k; }); for (const p of s.plan) if (p.calendar >= at) p.calendar++; },
      remove(s, at) { s.calendar.splice(at, 1); s.calendar.forEach((c, k) => { c.index = k; }); for (const p of s.plan) { if (p.calendar === at) p.calendar = -1; else if (p.calendar > at) p.calendar--; } },
      assist: { act: 'draft-slots', label: '규칙대로 자동 채우기' }
    },
    series: {
      label: '시리즈', sheet: S.SHEET_NAMES.series, unit: '시리즈', desc: '같은 두 구단이 한 구장에서 치르는 2~4연전입니다. 날짜와 고정은 ③에서 정합니다.',
      rows: (st) => st.matches,
      cols: [
        { key: 'home', head: '홈', alias: 'home', req: true, w: 120, get: (r) => r.home, show: (r) => S.team(r.home) + (r.pinned ? ' <span class="muted" title="개막전 대진 지정으로 고정(③에서 관리)">' + icon('pin') + '</span>' : ''), html: true, validate: (v, r) => vTeam(v) || (String(v).trim() === r.away ? { error: '홈과 원정이 같습니다.' } : null), set: (r, v) => { r.home = String(v).trim(); } },
        { key: 'away', head: '원정', alias: 'away', req: true, w: 120, get: (r) => r.away, show: (r) => S.team(r.away), html: true, validate: (v, r) => vTeam(v) || (String(v).trim() === r.home ? { error: '홈과 원정이 같습니다.' } : null), set: (r, v) => { r.away = String(v).trim(); } },
        { key: 'games', head: '연전 수', alias: 'games', req: true, w: 70, num: true, get: (r) => r.consecutive, validate: vRange(2, 4, '연전 수'), set: (r, v) => { r.consecutive = P.int(v); } },
        { key: 'stadium', head: '구장', w: 170, ro: true, show: (r) => esc(((app().team(r.home) || {}).stadium) || '-'), html: true },
        { key: 'slot', head: '들어간 연전 기간', w: 150, ro: true, show: (r, i) => { const c = D(); const sl = c.plan[i]; return sl >= 0 ? esc(c.slots[sl].label) : '<span class="muted">일정 미정</span>'; }, html: true },
        { key: 'pair', head: '맞대결 경기 수', w: 110, ro: true, show: (r) => { const n = app().state.matches.filter((m) => (m.home === r.home && m.away === r.away) || (m.home === r.away && m.away === r.home)).reduce((a, m) => a + m.consecutive, 0); return n + '경기'; } },
        { key: 'note', head: '메모', alias: 'note', w: 120, get: (r) => r.note || '', set: (r, v) => { r.note = String(v); } }
      ],
      rowIssues(st, i) {
        const r = st.matches[i], out = [];
        const names = new Set(st.teams.map((t) => t.name));
        if (!names.has(r.home)) out.push({ level: 'error', col: 'home', msg: "알 수 없는 구단 '" + r.home + "'" });
        if (!names.has(r.away)) out.push({ level: 'error', col: 'away', msg: "알 수 없는 구단 '" + r.away + "'" });
        if (r.home === r.away) out.push({ level: 'error', col: 'away', msg: '홈과 원정이 같습니다.' });
        if (r.consecutive < 2 || r.consecutive > 4) out.push({ level: 'error', col: 'games', msg: '연전 수는 2~4입니다.' });
        return out;
      },
      blank: (st, i) => { const p = st.matches[i] || st.matches[0]; return { index: 0, home: p.home, away: p.away, consecutive: p.consecutive, pinned: false, note: '새 줄' }; },
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
      assist: { act: 'draft-series', label: '맞대결 규칙대로 자동 채우기' }
    },
    holidays: {
      label: '공휴일', sheet: S.SHEET_NAMES.holidays, unit: '일', parent: 'season', desc: '휴일 등급을 매길 때 쓰는 공휴일입니다. 같은 날짜는 한 번만 적습니다.',
      rows: (st) => st.settings.holidays,
      cols: [
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 130, get: (r) => r.date, show: (r) => dateCell(r.date), validate: vDate, set: (r, v) => { r.date = P.date(v); } },
        { key: 'name', head: '이름', alias: 'name', req: true, w: 200, get: (r) => r.name, validate: (v) => (String(v).trim() ? null : { error: '이름이 비었습니다.' }), set: (r, v) => { r.name = String(v).trim(); } },
        { key: 'slot', head: '속한 연전 기간', w: 0, ro: true, show: (r) => { const i = CalendarGen.slotIndexOfDate(app().state.calendar, r.date); return i >= 0 ? D().slots[i].label : '<span class="muted">경기 없음</span>'; }, html: true }
      ],
      rowIssues(st, i) { const r = st.settings.holidays[i]; return st.settings.holidays.some((h, k) => k !== i && h.date === r.date) ? [{ level: 'error', col: 'date', msg: '같은 날짜가 두 번 있습니다.' }] : []; },
      blank: () => ({ date: '2025-06-03', name: '새 공휴일' }),
      insert(s, at, row) { s.settings.holidays.splice(at, 0, row); },
      remove(s, at) { s.settings.holidays.splice(at, 1); }
    },
    restex: {
      label: '휴식일 경기', sheet: S.SHEET_NAMES.restex, unit: '일', parent: 'season', desc: '휴식 요일이지만 경기를 하는 날입니다. 예: 5/5(월) 어린이날.',
      rows: (st) => st.settings.restExceptions.map((d) => ({ date: d })),
      cols: [
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 130, get: (r) => r.date, show: (r) => dateCell(r.date), validate: vDate, setAt: (s, i, v) => { s.settings.restExceptions[i] = P.date(v); } },
        { key: 'note', head: '메모', alias: 'note', w: 0, ro: true, show: (r) => { const h = (app().state.settings.holidays || []).find((x) => x.date === r.date); return esc(h ? h.name : ''); }, html: true }
      ],
      rowIssues(st, i) { const d = st.settings.restExceptions[i]; return st.settings.restWeekdays.includes(Dates.weekday(d)) ? [] : [{ level: 'warn', col: 'date', msg: '휴식 요일이 아니라서 따로 적을 필요가 없습니다.' }]; },
      blank: () => '2025-06-02',
      insert(s, at, row) { s.settings.restExceptions.splice(at, 0, typeof row === 'string' ? row : row.date); },
      remove(s, at) { s.settings.restExceptions.splice(at, 1); }
    },
    blackouts: {
      label: '휴식기', sheet: S.SHEET_NAMES.blackouts, unit: '개', parent: 'season', desc: '올스타 휴식기처럼 경기가 없는 기간입니다. 하루만이면 시작일과 종료일을 같게 적습니다.',
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
      label: '특별 경기', sheet: S.SHEET_NAMES.events, unit: '개', desc: '대진 지정: 그 날짜에 정한 대진을 고정합니다. 구장 지정: 그 구장 연고 구단이 반드시 홈 경기를 합니다.',
      rows: (st) => st.events,
      cols: [
        { key: 'name', head: '이름', alias: 'name', req: true, w: 110, get: (r) => r.name, set: (r, v) => { r.name = String(v).trim(); } },
        { key: 'type', head: '유형', alias: 'type', req: true, w: 90, ro: true, show: (r) => ({ OPENING: '개막전', CHILDREN: '어린이날', CUSTOM: '직접 추가' }[r.type] || r.type) },
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 110, get: (r) => r.date, show: (r) => dateCell(r.date), validate: (v) => vDate(v) || (CalendarGen.slotIndexOfDate(app().state.calendar, P.date(v)) < 0 ? { error: fmt.date(P.date(v)) + '은(는) 어느 연전 기간에도 없습니다.' } : null), set: (r, v) => { r.date = P.date(v); } },
        { key: 'mode', head: '지정 방식', alias: 'mode', req: true, w: 84, ro: true, show: (r) => (r.mode === 'MATCH' ? '대진 지정' : '구장 지정') },
        { key: 'home', head: '홈', alias: 'home', w: 90, get: (r) => r.home || '', show: (r) => (r.home ? S.team(r.home) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.home = String(v).trim(); } },
        { key: 'away', head: '원정', alias: 'away', w: 90, get: (r) => r.away || '', show: (r) => (r.away ? S.team(r.away) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.away = String(v).trim(); } },
        { key: 'stadiums', head: '구장', alias: 'stadiums', w: 0, ro: true, show: (r) => esc((r.stadiums || []).join(', ')) , html: true }
      ],
      rowIssues(st, i) {
        const e = st.events[i];
        const out = [];
        if (CalendarGen.slotIndexOfDate(st.calendar, e.date) < 0) out.push({ level: 'error', col: 'date', msg: '날짜가 어느 연전 기간에도 없습니다.' });
        for (const iss of app().checkEvents()) if (iss.events.includes(e.id)) out.push({ level: iss.level === 'block' ? 'error' : 'warn', col: 'name', msg: iss.message });
        return out;
      },
      blank: () => ({ id: 'ev-' + Date.now().toString(36), type: 'CUSTOM', name: '새 특별 경기', date: '2025-08-15', mode: 'STADIUM', stadiums: ['사직야구장'] }),
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
      '<button class="btn primary sm" data-act="import-xlsx"' + (locked ? ' disabled' : '') + '>' + icon('upload') + '엑셀 올리기</button>' +
      '<button class="btn sm" data-act="import-gsheet"' + (locked ? ' disabled' : '') + '>' + icon('link') + '구글 시트 연결</button>' +
      '<span class="drop-hint">' + icon('file') + '또는 엑셀 파일을 여기에 끌어다 놓기</span>' +
      '<span class="sep" style="width:1px;height:18px;background:var(--line);margin:0 4px"></span>' +
      '<button class="btn sm" data-act="export" data-kind="template">' + icon('file') + '빈 엑셀 양식</button>' +
      '<button class="btn sm" data-act="export" data-kind="xlsx">' + icon('download') + '엑셀로 받기</button>' +
      '<span class="last">' + (li
        ? S.stat('ok', '적용됨') + '<span>' + esc(li.source) + ' · ' + esc(li.sheets) + ' · ' + esc(li.time) + '</span>' + (li.kind === 'gsheet' ? '<button class="btn xs" data-act="import-gsheet-reload">' + icon('redo') + '다시 불러오기</button>' : '')
        : '<span class="muted">현재 데이터: 2025 실제 일정(기본 제공)</span>') + S.mock() + '</span>' +
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
    const nT = st.teams.length, pairs = nT * (nT - 1) / 2;
    let s = '<div class="pane-head"><span class="pane-title">시즌 데이터</span><span class="pane-desc">엑셀 6 · 직접 입력 2</span></div><div class="pane-body" data-sk="d-list">';
    s += '<div class="label">시즌 틀</div>';
    s += item('season', '시즌 기본 설정', '', { icon: 'cal', sub: '직접 입력 · 개막·종료·휴식 요일' });
    s += item('holidays', SHEETS.holidays.label, st.settings.holidays.length, { child: true, issues: sheetIssueCount('holidays') });
    s += item('restex', SHEETS.restex.label, st.settings.restExceptions.length, { child: true, issues: sheetIssueCount('restex') });
    s += item('blackouts', SHEETS.blackouts.label, st.settings.blackouts.length, { child: true, issues: sheetIssueCount('blackouts') });
    s += '<div class="label">편성할 것</div>';
    s += item('slots', SHEETS.slots.label, st.calendar.length, { icon: 'grid', sub: histText(st.calendar), issues: sheetIssueCount('slots') });
    s += item('series', SHEETS.series.label, st.matches.length, { icon: 'list', sub: '맞대결 ' + pairs + '쌍 × ' + (pairs ? Math.round(st.matches.length / pairs * 10) / 10 : 0), issues: sheetIssueCount('series') });
    s += item('events', SHEETS.events.label, st.events.length, { icon: 'target', sub: '대진 지정 ' + st.events.filter((e) => e.mode === 'MATCH').length + ' · 구장 지정 ' + st.events.filter((e) => e.mode === 'STADIUM').length, issues: sheetIssueCount('events') });
    s += '<div class="label">구단</div>';
    s += item('teams', '구단과 거리', st.teams.length, { icon: 'team', sub: '같이 쓰는 구장 ' + app().sharedStadiums().size + ' · 거리 ' + nT * (nT - 1) });
    s += '<div class="list-sep"></div><div class="label">가져온 기록</div>';
    const hist = (S.importHistory || []).slice().reverse();
    s += hist.map((h) => '<div class="small" style="padding:3px 12px 5px;display:flex;gap:6px;align-items:flex-start"><span class="ico" style="color:var(--text-3)">' + icon(h.kind === 'gsheet' ? 'link' : h.kind === 'preset' ? 'db' : 'upload') + '</span><span><b style="font-weight:600">' + esc(h.source) + '</b><br><span class="muted">' + esc(h.detail) + '</span></span></div>').join('');
    s += '</div>';
    return s;
  }
  function histText(cal) { const h = CalendarGen.lengthHistogram(cal); return [2, 3, 4].map((k) => k + '연전 ' + (h[k] || 0)).join(' · '); }
  S.importHistory = [{ kind: 'preset', source: '2025 실제 일정 (기본 제공)', detail: '엑셀 표 6개 · 1/14(화) 09:00' }];

  // ───────── 가운데: 시트 표 ─────────
  function renderSheet(key) {
    const sh = SHEETS[key], st = app().state, u = S.ui;
    const rows = sh.rows(st);
    const cols = visibleCols(sh);
    const cur = u.cell && u.cell.sheet === key ? u.cell : null;
    const selRow = cur ? cur.row : -1;
    const locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    let s = '<div class="toolbar">' +
      '<span class="pane-title">' + esc(sh.label) + '</span><span class="muted small">' + rows.length + '개</span>' +
      '<span class="pane-desc" style="max-width:420px">' + esc(sh.desc) + '</span>' +
      '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' +
      '<span class="btn-group">' +
      '<button class="btn sm" data-act="row-ins" data-pos="above"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 줄 위에 한 줄 추가">' + icon('rowAbove') + '위에 추가</button>' +
      '<button class="btn sm" data-act="row-ins" data-pos="below"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 줄 아래에 한 줄 추가">' + icon('rowBelow') + '아래에 추가</button>' +
      '<button class="btn sm danger" data-act="row-del"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 줄 삭제">' + icon('trash') + '삭제</button></span>' +
      S.undoButtons() +
      (sh.assist ? '<span class="sep" style="width:1px;height:18px;background:var(--line);margin:0 2px"></span><button class="btn sm" data-act="' + sh.assist.act + '" title="규칙대로 채운 결과를 먼저 미리 보여 드립니다">' + icon('bolt') + esc(sh.assist.label) + '</button>' : '') +
      '</span></div>';
    if (locked) s += '<div class="lockbar">' + icon('lock') + '자동 편성 중에는 입력이 잠깁니다. ② 검토·실행에서 중지하면 다시 고칠 수 있습니다.</div>';
    // 열 너비
    s += '<div class="pane-body xy" data-sk="d-sheet-' + key + '" id="sheetScroll"><table class="sheet" role="grid" aria-label="' + esc(sh.label) + ' 표"><colgroup><col style="width:44px">' + cols.map((c) => '<col' + (c.w ? ' style="width:' + c.w + 'px"' : '') + '>').join('') + '<col style="width:92px"></colgroup>';
    // 일반 모드: 번호는 1부터, 엑셀 열 글자는 숨김. 개발자 모드: 엑셀 행 번호(제목 줄 = 1행)와 열 글자.
    const dev = S.dev();
    const colTag = (c) => (dev ? (c.ro ? '계산' : colLetter(sheetColIndex(sh, c))) : (c.ro ? '자동' : '&nbsp;'));
    const colTip = (c) => (dev ? (c.alias ? c.head + '(' + c.alias + ')' : c.head + ' — 계산값(읽기 전용)') : (c.ro ? c.head + ' — 자동으로 계산(고칠 수 없음)' : c.head));
    s += '<thead><tr><th class="rn">' + (dev ? '행' : '번호') + '</th>' + cols.map((c) => '<th' + (c.num ? ' class="num"' : '') + ' title="' + esc(colTip(c)) + '"><span class="col">' + colTag(c) + '</span>' + esc(c.head) + (c.req ? '<span class="req">*</span>' : '') + '</th>').join('') + '<th>확인</th></tr></thead><tbody>';
    rows.forEach((r, i) => {
      const iss = sh.rowIssues(st, i);
      const isNew = r && r._uiNew;
      s += '<tr class="' + (i === selRow ? 'sel' : '') + (isNew ? ' newrow' : '') + '" data-row="' + i + '"><td class="rn">' + (dev ? i + 2 : i + 1) + '</td>';
      cols.forEach((c) => {
        const editing = u.edit && u.edit.sheet === key && u.edit.row === i && u.edit.col === c.key;
        const focus = cur && cur.row === i && cur.col === c.key;
        const ci = iss.find((x) => x.col === c.key && x.level === 'error');
        if (editing) {
          const e = u.edit;
          s += '<td class="cell editing' + (e.error ? ' err' : '') + '"><input id="cellEditor" data-edit="1" value="' + esc(e.value) + '" aria-label="' + esc(c.head) + ' 편집" aria-invalid="' + (e.error ? 'true' : 'false') + '">' +
            (e.error ? '<div class="cell-pop" role="alert"><b>' + icon('x') + esc(dev ? sh.sheet + ' ' + (i + 2) + '행 · ' + colLetter(sheetColIndex(sh, c)) + '열(' + c.head + ')' : sh.sheet + ' · 엑셀 ' + (i + 2) + '번째 줄 · ' + c.head) + '</b>' + esc(e.error) +
              '<div class="acts">' + (e.fix ? '<button class="btn xs primary" data-act="cell-fix">' + icon('check') + '「' + esc(e.fix) + '」 값으로 바꾸기</button>' : '') + '<button class="btn xs" data-act="cell-cancel">취소 <span class="kbd">Esc</span></button></div></div>' : '') + '</td>';
        } else {
          const val = c.show ? c.show(r, i) : esc(c.get(r));
          s += '<td class="' + (c.ro ? 'ro' : 'cell') + (c.num ? ' num' : '') + (focus ? ' focus' : '') + (ci ? ' err' : '') + '" data-act="cell" data-row="' + i + '" data-col="' + c.key + '"' + (ci ? ' title="' + esc(ci.msg) + '"' : '') + '>' + (c.html || c.show ? (c.html ? val : esc(val)) : val) + (isNew && c.key === cols[0].key ? ' <span class="tag new">새 줄</span>' : '') + '</td>';
        }
      });
      const worst = iss.find((x) => x.level === 'error') ? 'bad' : iss.length ? 'warn' : 'ok';
      s += '<td>' + (worst === 'ok' ? '<span class="st plain ok">' + icon('check') + '문제 없음</span>' : worst === 'bad' ? '<span class="st plain bad" title="' + esc(iss.map((x) => x.msg).join(' / ')) + '">' + icon('x') + '오류</span>' : '<span class="st plain warn" title="' + esc(iss.map((x) => x.msg).join(' / ')) + '">' + icon('warn') + '확인 필요</span>') + '</td></tr>';
    });
    s += '</tbody></table></div>';
    s += '<div class="pane-foot small muted" style="white-space:nowrap;overflow:hidden">' + icon('info') + '<span style="overflow:hidden;text-overflow:ellipsis" title="여러 줄을 한꺼번에 고치거나 붙여 넣을 때는 엑셀에서 고친 뒤 다시 가져옵니다.">칸을 누르고 <span class="kbd">Enter</span>나 두 번 눌러 고칩니다 · 화살표로 이동 · <span class="kbd">Esc</span>로 취소 · 고친 값은 오른쪽 그림에 바로 보입니다</span></div>';
    return s;
  }
  function sheetColIndex(sh, col) { return sh.cols.filter((c) => !c.ro).indexOf(col); }

  // ───────── 시즌 골격 ─────────
  function renderSeason() {
    const st = app().state, set = st.settings;
    const wd = ['일', '월', '화', '수', '목', '금', '토'];
    let s = '<div class="pane-head"><span class="pane-title">시즌 기본 설정</span><span class="pane-desc">개막·종료일과 휴식 요일은 여기서 입력합니다. 공휴일·휴식일 경기·휴식기는 왼쪽 목록에서 고칩니다.</span></div>';
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
    s += '<div class="blk" style="margin-top:12px"><div class="blk-head">시즌 달력 <span class="muted small" style="font-weight:400">지금 연전 기간 기준 · 3월~10월</span><span class="r legend"><span><i style="background:#D3DFF5"></i>경기일</span><span><i style="background:#A9C1EC"></i>주말</span><span><i style="background:#F7F7F8;border:1px solid #E2E5EA"></i>휴식</span><span><i style="background:repeating-linear-gradient(135deg,#F3D9B5 0 3px,#FBEEDB 3px 6px)"></i>경기 없는 기간</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #B3261E;border-radius:50%;width:8px;height:8px"></i>공휴일</span><span><i style="box-shadow:inset 2px 0 0 #0A1E3C;background:#D3DFF5"></i>연전 시작일</span></span></div><div class="blk-body"><div class="strip">';
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
    const sub = (k, title, lines) => '<div class="blk"><div class="blk-head">' + icon('sheet') + esc(title) + '<span class="r"><span class="muted small">' + lines.length + '개</span><button class="btn xs" data-act="d-tab" data-tab="' + k + '">표 열기' + icon('right') + '</button></span></div><div class="blk-body small" style="padding:6px 10px;display:flex;flex-direction:column;gap:2px">' + (lines.length ? lines.slice(0, 4).map((x) => '<div>' + x + '</div>').join('') + (lines.length > 4 ? '<div class="muted">외 ' + (lines.length - 4) + '개</div>' : '') : '<span class="muted">없음</span>') + '</div></div>';
    s += '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px">' +
      sub('holidays', SHEETS.holidays.label, set.holidays.map((h) => '<span class="mono">' + esc(fmt.date(h.date)) + '</span> ' + esc(h.name))) +
      sub('restex', SHEETS.restex.label, set.restExceptions.map((d) => '<span class="mono">' + esc(fmt.date(d)) + '</span> 휴식 요일이지만 경기')) +
      sub('blackouts', SHEETS.blackouts.label, set.blackouts.map((b) => '<span class="mono">' + esc(fmt.date(b.start) + (b.end !== b.start ? ' ~ ' + fmt.date(b.end) : '')) + '</span> ' + esc(b.label || ''))) + '</div>';
    s += '</div>';
    return s;
  }

  // ───────── 구단과 거리 ─────────
  function renderTeams() {
    const st = app().state, u = S.ui;
    const sel = u.cell && u.cell.sheet === 'teams' ? u.cell.row : -1;
    const shared = app().sharedStadiums();
    let s = '<div class="pane-head"><span class="pane-title">구단과 거리</span><span class="pane-desc">구단과 구장 위치입니다. 구장 사이 거리표는 접어 두었습니다. 여기서 직접 입력합니다.</span></div>';
    s += '<div class="pane-body pad" data-sk="d-teams"><div style="display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:12px;align-items:start">';
    s += '<div class="blk"><table class="sheet"><colgroup><col style="width:44px"><col style="width:110px"><col><col style="width:86px"><col style="width:86px"></colgroup><thead><tr><th class="rn">#</th><th>구단</th><th>구장</th><th class="num">위도</th><th class="num">경도</th></tr></thead><tbody>' +
      st.teams.map((t, i) => {
        const sh = Array.from(shared.keys()).includes(t.stadium);
        return '<tr class="' + (i === sel ? 'sel' : '') + '"><td class="rn">' + (i + 1) + '</td><td class="cell" data-act="team-sel" data-row="' + i + '">' + S.team(t.name) + '</td><td class="cell" data-act="team-sel" data-row="' + i + '">' + esc(t.stadium) + (sh ? ' <span class="tag shared">같이 쓰는 구장</span>' : '') + '</td><td class="num mono">' + t.latitude.toFixed(4) + '</td><td class="num mono">' + t.longitude.toFixed(4) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    const markers = st.teams.map((t, i) => ({ id: t.name, lat: t.latitude, lon: t.longitude, x: 0, y: 0, color: t.color, label: t.name, size: i === sel ? 7 : 5, active: i === sel }));
    let mapSvg = '';
    try {
      const proj = KBO.MapKit.projection(250);
      for (const mk of markers) { const p = proj.project(mk.lat, mk.lon); mk.x = p[0]; mk.y = p[1]; }
      mapSvg = KBO.MapKit.render({ width: 250, markers, grid: false, spread: 10, title: '구장 위치' }).svg;
    } catch (e) { mapSvg = '<div class="empty">지도를 그릴 수 없습니다.</div>'; }
    s += '<div class="blk"><div class="blk-head">' + icon('map') + '구장 지도' + (S.dev() ? '<span class="r"><span class="tag ref">내장 SVG</span></span>' : '') + '</div><div class="blk-body mapbox" style="padding:6px">' + mapSvg + '</div>' +
      (S.feature('T4') ? '<div class="pane-foot small" data-feature="T4">' + icon('move') + '구장 표시를 끌어 위치를 조금씩 옮길 수 있습니다' + (S.dev() ? ' <span class="tag ref">FR-T4</span>' : '') + '</div>' : '') + '</div>';
    s += '</div>';
    if (S.feature('T7')) {
      const names = st.teams.map((t) => t.name);
      const values = names.map((a) => names.map((b) => (a === b ? null : (app().distanceOf(a, b) || {}).distance)));
      s += '<details class="fold" style="margin-top:12px" data-feature="T7"><summary>' + icon('grid') + '구장 간 거리표 <span class="muted">km · A→B를 고치면 B→A도 함께 바뀜</span></summary><div style="padding:8px 10px" class="chart-box">' +
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
  S.inputViz = function (key) {
    const st = app().state, u = S.ui;
    const row = u.cell && u.cell.sheet === key ? u.cell.row : -1;
    const sec = (title, right, body, cls) => '<div class="insp-sec viz' + (cls ? ' ' + cls : '') + '"><h4>' + icon('chart') + esc(title) + (right ? '<span class="r">' + right + '</span>' : '') + '</h4>' + body + '</div>';
    if (key === 'series') {
      const names = st.teams.map((t) => t.name);
      const counts = V().pairCounts(st.matches, names);
      const r = row >= 0 ? st.matches[row] : null;
      const vc = vizChanged('series');
      const mx = V().pairMatrix({ names, counts, target: st.settings.initialGamesPerPair, sel: r ? { home: r.home, away: r.away } : null, changed: vc ? vc.keys : null, before: vc ? vc.before : null, title: '맞대결 경기 수' });
      let note = mx.off ? '<div class="vz-note warn">' + icon('warn') + '맞대결 ' + mx.off + '쌍은 두 구단 경기 수 합이 ' + st.settings.initialGamesPerPair + '가 아닙니다.</div>' : '<div class="vz-note ok">' + icon('check') + '모든 맞대결 ' + st.settings.initialGamesPerPair + '경기 (홈 ' + st.settings.homeGamesMajor + ' · 원정 ' + (st.settings.initialGamesPerPair - st.settings.homeGamesMajor) + ')</div>';
      if (vc) note += '<div class="vz-note chg">' + icon('info') + '방금 바뀐 칸 ' + vc.keys.size + ': ' + Array.from(vc.keys).slice(0, 3).map((k) => { const [h, a] = k.split('|'); return esc(h + ' 홈 × ' + a) + ' ' + (vc.before.get(k) || 0) + '→' + (counts.get(k) || 0); }).join(', ') + '</div>';
      return sec('맞대결 경기 수', '가로줄 홈 × 세로줄 원정', mx.html + note) +
        sec('연전 수 맞추기', '연전 기간마다 ' + (st.teams.length >> 1) + '시리즈', V().balance({ slots: st.calendar, matches: st.matches, teams: st.teams.length }));
    }
    const ribbonSheets = { season: 1, slots: 1, holidays: 1, restex: 1, blackouts: 1, events: 1 };
    if (!ribbonSheets[key]) return '';
    if (key === 'season') {
      const gen = CalendarGen.generateSlots(st.settings).slots;
      const diff = V().diffSlots(st.calendar, gen);
      return sec('규칙으로 만든 경기일', '지금 연전 기간과 ' + (diff.size ? '<b style="color:var(--warn)">' + diff.size + '곳 다름</b>' : '같음'), V().ribbon({ settings: st.settings, slots: gen, changed: diff, label: '규칙으로 만든 경기일' }));
    }
    const o = { settings: st.settings, slots: st.calendar, label: '시즌 달력' };
    let right = '';
    const vc = vizChanged(key);
    if (key === 'slots') {
      o.sel = row >= 0 ? row : null;
      if (vc) o.changed = vc.keys;
      const errRows = new Set(); st.calendar.forEach((c, i) => { if (SHEETS.slots.rowIssues(st, i).some((x) => x.level === 'error')) errRows.add(i); });
      o.errRows = errRows;
      const c = row >= 0 ? st.calendar[row] : null;
      right = c ? '선택 ' + (row + 1) + '번째 · ' + esc(fmt.short(c.datetime.slice(0, 10))) + ' ' + c.consecutive + '연전' : '경기일 ' + st.calendar.reduce((a, x) => a + x.consecutive, 0) + '일';
    } else {
      if (vc) o.changedDays = vc.keys;
      const sd = new Set();
      if (key === 'holidays' && row >= 0 && st.settings.holidays[row]) sd.add(Dates.dayNum(st.settings.holidays[row].date));
      if (key === 'restex' && row >= 0 && st.settings.restExceptions[row]) sd.add(Dates.dayNum(st.settings.restExceptions[row]));
      if (key === 'blackouts' && row >= 0 && st.settings.blackouts[row]) { const b = st.settings.blackouts[row]; for (let d = Dates.dayNum(b.start); d <= Dates.dayNum(b.end); d++) sd.add(d); }
      if (key === 'events') o.events = st.events.map((e, i) => ({ date: e.date, name: e.name, sel: i === row }));
      o.selDays = sd;
      right = { holidays: '공휴일 ' + st.settings.holidays.length + '일', restex: '휴식일 경기 ' + st.settings.restExceptions.length + '일', blackouts: '휴식기 ' + st.settings.blackouts.length + '개', events: '특별 경기 ' + st.events.length + '개' }[key];
    }
    let body = V().ribbon(o);
    if (vc) body += '<div class="vz-note chg">' + icon('info') + '방금 바뀐 ' + (key === 'slots' ? '연전 기간 ' + vc.keys.size + '개' : '날짜 ' + vc.keys.size + '일') + '을 파란 테두리로 표시했습니다.</div>';
    return sec('시즌 달력', right, body) +
      (key === 'slots' ? sec('연전 수 맞추기', '연전 기간마다 ' + (st.teams.length >> 1) + '시리즈', V().balance({ slots: st.calendar, matches: st.matches, teams: st.teams.length })) : '');
  };

  // ───────── 인스펙터 ─────────
  function renderInsp() {
    const b = renderInspBase();
    const v = S.inputViz(S.ui.tab);
    if (v) b.html = v + b.html.replace(/<div class="empty"><b>줄을 고르세요<\/b>[^<]*<\/div>/, '<div class="small muted" style="padding:10px 12px">' + icon('info') + ' 줄을 고르면 위 그림에 표시되고, 아래에서 값을 고치고 확인할 수 있습니다.</div>');
    return b;
  }
  function renderInspBase() {
    const u = S.ui, st = app().state, key = u.tab;
    if (key === 'season') {
      const gen = CalendarGen.generateSlots(st.settings);
      const same = !app().slotsOutOfDate();
      const h = CalendarGen.lengthHistogram(gen.slots);
      return { title: '규칙 미리보기', html: '<div class="insp-sec"><h4>규칙대로 만든 연전 기간' + (S.dev() ? ' (§5.2.1)' : '') + '</h4><dl class="props"><dt>개수</dt><dd><b>' + gen.slots.length + '</b></dd><dt>연전 분포</dt><dd>2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + '</dd><dt>지금과 비교</dt><dd>' + (same ? S.stat('ok', '같음') : S.stat('warn', '다름')) + '</dd><dt>연속 경기일 묶음</dt><dd>' + gen.runs.length + '개</dd></dl>' +
        '<button class="btn sm" style="margin-top:10px" data-act="draft-slots">' + icon('bolt') + '규칙대로 자동 채우기</button><div class="small muted" style="margin-top:6px">바로 바꾸지 않고 먼저 미리 보여 드립니다.</div></div>' +
        '<div class="insp-sec"><h4>세부 표</h4>' + ['holidays', 'restex', 'blackouts'].map((k) => '<button class="li" data-act="d-tab" data-tab="' + k + '" style="padding-left:4px"><span class="ico">' + icon('sheet') + '</span><span class="li-main">' + SHEETS[k].label + '</span><span class="cnt">' + rowsOf(k).length + '</span>' + icon('right') + '</button>').join('') + '</div>' };
    }
    if (key === 'teams') {
      const i = u.cell && u.cell.sheet === 'teams' ? u.cell.row : -1;
      if (i < 0) return { title: '구단', html: '<div class="empty"><b>구단을 고르세요</b>표에서 구단을 고르면 구장·위치·거리를 보여 줍니다.</div>' };
      const t = st.teams[i];
      const others = st.teams.filter((x) => x.name !== t.name).map((x) => ({ n: x.name, d: (app().distanceOf(t.name, x.name) || {}).distance })).sort((a, b) => a.d - b.d);
      return { title: '구단 자세히', html: '<div class="insp-sec"><div class="insp-title">' + S.team(t.name) + '</div><div class="insp-sub">' + esc(t.stadium) + '</div></div>' +
        '<div class="insp-sec"><h4>정보</h4><dl class="props"><dt>구단명</dt><dd><input class="input sm" value="' + esc(t.name) + '" data-in="team-field" data-row="' + i + '" data-k="name"></dd><dt>구장</dt><dd><input class="input sm" value="' + esc(t.stadium) + '" data-in="team-field" data-row="' + i + '" data-k="stadium"></dd><dt>위도·경도</dt><dd class="mono">' + t.latitude.toFixed(4) + ', ' + t.longitude.toFixed(4) + '</dd><dt>색</dt><dd><span class="tm"><i style="background:' + esc(t.color) + ';width:14px;height:14px"></i>' + esc(t.color) + '</span></dd></dl></div>' +
        '<div class="insp-sec"><h4>다른 구장까지 거리<span class="r">km</span></h4>' + others.map((o) => '<div style="display:flex;justify-content:space-between;height:22px;align-items:center" class="small">' + S.team(o.n) + '<span class="mono">' + fmt.km(o.d) + '</span></div>').join('') + '</div>' };
    }
    const sh = SHEETS[key];
    const i = u.cell && u.cell.sheet === key ? u.cell.row : -1;
    const rows = rowsOf(key);
    if (i < 0 || i >= rows.length) {
      const c = sheetIssueCount(key);
      return { title: sh.label + ' 요약', html: '<div class="insp-sec"><h4>요약</h4><dl class="props"><dt>개수</dt><dd><b>' + rows.length + '</b></dd><dt>오류</dt><dd>' + (c.e ? S.stat('block', c.e + '건') : S.stat('ok', '0')) + '</dd><dt>확인 필요</dt><dd>' + (c.w ? S.stat('warn', c.w + '건') : S.stat('ok', '0')) + '</dd></dl></div><div class="empty"><b>줄을 고르세요</b>줄을 고르면 값 고치기, 확인 결과, 관련 정보가 여기에 나옵니다.</div>' };
    }
    const r = rows[i];
    const iss = sh.rowIssues(st, i);
    let s = '<div class="insp-sec"><div class="insp-title">' + esc(sh.label) + ' ' + (i + 1) + '번째' + (r && r._uiNew ? '<span class="tag new">새 줄</span>' : '') + '</div><div class="insp-sub">엑셀에서는 ' + (i + 2) + '번째 줄입니다(제목 줄 다음부터).</div></div>';
    s += '<div class="insp-sec"><h4>값</h4><dl class="props">' + sh.cols.map((c) => {
      const editing = u.edit && u.edit.sheet === key && u.edit.row === i && u.edit.col === c.key;
      const err = editing && u.edit.error ? u.edit.error : null;
      if (c.ro) return '<dt>' + esc(c.head) + '</dt><dd class="small">' + (c.html ? c.show(r, i) : esc(c.show(r, i))) + '</dd>';
      return '<dt>' + esc(c.head) + (c.req ? ' *' : '') + '</dt><dd><input class="input sm' + (err ? ' err' : '') + '" style="width:100%" value="' + esc(editing ? u.edit.value : c.get(r)) + '" data-in="row-field" data-row="' + i + '" data-col="' + c.key + '">' + (err ? '<span class="small" style="color:var(--bad)">' + icon('x') + esc(err) + '</span>' : '') + '</dd>';
    }).join('') + '</dl></div>';
    s += '<div class="insp-sec"><h4>확인</h4>' + (iss.length || (u.edit && u.edit.error) ? (u.edit && u.edit.error && u.edit.row === i ? '<div class="small" style="color:var(--bad);display:flex;gap:6px">' + icon('x') + '<span>고치는 중: ' + esc(u.edit.error) + '</span></div>' : '') + iss.map((x) => '<div class="small" style="display:flex;gap:6px;color:' + (x.level === 'error' ? 'var(--bad)' : 'var(--warn)') + '">' + icon(x.level === 'error' ? 'x' : 'warn') + '<span>' + esc(x.msg) + '</span></div>').join('') : S.stat('ok', '문제 없음')) + '</div>';
    s += relatedInfo(key, i, r);
    s += '<div class="insp-sec"><h4>편집</h4><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="row-ins" data-pos="above">' + icon('rowAbove') + '위에 추가</button><button class="btn sm" data-act="row-ins" data-pos="below">' + icon('rowBelow') + '아래에 추가</button><button class="btn sm danger" data-act="row-del">' + icon('trash') + '삭제</button></div></div>';
    return { title: '선택한 ' + sh.label, html: s };
  }
  function relatedInfo(key, i, r) {
    const st = app().state, c = D();
    if (key === 'series') {
      const slot = c.plan[i];
      const pairGames = st.matches.filter((m) => (m.home === r.home && m.away === r.away) || (m.home === r.away && m.away === r.home));
      const homeG = pairGames.filter((m) => m.home === r.home).reduce((a, m) => a + m.consecutive, 0);
      const tot = pairGames.reduce((a, m) => a + m.consecutive, 0);
      return '<div class="insp-sec"><h4>관련 정보</h4><dl class="props"><dt>맞대결</dt><dd>' + esc(r.home + '–' + r.away) + ' ' + tot + '경기 <span class="muted small">(' + esc(r.home) + ' 홈 ' + homeG + ' · ' + esc(r.away) + ' 홈 ' + (tot - homeG) + ')</span></dd><dt>들어간 연전 기간</dt><dd>' + (slot >= 0 ? '<button class="btn xs" data-act="sel-match" data-m="' + i + '">' + icon('cal') + esc(c.slots[slot].label) + ' — ③에서 보기</button>' : '<span class="muted">일정 미정 (가져온 뒤 자동 편성을 돌려야 함)</span>') + '</dd></dl></div>';
    }
    if (key === 'slots') {
      const ms = c.bySlot[i] || [];
      const rule = CalendarGen.slotWeights(Dates.dayNum(r.datetime), r.consecutive, CalendarGen.holidaySet(st.settings));
      return '<div class="insp-sec"><h4>관련 정보</h4><dl class="props"><dt>규칙대로라면</dt><dd>' + (rule.weekend ? '주말' : '주중') + ' · 휴일 등급 ' + rule.holiday + ' ' + (rule.weekend === r.weekend && rule.holiday === r.holiday ? '<span class="tag auto">규칙과 같음</span>' : '<span class="tag ref">직접 고친 값</span>') + '</dd><dt>이 기간의 시리즈</dt><dd class="small">' + (ms.length ? ms.map((m) => esc(app().matchLabel(m))).join(', ') : '<span class="muted">없음</span>') + '</dd></dl></div>';
    }
    if (key === 'events') {
      const slot = Score.resolveEventSlot(r, st.calendar);
      const pinned = st.matches.findIndex((m) => m.eventId === r.id);
      return '<div class="insp-sec"><h4>관련 정보</h4><dl class="props"><dt>연전 기간</dt><dd>' + (slot >= 0 ? esc(c.slots[slot].label) : '<span style="color:var(--bad)">없음</span>') + '</dd>' + (r.mode === 'MATCH' ? '<dt>고정 시리즈</dt><dd>' + (pinned >= 0 ? '<span class="tag pin">' + icon('pin') + esc(app().matchLabel(pinned)) + '</span>' : '<span class="muted">자동 편성 때 고정됩니다</span>') + '</dd>' : '<dt>꼭 홈이어야 하는 구단</dt><dd class="small">' + esc((r.stadiums || []).map((x) => st.teams.filter((t) => t.stadium === x).map((t) => t.name).join('·')).join(', ')) + '</dd>') + '</dl></div>';
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
      return '<div class="stepview">' + renderBand() + S.workspace({ list: renderList(), main, insp: insp.html, inspTitle: insp.title, listLabel: '데이터 목록', cls: u.tab === 'teams' ? '' : 'ws-data' }) + '</div>';
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
  function locked() { if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) { S.toast('자동 편성 중에는 입력이 잠깁니다. 먼저 중지하세요.', 'warn'); return true; } return false; }
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
      S.trackViz(e.sheet, () => app().commit(sh.label + ' ' + (e.row + 1) + '번째 ' + c.head + ': ' + old + ' → ' + e.value, (s) => {
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
    S.trackViz(key, () => app().commit(sh.label + ' ' + (at + 1) + '번째 줄 추가', (s) => { sh.insert(s, at, blank); }, ['input', 'plan']));
    u.edit = null;
    u.cell = { sheet: key, row: at, col: sh.cols.find((c) => !c.ro).key };
    S.toast(sh.label + ' ' + (at + 1) + '번째에 한 줄을 ' + (pos === 'above' ? '위에' : '아래에') + ' 추가했습니다. 값을 고치세요.' + (key === 'series' ? ' 새 시리즈는 일정 미정 보관함으로 들어갑니다.' : ''), 'info');
    S.render();
  }
  S.insertRow = insertRow;
  function deleteRow() {
    const u = S.ui, key = u.tab, sh = SHEETS[key];
    if (!sh || !u.cell || u.cell.sheet !== key || locked()) return;
    const at = u.cell.row;
    S.trackViz(key, () => app().commit(sh.label + ' ' + (at + 1) + '번째 줄 삭제', (s) => { sh.remove(s, at); }, ['input', 'plan']));
    u.edit = null;
    const n = sh.rows(app().state).length;
    u.cell = n ? { sheet: key, row: Math.min(at, n - 1), col: u.cell.col } : null;
    S.toast(sh.label + ' ' + (at + 1) + '번째 줄을 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.', 'info');
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
    'row-ins': (el) => insertRow(el.dataset.pos),
    'row-del': () => deleteRow(),
    'team-sel': (el) => { S.ui.cell = { sheet: 'teams', row: +el.dataset.row, col: 'name' }; S.render(); },
    'rest-wd': (el) => {
      if (locked()) return;
      const w = +el.dataset.wd;
      const cur = app().state.settings.restWeekdays.slice();
      const i = cur.indexOf(w); if (i >= 0) cur.splice(i, 1); else cur.push(w);
      app().updateSettings({ restWeekdays: cur.sort() }, '휴식 요일 변경');
      if (app().slotsOutOfDate()) S.toast('휴식 요일을 바꿨습니다. 지금 연전 기간이 규칙과 달라졌으니, 오른쪽 「규칙대로 자동 채우기」로 확인하세요.', 'warn', 5000);
    }
  });
  S.inputs.season = (el) => {
    if (locked()) return;
    const v = P.date(el.value);
    if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "'", 'bad'); return; }
    app().updateSettings({ [el.dataset.k]: v }, '시즌 기본 설정: ' + ({ seasonStart: '개막일', initialEnd: '1차 편성 종료일', seasonEnd: '시즌 종료일' }[el.dataset.k] || el.dataset.k));
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
