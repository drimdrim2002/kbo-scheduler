/*
 * 편성 기록 화면 — 안 A(표준): 하루치 기록을 표 하나로, 최근 것이 위.
 * 데이터·화면 말은 admin-data.js(KBOAdmin). 비밀번호는 메모리에만 둔다.
 */
(function () {
  'use strict';
  const A = window.KBOAdmin;
  const esc = A.esc;
  const root = document.getElementById('adm');
  const params = new URLSearchParams(location.search);
  const ui = { view: 'signin', err: '', busy: false, data: null, showServer: false, downloading: -1 };

  function mark() {
    const h = document.documentElement;
    h.setAttribute('data-admin', ui.view);
    h.setAttribute('data-scroll', h.scrollWidth > window.innerWidth ? 'x' : 'none');
  }

  function render() {
    root.innerHTML = ui.view === 'signin' ? signinView() : ui.view === 'list' ? listView() : errorView();
    if (ui.view === 'signin') {
      const pw = document.getElementById('admPw');
      if (pw) pw.focus();
    }
    mark();
  }

  function signinView() {
    return '<section class="adm-signin"><h1>편성 기록</h1><p class="adm-lead">관리자 비밀번호를 넣으면 편성 기록을 볼 수 있습니다.</p>' +
      '<form id="admSignin" class="adm-form"><label class="field"><span>관리자 비밀번호</span>' +
      '<input class="input" id="admPw" type="password" autocomplete="current-password"></label>' +
      '<button class="btn primary" type="submit"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? '확인 중…' : '확인') + '</button></form>' +
      (ui.err ? '<p class="adm-err" role="alert">' + esc(ui.err) + '</p>' : '') + '</section>';
  }

  function errorView() {
    return '<section class="adm-signin"><h1>편성 기록</h1><p class="adm-err" role="alert">' + esc(ui.err) + '</p>' +
      '<button class="btn" data-act="retry">다시 불러오기</button></section>';
  }

  const TONE_ORDER = [['ok', '완료'], ['info', '저장된 결과'], ['muted', '중지·취소'], ['bad', '실패'], ['warn', '받지 않음']];

  function listView() {
    const d = ui.data, dates = d.dates || [], i = dates.indexOf(d.date);
    const all = (d.entries || []).slice().reverse();
    const serverCount = all.filter((e) => A.describe(e).server).length;
    const rows = ui.showServer ? all : all.filter((e) => !A.describe(e).server);
    const t = A.tally(all.filter((e) => !A.describe(e).server));
    const older = i >= 0 && i + 1 < dates.length ? dates[i + 1] : null;
    const newer = i > 0 ? dates[i - 1] : null;
    const opts = (dates.length ? dates : [d.date]).map((x) => '<option value="' + esc(x) + '"' + (x === d.date ? ' selected' : '') + '>' + esc(A.dayLabel(x)) + '</option>').join('');
    const tally = '<span class="adm-n"><b>' + t.all + '</b>번</span><span class="adm-n">방문자 <b>' + t.visitors + '</b></span>' +
      TONE_ORDER.filter(([k]) => t[k]).map(([k, w]) => '<span class="adm-n tone-' + k + '">' + w + ' <b>' + t[k] + '</b></span>').join('');
    let h = '<section class="adm-list">' +
      '<div class="adm-head"><div><h1>편성 기록</h1><p class="adm-lead">편성을 부를 때마다 한 줄씩 남습니다. 시각은 한국 시각입니다.</p></div>' +
      (d.sample ? '<p class="adm-sample">예시 기록입니다. 서버에서 열면 실제 기록이 보입니다.</p>' : '') + '</div>' +
      '<div class="adm-bar">' +
      '<div class="adm-day"><button class="btn sm icon" data-act="day" data-day="' + esc(older || '') + '"' + (older ? '' : ' disabled') + ' aria-label="전날">‹</button>' +
      '<select class="select sm" id="admDay" aria-label="날짜">' + opts + '</select>' +
      '<button class="btn sm icon" data-act="day" data-day="' + esc(newer || '') + '"' + (newer ? '' : ' disabled') + ' aria-label="다음 날">›</button></div>' +
      '<div class="adm-tally">' + tally + '</div>' +
      '<div class="adm-tools">' + (serverCount ? '<label class="adm-check"><input type="checkbox" id="admServer"' + (ui.showServer ? ' checked' : '') + '> 서버가 만든 기록도 보기 (' + serverCount + ')</label>' : '') +
      '<button class="btn sm" data-act="refresh"' + (ui.busy ? ' disabled' : '') + '>새로 고침</button></div></div>';
    if (!rows.length) {
      h += '<div class="empty"><b>이 날은 기록이 없습니다.</b>다른 날을 골라 보세요.</div>';
    } else {
      h += '<table class="adm-table"><thead><tr><th class="c-time">시각</th><th class="c-who">방문자</th><th class="c-kind">종류</th>' +
        '<th class="c-st">결과</th><th class="c-rule">규칙</th><th class="c-took">걸린 시간</th><th class="c-cond">조건</th><th class="c-act"></th></tr></thead><tbody>' +
        rows.map(row).join('') + '</tbody></table>';
    }
    if (ui.err) h += '<p class="adm-err" role="alert">' + esc(ui.err) + '</p>';
    return h + '</section>';
  }

  function row(e) {
    const v = A.describe(e);
    const sub = v.error || v.note;
    const cond = [v.limit, v.start].filter(Boolean).join(' · ');
    const acts = (v.resultUrl ? '<a class="btn sm" href="' + esc(v.resultUrl) + '" target="_blank" rel="noopener">결과 보기</a>' : '') +
      '<button class="btn sm" data-act="download" data-index="' + e.index + '"' + (ui.downloading === e.index ? ' disabled' : '') + '>' +
      (ui.downloading === e.index ? '받는 중…' : '입력 내려받기') + '</button>';
    return '<tr class="' + (v.server ? 'is-server' : '') + '">' +
      '<td class="c-time">' + esc(v.time) + '</td>' +
      '<td class="c-who">' + esc(v.who) + '</td>' +
      '<td class="c-kind">' + esc(v.kind) + '</td>' +
      '<td class="c-st"><span class="adm-st tone-' + v.tone + '">' + esc(v.statusWord) + '</span>' + (sub ? '<div class="adm-sub' + (v.error ? ' is-err' : '') + '">' + esc(sub) + '</div>' : '') + '</td>' +
      '<td class="c-rule">' + (v.rules ? '<span class="' + (v.rulesOk ? 'rule-ok' : 'rule-bad') + '">' + esc(v.rules) + '</span>' : '<span class="adm-dim">—</span>') + '</td>' +
      '<td class="c-took">' + esc(v.took || '—') + '</td>' +
      '<td class="c-cond">' + esc(cond || '—') + (v.inputSize ? '<div class="adm-sub">입력 ' + esc(v.inputSize) + '</div>' : '') + '</td>' +
      '<td class="c-act">' + acts + '</td></tr>';
  }

  function show(date) {
    ui.busy = true; ui.err = '';
    return A.load(date).then((d) => { ui.data = d; ui.view = 'list'; }).catch((e) => {
      ui.err = e.message;
      if (e.status === 403 || e.status === 429) ui.view = 'signin';
      else if (!ui.data) ui.view = 'error';
    }).then(() => { ui.busy = false; render(); });
  }

  document.addEventListener('submit', (ev) => {
    if (!ev.target || ev.target.id !== 'admSignin') return;
    ev.preventDefault();
    const pw = document.getElementById('admPw');
    if (ui.busy || !pw) return;
    ui.busy = true; ui.err = ''; render();
    A.signIn(pw.value).then((d) => { ui.data = d; ui.view = 'list'; }).catch((e) => { ui.err = e.message; })
      .then(() => { ui.busy = false; render(); });
  });

  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'admDay') show(ev.target.value);
    if (ev.target.id === 'admServer') { ui.showServer = ev.target.checked; render(); }
  });

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.getAttribute('data-act');
    if (act === 'day' && b.dataset.day) show(b.dataset.day);
    if (act === 'refresh' || act === 'retry') show(ui.data ? ui.data.date : null);
    if (act === 'download') {
      const idx = Number(b.dataset.index);
      ui.downloading = idx; render();
      A.download(ui.data.date, idx).catch((e) => { ui.err = e.message; }).then(() => { ui.downloading = -1; render(); });
    }
  });

  window.addEventListener('resize', mark);

  if (A.offline && !params.has('signin')) show(null);
  else render();
})();
