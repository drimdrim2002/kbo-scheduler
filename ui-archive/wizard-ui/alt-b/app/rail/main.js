/*
 * alt-b 단계 레일 — 시작, 해시 라우팅(스크린샷용 고정 상태 포함), 스크롤 점검 표시.
 *
 * 해시 예:
 *   #step=1&tab=slots            ① 슬롯        #step=1&tab=series&edit=demo  ① 시리즈 셀 편집 중(오류)
 *   #step=1&modal=import         가져오기 미리보기   #step=1&modal=import&stage=confirm  배정 초기화 확인
 *   #step=2&run=frozen           ② 엔진 실행 중(고정)  #step=3&sel=74  ③ 시리즈 선택
 *   #step=4&tab=charts           ④ 차트         #view=ops&tab=reschedule&result=1  재편성 결과
 *   #view=settings               설정           ?debug=scroll  페이지 스크롤 점검 표시
 */
(function () {
  'use strict';
  const R = window.R;

  function applyHash() {
    const p = R.parseHash();
    if (R._silentHash && location.hash === R._silentHash) { R._silentHash = null; return; }
    R.ui.params = p;
    if (p.fresh) { R.resetFeatures(); R.ls.del('rail'); R.ui.collapsed = false; }
    if (p.rail === 'collapsed') R.ui.collapsed = true;
    if (p.rail === 'open') R.ui.collapsed = false;
    if (p.features) { for (const part of p.features.split(',')) { const [id, v] = part.split(':'); if (id) R.features[id] = v !== '0'; } }
    if (p.view === 'ops') { R.ui.view = 'ops'; if (p.tab) R.ui.opsTab = p.tab; }
    else if (p.view === 'settings') R.ui.view = 'settings';
    else { R.ui.view = 'wizard'; if (p.step) R.ui.step = Math.min(4, Math.max(1, +p.step || 1)); if (p.tab) R.ui.tab[R.ui.step] = p.tab; }
    R.ui.modal = null;
    if (p.modal) {
      if ((p.modal === 'import' || p.modal === 'gsheet') && R.startImport) R.startImport(p.modal === 'gsheet' ? 'gsheet' : 'xlsx', { instant: true, stage: p.stage });
    }
    if (R.demo) for (const k of Object.keys(R.demo)) if (p[k] != null) R.demo[k](p[k], p);
    R.render();
  }

  // ?debug=scroll — 페이지 스크롤 여부와 잘림 검사 표시 (NFR-W4)
  R.debugScroll = function () {
    const p = R.ui.params || {};
    if (p.debug !== 'scroll') return;
    let el = document.getElementById('dbg');
    if (!el) { el = document.createElement('div'); el.id = 'dbg'; document.body.appendChild(el); }
    const de = document.documentElement;
    const W = window.innerWidth, H = window.innerHeight;
    const pageV = de.scrollHeight > H + 1 || document.body.scrollHeight > H + 1;
    const pageH = de.scrollWidth > W + 1 || document.body.scrollWidth > W + 1;
    const clipped = [];
    document.querySelectorAll('.top, .rail, .work-foot, .work, .split, .pane').forEach((n) => { const r = n.getBoundingClientRect(); if (r.bottom > H + 1 || r.right > W + 1) clipped.push(n.className.split(' ')[0]); });
    if (pageV || pageH) {
      // 페이지를 밀어내는 요소 찾기(스크롤 컨테이너 밖으로 나온 것)
      const clipsAnc = (n) => { for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (o.overflowY !== 'visible' || o.overflowX !== 'visible') return true; } return false; };
      document.querySelectorAll('body *').forEach((n) => { if (clipped.length > 6) return; const r = n.getBoundingClientRect(); if ((r.bottom > H + 1 || r.right > W + 1) && !clipsAnc(n)) clipped.push((n.tagName + '.' + (n.getAttribute('class') || '')).slice(0, 40) + '@' + Math.round(r.bottom)); });
    }
    const bad = pageV || pageH || clipped.length;
    el.className = 'dbg' + (bad ? ' bad' : '');
    el.textContent = (bad ? '페이지 스크롤 있음 ' : '페이지 스크롤 0 · ') + W + '×' + H + (bad ? ' 문서 ' + de.scrollWidth + '×' + de.scrollHeight : '') + (clipped.length ? ' · 잘림 ' + clipped.join(',') : '') + ' · 오류 ' + (window.__errors || []).length;
    de.setAttribute('data-scroll', JSON.stringify({ W, H, sw: de.scrollWidth, sh: de.scrollHeight, bsw: document.body.scrollWidth, bsh: document.body.scrollHeight, clipped, errors: window.__errors || [], screen: R.screenKey(), modal: R.ui.modal }));
  };

  R.bind();
  window.addEventListener('hashchange', applyHash);
  window.addEventListener('resize', () => R.render());
  applyHash();
})();
