#!/usr/bin/env node
/*
 * 공통 코어 헤드리스 테스트. 사용법: node core/test/run-tests.js
 * AC-1(채점 정합성), AC-2(슬롯 생성), AC-3(시리즈 생성), AC-4(이벤트), AC-5/7(Mock 엔진),
 * AC-6(재채점·실행 취소), AC-8(재편성), AC-11(저장·가져오기) 중 DOM이 필요 없는 부분을 검증한다.
 */
const fs = require('fs');
const path = require('path');
const core = path.resolve(__dirname, '..');
for (const f of ['calendar-gen', 'preset-2025', 'score', 'reschedule', 'mock-solver', 'store', 'engine-adapter', 'svg-chart', 'svg-map', 'replay-model', 'xlsx-lite']) require(path.join(core, f + '.js'));
const K = globalThis.KBO;
const { Score, CalendarGen, Preset, Reschedule, MockSolver, Store, Engine, Chart, MapKit, ReplayModel, Xlsx } = K;

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || '단언 실패'); }
function eq(a, b, msg) { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg || '불일치') + '\n  기대: ' + sb + '\n  실제: ' + sa); }

const project = () => Preset.buildProject();

test('AC-2 슬롯 자동 생성이 input_2025.json calendar 45개와 일치 (휴일 값은 공휴일 가중치 합)', () => {
  const r = CalendarGen.generateSlots(Preset.DEFAULT_SETTINGS);
  const exp = Preset.ENGINE_INPUT_2025.calendar;
  eq(r.slots.length, 45, '슬롯 수');
  const hw = CalendarGen.holidayWeights(Preset.DEFAULT_SETTINGS);
  r.slots.forEach((s, i) => eq([s.datetime, s.consecutive, s.weekend, s.holiday], [exp[i].datetime, exp[i].consecutive, exp[i].weekend, CalendarGen.slotWeights(CalendarGen.slotDays(exp[i])[0], exp[i].consecutive, hw).holiday], '슬롯 ' + i));
  // 묶음 값 = 든 날 가중치 합: 금·토·일 2, 화·수·목 0, 어린이날 월·화·수 3 + 2, 현충일(금)·광복절(금) 2 + 토 1 + 일 1
  const at = (d) => r.slots.find((x) => x.datetime.startsWith(d)).holiday;
  eq([at('2025-03-22'), at('2025-03-25'), at('2025-03-28'), at('2025-05-05'), at('2025-06-06'), at('2025-08-15'), at('2025-07-17')], [2, 0, 2, 5, 4, 4, 2], '가중치 합');
  // 가중치는 정수로 읽어 묶음 값도 늘 정수(엔진 Calendar.holiday는 정수)
  const odd = CalendarGen.applyWeights(JSON.parse(JSON.stringify(exp)), { holidays: [{ date: '2025-05-05', weight: 2.6 }, { date: '2025-06-06', weight: '1.4' }] });
  assert(odd.every((c) => Number.isInteger(c.holiday)), '묶음 값은 정수');
  // 예전 저장 데이터(weight 없음)는 2로 읽는다
  eq(CalendarGen.slotWeights(CalendarGen.slotDays(exp[13])[0], 3, CalendarGen.holidayWeights({ holidays: [{ date: '2025-05-05', name: '어린이날' }, '2025-05-06'] })).holiday, 4, 'weight 없음 = 2');
});

test('연전 묶음이 곧 경기일: 2025 묶음 45개에서 휴식일 경기·휴식기를 만들면 지금 설정과 같다', () => {
  const set = Preset.DEFAULT_SETTINGS, cal = Preset.ENGINE_INPUT_2025.calendar;
  const d = CalendarGen.deriveRestDays(cal, set);
  eq(d.restExceptions, set.restExceptions, '휴식일 경기');
  eq(d.blackouts.map((b) => [b.start, b.end, b.label]), set.blackouts.map((b) => [b.start, b.end, b.label]), '휴식기');
  // 1차 편성 종료일 뒤(재편성 기간)는 휴식기로 만들지 않는다
  assert(d.blackouts.every((b) => b.end <= set.initialEnd), '재편성 기간 제외');
  // 묶음 하나(4/8 화~4/10 목)를 지우면 그 3일이 휴식기, 월요일에 묶음을 그리면 휴식일 경기
  const cut = cal.filter((c) => !c.datetime.startsWith('2025-04-08')).concat([{ datetime: '2025-04-14 00:00:00', consecutive: 2 }]);
  const d2 = CalendarGen.deriveRestDays(cut, set);
  assert(d2.blackouts.some((b) => b.start === '2025-04-08' && b.end === '2025-04-10'), '지운 묶음 → 휴식기');
  assert(d2.restExceptions.includes('2025-04-14'), '월요일 묶음 → 휴식일 경기');
});

test('규칙대로 채우기: 휴식 요일 공휴일(그 날 경기·목 휴식) + 올스타 휴식기(금~수) → 2025 45개 · 135일', () => {
  const set = Object.assign({}, Preset.DEFAULT_SETTINGS, { restExceptions: [], blackouts: [] });
  const rs = CalendarGen.ruleSettings(set);
  eq(rs.restExceptions, ['2025-05-05']);
  eq(rs.blackouts.map((b) => [b.start, b.end]), [['2025-05-08', '2025-05-08'], ['2025-07-11', '2025-07-16']]);
  const g = CalendarGen.generateSlots(rs).slots, exp = Preset.ENGINE_INPUT_2025.calendar;
  eq(g.length, 45); eq(CalendarGen.lengthHistogram(g), { 2: 1, 3: 43, 4: 1 });
  eq(g.reduce((a, c) => a + c.consecutive, 0), 135);
  assert(g.every((c, i) => c.datetime === exp[i].datetime && c.consecutive === exp[i].consecutive), '2025 실제 연전 기간과 같음');
  eq(CalendarGen.defaultAllStarStart(2025), '2025-07-11', '올스타 기본: 7월 둘째 금요일');
});

test('내장 공휴일: 2027·2028 음력·대체공휴일, 기본 가중치(어린이날 3 · 나머지 2)', () => {
  const y27 = CalendarGen.builtinHolidays(2027).map((h) => h.date);
  for (const d of ['2027-05-13', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11']) assert(y27.includes(d), d);
  const y28 = CalendarGen.builtinHolidays(2028).map((h) => h.date);
  for (const d of ['2028-05-02', '2028-10-02', '2028-10-03', '2028-10-04', '2028-10-05']) assert(y28.includes(d), d);
  const w = (y, d) => CalendarGen.builtinHolidays(y).find((h) => h.date === d).weight;
  eq([w(2027, '2027-05-05'), w(2027, '2027-06-06'), w(2025, '2025-05-05')], [3, 2, 3]);
});

test('엑셀(.xlsx) 쓰기·읽기: 글자·숫자·날짜·수식(계산해 둔 값), 압축 없는 파일과 엑셀처럼 압축한 파일', async () => {
  const zlib = require('zlib');
  const rows = [['번호', '시작일', '요일', '연전 수', '끝 날짜', '메모'], [1, { date: '2025-03-22' }, { f: 'CHOOSE(WEEKDAY(B2),"일","월","화","수","목","금","토")', v: '토' }, 2, { f: 'B2+D2-1', v: { date: '2025-03-23' } }, '개막 <토·일> & "2연전"'], [2, { date: '2025-03-25' }, null, 3]];
  const bytes = Xlsx.write([{ name: '연전 기간', rows, header: true, widths: [6, 12] }, { name: '빈 시트', rows: [] }]);
  const back = await Xlsx.read(bytes);
  eq(back.map((x) => x.name), ['연전 기간', '빈 시트']);
  const r = back[0].rows;
  eq(r[0], rows[0]); eq(r[1][0], 1); eq(Xlsx.serialToIso(r[1][1]), '2025-03-22'); eq(r[1][2], '토'); eq(Xlsx.serialToIso(r[1][4]), '2025-03-23'); eq(r[1][5], '개막 <토·일> & "2연전"');
  eq(r[2], [2, Xlsx.isoToSerial('2025-03-25'), null, 3], '빈 칸은 null');
  eq(Xlsx.isoToSerial('2025-03-22'), 45738, '엑셀 일련번호');
  // 엑셀이 저장한 파일처럼: 항목을 deflate로 압축하고 공유 문자열을 쓴 zip
  const ents = Xlsx.zipEntries(bytes);
  const dec = (b) => Buffer.from(b).toString('utf8');
  const files = Object.keys(ents).map((name) => ({ name, xml: dec(ents[name].data) }));
  const sh = files.find((f) => f.name === 'xl/worksheets/sheet1.xml');
  sh.xml = sh.xml.replace('<c r="A1" t="inlineStr" s="2"><is><t xml:space="preserve">번호</t></is></c>', '<c r="A1" t="s"><v>0</v></c>');
  files.push({ name: 'xl/sharedStrings.xml', xml: '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><r><t>번</t></r><r><t>호</t></r></si></sst>' });
  const deflated = deflateZip(files.map((f) => ({ name: f.name, data: Buffer.from(f.xml, 'utf8') })), zlib);
  const back2 = await Xlsx.read(deflated, (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b))));
  eq(back2[0].rows[0][0], '번호', '공유 문자열(여러 조각)'); eq(back2[0].rows[1][2], '토');
  let threw = false; try { await Xlsx.read(new Uint8Array([1, 2, 3])); } catch (e) { threw = /xlsx/.test(e.message); }
  assert(threw, 'zip이 아니면 알기 쉬운 오류');
});
function deflateZip(files, zlib) {
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), comp = zlib.deflateRawSync(f.data), crc = Xlsx.crc32(new Uint8Array(f.data));
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(4, 28);
    parts.push(lh, name, Buffer.alloc(4), comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + 4 + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat(parts.concat([cd, end])));
}

test('§5.2.1 구간 분할 규칙', () => {
  eq(CalendarGen.splitRun(6), [3, 3]); eq(CalendarGen.splitRun(9), [3, 3, 3]); eq(CalendarGen.splitRun(4), [4]);
  eq(CalendarGen.splitRun(7), [3, 4]); eq(CalendarGen.splitRun(2), [2]); eq(CalendarGen.splitRun(5), [2, 3]);
});

test('AC-3 시리즈 생성: 구단쌍 15경기, 구단 135경기, 연전 2:5/3:215/4:5, 같은 길이 완전 매칭', () => {
  const slots = CalendarGen.generateSlots(Preset.DEFAULT_SETTINGS).slots;
  const g = CalendarGen.generateSeries(Preset.ENGINE_INPUT_2025.teams, slots, { initialGamesPerPair: 15, homeGamesMajor: 9 });
  eq(g.errors, []);
  eq(CalendarGen.lengthHistogram(g.matches), { 2: 5, 3: 215, 4: 5 });
  const pair = {}, team = {};
  for (const m of g.matches) {
    const k = [m.home, m.away].sort().join('|');
    pair[k] = (pair[k] || 0) + m.consecutive;
    team[m.home] = (team[m.home] || 0) + m.consecutive; team[m.away] = (team[m.away] || 0) + m.consecutive;
  }
  eq(Object.keys(pair).length, 45); assert(Object.values(pair).every((v) => v === 15), '구단쌍 15경기');
  assert(Object.values(team).every((v) => v === 135), '구단 135경기');
  // 구성적 초기해는 H0-a~d 위반이 없어야 한다(같은 길이 시리즈가 완전 매칭을 이룬다)
  const p = project();
  p.matches = g.matches.map((m) => Object.assign({ pinned: false }, m));
  p.plan = g.plan.map((c, m) => ({ match: m, calendar: c }));
  p.events = [];
  const ex = Score.scoreProject(p);
  eq(ex.byCode['H0-a'].amount + ex.byCode['H0-c'].amount + ex.byCode['H0-d'].amount, 0, '구성적 초기해 H0-a/c/d');
});

test('AC-3 시리즈 생성: 같이 쓰는 구장(잠실 두산·LG) 홈 k연전 수 ≤ k연전 슬롯 수, 구단쌍 9:6 유지', () => {
  const slots = CalendarGen.generateSlots(Preset.DEFAULT_SETTINGS).slots;
  const g = CalendarGen.generateSeries(Preset.ENGINE_INPUT_2025.teams, slots, { initialGamesPerPair: 15, homeGamesMajor: 9 });
  eq(g.errors, []);
  const sh = CalendarGen.lengthHistogram(slots);
  const home = {};
  for (const m of g.matches) if (m.home === '두산' || m.home === 'LG') home[m.consecutive] = (home[m.consecutive] || 0) + 1;
  for (const k of Object.keys(home)) assert(home[k] <= (sh[k] || 0), k + '연전 잠실 홈 ' + home[k] + ' > 슬롯 ' + sh[k]);
  const pair = {};
  for (const m of g.matches) pair[m.home + '|' + m.away] = (pair[m.home + '|' + m.away] || 0) + m.consecutive;
  for (const k of Object.keys(pair)) { const [h, a] = k.split('|'); assert([9, 6].includes(pair[k]) && pair[k] + pair[a + '|' + h] === 15, '구단쌍 홈 나눔 ' + k + ' ' + pair[k]); }
  // 빈 프로젝트에서 자동 생성한 데이터는 사전 점검(같이 쓰는 구장 자리·연전 자리)을 통과해야 한다
  const p = project();
  p.matches = g.matches.map((m) => Object.assign({ pinned: false }, m));
  p.plan = g.plan.map((c, m) => ({ match: m, calendar: c }));
  p.events = [];
  const half = p.teams.length >> 1, mh = CalendarGen.lengthHistogram(p.matches);
  for (const k of Object.keys(mh)) assert(mh[k] <= (sh[k] || 0) * half, k + '연전 자리');
});

// ───────── 2027 시즌 원칙 ─────────
const P27 = K.Preset2027;
const OPENING_HOSTS_2027 = ['KT', '삼성', 'KIA', 'LG', 'SSG'];
const HT_A = () => CalendarGen.defaultHomeTotals(2027, Preset.ENGINE_INPUT_2025.teams, { moreTeams: OPENING_HOSTS_2027 }); // (가) 홈 73 = 개막전 홈 구단
/** 2027 기본 데이터에 홈 73/71을 바꿔 끼우고 시리즈를 원칙대로 다시 만든다 */
function project2027(ht) {
  const p = P27.buildProject();
  if (ht !== undefined) p.settings.homeTotals = ht;
  const g = CalendarGen.generateSeries(p.teams, p.calendar, CalendarGen.seriesOptions(p));
  p.matches = g.matches.map((m) => Object.assign({ pinned: false }, m));
  p.plan = g.plan.map((c, m) => ({ match: m, calendar: c }));
  return { p, g };
}
function homeByTeam(matches) { const h = {}; for (const m of matches) h[m.home] = (h[m.home] || 0) + m.consecutive; return h; }

test('휴식 요일 공휴일 경기(playOnRest): 없으면 어린이날만, false는 그대로, 켜면 그 날 경기 · 그 주 목 휴식', () => {
  eq([CalendarGen.holidayPlaysOnRest({ date: '2025-05-05', name: '어린이날·부처님오신날' }), CalendarGen.holidayPlaysOnRest({ date: '2027-08-16' }), CalendarGen.holidayPlaysOnRest('2026-05-05'), CalendarGen.holidayPlaysOnRest({ date: '2025-05-05', playOnRest: false }), CalendarGen.holidayPlaysOnRest({ date: '2027-08-16', playOnRest: true })], [true, false, true, false, true]);
  // 2025: 5/5(월)을 끄면 그 날 쉬고 목 휴식도 없다
  const off = CalendarGen.ruleSettings(Object.assign({}, Preset.DEFAULT_SETTINGS, { holidays: Preset.DEFAULT_SETTINGS.holidays.map((h) => (h.date === '2025-05-05' ? Object.assign({}, h, { playOnRest: false }) : h)) }));
  eq(off.restExceptions, []); eq(off.blackouts.map((b) => b.start), ['2025-07-11']);
  // 내장 공휴일 표도 playOnRest를 채운다
  eq(CalendarGen.builtinHolidays(2027).filter((h) => h.playOnRest).map((h) => h.date), ['2027-05-05']);
});

test('2027 규칙대로 채우기 = 첨부 일정: 45개(개막 2연전 3/27~28 · 3연전 43 · 후반기 4연전 7/15~18) · 135일 · 9/5 종료 · 올스타 7/9~14', () => {
  const set = Object.assign({}, P27.DEFAULT_SETTINGS, { restExceptions: [], blackouts: [] });
  const rs = CalendarGen.ruleSettings(set);
  eq(rs.restExceptions, [], '8/16(월) 대체공휴일 기본 경기 없음');
  eq(rs.blackouts.map((b) => [b.start, b.end, b.label]), [['2027-07-09', '2027-07-14', '올스타 휴식기']]);
  const g = CalendarGen.generateSlots(rs).slots;
  eq(g.map((c) => [c.datetime.slice(5, 10), c.consecutive]), P27.SLOTS_2027, '첨부 일정과 같은 연전 기간');
  eq(g.length, 45); eq(CalendarGen.lengthHistogram(g), { 2: 1, 3: 43, 4: 1 });
  eq(g.reduce((a, c) => a + c.consecutive, 0), 135);
  eq(K.Dates.addDays(g[44].datetime.slice(0, 10), 2), '2027-09-05', '1차 편성 종료 9/5(일)');
  eq(g.findIndex((c) => c.datetime.startsWith('2027-05-04')), 11, '어린이날 5/4~6 3연전');
  // 올스타 휴식기 길이도 설정
  eq(CalendarGen.ruleSettings(Object.assign({}, set, { allStarDays: 4 })).blackouts[0].end, '2027-07-12');
  // 8/16을 켜면 그 날 경기 · 8/19(목) 휴식
  const on = CalendarGen.ruleSettings(Object.assign({}, set, { holidays: set.holidays.map((h) => (h.date === '2027-08-16' ? Object.assign({}, h, { playOnRest: true }) : h)) }));
  eq(on.restExceptions, ['2027-08-16']); assert(on.blackouts.some((b) => b.start === '2027-08-19'), '8/19 휴식');
  // 묶음에서 만든 휴식기·휴식일 경기 = 기본 설정
  const d = CalendarGen.deriveRestDays(P27.calendar(), P27.DEFAULT_SETTINGS);
  eq(d.restExceptions, P27.DEFAULT_SETTINGS.restExceptions); eq(d.blackouts, P27.DEFAULT_SETTINGS.blackouts);
});

test('2027 기본 데이터: 설정 · 공휴일 가중치 · 개막전(대진 고정)·어린이날 홈 구장 지정 · 구단 정보는 2025 것', () => {
  const p = P27.buildProject();
  const s = p.settings;
  eq([s.seasonYear, s.seasonStart, s.initialEnd, s.restWeekdays, s.allStarStart, s.allStarDays, s.seriesMinLength], [2027, '2027-03-27', '2027-09-05', [1], '2027-07-09', 6, 3]);
  eq(s.holidays.find((h) => h.date === '2027-05-05').weight, 3); eq(s.holidays.find((h) => h.date === '2027-08-16').playOnRest, false);
  eq(p.calendar.length, 45); eq(p.calendar[11].holiday, 3, '어린이날 묶음 값');
  eq(p.teams.map((t) => t.name), Preset.ENGINE_INPUT_2025.teams.map((t) => t.name));
  const op = p.events.find((e) => e.type === 'OPENING'), ch = p.events.find((e) => e.type === 'CHILDREN');
  eq([op.date, op.fix, op.teams.slice().sort(), op.pairs.map((x) => x.away + '@' + x.home)], ['2027-03-27', 'pairs', OPENING_HOSTS_2027.slice().sort(), ['한화@KT', 'NC@삼성', '롯데@KIA', '키움@LG', '두산@SSG']]);
  eq([ch.date, ch.slot, ch.fix, ch.teams.slice().sort()], ['2027-05-05', 11, 'home', ['NC', '두산', '롯데', '키움', '한화'].sort()]);
  eq(s.homeTotals, P27.HOME_TOTALS_2027);
  eq(p.reschedule.start, '2027-09-06');
  // 저장소 검증·정규화를 통과
  const v = Store.validateProject(JSON.parse(JSON.stringify(p)));
  assert(v.ok, JSON.stringify(v.errors));
});

test('격년 홈 73/71 기본값: 홀수 해 한화·SSG·KT·롯데·두산, 짝수 해는 나머지 · 다음 해로 뒤집기 · 합 검사', () => {
  const teams = Preset.ENGINE_INPUT_2025.teams;
  const y27 = CalendarGen.defaultHomeTotals(2027, teams), y28 = CalendarGen.defaultHomeTotals(2028, teams);
  eq(y27.moreTeams.slice().sort(), ['KT', 'SSG', '두산', '롯데', '한화'].sort());
  eq(y28.moreTeams.slice().sort(), ['KIA', 'LG', 'NC', '삼성', '키움'].sort());
  eq(CalendarGen.flipHomeTotals(y27, teams).moreTeams, y28.moreTeams);
  eq([y27.more, y27.less], [{ total: 73, initial: 68 }, { total: 71, initial: 67 }]);
  eq(CalendarGen.defaultHomeTotals(2027, teams, { initial: false }).more, { total: 73 });
  const t = CalendarGen.homeTotalsTargets(teams, { homeTotals: y27, gamesPerPair: 16, initialGamesPerPair: 15 });
  eq(t.errors, []); eq(t.targets.find((x) => x.team === '한화'), { team: '한화', total: 73, initial: 68 });
  const bad = CalendarGen.homeTotalsTargets(teams, { homeTotals: { moreTeams: ['한화', 'SSG'], more: { total: 73 }, less: { total: 71 } }, gamesPerPair: 16 });
  assert(/리그 전체 경기 수/.test(bad.errors[0]), bad.errors[0]);
});

test('시리즈 생성(2027 원칙, 홈 73 = 개막전 홈 구단): 1차 편성 홈 68/67 · 맞대결 15(9:6, 개막 대진 8:7) · 개막 대진 → 홈 바꾼 4연전 · 잠실 겹침 없음', () => {
  const { p, g } = project2027(HT_A());
  eq(g.errors, []);
  eq(CalendarGen.lengthHistogram(g.matches), { 2: 5, 3: 215, 4: 5 });
  const home = homeByTeam(g.matches);
  for (const t of p.teams) eq(home[t.name], OPENING_HOSTS_2027.includes(t.name) ? 68 : 67, t.name + ' 1차 편성 홈');
  const pair = {};
  for (const m of g.matches) pair[m.home + '|' + m.away] = (pair[m.home + '|' + m.away] || 0) + m.consecutive;
  const op = p.events.find((e) => e.type === 'OPENING').pairs;
  for (const k of Object.keys(pair)) {
    const [h, a] = k.split('|');
    eq(pair[k] + pair[a + '|' + h], 15, '맞대결 15 ' + k);
    const isOpen = op.some((x) => (x.home === h && x.away === a) || (x.home === a && x.away === h));
    assert(isOpen ? [8, 7].includes(pair[k]) : [9, 6].includes(pair[k]), '홈 나눔 ' + k + ' ' + pair[k]);
  }
  // 개막 연전 기간 = 기본 대진, 4연전 = 같은 두 구단 홈 바꿈
  eq(g.matches.filter((m, i) => g.plan[i] === 0).map((m) => m.away + '@' + m.home).sort(), op.map((x) => x.away + '@' + x.home).sort());
  eq(g.matches.filter((m) => m.consecutive === 4).map((m) => m.home + '@' + m.away).sort(), op.map((x) => x.away + '@' + x.home).sort());
  eq(g.homeTargets.find((x) => x.team === 'KT'), { team: 'KT', initial: 68, total: 73, remaining: 5, openingHost: true });
  eq(g.homeTargets.find((x) => x.team === '한화').remaining, 4);
  // 개막 연전 말고는 3연전 이상, 잠실(두산·LG) 같은 연전 기간 홈 겹침 없음
  assert(g.matches.every((m, i) => m.consecutive >= 3 || g.plan[i] === 0), '3연전 이상');
  const jam = new Map();
  g.matches.forEach((m, i) => { if (m.home === '두산' || m.home === 'LG') jam.set(g.plan[i], (jam.get(g.plan[i]) || 0) + 1); });
  assert(Array.from(jam.values()).every((c) => c === 1), '잠실 겹침');
  eq(jam.size, 45, '잠실은 연전 기간마다 꼭 한 구단 홈(67 + 68 = 135)');
  // 구성적 초기해: H0-a/c/d 위반 없음, 개막전 대진은 고정
  p.events = p.events.filter((e) => e.type === 'OPENING');
  const ex = Score.scoreProject(p);
  eq(ex.byCode['H0-a'].amount + ex.byCode['H0-c'].amount + ex.byCode['H0-d'].amount + ex.byCode['H0-e'].amount, 0, 'H0-a/c/d/e');
});

test('시리즈 생성(2027 원칙): 맞지 않는 조합은 알기 쉬운 오류 — 홈 73 한화·SSG·KT·롯데·두산 + 개막전 홈 KT·삼성·KIA·LG·SSG, 2연전, 잠실', () => {
  const { g } = project2027(CalendarGen.defaultHomeTotals(2027, Preset.ENGINE_INPUT_2025.teams));
  eq(g.matches.length, 0);
  const e = g.errors[0];
  assert(/두산·한화·롯데은\(는\) 개막전 원정/.test(e) && /LG·삼성·KIA은\(는\) 개막전 홈/.test(e) && /개막전 홈 구단\(KT·삼성·KIA·LG·SSG\)으로 바꾸거나/.test(e), e);
  // 기본 데이터(지금 홈 73 목록)는 시리즈 없이 만들어진다
  eq(P27.buildProject().matches.length, 0);
  // 개막 연전 말고 2연전이 있으면
  const p = P27.buildProject();
  const cal = p.calendar.slice(0, 1).concat([{ datetime: '2027-03-30 00:00:00', consecutive: 2 }, { datetime: '2027-04-01 00:00:00', consecutive: 4 }], p.calendar.slice(3));
  const g2 = CalendarGen.generateSeries(p.teams, cal, Object.assign(CalendarGen.seriesOptions(p), { settings: Object.assign({}, p.settings, { homeTotals: HT_A() }) }));
  assert(/개막 연전 말고는 3연전 이상이어야 합니다: 3\/30\(화\) 2연전/.test(g2.errors[0]), g2.errors[0]);
  // 잠실 두 구단이 모두 개막전 원정
  const p3 = P27.buildProject();
  const op = p3.events.find((e) => e.type === 'OPENING');
  op.pairs = [{ home: 'KT', away: '두산' }, { home: '삼성', away: 'LG' }, { home: 'KIA', away: '롯데' }, { home: '키움', away: '한화' }, { home: 'SSG', away: 'NC' }];
  const g3 = CalendarGen.generateSeries(p3.teams, p3.calendar, Object.assign(CalendarGen.seriesOptions(p3), { settings: Object.assign({}, p3.settings, { homeTotals: CalendarGen.defaultHomeTotals(2027, p3.teams, { initial: false }) }) }));
  assert(/두산·LG이\(가\) 둘 다 개막전 원정/.test(g3.errors[0]), g3.errors[0]);
});

test('시리즈 생성(2027 원칙): 1차 편성 홈을 비우면 개막 대진에서 정함(68/67), 개막전 지정이 없어도 · 홈 구장만 지정해도', () => {
  const nb = () => CalendarGen.defaultHomeTotals(2027, Preset.ENGINE_INPUT_2025.teams, { initial: false });
  const { g } = project2027(nb());
  eq(g.errors, []);
  const h = homeByTeam(g.matches);
  for (const t of Object.keys(h)) eq(h[t], OPENING_HOSTS_2027.includes(t) ? 68 : 67, t);
  eq(g.homeTargets.filter((x) => x.remaining === 6).map((x) => x.team).sort(), ['두산', '롯데', '한화'].sort());
  // 개막전 홈 구장만 지정(fix 'home', 대진 없음): 홈 구단은 그대로, 상대는 자동
  const p = P27.buildProject();
  const op = p.events.find((e) => e.type === 'OPENING'); delete op.pairs; op.fix = 'home';
  const g2 = CalendarGen.generateSeries(p.teams, p.calendar, Object.assign(CalendarGen.seriesOptions(p), { settings: Object.assign({}, p.settings, { homeTotals: HT_A() }) }));
  eq(g2.errors, []);
  eq(g2.matches.filter((m, i) => g2.plan[i] === 0).map((m) => m.home).sort(), OPENING_HOSTS_2027.slice().sort());
  // 개막전 지정 없음: 홈 73 구단이 개막전 홈이 된다
  p.events = [];
  const g3 = CalendarGen.generateSeries(p.teams, p.calendar, Object.assign(CalendarGen.seriesOptions(p), { settings: Object.assign({}, p.settings, { homeTotals: HT_A() }) }));
  eq(g3.errors, []); eq(g3.matches.filter((m, i) => g3.plan[i] === 0).map((m) => m.home).sort(), OPENING_HOSTS_2027.slice().sort());
});

test('시리즈 생성(2027 원칙): 사용자가 바꾼 개막 대진 여러 개 — 잠실 한 구단만 개막전 홈이면 늘 성공(68/67·대진·겹침 없음), 아니면 잠실 오류', () => {
  const teams = Preset.ENGINE_INPUT_2025.teams, names = teams.map((t) => t.name), cal = P27.calendar();
  const r = MockSolver.rng(31);
  let ok = 0, err = 0;
  for (let k = 0; k < 60; k++) {
    const order = names.slice().sort(() => r() - 0.5);
    const hosts = order.slice(0, 5), vis = order.slice(5);
    const pairs = hosts.map((h, i) => ({ home: h, away: vis[i] }));
    const one = ['두산', 'LG'].filter((x) => hosts.includes(x)).length === 1;
    for (const ht of [CalendarGen.defaultHomeTotals(2027, teams, { moreTeams: hosts }), CalendarGen.defaultHomeTotals(2027, teams, { initial: false })]) {
      const g = CalendarGen.generateSeries(teams, cal, { settings: Object.assign({}, P27.DEFAULT_SETTINGS, { homeTotals: ht }), events: [{ type: 'OPENING', mode: 'STADIUM', teams: hosts, pairs, fix: 'pairs' }] });
      if (!one) { assert(/잠실종합운동장을\(를\) 같이 쓰는 두산·LG/.test(g.errors[0] || ''), JSON.stringify(pairs) + ' ' + g.errors[0]); err++; continue; } // 둘 다 개막전 홈·원정, 또는 홈 합이 경기일보다 많음
      eq(g.errors, [], JSON.stringify(pairs));
      const h = homeByTeam(g.matches);
      assert(names.every((x) => h[x] === (hosts.includes(x) ? 68 : 67)), '68/67 ' + JSON.stringify(h));
      eq(g.matches.filter((m, i) => g.plan[i] === 0).map((m) => m.away + '@' + m.home).sort(), pairs.map((x) => x.away + '@' + x.home).sort());
      const jam = new Map(); g.matches.forEach((m, i) => { if (m.home === '두산' || m.home === 'LG') jam.set(g.plan[i], (jam.get(g.plan[i]) || 0) + 1); });
      assert(Array.from(jam.values()).every((c) => c === 1), '잠실 겹침');
      ok++;
    }
  }
  assert(ok > 0 && err > 0, ok + ' / ' + err);
});

test('시리즈 생성: 2025 데이터 — homeTotals가 없으면 예전 방식 그대로, 2025 개막전 홈 구단으로 73/71 원칙도 동작', () => {
  const slots = CalendarGen.generateSlots(Preset.DEFAULT_SETTINGS).slots;
  const legacy = CalendarGen.generateSeries(Preset.ENGINE_INPUT_2025.teams, slots, { initialGamesPerPair: 15, homeGamesMajor: 9 });
  const viaOpts = CalendarGen.generateSeries(Preset.ENGINE_INPUT_2025.teams, slots, CalendarGen.seriesOptions(project()));
  eq(viaOpts.matches, legacy.matches, '설정을 넘겨도 homeTotals가 없으면 같은 결과'); eq(viaOpts.plan, legacy.plan);
  const hosts25 = ['LG', 'SSG', 'KT', '삼성', 'KIA'];
  const set = Object.assign({}, Preset.DEFAULT_SETTINGS, { homeTotals: CalendarGen.defaultHomeTotals(2025, Preset.ENGINE_INPUT_2025.teams, { moreTeams: hosts25 }) });
  const g = CalendarGen.generateSeries(Preset.ENGINE_INPUT_2025.teams, slots, { settings: set, events: project().events });
  eq(g.errors, []);
  const h = homeByTeam(g.matches);
  for (const t of Object.keys(h)) eq(h[t], hosts25.includes(t) ? 68 : 67, t);
  eq(g.matches.filter((m, i) => g.plan[i] === 0).map((m) => m.home).sort(), hosts25.slice().sort());
});

test('미편성 경기 홈: homeTotals대로(홈 73 → 미편성 홈 5, 홈 71 → 4) · 1차 편성을 비운 방식은 3~6 · 취소가 있어도 전체 홈 수 유지', () => {
  const check = (p, want) => {
    const t = Reschedule.computeTargets(p);
    assert(t.homeTotals && t.homeTotals.ok, t.homeTotals && t.homeTotals.message);
    eq(t.totals.remaining, 45);
    const rem = {}; for (const n of t.needs) rem[n.home] = (rem[n.home] || 0) + n.remaining;
    for (const tm of p.teams) eq(rem[tm.name] || 0, want(tm.name), tm.name + ' 미편성 홈');
    const home = {}; for (const g of Reschedule.computeGames(p).filter((x) => x.source === 'INITIAL')) home[g.home] = (home[g.home] || 0) + 1;
    for (const tm of p.teams) eq(home[tm.name] + (rem[tm.name] || 0), p.settings.homeTotals.moreTeams.includes(tm.name) ? 73 : 71, tm.name + ' 전체 홈');
    return t;
  };
  const a = project2027(HT_A()).p;
  check(a, (n) => (OPENING_HOSTS_2027.includes(n) ? 5 : 4));
  const b = project2027(CalendarGen.defaultHomeTotals(2027, Preset.ENGINE_INPUT_2025.teams, { initial: false })).p;
  const want = { 한화: 6, 롯데: 6, 두산: 6, SSG: 5, KT: 5, NC: 4, 키움: 4, LG: 3, 삼성: 3, KIA: 3 };
  check(b, (n) => want[n]);
  // 취소 경기는 원래 홈으로 다시 편성되므로 미편성 홈 수는 그대로
  const games = Reschedule.computeGames(a);
  for (const g of [games[10], games[300]]) Reschedule.setGameStatus(a, g, 'CANCELLED', 'RAIN');
  const t = check(a, (n) => (OPENING_HOSTS_2027.includes(n) ? 5 : 4));
  eq(Reschedule.buildUnits(t).reduce((s, u) => s + u.games, 0), 47);
  // homeTotals가 없으면(2025) 예전 규칙 그대로
  eq(Reschedule.computeTargets(project()).homeTotals, null);
});

test('저장소 정규화: 예전 저장 데이터에 새 필드 기본값(playOnRest·seriesMinLength·allStarDays·그 해 올스타 시작일), homeTotals 모양 맞춤·검증', () => {
  const old = project();
  delete old.settings.seriesMinLength; delete old.settings.allStarDays;
  old.settings.holidays = old.settings.holidays.map((h) => { const c = Object.assign({}, h); delete c.playOnRest; return c; });
  const n = Store.normalize(old);
  eq(n.settings.holidays.filter((h) => h.playOnRest).map((h) => h.date), ['2025-05-05']);
  eq([n.settings.seriesMinLength, n.settings.allStarDays, 'homeTotals' in n.settings], [3, 6, false]);
  // 2027 프로젝트에 올스타 시작일이 없으면 2025 값이 아니라 2027 기본값
  const p27 = P27.buildProject(); delete p27.settings.allStarStart;
  eq(Store.normalize(p27).settings.allStarStart, '2027-07-09');
  // homeTotals: 숫자는 정수로, 이상한 값은 지움
  const q = project(); q.settings.homeTotals = { moreTeams: ['한화', 3], more: { total: '73', initial: 68.2 }, less: { total: 71 } };
  eq(Store.normalize(q).settings.homeTotals, { moreTeams: ['한화'], more: { total: 73, initial: 68 }, less: { total: 71 } });
  q.settings.homeTotals = 'x'; assert(!('homeTotals' in Store.normalize(q).settings), '이상한 값은 지움');
  const bad = project(); bad.settings.homeTotals = { moreTeams: ['없는팀'] };
  bad.events.push({ id: 'e', type: 'OPENING', mode: 'STADIUM', stadiums: [], pairs: [{ home: 'KT', away: 'KT' }] });
  const v = Store.validateProject(bad);
  eq(v.errors.map((e) => e.path).sort(), ['events[2].pairs[0]', 'settings.homeTotals.moreTeams[0]']);
  // 2027 프로젝트 저장 → 복원 왕복
  const { p } = project2027(HT_A());
  const v2 = Store.validateProject(JSON.parse(JSON.stringify(Store.normalize(p))));
  assert(v2.ok); eq(v2.project.settings, Store.normalize(p).settings); eq(v2.project.events, Store.normalize(p).events);
});

test('AC-1 JS 채점기 = Java ScoreFormulas.evaluate (엔진 호환 모드, 골든 값)', () => {
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'golden-scores.json'), 'utf8'));
  const plans = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'plans.json'), 'utf8'));
  assert(golden.length >= 8, '골든 값 수');
  const base = Array.from(Score.planArrayFrom(project()));
  let mockCount = 0, withEmpty = 0;
  for (const g of golden) {
    const spec = plans.find((p) => p.name === g.name);
    const cal = spec.initialPlan ? base : spec.calendar.map((c) => (c === 9999 ? -1 : c));
    const p = project();
    p.settings.holidayTolerance = 1.5; // 골든 값은 엔진 상수(1.5)로 만들었다. 프리셋 기본값(1.0)과 분리
    // 골든 값은 엔진 입력 input_2025.json 그대로(휴일 등급 원본, 어린이날 구장 지정만)로 만들었다.
    // 화면의 휴일 값은 공휴일 가중치 합이고 개막전은 구장 지정이므로, 엔진 원본으로 되돌려 비교한다
    p.calendar = JSON.parse(JSON.stringify(Preset.ENGINE_INPUT_2025.calendar));
    p.events = p.events.filter((e) => e.type !== 'OPENING');
    p.settings.h0eMode = 'ENGINE';
    p.plan = cal.map((c, m) => ({ match: m, calendar: c }));
    const ctx = Score.createContext(Score.buildInput(p));
    const fast = Score.evaluate(ctx, Int32Array.from(cal), []);
    const ex = Score.explain(ctx, Int32Array.from(cal), p);
    eq(fast, g.hard.concat(g.soft), g.name + ' 고속 경로');
    eq(Score.flat(ex.score), g.hard.concat(g.soft), g.name + ' 상세 경로');
    eq(Score.scoreString(ex.score), g.score, g.name + ' 점수 문자열');
    if (g.name.startsWith('mock-')) mockCount++;
    if (ex.slotStats.some((s) => s.series === 0) && cal.some((c) => c >= 0)) withEmpty++;
  }
  assert(mockCount >= 3, 'Mock 결과 3개 이상');
  assert(withEmpty >= 1, '빈 슬롯 배정 1개 이상');
});

test('고속 경로 = 상세 경로 (무작위 3,000건, 두 H0-e 모드)', () => {
  const p = project();
  const r = MockSolver.rng(123);
  for (const mode of ['STADIUM', 'ENGINE']) {
    const ctx = Score.createContext(Score.buildInput(p, { h0eMode: mode }));
    for (let k = 0; k < 1500; k++) {
      const plan = new Int32Array(225);
      for (let m = 0; m < 225; m++) plan[m] = r() < 0.04 ? -1 : r.int(45);
      eq(Score.evaluate(ctx, plan, []), Score.flat(Score.explain(ctx, plan, p).score), mode + ' #' + k);
    }
  }
});

test('AC-4 어린이날 구장 기준/엔진 호환', () => {
  const p = project();
  const plan = Score.planArrayFrom(p);
  const slot = 13;
  const inSlot = (pred) => p.matches.findIndex((m, i) => plan[i] === slot && pred(m));
  // 두산·LG 모두 원정이 되도록: 슬롯 13의 두산 홈 시리즈를, 다른 슬롯의 같은 길이 '두산·LG 무관' 원정 시리즈와 교환
  const doosanHome = inSlot((m) => m.home === '두산');
  assert(doosanHome >= 0, '슬롯 13에 두산 홈 시리즈');
  const swapWith = p.matches.findIndex((m, i) => plan[i] !== slot && plan[i] >= 0 && m.consecutive === 3 && m.away === '두산' && m.home !== 'LG');
  const both = Int32Array.from(plan); { const t = both[doosanHome]; both[doosanHome] = both[swapWith]; both[swapWith] = t; }
  const ctxS = Score.createContext(Score.buildInput(p, { h0eMode: 'STADIUM' }));
  const exBoth = Score.explain(ctxS, both, p);
  const h0eBoth = exBoth.violations.filter((v) => v.code === 'H0-e' && v.slot === slot);
  eq(h0eBoth.length, 1, '두산·LG 모두 원정 → H0-e 1건');
  assert(/잠실/.test(h0eBoth[0].message), '잠실 위반');
  // LG 홈, 두산 원정 → 구장 기준 통과, 엔진 호환 위반 1건
  const lg = Int32Array.from(plan);
  const lgHome = p.matches.findIndex((m, i) => m.home === 'LG' && m.away === '두산' && plan[i] !== slot && m.consecutive === 3);
  { const t = lg[doosanHome]; lg[doosanHome] = lg[lgHome]; lg[lgHome] = t; }
  eq(Score.explain(ctxS, lg, p).violations.filter((v) => v.code === 'H0-e').length, 0, '구장 기준: LG 홈이면 해소');
  const ctxE = Score.createContext(Score.buildInput(p, { h0eMode: 'ENGINE' }));
  eq(Score.explain(ctxE, lg, p).violations.filter((v) => v.code === 'H0-e').length, 1, '엔진 호환: 두산 원정 1건');
});

test('NFR-3/FR-M3 상세 재채점 100ms 이내 (225 시리즈)', () => {
  const p = project();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) Score.scoreProject(p);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  assert(ms < 100, '평균 ' + ms.toFixed(1) + 'ms');
  console.log('    상세 재채점 평균 ' + ms.toFixed(2) + 'ms');
});

test('AC-5 Mock 엔진(메인 스레드 폴백): 1초 안 갱신, 중지 1초 안 종료', async () => {
  const engine = new Engine.MockEngineAdapter({ useWorker: false });
  const p = project();
  const h = engine.solve(p, { timeLimitSec: 30, unimprovedSec: 30, seed: 5, init: 'KEEP' });
  const t0 = Date.now();
  let firstBest = -1, bestCount = 0;
  await new Promise((resolve, reject) => {
    h.on('best', () => { bestCount++; if (firstBest < 0) firstBest = Date.now() - t0; });
    h.on('error', (e) => reject(new Error(e.message)));
    let stopAt = 0;
    h.on('done', (d) => {
      try {
        assert(d.reason === 'STOPPED', '종료 사유 ' + d.reason);
        assert(Date.now() - stopAt < 1000, '중지 지연 ' + (Date.now() - stopAt));
        resolve();
      } catch (e) { reject(e); }
    });
    setTimeout(() => { stopAt = Date.now(); h.stop(); }, 1200);
  });
  assert(firstBest >= 0 && firstBest < 1000, '첫 갱신 ' + firstBest + 'ms');
  assert(bestCount >= 1);
});

test('AC-7 핀 고정 시리즈는 재최적화 후에도 같은 슬롯', async () => {
  const engine = new Engine.MockEngineAdapter({ useWorker: false });
  const p = project();
  const plan = Score.planArrayFrom(p);
  const pinned = [10, 50, 100, 150, 200];
  for (const m of pinned) p.matches[m].pinned = true;
  const before = pinned.map((m) => plan[m]);
  const done = await new Promise((resolve) => engine.solve(p, { timeLimitSec: 1.5, seed: 9, init: 'SCRATCH' }).on('done', resolve));
  const after = new Map(done.plan.map((x) => [x.match, x.calendar]));
  eq(pinned.map((m) => after.get(m)), before, '핀 시리즈 슬롯');
  for (const m of p.matches.map((x, i) => i).filter((i) => p.matches[i].pinned)) eq(after.get(m), plan[m], '개막전 핀 ' + m);
});

test('AC-6 수정 후 실행 취소하면 이전 점수로 정확히 복귀 (Store)', () => {
  const st = new Store.Store({ storageKey: 't', storage: null, initial: project, autosaveMs: -1 });
  const s0 = Score.scoreString(Score.scoreProject(st.state).score);
  st.commit('이동', (s) => { s.plan[30].calendar = 7; }, { tags: ['plan'] });
  const s1 = Score.scoreString(Score.scoreProject(st.state).score);
  assert(s0 !== s1, '이동 후 점수 변화');
  st.undo();
  eq(Score.scoreString(Score.scoreProject(st.state).score), s0, '실행 취소 점수');
  st.redo();
  eq(Score.scoreString(Score.scoreProject(st.state).score), s1, '다시 실행 점수');
  for (let i = 0; i < 60; i++) st.commit('반복 ' + i, (s) => { s.plan[i].calendar = (s.plan[i].calendar + 1) % 45; });
  let n = 0; while (st.undo()) n++;
  assert(n >= 50, '실행 취소 ' + n + '단계');
});

test('AC-8 취소 3경기 기록 → 재편성 대상 48경기, 월요일 미허용이면 월요일 0건', async () => {
  const p = project();
  const games = Reschedule.computeGames(p);
  const pick = [games[30], games[400], games[650]];
  for (const g of pick) Reschedule.setGameStatus(p, g, 'CANCELLED', 'RAIN');
  const t = Reschedule.computeTargets(p);
  eq(t.totals.remaining, 45, '잔여 45'); eq(t.totals.cancelled, 3, '취소 3');
  p.reschedule.units = Reschedule.buildUnits(t);
  eq(p.reschedule.units.reduce((s, u) => s + u.games, 0), 48, '재편성 대상 48경기');
  p.reschedule.allowMonday = false;
  p.reschedule.plan = [];
  const engine = new Engine.MockEngineAdapter({ useWorker: false });
  const done = await new Promise((resolve) => engine.solve(p, { mode: 'RESCHEDULE', timeLimitSec: 2, unimprovedSec: 1, seed: 3, init: 'SCRATCH' }).on('done', resolve));
  p.reschedule.plan = done.plan;
  const ex = Reschedule.explain(p);
  const rg = Reschedule.computeGames(p).filter((g) => g.source === 'RESCHEDULE');
  const unassigned = ex.violations.filter((v) => v.code === 'RH-5');
  eq(rg.length + unassigned.reduce((s, v) => s + v.amount, 0), 48, '배정 + 미배정 = 48');
  for (const v of unassigned) assert(v.message.includes('—'), '미배정 사유');
  eq(rg.filter((g) => K.Dates.weekday(g.day) === 1).length, 0, '월요일 배정 0건');
  assert(rg.every((g) => g.date >= '2025-09-01' && g.date <= '2025-10-31'), '9~10월');
  console.log('    재편성 점수 ' + Score.scoreString(ex.score) + ', 배정 ' + rg.length + '경기');
});

test('재편성 고속 경로 = 설명 경로 (무작위 배치)', () => {
  const p = project();
  const t = Reschedule.computeTargets(p);
  p.reschedule.units = Reschedule.buildUnits(t);
  const r = MockSolver.rng(77);
  for (let k = 0; k < 200; k++) {
    p.reschedule.allowMonday = r() < 0.5;
    p.reschedule.plan = p.reschedule.units.map((u) => ({ unit: u.id, start: r() < 0.1 ? null : K.Dates.addDays('2025-09-01', r.int(58)), dh: r() < 0.2 }));
    const ex = Reschedule.explain(p);
    assert(!ex.score.mismatch, '불일치 #' + k + ' ' + JSON.stringify(ex.score));
  }
});

test('AC-11 프로젝트 내보내기 → 가져오기 동일 상태, 엔진 JSON 재가져오기 점수 동일', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const st = new Store.Store({ storageKey: 'kbo-opus:test', storage, initial: project, autosaveMs: -1 });
  st.commit('이동', (s) => { s.plan[3].calendar = 9; s.matches[7].pinned = true; });
  Reschedule.setGameStatus(st.state, Reschedule.computeGames(st.state)[5], 'CANCELLED', 'HEAT');
  st.addSnapshot('테스트');
  st.save();
  const st2 = new Store.Store({ storageKey: 'kbo-opus:test', storage, initial: project, autosaveMs: -1 });
  assert(st2.restored, '새로고침 복원');
  const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.meta.updatedAt; return c; };
  eq(strip(st2.state), strip(st.state), '복원 상태');
  const exported = st.exportProject();
  const v = Store.validateProject(JSON.parse(exported));
  assert(v.ok, JSON.stringify(v.errors));
  const a = strip(v.project); delete a.meta.exportedAt;
  eq(a, strip(st.state), '가져오기 상태');
  const engineJson = JSON.parse(Store.exportEngine(st.state));
  const ve = Store.validateProject(engineJson);
  assert(ve.ok && ve.format === 'ENGINE');
  eq(Score.flat(Score.scoreProject(ve.project).score), Score.flat(Score.scoreProject(st.state).score), '엔진 JSON 왕복 점수');
});

test('NFR-8 잘못된 JSON은 필드 단위 오류', () => {
  const bad = project();
  bad.teams[2].latitude = 'abc';
  bad.matches[4].home = '없는팀';
  bad.calendar[1].consecutive = 0;
  const v = Store.validateProject(bad);
  assert(!v.ok);
  const paths = v.errors.map((e) => e.path);
  for (const p of ['teams[2].latitude', 'matches[4].home', 'calendar[1].consecutive']) assert(paths.includes(p), p + ' 누락: ' + paths.join(', '));
});

test('저장 실패(용량 초과)에도 동작', () => {
  const storage = { getItem: () => null, setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }, removeItem: () => {} };
  const st = new Store.Store({ storageKey: 'x', storage, initial: project, autosaveMs: -1 });
  const r = st.save();
  assert(!r.ok && st.persistError === '저장 용량 초과');
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
  const st2 = new Store.Store({ storageKey: 'x', storage: throwing, initial: project, autosaveMs: -1 });
  assert(st2.state.teams.length === 10);
});

test('AC-10 사전 검색 "사직" → 사직야구장', () => {
  const r = MapKit.searchStadiums('사직');
  eq(r[0].name, '사직야구장');
  assert(MapKit.searchStadiums('대전').length >= 2, '대전 후보 여럿');
  assert(MapKit.estimateRoadKm({ latitude: 37.5, longitude: 127, stadium: 'a' }, { latitude: 35.2, longitude: 129, stadium: 'b' }, 1.25) > 300);
});

test('CSV·차트·지도 렌더 스모크', () => {
  const csv = Store.exportCSV(project());
  assert(csv.startsWith('﻿날짜,요일,원정,홈,구장,상태'));
  eq(csv.trim().split('\r\n').length, 1 + 675, 'CSV 경기 행 수');
  assert(Chart.bar({ items: [{ label: 'A', value: 3 }, { label: 'B', value: 5, flag: true }], mean: 4, band: { lo: 3, hi: 5 } }).includes('<svg'));
  assert(MapKit.render({ markers: [{ id: 'a', lat: 37.5, lon: 127, label: 'A' }] }).svg.includes('kmap-marker'));
});

// ───────── 탐색 과정 재생 모델 (제품 정의서 §4.2) ─────────
const sampleTrace = () => JSON.parse(fs.readFileSync(path.join(core, 'trace-sample.json'), 'utf8'));

test('재생 모델: 샘플 트레이스를 모두 적용하면 모든 시리즈가 슬롯에 있고 슬롯마다 5개', () => {
  const t = sampleTrace();
  const m = ReplayModel.build(t);
  eq(m.states.length, t.events.length + 1, '상태 수 = 이벤트 수 + 1');
  const last = m.states[m.n];
  assert(Array.from(last.assign).every((s) => s >= 0 && s < m.slots.length), '미배정 없음');
  const counts = m.slotCounts(m.n);
  assert(Array.from(counts).every((c) => c === 5), '슬롯마다 시리즈 5개: ' + Array.from(counts).join(','));
  // 같은 슬롯 안에서 줄(row)이 겹치지 않는다
  for (let i = 0; i <= m.n; i++) {
    const seen = new Set();
    m.states[i].assign.forEach((s, k) => { if (s < 0) return; const key = s + ':' + m.states[i].row[k]; assert(!seen.has(key), '상태 ' + i + ' 줄 겹침 ' + key); seen.add(key); });
  }
  eq(last.moves, t.events.reduce((s, e) => s + e.changes.length, 0), '누적 이동 수');
});

test('재생 모델: 마지막 점수 = 트레이스 마지막 이벤트, 시간 축 20~40초·단조 증가, 해설 문자열', () => {
  const t = sampleTrace();
  const m = ReplayModel.build(t);
  const lastEv = t.events[t.events.length - 1];
  eq(m.states[m.n].soft, lastEv.score.soft.map((v) => Math.abs(v)), '마지막 소프트 점수');
  eq(m.states[0].soft, t.initialScore.soft.map((v) => Math.abs(v)), '초기 점수');
  assert(m.durationMs >= 20000 && m.durationMs <= 40000, '재생 길이 ' + m.durationMs);
  for (let i = 1; i < m.times.length; i++) assert(m.times[i] > m.times[i - 1], '시각 단조 증가');
  eq(m.times[0], 0); assert(m.times[m.n] < m.durationMs, '마지막 이벤트 뒤 여유');
  eq(m.indexAt(0), 0); eq(m.indexAt(m.times[3]), 3); eq(m.indexAt(m.times[3] - 1), 2); eq(m.indexAt(m.durationMs), m.n);
  assert(/^시작 상태/.test(m.captions[0]) && /총 이동거리 70,198km/.test(m.captions[0]), m.captions[0]);
  assert(/^1번째 개선 · 두 날짜 사이에서 시리즈 6개 바꿔 넣음 · 구단 간 이동거리 차이 5,101 → 756/.test(m.captions[1]), m.captions[1]);
  assert(/^22번째 개선 · 시리즈 7개 돌려 넣음 · 총 이동거리 68,505 → 68,501km · /.test(m.captions[22]), m.captions[22]);
  const names = m.captions[22].split(' · ').pop().split('·');
  assert(names.length >= 2 && names.length <= 3 && names.every((n) => t.teams.some((x) => x.name === n.replace(/ 외 \d+$/, ''))), '구단명 2~3개: ' + names.join(','));
});

test('재생 모델: 마지막 상태에서 되감으면 원래 배정으로 돌아온다', () => {
  const t = sampleTrace();
  const m = ReplayModel.build(t);
  let assign = m.states[m.n].assign, row = m.states[m.n].row;
  for (let i = m.n; i >= 1; i--) {
    const r = ReplayModel.apply(m, assign, row, m.events[i - 1].changes, -1);
    assign = r.assign; row = r.row;
    eq(Array.from(assign), Array.from(m.states[i - 1].assign), '상태 ' + (i - 1) + ' 배정 복원');
  }
  const init = t.series.map((s) => m.slotIndex.get(s.slot));
  eq(Array.from(assign), init, '초기 배정');
  // 잘못된 트레이스는 설명이 있는 오류
  let err = null; try { ReplayModel.build({ teams: [] }); } catch (e) { err = e; }
  assert(err && /트레이스 형식 오류/.test(err.message), '형식 오류 메시지');
});

test('Worker 소스 생성 (팩토리 직렬화)', () => {
  const src = Engine.workerSource();
  assert(src.includes('workerMain'));
  // 소스를 새 컨텍스트에서 평가해 MockSolver가 살아나는지 확인
  const vm = require('vm');
  const sandbox = { self: { postMessage: () => {} }, setTimeout, clearTimeout, Date, Math };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert(sandbox.self.KBO.MockSolver && typeof sandbox.self.onmessage === 'function');
});

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed++; console.log('✔ ' + t.name); }
    catch (e) { failed++; console.log('✘ ' + t.name + '\n  ' + e.message.split('\n').join('\n  ')); }
  }
  console.log('\n' + passed + ' 통과, ' + failed + ' 실패');
  process.exit(failed ? 1 : 0);
})();
