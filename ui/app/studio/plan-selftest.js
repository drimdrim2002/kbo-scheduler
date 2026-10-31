/*
 * 계획 흐름 자가 점검 (?plantest=1 일 때만 읽는다. ?selftest=1은 예전 화면을 보므로 따로 둔다)
 * 실제 버튼을 눌러 검토 게이트 · 고치기 · 엔진 옵션 → settings.objective · 실행 · 버전 저장·불러오기를 확인하고 <html data-plantest>에 적는다.
 * 서버 없이 도는 시험이다(브라우저 시험 엔진). 저장은 그 브라우저 프로필에만 남으므로 빈 프로필에서 돌린다(tools/studio/selftest.sh).
 */
(function () {
  'use strict';
  const S = window.Studio, P = S.planFlow, app = () => S.app, st = () => S.app.state;
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
  const slotMatches = (c) => st().plan.filter((x) => x.calendar === c).map((x) => st().matches[x.match]);
  const WRONG = /슬롯|인스펙터|스냅샷|프리셋|목업|구단쌍|미배정|위저드|JSON|[①②③④]|검토·실행|결과·수정|공정성·배포/;

  async function run() {
    try {
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
      S.go({ step: 2 });
      click('[data-act="pf-run"]'); flush();
      ok('검토 전 실행 → 시작하지 않고 멈춘 단계로', !S.run && S.ui.step === 1 && S.g1.fs === 2);

      // ── 고치기
      click('.pf-rv[data-k="opening"] [data-act="pf-cal"]'); flush();
      ok('개막일 고치기 → 달력에서 개막일 고르기가 열림', P.calEdit && S.cal.pickOpen && !!q('[data-act="cal-open"][data-date="2027-04-03"]'));
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

      // ── 엔진 옵션 → settings.objective
      click('[data-act="pf-order"][data-id="distance"]'); flush();
      ok('「거리 먼저」 → 순서', ob().order.join() === 'total,distance,moves,holiday');
      click('[data-act="pf-order"][data-id="holiday"]'); flush();
      ok('「주말·공휴일 먼저」 → 순서', ob().order.join() === 'holiday,moves,distance,total');
      click('[data-act="pf-order-custom"]'); flush();
      click('[data-act="pf-move"][data-k="0"][data-d="1"]'); flush();
      ok('직접 정하기 ▼ → 순서가 바뀌고 직접 정하기로 남음', ob().order.join() === 'moves,holiday,distance,total' && /직접 정하기/.test(q('.pf-oc.on').innerText));
      ok('맨 위 ▲·맨 아래 ▼는 눌리지 않음', q('[data-act="pf-move"][data-k="0"][data-d="-1"]').disabled && q('[data-act="pf-move"][data-k="3"][data-d="1"]').disabled);
      setBox(1, '800');
      ok('허용 차이 숫자 칸 800', ob().distanceGapKm === 800);
      setBox(1, '');
      ok('빈 칸은 받지 않음', ob().distanceGapKm === 800);
      setBox(1, 'abc'); setBox(1, '-5');
      ok('잘못된 값·음수는 받지 않음', ob().distanceGapKm === 800);
      setBox(0, '2.5');
      ok('소수는 정수로', ob().moveGap === 3);
      setBox(1, '0');
      ok('0도 받음', ob().distanceGapKm === 0);
      setBox(1, '99999');
      const win = qa('.pf-ax .win')[1].getBoundingClientRect(), axis = qa('.pf-ax')[1].getBoundingClientRect();
      ok('아주 큰 값: 초록 창이 눈금 밖으로 나가지 않음', ob().distanceGapKm === 99999 && win.right <= axis.right + 1, Math.round(win.right) + ' ≤ ' + Math.round(axis.right));
      setBox(1, '600'); setBox(0, '4');

      // ── 실행
      const orig = app().engine.solve;
      let sent = null;
      app().engine.solve = function (state, opts) { sent = { objective: JSON.parse(JSON.stringify(state.settings.objective)), opts }; return orig.call(this, state, Object.assign({}, opts, { timeLimitSec: 1, unimprovedSec: 1 })); };
      ok('실행 시간 선택지: 1·2·3·5분', qa('.pf-time button').map((b) => b.dataset.v).join() === '60,120,180,300');
      click('.pf-time [data-v="60"]'); flush();
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
      ok('시험 엔진 결과임을 표시(서버 없을 때만)', app().engineConfig.kind === 'REST' || /시험 엔진으로 낸 결과/.test(page()));

      // ── 버전
      const nameIn = q('[data-in="pf-name"]');
      nameIn.value = '<b>첫 버전</b>'; nameIn.dispatchEvent(new Event('change', { bubbles: true }));
      click('[data-act="pf-save"]'); flush();
      const v1 = P.versions.list(2027)[0];
      ok('버전 저장 → 비교 화면 · 이름은 글자 그대로', S.ui.step === 6 && !!v1 && v1.name === '<b>첫 버전</b>' && !q('.pf-ver b b') && !!v1.inputs && v1.inputs.calendar.length === 45);
      ok('저장한 일정·숫자·개막 대진', v1.matches.length === 225 && v1.plan.length === 225 && v1.pairs.some((x) => x.home === 'KIA' && x.away === '키움') && Number.isFinite(v1.gaps.totalKm));
      // 값을 고치면 전 결과를 보여 주지 않는다
      S.flowGo(2); flush();
      click('.pf-rv[data-k="opening"] [data-act="pf-cal"]'); flush();
      click('[data-act="cal-open"][data-date="2027-04-03"]'); flush();
      click('[data-act="pf-cal-done"]'); flush();
      click('[data-act="pf-stage"][data-stage="3"]'); flush();
      ok('실행 뒤 값을 고치면 전 결과 대신 다시 실행 안내', /값을 고친 뒤로/.test(page()) && !q('.pf-dash'));
      // 불러오면 그때 값으로
      click('[data-act="pf-stage"][data-stage="4"]'); flush();
      click('[data-act="pf-load"][data-id="' + v1.id + '"]'); flush();
      const ex = app().derived().ex;
      ok('불러오기: 달력·개막전도 그 버전 것으로', st().settings.seasonStart === '2027-03-27' && ev('OPENING').pairs.some((x) => x.home === 'KIA' && x.away === '키움') && ev('OPENING').teams.length === 5);
      ok('불러오기: 숫자가 저장한 것과 같음', JSON.stringify(ex.objectiveGaps) === JSON.stringify(v1.gaps) && ex.feasible === v1.feasible, JSON.stringify(ex.objectiveGaps));
      ok('불러오기: 결과 화면으로 · 옛 결과 아님', S.ui.step === 5 && !!q('.pf-dash'));
      ok('불러온 뒤 시리즈가 값과 맞음(다시 실행해도 안 깨짐)', S.seriesOkOf(st()));
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
      const third = JSON.parse(JSON.stringify(v1)); third.id = 'v-third'; third.name = '순서 다른 버전'; third.objective.order = ['total', 'distance', 'moves', 'holiday'];
      P.versions.put(2027, P.versions.list(2027).concat([third])); flush();
      click('[data-in="pf-cmp"][data-id="v-third"]'); flush();
      ok('3개째 고르면 가장 먼저 고른 것이 빠짐', boxes().length === 2 && boxes().includes('v-third'));
      ok('순서가 다른 두 버전: 숫자만 나란히', /순서·허용 차이가 달라/.test(page()));
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
      const names = st().teams.map((t) => t.name), chk = (v, y) => P.checkVersion(v, y || 2027, names, 45);
      ok('파일 검사: 정상 통과', chk(JSON.parse(JSON.stringify(v1))) === null);
      ok('파일 검사: 빈 것·다른 모양', !!chk(null) && !!chk({ a: 1 }));
      ok('파일 검사: 다른 해는 그 해를 말해 줌', /2027 버전/.test(chk(JSON.parse(JSON.stringify(v1)), 2025)));
      ok('파일 검사: 잘린 일정', !!chk(Object.assign({}, v1, { matches: v1.matches.slice(0, 3) })));
      ok('파일 검사: 없는 칸을 가리킴', !!chk(Object.assign({}, v1, { plan: v1.plan.map((x) => ({ match: x.match, calendar: 999 })) })));
      ok('파일 검사: 순서가 이상함', !!chk(Object.assign({}, v1, { objective: Object.assign({}, v1.objective, { order: ['x'] }) })));
      ok('파일 검사: 숫자 빠짐', !!chk(Object.assign({}, v1, { gaps: {} })));
      ok('파일 검사: 개막전 홈 구단이 다른 버전은 받지 않음', /홈 구단/.test(chk(Object.assign({}, v1, { pairs: [{ home: '한화', away: 'KT' }] }))));
      // 표·엑셀로 홈 구단이 달라진 경우
      app().commit('시험: 홈 구단 바꿈', (s) => { const e = s.events.find((x) => x.type === 'OPENING'); e.teams = e.teams.map((t) => (t === 'KT' ? '한화' : t)); }, ['events']);
      S.flowGo(3); flush();
      ok('다른 길로 홈 구단이 달라지면 3단계가 끝나지 않고 되돌리기 안내', !S.flowStatus().done[2] && /전년도 순위와 다릅니다/.test(page()) && q('.footer .btn.primary').disabled);
      click('[data-act="pf-op-reset"]'); flush();
      ok('되돌리기 → 원래 홈 구단 · 단계 끝', S.flowStatus().done[2] && ev('OPENING').teams.includes('KT') && ev('OPENING').pairs.length === 5);
      S.go({ step: 6 }); flush();
      click('[data-act="pf-load"][data-id="' + v1.id + '"]'); flush();
      // 저장 공간 부족
      const ls = S.ls.set;
      S.ls.set = () => false;
      const before = P.versions.list(2027).length;
      S.go({ step: 5 }); flush();
      const none = q('[data-act="pf-save"]') ? (click('[data-act="pf-save"]'), flush(), P.versions.list(2027).length) : -1;
      S.ls.set = ls;
      ok('저장 공간 부족: 버전이 늘지 않고 화면에 남음', none === before && S.ui.step === 5);

      // ── 2025 · 주소
      S.switchYear(2025, { quiet: true, to: 'stay' }); S.go({ step: 2 }); flush();
      ok('2025 주소로 다른 단계 → 비교 화면으로', S.ui.step === 5 && S.seasonYear() === 2025);
      ok('2025: 2027 결과가 섞이지 않음', !st().meta.result && !st().settings.objective);
      S.actions['pf-home'](); flush();
      click('[data-act="pf-open-2027"]'); flush();
      ok('2027로 돌아오면 검토·결과가 그대로', S.seasonYear() === 2027 && !!st().meta.result && S.flowStatus().allDone);

      // ── 글
      S.go({ step: 5 }); flush();
      const screens = { 처음: () => S.actions['pf-home'](), 값1: () => S.flowGo(1), 값2: () => S.flowGo(2), 값3: () => S.flowGo(3), 값4: () => S.flowGo(4), 옵션: () => S.go({ step: 2 }), 분석: () => S.go({ step: 5 }), 비교: () => S.go({ step: 6 }), 일정: () => S.go({ step: 3 }), 공정성: () => S.go({ step: 4, qv: 'metrics' }) };
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
