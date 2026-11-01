/*
 * 편성 스튜디오 — 1 구단 정보: 연도별 구단 간 거리를 편성 서버에 저장하고 다른 해 거리를 불러온다.
 * 불러오기는 누구나, 저장은 관리자 비밀번호가 있어야 한다(비밀번호는 브라우저에 남기지 않는다).
 * 편성 서버가 없으면(file:// 등) 단추가 보이지 않는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { esc, icon } = S;
  const app = () => S.app;
  const MOVED_KM = 0.05; // 구장 위치가 이만큼 넘게 다르면 거리가 안 맞을 수 있다고 알린다
  const dayOf = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; };
  const ui = () => S.ui.distYears || (S.ui.distYears = {});
  const fetchYears = () => {
    S.ui.distYears = { busy: true };
    app().listSavedDistances().then((years) => { ui().years = years; }).catch((e) => { ui().err = e.message; }).then(() => { ui().busy = false; S.render(); });
  };
  const open = (modal) => {
    if (S.locked()) return;
    fetchYears();
    S.ui.modal = modal; S.render();
  };

  /** 구단 정보 왼쪽, 도로거리 단추 아래 줄 */
  S.distYearsRow = function () {
    if (!app().distanceApi) return '';
    return '<div class="tm-road tm-saved"><button class="btn sm" data-act="dist-load-open">' + icon('upload') + '다른 해 거리 불러오기</button>' +
      (app().distanceSave ? '<button class="btn sm" data-act="dist-save-open">' + icon('db') + S.seasonYear() + ' 거리 저장</button>' : '') + '</div>';
  };

  /** 지금 구단과 저장된 거리를 견준다: 저장본에 없는 구단, 구장 위치가 달라진 구단 */
  function compare(saved) {
    const st = app().state, kept = new Map((saved.teams || []).map((t) => [t.name, t]));
    const covered = new Set(); for (const d of saved.distances || []) { covered.add(d.from); covered.add(d.to); }
    const missing = st.teams.filter((t) => !covered.has(t.name)).map((t) => t.name);
    const moved = st.teams.filter((t) => { const k = kept.get(t.name); return k && S.KBO.MapKit.haversineKm(t.latitude, t.longitude, k.latitude, k.longitude) > MOVED_KM; }).map((t) => t.name);
    return { missing, moved };
  }

  const shell = (title, body, foot) => '<div class="modal narrow" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" style="width:480px;max-width:94vw"><div class="modal-head"><h3>' + esc(title) + '</h3><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
    '<div class="modal-body" style="display:block;padding:14px">' + body + '</div><div class="modal-foot"><span style="margin-left:auto;display:flex;gap:8px">' + foot + '</span></div></div>';
  const errLine = (m) => (m ? '<p class="dist-err" role="alert">' + esc(m) + '</p>' : '');

  S.modals.distLoad = function () {
    if (!S.ui.distYears) fetchYears(); // 주소에 창이 남은 채 새로고침한 때
    const u = ui(), y = S.seasonYear();
    let body;
    if (u.busy && !u.years) body = '<p class="muted">저장된 해를 찾는 중…</p>';
    else if (!(u.years || []).length) body = u.err ? '' : '<p class="muted">아직 저장된 해가 없습니다.</p>';
    else {
      body = '<p class="dist-lead">가져올 해를 고르세요. ' + y + ' 시즌의 거리표에 그 해 값을 방향별로 넣습니다.</p><div class="dist-years">' +
        u.years.map((r) => '<button class="chip' + (u.sel === r.year ? ' on' : '') + '" data-act="dist-load-pick" data-year="' + esc(r.year) + '">' + esc(r.year) + '<small> 거리 ' + esc(r.count) + '개 · ' + esc(dayOf(r.savedAt)) + ' 저장</small></button>').join('') + '</div>';
      if (u.data) {
        const c = compare(u.data);
        if (c.moved.length) body += '<p class="dist-warn">구장 위치가 지금과 다른 구단: <b>' + esc(c.moved.join('·')) + '</b>. 이 구단의 거리는 맞지 않을 수 있습니다.</p>';
        if (c.missing.length) body += '<p class="dist-warn">그 해에 없는 구단: <b>' + esc(c.missing.join('·')) + '</b>. 이 구단의 거리는 지금 값 그대로 둡니다.</p>';
        body += '<p class="muted small">실행 취소로 되돌릴 수 있습니다.</p>';
      }
    }
    return shell('다른 해 거리 불러오기', body + errLine(u.err), '<button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="dist-load"' + (u.data ? '' : ' disabled') + '>불러오기</button>');
  };

  S.modals.distSave = function () {
    if (!S.ui.distYears) fetchYears();
    const u = ui(), y = S.seasonYear(), had = (u.years || []).find((r) => r.year === y), n = app().state.distanceMatrix.filter((d) => d.from !== d.to).length;
    const body = '<form id="distSaveForm"><p class="dist-lead">' + y + ' 시즌의 구단 간 거리 ' + n + '개를 서버에 저장합니다. 다른 컴퓨터에서도 불러올 수 있습니다.</p>' +
      (had ? '<p class="dist-warn">' + esc(dayOf(had.savedAt)) + '에 저장한 ' + y + ' 거리를 덮어씁니다.</p>' : '') +
      '<label class="field"><span>관리자 비밀번호</span><input class="input" id="distPw" type="password" autocomplete="current-password"></label>' + errLine(u.err) +
      '<button type="submit" data-act="dist-save" hidden></button></form>';
    return shell(y + ' 거리 저장', body, '<button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="dist-save"' + (u.saving ? ' disabled' : '') + '>저장</button>');
  };

  // 비밀번호 칸에서 Enter: 숨은 저장 단추가 눌린다. 페이지가 다시 열리지 않게 막는다
  document.addEventListener('submit', (e) => { if (e.target && e.target.id === 'distSaveForm') e.preventDefault(); });

  Object.assign(S.actions, {
    'dist-load-open': () => open('distLoad'),
    'dist-save-open': () => open('distSave'),
    'dist-load-pick': (el) => {
      const u = ui(), y = +el.dataset.year;
      u.sel = y; u.data = null; u.err = null; S.render();
      app().loadSavedDistances(y).then((saved) => { if (ui().sel === y) ui().data = saved; }).catch((e) => { ui().err = e.message; }).then(() => S.render());
    },
    'dist-load': () => {
      const u = ui();
      if (!u.data || S.locked()) return;
      const n = app().applySavedDistances(u.data);
      S.ui.modal = null; S.ui.distYears = null;
      S.toast(n ? u.sel + ' 거리 ' + n + '개를 불러왔습니다. 실행 취소로 되돌릴 수 있습니다.' : '불러올 거리가 없습니다. 구단 이름이 그 해와 다릅니다.', n ? 'ok' : 'warn', 5000);
      S.render();
    },
    'dist-save': () => {
      const u = ui(), pw = document.getElementById('distPw');
      if (!pw || u.saving) return;
      if (!pw.value) { u.err = '관리자 비밀번호를 적어 주세요.'; S.render(); return; }
      const y = S.seasonYear();
      u.saving = true; u.err = null;
      app().saveDistances(y, pw.value).then((r) => {
        S.ui.modal = null; S.ui.distYears = null;
        S.toast(y + ' 거리 ' + r.count + '개를 저장했습니다.', 'ok', 4000);
      }).catch((e) => { u.saving = false; u.err = e.message; }).then(() => S.render());
    }
  });
})();
