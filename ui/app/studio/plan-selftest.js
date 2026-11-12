/*
 * 계획 흐름 자가 점검 (?plantest=1 일 때만 읽는다. ?selftest=1은 예전 화면을 보므로 따로 둔다)
 * 실제 버튼을 눌러 검토 게이트 · 고치기 · 운영 방침 → settings.objective · 실행 · 버전 저장·불러오기를 확인하고 <html data-plantest>에 적는다.
 * 서버 없이 도는 시험이다(브라우저 시험 엔진). 저장은 그 브라우저 프로필에만 남으므로 빈 프로필에서 돌린다(tools/studio/selftest.sh).
 */
(function () {
  'use strict';
  const S = window.Studio, P = S.planFlow, app = () => S.app, st = () => S.app.state;
  const KBO = window.KBO, Dates = KBO.Dates;
  const out = [];
  const ok = (name, cond, info) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (info != null ? ' (' + info + ')' : ''));
  const q = (sel) => document.querySelector(sel), qa = (sel) => Array.from(document.querySelectorAll(sel));
  const click = (sel) => { const el = q(sel); if (!el) throw new Error('없음: ' + sel); el.click(); return el; };
  const flush = () => S.render();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = () => (q('#app') || document.body).innerText;
  const ev = (t) => st().events.find((e) => e.type === t);
  const setBox = (i, v) => { const el = qa('input[data-in="pf-gap"]:not([type=range])')[i]; el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
  const ob = () => st().settings.objective;
  // 규칙을 어긴 결과는 저장하지 않는다. 시험 엔진은 짧은 시간에 규칙을 다 맞추지 못할 수 있어, 그때는 지킨 결과처럼 다시 기록해 이후 점검(저장·번호·불러오기)을 이어 간다
  let forcedRuns = 0;
  const keepRun = () => { const e = app().derived().ex, r = st().meta.result; if (!r || !r.rule || e.feasible) return false; forcedRuns++; S.afterRun(Object.assign({}, e, { feasible: true }), { elapsed: r.elapsedMs || 1000, startedAt: 0 }, r.why); flush(); return true; };
  const slotMatches = (c) => st().plan.filter((x) => x.calendar === c).map((x) => st().matches[x.match]);
  const WRONG = /노란|값 입력|값을 검토|목적식|엔진 옵션|파레토|균등|공평|균등|공평|시안 예시|대기|슬롯|인스펙터|스냅샷|프리셋|목업|구단쌍|미배정|위저드|JSON|[①②③④]|검토·실행|결과·수정|공정성·배포/;

  async function run() {
    try {
      // ── 처음 화면: 목적 아래에 연도
      const heads = qa('.pf-ch h2').map((h) => h.innerText), yrs = (i) => [...qa('.pf-ch')[i].querySelectorAll('.pf-yr .y')].map((y) => y.innerText);
      ok('처음 화면: 확정 전에는 새 계획 만들기(2027) 카드 하나 — 2025 결과 확인·재편성 없음', heads.join() === S.homeCopy.title && !q('.pf-start h1') && yrs(0).join() === '2027' && !q('.pf-start [data-act="pf-open-2025"]') && !q('.pf-start [data-act="rs-open"]'), heads + ' / ' + yrs(0));
      ok('결과가 없으면 새 계획 > 2027은 검토 시작 단추(문구는 home-copy.js)', !q('[data-act="pf-open-2027"][data-to="result"]') && qa('.pf-ch')[0].querySelector('[data-act="pf-open-2027"]').innerText.includes(S.homeCopy.startButton));
      // ── 검토 게이트
      click('[data-act="pf-open-2027"]'); flush();
      ok('처음 들어가면 값은 있어도 「검토 전」', !S.flowStatus().allDone && S.flowStatus().stop === 1 && S.seasonYear() === 2027);
      ok('고치지 않았으면 처음 제공한 값과 같은 값으로 본다', P.inputSig(st()) === P.inputSig(S.builtinOf(2027).build()));
      ok('1단계: 「있어요」 답 전에는 다음이 잠김', q('.footer .btn.primary').disabled);
      click('[data-act="pf-tour-ok"]'); flush();
      S.actions['fl-teams-changed'](); flush();
      ok('「있어요 — 고칠게요」 → 구단 고치기·말풍선 3장 시작', st().meta.flow.teams === 'changed' && /따라 하기 1 \/ 3/.test((q('.ct-card') || {}).innerText || ''));
      S.flowTour.cur = null; flush();
      S.ls.del(S.KEY + 'tour:plan1'); click('[data-act="pf-tour-again"]'); flush();
      ok('「따라 하기 다시 보기」 → 말풍선이 다시 나옴', /따라 하기 1 \/ 4/.test((q('.ct-card') || {}).innerText || ''));
      click('[data-act="pf-tour-ok"]'); flush();
      click('.footer .btn.primary'); flush();
      click('[data-act="pf-tour-ok"]'); flush();
      ok('2단계: 하나도 확인 안 하면 다음이 잠김', q('.footer .btn.primary').disabled && qa('.pf-rv[data-k]').length === 3);
      S.go({ step: 2 }); flush();
      ok('검토 전 운영 방침 → 들어가지 않고 멈춘 단계로', !S.run && S.ui.step === 1 && S.g1.fs === 2 && !q('[data-act="pf-run"]'));
      S.flowGo(4); flush();
      ok('주소로 앞 단계를 건너뛰어도 멈춘 단계로 · 단계 띠의 앞 단계는 잠김', S.g1.fs === 2 && q('.fb-step[data-fs="3"]').disabled && q('.fb-step[data-fs="4"]').disabled && !q('.fb-step[data-fs="1"]').disabled);

      // ── 고치기
      click('.pf-rv[data-k="opening"] [data-act="pf-cal"]'); flush();
      ok('개막일 고치기 → 그 줄 안에서 개막일 고르기가 열림', P.inline === 'opening' && !P.calEdit && S.cal.pickOpen && !!q('[data-act="cal-open"][data-date="2027-04-03"]'));
      click('[data-act="cal-open"][data-date="2027-04-03"]'); flush();
      click('[data-act="pf-cal-done"]'); flush();
      ok('개막일 4/3 → 검토 줄·경기일·1차 편성 끝·직접 고침', st().settings.seasonStart === '2027-04-03' && st().settings.initialEnd === '2027-09-12' && S.gameDaysCheck().ok && ev('OPENING').date === '2027-04-03' && /직접 고침/.test(q('.pf-rv[data-k="opening"]').innerText));
      app().undo(); flush();
      ok('실행 취소 → 추정값으로 돌아옴', st().settings.seasonStart === '2027-03-27' && /추정/.test(q('.pf-rv[data-k="opening"]').innerText));
      click('.pf-rv[data-k="allStar"] [data-act="pf-cal"]'); flush();
      ok('올스타 고치기 → 그 입력칸이 열림', S.cal.edit === 'allstar' && !!q('[data-in="cal-set"][data-k="allStarStart"]'));
      click('[data-act="pf-cal-done"]'); flush();
      for (const k of ['opening', 'initialEnd', 'allStar']) { click('.pf-rv[data-k="' + k + '"] [data-act="pf-ok"]'); flush(); }
      ok('2단계 모두 확인 → 다음이 열림', !q('.footer .btn.primary').disabled);
      click('.footer .btn.primary'); flush();
      click('[data-act="pf-tour-ok"]'); flush();
      click('.pf-rv[data-k="childrenHome"] [data-act="pf-cal"]'); flush();
      ok('어린이날 고치기 → 5/5가 골라짐', S.cal.day === KBO.Dates.dayNum('2027-05-05') && /5\/5/.test((q('.sc-hrow.on') || {}).innerText || ''));
      click('[data-act="pf-cal-done"]'); flush();
      click('.pf-rv[data-k="openingHome"] [data-act="pf-cal"]'); flush();
      ok('개막전 고치기 → 3/27이 골라짐', S.cal.day === KBO.Dates.dayNum('2027-03-27'));
      // 홈 구단은 잠겨 있다
      ok('개막전 홈 구단은 눌리지 않음 · 고정 안내', qa('.gs-tbtn').every((b) => b.disabled) && !q('[data-act="cal-home-off"]') && !q('[data-act="cal-home-fix"]') && /홈 구단은 고정/.test(page()));
      const homes0 = ev('OPENING').teams.join();
      S.actions['cal-home-team']({ dataset: { team: 'KT' } }); flush();
      ok('막힌 동작을 불러도 홈 구단이 그대로', ev('OPENING').teams.join() === homes0);
      // 상대만 바꾼다: 삼성↔NC 상대, KIA↔키움 상대
      const pick = (home, away) => { const sel = q('[data-in="cal-pair"][data-home="' + home + '"]'); sel.value = away; sel.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      pick('삼성', ''); pick('KIA', '키움'); pick('삼성', 'NC');
      ok('대진을 바꾸면 지금 시리즈와 어긋난 것으로 본다', !S.seriesOkOf(st()));
      click('[data-act="pf-cal-done"]'); flush();
      for (const k of ['openingHome', 'childrenHome']) { click('.pf-rv[data-k="' + k + '"] [data-act="pf-ok"]'); flush(); }
      ok('2·3단계 모두 확인 → 4단계까지 끝', S.flowStatus().allDone && !!st().meta.review.childrenHome);
      click('.footer .btn.primary'); flush();
      click('[data-act="pf-tour-ok"]'); flush();
      ok('4 확인: 「검토 완료」', /검토 완료/.test(page()));
      click('.footer [data-act="cal-next"]'); flush();
      const four = st().calendar.findIndex((c) => c.consecutive === 4);
      const hasKT = (ms) => ms.some((m) => m.home === 'KIA' && m.away === '키움') && ms.some((m) => m.home === '삼성' && m.away === 'NC');
      ok('다음 → 시리즈를 다시 만들어 개막전·후반기 첫 4연전이 새 대진을 따름', S.ui.step === 2 && S.seriesOkOf(st()) && hasKT(slotMatches(0)) && hasKT(slotMatches(four)));

      // ── 운영 방침 → settings.objective (선택안 B, 사용자 확정 2026-11-12: 카드 둘 + 접어 둔 허용 수준)
      const cardNames = () => qa('.pf-oc h4').map((h) => h.textContent.replace(/^선택/, '').replace(/^(선수|구단)/, '').trim()).join();
      const policy = () => q('.footer .pf-policy').innerText;
      const pageText = () => q('.pf-page').innerText;
      const sumText = () => q('#pf-levels .pf-fold .sum').innerText;
      const stepBtn = (k, d) => q('[data-act="pf-gap-step"][data-k="' + k + '"][data-d="' + d + '"]');
      const rangeOf = (k) => q('#pf-levels input[type=range][data-k="' + k + '"]');
      const boxOf = (k) => q('#pf-levels input[data-in="pf-gap"][data-k="' + k + '"]:not([type=range])');
      const chipOf = (k) => q('[data-pfdef="' + k + '"]');
      const setOb = (patch) => { app().updateSettings({ objective: Object.assign({}, ob(), patch) }, '점검'); flush(); };
      ok('머리글: 「운영 방침 정하기」 · 첫 문장은 형평성 · 두 관점(선수의 이동 부담 · 구단의 휴일 관중) · 설명 링크(제목 바로 오른쪽)', /운영 방침 정하기/.test(q('.pf-head h2').innerText) && /운영 방침은 일정의 형평성을 기준으로 정합니다\./.test(q('.pf-head .pf-d').innerText) && /선수의 이동 부담과 구단의 휴일 관중입니다/.test(q('.pf-head .pf-d').innerText) && /구단마다 고르게/.test(q('.pf-head .pf-d').innerText) && q('.pf-head h2 [data-act="pf-explain"]').getBoundingClientRect().left - q('.pf-head h2').getBoundingClientRect().left < 320);
      ok('없어진 것: 가로 띠 · 목표 네 칸 · 「지금 순위」 칸 · 옛 말(격차 · 순위 · 목표 · 운영의 묘 · 만족)', !q('.pf-band') && !q('.pf-goals') && !q('.pf-goals-lead') && !q('#pf-order-now') && !q('.pf-bridge') && !/격차|순위|목표|운영의 묘|만족|리그 전체 효율/.test(pageText()), (pageText().match(/격차|순위|목표|운영의 묘|만족/) || []).join());
      ok('단계 띠: 「운영 방침·실행」 · 아래 줄: 방침 요약 + 실행 단추 하나(화면 안에는 없음)', /운영 방침·실행/.test(q('#stepper').innerText) && /지금 방침/.test(policy()) && qa('[data-act="pf-run"]').length === 1 && !!q('.footer [data-act="pf-run"]') && !q('.pf-page [data-act="pf-run"]'));
      ok('카드 둘: 이동 부담 먼저 (기본) · 휴일 관중 먼저(직접 정하기는 숨김) · 관점 표시 선수/구단 · 고른 카드는 「선택」 · 두 제목이 한 줄', /어느 쪽의 형평성을 먼저 맞출까요/.test(pageText()) && cardNames() === '이동 부담 먼저 (기본),휴일 관중 먼저' && !q('[data-act="pf-order-custom"]') && !q('[data-act="pf-move"]') && qa('.pf-oc .pf-who').map((e) => e.innerText).join() === '선수,구단' && /선택/.test(q('.pf-oc.on h4').innerText) && q('.pf-oc.on').dataset.id === 'balance' && new Set(qa('.pf-orders h4').map((h) => Math.round(h.getBoundingClientRect().top))).size === 1, cardNames());
      ok('카드마다 설명 한 줄 · 재는 것 · 지키는 것 · 내주는 것(단정하지 않음) · 모두의 이동은 선수 쪽에 「늘 마지막」', qa('.pf-oc[data-id]').every((c) => !!c.querySelector('p').innerText && [...c.querySelectorAll('.pf-kg dt')].map((d) => d.innerText).join() === '재는 것,지키는 것,내주는 것') && qa('.pf-oc[data-id] .pf-kg div:nth-child(3) dd').every((d) => /수 있음$/.test(d.innerText)) && /이동 횟수 · 이동 거리 · 모두의 이동\(늘 마지막\)/.test(q('.pf-oc[data-id="balance"]').innerText) && /휴일 홈경기 점수/.test(q('.pf-oc[data-id="holiday"]').innerText));
      ok('규칙 설명은 한 문장(「조금이라도 나은 결과」와 함께 적지 않음)', /먼저인 쪽이 허용 수준 안에 들어오면 그다음 쪽을 맞춥니다\. 둘 다 들어오면 모두의 이동을 줄입니다\. 반드시 지킬 규칙은 어느 순서든 지킵니다\./.test(pageText()) && !/조금이라도 나은/.test(pageText()));
      ok('허용 수준은 접혀 있음: 요약 한 줄 「기본값 그대로」 + 세 숫자 + 「바꾸기」', !q('#pf-levels .pf-lv') && !q('#pf-levels input') && /^기본값 그대로 · 이동 횟수 4회 · 이동 거리 600km · 휴일 홈경기 3점$/.test(sumText().trim()) && q('[data-act="pf-levels-toggle"]').innerText.trim() === '바꾸기' && q('[data-act="pf-levels-toggle"]').getAttribute('aria-expanded') === 'false', sumText());
      click('[data-act="pf-order"][data-id="holiday"]'); flush();
      ok('「휴일 관중 먼저」 → 순서(모두의 이동은 마지막) · 그 카드가 「선택」 · 아래 줄 「구단의 휴일 관중 먼저」', ob().order.join() === 'holiday,moves,distance,total' && q('.pf-oc.on').dataset.id === 'holiday' && qa('.pf-oc.on').length === 1 && /지금 방침: 구단의 휴일 관중 먼저 · 이동 횟수 4회 · 이동 거리 600km · 휴일 홈경기 3점/.test(policy()), policy());
      // 옛 프로젝트·저장 버전: 두 카드와 다른 순서는 그대로 두고 「직접 정한 순서」로 부른다
      setOb({ order: ['moves', 'holiday', 'distance', 'total'] });
      ok('두 카드와 다른 순서 → 고른 카드 없음 · 카드 아래 「직접 정한 순서」 한 줄(화살표 없음) · 아래 줄도 같은 이름', !q('.pf-oc.on') && /직접 정한 순서/.test(q('#pf-order-now').innerText) && qa('#pf-order-now li .nm').map((e) => e.innerText).join() === '이동 횟수,휴일 홈경기,이동 거리,모두의 이동' && /마지막/.test(qa('#pf-order-now li')[3].innerText) && !q('#pf-order-now [data-act="pf-move"]') && /카드를 고르면 그 순서로 바뀝니다/.test(q('#pf-order-now').innerText) && /지금 방침: 직접 정한 순서 · /.test(policy()) && P.optionOf(ob()) === 'custom');
      S.actions['pf-move']({ dataset: { k: '0', d: '1' } }); S.actions['pf-order-custom']({}); flush();
      ok('꺼 둔 「직접 정하기」 동작은 불러도 그대로', ob().order.join() === 'moves,holiday,distance,total' && !P.customOrder && P.showDiy === false);
      // 스위치 하나로 다시 보인다(코드는 남겨 두었다)
      P.showDiy = true; flush();
      ok('스위치를 켜면: 「직접 정하기」 카드 · 순서 줄에 화살표(모두의 이동 줄에는 없음)', cardNames() === '이동 부담 먼저 (기본),휴일 관중 먼저,직접 정하기' && /직접 정하기/.test(q('.pf-oc.on').innerText) && qa('#pf-order-now [data-act="pf-move"]').length === 6 && !q('[data-act="pf-move"][data-k="3"]') && q('[data-act="pf-move"][data-k="0"][data-d="-1"]').disabled && q('[data-act="pf-move"][data-k="2"][data-d="1"]').disabled);
      click('[data-act="pf-move"][data-k="0"][data-d="1"]'); flush();
      S.actions['pf-move']({ dataset: { k: '2', d: '1' } }); flush();
      ok('켠 채로 ▼ → 순서가 바뀌고 직접 정하기로 남음 · 모두의 이동은 마지막 그대로', ob().order.join() === 'holiday,moves,distance,total' && /직접 정하기/.test(q('.pf-oc.on').innerText) && /지금 방침: 직접 정한 순서/.test(policy()));
      P.showDiy = false; P.customOrder = false; flush();
      ok('스위치를 끄면 카드 둘로 돌아오고 같은 순서의 카드가 「선택」', cardNames() === '이동 부담 먼저 (기본),휴일 관중 먼저' && q('.pf-oc.on').dataset.id === 'holiday' && !q('#pf-order-now'));
      // 허용 수준 펼치기
      click('[data-act="pf-levels-toggle"]'); flush();
      ok('「바꾸기」 → 펼침: 선수 · 이동 부담 아래 이동 횟수 · 이동 거리, 구단 · 휴일 관중 아래 휴일 홈경기 · 단추는 「접기」', qa('#pf-levels .grp[data-view="player"] .pf-lv').map((e) => e.dataset.goal).join() === 'moves,distance' && qa('#pf-levels .grp[data-view="club"] .pf-lv').map((e) => e.dataset.goal).join() === 'holiday' && /^선수\s*이동 부담$/.test(q('.grp[data-view="player"] > h4').innerText.trim()) && /^구단\s*휴일 관중$/.test(q('.grp[data-view="club"] > h4').innerText.trim()) && q('[data-act="pf-levels-toggle"]').innerText.trim() === '접기' && q('[data-act="pf-levels-toggle"]').getAttribute('aria-expanded') === 'true');
      ok('모두의 이동 줄이기: 선수 칸 아래 한 줄 · 허용 수준 없음 · 늘 마지막', /모두의 이동 줄이기/.test(q('.grp[data-view="player"] .pf-total').innerText) && /허용 수준이 없고, 늘 마지막에 봅니다/.test(q('.pf-total').innerText) && !q('.pf-total input') && !q('.grp[data-view="club"] .pf-total'));
      ok('칸마다 문장 「구단 사이 차이를 …까지 괜찮다고 봅니다」(겹친 부정 없음) · 「기본값」 표시', qa('.pf-lv .pf-st').every((e) => /^구단 사이 차이를/.test(e.innerText.trim()) && /까지 괜찮다고 봅니다/.test(e.innerText)) && !/넘게 많지 않으면|만족/.test(q('#pf-levels').innerText) && ['moveGap', 'distanceGapKm', 'holidayGap'].every((k) => chipOf(k).innerText === '기본값' && !chipOf(k).classList.contains('moved')));
      const ends = (goal) => qa('.pf-lv[data-goal="' + goal + '"] .pf-lr span').map((e) => e.innerText).join(' / ');
      ok('눈금: 양 끝 「엄격」「느슨」 · 이동 횟수 1~9 · 이동 거리 100~999 · 휴일 홈경기 1~9', ends('moves') === '1 엄격 / 9 느슨' && ends('distance') === '100 엄격 / 999 느슨' && ends('holiday') === '1 엄격 / 9 느슨' && rangeOf('moveGap').min === '1' && rangeOf('moveGap').max === '9' && rangeOf('distanceGapKm').min === '100' && rangeOf('distanceGapKm').step === '50' && rangeOf('holidayGap').max === '9' && rangeOf('distanceGapKm').value === '600', ends('moves') + ' | ' + ends('distance') + ' | ' + ends('holiday'));
      ok('숫자가 작을수록 엄격 · 클수록 느슨이라는 머리말 · 지난 결과 숫자는 없음', /숫자가 작을수록 엄격하게 맞추고, 클수록 느슨하게 봅니다/.test(q('#pf-levels .pf-d').innerText) && !/2025|KBO \d/.test(q('#pf-levels').innerText));
      setBox(1, '800');
      ok('숫자 칸 800 → 저장 · 눈금도 800 · 「기본 600km에서 바꿈」 · 요약은 「바꾼 값」', ob().distanceGapKm === 800 && rangeOf('distanceGapKm').value === '800' && chipOf('distanceGapKm').innerText === '기본 600km에서 바꿈' && chipOf('distanceGapKm').classList.contains('moved') && /^바꾼 값 · 이동 횟수 4회 · 이동 거리 800km · 휴일 홈경기 3점$/.test(sumText().trim()) && chipOf('moveGap').innerText === '기본값', sumText());
      setBox(1, '');
      ok('빈 칸은 받지 않고 칸은 지금 값으로 돌아옴', ob().distanceGapKm === 800 && boxOf('distanceGapKm').value === '800');
      setBox(1, 'abc');
      ok('숫자가 아니면 받지 않음', ob().distanceGapKm === 800 && boxOf('distanceGapKm').value === '800');
      setBox(1, '99999');
      ok('범위 밖 큰 값 → 999km로 맞춤(숫자 칸도 999, 눈금은 오른쪽 끝)', ob().distanceGapKm === 999 && boxOf('distanceGapKm').value === '999' && rangeOf('distanceGapKm').value === rangeOf('distanceGapKm').max, ob().distanceGapKm + ' / ' + rangeOf('distanceGapKm').value);
      setBox(1, '0');
      ok('0은 받지 않고 100km로 맞춤', ob().distanceGapKm === 100 && boxOf('distanceGapKm').value === '100');
      setBox(1, '-5');
      ok('음수도 범위 안으로(100km 그대로)', ob().distanceGapKm === 100 && boxOf('distanceGapKm').value === '100');
      setBox(0, '2.5');
      ok('소수는 정수로', ob().moveGap === 3);
      setBox(0, '0'); const mv0 = ob().moveGap; setBox(0, '12');
      ok('이동 횟수: 0 → 1회, 12 → 9회', mv0 === 1 && ob().moveGap === 9 && boxOf('moveGap').value === '9');
      setBox(2, '0'); const hol0 = ob().holidayGap; setBox(2, '20');
      ok('휴일 홈경기: 0 → 1점, 20 → 9점', hol0 === 1 && ob().holidayGap === 9);
      ok('휴일 홈경기 칸: 가장 좁혀도 1점이라는 안내(2027은 275점 ÷ 10) + 휴일 점수를 키우면 범위도 커진다 · 다른 칸에는 없음', /10구단에 똑같이 나뉘지 않아, 가장 좁혀도 1점입니다/.test((q('.pf-lv[data-goal="holiday"] .pf-lv-n') || {}).innerText || '') && /1단계에서 휴일 점수를 키우면 이 범위도 함께 커집니다/.test(q('.pf-lv[data-goal="holiday"] .pf-lv-n').innerText) && !q('.pf-lv[data-goal="moves"] .pf-lv-n') && !q('.pf-lv[data-goal="distance"] .pf-lv-n'));
      // −/+ 단추: 눈금 한 칸씩, 끝에서 잠김
      setBox(1, '600'); click('[data-act="pf-gap-step"][data-k="distanceGapKm"][data-d="1"]'); flush();
      ok('+ 단추 → 650', ob().distanceGapKm === 650);
      click('[data-act="pf-gap-step"][data-k="distanceGapKm"][data-d="-1"]'); flush();
      ok('− 단추 → 600', ob().distanceGapKm === 600);
      setBox(1, '620'); click('[data-act="pf-gap-step"][data-k="distanceGapKm"][data-d="1"]'); flush(); const up620 = ob().distanceGapKm;
      setBox(1, '620'); click('[data-act="pf-gap-step"][data-k="distanceGapKm"][data-d="-1"]'); flush();
      ok('눈금 사이 값(620)에서 +는 650, −는 600', up620 === 650 && ob().distanceGapKm === 600);
      setBox(1, '999'); const plusOff = stepBtn('distanceGapKm', 1).disabled; click('[data-act="pf-gap-step"][data-k="distanceGapKm"][data-d="-1"]'); flush(); const down999 = ob().distanceGapKm;
      click('[data-act="pf-gap-step"][data-k="distanceGapKm"][data-d="1"]'); flush();
      ok('999에서 +는 잠김 · −는 950 · 다시 +는 999', plusOff && down999 === 950 && ob().distanceGapKm === 999);
      setBox(1, '100'); S.actions['pf-gap-step']({ dataset: { k: 'distanceGapKm', d: '-1' } }); flush();
      ok('100에서 −는 잠기고 불러도 100 그대로', stepBtn('distanceGapKm', -1).disabled && ob().distanceGapKm === 100);
      // 눈금: 끄는 동안에는 숫자만, 손을 떼면 저장
      setBox(0, '4');
      const drag = (k, v) => { const r = rangeOf(k); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); return r; };
      const r1 = drag('moveGap', '7');
      ok('눈금을 끄는 동안: 숫자 칸 · 기본값 표시 · 요약 줄 · 아래 줄의 숫자가 따라오고 저장은 아직', ob().moveGap === 4 && boxOf('moveGap').value === '7' && chipOf('moveGap').innerText === '기본 4회에서 바꿈' && /이동 횟수 7회/.test(sumText()) && /이동 횟수 7회/.test(policy()) && rangeOf('moveGap') === r1, sumText());
      r1.dispatchEvent(new Event('change', { bubbles: true })); flush();
      ok('눈금에서 손을 떼면 저장 · 숫자 칸과 같은 값', ob().moveGap === 7 && boxOf('moveGap').value === '7' && rangeOf('moveGap').value === '7');
      const r2 = drag('distanceGapKm', '1000'); const live999 = boxOf('distanceGapKm').value; r2.dispatchEvent(new Event('change', { bubbles: true })); flush();
      ok('이동 거리 눈금의 오른쪽 끝은 999km', live999 === '999' && ob().distanceGapKm === 999);
      // 옛 값(범위 밖)은 불러온 그대로 두고, 고칠 때만 범위 안으로
      setOb({ moveGap: 0, distanceGapKm: 1200 });
      ok('저장돼 있던 범위 밖 값은 그대로 보이고 범위 밖이라는 안내', ob().moveGap === 0 && ob().distanceGapKm === 1200 && boxOf('distanceGapKm').value === '1200' && /범위 100~999km 밖입니다/.test(q('.pf-lv[data-goal="distance"] .pf-lv-n.out').innerText) && /범위 1~9회 밖입니다/.test(q('.pf-lv[data-goal="moves"] .pf-lv-n.out').innerText) && /이동 거리 1,200km/.test(policy()));
      click('[data-act="pf-gap-step"][data-k="distanceGapKm"][data-d="-1"]'); flush(); click('[data-act="pf-gap-step"][data-k="moveGap"][data-d="1"]'); flush();
      ok('범위 밖 값을 고치면 범위 안으로(1,200 − → 999, 0 + → 1) · 안내는 사라짐', ob().distanceGapKm === 999 && ob().moveGap === 1 && !q('.pf-lv-n.out'));
      // 휴일 점수를 키우면 휴일 홈경기의 상한이 따라 커진다
      const hol = JSON.stringify(st().settings.holidays), topW = Math.max(...st().settings.holidays.map((h) => h.weight || 0));
      app().updateSettings({ holidays: st().settings.holidays.map((h) => (h.weight === topW ? Object.assign({}, h, { weight: 5 }) : h)) }, '점검'); flush();
      ok('휴일 점수를 5점으로 키우면 휴일 홈경기 범위가 1~15로', topW === 3 && P.levelRange('holidayGap').max === 15 && ends('holiday') === '1 엄격 / 15 느슨' && rangeOf('holidayGap').max === '15', ends('holiday'));
      app().undo(); flush();
      ok('되돌리면 다시 1~9', JSON.stringify(st().settings.holidays) === hol && P.levelRange('holidayGap').max === 9 && ends('holiday') === '1 엄격 / 9 느슨');
      setBox(1, '600'); setBox(0, '4'); setBox(2, '3');
      click('[data-act="pf-levels-toggle"]'); flush();
      ok('「접기」 → 다시 한 줄 요약(기본값 그대로)', !q('#pf-levels .pf-lv') && /^기본값 그대로 · 이동 횟수 4회 · 이동 거리 600km · 휴일 홈경기 3점$/.test(sumText().trim()) && q('[data-act="pf-levels-toggle"]').innerText.trim() === '바꾸기');
      click('[data-act="pf-order"][data-id="balance"]'); flush();
      ok('방침 요약: 선수의 이동 부담 먼저 · 허용 수준 셋', /지금 방침: 선수의 이동 부담 먼저 · 이동 횟수 4회 · 이동 거리 600km · 휴일 홈경기 3점/.test(policy()) && ob().order.join() === 'moves,distance,holiday,total', policy());
      ok('실행 단추: 「이 방침으로 실행」 · 실행 시간 입력은 아래 줄 단추 옆 · 화면 안에 실행 칸 없음', /^이 방침으로 실행$/.test(q('[data-act="pf-run"]').innerText.trim()) && !!q('.footer .pf-ftime input[data-in="pf-time"]') && !q('.pf-page .pf-run') && !q('.pf-page input[data-in="pf-time"]'));
      // ── 운영 방침 설명하기 → 오른쪽 설명 창(뒤 화면은 가리지 않음)
      click('[data-act="pf-explain"]'); flush();
      ok('「운영 방침 설명하기」 → 설명 창이 열리고 방침 화면은 그대로', S.ui.drawer === 'explain' && !!q('.drawer.explain') && !q('.drawer-scrim') && !!q('[data-act="pf-run"]') && /운영 방침 설명하기/.test(q('.drawer.explain .pane-title').innerText));
      ok('설명 창: 지금 허용 수준 숫자를 보여 줌', /4회/.test(q('.drawer.explain').innerText) && /600km/.test(q('.drawer.explain').innerText) && /3점/.test(q('.drawer.explain').innerText));
      const xh = () => q('.drawer.explain').innerText;
      ok('설명 창: 왜 운영자가 정하나 · 균형점 · 시험 실행 수치는 예시 · 2025 숫자·개발 용어 없음', /왜 운영자가 정하나/.test(xh()) && /더 좋아질 곳이 없는 균형점/.test(xh()) && /시험 실행에서 본 수치/.test(xh()) && /예시입니다/.test(xh()) && /58,352/.test(xh()) && /늘 마지막/.test(xh()) && !/2025|파레토|시드|JSON|잠실|리그 전체 효율/.test(xh()));
      ok('설명 창: 화면과 같은 말(형평성 · 선수의 이동 부담 · 구단의 휴일 관중 · 모두의 이동 줄이기) · 옛 말(격차 · 순위 · 목표) 없음', /일정의 형평성/.test(xh()) && /선수의 이동 부담/.test(xh()) && /구단의 휴일 관중/.test(xh()) && /모두의 이동 줄이기/.test(xh()) && /휴일 홈경기/.test(xh()) && !/격차|순위|목표|주말·공휴일 홈/.test(xh()), (xh().match(/격차|순위|목표|주말·공휴일 홈/) || []).join());
      ok('설명 창: 고를 수 있는 범위 · 0은 고를 수 없음 · 시험 수치의 허용 0은 지금 범위보다 엄격한 값이라는 한 줄', /이동 횟수 1~9회 · 이동 거리 100~999km · 휴일 홈경기 1~9점/.test(xh()) && /\(0\)은 고를 수 없습니다/.test(xh()) && !/0으로 두면/.test(xh()) && /지금 고를 수 있는 범위보다 더 엄격한 값/.test(xh()) && /69,344/.test(xh()));
      ok('설명 창: 구장 사이 평균 거리는 입력에서 센 값', /KT 171km/.test(q('.drawer.explain').innerText) && /롯데 293km/.test(q('.drawer.explain').innerText));
      click('.drawer.explain [data-act="close-drawer"]'); flush();
      ok('설명 창 닫기', !S.ui.drawer && !q('.drawer.explain'));

      // ── 실행
      const orig = app().engine.solve;
      let sent = null;
      app().engine.solve = function (state, opts) { sent = { objective: JSON.parse(JSON.stringify(state.settings.objective)), opts }; return orig.call(this, state, Object.assign({}, opts, { timeLimitSec: 1, unimprovedSec: 1 })); };
      const timeBox = () => q('input[data-in="pf-time"]');
      const setTime = (v) => { const el = timeBox(); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      setTime('2');
      click('[data-act="pf-time-step"][data-d="1"]'); flush();
      ok('실행 시간 +: 2분 → 3분(아래 줄 숫자 칸)', timeBox().value === '3' && /최대/.test(q('.footer .pf-ftime').innerText));
      setTime('9');
      ok('실행 시간 범위 밖 숫자는 받지 않음', timeBox().value === '3');
      setTime('5');
      ok('실행 시간 5분이면 + 잠김', q('[data-act="pf-time-step"][data-d="1"]').disabled);
      setTime('1');
      ok('실행 시간 1분이면 − 잠김', q('[data-act="pf-time-step"][data-d="-1"]').disabled);
      ok('결과가 없으면 「이어서」 안내가 없음(처음부터 푼다는 말도 따로 없음) · 「절반」 문장은 없음', !/지금 결과에서 이어서/.test(page()) && !/처음부터 풉니다/.test(page()) && !/절반/.test(page()));
      click('[data-act="pf-run"]');
      ok('실행: 순서·허용 차이가 엔진으로 간다', sent && sent.objective.order.join() === ob().order.join() && sent.objective.distanceGapKm === 600 && sent.opts.timeLimitSec === 60 && sent.opts.init === 'SCRATCH');
      ok('실행 중: 화면이 진행 표시로', /찾는 중/.test(page()));
      click('[data-act="pf-stage"][data-stage="3"]'); flush();
      ok('실행 중 현재 결과 분석: 「아직 결과 없음」이 아니라 실행 중 안내', /실행하는 중/.test(page()) && !/아직 결과가 없습니다/.test(page()));
      
    } catch (e) {
      out.push('FAIL 예외(앞부분): ' + e.message);
    }
    try {
      S.actions['pf-home'](); flush();
      ok('실행 중 처음 화면: 실행 화면으로 돌아갈 길이 있음', /실행하는 중/.test(page()) && !!q('.pf-start [data-act="pf-stage"][data-stage="2"]'));
      for (let i = 0; i < 400 && S.run; i++) await wait(50);
      flush();
      ok('실행이 끝나면 현재 결과 분석으로 · 결과 기록', !S.run && S.ui.step === 5 && !!st().meta.result && !!st().meta.result.sig, st().meta.result && st().meta.result.why);
      const vsText = () => (q('.pf-vs') || {}).innerText || '';
      ok('결과 맨 위: 「방침과 견주기」 목표 셋 · 안/넘음 · 「수준 다시 정하기」 · 결과 화면은 「격차」로 · 구단별 한눈에 경고는 어겼을 때만', /^방침과 견주기 — 이동 횟수 /.test(vsText()) && !!q('.pf-halert') === (!app().derived().ex.feasible || qa('.pf-vs .it.over').length > 0) && !/차이 \d|균형 3가지/.test(page()) && qa('.pf-vs .it').length === 3 && qa('.pf-vs .it').every((e) => /(허용 안|넘음)$/.test(e.innerText)) && !!q('.pf-vs [data-act="pf-relevel"]'));
      ok('방침과 견주기: 결과의 실제 차이와 허용 수준을 견줌(1순위부터)', (() => { const gaps = app().derived().ex.objectiveGaps, o = ob(), key = { moves: ['moves', 'moveGap'], distance: ['distanceKm', 'distanceGapKm'], holiday: ['holiday', 'holidayGap'] };
        return o.order.filter((id) => key[id]).every((id, i) => { const it = qa('.pf-vs .it')[i], inside = gaps[key[id][0]] <= o[key[id][1]]; return it.classList.contains(inside ? 'ok' : 'over') && (inside ? /허용 안$/ : /넘음$/).test(it.innerText); }); })());
      click('[data-act="pf-relevel"]'); flush();
      ok('「수준 다시 정하기」 → 운영 방침 화면의 허용 수준이 펼쳐진 채로', S.ui.step === 2 && !!q('#pf-levels') && P.levelsOpen === true && qa('#pf-levels .pf-lv').length === 3 && q('[data-act="pf-levels-toggle"]').innerText.trim() === '접기');
      click('[data-act="pf-levels-toggle"]'); flush();
      S.go({ step: 5 }); flush();
      ok('시험 엔진 결과임을 표시(서버 없을 때만)', app().engineConfig.kind === 'REST' || /시험용 자동 편성으로 낸 결과/.test(page()));

      // 규칙을 어긴 결과는 저장하지 않는다(사용자 결정 2026-11-07). 시험 엔진은 짧은 시간에 규칙을 다 맞추지 못할 수 있어, 그때는 그것을 확인하고 이후 점검은 지킨 결과로 이어 간다
      const exRun = app().derived().ex;
      if (!exRun.feasible) {
        ok('규칙을 어긴 결과는 저장하지 않음 · 번호도 쓰지 않음 · 맨 위 줄에 표시', P.versions.list(2027).length === 0 && !!st().meta.result.rule && P.nextRunNo(2027) === 1 && /규칙을 어겨 저장하지 않음/.test(page()) && !q('[data-act="pf-save"]'));
        keepRun();
      }
      // ── 버전: 실행이 끝나면 「#번호_방침_횟수_거리_점수」로 저절로 저장
      const o1 = ob(), auto1 = '#0001_이동격차_' + o1.moveGap + '회_' + o1.distanceGapKm + 'km_' + o1.holidayGap + '점';
      const v1 = P.versions.list(2027)[0];
      ok('실행이 끝나면 저절로 저장 · 이름 규칙', P.versions.list(2027).length === 1 && !!v1 && v1.name === auto1 && v1.auto && v1.no === 1 && !v1.kept && st().meta.result.vid === v1.id && !q('[data-act="pf-save"]'), v1 ? v1.name : JSON.stringify({ n: P.versions.list(2027).length, y: S.seasonYear(), feas: app().derived().ex.feasible, hard: (app().derived().ex.violations || []).length, r: st().meta.result && Object.keys(st().meta.result).join(',') }));
      ok('이름 칸에 저장한 이름 · 아래 줄에 실행 시각', (q('[data-in="pf-name"]') || {}).value === auto1 && /\d+월 \d+일 \d\d:\d\d/.test((q('.pf-meta') || {}).innerText || ''));
      const nameIn = q('[data-in="pf-name"]');
      nameIn.value = '  '; nameIn.dispatchEvent(new Event('change', { bubbles: true })); flush();
      ok('빈 이름이면 바꾸지 않음', P.versions.get(2027, v1.id).name === auto1 && !P.versions.get(2027, v1.id).kept);
      q('[data-in="pf-name"]').value = '<b>첫 버전</b>'; q('[data-in="pf-name"]').dispatchEvent(new Event('change', { bubbles: true })); flush();
      Object.assign(v1, P.versions.get(2027, v1.id));
      S.go({ step: 6 }); flush();
      ok('이름 바꾸기 → 남길 결과 · 이름은 글자 그대로', v1.name === '<b>첫 버전</b>' && v1.kept && !q('.pf-ver b b') && /남김/.test(q('.pf-ver input[data-id="' + v1.id + '"]').closest('.pf-ver').innerText) && !!v1.inputs && v1.inputs.calendar.length === 45);
      ok('저장한 일정·숫자·개막 대진', v1.matches.length === 225 && v1.plan.length === 225 && v1.pairs.some((x) => x.home === 'KIA' && x.away === '키움') && Number.isFinite(v1.gaps.totalKm));
      // 연전이 바뀌면 묻고 지운다
      S.flowGo(2); flush();
      click('.pf-rv[data-k="opening"] [data-act="pf-cal"]'); flush();
      click('[data-act="cal-open"][data-date="2027-04-03"]'); flush();
      ok('연전이 바뀌면 확인 창', S.ui.modal === 'pfCalChange' && /결과 지우고 계속/.test(page()));
      click('[data-act="pf-cal-undo"]'); flush();
      ok('「바꾸지 않기」 → 달력과 결과가 그대로', st().settings.seasonStart === '2027-03-27' && !!st().meta.result && !S.ui.modal);
      click('[data-act="pf-cal-done"]'); flush();
      click('.pf-rv[data-k="opening"] [data-act="pf-cal"]'); flush();
      click('[data-act="cal-open"][data-date="2027-04-03"]'); flush();
      click('[data-act="pf-cal-clear"]'); flush();
      click('[data-act="pf-cal-done"]'); flush();
      ok('「결과 지우고 계속」 → 지금 결과만 지우고 저장한 버전은 남음', st().settings.seasonStart === '2027-04-03' && !st().meta.result && !S.ui.modal && !!P.versions.get(2027, v1.id));
      click('[data-act="pf-stage"][data-stage="3"]'); flush();
      ok('지운 뒤 현재 결과 분석: 결과 없음', /아직 결과가 없습니다/.test(page()) && !q('.pf-dash'));
      // 불러오면 그때 값으로
      click('[data-act="pf-stage"][data-stage="4"]'); flush();
      click('[data-act="pf-load"][data-id="' + v1.id + '"]'); flush();
      const ex = app().derived().ex;
      ok('불러오기: 달력·개막전도 그 버전 것으로', st().settings.seasonStart === '2027-03-27' && ev('OPENING').pairs.some((x) => x.home === 'KIA' && x.away === '키움') && ev('OPENING').teams.length === 5);
      ok('불러오기: 숫자가 저장한 것과 같음', JSON.stringify(ex.objectiveGaps) === JSON.stringify(v1.gaps) && (ex.feasible === v1.feasible || forcedRuns > 0), JSON.stringify(ex.objectiveGaps));
      ok('불러오기: 결과 화면으로 · 옛 결과 아님', S.ui.step === 5 && !!q('.pf-dash'));
      ok('불러온 뒤 시리즈가 값과 맞음(다시 실행해도 안 깨짐)', S.seriesOkOf(st()));
      // 값만 고치면 결과를 두고 이어서 푼다
      const planBefore = st().plan.map((x) => { const m = st().matches[x.match]; return x.calendar + '|' + m.home + '|' + m.away + '|' + m.consecutive; });
      S.flowGo(3); flush();
      click('.pf-rv[data-k="openingHome"] [data-act="pf-cal"]'); flush();
      const pick2 = (home, away) => { const sel = q('[data-in="cal-pair"][data-home="' + home + '"]'); sel.value = away; sel.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      pick2('LG', ''); pick2('KIA', '롯데'); pick2('LG', '키움');
      ok('개막전 상대를 바꿔도 결과가 남음', !!st().meta.result && !S.ui.modal);
      click('[data-act="pf-cal-done"]'); flush();
      S.flowGo(4); flush();
      click('.footer [data-act="cal-next"]'); flush();
      const planAfter = new Set(st().plan.map((x) => { const m = st().matches[x.match]; return x.calendar + '|' + m.home + '|' + m.away + '|' + m.consecutive; }));
      const keptN = planBefore.filter((k) => planAfter.has(k)).length;
      const four2 = st().calendar.findIndex((c) => c.consecutive === 4);
      ok('다음: 바뀐 시리즈만 바꾸고 나머지는 그 자리', S.seriesOkOf(st()) && keptN >= 100 && P.keepPlanLeft === 0 && st().plan.length === 225 && slotMatches(0).some((m) => m.home === 'KIA' && m.away === '롯데') && slotMatches(four2).some((m) => m.home === 'KIA' && m.away === '롯데'), keptN + ' / 225');
      const orig2 = app().engine.solve;
      let sent2 = null;
      app().engine.solve = function (state, opts) { sent2 = opts; return orig2.call(this, state, Object.assign({}, opts, { timeLimitSec: 1, unimprovedSec: 1 })); };
      ok('값을 고쳤으면 이어서 푼다는 안내', /지금 결과에서 이어서/.test(page()));
      click('[data-act="pf-run"]');
      ok('값을 고쳤으면 전 결과에서 이어서 실행', sent2 && sent2.init === 'KEEP', sent2 && sent2.init);
      for (let i = 0; i < 400 && S.run; i++) await wait(50);
      flush();
      app().engine.solve = orig2;
      keepRun();
      ok('이어 풀기가 끝나면 결과 기록 · 2번으로 저장', !S.run && S.ui.step === 5 && !!st().meta.result && /^#0002_이동격차_/.test(st().meta.result.name) && !!P.versions.get(2027, st().meta.result.vid));
      S.go({ step: 2 }); flush();
      click('[data-act="pf-order"][data-id="holiday"]'); flush();
      let sent3 = null;
      const orig3 = app().engine.solve;
      app().engine.solve = function (state, opts) { sent3 = opts; return orig3.call(this, state, Object.assign({}, opts, { timeLimitSec: 1, unimprovedSec: 1 })); };
      click('[data-act="pf-run"]');
      ok('운영 방침만 바꾸면 처음부터 실행', sent3 && sent3.init === 'SCRATCH', sent3 && sent3.init);
      for (let i = 0; i < 400 && S.run; i++) await wait(50);
      flush();
      app().engine.solve = orig3;
      keepRun();
      ok('주말·공휴일 격차 우선으로 실행 → 3번 · 그 방침 이름', /^#0003_주말공휴일_\d+회_\d+km_\d+점$/.test(st().meta.result.name) && P.versions.list(2027).filter((v) => v.auto).length === 3, st().meta.result.name);
      // 최근 몇 개만 남기기 · 번호는 다시 쓰지 않음
      const keepRuns = P.versions.list(2027), fakeRun = (i, more) => Object.assign({ id: 'a' + i, no: 100 + i, auto: true, name: 'r' + i, year: 2027 }, more);
      const many = keepRuns.concat([fakeRun(0, { kept: true }), fakeRun(1, { id: 'a-final' })]).concat(Array.from({ length: 10 }, (_, i) => fakeRun(i + 2)));
      P.final.set(2027, 'a-final');
      const pruned = P.pruneRuns(many, 2027), left = pruned.filter((v) => v.auto && !v.kept && v.id !== 'a-final');
      P.final.clear(2027);
      ok('정리: 이름 안 바꾼 결과는 최근 ' + P.AUTO_KEEP + '개만 · 이름 바꾼 것·확정한 것은 남음', left.length === P.AUTO_KEEP && left[left.length - 1].id === 'a11' && pruned.some((v) => v.id === 'a0') && pruned.some((v) => v.id === 'a-final') && pruned.some((v) => v.id === v1.id), left.map((v) => v.id).join());
      const nextNo = P.nextRunNo(2027);
      P.versions.put(2027, keepRuns.filter((v) => v.no !== 3));
      ok('결과를 지워도 번호는 다시 쓰지 않음', nextNo === 4 && P.nextRunNo(2027) === 4);
      P.versions.put(2027, keepRuns);
      // 기본 제공 대진안처럼 값이 없는 버전(개막 대진만 다름)
      const pairs2 = [{ home: 'KT', away: '한화' }, { home: '삼성', away: 'NC' }, { home: 'KIA', away: '롯데' }, { home: 'LG', away: '키움' }, { home: 'SSG', away: '두산' }];
      const gen = S.builtinOf(2027).build();
      gen.events.find((e) => e.type === 'OPENING').pairs = pairs2;
      const g2 = KBO.CalendarGen.generateSeries(gen.teams, gen.calendar, KBO.CalendarGen.seriesOptions(gen));
      const noInputs = Object.assign({}, v1, { id: 'v-rank2', name: '값 없는 2순위', pairs: pairs2, inputs: undefined, matches: g2.matches.map((m, i) => Object.assign({ index: i }, m)), plan: g2.plan.map((c, m) => ({ match: m, calendar: c })) });
      P.versions.put(2027, P.versions.list(2027).concat([noInputs]));
      S.go({ step: 6 }); flush();
      click('[data-act="pf-load"][data-id="v-rank2"]'); flush();
      ok('값 없는 버전: 처음 제공한 값 + 그 대진 · 구장·후반기 4연전이 따라옴', ev('OPENING').teams.join() === 'KT,삼성,KIA,LG,SSG' && ev('OPENING').stadiums.includes('수원KT위즈파크') && st().matches.some((m) => m.home === '삼성' && m.away === 'NC' && m.consecutive === 4) && S.seriesOkOf(st()));

      // ── 비교
      S.go({ step: 6 }); flush();
      const boxes = () => qa('[data-in="pf-cmp"]').filter((c) => c.checked).map((c) => c.dataset.id);
      ok('처음에는 둘이 골라짐', boxes().length === 2);
      const third = JSON.parse(JSON.stringify(v1)); third.id = 'v-third'; third.name = '순서 다른 버전'; third.feasible = true; third.objective.order = ['total', 'distance', 'moves', 'holiday'];
      P.versions.put(2027, P.versions.list(2027).concat([third])); flush();
      click('[data-in="pf-cmp"][data-id="v-third"]'); flush();
      ok('3개째 고르면 가장 먼저 고른 것이 빠짐', boxes().length === 2 && boxes().includes('v-third'));
      ok('순서가 다른 버전도 고른 운영 방침으로 줄 세움 · 꼬리표', /다른 방침으로 만듦/.test(q('.pf-ver input[data-id="v-third"]').closest('.pf-ver').innerText) && qa('select[data-in="pf-cmp-ob"] option').length >= 2);
      ok('새로 고른 것이 파랑', P.cmp[0] === 'v-third' && q('.pf-ver.pa input[data-id="v-third"]'));
      const first = boxes()[0];
      click('[data-in="pf-cmp"][data-id="' + first + '"]'); flush();
      ok('체크를 끄면 꺼진 채로 · 하나 더 고르라는 안내', boxes().length === 1 && /두 개 고르세요/.test(page()));
      // 이름 바꾸기·지우기
      const pr = window.prompt, cf = window.confirm;
      window.prompt = () => '새 이름'; click('[data-act="pf-rename"][data-id="v-third"]'); flush();
      ok('이름 바꾸기', P.versions.get(2027, 'v-third').name === '새 이름');
      window.confirm = () => true; click('[data-act="pf-del"][data-id="v-third"]'); flush();
      ok('지우기 → 비교에서도 빠짐', !P.versions.get(2027, 'v-third') && !P.cmp.includes('v-third'));
      window.prompt = pr; window.confirm = cf;
      // 올린 파일 검사
      const num0 = (x) => Number(x).toLocaleString('ko-KR');
      const names = st().teams.map((t) => t.name), chk = (v, y) => P.checkVersion(v, y || 2027, names);
      ok('파일 검사: 정상 통과', chk(JSON.parse(JSON.stringify(v1))) === null);
      ok('파일 검사: 빈 것·다른 모양', !!chk(null) && !!chk({ a: 1 }));
      ok('파일 검사: 다른 해는 그 해를 말해 줌', /2027 버전/.test(chk(JSON.parse(JSON.stringify(v1)), 2025)));
      ok('파일 검사: 잘린 일정', !!chk(Object.assign({}, v1, { matches: v1.matches.slice(0, 3) })));
      ok('파일 검사: 없는 칸을 가리킴', !!chk(Object.assign({}, v1, { plan: v1.plan.map((x) => ({ match: x.match, calendar: 999 })) })));
      ok('파일 검사: 순서가 이상함', !!chk(Object.assign({}, v1, { objective: Object.assign({}, v1.objective, { order: ['x'] }) })));
      ok('파일 검사: 숫자 빠짐', !!chk(Object.assign({}, v1, { gaps: {} })));
      ok('파일 검사: 개막전 홈 구단이 다른 버전은 받지 않음', /홈 구단/.test(chk(Object.assign({}, v1, { pairs: [{ home: '한화', away: 'KT' }] }))));
      ok('파일 검사: 값 칸이 빠진 파일(불러올 때 멈춤)', !!chk(Object.assign({}, v1, { inputs: { calendar: v1.inputs.calendar } })));
      ok('파일 검사: 같은 경기만 가리킴', !!chk(Object.assign({}, v1, { plan: v1.plan.map((x) => ({ match: 0, calendar: x.calendar })) })));
      const fake = JSON.parse(JSON.stringify(v1)); fake.gaps.totalKm = 1;
      ok('올린 파일: 적힌 숫자 대신 일정으로 다시 계산', P.rescoreVersion(fake) === true && fake.gaps.totalKm === v1.gaps.totalKm);
      const same = JSON.parse(JSON.stringify(v1));
      ok('올린 파일: 그대로면 숫자가 같음', P.rescoreVersion(same) === false);
      const nine = JSON.parse(JSON.stringify(v1)); nine.matches.forEach((m) => { m.consecutive = 9; }); P.rescoreVersion(nine);
      ok('올린 파일: 규칙을 어긴 일정은 그렇게 표시됨', nine.feasible === false);
      // 어느 엔진으로 낸 결과인가: 지금 연결이 아니라 그 결과를 낸 엔진으로
      ok('버전에 낸 엔진을 함께 저장', v1.engine === app().engineConfig.kind);
      const fromServer = Object.assign(JSON.parse(JSON.stringify(v1)), { id: 't-rest', name: '시험 서버 결과', engine: 'REST' });
      const fromMock = Object.assign(JSON.parse(JSON.stringify(v1)), { id: 't-mock', name: '시험 브라우저 결과', engine: 'MOCK' });
      const beforeTag = P.versions.list(2027); P.versions.put(2027, beforeTag.concat([fromServer, fromMock]));
      S.go({ step: 6 }); flush();
      ok('시험 엔진 버전만 표시', /시험용 자동 편성/.test(q('.pf-ver input[data-id="t-mock"]').closest('.pf-ver').innerText) && !/시험용 자동 편성/.test(q('.pf-ver input[data-id="t-rest"]').closest('.pf-ver').innerText));
      click('[data-act="pf-load"][data-id="t-rest"]'); flush();
      ok('서버에서 낸 버전을 불러오면 시험 엔진 표시 없음', S.ui.step === 5 && !/시험용 자동 편성으로 낸 결과/.test(page()));
      click('.footer [data-act="pf-stage"][data-stage="4"]'); flush();
      click('[data-act="pf-load"][data-id="t-mock"]'); flush();
      ok('시험 엔진 버전을 불러오면 표시', S.ui.step === 5 && /시험용 자동 편성으로 낸 결과/.test(page()));
      P.versions.put(2027, beforeTag); S.go({ step: 6 }); flush();
      // 비교: 규칙을 어긴 버전 · 허용 차이가 다른 버전
      const keepList = P.versions.list(2027);
      const cv = (id, name, more) => Object.assign(JSON.parse(JSON.stringify(v1)), { id, name, feasible: true }, more);
      const vGood = cv('t-good', '시험 지킴'), vBad = cv('t-bad', '시험 어김', { feasible: false, gaps: Object.assign({}, v1.gaps, { totalKm: 1 }) });
      const vTol = cv('t-tol', '시험 허용', { objective: Object.assign({}, v1.objective, { distanceGapKm: 300 }) });
      P.versions.put(2027, keepList.concat([vGood, vBad, vTol]));
      P.cmpPicked = true; P.cmp = ['t-good', 't-bad']; S.go({ step: 6 }); flush();
      ok('비교: 규칙을 어긴 버전은 목록·비교에 없음', !q('.pf-ver input[data-id="t-bad"]') && !P.cmp.includes('t-bad') && !/반드시 지킬 규칙<\/th>/.test(q('.pf-vt').innerHTML));
      P.cmp = ['t-good', 't-tol']; S.render(); flush();
      const obSel = () => q('select[data-in="pf-cmp-ob"]'), pickOb = (i) => { const el = obSel(); el.value = el.options[i].value; el.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      ok('운영 방침: 지금 방침이 처음 · 평가 기준이 순위대로', /\(지금 방침\)/.test(obSel().options[0].text) && /^1 \S.* → 2 .* → 3 .* → 4 전체 이동 거리 · 허용/.test(obSel().options[0].text));
      const tolIdx = [...obSel().options].findIndex((o) => / · 300km · /.test(o.text));
      pickOb(tolIdx);
      ok('운영 방침을 바꾸면 그 허용 수준으로 판정', /허용 300km/.test(q('.pf-vt thead').innerText) && (v1.gaps.distanceKm > 300 ? /넘음/.test(q('.pf-duel').innerText) : true));
      pickOb(0);
      ok('비교: 줄마다 순위 하나', qa('.pf-t tbody tr .pf-rk').length === 4);
      const vWin = cv('t-win', '시험 짧음', { gaps: Object.assign({}, v1.gaps, { totalKm: v1.gaps.totalKm - 500 }) });
      P.versions.put(2027, keepList.concat([vGood, vWin]));
      P.cmp = ['t-good', 't-win']; S.render(); flush();
      ok('비교: 승부가 갈린 줄에 「여기서 갈림」 · 차이가 작으면 뒤집힐 수 있음', /여기서 갈림 · 500km/.test(q('.pf-duel tr.hit').innerText) && /뒤집힐 수 있음/.test(q('.pf-duel tr.hit').innerText) && qa('.pf-duel tr.same').length === 3);
      ok('비교: 순위표에서 더 짧은 쪽이 앞', qa('.pf-vt tbody tr').findIndex((r) => r.querySelector('input[data-id="t-win"]')) < qa('.pf-vt tbody tr').findIndex((r) => r.querySelector('input[data-id="t-good"]')));
      click('[data-act="pf-cmp-swap"]'); flush();
      ok('색 바꾸기', P.cmp[0] === 't-win');
      P.versions.put(2027, keepList); P.cmp = []; P.cmpPicked = false;
      // 표·엑셀로 홈 구단이 달라진 경우
      app().commit('시험: 홈 구단 바꿈', (s) => { const e = s.events.find((x) => x.type === 'OPENING'); e.teams = e.teams.map((t) => (t === 'KT' ? '한화' : t)); }, ['events']);
      S.flowGo(3); flush();
      ok('다른 길로 홈 구단이 달라지면 3단계가 끝나지 않고 되돌리기 안내', !S.flowStatus().done[2] && /전년도 순위와 다릅니다/.test(page()) && q('.footer .btn.primary').disabled);
      click('[data-act="pf-op-reset"]'); flush();
      ok('되돌리기 → 원래 홈 구단 · 단계 끝', S.flowStatus().done[2] && ev('OPENING').teams.includes('KT') && ev('OPENING').pairs.length === 5);
      S.go({ step: 6 }); flush();
      click('[data-act="pf-load"][data-id="' + (P.builtin['2027-rank1'] ? '2027-rank1' : v1.id) + '"]'); flush(); // 다시 저장은 규칙을 지킨 일정에서만 되므로 기본 제공 1순위안으로
      // 저장 공간 부족
      const ls = S.ls.set;
      S.ls.set = () => false;
      const before = P.versions.list(2027).length;
      app().store.commit('시험: 저장 못 한 결과', (s) => { s.meta.result = Object.assign({}, s.meta.result, { from: undefined, vid: null, no: 9, option: 'balance', name: '#0009_시험' }); }, { tags: ['meta'], undo: false });
      S.go({ step: 5 }); flush();
      const retry = !!q('[data-act="pf-save"]') && /저장하지 못함/.test(page());
      if (retry) { click('[data-act="pf-save"]'); flush(); }
      const none = P.versions.list(2027).length;
      S.ls.set = ls;
      ok('저장 공간 부족: 다시 저장 단추 · 눌러도 늘지 않고 화면에 남음', retry && none === before && S.ui.step === 5 && !!q('[data-act="pf-save"]'));
      click('[data-act="pf-save"]'); flush();
      ok('다시 저장 → 같은 번호로 저장', P.versions.list(2027).length === before + 1 && P.versions.list(2027).some((v) => v.no === 9 && v.id === st().meta.result.vid) && !q('[data-act="pf-save"]'));

      // ── 처음 화면: 결과가 생긴 뒤 · 확정
      S.actions['pf-home'](); flush();
      const cards = () => qa('.pf-ch'), yrsOf = (c) => [...c.querySelectorAll('.pf-yr .y')].map((y) => y.innerText).join(), newCard = () => cards()[cards().length - 1];
      ok('실행만 끝나면 결과 확인 카드가 나오지 않음(확정 전)', cards().length === 1 && !q('[data-act="pf-open-final"]'));
      ok('실행 결과는 새 계획 > 2027에서 결과 보기 · 다시 검토 단추(문구는 home-copy.js)', newCard().querySelector('[data-act="pf-open-2027"][data-to="result"]').innerText.includes(S.homeCopy.resultButton) && newCard().querySelector('[data-act="pf-open-2027"]:not([data-to])').innerText.includes(S.homeCopy.reviewButton));
      const reviewBtn = newCard().querySelector('[data-act="pf-open-2027"]:not([data-to])'), resultBtn = newCard().querySelector('[data-to="result"]');
      ok('편성 조건 검토가 먼저, 실행 결과 보기는 네 단계 아래', !!(reviewBtn.compareDocumentPosition(newCard().querySelector('ul')) & 4) && !!(newCard().querySelector('ul').compareDocumentPosition(resultBtn) & 4));
      click('[data-act="pf-open-2027"][data-to="result"]'); flush();
      ok('실행 결과 보기 → 현재 결과 화면', S.ui.step === 5 && S.seasonYear() === 2027);
      const finalKeep = P.versions.list(2027), vFinal = Object.assign({}, finalKeep[0], { id: 'v-final', name: '확정할 버전', engine: 'REST', feasible: true, inputs: finalKeep[0].inputs, gaps: Object.assign({}, finalKeep[0].gaps, { distanceKm: 1234.5 }) }), vTest = Object.assign({}, vFinal, { id: 'v-test', name: '시험 버전', engine: 'MOCK' }), vRule = Object.assign({}, vFinal, { id: 'v-bad', name: '규칙 어긴 버전', feasible: false }), vNext = Object.assign({}, vFinal, { id: 'v-next', name: '다음 버전' });
      P.versions.put(2027, finalKeep.concat([vFinal, vTest, vRule, vNext]));
      S.go({ step: 6 }); flush();
      ok('시험 엔진 버전에는 확정 단추가 없고 규칙 어긴 버전은 보이지 않음', !!q('[data-act="pf-final"][data-id="v-final"]') && !q('[data-act="pf-final"][data-id="v-test"]') && !q('[data-act="pf-final"][data-id="v-bad"]'));
      const askedConfirm = window.confirm; let asked = 0; window.confirm = () => { asked++; return false; };
      click('[data-act="pf-final"][data-id="v-final"]'); flush();
      ok('확정은 한 번 묻고, 아니요면 그대로', asked === 1 && !P.final.id(2027));
      window.confirm = () => true;
      click('[data-act="pf-final"][data-id="v-final"]'); flush();
      const row27 = q('.pf-ver input[data-id="v-final"]').closest('.pf-ver');
      ok('확정 → 표시 · 「확정 취소」 · 지우기 숨김', P.final.id(2027) === 'v-final' && /확정/.test(row27.querySelector('.pf-tag.ok').innerText) && !!row27.querySelector('[data-act="pf-final-off"]') && !row27.querySelector('[data-act="pf-del"]'));
      click('[data-act="pf-final"][data-id="v-next"]'); flush();
      ok('다른 버전을 확정하면 하나만 남음', P.final.id(2027) === 'v-next' && qa('[data-act="pf-final-off"]').length === 1);
      click('[data-act="pf-final"][data-id="v-final"]'); flush();
      const planAtFinal = JSON.stringify(st().plan), resAtFinal = JSON.stringify(st().meta.result);
      S.actions['pf-home'](); flush();
      ok('확정하면 결과 확인 카드에 2027 줄 · 보기·재편성 단추', cards().length === 2 && yrsOf(cards()[0]) === '2027' && /확정할 버전/.test(cards()[0].innerText) && !!cards()[0].querySelector('[data-act="pf-open-final"]') && !!cards()[0].querySelector('[data-act="rs-open"]'));
      click('[data-act="pf-open-final"]'); flush();
      ok('결과 확인 > 2027 → 확정 일정 화면(단계 띠 없음 · 확정한 숫자)', S.ui.step === 7 && document.body.classList.contains('pf-ro') && /확정할 버전/.test(page()) && /1,234.5km/.test(page()), S.ui.step);
      ok('확정 일정을 봐도 작업 중인 값·결과는 그대로', JSON.stringify(st().plan) === planAtFinal && JSON.stringify(st().meta.result) === resAtFinal);
      S.go({ step: 6 }); flush();
      click('[data-act="pf-final-off"]'); flush();
      S.actions['pf-home'](); flush();
      ok('확정 취소 → 결과 확인 카드가 빠지고 버전은 남음', !P.final.id(2027) && cards().length === 1 && !!P.versions.get(2027, 'v-final'));
      S.go({ step: 7 }); flush();
      ok('확정 없이 확정 화면 주소로 오면 처음 화면', S.ui.step === 1);
      click('[data-act="pf-open-2027"]:not([data-to])'); flush();
      S.go({ step: 9 }); flush();
      ok('확정 없이 재편성 주소로 오면 처음 화면', S.ui.step === 1, S.ui.step + ' / ' + S.seasonYear());
      window.confirm = askedConfirm; P.versions.put(2027, finalKeep); P.cmp = []; P.cmpPicked = false; flush();

      // ── 2025 · 주소
      S.switchYear(2025, { quiet: true, to: 'stay' }); S.go({ step: 2 }); flush();
      ok('2025 주소로 다른 단계 → 비교 화면으로', S.ui.step === 5 && S.seasonYear() === 2025);
      ok('2025: 2027 결과가 섞이지 않음', !st().meta.result && !st().settings.objective);
      S.actions['pf-home'](); flush();
      click('[data-act="pf-open-2027"]'); flush();
      ok('2027로 돌아오면 검토·결과가 그대로', S.seasonYear() === 2027 && !!st().meta.result && S.flowStatus().allDone);

      // ── 글
      S.go({ step: 5 }); flush();
      // ── 재편성(step=9): 버전 → 취소 표시 → 기간·조건 → 실행(브라우저) → 보기 넷 → 엑셀 (reschedule-parts.js · reschedule-view.js)
      {
        const R = S.rs, rsSt = () => st().reschedule, cf0 = window.confirm;
        window.confirm = () => true;
        P.final.set(2027, '2027-rank1');
        S.actions['pf-home'](); flush();
        ok('처음 화면: 확정한 일정 줄에 재편성 단추(따로 재편성 줄은 없음)', !!q('.pf-ch [data-act="rs-open"]') && !q('.rs-home'));
        click('.pf-ch [data-act="rs-open"]'); flush();
        ok('재편성 화면(단계 띠 없음) · 확정한 버전을 저절로 고름 · 고르는 칸 없음', S.ui.step === 9 && document.body.classList.contains('pf-rs') && rsSt().version === '2027-rank1' && !q('select[data-in="rs-version"]') && /확정/.test((q('.rs-vpick') || {}).innerText || ''));
        ok('재편성 대상: 확정한 버전 하나', R.versions().length === 1 && R.versions()[0].id === '2027-rank1');
        ok('기간 시작 = 1차 편성 마지막 날 다음 날', rsSt().start === Dates.isoDate(Dates.dayNum(R.base().last) + 1) && !rsSt().games.length);
        click('[data-act="rs-month"][data-m="8"]'); flush();
        click('.rs-cal .rs-d.has'); flush();
        const day = R.ui.date, n0 = R.base().byDate.get(day).length;
        ok('달력에서 날 → 그날 경기와 「취소」 단추', !!day && qa('.rs-day [data-act="rs-cancel"][data-v="1"]').length === n0);
        click('.rs-day [data-act="rs-cancel"][data-v="1"]'); flush();
        ok('「취소」 → 취소 기록(우천)', rsSt().games.length === 1 && rsSt().games[0].reason === 'RAIN' && rsSt().games[0].date === day && !!q('.rs-day tr.cx'));
        const rsel = q('.rs-day select[data-in="rs-reason"]'); rsel.value = 'HEAT'; rsel.dispatchEvent(new Event('change', { bubbles: true })); flush();
        ok('사유 바꾸기 → 폭염', rsSt().games[0].reason === 'HEAT');
        click('.rs-day [data-act="rs-day-all"][data-v="1"]'); flush();
        ok('그날 모두 취소', rsSt().games.filter((g) => g.date === day).length === n0 && !!q('.rs-cal .rs-d.cx'));
        const pr = R.problem();
        ok('배정할 경기 = 취소 + 잔여 45 · 홈 73/71 맞음', !pr.error && pr.targets.cancelled === n0 && pr.targets.remaining === 45 && new RegExp((n0 + 45) + '경기').test(q('.rs-sum').innerText));
        app().undo(); flush();
        ok('실행 취소로 되돌림', rsSt().games.length === 1);
        ok('대안 B: 첫 쪽은 취소 경기', !!q('.rs-bstep.on[data-p="1"]') && !q('input[data-in="rs-date"]'));
        click('.footer [data-act="rs-page"][data-p="2"]'); flush();
        ok('다음 → 기간·조건 쪽', !!q('.rs-bstep.on[data-p="2"]') && !!q('input[data-in="rs-date"]') && !!q('.rs-tt'));
        const setIn = (sel2, v) => { const el = q(sel2); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
        setIn('input[data-in="rs-date"][data-k="end"]', '2027-09-01');
        ok('마감일이 시작일보다 앞 → 이유를 보이고 실행 단추 막음', /마감일이 시작일보다 앞입니다/.test(q('.rs-err').innerText) && q('[data-act="rs-run"]').disabled);
        setIn('input[data-in="rs-date"][data-k="end"]', '2027-10-10');
        setIn('input[data-in="rs-num"][data-k="maxConsecutiveDays"]', '5');
        ok('연속 경기일 상한 5', rsSt().maxConsecutiveDays === 5 && !R.problem().error);
        const firstCrit = rsSt().order[0];
        click('[data-act="rs-ord"][data-k="' + firstCrit + '"][data-d="1"]'); flush();
        ok('기준 순서 바꾸기', rsSt().order[1] === firstCrit && rsSt().order.length === 5);
        click('[data-act="rs-run"]'); flush();
        ok('실행 중 표시', R.running() && !!q('[data-act="rs-stop"]'));
        for (let i = 0; i < 300 && !R.result(); i++) await wait(100);
        flush();
        const r = R.result();
        ok('실행이 끝나면 결과 쪽으로', !!q('.rs-bstep.on[data-p="3"]') && !!q('.rs-tg'));
        ok('결과: 브라우저 결과 안내 · 서버와 같은 모양', !!r && r.engine === 'browser' && /인터넷 연결 없이 만든 간단한 결과입니다/.test(q('.rs-notice').innerText) && !!r.metrics && Array.isArray(r.unplaced) && !R.stale(r));
        ok('결과: 배정 대상 모두(넣음 + 못 넣음)', r && r.plan.length === R.problem().targets.targets.length);
        ok('구단 × 날짜 표: 10구단 · 재편성 기간 날짜 칸', qa('.rs-tg tbody tr').length === st().teams.length && qa('.rs-tg thead th.d').length === R.model(r).days.length);
        click('[data-act="rs-view"][data-v="cal"]'); flush();
        const pdays = qa('.rsc-d.pd').map((b) => b.dataset.date);
        ok('달력: 재편성 첫 달 · 기간의 날마다 칸', pdays.length > 0 && pdays.every((d) => d >= r.period.start && d <= r.period.end) && pdays[0].slice(0, 7) === r.period.start.slice(0, 7) && !!q('.rsc-chip'), pdays.length);
        const gday = R.model(r).games.find((g) => g.kind === 're').date;
        click('[data-act="rsc-day"][data-date="' + gday + '"]'); flush();
        ok('달력에서 날 → 오른쪽에 그날 경기 · 구단별 연속 경기일', !!q('.rsc-d.sel[data-date="' + gday + '"]') && qa('.rsc-side tr').length === R.model(r).games.filter((g) => g.kind === 're' && g.date === gday).length && qa('.rsc-runs li').length === st().teams.length);
        if (qa('[data-act="rsc-month"]').length > 1) { const m2 = qa('[data-act="rsc-month"]')[1].dataset.m; click('[data-act="rsc-month"][data-m="' + m2 + '"]'); flush(); ok('달 바꾸기', !!q('[data-act="rsc-month"].on[data-m="' + m2 + '"]') && qa('.rsc-d.pd').every((b) => b.dataset.date.slice(0, 7) === m2)); }
        click('[data-act="rs-view"][data-v="days"]'); flush();
        ok('날짜별 경기: 기간의 날마다', qa('.rs-dl-day').length === Dates.dayNum(r.period.end) - Dates.dayNum(r.period.start) + 1 && qa('.rs-dl-day tr').length === R.model(r).placed);
        click('[data-act="rs-view"][data-v="metrics"]'); flush();
        ok('평가 숫자: 구단별 표', qa('.rs-mt tbody tr').length === st().teams.length && !!q('.rs-tiles'));
        click('[data-act="rs-view"][data-v="unplaced"]'); flush();
        ok('못 넣은 경기 보기', r.unplaced.length ? qa('.rs-un li').length === r.unplaced.length : !!q('.rs-allin'));
        R.quietDownload = true;
        click('.rs-tabs [data-act="rs-xlsx"]'); flush();
        const xs = await KBO.Xlsx.read(R.lastXlsx, null);
        ok('엑셀: 시트 다섯 · 날짜별 경기 = 1차 + 재편성', xs.map((x) => x.name).join() === '날짜별 경기,구단별 출전표,평가 숫자,못 넣은 경기,조건' && xs[0].rows.length === 1 + R.base().games.length + R.model(r).placed && xs[1].rows[0].length === 3 + st().teams.length);
        // ── 다시 짜기(요구 §8): 발표 → 발표한 경기 취소(G:) → 다시 짜기 → 발표한 날짜 그대로 → 다시 발표
        {
          const r1 = R.result();
          click('.rs-tabs [data-act="rs-publish"]'); flush();
          const pub = rsSt().plan.slice();
          ok('발표: 넣은 경기 모두 발표한 일정으로 · 결과는 그대로 맞음 · 「발표한 일정」 표시', pub.length === R.model(r1).placed && !!R.published() && R.isPublished(R.result()) && !R.stale(R.result()) && !!q('.rs-pubtag') && !!q('.rs-publine'), pub.length);
          const tgt = pub.slice().sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : 0))[Math.floor(pub.length / 2)];
          S.rsView.goRecancel(tgt.date); flush();
          ok('취소 표시 달력이 발표한 재편성 달까지', qa('[data-act="rs-month"],[data-act="rsc-month"]').some((b) => Number(String(b.dataset.m).slice(-2)) === Number(tgt.date.slice(5, 7))) || qa('.rsc-mt').length === 1);
          const reBtn = qa('.rs-day.pub [data-act="rs-recancel"][data-v="1"]').find((b) => b.dataset.g === tgt.game);
          ok('그날 재편성 경기에 「취소」', !!reBtn);
          reBtn.click(); flush();
          ok('재편성 경기 취소 → 기록 G:<경기>|<날짜> · 다시 짜는 시작일은 그 다음 날', rsSt().games.some((g) => g.game === tgt.game && g.date === tgt.date) && rsSt().start === Dates.isoDate(Dates.dayNum(tgt.date) + 1) && /새로 취소된 재편성 경기 1/.test(q('.rs-publine').innerText));
          const n1 = rsSt().games.length, m0 = rsSt().games.find((g) => g.match != null);
          R.setCancel(['M:' + m0.match + '|' + m0.date], false); flush();
          ok('발표한 일정에 들어간 1차 편성 취소는 풀리지 않음', rsSt().games.length === n1 && R.lockedM('M:' + m0.match + '|' + m0.date));
          S.rsView.goRerun(); flush();
          const pr2 = R.problem();
          ok('다시 짜는 곳: 다시 넣을 경기 1 · 「다시 짜기」', !pr2.error && pr2.rerun.free.length === 1 && pr2.rerun.free[0].t.id === tgt.game && /다시 짜기/.test(q('[data-act="rs-run"]').innerText));
          setIn('input[data-in="rs-date"][data-k="start"]', tgt.date);
          ok('시작일이 취소된 날 이전 → 이유를 보이고 막음', /다음 날부터 잡을 수 있습니다/.test(q('.rs-err').innerText) && q('[data-act="rs-run"]').disabled);
          setIn('input[data-in="rs-date"][data-k="start"]', Dates.isoDate(Dates.dayNum(tgt.date) + 1));
          const at1 = R.result().at;
          click('[data-act="rs-run"]'); flush();
          for (let i = 0; i < 300 && (R.running() || !R.result() || R.result().at === at1); i++) await wait(100);
          flush();
          const r2 = R.result(), mv = r2.plan.find((x) => x.game === tgt.game), fx = r2.plan.filter((x) => x.fixed);
          ok('다시 짜기: 발표한 경기 날짜 그대로 · 취소된 경기만 시작일 뒤 빈 날로', fx.length === pub.length - 1 && fx.every((x) => pub.find((p) => p.game === x.game).date === x.date) && !!mv && !mv.fixed && (mv.date == null || mv.date >= rsSt().start), fx.length + ' / ' + (mv && mv.date));
          ok('다시 짠 결과: 원래 날은 취소로 · 발표 전 · 「다시 발표」 단추', R.model(r2).games.some((g) => g.kind === 're' && g.cancelled && g.date === tgt.date) && !R.isPublished(r2) && /다시 발표/.test(q('.rs-tabs [data-act="rs-publish"]').innerText));
          click('.rs-tabs [data-act="rs-publish"]'); flush();
          ok('다시 발표: 두 번째 발표 · 취소된 경기는 새 날로', R.published().rounds.length === 2 && (mv.date == null ? !R.planMap().has(tgt.game) : R.planMap().get(tgt.game).date === mv.date) && /2번째 발표/.test(q('.rs-publine').innerText));
        }
        click('.rs-band [data-act="rs-page"][data-p="1"]'); flush();
        click('[data-act="rs-month"][data-m="7"]'); flush();
        click('.rs-cal .rs-d.has'); flush();
        click('.rs-day [data-act="rs-cancel"][data-v="1"]'); flush();
        ok('결과 뒤 취소를 더하면 「다시 실행」 안내', R.stale(R.result()) && /발표함 · 새 취소 있음/.test(page()));
        const other = P.versions.get(2027, '2027-rank2');
        if (other && other.feasible !== false) {
          const g0 = rsSt().games.length;
          P.final.set(2027, other.id); S.go({ step: 9 }); flush();
          ok('다른 버전을 확정하면 작업을 지우지 않고 묻는다', rsSt().version === '2027-rank1' && rsSt().games.length === g0 && !!q('[data-act="rs-version-final"]') && !q('.rs-band'));
          click('[data-act="rs-version-final"]'); flush();
          ok('「확정한 일정으로 새로 시작」 → 취소 표시·결과·발표한 일정 지움', rsSt().version === other.id && !rsSt().games.length && !rsSt().result && !rsSt().plan.length && !rsSt().published && !!q('.rs-band'));
        }
        R.ui.view = 'grid'; S.go({ step: 9 }); flush();
        ok('재편성 아래 줄: 처음 화면으로', !!q('.footer [data-act="pf-home"]'));
        window.confirm = cf0;
        S.actions['pf-home'](); flush();
      }
      const screens = { 재편성: () => S.go({ step: 9 }), 처음: () => S.actions['pf-home'](), 값1: () => S.flowGo(1), 값2: () => S.flowGo(2), 값3: () => S.flowGo(3), 값4: () => S.flowGo(4), 옵션: () => S.go({ step: 2 }), 분석: () => S.go({ step: 5 }), 비교: () => S.go({ step: 6 }), 일정: () => S.go({ step: 3, view: 'calendar' }), 흐름: () => S.go({ step: 3, view: 'flow' }), 상대: () => S.go({ step: 3, view: 'pairs' }), 공정성: () => S.go({ step: 4, qv: 'sched', team: 'KT', team2: null }), 비교: () => S.go({ step: 4, qv: 'cmp', team: 'KT', team2: '삼성' }) };
      for (const v of ['export', 'metrics', 'soft', 'a1', 'a2']) { S.go({ step: 4, qv: v }); flush(); ok('구단 간 비교·내보내기 보기(' + v + ')는 빼고 구단별 보기로', S.ui.qv === 'sched' && !q('[data-qv="' + v + '"]')); }
      ok('남은 보기는 한 구단을 따라가는 것뿐(구단별 일정표·두 구단 비교)', qa('[data-act="q-view"]').length === 2 && qa('[data-act="q-view"]').every((b) => !['metrics', 'soft', 'a1', 'a2', 'export'].includes(b.dataset.qv)));
      S.ui.step = 1; S.g1.mode = 'all'; S.render(); flush();
      ok('모든 표 보기: 동작하지 않는 가져오기 단추 없음', !q('[data-act="import-xlsx"]') && !q('[data-act="import-gsheet"]') && !q('.band [data-act="export"]') && !!q('.band'));
      S.g1.mode = 'flow';
      S.go({ step: 3, view: 'calendar', month: 4 }); flush();
      ok('일정 달력: 그 해 날짜로 그려짐(연도가 2025로 고정되지 않음)', qa('.cal-week').length >= 4 && /vs/.test(q('.cal-grid').innerText));
      const mt = q('.month-tabs');
      ok('일정 달력: 달 단추가 잘리지 않음', mt.scrollWidth <= mt.clientWidth + 1);
      // 결과 고치기(plan-edit.js): 시즌 띠 — 누르면 그 연전 고정(경기 모두 고정), 다시 누르면 풀림 · 「고치는 방법」 추천은 없음
      const press = (el, shift) => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: !!shift })); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); flush(); };
      ok('결과 고치기: 시즌 띠에 연전 기간 전부 + 마치기 단추 둘 · 고치는 방법 단추 없음', qa('.pe-strip .pe-c').length === st().calendar.length && !!q('[data-act="pe-run"]') && !!q('[data-act="pe-save"]') && !q('[data-act="viol-fix"]'));
      const fixAt = 5, slotPins = () => st().plan.filter((p) => p.calendar === fixAt).map((p) => !!st().matches[p.match].pinned);
      press(q('.pe-c[data-pe="' + fixAt + '"]'));
      ok('결과 고치기: 누른 연전이 고정되고 그 연전 경기가 모두 고정됨 · 달력이 그 달로', (st().meta.editFix || {}).slots.join() === String(fixAt) && slotPins().every(Boolean) && !!q('.pe-c.fx[data-pe="' + fixAt + '"]') && !!q('.slotband.pe-fx'));
      press(q('.pe-c[data-pe="' + (fixAt + 3) + '"]'), true);
      ok('결과 고치기: Shift로 누르면 사이의 연전까지 고정', st().meta.editFix.slots.join() === [fixAt, fixAt + 1, fixAt + 2, fixAt + 3].join());
      const conf = window.confirm; window.confirm = () => true; click('[data-act="pe-clear"]'); window.confirm = conf; flush();
      ok('결과 고치기: 모두 풀기 → 고정 없음', !st().meta.editFix.slots.length && slotPins().every((x) => !x) && !q('.pe-c.fx'));
      // 서버가 「고정한 채로 처음부터 짤 수 없음」(JobManager.problemFor)이라 답하면 이어서 풀기로 다시 → 그것도 안 되면 사용자 말로. 시험 엔진은 이 오류를 내지 않으므로 실행 시작만 바꿔 끼워 본다
      {
        const PF = S.planFlow, PE = PF.edit, startRun = S.startRun, solver0 = Object.assign({}, st().settings.solver), toasts = [], toast0 = S.toast;
        let started = 0;
        S.startRun = () => { started++; };
        S.toast = (m) => toasts.push(String(m));
        const JAVA = '고정한 3연전 시리즈 2개를 그 자리에 둔 채로는 편성을 처음부터 짤 수 없었습니다. 고정을 몇 개 풀고 다시 시도해 주세요.';
        const arm = (init) => { S.app.updateSolverSettings({ init }); PE.pending = true; PF.runTag = '고정후새로짜기'; PF.runNote = '메모'; S.app.store.commit('점검: 실행 전', (x) => { x.meta.editRun = { before: { gaps: {}, hard: 0 }, init }; }, { tags: ['meta'], undo: false }); };
        try {
          arm('SCRATCH');
          const r1 = S.onRunError(JAVA);
          await wait(30);
          ok('결과 고치기: 처음부터 못 짜면 이어서 풀기로 다시 보냄', r1 === true && st().settings.solver.init === 'KEEP' && started === 1 && st().meta.editRun.fallback === true && toasts.some((t) => /이어서 고칩니다/.test(t)));
          arm('KEEP');
          const r2 = S.onRunError(JAVA);
          ok('결과 고치기: 이어서 풀기도 못 하면 「고정한 연전이 많아…」 · 이름 꼬리표 지움', r2 === true && st().meta.editRun.failed === true && toasts.some((t) => /고정한 연전이 많아 새로 짤 수 없습니다/.test(t)) && !toasts.some((t) => /시리즈/.test(t)) && PF.runTag == null && !PE.pending);
          arm('SCRATCH');
          const r3 = S.onRunError('이벤트 스트림 연결이 끊어졌습니다.');
          ok('결과 고치기: 다른 오류는 그대로 넘기고 이름 꼬리표 지움', r3 === false && PF.runTag == null && PF.runNote == null && !PE.pending && started === 1);
        } finally {
          S.startRun = startRun; S.toast = toast0;
          S.app.updateSolverSettings(solver0);
          S.app.store.commit('점검: 정리', (x) => { delete x.meta.editRun; }, { tags: ['meta'], undo: false });
        }
        S.go({ step: 3, view: 'calendar', month: 4 }); flush();
      }
      // 홈 지정을 넣으면 운영 방침 화면의 실행도 처음부터(고정은 지킴) · 아래 줄에 「…를 지킵니다」 (사용자 결정 2026-11-07)
      {
        const PF = S.planFlow, startRun = S.startRun, solver0 = Object.assign({}, st().settings.solver);
        press(q('.pe-c[data-pe="' + fixAt + '"]'));
        click('[data-act="pe-mode"][data-v="home"]'); flush();
        const d = S.app.derived(), des0 = window.KBO.FixPlan.designations(st()), hs = d.slots.find((x) => x.index > fixAt + 5 && x.consecutive === 3 && !des0[x.index]).index; // 어린이날처럼 이미 정한 연전은 피한다
        const shared = new Set(st().teams.filter((t) => st().teams.filter((x) => x.stadium === t.stadium).length > 1).map((t) => t.name));
        const team = d.bySlot[hs].map((i) => st().matches[i].away).find((t) => !shared.has(t));
        press(q('.pe-c[data-pe="' + hs + '"]'));
        click('.pe-tm[data-team="' + team + '"]'); flush();
        ok('홈 지정: 띠에서 3연전 → 구단 고르기 → 홈 지정 이벤트(1단계와 같은 값)', st().events.some((e) => e.mode === 'STADIUM' && e.fix === 'home' && (e.teams || []).includes(team)) && PF.homeEdited(st()));
        S.go({ step: 2 }); flush();
        const foot = q('.footer').innerText, band = q('#stepper').innerText;
        ok('운영 방침: 아래 줄 실행 단추 옆에 「고정한 연전 1개를 지킵니다」', !!q('.footer .pe-keep') && /고정한 연전 1개를 지킵니다/.test(q('.footer .pe-keep').textContent));
        ok('운영 방침: 홈 지정이 바뀌면 「이어서」가 아니라 처음부터 다시', /처음부터 다시/.test(foot) && !/이어서/.test(foot) && /처음부터 다시 실행/.test(band) && !/이어서 실행/.test(band));
        const editedBefore = PF.homeEdited(st()) && st().meta.result.sig !== PF.inputSig(st()); // 편성 조건이 바뀌어 예전 규칙이면 「이어서」였을 경우
        S.startRun = () => {};
        try { click('.footer [data-act="pf-run"]'); flush(); } finally { S.startRun = startRun; PF.runOption = null; }
        ok('운영 방침: 홈 지정을 바꾼 뒤 실행은 처음부터(고정은 그대로 보냄)', editedBefore && st().settings.solver.init === 'SCRATCH' && st().plan.filter((p) => p.calendar === fixAt).every((p) => st().matches[p.match].pinned));
        S.app.updateSolverSettings(solver0);
        S.go({ step: 3, view: 'calendar' }); flush();
        click('[data-act="pe-mode"][data-v="home"]'); flush();
        press(q('.pe-c[data-pe="' + hs + '"]'));
        click('.pe-tm[data-team="' + team + '"]'); flush();
        ok('홈 지정 빼면 다시 「이어서」 대상 아님', !PF.homeEdited(st()));
        click('[data-act="pe-mode"][data-v="fix"]'); flush();
        const conf2 = window.confirm; window.confirm = () => true; click('[data-act="pe-clear"]'); window.confirm = conf2; flush();
      }
      S.go({ step: 4, qv: 'sched', team: st().teams[0].name }); flush();
      ok('구단별 일정표: 제목이 그 해', /2027 정규시즌/.test(page()) && !/2025 정규시즌/.test(page()));
      // 구단별 보기: 한 구단 → 둘째 구단 고르기 → 두 구단 비교(team-view.js)
      S.go({ step: 4, qv: 'sched', team: 'KT', team2: null, pick2: false }); flush();
      click('[data-act="tv-pick2"]'); flush();
      ok('구단 카드: 「다른 구단과 비교」 → 고르는 상태', S.ui.pick2 === true && !!q('.tf.picking'));
      click('.tf button[data-team="삼성"]'); flush();
      ok('둘째 구단을 고르면 두 구단 비교: 이동 구간 띠(두 구단 막대) + 항목 표 · 지도 없음', S.ui.qv === 'cmp' && S.ui.team === 'KT' && S.ui.team2 === '삼성' && !!q('.tv-strip svg.tv-leg') && qa('.tv-leg rect.tv-bar').length > 20 && qa('.tv-tbl').length >= 1 && !q('svg.kmap'));
      ok('두 구단 비교 가로축: 달 이름 · 개막일 · 끝 날짜 · 휴식기 띠', qa('.tv-leg .tv-leg-month').length >= 4 && /개막 \d+\/\d+/.test(q('.tv-leg').textContent) && /\d+\/\d+까지/.test(q('.tv-leg').textContent) && qa('.tv-leg .tv-leg-wk').length > 20 && !!q('.tv-leg .tv-leg-break') && /올스타 휴식기/.test(q('.tv-leg').textContent));
      click('[data-act="tv-swap"]'); flush();
      ok('자리 바꾸기', S.ui.team === '삼성' && S.ui.team2 === 'KT');
      click('.tf button[data-team="LG"]'); flush();
      ok('비교 중 셋째 구단을 누르면 둘째 구단이 바뀜', S.ui.team === '삼성' && S.ui.team2 === 'LG');
      click('[data-act="tv-cmp-off"]'); flush();
      ok('비교 끝내기 → 한 구단 일정표', S.ui.qv === 'sched' && !S.ui.team2 && /2027 정규시즌/.test(page()));
      S.go({ step: 4, qv: 'cmp', team: 'LG', team2: null }); flush();
      ok('둘째 구단 없이 비교 보기 → 하나 더 고르라는 안내', S.ui.pick2 === true && /하나 더 고르세요/.test(page()));
      S.ui.pick2 = false; S.ui.team2 = null;
      // 일정 자세히 보기: 달력 · 홈/원정 흐름 · 상대별 경기 수 (리그 전체 보기 둘은 구단별 보기에서 여기로, 구단별 연전 표는 흐름 띠에 합침)
      S.go({ step: 3, view: 'flow', sel: null, teamFilter: [] }); flush();
      ok('홈/원정 흐름: 구단마다 한 줄 띠(홈 막대·원정 막대·달 경계) · 구단별 연전 표 탭 없음', qa('.r3 .tv-flow-row').length === st().teams.length && qa('.tv-flow-blk.h').length > 100 && qa('.tv-flow-head .tv-flow-track > b').length >= 5 && !q('[data-view="matrix"]') && !!q('[data-view="pairs"]'));
      click('.tv-flow-row .tv-flow-name[data-team="KT"]'); flush();
      ok('구단 이름을 누르면 그 줄 강조 = 달력의 구단 고르기', S.ui.teamFilter.join() === 'KT' && !!q('.tv-flow-row.sel') && !!q('.tv-flow.has-sel') && /KT/.test(q('[data-act="teams-menu"]').innerText));
      click('.tv-flow-row.sel .tv-flow-blk'); flush();
      ok('막대를 누르면 경기 창', !!q('.pop.pop-m') && !!S.ui.sel && S.ui.sel.startsWith('m:'));
      S.go({ step: 3, view: 'matrix', sel: null, teamFilter: [] }); flush();
      ok('옛 주소의 구단별 연전 표는 홈/원정 흐름으로', S.ui.view === 'flow');
      S.go({ step: 3, view: 'pairs' }); flush();
      ok('상대별 경기 수: 판정 한 줄 + 칸', !!q('.tv-verdict') && qa('.tv-pairs .tv-pc').length === (st().teams.length + 1) * (st().teams.length + 1));
      S.go({ step: 4, qv: 'a3', team: 'KT' }); flush();
      ok('구단별 보기: 리그 전체 묶음 없음(옛 주소는 구단별 일정표로)', S.ui.qv === 'sched' && !q('[data-qv="a3"]') && !q('[data-qv="a5"]') && !/리그 전체/.test(page()));
      const menuHtml = S.menus.data();
      ok('데이터 메뉴: 동작하지 않는 항목 없음 · 실제로 받는 항목은 남음', !/tag mock|import-xlsx|import-gsheet|엑셀/.test(menuHtml) && /파일로 내려받기/.test(menuHtml) && !/가져오기/.test(menuHtml));
      const found = [];
      for (const k of Object.keys(screens)) { screens[k](); flush(); const m = page().match(WRONG); if (m) found.push(k + ':' + m[0]); }
      ok('화면 글: 금지어·옛 단계 이름 없음', !found.length, found.join(', '));
      S.flowGo(1); S.g1.mode = 'all'; flush();
      ok('모든 표 보기: 아래 줄이 새 흐름 말', !WRONG.test(q('.footer').innerText) && !!q('.footer [data-act="g1-cal"]'));
      click('.footer [data-act="g1-cal"]'); flush();
      ok('모든 표 보기 → 돌아가기', S.g1.mode === 'flow');
    } catch (e) {
      out.push('FAIL 예외: ' + e.message);
    }
    const fails = out.filter((x) => x.startsWith('FAIL')).length;
    document.documentElement.setAttribute('data-plantest', (fails ? 'FAIL ' + fails : 'ALL PASS') + ' / ' + out.length + ' :: ' + out.join(' | '));
  }
  setTimeout(run, 50);
})();
