# 개인·사이드·오픈소스 프로젝트 발표의 구성 관행과 발표 설계 원칙

조사일: 2026-11-08. 대상 발표: 산업공학·최적화 엔지니어 한 명이 개인 프로젝트로 만든 KBO 시즌 일정 자동 편성(조합 최적화 엔진 + 웹 스튜디오 + 공개 사이트 schedulelab.kr). 목적은 판매·투자가 아니라 발표자 개인의 평판. 핵심 15분, 업계 행사용 20~30분, 기자 설명용 7~10분.

출처 표기 원칙: 원문을 직접 읽은 것만 따옴표로 인용했다(TEDx 발표자 안내서 PDF 본문, NHN FORWARD 발표 슬라이드). 나머지는 검색 요약이나 2차 정리를 바탕으로 풀어 썼고, 그렇다는 점을 표시했다.

## 1. 개발자 행사에서 개인·사이드·오픈소스 프로젝트 발표는 어떻게 짜이는가 (순서, 장수, 구간별 시간)

### Takeaway
실제로 확인한 한국 사례(NHN FORWARD 2020, TOAST UI 오픈소스 발표, 66장)와 영문 가이드들의 공통 순서는 "숫자로 보여 주는 짧은 자기·프로젝트 소개 → 왜 했나/무엇을 배웠나 → 청중이 가져갈 방법 → 한 줄 메시지와 행동 제안"이다. 행사 형식은 인프콘 40분 발표+40분 질의응답, TEDx 18분 이하, 라이트닝 5분 수준으로 갈린다. 장수는 "1분에 1장"부터 "30분에 100장"까지 발표 방식에 따라 폭이 크다.

### Cited Findings
**한국 사례**
- NHN FORWARD 2020(2020-12-29), 「오픈소스 메인테이너로 성장하기 (feat. TOAST UI)」는 66장이고 순서가 ① 시작하기 전에(자기·프로젝트 소개) ② 어떤 점이 나를 성장시켰나(넓은 참여, 범용 기능 고민, 소통 연습, 결과가 밖에서 보임, 4가지) ③ 그럼, 어떻게 시작할까(프로젝트 고르기, 기존 프로젝트 참여, 이슈·PR 예절, 소통 채널, 직접 시작, 저장소 필수 파일, 홍보, 이슈·PR 대응)이다. — [Speaker Deck: hanjung, NHN FORWARD 2020](https://speakerdeck.com/hanjung/opeunsoseu-meinteineoro-seongjanghagi-feat-dot-toast-ui)
- 같은 발표의 자기소개는 숫자로 짜여 있다. 5개 브랜드·13개 컴포넌트·MIT 라이선스, 5개 앱 합계 GitHub 스타 29,636개, npm 내려받기 4,507,082회(2019년 1월~2020년 10월), 그리고 발표자가 맡은 Grid 4.x 개발과 Chart 3.x·4.x 유지보수. — [같은 덱](https://speakerdeck.com/hanjung/opeunsoseu-meinteineoro-seongjanghagi-feat-dot-toast-ui)
- 같은 발표의 마지막 부분은 62장 한 줄 메시지 "오픈 소스는 나와 기술 생태계 모두에게 도움이 되는 훌륭한 활동이다."와 미루지 말고 쉬운 것부터 시작하라는 권유, 63장 "❤ PRs" 그림, 64장 「감사합니다!」, 65장 행사 저작권 표기다. 판매 요청은 없고 행동 권유로 끝난다. — [같은 덱](https://speakerdeck.com/hanjung/opeunsoseu-meinteineoro-seongjanghagi-feat-dot-toast-ui)
- 인프콘 2024는 세션을 40분 발표와 40분 질의응답으로 운영했다는 운영진 인터뷰가 있다(검색 요약 기준, 원문 미확인). — [요즘IT 인프콘 관련 글](https://yozm.wishket.com/magazine/detail/2740/)
- 인프콘 발표자는 1차 자료를 정해진 기간까지 내고, 발표자 사전 모임에서 대면 피드백을 받은 뒤 최종 자료를 만든다는 설명이 있다(검색 요약 기준, 원문과 정확한 링크 미확인). — [요즘IT](https://yozm.wishket.com/magazine/questions/share/PgNwiSyhmh1C9wLR/)
- 인프런 퇴근길 밋업 #04(사이드 프로젝트 주제)의 한 발표는 사이드 프로젝트를 1년 운영하며 도움이 된 네 가지 동력(기술적 성장, 비용 최적화, 충성 유저, 감시 체계)을 묶어서 소개했다. 개인 서비스 운영 경험을 "배운 것 N가지"로 정리하는 전형적인 틀이다. — [인프런 퇴근길 밋업 04](https://www.inflearn.com/course/인프런-퇴근길-밋업-04-사이드프로젝트)
- if(kakao)는 카카오의 기술과 노하우를 밖에 공유하는 행사이고 현직 개발자가 실제 개발 사례를 발표한다(2018년 기사). 2019년 발표 자료와 영상은 공개됐다. — [아이뉴스24](https://www.inews24.com/view/1116323); [GeekNews 주간 #11](https://news.hada.io/weekly/201938)

**국제 사례와 가이드**
- TEDx 공식 안내서가 권하는 구조(4단계): 1) 친숙한 예나 흥미로운 아이디어로 청중이 관심을 갖게 한다 → 2) 아이디어를 분명하고 확신 있게 설명한다 → 3) 증거와 실행 방법·이유를 보인다 → 4) 아이디어를 받아들이면 청중에게 어떤 영향이 있는지로 끝낸다. 또 "Your structure should be invisible to the audience"라고 해서 목차 슬라이드처럼 구조를 말로 설명하지 말라고 한다. 날짜 표기는 없다. — [TEDx Speaker Guide (PDF)](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- 영문 기술 발표 가이드(2026년 블로그, 2차 자료)는 첫머리에 관심 끌기(Hook), 자격 제시(Credibility), 순서 안내(Roadmap)를 넣으라고 한다. 또 데모 중심 구성이 오픈소스 프로젝트 발표에 맞지만 데모가 실패하면 위험이 크다고 짚는다. 순서 안내를 넣으라는 점은 TEDx의 "구조를 드러내지 말라"와 반대다. — [youngju.dev 영문 기술 발표 가이드](https://www.youngju.dev/blog/english/2026-03-05-english-tech-presentation-conference-guide); 반대 의견은 [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- 한국어 기술 발표 가이드(2026년 블로그)는 슬라이드를 만들기 전에 청중 분석(기술 수준, 이미 아는 것, 얻고 싶은 것)과 "발표 후 청중이 무엇을 하길 바라는가"를 먼저 정하라고 하고, 준비 시간의 절반을 내용에 쓰라고 권한다. — [youngju.dev 기술 발표 준비 가이드](https://www.youngju.dev/split/culture/2026-03-13-technical-presentation-preparation-delivery-storytelling)
- Michael Trick(최적화 연구자)의 스포츠 일정 편성 강연은 실제 편성 경험(대학 농구, MLB, MLB 심판)에서 시작해 방법론(조합 Benders 분해)과 OR 분야 흐름으로 넓혀 간다. 2012년 홍콩중문대 세미나와 2017년 9월 위스콘신 강연이 있다. 최적화 엔지니어가 스포츠 일정 편성을 이야기하는 선례다. — [CUHK 세미나 2012](https://seminar.se.cuhk.edu.hk/node/19); [UW–Madison 2017](https://today.wisc.edu/events/view/114048)
- NFL은 2013년부터 Gurobi 수리최적화로 일정을 짠다고 소개됐고 관련 웨비나·기조연설(2021-05-03 행사 목록)이 있다. 해당 Gurobi 페이지는 직접 읽으려 했으나 404였다. — [Utility Analytics Summit 세션 목록](https://www.utilityanalyticssummit.com/uasummit/session/452999/keynote-webinar-optimization-and-the-nfl’s-toughest-scheduling-problem); [Gurobi 스포츠 일정 웨비나 2023-11-30](https://www.gurobi.com/resources/webinar-events/optimization-in-sports-scheduling)

**장수와 시간**
- TEDx: 18분 이하, 넘길 수 없다. "Shorter talks are not lesser talks. It may only take 5 minutes to make your point unforgettably." — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- 한국어·영문 가이드에서는 슬라이드 1장에 약 1분을 잡는 게 일반적이라고 한다(2차 자료). — [youngju.dev](https://www.youngju.dev/blog/english/2026-03-05-english-tech-presentation-conference-guide)
- Zach Holman(GitHub 초기 개발자, speaking.io 저자)은 30분 발표에 약 100장을 쓰기도 했다고 하나, 장수는 주제와 발표자에 달렸다고 했다(2014 Gigazine의 speaking.io 요약, 2차 자료). 이것은 "1분에 1장"과 크게 다르다. — [Gigazine 2014-01-20](https://gigazine.net/gsc_news/en/20140120-speaking-io/)
- Guy Kawasaki의 10/20/30 규칙(2005-12-30 블로그 글)은 슬라이드 10장, 20분, 글자 30pt 이상이다. 근거로 사람이 한 모임에서 10개 넘는 개념을 이해하기 어렵다는 점을 들었다. 원래는 투자 유치 발표용이다. 원문 페이지는 403이라 날짜와 내용은 2차 자료로 확인했다. — [memex.naughtons.org](https://memex.naughtons.org/?p=2658); [CBS News](https://www.cbsnews.com/news/improve-your-powerpoint-presentations-with-guy-kawasakis-10-20-30-rule/); [Manner of Speaking 2010](https://mannerofspeaking.org/2010/03/09/powerpoint-math-the-10-20-30-rule/)
- 행사 쪽 리허설 관행: React Conf 조직위원 Sophie Alpert는 행사 전 몇 주 동안 연사별 사전 연습(dry run)을 한다고 밝혔다(2018-10-19). — [sophiebits.com](https://sophiebits.com/2018/10/19/conference-talk-dry-runs.html)

### Inferences
- 확인된 한국 사례 하나(NHN)와 TEDx 4단계를 겹치면 개인 프로젝트 발표의 뼈대는 이렇게 된다. ① 청중이 아는 것에서 시작(KBO 일정표) ② 한 문장 아이디어 ③ 증거(실제 일정과 숫자 비교) ④ 청중에게 미치는 영향 또는 행동 제안.
- 인프콘처럼 질의응답이 발표만큼 긴 행사라면 질의응답용 예비 슬라이드(엔진 내부, 제약 목록, 실험 기록)가 본 발표 장수만큼 중요하다.
- Trick의 강연처럼 최적화 쪽 발표의 관행은 "실제 편성 경험 → 문제 크기와 제약 → 방법 → 결과"다. KBO 발표도 같은 순서를 쓰면 OR·산업공학 청중에게 익숙하다.
- 장수 기준이 갈리므로(1분에 1장 대 30분에 100장), 주장-증거형 슬라이드(4번 질문)를 쓴다면 1분에 1~2장이 맞다. 15분이면 12~20장 정도다(추론).

### Gaps
- if(kakao), DEVIEW, 우아콘, FEConf, PyCon Korea에서 개인 프로젝트 발표의 실제 목차·장수·구간별 시간을 원문으로 확인하지 못했다. 검색에서 나온 것은 행사 성격과 자료 공개 소식뿐이다.
- PyCon Korea에서 야구 데이터나 스포츠 일정을 다룬 개인 발표는 검색으로 찾지 못했다.
- Strange Loop, GOTO, NDC의 발표 구성 안내(CFP·연사 가이드)는 이번에 확인하지 못했다.
- 후보로만 찾은 덱: 「한국 오픈소스 생태계」(skydoves) — [Speaker Deck](https://speakerdeck.com/skydoves/kr-open-source-ecosystem). 내용은 읽지 않았다.
- 구간별 분 단위 배분을 공식으로 정한 1차 자료는 찾지 못했다. "3분 관심 끌기/3분 아이디어/9분 본론/3분 요청" 같은 18분 배분은 컨설팅 업체의 제안이고 TED 공식이 아니다 — [library-d7m TED talk structure](https://library-d7m.pages.dev/communication-framework/storytelling-and-presentation/ted-talk-structure).

## 2. 평판이 목적인 발표자는 자신을 어떻게 소개하고 신뢰를 쌓는가, 마지막 장에는 무엇을 두는가

### Takeaway
1차 자료(TEDx 안내서)는 자기 이야기를 길게 하지 말고("Don't focus too much on yourself"), 반론과 "틀릴 수 있는 이유"를 직접 다루며, 판매 요청 없이 끝내되 알맞으면 행동을 요청하라고 한다. 확인한 한국 사례는 자기소개를 이력 대신 숫자(스타, 내려받기, 맡은 버전)로 했고, 마지막을 "같이 하자/지금 시작하라"는 권유로 닫았다. 평판은 자기 소개 슬라이드보다 공개된 결과물과 검증 초대에서 나온다.

### Cited Findings
- TEDx 도입부 원칙: "Get your idea out as quickly as possible.", "Don't focus too much on yourself.", "Don't open with a string of stats." — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- TEDx 본론 원칙: 반론, 틀릴 수 있는 이유, 청중이 품을 의심을 정중하게 다루라고 한다("(Respectfully) address any controversies in your claims, including legitimate counter-arguments, reasons you might be wrong, or doubts your audience might have about your idea."). 경험적 증거를 쓰고 일화는 줄이며, 전문 용어는 줄이거나 풀어 설명하라고 한다. 출처 표기는 흐름을 끊지 않게 뒤에 두거나 작은 글씨로 넣으라고 한다. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- TEDx 결론 원칙: 이미 말한 것을 요약하지 말고, 아이디어가 실현되면 청중의 삶이 어떻게 달라지는지 말하라고 한다. "Avoid ending with a pitch (such as soliciting funds, showing a book cover, using corporate logos)." "If appropriate, give your audience a call to action." — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- TEDx는 새 연구를 발표한다면 데이터와 동료 검토로 뒷받침하라고 하고, 행동 요청을 한다면 청중이 실제로 할 수 있는 것이어야 한다고 한다. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- NHN FORWARD 사례: 자기소개는 맡은 프로젝트의 규모와 공개 지표(스타 29,636개, npm 내려받기 4,507,082회, 기간 명시)로 하고, 마지막은 한 줄 메시지 + 쉬운 것부터 시작하라는 권유 + PR 환영 그림 + 감사로 닫았다. — [Speaker Deck](https://speakerdeck.com/hanjung/opeunsoseu-meinteineoro-seongjanghagi-feat-dot-toast-ui)
- 영문 기술 발표 가이드(2차)는 첫머리에 자격 제시를 넣으라고 한다. 이것은 TEDx의 "자기 이야기에 집중하지 말라"와 긴장 관계다. — [youngju.dev](https://www.youngju.dev/blog/english/2026-03-05-english-tech-presentation-conference-guide)
- 한국어 가이드(2차)는 준비 첫 단계에서 "발표 후 청중이 어떤 행동을 하길 바라는가"를 정하라고 한다. 마지막 장을 처음에 정하라는 뜻이다. — [youngju.dev](https://www.youngju.dev/split/culture/2026-03-13-technical-presentation-preparation-delivery-storytelling)
- 인프런 밋업의 사이드 프로젝트 발표는 운영 1년 동안 쌓인 "충성 유저", "감시 체계" 같은 운영 경험을 신뢰의 근거로 쓴다(검색 요약 기준). — [인프런 퇴근길 밋업 04](https://www.inflearn.com/course/인프런-퇴근길-밋업-04-사이드프로젝트)
- Zach Holman은 좋은 발표를 학술 보고가 아니라 이야기로 본다(Inc. 인터뷰, 2차). — [Inc.](https://www.inc.com/jill-krasny/github-zach-holman-speaking-tips.html?cid=readmore)

### Inferences
- 평판 목적이라도 자기소개 슬라이드는 짧게(한 장, 15초 안쪽). "산업공학·최적화 엔지니어, 혼자 만든 개인 프로젝트" 정도만 말하고, 신뢰는 "실제 2025 일정과 같은 잣대로 비교한 숫자"와 "누구나 들어가 볼 수 있는 사이트"가 대신하게 하는 편이 TEDx 원칙과 맞다.
- NHN 사례처럼 자기소개를 숫자로 한다면, 이 프로젝트에서는 공개 지표(규칙 수, 계산 시간, 실제와 비교한 이동 거리 차이 등 이미 사이트에 있는 숫자)가 그 역할을 한다. 다만 TEDx는 첫머리에 통계를 늘어놓지 말라고 하므로 숫자는 한두 개만 둔다.
- "틀릴 수 있는 이유" 슬라이드(모델이 담지 못한 것: 방송 편성, 구장 사정, 구단 요청 등)를 넣는 것은 TEDx가 직접 권하는 신뢰 장치이고, 3번 질문의 데이터 저널리즘 관행("데이터는 현실을 줄인 것")과도 맞는다.
- 마지막 장 후보(판매 요청 대신): ① 사이트 주소와 QR(직접 만져 보기) ② 검증 초대(같은 조건으로 돌려 보고 틀린 곳을 알려 달라) ③ 협업·자료 제공 요청(실제 편성 조건, 구장 사정을 아는 사람) ④ 연락처. TEDx 기준으로 청중이 그 자리에서 할 수 있는 행동 하나를 맨 앞에 둔다.
- 회사 로고나 후원 문구로 끝내지 말라는 TEDx 원칙은 개인 프로젝트 발표에 그대로 맞는다.

### Gaps
- 평판 쌓기를 목적으로 한 개인 발표자의 자기소개 방식을 다룬 1차 연구나 행사 공식 안내는 찾지 못했다. 위 내용은 TEDx 안내서와 사례 한 건에 기댄다.
- 한국 행사(if(kakao), DEVIEW 등)의 마지막 장 관행을 여러 건 비교한 자료는 찾지 못했다.

## 3. 데이터 저널리즘·시빅테크·공공데이터 발표는 "공개 자료로 다시 만들고 실제와 비교한" 이야기를 어떻게 보여 주는가

### Takeaway
이 분야의 관행은 ① 방법을 따로 공개하고(방법론 글 + 코드·데이터) ② 데이터가 현실을 줄인 것임을 먼저 밝히며 ③ 공식 결과를 기준으로 두고 내 결과는 "참고·추세"로 자리매김하는 것이다. 다만 "다시 만들어 실제와 비교한" 발표의 목차 자체를 1차 자료로 찾지는 못했다.

### Cited Findings
- NICAR(미국 탐사보도기자협회 데이터 저널리즘 학회)는 세션마다 '팁시트'라는 배포 자료를 내고 IRE가 모아 둔다. 2024년 자료와 녹음도 공개됐다. — [Nieman Lab 2025-03](https://www.niemanlab.org/2025/03/you-can-learn-a-conferences-worth-of-data-journalism-through-these-nicar-tipsheets/); [Simon Willison 2024-03-11](https://simonwillison.net/2024/Mar/11/)
- 2014년 NICAR의 데이터 기사 발표는 방법론은 바퀴를 새로 만들지 말라고 하고, 모든 데이터베이스는 현실을 줄인 것이니 데이터의 한계를 먼저 밝히라고 강조했다(검색 요약 기준, 해당 글 원문 미확인). — [MIT Center for Civic Media](https://civic.mit.edu/index.html%3Fp=1823.html)
- 2015년 NICAR 시각화 세션 팁시트는 데이터를 일찍 그려 봐야 일찍 이해한다고 했다(검색 요약 기준). — [journalism.co.uk NICAR15 정리](https://www.journalism.co.uk/tip-of-the-day/tip-check-out-these-data-journalism-resources-and-slides-from-nicar15/s419/a564395/)
- ProPublica의 「Machine Bias」 기사는 분석 노트북과 데이터를 GitHub 저장소(compas-analysis)로 공개했다. README는 저장소가 "contains a Jupyter notebook and data for the ProPublica story "Machine Bias.""라고 밝히고, 방법론 글 「How We Analyzed the COMPAS Recidivism Algorithm」에 링크를 걸어 그 글과 함께 따라 해 보라고 권한다. 기사, 방법론 글, 재현 자료를 나눠 내는 관행의 대표 사례다(README 직접 확인). — [GitHub propublica/compas-analysis](https://github.com/propublica/compas-analysis); [ProPublica 방법론 글](https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm/)
- ProPublica의 Nerd Blog는 공개 자료로 뉴스 앱을 만드는 기자·개발자 팀의 블로그다. 공개한 Recovery Tracker가 100건 넘는 지역 기사의 자료로 쓰였다고 소개했다. — [Welcome to the Nerd Blog](https://www.propublica.org/nerds/welcome-to-the-nerd-blog)
- 나이지리아 CivicHive 실시간 개표 사이트는 선관위(INEC)가 발표한 결과에 기대며 "확정이 아니라 추세만 보여 준다"고 밝힌다. 공식 결과를 기준으로 두고 자기 결과의 지위를 낮춰 적는 문구의 예다(검색 요약 기준). — [CivicHive Live Results](https://liveresults.civichive.org/)
- Cicero(선출직 공직자 데이터베이스)의 발표 기반 글(mySociety TICTeC 2020)은 선거 결과는 공식 창구에 기댄다는 점을 짚는다. — [Medium: Lessons Learned from Building Democracy's Database](https://medium.com/cicero-data/lessons-learned-from-building-democracys-database-11de07b071f7)
- 이 원칙들은 TEDx 안내서의 "새 연구는 데이터로 뒷받침하라", "틀릴 수 있는 이유를 다뤄라"와 같은 방향이다. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)

### Inferences
- "실제 2025 KBO 일정과 비교" 구간은 데이터 저널리즘 관행대로 보여 주는 편이 맞다. ① 기준은 실제 일정(주황, '실제') ② 같은 잣대로 잰 내 결과 ③ 비교 잣대의 정의 한 줄 ④ 이 잣대가 담지 못하는 것 한 줄. "실제보다 낫다"고 단정하지 않고 "이 잣대로는 이만큼 다르다"로 말해야 공식 기관(KBO)과 맞서는 모양이 되지 않는다.
- ProPublica처럼 발표와 방법을 나누는 게 좋다. 발표에서는 결론과 그림만 보이고, 방법·재현 자료는 사이트나 별도 문서로 보낸 뒤 마지막 장에서 "직접 확인해 보시라"고 초대한다.
- 시빅테크 관행대로 공식 결과를 존중하는 문구("실제 편성은 이 잣대 밖의 사정도 고려한다")를 넣으면 기자 설명과 KBO 접촉에도 쓸 수 있다.

### Gaps
- 코드포코리아나 Code for America 등에서 "공공데이터로 X를 다시 만들어 실제와 비교한" 발표의 목차나 슬라이드를 1차 자료로 찾지 못했다.
- NICAR 팁시트 가운데 "방법론 발표하는 법"을 직접 다룬 것은 찾지 못했다(IRE 사이트에서 세션별로 찾아야 함).
- 스포츠 일정을 공개 자료로 다시 만들어 실제와 비교한 발표 사례는 찾지 못했다.

## 4. 발표 설계 원칙 (Alley, Duarte, Reynolds, TED, Minto, Kawasaki, 장수 기준, 라이브 데모)

### Takeaway
원칙들은 같은 방향을 가리킨다. 한 발표에 생각 하나(TED), 결론 먼저(Minto), 슬라이드마다 주장 한 문장 + 그림 증거(Alley, TEDx "슬라이드 한 장에 요점 하나"), 글은 적게(Reynolds, Holman, TEDx 42pt 이상), 처음에 '현재'와 '될 수 있는 것'의 차이를 보이고 행동 요청으로 끝내기(Duarte)다. 라이브 데모는 미리 녹화한 영상, 인터넷 없이 도는 준비 상태, 전환 연습으로 위험을 줄이는 것이 공통 관행이다.

### Cited Findings
**Assertion-Evidence (Michael Alley, 펜실베이니아 주립대 공학 커뮤니케이션)**
- PowerPoint 기본형(주제 구 제목 + 글머리표 목록)을 버리고, 결론을 담은 한 문장 제목(주장)을 그림 증거(사진, 도표, 그래프, 영상, 작은 표)로 뒷받침하는 방식이다. 공식 사이트는 기본형을 발표자가 저지르는 가장 큰 실수로 꼽는다. — [assertion-evidence.com](https://www.assertion-evidence.com/)
- Penn State 자료는 주장 제목을 왼쪽 정렬하고 두 줄을 넘지 않게 하라는 지침을 둔다. — [Penn State eye_presenting.pdf](https://writing.engr.psu.edu/eye_presenting.pdf)
- ASEE 논문(학회 발표 논문)은 주장-증거형 슬라이드가 복잡한 개념의 이해와 기억을 높이는 것으로 보인다고 보고한다. — [ASEE PEER](https://peer.asee.org/assertion-evidence-slides-appear-to-lead-to-better-comprehension-and-recall-of-more-complex-concepts.pdf)
- 기본서는 『The Craft of Scientific Presentations』(Springer)이고 현재 4판까지 나왔다(검색 요약 기준). — [Springer](https://link.springer.com/978-1-4419-8279-7)

**Nancy Duarte (Resonate, 2010)** — 원문(duarte.com)은 404로 읽지 못했고 아래는 모두 2차 자료다.
- 'sparkline'은 '지금 있는 것(what is)'과 '될 수 있는 것(what could be)'을 오가는 구조다. 지금 있는 것으로 시작해 불균형을 만들고, 될 수 있는 것을 보여 준다. 250개가 넘는 연설을 분석해 나왔다고 한다. — [Architect Elevator](https://architectelevator.com/strategy/presenting-waveform/); [Tom Tunguz](https://tomtunguz.com/storytelling-duarte/)
- 끝은 행동 요청과 'new bliss'(그 뒤 달라진 세상)로 닫는다고 하는데, 'new bliss'라는 용어는 한 출처에서만 확인했다. — [library-d7m Duarte sparkline](https://library-d7m.pages.dev/communication-framework/storytelling-and-presentation/duarte-sparkline)
- TEDx 안내서도 발표 구조 이론의 하나로 Duarte를 직접 가리킨다. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)

**Garr Reynolds (Presentation Zen)** — 2차 자료.
- 세 원칙은 절제(준비), 단순(디자인), 자연스러움(전달)이다. 일본 미학 개념인 簡素(kanso), 自然(shizen), 渋み(shibumi)를 끌어온다. — [SuperSummary](https://www.supersummary.com/presentation-zen/summary/); [Antoine Buteau](https://www.antoinebuteau.com/lessons-from-garr-reynolds/)
- 슬라이드와 문서를 섞은 'slidument'는 둘 다 못하니 자세한 내용은 따로 배포 자료로 만들라고 한다(정리 사이트 기준, 원문 미확인). — [SuperSummary](https://www.supersummary.com/presentation-zen/summary/)
- 3판이 나와 있다. — [O'Reilly](https://oreilly.com/library/view/presentation-zen-simple/9780135897751)

**TED / TEDx 공식 안내서** (1차, 날짜 표기 없음)
- 18분 이하. "An audience is good at focusing on one subject at a time in relatively short chunks." — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- 아이디어를 한두 문장으로 적어 보고, 새로운가·흥미로운가·현실적인가를 스스로 물으라고 한다. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- 증거 목록은 앞의 것을 알아야 다음을 이해하는 순서로, 덜 흥미로운 것에서 더 흥미로운 것 순으로 놓고, 논리가 무너지지 않는 선까지 최대한 잘라 내라고 한다(중요하다고 생각한 것도 잘라야 할 것이라고 한다). 비전문가 친구와 함께 목록을 만들라고 권한다. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- 슬라이드 원칙: "No slide should support more than one point.", 그래프 하나에 요점 하나, 글은 최소("if your audience is reading, they are not listening"), 글머리표 피하기, 1920×1080 16:9, 모서리에 정보 두지 않기, 글자 42pt 이상, 흔한 고딕(산세리프) 글꼴. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- 리허설: "Rehearse, rehearse, rehearse!" 무대에서 리허설할 시간을 최대한 확보하라고 한다. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- Chris Anderson(TED 대표)은 발표에 아이디어가 딱 하나여야 한다고 말한다(2차 정리). — [AhaSlides](https://ahaslides.com/blog/how-to-do-a-ted-talks)

**Minto 피라미드 원칙** — 2차 자료.
- 결론(답)을 맨 위에 두고 근거를 아래에 묶는다. 상황(S)-문제(C)-질문(Q)-답(A) 순서로 짜되, 전달할 때는 보통 답을 먼저 말하고 S·C·Q는 짧은 도입으로 쓴다. — [SlideModel SCQA](https://slidemodel.com/scqa-framework-guide/); [Think Insights](https://thinkinsights.net/strategy/pyramid-principle)
- 한 출처는 SCQA에서 답을 맨 끝에 둔다고 해 다른 출처와 어긋난다. 창안 시기도 1960년대·1970년대로 갈린다. — [SlideModel](https://slidemodel.com/scqa-framework-guide/) 등 검색 결과 간 불일치

**Guy Kawasaki 10/20/30** (2005-12-30, 원래 투자 유치용)
- 투자 관련 내용은 빼고 남는 원칙은 "개념 10개 이하, 20분, 글자 30pt 이상"이다. 큰 글자를 강제해 불필요한 내용을 덜어 내게 한다. — [memex.naughtons.org](https://memex.naughtons.org/?p=2658); [Manner of Speaking](https://mannerofspeaking.org/2010/03/09/powerpoint-math-the-10-20-30-rule/)

**개발자 발표용 슬라이드 디자인 (Zach Holman, 2011-10-24)**
- 글을 절반으로 줄이고 남은 글을 키운다. 본문 약 90pt 이상, 보통 150pt, 제목은 300pt 이상. 대비가 큰 색 4가지를 주로 쓰고 8~10색 안에서. 핵심은 되짚기('RECAP') 슬라이드로 반복하고, 새 구간마다 눈에 띄는 배경을 쓴다. — [Zach Holman: Slide Design for Developers](https://zachholman.com/posts/slide-design-for-developers/)
- 글이 많으면 청중은 발표자 말 대신 화면을 읽는다. — [Last Week in AWS](https://www.lastweekinaws.com/blog/how-to-prepare-for-a-tech-conference-talk/)

**라이브 데모와 위험 줄이기**
- 데모를 미리 녹화해 두었다가 실패하면 영상을 튼다. — [Red Gate Simple Talk](https://www.red-gate.com/simple-talk/career/how-to-avoid-demo-fails-when-presenting-at-tech-conferences/); [Oracle-Base 2014-01-02](https://oracle-base.com/blog/2014/01/02/public-speaking-tip-4-have-a-disaster-recovery-plan/)
- 행사장 와이파이를 믿지 말고 인터넷 없이 돌게 하며, 화면 녹화를 예비로 둔다. — [localghost.dev](https://localghost.dev/blog/things-experienced-speakers-wish-they-d-known/)
- 완성된 상태의 데모를 따로 준비해 두고, 일이 꼬이면 그쪽으로 넘어가 설명한다. — [Phil Haack 2011-04-18](https://haacked.com/archive/2011/04/18/presentation-tips.aspx/)
- 발표 화면과 데모 화면을 오가는 전환 자체를 연습하라. — [opensource.com 2017-09](https://opensource.com/article/17/9/7-best-practices-giving-conference-talk)
- 데모가 실패해도 발표자가 크게 만들지 않으면 큰일이 아니다. 데모가 클라우드, 인터넷, 전원, 소리에 기대면 각각 미리 시험하라. — [Lorna Jane: Live Demo Risks and Rewards](https://lornajane.net/?p=3720)
- 녹화 데모가 여러 면에서 낫다는 의견과 라이브를 선호하는 의견이 갈린다. — [Red Gate](https://www.red-gate.com/simple-talk/career/how-to-avoid-demo-fails-when-presenting-at-tech-conferences/); [Lorna Jane](https://lornajane.net/?p=3720)

### Inferences
- 이 프로젝트에 적용하면: 발표 전체의 '하나의 아이디어'는 한 문장(예: "KBO 한 시즌 일정은 규칙을 숫자로 적으면 컴퓨터가 몇 분 안에 짤 수 있고, 실제 일정과 같은 잣대로 견줘 볼 수 있다")으로 정하고, 첫 1~2분 안에 말한다(TED·Minto).
- 슬라이드는 주장-증거형으로 짠다. 제목 자리에 결론 문장(두 줄 이하), 본문은 그림 하나(지도·달력·막대). TEDx의 "슬라이드 한 장에 요점 하나"와 같다. 이는 저장소의 「한 결 규칙」(제목 → 한 줄 설명 → 그림 → 보조)과도 순서가 맞는다.
- Duarte식 흐름: '지금 있는 것'(일정은 사람이 몇 달 걸려 짜고 기준이 밖에서 보이지 않는다) ↔ '될 수 있는 것'(규칙을 바꾸면 몇 분 만에 새 일정과 그 대가를 숫자로 볼 수 있다)을 두세 번 오간 뒤 행동 요청으로 끝낸다.
- 데모는 녹화 영상을 기본으로 하고 라이브는 덤으로 둔다. 이 서버는 하나의 작업이 모든 코어를 쓰고 대기열이 있으므로, 발표 중 실제 계산을 돌리면 다른 사람 작업과 겹칠 수 있다. 미리 계산해 둔 결과(공유 링크)와 화면 녹화, 인터넷 없이 여는 화면을 준비하는 것이 위 관행에 맞는다(추론).
- 글자 크기 기준(Kawasaki 30pt, TEDx 42pt, Holman 90pt 이상)은 모두 "작은 글자로 많은 내용을 넣지 말라"는 같은 요구다. 표·코드는 본 발표에서 빼고 예비 슬라이드로 돌린다.

### Gaps
- Duarte, Reynolds, Minto는 원문(책·공식 사이트)을 직접 읽지 못해 2차 자료에 기댔다. 'new bliss' 용어와 Reynolds의 배포 자료 권고는 원문 확인이 필요하다.
- "18~20분이 지나면 집중력이 급격히 떨어진다"는 주장은 근거 연구를 인용한 출처를 찾지 못했다. TED가 3·6·9분 발표를 권한다는 말도 블로그 한 곳에서만 나왔다.
- Kawasaki 원문(guykawasaki.com)은 403으로 읽지 못했다.
- 1분당 장수에 대한 실증 자료는 없다. 가이드마다 기준이 다르다.

## 5. 한 발표를 25~30분으로 늘리거나 7~10분으로 줄일 수 있게 짜는 방법 (모듈 구성, 부록·예비 슬라이드)

### Takeaway
늘리고 줄이는 방법을 직접 다룬 1차 자료는 찾지 못했다. 다만 TEDx가 "짧은 발표가 못한 발표가 아니다"라고 하고, 증거를 앞뒤 의존 순서로 정리한 뒤 최대한 잘라 내라고 하며, 정해진 길이의 형식(Ignite 20장×15초=5분, PechaKucha 20장×20초=6분 40초)이 있다는 점에서, "고정된 앞뒤 + 넣고 뺄 수 있는 증거 묶음 + 질의응답용 예비 슬라이드" 구조를 끌어낼 수 있다.

### Cited Findings
- TEDx: "Shorter talks are not lesser talks. It may only take 5 minutes to make your point unforgettably." — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- TEDx: 증거 목록을 '앞의 것을 알아야 다음을 이해하는' 순서로 놓고, 논리가 무너지지 않는 선까지 잘라 내라. 이미 아는 내용은 짧게, 새 정보에 시간을 더 써라. 출처는 요점을 말한 뒤에 두거나 작은 글씨로. — [TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- Ignite는 20장이 15초마다 자동으로 넘어가 약 5분이고, PechaKucha 20×20은 2003년 도쿄의 건축가 Astrid Klein과 Mark Dytham이 만든 형식으로 20장×20초, 약 6분 40초다. '라이트닝 토크'라는 말은 이보다 느슨하게 쓰여 출처마다 분류가 다르다. — [University of Arkansas Pressbooks: Pecha Kucha and Ignite](https://uark.pressbooks.pub/speaking/chapter/pecha-kucha-type-and-ignite-type-talks/); [Toastmasters 2018-05](https://toastmasters.org/magazine/magazine-issues/2018/may2018/ticktock)
- 인프콘 2024 형식은 40분 발표 + 40분 질의응답이다(검색 요약 기준). 질의응답 대비가 발표만큼 크다. — [요즘IT](https://yozm.wishket.com/magazine/detail/2740/)
- Holman은 핵심을 되짚는 'RECAP' 슬라이드와 구간마다 다른 배경을 썼다. 구간 단위로 묶여 있으면 구간째 넣고 빼기 쉽다. — [Zach Holman: Slide Design for Developers](https://zachholman.com/posts/slide-design-for-developers/)
- Reynolds 정리: 자세한 내용은 슬라이드가 아니라 따로 배포 자료로(2차). — [SuperSummary](https://www.supersummary.com/presentation-zen/summary/)
- Minto: 답을 먼저 말하고 근거를 아래에 묶는 구조여서, 시간이 줄면 아래 근거부터 잘라도 결론이 남는다(2차 자료 기준의 원리). — [Think Insights](https://thinkinsights.net/strategy/pyramid-principle)

### Inferences
아래는 위 원칙들을 이 프로젝트에 맞춰 조합한 **제안(추론)이며, 출처에서 발견한 관행 그대로가 아니다.**

**15분 핵심판 (약 14~18장, 주장-증거형, 1분에 1장 안팎)**
| 구간 | 시간 | 내용 | 근거 원칙 |
| :--- | :--- | :--- | :--- |
| A. 여는 장면 | 1분 | 청중이 아는 것: 올해 KBO 일정표 한 장, "이건 누가 어떻게 짰을까" | TEDx 도입(친숙한 것에서 시작), Duarte '지금 있는 것' |
| B. 한 문장 아이디어 + 결론 | 1분 | 규칙을 숫자로 적으면 몇 분 안에 한 시즌을 짜고, 실제와 같은 잣대로 견줄 수 있다. 결과 숫자 하나 | TED 한 아이디어, Minto 결론 먼저 |
| C. 문제의 크기 | 2분 | 팀·경기 수·지켜야 할 규칙·좋을수록 좋은 것(이동 거리 등). 왜 사람 손으로 어려운가 | Trick식 "문제 크기와 제약" |
| D. 어떻게 푸나 | 3분 | 처음 해 → 조금씩 바꿔 보기 → 나아지는 과정(재생 화면) | 그림 증거, 전문 용어 풀기 |
| E. 실제와 비교 | 3분 | 실제 2025 일정과 같은 잣대로 잰 숫자 2~3개 + 잣대 정의 한 줄 | 데이터 저널리즘(기준은 실제) |
| F. 틀릴 수 있는 이유 | 1분 | 모델이 담지 못한 것(방송, 구장 사정, 구단 요청 등) | TEDx "reasons you might be wrong", NICAR "데이터는 현실을 줄인 것" |
| G. 짧은 데모 | 2분 | 규칙 하나를 바꾸면 일정과 대가가 바뀌는 장면(녹화 기본, 라이브는 덤) | 데모 위험 관리 관행 |
| H. 마무리와 행동 요청 | 1~2분 | 청중에게 생기는 변화 한 문장 + 사이트 주소·QR + 검증·자료 제공 초대 + 연락처 | TEDx 결론(요약 대신 영향, 판매 요청 금지, 행동 요청) |
| 자기소개 | A나 B 안에 15초 | "산업공학·최적화 엔지니어, 혼자 만든 개인 프로젝트" 한 줄 | TEDx "Don't focus too much on yourself" |

**25~30분 확장판 (넣을 모듈)**
- C에 '왜 KBO 일정이 특히 어려운가'(3연전 묶음, 이동 동선, 공휴일) 사례 추가 +3분
- D에 '처음 해를 규칙 위반 없이 만드는 방법'과 '나쁜 이동을 미리 거르는 방법' 두 장면 +4분
- E에 구단별·월별 비교와 '규칙을 바꾸면 무엇을 잃는가' 실험 +3분
- 만든 과정 회고(혼자 엔진·스튜디오·공개 사이트를 만들며 배운 것 3가지, NHN·인프런 사례의 "배운 것 N가지" 틀) +3분
- 라이브 데모를 길게(스튜디오에서 규칙 직접 바꾸기) +2분
- 질의응답 예비 슬라이드(계산 시간·편차, 규칙 전체 목록, 점수 체계, 공개한 것과 하지 않은 것)는 본 발표에 넣지 않고 뒤에 둔다.

**7~10분 축소판 (기자 설명·짧은 세션)**
- A → B → E → F → H만 남긴다(약 6~8장). C·D는 그림 한 장("이만큼 복잡한 것을 몇 분에")으로 합치고 데모는 15~30초 영상 하나로.
- Minto식으로 답을 먼저 말했기 때문에, 시간이 더 줄면 E의 숫자 하나와 H만 남겨도 결론이 유지된다.
- 5분 라이트닝용이라면 Ignite 형식(20장×15초)에 맞춰 A·B·E·H를 한 장씩 늘려 쓰는 방법이 있다.

**운영 원칙(추론)**
- 모든 판이 같은 A·B·H(여는 장면, 한 문장 결론, 마무리)를 공유하고, 가운데 증거 묶음만 넣고 뺀다. 그래야 판이 달라도 같은 발표처럼 기억된다.
- 각 모듈은 첫 장 제목만 읽어도 결론이 서도록(주장-증거형) 만들어, 빼더라도 앞뒤가 이어지게 한다.
- 데모는 녹화 영상을 판마다 길이별(15초·1분·2분)로 준비한다.

### Gaps
- 한 발표를 길이별 판으로 나누는 '모듈식 발표'를 직접 다룬 1차 자료(행사 안내, 연사 가이드, 책)는 찾지 못했다. 위 표는 추론이다.
- 기자 설명(브리핑)용 발표 구성의 관행 자료는 찾지 못했다.
- Randy Shoup의 「Speaking about Speaking, Part 2 — Organizing Content」(Medium)는 내용 구성을 다루는 것으로 보이나 403으로 읽지 못했다 — [Medium](https://medium.com/@randyshoup/speaking-about-speaking-part-2-organizing-content-c3b546c3b250).
- Neal Ford 등의 『Presentation Patterns』가 이런 구성 패턴을 다룰 가능성이 있으나 확인하지 못했다 — [Ted Neward 정리](https://research.tedneward.com/speaking/presentation-patterns.html).
