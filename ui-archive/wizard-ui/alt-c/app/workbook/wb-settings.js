/*
 * alt-c 편성 워크북 — 설정 (모달). 기능 켜기·끄기 목록(Must 잠금), H0-e 모드, Kakao 키, 엔진 연결, 기준일, 구글 시트 URL, 프로젝트 JSON.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const esc = WB.esc, icon = WB.icon;
  const S = WB.Settings = {};

  function featTable() {
    const rows = WB.FEATURES;
    const on = rows.filter((f) => !f.must && WB.feature(f.key)).length;
    const tog = rows.filter((f) => !f.must).length;
    return '<div class="ph">' + icon('sheet') + ' 기능 켜기·끄기<small>FR-F · 켠 기능 ' + on + ' / ' + tog + ' · Must ' + rows.filter((f) => f.must).length + '개는 항상 켜짐</small><span class="grow"></span><button class="btn box sm" id="featReset">기본값으로</button></div>' +
      '<div class="ftwrap"><table class="g ft"><thead><tr class="fh"><th style="width:92px">상태</th><th style="width:66px">ID</th><th style="width:170px">기능</th><th>설명</th><th style="width:118px">위치</th><th style="width:64px">기본값</th></tr></thead><tbody>' +
      rows.map((f) => {
        const v = WB.feature(f.key || f.id);
        const ctl = f.must ? '<span class="st lock">' + icon('lock') + '항상 켜짐</span>' : '<label class="tgl"><input type="checkbox" data-feat="' + f.key + '"' + (v ? ' checked' : '') + ' aria-label="' + esc(f.name) + '"><span class="tr"></span><b>' + (v ? '켜짐' : '꺼짐') + '</b></label>';
        return '<tr class="' + (f.must ? 'must' : '') + '"><td>' + ctl + '</td><td class="mono">' + esc(f.id) + '</td><td>' + esc(f.name) + '</td><td style="color:var(--c-muted)">' + esc(f.desc) + '</td><td>' + esc(f.where || '') + '</td><td>' + (f.must ? 'Must' : f.def ? '켜짐' : '꺼짐') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="note" style="margin-top:4px">끈 기능은 화면에서 사라지고 계산도 하지 않습니다(빈 자리·회색 처리 없음). 채점에는 영향이 없습니다. 상태는 이 브라우저에 저장됩니다.</div>';
  }

  function side() {
    const app = WB.app;
    const st = app.state.settings;
    const mode = st.h0eMode || 'STADIUM';
    const eng = app.engineConfig || { type: 'mock' };
    return '<div class="setsec" id="set-h0e"><div class="ph">' + icon('ok') + ' H0-e 홈 의무 판정</div>' +
      '<label class="chk rad"><input type="radio" name="h0e" value="STADIUM"' + (mode === 'STADIUM' ? ' checked' : '') + '><span><b>구장 기준</b> (기본, D3) — 지정 구장 연고 구단 중 하나가 홈이면 충족. 잠실은 두산·LG 중 하나</span></label>' +
      '<label class="chk rad"><input type="radio" name="h0e" value="ENGINE"' + (mode === 'ENGINE' ? ' checked' : '') + '><span><b>엔진 호환</b> — 의무 구단(' + esc((st.obligationTeams || []).join('·')) + ')의 원정마다 1점. Java 결과와 1:1 비교</span></label></div>' +
      '<div class="setsec"><div class="ph">' + icon('map') + ' 지도 (Kakao Maps)</div><div class="field"><span>JavaScript 키</span><input class="inp mono" id="kakaoKey" placeholder="키 없음 — 내장 SVG 지도 사용" value="' + esc(app.kakaoKey || '') + '"></div><div class="note">키를 넣으면 Kakao SDK를 불러옵니다(네트워크). 무효 키·미등록 도메인이면 내장 지도로 돌아갑니다. ' + WB.st('info', '현재: 내장 SVG') + '</div></div>' +
      '<div class="setsec"><div class="ph">' + icon('play') + ' 엔진 연결</div>' +
      '<div class="field"><span>엔진</span><span class="seg"><button data-eng="mock" class="' + (eng.type !== 'rest' ? 'on' : '') + '">Mock (브라우저)</button><button data-eng="rest" class="' + (eng.type === 'rest' ? 'on' : '') + '">REST 서버</button></span></div>' +
      '<div class="field"><span>REST 주소</span><span class="row"><input class="inp mono" id="restUrl" value="' + esc(eng.baseUrl || 'http://localhost:8080/api/v1') + '"><button class="btn box sm" id="restTest">연결 시험</button></span></div><div class="note">' + WB.mock('목업') + ' POST /solve · GET /solve/{id}/events(SSE) · POST /score (§7.3)</div></div>' +
      '<div class="setsec"><div class="ph">' + icon('cal') + ' 기준일 · 데이터</div>' +
      '<div class="field"><span>결과 미입력 기준일</span><input class="inp num" id="refDate" value="' + esc(st.referenceDate || '') + '" placeholder="비우면 오늘"></div>' +
      '<div class="field"><span>구글 시트 URL</span><input class="inp mono" id="gsUrl2" value="' + esc(WB.LS.get('gsheet-url') || '') + '" placeholder="최근 연결한 링크를 기억합니다"></div>' +
      '<div class="row wrap" style="margin-top:4px"><button class="btn box sm" data-act="export-json">' + icon('down') + '프로젝트 JSON 내보내기</button><button class="btn box sm" id="importJson">' + icon('up') + 'JSON 가져오기</button><button class="btn box sm" data-act="export-engine">' + icon('down') + '엔진 JSON</button></div></div>';
  }

  S.open = function (focus) {
    const m = WB.modal({
      id: 'settings', title: icon('gear') + ' 설정', width: 1180,
      body: '<div class="setgrid"><div class="setl">' + featTable() + '</div><div class="setr">' + side() + '</div></div>',
      foot: '<span class="note">설정은 바로 적용됩니다.</span><span class="grow"></span><button class="btn pri" data-close>닫기</button>',
      onMount: bind
    });
    if (focus) { const el = m.querySelector('#set-' + focus); if (el) { el.classList.add('flashbox'); el.scrollIntoView({ block: 'nearest' }); } }
  };
  function rerender(m) {
    const l = m.querySelector('.ftwrap'); const top = l ? l.scrollTop : 0;
    m.querySelector('.setl').innerHTML = featTable();
    const l2 = m.querySelector('.ftwrap'); if (l2) l2.scrollTop = top;
    bindFeat(m);
  }
  function bindFeat(m) {
    m.querySelectorAll('[data-feat]').forEach((cb) => cb.addEventListener('change', () => {
      const f = WB.FEATURES.find((x) => x.key === cb.dataset.feat);
      WB.setFeature(cb.dataset.feat, cb.checked);
      WB.render();
      rerender(m);
      WB.toast(f.name + ' ' + (cb.checked ? '켬' : '끔') + ' — ' + f.where + (cb.checked ? '에 나타납니다' : '에서 사라졌습니다'), 'ok');
    }));
    const r = m.querySelector('#featReset');
    if (r) r.addEventListener('click', () => { WB.resetFeatures(); WB.render(); rerender(m); WB.toast('기능 켜기·끄기를 기본값으로 돌렸습니다.', 'ok'); });
  }
  function bind(m) {
    bindFeat(m);
    m.querySelectorAll('input[name=h0e]').forEach((r) => r.addEventListener('change', () => { WB.track('H0-e 모드 변경', () => WB.app.setH0eMode(r.value)); WB.render(); WB.toast('H0-e 모드: ' + (r.value === 'ENGINE' ? '엔진 호환' : '구장 기준') + ' — 점수를 다시 계산했습니다.', 'ok'); }));
    m.querySelector('#kakaoKey').addEventListener('change', (e) => { WB.toast(e.target.value ? 'Kakao 키 저장 — 지도 탭에서 불러옵니다 (목업)' : 'Kakao 키를 지웠습니다 — 내장 지도 사용'); });
    m.querySelectorAll('[data-eng]').forEach((b) => b.addEventListener('click', () => { m.querySelectorAll('[data-eng]').forEach((x) => x.classList.toggle('on', x === b)); WB.toast(b.dataset.eng === 'rest' ? 'REST 엔진 선택 (목업) — 서버 미구현' : 'Mock 엔진 선택'); }));
    m.querySelector('#restTest').addEventListener('click', () => WB.toast('연결 시험 (목업): 서버가 응답하지 않습니다 — Mock 엔진을 계속 씁니다.', 'warn'));
    m.querySelector('#refDate').addEventListener('change', (e) => { const v = WB.Book.parseDate(e.target.value) || ''; WB.track('기준일 변경', () => WB.app.updateSettings({ referenceDate: v }, '기준일')); WB.render(); });
    m.querySelector('#gsUrl2').addEventListener('change', (e) => WB.LS.set('gsheet-url', e.target.value));
    m.querySelector('#importJson').addEventListener('click', () => WB.app.importFile());
  }
})();
