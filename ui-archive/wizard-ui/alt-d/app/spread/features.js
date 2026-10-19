/*
 * 기능 켜기·끄기 레지스트리 (요구사항 §6 FR-F).
 * 최종 제품에서는 app/common/features.js 한 곳에 둔다(FR-F5). 시안에서는 후보 폴더 안에 둔다.
 * 상태는 프로젝트 meta.features에 저장되고(FR-F4), Store가 localStorage에 자동 저장한다(try/catch는 Store.safeStorage).
 */
(function () {
  'use strict';
  const KBO = window.KBO;

  /** must: true 이면 항상 켜짐(끌 수 없음). def: 기본값 */
  const LIST = [
    { id: 'X1', group: '데이터', name: '.xlsx 업로드', ref: 'FR-X1', must: true, desc: '엑셀 파일로 슬롯·시리즈·이벤트를 가져온다' },
    { id: 'X2', group: '데이터', name: '구글 시트 공유 링크 읽기', ref: 'FR-X2', must: true, desc: '공유 링크(보기 전용)로 시트 탭을 읽는다' },
    { id: 'X8', group: '데이터', name: '한 건 편집', ref: 'FR-X8', must: true, desc: '표에서 행 하나를 수정·삽입·삭제한다' },
    { id: 'X10', group: '데이터', name: 'CSV 업로드', ref: 'FR-X10', def: false, desc: '시트 하나를 CSV 파일로 올린다' },
    { id: 'T4', group: '구단과 거리', name: '지도 마커 드래그', ref: 'FR-T4', def: false, desc: '지도에서 구장 마커를 끌어 좌표를 고친다' },
    { id: 'T7', group: '구단과 거리', name: '거리 행렬 히트맵·대칭 편집', ref: 'FR-T7', def: true, desc: '접힌 히트맵으로 거리 행렬을 보고 대칭으로 고친다' },
    { id: 'V6M', group: '결과·수정', name: '구단 × 슬롯 매트릭스', ref: 'FR-V6', def: false, desc: '결과를 구단(행) × 슬롯(열) 격자로도 본다' },
    { id: 'M2', group: '결과·수정', name: '이동 전 Δ 미리보기', ref: 'FR-M2', def: true, desc: '옮기거나 맞바꾸기 전에 점수 변화량을 보여 준다' },
    { id: 'M8', group: '결과·수정', name: '미배정 풀', ref: 'FR-M8', def: true, desc: '시리즈를 풀로 빼고 다시 넣는다' },
    { id: 'M7', group: '결과·수정', name: '스냅샷 저장·복원', ref: 'FR-M7', must: true, desc: '배정을 이름 붙여 저장하고 되돌린다' },
    { id: 'A1', group: '품질·배포', name: '구단별 총 이동거리', ref: 'FR-A1', must: true, desc: '막대 + 리그 평균선 + ±300km 허용오차' },
    { id: 'A2', group: '품질·배포', name: '이동 횟수·휴일 가중치·주말 홈', ref: 'FR-A2', must: true, desc: '평균과 허용오차를 표시한 점 차트' },
    { id: 'A3', group: '품질·배포', name: '홈/원정 흐름 스트립', ref: 'FR-A3', must: true, desc: '구단 × 슬롯, 3연속 초과 강조' },
    { id: 'A4', group: '품질·배포', name: '누적 이동거리 선 차트', ref: 'FR-A4', def: true, desc: '시즌 진행에 따른 구단별 누적 이동거리' },
    { id: 'A5', group: '품질·배포', name: '상대 매트릭스', ref: 'FR-A5', def: true, desc: '구단쌍 경기 수와 홈/원정 분배(10×10)' },
    { id: 'A8', group: '품질·배포', name: '주중 이동 분석', ref: 'FR-A8', def: true, desc: '주중 → 주말 슬롯 이동 횟수·거리(참고 지표)' },
    { id: 'A9', group: '품질·배포', name: '혹서기 부담 분석', ref: 'FR-A9', def: false, desc: '7~8월 원정 경기 수와 이동거리, 돔 구장 표기' },
    { id: 'A10', group: '품질·배포', name: '장거리 연속 원정 경고', ref: 'FR-A10', def: false, desc: '연속 원정 2시리즈 이상 + 600km 초과 구간' },
    { id: 'A11', group: '품질·배포', name: '구단별 일정표·인쇄', ref: 'FR-A11', def: true, desc: '구단 운영팀 배포용 일정표와 인쇄 레이아웃' },
    { id: 'A12', group: '품질·배포', name: '월별 홈경기 히트맵', ref: 'FR-A12', def: false, desc: '구단 × 월 홈경기 수' },
    { id: 'D4', group: '품질·배포', name: '일정표 CSV 내보내기', ref: 'FR-D4', def: true, desc: '날짜·원정·홈·구장·상태 CSV' },
    { id: 'P2', group: '시즌 운영', name: '결과 미입력 강조', ref: 'FR-P2', def: true, desc: '기준일 이전의 예정 경기를 강조한다' },
    { id: 'P7', group: '시즌 운영', name: '시즌 진행 현황', ref: 'FR-P7', def: true, desc: '구단별 소화·취소·잔여 경기와 수용 게이지' }
  ];
  const BY_ID = {};
  for (const f of LIST) BY_ID[f.id] = f;

  function defaults() {
    const o = {};
    for (const f of LIST) if (!f.must) o[f.id] = !!f.def;
    return o;
  }

  KBO.Features = {
    LIST, BY_ID, defaults,
    /** app.feature(id): Must는 항상 true, 나머지는 meta.features → 기본값 */
    isOn(state, id) {
      const f = BY_ID[id];
      if (!f) return true;
      if (f.must) return true;
      const m = state && state.meta && state.meta.features;
      if (m && typeof m[id] === 'boolean') return m[id];
      return !!f.def;
    }
  };
})();
