/*
 * alt-b 단계 레일 — ② 검토·실행.
 * 왼쪽: 입력 요약 + 사전 점검(통과·경고·차단, 입력 위치로 이동). 오른쪽: 엔진 옵션·실행·진행(목업)·점수 추이·입력 잠금.
 */
(function () {
  'use strict';
  const R = window.R;
  const esc = R.esc;
  const D = R.KBO.Dates;
  const u = R.ui;
  u.engine = { timeLimit: 60, unimproved: 15, init: 'KEEP', seed: 42 };
  R.lastRun = { at: '10/18(토) 14:10', sec: 60, improvements: 1284, reason: '시간 제한' };

  function trendAt(t) {
    const hard = Math.round(41 * Math.exp(-t / 8.5)) + 3;
    const soft = -919000 - Math.round(265000 * Math.exp(-t / 14));
    return { hard, soft };
  }
  function summary(d) {
    const st = R.state();
    const h = d.preflight.sh;
    const games = st.matches.reduce((a, b) => a + b.consecutive, 0);
    return '<div class="kpis k3 kpis-sm">' +
      R.kpi('구단', st.teams.length + '<small>개</small>', '공유 구장 1 · 잠실') +
      R.kpi('1차 편성 기간', D.fmtShort(st.settings.seasonStart) + '~' + D.fmtShort(st.settings.initialEnd), '경기 없는 기간 ' + st.settings.blackouts.length) +
      R.kpi('슬롯', st.calendar.length + '<small>개</small>', '2·3·4연전 ' + (h[2] || 0) + '·' + (h[3] || 0) + '·' + (h[4] || 0)) +
      R.kpi('시리즈', st.matches.length + '<small>개</small>', games + '경기 · 구단당 ' + Math.round(games * 2 / st.teams.length)) +
      R.kpi('이벤트', st.events.length + '<small>건</small>', '개막 대진 5 · 어린이날 구장 5') +
      R.kpi('고정(핀)', st.matches.filter((m) => m.pinned).length + '<small>시리즈</small>', '엔진이 옮기지 않음') + '</div>';
  }
  function left(d) {
    const pf = d.preflight;
    let b = '<div class="sect"><div class="sect-h"><h3>입력 요약</h3><span class="hint">① 데이터 준비에서 가져온 값</span></div>' + summary(d) + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>사전 점검</h3><span class="pfcount">' + R.st('ok', '통과 ' + pf.counts.ok) + R.st('warn', '경고 ' + pf.counts.warn) + R.st('block', '차단 ' + pf.counts.block) + '</span></div><ul class="pf">';
    const order = { block: 0, warn: 1, ok: 2 };
    for (const it of pf.items.slice().sort((a, b) => order[a.status] - order[b.status])) {
      const l = it.link;
      const attr = l.view ? 'data-view="' + l.view + '"' : 'data-step="' + l.step + '" data-tab="' + l.tab + '"' + (l.row != null && l.row >= 0 ? ' data-row="' + l.row + '"' : '');
      b += '<li class="pf-i st-' + it.status + '">' + R.stIcon(it.status) + '<div class="pf-t"><b>' + esc(it.title) + '</b><span>' + esc(it.detail) + '</span></div><button class="lnk pf-go" data-act="go" ' + attr + '>' + (l.view ? '설정' : '입력 위치') + ' →</button></li>';
    }
    b += '</ul><p class="hint">연전 k마다 “k연전 시리즈 수 ≤ k연전 슬롯 수 × (구단 수 / 2)”를 검사합니다. 부족하면 차단, 남으면 경고만 합니다.</p></div>';
    return R.pane({ title: '입력 검토', sub: '차단이 있으면 실행할 수 없습니다', body: b, sk: 'review' });
  }
  function right(d) {
    const pf = d.preflight;
    const r = R.run;
    const running = r && (r.status === 'RUNNING' || r.status === 'PAUSED');
    const e = u.engine;
    const dis = running ? ' disabled' : '';
    let b = '<div class="eng-opts"><div class="field"><label for="o-time">최대 실행 시간</label><span class="unit"><input class="inp" id="o-time" type="number" min="5" max="600" value="' + e.timeLimit + '" data-in="eng" data-k="timeLimit"' + dis + '>초</span></div>' +
      '<div class="field"><label for="o-un">개선 없음 종료</label><span class="unit"><input class="inp" id="o-un" type="number" min="1" value="' + e.unimproved + '" data-in="eng" data-k="unimproved"' + dis + '>초</span></div>' +
      '<div class="field"><span class="flabel">초기해</span><div class="seg"><button class="' + (e.init === 'KEEP' ? 'is-on' : '') + '" data-act="eng-init" data-v="KEEP"' + dis + '>현재 배정 유지</button><button class="' + (e.init === 'SCRATCH' ? 'is-on' : '') + '" data-act="eng-init" data-v="SCRATCH"' + dis + '>처음부터</button></div></div>' +
      '<div class="field"><label for="o-seed">시드</label><input class="inp" id="o-seed" type="number" value="' + e.seed + '" data-in="eng" data-k="seed"' + dis + '></div></div>';
    b += '<div class="eng-src"><span class="kicker">엔진</span><b>시뮬레이션 엔진 (Mock)</b><span class="hint">REST 연결은 설정에서 · 결과 품질은 보장하지 않음</span>' + R.mock() + '</div>';
    if (pf.counts.block) {
      const first = pf.items.find((x) => x.status === 'block');
      b += '<div class="runbox blocked"><button class="btn btn-lg btn-primary" disabled>' + R.icon('lock') + '엔진 실행</button><div class="note bad">' + R.icon('block') + '<span><b>사전 점검 차단 ' + pf.counts.block + '건</b> — ' + esc(first.title) + ': ' + esc(first.detail) + ' <button class="lnk" data-act="go" data-step="' + (first.link.step || 1) + '" data-tab="' + (first.link.tab || '') + '"' + (first.link.row != null && first.link.row >= 0 ? ' data-row="' + first.link.row + '"' : '') + '>고치러 가기 →</button></span></div></div>';
    } else if (!running) {
      b += '<div class="runbox"><button class="btn btn-lg btn-primary" data-act="run-start">' + R.icon('chevR') + '엔진 실행</button><span class="hint">실행하는 동안 ①·③의 입력과 배정이 잠깁니다. 고정 ' + R.state().matches.filter((m) => m.pinned).length + ' 시리즈는 옮기지 않습니다.</span></div>';
    }
    if (running) {
      const total = r.total;
      const cur = trendAt(r.elapsed);
      b += '<div class="runbox live"><div class="run-top"><div class="run-clock"><span class="l">경과</span><b class="num">' + R.clock(r.elapsed) + '</b><span class="muted">/ ' + R.clock(total) + '</span></div><div class="run-imp"><span class="l">개선</span><b class="num">' + R.fmt.int(r.improvements) + '</b><span class="muted">회</span></div>' +
        '<div class="run-btns"><button class="btn" data-act="run-pause">' + (r.status === 'PAUSED' ? '재개' : '일시정지') + '</button><button class="btn btn-danger" data-act="run-stop">중지</button></div></div>' +
        R.chart.meter(r.elapsed, total, { title: '진행', color: 'var(--teal)' }) +
        '<div class="run-trend"><div><div class="sect-h"><h3>Hard 위반 추이</h3><span class="hint">' + r.trend[0].hard + ' → ' + cur.hard + '</span></div>' + R.chart.spark(r.trend.map((x) => -x.hard), { width: 300, height: 64, n: Math.round(total / 2) + 1, title: 'Hard 추이' }) + '</div>' +
        '<div><div class="sect-h"><h3>Soft 추이</h3><span class="hint">S2 분산 · S4 거리 합산</span></div>' + R.chart.spark(r.trend.map((x) => x.soft), { width: 300, height: 64, n: Math.round(total / 2) + 1, title: 'Soft 추이', color: 'var(--away)' }) + '</div></div>' +
        '<div class="note lock">' + R.icon('lock') + '<span><b>입력 잠금</b> — 엔진이 더 좋은 해를 찾을 때마다(250ms 이상 간격) 캘린더와 상단 배지를 갱신합니다. 끝나면 ③ 결과·수정으로 이동합니다.</span></div></div>';
    } else {
      const lr = R.lastRun;
      b += '<div class="lastrun"><div class="sect-h"><h3>마지막 실행</h3><span class="hint">' + esc(lr.at) + '</span></div><div class="kpis k3 kpis-sm">' + R.kpi('실행 시간', lr.sec + '<small>초</small>', '종료: ' + esc(lr.reason)) + R.kpi('개선', R.fmt.int(lr.improvements) + '<small>회</small>', '시드 ' + u.engine.seed) + R.kpi('결과', '<button class="lnk big" data-act="go" data-step="3">③에서 보기</button>', '점수는 상단 배지') + '</div></div>';
    }
    return R.pane({ cls: 'pane-live', title: '엔진 실행', kicker: running ? '실행 중' : '실행', live: running, body: b, sk: 'engine' });
  }

  function tick() {
    const r = R.run;
    if (!r || r.status !== 'RUNNING' || r.frozen) return;
    r.elapsed = Math.min(r.total, r.elapsed + 2);
    r.improvements += 18 + Math.floor(Math.random() * 25);
    r.trend.push(trendAt(r.elapsed));
    r.progress = r.elapsed / r.total;
    if (r.elapsed >= r.total) return finish('시간 제한');
    R.render();
    r.timer = setTimeout(tick, 250);
  }
  function finish(reason) {
    const r = R.run;
    if (!r) return;
    clearTimeout(r.timer);
    r.status = 'DONE';
    const snap = R.state().snapshots.find((s) => s.id === 'snap-engine');
    R.lastRun = { at: '방금', sec: Math.round(r.elapsed), improvements: r.improvements, reason };
    if (snap) R.commit('엔진 결과 반영', (s) => { s.plan = JSON.parse(JSON.stringify(snap.plan)); });
    R.run = null;
    R.toast('엔진 ' + (reason === '중지' ? '중지' : '완료') + ' — 결과를 ③ 결과·수정에 반영했습니다. (가상 위반 3건 포함 목업 결과)', 'ok', 4200);
    R.go({ step: 3 });
  }
  R.startRun = function (frozen) {
    const total = u.engine.timeLimit;
    R.run = { status: 'RUNNING', elapsed: 0, total, improvements: 0, trend: [trendAt(0)], progress: 0, frozen: !!frozen };
    if (frozen) {
      for (let t = 2; t <= 36; t += 2) R.run.trend.push(trendAt(t));
      R.run.elapsed = 37; R.run.improvements = 812; R.run.progress = 37 / total;
    } else R.run.timer = setTimeout(tick, 250);
    R.render();
  };

  R.screens.w2 = { left, right, cls: 'even' };
  Object.assign(R.act, {
    'run-start'() { if (R.derived().preflight.counts.block) return; R.startRun(false); R.toast('엔진을 시작했습니다 (목업 · 약 8초 뒤 끝남).', 'info'); },
    'run-pause'() { const r = R.run; if (!r) return; if (r.status === 'PAUSED') { r.status = 'RUNNING'; r.frozen = false; r.timer = setTimeout(tick, 250); } else { r.status = 'PAUSED'; clearTimeout(r.timer); } R.render(); },
    'run-stop'() { finish('중지'); },
    'eng-init'(el) { u.engine.init = el.getAttribute('data-v'); R.render(); }
  });
  R.inputs.eng = (el) => { u.engine[el.getAttribute('data-k')] = Number(el.value) || u.engine[el.getAttribute('data-k')]; R.render(); };
  R.demo = R.demo || {};
  R.demo.run = (v) => { if (v === 'frozen') R.startRun(true); };
})();
