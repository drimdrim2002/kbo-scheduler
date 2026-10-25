/*
 * 편성 스튜디오 — ① 입력 안내 (표준): 따라 하기
 * 왼쪽 목록 자리에 붙는 안내 카드. 할 일 8개를 한 장씩 넘기며 카드 안에서 바로 적고(개막일·휴식 요일), 큰 표는 카드의 단추로 만든다
 * (법정 공휴일 채우기 · 규칙대로 자동 채우기 · 맞대결 규칙대로 자동 채우기 · 개막전·어린이날 추가).
 * 「처음부터 입력하기」로 표를 비우면 자동으로 열려 시즌 기본 설정부터 끝까지 이끈다. 예시 데이터에서는 「바꿀 곳만 확인」 말투로 같은 장을 쓴다.
 * 카드는 화면을 덮지 않아서 뒤의 표와 오른쪽 자세히를 그대로 보고 누를 수 있다. 가져오기 창이 열리면 잠시 숨었다가 닫히면 같은 장으로 돌아온다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { esc, icon, fmt } = S;
  const store = S.guideStore('follow');
  // i: 0 = 시작 고르기, 1~ = 할 일 한 장씩
  const F = { open: false, i: 0, min: false, autoTried: false, noAuto: false, fromImport: false, fromReset: false, html: '' };
  const tasks = () => S.GUIDE_TASKS;
  const pages = () => tasks().length;          // 할 일 장 수
  const app = () => S.app;
  const blank = () => S.isBlank();
  const T = (x) => S.gtxt(x);
  const KBOgen = () => S.KBO.CalendarGen;

  function show(i) {
    F.open = true; F.min = false;
    F.i = Math.max(0, Math.min(pages(), i));
    if (F.i > 0) store.set({ at: F.i }); // 시작 고르기 장은 멈춘 곳을 지우지 않는다
    const t = F.i > 0 ? tasks()[F.i - 1] : null;
    if (t && t.tab && (S.ui.step !== 1 || S.ui.tab !== t.tab)) S.guideGoTab(t.tab);
    else if (S.ui.step !== 1) S.go({ step: 1, ops: null });
    else S.render();
  }
  function markDone() {
    if (F.i < 1) return;
    const done = Object.assign({}, store.get().done, { [tasks()[F.i - 1].id]: true });
    store.set({ done });
  }
  function close(finished) {
    F.open = false; F.fromReset = false;
    store.set(finished ? { seen: true, at: 0 } : { seen: true, at: F.i });
    S.render();
  }
  const pageOf = (id) => tasks().findIndex((t) => t.id === id) + 1;

  // ───────── 장마다 본문 ─────────
  const tabBtn = (tab, label) => '<button class="btn xs" data-act="d-tab" data-tab="' + tab + '">' + esc(label || '표 열기') + icon('right') + '</button>';
  const line = (label, value, right) => '<div class="gf-line"><span class="gf-k">' + esc(label) + '</span><span class="gf-v">' + value + '</span>' + (right || '') + '</div>';
  const chip = (st) => S.stat(st.kind === 'todo' ? 'todo' : st.kind, st.kind === 'ok' ? '됨' : st.kind === 'todo' ? '아직' : '확인 필요');
  function sheetCount(key) {
    const sh = S.SHEETS[key], st = app().state, n = sh.rows(st).length;
    let e = 0;
    for (let k = 0; k < n; k++) for (const x of sh.rowIssues(st, k)) if (x.level === 'error') e++;
    return { n, e };
  }
  function balanceLines() {
    const st = app().state, half = st.teams.length >> 1;
    const sh = KBOgen().lengthHistogram(st.calendar), mh = KBOgen().lengthHistogram(st.matches);
    let s = '';
    for (const k of [2, 3, 4]) {
      const cap = (sh[k] || 0) * half, need = mh[k] || 0;
      if (!cap && !need) continue;
      s += line(k + '연전', '기간 ' + (sh[k] || 0) + '개 × ' + half + ' = ' + cap + ' · 시리즈 ' + need, cap === need ? S.stat('ok', '맞음') : S.stat('warn', need > cap ? '부족 ' + (need - cap) : '여유 ' + (cap - need)));
    }
    return s || '<div class="gf-hint">연전 기간을 만들면 여기서 연전 수를 맞춰 봅니다.</div>';
  }
  function gameDaysLine() {
    const set = app().state.settings;
    if (!set.seasonStart || !set.initialEnd) return line('경기일 합', '<span class="muted">개막일·종료일을 적으면 셉니다</span>');
    const gd = S.gameDaysCheck(KBOgen().generateSlots(set).slots);
    return line('경기일 합', gd.have + '일 / 필요 ' + gd.need + '일', gd.ok ? S.stat('ok', '맞음') : S.stat('warn', gd.have < gd.need ? (gd.need - gd.have) + '일 부족' : (gd.have - gd.need) + '일 많음')) +
      (gd.ok ? '' : '<div class="gf-hint">' + (gd.have < gd.need ? '1차 편성 종료일을 늦추거나 휴식기를 줄이세요.' : '1차 편성 종료일을 당기거나, 다음 장에서 휴식기(올스타 휴식기 등)를 넣으세요.') + ' 맞대결 ' + set.initialGamesPerPair + '경기 × 상대 ' + (app().state.teams.length - 1) + '구단 = ' + gd.need + '일이어야 시리즈가 빈 자리 없이 들어갑니다.</div>');
  }

  const BODY = {
    start() {
      const li = S.ui.lastImport;
      if (blank()) {
        return (F.fromImport ? '<div class="gf-note ok">' + icon('check') + '<span>가져오기 창을 닫았습니다. 이제 가져온 내용을 아래 순서로 하나씩 확인합니다.</span></div>' : F.fromReset ? '<div class="gf-note ok">' + icon('check') + '<span>표를 모두 비웠습니다. 구단과 거리만 남아 있습니다.</span></div>' : '') +
          '<div class="gf-key"><div class="gf-key-row"><b>직접 적는 것</b><span>개막일·종료일 3개, 휴식일 경기·휴식기 한두 줄</span></div><div class="gf-key-row"><b>단추로 만드는 것</b><span>공휴일 · 연전 기간 · 시리즈 · 개막전·어린이날</span></div></div>' +
          '<div class="gf-hint">「다음」을 누르면 시즌 기본 설정부터 차례로 안내합니다. 엑셀 파일이 이미 있으면 「엑셀 올리기」로 한 번에 넣어도 됩니다.</div>';
      }
      return (F.fromImport ? '<div class="gf-note ok">' + icon('check') + '<span>가져오기 창을 닫았습니다. 이제 가져온 내용을 아래 순서로 하나씩 확인합니다.</span></div>' : '') +
        line('지금 데이터', esc(li ? li.source : '2025 실제 일정(기본 제공)')) +
        '<div class="gf-hint">엑셀이 없으면 그대로 「다음」을 누르세요. 지금 들어 있는 값을 하나씩 확인합니다. 빈 상태에서 처음부터 적어 보려면 「처음부터 입력하기」입니다.</div>';
    },
    season() {
      const set = app().state.settings;
      const wd = ['일', '월', '화', '수', '목', '금', '토'];
      const inp = (k, label, ph) => '<label class="field"><span>' + esc(label) + '</span><input class="input sm" data-in="season" data-k="' + k + '" value="' + esc(set[k] ? fmt.date(set[k]) : '') + '" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '"></label>';
      return (F.fromReset ? '<div class="gf-note ok">' + icon('check') + '<span>표를 모두 비웠습니다. 직접 적는 건 아래 날짜 3개와 다음 장의 한두 줄뿐이고, 큰 표는 단추로 만듭니다.</span></div>' : '') +
        '<div class="gf-form">' + inp('seasonStart', '개막일', '예: 2025-03-22') + inp('initialEnd', '1차 편성 종료일', '예: 2025-08-31') + inp('seasonEnd', '시즌 종료일', '예: 2025-10-31') + '</div>' +
        '<div class="field" style="margin-top:8px"><span>휴식 요일 (누르면 켜고 끕니다)</span><div class="wd">' + wd.map((n, k) => '<button class="' + (set.restWeekdays.includes(k) ? 'on' : '') + '" data-act="rest-wd" data-wd="' + k + '" aria-pressed="' + set.restWeekdays.includes(k) + '">' + n + '</button>').join('') + '</div></div>' +
        '<div class="gf-sub" style="margin-top:10px">경기일 합 맞추기</div>' + gameDaysLine() +
        '<div class="gf-hint">날짜는 2025-03-22나 3/22처럼 적고 Enter를 누르면 바로 반영됩니다. 가운데 시즌 달력에 바로 보입니다.</div>';
    },
    dates() {
      const rows = [['holidays', '공휴일', blank() ? '「법정 공휴일 채우기」 한 번' : '휴일 경기를 고르게 나눌 때 씁니다'], ['restex', '휴식일 경기', '휴식 요일이지만 경기하는 날 · 예: 5/5(월)'], ['blackouts', '휴식기', '올스타 휴식기처럼 경기 없는 기간']];
      return rows.map(([k, label, sub]) => { const c = sheetCount(k); return '<div class="gf-line"><span class="gf-k">' + esc(label) + '<small>' + esc(sub) + '</small></span><span class="gf-v">' + c.n + '개</span>' + (c.e ? S.stat('block', '오류 ' + c.e) : c.n ? S.stat('ok', '문제 없음') : '') + tabBtn(k) + '</div>'; }).join('') +
        '<div class="gf-sub" style="margin-top:10px">경기일 합</div>' + gameDaysLine() +
        '<div class="gf-hint">휴식일 경기와 휴식기는 표를 열어 「첫 줄 추가」를 누르고 날짜 칸을 두 번 눌러 고칩니다. 휴식기를 넣으면 경기일 합이 줄어듭니다.</div>';
    },
    slots() {
      const st = app().state, c = sheetCount('slots');
      return line('연전 기간', st.calendar.length + '개', c.e ? S.stat('block', '오류 ' + c.e) : st.calendar.length ? S.stat('ok', '문제 없음') : '') +
        (st.calendar.length ? '' : gameDaysLine()) +
        '<div class="gf-sub">연전 수 맞추기 <small>연전 기간마다 ' + (st.teams.length >> 1) + '시리즈</small></div>' + balanceLines() +
        '<div class="gf-hint">' + (st.calendar.length ? '시리즈를 아직 안 만들었으면 「여유」로 보이는 게 정상입니다. 다음 장에서 시리즈를 만들면 모두 「맞음」이 됩니다.' : '아래 단추를 누르면 시즌 기본 설정대로 만든 결과를 먼저 보여 주고, 「적용」을 누르면 표가 채워집니다.') + '</div>';
    },
    series() {
      const st = app().state, c = sheetCount('series'), s = st.settings;
      return line('시리즈', st.matches.length + '개', c.e ? S.stat('block', '오류 ' + c.e) : st.matches.length ? S.stat('ok', '문제 없음') : '') +
        line('맞대결마다', s.initialGamesPerPair + '경기 (홈 ' + s.homeGamesMajor + ' · 원정 ' + (s.initialGamesPerPair - s.homeGamesMajor) + ')') +
        (st.matches.length ? '<div class="gf-sub">연전 수 맞추기</div>' + balanceLines() : '') +
        '<div class="gf-hint">' + (st.calendar.length ? '오른쪽 자세히의 「맞대결 경기 수」 표에서 노란 칸(!)이 없으면 됩니다.' : '연전 기간을 먼저 만들어야 합니다(이전 장).') + '</div>';
    },
    events() {
      const st = app().state;
      return (st.events.length ? st.events.slice(0, 6).map((e) => '<div class="gf-line"><span class="gf-k">' + esc(e.name) + '</span><span class="gf-v">' + esc(fmt.short(e.date)) + ' · ' + (e.mode === 'MATCH' ? '대진 지정' + (e.home ? ' ' + esc(e.away + ' 대 ' + e.home) : '') : '구장 지정 ' + (e.stadiums || []).length + '곳') + '</span></div>').join('') +
        (st.events.length > 6 ? '<div class="gf-hint">외 ' + (st.events.length - 6) + '개</div>' : '') : line('특별 경기', '아직 없음')) +
        '<div class="gf-hint">' + (st.matches.length ? '개막전은 개막일 연전 기간의 대진을 그대로 고정합니다. 대진을 바꾸려면 표에서 홈·원정 칸을 고치세요. 어린이날 구장은 구장 칸에 쉼표로 적습니다.' : '시리즈를 먼저 만들어야 개막전 대진을 정할 수 있습니다(이전 장). 특별 경기는 없어도 편성할 수 있습니다.') + '</div>' +
        '<div class="gf-row">' + tabBtn('events', '특별 경기 표 열기') + '</div>';
    },
    teams() {
      const st = app().state, sh = Array.from(app().sharedStadiums().keys());
      return line('구단', st.teams.length + '개') + line('같이 쓰는 구장', esc(sh.join(', ') || '없음')) +
        '<div class="gf-hint">그대로 두면 됩니다. 「처음부터 입력하기」로 비워도 이 표는 남겨 둡니다. 표에서 구단을 고르면 오른쪽에 다른 구장까지 거리가 나오고, 구단명·구장은 오른쪽 칸에서 고칩니다.</div>';
    },
    next() {
      const done = store.get().done;
      return tasks().filter((t) => t.id !== 'next' && t.id !== 'start').map((t) => { const st = t.status(); return '<div class="gf-line"><span class="gf-k">' + esc(t.title) + '</span><span class="gf-v small" title="' + esc(st.text) + '">' + esc(st.text) + '</span>' + (st.ok ? S.stat('ok', done[t.id] ? '확인함' : '됨') : S.stat(st.kind === 'todo' ? 'todo' : 'warn', st.kind === 'todo' ? '아직' : '확인 필요')) + '</div>'; }).join('') +
        '<div class="gf-hint">② 검토·실행에서 편성할 수 없는 입력이 있는지 한 번 더 점검하고 자동 편성을 돌립니다.</div>';
    }
  };

  // ───────── 카드 ─────────
  function choiceCard() {
    const saved = store.get();
    const pick = (v, ic, title, sub, cls) => '<button class="gf-pick' + (cls ? ' ' + cls : '') + '" data-act="gf-pick" data-v="' + v + '">' + icon(ic) + '<span><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span>' + icon('right') + '</button>';
    const resume = saved.at > 1 && saved.at <= pages() ? pick('resume', 'redo', '이어서 할게요', '지난번 멈춘 곳(' + tasks()[saved.at - 1].title + ', ' + saved.at + ' / ' + pages() + ')부터') : '';
    return '<div class="gf-card gf-choice" role="dialog" aria-modal="false" aria-labelledby="gfTitle">' +
      '<div class="gf-head"><span class="gf-kicker">① 데이터 준비 · 따라 하기</span><button class="btn xs ghost icon" data-act="gf-close" title="닫기">' + icon('x') + '</button></div>' +
      '<div class="gf-body"><h3 id="gfTitle">어떻게 시작할까요?</h3>' +
      (blank()
        ? '<p class="gf-why">표가 비어 있습니다. 직접 적는 것은 날짜 몇 개뿐이고, 연전 기간·시리즈 같은 큰 표는 단추로 만듭니다. ' + pages() + '장이면 끝납니다.</p>' + resume +
          pick('steps', 'list', saved.at > 1 ? '처음부터 하나씩 적을게요' : '하나씩 적을게요', '시즌 기본 설정부터 차례로 이끌어 드립니다', 'rec') +
          pick('xlsx', 'upload', '엑셀 파일이 있어요', '파일을 올려 모든 표를 한 번에 가져온 뒤 확인합니다') +
          pick('browse', 'eye', '그냥 둘러볼게요', '안내를 닫습니다. 위쪽 「입력 안내」로 언제든 다시 엽니다')
        : '<p class="gf-why">편성에 필요한 시즌 정보를 ' + pages() + '가지 순서로 확인합니다. 지금은 2025 실제 일정이 들어 있어서 바꿀 곳만 고치면 됩니다.</p>' + resume +
          pick('reset', 'plus', '처음부터 입력해 볼게요', '표를 모두 비우고 빈 상태에서 하나씩 적습니다(구단과 거리는 남김)', 'rec') +
          pick('xlsx', 'upload', '엑셀 파일이 있어요', '파일을 올려 모든 표를 한 번에 가져온 뒤 확인합니다') +
          pick('steps', 'list', saved.at > 1 ? '처음부터 하나씩 확인할게요' : '지금 데이터를 하나씩 확인할게요', '시즌 기본 설정부터 차례로 짚어 드립니다') +
          pick('browse', 'eye', '지금 데이터로 둘러볼게요', '안내를 닫습니다. 위쪽 「입력 안내」로 언제든 다시 엽니다')) +
      '</div></div>';
  }
  function pageCard() {
    const t = tasks()[F.i - 1], st = t.status(), done = store.get().done;
    const last = F.i === pages();
    const nowT = S.guideNext(), nowI = pageOf(nowT.id);
    const isStatus = t.id !== 'start';
    return '<div class="gf-card gf-page" role="dialog" aria-modal="false" aria-labelledby="gfTitle" data-page="' + t.id + '" data-status="' + st.kind + '">' +
      '<div class="gf-head"><span class="gf-kicker">따라 하기 · ' + F.i + ' / ' + pages() + '</span>' +
        '<button class="btn xs ghost" data-act="gf-min" title="안내를 작게 접습니다">' + icon('down') + '접기</button>' +
        '<button class="btn xs ghost icon" data-act="gf-close" title="닫기">' + icon('x') + '</button></div>' +
      '<div class="gf-steps" aria-hidden="true">' + tasks().map((x, k) => { const xs = k + 1 === F.i ? 'on' : x.id === 'start' ? (done.start ? 'done' : '') : x.status().ok ? 'done' : ''; return '<i class="' + xs + '" title="' + esc(x.title) + '"></i>'; }).join('') + '</div>' +
      '<div class="gf-body"><h3 id="gfTitle">' + esc(t.title) + (isStatus ? chip(st) : '') + '</h3>' +
        '<p class="gf-why">' + esc(T(t.why)) + '</p>' +
        (isStatus ? '<div class="gf-how">' + icon('bolt') + '<span>' + esc(T(t.how)) + '</span></div>' : '') +
        BODY[t.id]() +
        (isStatus ? '<div class="gf-status ' + st.kind + '">' + S.stat(st.kind, st.kind === 'ok' ? '지금 상태' : st.kind === 'todo' ? '아직' : '확인 필요') + '<span>' + esc(st.text) + '</span></div>' : '') +
        '<div class="gf-row gf-acts">' + S.guideActButtons(t, 'sm') + '</div>' +
        (nowI !== F.i && nowT.id !== 'next' && isStatus ? '<div class="gf-now">' + icon('info') + '<span>지금 할 일: <b>' + esc(nowT.title) + '</b></span><button class="btn xs" data-act="gf-go" data-i="' + nowI + '">그 장으로' + icon('right') + '</button></div>' : '') +
        '<details class="gf-more"><summary>이 화면에서 보는 곳</summary><ul>' + t.spots.map((sp) => '<li><b>' + esc(T(sp.title)) + '</b> — ' + esc(T(sp.text)) + '</li>').join('') + '</ul></details>' +
      '</div>' +
      '<div class="gf-foot"><button class="btn sm ghost" data-act="gf-close">건너뛰기</button><span class="gf-sp"></span>' +
        '<button class="btn sm" data-act="gf-go" data-i="' + (F.i - 1) + '">' + icon('left') + '이전</button>' +
        (last ? '<button class="btn sm primary" data-act="gf-step2">다음: 검토·실행' + icon('right') + '</button>' : '<button class="btn sm primary" data-act="gf-next">다음' + icon('right') + '</button>') +
      '</div></div>';
  }
  function pill() {
    const t = F.i > 0 ? tasks()[F.i - 1] : null;
    return '<button class="gf-pill" data-act="gf-max" title="안내를 펼칩니다">' + icon('info') + '<span>따라 하기 ' + F.i + ' / ' + pages() + (t ? ' · ' + esc(t.title) : '') + '</span>' + icon('right') + '</button>';
  }

  function after(box) {
    const u = S.ui;
    if (u.guideReq != null) {
      const req = u.guideReq; u.guideReq = null;
      if (req === '0') F.noAuto = true;
      else {
        const n = parseInt(req, 10);
        F.autoTried = true; F.open = true; F.min = false;
        F.i = n >= 2 ? Math.min(pages(), n - 1) : Math.min(pages(), store.get().at || 0);
        const t = F.i > 0 ? tasks()[F.i - 1] : null;
        if (t && t.tab && u.tab !== t.tab) setTimeout(() => S.guideGoTab(t.tab), 0);
      }
    }
    if (!F.open && !F.autoTried && !F.noAuto && S.guideAutoOK() && !store.get().seen) { F.autoTried = true; F.open = true; F.i = 0; }
    let html = '';
    if (F.open && !S.guideBlocked() && u.step === 1) html = F.min ? pill() : F.i === 0 ? choiceCard() : pageCard();
    // 카드를 펼친 동안은 왼쪽 목록 자리를 넓혀 그 자리에 붙인다(가운데 표와 오른쪽 자세히는 가리지 않는다)
    const dock = !!html && !F.min;
    document.body.classList.toggle('gf-dock', dock);
    // 같은 내용이면 다시 그리지 않는다(카드 안 입력 칸의 커서를 지킨다)
    if (html !== F.html || (box.innerHTML === '' && html)) { box.innerHTML = html; F.html = html; }
    const c = box.querySelector('.gf-card');
    const r = c && S.guideRect('.pane.list');
    if (c && r) { c.style.left = Math.round(r.left) + 'px'; c.style.top = Math.round(r.top) + 'px'; c.style.width = Math.round(r.width) + 'px'; c.style.height = Math.round(r.height) + 'px'; }
  }

  Object.assign(S.actions, {
    'guide-open': () => { F.autoTried = true; F.fromImport = false; F.fromReset = false; show(0); },
    'gf-pick': (el) => {
      const v = el.dataset.v;
      if (v === 'browse') { close(false); return; }
      if (v === 'resume') { show(store.get().at); return; }
      if (v === 'xlsx') { F.fromImport = true; F.open = true; F.i = 1; store.set({ at: 1 }); S.openImport('xlsx'); return; }
      if (v === 'reset') { F.open = true; F.i = 1; S.ui.resetKind = 'blank'; S.go({ modal: 'reset', menu: null }); return; }
      F.fromImport = false; show(1);
    },
    'gf-go': (el) => { F.fromReset = false; show(+el.dataset.i); },
    'gf-next': () => { markDone(); F.fromReset = false; show(F.i + 1); },
    'gf-finish': () => { markDone(); close(true); },
    'gf-close': () => close(false),
    'gf-min': () => { F.min = true; S.render(); },
    'gf-max': () => { F.min = false; S.render(); },
    'gf-step2': () => { markDone(); close(true); S.go({ step: 2, ops: null, sel: null, edit: null }); }
  });

  S.guideUI = {
    after,
    button: () => '<button class="btn sm gf-open" data-act="guide-open" title="① 데이터 준비를 하나씩 따라 하며 채웁니다">' + icon('info') + '입력 안내</button>',
    onKey(e) {
      if (!F.open || S.guideBlocked() || S.ui.step !== 1) return false;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
      if (e.key === 'Escape') { e.preventDefault(); close(false); return true; }
      return false;
    },
    /** 「처음부터 입력하기」 직후: 시즌 기본 설정 장부터 연다 */
    onReset() {
      F.autoTried = true; F.open = true; F.min = false; F.fromImport = false; F.fromReset = true;
      store.set({ at: pageOf('season'), done: {} });
      show(pageOf('season'));
    },
    close() { F.open = false; S.render(); },
    state: () => ({ open: F.open, i: F.i, min: F.min }),
    screens() {
      const out = [{ where: '따라 하기 시작 고르기', patch: { tab: 'slots' }, fn: () => { store.set({ at: 4 }); F.open = true; F.min = false; F.i = 0; } }];
      for (let k = 1; k <= pages(); k++) {
        const t = tasks()[k - 1];
        out.push({ where: '따라 하기 ' + k, patch: { tab: t.tab || 'slots' }, fn: () => { F.open = true; F.min = false; F.i = k; F.fromImport = k === 1; F.fromReset = false; } });
      }
      out.push({ where: '따라 하기 접음', patch: { tab: 'slots' }, fn: () => { F.open = true; F.min = true; F.i = 4; } });
      // 빈 상태의 장들
      out.push({ where: '따라 하기 빈 상태 시작 고르기', patch: { tab: 'season' }, fn: () => { S.resetAll({ quiet: true, stay: true }); F.open = true; F.min = false; F.i = 0; } });
      for (let k = 1; k <= pages(); k++) {
        const t = tasks()[k - 1];
        out.push({ where: '따라 하기 빈 ' + k, patch: { tab: t.tab || 'season' }, fn: () => { F.open = true; F.min = false; F.i = k; F.fromReset = k === 2; } });
      }
      out.push({ where: '따라 하기 예시 복귀', patch: { tab: 'slots' }, fn: () => { F.open = false; S.loadExample({ quiet: true, stay: true }); } });
      return out;
    },
    async selftest({ ok, click, flush }) {
      const box = document.getElementById('guide');
      const card = () => box.querySelector('.gf-card');
      const st = () => app().state;
      const enter = (sheet, row, col, v) => { S.startEdit(sheet, row, col, v); document.getElementById('cellEditor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush(); };
      ok('따라 하기: 자가 점검에서는 자동으로 뜨지 않음', !F.open && !box.innerHTML);
      store.reset();
      click('.band [data-act="guide-open"]'); flush();
      ok('따라 하기: 띠 단추 → 시작 고르기(예시 데이터: 처음부터·엑셀·하나씩·둘러보기)', F.open && F.i === 0 && box.querySelectorAll('.gf-choice [data-act="gf-pick"]').length === 4 && !!box.querySelector('[data-act="gf-pick"][data-v="reset"]') && !S.ui.modal);
      const lr = S.guideRect('.pane.list'), cr = card().getBoundingClientRect(), mr = S.guideRect('.pane.main');
      ok('따라 하기: 카드는 왼쪽 목록 자리에만, 가운데 표는 가리지 않음', getComputedStyle(box).pointerEvents === 'none' && getComputedStyle(card()).pointerEvents === 'auto' && Math.abs(cr.left - lr.left) < 2 && Math.abs(cr.right - lr.right) < 2 && cr.right <= mr.left + 1 && document.body.classList.contains('gf-dock'));
      // 처음부터 입력해 볼게요 → 확인 창 → 비움 → 시즌 기본 설정 장이 자동으로 열림
      click('.gf-choice [data-act="gf-pick"][data-v="reset"]'); flush();
      ok('따라 하기: 「처음부터 입력해 볼게요」 → 확인 창, 카드는 잠시 숨김', S.ui.modal === 'reset' && !card());
      click('.reset-modal [data-act="reset-go"]'); flush();
      ok('따라 하기: 표 비움 → 시즌 기본 설정 장(2 / ' + pages() + ')이 열리고 날짜 칸 3개가 비어 있음', S.isBlank() && F.open && F.i === pageOf('season') && S.ui.tab === 'season' && card().getAttribute('data-page') === 'season' && card().getAttribute('data-status') === 'todo' && box.querySelectorAll('.gf-form input[data-k]').length === 3 && Array.from(box.querySelectorAll('.gf-form input[data-k]')).every((i) => i.value === '') && /비웠습니다/.test(card().textContent));
      const put = (k, v) => { const i = box.querySelector('.gf-page input[data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      put('seasonStart', '2025-03-22'); put('initialEnd', '8/31'); put('seasonEnd', '2025-10-31');
      ok('따라 하기: 카드 안 날짜 3개 입력 → 반영 · 경기일 합 140 / 135 「5일 많음」 안내', st().settings.seasonStart === '2025-03-22' && st().settings.initialEnd === '2025-08-31' && /140일 \/ 필요 135일/.test(card().textContent) && /5일 많음/.test(card().textContent) && card().getAttribute('data-status') === 'warn');
      click('.gf-page [data-act="gf-next"]'); flush();
      ok('따라 하기: 다음 → 공휴일·휴식일 경기·휴식기 장(공휴일 화면)', F.i === pageOf('dates') && S.ui.tab === 'holidays' && card().getAttribute('data-page') === 'dates');
      click('.gf-page .gf-acts [data-act="fill-holidays"]'); flush();
      ok('따라 하기: 카드의 「법정 공휴일 채우기」 → 10일', st().settings.holidays.length === 10 && /10개/.test(card().textContent));
      click('.gf-page [data-act="d-tab"][data-tab="restex"]'); flush();
      click('.sheet-empty [data-act="row-ins"]'); flush(); enter('restex', 0, 'date', '5/5');
      click('.gf-page [data-act="d-tab"][data-tab="blackouts"]'); flush();
      click('.sheet-empty [data-act="row-ins"]'); flush(); enter('blackouts', 0, 'start', '5/8'); enter('blackouts', 0, 'end', '5/8'); enter('blackouts', 0, 'name', '어린이날 3연전 뒤 휴식');
      S.ui.cell = null; flush(); click('.toolbar [data-act="row-ins"][data-pos="below"]'); flush(); enter('blackouts', 1, 'start', '7/11'); enter('blackouts', 1, 'end', '7/16'); enter('blackouts', 1, 'name', '올스타 브레이크');
      ok('따라 하기: 카드의 「표 열기」로 휴식일 경기 1·휴식기 2 입력 → 같은 장 유지 · 경기일 합 맞음', F.i === pageOf('dates') && card() && card().getAttribute('data-page') === 'dates' && st().settings.restExceptions.length === 1 && st().settings.blackouts.length === 2 && /135일 \/ 필요 135일/.test(card().textContent) && card().getAttribute('data-status') === 'ok');
      click('.gf-page [data-act="gf-next"]'); flush();
      ok('따라 하기: 다음 → 연전 기간 장 · 「아직」 · 자동 채우기 단추', F.i === pageOf('slots') && S.ui.tab === 'slots' && card().getAttribute('data-status') === 'todo' && !!box.querySelector('.gf-acts [data-act="draft-slots"]'));
      click('.gf-page .gf-acts [data-act="draft-slots"]'); flush();
      ok('따라 하기: 자동 채우기 → 미리보기 창, 카드는 잠시 숨김', S.ui.modal === 'import' && S.ui.imp && S.ui.imp.kind === 'draft-slots' && !card());
      click('.modal [data-act="imp-apply"]'); flush();
      ok('따라 하기: 적용 → 연전 기간 45개 · 같은 장에서 「됨」', !S.ui.modal && st().calendar.length === 45 && F.i === pageOf('slots') && card().getAttribute('data-status') === 'ok' && /45개/.test(card().textContent));
      click('.gf-page [data-act="gf-next"]'); flush();
      click('.gf-page .gf-acts [data-act="draft-series"]'); flush();
      click('.modal [data-act="imp-apply"]'); flush();
      ok('따라 하기: 시리즈 장 → 자동 채우기 → 225개 · 연전 수 모두 맞음 · 「됨」', F.i === pageOf('series') && st().matches.length === 225 && card().getAttribute('data-status') === 'ok' && (card().textContent.match(/맞음/g) || []).length >= 3);
      click('.gf-page [data-act="gf-next"]'); flush();
      click('.gf-page .gf-acts [data-act="add-opening"]'); flush();
      click('.gf-page .gf-acts [data-act="add-children"]'); flush();
      ok('따라 하기: 특별 경기 장 → 개막전 5·어린이날 1 추가 · 「됨」', F.i === pageOf('events') && st().events.length === 6 && card().getAttribute('data-status') === 'ok' && /개막전/.test(card().textContent) && /어린이날/.test(card().textContent));
      click('.gf-page [data-act="gf-next"]'); flush();
      ok('따라 하기: 구단과 거리 장(그대로)', F.i === pageOf('teams') && S.ui.tab === 'teams' && /10개/.test(card().textContent));
      click('.gf-page [data-act="gf-next"]'); flush();
      ok('따라 하기: 마지막 장 — 할 일 모두 「됨」·「다음: 검토·실행」', F.i === pages() && card().getAttribute('data-status') === 'ok' && !!box.querySelector('[data-act="gf-step2"]') && !box.querySelector('.gf-now'));
      // 모든 장이 화면 안 · 페이지 스크롤 0 (빈 상태에서 채운 데이터)
      const bad = [];
      for (let k = 0; k <= pages(); k++) {
        S.actions['gf-go']({ dataset: { i: k } }); flush();
        const r = card() && card().getBoundingClientRect();
        if (!r || r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight || !S.checkScroll().ok) bad.push(k);
      }
      ok('따라 하기: ' + (pages() + 1) + '장 모두 화면 안 · 페이지 스크롤 0', !bad.length, bad.join(','));
      S.actions['gf-go']({ dataset: { i: pages() } }); flush();
      click('[data-act="gf-step2"]'); flush();
      ok('따라 하기: 「다음: 검토·실행」 → ②로 · 닫히고 처음부터로 저장 · 사전 점검 진행 불가 0', S.ui.step === 2 && !F.open && store.get().seen && store.get().at === 0 && app().preflight().counts.block === 0);
      // 접기·이어서·Esc·주소
      S.go({ step: 1, tab: 'slots' });
      click('.band [data-act="guide-open"]'); flush();
      ok('따라 하기: 빈 상태 시작 고르기 3가지(하나씩·엑셀·둘러보기)', F.i === 0 && box.querySelectorAll('.gf-choice [data-act="gf-pick"]').length === 3 && !box.querySelector('[data-v="reset"]'));
      click('.gf-choice [data-act="gf-pick"][data-v="steps"]'); flush();
      ok('따라 하기: 하나씩 → 1 / ' + pages() + ' 시작하기(직접 적는 것·단추로 만드는 것)', F.i === 1 && card().getAttribute('data-page') === 'start' && /단추로 만드는 것/.test(card().textContent));
      click('.gf-page [data-act="gf-min"]'); flush();
      ok('따라 하기: 접기 → 작은 단추', !card() && !!box.querySelector('.gf-pill'));
      click('.gf-pill'); flush();
      ok('따라 하기: 펼치기', !!card() && F.i === 1);
      S.actions['gf-go']({ dataset: { i: 5 } }); flush();
      click('.gf-page .gf-foot [data-act="gf-close"]'); flush();
      ok('따라 하기: 건너뛰기 → 닫고 본 것으로 저장', !F.open && !box.innerHTML && !document.body.classList.contains('gf-dock') && store.get().seen === true && store.get().at === 5);
      click('.band [data-act="guide-open"]'); flush();
      const res = box.querySelector('[data-act="gf-pick"][data-v="resume"]');
      ok('따라 하기: 다시 열면 「이어서 할게요」', !!res && /5 \/ /.test(res.textContent));
      res.click(); flush();
      ok('따라 하기: 이어서 → 멈춘 장', F.i === 5 && S.ui.tab === tasks()[4].tab);
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); flush();
      ok('따라 하기: Esc로 닫기', !F.open);
      click('.band [data-act="guide-open"]'); flush();
      click('.gf-choice [data-act="gf-pick"][data-v="xlsx"]'); flush();
      const impOpen = S.ui.modal === 'import' && S.ui.imp.kind === 'xlsx' && !card();
      click('.modal [data-act="close-modal"]'); flush();
      ok('따라 하기: 엑셀 → 가져오기 창 → 닫으면 확인 순서로', impOpen && F.i === 1 && /가져온 내용/.test(card().textContent));
      S.ui.guideReq = '4'; F.autoTried = true; S.render(); await new Promise((r) => setTimeout(r, 20)); flush();
      ok('따라 하기: 주소 guide=4 → 3번째 할 일(' + tasks()[2].title + ')', F.open && F.i === 3 && S.ui.tab === tasks()[2].tab);
      // 예시 데이터로 복귀 → 예시 데이터 말투
      F.open = false; S.loadExample({ quiet: true, stay: true }); S.go({ step: 1, tab: 'slots', ops: null, cell: null, edit: null });
      click('.band [data-act="guide-open"]'); flush();
      click('.gf-choice [data-act="gf-pick"][data-v="steps"]'); flush();
      ok('따라 하기: 예시 데이터에서는 「2025 실제 일정」 확인 말투', !S.isBlank() && /2025 실제 일정/.test(card().textContent));
      S.actions['gf-go']({ dataset: { i: pageOf('season') } }); flush();
      const end0 = st().settings.initialEnd;
      put('initialEnd', '2025-08-30');
      const changed = st().settings.initialEnd === '2025-08-30' && !!document.querySelector('.pane.main input[data-k="initialEnd"][value="' + fmt.date('2025-08-30') + '"]');
      app().undo(); flush();
      ok('따라 하기: 카드 안 날짜 입력 → 바로 반영(실행 취소 가능)', changed && st().settings.initialEnd === end0);
      click('.gf-page [data-act="rest-wd"][data-wd="2"]'); flush();
      const wdOn = st().settings.restWeekdays.includes(2) && !!box.querySelector('[data-act="rest-wd"][data-wd="2"].on');
      app().undo(); flush();
      ok('따라 하기: 카드 안 휴식 요일 → 반영', wdOn && !st().settings.restWeekdays.includes(2));
      click('[data-act="gf-close"]'); flush();
      click('.band [data-act="guide-open"]'); flush();
      click('[data-act="gf-pick"][data-v="browse"]'); flush();
      ok('따라 하기: 둘러보기 → 닫힘', !F.open && store.get().seen);
      F.open = false; store.reset(); S.go({ tab: 'slots' });
    }
  };
})();
