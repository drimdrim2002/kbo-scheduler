/*
 * alt-b 단계 레일 — 설정 (별도 메뉴, §3.6).
 * 왼쪽: 기능 켜기·끄기(Must 잠금) · H0-e 모드 · 엔진 연결 · Kakao 키 · 기준일 · 데이터 입출력.
 * 오른쪽: 화면 구성 미리보기 — 켜진 기능만 단계별로 나열한다(끄면 목록과 실제 화면에서 함께 사라짐).
 */
(function () {
  'use strict';
  const R = window.R;
  const esc = R.esc;
  const u = R.ui;
  u.engineMode = 'MOCK';

  function left() {
    const st = R.state();
    const groups = [];
    for (const f of R.FEATURES) { let g = groups.find((x) => x.name === f.group); if (!g) groups.push(g = { name: f.group, items: [] }); g.items.push(f); }
    const on = R.FEATURES.filter((f) => R.feature(f.id)).length;
    let fb = '<div class="sect"><div class="sect-h"><h3>기능 켜기·끄기</h3><span class="hint">' + on + '/' + R.FEATURES.length + ' 켜짐 · 꺼진 기능은 화면에서 사라지고 계산도 하지 않습니다 · 채점에는 영향 없음</span><button class="btn btn-sm" data-act="feat-reset">기본값으로</button></div>';
    for (const g of groups) {
      fb += '<div class="fgroup"><div class="fg-h">' + esc(g.name) + '</div><ul class="flist">' + g.items.map((f) =>
        '<li class="frow"><label class="sw"><input type="checkbox" data-in="feat" data-id="' + f.id + '"' + (R.feature(f.id) ? ' checked' : '') + '><span class="tr"></span><span class="sw-txt">' + (R.feature(f.id) ? '켜짐' : '꺼짐') + '</span></label><div class="f-t"><b>' + esc(f.name) + '</b><span class="hint">' + esc(f.desc) + '</span></div><span class="f-id">' + f.req + '</span><span class="f-def">기본 ' + (f.def ? '켜짐' : '꺼짐') + '</span></li>').join('') + '</ul></div>';
    }
    fb += '<div class="fgroup"><div class="fg-h">Must · 끌 수 없음</div><ul class="flist must">' + R.MUST.map((m) => '<li class="frow"><span class="lockd">' + R.icon('lock') + '항상 켜짐</span><div class="f-t"><b>' + esc(m.name) + '</b></div><span class="f-id">' + m.req + '</span><span></span></li>').join('') + '</ul></div></div>';
    let b = '<div class="sect"><div class="sect-h"><h3>H0-e 홈 의무 판정</h3><span class="hint">상단 배지 옆에 현재 기준 표시</span></div><div class="radios">' +
      [['STADIUM', '구장 기준 (기본)', '지정 구장마다 연고 구단 중 하나라도 홈이면 충족. 잠실은 두산·LG 중 하나'], ['ENGINE', '엔진 호환', 'Java 엔진과 같게: 의무 구단(두산·키움·한화·NC·롯데)의 원정마다 1점']].map((x) => '<label class="radio' + (st.settings.h0eMode === x[0] ? ' is-on' : '') + '"><input type="radio" name="h0e" value="' + x[0] + '" data-in="h0e"' + (st.settings.h0eMode === x[0] ? ' checked' : '') + '><span><b>' + x[1] + '</b><span class="hint">' + x[2] + '</span></span></label>').join('') + '</div></div>';
    b += '<div class="sect"><div class="sect-h"><h3>엔진 연결</h3>' + R.mock() + '</div><div class="frow3"><div class="field"><span class="flabel">엔진</span><div class="seg"><button class="' + (u.engineMode === 'MOCK' ? 'is-on' : '') + '" data-act="eng-mode" data-v="MOCK">시뮬레이션(Mock)</button><button class="' + (u.engineMode === 'REST' ? 'is-on' : '') + '" data-act="eng-mode" data-v="REST">REST 서버</button></div></div><div class="field" style="grid-column:span 2"><label for="rest-url">REST 주소</label><input class="inp" id="rest-url" value="http://localhost:8080/api/v1"' + (u.engineMode === 'REST' ? '' : ' disabled') + '></div></div></div>';
    b += '<div class="sect"><div class="frow3"><div class="field"><label for="kakao">Kakao 지도 키</label><input class="inp" id="kakao" placeholder="없으면 내장 SVG 지도"></div><div class="field"><label for="refdate">결과 미입력 기준일</label><input class="inp" type="date" id="refdate" value="' + st.settings.referenceDate + '" data-in="refdate"></div><div class="field"><label for="lt">장거리 원정 임계값</label><span class="unit"><input class="inp" id="lt" type="number" value="' + st.settings.longTripKm + '">km</span></div></div>' +
      '<label class="chk" style="margin-top:10px"><input type="checkbox" checked> 마지막 구글 시트 URL 기억 (이 브라우저에만)</label></div>';
    b += fb;
    b += '<div class="sect"><div class="sect-h"><h3>프로젝트 데이터</h3></div><div class="btns"><button class="btn btn-sm" data-act="export" data-kind="project">' + R.icon('download') + '프로젝트 JSON 내보내기</button><button class="btn btn-sm" data-act="export" data-kind="project-in">' + R.icon('upload') + '프로젝트 JSON 가져오기</button><button class="btn btn-sm" data-act="export" data-kind="engine">' + R.icon('download') + '엔진 JSON</button></div></div>';
    return R.pane({ title: '판정 기준·연결·기능', sub: '바꾸면 바로 반영됩니다', body: b, sk: 'set' });
  }

  function right() {
    const F = R.feature;
    const steps = [
      ['① 데이터 준비', [['가져오기 띠 · 시트 미리보기', 1], ['슬롯·시리즈 표 한 건 편집', 1], ['이벤트 · 구단과 거리', 1], ['지도 마커 끌기', F('T4'), 'T4'], ['거리 행렬 히트맵', F('T7'), 'T7']]],
      ['② 검토·실행', [['입력 요약 · 사전 점검', 1], ['엔진 옵션 · 실행 · 점수 추이', 1]]],
      ['③ 결과·수정', [['캘린더 · 슬롯 목록', 1], ['위반 목록 · 시리즈 상세 · 핀', 1], ['교환 후보 Δ 미리보기', F('M2'), 'M2'], ['미배정 풀', F('M8'), 'M8'], ['구단 × 슬롯 탭', F('V6'), 'V6'], ['스냅샷 저장·복원', 1]]],
      ['④ 품질·배포', [['구단 지표 · Soft 분해', 1], ['필수 차트 A1~A3', 1], ['누적 이동거리', F('A4'), 'A4'], ['상대 매트릭스', F('A5'), 'A5'], ['주중 이동 (지표 열 포함)', F('A8'), 'A8'], ['혹서기 부담', F('A9'), 'A9'], ['장거리 연속 원정', F('A10'), 'A10'], ['월별 홈 히트맵', F('A12'), 'A12'], ['구단별 일정표 탭', F('A11'), 'A11'], ['일정표 CSV', F('D4'), 'D4'], ['내보내기 · 배포 점검', 1]]],
      ['시즌 운영', [['경기 기록', 1], ['결과 미입력 강조', F('P2'), 'P2'], ['시즌 진행 현황', F('P7'), 'P7'], ['재편성', 1]]]
    ];
    let b = '<p class="hint lead">켜진 기능만 그립니다. 끈 기능은 이 목록과 실제 화면에서 함께 빠집니다.</p><div class="layout-prev">';
    for (const [name, items] of steps) {
      const shown = items.filter((x) => x[1]);
      b += '<div class="lp"><div class="lp-h"><b>' + name + '</b><span class="cnt">' + shown.length + '개</span></div><ul>' + shown.map((x) => '<li class="' + (x[2] ? 'opt' : '') + '">' + (x[2] ? '<span class="f-id">' + x[2] + '</span>' : R.icon('lock', 'lk')) + esc(x[0]) + '</li>').join('') + '</ul></div>';
    }
    b += '</div>';
    return R.pane({ cls: 'pane-live', title: '화면 구성 미리보기', kicker: '즉시 결과', live: true, body: b, sk: 'setr' });
  }

  R.screens.settings = { left, right };
  Object.assign(R.act, {
    'feat-reset'() { R.resetFeatures(); R.toast('기능 켜기·끄기를 기본값으로 되돌렸습니다.', 'ok'); R.render(); },
    'eng-mode'(el) { u.engineMode = el.getAttribute('data-v'); R.render(); }
  });
  R.inputs.feat = (el) => {
    const id = el.getAttribute('data-id');
    R.setFeature(id, el.checked);
    const f = R.FEATURES.find((x) => x.id === id);
    R.toast(f.name + ' — ' + (el.checked ? '켰습니다' : '껐습니다. 화면에서 사라집니다') + '.', el.checked ? 'ok' : 'info');
    R.render();
  };
  R.inputs.h0e = (el) => { R.commit('H0-e 기준: ' + (el.value === 'ENGINE' ? '엔진 호환' : '구장 기준'), (s) => { s.settings.h0eMode = el.value; }, { force: true }); };
  R.inputs.refdate = (el) => { if (el.value) R.commit('기준일 ' + el.value, (s) => { s.settings.referenceDate = el.value; }, { force: true }); };
})();
