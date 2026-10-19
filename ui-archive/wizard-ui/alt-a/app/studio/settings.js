/*
 * alt-a 편성 스튜디오 — 설정 서랍 (§3.6, §6)
 * 기능 켜기·끄기(Must 잠금), H0-e 모드, 엔진 연결, Kakao 키, 기준일, 구글 시트 URL, JSON 입출력
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { esc, icon, fmt } = S;
  const app = () => S.app;

  function features() {
    const must = S.FEATURES.filter((f) => f.must), opt = S.FEATURES.filter((f) => !f.must);
    const on = opt.filter((f) => S.feature(f.id)).length;
    let s = '<div class="set-sec" style="display:flex;align-items:center;gap:8px"><div><h4 style="margin:0">기능 켜기·끄기</h4><p>꺼진 기능은 화면에서 사라지고 계산도 하지 않습니다. 채점에는 영향이 없습니다. 상태는 프로젝트 <code class="mono">meta.features</code>와 이 브라우저에 저장됩니다.</p></div><button class="btn sm" style="margin-left:auto;flex:none" data-act="feat-reset">' + icon('undo') + '기본값으로</button></div>';
    s += '<div class="label">필수 기능 (Must)<span class="cnt">' + icon('lock') + ' 항상 켜짐 · 끌 수 없음</span></div><div style="display:flex;flex-wrap:wrap;gap:5px;padding:0 14px 10px">' +
      must.map((f) => '<span class="tag ref" style="height:22px;padding:0 7px;font-size:11.5px" title="' + esc(f.desc) + '">' + icon('lock') + esc(f.name) + ' <span class="mono" style="font-weight:400;color:var(--text-3)">' + esc(f.ref.replace('FR-', '')) + '</span></span>').join('') + '</div>';
    s += '<div class="label" style="border-top:1px solid var(--line)">선택 기능<span class="cnt">' + on + ' / ' + opt.length + ' 켜짐</span></div>';
    s += opt.map((f) => '<label class="feat"><span class="switch"><input type="checkbox" data-in="feat" data-id="' + f.id + '"' + (S.feature(f.id) ? ' checked' : '') + ' aria-label="' + esc(f.name) + '"><i></i></span>' +
      '<span class="nm">' + esc(f.name) + ' <span class="id">' + esc(f.ref) + '</span></span><span class="df">기본 ' + (f.def ? '켜짐' : '꺼짐') + (S.feature(f.id) !== f.def ? '<br><b style="color:var(--blue)">변경됨</b>' : '') + '</span><span class="ds">' + esc(f.desc) + '</span></label>').join('');
    return s;
  }
  function scoring() {
    const st = app().state, mode = st.settings.h0eMode;
    const eng = app().engineConfig;
    return '<div class="set-sec"><h4>' + icon('rule') + 'H0-e 홈 의무 판정</h4><div class="radio-row">' +
      '<label><input type="radio" name="h0e" data-in="h0e" value="STADIUM"' + (mode !== 'ENGINE' ? ' checked' : '') + '>구장 기준 (기본, D3)</label>' +
      '<label><input type="radio" name="h0e" data-in="h0e" value="ENGINE"' + (mode === 'ENGINE' ? ' checked' : '') + '>엔진 호환 (Java 1:1 비교)</label></div>' +
      '<p>구장 기준: 지정 구장마다 연고 구단 중 홈이 없으면 1점. 엔진 호환: 의무 구단(' + esc((st.settings.obligationTeams || []).join('·')) + ')의 원정 시리즈마다 1점. 현재 모드는 상단 점수 배지 옆에 표시됩니다.</p></div>' +
      '<div class="set-sec"><h4>' + icon('bolt') + '엔진 연결</h4><div class="radio-row">' +
      '<label><input type="radio" name="eng" data-in="eng" value="MOCK"' + (eng.kind !== 'REST' ? ' checked' : '') + '>브라우저 Mock 엔진</label>' +
      '<label><input type="radio" name="eng" data-in="eng" value="REST"' + (eng.kind === 'REST' ? ' checked' : '') + '>REST (Java 서버)</label></div>' +
      '<label class="field" style="margin-top:8px"><span>REST 주소</span><input class="input" data-in="eng-url" value="' + esc(eng.baseUrl || 'http://localhost:8080') + '"' + (eng.kind === 'REST' ? '' : ' disabled') + '></label>' +
      '<p>POST /api/v1/solve · GET /api/v1/solve/{jobId}/events (SSE) · POST /api/v1/score ' + S.mock('시안: 연결 시험 없음') + '</p></div>' +
      '<div class="set-sec"><h4>' + icon('clock') + '기준일 (결과 미입력 판정)</h4><input class="input" style="width:160px" data-in="refdate" value="' + esc(fmt.date(app().referenceDate())) + '"><p>비우면 오늘입니다. 시안은 2025 시즌 중간(7/10)으로 둡니다.</p></div>';
  }
  function data() {
    const key = app().kakaoKey || '';
    const gs = S.ls.get(S.KEY + 'gsheet-url') || '';
    return '<div class="set-sec"><h4>' + icon('map') + '지도 (Kakao)</h4><label class="field"><span>Kakao JavaScript 키</span><input class="input" data-in="kakao" value="' + esc(key) + '" placeholder="키가 없으면 내장 SVG 지도를 씁니다"></label><p>' + (key ? '키 입력됨 — 로컬 서버(http://localhost)로 열어야 합니다.' : S.stat('info', 'SVG 지도 사용 중') + ' 키를 넣으면 Kakao 지도·장소 검색으로 바꿉니다.') + '</p></div>' +
      '<div class="set-sec"><h4>' + icon('link') + '구글 시트</h4><label class="field"><span>기억한 공유 링크</span><input class="input" data-in="gsurl" value="' + esc(gs) + '" placeholder="https://docs.google.com/spreadsheets/d/…"></label><p>URL과 문서 ID는 이 브라우저의 localStorage에만 둡니다. <button class="btn xs" data-act="gs-forget">잊기</button></p></div>' +
      '<div class="set-sec"><h4>' + icon('db') + '프로젝트·엔진 JSON</h4><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="export" data-kind="project">' + icon('download') + '프로젝트 JSON 내보내기</button><button class="btn sm" data-act="export" data-kind="engine">' + icon('download') + '엔진 JSON 내보내기</button><button class="btn sm" data-act="json-import">' + icon('upload') + 'JSON 가져오기…</button></div><p>엔진 JSON은 input_2025.json 형식입니다. 가져오기는 필드 단위로 검증합니다.</p></div>';
  }

  S.drawers.settings = function () {
    const t = S.ui.setTab || 'features';
    const tabs = [['features', '기능'], ['scoring', '채점·엔진'], ['data', '지도·데이터']];
    return '<aside class="drawer" role="dialog" aria-label="설정"><div class="pane-head"><span class="pane-title">' + icon('gear') + ' 설정</span><span class="pane-desc">프로젝트 단위 · 자동 저장</span><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-drawer" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div class="set-nav" role="tablist">' + tabs.map((x) => '<button role="tab" class="' + (t === x[0] ? 'on' : '') + '" data-act="set-tab" data-tab="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
      '<div class="pane-body" data-sk="set-' + t + '">' + (t === 'scoring' ? scoring() : t === 'data' ? data() : features()) + '</div></aside>';
  };

  Object.assign(S.actions, {
    'set-tab': (el) => S.go({ setTab: el.dataset.tab }),
    'feat-reset': () => { S.resetFeatures(); S.toast('기능 켜기·끄기를 기본값으로 되돌렸습니다.', 'ok'); S.render(); },
    'gs-forget': () => { S.ls.del(S.KEY + 'gsheet-url'); S.render(); },
    'json-import': () => app().importFile()
  });
  S.inputs.feat = (el) => {
    const f = S.FEATURES.find((x) => x.id === el.dataset.id);
    S.setFeature(el.dataset.id, el.checked);
    S.toast((f ? f.name : el.dataset.id) + ' — ' + (el.checked ? '켰습니다. 해당 화면에 나타납니다.' : '껐습니다. 화면에서 사라집니다.'), 'info');
    S.render();
  };
  S.inputs.h0e = (el) => { app().setH0eMode(el.value); };
  S.inputs.eng = (el) => { app().setEngineConfig({ kind: el.value }); S.render(); };
  S.inputs['eng-url'] = (el) => { app().setEngineConfig({ baseUrl: el.value }); };
  S.inputs.refdate = (el) => { const v = S.parse.date(el.value); if (v) app().updateSettings({ referenceDate: v }, '기준일 변경'); };
  S.inputs.kakao = (el) => { app().setKakaoKey(el.value.trim()); S.render(); };
  S.inputs.gsurl = (el) => { S.ls.set(S.KEY + 'gsheet-url', el.value.trim()); };
})();
