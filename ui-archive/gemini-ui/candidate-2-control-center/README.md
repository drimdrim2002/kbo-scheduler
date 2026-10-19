# KBO Tactical Command Center (Candidate 2: Dark GIS & Real-time Solver Telemetry Control Center)

프로야구 데이터 분석 상황실(MLB Statcast / 항공 스케줄 관제 센터 감성)의 하이컨트라스트 다크 모드(`#080C14` / `#0F172A`)를 적용한 **KBO 정규시즌 스케줄 최적화(OptaPlanner 8.x) 통합 관제 UI 템플릿**입니다.

프레임워크(React, Vue 등)나 별도 번들러 없이 **100% 순수 HTML5, CSS3, Vanilla JavaScript**로 구현되어 브라우저에서 `index.html`을 직접(`file://`) 열어도 모든 GIS 지도, 거리 행렬 계산, 이벤트 룰 빌더, OptaPlanner 스코어 계산기 및 5종의 텔레메트리 차트가 완벽히 동작합니다.

---

## 📂 파일 구조 (`ui-template/`)

| 파일명 | 설명 |
| :--- | :--- |
| `index.html` | 글로벌 텔레메트리 헤더, 4대 핵심 관제 모듈 데크, GIS API Key 설정 모달을 포함한 메인 마크업 |
| `styles.css` | `#080C14` 다크 슬레이트 기반 관제 시스템 스타일시트 (네온 에메랄드/시안/앰버/크림슨 상태 램프 및 반응형 그리드) |
| `data.js` | 실제 프로젝트의 `input_2025.json` 도메인 데이터(`teams`, `distanceMatrix`, `calendar`, `initialPlan`, `solvedPlan`) 및 `BaseballEasyScoreCalculator.java` 100% 포트 엔진 (`window.KBOEngine`) |
| `app.js` | 4대 모듈 인터랙션, 지오코딩/거리 재계산, 멀티 엔진 GIS 렌더러, 실시간 솔버 시뮬레이터, 5종 고해상도 Canvas 차트 컨트롤러 |
| `README.md` | 템플릿 아키텍처 및 기능 명세 문서 |

---

## 🚀 실행 방법

별도의 빌드나 서버 구동 없이 즉시 실행할 수 있습니다.

1. **브라우저 직접 열기 (`file://` 완벽 지원)**:
   - `/Users/brown/workspace/optaplanner-practice-ui-control-center/ui-template/index.html` 파일을 더블클릭하거나 브라우저로 드래그하여 엽니다.
2. **로컬 정적 서버 실행 (선택 사항)**:
   ```bash
   npx serve ui-template
   # 또는
   python3 -m http.server 8080 --directory ui-template
   ```

---

## 🛠️ 4대 핵심 관제 모듈 및 구현 기능

### 1. MODULE 01 // GIS 구단·구장 & 거리 매트릭스 관제 (`#mod-gis`)
- **10개 구단 레지스트리 & 위·경도 자동 변환**:
  - SSG, 두산, LG, KT, 키움, 한화, 삼성, KIA, NC, 롯데 10개 구단의 홈구장명/주소, 위도(`latitude`), 경도(`longitude`), 어린이날 의무 홈 여부를 실시간 편집합니다.
  - 구장명이나 주소를 입력 후 `Enter` 또는 `📍변환` 클릭 시 `KBOEngine.geocodeLocation()`을 통해 위·경도가 자동 변환됩니다 (내장 KBO 제1·제2구장 좌표 DB + Kakao Map Places/Geocoder API + OpenStreetMap Nominatim 연동).
  - 상단 **제2구장 시나리오 빠른 적용 버튼**(`삼성 → 포항야구장`, `롯데 → 울산문수`, `한화 → 청주야구장`, `KIA → 군산월명`)을 클릭하면 즉시 좌표 변환과 10×10 거리 행렬 및 전체 스케줄 점수가 재계산됩니다.
- **멀티 엔진 GIS 네트워크 맵**:
  - **Tactical Vector GIS (기본 내장)**: 오프라인 및 `file://` 환경에서도 100% 동작하는 고해상도 한반도 벡터 GIS 맵으로, 구단 클릭 시 출발 구단에서 타 구장까지의 이동 노선(Quadratic Bezier Arc)과 도로 이동거리(`km`) 라벨을 하이라이트합니다.
  - **Leaflet Dark Tile Map**: CartoDB DarkMatter 타일 기반 다크 맵 위에 구장 마커와 이동 경로를 표시합니다.
  - **Kakao Map / Naver Map SDK 동적 로더**: 상단 `🔑 GIS API KEY` 모달에서 키 입력 시 즉시 상용 카카오맵/네이버맵 타일 및 지오코더로 전환됩니다.
- **10×10 구장 간 도로 이동거리 히트맵 행렬**:
  - `[⚡ Map Route API 거리 행렬 일괄 재계산]` 버튼 클릭 시 `KBOEngine.calculateDistanceMatrixFromCoords()`로 100개 셀 거리를 일괄 산출합니다.
  - `0.0km (잠실 두산·LG 공유)`부터 `407.2km (고척↔사직)`까지 거리 구간별 히트맵 컬러링과 개별 셀 인라인 수정(대칭 동시 수정 옵션 포함)을 지원합니다.

### 2. MODULE 02 // 시즌 캘린더·휴일·이벤트 룰 빌더 (`#mod-calendar`)
- **시즌 마스터 타임라인 & 정기 휴무 요일**:
  - 정규시즌 시작일(`2025-03-22`) ~ 종료일(`2025-08-31`), 올스타 브레이크(`2025-07-11 ~ 2025-07-16`), 경기 미개최 Blackout 일자를 설정합니다.
  - 매주 정기 휴무일(기본값: **월요일** 체크, 요일 토글 변경 가능)을 지정하여 휴무일 경기 편성 시 즉시 Hard 위반으로 탐지합니다(단, 어린이날 월요일은 예외 허용).
- **특정 이벤트 룰 매니저 (개막전 · 어린이날 · 공휴일 특별 편성)**:
  - 각 이벤트마다 다음 두 가지 배정 모드를 스위치로 즉시 전환할 수 있습니다:
    1. **`구단 + 구장 지정 (대진 고정 / Matchup Pin)`**: 홈 구단(구장)과 원정 상대 구단까지 대진표를 모두 고정합니다.
    2. **`구장만 지정 (홈구장 고정, 상대팀 자동배정 / Stadium-Only Host Pin)`**: 개최 구장(홈팀) 5곳만 의무 고정하고 원정 상대팀은 솔버가 이동거리·휴일 밸런스에 맞춰 자동 배정합니다.
- **시각적 시즌 캘린더 & 45시리즈 슬롯 타임라인 인스펙터**:
  - 3월~8월 달력 그리드와 하단 45개 시리즈 슬롯 리본(`S01 ~ S45`)을 클릭하면 해당 날짜의 5경기 대진표, 구장, 연전 수, 휴일 가중치, Hard 위반 내역을 즉시 인스펙터에 표시합니다.

### 3. MODULE 03 // 프리플라이트 진단 & 엔진 실행 콘솔 (`#mod-solver`)
- **Pre-flight Readiness Check & Soft Tolerance 실시간 튜닝**:
  - 구단 좌표, 거리 행렬(100셀), 캘린더(45슬롯), 이벤트 Pinning 무결성을 자동 점검합니다.
  - `toleranceTotalDistance`(기본 `±300.0km`), `toleranceHoliday`(기본 `±1.5pt`), `toleranceTotalMove`(기본 `±2.0회`), `maxConsecutiveSeries`(기본 `3연속`) 슬라이더를 조절하면 즉시 BendableScore와 차트에 반영됩니다.
  - OptaPlanner 입력 JSON Payload 프리뷰, 클립보드 복사 및 파일 다운로드(`input_2025_command_center.json`)를 지원합니다.
- **실시간 솔버 실행 터미널 & 수렴 곡선 차트**:
  - `[▶ EXECUTE OPTAPLANNER ENGINE]` 클릭 시 `Problem Fact Load` → `Construction Heuristic (FIRST_FIT)` → `Tabu Search (Hard→0)` → `Late Acceptance (Soft 수렴)` 단계별 애니메이션, 초당 탐색 Move 속도, 실시간 수렴 곡선 및 로그 스트림을 시뮬레이션합니다.

### 4. MODULE 04 // Hard/Soft 제약 검증 & 5종 텔레메트리 차트 (`#mod-analytics`)
- **원클릭 스케줄 비교 전환**:
  - `[🟢 최적화 완료안 (Feasible)]` / `[🟡 초기 배정안 (Initial)]` / `[🔴 Hard 위반 시뮬레이션 (4건 위반)]`을 원클릭으로 전환하며 전후 결과를 즉시 비교하고 `[🔧 솔버 자동 교정]`으로 위반을 즉시 복구할 수 있습니다.
- **6대 핵심 Hard Constraints LED 검증 보드**:
  1. `1일 10구단 5경기 편성 (구단 중복 금지)`
  2. `구장 중복 배정 금지 (잠실 두산·LG 공동구장 분리)`
  3. `시리즈 연전 수(2·3·4연전) 슬롯 일치`
  4. `개막전·어린이날 의무 홈구장 및 휴식일·올스타브레이크 준수`
  5. `연속 홈/원정 시리즈 제한 (최대 3연속 시리즈)`
  6. `동일 구단 간 연속 시리즈 맞대결 금지 (Hard 1)`
- **10개 구단 Soft Constraints 비교 매트릭스 (컬럼 정렬 지원)**:
  - 구단별 총 이동 횟수, 주중(화→금) 이동 횟수, 주말(금→화) 이동 횟수, 총 이동거리(`km`), 평균 대비 편차(`±300km IN-BAND` 여부), 주말/공휴일 홈경기 수, 휴일 점수, 최대 연속 홈/원정 시리즈 수, 초기안 대비 이동거리 증감(`Δ km`)을 한눈에 비교합니다.
- **5종 고밀도 자체 렌더링 텔레메트리 차트 (HTML5 Canvas)**:
  1. **Chart 01**: 구단별 총 이동거리 편차 & `±300km` Tolerance Zone 차트 (초기 배정안 고스트 바 vs 현재 플랜 오버레이 비교)
  2. **Chart 02**: 구단별 이동 일수(횟수) & 이동 거리 분해 차트 (주중 무휴식 이동 vs 주말 휴식포함 이동 Stacked Bar)
  3. **Chart 03**: 주말·공휴일 홈경기 수 & 휴일 흥행 점수(Holiday Score) 공정성 차트
  4. **Chart 04**: 구단별 5축 스케줄 밸런스 스파이더 레이더 차트 (Multi-Team Radar Overlay + 초기안 점선 비교)
  5. **Chart 05**: 10구단 × 45시리즈 홈/원정/이동강도 시즌 히트맵 매트릭스 & **구단별 전국 이동 궤적 GIS 리플레이어** (`S01 개막전 ~ S45 최종전` 단계별 재생 및 경로 추적)
