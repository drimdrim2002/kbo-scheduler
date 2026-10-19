/*
 * alt-d 브리프 스프레드 — 가장 먼저 읽는 스크립트.
 * 오류 수집(콘솔 오류 0 점검용)과 ?fresh=1 처리(저장 상태 지우기)를 한다.
 */
(function () {
  'use strict';
  var errors = [];
  window.__spErrors = errors;
  window.addEventListener('error', function (e) { errors.push(String((e && e.message) || e)); });
  window.addEventListener('unhandledrejection', function (e) { errors.push('unhandled: ' + String(e && e.reason)); });
  var ce = console.error;
  console.error = function () { errors.push(Array.prototype.join.call(arguments, ' ')); return ce.apply(console, arguments); };
  var q = new URLSearchParams(location.search);
  if (q.get('fresh') === '1') {
    try {
      var drop = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && (k.indexOf('kbo-opus:alt-d') === 0 || k.indexOf('kbo-spread') === 0)) drop.push(k); }
      drop.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* 저장소를 쓸 수 없으면 무시 */ }
  }
  if (q.get('debug') === 'scroll') document.documentElement.classList.add('sp-debug-scroll');
})();
