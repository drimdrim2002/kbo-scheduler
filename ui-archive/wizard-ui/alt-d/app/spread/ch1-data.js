/*
 * 제1장 데이터 준비 — 시즌 데이터를 가져오고 고친다.
 * 본문: 가져오기 띠 + 절 탭(1.1 시즌 골격 · 1.2 슬롯 · 1.3 시리즈 · 1.4 이벤트 · 1.5 구단과 거리)
 * 여백: 장 요약 · 데이터 출처(시트 ↔ 표) · 선택한 행 · 점검 메모 · 다음 할 일
 */
(function () {
  'use strict';
  const SP = window.SP;
  const KBO = window.KBO;
  const { Dates, CalendarGen, MapKit } = KBO;
  const { esc, fmt } = SP;
  const app = SP.app;
  const ui = SP.ui;

  const TABS = [
    { id: 'season', label: '시즌 골격' },
    { id: 'slots', label: '슬롯' },
    { id: 'series', label: '시리즈' },
    { id: 'events', label: '이벤트' },
    { id: 'teams', label: '구단과 거리' }
  ];
  const LEADS = {
    season: '개막·종료일과 휴식 요일은 여기서만 입력하고, 공휴일·예외일·경기 없는 기간은 시트로 가져온 값을 한 건씩 고친다.',
    slots: '슬롯은 시트 \'슬롯\'에서 가져온다. 셀을 두 번 누르거나 Enter로 고치고, 행을 골라 위·아래에 삽입하거나 삭제한다.',
    series: '시리즈는 시트 \'시리즈\'에서 가져온다. 구단명은 구단 표와 같아야 하고, 연전 분포는 슬롯과 맞아야 한다.',
    events: '개막전 대진은 고정(핀)되고, 어린이날 구장 지정은 해당 구장 연고 구단의 홈 의무가 된다.',
    teams: '구단·구장·거리는 UI에서만 입력한다. 같은 구장을 쓰는 구단은 공유 구장으로 묶인다.'
  };
  const DATA_TARGETS = ['teams', 'distance', 'season', 'slots', 'series', 'events'];

  // ───────────── 공통: 날짜·구단 검증 ─────────────
  /** §4.2 날짜 셀: 2025-03-22, 2025.3.22, 2025/3/22, 3/22, 3/22(토), 엑셀 일련번호 */
  SP.parseDate = function (raw) {
    const s = String(raw == null ? '' : raw).trim().replace(/\s*\(.\)\s*$/, '');
    if (!s) return null;
    let m;
    const year = app.state.meta.season || 2025;
    const mk = (y, mo, d) => { const iso = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); const n = Dates.dayNum(iso); return Number.isFinite(n) && Dates.isoDate(n) === iso ? iso : null; };
    if ((m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/))) return mk(m[1], m[2], m[3]);
    if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})$/))) return mk(year, m[1], m[2]);
    if (/^\d{5}$/.test(s)) { const n = Number(s); const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000); return d.toISOString().slice(0, 10); }
    return null;
  };
  function lev(a, b) {
    a = a.toUpperCase(); b = b.toUpperCase();
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  }
  SP.suggestTeam = function (v) {
    const names = app.state.teams.map((t) => t.name);
    let best = null, bd = 99;
    for (const n of names) { const d = n.includes(v) || v.includes(n) ? 1 : lev(v, n); if (d < bd) { bd = d; best = n; } }
    return bd <= 2 ? best : null;
  };
  function validateTeam(v, other, label) {
    const s = String(v).trim();
    if (!s) return { error: label + '은(는) 필수입니다.' };
    const names = app.state.teams.map((t) => t.name);
    if (!names.includes(s)) {
      const sug = SP.suggestTeam(s);
      return sug ? { error: '알 수 없는 구단 \'' + s + '\' — \'' + sug + '\'인가요?', fix: sug, fixLabel: '\'' + sug + '\'(으)로 고치기' } : { error: '알 수 없는 구단 \'' + s + '\' — 구단 표의 이름을 쓰세요.' };
    }
    if (s === other) return { error: '홈과 원정이 같습니다 (\'' + s + '\').' };
    return {};
  }
  function validateLen(v) {
    const n = Number(String(v).trim());
    if (!/^\d+$/.test(String(v).trim()) || n < 2 || n > 4) return { error: '연전은 2~4 사이의 정수입니다.' };
    return {};
  }

  // ───────────── 상태 변경 (모두 실행 취소 대상) ─────────────
  function remapNotes(obj, fn) { const out = {}; for (const k of Object.keys(obj || {})) { const j = fn(Number(k)); if (j >= 0) out[j] = obj[k]; } return out; }
  const notes = (kind) => (SP.meta()[kind] || {});

  function setSlot(i, patch, label) {
    return app.commit(label || '슬롯 수정: ' + (i + 1) + '행', (s) => {
      const c = s.calendar[i];
      Object.assign(c, patch);
      if (patch.datetime || patch.consecutive) {
        const w = CalendarGen.slotWeights(Dates.dayNum(c.datetime), c.consecutive, CalendarGen.holidaySet(s.settings));
        if (patch.weekend == null) c.weekend = w.weekend;
        if (patch.holiday == null) c.holiday = w.holiday;
      }
    }, ['calendar']);
  }
  function insertSlot(i, where) {
    const st = app.state;
    const at = where === 'above' ? i : i + 1;
    const ref = st.calendar[i];
    const refDay = Dates.dayNum(ref.datetime);
    const day = where === 'above' ? refDay - 3 : refDay + ref.consecutive;
    return app.commit('슬롯 삽입: ' + (at + 1) + '행', (s) => {
      const w = CalendarGen.slotWeights(day, 3, CalendarGen.holidaySet(s.settings));
      s.calendar.splice(at, 0, { index: at, datetime: Dates.engineDatetime(day), consecutive: 3, weekend: w.weekend, holiday: w.holiday });
      s.calendar.forEach((c, k) => { c.index = k; });
      for (const p of s.plan) if (p.calendar >= at) p.calendar++;
      const sp = s.meta.spread; sp.slotNotes = remapNotes(sp.slotNotes, (k) => (k >= at ? k + 1 : k)); sp.slotNotes[at] = '새 슬롯';
    }, ['calendar', 'plan']);
  }
  function deleteSlot(i) {
    const n = app.derived().bySlot[i].length;
    return app.commit('슬롯 삭제: ' + (i + 1) + '행', (s) => {
      s.calendar.splice(i, 1);
      s.calendar.forEach((c, k) => { c.index = k; });
      for (const p of s.plan) { if (p.calendar === i) p.calendar = -1; else if (p.calendar > i) p.calendar--; }
      const sp = s.meta.spread; sp.slotNotes = remapNotes(sp.slotNotes, (k) => (k === i ? -1 : k > i ? k - 1 : k));
    }, ['calendar', 'plan']) && (n ? SP.toast('이 슬롯의 시리즈 ' + n + '개는 미배정 풀로 옮겨졌습니다.', 'warn') : true);
  }
  function setMatch(i, patch) {
    return app.commit('시리즈 수정: ' + (i + 1) + '행', (s) => { Object.assign(s.matches[i], patch); }, ['matches', 'plan']);
  }
  function insertMatch(i, where) {
    const at = where === 'above' ? i : i + 1;
    const ref = app.state.matches[i];
    return app.commit('시리즈 삽입: ' + (at + 1) + '행', (s) => {
      s.matches.splice(at, 0, { index: at, home: ref.home, away: ref.away, consecutive: 3, pinned: false });
      s.matches.forEach((m, k) => { m.index = k; });
      for (const p of s.plan) if (p.match >= at) p.match++;
      s.plan.push({ match: at, calendar: -1 });
      s.plan.sort((a, b) => a.match - b.match);
      const sp = s.meta.spread; sp.seriesNotes = remapNotes(sp.seriesNotes, (k) => (k >= at ? k + 1 : k)); sp.seriesNotes[at] = '새 시리즈 (미배정)';
    }, ['matches', 'plan']);
  }
  function deleteMatch(i) {
    if (app.state.matches[i].pinned) { SP.toast('고정(핀)된 시리즈는 삭제할 수 없습니다. 제3장에서 고정을 해제하세요.', 'warn'); return false; }
    return app.commit('시리즈 삭제: ' + (i + 1) + '행', (s) => {
      s.matches.splice(i, 1);
      s.matches.forEach((m, k) => { m.index = k; });
      s.plan = s.plan.filter((p) => p.match !== i).map((p) => ({ match: p.match > i ? p.match - 1 : p.match, calendar: p.calendar }));
      const sp = s.meta.spread; sp.seriesNotes = remapNotes(sp.seriesNotes, (k) => (k === i ? -1 : k > i ? k - 1 : k));
    }, ['matches', 'plan']);
  }
  function setNote(kind, i, v) {
    return app.commit('메모 수정', (s) => { s.meta.spread[kind] = Object.assign({}, s.meta.spread[kind]); if (v) s.meta.spread[kind][i] = v; else delete s.meta.spread[kind][i]; }, ['spread']);
  }

  // ───────────── 표 정의 ─────────────
  function slotGrid() {
    const st = app.state;
    const d = app.derived();
    const ex = d.ex;
    const nts = notes('slotNotes');
    const range = (i, startIso, len) => { const s0 = Dates.dayNum(startIso); return [s0, s0 + len - 1]; };
    const rows = st.calendar;
    function overlapMsg(i, startIso, len) {
      const [a, b] = range(i, startIso, len);
      const prev = rows[i - 1], next = rows[i + 1];
      if (prev) { const pe = Dates.dayNum(prev.datetime) + prev.consecutive - 1; if (a <= pe) return '앞 슬롯(' + fmt.md(Dates.dayNum(prev.datetime)) + '~' + fmt.md(pe) + ')과 날짜가 겹칩니다.'; }
      if (next) { const ns = Dates.dayNum(next.datetime); if (b >= ns) return '다음 슬롯(' + fmt.date(ns) + ' 시작)과 날짜가 겹칩니다.'; }
      return null;
    }
    const restWd = new Set(st.settings.restWeekdays || [1]);
    const rex = new Set(st.settings.restExceptions || []);
    function restWarn(startIso, len) {
      const s0 = Dates.dayNum(startIso);
      for (let k = 0; k < len; k++) { const dd = s0 + k; if (restWd.has(Dates.weekday(dd)) && !rex.has(Dates.isoDate(dd))) return fmt.date(dd) + '은(는) 휴식 요일입니다(휴식 예외일 아님).'; }
      return null;
    }
    return {
      id: 'slots', label: '슬롯', rows,
      cols: [
        { key: 'start', label: '시작일', req: true, edit: true, w: '120px', get: (r) => '<b>' + fmt.date(Dates.dayNum(r.datetime)) + '</b>', raw: (r) => fmt.md(Dates.dayNum(r.datetime)),
          validate: (v, i) => { const iso = SP.parseDate(v); if (!iso) return { error: '날짜 형식이 아닙니다. 예: 5/20, 2025-05-20, 5/20(화)' }; const ov = overlapMsg(i, iso, rows[i].consecutive); if (ov) return { error: ov }; const rw = restWarn(iso, rows[i].consecutive); return rw ? { warn: rw } : {}; },
          commit: (i, v) => setSlot(i, { datetime: Dates.engineDatetime(Dates.dayNum(SP.parseDate(v))) }) },
        { key: 'end', label: '종료일', w: '90px', cls: 'sp-muted', get: (r) => fmt.date(Dates.dayNum(r.datetime) + r.consecutive - 1), raw: () => '' },
        { key: 'games', label: '연전', req: true, edit: true, cls: 'sp-num', w: '56px', get: (r) => r.consecutive + '', raw: (r) => String(r.consecutive),
          validate: (v, i) => { const e = validateLen(v); if (e.error) return e; const ov = overlapMsg(i, Dates.isoDate(Dates.dayNum(rows[i].datetime)), Number(v)); return ov ? { error: ov } : {}; },
          commit: (i, v) => setSlot(i, { consecutive: Number(v) }) },
        { key: 'weekend', label: '주말', edit: true, cls: 'sp-c', w: '56px', get: (r) => (r.weekend ? '예' : '아니오'), raw: (r) => (r.weekend ? '예' : '아니오'),
          validate: (v) => (/^(1|0|y|n|예|아니오|true|false)$/i.test(String(v).trim()) ? {} : { error: '1/0, Y/N, 예/아니오, TRUE/FALSE 중 하나입니다.' }),
          commit: (i, v) => setSlot(i, { weekend: /^(1|y|예|true)$/i.test(v) ? 1 : 0 }) },
        { key: 'holiday', label: '휴일가중치', edit: true, cls: 'sp-num', w: '84px', get: (r) => r.holiday + '', raw: (r) => String(r.holiday),
          validate: (v) => (/^[0-3]$/.test(String(v).trim()) ? {} : { error: '휴일가중치는 0~3 정수입니다(주말 2, 공휴일 포함 주말 3).' }),
          commit: (i, v) => setSlot(i, { holiday: Number(v) }) },
        { key: 'note', label: '메모', edit: true, get: (r, i) => esc(nts[i] || ''), raw: (r, i) => nts[i] || '', validate: (v) => (String(v).length > 40 ? { error: '메모는 40자 이내입니다.' } : {}), commit: (i, v) => setNote('slotNotes', i, v) },
        { key: 'assigned', label: '배정', cls: 'sp-num', w: '92px', get: (r, i) => { const n = (d.bySlot[i] || []).length; const hard = ex.slotHard[i] || 0; return (hard ? '<span class="sp-ic sp-ic-bad" aria-label="위반">✖</span> ' : '') + n + ' / ' + (st.teams.length / 2) + ' 시리즈'; }, raw: () => '' }
      ],
      note: (i, r) => { const o = {}; const ov = overlapMsg(i, Dates.isoDate(Dates.dayNum(r.datetime)), r.consecutive); if (ov) o.start = ov; const rw = restWarn(Dates.isoDate(Dates.dayNum(r.datetime)), r.consecutive); if (rw && !ov) o.start = rw; return o; },
      onInsert: insertSlot, onDelete: deleteSlot, insertFocus: 'start'
    };
  }
  function seriesGrid() {
    const st = app.state;
    const d = app.derived();
    const nts = notes('seriesNotes');
    return {
      id: 'series', label: '시리즈', rows: st.matches,
      cols: [
        { key: 'home', label: '홈', req: true, edit: true, w: '110px', get: (r) => SP.team(r.home), raw: (r) => r.home, validate: (v, i) => validateTeam(v, st.matches[i].away, '홈'), commit: (i, v) => setMatch(i, { home: v }) },
        { key: 'away', label: '원정', req: true, edit: true, w: '110px', get: (r) => SP.team(r.away), raw: (r) => r.away, validate: (v, i) => validateTeam(v, st.matches[i].home, '원정'), commit: (i, v) => setMatch(i, { away: v }) },
        { key: 'games', label: '연전', req: true, edit: true, cls: 'sp-num', w: '56px', get: (r) => r.consecutive + '', raw: (r) => String(r.consecutive), validate: validateLen, commit: (i, v) => setMatch(i, { consecutive: Number(v) }) },
        { key: 'note', label: '메모', edit: true, get: (r, i) => esc(nts[i] || ''), raw: (r, i) => nts[i] || '', validate: (v) => (String(v).length > 40 ? { error: '메모는 40자 이내입니다.' } : {}), commit: (i, v) => setNote('seriesNotes', i, v) },
        { key: 'slot', label: '배정 슬롯 (결과)', w: '150px', cls: 'sp-muted', get: (r, i) => { const s = d.plan[i]; return s >= 0 ? esc(SP.slotLabel(s)) : '<span class="sp-ic sp-ic-warn">⚠</span> 미배정'; }, raw: () => '' },
        { key: 'pin', label: '고정', w: '54px', cls: 'sp-c', get: (r) => (r.pinned ? '<span title="고정(핀)">■ 고정</span>' : ''), raw: () => '' }
      ],
      onInsert: insertMatch, onDelete: deleteMatch, insertFocus: 'home'
    };
  }
  function eventGrid() {
    const st = app.state;
    const TYPE = { OPENING: '개막전', CHILDREN: '어린이날', CUSTOM: '사용자정의' };
    return {
      id: 'events', label: '이벤트', rows: st.events,
      cols: [
        { key: 'name', label: '이름', req: true, edit: true, w: '120px', get: (r) => esc(r.name), raw: (r) => r.name, validate: (v) => (String(v).trim() ? {} : { error: '이름은 필수입니다.' }), commit: (i, v) => app.updateEvent(st.events[i].id, { name: v }) },
        { key: 'type', label: '유형', w: '86px', get: (r) => esc(TYPE[r.type] || r.type), raw: () => '' },
        { key: 'date', label: '날짜', req: true, edit: true, w: '96px', get: (r) => fmt.date(Dates.dayNum(r.date)), raw: (r) => fmt.md(Dates.dayNum(r.date)),
          validate: (v) => { const iso = SP.parseDate(v); if (!iso) return { error: '날짜 형식이 아닙니다.' }; return CalendarGen.slotIndexOfDate(st.calendar, iso) < 0 ? { error: fmt.date(Dates.dayNum(iso)) + '은(는) 어느 슬롯에도 없습니다.' } : {}; },
          commit: (i, v) => { const iso = SP.parseDate(v); app.updateEvent(st.events[i].id, { date: iso, slot: CalendarGen.slotIndexOfDate(st.calendar, iso) }); } },
        { key: 'mode', label: '방식', w: '74px', get: (r) => (r.mode === 'MATCH' ? '대진' : '구장'), raw: () => '' },
        { key: 'home', label: '홈', w: '84px', get: (r) => (r.home ? SP.team(r.home) : ''), raw: () => '' },
        { key: 'away', label: '원정', w: '84px', get: (r) => (r.away ? SP.team(r.away) : ''), raw: () => '' },
        { key: 'stadiums', label: '구장', get: (r) => esc((r.stadiums || []).map((x) => x.replace(/종합운동장|야구장|돔야구장|이글스파크|NC파크/, (m) => (m === '돔야구장' ? '돔' : ''))).join(', ')), raw: () => '' }
      ],
      onInsert: (i, where) => { const ok = app.addEvent({ type: 'CUSTOM', name: '사용자 정의 이벤트', date: '2025-08-15', slot: CalendarGen.slotIndexOfDate(st.calendar, '2025-08-15'), mode: 'STADIUM', stadiums: [] }); if (ok) SP.toast('사용자 정의 이벤트를 표 끝에 추가했습니다.', 'info'); return ok ? undefined : false; },
      onDelete: (i) => app.removeEvent(st.events[i].id), editAfterInsert: false
    };
  }
  function dateGrid(id, label, list, opts) {
    return {
      id, label, rows: list,
      cols: [
        { key: 'date', label: opts.dateLabel || '날짜', req: true, edit: true, w: '100px', get: (r) => fmt.date(Dates.dayNum(opts.dateOf(r))), raw: (r) => fmt.md(Dates.dayNum(opts.dateOf(r))),
          validate: (v, i) => { const iso = SP.parseDate(v); if (!iso) return { error: '날짜 형식이 아닙니다. 예: 6/3, 2025-06-03' }; if (list.some((x, k) => k !== i && opts.dateOf(x) === iso)) return { error: '같은 날짜가 이미 있습니다.' }; return opts.extraValidate ? opts.extraValidate(iso) : {}; },
          commit: (i, v) => opts.commit(i, { date: SP.parseDate(v) }) }
      ].concat(opts.cols || []),
      onInsert: opts.onInsert, onDelete: opts.onDelete, editAfterInsert: true
    };
  }
  function settingsCommit(label, fn) { return app.commit(label, (s) => { fn(s.settings); }, ['settings']); }

  // ───────────── 본문 ─────────────
  function importBand() {
    const li = SP.meta().lastImport || {};
    return '<div class="sp-import" role="group" aria-label="가져오기">' +
      '<span class="sp-import-t">가져오기</span>' +
      SP.btn('importStart', '.xlsx 업로드', { arg: 'xlsx', kind: 'primary' }) +
      SP.btn('modal', '구글 시트 링크', { arg: 'gsheet' }) +
      '<span class="sp-vr"></span>' +
      SP.btn('mockToast', '빈 양식', { arg: '빈 양식 다운로드' }) +
      SP.btn('mockToast', '.xlsx 내보내기', { arg: '.xlsx 내보내기' }) +
      '<span class="sp-import-src">마지막 가져오기 · ' + esc(li.source || '2025 프리셋(내장)') + (li.sheets ? ' · 시트 ' + li.sheets + '개' : '') + (li.at ? ' · ' + fmt.md(li.at.slice(0, 10)) + ' ' + fmt.clock(li.at) : '') + '</span>' +
      SP.mock() + '</div>';
  }
  function undoTools() {
    const s = app.store;
    return SP.btn('undo', '↶ 실행 취소', { disabled: !s.canUndo(), title: s.canUndo() ? '되돌리기: ' + s.undoLabel() : '되돌릴 작업 없음' }) + SP.btn('redo', '↷ 다시 실행', { disabled: !s.canRedo(), title: s.canRedo() ? '다시: ' + s.redoLabel() : '' });
  }

  function mainSlots() {
    const st = app.state;
    const h = CalendarGen.lengthHistogram(st.calendar);
    return '<div class="sp-toolbar">' + SP.cap('표 1.2', '슬롯', '시트 \'슬롯\' ↔ ' + st.calendar.length + '행 · ' + Object.keys(h).sort().map((k) => k + '연전 ' + h[k]).join(' · ')) +
      '<span class="sp-grow"></span><span class="sp-toolbar-l">더블클릭·Enter 편집 · ↑↓ 이동</span>' + SP.btn('draft', '규칙으로 초안 만들기', { arg: 'slots', title: '§5.2.1 규칙(3연전 우선)으로 슬롯 초안을 만들고 미리보기로 비교' }) + '</div>' +
      SP.grid(slotGrid());
  }
  function mainSeries() {
    const st = app.state;
    const h = CalendarGen.lengthHistogram(st.matches), hs = CalendarGen.lengthHistogram(st.calendar);
    const same = Object.keys(Object.assign({}, h, hs)).every((k) => (h[k] || 0) === (hs[k] || 0) * st.teams.length / 2);
    return '<div class="sp-toolbar">' + SP.cap('표 1.3', '시리즈', '시트 \'시리즈\' ↔ ' + st.matches.length + '행 · ' + Object.keys(h).sort().map((k) => k + '연전 ' + h[k]).join(' · ') + ' · 슬롯 용량과 ' + (same ? '일치 ✔' : '불일치 ⚠')) +
      '<span class="sp-grow"></span><span class="sp-toolbar-l">더블클릭·Enter 편집 · Tab 다음 셀</span>' + SP.btn('draft', '구단쌍 규칙으로 만들기', { arg: 'series', title: 'FR-S7 구단쌍 목표 경기 수로 시리즈 초안을 만들고 미리보기로 비교' }) + '</div>' +
      SP.grid(seriesGrid());
  }
  function mainEvents() {
    return '<div class="sp-toolbar">' + SP.cap('표 1.4', '특별 이벤트', '시트 \'이벤트\' ↔ ' + app.state.events.length + '행 · 대진 지정 = 고정(핀), 구장 지정 = 홈 의무') + '</div>' + SP.grid(eventGrid());
  }
  function ribbon() {
    const st = app.state;
    const s0 = Dates.dayNum('2025-03-17'), s1 = Dates.dayNum(st.settings.seasonEnd);
    const weeks = Math.ceil((s1 - s0 + 1) / 7);
    const W = 1200, cw = W / weeks, chh = 9;
    const H = 7 * chh + 18;
    const d = app.derived();
    const hol = new Set((st.settings.holidays || []).map((x) => Dates.dayNum(x.date)));
    const blk = Dates.expandRanges(st.settings.blackouts || []);
    const rest = new Set(st.settings.restWeekdays || [1]);
    const rex = new Set((st.settings.restExceptions || []).map((x) => Dates.dayNum(x)));
    const start = Dates.dayNum(st.settings.seasonStart), iend = Dates.dayNum(st.settings.initialEnd);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="시즌 일자 띠: 경기일·휴식·경기 없는 기간·공휴일">';
    svg += '<defs><pattern id="rb-h" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#efe8da"/><line x1="0" y1="0" x2="0" y2="4" stroke="#bfb49e" stroke-width="1.5"/></pattern></defs>';
    let lastMonth = -1;
    for (let dd = s0; dd <= s1; dd++) {
      const w = Math.floor((dd - s0) / 7), wd = (Dates.weekday(dd) + 6) % 7;
      const x = w * cw, y = 14 + wd * chh;
      const mo = Dates.month(dd);
      if (mo !== lastMonth && Number(Dates.isoDate(dd).slice(8)) <= 7 && wd === 0) { svg += '<text x="' + (x + 1) + '" y="10" class="sv-tb">' + mo + '월</text><line x1="' + x + '" x2="' + x + '" y1="12" y2="' + H + '" class="sv-grid"/>'; lastMonth = mo; }
      let fill = '#fffdf8';
      if (dd < start) fill = 'none';
      else if (blk.has(dd)) fill = 'url(#rb-h)';
      else if (rest.has(Dates.weekday(dd)) && !rex.has(dd)) fill = '#e6dfd0';
      else if (d.dayToSlot.has(dd)) fill = dd > iend ? '#c9d3e2' : '#1d3557';
      else if (dd > iend) fill = '#dfe6f0';
      if (fill !== 'none') svg += '<rect x="' + (x + .5).toFixed(1) + '" y="' + y + '" width="' + (cw - 1).toFixed(1) + '" height="' + (chh - 1) + '" fill="' + fill + '"><title>' + fmt.date(dd) + '</title></rect>';
      if (hol.has(dd)) svg += '<circle cx="' + (x + cw / 2).toFixed(1) + '" cy="' + (y + chh / 2 - .5) + '" r="2.4" fill="#e9c46a" stroke="#7a4f00" stroke-width=".8"/>';
    }
    svg += '</svg>';
    return svg;
  }
  function mainSeason() {
    const st = app.state;
    const s = st.settings;
    const wdBox = [1, 2, 3, 4, 5, 6, 0].map((w) => '<label class="sp-check"><input type="checkbox" data-chg="restWd" value="' + w + '"' + ((s.restWeekdays || []).includes(w) ? ' checked' : '') + '> ' + Dates.WEEKDAY_KO[w] + '</label>').join(' ');
    const holG = dateGrid('hol', '공휴일', s.holidays, {
      dateOf: (r) => r.date,
      cols: [{ key: 'name', label: '이름', req: true, edit: true, get: (r) => esc(r.name), raw: (r) => r.name, validate: (v) => (String(v).trim() ? {} : { error: '이름은 필수입니다.' }), commit: (i, v) => settingsCommit('공휴일 이름 수정', (x) => { x.holidays[i].name = v; }) }],
      commit: (i, p) => settingsCommit('공휴일 날짜 수정', (x) => { x.holidays[i].date = p.date; x.holidays.sort((a, b) => (a.date < b.date ? -1 : 1)); }),
      onInsert: (i, where) => settingsCommit('공휴일 삽입', (x) => { const at = where === 'above' ? i : i + 1; x.holidays.splice(at, 0, { date: Dates.addDays(x.holidays[i].date, where === 'above' ? -1 : 1), name: '새 공휴일' }); }),
      onDelete: (i) => settingsCommit('공휴일 삭제', (x) => { x.holidays.splice(i, 1); })
    });
    const rexG = dateGrid('rex', '휴식 예외일', (s.restExceptions || []).map((d) => ({ date: d })), {
      dateOf: (r) => r.date,
      extraValidate: (iso) => ((s.restWeekdays || []).includes(Dates.weekday(Dates.dayNum(iso))) ? {} : { warn: '휴식 요일이 아닌 날입니다(효과 없음).' }),
      cols: [{ key: 'wd', label: '요일', w: '50px', get: (r) => SP.wd(Dates.dayNum(r.date)), raw: () => '' }],
      commit: (i, p) => settingsCommit('휴식 예외일 수정', (x) => { x.restExceptions[i] = p.date; }),
      onInsert: (i, where) => settingsCommit('휴식 예외일 삽입', (x) => { x.restExceptions.splice(where === 'above' ? i : i + 1, 0, '2025-06-02'); }),
      onDelete: (i) => settingsCommit('휴식 예외일 삭제', (x) => { x.restExceptions.splice(i, 1); })
    });
    const blkG = dateGrid('blk', '경기 없는 기간', s.blackouts, {
      dateLabel: '시작일', dateOf: (r) => r.start,
      cols: [
        { key: 'end', label: '종료일', req: true, edit: true, w: '96px', get: (r) => fmt.date(Dates.dayNum(r.end)), raw: (r) => fmt.md(Dates.dayNum(r.end)), validate: (v, i) => { const iso = SP.parseDate(v); if (!iso) return { error: '날짜 형식이 아닙니다.' }; return iso < s.blackouts[i].start ? { error: '종료일이 시작일보다 빠릅니다.' } : {}; }, commit: (i, v) => settingsCommit('경기 없는 기간 수정', (x) => { x.blackouts[i].end = SP.parseDate(v); }) },
        { key: 'label', label: '이름', req: true, edit: true, get: (r) => esc(r.label), raw: (r) => r.label, validate: (v) => (String(v).trim() ? {} : { error: '이름은 필수입니다.' }), commit: (i, v) => settingsCommit('경기 없는 기간 이름', (x) => { x.blackouts[i].label = v; }) }
      ],
      commit: (i, p) => settingsCommit('경기 없는 기간 수정', (x) => { x.blackouts[i].start = p.date; }),
      onInsert: (i, where) => settingsCommit('경기 없는 기간 삽입', (x) => { x.blackouts.splice(where === 'above' ? i : i + 1, 0, { start: '2025-08-18', end: '2025-08-18', label: '새 기간' }); }),
      onDelete: (i) => settingsCommit('경기 없는 기간 삭제', (x) => { x.blackouts.splice(i, 1); })
    });
    const slotsWarn = app.slotsOutOfDate();
    return '<div class="sp-form">' +
      '<label class="sp-field"><span>개막일</span><input class="sp-input" type="date" data-chg="seasonDate" data-arg="seasonStart" value="' + esc(s.seasonStart) + '"></label>' +
      '<label class="sp-field"><span>1차 편성 종료일</span><input class="sp-input" type="date" data-chg="seasonDate" data-arg="initialEnd" value="' + esc(s.initialEnd) + '"></label>' +
      '<label class="sp-field"><span>시즌 종료일</span><input class="sp-input" type="date" data-chg="seasonDate" data-arg="seasonEnd" value="' + esc(s.seasonEnd) + '"></label>' +
      '<div class="sp-field"><span>휴식 요일 (UI에서만 입력)</span><div class="sp-row" style="height:26px">' + wdBox + '</div></div></div>' +
      '<div class="sp-ribbon">' + SP.cap('그림 1.1', '시즌 일자 띠', slotsWarn ? '<span class="sp-ic sp-ic-warn">⚠</span> 설정이 슬롯과 다릅니다 — 1.2 슬롯에서 초안을 비교하세요' : '세로 월~일 · 가로 주') + ribbon() +
      '<div class="sp-legend"><span><i style="background:#1d3557"></i>1차 편성 경기일</span><span><i style="background:#c9d3e2"></i>재편성 기간</span><span><i style="background:#e6dfd0"></i>휴식 요일</span><span><i style="background:repeating-linear-gradient(45deg,#efe8da 0 2px,#bfb49e 2px 3px)"></i>경기 없는 기간</span><span><i style="background:#e9c46a;border-radius:50%"></i>공휴일</span></div></div>' +
      '<div class="sp-split" style="grid-template-columns:1.25fr 0.85fr 1.3fr">' +
      '<div>' + SP.cap('표 1.1a', '공휴일', '시트 \'공휴일\' · ' + s.holidays.length + '행') + SP.grid(holG) + '</div>' +
      '<div>' + SP.cap('표 1.1b', '휴식 예외일', '시트 \'휴식예외일\'') + SP.grid(rexG) + '</div>' +
      '<div>' + SP.cap('표 1.1c', '경기 없는 기간', '시트 \'경기없는기간\'') + SP.grid(blkG) + '</div></div>';
  }
  SP.act.restWd = (el) => { const w = Number(el.value); settingsCommit('휴식 요일 변경', (x) => { const set = new Set(x.restWeekdays || []); if (el.checked) set.add(w); else set.delete(w); x.restWeekdays = Array.from(set).sort(); }); };
  SP.act.seasonDate = (el) => { if (!el.value) return; settingsCommit('시즌 일정 변경', (x) => { x[el.dataset.arg] = el.value; }); };

  function mainTeams() {
    const st = app.state;
    const shared = app.sharedStadiums();
    const tGrid = {
      id: 'teams', label: '구단', rows: st.teams,
      cols: [
        { key: 'name', label: '구단', w: '90px', get: (r) => SP.team(r.name), raw: () => '' },
        { key: 'stadium', label: '구장', req: true, edit: true, get: (r) => esc(r.stadium) + (shared.has(r.stadium) ? ' <span class="sp-chip sp-chip-info" title="같은 구장을 쓰는 구단">공유 구장</span>' : ''), raw: (r) => r.stadium, validate: (v) => (String(v).trim() ? {} : { error: '구장명은 필수입니다.' }), commit: (i, v) => app.updateTeam(i, { stadium: v }) },
        { key: 'lat', label: '위도', edit: true, cls: 'sp-num', w: '80px', get: (r) => Number(r.latitude).toFixed(4), raw: (r) => String(r.latitude), validate: (v) => (Number.isFinite(Number(v)) && Number(v) > 33 && Number(v) < 39 ? {} : { error: '위도는 33~39 사이 숫자입니다.' }), commit: (i, v) => app.updateTeam(i, { latitude: Number(v) }) },
        { key: 'lon', label: '경도', edit: true, cls: 'sp-num', w: '84px', get: (r) => Number(r.longitude).toFixed(4), raw: (r) => String(r.longitude), validate: (v) => (Number.isFinite(Number(v)) && Number(v) > 124 && Number(v) < 132 ? {} : { error: '경도는 124~132 사이 숫자입니다.' }), commit: (i, v) => app.updateTeam(i, { longitude: Number(v) }) },
        { key: 'km', label: '평균 거리', cls: 'sp-num', w: '84px', get: (r) => { const ds = st.distanceMatrix.filter((d) => d.from === r.name && d.to !== r.name); return fmt.km(ds.reduce((a, b) => a + b.distance, 0) / (ds.length || 1)) + 'km'; }, raw: () => '' }
      ],
      onInsert: () => { SP.toast('구단 추가·삭제는 구단 수와 엔진 상수(TEAMS_PER_DAY)가 함께 바뀌므로 시안에서는 막아 두었습니다.', 'info'); return false; },
      onDelete: () => { SP.toast('구단 삭제는 시안에서 막아 두었습니다.', 'info'); return false; }
    };
    const markers = st.teams.map((t) => ({ id: t.name, lat: t.latitude, lon: t.longitude, color: t.color, label: t.name, active: ui.row.teams != null && st.teams[ui.row.teams] === t, draggable: SP.on('T4') }));
    const map = MapKit.render({ width: 300, markers, grid: false, title: '구장 위치' }).svg;
    let heat = '';
    if (SP.on('T7')) {
      const names = st.teams.map((t) => t.name);
      const dm = new Map(st.distanceMatrix.map((d) => [d.from + '|' + d.to, d]));
      const max = Math.max(...st.distanceMatrix.map((d) => d.distance));
      let t = '<table class="sp-table sp-heat" style="font-size:10px"><thead><tr><th></th>' + names.map((n) => '<th class="sp-num">' + esc(n) + '</th>').join('') + '</tr></thead><tbody>';
      for (const a of names) {
        t += '<tr><th scope="row" style="font-size:10px">' + esc(a) + '</th>';
        for (const b of names) { const d = dm.get(a + '|' + b); const v = d ? d.distance : null; const k = v == null ? 0 : v / max; t += '<td class="sp-num" style="height:20px;padding:0 4px;background:rgba(29,53,87,' + (k * 0.75).toFixed(2) + ');color:' + (k > .5 ? '#fff' : 'var(--ink)') + '">' + (a === b ? '·' : v == null ? '?' : Math.round(v)) + '</td>'; }
        t += '</tr>';
      }
      t += '</tbody></table>';
      heat = '<details class="sp-heatbox"' + (ui.heatOpen ? ' open' : '') + ' data-chg="heat"><summary class="sp-link" style="text-decoration:none;cursor:pointer;font-size:12px">그림 1.3 거리 행렬 히트맵 (km) — 펼치기</summary>' + t + '<p class="sp-note-s"><label class="sp-check"><input type="checkbox" checked disabled> 대칭 편집 (A→B를 고치면 B→A도)</label></p></details>';
    }
    return '<div class="sp-split" style="grid-template-columns:minmax(0,1fr) 320px">' +
      '<div>' + SP.cap('표 1.5', '구단·구장', st.teams.length + '개 구단 · 구장 ' + new Set(st.teams.map((t) => t.stadium)).size + '개 · UI에서만 입력') + SP.grid(tGrid) + '</div>' +
      '<div style="overflow-y:auto" data-sk="teams-side">' + SP.cap('그림 1.2', '구장 위치', SP.on('T4') ? '마커를 끌어 좌표 수정 ' + SP.mock() : '내장 SVG 지도') + '<div class="sp-mapbox" style="border-top:2px solid var(--ink);background:var(--sheet)">' + map + '</div>' + heat + '</div></div>';
  }
  SP.act.heat = (el) => { ui.heatOpen = el.open; };

  // ───────────── 여백 ─────────────
  function marginData(tab) {
    const st = app.state;
    const d = app.derived();
    const pf = app.preflight();
    let b = SP.mSec('이 장의 요약', '<div class="sp-figrow"><div><b>' + st.calendar.length + '</b><span>슬롯</span></div><div><b>' + st.matches.length + '</b><span>시리즈</span></div><div><b>' + st.events.length + '</b><span>이벤트</span></div></div>' +
      '<dl class="sp-kv"><dt>1차 편성</dt><dd>' + fmt.date(st.settings.seasonStart) + ' ~ ' + fmt.date(st.settings.initialEnd) + '</dd><dt>경기 수</dt><dd>' + fmt.int(st.matches.reduce((a, m) => a + m.consecutive, 0)) + '경기</dd><dt>휴식 요일</dt><dd>' + (st.settings.restWeekdays || []).map((w) => Dates.WEEKDAY_KO[w]).join('·') + '요일</dd><dt>공휴일 · 경기 없는 기간</dt><dd>' + st.settings.holidays.length + '일 · ' + st.settings.blackouts.length + '개</dd></dl>');
    // 선택한 행
    if (tab === 'slots' && ui.row.slots != null && st.calendar[ui.row.slots]) {
      const i = ui.row.slots;
      const ms = d.bySlot[i] || [];
      b += SP.mSec('선택한 행 · 슬롯 ' + (i + 1), '<div class="sp-detail"><div class="sp-detail-t">' + esc(SP.slotRange(i)) + ' <span class="sp-chip sp-chip-muted">' + st.calendar[i].consecutive + '연전</span></div><div class="sp-detail-s">주말 ' + (st.calendar[i].weekend ? '예' : '아니오') + ' · 휴일가중치 ' + st.calendar[i].holiday + ' · 배정 ' + ms.length + '개</div>' +
        '<ul class="sp-mlist">' + ms.map((m) => '<li><span class="sp-mlist-t">' + esc(app.matchLabel(m)) + '</span>' + (st.matches[m].pinned ? '<span class="sp-muted">■ 고정</span>' : '') + '</li>').join('') + '</ul></div>');
    } else if (tab === 'series' && ui.row.series != null && st.matches[ui.row.series]) {
      const i = ui.row.series;
      const m = st.matches[i];
      const pair = st.matches.filter((x) => (x.home === m.home && x.away === m.away) || (x.home === m.away && x.away === m.home));
      const hg = pair.filter((x) => x.home === m.home).reduce((a, x) => a + x.consecutive, 0);
      const ag = pair.filter((x) => x.home === m.away).reduce((a, x) => a + x.consecutive, 0);
      b += SP.mSec('선택한 행 · 시리즈 ' + (i + 1), '<div class="sp-detail"><div class="sp-detail-t">' + SP.team(m.away) + ' <span class="sp-muted">@</span> ' + SP.team(m.home) + '</div><div class="sp-detail-s">' + m.consecutive + '연전 · ' + esc(app.team(m.home) ? app.team(m.home).stadium : '') + '</div>' +
        '<dl class="sp-kv"><dt>같은 구단쌍 시리즈</dt><dd>' + pair.length + '개</dd><dt>' + esc(m.home) + ' 홈 : ' + esc(m.away) + ' 홈</dt><dd>' + hg + ' : ' + ag + '경기</dd><dt>배정 (제3장)</dt><dd>' + (d.plan[i] >= 0 ? esc(SP.slotLabel(d.plan[i])) : '미배정') + '</dd></dl></div>');
    } else if (tab === 'teams' && ui.row.teams != null) {
      const t = st.teams[ui.row.teams];
      const near = st.distanceMatrix.filter((x) => x.from === t.name && x.to !== t.name).sort((a, b) => a.distance - b.distance);
      b += SP.mSec('선택한 구단 · ' + esc(t.name), '<div class="sp-detail"><div class="sp-detail-t">' + SP.team(t.name) + '</div><div class="sp-detail-s">' + esc(t.stadium) + '</div><ul class="sp-mlist">' + near.slice(0, 4).map((x) => '<li><span class="sp-mlist-t">' + esc(x.to) + '</span><span class="sp-num">' + fmt.km(x.distance) + 'km</span></li>').join('') + '<li><span class="sp-mlist-t sp-muted">가장 먼 구단 · ' + esc(near[near.length - 1].to) + '</span><span class="sp-num">' + fmt.km(near[near.length - 1].distance) + 'km</span></li></ul></div>');
    }
    // 점검 메모
    const targets = tab === 'teams' ? ['teams', 'distance'] : tab === 'season' ? ['season', 'slots'] : [tab];
    const items = pf.items.filter((x) => targets.includes(x.target));
    const evc = tab === 'events' ? app.checkEvents() : [];
    b += SP.mSec('점검 메모', '<ul class="sp-mlist">' + (items.length ? items.map((x) => '<li>' + SP.icon(x.status) + '<span class="sp-mlist-t"><b>' + esc(x.title) + '</b> — ' + esc(x.detail) + '</span></li>').join('') : '<li><span class="sp-mlist-t sp-muted">이 절에 해당하는 사전 점검 항목이 없습니다.</span></li>') +
      evc.map((x) => '<li>' + SP.icon(x.level === 'block' ? 'block' : 'warn') + '<span class="sp-mlist-t">' + esc(x.message) + '</span></li>').join('') + '</ul>', { right: '사전 점검 기준' });
    // 데이터 출처
    b += SP.mSec('시트 ↔ 표', '<ul class="sp-mlist">' +
      [['슬롯', '표 1.2', 'slots'], ['시리즈', '표 1.3', 'series'], ['공휴일 · 휴식예외일 · 경기없는기간', '표 1.1', 'season'], ['이벤트', '표 1.4', 'events']].map((r) => '<li><span class="sp-mlist-t">\'' + r[0] + '\'</span><button class="sp-link" data-act="tab" data-arg="' + r[2] + '">' + r[1] + '</button></li>').join('') +
      '<li><span class="sp-mlist-t sp-muted">구단·구장·거리 — UI에서만 입력 (표 1.5)</span></li></ul>');
    const dataItems = pf.items.filter((x) => DATA_TARGETS.includes(x.target));
    const nb = dataItems.filter((x) => x.status === 'block').length, nw = dataItems.filter((x) => x.status === 'warn').length;
    const next = '<p>' + (nb ? '⛔ 차단 ' + nb + '건을 먼저 고칩니다.' : nw ? '⚠ 경고 ' + nw + '건을 확인하고 사전 점검으로 넘어갑니다.' : '입력을 마쳤으면 장을 확정하고 사전 점검으로 넘어갑니다.') + '</p>' + SP.btn('go', '제2장 사전 점검 열기 ▶', { arg: '2:check', kind: 'primary' });
    return { body: b, next };
  }

  // ───────────── 장 정의 ─────────────
  SP.chapters[1] = {
    n: 1, id: 'data', title: '데이터 준비', task: '시즌 데이터를 가져오고 고친다', tabs: TABS,
    summary() { const st = app.state; return st.calendar.length + ' 슬롯 · ' + st.matches.length + ' 시리즈 · 이벤트 ' + st.events.length; },
    card() { const st = app.state; return st.calendar.length + ' 슬롯 · ' + st.matches.length + ' 시리즈 · 이벤트 ' + st.events.length + ' · ' + fmt.date(st.settings.seasonStart) + ' 개막'; },
    status() {
      const items = app.preflight().items.filter((x) => DATA_TARGETS.includes(x.target));
      const nb = items.filter((x) => x.status === 'block').length, nw = items.filter((x) => x.status === 'warn').length;
      if (nb) return { kind: 'block', text: '차단 ' + nb, short: '차단 ' + nb };
      if (nw) return { kind: 'warn', text: '경고 ' + nw, short: '경고 ' + nw };
      return { kind: 'draft', text: '작성 중', short: '작성 중' };
    },
    main(tab) {
      const body = tab === 'season' ? mainSeason() : tab === 'series' ? mainSeries() : tab === 'events' ? mainEvents() : tab === 'teams' ? mainTeams() : mainSlots();
      return SP.subhead(1, TABS, tab, undoTools(), LEADS[tab]) + importBand() + '<div class="sp-body">' + body + '</div>';
    },
    margin: marginData
  };
  SP.undoTools = undoTools;
})();
