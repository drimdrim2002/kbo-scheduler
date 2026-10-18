# KBO 2025 Analytics & Fairness BI Suite (Candidate 04)
> **Executive BI & Before/After Simulation Dashboard (`optaplanner-practice-ui-analytics-bi`)**  
> 100% Pure Vanilla HTML5 / CSS3 / JavaScript — Zero External Framework Dependencies (`file://` 즉시 실행 지원)

---

## 1. 디자인 컨셉 & 핵심 가치
**후보 4 (Executive BI & Fairness Simulation Suite)**는 KBO 총재·실무진 및 10개 구단 단장 회의에서 정규시즌 일정표의 **수리적 무결성(Hard Constraints)**과 **구단 간 유불리 평준화(Soft Constraints)**를 브리핑하고, 최적화 전(`Initial Plan`)과 최적화 후(`Solved Plan`)의 개선 효과를 시각적으로 입증하도록 설계된 프리미엄 스포츠 BI 대시보드입니다.

- **다크 네이비 Executive 헤더 (`#0F172A`) + 웜 그레이 캔버스 (`#F1F5F9`) + 10개 구단 고유 브랜드 컬러 액센트**
- 상단 4단계 탭 네비게이션 및 **`[📑 전체 스테이지 연속 보기]`** 브리핑 모드 지원

---

## 2. 4대 핵심 워크플로우 스테이지 및 구현 기능

### ① 구단·구장 & GIS 거리 분석 (`Stage 1`)
- **10개 구단 브랜드 카드 & 구장 위치 에디터**:
  - 구단별 공식 컬러 아바타, 연고지, 구장명/주소, 위도(`latitude`), 경도(`longitude`) 편집.
  - **구장 위치 입력 시 위경도 자동 입력**: 구장명/주소 입력 후 `[📍 위경도 자동입력]` 또는 제2구장 프리셋(포항야구장, 울산문수야구장, 청주야구장, 군산월명야구장 등) 선택 시 `KBOEngine.geocodeLocation()`을 통해 위경도가 즉시 자동 입력됩니다.
- **멀티 맵 엔진 지원 (내장 GIS Canvas + Leaflet + Kakao Map + Naver Map)**:
  - 오프라인(`file://`)에서도 100% 동작하는 고해상도 대한민국 야구장 GIS 네트워크 캔버스와 Leaflet 오픈스트리트맵, Kakao/Naver Map SDK 동적 로더를 제공합니다.
- **전 구장 10×10 이동거리 자동 산출 & 지리적 유불리 지수**:
  - `[🗺️ 전 구장 이동거리 자동 산출]` 클릭 시 10×10 도로 이동거리 매트릭스를 재산출하며, 구단별 타 구장 평균 접근성(수도권 유리 vs 지방 장거리 원정 불리) 순위 카드를 함께 표시합니다.

### ② 시즌 일정·휴일·이벤트 설계 (`Stage 2`)
- **시즌 마스터 룰 설정**:
  - 정규시즌 시작일(`2025-03-22`) ~ 종료일(`2025-08-31`), 매주 정기 휴무일 요일 칩 토글(기본값: **매주 월요일**), Soft 평준화 허용 편차(`Tolerance`) 설정.
- **특정 이벤트 설정 빌더 (`[구단 및 구장 지정]` vs `[구장만 지정]` 양방향 모드 지원)**:
  - **모드 A `[🎯 구단 및 구장 지정]`**: 개막 2연전(`2025-03-22`) 등 5개 매치업의 `원정구단 vs 홈구단 @ 개최구장`을 모두 지정(`@PlanningPin`).
  - **모드 B `[🏟️ 구장만 지정 (5개 구장)]`**: 어린이날 3연전(`2025-05-05`) 등 홈경기를 개최할 5개 구장(`잠실, 고척, 대전, 창원, 사직`)만 체크박스로 지정하고 상대 매치업은 OptaPlanner 엔진에 위임. (잠실 어린이날 홈 `두산 ↔ LG` 원클릭 전환 및 신규 커스텀 이벤트 추가 지원)
- **올스타 브레이크 및 미개최(Blackout) 일자 설정**:
  - 올스타 브레이크(`2025-07-11 ~ 2025-07-16`) 및 추가 미개최일 등록/삭제.
- **2025 시즌 6개월(3월~8월) 시각적 캘린더 프리뷰 보드**:
  - 개막 2연전, 어린이날 3연전, 주중/주말 3연전, 후반기 4연전, 월요일 휴무, 올스타 브레이크를 색상별로 구분하며 날짜 클릭 시 해당 슬롯의 5개 대진(Before/After)을 즉시 인스펙트합니다.

### ③ 시뮬레이션 최종 확인 & 엔진 구동 (`Stage 3`)
- **최종 입력 요약 인포그래픽 (Pre-Flight Auditor)**:
  - 6대 사전 무결성 체크리스트(위경도/거리행렬, 45슬롯·225시리즈, 휴무일/올스타, 잠실 공동구장, 개막/어린이날 Pin, Tolerance 목표) 점검.
- **OptaPlanner 최적화 엔진 실행 & 실시간 수렴 모니터**:
  - `[🚀 OptaPlanner 최적화 엔진 실행]` 클릭 시 Construction Heuristic → Tabu Search → Simulated Annealing → Late Acceptance 단계별 실시간 로그, 진행률 바, 그리고 **실시간 거리 편차 페널티(`-573,810 → 0`) & 최대 격차(`1,372.5km → 573.1km`) 수렴 그래프(Canvas)**가 애니메이션으로 구동됩니다.

### ④ Hard/Soft 공정성 리포트 & 전후 비교 BI (`Stage 4`)
- **플랜 비교 모드 스위치**:
  - `[✨ 최적화 완료안 (Solved)]` ↔ `[📉 최적화 전 초기안 (Initial)]` ↔ `[🚨 Hard 위반 샘플 테스트 (Violation Demo)]` 실시간 전환.
- **6대 Hard Constraints 신호등 검증 패널**:
  - ① 1일 10구단 5경기 편성, ② 구장 중복 배정 금지(잠실 두산·LG 분리), ③ 연전 수 일치, ④ 개막·어린이날·휴무일·올스타 준수, ⑤ 연속 홈/원정 시리즈 제한(최대 3연속), ⑥ 연속 시리즈 동일 맞대결 금지 위반 여부를 신호등(`PASS / FAIL`)으로 표시합니다.
- **구단별 Soft Constraints 전/후(Before vs After) 마스터 비교 테이블**:
  - 10개 구단별 최적화 전 거리, 최적화 후 거리, 개선폭(Δ), 평균 대비 편차, 총 이동 일수(주중/주말), 주말 홈경기 수, 공휴일 홈경기 수, 휴일 점수, 최대 연속 홈/원정 시리즈 비교 및 컬럼 정렬 지원.
- **6종 프리미엄 BI 차트 (100% Pure HTML5 Canvas 직접 구현)**:
  1. **BI Chart 1**: 최적화 전/후 구단별 총 이동거리 비교 & 리그 평균 ±300km 평준화 Tolerance 밴드 차트
  2. **BI Chart 2**: 구단별 이동 일수(주중 이동 vs 주말 이동) 누적 바 & 이동 효율 산점도(Scatter/Bubble Chart)
  3. **BI Chart 3**: 구단별 주말·공휴일 홈경기 수 및 휴일 점수(Holiday Score) 평준화 차트
  4. **BI Chart 4**: 10개 구단 5대 공정성 지수 레이더 차트 (다중 구단 오버레이 & Before 점선 비교)
  5. **BI Chart 5**: 시즌 진행(3월~8월, 45슬롯)에 따른 10개 구단 누적 이동거리 스파게티/라인 차트
  6. **BI Chart 6**: 선택 구단 상세 시즌 이동 경로 타임라인 & 대한민국 지도 궤적 뷰 (45 시리즈 전수 추적)

---

## 3. 실행 방법
별도의 빌드나 웹 서버 없이 브라우저에서 `index.html`을 바로 열거나 로컬 정적 서버로 실행할 수 있습니다.

```bash
# 방법 1: 브라우저로 직접 열기
open /Users/brown/workspace/optaplanner-practice-ui-analytics-bi/ui-template/index.html

# 방법 2: 로컬 정적 서버로 열기
cd /Users/brown/workspace/optaplanner-practice-ui-analytics-bi/ui-template
python3 -m http.server 8084
```
