/*
 * 편성 스튜디오 — ① 데이터 준비 입력 안내: 공통 바탕
 * 안내 내용(할 일 8개와 그 안의 짚어 줄 곳·누를 단추), 할 일마다 데이터로 판단하는 상태, 저장, 주소 키(guide=), 렌더 뒤 고리.
 * 보여 주는 방식(따라 하기·체크리스트·말풍선 등)은 guide-*.js가 S.guideUI로 정한다.
 *
 * 두 가지 출발점을 모두 안내한다.
 *  - 빈 상태(「처음부터 입력하기」 뒤, S.isBlank()): 시즌 기본 설정 → 공휴일·휴식일 경기·휴식기 → 연전 기간(자동 채우기) → 시리즈(자동 채우기)
 *    → 특별 경기(개막전·어린이날) → 구단과 거리 확인 → 다음 단계. 핵심: 직접 적는 건 날짜 몇 개, 큰 표는 단추로 만든다.
 *  - 예시 데이터(2025 실제 일정): 같은 순서로 「바꿀 곳만」 확인한다.
 * 문구는 함수여도 되고 글자여도 된다. S.gtxt()로 읽는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO } = S;
  const { CalendarGen } = KBO;
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
  /** 연전 수 맞추기: 연전 수(2·3·4)마다 「기간 수 × 구장 수」와 시리즈 수가 같은지 (오른쪽 자세히의 막대와 같은 계산) */
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
  /** 상태: ok(됨) · todo(아직 안 함, 빈 상태에서 다음에 할 일) · warn(확인·고칠 곳) */
  const res = (kind, text) => ({ ok: kind === 'ok', kind, text, todo: kind === 'todo' });
  const seasonOK = () => { const s = app().state.settings; return !!(s.seasonStart && s.initialEnd && s.seasonEnd) && s.seasonStart < s.initialEnd && s.initialEnd <= s.seasonEnd && s.restWeekdays.length > 0; };

  // ───────── 안내 내용 ─────────
  // 할 일(task)마다: title·short·why(왜 하는지)·how(빈 상태에서 하는 법)·spots(화면에서 짚어 줄 곳)·acts(누를 단추)·status(데이터로 판단)
  const half = () => app().state.teams.length >> 1;
  const set = () => app().state.settings;
  const pairText = () => { const s = set(); return s.initialGamesPerPair + '경기(홈 ' + s.homeGamesMajor + ' · 원정 ' + (s.initialGamesPerPair - s.homeGamesMajor) + ')'; };
  const needDays = () => S.gameDaysCheck().need;
  const d = (iso) => (iso ? S.fmt.date(iso) : '');
  S.GUIDE_TASKS = [
    {
      id: 'start', tab: null, title: '시작하기', short: () => (blank() ? '직접 적는 건 날짜 몇 개뿐' : '한꺼번에 가져오거나 하나씩 확인'),
      why: () => (blank() ? '빈 상태에서 시즌 정보를 위에서 아래 순서로 채웁니다. 직접 적는 것은 개막일·종료일과 공휴일 같은 날짜 몇 개뿐이고, 연전 기간·시리즈 같은 큰 표는 단추 한 번으로 만듭니다.' : '편성에 필요한 시즌 정보를 위에서 아래 순서로 채웁니다. 지금은 2025 실제 일정이 들어 있어서, 바꿀 곳만 고치면 됩니다.'),
      how: () => (blank() ? '왼쪽 목록을 위에서 아래로 따라갑니다. 엑셀 파일이 이미 있으면 「엑셀 올리기」로 한 번에 넣어도 됩니다.' : '엑셀 파일이 있으면 「엑셀 올리기」, 아니면 왼쪽 목록을 위에서 아래로 확인합니다. 빈 상태에서 처음부터 적어 보려면 「처음부터 입력하기」를 누르세요.'),
      spots: [
        { target: '.band', title: () => (blank() ? '가져오기와 처음부터 입력하기' : '엑셀로 한꺼번에 가져오기'), text: () => (blank() ? '엑셀 파일이 있으면 「엑셀 올리기」로 모든 표를 한 번에 가져옵니다. 지금은 구단과 거리만 들어 있고, 나머지는 아래 순서로 채웁니다. 2025 예시 데이터로 돌아가려면 「2025 예시 데이터 불러오기」를 누릅니다.' : '엑셀 파일이 있으면 「엑셀 올리기」로 모든 표를 한 번에 가져옵니다. 양식이 없으면 「빈 엑셀 양식」을 받아 채우세요. 표를 모두 비우고 직접 적어 보려면 「처음부터 입력하기」입니다.') },
        { target: '.pane.list', title: '입력 순서', text: () => '왼쪽 목록을 위에서 아래로 차례대로 채웁니다. 초록 체크는 문제 없음, 빨간 표시는 고칠 곳이 있다는 뜻입니다.' }
      ],
      acts: () => (blank() ? [{ act: 'import-xlsx', label: '엑셀 올리기', icon: 'upload' }] : [{ act: 'import-xlsx', label: '엑셀 올리기', icon: 'upload' }, { act: 'reset-ask', kind: 'blank', label: '처음부터 입력하기', icon: 'plus' }]),
      status: () => res('ok', blank() ? '구단과 거리만 들어 있음' : '2025 실제 일정이 들어 있음')
    },
    {
      id: 'season', tab: 'season', title: '시즌 기본 설정', short: '개막일·종료일·휴식 요일',
      why: '시즌이 언제 시작하고 끝나는지, 어느 요일에 쉬는지 정합니다. 연전 기간은 이 설정대로 만들어집니다.',
      how: () => '개막일, 1차 편성 종료일, 시즌 종료일 세 칸에 날짜를 적고 Enter를 누릅니다(2025-03-22나 3/22처럼). 휴식 요일은 보통 월요일입니다. 오른쪽 「경기일 합」이 「필요 ' + needDays() + '일」과 맞아야 시리즈를 빈 자리 없이 만들 수 있습니다.',
      spots: [
        { target: '.form-grid', title: '개막일과 종료일', text: () => '개막일, 1차 편성 종료일, 시즌 종료일을 적습니다. 2025-03-22나 3/22처럼 적으면 됩니다. 1차 편성 종료일 뒤는 취소된 경기를 다시 넣는 재편성 기간입니다.' },
        { target: '.wd', title: '휴식 요일', text: () => '경기가 없는 요일을 누릅니다. KBO는 보통 월요일에 쉽니다.' },
        { target: '.pane.insp', title: '경기일 합 맞추기', text: () => '오른쪽 「규칙대로 만든 연전 기간」에서 경기일 합이 필요 ' + needDays() + '일과 같은지 봅니다. 부족하면 1차 편성 종료일을 늦추고, 많으면 당기거나 휴식기를 넣습니다.' }
      ],
      acts: () => [],
      status: () => {
        const s = set();
        if (!s.seasonStart || !s.initialEnd || !s.seasonEnd) return res('todo', '개막일·종료일을 적어 주세요');
        if (!seasonOK()) return res('warn', s.restWeekdays.length ? '날짜 순서를 확인하세요(개막 < 1차 종료 ≤ 시즌 종료)' : '휴식 요일을 하나 이상 고르세요');
        const gd = S.gameDaysCheck(CalendarGen.generateSlots(s).slots);
        if (!gd.ok) return res('warn', '경기일 합 ' + gd.have + '일 · 필요 ' + gd.need + '일 (' + (gd.have < gd.need ? (gd.need - gd.have) + '일 부족' : (gd.have - gd.need) + '일 많음') + ')');
        return res('ok', '개막 ' + S.fmt.short(s.seasonStart) + ' · 1차 종료 ' + S.fmt.short(s.initialEnd) + ' · 경기일 합 맞음');
      }
    },
    {
      id: 'dates', tab: 'holidays', tabs: ['holidays', 'restex', 'blackouts'], title: '공휴일·휴식일 경기·휴식기', short: '쉬는 날과 특별한 날짜',
      why: '공휴일은 휴일 경기를 고르게 나눌 때 씁니다. 휴식일 경기는 휴식 요일이지만 경기를 하는 날(어린이날이 월요일일 때), 휴식기는 올스타 휴식기처럼 경기가 없는 기간입니다.',
      how: () => '공휴일은 「법정 공휴일 채우기」 한 번이면 됩니다. 휴식일 경기와 휴식기는 보통 한두 줄이라 「첫 줄 추가」로 넣고 날짜 칸을 고칩니다. 휴식기를 넣으면 경기일 합이 줄어드니 시즌 기본 설정의 「경기일 합」을 다시 봅니다.',
      spots: [
        { tab: 'holidays', target: '#sheetScroll', title: '공휴일 표', text: () => (blank() ? '「법정 공휴일 채우기」를 누르면 시즌 기간의 법정 공휴일이 한 번에 들어옵니다. 임시 공휴일만 「끝에 추가」로 더합니다.' : '공휴일(예: 6/6 현충일)을 확인합니다. 칸을 두 번 누르거나 Enter를 눌러 고칩니다.') },
        { tab: 'restex', target: '#sheetScroll', title: '휴식일 경기', text: () => '휴식 요일인데 경기를 하는 날만 적습니다. 예: 5/5(월) 어린이날. 「첫 줄 추가」를 누르고 날짜 칸을 고칩니다.' },
        { tab: 'blackouts', target: '#sheetScroll', title: '휴식기', text: () => '올스타 휴식기처럼 경기가 없는 기간입니다. 시작일·종료일·이름을 적습니다. 하루만이면 시작일과 종료일을 같게 합니다.' }
      ],
      acts: () => [{ act: 'fill-holidays', label: '법정 공휴일 채우기', icon: 'bolt' }, { act: 'd-tab', tab: 'restex', label: '휴식일 경기 표 열기', icon: 'sheet' }, { act: 'd-tab', tab: 'blackouts', label: '휴식기 표 열기', icon: 'sheet' }],
      status: () => {
        let e = 0; for (const k of ['holidays', 'restex', 'blackouts']) e += sheetErrors(k).e;
        const s = set();
        if (e) return res('warn', '오류 ' + e + '건');
        if (blank() && !s.holidays.length) return res('todo', '공휴일을 채워 주세요(단추 한 번)');
        return res('ok', '공휴일 ' + s.holidays.length + ' · 휴식일 경기 ' + s.restExceptions.length + ' · 휴식기 ' + s.blackouts.length);
      }
    },
    {
      id: 'slots', tab: 'slots', title: '연전 기간', short: '시리즈가 열리는 2~4일 묶음 — 단추로 만듦',
      why: () => '연전 기간은 ' + half() + '개 구장에서 동시에 시리즈가 열리는 2~4일 묶음입니다. 한 줄이 한 기간이고, 자동 편성은 시리즈를 이 기간에 하나씩 넣습니다.',
      how: () => '직접 적지 않습니다. 「규칙대로 자동 채우기」를 누르면 시즌 기본 설정(개막일·종료일·휴식 요일·휴식일 경기·휴식기)대로 연전 기간을 만들어 먼저 보여 주고, 「적용」으로 넣습니다. 오른쪽 「연전 수 맞추기」는 시리즈를 만든 뒤 모두 「맞음」이 됩니다.',
      spots: [
        { target: '.toolbar [data-act="draft-slots"], .sheet-empty [data-act="draft-slots"]', title: '규칙대로 자동 채우기', text: () => '이 단추를 누르세요. 시즌 기본 설정대로 연전 기간을 만들고, 바꾸기 전에 먼저 보여 드립니다. 미리보기 창에서 「적용」을 누르면 표가 채워집니다.' },
        { target: '#sheetScroll', title: '한 줄이 한 연전 기간', text: () => half() + '개 구장에서 동시에 시리즈가 열리는 기간입니다. 시작일과 연전 수(2~4)만 맞으면 「기간」은 자동으로 계산됩니다. 주말과 휴일 등급은 휴일 경기를 고르게 나눌 때 씁니다.' },
        { target: '.pane.insp', title: '오른쪽 자세히로 확인', text: () => '시즌 달력에 빈 곳이 없는지 보고, 「연전 수 맞추기」를 확인합니다. 시리즈를 아직 안 만들었으면 「여유」로 보이는 게 정상입니다. 줄을 고르면 달력에 그 기간이 표시됩니다.' }
      ],
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
      how: () => '「맞대결 규칙대로 자동 채우기」를 누르면 맞대결마다 ' + pairText() + '을 연전 기간 수에 맞게 나눠 ' + (half() ? half() * 2 * (half() * 2 - 1) / 2 : 0) + '쌍 모두 만들어 먼저 보여 줍니다. 「적용」 뒤 오른쪽 「맞대결 경기 수」 표에 노란 칸(!)이 없고 「연전 수 맞추기」가 모두 「맞음」이면 됩니다.',
      spots: [
        { target: '.toolbar [data-act="draft-series"], .sheet-empty [data-act="draft-series"]', title: '맞대결 규칙대로 자동 채우기', text: () => '이 단추를 누르세요. 맞대결마다 ' + pairText() + '을 연전 기간 수에 맞게 나눠 채우고, 바꾸기 전에 먼저 보여 드립니다.' },
        { target: '#sheetScroll', title: '한 줄이 한 시리즈', text: () => '홈 구단, 원정 구단, 연전 수입니다. 고칠 때 구단 이름이 틀리면 비슷한 이름을 찾아 바꿔 드립니다.' },
        { target: '.pane.insp', title: '맞대결 경기 수 확인', text: () => '오른쪽 표에서 두 구단의 경기 수 합이 모두 ' + set().initialGamesPerPair + '인지 봅니다. 다른 곳은 노란 칸과 !로 표시됩니다. 아래 「연전 수 맞추기」도 모두 「맞음」이어야 합니다.' }
      ],
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
      why: '날짜를 미리 정해야 하는 경기를 적습니다. 대진 지정은 그 날짜의 대진을 고정하고, 구장 지정은 그 구장 구단이 꼭 홈 경기를 하게 합니다.',
      how: () => '「개막전 대진 추가」는 개막일 연전 기간의 ' + half() + '경기를 「대진 지정」으로 넣고 고정합니다(대진을 바꾸려면 홈·원정 칸을 고칩니다). 「어린이날 구장 지정 추가」는 5/5에 홈이어야 하는 구장을 넣습니다. 어린이날이 휴식 요일이면 먼저 「휴식일 경기」에 넣어 두어야 합니다.',
      spots: [
        { target: '.toolbar [data-act="add-opening"], .sheet-empty [data-act="add-opening"]', title: '개막전 대진 추가', text: () => '개막일 연전 기간에 들어 있는 대진을 「대진 지정」으로 넣고 고정합니다. 대진을 바꾸려면 홈·원정 칸을 고치세요.' },
        { target: '.toolbar [data-act="add-children"], .sheet-empty [data-act="add-children"]', title: '어린이날 구장 지정 추가', text: () => '어린이날에 꼭 홈이어야 하는 구장을 「구장 지정」으로 넣습니다. 구장 칸에 쉼표로 적어 바꿀 수 있습니다.' },
        { target: '#sheetScroll', title: '대진 지정과 구장 지정', text: () => '개막전처럼 날짜와 대진을 정한 경기는 「대진 지정」, 어린이날처럼 그 구장 구단이 꼭 홈이어야 하는 날은 「구장 지정」입니다. 날짜는 연전 기간 안에 있어야 합니다.' }
      ],
      acts: () => [{ act: 'add-opening', label: '개막전 대진 추가', icon: 'bolt' }, { act: 'add-children', label: '어린이날 구장 지정 추가', icon: 'bolt' }],
      status: () => {
        const st = app().state, e = sheetErrors('events').e;
        if (e) return res('warn', '오류 ' + e + '건');
        if (!st.events.length) return res(blank() && st.matches.length ? 'todo' : 'ok', st.matches.length ? '아직 없음 — 개막전·어린이날을 단추로 추가' : '시리즈를 만든 뒤 추가합니다(없어도 됨)');
        return res('ok', st.events.length + '개 (대진 지정 ' + st.events.filter((x) => x.mode === 'MATCH').length + ' · 구장 지정 ' + st.events.filter((x) => x.mode === 'STADIUM').length + ')');
      }
    },
    {
      id: 'teams', tab: 'teams', title: '구단과 거리', short: '구단·구장 위치 (보통 그대로)',
      why: '구단과 구장 위치, 구장 사이 거리입니다. 이동거리를 계산할 때 씁니다. 「처음부터 입력하기」로 비워도 남겨 두는 표입니다 — KBO 10구단은 거의 바뀌지 않습니다.',
      how: () => '그대로 두면 됩니다. 구단을 고르면 오른쪽에 다른 구장까지 거리가 나옵니다. 구단 이름이나 구장이 바뀌었을 때만 오른쪽 칸에서 고칩니다.',
      spots: [
        { target: '.pane.main', title: '구단과 구장', text: () => '구단을 고르면 오른쪽에 다른 구장까지 거리가 나옵니다. 잠실처럼 두 구단이 같이 쓰는 구장은 자동으로 알아봅니다.' }
      ],
      acts: () => [],
      status: () => res('ok', app().state.teams.length + '구단 · 같이 쓰는 구장 ' + app().sharedStadiums().size)
    },
    {
      id: 'next', tab: null, title: '다음 단계로', short: '② 검토·실행에서 한 번 더 점검',
      why: '모두 「문제 없음」이면 다음 단계로 넘어갑니다. ② 검토·실행에서 편성할 수 없는 입력이 있는지 한 번 더 점검하고 자동 편성을 돌립니다.',
      how: () => '아래 「다음: 검토·실행」을 누릅니다. 입력은 언제든 다시 돌아와 고칠 수 있습니다.',
      spots: [
        { target: '.footer .btn.primary', title: '다음: 검토·실행', text: () => '이 단추를 누르면 ② 검토·실행으로 갑니다. 입력은 언제든 다시 돌아와 고칠 수 있습니다.' }
      ],
      acts: () => [{ act: 'go-step', step: 2, label: '다음: 검토·실행', icon: 'right', primary: true }],
      status: () => { const bad = S.GUIDE_TASKS.filter((t) => t.id !== 'next' && !t.status().ok); return res(bad.length ? (bad.some((t) => !t.status().todo) ? 'warn' : 'todo') : 'ok', bad.length ? bad.map((t) => t.title).join(', ') + ' 남음' : '모두 확인됨 — 다음 단계로'); }
    }
  ];
  /** 펼친 짚어 줄 곳 목록: [{task, spot, tab, n}] — 말풍선·번호 점이 쓴다 */
  S.guideSpots = function () {
    const out = [];
    for (const t of S.GUIDE_TASKS) for (const sp of t.spots) out.push({ task: t, spot: sp, tab: sp.tab || t.tab, n: out.length });
    return out;
  };
  S.guideTaskOfTab = (tab) => S.GUIDE_TASKS.find((t) => t.tab === tab || (t.tabs && t.tabs.includes(tab))) || null;
  /** 지금 할 일: 위에서부터 처음으로 「됨」이 아닌 할 일(시작하기 제외). 모두 됐으면 「다음 단계로」 */
  S.guideNext = function () {
    for (const t of S.GUIDE_TASKS) { if (t.id === 'start') continue; if (!t.status().ok) return t; }
    return S.GUIDE_TASKS[S.GUIDE_TASKS.length - 1];
  };
  /** 할 일의 단추를 HTML로. 안내 방식이 카드·말풍선 안에 그대로 넣는다. */
  S.guideActButtons = function (task, cls) {
    const acts = typeof task.acts === 'function' ? task.acts() : (task.acts || []);
    return acts.map((a) => {
      const data = ' data-act="' + a.act + '"' + (a.tab ? ' data-tab="' + a.tab + '"' : '') + (a.step ? ' data-step="' + a.step + '"' : '') + (a.kind ? ' data-kind="' + a.kind + '"' : '');
      return '<button class="btn ' + (cls || 'sm') + (a.primary ? ' primary' : '') + '"' + data + '>' + (a.icon ? S.icon(a.icon) : '') + S.esc(a.label) + '</button>';
    }).join('');
  };

  // ───────── 저장 (안내 방식마다 따로) ─────────
  /** variant: 'tour' | 'check' | 'follow' | 'spot'. 반환: { get(), set(patch), reset() } — 값은 { seen, at, done:{} } */
  S.guideStore = function (variant) {
    const key = S.KEY + 'guide-' + variant;
    const read = () => { try { return JSON.parse(S.ls.get(key) || 'null') || {}; } catch (e) { return {}; } };
    return {
      get: () => Object.assign({ seen: false, at: 0, done: {} }, read()),
      set(patch) { const v = Object.assign(this.get(), patch); S.ls.set(key, JSON.stringify(v)); return v; },
      reset() { S.ls.del(key); }
    };
  };

  /** 처음 방문 자동 시작 가능 여부: 자가 점검·시연 상태·모달·서랍·시즌 운영이면 띄우지 않는다 */
  S.guideAutoOK = function () {
    const u = S.ui;
    return !S.selftestMode && !u.ops && u.step === 1 && !u.modal && !u.drawer && !u.demo && !u.menu;
  };
  /** 모달·서랍·메뉴가 열려 있으면 안내를 잠시 숨긴다 */
  S.guideBlocked = () => !!(S.ui.modal || S.ui.drawer || S.ui.menu || S.ui.ops);

  /** 안내가 다른 탭을 보여 줄 때: 목록에서 탭을 누른 것과 같게 바꾼다 */
  S.guideGoTab = function (tab) {
    if (!tab) return;
    if (S.ui.step !== 1 || S.ui.tab !== tab) S.go({ step: 1, ops: null, tab, edit: null, cell: null, vizChanged: null });
  };

  /** 화면 요소 위치 (보이는 첫 요소) */
  S.guideRect = function (sel) {
    if (!sel) return null;
    for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return r; }
    return null;
  };

  // ───────── 렌더 고리 ─────────
  // shell.js가 S.render 끝(스크롤 점검 전)에 S.guideAfter()를, 키 입력 때 S.guideOnKey(e)를 부른다.
  // 「처음부터 입력하기」 직후에는 S.guideOnReset()을 불러 안내 방식이 빈 상태 안내를 열 수 있게 한다.
  S.guideAfter = function () {
    const box = document.getElementById('guide');
    if (!box || !S.guideUI) return;
    try { S.guideUI.after(box); } catch (e) { console.error(e); }
  };
  S.guideOnKey = (e) => (S.guideUI && S.guideUI.onKey ? S.guideUI.onKey(e) : false);
  S.guideOnReset = () => { if (S.guideUI && S.guideUI.onReset) { try { S.guideUI.onReset(); } catch (e) { console.error(e); } } };
  /** 띠의 「입력 안내」 단추 (안내 방식이 정함) */
  S.guideButton = () => (S.guideUI && S.guideUI.button ? S.guideUI.button() : '');
  window.addEventListener('resize', () => { if (S.app) { S.guideAfter(); S.checkScroll(); } });
})();
