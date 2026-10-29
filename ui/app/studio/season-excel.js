/*
 * 편성 스튜디오 — ① 시즌 달력: 엑셀로 한꺼번에 (서식 ㄱ 날짜 행)
 * 「지금 데이터로 서식 내려받기」 → .xlsx 시트 4개(지금 데이터가 채워져 있음):
 *   ① 구단 정보(구단·구장·위도·경도) ② 시즌 기간과 공휴일(종류·날짜·이름·가중치)
 *   ③ 연전 기간(번호·시작일·요일(수식)·연전 수·끝 날짜(수식)·메모 — 줄을 모두 비우면 규칙대로) ④ 홈 구장 지정(날짜·이름·구단 1~5)
 * 「채운 파일 올리기」 → 실제로 읽어(core/xlsx-lite.js) 시트마다 검사(날짜 형식·겹침·연전 수·경기일 합·잠실 중복·5곳 초과·모르는 구단)
 *   → 「달력에 반영」(저장 한 번, 실행 취소 가능). 구글 시트 연결은 그대로(가져오기 미리보기 화면).
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, CalendarGen, Score, Xlsx } = KBO;
  const app = () => S.app;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const SHEET = { teams: '구단 정보', season: '시즌 기간과 공휴일', slots: '연전 기간', home: '홈 구장 지정' };
  const KIND = { year: '시즌 연도', start: '개막일', initialEnd: '1차 편성 종료일', end: '시즌 종료일', rest: '휴식 요일', allStar: '올스타 휴식기 시작', holiday: '공휴일' };
  const dn = Dates.dayNum;
  const weekdayF = (cell) => 'CHOOSE(WEEKDAY(' + cell + '),"일","월","화","수","목","금","토")';

  // ───────── 서식 만들기 (지금 데이터로 채움) ─────────
  S.calXlSheets = function () {
    const st = app().state, s = st.settings, y = S.seasonYear();
    const d = (iso) => (iso ? { date: iso } : null);
    const teams = [['구단', '구장', '위도', '경도']].concat(st.teams.map((t) => [t.name, t.stadium, t.latitude, t.longitude]));
    const season = [['종류', '날짜', '이름', '가중치'],
      [KIND.year, y, '고르면 주말·공휴일이 달력에 표시됩니다', null],
      [KIND.start, d(s.seasonStart), '늘 토요일(토·일 2연전)', null],
      [KIND.initialEnd, d(s.initialEnd), '여기까지 1차 편성(경기일 ' + S.gameDaysCheck().need + '일)', null],
      [KIND.end, d(s.seasonEnd), '그 뒤는 재편성 기간', null],
      [KIND.rest, (s.restWeekdays || []).map((k) => WD[k]).join(','), '쉼표로 여럿', null],
      [KIND.allStar, d(s.allStarStart || (s.seasonStart ? CalendarGen.defaultAllStarStart(y) : '')), '금요일부터 6일(금~수)', null]]
      .concat(s.holidays.map((h) => [KIND.holiday, d(h.date), h.name, h.weight == null ? CalendarGen.HOLIDAY_WEIGHT : h.weight]));
    const slots = [['번호', '시작일', '요일', '연전 수', '끝 날짜', '메모']].concat(st.calendar.map((c, i) => {
      const r = i + 2, start = c.datetime.slice(0, 10), end = Dates.isoDate(dn(start) + c.consecutive - 1);
      return [i + 1, { date: start }, { f: weekdayF('B' + r), v: WD[Dates.weekday(dn(start))] }, c.consecutive, { f: 'IF(B' + r + '="","",B' + r + '+D' + r + '-1)', v: { date: end } }, c.note || null];
    }));
    const evs = st.events.filter((e) => e.mode === 'STADIUM').slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const home = [['날짜', '이름', '구단 1', '구단 2', '구단 3', '구단 4', '구단 5']].concat(evs.map((e) => [{ date: e.date }, e.name].concat(S.evTeams(e).slice(0, 5))));
    return [
      { name: SHEET.teams, rows: teams, header: true, widths: [10, 24, 12, 12] },
      { name: SHEET.season, rows: season, header: true, widths: [18, 13, 34, 8] },
      { name: SHEET.slots, rows: slots, header: true, widths: [6, 13, 6, 8, 13, 24] },
      { name: SHEET.home, rows: home, header: true, widths: [13, 12, 8, 8, 8, 8, 8] }
    ];
  };
  S.calXlFileName = () => 'KBO ' + S.seasonYear() + ' 시즌 입력 서식.xlsx';
  function download() {
    const bytes = Xlsx.write(S.calXlSheets());
    S.lastXlBytes = bytes; // 자가 점검이 같은 파일로 「올리기」를 해 본다
    if (!S.selftestMode) KBO.UI.download(S.calXlFileName(), new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    S.toast('「' + S.calXlFileName() + '」을 내려받았습니다. 시트 4개(구단 정보 · 시즌 기간과 공휴일 · 연전 기간 · 홈 구장 지정)에 지금 데이터가 들어 있습니다. 고친 뒤 「채운 파일 올리기」로 올립니다.', 'ok', 7000);
  }

  // ───────── 읽기 ─────────
  async function inflateRaw(b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 압축된 엑셀 파일을 풀 수 없습니다. 최신 Chrome·Edge·Safari에서 올려 주세요.');
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([b]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  const norm = (v) => (v == null ? '' : String(v).trim());
  /** 칸 → 'YYYY-MM-DD'. 엑셀 날짜(일련번호)·「2025-03-22」·「3/22」·「3/22(토)」 */
  function cellDate(v, year) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v > 20000 && v < 80000 ? Xlsx.serialToIso(v) : null;
    const s = String(v).trim();
    let m = /^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/.exec(s);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})[/.월\s]+(\d{1,2})일?(\([^)]*\))?$/.exec(s);
    if (m) return iso(year, +m[1], +m[2]);
    return null;
    function iso(y0, mo, d) { if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; const x = Dates.isoDate(dn(y0 + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'))); return x.slice(5) === String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') ? x : null; }
  }
  /** 올린 파일 → 검사 결과(시트마다 줄 수·바뀐 것·오류·경고)와 반영할 값 */
  S.calXlParse = function (sheets) {
    const st = app().state, out = { sheets: [], next: {}, errors: 0 };
    const find = (name) => sheets.find((x) => norm(x.name) === name) || null;
    const add = (key, name, rows) => { const r = { key, name, rows, errors: [], warnings: [], notes: [] }; out.sheets.push(r); return r; };
    const where = (sh, i, col) => sh.name + ' · 엑셀 ' + (i + 1) + '번째 줄' + (col ? ' · ' + col : ''); // i = 제목 줄 다음부터 1, 엑셀 줄 번호는 i + 1
    // ② 시즌 기간과 공휴일(연도를 먼저 읽어야 「3/22」 같은 날짜의 연도를 안다)
    const sSh = find(SHEET.season);
    const set = Object.assign({}, st.settings);
    let year = S.seasonYear();
    const rs = add('season', SHEET.season, sSh ? Math.max(0, sSh.rows.length - 1) : 0);
    if (!sSh) rs.warnings.push({ loc: SHEET.season, why: '시트가 없어 시즌 기간과 공휴일은 그대로 둡니다.' });
    else {
      const body = sSh.rows.slice(1);
      const yRow = body.find((r) => norm(r[0]) === KIND.year);
      if (yRow && yRow[1] != null && yRow[1] !== '') { const y = parseInt(String(yRow[1]), 10); if (y >= 2000 && y <= 2100) year = y; else rs.errors.push({ loc: SHEET.season + ' · 시즌 연도', why: "연도로 읽을 수 없습니다: '" + yRow[1] + "'" }); }
      const hols = [];
      body.forEach((r, k) => {
        const i = k + 1, kind = norm(r[0]);
        if (!kind) return;
        const dateKey = { [KIND.start]: 'seasonStart', [KIND.initialEnd]: 'initialEnd', [KIND.end]: 'seasonEnd', [KIND.allStar]: 'allStarStart' }[kind];
        if (dateKey) {
          if (r[1] == null || r[1] === '') { if (dateKey !== 'allStarStart') rs.errors.push({ loc: where(sSh, i, '날짜'), why: kind + '이(가) 비었습니다.' }); return; }
          const v = cellDate(r[1], year);
          if (!v) rs.errors.push({ loc: where(sSh, i, '날짜'), why: kind + "을(를) 날짜로 읽을 수 없습니다: '" + r[1] + "' — 2025-03-22나 3/22처럼 적습니다." });
          else set[dateKey] = v;
        } else if (kind === KIND.rest) {
          const ks = norm(r[1]).split(/[,、·\s]+/).filter(Boolean).map((x) => WD.indexOf(x.replace(/요일$/, '')));
          if (!ks.length || ks.some((x) => x < 0)) rs.errors.push({ loc: where(sSh, i, '날짜'), why: "휴식 요일은 「월」처럼 요일 글자로 적습니다: '" + norm(r[1]) + "'" });
          else set.restWeekdays = Array.from(new Set(ks)).sort();
        } else if (kind === KIND.holiday) {
          const v = cellDate(r[1], year), name = norm(r[2]), w = r[3] == null || r[3] === '' ? CalendarGen.defaultHolidayWeight(name) : Number(r[3]);
          if (!v) { rs.errors.push({ loc: where(sSh, i, '날짜'), why: "공휴일 날짜로 읽을 수 없습니다: '" + (r[1] == null ? '' : r[1]) + "'" }); return; }
          if (!name) { rs.errors.push({ loc: where(sSh, i, '이름'), why: '공휴일 이름이 비었습니다.' }); return; }
          if (!Number.isInteger(w) || w < 0 || w > 10) { rs.errors.push({ loc: where(sSh, i, '가중치'), why: "가중치는 0~10 정수입니다(주말 하루 = 1): '" + r[3] + "'" }); return; }
          if (hols.some((h) => h.date === v)) { rs.errors.push({ loc: where(sSh, i, '날짜'), why: fmt.date(v) + '이(가) 두 번 있습니다.' }); return; }
          hols.push({ date: v, name, weight: w });
        } else if (kind !== KIND.year) rs.warnings.push({ loc: where(sSh, i, '종류'), why: "모르는 종류 「" + kind + "」는 읽지 않습니다." });
      });
      set.holidays = hols.sort((a, b) => (a.date < b.date ? -1 : 1));
      set.seasonYear = year;
      if (set.seasonStart && set.initialEnd && !(set.seasonStart < set.initialEnd)) rs.errors.push({ loc: SHEET.season, why: '개막일이 1차 편성 종료일보다 늦습니다.' });
      if (set.initialEnd && set.seasonEnd && set.seasonEnd < set.initialEnd) rs.errors.push({ loc: SHEET.season, why: '시즌 종료일이 1차 편성 종료일보다 이릅니다.' });
      if (set.seasonStart && Dates.weekday(dn(set.seasonStart)) !== 6) rs.warnings.push({ loc: SHEET.season + ' · 개막일', why: fmt.date(set.seasonStart) + '이 토요일이 아닙니다. 개막은 늘 토요일(토·일 2연전)입니다.' });
      const ch = ['seasonStart', 'initialEnd', 'seasonEnd', 'allStarStart'].filter((k) => (set[k] || '') !== (st.settings[k] || '')).length + (set.restWeekdays.join() !== st.settings.restWeekdays.join() ? 1 : 0);
      const hk = (h) => h.date + '|' + h.name + '|' + (h.weight == null ? CalendarGen.HOLIDAY_WEIGHT : h.weight);
      const hch = JSON.stringify(set.holidays.map(hk)) !== JSON.stringify(st.settings.holidays.map(hk));
      rs.notes.push('시즌 ' + year + ' · ' + (set.seasonStart ? fmt.date(set.seasonStart) : '개막일 없음') + ' ~ ' + (set.initialEnd ? fmt.date(set.initialEnd) : '?') + ' · 공휴일 ' + set.holidays.length + '일' + (ch || hch ? ' · 바뀐 곳 ' + (ch + (hch ? 1 : 0)) : ' · 지금과 같음'));
    }
    out.next.settings = set;
    // ③ 연전 기간
    const cSh = find(SHEET.slots);
    const rc = add('slots', SHEET.slots, cSh ? Math.max(0, cSh.rows.length - 1) : 0);
    let list = null;
    if (!cSh) rc.warnings.push({ loc: SHEET.slots, why: '시트가 없어 연전 묶음은 그대로 둡니다.' });
    else {
      const body = cSh.rows.slice(1).map((r, k) => ({ r, i: k + 1 })).filter(({ r }) => r.some((x) => x != null && x !== ''));
      if (!body.length) {
        if (!set.seasonStart || !set.initialEnd) rc.errors.push({ loc: SHEET.slots, why: '줄이 비어 규칙대로 채우려면 개막일과 1차 편성 종료일이 있어야 합니다.' });
        else { list = CalendarGen.generateSlots(CalendarGen.ruleSettings(set)).slots.map((x) => ({ d: dn(x.datetime), len: x.consecutive })); rc.notes.push('줄이 비어 규칙대로 채웁니다 — 묶음 ' + list.length + '개'); }
      } else {
        list = [];
        for (const { r, i } of body) {
          const v = cellDate(r[1], year), n = r[3] == null || r[3] === '' ? null : Number(r[3]);
          if (!v) { rc.errors.push({ loc: where(cSh, i, '시작일'), why: "날짜로 읽을 수 없습니다: '" + (r[1] == null ? '' : r[1]) + "' — 2025-03-22나 3/22처럼 적습니다." }); continue; }
          if (!Number.isInteger(n) || n < 2 || n > 4) { rc.errors.push({ loc: where(cSh, i, '연전 수'), why: '연전 수는 2~4입니다: \'' + (r[3] == null ? '' : r[3]) + "'" }); continue; }
          const x = { d: dn(v), len: n, i };
          if (norm(r[5])) x.note = norm(r[5]);
          if (set.seasonStart && set.initialEnd && (x.d < dn(set.seasonStart) || x.d + n - 1 > dn(set.initialEnd))) rc.warnings.push({ loc: where(cSh, i, '시작일'), why: fmt.date(x.d) + ' ' + n + '연전이 1차 편성 기간(' + fmt.short(set.seasonStart) + '~' + fmt.short(set.initialEnd) + ')을 벗어납니다.' });
          list.push(x);
        }
        list.sort((a, b) => a.d - b.d);
        for (let k = 1; k < list.length; k++) { const p = list[k - 1], c = list[k]; if (c.d <= p.d + p.len - 1) rc.errors.push({ loc: where(cSh, c.i, '시작일'), why: fmt.date(c.d) + ' 묶음이 앞 묶음(' + fmt.date(p.d) + ' ' + p.len + '연전)과 겹칩니다.' }); }
      }
      if (list) {
        const have = list.reduce((a, x) => a + x.len, 0), need = S.gameDaysCheck().need;
        const h = CalendarGen.lengthHistogram(list.map((x) => ({ consecutive: x.len })));
        rc.notes.push('묶음 ' + list.length + '개 · 2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + ' · 경기일 ' + have + ' / ' + need + '일');
        if (have !== need) rc.warnings.push({ loc: SHEET.slots, why: '경기일 합이 ' + have + '일입니다(필요 ' + need + '일). 반영한 뒤 달력에서 맞출 수 있습니다.' });
      }
    }
    out.next.list = list;
    // ④ 홈 구장 지정
    const hSh = find(SHEET.home);
    const rh = add('home', SHEET.home, hSh ? Math.max(0, hSh.rows.length - 1) : 0);
    let evs = null;
    if (!hSh) rh.warnings.push({ loc: SHEET.home, why: '시트가 없어 홈 구장 지정은 그대로 둡니다.' });
    else {
      evs = [];
      const names = st.teams.map((t) => t.name), half = st.teams.length >> 1;
      hSh.rows.slice(1).forEach((r, k) => {
        const i = k + 1;
        if (!r.some((x) => x != null && x !== '')) return;
        const v = cellDate(r[0], year);
        if (!v) { rh.errors.push({ loc: where(hSh, i, '날짜'), why: "날짜로 읽을 수 없습니다: '" + (r[0] == null ? '' : r[0]) + "'" }); return; }
        if (evs.some((e) => e.date === v)) { rh.errors.push({ loc: where(hSh, i, '날짜'), why: fmt.date(v) + '이(가) 두 번 있습니다 — 한 날은 한 줄에 적습니다.' }); return; }
        const picked = r.slice(2).map(norm).filter(Boolean);
        const bad = picked.filter((n) => !names.includes(n));
        if (bad.length) { const sg = S.suggestTeam(bad[0]); rh.errors.push({ loc: where(hSh, i, '구단'), why: "알 수 없는 구단 '" + bad[0] + "'" + (sg ? " — '" + sg + "'인가요?" : '') }); return; }
        if (picked.length > half) { rh.errors.push({ loc: where(hSh, i, '구단'), why: '하루에 홈 경기는 ' + half + '곳입니다(' + picked.length + '곳을 적음).' }); return; }
        const stads = picked.map((n) => st.teams.find((t) => t.name === n).stadium);
        const dup = stads.find((x, j) => stads.indexOf(x) !== j);
        if (dup) { rh.errors.push({ loc: where(hSh, i, '구단'), why: dup + '은(는) ' + st.teams.filter((t) => t.stadium === dup).map((t) => t.name).join('·') + ' 중 하나만 적습니다(같은 날 한 구장에서 홈 경기는 하나).' }); return; }
        if (!picked.length) { rh.warnings.push({ loc: where(hSh, i, '구단'), why: '구단이 비어 이 줄은 읽지 않습니다.' }); return; }
        const name = norm(r[1]) || (v === set.seasonStart ? '개막전' : v.slice(5) === '05-05' ? '어린이날' : '홈 구장 지정');
        const type = v === set.seasonStart ? 'OPENING' : v.slice(5) === '05-05' ? 'CHILDREN' : 'CUSTOM';
        if (list && !list.some((x) => dn(v) >= x.d && dn(v) < x.d + x.len)) rh.warnings.push({ loc: where(hSh, i, '날짜'), why: fmt.date(v) + '은(는) 어느 연전 묶음에도 없습니다 — 그 날 경기가 없습니다.' });
        if (picked.length < half) rh.warnings.push({ loc: where(hSh, i, '구단'), why: fmt.date(v) + ' ' + name + ' ' + picked.length + '곳(' + half + '곳 중)입니다.' });
        evs.push({ date: v, name, type, teams: picked.slice().sort((a, b) => names.indexOf(a) - names.indexOf(b)), stadiums: stads });
      });
      rh.notes.push(evs.length ? evs.map((e) => fmt.short(e.date) + ' ' + e.name + ' ' + e.teams.length + '곳').join(' · ') : '홈 구장 지정 없음');
    }
    out.next.events = evs;
    // ① 구단 정보(구장·위치만 바꾼다 — 구단을 늘리거나 줄이지 않는다)
    const tSh = find(SHEET.teams);
    const rt = add('teams', SHEET.teams, tSh ? Math.max(0, tSh.rows.length - 1) : 0);
    const tch = [];
    if (!tSh) rt.warnings.push({ loc: SHEET.teams, why: '시트가 없어 구단 정보는 그대로 둡니다.' });
    else {
      const seen = new Set();
      tSh.rows.slice(1).forEach((r, k) => {
        const i = k + 1, n = norm(r[0]);
        if (!n) return;
        const t = st.teams.find((x) => x.name === n);
        if (!t) { const sg = S.suggestTeam(n); rt.errors.push({ loc: where(tSh, i, '구단'), why: "알 수 없는 구단 '" + n + "'" + (sg ? " — '" + sg + "'인가요?" : '') + ' 구단을 늘리거나 이름을 바꾸는 것은 구단 정보 화면에서 합니다.' }); return; }
        seen.add(n);
        const stad = norm(r[1]) || t.stadium, lat = r[2] == null || r[2] === '' ? t.latitude : Number(r[2]), lon = r[3] == null || r[3] === '' ? t.longitude : Number(r[3]);
        if (!Number.isFinite(lat) || lat < 30 || lat > 45 || !Number.isFinite(lon) || lon < 120 || lon > 135) { rt.errors.push({ loc: where(tSh, i, '위도·경도'), why: n + ' 위도·경도를 숫자로 읽을 수 없습니다(예: 37.5122, 127.0719).' }); return; }
        const p = {};
        if (stad !== t.stadium) p.stadium = stad;
        if (Math.abs(lat - t.latitude) > 1e-6) p.latitude = Math.round(lat * 1e6) / 1e6;
        if (Math.abs(lon - t.longitude) > 1e-6) p.longitude = Math.round(lon * 1e6) / 1e6;
        if (Object.keys(p).length) tch.push({ name: n, patch: p });
      });
      const miss = st.teams.filter((t) => !seen.has(t.name)).map((t) => t.name);
      if (miss.length) rt.warnings.push({ loc: SHEET.teams, why: '파일에 없는 구단(' + miss.join('·') + ')은 그대로 둡니다.' });
      rt.notes.push(tch.length ? '바뀐 구단 ' + tch.length + '곳: ' + tch.map((x) => x.name + '(' + Object.keys(x.patch).map((k) => ({ stadium: '구장', latitude: '위도', longitude: '경도' }[k])).join('·') + ')').join(', ') : '지금과 같음');
    }
    out.next.teams = tch;
    const ign = sheets.filter((x) => !Object.values(SHEET).includes(norm(x.name))).map((x) => x.name);
    if (ign.length) out.ignored = ign;
    // 다른 해 서식은 받지 않는다(날짜가 모두 그 해라, 지금 해에 반영하면 저장도 그 해로 섞인다) — 위쪽 연도 칸에서 그 해로 바꾼 뒤 올린다
    if (year !== S.seasonYear()) rs.errors.unshift({ loc: SHEET.season + ' · 시즌 연도', why: '이 파일은 ' + year + ' 시즌 서식입니다. 지금은 ' + S.seasonYear() + ' 시즌입니다 — 위쪽 「' + S.seasonYear() + ' 시즌 ▾」에서 ' + year + ' 시즌으로 바꾼 뒤 올려 주세요.' });
    out.errors = out.sheets.reduce((a, x) => a + x.errors.length, 0);
    return out;
  };

  // ───────── 반영 (저장 한 번) ─────────
  S.calXlApply = function (res) {
    if (!res || res.errors || S.locked()) return false;
    const n = res.next, st = app().state;
    const oldCal = st.calendar;
    const ok = app().commit('엑셀 서식 반영', (s) => {
      for (const t of n.teams || []) { const i = s.teams.findIndex((x) => x.name === t.name); if (i < 0) continue; const loc = t.patch.latitude != null || t.patch.longitude != null; Object.assign(s.teams[i], t.patch); if (loc) app()._reestimate(s, [t.name]); }
      Object.assign(s.settings, { seasonYear: n.settings.seasonYear, seasonStart: n.settings.seasonStart, initialEnd: n.settings.initialEnd, seasonEnd: n.settings.seasonEnd, restWeekdays: n.settings.restWeekdays, allStarStart: n.settings.allStarStart, holidays: n.settings.holidays });
      if (n.list) {
        s.calendar = n.list.map((x, i) => { const c = { index: i, datetime: Dates.engineDatetime(x.d), consecutive: x.len, weekend: 0, holiday: 0 }; if (x.note) c.note = x.note; return c; });
        const map = new Map(s.calendar.map((c, i) => [c.datetime + '|' + c.consecutive, i]));
        s.plan.forEach((p) => { if (p.calendar < 0) return; const o = oldCal[p.calendar]; const k = o ? map.get(o.datetime + '|' + o.consecutive) : undefined; p.calendar = k == null ? -1 : k; });
      }
      if (n.events) {
        const keepIds = new Map(s.events.filter((e) => e.mode === 'STADIUM').map((e) => [e.date, e.id]));
        // 엑셀 서식에는 지정 방식이 없다: 같은 날 지정의 방식(대진까지 고정·홈 구장만)과 남은 구단의 대진은 그대로 둔다
        const keepFix = new Map(s.events.filter((e) => e.mode === 'STADIUM').map((e) => [e.date, { fix: e.fix || 'home', pairs: e.pairs }]));
        n.events = n.events.map((e) => { const k = keepFix.get(e.date) || { fix: 'home' }; const o = Object.assign({}, e, { fix: k.fix }); if (k.fix === 'pairs') o.pairs = (k.pairs || []).filter((p) => (e.teams || []).includes(p.home)); return o; });
        const drop = new Set(s.events.filter((e) => e.mode === 'STADIUM').map((e) => e.id));
        s.events = s.events.filter((e) => e.mode !== 'STADIUM').concat(n.events.map((e) => Object.assign({ id: keepIds.get(e.date) || 'ev-' + e.type.toLowerCase() + '-' + e.date }, e, { mode: 'STADIUM' })));
        const now = new Map(s.events.map((e) => [e.id, e]));
        for (const m of s.matches) if (m.eventId && drop.has(m.eventId) && (!now.has(m.eventId) || !(now.get(m.eventId).teams || []).includes(m.home))) { delete m.eventId; m.pinned = false; }
        const ch = s.events.find((e) => e.type === 'CHILDREN' && e.mode === 'STADIUM');
        if (ch && ch.teams.length === (s.teams.length >> 1)) s.settings.obligationTeams = ch.teams.slice();
      }
      for (const e of s.events) e.slot = Score.resolveEventSlot(e, s.calendar);
      S.recalcCalendar(s);
    }, ['all']);
    if (ok) {
      S.importHistory.push({ kind: 'xlsx', source: res.file || '엑셀 서식', detail: '시즌 달력에 반영 · ' + fmt.clock(new Date()) });
      S.ui.lastImport = { kind: 'xlsx', source: res.file || '엑셀 서식', sheets: '시트 ' + res.sheets.length + '개', time: fmt.clock(new Date()) };
      S.cal.day = null; S.cal.slotAt = null;
      S.toast('엑셀 서식을 달력에 반영했습니다(' + res.sheets.map((x) => x.name).join(' · ') + '). 실행 취소로 되돌릴 수 있습니다.', 'ok', 6000);
    }
    return ok;
  };

  // ───────── 확인 창 ─────────
  S.modals.calxl = function () {
    const r = S.ui.calxl;
    if (!r) return '<div class="modal narrow cx-modal" role="dialog" aria-modal="true" aria-label="엑셀 서식 확인"><div class="modal-head"><h3>' + icon('upload') + '엑셀 서식 확인</h3><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div><div class="modal-body cx-body"><p class="cx-lead">올린 파일이 없습니다. 시즌 달력 오른쪽 「채운 파일 올리기」로 다시 올려 주세요.</p></div><div class="modal-foot"><span class="sp"></span><button class="btn" data-act="close-modal">닫기</button></div></div>';
    const sec = (x) => '<section class="cx-sheet' + (x.errors.length ? ' bad' : x.warnings.length ? ' warn' : ' ok') + '"><h4>' + icon('sheet') + esc(x.name) + '<span class="muted small">' + x.rows + '줄</span>' + (x.errors.length ? S.stat('block', '오류 ' + x.errors.length) : x.warnings.length ? S.stat('warn', '확인 ' + x.warnings.length) : S.stat('ok', '문제 없음')) + '</h4>' +
      x.notes.map((t) => '<div class="cx-note">' + esc(t) + '</div>').join('') +
      x.errors.concat(x.warnings).slice(0, 8).map((e) => '<div class="cx-iss ' + (x.errors.includes(e) ? 'bad' : 'warn') + '">' + icon(x.errors.includes(e) ? 'x' : 'warn') + '<span><b>' + esc(e.loc) + '</b> ' + esc(e.why) + '</span></div>').join('') +
      (x.errors.length + x.warnings.length > 8 ? '<div class="cx-note">외 ' + (x.errors.length + x.warnings.length - 8) + '건</div>' : '') + '</section>';
    return '<div class="modal cx-modal" role="dialog" aria-modal="true" aria-labelledby="cxTitle"><div class="modal-head"><h3 id="cxTitle">' + icon('upload') + '엑셀 서식 확인 — ' + esc(r.file || '') + '</h3><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div class="modal-body cx-body"><p class="cx-lead">시트마다 읽은 내용과 확인할 것입니다. 「달력에 반영」을 누르면 한 번에 바꾸고, 실행 취소로 되돌릴 수 있습니다.' + (r.ignored ? ' 읽지 않은 시트: ' + esc(r.ignored.join(', ')) + '.' : '') + '</p>' +
      r.sheets.map(sec).join('') + '</div>' +
      '<div class="modal-foot">' + (r.errors ? S.stat('block', '오류 ' + r.errors + '건 — 파일을 고쳐 다시 올려 주세요') : S.stat('ok', '반영할 수 있습니다')) + '<span class="sp"></span><button class="btn" data-act="close-modal">닫기</button><button class="btn primary" data-act="cal-xl-apply"' + (r.errors ? ' disabled' : '') + '>' + icon('check') + '달력에 반영</button></div></div>';
  };
  /** 바이트(.xlsx) → 검사 결과를 확인 창으로 */
  S.calXlOpen = async function (bytes, file) {
    try {
      const sheets = await Xlsx.read(bytes, inflateRaw);
      const res = S.calXlParse(sheets);
      res.file = file || '';
      S.ui.calxl = res;
      S.go({ modal: 'calxl', menu: null });
      return res;
    } catch (e) {
      S.toast('파일을 읽지 못했습니다: ' + e.message, 'bad', 7000);
      return null;
    }
  };
  function upload() {
    if (S.locked()) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; f.arrayBuffer().then((b) => S.calXlOpen(new Uint8Array(b), f.name)); };
    inp.click();
  }
  Object.assign(S.actions, {
    'cal-xl-down': () => download(),
    'cal-xl-up': () => upload(),
    'cal-xl-apply': () => { if (S.calXlApply(S.ui.calxl)) { S.ui.calxl = null; S.go({ modal: null }); } }
  });
})();
