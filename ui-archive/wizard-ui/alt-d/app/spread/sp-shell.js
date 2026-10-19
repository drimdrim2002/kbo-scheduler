/*
 * alt-d — 고정 골격: 상단 띠(제품·점수 배지·엔진 상태·메뉴), 장(章) 탭, 확정한 장의 요약 카드 띠,
 * 좌우 2단 펼친 면(본문 · 여백), 아래 쪽번호 띠(이전 장 / 다음 장), 모달 층.
 */
(function () {
  'use strict';
  const SP = window.SP;
  const { esc, fmt } = SP;
  const app = SP.app;
  const ui = SP.ui;
  const KBO = window.KBO;

  const $ = (id) => document.getElementById(id);
  const CH_NO = ['', '제1장', '제2장', '제3장', '제4장'];
  SP.CH_NO = CH_NO;

  // ───────────── 상단 띠 ─────────────
  function badgeHtml() {
    const ex = SP.ex();
    const mode = app.state.settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준';
    const pool = app.derived().pool.length;
    const n = ex.violations.length;
    const vc = SP.virtualCount();
    let main;
    if (ex.feasible) main = '<span class="sp-badge sp-badge-ok" title="' + esc(fmt.score(ex.score)) + '"><span aria-hidden="true">✔</span> 편성 가능' + (pool ? ' <small>· 미배정 ' + pool + '</small>' : '') + '</span>';
    else main = '<span class="sp-badge sp-badge-bad" title="' + esc(fmt.score(ex.score)) + '"><span aria-hidden="true">✖</span> Hard 위반 ' + n + '건' + (vc ? ' <small>(가상 ' + vc + ')</small>' : '') + '</span>';
    return '<div class="sp-scorebox" role="status" aria-label="점수 배지">' + main +
      '<button type="button" class="sp-modechip" data-act="modal" data-arg="settings" title="H0-e 이벤트 홈 의무 채점 모드 — 설정에서 바꿈">H0-e · ' + mode + '</button>' +
      '<span class="sp-scorestr" aria-label="점수">' + esc(fmt.score(ex.score)) + '</span></div>';
  }
  function engineHtml() {
    const r = SP.run;
    const label = app.engine.label || 'Mock';
    if (r && r.status === 'RUNNING') return '<div class="sp-engine sp-engine-run" role="status"><span class="sp-dot" aria-hidden="true"></span>엔진 실행 중 <b>' + fmt.time(r.progress * 60000) + '</b><span class="sp-lock" title="실행 중에는 입력과 배정을 바꿀 수 없습니다"><span aria-hidden="true">⊘</span> 입력 잠김</span></div>';
    if (r && r.status === 'PAUSED') return '<div class="sp-engine sp-engine-pause" role="status"><span aria-hidden="true">❚❚</span> 일시정지 <b>' + fmt.time(r.progress * 60000) + '</b><span class="sp-lock"><span aria-hidden="true">⊘</span> 입력 잠김</span></div>';
    return '<div class="sp-engine" role="status"><span aria-hidden="true">○</span> 엔진 대기 <span class="sp-muted">· ' + esc(/Mock|시뮬/.test(label) ? 'Mock 엔진' : label) + '</span></div>';
  }
  function dataMenu() {
    if (ui.menu !== 'data') return '';
    const lastUrl = SP.sheetUrl();
    return '<div class="sp-pop sp-pop-data" role="menu" aria-label="데이터">' +
      '<div class="sp-pop-h">가져오기</div>' +
      '<button class="sp-pop-i" role="menuitem" data-act="importStart" data-arg="xlsx">.xlsx 업로드… <span class="sp-kbd">파일 선택·끌어 놓기</span></button>' +
      '<button class="sp-pop-i" role="menuitem" data-act="modal" data-arg="gsheet">구글 시트 연결… <span class="sp-kbd">공유 링크</span></button>' +
      '<button class="sp-pop-i" role="menuitem" data-act="importStart" data-arg="gsheet"' + (lastUrl ? '' : ' disabled') + '>다시 불러오기 <span class="sp-kbd">' + esc(lastUrl ? '마지막 링크' : '연결 기록 없음') + '</span></button>' +
      '<div class="sp-pop-h">내보내기</div>' +
      '<button class="sp-pop-i" role="menuitem" data-act="mockToast" data-arg=".xlsx 내보내기">.xlsx 내보내기 ' + SP.mock() + '</button>' +
      '<button class="sp-pop-i" role="menuitem" data-act="mockToast" data-arg="빈 양식 다운로드">빈 양식 다운로드 ' + SP.mock() + '</button>' +
      '<button class="sp-pop-i" role="menuitem" data-act="mockToast" data-arg="2025 예시 파일">2025 예시 파일 (프리셋) ' + SP.mock() + '</button>' +
      '<div class="sp-pop-h">프로젝트</div>' +
      '<button class="sp-pop-i" role="menuitem" data-act="exportProject">프로젝트 JSON 내보내기</button>' +
      '<button class="sp-pop-i" role="menuitem" data-act="exportEngine">엔진 입력 JSON 내보내기</button>' +
      '</div>';
  }
  SP.act.exportProject = () => app.exportProject();
  SP.act.exportEngine = () => app.exportEngine();

  function renderMast() {
    const el = $('sp-mast');
    const m = app.state.meta;
    el.innerHTML = '<div class="sp-brand"><span class="sp-brand-t">KBO 일정 편성 <em>· ' + esc(m.season) + '</em></span><span class="sp-brand-d">' + esc(m.name || '') + '</span></div>' +
      badgeHtml() + engineHtml() +
      '<nav class="sp-menu" aria-label="메뉴">' +
      '<div class="sp-menu-wrap"><button type="button" class="sp-menu-b" data-act="menu" data-arg="data" aria-haspopup="menu" aria-expanded="' + (ui.menu === 'data') + '">데이터 <span aria-hidden="true">▾</span></button>' + dataMenu() + '</div>' +
      '<button type="button" class="sp-menu-b' + (ui.view === 'ops' ? ' sp-on' : '') + '" data-act="ops"' + (ui.view === 'ops' ? ' aria-current="page"' : '') + '>시즌 운영</button>' +
      '<button type="button" class="sp-menu-b" data-act="modal" data-arg="settings">설정</button>' +
      '</nav>';
  }

  // ───────────── 장 탭 ─────────────
  function renderChapters() {
    const el = $('sp-chapters');
    if (ui.view === 'ops') { el.className = 'sp-chapters sp-chapters-ops'; el.innerHTML = SP.views.ops.header(); return; }
    el.className = 'sp-chapters';
    let h = '';
    for (let n = 1; n <= 4; n++) {
      const ch = SP.chapters[n];
      const st = SP.chapterState(n);
      const cur = ui.step === n;
      h += '<button type="button" class="sp-ch sp-ch-' + st.kind + (cur ? ' sp-cur' : '') + '" data-act="go" data-arg="' + n + '"' + (cur ? ' aria-current="step"' : '') + '>' +
        '<span class="sp-ch-l1"><span class="sp-ch-no">' + CH_NO[n] + '</span><span class="sp-ch-t">' + esc(ch.title) + '</span>' + SP.chip(st.kind === 'done' ? 'done' : st.kind, st.text) + '</span>' +
        '<span class="sp-ch-l2">' + esc(ch.summary()) + '</span></button>';
    }
    el.innerHTML = h;
  }

  // ───────────── 확정한 장 요약 카드 띠 ─────────────
  function renderBand() {
    const el = $('sp-band');
    if (ui.view === 'ops') { el.innerHTML = SP.views.ops.band(); return; }
    let h = '<span class="sp-band-l">확정한 장</span>';
    let k = 0;
    for (let n = 1; n <= 4; n++) {
      if (!SP.isConfirmed(n)) continue;
      k++;
      const ch = SP.chapters[n];
      const st = SP.chapterState(n);
      h += '<div class="sp-card' + (st.kind === 'block' ? ' sp-card-bad' : '') + '"><span class="sp-card-ic" aria-hidden="true">' + (st.kind === 'block' ? '⛔' : '✔') + '</span><span class="sp-card-t">' + CH_NO[n] + ' ' + esc(ch.title) + '</span><span class="sp-card-s">' + esc(ch.card ? ch.card() : ch.summary()) + '</span>' +
        '<button type="button" class="sp-link" data-act="reopen" data-arg="' + n + '">다시 열기</button></div>';
    }
    if (!k) h += '<span class="sp-band-empty">장을 확정하면 한 줄 요약 카드가 여기에 쌓입니다.</span>';
    h += '<span class="sp-band-r">확정 ' + k + ' / 4</span>';
    el.innerHTML = h;
  }

  // ───────────── 본문 · 여백 ─────────────
  function renderSpread() {
    const main = $('sp-main');
    const margin = $('sp-margin');
    if (ui.view === 'ops') {
      main.innerHTML = SP.views.ops.main();
      margin.innerHTML = SP.marginWrap(SP.views.ops.margin());
      return;
    }
    const ch = SP.chapters[ui.step];
    const tab = ui.tab[ui.step];
    main.innerHTML = ch.main(tab);
    margin.innerHTML = SP.marginWrap(ch.margin(tab));
  }
  /** 여백: 위는 스크롤되는 주석, 아래는 고정된 "다음 할 일" */
  SP.marginWrap = function (m) {
    const o = typeof m === 'string' ? { body: m } : m;
    return '<div class="sp-margin-body" data-sk="margin-' + ui.view + ui.step + '">' + o.body + '</div>' + (o.next ? '<div class="sp-next"><h3 class="sp-mh">다음 할 일</h3>' + o.next + '</div>' : '');
  };
  SP.mSec = function (title, body, opts) {
    const o = opts || {};
    return '<section class="sp-msec' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><h3 class="sp-mh">' + title + (o.right ? '<span class="sp-mh-r">' + o.right + '</span>' : '') + '</h3>' + body + '</section>';
  };
  /** 장 안의 하위 탭(절) + 오른쪽 도구 */
  SP.subhead = function (n, tabs, cur, tools, lead) {
    let h = '<div class="sp-subhead"><div class="sp-subtabs" role="tablist" aria-label="' + esc(CH_NO[n] || '') + ' 절">';
    tabs.forEach((t, i) => {
      const on = t.id === cur;
      const fl = ui.flash === 'tab-' + t.id;
      h += '<button type="button" role="tab" class="sp-subtab' + (on ? ' sp-on' : '') + (fl ? ' sp-flash' : '') + '" aria-selected="' + on + '" data-act="tab" data-arg="' + t.id + '"><span class="sp-subtab-no">' + (typeof n === 'number' ? n + '.' + (i + 1) : '') + '</span>' + esc(t.label) + (t.badge ? ' ' + t.badge : '') + '</button>';
    });
    h += '</div>' + (lead ? '<p class="sp-lead">' + lead + '</p>' : '') + '<div class="sp-subtools">' + (tools || '') + '</div></div>';
    return h;
  };

  // ───────────── 아래 쪽번호 띠 ─────────────
  function renderFoot() {
    const el = $('sp-foot');
    if (ui.view === 'ops') {
      el.innerHTML = '<div class="sp-foot-l">' + SP.btn('wizard', '<span aria-hidden="true">◀</span> 편성 위저드로 돌아가기 · ' + esc(CH_NO[ui.step] + ' ' + SP.chapters[ui.step].title)) + '</div>' +
        '<div class="sp-folio"><span class="sp-folio-t">별책 · 시즌 운영</span><span class="sp-folio-d">1차 편성 확정 뒤 경기 기록과 9~10월 재편성</span></div><div class="sp-foot-r"></div>';
      return;
    }
    const n = ui.step;
    const ch = SP.chapters[n];
    const st = SP.chapterState(n);
    const prev = n > 1 ? SP.chapters[n - 1] : null;
    const next = n < 4 ? SP.chapters[n + 1] : null;
    const stTxt = st.kind === 'done' ? '✔ 완료' : st.kind === 'block' ? '⛔ ' + (st.short || '차단') : st.kind === 'warn' ? '⚠ ' + (st.short || '확인 필요') : '○ 작성 중';
    const conf = SP.isConfirmed(n);
    el.innerHTML = '<div class="sp-foot-l">' + (prev ? SP.btn('go', '<span aria-hidden="true">◀</span> 이전 장 · ' + esc(prev.title), { arg: n - 1 }) : '<span class="sp-foot-start">시작 장</span>') + '</div>' +
      '<div class="sp-folio"><span class="sp-folio-n">— ' + n + ' —</span><span class="sp-folio-t">' + CH_NO[n] + ' ' + esc(ch.title) + '</span><span class="sp-folio-d">' + esc(ch.task) + '</span></div>' +
      '<div class="sp-foot-r">' +
      (conf ? SP.btn('confirm', '확정 취소', { arg: n, kind: 'ghost' }) : SP.btn('confirm', '<span aria-hidden="true">✔</span> 이 장 확정하고 접기', { arg: n, disabled: st.kind === 'block', title: st.kind === 'block' ? '차단 항목을 먼저 해결하세요' : '' })) +
      (next ? SP.btn('go', '다음 장 · ' + esc(next.title) + ' <span class="sp-foot-st">(' + esc(stTxt) + ')</span> <span aria-hidden="true">▶</span>', { arg: n + 1, kind: 'primary' }) : SP.btn('ops', '시즌 운영으로 <span aria-hidden="true">▶</span>', { kind: 'primary' })) +
      '</div>';
  }

  // ───────────── 모달 층 ─────────────
  function renderLayer() {
    const el = $('sp-layer');
    const name = ui.modal;
    const m = name && SP.modals[name];
    if (!m) { el.innerHTML = ''; el.hidden = true; document.getElementById('sp-root').removeAttribute('inert'); return; }
    el.hidden = false;
    el.innerHTML = '<div class="sp-scrim" data-act="closeModal" aria-hidden="true"></div><div class="sp-modal sp-modal-' + (m.size || 'mid') + '" role="dialog" aria-modal="true" aria-labelledby="sp-modal-t">' + m.render() + '</div>';
    document.getElementById('sp-root').setAttribute('inert', '');
    if (!el.contains(document.activeElement)) { const f = el.querySelector('[data-autofocus]') || el.querySelector('.sp-modal button, .sp-modal input'); if (f) f.focus({ preventScroll: true }); }
  }

  SP.renderers.push(renderMast, renderChapters, renderBand, renderSpread, renderFoot, renderLayer);
})();
