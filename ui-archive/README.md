# UI 시안 보관소

메인 템플릿은 `../ui/`다. 이 폴더에는 그 확정본을 고르기까지 만든 시안을 모아 두었다. 보관용이라 더는 고치지 않는다.

- 각 시안은 원래 브랜치의 마지막 커밋을 **파일만** 복사했다. 커밋 이력은 원래 브랜치에 그대로 남아 있다.
- 스크린샷(`shots/`)은 넣지 않았다. 필요하면 해당 폴더의 `tools/studio/shot.sh`로 다시 찍는다. 그래서 `wizard-ui/index.html` 갤러리의 스크린샷 비교 화면은 비어 있다. "직접 써 보기" 탭과 각 시안의 `index.html`은 그대로 동작한다.
- 모두 `file://`로 바로 열린다. 서버도, 설치할 것도 없다.

| 폴더 | 원래 위치 (브랜치 @ 커밋) | 내용 |
| :--- | :--- | :--- |
| `wizard-ui/std` | `wizard-ui/std` @ 87006ee | 확정 템플릿의 표준. alt-a 골격에 단계별 차용·일반 용어·개발자 모드를 넣었다. |
| `wizard-ui/opt-1` | `wizard-ui/opt-1` @ b6b84bc | 옵션 1 입력 분할형. ① 데이터 준비를 표 ↔ 큰 시각화로 좌우 분할했다. **채택하지 않음** |
| `wizard-ui/opt-2` | `wizard-ui/opt-2` @ fd83b65 | 옵션 2 지표 대시보드형. ④ 지표 대시보드와 ② 큰 선택 카드다. **채택해 `ui/`에 합침** |
| `wizard-ui/opt-3` | `wizard-ui/opt-3` @ 1309074 | 옵션 3 경로 극장형. 전면 지도와 타임라인으로 여러 구단을 동시 재생한다. **채택하지 않음** |
| `wizard-ui/alt-a` | `wizard-ui/alt-a` @ f2c61f8 | 3차 후보 A 편성 스튜디오. 골격으로 채택했다. |
| `wizard-ui/alt-b` | `wizard-ui/alt-b` @ 1915aa5 | 3차 후보 B. 시즌 띠와 구단쌍 행렬을 표준에 차용했다. |
| `wizard-ui/alt-c` | `wizard-ui/alt-c` @ 78434dc | 3차 후보 C. 지표 차트를 표준에 차용했다. |
| `wizard-ui/alt-d` | `wizard-ui/alt-d` @ 6b9edf8 | 3차 후보 D |
| `wizard-ui/index.html` | (추적하지 않던 파일) | 3차 후보·표준·옵션 비교 갤러리 |
| `opus-ui/alt-1` ~ `alt-4` | `opus-ui/alt-1` @ 0829321, `alt-2` @ 0f1f685, `alt-3` @ e3188c7, `alt-4` @ c7fb1f9 | 2차 opus 후보 4종. alt-1을 내용 기준으로 삼았다. |
| `opus-ui/index.html` | (추적하지 않던 파일) | 2차 opus 후보 비교 페이지 |
| `gemini-ui/` | `feat/kbo-ui-templates`의 `gemini-ui/` (c3c5003) | gemini 후보 4종. candidate-1의 위저드 구성을 참고했다. |
| `opus-layout-design/` | (추적하지 않던 폴더) | 레이아웃 와이어프레임 A~E |
| `opus-layout-design-v2/` | (추적하지 않던 폴더) | 레이아웃 시안 01~07. 06-replay는 이동 경로 재생의 참고 자료다. |
| `input-flow-concepts/` | `claude/input-flow-ux-d531b4` | ① 데이터 준비 **입력 흐름** 컨셉 시안(2026-10-26). `index.html` 비교 페이지: ★추천안 R(사용자 제안 반영 — 입력은 모두 시즌 달력 한 화면: 끌어서 연전 묶음·눌러서 홈 구장·공휴일 가중치 표·엑셀 왕복·따라 하기) → 지금 9단계의 문제 → 이전 추천안 A(5단계, 띠에 역할 표시 · 특별한 날 달력 하나 · 연전 기간 규칙 + 달력에서 고치기 · 시리즈 규칙 확인만) + 대안 B 달력 한 장 · C 질문형 · D 엑셀 중심. 2025 설정으로 그린 정적 HTML, `shots/` 1440×877, `shot.sh`로 다시 찍는다. |
| `step-flow-concepts/` | `claude/season-calendar-960478` | ① 데이터 준비 **단계 흐름** 시안(2026-10-29, 사용자 결정 반영): 맨 먼저 시즌 연도(상단 띠에 크게, 오늘 기준 2년 뒤까지) → ① 안 4단계(1 구단 정보 → 2 시즌 기간·연전 묶음 → 3 공휴일·홈 구장 → 4 확인), 늘 보이는 단계 띠(「지금 여기」·단계마다 상태 한 줄), 다시 왔을 때 「어디까지 했는지」 한 장, 비어 있을 때 따라 하기, 2단계는 연도·개막일만 고르면 나머지 자동. `index.html` 비교 페이지, 화면 8장 `shots/` 1440×877, `shot.sh`. 공통 모양은 `../input-flow-concepts/concept.css`·`concept.js`를 쓴다. |
| `demo-flow-concepts/` | `claude/season-calendar-960478` | **시연 흐름** 시안(2026-10-31, 사용자 결정 반영): 처음 화면에서 「2025 계획 보기(확인용)」/「2027 새 계획 만들기」, 연도는 2025·2027만. 2025는 같은 해 조건으로 KBO 실제 vs 이 엔진 숫자 비교, 2027은 원칙이 모두 채워진 4단계 → 자동 편성 → 결과(걸린 시간·규칙 점검표·숫자) → 조건 바꿔 다시(전후 비교). 숫자는 모두 실제 실행 값. `index.html` 비교 페이지, 화면 7장 `shots/` 1440×877, `shot.sh`. 공통 모양은 `../input-flow-concepts/concept.css`·`../step-flow-concepts/flow.css`. |

경위와 결정 사항은 `../KBO_WIZARD_UI_REQUIREMENTS.md` §12~§13에 있다.
