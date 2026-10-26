# opus-ui 공통 코어 (`core/`)와 화면 공통 부품 (`app/common/`)

4개 대안(alt-1~4)이 공유하는 코드다. 요구사항은 저장소 루트의 `KBO_OPUS_UI_REQUIREMENTS.md`(이하 요구사항)를 따른다. 코어는 `opus-ui/base` 브랜치에서 고치고 각 대안 브랜치에 병합한다.

## 구성

| 파일 | 내용 | 요구사항 |
| :--- | :--- | :--- |
| `preset-2025.js` | `input_2025.json` 원본, 2025 기본 설정(공휴일 가중치·올스타 시작일)·이벤트(개막전·어린이날 모두 홈 구장 지정 5곳), 구장 사전, 구단 색. 프로젝트의 연전 기간 휴일 값은 공휴일 표대로 다시 매긴다(엔진 원본 값은 `ENGINE_INPUT_2025`). `node tools/build-preset.js <input_2025.json>`로 다시 만든다. | FR-S8, FR-E4, FR-T2 |
| `calendar-gen.js` | 날짜 유틸, 슬롯 자동 생성, 시리즈 목록 생성, 내장 공휴일(2025~2028). 공휴일 가중치 합(`slotWeights`·`applyWeights`, 주말 하루 1 · 공휴일 weight 기본 2 · 어린이날 3), 묶음에서 휴식기·휴식일 경기 만들기(`deriveRestDays`), 규칙대로 채우기 설정(`ruleSettings`: 휴식 요일 공휴일 · 올스타 휴식기) | §5.2.1, FR-S6, FR-S7 |
| `xlsx-lite.js` | 바깥 라이브러리 없는 .xlsx 쓰기(압축 없는 zip · 날짜 서식 · 수식)와 읽기(deflate zip · 공유 문자열 · 수식 값). 압축 풀기는 호출하는 쪽이 넘긴다(브라우저 `DecompressionStream`, Node `zlib`) | ① 엑셀 서식 |
| `score.js` | `ScoreFormulas.evaluate` 1:1 포팅, 위반 설명, 구단 지표, Soft 분해 | §6.1, §6.2 |
| `reschedule.js` | 경기 상태, 잔여·취소 집계, 재편성 묶음, RH/RS 채점, 재편성 탐색 | §5.8, §6.3 |
| `mock-solver.js` | Late Acceptance 로컬서치, 완전 매칭 구성 휴리스틱, time-slicing 드라이버, Worker 진입점 | §7.2 |
| `engine-adapter.js` | `MockEngineAdapter`(Blob Worker → 실패 시 메인 스레드), `RestEngineAdapter`(§7.3) | §7.1, FR-R5 |
| `store.js` | 상태, undo/redo(100단계), 스냅샷, localStorage 자동 저장, JSON/CSV 입출력, 필드 단위 검증 | FR-M6, FR-M7, FR-D |
| `svg-chart.js` | 막대·점·선·히트맵·레이더·스파크라인·게이지 (SVG 문자열) | FR-A |
| `svg-map.js` | 내장 남한 SVG 지도, 하버사인 거리 추정, 구장 사전 검색, Kakao 로더 | D4, FR-T2, FR-T3, FR-T6 |

- 코어 파일은 classic script다(`file://`에서 ES 모듈이 막히므로). 모두 `globalThis.KBO`에 붙고 Node에서도 `require`로 읽힌다. DOM에 의존하지 않는다(Kakao 로더만 호출 시 `document`를 인자로 받는다).
- Worker는 코어 팩토리 함수를 문자열로 이어 붙인 Blob으로 만든다. `fetch` 없이 `file://`에서도 동작한다.
- `app/common/`은 DOM을 쓰는 공통 화면 부품이다. 컨트롤러(`app.js`)와 패널(입력·결과·품질·운영), 지도 위젯, `common.css`. 대안은 CSS 변수와 배치로 시각 언어를 바꾼다.

## 채점 정합성

- 구단 인덱스는 JSON 순서, 구장 인덱스는 처음 등장한 구장명 순서다. 거리는 0.1km 정수(HALF_UP)로 계산한다.
- 시리즈 방문 순서는 슬롯 인덱스, 같은 슬롯 안에서는 매치 인덱스 순이다. H1은 캘린더 목록의 직전 슬롯과 비교하고, 직전 슬롯이 비면 0이다.
- H0-e는 두 모드다. **구장 기준**(기본, D3)은 지정 구장마다 연고 구단 중 홈이 없으면 1점이다. **엔진 호환**은 의무 구단(기본 `Constants.HOME_OBLIGATION_CHILDREN`)의 원정 시리즈마다 1점이며 어린이날 유형 이벤트 슬롯에 적용한다. 사용자 정의 구장 지정 이벤트는 엔진 호환 모드에서 지정 구장 연고 구단을 의무 구단으로 본다.

## 테스트

```bash
node core/test/run-tests.js          # 헤드리스 테스트 (AC-1~8, 10, 11 중 DOM 불필요 부분)
```

`core/test/golden/golden-scores.json`은 Java `ScoreFormulas.evaluate`로 미리 채점해 저장한 11개 배정(initialPlan, Mock 결과 4개, 빈 슬롯·null·더미·전부 미배정·라운드로빈·어린이날 LG 홈·무작위)이다. JS 채점기의 엔진 호환 모드 결과가 Hard 2단계·Soft 5단계 모두 일치해야 한다(AC-1).

## REST 계약 (향후 Java 서버, §7.3)

| Method | Endpoint | 요청 | 응답 |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/solve` | `{ problem, options, mode: "INITIAL" \| "RESCHEDULE" }` | `{ jobId }` |
| `GET` | `/api/v1/solve/{jobId}` | - | `{ status, bestPlan, score, elapsedMs, improvementCount }` |
| `GET` | `/api/v1/solve/{jobId}/events` | SSE | `event: best` / `event: done` — `{ plan, score: { hard, soft }, elapsedMs, improvementCount, reason }` |
| `POST` | `/api/v1/solve/{jobId}/stop` | - | `{ status }` |
| `POST` | `/api/v1/score` | `{ problem, plan, mode }` | `{ score, violations, teamMetrics }` |

- `problem`은 §8 프로젝트 JSON이다. `plan`은 INITIAL이면 `[{ match, calendar }]`, RESCHEDULE이면 `[{ unit, start, dh }]`이다.
- 점수 문자열은 OptaPlanner `BendableLongScore` 표기(`[0/0]hard/[0/-400/-573307/-13/-72955]soft`)를 함께 쓴다. RESCHEDULE은 Hard `[RH-1~4, RH-5]`, Soft `[RS-1, RS-2a, RS-2b, RS-3]`이다.
- 일시정지는 계약에 없다. `RestEngineAdapter`는 일시정지 중 받은 해를 보류했다가 재개할 때 반영한다.

## 결정·가정

- 잔여 경기 홈 결정(O-1): 그 구단쌍에서 홈 경기가 적은 쪽(설정으로 많은 쪽 선택 가능). 동률이면 리그 전체 홈 경기가 적은 구단.
- 재편성 Soft 순서(O-3): RS-1 마지막 경기일 → RS-2a 이동 증가분 편차(50km 단계) → RS-2b 증가분 합계 → RS-3 DH·월요일 경기 수.
- 더블헤더(O-4): DH 묶음은 첫날 2경기, 이후 하루 1경기. 요일 제한은 두지 않는다.
- 결과 미입력(FR-P2) 기준일은 설정에서 바꿀 수 있다. 비우면 오늘이다.
- 2025 공휴일 기본값은 §5.2.1 검증 기준(5/5·6/6·8/15)에 9~10월 공휴일을 더한 것이다. 6/3 임시공휴일은 원본 데이터에 반영되지 않아 제외했다.
