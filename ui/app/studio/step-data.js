/*
 * alt-a 편성 스튜디오 — ① 데이터 준비
 * 기본 화면은 시즌 달력 한 화면(season-calendar.js). 여기는 그 화면이 쓰는 표 정의·구단 정보와
 * 전문가용 「모든 표 보기」(위: 가져오기 띠 / 왼쪽: 시트 목록 / 가운데: 시트 표 · 시즌 골격 폼 · 구단 정보 / 오른쪽: 행 인스펙터)다.
 * 휴식일 경기·휴식기 표는 달력의 묶음에서 만들어지므로 읽기만 한다.
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
      if (m) return iso(S.seasonYear(), +m[1], +m[2]); // 연도 없는 M/D는 시즌 연도(개막일 기준, 없으면 2025)
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
  /** 빈 표에서 첫 줄의 기준 날짜: 개막일 → 없으면 시즌 연도 3월 22일 */
  const baseDate = (st) => (st.settings.seasonStart || (S.seasonYear() + '-03-22'));
  /** 첫 연전 기간 날짜(없으면 기준 날짜) */
  const firstSlotDate = (st) => (st.calendar.length ? st.calendar[0].datetime.slice(0, 10) : baseDate(st));
  /** 기준 날짜 뒤 첫 휴식 요일(휴식일 경기 새 줄용) */
  const nextRestDay = (st) => { const d0 = Dates.dayNum(baseDate(st)); const rest = st.settings.restWeekdays.length ? st.settings.restWeekdays : [1]; for (let d = d0; d < d0 + 7; d++) if (rest.includes(Dates.weekday(d))) return Dates.isoDate(d); return Dates.isoDate(d0); };
  const STADIUM_NAMES = () => app().state.teams.map((t) => t.stadium).filter((x, i, a) => a.indexOf(x) === i);
  const vMode = (v) => (['대진 지정', '구장 지정', 'MATCH', 'STADIUM'].includes(String(v).trim()) ? null : { error: '「대진 지정」 또는 「구장 지정」으로 씁니다.', fix: /대진|MATCH/i.test(String(v)) ? '대진 지정' : '구장 지정' });
  const parseMode = (v) => (/대진|MATCH/i.test(String(v)) ? 'MATCH' : 'STADIUM');
  const vStadiums = (v) => { const names = STADIUM_NAMES(); const bad = String(v).split(/[,、·]/).map((x) => x.trim()).filter(Boolean).filter((x) => !names.includes(x)); return bad.length ? { error: "모르는 구장 '" + bad[0] + "' — 구단 정보 화면의 구장 이름을 쉼표로 적습니다." } : null; };
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
      blank: (st, i) => { const p = st.calendar[i] || st.calendar[st.calendar.length - 1]; const d = p ? Dates.dayNum(p.datetime) + p.consecutive : Dates.dayNum(baseDate(st)); return { index: 0, datetime: Dates.isoDate(d) + ' 00:00:00', consecutive: 3, weekend: 0, holiday: 0, note: '새 줄' }; },
      emptyHint: '한 줄이 한 연전 기간입니다. 시즌 기본 설정(개막일·종료일·휴식 요일·휴식기)대로 「규칙대로 자동 채우기」가 한 번에 만들어 드립니다.',
      insert(s, at, row) { s.calendar.splice(at, 0, row); s.calendar.forEach((c, k) => { c.index = k; }); for (const p of s.plan) if (p.calendar >= at) p.calendar++; },
      remove(s, at) { s.calendar.splice(at, 1); s.calendar.forEach((c, k) => { c.index = k; }); for (const p of s.plan) { if (p.calendar === at) p.calendar = -1; else if (p.calendar > at) p.calendar--; } },
      assist: { act: 'draft-slots', label: '규칙대로 자동 채우기' }
    },
    series: {
      label: '시리즈', sheet: S.SHEET_NAMES.series, unit: '시리즈', desc: '같은 두 구단이 한 구장에서 치르는 2~4연전입니다. 날짜와 고정은 ③에서 정합니다.',
      rows: (st) => st.matches,
      cols: [
        { key: 'home', head: '홈', alias: 'home', req: true, w: 120, get: (r) => r.home, show: (r) => S.team(r.home) + (r.pinned ? ' <span class="muted" title="홈 구장 지정으로 고정(③에서 관리)">' + icon('pin') + '</span>' : ''), html: true, validate: (v, r) => vTeam(v) || (String(v).trim() === r.away ? { error: '홈과 원정이 같습니다.' } : null), set: (r, v) => { r.home = String(v).trim(); } },
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
      blank: (st, i) => { const p = st.matches[i] || st.matches[0] || { home: (st.teams[0] || {}).name || '', away: (st.teams[1] || {}).name || '', consecutive: 3 }; return { index: 0, home: p.home, away: p.away, consecutive: p.consecutive, pinned: false, note: '새 줄' }; },
      emptyHint: '한 줄이 한 시리즈(홈·원정·연전 수)입니다. 맞대결마다 정한 경기 수를 연전 기간에 맞게 「맞대결 규칙대로 자동 채우기」가 만들어 드립니다. 연전 기간이 먼저 있어야 합니다.',
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
      label: '공휴일', sheet: S.SHEET_NAMES.holidays, unit: '일', parent: 'season', desc: '홈 경기 공정성에 쓰는 공휴일과 가중치(주말 하루 = 1)입니다. 같은 날짜는 한 번만 적습니다.',
      rows: (st) => st.settings.holidays,
      cols: [
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 130, get: (r) => r.date, show: (r) => dateCell(r.date), validate: vDate, set: (r, v) => { r.date = P.date(v); } },
        { key: 'name', head: '이름', alias: 'name', req: true, w: 200, get: (r) => r.name, validate: (v) => (String(v).trim() ? null : { error: '이름이 비었습니다.' }), set: (r, v) => { r.name = String(v).trim(); } },
        { key: 'weight', head: '가중치', alias: 'weight', w: 70, num: true, get: (r) => (r.weight == null ? CalendarGen.HOLIDAY_WEIGHT : r.weight), validate: (v) => { const n = Number(String(v).trim()); return String(v).trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 10 ? null : { error: '가중치는 0~10 정수입니다(주말 하루 = 1).' }; }, set: (r, v) => { r.weight = Number(String(v).trim()); } },
        { key: 'slot', head: '속한 연전 기간', w: 0, ro: true, show: (r) => { const i = CalendarGen.slotIndexOfDate(app().state.calendar, r.date); return i >= 0 ? D().slots[i].label : '<span class="muted">경기 없음</span>'; }, html: true }
      ],
      rowIssues(st, i) { const r = st.settings.holidays[i]; return st.settings.holidays.some((h, k) => k !== i && h.date === r.date) ? [{ level: 'error', col: 'date', msg: '같은 날짜가 두 번 있습니다.' }] : []; },
      blank: (st) => ({ date: baseDate(st), name: '새 공휴일', weight: CalendarGen.HOLIDAY_WEIGHT }),
      insert(s, at, row) { s.settings.holidays.splice(at, 0, row); },
      remove(s, at) { s.settings.holidays.splice(at, 1); },
      assist: { act: 'fill-holidays', label: '법정 공휴일 채우기' },
      emptyHint: '시즌 기간의 법정 공휴일(어린이날·현충일·광복절 등)입니다. 「법정 공휴일 채우기」로 한 번에 넣고, 임시 공휴일만 직접 더합니다.'
    },
    restex: {
      label: '휴식일 경기', sheet: S.SHEET_NAMES.restex, unit: '일', parent: 'season', derived: true, desc: '휴식 요일이지만 경기를 하는 날입니다(예: 5/5(월) 어린이날). 시즌 달력에서 휴식 요일에 묶음을 그리면 여기에 생깁니다 — 읽기만.',
      rows: (st) => st.settings.restExceptions.map((d) => ({ date: d })),
      cols: [
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 130, ro: true, get: (r) => r.date, show: (r) => dateCell(r.date) },
        { key: 'note', head: '메모', alias: 'note', w: 0, ro: true, show: (r) => { const h = (app().state.settings.holidays || []).find((x) => x.date === r.date); return esc(h ? h.name : ''); }, html: true }
      ],
      rowIssues(st, i) { const d = st.settings.restExceptions[i]; return st.settings.restWeekdays.includes(Dates.weekday(d)) ? [] : [{ level: 'warn', col: 'date', msg: '휴식 요일이 아니라서 따로 적을 필요가 없습니다.' }]; },
      blank: (st) => nextRestDay(st),
      insert(s, at, row) { s.settings.restExceptions.splice(at, 0, typeof row === 'string' ? row : row.date); },
      remove(s, at) { s.settings.restExceptions.splice(at, 1); },
      emptyHint: '휴식 요일인데 경기를 하는 날입니다. 시즌 달력에서 휴식 요일(월)에 묶음을 그리면 여기에 생깁니다. 예: 5/5(월) 어린이날.'
    },
    blackouts: {
      label: '휴식기', sheet: S.SHEET_NAMES.blackouts, unit: '개', parent: 'season', derived: true, desc: '올스타 휴식기처럼 경기가 없는 기간입니다. 시즌 달력에서 묶음이 없는 날(휴식 요일 말고)이 여기에 생깁니다 — 읽기만.',
      rows: (st) => st.settings.blackouts,
      cols: [
        { key: 'start', head: '시작일', alias: 'start', req: true, w: 130, ro: true, get: (r) => r.start, show: (r) => dateCell(r.start) },
        { key: 'end', head: '종료일', alias: 'end', req: true, w: 130, ro: true, get: (r) => r.end, show: (r) => dateCell(r.end) },
        { key: 'name', head: '이름', alias: 'name', req: true, w: 0, ro: true, get: (r) => r.label || '', show: (r) => r.label || '' }
      ],
      rowIssues(st, i) { const r = st.settings.blackouts[i]; return r.start > r.end ? [{ level: 'error', col: 'end', msg: '시작일이 종료일보다 늦습니다.' }] : []; },
      blank: (st) => ({ start: baseDate(st), end: baseDate(st), label: '새 기간' }),
      insert(s, at, row) { s.settings.blackouts.splice(at, 0, row); },
      remove(s, at) { s.settings.blackouts.splice(at, 1); },
      emptyHint: '올스타 휴식기처럼 경기가 없는 기간입니다. 시즌 달력에서 그 주 묶음을 지우면 여기에 생깁니다.'
    },
    events: {
      label: '특별 경기', sheet: S.SHEET_NAMES.events, unit: '개', desc: '대진 지정: 그 날짜에 정한 대진을 고정합니다. 구장 지정: 그 구장 연고 구단이 반드시 홈 경기를 합니다.',
      rows: (st) => st.events,
      cols: [
        { key: 'name', head: '이름', alias: 'name', req: true, w: 110, get: (r) => r.name, set: (r, v) => { r.name = String(v).trim(); } },
        { key: 'type', head: '유형', alias: 'type', req: true, w: 90, ro: true, show: (r) => ({ OPENING: '개막전', CHILDREN: '어린이날', CUSTOM: '직접 추가' }[r.type] || r.type) },
        { key: 'date', head: '날짜', alias: 'date', req: true, w: 110, get: (r) => r.date, show: (r) => dateCell(r.date), validate: (v) => vDate(v) || (CalendarGen.slotIndexOfDate(app().state.calendar, P.date(v)) < 0 ? { error: fmt.date(P.date(v)) + '은(는) 어느 연전 기간에도 없습니다.' } : null), set: (r, v) => { r.date = P.date(v); } },
        { key: 'mode', head: '지정 방식', alias: 'mode', req: true, w: 84, get: (r) => (r.mode === 'MATCH' ? '대진 지정' : '구장 지정'), validate: vMode, set: (r, v) => { r.mode = parseMode(v); if (r.mode === 'STADIUM') { delete r.home; delete r.away; r.stadiums = r.stadiums || []; } else delete r.stadiums; } },
        { key: 'home', head: '홈', alias: 'home', w: 90, get: (r) => r.home || '', show: (r) => (r.home ? S.team(r.home) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.home = String(v).trim(); } },
        { key: 'away', head: '원정', alias: 'away', w: 90, get: (r) => r.away || '', show: (r) => (r.away ? S.team(r.away) : ''), html: true, validate: (v, r) => (r.mode === 'MATCH' ? vTeam(v) : null), set: (r, v) => { r.away = String(v).trim(); } },
        { key: 'stadiums', head: '구장', alias: 'stadiums', w: 0, get: (r) => (r.stadiums || []).join(', '), validate: (v, r) => (r.mode === 'STADIUM' ? vStadiums(v) : null), set: (r, v) => { if (r.mode === 'STADIUM') { r.stadiums = String(v).split(/[,、·]/).map((x) => x.trim()).filter(Boolean); delete r.teams; r.teams = S.evTeams(r); } } }
      ],
      rowIssues(st, i) {
        const e = st.events[i];
        const out = [];
        if (CalendarGen.slotIndexOfDate(st.calendar, e.date) < 0) out.push({ level: 'error', col: 'date', msg: '날짜가 어느 연전 기간에도 없습니다.' });
        for (const iss of app().checkEvents()) if (iss.events.includes(e.id)) out.push({ level: iss.level === 'block' ? 'error' : 'warn', col: 'name', msg: iss.message });
        return out;
      },
      blank: (st) => ({ id: 'ev-' + Date.now().toString(36), type: 'CUSTOM', name: '새 특별 경기', date: firstSlotDate(st), mode: 'STADIUM', stadiums: [(st.teams[0] || {}).stadium].filter(Boolean) }),
      insert(s, at, row) { s.events.splice(at, 0, row); },
      remove(s, at) { const e = s.events[at]; s.events.splice(at, 1); for (const m of s.matches) if (m.eventId === e.id) { delete m.eventId; m.pinned = false; } },
      assists: [{ act: 'add-opening', label: '개막전 홈 구장 지정 추가' }, { act: 'add-children', label: '어린이날 구장 지정 추가' }],
      emptyHint: '날짜를 미리 정할 경기입니다. 개막전·어린이날 모두 「구장 지정」(그 날 홈 경기를 해야 하는 구단 5곳, 상대는 자동 편성이 정함)입니다. 시즌 달력에서 날을 눌러 고르는 편이 쉽습니다.'
    }
  };
  S.SHEETS = SHEETS;
  /** 경기일 합 점검: 연전 기간의 연전 수 합(have)이 맞대결 경기 수 × 상대 수(need)와 같아야 시리즈를 빈 자리 없이 만들 수 있다 */
  S.gameDaysCheck = function (slots) {
    const st = app().state;
    const have = (slots || st.calendar).reduce((a, c) => a + (c.consecutive || 0), 0);
    const need = st.settings.initialGamesPerPair * Math.max(0, st.teams.length - 1);
    return { have, need, ok: have === need };
  };
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
      '<span class="sep" style="width:1px;height:18px;background:var(--line);margin:0 4px"></span>' +
      (S.isBlank()
        ? '<button class="btn sm" data-act="reset-ask" data-kind="example"' + (locked ? ' disabled' : '') + ' title="2025 실제 일정(기본 제공)을 다시 불러옵니다">' + icon('db') + '2025 예시 데이터 불러오기</button>'
        : '<button class="btn sm reset-btn" data-act="reset-ask" data-kind="blank"' + (locked ? ' disabled' : '') + ' title="표를 모두 비우고 빈 상태에서 처음부터 입력합니다(구단 정보는 남김)">' + icon('plus') + '처음부터 입력하기</button>') +
      (S.guideButton ? S.guideButton() : '') +
      '<span class="last">' + (li
        ? S.stat('ok', '적용됨') + '<span>' + esc(li.source) + ' · ' + esc(li.sheets) + ' · ' + esc(li.time) + '</span>' + (li.kind === 'gsheet' ? '<button class="btn xs" data-act="import-gsheet-reload">' + icon('redo') + '다시 불러오기</button>' : '') + S.mock()
        : S.isBlank() ? '<span class="muted">현재 데이터: 직접 입력(처음부터) · 구단 정보만 들어 있음</span>' : '<span class="muted">현재 데이터: 2025 실제 일정(기본 제공)</span>' + S.mock()) + '</span>' +
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
    s += item('teams', '구단 정보', st.teams.length, { icon: 'team', sub: '같이 쓰는 구장 ' + app().sharedStadiums().size + ' · 거리 ' + nT * (nT - 1) });
    s += '<div class="list-sep"></div><div class="label">가져온 기록</div>';
    const hist = (S.importHistory || []).slice().reverse();
    s += hist.map((h) => '<div class="small" style="padding:3px 12px 5px;display:flex;gap:6px;align-items:flex-start"><span class="ico" style="color:var(--text-3)">' + icon(h.kind === 'gsheet' ? 'link' : h.kind === 'preset' ? 'db' : 'upload') + '</span><span><b style="font-weight:600">' + esc(h.source) + '</b><br><span class="muted">' + esc(h.detail) + '</span></span></div>').join('');
    s += '</div>';
    return s;
  }
  function histText(cal) { const h = CalendarGen.lengthHistogram(cal); return [2, 3, 4].map((k) => k + '연전 ' + (h[k] || 0)).join(' · '); }
  S.importHistory = [{ kind: 'preset', source: '2025 실제 일정 (기본 제공)', detail: '엑셀 표 6개 · 1/14(화) 09:00' }];

  // ───────── 가운데: 시트 표 ─────────
  /** opts.assist === false 면 표 위 자동 채우기 단추를 뺀다(단계별 화면에서는 카드가 그 단추를 보여 준다) */
  function renderSheet(key, opts) {
    const o = opts || {};
    const sh = SHEETS[key], st = app().state, u = S.ui;
    const rows = sh.rows(st);
    const cols = visibleCols(sh);
    const cur = u.cell && u.cell.sheet === key ? u.cell : null;
    const selRow = cur ? cur.row : -1;
    const locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    // 줄을 고르지 않았으면 「아래에 추가」는 맨 끝(빈 표면 첫 줄)에 더한다
    const addLabel = rows.length ? (selRow < 0 ? '끝에 추가' : '아래에 추가') : '첫 줄 추가';
    const assists = o.assist === false ? [] : sheetAssists(sh);
    if (sh.derived) return renderDerivedSheet(key, sh, rows, cols);
    let s = '<div class="toolbar">' +
      '<span class="pane-title">' + esc(sh.label) + '</span><span class="muted small">' + rows.length + '개</span>' +
      '<span class="pane-desc" style="max-width:420px">' + esc(sh.desc) + '</span>' +
      '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' +
      '<span class="btn-group">' +
      '<button class="btn sm" data-act="row-ins" data-pos="above"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 줄 위에 한 줄 추가">' + icon('rowAbove') + '위에 추가</button>' +
      '<button class="btn sm" data-act="row-ins" data-pos="below"' + (locked ? ' disabled' : '') + ' title="' + (selRow < 0 ? (rows.length ? '표 맨 끝에 한 줄 추가' : '빈 표에 첫 줄 추가') : '선택한 줄 아래에 한 줄 추가') + '">' + icon('rowBelow') + esc(addLabel) + '</button>' +
      '<button class="btn sm danger" data-act="row-del"' + (selRow < 0 || locked ? ' disabled' : '') + ' title="선택한 줄 삭제">' + icon('trash') + '삭제</button></span>' +
      S.undoButtons() +
      (assists.length ? '<span class="sep" style="width:1px;height:18px;background:var(--line);margin:0 2px"></span>' + assists.map((a) => '<button class="btn sm" data-act="' + a.act + '" title="' + esc(a.title || '규칙대로 채운 결과를 먼저 미리 보여 드립니다') + '">' + icon('bolt') + esc(a.label) + '</button>').join('') : '') +
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
    if (!rows.length) {
      // 빈 표: 무엇을 어떻게 넣는지와 첫 줄·자동 채우기 단추
      s += '<tr class="empty-row"><td colspan="' + (cols.length + 2) + '"><div class="empty sheet-empty"><b>' + icon('sheet') + ' 아직 줄이 없습니다</b>' + esc(sh.emptyHint || '「첫 줄 추가」로 시작합니다.') +
        '<div class="acts">' + (locked ? '' : '<button class="btn sm" data-act="row-ins" data-pos="below">' + icon('rowBelow') + '첫 줄 추가</button>' + assists.map((a) => '<button class="btn sm primary" data-act="' + a.act + '">' + icon('bolt') + esc(a.label) + '</button>').join('')) + '</div></div></td></tr>';
    }
    s += '</tbody></table></div>';
    s += '<div class="pane-foot small muted" style="white-space:nowrap;overflow:hidden">' + icon('info') + '<span style="overflow:hidden;text-overflow:ellipsis" title="여러 줄을 한꺼번에 고치거나 붙여 넣을 때는 엑셀에서 고친 뒤 다시 가져옵니다.">칸을 누르고 <span class="kbd">Enter</span>나 두 번 눌러 고칩니다 · 화살표로 이동 · <span class="kbd">Esc</span>로 취소 · 고친 값은 오른쪽 그림에 바로 보입니다</span></div>';
    return s;
  }
  /** 휴식일 경기·휴식기: 시즌 달력의 묶음에서 만들어지는 표(읽기만) */
  function renderDerivedSheet(key, sh, rows, cols) {
    let s = '<div class="toolbar"><span class="pane-title">' + esc(sh.label) + '</span><span class="muted small">' + rows.length + '개</span><span class="pane-desc" style="max-width:520px">' + esc(sh.desc) + '</span>' +
      '<span style="margin-left:auto"><button class="btn sm primary" data-act="g1-cal">' + icon('cal') + '시즌 달력에서 고치기</button></span></div>';
    s += '<div class="pane-body xy" data-sk="d-sheet-' + key + '" id="sheetScroll"><table class="sheet" aria-label="' + esc(sh.label) + ' 표(읽기만)"><colgroup><col style="width:44px">' + cols.map((c) => '<col' + (c.w ? ' style="width:' + c.w + 'px"' : '') + '>').join('') + '</colgroup>';
    s += '<thead><tr><th class="rn">번호</th>' + cols.map((c) => '<th><span class="col">자동</span>' + esc(c.head) + '</th>').join('') + '</tr></thead><tbody>';
    rows.forEach((r, i) => { s += '<tr data-row="' + i + '"><td class="rn">' + (i + 1) + '</td>' + cols.map((c) => '<td class="ro">' + (c.html ? c.show(r, i) : esc(c.show ? c.show(r, i) : c.get(r))) + '</td>').join('') + '</tr>'; });
    if (!rows.length) s += '<tr class="empty-row"><td colspan="' + (cols.length + 1) + '"><div class="empty sheet-empty"><b>' + icon('sheet') + ' 없습니다</b>' + esc(sh.emptyHint) + '</div></td></tr>';
    return s + '</tbody></table></div><div class="pane-foot small muted">' + icon('info') + '<span>연전 묶음이 곧 경기일입니다. 이 표는 시즌 달력의 묶음과 휴식 요일에서 만들어 ② 검토·실행과 자동 편성에 넘깁니다.</span></div>';
  }
  function sheetColIndex(sh, col) { return sh.cols.filter((c) => !c.ro).indexOf(col); }
  /** 표의 자동 채우기 단추 목록 (assist 하나 또는 assists 여럿) */
  function sheetAssists(sh) { return sh.assists ? sh.assists.slice() : sh.assist ? [sh.assist] : []; }
  S.sheetAssists = (key) => sheetAssists(SHEETS[key] || {});

  // ───────── 시즌 골격 ─────────
  /** opts.subs === false 면 아래 공휴일·휴식일 경기·휴식기 요약 상자를 뺀다(단계별 화면에서는 다음 단계들이다) */
  function renderSeason(opts) {
    const o = opts || {};
    const st = app().state, set = st.settings;
    const wd = ['일', '월', '화', '수', '목', '금', '토'];
    const blankDates = !set.seasonStart || !set.initialEnd;
    const dateIn = (k, label, ph) => '<label class="field"><span>' + label + ' *</span><input class="input' + (set[k] ? '' : ' empty') + '" data-in="season" data-k="' + k + '" value="' + esc(set[k] ? fmt.date(set[k]) : '') + '" placeholder="' + esc(ph) + '"' + (set[k] ? '' : ' aria-describedby="seasonHint"') + '></label>';
    let s = '<div class="pane-head"><span class="pane-title">시즌 기본 설정</span><span class="pane-desc">' + (o.subs === false ? '개막·종료일과 휴식 요일을 입력합니다.' : '개막·종료일과 휴식 요일은 여기서 입력합니다. 공휴일은 왼쪽 목록에서 고치고, 휴식일 경기·휴식기는 시즌 달력의 묶음에서 만들어집니다.') + '</span></div>';
    s += '<div class="pane-body pad" data-sk="d-season">';
    s += '<div class="blk"><div class="blk-head">기간과 휴식 요일</div><div class="blk-body"><div class="form-grid">' +
      dateIn('seasonStart', '개막일', '예: 2025-03-22') +
      dateIn('initialEnd', '1차 편성 종료일', '예: 2025-08-31') +
      dateIn('seasonEnd', '시즌 종료일', '예: 2025-10-31') +
      '<div class="field"><span>휴식 요일 (복수 선택)</span><div class="wd">' + wd.map((n, i) => '<button class="' + (set.restWeekdays.includes(i) ? 'on' : '') + '" data-act="rest-wd" data-wd="' + i + '" aria-pressed="' + set.restWeekdays.includes(i) + '">' + n + '</button>').join('') + '</div></div>' +
      '</div>' +
      (blankDates ? '<div class="small season-hint" id="seasonHint" style="margin-top:8px;display:flex;gap:6px;align-items:flex-start;color:var(--text-2)">' + icon('info') + '<span>개막일과 1차 편성 종료일을 적으면 시즌 달력이 그려지고, 연전 기간을 「규칙대로 자동 채우기」로 만들 수 있습니다. 1차 편성 종료일 뒤(시즌 종료일까지)는 취소된 경기를 다시 넣는 재편성 기간입니다. 날짜는 2025-03-22나 3/22처럼 적고 Enter를 누릅니다.</span></div>' : '') +
      '</div></div>';
    // 시즌 달력(월 × 일)
    const hol = new Set(set.holidays.map((h) => Dates.dayNum(h.date)));
    const black = new Set();
    for (const b of set.blackouts) for (let d = Dates.dayNum(b.start); d <= Dates.dayNum(b.end); d++) black.add(d);
    const isGame = CalendarGen.gameDayPredicate(set);
    const slotStart = new Set(D().slots.map((x) => x.day));
    const inSlot = D().dayToSlot;
    const year = S.seasonYear();
    const mFrom = set.seasonStart ? Math.min(Dates.month(Dates.dayNum(set.seasonStart)), 3) : 3;
    const mTo = set.seasonEnd ? Math.max(Dates.month(Dates.dayNum(set.seasonEnd)), mFrom) : 10;
    s += '<div class="blk" style="margin-top:12px"><div class="blk-head">시즌 달력 <span class="muted small" style="font-weight:400">지금 연전 기간 기준 · ' + mFrom + '월~' + mTo + '월</span><span class="r legend"><span><i style="background:#D3DFF5"></i>경기일</span><span><i style="background:#A9C1EC"></i>주말</span><span><i style="background:#F7F7F8;border:1px solid #E2E5EA"></i>휴식</span><span><i style="background:repeating-linear-gradient(135deg,#F3D9B5 0 3px,#FBEEDB 3px 6px)"></i>경기 없는 기간</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #B3261E;border-radius:50%;width:8px;height:8px"></i>공휴일</span><span><i style="box-shadow:inset 2px 0 0 #0A1E3C;background:#D3DFF5"></i>연전 시작일</span></span></div><div class="blk-body">' +
      (blankDates ? '<div class="small muted" style="margin:0 0 8px;display:flex;gap:6px">' + icon('info') + '<span>개막일과 1차 편성 종료일이 아직 없어 모든 날이 휴식으로 보입니다.</span></div>' : '') + '<div class="strip">';
    for (let mo = mFrom; mo <= mTo; mo++) {
      s += '<div class="strip-row"><span class="m">' + mo + '월</span><div class="strip-days">';
      for (let d = 1; d <= 31; d++) {
        const ds = year + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const n = Dates.dayNum(ds);
        if (Dates.month(n) !== mo) { s += '<span class="sd out"></span>'; continue; }
        const w = Dates.weekday(n);
        let cls = 'sd';
        if (inSlot.has(n)) cls += ' game' + (w === 0 || w === 6 ? ' we' : '');
        else if (black.has(n)) cls += ' black';
        else if (blankDates || !isGame(n) || ds > set.initialEnd || ds < set.seasonStart) cls += ' rest';
        if (hol.has(n)) cls += ' hol';
        if (slotStart.has(n)) cls += ' slotstart';
        s += '<span class="' + cls + '" title="' + esc(fmt.date(n)) + '">' + d + '</span>';
      }
      s += '</div></div>';
    }
    s += '</div><div class="small muted" style="margin-top:8px">' + (set.initialEnd && set.seasonEnd && set.seasonEnd > set.initialEnd ? esc(fmt.short(Dates.dayNum(set.initialEnd) + 1) + '~' + fmt.short(set.seasonEnd)) + '은 재편성 기간입니다(시즌 운영 메뉴).' : '1차 편성 종료일 뒤부터 시즌 종료일까지는 재편성 기간입니다(시즌 운영 메뉴).') + '</div></div></div>';
    const sub = (k, title, lines) => '<div class="blk"><div class="blk-head">' + icon('sheet') + esc(title) + '<span class="r"><span class="muted small">' + lines.length + '개</span><button class="btn xs" data-act="d-tab" data-tab="' + k + '">표 열기' + icon('right') + '</button></span></div><div class="blk-body small" style="padding:6px 10px;display:flex;flex-direction:column;gap:2px">' + (lines.length ? lines.slice(0, 4).map((x) => '<div>' + x + '</div>').join('') + (lines.length > 4 ? '<div class="muted">외 ' + (lines.length - 4) + '개</div>' : '') : '<span class="muted">없음</span>') + '</div></div>';
    if (o.subs !== false) s += '<div class="season-subs" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px">' +
      sub('holidays', SHEETS.holidays.label, set.holidays.map((h) => '<span class="mono">' + esc(fmt.date(h.date)) + '</span> ' + esc(h.name))) +
      sub('restex', SHEETS.restex.label, set.restExceptions.map((d) => '<span class="mono">' + esc(fmt.date(d)) + '</span> 휴식 요일이지만 경기')) +
      sub('blackouts', SHEETS.blackouts.label, set.blackouts.map((b) => '<span class="mono">' + esc(fmt.date(b.start) + (b.end !== b.start ? ' ~ ' + fmt.date(b.end) : '')) + '</span> ' + esc(b.label || ''))) + '</div>';
    s += '</div>';
    return s;
  }

  // ───────── 구단 정보 ─────────
  // 왼쪽: 구단 표(+ 접힌 구장 간 거리표) / 오른쪽: 구장 지도(남은 높이를 모두).
  // 지도는 UI.mapWidget(설정에 카카오 지도 키가 있으면 카카오 지도, 없으면 내장 지도)을 한 번만 만들어 두고,
  // 화면을 다시 그릴 때마다 자리(#teamMapHost)에 옮겨 붙인다(카카오 지도를 매번 새로 만들지 않도록).
  const TM = { el: null, w: null, app: null };
  const TEAM_BOX = { lonMin: 125.9, lonMax: 129.8, latMin: 34.6, latMax: 38.0 }; // 내장 지도: 제주를 빼고 구장이 있는 곳만(지도가 덜 길쭉해 넓게 보인다)
  const running = () => !!(S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED'));
  const selTeam = () => (S.ui.cell && S.ui.cell.sheet === 'teams' ? S.ui.cell.row : -1);
  const kakaoOn = () => !!(app().kakao && app().kakaoKey);
  /** 구장 칸 Enter로 찾은 곳이 여럿이면 지도에도 번호로 보인다(guide-steps.js의 S.ui.teamFind) */
  const findCands = () => { const f = S.ui.teamFind; return f && f.row === selTeam() && f.results && f.results.length ? f.results : null; };
  /** 「지도에서 찍기」 중인 구단(카카오 지도일 때만) */
  const mapPicking = () => { const p = S.ui.mapPick; return p && p.row === selTeam() && kakaoOn() ? p : null; };
  function teamMarkers() {
    const sel = selTeam();
    const drag = S.feature('T4') && !running() && !mapPicking();
    const out = app().state.teams.map((t, i) => ({ id: i, lat: Number(t.latitude), lon: Number(t.longitude), color: t.color, label: t.name, title: t.stadium, size: i === sel ? 7 : 5, active: i === sel, draggable: drag }));
    (findCands() || []).forEach((x, k) => out.push({ id: 'c' + k, lat: Number(x.latitude), lon: Number(x.longitude), color: '#1F5FD6', shape: 'square', size: 6, label: (k + 1) + ' ' + x.name, title: '누르면 이 위치로 채웁니다', cls: 'cand' }));
    return out;
  }
  function teamFocus() {
    const c = findCands(), f = S.ui.teamFind;
    if (!c) return null; // 검색 결과가 없으면 지금 보는 범위를 그대로 둔다(지도에서 찍기 중 확대한 화면 유지)
    const t = app().state.teams[f.row];
    return { key: 'find:' + f.row + ':' + f.q, points: c.map((x) => ({ lat: Number(x.latitude), lon: Number(x.longitude) })).concat(t ? [{ lat: t.latitude, lon: t.longitude }] : []) };
  }
  function mountTeamMap() {
    const host = document.getElementById('teamMapHost');
    if (!host) return;
    if (TM.app !== app()) { if (TM.w) TM.w.destroy(); TM.el = null; TM.w = null; TM.app = app(); }
    if (!TM.el) {
      TM.el = document.createElement('div');
      TM.el.className = 'tm-map';
      host.appendChild(TM.el); // 크기가 있는 자리에 붙인 뒤 만든다(카카오 지도는 처음 크기로 범위를 맞춘다)
      TM.w = KBO.UI.mapWidget(TM.el, app(), {
        get width() { return S.wide ? 520 : 400; }, // 넓은 화면에서 이름표가 너무 커지지 않게
        box: TEAM_BOX, spread: 10, grid: false, caption: false, fit: true, title: '구장 위치', tags: ['teams', 'map'], markers: teamMarkers,
        focus: teamFocus, cursor: () => (mapPicking() ? 'crosshair' : ''),
        onMarkerClick: (id) => {
          if (String(id).charAt(0) === 'c') { if (S.teamFindPick) S.teamFindPick(+String(id).slice(1)); return; }
          if (mapPicking()) return; // 찍는 중에는 다른 구단으로 바꾸지 않는다
          S.ui.cell = { sheet: 'teams', row: +id, col: 'name' }; S.ui.teamFind = null; S.render();
        },
        onMapClick: (lat, lon) => { const p = mapPicking(); if (p && S.teamMapPicked) S.teamMapPicked(p.row, lat, lon); },
        onDragEnd: (id, lat, lon) => { if (!locked() && app().updateTeam(+id, { latitude: lat, longitude: lon })) S.toast('구장 위치를 옮겼습니다. 이 구단의 구장 간 거리는 직선거리로 다시 추정했습니다. 실행 취소로 되돌릴 수 있습니다.', 'ok', 5000); }
      });
      return;
    }
    if (TM.el.parentNode !== host) host.appendChild(TM.el);
    TM.w.refresh();
  }
  S.teamMap = TM;
  function mapFoot() {
    const a = app();
    const drag = S.feature('T4') ? ' 구장 표시를 끌어 위치를 옮길 수 있습니다.' + (S.dev() ? ' <span class="tag ref">FR-T4</span>' : '') : '';
    let s;
    if (!a.kakaoKey) s = icon('info') + '<span>' + (findCands() ? '파란 번호 표시를 누르면 그 위치로 채웁니다. ' : '') + '<button class="lnk" data-act="open-settings" data-set="data">설정 › 카카오 지도 키</button>를 넣으면 카카오 지도로 보입니다.' + drag + '</span>';
    else if (a.kakao && mapPicking()) s = icon('move') + '<span><b>지도에서 새 구장 자리를 누르세요.</b> 누른 곳의 위도·경도로 채웁니다. 그만두려면 카드의 「취소」나 Esc.</span>';
    else if (a.kakao) s = icon('map') + '<span>카카오 지도 · ' + (findCands() ? '파란 번호 표시를 누르면 그 위치로 채웁니다.' : '표시를 누르면 그 구단을 고릅니다.') + drag + '</span>';
    else if (a.kakaoError) s = icon('warn') + '<span>카카오 지도를 열지 못해 기본 지도로 보입니다. 설정 › 카카오 지도 키와, 이 사이트 주소를 카카오에 등록했는지 확인해 주세요.' + (S.dev() ? ' (' + esc(a.kakaoError) + ')' : '') + '</span>';
    else s = icon('map') + '<span>카카오 지도를 불러오는 중입니다…</span>';
    return '<div class="pane-foot small tm-foot' + (a.kakaoKey && a.kakaoError ? ' warn' : '') + '"' + (S.feature('T4') ? ' data-feature="T4"' : '') + '>' + s + '</div>';
  }
  function renderTeams() {
    const st = app().state, u = S.ui;
    const sel = u.cell && u.cell.sheet === 'teams' ? u.cell.row : -1;
    const shared = app().sharedStadiums();
    const stepwise = !!(S.g1 && S.g1.mode === 'flow' && S.g1.fs === 1); // 1 구단 정보 단계면 왼쪽 카드, 모든 표 보기면 오른쪽 자세히에서 고친다
    let s = '<div class="pane-head"><span class="pane-title">구단 정보</span><span class="pane-desc">구단과 구장, 구장 위치입니다. 구단 줄을 누르면 ' + (stepwise ? '왼쪽 카드' : '오른쪽') + '에서 고칩니다. 구장 사이 거리표는 표 아래에 접어 두었습니다.</span></div>';
    s += '<div class="pane-body pad tm-body" data-sk="d-teams"><div class="tm-grid"><div class="tm-left">';
    s += '<div class="blk"><table class="sheet tm-table"><colgroup><col style="width:40px"><col style="width:84px"><col><col style="width:80px"><col style="width:88px"></colgroup><thead><tr><th class="rn">#</th><th>구단</th><th>구장</th><th class="num">위도</th><th class="num">경도</th></tr></thead><tbody>' +
      st.teams.map((t, i) => {
        const sh = shared.get(t.stadium);
        const tip = t.stadium + (sh ? ' · 같이 쓰는 구장(' + sh.join('·') + ')' : '');
        const hint = i === sel ? (stepwise ? '왼쪽 카드에서 고치는 중' : '오른쪽에서 고치는 중') : '눌러서 고치기';
        return '<tr class="' + (i === sel ? 'sel' : '') + '" data-act="team-sel" data-row="' + i + '"><td class="rn">' + (i + 1) + '</td><td class="cell" data-act="team-sel" data-row="' + i + '">' + S.team(t.name) + '</td><td class="cell tm-std" data-act="team-sel" data-row="' + i + '" title="' + esc(tip) + '"><span class="tm-std-n">' + esc(t.stadium) + '</span>' + (sh ? '<span class="tag shared">같이 쓰는 구장</span>' : '') + '<span class="tm-edit-hint">' + (i === sel ? icon('left') : icon('edit')) + hint + '</span></td><td class="num mono cell" data-act="team-sel" data-row="' + i + '">' + t.latitude.toFixed(4) + '</td><td class="num mono cell" data-act="team-sel" data-row="' + i + '">' + t.longitude.toFixed(4) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (app().roadApi) {
      const dm = st.distanceMatrix.filter((d) => d.from !== d.to);
      const nRoad = dm.filter((d) => d.source === 'ROAD').length / 2, nEst = dm.filter((d) => d.estimated).length / 2;
      s += '<div class="tm-road">' + (app().roadBusy === 'all' ? '<span class="gs-road-busy">' + icon('clock') + '모든 구장 도로거리 받는 중…</span>' : '<button class="btn sm" data-act="road-all" title="카카오모빌리티 길찾기로 10구장 사이 45쌍의 도로거리를 받습니다">' + icon('map') + '모든 구장 도로거리 받기 (' + (st.teams.length * (st.teams.length - 1) / 2) + '쌍)</button>') +
        '<span class="muted small">도로 ' + Math.floor(nRoad) + '쌍 · 추정 ' + Math.floor(nEst) + '쌍</span></div>';
    }
    if (S.feature('T7')) {
      const names = st.teams.map((t) => t.name);
      const values = names.map((a) => names.map((b) => (a === b ? null : (app().distanceOf(a, b) || {}).distance)));
      s += '<details class="fold" data-feature="T7"><summary>' + icon('grid') + '구장 간 거리표 <span class="muted">km · A→B를 고치면 B→A도 함께 바뀜</span></summary><div style="padding:8px 6px" class="chart-box">' +
        KBO.Chart.heatmap({ rows: names, cols: names, values, cellW: 43, cellH: 24, labelW: 44, format: (v) => (v == null ? '' : String(Math.round(v))), title: '구단 간 이동거리' }) + '</div></details>';
    }
    s += '</div>';
    s += '<div class="blk tm-mapblk"><div class="blk-head">' + icon('map') + '구장 지도' + (S.dev() ? '<span class="r"><span class="tag ref">' + (app().kakao && app().kakaoKey ? 'Kakao' : '내장 SVG') + '</span></span>' : '') + '</div><div class="blk-body tm-maphost" id="teamMapHost"></div>' + mapFoot() + '</div>';
    s += '</div></div>';
    S.afterRender(mountTeamMap);
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
      const gen = CalendarGen.generateSlots(CalendarGen.ruleSettings(st.settings)).slots;
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
      const gen = CalendarGen.generateSlots(CalendarGen.ruleSettings(st.settings));
      const same = !app().slotsOutOfDate();
      const h = CalendarGen.lengthHistogram(gen.slots);
      const gd = S.gameDaysCheck(gen.slots);
      const blankDates = !st.settings.seasonStart || !st.settings.initialEnd;
      return { title: '규칙 미리보기', html: '<div class="insp-sec"><h4>규칙대로 만든 연전 기간' + (S.dev() ? ' (§5.2.1)' : '') + '</h4>' +
        (blankDates ? '<div class="small muted" style="margin-bottom:8px">개막일과 1차 편성 종료일을 적으면 여기서 미리 셉니다.</div>' : '') +
        '<dl class="props"><dt>개수</dt><dd><b>' + gen.slots.length + '</b></dd><dt>연전 분포</dt><dd>2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + '</dd>' +
        '<dt>경기일 합</dt><dd class="gd-check" data-ok="' + (gd.ok ? 1 : 0) + '"><b>' + gd.have + '</b>일 / 필요 ' + gd.need + '일 ' + (gd.ok ? S.stat('ok', '맞음') : S.stat('warn', gd.have < gd.need ? (gd.need - gd.have) + '일 부족' : (gd.have - gd.need) + '일 많음')) + '</dd>' +
        '<dt>지금과 비교</dt><dd>' + (same ? S.stat('ok', '같음') : S.stat('warn', '다름')) + '</dd><dt>연속 경기일 묶음</dt><dd>' + gen.runs.length + '개</dd></dl>' +
        (!blankDates && !gd.ok ? '<div class="small" style="margin-top:8px;color:var(--warn);display:flex;gap:6px">' + icon('warn') + '<span>맞대결 ' + st.settings.initialGamesPerPair + '경기 × 상대 ' + (st.teams.length - 1) + '구단 = ' + gd.need + '경기일이어야 시리즈를 빈 자리 없이 채울 수 있습니다. 1차 편성 종료일을 ' + (gd.have < gd.need ? '늦추거나 휴식기를 줄이세요' : '당기거나 휴식기를 늘리세요') + '.</span></div>' : '') +
        '<button class="btn sm" style="margin-top:10px" data-act="draft-slots"' + (blankDates ? ' disabled' : '') + '>' + icon('bolt') + '규칙대로 자동 채우기</button><div class="small muted" style="margin-top:6px">바로 바꾸지 않고 먼저 미리 보여 드립니다.</div></div>' +
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
      // 시즌 달력 한 화면(기본)·구단 정보 펼침이면 guide-steps.js가 그린다. null이면 아래 전체 화면(모든 표 보기)
      if (S.guideUI && S.guideUI.renderStep1) { const g = S.guideUI.renderStep1({ sheet: renderSheet, season: renderSeason, teams: renderTeams, calendar: () => S.renderSeasonCalendar() }); if (g) return g; }
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
  S.locked = locked;
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
        if (e.sheet === 'holidays' || e.sheet === 'slots') S.recalcCalendar(s);
      }, ['input']));
    }
    if (moveDown) { const n = sh.rows(app().state).length; S.ui.cell = { sheet: e.sheet, row: Math.min(n - 1, e.row + 1), col: e.col }; }
    S.render();
  }
  function insertRow(pos) {
    const u = S.ui, key = u.tab, sh = SHEETS[key];
    if (!sh || sh.derived || locked()) return;
    const n = sh.rows(app().state).length;
    const has = u.cell && u.cell.sheet === key && u.cell.row < n;
    if (pos === 'above' && !has) return;
    // 줄을 고르지 않았으면 맨 끝에(빈 표면 첫 줄로) 더한다
    const at = has ? (pos === 'above' ? u.cell.row : u.cell.row + 1) : n;
    const blank = sh.blank(app().state, has ? u.cell.row : n - 1);
    if (blank && typeof blank === 'object') blank._uiNew = true;
    S.trackViz(key, () => app().commit(sh.label + ' ' + (at + 1) + '번째 줄 추가', (s) => { sh.insert(s, at, blank); if (key === 'holidays' || key === 'slots') S.recalcCalendar(s); }, ['input', 'plan']));
    u.edit = null;
    u.cell = { sheet: key, row: at, col: sh.cols.find((c) => !c.ro).key };
    S.toast(!n ? sh.label + ' 표에 첫 줄을 넣었습니다. 칸을 두 번 누르거나 Enter로 값을 고치세요.' : sh.label + ' ' + (at + 1) + '번째에 한 줄을 ' + (has ? (pos === 'above' ? '위에' : '아래에') : '끝에') + ' 추가했습니다. 값을 고치세요.' + (key === 'series' ? ' 새 시리즈는 일정 미정 보관함으로 들어갑니다.' : ''), 'info');
    S.render();
  }
  S.insertRow = insertRow;
  function deleteRow() {
    const u = S.ui, key = u.tab, sh = SHEETS[key];
    if (!sh || sh.derived || !u.cell || u.cell.sheet !== key || locked()) return;
    const at = u.cell.row;
    S.trackViz(key, () => app().commit(sh.label + ' ' + (at + 1) + '번째 줄 삭제', (s) => { sh.remove(s, at); if (key === 'holidays' || key === 'slots') S.recalcCalendar(s); }, ['input', 'plan']));
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
    // 작은 표 자동 채우기(미리보기 없이 바로 넣고, 실행 취소로 되돌린다)
    'fill-holidays': () => {
      if (locked()) return;
      const st = app().state, set = st.settings, y = S.seasonYear();
      // 시즌 기간(개막일~시즌 종료일). 날짜를 아직 적지 않았으면 시즌 연도의 3월~10월
      const start = set.seasonStart || y + '-03-01';
      const end = set.seasonEnd && set.seasonEnd > (set.initialEnd || '') ? set.seasonEnd : set.initialEnd || y + '-10-31';
      const have = new Set(set.holidays.map((h) => h.date));
      const add = CalendarGen.builtinHolidays(y).filter((h) => h.date >= start && h.date <= end && !have.has(h.date));
      if (!add.length) { S.toast('시즌 기간(' + fmt.short(start) + '~' + fmt.short(end) + ')의 법정 공휴일이 이미 모두 들어 있습니다.', 'info', 4000); return; }
      S.trackViz('holidays', () => app().commit('법정 공휴일 채우기 (' + add.length + '일)', (s) => { s.settings.holidays = s.settings.holidays.concat(add).sort((a, b) => (a.date < b.date ? -1 : 1)); S.recalcCalendar(s); }, ['input']));
      S.ui.cell = null; S.ui.edit = null;
      S.toast('법정 공휴일 ' + add.length + '일을 넣었습니다(' + add.map((h) => fmt.short(h.date)).join(', ') + '). 가중치는 공휴일 2 · 어린이날 3입니다. 임시 공휴일은 「줄 추가」로 더하세요.', 'ok', 6000);
      S.go({ tab: 'holidays' });
    },
    // 개막전 홈 구장 지정: 대진이 아니라 그 날 홈 경기를 해야 하는 구단 5곳(구장 지정). 지금 일정의 개막일 홈 구단으로 채우고, 시즌 달력에서 고친다
    'add-opening': () => {
      if (locked()) return;
      const st = app().state, c = D();
      if (!st.calendar.length) { S.toast('연전 기간이 먼저 있어야 합니다. 시즌 달력에서 「규칙대로 채우기」를 누르세요.', 'warn', 5000); return; }
      if (st.events.some((e) => e.type === 'OPENING' && e.mode === 'STADIUM')) { S.toast('개막전 홈 구장 지정이 이미 있습니다. 시즌 달력에서 개막일을 눌러 고칩니다.', 'info', 4500); return; }
      const date = c.slots[0].date, half = st.teams.length >> 1;
      const homes = (c.bySlot[0] || []).map((m) => st.matches[m].home).filter((x, i, a) => a.indexOf(x) === i).slice(0, half);
      const ev = { id: 'ev-opening-' + Date.now().toString(36), type: 'OPENING', name: '개막전', slot: 0, date, mode: 'STADIUM', teams: homes, stadiums: homes.map((n) => (app().team(n) || {}).stadium).filter(Boolean) };
      S.trackViz('events', () => app().commit('개막전 홈 구장 지정 추가', (s) => { s.events.push(ev); }, ['input', 'events']));
      S.ui.cell = { sheet: 'events', row: st.events.length - 1, col: 'stadiums' }; S.ui.edit = null;
      S.toast(homes.length ? '개막전(' + fmt.date(date) + ') 홈 구장 ' + homes.length + '곳을 넣었습니다: ' + homes.join('·') + '. 상대는 자동 편성이 정합니다. 시즌 달력에서 개막일을 눌러 바꿀 수 있습니다.' : '개막전(' + fmt.date(date) + ') 홈 구장 지정을 넣었습니다. 시즌 달력에서 개막일을 눌러 홈 구단 ' + half + '곳을 고르세요.', homes.length ? 'ok' : 'warn', 6500);
      S.go({ tab: 'events' });
    },
    'add-children': () => {
      if (locked()) return;
      const st = app().state, set = st.settings;
      const date = S.seasonYear() + '-05-05';
      if (st.events.some((e) => e.type === 'CHILDREN')) { S.toast('어린이날 구장 지정이 이미 있습니다.', 'info'); return; }
      const teams = (set.obligationTeams || []).filter((n) => st.teams.some((t) => t.name === n));
      const stadiums = teams.map((n) => st.teams.find((t) => t.name === n).stadium).filter((x, i, a) => a.indexOf(x) === i);
      const inSlot = CalendarGen.slotIndexOfDate(st.calendar, date) >= 0;
      const ev = { id: 'ev-children-' + Date.now().toString(36), type: 'CHILDREN', name: '어린이날', date, mode: 'STADIUM', teams, stadiums };
      S.trackViz('events', () => app().commit('어린이날 구장 지정 추가', (s) => { s.events.push(ev); }, ['input', 'events']));
      S.ui.cell = { sheet: 'events', row: st.events.length - 1, col: 'stadiums' }; S.ui.edit = null;
      S.toast('어린이날(' + fmt.date(date) + ') 구장 지정을 넣었습니다: ' + teams.join('·') + ' 홈.' + (inSlot ? ' 구장 칸에서 바꿀 수 있습니다.' : ' 아직 어느 연전 기간에도 없는 날짜입니다 — 시즌 달력에서 ' + fmt.date(date) + '이 든 묶음을 만드세요(휴식 요일이면 그 날을 눌러 끌기).'), inSlot ? 'ok' : 'warn', 7000);
      S.go({ tab: 'events' });
    },
    'road-all': () => { if (locked()) return; app().fetchRoadDistances(null).then(S.roadToast); },
    'team-sel': (el) => { S.ui.cell = { sheet: 'teams', row: +el.dataset.row, col: 'name' }; S.ui.teamFind = null; S.ui.mapPick = null; S.render(); },
    'rest-wd': (el) => {
      if (locked()) return;
      const w = +el.dataset.wd;
      const cur = app().state.settings.restWeekdays.slice();
      const i = cur.indexOf(w); if (i >= 0) cur.splice(i, 1); else cur.push(w);
      S.updateSeason({ restWeekdays: cur.sort() }, '휴식 요일 변경');
      if (app().slotsOutOfDate()) S.toast('휴식 요일을 바꿨습니다. 연전 묶음은 그대로입니다. 규칙대로 다시 깔려면 「규칙대로 채우기」를 누르세요.', 'warn', 5000);
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
  /** 카드의 「다른 구장까지 거리」 칸: 고치면 반대 방향도 같은 값(직접 적은 값 = 추정 아님) */
  S.inputs['team-dist'] = (el) => {
    if (locked()) return;
    const from = el.dataset.from, to = el.dataset.to, raw = el.value.trim().replace(/km$/i, '').trim();
    const v = Number(raw);
    if (!raw || !Number.isFinite(v) || v < 0 || v > 2000) { el.classList.add('err'); S.toast('거리는 km 숫자로 적습니다(예: 31.5).', 'bad'); return; }
    const d = app().distanceOf(from, to);
    if (d && !d.estimated && Math.round(v * 10) / 10 === d.distance) return; // 바뀐 것 없음
    if (app().setDistance(from, to, v, true)) S.toast(from + ' ↔ ' + to + ' 거리를 ' + (Math.round(v * 10) / 10) + 'km로 바꿨습니다(양쪽 방향). 실행 취소로 되돌릴 수 있습니다.', 'ok', 4000);
  };
  S.inputs['team-field'] = (el) => {
    if (locked()) return;
    const i = +el.dataset.row, k = el.dataset.k;
    const t = app().state.teams[i];
    if (!el.value.trim() || !t) return;
    if (k === 'latitude' || k === 'longitude') {
      const v = Number(el.value.trim());
      const okRange = Number.isFinite(v) && (k === 'latitude' ? v >= -90 && v <= 90 : v >= -180 && v <= 180);
      if (!okRange) { el.classList.add('err'); S.toast((k === 'latitude' ? '위도' : '경도') + '는 숫자로 적습니다(예: ' + (k === 'latitude' ? '37.5122' : '127.0719') + ').', 'bad'); return; }
      if (el.value.trim() === t[k].toFixed(4)) return; // 칸에 보이는 값 그대로(바뀐 것 없음)
      if (app().updateTeam(i, { [k]: v })) S.toast('구장 위치를 바꿨습니다. 이 구단의 구장 간 거리는 직선거리로 다시 추정했습니다. 실행 취소로 되돌릴 수 있습니다.', 'ok', 6000);
      return;
    }
    if (el.value.trim() === t[k]) return; // 바뀐 것 없음(Enter로 위치를 찾은 뒤의 change 등)
    const f = S.ui.teamFind;
    if (k === 'stadium' && f && f.row === i && f.q === el.value.trim()) return; // 구장 위치 찾기(Enter)가 이름과 위치를 한 번에 저장한다(칸을 다시 그릴 때 오는 change는 무시)
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
