# 사용자 매뉴얼 작성 표준·프레임워크 조사 (국제 표준, Diátaxis, 3대 스타일 가이드, 한국 지침)

조사일: 2026-11-07. 대상: 비개발자 직원이 쓰는 웹 기반 일정 편성 시스템의 한국어 PDF 사용자 매뉴얼.

---

## 1. ISO/IEC/IEEE 26514 계열: 사용자 문서에 무엇을, 어떤 구조로 넣으라고 하는가

### Takeaway
현행판은 **ISO/IEC/IEEE 26514:2022**(3판, 제목 "Design and development of information for users")이며, 2008판의 "구성 요소 목록" 방식 대신 **개념 정보 / 지시(절차) 정보 / 참조 정보 / 명령 / 문제 해결 / 오류 메시지 / 용어집**의 정보 유형별 구조와, **목차·색인·검색·위험/경고/주의 표시·그림** 형식을 규정한다. 2008판의 구성 요소(식별 정보, 문서 사용법, 운영 개념, 절차, 오류 메시지와 문제 해결, 경고·주의, 용어, 관련 정보원)는 여전히 매뉴얼 목차의 "체크리스트"로 쓰기 좋다.

### Cited Findings
**판·관계**
- 26514:2022는 2008판(ISO/IEC 26514:2008)을 대체했고, 2008판은 2022-01-14 폐지. 2022판은 IEC/IEEE 82079-1을 규범 참조로 쓰고 API·챗봇 절을 추가 — [GlobalSpec/genorma 카탈로그 요약](https://genorma.com/en/standards/iso-iec-26514-2008), [iTeh 카탈로그](https://standards.iteh.ai/catalog/standards/iso/63708794-272a-42ae-be3d-cbdfc0315f7f/iso-iec-ieee-26514-2022)
- 2022판(초안 DIS 2021 서문 기준) 은 "모든 제품용 사용 설명 일반 요구사항인 IEC/IEEE 82079-1:2019에 기반해 소프트웨어 사용자 정보에 대한 구체 요구사항을 제공"하며, 프로세스 표준(어떻게 만드나)과 정보 제품 표준(무엇을 담나)을 함께 다룬다. "구조, 정보 내용, 형식"에 대한 요구사항을 정하고 문체는 참고 지침으로 제공 — [ISO/IEC/IEEE DIS 26514 샘플 PDF (iTeh)](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf)
- 같은 서문: 자매 표준은 관점별로 나뉜다 — 26511(관리자), 26512(발주자·공급자), 26513(검토자·시험자), 26515(애자일 개발 참여자), 26531(콘텐츠 관리자) — [DIS 26514 샘플](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf)
- 26511:2018 = 사용자 정보 관리자 요구사항(전략·계획·인력·번역·제작·품질 평가), 애자일/전통 방식 모두 적용. ISO는 2024년에 재확인(현행 유지) — [ISO 26511:2018](https://www.iso.org/standard/70879.html), [JTC1/SC7 소개](https://committee.iso.org/sites/jtc1sc7/home/projects/flagship-standards/isoiecieee-265112018.html)
- 26512 = 발주자·공급자 요구사항(판 연도는 카탈로그에 따라 2017/2018로 엇갈림), 26515:2018 = 애자일 환경에서의 사용자 정보 개발 — [ANSI webstore 목록](https://webstore.ansi.org/industry/software/software-engineering/documentation), [nimonik 26511](https://www.standards.nimonik.com/products/iso/iso-iec-ieee-26511/)
- 2022판은 "인쇄되었거나 사용자가 인쇄하도록 전자 형태로 제공되는 정보"를 printed information for users로 정의(→ PDF 매뉴얼이 여기에 해당) — [DIS 26514 샘플 3.1.37](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf)

**2022판(DIS 기준) 목차 중 매뉴얼 구조·형식 관련 절** — [DIS 26514 샘플](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf)
- 6장 정보 설계·개발: 6.2 독자 분석·작업 분석, 6.4 검토, 6.5 시안, 6.8 최종 조립·검토, 6.11 갱신·유지, 6.12 **버전 관리·변경 관리**
- 7장 정보 품질: 정확성, 일관성, 이해 가능성, 간결성, **최소주의(Minimalism)**, 접근성
- 8장 구조: 8.1 전체 구조, 8.2 모듈화, 8.3 **기능별 구조화**, 8.4 정보 모델, 8.5 **개념 정보 구조**, 8.6 **지시(절차) 정보 구조**, 8.7 **참조 정보 구조**, 8.8 명령 구조, 8.9 **문제 해결 정보 구조**, 8.10 **오류 메시지 구조**, 8.11 **용어집**, 8.12 **인쇄용 정보 구조**, 8.13 온라인 정보 구조, 8.16 FAQ, 8.17 챗봇
- 9장 형식: 9.3 매체·형식 선택, 9.5 **접근 가능한 정보**(이해 가능한 정보, 접근 가능한 전자 형태, 비텍스트 대체 텍스트, 불필요한 장치 언급 피하기, 접근성 기능 안내), 9.7 가독성(서체·글자 크기·강조), 9.8 **UI 요소 표기 형식**, 9.9 색 사용, 9.10 **탐색 기능**(같은 정보 다시 찾기, 링크, **목차**, **색인**, **검색**), 9.11 **위험·경고·주의 표시 형식**, 9.12 지시문 형식, 9.14 **그림 형식**(일관된 표현, 배치, 화면 정보 그림), 9.15 아이콘, 9.16 동영상·애니메이션
- 부록 A 사용자 정보 스타일 가이드 내용, 부록 B 번역·현지화 문체
- (주의) 위 목차는 2021년 DIS 초안 기준이다. 검색 요약에서 최종판도 "8.10 Structure of error messages, 8.11 Glossary of terms"를 갖는 것으로 보이므로 큰 틀은 같다고 판단되나, 최종판 절 번호는 확인하지 못했다 — [iTeh 검색 요약](https://standards.iteh.ai/catalog/standards/iso/63708794-272a-42ae-be3d-cbdfc0315f7f/iso-iec-ieee-26514-2022)

**2022판 주요 용어 정의** — [DIS 26514 샘플 3장](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf)
- 개념 정보: 독자가 필요한 작업을 하도록 제품의 작동 원리를 이해시키는 설명
- 지시 정보: 제품으로 작업을 수행하는 법을 설명하는 정보 / 절차: 작업 수행법을 정한 "순서 있는 단계들" / 단계: 사용자가 할 행동을 알려 주는 번호 목록 항목이며 "소프트웨어의 반응은 단계가 아니다"
- 참조 정보: 기능에 이미 익숙한 사용자가 특정 세부 사항에 빨리 접근하도록 하는 정보
- 최소주의: 꼭 필요한 정보와, 완전성에 필요한 최소한의 다른 정보만 담는 원칙
- 주의(caution): 그 행동이 경미한 부상이나 데이터 손실 같은 원치 않는 결과를 낳을 수 있음을 알리는 정보. 그보다 강한 경고(warning), 위험(danger)과 구분
- 그림(illustration): 표·그림·화면 캡처·순서도·도표·아이콘을 포괄하는 일반 용어
- 독자(audience): 같은 특성·요구를 가진 사용자 범주(예: 관리자, 데이터 입력자 등) — 독자별로 내용·구조가 달라진다

**2008판(1판) 목차: "구성 요소" 체크리스트** — [ISO/IEC 26514:2008 샘플 PDF (iTeh)](https://cdn.standards.iteh.ai/samples/43073/d8447563ac1e481897744ba18955894d/ISO-IEC-26514-2008.pdf)
- 10장 구조: 10.1.1 **지시 모드** 문서 구조 / 10.1.2 **참조 모드** 문서 구조, 10.2 독자 요구별 구조, 10.4 **사용자 문서 구성 요소**(표 2 "Components of documentation"), 10.5.1 **앞부분 구성 요소(Initial components)**, 10.5.2 **중요 정보의 배치**
- 11장 정보 내용: 11.3 **식별 정보**, 11.4 **문서 사용법 안내**, 11.5 **운영 개념(Concept of operations)**, 11.6 소프트웨어 일반 사용 정보, 11.7 절차와 튜토리얼(11.7.1 사전 정보, 11.7.2 절차 단계, 11.7.3 완료 정보, 11.7.4 튜토리얼), 11.8 명령 정보, 11.9 **데이터 입력 필드 설명**, 11.10 **오류 메시지와 문제 해결**, 11.11 **경고와 주의**, 11.12 **용어 정보**, 11.13 **관련 정보원**
- 12장 형식: 12.5 접근 가능한 문서, 12.7 용어 일관성, 12.11 UI 요소 표기, 12.14 찾기 형식(12.14.1 **목차**, 12.14.3 **그림 목록**, 12.14.4 **색인**, 12.14.5 검색), 12.15 **경고·주의·참고 형식**, 12.18 그림(언제 쓰나, 상세 수준, 그림 식별, **화면 그림**, 표), 12.19 아이콘·표지
- 부록 A 사용자 문서 스타일 가이드 내용

### Inferences
- 2022판은 "식별 정보/운영 개념" 같은 이름의 절을 없애고 정보 유형(개념·절차·참조·문제 해결·오류 메시지·용어집)으로 재편했다. 그러나 PDF처럼 한 권짜리 인쇄 매뉴얼에는 2008판의 구성 요소(표지·식별 정보 → 문서 사용법 → 운영 개념 → 절차 → 입력 항목 설명 → 오류·문제 해결 → 용어 → 관련 자료 → 목차·그림 목록·색인)가 그대로 실용적인 목차 골격이 된다.
- "소프트웨어 반응은 단계가 아니다"라는 정의는 "클릭하면 창이 열립니다" 같은 결과를 번호 단계로 따로 매기지 말고 단계 안에 결과 문장으로 붙이라는 뜻으로 읽힌다.
- 2008판의 "지시 모드 문서 구조(10.1.1)"·"독자 요구별 구조(10.2)"와 2022판의 "독자 분석·작업 분석(6.2)"이 있다는 점, 그리고 Diátaxis 방법 안내 정의(실제 업무 목표를 돕는다)를 합치면, 일정 편성 시스템 매뉴얼은 화면(메뉴) 순서보다 직원이 하는 업무(편성 만들기, 결과 확인, 바꾸기, 내보내기) 순서로 장을 나누는 것이 취지에 맞다고 판단된다(절 제목에 근거한 추론, 본문 미확인).

### Gaps
- 26514:2022 최종판 본문(각 절의 shall 요구사항 문구)은 유료라 확인하지 못함. 위 목차는 2021 DIS 초안 기준.
- 2008판 표 2 "Components of documentation"의 내용(필수/선택 구분) 원문 미확인. 전신 IEEE 1063-2001의 구성 요소 목록과 같은지도 확인하지 못함(조사자 기억 외 근거 없음).
- 2022판 8.3 "Structuring by function"의 본문 미확인 — "기능"이 소프트웨어 기능을 뜻하는지 사용자 업무를 뜻하는지 알 수 없어 장 구성 근거로 쓰지 않음.
- 26512·26515의 공식 범위 문구 미확인(제목만 확인). 26513:2017은 서문 언급으로만 확인.

---

## 2. Diátaxis: 네 가지 문서 유형과 한 권짜리 PDF에서의 결합

### Takeaway
Diátaxis는 사용자의 요구를 "행동 vs 인지" × "익히기 vs 적용하기" 두 축으로 나눠 **튜토리얼 / 방법 안내(How-to) / 참조 / 설명**의 네 유형을 정하고, **유형을 섞지 말라**는 것이 핵심 규칙이다. 한 권의 PDF에서는 장(章) 단위로 유형을 나누어 담는 방식이 자연스럽다(추론).

### Cited Findings
- 네 유형 정의: 튜토리얼 = 강사 안내 아래 실습으로 기술을 익히는 수업 / 방법 안내 = 이미 할 줄 아는 사용자가 실제 목표·문제를 해결하도록 돕는 지시, "공부가 아니라 일을 돕는다" / 참조 = 일하는 사용자를 위한 정확·완전·중립적 사실, 구조는 설명 대상의 구조를 따른다 / 설명 = "왜?"에 답하는 맥락·배경 — [Diátaxis Start here](https://diataxis.fr/start-here/)
- 두 축: 튜토리얼·방법 안내는 사용자가 "하는 것"(행동), 참조·설명은 "아는 것"(인지). 튜토리얼·설명은 익히기(학습), 방법 안내·참조는 적용(업무) — [Diátaxis Start here](https://diataxis.fr/start-here/)
- 유형 간 경계를 흐리는 것이 많은 문서 문제의 근원. 튜토리얼에 설명을 많이 넣지 말고 최소 설명 후 별도 설명 글로 연결. 참조는 사용자가 지금 하는 일에 맞춰 바꾸지 말고 중립 유지 — [Diátaxis Start here](https://diataxis.fr/start-here/)
- 문서는 사용자 요구의 구조에 맞춰 조직해야 하며, 프레임워크는 내용(무엇을)·문체(어떻게)·구조(어떻게 조직)를 다룬다. 전부 채택할 필요 없이 조금씩 개선하라 — [Diátaxis 홈](https://diataxis.fr/), [Start here](https://diataxis.fr/start-here/)

### Inferences
- 26514의 정보 유형과 대응: 개념 정보 ≈ 설명, 지시 정보(절차) ≈ 방법 안내, 튜토리얼(2008판 11.7.4) ≈ 튜토리얼, 참조 정보 ≈ 참조. 두 체계가 서로 모순되지 않으므로 함께 기준으로 삼을 수 있다.
- 한 권 PDF에 적용하는 예(제안): ① 시작하기(첫 편성 한 번 따라 하기 = 튜토리얼) → ② 업무별 방법(편성 만들기, 조건 바꾸기, 결과 비교, 내보내기 = 방법 안내) → ③ 화면·항목·규칙 참조(각 화면 항목 표, 규칙 목록, 용어 = 참조) → ④ 알아두기(일정이 어떻게 만들어지는지, 점수·우선순위의 뜻 = 설명). 각 장 안에서는 유형을 섞지 않고, 필요한 곳에서 다른 장으로 쪽 번호를 걸어 연결한다.
- 비개발자 독자에게는 "설명" 장을 짧게 앞쪽(개요)과 뒤쪽(심화)으로 나누는 것이 실무적으로 흔하나, 이는 Diátaxis 문서 자체의 지시가 아니다.

### Gaps
- Diátaxis 사이트의 "복잡한 계층" 관련 페이지(diataxis.fr/complex-hierarchies/)는 404로 확인 못 함. 인쇄·PDF 단일 문서에 대한 Diátaxis 공식 지침은 찾지 못함.

---

## 3. Microsoft·Google·Apple 스타일 가이드: 절차, UI 이름, 화면 캡처, 쉬운 말

### Takeaway
세 가이드는 공통으로 **번호 목록·한 단계 한 행동·명령형·"어디서" 먼저 "무엇을" 나중에·UI 이름은 굵게, 화면에 보이는 그대로·짧고 쉬운 말**을 요구한다. 화면 캡처는 "찾기 어려운 요소일 때만, 필요한 부분만 잘라서, 최신으로, 개인정보는 불투명 가림"(Google)이 가장 구체적이다.

### Cited Findings
**Microsoft Writing Style Guide (페이지 갱신 2026-10-15)**
- 절차 제목은 무엇을 하게 돕는지 간결히, 제목끼리 같은 문형(예: "Create a profile / Add an account"). 도입 문장은 제목을 반복하지 말 것 — [Writing step-by-step instructions](https://learn.microsoft.com/en-us/style-guide/procedures-instructions/writing-step-by-step-instructions)
- 여러 단계는 번호 목록, 지시마다 별도 단계(같은 위치의 짧은 단계는 합쳐도 됨), 확인/적용 같은 마무리 행동 포함, 단계가 너무 많지 않게 "한 화면에 들어가게" — 같은 출처
- 한 단계뿐이면 번호 대신 글머리표 — 같은 출처
- 단계는 완전한 문장, 명령형 동사로 시작. 행동 전에 위치를 먼저 알려 줌(예: "On the **Design** tab, select **Header Row**"). 메뉴 경로는 `>`로 줄일 수 있으나 화면 낭독기가 `>`를 건너뛸 수 있다는 접근성 주의 — 같은 출처
- 버튼·체크박스·메뉴·탭 이름은 굵게, 주 동사는 "Select", 요소 종류(버튼 등)는 필요할 때만 표기 — [Formatting text in instructions](https://learn.microsoft.com/en-us/style-guide/procedures-instructions/formatting-text-in-instructions), [Procedures and instructions checklist](https://learn.microsoft.com/en-us/style-guide/checklists/procedures-and-instructions-checklist)
- 문체 10대 원칙: 더 큰 생각을 더 적은 말로, 말하듯 쓰기(전문 용어·기술적 표현 피하기), 친근하게, 요점을 먼저(핵심어를 앞에), 간결하게, 제목 끝에 마침표 없음, 동사로 시작하고 "할 수 있습니다/~이 있습니다" 같은 약한 표현 줄이기 — [Top 10 tips for Microsoft style and voice](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice)

**Google developer documentation style guide**
- 대부분의 절차는 제목 이상의 맥락을 주는 도입 문장으로 시작. 번호 단계, 한 단계 한 행동, 명령형, 완전한 문장. 방법이 여러 개면 가장 좋은 하나만 문서화 — [Procedures](https://developers.google.com/style/procedures)
- 위치를 먼저, 목표를 먼저("To start a new document, click **File > New > Document**"). 선택 단계는 "Optional:"로 시작. 하위 단계는 a, b, c — 같은 출처
- UI 요소 이름은 굵게, 메뉴 경로는 `>`. "위/아래/오른쪽" 같은 방향어로 안내하지 말 것. UI 요소가 찾기 어려우면 화면 캡처 제공 — 같은 출처
- 이미지: 말로 설명하기 어려울 때만 사용, 중요한 정보를 이미지에만 의존하지 말고 글로도 제공, 화면 캡처는 논의에 필요한 UI만 잘라서, 문서 전체에서 같은 스타일, UI가 바뀌면 다시 캡처(유지보수의 일부), 개인정보는 100% 불투명 단색으로 가림(흐림·모자이크 금지), 이미지 속 글은 짧게, 번호 콜아웃은 그림 설명을 돕는 용도로만, 대체 텍스트 155자 이내, "위 그림" 대신 그림 번호로 참조 — [Images](https://developers.google.com/style/images)
- 알림 상자: Note(넘어가도 되는 유용한 정보), Caution(조심해서 진행), Warning(하지 말아야 할 것·되돌릴 수 없는 결과, 예: 데이터 영구 손실). 작업 성공에 꼭 필요한 정보·사전 조건·절차 단계는 알림 상자에 넣지 말고 본문 해당 단계 앞에. 아껴 쓰고, 두 개를 연달아 두지 말 것 — [Notices](https://developers.google.com/style/notices)

**Apple Style Guide**
- 공식 현행 페이지는 이번 조사에서 직접 확인하지 못함. 2차 자료: Apple은 "select"와 "choose"를 구분(대상을 select하고 그 대상에 적용할 명령을 choose) — [Brent Simmons, inessential (2019)](https://inessential.com/2019/12/30/reminder_select_and_choose_are_not_synon.html). 다만 한 블로그 요약은 이와 상충하는 설명을 하고 있어 현행 가이드 확인 필요(같은 검색 결과 내 상충).
- 옛 Apple HIG: 사용자의 언어로 말하고 공간 때문에 명확성을 희생하지 말 것, 레이블에 전문 용어 피하기, UI 레이블 대소문자 방식 일관 — [Apple FxPlug HIG Text Style Guidelines](https://developer.apple.com/library/archive/documentation/FinalCutProX/Conceptual/FxPlugHIG/TextStyleGuidelines/TextStyleGuidelines.html)

### Inferences
- 한국어 적용 예: "**편성 시작** 단추를 누릅니다" 대신 위치 먼저 → "**새 편성** 화면에서 **편성 시작**을 누릅니다." 결과는 같은 단계 끝에 "잠시 뒤 진행 막대가 나타납니다."처럼 붙인다(26514 "소프트웨어 반응은 단계가 아니다"와 일치).
- 한국어 UI 동사는 MS의 select/Google의 click 구분이 그대로 옮겨지지 않으므로 "누르다(단추)·고르다(목록·선택지)·입력하다(칸)"처럼 프로젝트 자체 용어표를 정해 일관되게 쓰는 것이 세 가이드의 공통 취지(일관성)에 맞다.
- 화면 캡처는 웹 화면이 자주 바뀌는 점을 고려해 "꼭 필요한 곳·잘라서·번호 콜아웃 + 본문 설명"으로 최소화하는 Google 방식이 유지보수 비용 면에서 유리하다.

### Gaps
- Microsoft 가이드의 화면 캡처 전용 규칙은 공식 페이지에서 찾지 못함(2차 자료뿐).
- Apple Style Guide 현행판(Apple Books/웹) 원문 미확인.

---

## 4. 한국 지침: 공공 SW 산출물, TTA, NCS, 국립국어원

### Takeaway
한국에는 **사용자 매뉴얼 목차를 정한 단일 국가 표준(TTA 등)은 확인되지 않았다.** 공공 사업은 행정안전부 「행정기관 및 공공기관 정보시스템 구축·운영 지침」이 "표준산출물"과 운영 매뉴얼의 제출 근거만 두고, 실제 목차는 발주기관 양식·실무 관행(개정 이력 → 목차 → 시스템 개요 → 메뉴 구성 → 화면별 설명 → 문제 해결)을 따른다. 문장은 국어기본법 제14조와 국립국어원 『쉬운 공문서 쓰기 길잡이』(2022)의 "짧게, 쉬운 말로, 순화어로" 원칙이 기준이 된다.

### Cited Findings
**공공 SW 사업 산출물**
- 행정안전부 「행정기관 및 공공기관 정보시스템 구축·운영 지침」(2019·2022 개정, 행정안전부고시 제2023-27호 2023-04-18 시행 등): 기관장은 운영·유지관리에 필요한 표준산출물을 지정해 제출을 요구할 수 있고, 사업자는 반복 수행 사항을 매뉴얼로 작성·관리해 요구 시 제공해야 한다. 단, 사용자 매뉴얼/운영자 매뉴얼을 따로 정의한 목차는 조문에서 확인되지 않음 — [행정안전부 고시 개정 공지](https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=100043), [국민건강보험공단 법령 전문 사본](https://www.nhis.or.kr/lm/lmxsrv/law/lawFullContent.do?SEQ=1541&SEQ_HISTORY=44805)
- 한국소프트웨어산업협회 『소프트웨어 사업 가이드북 ver 3.0』은 산출물 종류로 요구사항 분석서·상세설계서·프로그램 명세서·시험계획서·**사용자 지침서** 등을 나열 — [KOSA 가이드북](https://www.sw.or.kr/upload/common/027d281c-2a7a-4886-b96b-e9ad04c7a309.pdf)
- NIPA "SW 개발 산출물 작성 가이드(SW개발도우미, 2013)"가 있으나 접속 시 인증서 오류로 매뉴얼 목차 확인 실패 — [swbank.kr](http://www.swbank.kr/html/sample/sample_index.jsp)
- SI 산출물 정리 위키: 사용자 매뉴얼 = 최종 시스템 사용자에게 제공되는 매뉴얼 — [인코덤 SI 산출물](https://incodom.kr/SI_%EC%82%B0%EC%B6%9C%EB%AC%BC)

**실제 공공·대학 매뉴얼의 목차 관행**
- 서울시 저작권 유통관리 통합사업관리시스템 사용자 매뉴얼: 표지 → **제·개정 이력 표(버전, 변경일자, 제·개정 구분, 개정 내용, 작성자)** → 목차 → 업무별 화면 설명(그림 번호 붙은 등록·수정 화면 단위) — [서울시 PDF](https://news.seoul.go.kr/economy/files/2015/07/55b97e96085251.67161727.pdf) (검색 요약 기준)
- 한성대 관리자 매뉴얼: 1장 시스템 개요 아래 **매뉴얼의 구성, 용어 설명, 서비스 개요, 구성 및 체계** 순 — [한성대 관리자매뉴얼](https://hansung.ac.kr/sites/homepage/contents/homepage/%EA%B4%80%EB%A6%AC%EC%9E%90%EB%A7%A4%EB%89%B4%EC%96%BC.pdf) (검색 요약 기준)
- 서울과기대 사이트 관리자 매뉴얼: **메뉴 구성**을 별도 장으로 두고 하위 절로 세분 — [서울과기대 매뉴얼](https://itc.seoultech.ac.kr/storage/itc2/ckfinder/files/SNUST1627000530568.pdf) (검색 요약 기준)

**NCS·정보처리기사 계열 설명(2차 자료, 블로그)**
- 사용자 매뉴얼 기본 구성: **목차 및 개요, 서문(문서 이력·주석 등), 기본 사항(기능·UI 설명)**. 목차는 전체 내용을 순서대로 요약하고 시작 쪽을 함께 적음. 작성 순서: 작성 지침 정의 → 구성 요소 정의 → 구성 요소별 내용 작성 → 검토. 화면을 캡처해 이해하기 쉽게 구성 — [velog 제품 소프트웨어 매뉴얼 작성](https://velog.io/@ln1992/8%EC%9D%BC%EC%B0%A8-3-2-%EC%A0%9C%ED%92%88-%EC%86%8C%ED%94%84%ED%8A%B8%EC%9B%A8%EC%96%B4-%EB%A7%A4%EB%89%B4%EC%96%BC-%EC%9E%91%EC%84%B1), [velog 소프트웨어 사용자 매뉴얼 작성](https://velog.io/@clay/%EC%86%8C%ED%94%84%ED%8A%B8%EC%9B%A8%EC%96%B4-%EC%82%AC%EC%9A%A9%EC%9E%90-%EB%A7%A4%EB%89%B4%EC%96%BC-%EC%9E%91%EC%84%B1) (두 페이지 모두 열기 실패 504, 검색 요약 기준)
- 기술 매뉴얼 실무 글: 문제 해결은 오류마다 **증상·원인·대처 방법**을 적고, 해결법이 여러 개면 **간단한 것부터 복잡한 순**으로 — [텍스트리 블로그](https://textree.co.kr/blog/user-guide-step), [한샘글로벌 블로그](https://hansem.com/ko/blog/%EC%82%AC%EC%9A%A9%EC%84%A4%EB%AA%85%EC%84%9C-%EC%A0%9C%EC%9E%91-%EA%B8%B0%EC%88%A0-%EA%B5%AC%EC%84%B1/) (검색 요약 기준, 원문 상세 미확인)

**TTA**
- 사용자 매뉴얼 작성 전용 TTAK.KO 표준은 찾지 못함. 관련: TTAS.KO-11.0020 소프트웨어 프로젝트 관리 문서 작성 지침, TTAS.KO-11.0003 기본설계 단계 문서 작성 지침(1998), 접근성 쪽 **TTAK.KO-10.0772 이미지의 대체 텍스트 작성 지침** — [TTA 11.0020](https://committee.tta.or.kr/summary/standard_view.jsp?std_no=KO&pk_num=TTAS.KO-11.0020&nowSu=4064&section_code=), [TTA 10.0772](https://committee.tta.or.kr/data/standard_view.jsp?rn1=Y&standard_no=TTAK.KO-10.0772&pk_num=TTAK.KO-10.0772&nowSu=1&rn=1)

**국립국어원·쉬운 말**
- 국어기본법 제14조: 공공기관 공문서는 일반 국민이 알기 쉬운 용어와 문장으로, 어문 규범에 맞게 한글로 작성(괄호 안 한자·외국 글자는 대통령령이 정한 경우만). 2022년부터 공문서 평가 시행 — [아주경제 2022](https://www.ajunews.com/view/20221030094954021), [문체부 보도자료](https://www.mcst.go.kr/site/s_notice/press/pressView.jsp?pSeq=12992) (검색 요약 기준, 법령 원문 미확인)
- 『쉬운 공문서 쓰기 길잡이』(국립국어원, 2022, 공공데이터포털 배포): '쉬운 공공언어 쓰기 지침' 기반, 1부 공공언어 요건 확인 / 2부 단계별 작성 / 3부 유형별 실제 문서. 요건: 간결성(문장을 짧게 끊어 항목별로), 용이성, 정확성, 표현성. 어려운 전문어·신조어·한자어·외래어는 순화어로 — [공공데이터포털 길잡이](https://www.data.go.kr/data/15118448/fileData.do), [국립국어원 자료](https://www.korean.go.kr/front/etcData/etcDataView.do?mn_id=208&etc_seq=700)
- 국립국어원 「쉽고 바른 공공언어 쓰기 평가용 용어 목록」(2024-02-28): 외래어·오류 표기와 권장 쉬운 말 대안(1,331행) — [공공데이터포털](https://www.data.go.kr/data/15130006/fileData.do)
- 국립국어원 '공공언어 진단 기준'(2010): 정확성·소통성, 권위적 표현, 정보의 형식과 양, 쉬운 용어 등 — [디지털투데이 기사](https://ditoday.com/%EB%8B%A8%EC%96%B4-%EC%88%9C%ED%99%94%EB%A1%9C%EB%8A%94-%EB%B6%80%EC%A1%B1-%EB%94%94%EC%A7%80%ED%84%B8-%EA%B3%B5%EA%B3%B5%EC%96%B8%EC%96%B4-%EC%96%B4%EB%96%A4-%EB%AA%A8%EC%8A%B5%EC%9D%B4/) (2차 자료, 검색 요약 기준)

### Inferences
- 한국 공공·SI 관행의 "표준 목차"는 사실상 다음 순서로 수렴한다: 표지 → 제·개정 이력 → 목차 → 1. 개요(목적·대상 독자·매뉴얼 구성·용어) → 2. 시스템 개요(구성·메뉴 구조·접속 방법·화면 공통 요소) → 3~N. 업무(메뉴)별 화면 설명 → 문제 해결/FAQ → 부록(용어, 문의처). 이는 26514:2008의 구성 요소(식별 정보·문서 사용법·운영 개념·절차·오류·용어)와 대체로 대응한다.
- 한국 관행은 "메뉴(화면) 순서" 구성이 많은 반면 Diátaxis(방법 안내 = 업무 목표 중심)와 26514의 독자·작업 분석 절은 "업무(과제) 순서" 쪽에 가깝다(26514가 업무 순서를 명시적으로 요구하는지는 본문 미확인). 비개발자 직원용이라면 업무 순서로 장을 짜고, 화면별 항목 설명은 참조 장(또는 부록)으로 모으는 절충이 두 쪽 모두와 맞는다.
- 공공기관 사용 전제가 아니어도, 화면 문구와 매뉴얼 용어를 국립국어원 순화어 목록과 한 번 대조하는 것이 "쉬운 말" 기준을 객관적으로 설명하는 근거가 된다.

### Gaps
- NIA(한국지능정보사회진흥원)·NIPA의 공식 "사용자 매뉴얼/운영자 매뉴얼" 산출물 양식(목차 템플릿) 원문은 찾지 못함(swbank.kr 인증서 오류, 지침 본문에는 목차 없음).
- 「정보시스템 구축·운영 지침」 현행본의 표준산출물 목록(별표)에 사용자·운영자 매뉴얼이 명시되는지 확인 못 함.
- NCS 학습모듈 "제품소프트웨어 패키징"(한국산업인력공단) 원문 미확인 — 블로그 요약만 확인.
- 『쉬운 공문서 쓰기 길잡이』 PDF 원문의 세부 항목은 직접 읽지 못함(목차·요건 요약 수준).

---

## 5. 분량, 화면 캡처, 알림 상자(참고·주의), 버전 이력, PDF 접근성

### Takeaway
분량에 대한 표준 수치는 없고, 표준은 "최소주의(꼭 필요한 정보 + 완전성에 필요한 최소)"와 "한 절차는 한 화면 분량"을 원칙으로 한다. 화면 캡처는 필요한 곳에 잘라서·번호 붙여·글로도 같은 내용 제공, 알림은 참고/주의/경고 3단계를 아껴 쓰기, 버전 이력은 표지 뒤 개정 이력 표, PDF 접근성은 PDF/UA(ISO 14289) 기준의 태그·제목 계층·책갈피·대체 텍스트·문서 언어 설정이 관행이다.

### Cited Findings
- 분량 원칙: 26514 최소주의 정의, 품질 항목으로 간결성·최소주의 — [DIS 26514 샘플](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf); 절차는 "한 화면에 들어가게" — [MS step-by-step](https://learn.microsoft.com/en-us/style-guide/procedures-instructions/writing-step-by-step-instructions)
- 화면 캡처: 26514 2008판 12.18(언제 쓰나, 상세 수준, 그림 식별, 화면 그림) / 2022판 9.14(일관 표현, 배치, 화면 정보 그림), 9.5.3 비텍스트 대체 텍스트 — [2008 샘플](https://cdn.standards.iteh.ai/samples/43073/d8447563ac1e481897744ba18955894d/ISO-IEC-26514-2008.pdf), [DIS 샘플](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf); Google 이미지 규칙(필요한 부분만 자르기, 최신 유지, 개인정보 불투명 가림, 그림 번호로 참조) — [Google Images](https://developers.google.com/style/images)
- 알림 상자: 26514는 위험(danger)·경고(warning)·주의(caution)를 정의하고 형식 절(2008 12.15 "경고·주의·참고", 2022 9.11)을 둠 — 위 두 샘플; Google은 Note/Caution/Warning과 사용 조건 제시 — [Google Notices](https://developers.google.com/style/notices)
- 버전 이력: 26514 2022판 6.12 버전 관리·변경 관리, 6.11 갱신·유지 — [DIS 샘플](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf); 한국 공공 매뉴얼은 표지 뒤 제·개정 이력 표(버전·일자·구분·내용·작성자) — [서울시 매뉴얼 PDF](https://news.seoul.go.kr/economy/files/2015/07/55b97e96085251.67161727.pdf)
- PDF 접근성: PDF/UA-1(ISO 14289-1, 2012, PDF 1.7 기반), PDF/UA-2(ISO 14289-2, 2024, PDF 2.0 기반). 의미 있는 내용은 하나의 구조 트리에 태그, 제목은 단계대로 중첩, 표는 머리글 셀, 이미지는 대체 텍스트 또는 장식(artifact) 표시, 문서 언어 지정, 글꼴 포함, 글자를 이미지가 아닌 선택 가능한 텍스트로 — [pdf-tools PDF/UA 설명](https://www.pdf-tools.com/pdf-ua-standard-explained), [Nutrient PDF/UA 가이드](https://www.nutrient.io/blog/pdf-ua-compliance-guide/)
- 책갈피: PDF/UA가 필수로 요구하지는 않는다는 설명(Oracle)과, 긴 문서에 책갈피가 없으면 Acrobat·Deque 검사기가 오류/중간 영향 문제로 표시한다는 설명이 공존 — [Oracle BI Publisher 문서](https://docs.oracle.com/middleware/bi12214/bip/BIPRD/GUID-2447AD55-840D-430A-BDAD-09E21206A3B3.htm), [Deque PDF Results](https://docs.deque.com/monitor/8.0/en/pdf-results), [Markup UK 2019](https://markupuk.org/2019/webhelp/sec-pdfua.html)
- 한국: 이미지 대체 텍스트 작성 지침 TTAK.KO-10.0772 — [TTA](https://committee.tta.or.kr/data/standard_view.jsp?rn1=Y&standard_no=TTAK.KO-10.0772&pk_num=TTAK.KO-10.0772&nowSu=1&rn=1)
- 접근성 관련 절차 표기: `>` 경로 표기는 화면 낭독기가 건너뛸 수 있음 — [MS step-by-step](https://learn.microsoft.com/en-us/style-guide/procedures-instructions/writing-step-by-step-instructions); 색에만 의존하지 말 것은 26514 9.9 "색 사용" 절 존재로만 확인 — [DIS 샘플](https://cdn.standards.iteh.ai/samples/77451/1a554e3e44ba4735afd336ccfe48e9e5/ISO-IEC-IEEE-DIS-26514.pdf)

### Inferences
- 비개발자 대상 웹 시스템 PDF 매뉴얼의 실무 기준(제안): 장마다 첫 쪽에 "이 장에서 할 수 있는 일" 한 줄, 절차 1개당 단계 3~7개 정도(“한 화면” 원칙의 한국어 PDF 환산 — 수치는 표준이 아니라 추정), 캡처는 절차당 0~1장·잘라서·번호 콜아웃, 알림 상자는 참고/주의 2종 위주(경고는 데이터 삭제·되돌릴 수 없는 작업에만), 표지 뒤 개정 이력 표, PDF 내보내기 시 태그·책갈피·문서 언어(ko) 설정.
- 제목 계층(장·절)을 워드프로세서/HTML의 실제 제목 스타일로 만들면 PDF 책갈피·목차·태그가 함께 생기므로 PDF/UA 요구와 26514 탐색 기능(목차·같은 정보 다시 찾기) 요구를 한 번에 충족한다.

### Gaps
- 사용자 매뉴얼 적정 분량(쪽 수, 절차당 단계 수)에 대한 신뢰할 만한 표준·연구 수치는 찾지 못함.
- 한국 웹 접근성 지침(KWCAG 2.2, KS X OT0003)의 PDF 문서 적용 범위는 이번 조사에서 확인하지 않음.
- STC·ISTC·tcworld 등 기술문서 협회 자료는 도구 호출 한도로 조사하지 못함.
