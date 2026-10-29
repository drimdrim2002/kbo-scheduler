/*
 * 편성 스튜디오 — ① 데이터 준비 단계 흐름: 가로 4칸 단계 띠 · 다시 왔을 때 「어디까지 했는지」 · 4 확인 · 하단 이전/다음 · 따라 하기
 *  단계 띠: 「2027 시즌 · ① 데이터 준비」 + 1 구단 정보 → 2 시즌 기간·연전 묶음 → 3 공휴일·홈 구장 → 4 확인(단계마다 상태 한 줄 + 「지금 여기」),
 *           오른쪽 끝에 작게 「어디까지 했는지」·「모든 표 보기」. 단계를 누르면 그 단계로.
 *  단계 완료는 데이터로 판단한다(season-year.js S.flowStatus).
 *  4 확인: 단계별 요약 + 「고치기」, 시리즈는 규칙대로 자동, 맞대결 경기 수·격년 홈 73/71도 여기서 고친다 → 「다음: ② 검토·실행」.
 *  따라 하기: 단계마다 처음 한 번(2·3단계) + 1단계 「있어요」를 누를 때마다. 테두리(어디)와 작은 카드(무엇을)만 띄우고 데이터는 바꾸지 않는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, CalendarGen } = KBO;
  const app = () => S.app;
  const G = S.g1;
  const STEPS = S.FLOW_STEPS;
  const F = S.flowUI = { edit: null };

  // ───────── 단계 띠 ─────────
  function shortText(n, s) {
    const st = app().state, gd = S.gameDaysCheck(), fl = st.meta.flow || {};
    if (n === 1) return s.kind === 'done' ? (fl.teams === 'changed' ? '고침 · ' : fl.teams === 'same' ? '그대로 · ' : '') + st.teams.length + '구단' : s.text;
    if (n === 2) return st.settings.seasonStart ? '경기일 ' + gd.have + ' / ' + gd.need + '일' : '개막일을 골라 주세요';
    if (n === 3) { const hs = S.homeStateOf(st); return '공휴일 ' + st.settings.holidays.length + ' · 홈 구장 ' + hs.done + ' / ' + hs.total; }
    return s.kind === 'done' ? '모두 맞음' : '아직';
  }
  S.flowBand = function () {
    const fs = S.flowStatus(), here = G.mode === 'flow' ? G.fs : 0, y = S.seasonYear();
    const cell = (s) => {
      const k = s.n === here ? 'here' : s.kind === 'done' ? 'done' : 'todo';
      return '<button class="fb-step ' + k + '" data-act="fl-go" data-fs="' + s.n + '"' + (s.n === here ? ' aria-current="step"' : '') + '><i>' + (s.kind === 'done' && s.n !== here ? icon('check') : s.n) + '</i>' +
        '<span class="fb-t"><b>' + s.n + ' ' + esc(s.name) + (s.n === here ? '<span class="fb-here">지금 여기</span>' : '') + '</b><small>' + (s.kind === 'done' ? '✓ ' : '') + esc(shortText(s.n, s)) + '</small></span></button>';
    };
    return '<nav class="fl-band" aria-label="데이터 준비 단계"><div class="fb-lead"><b>' + y + ' 시즌 · ' + S.CIRCLED[1] + ' 데이터 준비</b><small>' + (here ? here + ' / 4단계' : '어디까지 했는지') + '</small></div>' +
      fs.steps.map(cell).join('') +
      '<div class="fb-tail"><button class="lnk" data-act="fl-resume">' + icon('menu') + '어디까지 했는지</button><button class="lnk" data-act="g1-all" title="가져오기·표 목록·자세히가 모두 보이는 화면(전문가용)">' + icon('table') + '모든 표 보기</button></div></nav>';
  };
  /** 단계 화면 감싸기: 단계 띠 + 그 단계 */
  S.flowWrap = (inner, cls) => '<div class="stepview fl' + (cls ? ' ' + cls : '') + '" data-mode="flow" data-fs="' + G.fs + '">' + S.flowBand() + '<div class="fl-body">' + inner + '</div></div>';

  // ───────── 어디까지 했는지 ─────────
  S.renderResume = function () {
    const st = app().state, fs = S.flowStatus(), y = S.seasonYear(), stop = STEPS[fs.stop - 1];
    const saved = S.repo.load(y);
    const row = (s) => {
      const btn = s.n === fs.stop && !fs.allDone ? '<button class="btn sm primary" data-act="fl-go" data-fs="' + s.n + '">이어서 하기' + icon('right') + '</button>'
        : s.kind === 'done' || s.n < fs.stop ? '<button class="btn sm" data-act="fl-go" data-fs="' + s.n + '">보기</button>' : '<button class="btn sm" data-act="fl-go" data-fs="' + s.n + '">미리 보기</button>';
      return '<div class="rr ' + (s.kind === 'done' ? 'done' : s.n === fs.stop ? 'cur' : '') + '"><i>' + (s.kind === 'done' ? icon('check') : s.n) + '</i><div class="rr-t"><b>' + s.n + ' ' + esc(s.name) + '</b><small>' + esc(s.text) + '</small></div>' + btn + '</div>';
    };
    const b = S.builtinOf(y);
    return '<div class="stepview fl-center" data-mode="resume"><div class="fl-card" aria-label="어디까지 했는지">' +
      '<div class="fl-kick">' + S.CIRCLED[1] + ' 데이터 준비 · ' + (saved ? '다시 오셨습니다' : b ? esc(b.label) + '(' + esc(b.tag) + ')' : '새 시즌') + '</div>' +
      '<h2>' + (fs.allDone ? y + ' 시즌 데이터가 모두 준비돼 있습니다' : fs.stop + '단계 「' + esc(stop.name) + '」' + (fs.stop === 1 && !saved ? '부터 시작합니다' : '에서 멈췄습니다')) + '</h2>' +
      '<p class="fl-sub">' + y + ' 시즌 · ' + esc(saved ? '마지막으로 고친 때 ' + S.whenText(saved.savedAt) + ' · 이 컴퓨터의 브라우저에 저장되어 있습니다.' : b ? '기본 제공 데이터입니다. 고치면 이 브라우저에 자동 저장합니다.' : '고치면 이 브라우저에 자동 저장합니다.') + (fs.allDone ? ' 단계를 하나씩 눌러 확인하거나 「다음」으로 ② 검토·실행에 갑니다.' : '') + '</p>' +
      fs.steps.map(row).join('') +
      '<div class="fl-foot"><span>다른 시즌을 하시려면</span><button class="btn sm" data-act="year-pick">' + icon('cal') + '시즌 연도 고르기</button><button class="btn sm" data-act="year-reset" data-year="' + y + '">' + icon('plus') + y + ' 처음부터 다시</button>' +
      (y === 2025 ? '<button class="btn sm" data-act="year-builtin" data-year="2025">' + icon('db') + '2025 예시 데이터 다시 불러오기</button>' : '<button class="btn sm" data-act="year-open" data-year="2025">' + icon('db') + '2025 예시 데이터 보기</button>') + '</div>' +
      '</div></div>';
  };
  function resumeFooter() {
    const fs = S.flowStatus(), stop = STEPS[fs.stop - 1];
    return '<button class="btn" data-act="year-pick">' + icon('left') + '시즌 연도</button>' +
      '<span class="hint"><b>' + S.CIRCLED[1] + ' 데이터 준비</b> — 어디까지 했는지 보고 이어서 합니다</span>' +
      '<span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' +
      (fs.allDone ? '<button class="btn primary" data-act="fl-go" data-fs="4">4 확인 보기' + icon('right') + '</button>' : '<button class="btn primary" data-act="fl-go" data-fs="' + fs.stop + '">이어서: ' + fs.stop + ' ' + esc(stop.name) + icon('right') + '</button>');
  }

  // ───────── 4 확인 ─────────
  function rulesEditor() {
    const s = app().state.settings, ht = s.homeTotals, names = app().state.teams.map((t) => t.name), half = names.length >> 1;
    const num = (k, v, label) => '<label class="sc-inl">' + esc(label) + ' <input class="input sm num sc-num" data-in="fl-rule" data-k="' + k + '" value="' + esc(String(v)) + '" inputmode="numeric" aria-label="' + esc(label) + '"></label>';
    const total = (s.gamesPerPair || 16) * (names.length - 1);
    let h = '<div class="ck-ed"><div class="ck-ed-row">' + num('gamesPerPair', s.gamesPerPair, '맞대결') + num('initialGamesPerPair', s.initialGamesPerPair, '그중 1차 편성') + num('homeGamesMajor', s.homeGamesMajor, '1차 편성 홈(많은 쪽)') + '</div>' +
      '<div class="sc-note">맞대결 ' + s.gamesPerPair + '경기 = 1차 편성 ' + s.initialGamesPerPair + ' + 미편성 ' + (s.gamesPerPair - s.initialGamesPerPair) + '(재편성에서). 1차 편성 경기 수를 바꾸면 필요한 경기일(' + s.initialGamesPerPair + ' × ' + (names.length - 1) + ')도 바뀝니다.</div>';
    if (ht && Array.isArray(ht.moreTeams)) {
      const more = (ht.more && ht.more.total) || Math.ceil(total / 2) + 1, less = (ht.less && ht.less.total) || total - more;
      h += '<div class="sc-sub">격년 홈 ' + more + ' / ' + less + '경기 <small>홈 ' + more + ' 구단 ' + ht.moreTeams.length + ' / ' + half + '곳</small></div><div class="sc-home-teams">' +
        app().state.teams.map((t) => '<button class="gs-tbtn' + (ht.moreTeams.includes(t.name) ? ' on' : '') + '" data-act="fl-ht-team" data-team="' + esc(t.name) + '" aria-pressed="' + ht.moreTeams.includes(t.name) + '" style="--tc:' + esc(t.color || '#555') + '"><i></i>' + esc(t.name) + '</button>').join('') + '</div>' +
        '<div class="sc-note">홈 ' + more + ' 구단: 1차 편성 홈 ' + ((ht.more && ht.more.initial) || '-') + ' · 미편성 홈 ' + (more - ((ht.more && ht.more.initial) || 0)) + ' / 홈 ' + less + ' 구단: 1차 편성 홈 ' + ((ht.less && ht.less.initial) || '-') + ' · 미편성 홈 ' + (less - ((ht.less && ht.less.initial) || 0)) + '. 해마다 바뀝니다(다음 해는 반대로). <button class="lnk" data-act="fl-ht-off">쓰지 않기</button></div>';
    } else h += '<div class="sc-note">격년 홈 73 / 71경기(구단마다 홈 경기 수가 해마다 번갈아 다름)를 쓰지 않습니다. <button class="lnk" data-act="fl-ht-on">격년 홈 73 / 71 쓰기</button></div>';
    return h + '</div>';
  }
  S.renderCheck = function () {
    const st = app().state, s = st.settings, fs = S.flowStatus(), gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(st.calendar), sr = S.calSeriesState(), y = S.seasonYear();
    const icn = (done) => '<i class="ck-i ' + (done ? 'done' : 'cur') + '">' + (done ? icon('check') : '!') + '</i>';
    const row = (n, title, text, btn) => '<div class="ck-row' + (fs.done[n - 1] ? '' : ' cur') + '">' + icn(n <= 3 ? fs.done[n - 1] : sr.ok) + '<div class="ck-t"><b>' + title + '</b><small>' + text + '</small></div>' + btn + '</div>';
    const fix = (n) => '<button class="btn sm" data-act="fl-go" data-fs="' + n + '">고치기</button>';
    const dm = st.distanceMatrix.filter((d) => d.from !== d.to).length, shared = Array.from(app().sharedStadiums()).map(([x, n]) => x.replace(/종합운동장$/, '') + '(' + n.join('·') + ')').join(', ');
    const hol = s.holidays.filter((x) => x.date >= (s.seasonStart || y + '-03-01') && x.date <= (s.seasonEnd || y + '-10-31'));
    const ht = s.homeTotals && Array.isArray(s.homeTotals.moreTeams) ? ' · 격년 홈 ' + ((s.homeTotals.more && s.homeTotals.more.total) || 73) + ' ' + s.homeTotals.moreTeams.join('·') : '';
    return '<div class="ck-wrap" data-sk="ck"><div class="fl-card ck-card" aria-label="확인">' +
      '<div class="fl-kick">4 / 4단계 · 확인</div><h2>' + (fs.allDone || (fs.done[0] && fs.done[1] && fs.done[2]) ? y + ' 시즌 데이터가 모두 준비됐습니다' : y + ' 시즌 — 아직 맞지 않는 곳이 있습니다') + '</h2>' +
      '<p class="fl-sub">아래가 맞으면 「다음: ② 검토·실행」을 누릅니다. 고칠 곳이 있으면 그 줄의 「고치기」로 그 단계에 갑니다.</p>' +
      row(1, '1 구단 정보', esc(st.teams.length + '구단 · 구장 간 거리 ' + dm + '개' + (shared ? ' · 같이 쓰는 구장 ' + shared : '')), fix(1)) +
      row(2, '2 시즌 기간·연전 묶음', esc(s.seasonStart ? '개막 ' + fmt.date(s.seasonStart) + ' ~ 1차 편성 ' + fmt.date(s.initialEnd) + ' · 시즌 종료 ' + fmt.date(s.seasonEnd) + ' · 묶음 ' + st.calendar.length + '개(2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + ') · 경기일 ' + gd.have + ' / ' + gd.need + '일' : '개막일을 아직 고르지 않았습니다'), fix(2)) +
      row(3, '3 공휴일·홈 구장', esc('공휴일 ' + hol.length + '일 · 홈 구장 지정 ' + S.calHomeLine()), fix(3)) +
      row(4, '시리즈(규칙대로 자동)', esc('맞대결 ' + s.gamesPerPair + '경기 = 1차 편성 ' + s.initialGamesPerPair + '(홈 ' + s.homeGamesMajor + '·원정 ' + (s.initialGamesPerPair - s.homeGamesMajor) + ') + 미편성 ' + (s.gamesPerPair - s.initialGamesPerPair) + ht + ' · ' + sr.text), '<span class="ck-btns"><button class="btn sm" data-act="fl-edit-rules">' + (F.edit === 'rules' ? '닫기' : '고치기') + '</button><button class="btn sm" data-act="g1-all" data-tab="series">표 보기</button></span>') +
      (S.cal.seriesError ? '<div class="sc-warn ck-err">' + icon('warn') + '<span><b>시리즈를 만들 수 없습니다.</b> ' + esc(S.cal.seriesError) + '</span></div>' : '') +
      (F.edit === 'rules' ? rulesEditor() : '') +
      '<div class="fl-foot ck-foot"><span>' + esc(S.savedText()) + '</span><button class="btn sm" data-act="repo-export">' + icon('download') + '파일로 내려받기</button><span class="sc-xl"><button class="btn sm" data-act="cal-xl-down" title="구단 정보 · 시즌 기간과 공휴일 · 연전 기간 · 홈 구장 지정 시트 4개">' + icon('sheet') + '엑셀 서식 내려받기</button><button class="btn sm" data-act="cal-xl-up">' + icon('upload') + '채운 엑셀 올리기</button></span>' +
      '<button class="btn primary" data-act="cal-next">다음: ' + S.CIRCLED[2] + ' 검토·실행' + icon('right') + '</button></div>' +
      '</div></div>';
  };

  // ───────── 하단 ─────────
  const HINT = {
    1: '가장 최근 해의 구단 정보를 가져왔습니다. 바뀐 정보가 없으면 그대로 「다음」',
    2: '개막일(토요일)만 고르면 나머지는 규칙대로 채웁니다',
    3: '공휴일은 왼쪽 표에서, 홈 구장은 달력에서 날을 눌러 고릅니다',
    4: '모두 맞으면 ' + S.CIRCLED[2] + ' 검토·실행으로 넘어갑니다'
  };
  function flowFooter() {
    const n = G.fs, prev = STEPS[n - 2], next = STEPS[n];
    const noOpen = n === 2 && !app().state.settings.seasonStart;
    return (prev ? '<button class="btn" data-act="fl-go" data-fs="' + (n - 1) + '">' + icon('left') + '이전: ' + prev.n + ' ' + esc(prev.name) + '</button>' : '<button class="btn" data-act="fl-resume">' + icon('left') + '어디까지 했는지</button>') +
      '<span class="hint"><b>' + n + ' / 4 ' + esc(STEPS[n - 1].name) + '</b> — ' + esc(n === 1 && !(app().state.meta.flow || {}).from ? '구단·구장·위치가 바뀐 해만 고칩니다. 그대로면 「다음」' : HINT[n]) + '</span>' +
      '<span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' +
      (next ? '<button class="btn primary" data-act="fl-next"' + (noOpen ? ' disabled title="개막일을 먼저 골라 주세요"' : '') + '>다음: ' + next.n + ' ' + esc(next.name) + icon('right') + '</button>'
        : '<button class="btn primary" data-act="cal-next">다음: ' + S.CIRCLED[2] + ' 검토·실행' + icon('right') + '</button>');
  }
  S.flowFooter = function () {
    if (G.mode === 'year') return S.yearFooter();
    if (G.mode === 'resume') return resumeFooter();
    if (G.mode === 'flow') return flowFooter();
    return null;
  };
  S.flowSummary = function () {
    if (G.mode === 'year') return '시즌 연도를 고르면 시작합니다';
    if (G.mode === 'resume') { const fs = S.flowStatus(); return fs.allDone ? '4단계 모두 완료' : fs.stop + ' / 4 ' + STEPS[fs.stop - 1].name + '에서 멈춤'; }
    if (G.mode === 'flow') return G.fs + ' / 4 ' + STEPS[G.fs - 1].name;
    return null;
  };

  // ───────── 이동 ─────────
  S.flowGo = function (n) {
    G.mode = 'flow'; G.fs = Math.max(1, Math.min(4, n | 0 || 1));
    S.cal.slotAt = null; S.cal.edit = null; S.cal.pickOpen = false;
    if (G.fs !== 3) S.cal.day = null;
    S.ui.teamFind = null; S.ui.mapPick = null;
    S.go({ step: 1, ops: null, cell: null, edit: null, modal: null, drawer: null });
  };
  /** 1단계 「바뀐 정보가 있나요?」 답(저장한다 — 다시 와도 기억) */
  S.flowSetTeams = function (ans) {
    const cur = (app().state.meta.flow || {}).teams;
    if (cur === ans) return true;
    return app().commit('구단 정보: ' + (ans === 'same' ? '바뀐 정보 없음' : '바뀐 정보 있음'), (s) => { s.meta.flow = Object.assign({}, s.meta.flow || {}, { teams: ans }); }, ['meta']);
  };
  Object.assign(S.actions, {
    'fl-go': (el) => S.flowGo(+el.dataset.fs),
    'fl-resume': () => { G.mode = 'resume'; S.go({ step: 1, ops: null, cell: null, edit: null, modal: null, drawer: null }); },
    'fl-next': () => {
      if (G.fs === 1 && !(app().state.meta.flow || {}).teams) S.flowSetTeams('same');
      if (G.fs === 2 && !app().state.settings.seasonStart) { S.toast('개막일을 먼저 골라 주세요.', 'warn'); return; }
      S.flowGo(G.fs + 1);
    },
    'fl-teams-same': () => { S.flowSetTeams('same'); S.flowGo(2); },
    'fl-teams-changed': () => { S.flowSetTeams('changed'); if (!S.ui.cell || S.ui.cell.sheet !== 'teams') S.ui.cell = { sheet: 'teams', row: 0, col: 'name' }; S.flowTour.start('teams'); },
    'fl-edit-rules': () => { F.edit = F.edit === 'rules' ? null : 'rules'; S.render(); },
    'fl-ht-on': () => {
      const names = app().state.teams.map((t) => t.name), total = (app().state.settings.gamesPerPair || 16) * (names.length - 1), more = total / 2 + 1, less = total / 2 - 1;
      const init = app().state.settings.initialGamesPerPair * (names.length - 1);
      app().commit('격년 홈 ' + more + ' / ' + less + ' 쓰기', (s) => { s.settings.homeTotals = { moreTeams: [], more: { total: more, initial: Math.ceil(init / 2) }, less: { total: less, initial: Math.floor(init / 2) } }; }, ['settings']);
    },
    'fl-ht-off': () => { app().commit('격년 홈 경기 수 쓰지 않기', (s) => { delete s.settings.homeTotals; }, ['settings']); },
    'fl-ht-team': (el) => {
      const n = el.dataset.team, ht = app().state.settings.homeTotals, half = app().state.teams.length >> 1;
      if (!ht) return;
      const on = ht.moreTeams.includes(n);
      if (!on && ht.moreTeams.length >= half) { S.toast('홈 ' + ((ht.more && ht.more.total) || 73) + ' 구단은 ' + half + '곳입니다. 다른 구단을 먼저 빼세요.', 'warn', 4500); return; }
      const order = app().state.teams.map((t) => t.name);
      app().commit('격년 홈 ' + ((ht.more && ht.more.total) || 73) + ' 구단 ' + (on ? '빼기: ' : '넣기: ') + n, (s) => { const m = s.settings.homeTotals.moreTeams; s.settings.homeTotals.moreTeams = (on ? m.filter((x) => x !== n) : m.concat([n])).sort((a, b) => order.indexOf(a) - order.indexOf(b)); }, ['settings']);
    }
  });
  S.inputs['fl-rule'] = (el) => {
    if (S.locked()) return;
    const k = el.dataset.k, n = Number(el.value), s = app().state.settings;
    const lim = { gamesPerPair: [2, 30], initialGamesPerPair: [1, s.gamesPerPair], homeGamesMajor: [Math.ceil(s.initialGamesPerPair / 2), s.initialGamesPerPair] }[k];
    if (!Number.isInteger(n) || n < lim[0] || n > lim[1]) { el.classList.add('err'); S.toast('숫자는 ' + lim[0] + '~' + lim[1] + ' 사이 정수입니다.', 'bad'); return; }
    if (n === s[k]) return;
    app().updateSettings({ [k]: n }, ({ gamesPerPair: '맞대결 경기 수', initialGamesPerPair: '1차 편성 맞대결 경기 수', homeGamesMajor: '1차 편성 홈 경기 수' }[k]) + ': ' + n);
    S.toast('바꿨습니다. 시리즈는 「다음」 때 이 값으로 규칙대로 다시 만듭니다.', 'info', 4500);
  };

  // ───────── 따라 하기 ─────────
  const T = S.flowTour = { cur: null, suppressed: false };
  const q = (sel) => document.querySelector(sel);
  const seenKey = (id) => S.KEY + 'tour:' + id;
  const TOURS = {
    teams: [
      { anchor: () => q('.gs-card .gs-pickteam'), title: '바뀐 구단을 고르세요', text: () => '단추나 가운데 표에서 바뀐 구단을 누릅니다. 바뀐 구단이 여럿이면 하나씩 같은 방법으로 고칩니다. 구단 이름이 바뀌었으면 구단명 칸에서 고칩니다.', done: () => !!(T.cur && T.cur.picked) },
      { anchor: () => q('.gs-card .gs-team input[data-k="stadium"]'), title: '새 구장 이름을 적고 Enter', text: () => '구장 칸에 새 구장 이름을 적고 Enter를 누르면 위치(위도·경도)를 찾아 채웁니다. 결과가 여럿이면 맞는 곳을 고릅니다.', done: () => !!(T.cur && T.cur.found) },
      { anchor: () => q('.gs-card .gs-dists'), title: '다른 구장까지 거리 확인', text: () => '위치가 바뀌면 이 구단의 구장 간 거리를 다시 계산합니다(도로거리 받기 · 숫자를 직접 고칠 수도 있음). 맞으면 「다음」으로 갑니다.', last: true }
    ],
    season: [
      { when: () => !app().state.settings.seasonStart, anchor: () => q('.fl-open-ask'), title: '개막일을 하나 눌러 보세요', text: () => '추천은 ' + fmt.date(S.calOpeningChoices()[1]) + '(3월 넷째 토요일)입니다. 누르면 ' + S.seasonYear() + ' 시즌 연전 묶음이 규칙대로 달력에 깔립니다. 손댈 것은 거의 없습니다.', done: () => !!app().state.settings.seasonStart },
      { anchor: () => q('#scCal'), title: '달력을 훑어보고, 고칠 곳만 고치세요', text: () => '연전 묶음 ' + app().state.calendar.length + '개를 규칙대로 깔았고 경기일은 ' + S.gameDaysCheck().have + ' / ' + S.gameDaysCheck().need + '일입니다. 고칠 곳이 있으면 날짜를 끌거나 묶음을 눌러 연전 수를 바꾸고 나눕니다. 자동으로 채운 값은 왼쪽 「자동으로 채운 것」에서 고칩니다.', last: true }
    ],
    days: [
      { anchor: () => q('.sc-homes'), title: '홈 구장 지정을 마저 고르세요', text: () => '개막전·어린이날 홈 경기 구단 ' + (app().state.teams.length >> 1) + '곳을 고릅니다. 목록이나 달력에서 날을 누르면 오른쪽에서 고르고, 개막전은 「대진까지 고정」으로 상대까지 정할 수 있습니다. 가중치는 위 공휴일 표에서 고칩니다.', last: true }
    ]
  };
  const where = { teams: 1, season: 2, days: 3 };
  T.TOURS = TOURS;
  T.seen = (id) => S.ls.get(seenKey(id)) === '1';
  T.reset = (id) => S.ls.del(seenKey(id));
  T.start = function (id, n) {
    const list = TOURS[id];
    if (!list) return false;
    let k = n ? n - 1 : 0;
    while (!n && k < list.length - 1 && list[k].when && !list[k].when()) k++;
    const st = app().state;
    T.cur = { id, k, picked: false, found: false, stad: JSON.stringify(st.teams.map((t) => [t.stadium, t.latitude, t.longitude])) };
    S.ls.set(seenKey(id), '1');
    S.render();
    return true;
  };
  T.end = function () { T.cur = null; S.render(); };
  T.route = function (v) {
    if (v === '0') { T.suppressed = true; return; }
    const m = /^(teams|season|days)\.?(\d)?$/.exec(v || '');
    if (m) { T.suppressed = true; setTimeout(() => T.start(m[1], +(m[2] || 1)), 0); }
  };
  T.hash = function (o) { if (T.cur) o.tour = T.cur.id + '.' + (T.cur.k + 1); };
  /** 렌더 뒤(#guide 층): 처음 한 번 띄우기 · 단계 넘기기 · 테두리와 카드 */
  T.after = function (el) {
    if (!el) return;
    const onFlow = S.ui.step === 1 && !S.ui.ops && G.mode === 'flow';
    const running = !!(S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED'));
    if (onFlow && !T.cur && !T.suppressed && !S.selftestMode && !running && !S.guideBlocked()) {
      const id = G.fs === 2 ? 'season' : G.fs === 3 ? 'days' : null;
      if (id && !T.seen(id)) { setTimeout(() => { if (!T.cur && G.mode === 'flow' && where[id] === G.fs) T.start(id); }, 0); }
    }
    const t = T.cur;
    if (t && (!onFlow || where[t.id] !== G.fs)) { T.cur = null; el.innerHTML = ''; return; } // 그 단계를 떠나면 닫는다(데이터는 그대로)
    if (!t || S.guideBlocked()) { el.innerHTML = ''; return; }
    const st = app().state;
    if (t.id === 'teams' && JSON.stringify(st.teams.map((x) => [x.stadium, x.latitude, x.longitude])) !== t.stad) t.found = true;
    if (t.id === 'teams' && S.ui.teamFind) t.found = true;
    const list = TOURS[t.id];
    while (t.k < list.length - 1 && list[t.k].done && list[t.k].done()) t.k++;
    const s = list[t.k], a = s.anchor();
    el.innerHTML = ring(a) + card(t, list, s);
    place(el, a);
  };
  function ring(a) {
    if (!a) return '';
    const r = a.getBoundingClientRect();
    return '<div class="ct-ring" style="left:' + (r.left - 4) + 'px;top:' + (r.top - 4) + 'px;width:' + (r.width + 8) + 'px;height:' + (r.height + 8) + 'px"></div>';
  }
  function card(t, list, s) {
    const dots = list.map((x, i) => '<i class="' + (i === t.k ? 'on' : i < t.k ? 'done' : '') + '"></i>').join('');
    return '<div class="ct-card" role="dialog" aria-label="따라 하기 ' + (t.k + 1) + ' / ' + list.length + '"><div class="ct-head"><span class="ct-no">따라 하기 ' + (t.k + 1) + ' / ' + list.length + '</span><span class="ct-dots">' + dots + '</span><button class="btn xs icon ghost" data-act="tour-end" title="닫기" aria-label="따라 하기 닫기">' + icon('x') + '</button></div>' +
      '<h4>' + esc(s.title) + '</h4><p>' + esc(s.text()) + '</p>' +
      '<div class="ct-acts">' + (s.last ? '<button class="btn xs primary" data-act="tour-end">' + icon('check') + '마치기</button>' : '<button class="btn xs" data-act="tour-skip">건너뛰기' + icon('right') + '</button>') + '</div></div>';
  }
  function place(el, a) {
    const c = el.querySelector('.ct-card');
    if (!c) return;
    const W = window.innerWidth, H = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
    let left = (W - cw) / 2, top = (H - ch) / 2;
    if (a) {
      const r = a.getBoundingClientRect();
      left = r.right + 14; top = r.top - 8;
      if (left + cw > W - 8) { left = Math.max(8, r.left + Math.min(40, r.width / 4)); top = r.top + Math.min(r.height - 20, 120); }
      if (top + ch > H - 8) top = Math.max(8, r.top - ch - 12);
    }
    c.style.left = Math.max(8, Math.min(left, W - cw - 8)) + 'px';
    c.style.top = Math.max(8, Math.min(top, H - ch - 8)) + 'px';
  }
  Object.assign(S.actions, {
    'tour-skip': () => { const t = T.cur; if (!t) return; if (t.k < TOURS[t.id].length - 1) t.k++; if (t.id === 'teams') { if (t.k >= 1) t.picked = true; if (t.k >= 2) t.found = true; } S.render(); },
    'tour-end': () => T.end(),
    'tour-again': () => { const id = G.fs === 1 ? 'teams' : G.fs === 2 ? 'season' : 'days'; T.start(id); }
  });
  // 1단계 따라 하기: 구단을 고르면(단추·표·지도) 다음 카드로
  const teamSel0 = S.actions['team-sel'];
  S.actions['team-sel'] = function (el, e) {
    if (G.mode === 'flow' && G.fs === 1 && (app().state.meta.flow || {}).teams !== 'changed') S.flowSetTeams('changed');
    if (T.cur && T.cur.id === 'teams') T.cur.picked = true;
    return teamSel0 ? teamSel0(el, e) : undefined;
  };

  // ───────── 자가 점검 (guide-steps.js의 selftest가 부른다) ─────────
  S.flowSelftest = async function ({ ok, click, flush }) {
    const st = () => app().state, q = (sel) => document.querySelector(sel), qa = (sel) => document.querySelectorAll(sel), C = S.cal, dn = Dates.dayNum;
    const card = () => (q('#guide .ct-card') || { textContent: '' }).textContent;
    const saved27 = S.repo.has(2027);
    // 어디까지 했는지(2025 예시: 네 단계 모두 끝)
    G.mode = 'resume'; S.go({ step: 1, ops: null });
    ok('어디까지 했는지: 2025 예시 → 네 단계 모두 완료 · 단계마다 한 줄 + 보기 · 연도 고르기·처음부터 다시·예시 다시 불러오기 · 주소 resume=1', /모두 준비돼 있습니다/.test(q('.fl-card h2').textContent) && qa('.rr.done').length === 4 && !!q('.fl-foot [data-act="year-reset"]') && !!q('.fl-foot [data-act="year-builtin"]') && /resume=1/.test(S.lastHash) && /4단계 모두 완료/.test(q('.step[data-step="1"] .step-sum').textContent));
    // 새 연도 2027(기본 제공이 있으면 처음부터 다시)
    // 2027 기본 제공(코어 KBO.Preset2027)이 있어도 「새로 입력」 길을 본다: 새 연도 프로젝트로 연다
    S.switchYear(2027, S.builtinOf(2027) ? { quiet: true, to: 'resume', project: S.newYearProject(2027) } : { quiet: true, to: 'resume' }); flush();
    ok('2027 새로 입력 → 바로 1 구단 정보 · 2025 구단 정보를 가져왔습니다 · 「바뀐 정보가 있나요?」 · 단계 띠 1 지금 여기', G.mode === 'flow' && G.fs === 1 && /가장 최근\(2025\)/.test(q('.gs-card').textContent) && /바뀐 정보가 있나요/.test(q('.fb-step.here').textContent));
    click('.gs-card [data-act="fl-teams-same"]'); flush();
    ok('「없어요」 → 2단계 · 개막일 후보 3/20 · 3/27(추천) · 4/3 · 나머지는 자동(접힘) · 연도 칸 「2027 시즌」', G.fs === 2 && S.calOpeningChoices().join() === '2027-03-20,2027-03-27,2027-04-03' && /3\/27\(토\) 추천/.test(q('.fl-open-ask').textContent) && !!q('.sc-dash') && /2027 시즌/.test(q('.tb-year').textContent));
    S.flowTour.start('season'); flush();
    ok('따라 하기(2단계) 1 / 2: 개막일 고르기를 가리킴', S.flowTour.cur && S.flowTour.cur.k === 0 && /개막일을 하나 눌러 보세요/.test(card()) && !!q('#guide .ct-ring'));
    const u0 = app().store.undoStack.length;
    click('.fl-open-ask [data-act="cal-open"][data-date="2027-03-27"]'); flush();
    const h = CalendarGen.lengthHistogram(st().calendar), bl = st().settings.blackouts.map((b) => b.start.slice(5) + '~' + b.end.slice(5) + ' ' + b.label).join(',');
    ok('2027: 개막 3/27(토)만 고르면 — 1차 편성 종료 9/5(일, 자동) · 묶음 45개(2연전 1 · 3연전 43 · 4연전 1) · 경기일 135 · 8/16(월) 대체공휴일 경기 없음 · 올스타 휴식기 7/9~7/14 · 후반기 7/15 4연전 · 실행 취소 한 번',
      st().settings.initialEnd === '2027-09-05' && st().calendar.length === 45 && h[2] === 1 && h[3] === 43 && h[4] === 1 && S.gameDaysCheck().ok && !st().settings.restExceptions.includes('2027-08-16') && /07-09~07-14 올스타 휴식기/.test(bl) && st().calendar.some((c) => c.datetime.startsWith('2027-07-15') && c.consecutive === 4) && app().store.undoStack.length === u0 + 1 && st().settings.initialEndAuto !== false, st().settings.initialEnd + ' · ' + st().calendar.length + ' · ' + bl);
    ok('따라 하기 2 / 2: 개막일을 고르면 「달력을 훑어보고, 고칠 곳만」 · 마치기 · 자동 표시와 이유', S.flowTour.cur && S.flowTour.cur.k === 1 && /고칠 곳만/.test(card()) && qa('.sc-auto .tag.auto').length === 2 && /경기일 135일이 되는 날/.test(q('.sc-auto').textContent) && /7월 둘째 금요일/.test(q('.sc-auto').textContent));
    click('#guide .ct-acts [data-act="tour-end"]'); flush();
    app().undo(); flush();
    const undone = !st().settings.seasonStart && !st().calendar.length;
    app().redo(); flush();
    ok('실행 취소 한 번 → 개막일·묶음 모두 비움 · 다시 실행 → 그대로', undone && st().calendar.length === 45 && !S.flowTour.cur);
    // 자동으로 채운 것 고치기: 올스타 휴식기 길이(묶음을 손대지 않았으면 같이 다시 깔기) · 1차 편성 종료일 직접 → 자동으로
    click('.sc-auto [data-act="cal-edit"][data-k="allstar"]'); flush();
    const put = (sel, v) => { const i = q(sel); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
    const u1 = app().store.undoStack.length;
    put('.sc-auto input[data-k="allStarDays"]', '5');
    const as5 = /07-09~07-13/.test(st().settings.blackouts.map((b) => b.start.slice(5) + '~' + b.end.slice(5)).join()) && app().store.undoStack.length === u1 + 1 && S.calSameAsRule();
    app().undo(); flush();
    click('.sc-auto [data-act="cal-edit"][data-k="initialEnd"]'); flush();
    put('.sc-auto input[data-k="initialEnd"]', '8/29');
    const direct = st().settings.initialEnd === '2027-08-29' && st().settings.initialEndAuto === false && !S.gameDaysCheck().ok && !!q('.sc-auto [data-act="cal-end-auto"]');
    click('.sc-auto [data-act="cal-end-auto"]'); flush();
    ok('자동으로 채운 것: 올스타 휴식기 5일 → 묶음도 같이(실행 취소 한 번) · 1차 편성 종료일 8/29(직접) → 경기일 모자람 → 「자동으로」 → 9/5', as5 && direct && st().settings.initialEnd === '2027-09-05' && S.gameDaysCheck().ok, 'as5 ' + as5 + ' · direct ' + direct);
    // 직접 고친 묶음이 있으면 설정만 바꾸고 「묶음에 반영할까요?」
    const b0 = st().calendar.findIndex((c) => c.datetime.startsWith('2027-04-06'));
    S.calOps.removeBundle(b0); flush();
    click('.sc-auto [data-act="cal-edit"][data-k="allstar"]'); flush();
    put('.sc-auto input[data-k="allStarDays"]', '5');
    const kept = st().calendar.length === 44 && !!q('.sc-relay') && st().settings.allStarDays === 5;
    click('.sc-relay [data-act="cal-relay-no"]'); flush();
    ok('직접 고친 묶음(4/6 지움)이 있으면 올스타 길이를 바꿔도 묶음은 그대로 + 「묶음에 반영할까요?」 · 「그대로 둠」', kept && !q('.sc-relay'));
    app().undo(); app().undo(); flush(); C.edit = null;
    // 3단계: 2027 공휴일(1차 편성 기간 5일) · 8/16 「월 경기」 켜기 → 반영 → 8/16 경기 · 8/19 휴식
    click('.footer [data-act="fl-next"]'); flush();
    const hols = Array.from(qa('.sc-hols tbody tr')).map((tr) => tr.querySelector('.sc-hd').value).join();
    const i816 = st().settings.holidays.findIndex((x) => x.date === '2027-08-16');
    ok('3단계(2027): 공휴일 5일(5/5·5/13·6/6·8/15·8/16) · 8/16(월) 「월 경기」 꺼짐 · 홈 구장 지정 0 / 2(개막전·어린이날)', G.fs === 3 && hols === '5/5(수),5/13(목),6/6(일),8/15(일),8/16(월)' && !q('.sc-hols [data-act="cal-por"][data-row="' + i816 + '"]').classList.contains('on') && /0 \/ 2/.test(q('.sc-homes h4').textContent), hols);
    click('.sc-hols [data-act="cal-por"][data-row="' + i816 + '"]'); flush();
    click('.sc-relay [data-act="cal-relay-go"]'); flush();
    ok('8/16 「월 경기」 켜기 → 반영 → 8/16 경기(휴식일 경기) · 8/19(목) 휴식 · 경기일 135 그대로', st().settings.restExceptions.includes('2027-08-16') && /08-19~08-19/.test(st().settings.blackouts.map((b) => b.start.slice(5) + '~' + b.end.slice(5)).join()) && S.gameDaysCheck().ok);
    app().undo(); app().undo(); flush();
    // 홈 구장 지정: 개막전 KT·삼성·KIA·LG·SSG, 어린이날 두산·키움·한화·롯데·NC
    const pick = (iso, names) => { click('.sc-homes .sc-hrow[data-d="' + dn(iso) + '"]'); flush(); if (q('.sc-day [data-act="cal-home-on"]')) { click('.sc-day [data-act="cal-home-on"]'); flush(); } for (const n of names) { click('.sc-day [data-act="cal-home-team"][data-team="' + n + '"]'); flush(); } };
    pick('2027-03-27', ['KT', '삼성', 'KIA', 'LG', 'SSG']);
    pick('2027-05-05', ['두산', '키움', '한화', '롯데', 'NC']);
    ok('홈 구장 지정 2 / 2 → 3단계 ✓ · 단계 띠 3 완료', S.flowStatus().done[2] && /2 \/ 2/.test(q('.sc-homes h4').textContent) && st().settings.obligationTeams.join() === '두산,키움,한화,NC,롯데', st().settings.obligationTeams.join() + ' · ' + S.homeStateOf(st()).done);
    S.flowTour.start('days'); flush();
    const daysCard = /홈 구장 지정을 마저/.test(card());
    click('.footer [data-act="fl-next"]'); flush();
    ok('따라 하기(3단계) 1 / 1 · 단계를 떠나면 닫힘(데이터 그대로) · 4 확인 — 1~3 ✓ · 시리즈는 「다음」 때', daysCard && !S.flowTour.cur && G.fs === 4 && qa('.ck-row .ck-i.done').length === 3 && /다음」 때 규칙대로 만듭니다/.test(q('.ck-card').textContent));
    // 4 확인: 맞대결·격년 홈 73/71 고치기
    click('.ck-card [data-act="fl-edit-rules"]'); flush();
    if (q('.ck-ed [data-act="fl-ht-off"]')) { click('.ck-ed [data-act="fl-ht-off"]'); flush(); } // 코어가 2027 기본값을 채워 두었으면 비우고 다시
    click('.ck-ed [data-act="fl-ht-on"]'); flush();
    for (const n of ['한화', 'SSG', 'KT', '롯데', '두산', 'LG']) { click('.ck-ed [data-act="fl-ht-team"][data-team="' + n + '"]'); flush(); }
    const ht = st().settings.homeTotals;
    ok('4 확인 「고치기」: 격년 홈 73 / 71 쓰기 → 홈 73 구단 5곳까지(6번째 LG는 거부) · 1차 편성 홈 68/67', !!ht && ht.more.total === 73 && ht.less.total === 71 && ht.more.initial === 68 && ht.less.initial === 67 && ht.moreTeams.join() === 'SSG,두산,KT,한화,롯데', ht && ht.moreTeams.join());
    if (CalendarGen.seriesOptions) {
      // 코어가 격년 홈으로 시리즈를 만들 때: 홈 73 구단과 개막전 홈 구단이 맞지 않으면 4 확인에 남아 이유를 보여 준다 → 개막전 홈 구단을 홈 73으로 맞추면 통과
      click('.ck-card [data-act="cal-next"]'); flush();
      ok('시리즈를 만들 수 없으면(홈 73 구단 ≠ 개막전 홈) 4 확인에 남아 코어의 이유를 보여 줌', S.ui.step === 1 && G.fs === 4 && !!q('.ck-err') && /시리즈를 만들 수 없습니다/.test(q('.ck-err').textContent));
      for (const n of ['두산', '한화', '롯데', '삼성', 'KIA', 'LG']) { click('.ck-ed [data-act="fl-ht-team"][data-team="' + n + '"]'); flush(); }
    } else { click('.ck-ed [data-act="fl-ht-off"]'); flush(); }
    click('.ck-card [data-act="cal-next"]'); flush();
    ok('「다음: ② 검토·실행」 → 시리즈 규칙대로 225개 · ② · 개막전은 홈 구장만(고정 없음)', S.ui.step === 2 && st().matches.length === 225 && !st().matches.some((m) => m.pinned) && S.flowStatus().allDone, st().matches.length + ' · ' + S.flowStatus().stop);
    S.autosave.flush();
    S.flowPickYear(); flush();
    ok('연도 카드 2027: 이 브라우저에 저장됨 · 4단계 모두 완료', /이 브라우저에 저장됨/.test(q('.yc[data-year="2027"]').textContent) && /4단계 모두 완료/.test(q('.yc[data-year="2027"]').textContent));
    S.switchYear(2025, { quiet: true, to: 'stay' }); flush();
    if (!saved27) S.repo.remove(2027);
    S.flowTour.cur = null;
    G.mode = 'flow'; G.fs = 1;
  };
  /** 금지어 검사용 화면 목록 */
  S.flowScreens = function () {
    const at = (fn) => () => { S.flowTour.cur = null; F.edit = null; if (fn) fn(); };
    return [
      { where: '연도 고르기', patch: {}, fn: at(() => { G.mode = 'year'; }) },
      { where: '어디까지 했는지', patch: {}, fn: at(() => { G.mode = 'resume'; }) },
      { where: '4 확인 — 맞대결·격년 홈 고치기', patch: {}, fn: at(() => { G.mode = 'flow'; G.fs = 4; F.edit = 'rules'; }) },
      { where: '4 확인 — 격년 홈 73/71', patch: {}, fn: at(() => { G.mode = 'flow'; G.fs = 4; F.edit = 'rules'; app().state.settings.homeTotals = { moreTeams: ['한화'], more: { total: 73, initial: 68 }, less: { total: 71, initial: 67 } }; }) },
      { where: '따라 하기 2단계', patch: {}, fn: at(() => { delete app().state.settings.homeTotals; G.mode = 'flow'; G.fs = 2; S.flowTour.cur = { id: 'season', k: 1 }; }) },
      { where: '따라 하기 3단계', patch: {}, fn: at(() => { G.mode = 'flow'; G.fs = 3; S.flowTour.cur = { id: 'days', k: 0 }; }) }
    ];
  };
})();
