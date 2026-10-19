/*
 * alt-d — 시작: 주소(hash)의 화면 상태와 시연 상태(demo, run)를 적용하고 처음 그린다.
 */
(function () {
  'use strict';
  const SP = window.SP;
  const app = SP.app;
  const ui = SP.ui;
  const r = SP.parseHash();
  SP.applyRoute(r);
  if (!r.step && !r.view) ui.step = 1;
  // 시연 상태 (스크린샷·검토용, 타이머 없이 즉시 그린다)
  if (r.demo === 'edit') {
    ui.step = 1; ui.tab[1] = 'series'; ui.row.series = 11;
    ui.edit = { table: 'series', row: 11, key: 'away', value: 'LGG' };
    ui.scrollRow = 'series';
  }
  if (r.demo === 'block') {
    // 3연전 슬롯 하나를 지워 3연전 용량 차단을 만든다 (실행 버튼 잠금 시연, 실행 취소로 복구)
    app.commit('시연: 슬롯 삭제', (s) => { s.calendar.splice(40, 1); s.calendar.forEach((c, k) => { c.index = k; }); for (const p of s.plan) { if (p.calendar === 40) p.calendar = -1; else if (p.calendar > 40) p.calendar--; } }, ['calendar', 'plan']);
    ui.step = 2; ui.tab[2] = 'check';
  }
  if (r.demo === 'resched') { ui.view = 'ops'; ui.tab.ops = 'resched'; SP.runResched(true); }
  if (r.run === 'hold') { ui.step = 2; SP.startRun({ hold: true }); }
  (SP.afterBoot || []).forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  app.bindShortcuts();
  SP.renderNow();
  if (new URLSearchParams(location.search).get('check') === '1') {
    setTimeout(() => {
      const res = SP.checkScroll();
      const el = document.createElement('pre');
      el.id = 'sp-check-result';
      el.textContent = JSON.stringify(Object.assign({ hash: location.hash, errorList: (window.__spErrors || []).slice(0, 5) }, res));
      document.body.appendChild(el);
    }, 300);
  }
})();
