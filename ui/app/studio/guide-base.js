/*
 * 편성 스튜디오 — ① 데이터 준비 입력 안내: 공통 바탕
 * 안내 내용(할 일 9개), 할 일마다 데이터로 판단하는 상태, 저장, 렌더 뒤 고리.
 * 보여 주는 방식(단계별 화면 등)은 guide-*.js가 S.guideUI로 정한다.
 *
 * 할 일 순서는 「새로 입력」과 「기존 데이터 보기」가 같다:
 *   구단과 거리(구장이 바뀌었는지 먼저 확인) → 시즌 기본 설정 → 공휴일 → 휴식일 경기 → 휴식기 → 연전 기간(자동 채우기) → 시리즈(자동 채우기) → 특별 경기(개막전·어린이날) → 다음 단계.
 * 구단과 거리가 맨 앞인 이유: 다른 단계가 이 표에 기대지 않아 어디에 두어도 되고, 가장 이해하기 쉬운 정보라 시작으로 알맞다.
 *   구장이 바뀌는 해(잠실 공사 등)에는 거리가 달라지므로 시리즈·공정성보다 먼저 고쳐야 한다.
 * 공휴일·휴식일 경기·휴식기는 표가 셋이라 「한 화면에 하나」를 지키기 위해 세 할 일로 나눴다(각각 표 하나, 설명 한 줄, 단추 하나).
 * 할 일마다: title·why(왜) · how(새로 입력할 때 하는 법) · view(기존 데이터에 무엇이 들어 있는지) · edit(바꿀 거면 어디서) · acts(누를 단추) · status(데이터로 판단).
 * 문구는 함수여도 되고 글자여도 된다. S.gtxt()로 읽는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO } = S;
  const { CalendarGen, Dates } = KBO;
  const app = () => S.app;
  const blank = () => S.isBlank();
  S.gtxt = (x) => (typeof x === 'function' ? x() : (x == null ? '' : String(x)));

  // ───────── 상태 판단 (데이터로) ─────────
  function sheetErrors(key) {
    const sh = S.SHEETS[key], st = app().state;
    const n = sh.rows(st).length;
    let e = 0, w = 0;
    for (let i = 0; i < n; i++) for (const x of sh.rowIssues(st, i)) { if (x.level === 'error') e++; else w++; }
    return { e, w };
  }
  S.guideSheetErrors = sheetErrors;
  /** 연전 수 맞추기: 연전 수(2·3·4)마다 「기간 수 × 구장 수」와 시리즈 수가 같은지 */
  S.guideBalance = function () {
    const st = app().state, half = st.teams.length >> 1;
    const sh = CalendarGen.lengthHistogram(st.calendar), mh = CalendarGen.lengthHistogram(st.matches);
    const off = [];
    for (const k of [2, 3, 4]) { const cap = (sh[k] || 0) * half, need = mh[k] || 0; if (cap !== need) off.push(k + '연전'); }
    return off;
  };
  function pairOff() {
    const st = app().state, target = st.settings.initialGamesPerPair;
    const names = st.teams.map((t) => t.name);
    const c = S.viz.pairCounts(st.matches, names);
    let off = 0;
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if ((c.get(names[i] + '|' + names[j]) || 0) + (c.get(names[j] + '|' + names[i]) || 0) !== target) off++;
    return off;
  }
  S.guidePairOff = pairOff;
  /** 상태: ok(됨) · todo(아직 안 함, 빈 상태에서 다음에 할 일) · warn(확인·고칠 곳) */
  const res = (kind, text) => ({ ok: kind === 'ok', kind, text, todo: kind === 'todo' });
  const seasonOK = () => { const s = app().state.settings; return !!(s.seasonStart && s.initialEnd && s.seasonEnd) && s.seasonStart < s.initialEnd && s.initialEnd <= s.seasonEnd && s.restWeekdays.length > 0; };
  S.guideSeasonOK = seasonOK;

  // ───────── 안내 내용 ─────────
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const half = () => app().state.teams.length >> 1;
  const set = () => app().state.settings;
  const pairText = () => { const s = set(); return s.initialGamesPerPair + '경기(홈 ' + s.homeGamesMajor + ' · 원정 ' + (s.initialGamesPerPair - s.homeGamesMajor) + ')'; };
  const needDays = () => S.gameDaysCheck().need;
  const d = (iso) => (iso ? S.fmt.date(iso) : '아직 없음');
  const sd = (iso) => (iso ? S.fmt.short(iso) : '');
  const list = (arr, n) => (arr.length ? arr.slice(0, n).join(', ') + (arr.length > n ? ' 외 ' + (arr.length - n) + '개' : '') : '없음');
  const gameDays = () => { const s = set(); if (!s.seasonStart || !s.initialEnd) return null; return S.gameDaysCheck(CalendarGen.generateSlots(s).slots); };
  const restDays = () => (set().restWeekdays.length ? set().restWeekdays.map((k) => WD[k] + '요일').join('·') : '없음');
  S.GUIDE_TASKS = [
    {
      id: 'teams', tab: 'teams', title: '구단과 거리', short: '구장이 바뀌었는지 먼저 확인',
      why: '구단과 구장 위치, 구장 사이 거리입니다. 이동거리는 이 표로 계산합니다. 구장이 바뀌는 해(예: 잠실 공사로 임시 구장을 쓸 때)에는 여기부터 고쳐야 뒤의 시리즈·공정성 계산이 맞습니다. 「새로 입력」으로 비워도 남는 표입니다.',
      how: '구장이 바뀌었는지 먼저 확인합니다. 바뀐 구단이 있으면 표에서 그 구단을 누르고 이 카드에서 구단명·구장·위도·경도를 고칩니다. 위치를 바꾸면 그 구단의 거리는 직선거리로 다시 추정합니다. 그대로면 「다음」을 누릅니다.',
      view: () => { const st = app().state, sh = Array.from(app().sharedStadiums().entries()); const est = st.distanceMatrix.filter((d) => d.estimated).length; return st.teams.length + '구단 · ' + (sh.length ? '같이 쓰는 구장 ' + sh.map(([k, v]) => k + '(' + v.join('·') + ')').join(', ') : '같이 쓰는 구장 없음') + ' · 구장 간 거리 ' + st.teams.length * (st.teams.length - 1) + '개' + (est ? ' (추정 ' + est + '개)' : ''); },
      edit: '표에서 구단을 누르면 이 카드에서 구단명·구장·위도·경도를 고칩니다. 구장 위치를 바꾸면 그 구단의 거리는 직선거리로 다시 추정합니다. 아래 「구장 간 거리표」에서 거리를 확인합니다.',
      acts: () => [],
      status: () => { const st = app().state; const est = st.distanceMatrix.filter((d) => d.estimated).length; return res('ok', st.teams.length + '구단 · 같이 쓰는 구장 ' + app().sharedStadiums().size + (est ? ' · 추정 거리 ' + est + '개' : '')); }
    },
    {
      id: 'season', tab: 'season', title: '시즌 기본 설정', short: '개막일·종료일·휴식 요일',
      why: '시즌이 언제 시작하고 끝나는지, 어느 요일에 쉬는지 정합니다. 연전 기간은 이 설정대로 만들어집니다.',
      how: () => '개막일, 1차 편성 종료일, 시즌 종료일 세 칸에 날짜를 적고 Enter를 누릅니다(2025-03-22나 3/22처럼). 휴식 요일은 보통 월요일입니다. 「경기일 합」이 필요 ' + needDays() + '일과 맞아야 시리즈를 빈 자리 없이 만들 수 있습니다. 공휴일·휴식기는 다음 화면에서 넣습니다.',
      view: () => { const s = set(); const gd = gameDays(); return '개막 ' + d(s.seasonStart) + ' · 1차 편성 종료 ' + d(s.initialEnd) + ' · 시즌 종료 ' + d(s.seasonEnd) + ' · 휴식 요일 ' + restDays() + (gd ? ' · 경기일 합 ' + gd.have + '일 / 필요 ' + gd.need + '일' : ''); },
      edit: '날짜 칸을 고치고 Enter를 누르면 바로 반영됩니다. 휴식 요일은 요일 단추를 누릅니다. 날짜나 휴식 요일을 바꾸면 연전 기간 화면에서 「규칙대로 자동 채우기」로 연전 기간을 다시 만듭니다.',
      acts: () => [],
      status: () => {
        const s = set();
        if (!s.seasonStart || !s.initialEnd || !s.seasonEnd) return res('todo', '개막일·1차 편성 종료일·시즌 종료일을 적어 주세요');
        if (!seasonOK()) return res('warn', s.restWeekdays.length ? '날짜 순서를 확인하세요(개막 < 1차 종료 ≤ 시즌 종료)' : '휴식 요일을 하나 이상 고르세요');
        const gd = S.gameDaysCheck(CalendarGen.generateSlots(s).slots);
        if (!gd.ok) return res('warn', '경기일 합 ' + gd.have + '일 · 필요 ' + gd.need + '일 (' + (gd.have < gd.need ? (gd.need - gd.have) + '일 부족' : (gd.have - gd.need) + '일 많음') + ')');
        return res('ok', '개막 ' + sd(s.seasonStart) + ' · 1차 종료 ' + sd(s.initialEnd) + ' · 경기일 합 맞음');
      }
    },
    {
      id: 'holidays', tab: 'holidays', title: '공휴일', short: '단추 한 번으로 채움',
      why: '공휴일은 휴일 경기를 구단마다 고르게 나눌 때 씁니다. 어린이날·현충일·광복절 같은 날입니다.',
      how: '「법정 공휴일 채우기」를 한 번 누르면 시즌 기간의 법정 공휴일이 모두 들어옵니다. 임시 공휴일(선거일 등)만 표의 「끝에 추가」로 더합니다.',
      view: () => { const h = set().holidays; return '공휴일 ' + h.length + '일: ' + list(h.map((x) => sd(x.date) + ' ' + x.name), 5); },
      edit: '날짜·이름 칸을 두 번 눌러 고칩니다. 빠진 날은 「끝에 추가」, 시즌 기간의 법정 공휴일이 빠졌으면 「법정 공휴일 채우기」가 빠진 날만 더합니다.',
      acts: () => [{ act: 'fill-holidays', label: '법정 공휴일 채우기', icon: 'bolt', primary: true }],
      status: () => {
        const e = sheetErrors('holidays').e, h = set().holidays;
        if (e) return res('warn', '오류 ' + e + '건 — 같은 날짜가 두 번 있습니다');
        if (!h.length) return res(blank() ? 'todo' : 'warn', blank() ? '「법정 공휴일 채우기」를 누르세요' : '공휴일이 없습니다 — 휴일 경기를 고르게 나눌 수 없습니다');
        return res('ok', '공휴일 ' + h.length + '일');
      }
    },
    {
      id: 'restex', tab: 'restex', title: '휴식일 경기', short: '휴식 요일인데 경기하는 날',
      why: '휴식 요일이지만 경기를 하는 날입니다. 어린이날(5/5)이 월요일이면 여기에 적어야 그날 경기를 넣습니다. 보통 한두 줄이고, 없어도 됩니다.',
      how: '해당하는 날이 있으면 「첫 줄 추가」를 누르고 날짜 칸을 두 번 눌러 고칩니다(5/5처럼). 없으면 그냥 「다음」을 누릅니다.',
      view: () => { const r = set().restExceptions; return r.length ? '휴식일 경기 ' + r.length + '일: ' + list(r.map((x) => { const h = set().holidays.find((y) => y.date === x); return sd(x) + '(' + WD[Dates.weekday(Dates.dayNum(x))] + ')' + (h ? ' ' + h.name : ''); }), 5) : '휴식일 경기 없음 — 휴식 요일에는 경기를 하지 않습니다'; },
      edit: '날짜 칸을 두 번 눌러 고칩니다. 날을 더하려면 「끝에 추가」, 빼려면 줄을 고르고 「삭제」.',
      acts: () => [],
      status: () => {
        const e = sheetErrors('restex').e, r = set().restExceptions;
        if (e) return res('warn', '오류 ' + e + '건');
        return res('ok', r.length ? '휴식일 경기 ' + r.length + '일' : '없음 (없어도 됩니다)');
      }
    },
    {
      id: 'blackouts', tab: 'blackouts', title: '휴식기', short: '경기가 없는 기간',
      why: '올스타 휴식기처럼 경기가 없는 기간입니다. 이 기간은 연전 기간에서 빠지고, 경기일 합이 그만큼 줄어듭니다.',
      how: () => '「첫 줄 추가」를 누르고 시작일·종료일·이름 칸을 두 번 눌러 고칩니다. 하루만이면 시작일과 종료일을 같게 합니다. 경기일 합이 필요 ' + needDays() + '일보다 많으면 여기서 휴식기를 넣어 맞춥니다.',
      view: () => { const b = set().blackouts; return b.length ? '휴식기 ' + b.length + '개: ' + list(b.map((x) => sd(x.start) + (x.end !== x.start ? '~' + sd(x.end) : '') + ' ' + (x.label || '')), 4) : '휴식기 없음'; },
      edit: '시작일·종료일·이름 칸을 두 번 눌러 고칩니다. 기간을 더하려면 「끝에 추가」. 휴식기를 바꾸면 연전 기간을 「규칙대로 자동 채우기」로 다시 만듭니다.',
      acts: () => [],
      status: () => {
        const e = sheetErrors('blackouts').e, b = set().blackouts;
        if (e) return res('warn', '오류 ' + e + '건 — 시작일이 종료일보다 늦습니다');
        const gd = gameDays();
        if (gd && !gd.ok && blank()) return res('warn', '경기일 합 ' + gd.have + '일 · 필요 ' + gd.need + '일 — 휴식기로 ' + (gd.have > gd.need ? (gd.have - gd.need) + '일을 빼세요' : (gd.need - gd.have) + '일이 모자랍니다(1차 편성 종료일을 늦추세요)'));
        return res('ok', b.length ? '휴식기 ' + b.length + '개' + (gd && gd.ok ? ' · 경기일 합 맞음' : '') : '없음 (없어도 됩니다)');
      }
    },
    {
      id: 'slots', tab: 'slots', title: '연전 기간', short: '시리즈가 열리는 2~4일 묶음 — 단추로 만듦',
      why: () => '연전 기간은 ' + half() + '개 구장에서 동시에 시리즈가 열리는 2~4일 묶음입니다. 한 줄이 한 기간이고, 자동 편성은 시리즈를 이 기간에 하나씩 넣습니다.',
      how: '직접 적지 않습니다. 「규칙대로 자동 채우기」를 누르면 시즌 기본 설정(개막일·종료일·휴식 요일·휴식일 경기·휴식기)대로 연전 기간을 만들어 먼저 보여 주고, 「적용」으로 넣습니다.',
      view: () => { const c = app().state.calendar; if (!c.length) return '연전 기간이 없습니다'; const h = CalendarGen.lengthHistogram(c); const gd = S.gameDaysCheck(); return '연전 기간 ' + c.length + '개 · ' + [2, 3, 4].map((k) => k + '연전 ' + (h[k] || 0)).join(' · ') + ' · ' + sd(c[0].datetime.slice(0, 10)) + ' ~ ' + sd(Dates.isoDate(Dates.dayNum(c[c.length - 1].datetime) + c[c.length - 1].consecutive - 1)) + ' · 경기일 합 ' + gd.have + '일 / 필요 ' + gd.need + '일'; },
      edit: '줄을 고르고 시작일·연전 수 칸을 두 번 눌러 고칩니다. 시즌 기본 설정이나 휴식기를 바꿨으면 표 위 「규칙대로 자동 채우기」로 전체를 다시 만드는 쪽이 쉽습니다.',
      acts: () => [{ act: 'draft-slots', label: '규칙대로 자동 채우기', icon: 'bolt', primary: true }],
      status: () => {
        const st = app().state, e = sheetErrors('slots').e;
        if (!st.calendar.length) return res('todo', seasonOK() ? '「규칙대로 자동 채우기」를 누르세요' : '시즌 기본 설정을 먼저 적어 주세요');
        if (e) return res('warn', '오류 ' + e + '건');
        const gd = S.gameDaysCheck();
        if (!gd.ok) return res('warn', st.calendar.length + '개 · 경기일 합 ' + gd.have + '일 (필요 ' + gd.need + ')');
        const off = st.matches.length ? S.guideBalance() : [];
        if (off.length) return res('warn', off.join('·') + ' 수가 시리즈와 다름');
        return res('ok', st.calendar.length + '개 · 경기일 합 맞음' + (st.matches.length ? ' · 연전 수 맞음' : ''));
      }
    },
    {
      id: 'series', tab: 'series', title: '시리즈', short: '맞대결마다 홈·원정·연전 수 — 단추로 만듦',
      why: '시리즈는 같은 두 구단이 한 구장에서 치르는 2~4연전입니다. 홈·원정·연전 수만 있으면 되고, 날짜는 ② 자동 편성이 정합니다.',
      how: () => '「맞대결 규칙대로 자동 채우기」를 누르면 맞대결마다 ' + pairText() + '을 연전 기간 수에 맞게 나눠 ' + (half() ? half() * 2 * (half() * 2 - 1) / 2 : 0) + '쌍 모두 만들어 먼저 보여 줍니다. 「적용」 뒤 아래 「맞대결 경기 수」와 「연전 수 맞추기」가 모두 「맞음」이면 됩니다.',
      view: () => { const st = app().state; if (!st.matches.length) return '시리즈가 없습니다'; const nT = st.teams.length, pairs = nT * (nT - 1) / 2; const off = pairOff(), bal = S.guideBalance(); return '시리즈 ' + st.matches.length + '개 · 맞대결 ' + pairs + '쌍 × ' + pairText() + ' · ' + (off ? '경기 수 다른 맞대결 ' + off + '곳' : '맞대결 경기 수 맞음') + ' · ' + (bal.length ? bal.join('·') + ' 수 다름' : '연전 수 맞음'); },
      edit: '줄을 고르고 홈·원정·연전 수 칸을 두 번 눌러 고칩니다. 구단 이름이 틀리면 비슷한 이름을 찾아 바꿔 드립니다. 맞대결 경기 수를 바꿨으면 표 위 「맞대결 규칙대로 자동 채우기」로 전체를 다시 만듭니다.',
      acts: () => [{ act: 'draft-series', label: '맞대결 규칙대로 자동 채우기', icon: 'bolt', primary: true }],
      status: () => {
        const st = app().state, e = sheetErrors('series').e;
        if (!st.matches.length) return res('todo', st.calendar.length ? '「맞대결 규칙대로 자동 채우기」를 누르세요' : '연전 기간을 먼저 만들어 주세요');
        if (e) return res('warn', '오류 ' + e + '건');
        const off = pairOff(), bal = S.guideBalance();
        if (off) return res('warn', '맞대결 ' + off + '곳 경기 수 다름');
        if (bal.length) return res('warn', bal.join('·') + ' 수가 연전 기간과 다름');
        return res('ok', st.matches.length + '개 · 맞대결 경기 수 맞음 · 연전 수 맞음');
      }
    },
    {
      id: 'events', tab: 'events', title: '특별 경기', short: '개막전 대진·어린이날 구장 — 단추로 추가',
      why: '날짜를 미리 정해야 하는 경기를 적습니다. 대진 지정은 그 날짜의 대진을 고정하고, 구장 지정은 그 구장 구단이 꼭 홈 경기를 하게 합니다. 없어도 편성할 수 있습니다.',
      how: () => '「개막전 대진 추가」는 개막일 연전 기간의 ' + half() + '경기를 「대진 지정」으로 넣고 고정합니다(대진을 바꾸려면 홈·원정 칸을 고칩니다). 「어린이날 구장 지정 추가」는 5/5에 홈이어야 하는 구장을 넣습니다. 어린이날이 휴식 요일이면 먼저 「휴식일 경기」에 넣어 두어야 합니다.',
      view: () => { const ev = app().state.events; if (!ev.length) return '특별 경기 없음 — 개막전 대진·어린이날 구장을 정하지 않았습니다'; const m = ev.filter((x) => x.mode === 'MATCH'), s = ev.filter((x) => x.mode === 'STADIUM'); return '특별 경기 ' + ev.length + '개: ' + (m.length ? '대진 지정 ' + m.length + '(' + list(m.map((x) => x.name + ' ' + sd(x.date)).filter((x, i, a) => a.indexOf(x) === i), 2) + ')' : '') + (m.length && s.length ? ' · ' : '') + (s.length ? '구장 지정 ' + s.length + '(' + list(s.map((x) => x.name + ' ' + sd(x.date) + ' 구장 ' + (x.stadiums || []).length + '곳'), 2) + ')' : ''); },
      edit: '이름·날짜·홈·원정·구장 칸을 두 번 눌러 고칩니다. 날짜는 연전 기간 안에 있어야 합니다. 빠진 것은 「개막전 대진 추가」·「어린이날 구장 지정 추가」 단추나 「끝에 추가」로 넣습니다.',
      acts: () => [{ act: 'add-opening', label: '개막전 대진 추가', icon: 'bolt' }, { act: 'add-children', label: '어린이날 구장 지정 추가', icon: 'bolt' }],
      status: () => {
        const st = app().state, e = sheetErrors('events').e;
        if (e) return res('warn', '오류 ' + e + '건');
        if (!st.events.length) return res(blank() && st.matches.length ? 'todo' : 'ok', st.matches.length ? '아직 없음 — 개막전·어린이날을 단추로 추가' : '시리즈를 만든 뒤 추가합니다(없어도 됨)');
        return res('ok', st.events.length + '개 (대진 지정 ' + st.events.filter((x) => x.mode === 'MATCH').length + ' · 구장 지정 ' + st.events.filter((x) => x.mode === 'STADIUM').length + ')');
      }
    },
    {
      id: 'next', tab: null, title: '다음 단계로', short: '② 검토·실행에서 한 번 더 점검',
      why: '모두 「문제 없음」이면 다음 단계로 넘어갑니다. ② 검토·실행에서 편성할 수 없는 입력이 있는지 한 번 더 점검하고 자동 편성을 돌립니다.',
      how: '「다음: 검토·실행」을 누릅니다. 입력은 언제든 ①로 돌아와 고칠 수 있습니다.',
      view: '지금 데이터를 모두 확인했습니다. 바꿀 곳이 있으면 위 단계 번호를 눌러 그 화면으로 돌아갑니다.',
      edit: '바꿀 곳이 있으면 위 단계 번호를 눌러 돌아가거나, 「모든 표 보기」에서 표를 한꺼번에 봅니다.',
      acts: () => [{ act: 'go-step', step: 2, label: '다음: 검토·실행', icon: 'right', primary: true }],
      status: () => { const bad = S.GUIDE_TASKS.filter((t) => t.id !== 'next' && !t.status().ok); return res(bad.length ? (bad.some((t) => !t.status().todo) ? 'warn' : 'todo') : 'ok', bad.length ? bad.map((t) => t.title).join(', ') + ' 남음' : '모두 확인됨 — 다음 단계로'); }
    }
  ];
  S.guideTaskOfTab = (tab) => S.GUIDE_TASKS.find((t) => t.tab === tab) || null;
  S.guideTask = (id) => S.GUIDE_TASKS.find((t) => t.id === id) || null;
  /** 지금 할 일: 위에서부터 처음으로 「됨」이 아닌 할 일. 모두 됐으면 「다음 단계로」 */
  S.guideNext = function () {
    for (const t of S.GUIDE_TASKS) { if (t.id === 'next') continue; if (!t.status().ok) return t; }
    return S.GUIDE_TASKS[S.GUIDE_TASKS.length - 1];
  };
  /** 할 일의 단추를 HTML로. 안내 방식이 카드 안에 그대로 넣는다. */
  S.guideActButtons = function (task, cls) {
    const acts = typeof task.acts === 'function' ? task.acts() : (task.acts || []);
    return acts.map((a) => {
      const data = ' data-act="' + a.act + '"' + (a.tab ? ' data-tab="' + a.tab + '"' : '') + (a.step ? ' data-step="' + a.step + '"' : '') + (a.kind ? ' data-kind="' + a.kind + '"' : '');
      return '<button class="btn ' + (cls || 'sm') + (a.primary ? ' primary' : '') + '"' + data + '>' + (a.icon ? S.icon(a.icon) : '') + S.esc(a.label) + '</button>';
    }).join('');
  };

  // ───────── 저장 (안내 방식마다 따로) ─────────
  /** variant: 'steps' 등. 반환: { get(), set(patch), reset() } — 값은 { seen, at, mode, off, done:{} } */
  S.guideStore = function (variant) {
    const key = S.KEY + 'guide-' + variant;
    const read = () => { try { return JSON.parse(S.ls.get(key) || 'null') || {}; } catch (e) { return {}; } };
    return {
      get: () => Object.assign({ seen: false, at: 0, mode: null, off: false, done: {} }, read()),
      set(patch) { const v = Object.assign(this.get(), patch); S.ls.set(key, JSON.stringify(v)); return v; },
      reset() { S.ls.del(key); }
    };
  };

  /** 모달·서랍·메뉴가 열려 있으면 안내를 잠시 숨긴다 */
  S.guideBlocked = () => !!(S.ui.modal || S.ui.drawer || S.ui.menu || S.ui.ops);

  // ───────── 렌더 고리 ─────────
  // shell.js가 S.render 끝(스크롤 점검 전)에 S.guideAfter()를, 키 입력 때 S.guideOnKey(e)를 부른다.
  // 「처음부터 입력하기」 직후에는 S.guideOnReset()을 부른다.
  S.guideAfter = function () {
    if (!S.guideUI || !S.guideUI.after) return;
    try { S.guideUI.after(document.getElementById('guide')); } catch (e) { console.error(e); }
  };
  S.guideOnKey = (e) => (S.guideUI && S.guideUI.onKey ? S.guideUI.onKey(e) : false);
  S.guideOnReset = () => { if (S.guideUI && S.guideUI.onReset) { try { S.guideUI.onReset(); } catch (e) { console.error(e); } } };
  /** 띠의 안내 단추 (안내 방식이 정함) */
  S.guideButton = () => (S.guideUI && S.guideUI.button ? S.guideUI.button() : '');
})();
