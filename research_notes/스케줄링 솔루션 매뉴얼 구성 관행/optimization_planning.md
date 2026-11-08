# 최적화 기반 계획·스케줄링 소프트웨어의 솔루션 소개 자료와 사용자 문서 구성 관행

조사일: 2026-11-07. 공개 문서만 봤다. 근거가 가장 단단한 것은 Timefold(OptaPlanner 후속) 문서다. Quinyx·Infor WFM(인력 스케줄링), IBM Decision Optimization(시나리오 비교), ServiceNow SPW(비교→승인 흐름의 유사 사례)가 보조 근거다. Kinaxis·SAP IBP·UKG·Deputy·Shiftboard·ORTEC·Descartes·OptimoRoute·Gurobi·o9·Blue Yonder는 공식 사용자 안내서 목차를 공개된 곳에서 찾지 못했다. 그 내용은 각 절의 Gaps에 적었다.

## 1. 제품별 솔루션 소개 자료와 사용자 안내서의 구성(장·절 순서)

### Takeaway
공개 근거가 가장 충실한 Timefold는 같은 뼈대를 쓴다. 대상별 소개 → 시작하기(Hello world) → 단계별 레슨 → 사용자 안내(용어·개념·제약·입력·출력·KPI·점수 분석·시각화) → 기능별 안내 → 변화 대응 → 기타(FAQ·변경 이력)이다. 여기에 "업무 목적별 안내(job-oriented guides)"가 따로 붙는다. 소개 자료(브로셔)의 구조는 독립 문서로는 찾지 못했다. 다만 소개 페이지 하나를 독자별 절(개발자 / 아키텍트 / 제품·업무·의사결정자)로 나누는 관행은 확인했다.

### Cited Findings
- **Timefold Platform 문서 사이드바 순서(실제 제목)**: "Basics" 아래에 "Introduction" → "Getting started" → "Scheduling API concepts" → "Platform concepts" → "Available models"가 온다. 이어 "How-tos" 아래 "Model and dataset management"("Dataset lifecycle", "Datasets overview", "Configuration profiles and parameters" 등)와 "Analyze"("Insights", "Comparisons", "Experiments", "Timefold Copilot")가 있다. 그다음 "Manage tenant", "Manage user", "Job-oriented guides", "API integration", "More information"("Changelog", "Feature requests", "Pricing plans and capabilities", "Self-Hosted", "Support"(…"Troubleshooting"), "Trust")이 이어진다 — [Timefold Platform Introduction](https://docs.timefold.ai/timefold-platform/latest/introduction)
- **Timefold "Job-oriented guides"(업무 목적별 안내) 제목**: "Balancing different optimization goals", "Validating an optimized plan with Explainable AI", "Uncovering inefficiencies in operational planning", "Responding to disruptions with real-time planning", "Designing better routing plans with (just enough) traffic awareness" — [Timefold Platform Introduction](https://docs.timefold.ai/timefold-platform/latest/introduction)
- **Timefold 소개 페이지의 네 층**: 플랫폼을 REST API로 최적화 모델을 돌리는 관리형 서비스로 소개한다. 네 층 가운데 하나가 "Explainability and trust"다. 계획 담당자가 "pin assignments, override decisions"를 하고 그 영향을 볼 수 있다고 쓴다 — [Timefold Platform Introduction](https://docs.timefold.ai/timefold-platform/latest/introduction)
- **Timefold Employee Shift Scheduling 모델 문서, 소개 페이지 본문 제목 순서**: "Introduction" → "Introduction for integration and application developers" → "Introduction for platform and enterprise architects" → "Introduction for product, business, and decision makers" → "Next". 한 페이지 안에서 독자별로 절을 나눈다 — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction)
- **같은 모델 문서의 사이드바 순서**: "The basics"("Introduction", "Getting started: Hello world", "Lessons overview"(Lessons 1–4, "Interlude 1: Basic demo data", Lessons 5–7)) → "User guide"("Terminology", "Use case guide", "Scheduling API concepts", "Integration", "Constraints", "Using the API", "Demo datasets", "Input datasets", "Planning window", "Time zones and Daylight Saving Time (DST)", "Tags and tag types", "Input validation", "Output datasets"(…"Key performance indicators (KPIs)"), "Metrics and optimization goals", "Score analysis", "Visualization", "Efficiency X-Ray", "Assignability analysis") → "Feature guides"("Employee resource constraints" 아래에 "Employee availability and preferences", "Employee contracts", "Fairness" 등 13개, "Shift service constraints" 아래 6개, "Scenarios" 아래 "Configuring labor law compliance", "Configuring employee well-being", "Self-rostering and optimization") → "Responding to change"("Manual intervention", "Recommendations", "Real-time planning") → "More information"("FAQs", "Changelog", "Upgrade to the latest version", "Feature requests") — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction)
- **Timefold의 기능별 안내는 "제약 = 업무 규칙 하나"로 나눈다**: 근무 계약·가용성·공정성·휴가처럼 업무 용어로 된 제약 묶음이 각각 한 장이다. 맨 위에는 "Constraints have configurable weights, making them adjustable to meet different business goals and priorities."라는 문장을 둔다 — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction)
- **Quinyx 도움말 센터의 분류 경로**: "All Categories > Web app > Forecast & Optimization > Labor optimization > Auto Assign > Auto Assign: Rule configuration"이다. Labor optimization 아래에 "Auto Schedule"과 "Auto Assign"이 있다. Auto Schedule 글은 "Auto Schedule", "Minimum and maximum requirements in Auto Schedule", "Shift rule configuration in Auto Schedule", "Availability within Auto schedule", "Schedule Automation run tables", "Auto Schedule use cases"다. 화면(기능) 단위로 분류하고, 형제 분류로 "KPIs"를 둔다 — [Quinyx: Auto Assign: Rule configuration](https://quinyx.helpdocs.io/l/en/article/23q5v84x00-auto-assign-rule-configuration)
- **Quinyx 글 하나의 구성**: "Key highlights" → "How to use it" → "Why this matters"(요점 → 사용법 → 의의) — [Quinyx: Auto Assign: Rule configuration](https://quinyx.helpdocs.io/l/en/article/23q5v84x00-auto-assign-rule-configuration)
- **Quinyx "Auto Schedule tutorial"은 이름과 달리 짧은 개요다**: 단계·전제·검토·게시 절이 없다. "The output of the Auto Schedule algorithm is open shifts"라고 결과물을 정의한 뒤, 이어지는 작업은 Auto Assign 안내로 넘긴다 — [Quinyx: Auto Schedule tutorial](https://quinyx.helpdocs.io/l/en/article/7nr2igmru0-auto-schedule-tutorial)
- **IBM Decision Optimization**: 실험(experiment)과 시나리오를 문서의 중심 개념으로 둔다. 시나리오 하나는 데이터(표)·모델·해(풀었을 때)의 묶음이다 — [IBM: Scenarios in a Decision Optimization experiment](https://www.ibm.com/docs/en/DSXDOC/DO/do_expts/scenarios.html); [IBM: Comparing scenarios (CP4D 5.4.x)](https://www.ibm.com/docs/en/cloud-paks/cp-data/5.4.x?topic=scenarios-comparing)
- **N-SIDE(제약 공급 계획 SaaS) 지식 베이스**: 제품별로 "Information"과 "Release notes"(예: "Prediction App Release notes 2026.4.6"부터 2026.4.2까지, 패치 포함 다섯 건) 두 축으로 나뉘고 검색창이 있다. 시나리오 비교 글은 가져온 화면에 보이지 않았다 — [N-SIDE Knowledge Base](https://knowledge.n-side.com/production-app/how-to-compare-scenarios-or-versions-of-a-scenario)

### Inferences
- 업무 사용자용 최적화 제품 문서의 공통 뼈대(Timefold 기준, Quinyx의 기능별 분류가 보조)는 다음 순서로 보인다.
  1. 소개(무엇을 풀어 주는가, 독자별 요약)
  2. 시작하기(가장 작은 예제 한 번 돌리기)
  3. 개념·용어(계획 기간, 입력, 출력, 점수)
  4. 규칙(제약) — 업무 규칙 하나가 한 절
  5. 결과 읽기(KPI, 점수 분석, 시각화, 배정 못 한 항목)
  6. 비교·실험(가중치를 바꿔 다시 돌리고 나란히 보기)
  7. 변화 대응(수동 고정, 재편성)
  8. 기타(FAQ, 변경 이력, 지원·문제 해결)
- 우리 스튜디오 안내서에 옮기면 다음과 같다(추론). ① 이 도구가 하는 일(한 쪽 요약, "구단·운영 담당자용" 절) → ② 처음 한 번 해 보기(기본 조건으로 편성 → 결과 보기 → 확정) → ③ 알아 둘 말(시즌, 연전, 슬롯, 꼭 지키는 규칙 / 되도록 지키는 기준, 점수) → ④ 조건 정하기(규칙별 한 절: 연속 경기일, 더블헤더, 이동 거리, 월요일, 공정성 …) → ⑤ 순서(우선순위) 정하기와 그 효과 → ⑥ 엔진 돌리기와 진행 화면 → ⑦ 결과 읽기(요구 사항 점검, 규칙별 점수, 지도·달력) → ⑧ 여러 결과 비교(순위표, 「여기서 갈림」) → ⑨ 확정과 공유 → ⑩ 취소 경기 다시 짜기 → ⑪ 자주 묻는 질문, 바뀐 점.
- Timefold의 "job-oriented guides" 방식(예: "목표 사이의 균형 잡기", "결과를 믿을 수 있는지 확인하기")은 기능 설명과 별도로 "이럴 때 이렇게" 안내를 두는 관행이다. 비개발자 편성 담당자에게 특히 맞아 보인다.
- 독자별 소개 절(Timefold)은 브로셔 대신 소개 페이지 첫머리에서 "의사결정자에게는 이 문단" 식으로 나누는 방식이다. 별도 브로셔를 만들지 않는 제품도 많은 것으로 보인다(근거 부족, 추론).

### Gaps
- 독립된 솔루션 소개서·브로셔·데이터시트의 장 순서는 공개된 곳에서 찾지 못했다(Timefold·Quinyx·Kinaxis·SAP 모두).
- Kinaxis Maestro, SAP IBP, UKG Dimensions, Deputy, Shiftboard, ORTEC, Descartes, o9, Blue Yonder, Gurobi 애플리케이션의 공식 업무 사용자 안내서 목차는 공개된 곳에서 찾지 못했다(로그인 뒤에 있거나 검색에 나오지 않음). OptimoRoute 도움말 센터는 자동 가져오기를 403으로 막아 확인하지 못했다.
- Timefold 문서는 개발자와 업무 사용자를 한 문서 안에서 함께 다룬다. 순수 업무 사용자용 목차라고 보기 어렵다.
- 문서 분량(쪽수·글 수)에 대한 자료는 찾지 못했다.

## 2. 목표·제약·꼭 지킬 규칙과 되도록 지킬 기준·가중치·맞바꿈을 업무 사용자에게 설명하는 방식

### Takeaway
공통 설명 틀은 세 층이다. "꼭 지키는 규칙(hard) — 반드시 지키며, 어기면 쓸 수 없는 결과"와 "되도록 지키는 기준(soft) — 많이 지킬수록 좋은 결과"를 나누고, 그 사이에 우선순위나 가중치를 둔다. Timefold는 가중치를 "기본 1, 상대값만 의미, 0이면 끔"으로 설명한다. 그리고 "최고의 일정은 하나가 아니라 맞바꿈"이라는 파레토 관점을 명시한다. 인력 스케줄링 제품(Quinyx, Infor)은 숫자 가중치 대신 Mandatory/High/Medium/Low 같은 등급, 또는 Hard/Soft/Preference + Weight 같은 단계로 보여 준다.

### Cited Findings
- **Timefold "Balancing different optimization goals" 제목 순서**: "Introduction" → "Measuring the impact of a single optimization goal" → "Multi-objective optimization and the need for a normalizing function" → "Customizing constraint importance via Configuration Profiles" → "Practical approach to balancing optimization goals" → "Why not a cost-based approach?" → "What's next? More intuitive Goal Alignment" → "Conclusion" — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **세 층 설명**: hard는 언제나 지켜야 하는 것(예: "legal shift limits")이다. medium은 자원이 모자라도 가능한 한 많이 배정하는 것이다. soft는 최적화 목표(예: 이동 거리 최소화)다 — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **목표와 제약의 관계**: 업무 목표 하나(인원 충족, 인건비, 직원 만족)는 제약 하나 이상으로 구현된다. 어떤 제약은 여러 목표를 함께 돕고(선호 기술 매칭 → 품질과 만족), 어떤 제약은 서로 부딪친다(비용 절감 ↔ 만족) — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **가중치 설명 방식**: soft 제약은 모두 가중치 1에서 시작한다. 2로 올리면 영향이 두 배다. 0이면 그 제약과 목표가 빠진다. 상대값만 의미가 있어 전체를 같은 배수로 키우면 아무것도 바뀌지 않는다. 또 가중치를 두 배로 올려도 관련 지표가 절반이 되지는 않으며 효과는 예측하기 어렵다고 경고한다 — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **맞바꿈(파레토) 설명**: 하나의 "best plan"은 없고, 업무 우선순위에 따른 맞바꿈만 있다. km와 초과근무 분처럼 단위가 다른 것을 합치므로, "1 km가 초과근무 1분에 비해 얼마나 중요한가"는 업무 쪽이 정해야 한다고 쓴다 — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **가중치를 맞추는 6단계 반복("goal alignment")**: 가장 모자란 핵심 지표를 고른다 → 그 지표를 움직이는 제약을 찾는다 → 가중치를 조정한다 → 대표 데이터로 다시 돌린다 → 결과를 비교한다 → 다음 우선순위로 넘어간다. 조합은 "Configuration Profile"로 저장한다 — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **비용 환산 방식을 권하지 않는 이유**: 공정성·직원 웰빙은 돈으로 값을 매기기 어렵다. 값을 매겨도 결국 같은 반복 조정이 필요하다 — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **점수를 읽는 순서**: hard → medium → soft 순으로 읽고 각 점수는 높을수록 좋다. soft는 "the more they are satisfied, the more optimal a solution is"라고 설명한다. hard가 깨지면 그 해는 쓸 수 없다 — [Timefold: Interpreting model run results](https://docs.timefold.ai/timefold-platform/latest/how-tos/interpreting-model-run-results)
- **Quinyx의 등급식 우선순위**: 규칙을 추가·수정할 때 우선순위를 Mandatory, High, Medium, Low 중에서 고른다. "Hard stop rules and warnings"는 "automatically assigned as Mandatory and cannot be changed"이고, "silent rules"만 우선순위를 직접 고른다. 각 등급이 실제로 어떻게 작동하는지는 그 페이지에 설명이 없다 — [Quinyx: Auto Assign: Rule configuration](https://quinyx.helpdocs.io/l/en/article/23q5v84x00-auto-assign-rule-configuration)
- **Quinyx Auto Assign의 soft/hard 설명**: 규칙마다 soft(선호)인지 hard(필수)인지 정하고, 필수 규칙은 배정 과정에서 어기지 않는다(검색 요약 기준) — [Quinyx: Auto Assign](https://quinyx.helpdocs.io/l/en/article/nxuh0oo67s-labour-optimization-auto-assign)
- **Quinyx Auto Schedule의 최소 인원 기본값**: 최소 인원 요구는 기본이 soft다. hard로 하면 수요가 적은 때에도 늘 채운다. 이 값과 일정 매개변수는 현재 초기 설정 때 Quinyx가 정한다(검색 요약 기준) — [Quinyx: Minimum and maximum requirements in Auto Schedule](https://quinyx.helpdocs.io/l/en/article/2tidrvcpzk-minimum-and-maximum-requirements)
- **Quinyx 마케팅 문구**: hard 규칙은 언제나 지키고, soft 규칙 위반은 막지 않고 알림으로 알린다(검색 요약 기준) — [Quinyx: Labor optimization](https://quinyx.com/ai-optimization/labor-optimization)
- **Infor WFM(인력 스케줄링) 세 단계**: 2023.10부터 일정을 만들 때 고르는 규칙 목록에 "Hard", "Soft", "Preference" 열이 보인다. Preference에는 Weight가 있고, 가중치가 높은 선호가 낮은 선호보다 앞선다(검색 요약 기준) — [Infor WFM: Adding rules (2026)](https://docs.infor.com/wfm/2026/en-us/wfmopolh/auto_assignment_on-premise/mja1529952286494.html). Infor는 서로 부딪치는 규칙을 다루는 별도 글도 둔다 — [Infor WFM: Using contradicting rules](https://docs.infor.com/wfm/2024/en-us/wfmclolh/auto_assignment_cloud/ilf1554998175014.html)
- **Shiftboard 제품 페이지**: 고용법·노조 계약·피로 규칙·내부 정책 위반을 자동으로 막는다(auto-block)고 소개한다(검색 요약 기준, 도움말 문서가 아님) — [Shiftboard Product](https://www.shiftboard.com/product/)
- **SAP IBP 최적화기**: 목표를 공급망 계획의 총비용 최소화(또는 이익 최대화)로 두고, 미납 비용(non-delivery cost) 같은 벌점 비용으로 우선순위를 표현한다. 이 근거는 SAP 공식 도움말이 아니라 커뮤니티 블로그·교육 자료의 검색 요약이다 — [SAP Community: SAP IBP Supply](https://blogs.sap.com/2019/08/22/sap-ibp-supply/); [SAP Learning: Optimizer run details](https://learning.sap.com/courses/mastering-sap-ibp-for-response-and-supply-order-based-planning/optimizer-run-details)

### Inferences
- 업무 사용자용 설명의 공통 어휘는 "반드시 지킴 / 되도록 지킴 / 얼마나 중요한가"이다. 숫자 가중치를 그대로 보여 주는 제품(Timefold, Infor Preference Weight)과 등급만 보여 주는 제품(Quinyx Mandatory/High/Medium/Low)이 나뉜다. 우리 제품처럼 "기준 순서(1순위 → 2순위 …)"를 쓰는 방식은 등급식에 가깝다. 안내서에서는 "앞 순위가 조금이라도 나으면 뒤 순위는 보지 않는다" 같은 비교 규칙을 한 문단으로 밝혀 두는 것이 관행에 맞다(추론).
- Timefold가 경고한 "가중치를 두 배로 해도 지표가 반이 되지 않는다"처럼, 조정의 효과를 장담하지 않는 문장과 "바꾸고 → 다시 돌리고 → 비교"하는 반복 절차를 안내서에 함께 쓰는 것이 관행으로 보인다.
- 비용 환산(SAP IBP) 방식은 공급망 쪽 관행이다. 공정성·선수 피로처럼 값을 매기기 어려운 기준이 많은 스포츠 편성에는 Timefold식 설명(돈으로 환산하지 않음)이 더 가까워 보인다(추론).

### Gaps
- Quinyx 등급(High/Medium/Low)이 실제로 어떻게 작동하는지(사전식 순서인지 가중치인지)는 공개 문서에서 확인하지 못했다.
- SAP IBP 공식 help.sap.com 사용자 안내서에서 벌점 비용을 설명하는 장을 직접 찾지 못했다(커뮤니티·교육 자료만 확인).
- UKG Dimensions·Deputy의 자동 편성 규칙 설명은 찾지 못했다.

## 3. "왜 이 결과인가"(설명 가능성·점수 내역·KPI), 시나리오 비교, 승인·게시·확정 단계를 설명하는 방식

### Takeaway
설명 가능성은 "실제 업무 지표(KPI) → 제약별 점수 분석표 → 근거(justification) 예시 → 배정 못 한 항목의 이유 → 시각화로 눈으로 확인"의 층으로 설명한다(Timefold). 비교는 "같은 데이터를 여러 설정으로 돌린 실험 → 지표·점수·제약 내역을 나란히 놓고 차이를 % 또는 차이만 보기로"가 공통이다(Timefold, IBM). 승인·확정은 최적화 엔진 문서보다 계획 플랫폼 쪽에서 "시나리오를 만들고 → 비교하고 → 하나를 승인하면 실제 계획이 된다"는 흐름으로 나타난다(ServiceNow는 유사 사례, Kinaxis는 사용자 후기). 엔진 문서인 Timefold에는 별도의 승인 단계 설명이 없다.

### Cited Findings
- **Timefold "Validating an optimized plan with Explainable AI" 제목 순서**: "Introduction" → "Why trust matters" → "How Timefold helps build trust"("Explainability": "Plan visualizations", "Assessing plan quality with real-world metrics", "Analyze the solution per constraint", "Explaining unassigned items", "Efficiency X-rays", "Tradeoff transparency during solving" / "Adjusting the plan": "Plan around manual assignments and exceptions", "Test the impact of manual changes with sensitivity analysis", "Goal alignment: Redefining what "better" means") → "Tips for building trust"(계획 담당자용, 직원용: "Make plans conversational", "Avoid overly tight schedules") → "What's next?" → "Conclusion" — [Timefold: Validating an optimized plan with Explainable AI](https://docs.timefold.ai/timefold-platform/latest/guides/validating-an-optimized-plan-with-explainable-ai)
- **근거(justification) 설명**: 제약을 다 지키지 못하면 그 차이를 예시로 보여 준다(놓친 직원 선호, 균형이 정확하지 않을 때 시간 배분). "Why didn't it do X?"를 이해할 수 있는 답으로 바꾸는 것이 목표라고 쓴다. 배정 못 한 항목은 이유(기술 부족, 이미 꽉 찬 일정 등)를 추천 기능으로 보여 준다 — [Timefold: Validating an optimized plan with Explainable AI](https://docs.timefold.ai/timefold-platform/latest/guides/validating-an-optimized-plan-with-explainable-ai)
- **실제로 쓰기 전 확인 절차**: 시각화 화면에서 표본을 직접 확인하고, 지표와 제약별 근거를 검토하며, 수동 배정을 고정(pin)한다. 민감도 분석으로 수동 변경의 영향을 미리 시험한다. 한 팀처럼 일부에서 시작해 신뢰가 쌓이면 넓히라고 권한다 — [Timefold: Validating an optimized plan with Explainable AI](https://docs.timefold.ai/timefold-platform/latest/guides/validating-an-optimized-plan-with-explainable-ai)
- **결과 읽기 안내의 구성**: 사이드바에 모델이 정한 출력 지표를 나열하고, 첫 해와 마지막 해를 비교한 "optimization gain"을 함께 보인다. 지표 하나만 보면 오해할 수 있으니 함께 읽으라고 한다. 기본으로 다섯 개를 보이고 "More"로 나머지를 연다. "--"는 그 데이터에 해당 없음이다. 입력 지표(문제 규모)도 맥락으로 보여 준다 — [Timefold: Interpreting model run results](https://docs.timefold.ai/timefold-platform/latest/how-tos/interpreting-model-run-results)
- **점수 분석표 열**: 제약마다 유형, 영향(벌점/보상), 해당 건수(matches), 실제 가중치(effective weight), 점수를 보인다. 걸러 보기(matched/triggered/all)와 정렬(점수·건수·가중치·이름)이 있다. 풀이가 끝난 뒤 표가 나타나고 근거를 내보낼 수 있다. 진행 그래프는 풀이 중 점수와 지표가 어떻게 바뀌었는지 보여 줘 맞바꿈을 드러낸다 — [Timefold: Interpreting model run results](https://docs.timefold.ai/timefold-platform/latest/how-tos/interpreting-model-run-results)
- **Timefold 실험(Experiments)과 비교 화면**: 같은 데이터를 여러 설정 프로필로 돌려 차이를 나란히 비교한다. 실험 결과도 일반 데이터셋이어서 다른 비교에 섞을 수 있다(검색 요약 기준) — [Timefold: Experiments](https://docs.timefold.ai/timefold-platform/latest/how-tos/experiments). 여러 데이터셋의 지표·점수·제약 내역을 레이더 차트와 함께 나란히 보고 비교를 저장할 수 있다 — [Timefold Solver: Metrics (platform)](https://docs.timefold.ai/timefold-solver/latest/deploying-to-platform/metrics). 비교 화면과 저장된 비교는 상위 요금제(Horizon) 기능이다 — [Timefold Plans](https://docs.timefold.ai/timefold-platform/latest/plans). 변경 이력에 비교의 % 차이 표시와 레이더 그림 SVG 내보내기가 추가됐다 — [Timefold Changelog](https://docs.timefold.ai/timefold-platform/latest/changelog)
- **비교 화면에서 볼 것(업무 관점)**: 목표 지표가 좋아졌는지, 다른 중요한 지표가 크게 나빠지지 않았는지를 확인하라고 쓴다 — [Timefold: Balancing different optimization goals](https://docs.timefold.ai/timefold-platform/latest/guides/balancing-different-optimization-goals)
- **IBM Decision Optimization 시나리오 비교**: 시나리오 메뉴의 "Compare with"로 두 번째 시나리오를 고르면 나란히 보는 화면이 열린다. 입력·모델·해·로그의 차이를 표시하고 "차이만 보기"로 바꿀 수 있다. Overview 탭은 모든 시나리오의 모델·데이터·해를 한눈에 요약한다. 전형적인 사용은 데이터만 다른 두 시나리오를 돌려 해를 비교하는 것이다. 공유 프로젝트의 viewer는 보기만 할 수 있다(검색 요약 기준) — [IBM: Comparing scenarios in a Decision Optimization experiment](https://www.ibm.com/docs/en/cloud-paks/cp-data/5.4.x?topic=scenarios-comparing)
- **ServiceNow Strategic Planning Workspace(최적화 스케줄러가 아닌 유사 사례)**: 실제 계획이나 다른 시나리오에서 시나리오를 만들고, 실제 계획과 나란히 비교한 뒤 가장 나은 시나리오를 승인하면 그것이 실제 계획이 된다. 한 번에 최대 다섯 개까지 비교한다(검색 요약 기준) — [ServiceNow: Optimizing planning with scenario planning](https://www.servicenow.com/docs/r/MrftC6mNgCta3UqwXSW7Kg/9Tw6Je36J5v82Kpi66A~7A); [ServiceNow: Compare scenarios](https://www.servicenow.com/docs/r/cVzHwL~N5hQ70Ca9r7fiZg/0EF4~lNegkn4iHi_y_oYZQ)
- **Kinaxis Maestro(공식 문서가 아닌 사용자 후기)**: 현재 상태를 복사해 바꿔 보고, 처음부터 끝까지의 영향을 본 뒤 버리거나(scrap) 확정(commit)하는 시나리오 방식이라는 Gartner Peer Insights 후기가 있다 — [Gartner Peer Insights: Kinaxis Maestro likes/dislikes](https://www.gartner.com/reviews/market/supply-chain-planning-solutions/vendor/kinaxis/product/kinaxis-maestro-platform/likes-dislikes). 제3자 요약에는 나란히 놓는 시나리오 점수표(scorecards)가 있다고 적혀 있다 — [ERPResearch: Kinaxis](https://erpresearch.com/erp-add-ons/demand-planning/kinaxis). NTT Data의 일본어 소개는 여러 미래 시나리오를 빨리 비교해 위험과 제약에 맞는 계획을 고르는 기능으로 설명한다 — [NTT Data: Kinaxis Maestro](https://www.nttdata.com/jp/ja/lineup/kinaxis-maestro)
- **SAP 쪽 실행 기록**: 최적화 실행 기록에 계획 버전, 최적화 프로필, 비용 프로필, 제안 해의 총비용을 남긴다. 다만 근거는 IBP가 아닌 예전 SAP SNC 도움말의 검색 요약이다 — [SAP Help (SNC): optimizer log](https://help.sap.com/saphelp_snc70/helpdata/en/78/4d2a28608611d3b6380000e82de178/content.htm)
- **Quinyx 흐름**: Auto Schedule의 결과물은 빈 근무(open shifts)이고, 배정은 Auto Assign이 이어서 한다. 두 단계로 나뉜 흐름을 각각 다른 글로 안내한다 — [Quinyx: Auto Schedule tutorial](https://quinyx.helpdocs.io/l/en/article/7nr2igmru0-auto-schedule-tutorial)

### Inferences
- "왜 이 결과인가"를 설명하는 장은 대체로 ① 업무 지표(점수보다 먼저) → ② 규칙별 점수 내역(몇 건, 얼마나) → ③ 구체적인 예(어느 경기, 어느 구단) → ④ 못 지킨 것과 그 이유 → ⑤ 눈으로 확인(달력·지도) 순서다. 우리 스튜디오의 「요구 사항 점검」과 규칙별 점수, 「여기서 갈림」이 각각 ②·③·비교에 해당한다(추론).
- 비교 장의 관행: "같은 조건 묶음을 바꿔 여러 번 돌림 → 나란히 보기 → 차이만 보기 / 백분율 차이 → 목표 지표가 좋아졌는지, 다른 지표가 나빠지지 않았는지 확인" 순서다.
- 확정 단계는 엔진 문서(Timefold, IBM)에는 거의 없고 계획 플랫폼(ServiceNow, Kinaxis 후기)에 "승인한 시나리오가 실제 계획이 된다 / 버리거나 확정한다"로 나타난다. 우리 안내서에는 "하나를 골라 확정 → 확정본은 공유 링크로 보임 → 나머지 버전은 보관"을 별도 장으로 두는 편이 맞아 보인다(추론).
- Timefold가 "일부(한 팀)부터 시작해 신뢰를 쌓으라"고 권하는 것처럼, 처음 쓰는 편성 담당자에게 "실제 시즌과 숫자 비교부터 보라"(우리의 2025 비교)는 안내를 두는 것이 관행과 맞는다(추론).

### Gaps
- 승인·게시·확정 단계를 다룬 최적화 스케줄러의 공식 사용자 문서는 찾지 못했다. Quinyx의 검토·게시 단계는 가져온 화면에서 보이지 않았다. Kinaxis는 사용자 후기와 제3자 요약만 확인했다.
- Timefold의 "Comparisons" 전용 페이지는 주소를 짐작해 가져오려다 404가 나서 직접 보지 못했다. 검색 요약과 관련 페이지(Experiments·Metrics·Plans·Changelog)로만 확인했다.
- SAP IBP 시나리오(simulation) 비교와 버전 승격(copy to baseline 등)의 공식 설명은 찾지 못했다.

## 4. 관행: 빠른 시작, 개념 장, 화면 사진, 용어집, FAQ, 문제 해결, 변경 이력, 분량

### Takeaway
확인한 문서들의 공통 관행은 다음과 같다. 맨 앞의 "Getting started / Hello world"와 단계별 레슨, 앞쪽의 개념·용어 장, 맨 끝의 "More information"(FAQ·Changelog·업그레이드·기능 요청), 따로 둔 지원·문제 해결 장, 도움말 센터 쪽의 릴리스 노트 축이다. 화면 사진의 비중과 문서 분량에 대한 자료는 찾지 못했다.

### Cited Findings
- **빠른 시작**: Timefold 모델 문서는 "Getting started: Hello world"를 두 번째 항목에 두고, 이어서 "Lessons overview"(Lessons 1–7, 중간에 "Interlude 1: Basic demo data")로 단계별 학습을 이어 간다 — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction)
- **개념·용어 장**: Timefold 모델 문서의 "User guide"는 "Terminology"로 시작한다. 플랫폼 문서는 "Scheduling API concepts", "Platform concepts"를 Basics에 둔다 — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction); [Timefold Platform Introduction](https://docs.timefold.ai/timefold-platform/latest/introduction)
- **데모 데이터**: "Demo datasets"를 사용자 안내 안에 따로 둔다 — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction)
- **FAQ·변경 이력·업그레이드**: 모델 문서 끝의 "More information"에 "FAQs", "Changelog", "Upgrade to the latest version", "Feature requests"가 있다 — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction)
- **문제 해결·지원·신뢰**: 플랫폼 문서는 "Support"("Contacting support", "Platform status", "Troubleshooting")와 "Trust"("Risk profile", "Product security", "Data security", "Legal and privacy", "AI legislation compliance", "Trust center")를 맨 끝에 둔다 — [Timefold Platform Introduction](https://docs.timefold.ai/timefold-platform/latest/introduction)
- **입력 점검**: "Input validation"을 사용자 안내에 따로 둔다. 결과 읽기 안내는 결과를 믿기 전에 상태·검증 오류·경고부터 보라고 한다 — [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction); [Timefold: Interpreting model run results](https://docs.timefold.ai/timefold-platform/latest/how-tos/interpreting-model-run-results)
- **릴리스 노트**: N-SIDE 지식 베이스는 "Release notes"를 "Information"과 나란한 최상위 축으로 두고 패치 단위까지 버전별 글을 쌓는다 — [N-SIDE Knowledge Base](https://knowledge.n-side.com/production-app/how-to-compare-scenarios-or-versions-of-a-scenario). Timefold도 "Changelog"를 둔다 — [Timefold Changelog](https://docs.timefold.ai/timefold-platform/latest/changelog)
- **도움말 글의 형식**: Quinyx 글은 "Key highlights" → "How to use it"(번호 단계) → "Why this matters"로 짧게 구성되고, 끝에 "How Did We Do?" 피드백과 "Contact"가 있다 — [Quinyx: Auto Assign: Rule configuration](https://quinyx.helpdocs.io/l/en/article/23q5v84x00-auto-assign-rule-configuration); [Quinyx: Auto Schedule tutorial](https://quinyx.helpdocs.io/l/en/article/7nr2igmru0-auto-schedule-tutorial)
- **사용 사례 장**: Quinyx는 "Auto Schedule use cases"를, Timefold는 "Use case guide"와 "Scenarios"(노동법 준수, 직원 웰빙, 자율 편성)를 둔다 — [Quinyx: Auto Assign: Rule configuration](https://quinyx.helpdocs.io/l/en/article/23q5v84x00-auto-assign-rule-configuration); [Timefold Employee Shift Scheduling Introduction](https://docs.timefold.ai/employee-shift-scheduling/latest/introduction)

### Inferences
- 업무 사용자용 안내서의 표준 부속물은 "빠른 시작(1회 실습) + 개념·용어 + 사용 사례 + FAQ + 문제 해결 + 바뀐 점(변경 이력)"으로 정리된다. 우리 안내서에도 같은 틀이 맞아 보인다. 다만 AGENTS.md 규칙대로 "변경 이력"이나 "데이터셋" 같은 개발 용어 대신 "바뀐 점", "기본 예시" 같은 쉬운 말로 바꿔야 한다(추론).
- 도움말 글 하나는 짧게(요점 → 순서 → 왜 중요한가) 쓰고, 긴 개념 설명은 별도 안내(Timefold의 job-oriented guide)로 떼어 내는 두 층 구조가 보인다.
- "신뢰" 장(Timefold Trust)은 기업 고객용이다. 우리 제품에서는 "이 결과를 믿어도 되는 이유(실제 시즌과의 비교, 요구 사항 점검)" 한 절 정도로 줄여 옮길 수 있다(추론).

### Gaps
- 화면 사진(스크린샷)을 얼마나, 어떻게 쓰는지에 대한 관행 자료는 찾지 못했다(가져온 텍스트에는 그림 설명이 거의 없음. Timefold "Balancing different optimization goals"에 비교 화면 그림 "Figure 1"이 있다는 정도만 확인).
- 독립된 용어집(Glossary) 장은 Timefold의 "Terminology" 외에는 확인하지 못했다.
- 안내서 분량(글 수, 쪽수, 읽는 시간)은 어느 제품에서도 자료를 찾지 못했다.
- 2026년 기준 최신판인지는 Timefold("latest")와 N-SIDE(2026 릴리스 노트)만 확인했다. 나머지는 버전을 확인하지 못했다.
