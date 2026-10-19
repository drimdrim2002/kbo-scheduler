/*
 * alt-c 편성 워크북 — 입력 시트 모델.
 * 가져오기 시트(§4.2)와 1:1로 대응하는 행 모델, 값 읽기(날짜·숫자·불리언), 셀 검증, 행 삽입·삭제, 실행 취소.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const KBO = window.KBO;
  const D = KBO.Dates;
  const CG = KBO.CalendarGen;

  const TYPES_EV = ['개막전', '어린이날', '사용자정의'];
  const MODES_EV = ['대진', '구장'];
  const WEEKDAY = D.WEEKDAY_KO;

  /** 시트 정의. cols: 가져오기 열(머리글은 고정, 괄호 안 영문 별칭도 받음). der: 계산 열(읽기 전용) */
  const DEFS = {
    season: { id: 'season', name: '시즌 골격', ui: true, desc: '시즌 기간·휴식 요일 등. 가져오기 대상이 아니며 내보낸 파일의 안내 시트에 참고값으로 적습니다.' },
    slots: {
      id: 'slots', name: '슬롯', desc: '시리즈가 열리는 연속 경기일 묶음. 주말·휴일가중치가 비면 규칙(§5.2.1)으로 채웁니다.',
      cols: [
        { key: 'start', label: '시작일', alias: 'start', type: 'date', req: true, w: 104 },
        { key: 'games', label: '연전', alias: 'games', type: 'int', req: true, min: 2, max: 4, w: 84, cls: 'n' },
        { key: 'weekend', label: '주말', alias: 'weekend', type: 'bool', auto: true, w: 112, cls: 'c' },
        { key: 'holiday', label: '휴일가중치', alias: 'holiday', type: 'int', auto: true, min: 0, max: 3, w: 126, cls: 'n' },
        { key: 'note', label: '메모', alias: 'note', type: 'text', w: 200 }
      ],
      der: [{ label: '종료일', w: 96 }, { label: '요일', w: 64 }, { label: '슬롯 번호', w: 70, cls: 'n' }]
    },
    series: {
      id: 'series', name: '시리즈', desc: '두 구단이 같은 구장에서 연속으로 치르는 2~4경기. 고정(핀)·슬롯 열은 없습니다.',
      cols: [
        { key: 'home', label: '홈', alias: 'home', type: 'team', req: true, w: 92 },
        { key: 'away', label: '원정', alias: 'away', type: 'team', req: true, w: 92 },
        { key: 'games', label: '연전', alias: 'games', type: 'int', req: true, min: 2, max: 4, w: 84, cls: 'n' },
        { key: 'note', label: '메모', alias: 'note', type: 'text', w: 180 }
      ],
      der: [{ label: '구장', w: 132 }, { label: '구단쌍 누계', w: 92, cls: 'n' }, { label: '홈:원정', w: 70, cls: 'c' }]
    },
    holidays: {
      id: 'holidays', name: '공휴일', desc: '휴일 가중치 계산에 쓰입니다. 같은 날짜가 두 번 있으면 오류입니다.',
      cols: [
        { key: 'date', label: '날짜', alias: 'date', type: 'date', req: true, w: 104 },
        { key: 'name', label: '이름', alias: 'name', type: 'text', req: true, w: 170 }
      ],
      der: [{ label: '요일', w: 54, cls: 'c' }, { label: '영향 슬롯', w: 200 }]
    },
    rest: {
      id: 'rest', name: '휴식예외일', desc: '휴식 요일이지만 경기하는 날. 휴식 요일이 아니면 경고합니다.',
      cols: [
        { key: 'date', label: '날짜', alias: 'date', type: 'date', req: true, w: 104 },
        { key: 'note', label: '메모', alias: 'note', type: 'text', w: 220 }
      ],
      der: [{ label: '요일', w: 54, cls: 'c' }, { label: '영향 슬롯', w: 200 }]
    },
    blackouts: {
      id: 'blackouts', name: '경기없는기간', desc: '올스타 브레이크 등. 하루짜리는 시작 = 종료로 적습니다.',
      cols: [
        { key: 'start', label: '시작일', alias: 'start', type: 'date', req: true, w: 104 },
        { key: 'end', label: '종료일', alias: 'end', type: 'date', req: true, w: 104 },
        { key: 'name', label: '이름', alias: 'name', type: 'text', req: true, w: 200 }
      ],
      der: [{ label: '일수', w: 54, cls: 'n' }]
    },
    events: {
      id: 'events', name: '이벤트', desc: '대진이면 행 하나 = 대진 하나(핀 고정), 구장이면 그 구장 연고 구단의 홈 의무입니다.',
      cols: [
        { key: 'name', label: '이름', alias: 'name', type: 'text', req: true, w: 92 },
        { key: 'type', label: '유형', alias: 'type', type: 'enum', options: TYPES_EV, req: true, w: 78 },
        { key: 'date', label: '날짜', alias: 'date', type: 'date', req: true, w: 98 },
        { key: 'mode', label: '방식', alias: 'mode', type: 'enum', options: MODES_EV, req: true, w: 54 },
        { key: 'home', label: '홈', alias: 'home', type: 'team', w: 60 },
        { key: 'away', label: '원정', alias: 'away', type: 'team', w: 60 },
        { key: 'stadiums', label: '구장', alias: 'stadiums', type: 'text', w: 280 }
      ],
      der: [{ label: '슬롯', w: 110 }]
    },
    teams: { id: 'teams', name: '구단과 거리', ui: true, desc: '구단·구장·좌표. UI에서만 입력합니다(시트 가져오기 대상 아님).' }
  };
  const ORDER = ['season', 'slots', 'series', 'holidays', 'rest', 'blackouts', 'events', 'teams'];
  const IMPORT_SHEETS = ['slots', 'series', 'holidays', 'rest', 'blackouts', 'events'];

  // ───────────── 값 읽기 ─────────────
  const pad = (n) => String(n).padStart(2, '0');
  /** §4.2 날짜 셀: 일련번호, 2025-03-22, 2025.3.22, 2025/3/22, 3/22, 3/22(토) */
  function parseDate(text, year) {
    const t = String(text == null ? '' : text).trim().replace(/\([^)]*\)\s*$/, '').trim();
    if (!t) return null;
    let m;
    if (/^\d{5}$/.test(t)) { const n = +t; const ms = Date.UTC(1899, 11, 30) + n * 86400000; const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
    if ((m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t))) return valid(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[/.-](\d{1,2})$/.exec(t))) return valid(year || 2025, +m[1], +m[2]);
    if ((m = /^(\d{1,2})월\s*(\d{1,2})일$/.exec(t))) return valid(year || 2025, +m[1], +m[2]);
    return null;
  }
  function valid(y, mo, d) {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  const isISO = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  function parseBool(t) {
    const s = String(t).trim().toUpperCase();
    if (['1', 'Y', '예', 'TRUE', 'O'].includes(s)) return 1;
    if (['0', 'N', '아니오', 'FALSE', 'X'].includes(s)) return 0;
    return null;
  }
  function parseCell(col, text) {
    const t = String(text == null ? '' : text).trim();
    if (t === '') return '';
    if (col.type === 'date') return parseDate(t) || t;
    if (col.type === 'int') return /^-?\d+$/.test(t) ? +t : t;
    if (col.type === 'bool') { const b = parseBool(t); return b == null ? t : b; }
    if (col.type === 'enum') { const o = (col.options || []).find((x) => x === t || x.replace(/\s/g, '') === t.replace(/\s/g, '')); return o || t; }
    return t;
  }
  function editText(col, v) {
    if (v == null || v === '') return '';
    if (col.type === 'date' && isISO(v)) return v;
    return String(v);
  }
  function showText(col, v) {
    if (v == null || v === '') return '';
    if (col.type === 'date' && isISO(v)) return D.fmtDate(v);
    if (col.type === 'bool' && (v === 0 || v === 1)) return v ? '예' : '아니오';
    return String(v);
  }

  // 유사 이름 제안
  function lev(a, b) {
    const m = a.length, n = b.length; const dp = [];
    for (let i = 0; i <= m; i++) { dp.push([i]); for (let j = 1; j <= n; j++) dp[i][j] = i ? 0 : j; }
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1].toUpperCase() === b[j - 1].toUpperCase() ? 0 : 1));
    return dp[m][n];
  }
  function suggestTeam(name) {
    const names = WB.app.state.teams.map((t) => t.name);
    let best = null, bd = 99;
    for (const n of names) { const d = n.toUpperCase().startsWith(name.toUpperCase()) || name.toUpperCase().startsWith(n.toUpperCase()) ? 0.5 : lev(name, n); if (d < bd) { bd = d; best = n; } }
    return bd <= 2 ? best : null;
  }

  // ───────────── 모델 생성 ─────────────
  function fromProject(p) {
    const s = p.settings;
    const holidays = new Set(s.holidays.map((h) => h.date));
    const notes = {};
    const slots = p.calendar.map((c, i) => {
      const start = c.datetime.slice(0, 10);
      const days = []; for (let k = 0; k < c.consecutive; k++) days.push(D.addDays(start, k));
      let note = '';
      if (i === 0) note = '개막 2연전';
      else if (days.includes('2025-05-05')) note = '어린이날 (휴식 예외일 포함)';
      else if (days.some((d) => holidays.has(d))) note = s.holidays.filter((h) => days.includes(h.date)).map((h) => h.name).join('·');
      else if (start === '2025-07-17') note = '올스타 브레이크 후';
      notes[i] = note;
      const auto = i >= 24;
      return { start, games: c.consecutive, weekend: auto ? '' : c.weekend, holiday: auto ? '' : c.holiday, note };
    });
    const series = p.matches.map((m) => ({ home: m.home, away: m.away, games: m.consecutive, note: m.eventId ? '개막전 대진' : '' }));
    const events = p.events.map((e) => ({
      name: e.name, type: e.type === 'OPENING' ? '개막전' : e.type === 'CHILDREN' ? '어린이날' : '사용자정의', date: e.date, mode: e.mode === 'MATCH' ? '대진' : '구장',
      home: e.home || '', away: e.away || '', stadiums: (e.stadiums || []).join(', ')
    }));
    return {
      season: {
        seasonStart: s.seasonStart, initialEnd: s.initialEnd, seasonEnd: s.seasonEnd, restWeekdays: s.restWeekdays.map((d) => WEEKDAY[d]).join(','),
        gamesPerPair: s.gamesPerPair, initialGamesPerPair: s.initialGamesPerPair, homeGamesMajor: s.homeGamesMajor || 9, roadFactor: s.roadFactor, longTripKm: s.longTripKm || 600
      },
      slots, series,
      holidays: s.holidays.map((h) => ({ date: h.date, name: h.name })),
      rest: s.restExceptions.map((d) => ({ date: d, note: d === '2025-05-05' ? '어린이날 월요일 경기' : '' })),
      blackouts: s.blackouts.map((b) => ({ start: b.start, end: b.end, name: b.label })),
      events,
      dirty: false
    };
  }

  // ───────────── 시즌 골격 행 ─────────────
  const SEASON_ROWS = [
    { key: 'seasonStart', label: '개막일', type: 'date', unit: '날짜', desc: '정규시즌 첫 경기일 (FR-S1)' },
    { key: 'initialEnd', label: '1차 편성 종료일', type: 'date', unit: '날짜', desc: '1차 편성 범위 끝. 이후는 재편성' },
    { key: 'seasonEnd', label: '시즌 종료일', type: 'date', unit: '날짜', desc: '재편성까지 포함한 마지막 날' },
    { key: 'restWeekdays', label: '휴식 요일', type: 'weekdays', unit: '요일(쉼표)', desc: '경기가 없는 요일. 여러 개는 쉼표로' },
    { key: 'gamesPerPair', label: '구단쌍 목표 경기 수', type: 'int', min: 2, max: 30, unit: '경기', desc: '시즌 전체 기준 (FR-S7)' },
    { key: 'initialGamesPerPair', label: '1차 편성 경기 수', type: 'int', min: 2, max: 30, unit: '경기', desc: '구단쌍마다 1차 편성에 넣을 경기' },
    { key: 'homeGamesMajor', label: '홈/원정 분배 (많은 쪽)', type: 'int', min: 0, max: 30, unit: '경기', desc: '예: 9 → 9:6' },
    { key: 'roadFactor', label: '도로계수', type: 'num', unit: '배', desc: '새 구장 거리 = 직선거리 × 도로계수' },
    { key: 'longTripKm', label: '장거리 원정 임계값', type: 'int', min: 100, max: 2000, unit: 'km', desc: 'FR-A10 경고 기준' }
  ];
  function seasonText(row, v) {
    if (row.type === 'date' && isISO(v)) return D.fmtDate(v);
    return v == null ? '' : String(v);
  }
  function seasonParse(row, text) {
    const t = String(text).trim();
    if (row.type === 'date') return parseDate(t) || t;
    if (row.type === 'int') return /^\d+$/.test(t) ? +t : t;
    if (row.type === 'num') return /^\d+(\.\d+)?$/.test(t) ? +t : t;
    return t;
  }
  function seasonValidate(row, v) {
    if (v === '' || v == null) return { level: 'error', msg: '값이 비어 있습니다.' };
    if (row.type === 'date' && !isISO(v)) return { level: 'error', msg: "날짜로 읽을 수 없습니다: '" + v + "' — 2025-03-22, 3/22 형식" };
    if ((row.type === 'int' || row.type === 'num') && typeof v !== 'number') return { level: 'error', msg: '숫자를 입력하세요.' };
    if (row.type === 'int' && (v < row.min || v > row.max)) return { level: 'error', msg: row.min + '~' + row.max + ' 범위여야 합니다.' };
    if (row.type === 'weekdays') { const bad = String(v).split(/[,\s]+/).filter((x) => x && WEEKDAY.indexOf(x) < 0); if (bad.length) return { level: 'error', msg: "요일을 읽을 수 없습니다: '" + bad.join(',') + "' — 월, 화 … 일" }; }
    const b = WB.book.season;
    if (row.key === 'initialEnd' && isISO(v) && isISO(b.seasonStart) && v <= b.seasonStart) return { level: 'error', msg: '1차 편성 종료일이 개막일보다 빠릅니다.' };
    if (row.key === 'initialGamesPerPair' && typeof v === 'number' && v > b.gamesPerPair) return { level: 'error', msg: '목표 경기 수(' + b.gamesPerPair + ')보다 클 수 없습니다.' };
    return null;
  }
  function restDays() {
    const s = WB.book.season.restWeekdays;
    return String(s || '').split(/[,\s]+/).map((x) => WEEKDAY.indexOf(x)).filter((x) => x >= 0);
  }

  // ───────────── 검증 ─────────────
  function issue(sheet, r, key, level, msg, fix) { return { sheet, r, key, level, msg, fix }; }
  function cellCheck(sheet, col, v) {
    if ((v === '' || v == null) && col.req) return { level: 'error', msg: '필수 값이 비어 있습니다.' };
    if (v === '' || v == null) return null;
    if (col.type === 'date' && !isISO(v)) return { level: 'error', msg: "날짜로 읽을 수 없습니다: '" + v + "' — 2025-03-22, 2025.3.22, 3/22(토) 형식을 받습니다." };
    if (col.type === 'int' && typeof v !== 'number') return { level: 'error', msg: "숫자가 아닙니다: '" + v + "'" };
    if (col.type === 'int' && col.min != null && (v < col.min || v > col.max)) return { level: 'error', msg: col.label + '은(는) ' + col.min + '~' + col.max + '이어야 합니다. 입력값 ' + v + '.' };
    if (col.type === 'bool' && v !== 0 && v !== 1) return { level: 'error', msg: "1/0, Y/N, 예/아니오, TRUE/FALSE만 받습니다: '" + v + "'" };
    if (col.type === 'enum' && col.options.indexOf(v) < 0) return { level: 'error', msg: "'" + v + "'은(는) 쓸 수 없는 값입니다 — " + col.options.join(' · ') + ' 중 하나' };
    if (col.type === 'team') {
      const names = WB.app.state.teams.map((t) => t.name);
      if (names.indexOf(v) < 0) { const sg = suggestTeam(String(v)); return { level: 'error', msg: "알 수 없는 구단 '" + v + "'" + (sg ? " — '" + sg + "'인가요?" : ' — 구단 표에 있는 이름을 쓰세요.'), fix: sg ? { value: sg, label: "'" + sg + "'(으)로 고치기" } : null }; }
    }
    return null;
  }
  function slotRange(row) { if (!isISO(row.start) || typeof row.games !== 'number') return null; return [row.start, D.addDays(row.start, row.games - 1)]; }

  function validate() {
    const b = WB.book;
    const out = [];
    const per = (sheet, rows) => rows.forEach((row, r) => DEFS[sheet].cols.forEach((col) => { const x = cellCheck(sheet, col, row[col.key]); if (x) out.push(issue(sheet, r, col.key, x.level, x.msg, x.fix)); }));
    for (const id of IMPORT_SHEETS) per(id, b[id]);
    // 시즌 골격
    SEASON_ROWS.forEach((row, r) => { const x = seasonValidate(row, b.season[row.key]); if (x) out.push(issue('season', r, 'value', x.level, x.msg)); });
    const rd = restDays();
    const blackoutDays = new Set(); b.blackouts.forEach((x) => { if (isISO(x.start) && isISO(x.end)) for (let d = D.dayNum(x.start); d <= D.dayNum(x.end); d++) blackoutDays.add(D.isoDate(d)); });
    const exc = new Set(b.rest.map((x) => x.date));
    // 슬롯
    let prevEnd = null, prevStart = null, prevR = -1;
    b.slots.forEach((row, r) => {
      const rg = slotRange(row);
      if (!rg) return;
      if (prevStart && row.start < prevStart) out.push(issue('slots', r, 'start', 'warn', '시작일 순으로 정렬되어 있지 않습니다(앞 ' + (prevR + 2) + '행 ' + D.fmtDate(prevStart) + '). 가져올 때 정렬합니다.'));
      else if (prevEnd && row.start <= prevEnd) out.push(issue('slots', r, 'start', 'error', '앞 ' + (prevR + 2) + '행 슬롯(' + D.fmtShort(prevStart) + '~' + D.fmtShort(prevEnd) + ')과 날짜가 겹칩니다.'));
      if (isISO(b.season.seasonStart) && rg[0] < b.season.seasonStart) out.push(issue('slots', r, 'start', 'warn', '개막일(' + D.fmtDate(b.season.seasonStart) + ') 이전입니다.'));
      if (isISO(b.season.initialEnd) && rg[1] > b.season.initialEnd) out.push(issue('slots', r, 'start', 'warn', '1차 편성 종료일(' + D.fmtDate(b.season.initialEnd) + ') 이후까지 이어집니다.'));
      for (let d = D.dayNum(rg[0]); d <= D.dayNum(rg[1]); d++) {
        const iso = D.isoDate(d);
        if (blackoutDays.has(iso)) { out.push(issue('slots', r, 'start', 'warn', D.fmtDate(iso) + '이(가) 경기 없는 기간과 겹칩니다.')); break; }
        if (rd.indexOf(D.weekday(d)) >= 0 && !exc.has(iso)) { out.push(issue('slots', r, 'games', 'warn', D.fmtDate(iso) + '은(는) 휴식 요일입니다(휴식 예외일 아님).')); break; }
      }
      if (prevEnd == null || row.start > prevEnd) { prevEnd = rg[1]; prevStart = rg[0]; prevR = r; }
    });
    // 시리즈
    const pair = new Map();
    b.series.forEach((row, r) => {
      if (row.home && row.away && row.home === row.away) out.push(issue('series', r, 'away', 'error', '홈과 원정이 같은 구단(' + row.home + ')입니다.'));
      if (row.home && row.away && typeof row.games === 'number') { const k = [row.home, row.away].sort().join('–'); pair.set(k, (pair.get(k) || 0) + row.games); }
    });
    const G = b.season.initialGamesPerPair;
    for (const [k, v] of pair) if (v !== G && typeof G === 'number') {
      const rr = b.series.map((x, i) => ([x.home, x.away].sort().join('–') === k ? i : -1)).filter((i) => i >= 0);
      out.push(issue('series', rr[rr.length - 1], 'games', 'warn', '구단쌍 ' + k + ' 경기 수 ' + v + ' ≠ 1차 편성 경기 수 ' + G + '.'));
    }
    // 공휴일
    const seen = new Map();
    b.holidays.forEach((row, r) => {
      if (!isISO(row.date)) return;
      if (seen.has(row.date)) out.push(issue('holidays', r, 'date', 'error', '같은 날짜가 ' + (seen.get(row.date) + 2) + '행에 이미 있습니다.'));
      else seen.set(row.date, r);
      if (isISO(b.season.initialEnd) && row.date > b.season.initialEnd) out.push(issue('holidays', r, 'date', 'info', '1차 편성 기간 밖 — 재편성(9~10월) 가중치에만 쓰입니다.'));
    });
    b.rest.forEach((row, r) => { if (isISO(row.date) && rd.indexOf(D.weekday(row.date)) < 0) out.push(issue('rest', r, 'date', 'warn', D.fmtDate(row.date) + '은(는) 휴식 요일이 아닙니다. 예외일로 둘 필요가 없습니다.')); });
    b.blackouts.forEach((row, r) => { if (isISO(row.start) && isISO(row.end) && row.start > row.end) out.push(issue('blackouts', r, 'end', 'error', '시작일(' + D.fmtDate(row.start) + ')이 종료일보다 늦습니다.')); });
    // 이벤트
    const slotOf = (iso) => { for (let i = 0; i < b.slots.length; i++) { const rg = slotRange(b.slots[i]); if (rg && iso >= rg[0] && iso <= rg[1]) return i; } return -1; };
    const byDate = new Map();
    const stadiums = new Set(WB.app.state.teams.map((t) => t.stadium));
    b.events.forEach((row, r) => {
      if (isISO(row.date) && slotOf(row.date) < 0) out.push(issue('events', r, 'date', 'error', D.fmtDate(row.date) + '은(는) 어느 슬롯에도 없습니다.'));
      if (row.mode === '대진') {
        if (!row.home) out.push(issue('events', r, 'home', 'error', '대진 방식은 홈 구단이 필수입니다.'));
        if (!row.away) out.push(issue('events', r, 'away', 'error', '대진 방식은 원정 구단이 필수입니다.'));
      }
      if (row.mode === '구장') {
        if (!row.stadiums) out.push(issue('events', r, 'stadiums', 'error', '구장 방식은 구장이 필수입니다(쉼표로 여러 개).'));
        else { const bad = String(row.stadiums).split(',').map((x) => x.trim()).filter((x) => x && !stadiums.has(x)); if (bad.length) out.push(issue('events', r, 'stadiums', 'error', '알 수 없는 구장: ' + bad.join(', '))); }
      }
      if (isISO(row.date)) { const k = slotOf(row.date); if (!byDate.has(k)) byDate.set(k, []); byDate.get(k).push(r); }
    });
    for (const [, rows] of byDate) {
      const teamUse = new Map();
      for (const r of rows) { const e = b.events[r]; if (e.mode !== '대진') continue; for (const t of [e.home, e.away]) { if (!t) continue; if (teamUse.has(t)) out.push(issue('events', r, e.home === t ? 'home' : 'away', 'error', '같은 슬롯에서 ' + t + '이(가) 두 대진(' + (teamUse.get(t) + 2) + '행)에 나옵니다 (FR-E5).')); else teamUse.set(t, r); } }
    }
    return out;
  }

  function issues() {
    if (WB.book._issues) return WB.book._issues;
    WB.book._issues = validate();
    return WB.book._issues;
  }
  function issueMap(sheet) {
    const m = new Map();
    for (const x of issues()) { if (x.sheet !== sheet) continue; const k = x.r + '|' + x.key; const cur = m.get(k); if (!cur || rank(x.level) > rank(cur.level)) m.set(k, x); }
    return m;
  }
  const rank = (l) => (l === 'error' ? 3 : l === 'warn' ? 2 : 1);
  function counts(sheet) {
    const c = { error: 0, warn: 0, info: 0 };
    for (const x of issues()) if (!sheet || x.sheet === sheet) c[x.level]++;
    return c;
  }

  // ───────────── 변경 (기록 포함) ─────────────
  function changed(sheet) {
    WB.book._issues = null;
    if (sheet === 'slots' || sheet === 'series') WB.book.dirty = true;
  }
  function snapshotSheet(sheet) { return JSON.stringify(sheet === 'season' ? WB.book.season : WB.book[sheet]); }
  function restoreSheet(sheet, json) { if (sheet === 'season') WB.book.season = JSON.parse(json); else WB.book[sheet] = JSON.parse(json); changed(sheet); }
  function record(sheet, label, mut) {
    const before = snapshotSheet(sheet);
    const dirtyBefore = WB.book.dirty;
    mut();
    changed(sheet);
    const after = snapshotSheet(sheet);
    if (before === after) return false;
    WB.pushHist({ label, undo: () => { restoreSheet(sheet, before); WB.book.dirty = dirtyBefore; }, redo: () => restoreSheet(sheet, after) });
    return true;
  }
  function setCell(sheet, r, key, text) {
    if (sheet === 'season') {
      const row = SEASON_ROWS[r];
      return record('season', '시즌 골격 · ' + row.label + ' 수정', () => { WB.book.season[row.key] = seasonParse(row, text); });
    }
    const col = DEFS[sheet].cols.find((c) => c.key === key);
    const v = parseCell(col, text);
    return record(sheet, DEFS[sheet].name + ' ' + (r + 2) + '행 ' + col.label + ' 수정', () => { WB.book[sheet][r][key] = v; });
  }
  function blankRow(sheet) { const o = {}; for (const c of DEFS[sheet].cols) o[c.key] = ''; o.__new = true; return o; }
  function insertRow(sheet, r, below) {
    const at = below ? r + 1 : r;
    record(sheet, DEFS[sheet].name + ' ' + (at + 2) + '행 삽입', () => { WB.book[sheet].splice(at, 0, blankRow(sheet)); });
    return at;
  }
  function deleteRow(sheet, r) {
    const row = WB.book[sheet][r];
    const desc = DEFS[sheet].cols.slice(0, 3).map((c) => showText(c, row[c.key])).filter(Boolean).join(' · ');
    record(sheet, DEFS[sheet].name + ' ' + (r + 2) + '행 삭제 (' + desc + ')', () => { WB.book[sheet].splice(r, 1); });
  }

  /** 시리즈 행 → 구장 이름 */
  function stadiumOf(team) { const t = WB.app.state.teams.find((x) => x.name === team); return t ? t.stadium : ''; }
  /** 슬롯 행의 자동 값 (주말·휴일가중치) */
  function autoWeights(row) {
    if (!isISO(row.start) || typeof row.games !== 'number') return null;
    const hol = new Set(WB.book.holidays.filter((h) => isISO(h.date)).map((h) => D.dayNum(h.date)));
    return CG.slotWeights(D.dayNum(row.start), row.games, hol);
  }
  /** 현재 시즌 골격·공휴일·예외·경기 없는 기간으로 슬롯을 다시 만든 결과 */
  function regenSlots() {
    const b = WB.book;
    const settings = {
      seasonStart: b.season.seasonStart, initialEnd: b.season.initialEnd, restWeekdays: restDays(),
      restExceptions: b.rest.map((x) => x.date).filter(isISO),
      blackouts: b.blackouts.filter((x) => isISO(x.start) && isISO(x.end)).map((x) => ({ start: x.start, end: x.end, label: x.name })),
      holidays: b.holidays.filter((x) => isISO(x.date)).map((x) => ({ date: x.date, name: x.name }))
    };
    try { return CG.generateSlots(settings); } catch (e) { return []; }
  }

  WB.Book = {
    DEFS, ORDER, IMPORT_SHEETS, SEASON_ROWS, TYPES_EV, MODES_EV,
    parseDate, isISO, parseCell, editText, showText, cellCheck, seasonText, seasonParse, seasonValidate, suggestTeam,
    fromProject, issues, issueMap, counts, setCell, insertRow, deleteRow, record, changed, stadiumOf, autoWeights, regenSlots, restDays, slotRange
  };
})();
