/*
 * 편성 스튜디오 — 1 구단 정보: 그 해 구단 간 거리를 편성 서버에 저장한다.
 * 저장은 관리자 비밀번호가 있어야 한다(비밀번호는 브라우저에 남기지 않는다).
 * 편성 서버가 없거나 서버에 비밀번호가 없으면 단추가 보이지 않는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { esc, icon } = S;
  const app = () => S.app;
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

  /** 도로거리 단추 옆에 놓는 저장 단추 */
  S.distSaveBtn = function () {
    return app().distanceSave ? '<button class="btn sm" data-act="dist-save-open">' + icon('db') + S.seasonYear() + ' 거리 저장</button>' : '';
  };

  const shell = (title, body, foot) => '<div class="modal narrow" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" style="width:480px;max-width:94vw"><div class="modal-head"><h3>' + esc(title) + '</h3><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
    '<div class="modal-body" style="display:block;padding:14px">' + body + '</div><div class="modal-foot"><span style="margin-left:auto;display:flex;gap:8px">' + foot + '</span></div></div>';
  const errLine = (m) => (m ? '<p class="dist-err" role="alert">' + esc(m) + '</p>' : '');

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
    'dist-save-open': () => open('distSave'),
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
