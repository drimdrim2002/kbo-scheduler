# KBO 프로야구 일정 수립 솔버 웹 서비스 구현 계획서 (Implementation Plan)

본 문서는 [KBO_SCHEDULER_WEB_DESIGN.md](file:///Users/brown/workspace/optaplanner-practice/KBO_SCHEDULER_WEB_DESIGN.md) 설계서를 바탕으로, 기존 OptaPlanner 기반 KBO 일정 최적화 솔버(`2025-new` 브랜치)를 단일 서버 기반 웹 애플리케이션으로 전환하기 위한 단계별 상세 구현 계획서입니다.

---

## 1. 구현 범위 및 아키텍처 개요

### 1.1 핵심 목표
* **Zero 외부 인프라**: 별도 DB나 Node.js 프론트엔드 빌드 파이프라인 없이, JDK 내장 `HttpServer`와 기존 Maven 의존성(`optaplanner-core`, `json-simple`, `apache-poi`)만으로 즉시 구동 가능한 웹 서버 구축
* **기존 코드 정합성 보완 및 동적 제약화**:
  * [`BaseballSolution.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/BaseballSolution.java)의 `@PlanningScore` Soft 레벨 크기 불일치(`4` → `5`) 수정
  * [`Constants.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/Constants.java)의 정적 상수들을 [`SolverConfigParams`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/SolverConfigParams.java) 도메인 설정 객체로 분리하여 런타임 동적 변경 지원
  * 특정 일자 구장(구단) 홈경기 불가 제약(`UnavailableHomeSlot`) 신규 도입
  * 미배정(`calendar == null` 또는 Dummy Calendar `9999L`) 시리즈 발생 시 스코어 계산기 및 분석/엑셀 모듈의 Null-safety 보장
* **3-Tab SPA 웹 UI**:
  * 상단 글로벌 솔버 컨트롤 바 + **탭 1(기초 데이터 & 제약 설정)** + **탭 2(일정 보드 & Pinning/수동 편집)** + **탭 3(스코어 위반 & 구단별 유불리 분석)**

### 1.2 디렉토리 및 파일 구성 계획

```text
src/main/java/org/optaplanner/examples/baseball/
├── domain/
│   ├── BaseballSolution.java          [수정] bendableSoftLevelsSize=5, teamList 및 configParams 필드 추가
│   ├── Team.java                      [수정] latitude, longitude 필드 추가 (JSON 입출력 호환)
│   ├── Match.java                     [수정] 선택적 제2구장/특정구장 지정(stadiumOverride) 필드 추가 및 기존 @PlanningPin 활용
│   ├── Calendar.java                  [유지] 시리즈 슬롯 도메인
│   ├── Constants.java                 [유지] 기본 프리셋 상수값 참조용으로 유지
│   └── SolverConfigParams.java        [신규] 동적 제약 파라미터 및 홈 불가 제약(UnavailableHomeSlot) 모델
├── score/
│   └── BaseballEasyScoreCalculator.java [수정] SolverConfigParams 기반 동적 스코어 계산 및 Null-safe 처리
├── app/
│   └── BaseballApp.java               [유지] 기존 CLI 실행 하위 호환성 유지
└── web/
    ├── BaseballWebApp.java            [신규] 내장 HttpServer 구동 및 REST API 라우팅 엔트리포인트
    ├── BaseballStateService.java      [신규] In-Memory Solution 상태 관리, JSON 입출력, 매치 수동 편집/Pinning, 설정 변경
    ├── BaseballSolverManager.java     [신규] 비동기 솔버 실행/중지(terminateEarly), 실시간 BestSolution 이벤트 리스너
    ├── BaseballAnalyticsService.java  [신규] 슬롯별/매치별 Hard 위반 상세 진단 및 구단별 거리/휴일/이동경로 통계 산출
    └── BaseballExcelExporter.java     [신규] 4개 시트(.xlsx) 인메모리 스트림 생성기 (BaseballApp 엑셀 로직 모듈화)

src/main/resources/org/optaplanner/examples/baseball/
├── solver/
│   └── baseballSolverConfig.xml       [유지] 기본 솔버 XML 설정
└── web/
    └── index.html                     [신규] Vue 3 + Tailwind CSS 기반 단일 페이지 웹 애플리케이션(SPA)
```

---

## 2. Phase별 상세 구현 계획

### Phase 1: 도메인 모델 확장 및 스코어 계산기 개선

#### 1.1 [`SolverConfigParams.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/SolverConfigParams.java) 신규 작성
기존 [`Constants.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/Constants.java)의 하드코딩된 제약값과 솔버 종료 옵션을 담는 설정 클래스를 정의합니다.

* **주요 필드 및 기본값**:
  * `String matchStartDate = "2025-03-22"` (개막일)
  * `String childrenDayStart = "2025-05-05"` (어린이날 시리즈 기준일)
  * `String allStarBreakDate = "2025-07-02"` (올스타 브레이크 기준일)
  * `Set<String> childrenDayHomeTeams = new LinkedHashSet<>(Arrays.asList("두산", "키움", "한화", "NC", "롯데"))` (어린이날 홈 의무 구단)
  * `List<UnavailableHomeSlot> unavailableHomeSlots = new ArrayList<>()` (특정 일자 구단 홈경기 불가 제약 목록)
    * 내부 정적 클래스 `UnavailableHomeSlot`: `String datetime` (예: `"2025-05-16"`), `String teamName` (예: `"두산"`), `String reason` (예: `"잠실 콘서트 대관"`)
  * `double toleranceTotalDistance = 300.0` (총 이동거리 평준화 허용 오차)
  * `double toleranceHoliday = 1.5` (휴일 점수 평준화 허용 오차)
  * `double toleranceWeekdayMove = 1.5` (주중 이동 횟수 허용 오차)
  * `double toleranceTotalMove = 2.0` (총 이동 횟수 평준화 허용 오차)
  * `int maxConsecutiveHomeAway = 3` (최대 연속 홈/원정 시리즈 수, 초과 시 Hard 페널티)
  * **솔버 종료(Termination) 파라미터**:
    * `long secondsSpentLimit = 600L` (최대 실행 시간, 기본 600초 = 10분)
    * `long unimprovedSecondsSpentLimit = 300L` (개선 없을 시 종료 시간, 기본 300초)
    * `int stepCountLimit = 10000` (LocalSearch 최대 Step 수)
    * `int unimprovedStepCountLimit = 300` (LocalSearch 개선 없는 최대 Step 수)
* **헬퍼 메서드**:
  * `copy()`: OptaPlanner BestSolution 클로닝 및 스레드 안전성을 위한 깊은 복사 메서드
  * `isHomeUnavailable(LocalDateTime slotDateTime, String teamName)`: 날짜(`yyyy-MM-dd` 접두사 또는 전체 문자열)와 홈 구단명이 불가 목록에 해당하는지 판별

#### 1.2 [`Team.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/Team.java), [`Match.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/Match.java) 및 [`BaseballSolution.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/BaseballSolution.java) 수정
* **[`Team.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/Team.java)**:
  * `private double latitude;`, `private double longitude;` 필드 및 Getter/Setter 추가 ([`input_2025.json`](file:///Users/brown/workspace/optaplanner-practice/data/baseball/input_2025.json#L3698-L3769)의 위도/경도 데이터 보존 및 웹 UI 편집/JSON 내보내기 완벽 호환)
* **[`Match.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/Match.java)**:
  * 선택적 구장 지정 필드 `private String stadiumOverride;` 및 헬퍼 메서드 `getEffectiveStadium()` (`stadiumOverride`가 지정되어 있으면 해당 구장명 반환, 없으면 `home.getStadium()` 반환) 추가 — 특정 시리즈를 제2구장이나 특정 구장으로 지정하는 케이스 지원
* **[`BaseballSolution.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/domain/BaseballSolution.java)**:
  * `@PlanningScore(bendableHardLevelsSize = 2, bendableSoftLevelsSize = 5)`로 수정하여 [`BaseballEasyScoreCalculator.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/score/BaseballEasyScoreCalculator.java#L217-L219)의 5단계 Soft Score 반환값과 정합성 확보
  * `@ProblemFactCollectionProperty private List<Team> teamList;` 추가
  * `@ProblemFactProperty private SolverConfigParams configParams;` 추가 (null일 경우 기본 `new SolverConfigParams()` 반환)

#### 1.3 [`BaseballEasyScoreCalculator.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/score/BaseballEasyScoreCalculator.java) 리팩토링
* `baseballSolution.getConfigParams()`를 조회하여 동적 파라미터 적용 (설정이 없으면 `new SolverConfigParams()` 기본값 사용):
  1. **미배정/더미 슬롯(`9999L`) 완전 분리 및 Null-safety 보장**:
     * `for (Calendar calendar : calendarSet)` 루프 시작 시 `if (calendar == null || Long.valueOf(9999L).equals(calendar.getId())) continue;`를 명시적으로 수행하여, 미배정 매치가 모여 있는 더미 슬롯(`2100-12-31`)에 일반 날짜 슬롯의 Hard 제약(`10개 팀/5개 구장/5경기`)이 잘못 부과되거나 `visitOrderByTeam`(이동거리 계산)에 2100년 날짜가 섞여 스코어가 왜곡되는 기존 버그를 원천 차단
     * 미배정(`calendar == null` 또는 `id == 9999L`) 매치에 대해서는 하단 루프에서 `minimizeShortScore -= 1`만 부과
  2. **어린이날 의무 홈 구단 체크**:
     * `calendar.getStartTime().toLocalDate().toString().equals(config.getChildrenDayStart())`이고 `config.getChildrenDayHomeTeams().contains(awayTeam)`이면 `duplicationHardScore -= 1`
  3. **특정 일자 구단 홈경기 불가 제약 체크 (신규)**:
     * `config.isHomeUnavailable(calendar.getStartTime(), homeTeam)`이면 `duplicationHardScore -= 1`
  4. **구장 중복 체크 시 `getEffectiveStadium()` 반영**:
     * `stadiumDuplicationCheck.add(match.getEffectiveStadium());`을 사용하여 제2구장/특정구장 지정 시에도 구장 중복 여부를 정확히 판별
  5. **연속 홈/원정 시리즈 제한 체크**:
     * `if (consecutive > config.getMaxConsecutiveHomeAway()) { duplicationHardScore -= 1; }`
  6. **올스타 브레이크 및 평준화 Tolerance 반영**:
     * `isAllStarBreak(prevDate, config.getAllStarBreakDate())`로 동적 판별
     * `config.getToleranceTotalDistance()`, `config.getToleranceHoliday()`, `config.getToleranceWeekdayMove()`, `config.getToleranceTotalMove()` 적용

---

### Phase 2: 백엔드 핵심 서비스 및 내장 웹 서버 구현 (`org.optaplanner.examples.baseball.web`)

#### 2.1 [`BaseballAnalyticsService.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/web/BaseballAnalyticsService.java) (실시간 위반 진단 & 구단별 유불리 통계)
웹 UI의 탭 2(일정 보드 경고 표시)와 탭 3(스코어 & 유불리 분석 대시보드)에 필요한 데이터를 계산합니다.

* **제약 위반 상세 리포트 (`analyzeViolations(BaseballSolution solution)`)**:
  * **슬롯별 위반 목록 (`slotViolations`)**: 각 `calendarId`별로 발생한 위반 사유 리스트 반환 (더미 슬롯 `9999L`은 제외하되 미배정 건수는 별도 집계)
    * `TEAM_COUNT_MISMATCH`: 배정된 고유 구단 수가 10개가 아님 (중복 배정 구단명 명시)
    * `STADIUM_DUPLICATION`: 동일 구장(예: 잠실종합운동장 두산·LG 동시 홈) 중복 배정
    * `MATCH_COUNT_MISMATCH`: 슬롯에 배정된 경기 수가 5경기가 아님
    * `CONSECUTIVE_MISMATCH`: 슬롯 연전 수(`calendar.consecutive`)와 매치 연전 수(`match.consecutive`) 불일치
    * `CHILDREN_DAY_AWAY`: 어린이날 홈 의무 구단이 원정으로 배정됨
    * `HOME_UNAVAILABLE`: 특정 일자 홈 불가 구단(`UnavailableHomeSlot`)이 홈 경기로 배정됨
    * `SUCCESSIVE_MATCHUP`: 직전 슬롯과 동일한 두 구단 간 맞대결 연속 편성 (`Hard 1`)
  * **구단별 연속 홈/원정 위반 목록 (`consecutiveHomeAwayViolations`)**:
    * 특정 구단이 `maxConsecutiveHomeAway`(기본 3) 시리즈를 초과하여 연속 홈 또는 원정 경기를 치르는 구간(날짜 범위, 연속 횟수) 반환
  * **매치별 위반 맵 (`matchViolations`)**: 각 `matchId`별 위반 태그 리스트를 반환하여 UI 카드에 빨간색 테두리 및 툴팁 즉시 표시
* **구단별 유불리 지표 & 이동 경로 분석 (`analyzeTeamStats(BaseballSolution solution)`)**:
  * 구단별 요약 지표 (`TeamStatDto`):
    * `teamName`, `stadium`, `totalDistance`(총 이동거리 km), `distanceDiffFromMean`(평균 대비 거리 편차), `totalMoveCount`(총 이동 횟수), `weekdayMoveCount`(주중 이동 횟수), `weekdayDistance`(주중 이동 거리 km), `holidayScore`(휴일 점수 총합), `weekendHomeGames`(주말 홈경기 수), `holidayHomeGames`(공휴일 홈경기 수), `childrenDayHome`(어린이날 홈 여부), `maxHomeStreak`(최대 연속 홈 시리즈), `maxAwayStreak`(최대 연속 원정 시리즈)
  * 구단별 이동 경로 상세 (`teamRoutes`: `Map<String, List<RouteStepDto>>`):
    * 각 구단의 시즌 개막~종료 시리즈 순회: `matchId`, `date`, `dayOfWeek`, `isHome`, `opponent`, `fromStadium`, `toStadium`, `path`(`잠실-->문학`), `distance`, `cumulativeDistance`, `moveType`(`주중 이동` / `주말 이동` / `올스타 브레이크`), `consecutiveStreak`(`홈 2연속` 등)

#### 2.2 [`BaseballExcelExporter.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/web/BaseballExcelExporter.java) (엑셀 생성 모듈)
* 기존 [`BaseballApp.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/app/BaseballApp.java#L109-L473)의 `createWorkBook` 로직을 재사용·개선하여 `byte[] exportToExcelBytes(BaseballSolution solution)` 제공
* 4개 시트(`schedule`, `distanceAnalysis`, `holidayAnalysis`, `holidayDetails`) 생성 시 미배정(`calendar == null` 또는 `id == 9999L`) 매치를 안전하게 필터링하고, 동적 `childrenDayStart` 및 `match.getEffectiveStadium()` 설정을 반영

#### 2.3 [`BaseballStateService.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/web/BaseballStateService.java) (스레드 안전 상태 관리 및 JSON 입출력)
* **동시성(Thread-safety) 보장**:
  * 솔버 스레드가 `BestSolutionChangedEvent`로 Solution을 갱신하는 동안 웹 요청 스레드(`GET /api/state`)가 동시에 읽더라도 데이터 레이스가 발생하지 않도록 `synchronized` 락 및 깊은 복사 스냅샷(`deepCloneSolution(BaseballSolution)`) 구조를 적용
  * 솔버 시작 시에는 현재 메모리의 `BaseballSolution`을 복제한 독립적인 작업 복사본(`workingSolution`)을 솔버에 전달하고, `event.getNewBestSolution()`(OptaPlanner가 클론한 불변 스냅샷)이 도착할 때마다 참조를 원자적으로 교체
* **초기 로드 및 리셋 (`resetToDefault()`)**:
  * [`data/baseball/input_2025.json`](file:///Users/brown/workspace/optaplanner-practice/data/baseball/input_2025.json)을 파싱하여 `Team`, `Calendar`(마지막에 `9999L` 더미 캘린더 포함), `Match`, `initialPlan` 배정, 기본 `SolverConfigParams`를 생성하고 초기 스코어를 계산
  * 개막일(`matchStartDate`)에 배정된 매치는 기본 `pinned = true` 설정
* **JSON 가져오기 (`importFromJson(String jsonString)`)**:
  * 업로드된 JSON 문자열을 파싱하여 새로운 `BaseballSolution`으로 교체 (기존 `input_2025.json` 포맷 + 선택적 `configParams`, 매치별 `pinned` 및 `stadiumOverride` 필드까지 호환 지원)
* **JSON 내보내기 (`exportToJson()`)**:
  * 현재 메모리의 `teams`(위도/경도 포함), `distanceMatrix`, `calendar`(더미 `9999L` 제외), `matches`(`stadiumOverride` 포함), 그리고 현재 배정된 일정 상태를 담은 `initialPlan`(각 매치의 현재 배정된 `datetime`, `home`, `away`, `consecutive`, `weekend`, `holiday`, `pinned`, `stadiumOverride`) 및 `configParams`를 [`input_2025.json`](file:///Users/brown/workspace/optaplanner-practice/data/baseball/input_2025.json) 호환 JSON 포맷으로 직렬화
* **기초 데이터 & 제약 설정 업데이트 (`updateConfig(JSONObject payload)`)**:
  * 구단 정보(구단명, 구장명, 위도, 경도), 10×10 구단 간 거리 행렬(`distanceMatrix`), 캘린더 슬롯 목록(수정/추가/삭제 시 `prev`/`next` 체인 재연결), 시리즈(`matches`: 홈/원정/연전 수/구장 지정 수정·추가·삭제), `SolverConfigParams` 업데이트 후 즉시 스코어 재계산
* **수동 일정 편집 및 Pinning (`updateMatch(JSONObject payload)`)**:
  * 지원하는 액션(`action` 파라미터):
    1. `MOVE`: 특정 `matchId`의 `calendarId`를 대상 슬롯(또는 미배정 `9999L`)으로 변경
    2. `SWAP`: 두 매치(`matchId1`, `matchId2`)의 배정된 `Calendar`를 맞교환
    3. `PIN`: 특정 `matchId`의 `pinned` 상태 토글/지정
    4. `STADIUM`: 특정 `matchId`의 `stadiumOverride`(제2구장/특정구장) 변경
    5. `BULK_PIN`: 일괄 고정 액션 (`PIN_OPENING_DAY` 개막전 전체 고정, `PIN_CHILDREN_DAY` 어린이날 전체 고정, `PIN_ALL` 전체 고정, `UNPIN_ALL` 전체 고정 해제, `PIN_DATE` 특정 날짜 슬롯 전체 고정/해제)
  * 모든 변경 직후 `BaseballEasyScoreCalculator`를 호출하여 최신 `BendableLongScore` 갱신

#### 2.4 [`BaseballSolverManager.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/web/BaseballSolverManager.java) (비동기 솔버 실행기)
* **상태 관리**:
  * `enum SolverStatus { IDLE, SOLVING, STOPPED }`
  * `ExecutorService solverExecutor = Executors.newSingleThreadExecutor()`
  * `volatile Solver<BaseballSolution> activeSolver`
  * 실행 메타데이터: `startTimeMillis`, `elapsedMillis`, `bestScoreUpdateCount`, `lastUpdatedMillis`, `scoreHistory`(시간별 스코어 변화 로그 리스트)
* **솔버 실행 (`startSolver()`)**:
  * 현재 `SOLVING` 중이면 중복 실행 방지 예외 반환
  * `SolverConfig.createFromXmlResource("org/optaplanner/examples/baseball/solver/baseballSolverConfig.xml")` 로드 후 종료 조건(Termination) 오버라이드 주의사항 반영:
    * 기존 XML의 `<minutesSpentLimit>10</minutesSpentLimit>`이 남아 합산(`10분 + N초`)되지 않도록, 글로벌 `TerminationConfig`를 **새 인스턴스(`new TerminationConfig()`)로 생성하여 교체**하고 `secondsSpentLimit` 및 `unimprovedSecondsSpentLimit`만 깔끔하게 설정
    * 내부 `LocalSearchPhaseConfig`의 `TerminationConfig` 역시 새 인스턴스로 교체하여 `stepCountLimit` 및 `unimprovedStepCountLimit`을 주입
  * `solver.addEventListener(event -> ...)`를 등록하여 새로운 Best Solution이 발견될 때마다 `BaseballStateService`의 현재 Solution 참조를 원자적으로 교체하고 `bestScoreUpdateCount` 증가
  * 백그라운드 스레드에서 `BaseballStateService.createWorkingCopy()`로 복제한 Solution에 대해 `solver.solve(workingCopy)` 실행, 종료 시 최종 Solution을 반영하고 상태를 `STOPPED`로 전환
* **솔버 조기 종료 (`stopSolver()`)**:
  * `activeSolver != null && activeSolver.isSolving()`일 때 `activeSolver.terminateEarly()` 호출

#### 2.5 [`BaseballWebApp.java`](file:///Users/brown/workspace/optaplanner-practice/src/main/java/org/optaplanner/examples/baseball/web/BaseballWebApp.java) (JDK 내장 HTTP 서버 및 REST API)
* `com.sun.net.httpserver.HttpServer`를 사용하여 포트 `8080`(기본값, `-Dport` 또는 첫 번째 인자로 변경 가능)에서 구동
* **정적 리소스 서빙**:
  * `GET /` 또는 `GET /index.html`: 클래스패스(`org/optaplanner/examples/baseball/web/index.html`)에서 HTML 응답 (`Content-Type: text/html; charset=UTF-8`)
* **REST API 핸들러 매핑** (설계서 5장 명세 100% 준수):
  * `GET /api/state`: 전체 상태(구단, 거리행렬, 캘린더, 매치 배정, 제약 설정, 솔버 상태/경과시간/업데이트횟수, Hard/Soft 스코어 배열, 슬롯/매치별 위반 리포트, 구단별 유불리 통계 및 이동 경로) JSON 반환
  * `POST /api/reset`: `input_2025.json` 기본 프리셋으로 초기화 후 상태 반환
  * `POST /api/import`: 업로드된 JSON 본문으로 Solution 재구성 후 상태 반환
  * `GET /api/export/json`: `Content-Disposition: attachment; filename="kbo_schedule_2025.json"` 다운로드
  * `GET /api/export/excel`: `Content-Disposition: attachment; filename="kbo_schedule_2025.xlsx"` 다운로드
  * `POST /api/config`: 구단/거리/캘린더/시리즈(matches)/동적 제약 업데이트 후 갱신된 상태 반환 (솔버 실행 중일 때는 수정 차단 메시지 반환)
  * `POST /api/match/update`: 매치 날짜 이동/스왑/구장 지정/Pinning(단건 및 일괄) 처리 후 갱신된 상태 반환
  * `POST /api/solver/start`: 비동기 솔버 시작 후 상태 반환
  * `POST /api/solver/stop`: 솔버 `terminateEarly()` 호출 후 상태 반환

---

### Phase 3: 프론트엔드 웹 UI 구현 (`src/main/resources/org/optaplanner/examples/baseball/web/index.html`)

별도 빌드 도구 없이 CDN(`Vue 3 Global Build`, `Tailwind CSS`, `Lucide Icons` 또는 SVG 아이콘)을 활용한 반응형 Single Page Application으로 구현합니다.

#### 3.1 상단 글로벌 컨트롤 바 (Sticky Header)
* **솔버 상태 인디케이터**:
  * `IDLE`(회색 배지), `SOLVING`(파란색 펄스 애니메이션 배지 + 경과 시간 타이머 + Best 갱신 횟수), `STOPPED`(초록색 완료 배지)
* **실시간 스코어 보드**:
  * **Hard Score**: `[H0(중복/규칙), H1(연속매치업)]` — `0/0`이면 초록색 `FEASIBLE` 배지, 음수이면 빨간색 경고 배지
  * **Soft Score**: `S0(미배정)`, `S1(이동횟수편차)`, `S2(거리편차)`, `S3(휴일편차)`, `S4(총이동거리)` 각각의 수치를 직관적인 라벨과 함께 표시
* **글로벌 액션 툴바**:
  * `▶ 솔버 실행` (실행 중에는 `⏹ 조기 종료` 버튼으로 전환, 1초 주기 `/api/state` 자동 폴링)
  * `📂 JSON 불러오기` (파일 선택 모달/업로드), `💾 JSON 저장`, `📊 엑셀(.xlsx) 다운로드`, `🔄 2025 기본값 초기화`

#### 3.2 탭 1: 기초 데이터 & 제약 조건 설정 (Input & Constraints)
* **섹션 A — 특별 제약 & 솔버 옵션 카드**:
  * 시즌 주요 일자 입력 (`개막일`, `어린이날 시리즈 기준일`, `올스타 브레이크 기준일`)
  * 어린이날 홈경기 의무 구단 10개 구단 멀티 체크박스 토글
  * 평준화 Tolerance(`총 거리`, `휴일 점수`, `주중 이동`, `총 이동 횟수`) 및 `최대 연속 홈/원정 시리즈 제한(기본 3)` 숫자 입력
  * 솔버 Termination 설정 (`최대 실행 시간(초)`, `개선 없을 시 종료 시간(초)`, `LocalSearch 최대 Step 수`, `개선 없는 Step 수`)
  * **특정 일자 구단 홈경기 불가 제약 관리**:
    * `날짜 슬롯 드롭다운` + `구단 선택 드롭다운` + `사유 입력(예: 콘서트 대관)` + `+ 추가` 버튼 및 등록된 제약 태그/삭제 리스트
* **섹션 B — 구단 정보 & 10×10 이동거리 매트릭스**:
  * 10개 구단 테이블 (구단명, 홈구장명, 위도/경도 편집, 잠실 등 동일 구장 공유 구단 배지 표시)
  * 10×10 구단 간 이동거리(`distanceMatrix`) 인터랙티브 그리드 (셀 수치 직접 수정 및 대칭 동시 반영 옵션 제공)
* **섹션 C — 시즌 캘린더 슬롯 (`Calendar`) 및 시리즈(`Matches`) 편집기**:
  * **캘린더 슬롯 테이블**: 전체 시리즈 날짜 슬롯(`슬롯 ID`, `시리즈 시작일시`, `요일`, `연전 수(2/3/4)`, `주말 가중치`, `휴일 가중치`, `삭제`) 및 신규 슬롯 추가 기능 (상단에 슬롯별 연전 수 합계 요약 표시)
  * **시리즈(`Matches`) 구성 테이블**: 전체 시리즈 목록 필터/조회 및 편집 (`매치 ID`, `홈 구단`, `원정 구단`, `연전 수(consecutive)`, `구장 지정(기본 홈구장 또는 제2구장 직접 입력)`, `추가/삭제`) — 캘린더 슬롯의 연전 수 분포(2연전/3연전/4연전 개수)와 시리즈의 연전 수 분포가 일치하는지 실시간 정합성 체크 배지 제공
* 하단/상단 `💾 설정 적용 및 스코어 재계산` 버튼으로 `/api/config` 호출

#### 3.3 탭 2: 일정 대시보드 & 수동 편집 / Pinning (Schedule & Pinning)
* **서브 뷰 전환 및 필터 바**:
  * **뷰 모드 전환**: `📅 시리즈 캘린더 카드 뷰` ↔ `📊 구단별 타임라인 매트릭스 뷰`
  * **필터 & 검색**: 월별 필터(`전체`, `3월`, `4월`, ..., `8월`, `미배정`), 특정 구단 하이라이트/필터, `위반 발생 슬롯만 보기` 토글
  * **일괄 고정(Bulk Pin) 버튼 그룹**: `🔒 개막전 전체 고정`, `🔒 어린이날 전체 고정`, `🔒 전체 고정`, `🔓 전체 고정 해제`
* **뷰 1 — 시리즈 캘린더 카드 뷰**:
  * 날짜 슬롯별 카드 그리드: 헤더에 날짜/요일, 연전 수(`2연전`/`3연전`/`4연전`), 주말/공휴일/어린이날 배지, 슬롯 내 전체 고정 버튼 표시
  * 슬롯에 Hard 제약 위반이 있을 경우 카드 테두리를 빨간색으로 강조하고 상단에 구체적인 위반 사유 배너(예: `⚠️ 잠실구장 중복 배정`, `⚠️ 두산 홈 불가일 위반`) 표시
  * 슬롯 내부 5개 매치 행(`원정 vs 홈 @구장`):
    * 구단별 고유 컬러 배지 및 구장명(`stadiumOverride` 지정 시 별도 강조 배지) 적용
    * 🔒/🔓 핀 아이콘 클릭 시 즉시 `/api/match/update` (`PIN`) 호출
    * 매치 클릭 시 **이동/스왑/구장변경 액션 패널(모달)**: 다른 날짜 슬롯으로 이동(`MOVE`), 미배정 풀로 이동, 다른 매치와 날짜 맞바꾸기(`SWAP`), 또는 해당 시리즈 개최 구장(`stadiumOverride`) 변경 수행
* **뷰 2 — 구단별 타임라인 매트릭스 뷰**:
  * 세로축(10개 구단) × 가로축(시즌 전체 날짜 슬롯) 테이블
  * 각 셀에 홈(`홈 vs 상대`, 파란색 계열) / 원정(`@상대`, 회색/주황 계열) 표시, 고정된 경기는 🔒 아이콘 표시, 연속 4시리즈 이상 홈/원정 위반 구간은 빨간색 하이라이트 표시
* **미배정 시리즈 풀 (Unassigned Pool)**:
  * `calendar == null` 또는 `9999L`(더미 슬롯)에 있는 매치들을 별도 드로어/패널에 표시하여 원하는 날짜 슬롯에 즉시 배정 가능

#### 3.4 탭 3: 스코어 & 구단별 유불리 분석 (Analytics)
* **섹션 A — 제약 조건 위반 상세 리포트**:
  * Hard 0 / Hard 1 위반 총 건수 요약 카드 및 발생 슬롯/구단/상세 사유 테이블 (클릭 시 탭 2의 해당 날짜 슬롯으로 포커스 이동 지원)
* **섹션 B — 구단별 유불리 비교 테이블 & 시각화 바 차트**:
  * 10개 구단 비교 표 및 가로 바 차트:
    * 구단별 **총 이동거리(km)** 및 평균 대비 편차(`+ / - km`, Tolerance 범위 초과 여부 색상 표시)
    * 구단별 **총 이동 횟수** 및 **주중(화→금) 이동 횟수 / 주중 이동거리**
    * 구단별 **휴일 점수 총합**, **주말 홈경기 수**, **공휴일 홈경기 수**, **어린이날 홈 여부(O/X)**, **최대 연속 홈/원정 시리즈 수**
* **섹션 C — 구단별 시즌 이동 경로 상세 조회 (`distanceAnalysis`)**:
  * 구단 선택 탭/드롭다운(SSG, 두산, LG, KT, 키움, 한화, 삼성, KIA, NC, 롯데)
  * 선택한 구단의 개막전부터 최종전까지 시리즈별 이동 경로 테이블 (`시리즈 날짜`, `요일`, `홈/원정`, `상대 구단`, `이동 경로(이전구장 → 현재구장)`, `구간 이동거리(km)`, `누적 이동거리(km)`, `이동 구분(주중/주말/올스타)`)

---

## 3. 검증 및 테스트 계획 (Verification Plan)

1. **컴파일 및 단위/통합 검증**:
   * `mvn test-compile`을 실행하여 도메인 모델, 스코어 계산기, 웹 서버 및 엑셀/JSON 서비스의 컴파일 에러 및 타입 정합성 검증
2. **웹 서버 기동 및 API 엔드포인트 테스트**:
   * `BaseballWebApp` 서버 기동 후 `curl` 스크립트로 다음 시나리오 검증:
     * `GET /api/state`: [`input_2025.json`](file:///Users/brown/workspace/optaplanner-practice/data/baseball/input_2025.json) 프리셋 자동 로드 여부, 초기 스코어(`[0/0]hard/...`) 및 10개 구단 통계 정상 반환 확인
     * `POST /api/config`: 특정 일자 홈 불가 구단 추가 시 해당 슬롯에 홈 배정된 구단의 Hard Score가 즉시 차감되고 `slotViolations`에 `HOME_UNAVAILABLE`이 감지되는지 확인
     * `POST /api/match/update`: 매치 Pin 토글 및 두 매치 간 날짜 `SWAP` 시 스코어 재계산 동작 확인
     * `POST /api/solver/start` & `POST /api/solver/stop`: 백그라운드 솔버 실행 중 상태가 `SOLVING`으로 전환되고 조기 종료 요청 시 `STOPPED`로 정상 종료되는지 확인
     * `GET /api/export/excel` & `GET /api/export/json`: 다운로드된 `.xlsx` 파일(4개 시트) 및 `.json` 파일 유효성 확인
     * `POST /api/reset`: 초기 2025 프리셋 상태로 복원 확인
