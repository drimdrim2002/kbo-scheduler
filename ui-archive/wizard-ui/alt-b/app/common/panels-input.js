/*
 * 화면 공통 — 입력 패널: 구단·구장(FR-T), 거리 행렬, 일정 골격(FR-S), 슬롯, 시리즈, 이벤트(FR-E), 설정.
 * 각 패널은 (el, app, opts) → { refresh, destroy }. 이벤트는 el에 한 번만 위임한다.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels || (UI.panels = {});
  const { esc, fmt, on } = UI;
  const { Dates, CalendarGen } = KBO;

  const lockNote = (app) => (app.isRunning() ? '<div class="k-lock" role="status">🔒 엔진 실행 중 — 입력이 잠겨 있습니다.</div>' : '');
  const dis = (app) => (app.isRunning() ? ' disabled' : '');

  // ───────────── 구단·구장 ─────────────
  P.teams = function (el, app, opts) {
    const o = opts || {};
    let candidates = null; // { team, results, source, note }
    const render = () => {
      const st = app.state;
      const shared = app.sharedStadiums();
      let h = lockNote(app) + '<div class="k-toolbar"><button class="k-btn" data-act="add"' + dis(app) + '>＋ 구단 추가</button><button class="k-btn k-btn-ghost" data-act="preset"' + dis(app) + '>2025 프리셋 불러오기</button><span class="k-muted">구장명을 입력하고 🔍(또는 Enter)를 누르면 위치를 찾습니다. ' + (app.kakaoKey ? (app.kakao ? 'Kakao 장소 검색 사용 중.' : 'Kakao 준비 중/실패 시 내장 사전.') : '키가 없어 내장 구장 사전을 씁니다.') + '</span></div>';
      h += '<div class="k-table-wrap"><table class="k-table k-teams"><thead><tr><th>색</th><th>구단명</th><th>구장명</th><th>위도</th><th>경도</th><th>상태</th><th></th></tr></thead><tbody>';
      st.teams.forEach((t, i) => {
        const sh = shared.get(t.stadium);
        h += '<tr data-i="' + i + '"><td><input type="color" class="k-color" data-f="color" data-fk="tc' + i + '" value="' + esc(t.color) + '" aria-label="' + esc(t.name) + ' 대표 색상"' + dis(app) + '></td>' +
          '<td><input class="k-input k-w-name" data-f="name" data-fk="tn' + i + '" value="' + esc(t.name) + '" aria-label="구단명"' + dis(app) + '></td>' +
          '<td class="k-stadium-cell"><div class="k-inline"><input class="k-input k-w-stadium" data-f="stadium" data-fk="ts' + i + '" value="' + esc(t.stadium) + '" aria-label="구장명"' + dis(app) + '><button class="k-btn k-btn-icon" data-act="search" title="위치 검색" aria-label="' + esc(t.name) + ' 구장 위치 검색"' + dis(app) + '>🔍</button></div>' +
          (candidates && candidates.team === i ? '<div class="k-cands" role="listbox" aria-label="검색 후보">' + (candidates.results.length ? candidates.results.map((r, k) => '<button class="k-cand" data-act="pick" data-k="' + k + '"><b>' + esc(r.name) + '</b> <span class="k-muted">' + esc(r.address || '') + ' · ' + r.latitude.toFixed(4) + ', ' + r.longitude.toFixed(4) + '</span></button>').join('') : '<div class="k-muted">결과 없음</div>') + '<div class="k-muted k-small">출처: ' + (candidates.source === 'KAKAO' ? 'Kakao 장소 검색' : '내장 구장 사전') + (candidates.note ? ' — ' + esc(candidates.note) : '') + ' <button class="k-link" data-act="closecand">닫기</button></div></div>' : '') + '</td>' +
          '<td><input class="k-input k-w-num" type="number" step="0.0001" data-f="latitude" data-fk="la' + i + '" value="' + esc(t.latitude) + '" aria-label="위도"' + dis(app) + '></td>' +
          '<td><input class="k-input k-w-num" type="number" step="0.0001" data-f="longitude" data-fk="lo' + i + '" value="' + esc(t.longitude) + '" aria-label="경도"' + dis(app) + '></td>' +
          '<td>' + (sh ? '<span class="k-chip k-chip-info" title="같은 구장을 쓰는 구단: ' + esc(sh.join('·')) + '">⇄ 공유 구장 (' + esc(sh.filter((n) => n !== t.name).join('·')) + ')</span>' : '') + (app.state.distanceMatrix.some((d) => d.estimated && (d.from === t.name || d.to === t.name)) ? ' <span class="k-chip k-chip-warn" title="직선거리 × 도로계수 추정">≈ 추정 거리</span>' : '') + '</td>' +
          '<td><button class="k-btn k-btn-icon k-btn-danger" data-act="del" aria-label="' + esc(t.name) + ' 삭제"' + dis(app) + '>✕</button></td></tr>';
      });
      h += '</tbody></table></div>';
      el.querySelector('.k-teams-host').innerHTML = h;
    };
    el.innerHTML = '<div class="k-teams-layout' + (o.noMap ? ' k-nomap' : '') + '"><div class="k-teams-host"></div>' + (o.noMap ? '' : '<div class="k-teams-map"></div>') + '</div>';
    const host = el.querySelector('.k-teams-host');
    on(host, 'change', 'input[data-f]', (e, inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      const f = inp.dataset.f;
      app.updateTeam(i, { [f]: f === 'latitude' || f === 'longitude' ? Number(inp.value) : inp.value });
    });
    const doSearch = (i) => {
      const q = host.querySelector('tr[data-i="' + i + '"] input[data-f=stadium]').value;
      app.searchPlace(q).then((r) => {
        if (r.results.length === 1) { const x = r.results[0]; candidates = null; app.updateTeam(i, { stadium: x.name, latitude: x.latitude, longitude: x.longitude }); UI.toast(app.state.teams[i].name + ' 구장 위치: ' + x.name, 'ok'); }
        else { candidates = Object.assign({ team: i }, r); render(); }
      });
    };
    on(host, 'keydown', 'input[data-f=stadium]', (e, inp) => { if (e.key === 'Enter') { e.preventDefault(); inp.dispatchEvent(new Event('change', { bubbles: true })); doSearch(Number(inp.closest('tr').dataset.i)); } });
    on(host, 'click', '[data-act]', (e, b) => {
      const tr = b.closest('tr');
      const i = tr ? Number(tr.dataset.i) : -1;
      const act = b.dataset.act;
      if (act === 'add') app.addTeam();
      else if (act === 'preset') UI.confirmBox('2025 프리셋 불러오기', '현재 프로젝트를 2025 프리셋으로 바꿉니다. 실행 취소로 되돌릴 수 있습니다.', '불러오기').then((ok) => ok && app.loadPreset());
      else if (act === 'search') doSearch(i);
      else if (act === 'pick') { const x = candidates.results[Number(b.dataset.k)]; const t = candidates.team; candidates = null; app.updateTeam(t, { stadium: x.name, latitude: x.latitude, longitude: x.longitude }); }
      else if (act === 'closecand') { candidates = null; render(); }
      else if (act === 'del') UI.confirmBox('구단 삭제', app.state.teams[i].name + '을(를) 삭제합니다. 시리즈 인덱스가 바뀌므로 시리즈·배정·경기 기록이 비워지고 시리즈를 다시 생성해야 합니다.', '삭제', 'danger').then((ok) => ok && app.removeTeam(i));
    });
    const m = UI.mount(host, app, render, ['teams', 'distance', 'map', 'run']);
    if (!o.noMap) {
      UI.mapWidget(el.querySelector('.k-teams-map'), app, {
        width: 320, tags: ['teams', 'map'],
        markers: () => app.state.teams.map((t, i) => ({ id: i, lat: Number(t.latitude), lon: Number(t.longitude), label: t.name, color: t.color, draggable: !app.isRunning(), title: t.stadium })),
        onDragEnd: (id, lat, lon) => app.updateTeam(Number(id), { latitude: lat, longitude: lon }),
        caption: () => '마커를 끌거나 선택 후 화살표 키로 좌표를 조정합니다.'
      });
    }
    return m;
  };

  // ───────────── 거리 행렬 (FR-T6, T7) ─────────────
  P.distance = function (el, app) {
    let symmetric = true;
    const render = () => {
      const st = app.state;
      const map = new Map(st.distanceMatrix.map((d) => [d.from + '|' + d.to, d]));
      const max = Math.max(1, ...st.distanceMatrix.map((d) => Number(d.distance) || 0));
      let missing = 0;
      let h = lockNote(app) + '<div class="k-toolbar"><label class="k-check"><input type="checkbox" data-act="sym"' + (symmetric ? ' checked' : '') + '> 대칭 편집 (A→B를 바꾸면 B→A도)</label>' +
        '<label class="k-field-inline">도로계수 <input class="k-input k-w-xs" type="number" step="0.05" min="1" data-act="rf" data-fk="rf" value="' + esc(st.settings.roadFactor) + '"' + dis(app) + '></label>' +
        '<button class="k-btn" data-act="estimate"' + dis(app) + '>누락 거리 추정</button><span class="k-muted">행 = 출발 구단, 열 = 도착 구단, km. <i>≈</i> = 하버사인 직선거리 × 도로계수 추정값.</span></div>';
      h += '<div class="k-table-wrap" data-scroll-key="dist"><table class="k-table k-matrix"><thead><tr><th>출발 \\ 도착</th>' + st.teams.map((t) => '<th>' + esc(t.name) + '</th>').join('') + '</tr></thead><tbody>';
      for (const a of st.teams) {
        h += '<tr><th>' + UI.teamChip(a) + '</th>';
        for (const b of st.teams) {
          const d = map.get(a.name + '|' + b.name);
          if (a.name === b.name) { h += '<td class="k-diag">0</td>'; continue; }
          if (!d) missing++;
          const v = d ? Number(d.distance) : '';
          const k = d ? Math.round((v / max) * 100) : 0;
          h += '<td class="' + (d ? (d.estimated ? 'k-est' : '') : 'k-missing') + (k > 55 ? ' k-dark' : '') + '" style="--heat:' + k + '%"><input class="k-cell-input" type="number" step="0.1" min="0" data-from="' + esc(a.name) + '" data-to="' + esc(b.name) + '" data-fk="d' + esc(a.name) + '|' + esc(b.name) + '" value="' + esc(v) + '" aria-label="' + esc(a.name + '→' + b.name) + ' 거리 km"' + dis(app) + '>' + (d && d.estimated ? '<span class="k-est-mark" title="추정값">≈</span>' : '') + (!d ? '<span class="k-est-mark" title="누락">!</span>' : '') + '</td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div>' + (missing ? '<p>' + UI.stateChip('bad', '누락 ' + missing + '건 — 사전 점검에서 차단됩니다.') + '</p>' : '');
      el.innerHTML = h;
    };
    on(el, 'change', 'input.k-cell-input', (e, inp) => { if (inp.value === '') return; app.setDistance(inp.dataset.from, inp.dataset.to, inp.value, symmetric); });
    on(el, 'change', '[data-act=sym]', (e, c) => { symmetric = c.checked; });
    on(el, 'change', '[data-act=rf]', (e, inp) => app.updateSettings({ roadFactor: Math.max(1, Number(inp.value) || 1.25) }, '도로계수 변경'));
    on(el, 'click', '[data-act=estimate]', () => app.estimateMissingDistances());
    return UI.mount(el, app, render, ['teams', 'distance', 'run', 'settings']);
  };

  // ───────────── 일정 골격 (FR-S1~S5) ─────────────
  P.season = function (el, app) {
    const render = () => {
      const s = app.state.settings;
      const d = dis(app);
      let h = lockNote(app);
      if (app.slotsOutOfDate()) h += '<div class="k-banner k-banner-warn" role="alert">⚠ 일정 설정이 현재 슬롯과 다릅니다. <button class="k-btn k-btn-primary" data-act="regen"' + d + '>슬롯 다시 생성</button> <span class="k-muted">같은 날짜·연전의 배정은 유지됩니다.</span></div>';
      h += '<div class="k-grid-3"><label class="k-field"><span>정규시즌 개막일</span><input class="k-input" type="date" data-s="seasonStart" data-fk="ss" value="' + esc(s.seasonStart) + '"' + d + '></label>' +
        '<label class="k-field"><span>1차 편성 종료일</span><input class="k-input" type="date" data-s="initialEnd" data-fk="ie" value="' + esc(s.initialEnd) + '"' + d + '></label>' +
        '<label class="k-field"><span>시즌 최종 종료일</span><input class="k-input" type="date" data-s="seasonEnd" data-fk="se" value="' + esc(s.seasonEnd) + '"' + d + '></label></div>';
      h += '<fieldset class="k-fieldset"><legend>휴식 요일</legend><div class="k-inline">' + Dates.WEEKDAY_KO.map((w, i) => '<label class="k-check"><input type="checkbox" data-rest="' + i + '"' + (s.restWeekdays.includes(i) ? ' checked' : '') + d + '> ' + w + '</label>').join('') + '</div></fieldset>';
      h += '<fieldset class="k-fieldset"><legend>휴식 예외일 <span class="k-muted">(휴식 요일이지만 경기하는 날)</span></legend><div class="k-chips">' + s.restExceptions.map((x) => '<span class="k-chip">' + fmt.date(x) + ' <button class="k-x" data-del-exc="' + esc(x) + '" aria-label="' + fmt.date(x) + ' 삭제"' + d + '>×</button></span>').join('') + '</div><div class="k-inline"><input class="k-input" type="date" data-new="exc" data-fk="nexc"' + d + '><button class="k-btn" data-act="add-exc"' + d + '>추가</button></div></fieldset>';
      h += '<fieldset class="k-fieldset"><legend>경기 없는 기간</legend><table class="k-table k-compact"><tbody>' + s.blackouts.map((b, i) => '<tr><td><input class="k-input" data-bl="' + i + '" data-k="label" data-fk="bl' + i + '" value="' + esc(b.label || '') + '" aria-label="이름"' + d + '></td><td><input class="k-input" type="date" data-bl="' + i + '" data-k="start" value="' + esc(b.start) + '"' + d + '></td><td>~</td><td><input class="k-input" type="date" data-bl="' + i + '" data-k="end" value="' + esc(b.end) + '"' + d + '></td><td class="k-muted">' + (Dates.dayNum(b.end) - Dates.dayNum(b.start) + 1) + '일</td><td><button class="k-btn k-btn-icon" data-del-bl="' + i + '" aria-label="삭제"' + d + '>✕</button></td></tr>').join('') + '</tbody></table><button class="k-btn" data-act="add-bl"' + d + '>＋ 기간 추가</button></fieldset>';
      h += '<fieldset class="k-fieldset"><legend>공휴일 <span class="k-muted">(휴일 가중치 계산)</span></legend><div class="k-chips">' + s.holidays.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((x) => '<span class="k-chip" title="' + esc(x.name) + '">' + fmt.date(x.date) + ' ' + esc(x.name) + ' <button class="k-x" data-del-hol="' + esc(x.date) + '" aria-label="삭제"' + d + '>×</button></span>').join('') + '</div><div class="k-inline"><input class="k-input" type="date" data-new="hol" data-fk="nhol"' + d + '><input class="k-input" data-new="holname" placeholder="이름" data-fk="nholn"' + d + '><button class="k-btn" data-act="add-hol"' + d + '>추가</button><button class="k-btn k-btn-ghost" data-act="builtin"' + d + '>' + esc(s.seasonStart.slice(0, 4)) + ' 법정 공휴일 불러오기</button></div></fieldset>';
      el.innerHTML = h;
    };
    const s = () => app.state.settings;
    on(el, 'change', 'input[data-s]', (e, i) => app.updateSettings({ [i.dataset.s]: i.value }));
    on(el, 'change', 'input[data-rest]', () => app.updateSettings({ restWeekdays: UI.$$('input[data-rest]', el).filter((c) => c.checked).map((c) => Number(c.dataset.rest)) }, '휴식 요일 변경'));
    on(el, 'change', 'input[data-bl]', (e, i) => { const list = s().blackouts.map((b) => Object.assign({}, b)); list[Number(i.dataset.bl)][i.dataset.k] = i.value; app.updateSettings({ blackouts: list }, '경기 없는 기간 변경'); });
    on(el, 'click', 'button', (e, b) => {
      if (b.dataset.act === 'regen') app.regenerateSlots();
      else if (b.dataset.act === 'add-exc') { const v = el.querySelector('[data-new=exc]').value; if (v && !s().restExceptions.includes(v)) app.updateSettings({ restExceptions: s().restExceptions.concat([v]).sort() }, '휴식 예외일 추가'); }
      else if (b.dataset.delExc) app.updateSettings({ restExceptions: s().restExceptions.filter((x) => x !== b.dataset.delExc) }, '휴식 예외일 삭제');
      else if (b.dataset.act === 'add-bl') { const d0 = s().seasonStart; app.updateSettings({ blackouts: s().blackouts.concat([{ start: d0, end: d0, label: '경기 없는 기간' }]) }, '경기 없는 기간 추가'); }
      else if (b.dataset.delBl != null) app.updateSettings({ blackouts: s().blackouts.filter((x, i) => i !== Number(b.dataset.delBl)) }, '경기 없는 기간 삭제');
      else if (b.dataset.act === 'add-hol') { const v = el.querySelector('[data-new=hol]').value; const n = el.querySelector('[data-new=holname]').value || '공휴일'; if (v) app.updateSettings({ holidays: s().holidays.filter((h) => h.date !== v).concat([{ date: v, name: n }]) }, '공휴일 추가'); }
      else if (b.dataset.delHol) app.updateSettings({ holidays: s().holidays.filter((x) => x.date !== b.dataset.delHol) }, '공휴일 삭제');
      else if (b.dataset.act === 'builtin') {
        const y = Number(s().seasonStart.slice(0, 4));
        const add = CalendarGen.builtinHolidays(y).filter((h) => h.date >= s().seasonStart && h.date <= s().seasonEnd && !s().holidays.some((x) => x.date === h.date));
        if (!add.length) UI.toast('추가할 법정 공휴일이 없습니다.', 'info');
        else app.updateSettings({ holidays: s().holidays.concat(add) }, '법정 공휴일 ' + add.length + '개 추가');
      }
    });
    return UI.mount(el, app, render, ['settings', 'calendar', 'run']);
  };

  // ───────────── 슬롯 (FR-S6) ─────────────
  P.slots = function (el, app, opts) {
    const o = opts || {};
    const render = () => {
      const c = app.derived();
      const st = app.state;
      const hist = CalendarGen.lengthHistogram(st.calendar);
      let h = lockNote(app) + '<div class="k-toolbar"><button class="k-btn k-btn-primary" data-act="regen"' + dis(app) + '>설정으로 슬롯 자동 생성</button><span>' + st.calendar.length + '개 슬롯 · ' + Object.keys(hist).sort().map((k) => k + '연전 ' + hist[k]).join(' · ') + ' · 경기일 ' + st.calendar.reduce((a, b) => a + b.consecutive, 0) + '일</span>' + (app.slotsOutOfDate() ? UI.stateChip('warn', '설정과 다름') : UI.stateChip('ok', '설정과 일치')) + '</div>';
      if (o.calendar !== false) h += P.slotStrip(app);
      h += '<div class="k-table-wrap k-scroll-y" data-scroll-key="slots"><table class="k-table k-compact k-slots"><thead><tr><th>#</th><th>기간</th><th>연전</th><th title="토·일 포함 시 1">주말</th><th title="주말 2(공휴일 포함 3), 주중 공휴일 2">휴일 가중치</th><th>배정 시리즈</th></tr></thead><tbody>';
      c.slots.forEach((s, i) => {
        const end = s.day + s.consecutive - 1;
        h += '<tr data-i="' + i + '"><td>' + (i + 1) + '</td><td>' + fmt.date(s.day) + (s.consecutive > 1 ? ' ~ ' + fmt.date(end) : '') + '</td>' +
          '<td><input class="k-input k-w-xs" type="number" min="1" max="7" data-f="consecutive" data-fk="sc' + i + '" value="' + s.consecutive + '" aria-label="연전 수"' + dis(app) + '></td>' +
          '<td><input class="k-input k-w-xs" type="number" min="0" max="1" data-f="weekend" data-fk="sw' + i + '" value="' + s.weekend + '" aria-label="주말 가중치"' + dis(app) + '></td>' +
          '<td><input class="k-input k-w-xs" type="number" min="0" max="9" data-f="holiday" data-fk="sh' + i + '" value="' + s.holiday + '" aria-label="휴일 가중치"' + dis(app) + '></td>' +
          '<td>' + c.bySlot[i].length + '</td></tr>';
      });
      el.innerHTML = h + '</tbody></table></div>';
    };
    on(el, 'click', '[data-act=regen]', () => UI.confirmBox('슬롯 자동 생성', '일정 설정(§5.2.1 규칙)으로 슬롯을 다시 만듭니다. 같은 날짜·연전의 배정은 유지되고 나머지는 미배정이 됩니다.', '생성').then((ok) => ok && app.regenerateSlots()));
    on(el, 'change', 'input[data-f]', (e, inp) => app.updateSlot(Number(inp.closest('tr').dataset.i), { [inp.dataset.f]: inp.value }));
    return UI.mount(el, app, render, ['calendar', 'settings', 'plan', 'run']);
  };

  /** 슬롯 달력 띠: 월별로 날짜 칸을 그리고 슬롯마다 색을 번갈아 칠한다 (FR-S6 달력 보기) */
  P.slotStrip = function (app) {
    const c = app.derived();
    const s = app.state.settings;
    const start = Dates.dayNum(s.seasonStart), end = Dates.dayNum(s.seasonEnd);
    const holidays = new Set((s.holidays || []).map((x) => Dates.dayNum(x.date)));
    const black = Dates.expandRanges(s.blackouts);
    let h = '<div class="k-slotstrip" aria-label="슬롯 달력">';
    let curMonth = -1;
    for (let d = start; d <= end; d++) {
      const m = Dates.month(d);
      if (m !== curMonth) { if (curMonth > 0) h += '</div></div>'; curMonth = m; h += '<div class="k-ss-month"><div class="k-ss-mlabel">' + m + '월</div><div class="k-ss-days">'; }
      const si = c.dayToSlot.get(d);
      const wd = Dates.weekday(d);
      const cls = ['k-ss-day'];
      if (si != null) cls.push('k-ss-slot', si % 2 ? 'k-ss-odd' : 'k-ss-even', 'k-ss-len' + c.slots[si].consecutive);
      if (black.has(d)) cls.push('k-ss-black');
      if (holidays.has(d)) cls.push('k-ss-hol');
      if (wd === 0 || wd === 6) cls.push('k-ss-wkend');
      const title = fmt.date(d) + (si != null ? ' · ' + c.slots[si].label : ' · 경기 없음') + (holidays.has(d) ? ' · 공휴일' : '') + (black.has(d) ? ' · 경기 없는 기간' : '');
      h += '<span class="' + cls.join(' ') + '" title="' + esc(title) + '">' + new Date(d * Dates.DAY_MS).getUTCDate() + '</span>';
    }
    return h + '</div></div><div class="k-ss-legend"><span class="k-ss-day k-ss-slot k-ss-even">1</span> 슬롯(번갈아 색) <span class="k-ss-day k-ss-hol">1</span> 공휴일 <span class="k-ss-day k-ss-black">1</span> 경기 없는 기간 <span class="k-ss-day">1</span> 휴식일</div></div>';
  };

  // ───────────── 시리즈 (FR-S7, S8) ─────────────
  P.series = function (el, app) {
    const render = () => {
      const st = app.state;
      const s = st.settings;
      const N = st.teams.length;
      const sh = CalendarGen.lengthHistogram(st.calendar), mh = CalendarGen.lengthHistogram(st.matches);
      const half = N >> 1;
      const lens = Array.from(new Set(Object.keys(sh).concat(Object.keys(mh)))).sort();
      let h = lockNote(app) + '<div class="k-grid-4">' +
        '<label class="k-field"><span>구단쌍 목표 경기 수</span><input class="k-input" type="number" min="1" data-s="gamesPerPair" data-fk="gpp" value="' + s.gamesPerPair + '"' + dis(app) + '></label>' +
        '<label class="k-field"><span>1차 편성 경기 수</span><input class="k-input" type="number" min="1" data-s="initialGamesPerPair" data-fk="igpp" value="' + s.initialGamesPerPair + '"' + dis(app) + '></label>' +
        '<label class="k-field"><span>홈/원정 분배 (다수 홈 경기 수)</span><input class="k-input" type="number" min="0" data-s="homeGamesMajor" data-fk="hgm" value="' + s.homeGamesMajor + '"' + dis(app) + '><small class="k-muted">' + s.homeGamesMajor + ':' + (s.initialGamesPerPair - s.homeGamesMajor) + '</small></label>' +
        '<label class="k-field"><span>잔여 경기 홈 결정 (O-1)</span><select class="k-input" data-s="remainingHomeRule"' + dis(app) + '><option value="FEWER_HOME"' + (s.remainingHomeRule !== 'MORE_HOME' ? ' selected' : '') + '>홈 경기 적은 구단</option><option value="MORE_HOME"' + (s.remainingHomeRule === 'MORE_HOME' ? ' selected' : '') + '>홈 경기 많은 구단</option></select></label></div>';
      h += '<div class="k-toolbar"><button class="k-btn k-btn-primary" data-act="gen"' + dis(app) + '>시리즈 자동 생성</button><button class="k-btn" data-act="import"' + dis(app) + '>JSON 가져오기 (input_2025.json 형식 가능)</button><button class="k-btn k-btn-ghost" data-act="preset"' + dis(app) + '>2025 프리셋</button></div>';
      h += '<table class="k-table k-compact k-w-auto"><thead><tr><th>연전</th><th>슬롯 수</th><th>수용 (× ' + half + ')</th><th>시리즈 수</th><th>상태</th></tr></thead><tbody>' + lens.map((k) => {
        const cap = (sh[k] || 0) * half, n = mh[k] || 0;
        return '<tr><td>' + k + '연전</td><td>' + (sh[k] || 0) + '</td><td>' + cap + '</td><td>' + n + '</td><td>' + (n === cap ? UI.stateChip('ok', '일치') : n > cap ? UI.stateChip('bad', '부족 ' + (n - cap)) : UI.stateChip('warn', '여유 ' + (cap - n))) + '</td></tr>';
      }).join('') + '</tbody></table>';
      h += '<p class="k-muted">시리즈 ' + st.matches.length + '개 · 경기 ' + st.matches.reduce((a, b) => a + b.consecutive, 0) + '. 아래 행렬은 행(홈) × 열(원정) 1차 편성 경기 수입니다.</p>' + P.pairMatrix(app);
      el.innerHTML = h;
    };
    on(el, 'change', '[data-s]', (e, i) => app.updateSettings({ [i.dataset.s]: i.tagName === 'SELECT' ? i.value : Number(i.value) }, '시리즈 설정 변경'));
    on(el, 'click', '[data-act]', (e, b) => {
      if (b.dataset.act === 'gen') {
        const g = app.generateSeriesPreview();
        if (g.errors.length) { UI.dialog({ title: '시리즈를 만들 수 없습니다', body: '<ul>' + g.errors.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' }); return; }
        UI.confirmBox('시리즈 자동 생성', '시리즈 ' + g.matches.length + '개를 새로 만들고 배정을 구성적 초기해로 바꿉니다. 경기 기록과 재편성 정보는 지워집니다.', '생성').then((ok) => ok && app.regenerateSeries());
      } else if (b.dataset.act === 'import') app.importFile();
      else if (b.dataset.act === 'preset') app.loadPreset();
    });
    return UI.mount(el, app, render, ['matches', 'settings', 'calendar', 'teams', 'run']);
  };

  /** 구단쌍 × 경기 수 행렬 (홈 행, 원정 열) */
  P.pairMatrix = function (app, opts) {
    const st = app.state;
    const names = st.teams.map((t) => t.name);
    const idx = new Map(names.map((n, i) => [n, i]));
    const games = names.map(() => names.map(() => 0));
    const planned = opts && opts.planned ? app.derived().plan : null;
    st.matches.forEach((m, i) => { if (planned && planned[i] < 0) return; const a = idx.get(m.home), b = idx.get(m.away); if (a != null && b != null) games[a][b] += m.consecutive; });
    const target = st.settings.initialGamesPerPair;
    let h = '<div class="k-table-wrap"><table class="k-table k-matrix k-pairs"><thead><tr><th>홈 \\ 원정</th>' + names.map((n) => '<th>' + esc(n) + '</th>').join('') + '<th>홈 합</th></tr></thead><tbody>';
    names.forEach((n, i) => {
      h += '<tr><th>' + UI.teamChip(st.teams[i]) + '</th>';
      names.forEach((x, j) => {
        if (i === j) { h += '<td class="k-diag">—</td>'; return; }
        const tot = games[i][j] + games[j][i];
        h += '<td class="' + (tot !== target ? 'k-bad-cell' : '') + '" title="' + esc(n + ' 홈 ' + games[i][j] + ' · ' + x + ' 홈 ' + games[j][i] + ' (합 ' + tot + ')') + '">' + games[i][j] + (tot !== target ? ' <span aria-label="목표와 다름">⚠</span>' : '') + '</td>';
      });
      h += '<td><b>' + games[i].reduce((a, b) => a + b, 0) + '</b></td></tr>';
    });
    return h + '</tbody></table></div>';
  };

  // ───────────── 이벤트 (FR-E) ─────────────
  const EVENT_TYPES = { OPENING: '개막전', CHILDREN: '어린이날', CUSTOM: '사용자 정의' };
  P.events = function (el, app, opts) {
    const o = opts || {};
    const render = () => {
      const st = app.state;
      const c = app.derived();
      const issues = app.checkEvents();
      const stadiums = Array.from(new Set(st.teams.map((t) => t.stadium)));
      const evIssues = (id) => issues.filter((x) => x.events.includes(id));
      const groups = new Map();
      for (const e of st.events) {
        const s = KBO.Score.resolveEventSlot(e, st.calendar);
        if (!groups.has(s)) groups.set(s, []);
        groups.get(s).push(e);
      }
      let h = lockNote(app) + '<div class="k-toolbar"><button class="k-btn" data-act="add" data-type="OPENING" data-mode="MATCH"' + dis(app) + '>＋ 개막전 대진</button><button class="k-btn" data-act="add" data-type="CHILDREN" data-mode="STADIUM"' + dis(app) + '>＋ 어린이날 구장</button><button class="k-btn" data-act="add" data-type="CUSTOM" data-mode="MATCH"' + dis(app) + '>＋ 사용자 정의</button>' +
        '<button class="k-btn k-btn-primary" data-act="apply"' + dis(app) + '>대진 지정 고정 적용</button><button class="k-btn k-btn-ghost" data-act="pinall"' + dis(app) + '>이벤트 시리즈 일괄 고정</button><button class="k-btn k-btn-ghost" data-act="unpinall"' + dis(app) + '>일괄 고정 해제</button></div>';
      h += '<p class="k-muted">대진 지정(구단+구장)은 그 슬롯에 해당 시리즈를 고정(핀)합니다. 구장 지정은 선택 구장 연고 구단의 홈 경기 의무(H0-e)이며, 공유 구장은 연고 구단 중 하나만 홈이면 충족합니다.</p>';
      if (issues.length) h += '<ul class="k-issues">' + issues.map((x) => '<li>' + UI.stateChip(x.level === 'block' ? 'block' : 'warn', x.level === 'block' ? '모순' : '경고') + ' ' + esc(x.message) + '</li>').join('') + '</ul>';
      const keys = Array.from(groups.keys()).sort((a, b) => a - b);
      for (const s of keys) {
        h += '<section class="k-evgroup"><h4>' + (s >= 0 ? esc(c.slots[s].label) : '슬롯 미연결') + '</h4><div class="k-evcards">';
        for (const e of groups.get(s)) {
          const iss = evIssues(e.id);
          h += '<div class="k-evcard' + (iss.some((x) => x.level === 'block') ? ' k-has-block' : iss.length ? ' k-has-warn' : '') + '" data-id="' + esc(e.id) + '">' +
            '<div class="k-inline"><select class="k-input" data-e="type"' + dis(app) + '>' + Object.entries(EVENT_TYPES).map(([k, v]) => '<option value="' + k + '"' + (e.type === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>' +
            '<input class="k-input" data-e="name" data-fk="en' + esc(e.id) + '" value="' + esc(e.name) + '" aria-label="이벤트 이름"' + dis(app) + '>' +
            '<input class="k-input" type="date" data-e="date" value="' + esc(e.date || (s >= 0 ? c.slots[s].date : '')) + '" aria-label="날짜"' + dis(app) + '>' +
            '<select class="k-input" data-e="mode"' + dis(app) + '><option value="MATCH"' + (e.mode === 'MATCH' ? ' selected' : '') + '>대진 지정 (구단+구장)</option><option value="STADIUM"' + (e.mode === 'STADIUM' ? ' selected' : '') + '>구장 지정 (홈 의무)</option></select>' +
            '<button class="k-btn k-btn-icon k-btn-danger" data-act="del" aria-label="이벤트 삭제"' + dis(app) + '>✕</button></div>';
          if (e.mode === 'MATCH') {
            const team = (n) => st.teams.map((t) => '<option' + (t.name === n ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
            const pinnedM = st.matches.findIndex((m) => m.eventId === e.id && m.pinned);
            h += '<div class="k-inline">원정 <select class="k-input" data-e="away"' + dis(app) + '>' + team(e.away) + '</select> @ 홈 <select class="k-input" data-e="home"' + dis(app) + '>' + team(e.home) + '</select> <span class="k-muted">구장: ' + esc((c.teamByName.get(e.home) || {}).stadium || '-') + '</span> ' + (pinnedM >= 0 && c.plan[pinnedM] === s ? UI.stateChip('ok', '📌 고정됨') : UI.stateChip('info', '고정 대기')) + '</div>';
          } else {
            h += '<div class="k-chips">' + stadiums.map((x) => { const owners = st.teams.filter((t) => t.stadium === x).map((t) => t.name).join('·'); return '<label class="k-check k-chip"><input type="checkbox" data-stad="' + esc(x) + '"' + ((e.stadiums || []).includes(x) ? ' checked' : '') + dis(app) + '> ' + esc(x) + ' <span class="k-muted">(' + esc(owners) + ')</span></label>'; }).join('') + '</div>';
          }
          if (iss.length) h += '<div class="k-small">' + iss.map((x) => (x.level === 'block' ? '⛔ ' : '⚠ ') + esc(x.message)).join('<br>') + '</div>';
          h += '</div>';
        }
        h += '</div></section>';
      }
      if (!st.events.length) h += '<p class="k-muted">이벤트가 없습니다.</p>';
      el.innerHTML = h;
    };
    on(el, 'change', '[data-e]', (e, i) => { const id = i.closest('.k-evcard').dataset.id; app.updateEvent(id, { [i.dataset.e]: i.value }); });
    on(el, 'change', '[data-stad]', (e, i) => { const card = i.closest('.k-evcard'); app.updateEvent(card.dataset.id, { stadiums: UI.$$('[data-stad]', card).filter((x) => x.checked).map((x) => x.dataset.stad) }); });
    on(el, 'click', '[data-act]', (e, b) => {
      const act = b.dataset.act;
      if (act === 'add') {
        const st = app.state;
        const date = o.defaultDate ? o.defaultDate() : st.settings.seasonStart;
        const ev = { type: b.dataset.type, name: EVENT_TYPES[b.dataset.type], date, mode: b.dataset.mode };
        if (ev.mode === 'MATCH') { ev.home = st.teams[0].name; ev.away = st.teams[1].name; } else ev.stadiums = [];
        app.addEvent(ev);
      } else if (act === 'del') app.removeEvent(b.closest('.k-evcard').dataset.id);
      else if (act === 'apply') app.applyEvents();
      else if (act === 'pinall') app.pinEventSeries(true);
      else if (act === 'unpinall') app.pinEventSeries(false);
    });
    return UI.mount(el, app, render, ['events', 'teams', 'calendar', 'matches', 'pins', 'plan', 'run']);
  };

  // ───────────── 설정 (H0-e 모드, Kakao, 엔진, 기준일) ─────────────
  P.settings = function (el, app) {
    const render = () => {
      const s = app.state.settings;
      const ec = app.engineConfig;
      let h = '<div class="k-grid-2"><fieldset class="k-fieldset"><legend>H0-e 홈 의무 채점 모드 (§6.1.1)</legend>' +
        '<label class="k-check"><input type="radio" name="h0e" value="STADIUM"' + (s.h0eMode !== 'ENGINE' ? ' checked' : '') + '> <b>구장 기준</b> (기본) — 지정 구장마다 연고 구단 중 홈이 없으면 1점</label>' +
        '<label class="k-check"><input type="radio" name="h0e" value="ENGINE"' + (s.h0eMode === 'ENGINE' ? ' checked' : '') + '> <b>엔진 호환</b> — 의무 구단의 원정 시리즈마다 1점 (Java와 1:1)</label>' +
        '<div class="k-chips k-small">의무 구단(어린이날, 엔진 호환): ' + app.state.teams.map((t) => '<label class="k-check k-chip"><input type="checkbox" data-obl="' + esc(t.name) + '"' + ((s.obligationTeams || []).includes(t.name) ? ' checked' : '') + '> ' + esc(t.name) + '</label>').join('') + '</div></fieldset>';
      h += '<fieldset class="k-fieldset"><legend>지도 (Kakao Maps)</legend><div class="k-inline"><input class="k-input k-w-wide" type="password" autocomplete="off" data-fk="kakao" placeholder="JavaScript 키" value="' + esc(app.kakaoKey) + '" aria-label="Kakao JavaScript 키"><button class="k-btn" data-act="kakao">적용</button><button class="k-btn k-btn-ghost" data-act="kakao-clear">키 지우기</button></div>' +
        '<p class="k-small">' + (app.kakao ? UI.stateChip('ok', 'Kakao 지도 사용 중') : app.kakaoKey ? UI.stateChip('warn', app.kakaoError || 'Kakao 로드 대기') : UI.stateChip('info', '키 없음 — 내장 SVG 지도')) + '</p><p class="k-muted k-small">Kakao는 file://에서 동작하지 않습니다. <code>python3 -m http.server</code>로 열고 개발자 콘솔에 <code>http://localhost:포트</code>를 등록하세요.</p></fieldset>';
      h += '<fieldset class="k-fieldset"><legend>엔진 연결 (§7)</legend><label class="k-check"><input type="radio" name="eng" value="MOCK"' + (ec.kind === 'MOCK' ? ' checked' : '') + dis(app) + '> 브라우저 Mock 엔진 (시뮬레이션)</label><label class="k-check"><input type="radio" name="eng" value="REST"' + (ec.kind === 'REST' ? ' checked' : '') + dis(app) + '> REST 엔진 (Java 서버)</label><div class="k-inline"><input class="k-input k-w-wide" data-fk="rest" value="' + esc(ec.baseUrl || '') + '" aria-label="REST 서버 주소"' + dis(app) + '><button class="k-btn" data-act="rest"' + dis(app) + '>주소 저장</button></div></fieldset>';
      h += '<fieldset class="k-fieldset"><legend>운영·분석</legend><label class="k-field"><span>기준일 (결과 미입력 판정, 비우면 오늘)</span><input class="k-input" type="date" data-s="referenceDate" value="' + esc(s.referenceDate || '') + '"></label><label class="k-field"><span>장거리 연속 원정 임계값 (km)</span><input class="k-input" type="number" min="0" step="50" data-s="longTripKm" value="' + esc(s.longTripKm) + '"></label></fieldset></div>';
      el.innerHTML = h;
    };
    on(el, 'change', 'input[name=h0e]', (e, i) => app.setH0eMode(i.value));
    on(el, 'change', 'input[name=eng]', (e, i) => app.setEngineConfig({ kind: i.value }));
    on(el, 'change', '[data-obl]', () => app.store.commit('의무 구단 변경', (s) => { s.settings.obligationTeams = UI.$$('[data-obl]', el).filter((x) => x.checked).map((x) => x.dataset.obl); }, { tags: ['settings', 'plan'] }));
    on(el, 'change', 'input[data-s]', (e, i) => app.store.commit('설정 변경', (s) => { s.settings[i.dataset.s] = i.type === 'number' ? Number(i.value) : i.value; }, { tags: ['settings', 'games'] }));
    on(el, 'click', '[data-act]', (e, b) => {
      if (b.dataset.act === 'kakao') app.setKakaoKey(el.querySelector('[data-fk=kakao]').value);
      else if (b.dataset.act === 'kakao-clear') app.setKakaoKey('');
      else if (b.dataset.act === 'rest') app.setEngineConfig({ baseUrl: el.querySelector('[data-fk=rest]').value });
    });
    return UI.mount(el, app, render, ['settings', 'map', 'run', 'teams']);
  };

  P.EVENT_TYPES = EVENT_TYPES;
})();
