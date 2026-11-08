# 같은 잣대로 견주고, 검증하러 오게 하는 발표

**15분 본편의 표준 순서는 「청중이 아는 장면 하나 → 한 문장 결론과 짧은 자기소개 → 문제의 크기와 KBO가 지금 짜는 방식 → 쉬운 말로 푼 방법 → 실제 2025 일정과 같은 잣대로 잰 비교 → 틀릴 수 있는 이유 → 짧은 시연 → 사이트로 와서 확인해 달라는 초대」입니다.** 리그·업체·학자의 일정 편성 발표와 TEDx 안내서가 공통으로 가리키는 순서입니다. 명성이 목적인 개인 프로젝트에서 신뢰는 이력 슬라이드가 아니라 **누구나 열어 보고 다시 잴 수 있는 결과**에서 나오고, 2025 비교 글이 MLBPARK에서 팬 검증을 거쳤다는 사실이 자기소개를 대신합니다. 세 청중 모두에게 가장 큰 위험은 「KBO 일정이 나쁘다」로 읽히는 것입니다. KBO는 2015년부터 프로그램으로 일정안 수백 개를 뽑아 고르며 구단 간 이동거리 격차를 크게 줄였으므로, 이 성과를 먼저 인정하고 「같은 조건에서 다른 선택지도 있다」로 이어 가야 합니다. 시간은 한 문장 결론과 마무리를 고정하고 가운데 증거 묶음만 넣고 빼서 맞춥니다. 다만 시간 배분표, 시연의 위치, 미팅 뒤 남기는 자료는 출처에서 그대로 찾은 관행이 아니라 여러 원칙을 이 프로젝트에 맞춰 조합한 제안입니다.

---

## 세 청중 모두 「아는 장면 → 결론 → 같은 잣대 비교 → 한계 → 초대」를 공유합니다

### 리그·업체·학자의 일정 편성 발표는 같은 뼈대를 씁니다

조사한 일정 편성 발표들은 놀라울 만큼 같은 순서를 따릅니다. NFL과 AWS의 설명 글은 18주·272경기·576개 경기 시간대·2만 개가 넘는 규칙 같은 **규모 숫자**로 시작해, 코르크판에 손으로 짜던 시절을 거쳐 계산 방식으로 넘어가고, 팀 간 경쟁 불평등 줄이기, 원정 3연속 피하기, 지구 라이벌전 배치 같은 결과를 말한 뒤 「다음에 할 일」로 끝납니다 ([AWS M&E Blog](https://aws.amazon.com/blogs/media/a-look-inside-the-making-of-an-nfl-football-schedule)). MIT 강의 슬라이드(22장)도 일정이 왜 중요한가 → 손으로 짜던 방식(부부 한 쌍이 24년 동안 자석판으로 MLB 2,430경기를 짰다는 일화) → 「교황 방문으로 양키스타디움을 못 쓴다」 같은 재미있는 실제 조건 → 계산 방식 → 새 조건을 넣어도 쉽게 다시 만든다는 결론 순서입니다 ([MIT 15.071x](https://courses.edx.org/assets/courseware/v1/7e48a98f026a5221928917fd7aef8b9a/asset-v1:MITx+15.071x+2T2017+type@asset+block/Unit9_SportsScheduling_AllSlides.pdf)). Trick의 강연은 실제 일정의 이상한 원정 사례로 질문을 던지고, 대학 농구에서 성공한 뒤 MLB에 낸 안이 리그 구성 변경으로 채택되지 않은 **실패담까지 그대로** 이야기합니다 ([CMU](https://www.cs.cmu.edu/~ACO/dimacs/trick.html)).

리그 밖 개인이나 학자의 발표는 여기에 한 가지를 더합니다. Hoshino와 Kawarabayashi의 2011년 발표(51장)는 「지바 마린 스타디움 근처에 산다」는 개인적인 계기와 지바 롯데의 2010년 실제 이동거리 23,266km로 열고, 실제 교류전 일정과 자기 일정을 나란히 놓은 뒤, 마지막 장을 구장 사용 가능일 같은 **아직 못 넣은 현실 조건과 조언 요청**으로 닫습니다 ([Sambuz 슬라이드 사본](https://api.sambuz.com/doc/richard-hoshino-and-ken-ichi-kawarabayashi-ppt-presentation-850389)). 다만 이 발표의 기준 이동거리는 슬라이드(51,134km)와 논문(약 50,828km)이 서로 달라서, 인용할 때는 둘을 합치지 말고 출처마다 따로 적어야 합니다 ([Hoshino 논문](https://www.khoury.northeastern.edu/home/rhoshino/papers/sc3.pdf)). 공통된 틀은 「현재 실제 일정을 같은 기준으로 재 보니 이렇고, 우리 일정은 리그 규칙을 모두 지키면서 이만큼 다르며, 남은 현실 조건은 함께 풀자」입니다. 한 가지 눈에 띄는 점은 **조사한 일정 편성 발표 가운데 실시간 시연을 한 경우는 하나도 없었다**는 것입니다. 모두 정적인 일정표와 표로 결과를 보였습니다.

| 대표 예시 | 청중 | 순서의 특징 | 이 발표에 가져올 것 |
| :--- | :--- | :--- | :--- |
| NFL·AWS 설명 글 (2023) | 일반 팬·업계 | 규모 숫자 → 손으로 짜던 시절 → 계산 → 결과 → 다음 단계, 리그 실무자를 직함까지 소개 | 규모 숫자로 문제의 크기 보여 주기 |
| MIT 15.071x 강의 (2017) | 비전문가 학생 | 왜 중요한가 → 옛 방식 → 재미있는 실제 조건 → 방법 → 다시 만들기 쉽다 | 「재미있는 실제 조건」 한 장 |
| Trick 강연 (1998 무렵) | 연구자 | 이상한 실제 일정 → 방법 → 성공 → 실패담 → 열린 질문 | 실패와 남은 결점을 스스로 말하기 |
| Hoshino 발표 (2011) | 학회 | 동네 팀 → 실제 대비 km → 증명 → 남은 조건 → 조언 요청 | 한 팀 따라가기, 조언 요청으로 끝내기 |
| Columbia 학생 발표 (2019) | 수업 | 서론 → 모델 → 실제와 나란히 놓은 개막일 대진 → 평가 → 더 해 볼 것 | 비교 기준 섞지 않기(반면교사) |
| NHN FORWARD 오픈소스 발표 (2020) | 개발자 | 숫자로 한 자기소개 → 무엇이 나를 키웠나 → 어떻게 시작할까 → 한 줄 메시지 | 이력 대신 공개 숫자로 자기소개 |

### KBO 관계자 앞에서는 「KBO가 스스로 밝힌 원칙」으로 엽니다

설득 문서의 표준인 Minto의 피라미드 원칙은 청중이 이미 동의하는 상황 → 무엇이 어려운가 → 답의 순서로 짜되, 전달할 때는 **답을 먼저** 말하라고 합니다. 청중이 상황 설명에 동의하지 않으면 답에 닿기 전에 논쟁이 시작되기 때문입니다 ([Datopian handbook](https://handbook.datopian.com/scqh)). KBO 미팅에서 「청중이 이미 동의하는 상황」은 KBO가 공개적으로 밝힌 원칙입니다. KBO 일정 발표문은 매년 구단별 이동거리 최소화, 주말·공휴일 홈경기와 월별 홈경기 균등, 격년 홈 73·원정 71을 원칙으로 적습니다(주말·월별 균등 문구는 검색 요약으로만 확인했습니다) ([KBO 2026 일정 발표](https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11794), [뉴스서울](https://newsseoul.co.kr/news/view/1065598825460638)).

여기서 출발점을 잘못 잡으면 안 됩니다. 2011년 KBO 운영팀장은 「수작업으로 5개월 걸린다」고 했지만 ([OSEN 2011](https://osen.co.kr/article/G1106140003)), 2022년 스포츠춘추 기사에 따르면 **KBO는 2015년부터 외부 업체에 맡긴 편성 프로그램을 쓰고**, 실행위원회가 대원칙을 정하면 조건을 넣어 프로그램이 일정안 수백 개를 내고 운영팀이 그중에서 고릅니다. 그 결과 최장·최단 구단의 이동거리 격차는 2017년 4,034km에서 2021년 1,293km로 줄었습니다 ([스포츠춘추 2022](http://www.spochoo.com/news/articleView.html?idxno=100519)). 그러니 「사람이 손으로 몇 달 걸려 짠다」는 그림은 지금 KBO 실무자에게는 틀린 말이고 실례입니다. 발표의 「어려움」은 손 대 기계가 아니라, 같은 조건에서 다른 선택지가 있는지, 규칙 하나를 바꾸면 무엇을 잃는지 바로 볼 수 있는지, 일정의 기준을 바깥에서도 확인할 수 있는지로 잡아야 합니다.

칠레 프로축구 일정 사례는 이 자리의 결과 제시 방식을 정해 줍니다. 연구팀은 문제를 「가장 좋은 일정」보다 「모든 조건을 지키는 일정 찾기」로 정의했고, 여러 안을 내면 리그가 직접 골랐으며, 리그가 고른 안이 점수 1위가 아닐 수도 있었습니다. 적용할 조건을 관계자 모두에게 먼저 공개한 것이 투명성과 합의의 근거가 됐습니다 ([Durán et al. 2007](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf)). 이는 KBO가 지금 일하는 방식(수백 개 안 중 운영팀이 고르기)과도 맞아떨어집니다. 마지막 요청은 미국 연방 조달 규정 FAR 15.604의 논리를 빌려 「결정」이 아니라 「적합성 확인」으로 잡는 것이 맞습니다. 이 규정은 기관에 원치 않은 제안을 할 때 상세 제안 전에 실무 담당자와 먼저 만나 기관 필요에 맞는지 확인하라고 하고, 실무 담당자는 안내는 할 수 있지만 약속은 할 수 없다고 적습니다 ([FAR Subpart 15.6](https://www.acquisition.gov/node/61755/printable/pdf)).

### 업계 행사에서는 「한 아이디어」와 「만든 과정」이 무게를 받습니다

TEDx 안내서의 4단계는 친숙한 예로 관심 끌기 → 아이디어를 분명하게 설명 → 증거와 이유 → 아이디어가 청중에게 주는 영향으로 끝내기이고, 구조 자체는 청중에게 드러내지 말라고 합니다 ([TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)). 한국 개발자 행사의 실제 사례인 NHN FORWARD 2020 오픈소스 발표(66장)는 자기·프로젝트 소개 → 무엇이 나를 성장시켰나(4가지) → 어떻게 시작할까 → 한 줄 메시지와 「쉬운 것부터 시작하라」는 권유 → 감사 순서였고, 판매 요청 없이 행동 권유로 끝났습니다 ([Speaker Deck](https://speakerdeck.com/hanjung/opeunsoseu-meinteineoro-seongjanghagi-feat-dot-toast-ui)). 스포츠 분석 업계의 대표 행사인 MIT Sloan Sports Analytics Conference는 연구 발표에 「질문과 업계에 왜 중요한가 → 방법 → 약속이 아닌 실제 결과 → 업계 영향」의 네 부분을 요구하고, 재현 가능성(공개 저장소와 데이터)을 심사 기준으로 둡니다 ([SSAC](https://sloansportsconference.com/research-paper-competition)). 업계 청중에게는 이 네 부분이 최소 뼈대이고, 「할 수 있을 것」보다 「실제 2025 일정과 비교한 숫자」를 앞세우라는 근거가 됩니다.

### 언론 앞에서는 메시지 셋, 숫자 하나, 1쪽 요약입니다

PR 실무 지침은 브리핑마다 **핵심 메시지 3개**를 두고 각 메시지를 한 문장에 근거 하나(숫자나 사례)로 받치라고 하며, 메시지 하나는 말로 15~30초 길이여야 한다고 합니다 ([PR News](https://www.prnewsonline.com/making-your-messages-more-memorable-for-the-media/), [NCSU message map](https://ncfreshproducesafety.ces.ncsu.edu/wp-content/uploads/2014/03/Developing-a-message-map.pdf?fwd=no)). 발표는 짧게, 질문에 더 긴 시간을 주는 것이 경험칙입니다(발표 5~7분 + 질문 20~25분을 권하는 체크리스트가 있으나 권위는 낮습니다) ([press briefing checklist](https://mediamonitoringuk.pages.dev/press-briefing-checklist)). 한국 보도자료의 공식 표본인 국립국어원 길잡이는 맨 위에 보도 일시와 작성자·연락처, 이어서 표제 → 부제(1개, 2줄 이하) → 육하원칙으로 쓴 리드 → 본문(표·그림 포함) → 붙임 자료와 이용 범위 표시 순서를 둡니다. 문장 하나에는 핵심 정보 하나만 담고 되도록 3줄을 넘기지 않습니다 ([국립국어원 보도자료 작성 길잡이](https://korean.go.kr/common/download.do;front=B1ACE15E9BA7AD3FCE9AF48E7D08A9AB?c_file_name=e700a801-ced5-41ee-b69d-117b1973fd75.pdf&file_path=etcData&o_file_name=%EC%9C%A0%ED%98%95%EB%B3%84%EB%A1%9C+%EC%95%8C%EC%95%84%EB%B3%B4%EB%8A%94+%EB%B3%B4%EB%8F%84%EC%9E%90%EB%A3%8C+%EC%9E%91%EC%84%B1+%EA%B8%B8%EC%9E%A1%EC%9D%B4%28%EC%9E%AC%ED%8C%90%29.pdf)). 기자가 실제로 쓴 형식도 단순합니다. 스포츠춘추는 연도별 10개 구단 이동거리 표 하나로 「평준화」 기사를 썼고 ([스포츠춘추 2022](http://www.spochoo.com/news/articleView.html?idxno=100519)), Yahoo Sports는 NBA 일정 발표 당일 팀별 비행거리 순위표 하나에 「해외 경기를 빼면 중간쯤」 같은 단서 2~3개를 붙였습니다 ([Yahoo Sports 2026](https://sports.yahoo.com/nba/article/nba-schedule-release-pelicans-and-spurs-will-fly-the-most-miles-in-2026-27-season-knicks-will-travel-the-least-021750216.html)).

---

## 개인 프로젝트는 이력이 아니라 검증할 수 있는 결과로 이름을 얻습니다

### 자기소개는 15초, 대신 「이미 검증받은 사실」을 씁니다

TEDx 안내서는 아이디어를 최대한 빨리 꺼내고, 자기 이야기에 너무 집중하지 말고("Don't focus too much on yourself."), 통계를 줄줄이 늘어놓으며 시작하지 말라고 합니다 ([TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)). 사례들의 자기소개도 대부분 짧습니다. Hoshino는 이름·소속과 「경기장 근처에 산다」는 계기 하나였고, Columbia 학생 발표는 제목 장에 이름만 적었습니다 ([Columbia slides](https://www1.columbia.edu/~cs2035/courses/ieor4405.S19/p21.pdf)). NHN 발표는 이력 대신 맡은 프로젝트의 공개 숫자(GitHub 스타 29,636개, npm 내려받기 4,507,082회와 그 기간)로 자기를 소개했습니다 ([Speaker Deck](https://speakerdeck.com/hanjung/opeunsoseu-meinteineoro-seongjanghagi-feat-dot-toast-ui)). 반대 의견도 있습니다. 한 영문 기술 발표 가이드는 첫머리에 관심 끌기·자격 제시·순서 안내를 넣으라고 해서 TEDx와 부딪힙니다 ([youngju.dev](https://www.youngju.dev/blog/english/2026-03-05-english-tech-presentation-conference-guide)).

이 프로젝트에서 둘을 잇는 방법은 자기소개 한 장에 세 가지만 두는 것입니다. 「물류·공급망 일정을 최적화하던 엔지니어」라는 한 줄(왜 이 문제를 풀 수 있는 사람인가), 「혼자 만든 개인 프로젝트」라는 한 줄(누구의 이해관계도 없다), 그리고 **「2025 실제 일정과 비교한 글이 MLBPARK에서 가장 많은 추천을 받았다」는 한 줄**입니다. 세 번째가 가장 강한 신뢰 장치입니다. 발표자가 스스로 하는 주장이 아니라 야구를 잘 아는 팬들이 이미 들여다보고 받아들였다는 사실이기 때문입니다. 추천 수나 글 주소를 장에 넣으려면 원글에서 직접 옮겨야 하며, 이번 조사 노트에는 그 숫자가 없습니다.

### 신뢰는 「틀릴 수 있는 이유」와 「방법 공개」에서 쌓입니다

TEDx 안내서는 정당한 반론, **틀릴 수 있는 이유**, 청중이 품을 의심을 정중하게 직접 다루라고 하고, 새 연구라면 데이터와 검토로 뒷받침하라고 합니다 ([TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)). 데이터 저널리즘의 관행도 같은 방향입니다. ProPublica는 기사와 별도로 방법론 글과 분석 자료 저장소를 내고 「직접 따라 해 보라」고 권하며 ([GitHub compas-analysis](https://github.com/propublica/compas-analysis), [ProPublica 방법론 글](https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm/)), 공식 결과가 따로 있는 분야의 시민 기술 사이트는 공식 결과를 기준으로 두고 자기 결과의 지위를 낮춰 적습니다 ([CivicHive](https://liveresults.civichive.org/)). 학자 발표에서 Trick이 실패담을, Hoshino가 남은 현실 조건을 스스로 말한 것도 같은 장치입니다.

이 발표에서는 「엔진이 모르는 조건」 한 장이 그 역할을 합니다. 방송 편성, 구장 대관과 보수, 구단 요청, 지역 행사처럼 실제 KBO 일정이 반영했을 수 있지만 엔진에는 없는 조건을 먼저 공개하고, 그래서 비교는 「우리가 낫다」가 아니라 「엔진이 아는 조건 안에서 같은 잣대로 쟀다」라고 말합니다. 같은 이유로 칠레 논문이 채택 뒤 학술지에서 옛 방식을 두고 쓴 강한 비판 어조는 기존 편성자 앞에서 쓰면 안 됩니다 ([Durán et al. 2007](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf)). 공개 사이트 schedulelab.kr은 SSAC가 요구하는 재현 가능성, Edelman 대회가 결선 전에 심사위원에게 맡기는 검증 단계를 대신하는 장치가 됩니다. 개인 프로젝트에는 「리그가 실제로 썼다」는 증거가 없으므로, 그 자리를 **「누구나 들어가 같은 잣대로 다시 재 볼 수 있다」**로 채우는 것이 가장 가까운 대체물입니다 ([INFORMS Edelman 2023](https://www.informs.org/Recognizing-Excellence/2023-Edelman-Award)).

### 요청은 청중마다 「그 자리에서 할 수 있는 일 하나」입니다

TEDx 안내서는 요약으로 끝내지 말고 아이디어가 청중에게 주는 영향을 말하며, 기금 요청이나 책 표지, 회사 로고 같은 판매로 끝내지 말고, 알맞으면 **청중이 실제로 할 수 있는 행동**을 요청하라고 합니다 ([TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)). 한국어 발표 가이드는 준비 첫 단계에서 「발표 뒤 청중이 무엇을 하길 바라는가」부터 정하라고 합니다 ([youngju.dev 준비 가이드](https://www.youngju.dev/split/culture/2026-03-13-technical-presentation-preparation-delivery-storytelling)). 이를 세 청중에 옮기면 마지막 장이 달라집니다. KBO 관계자에게는 「빠진 규칙을 알려 주시면 넣어서 다시 돌려 보겠다」, 「실무자 한 분이 직접 한 번 만져 봐 달라」 같은 저비용 적합성 확인을, 업계 청중에게는 사이트 주소·QR과 「같은 조건으로 돌려 보고 틀린 곳을 알려 달라」는 검증 초대를, 기자에게는 그림·표를 출처만 밝히면 그대로 써도 된다는 한 줄 이용 허락과 연락처를 둡니다. 이용 허락 문구는 정부 보도자료의 이용 범위 표시(공공누리)를 개인용으로 옮긴 것입니다 ([국립국어원 길잡이](https://korean.go.kr/common/download.do;front=B1ACE15E9BA7AD3FCE9AF48E7D08A9AB?c_file_name=e700a801-ced5-41ee-b69d-117b1973fd75.pdf&file_path=etcData&o_file_name=%EC%9C%A0%ED%98%95%EB%B3%84%EB%A1%9C+%EC%95%8C%EC%95%84%EB%B3%B4%EB%8A%94+%EB%B3%B4%EB%8F%84%EC%9E%90%EB%A3%8C+%EC%9E%91%EC%84%B1+%EA%B8%B8%EC%9E%A1%EC%9D%B4%28%EC%9E%AC%ED%8C%90%29.pdf)). 첫 KBO 미팅의 목표를 채택으로 잡지 않는 근거도 있습니다. MLB가 외부 연구자 그룹의 일정을 공식으로 쓰기까지는 첫 시도에서 약 10년이 걸렸다는 기록이 있습니다(시작 연도는 출처마다 1994·1996년으로 엇갈립니다) ([CMU News 2005](https://www.cmu.edu/cmnews/extra/050404_trick.html), [Daring Fireball](https://daringfireball.net/linked/2013/11/21/million-times-faster)).

---

## 비전문가에게는 「규칙 0건 → 같은 잣대의 숫자 하나 → 팀별 분포 → 한 팀의 시즌」 순서로 보여 줍니다

### 필수 규칙을 모두 지켰다는 사실이 첫 숫자입니다

칠레 사례가 보여 주듯 리그 쪽이 먼저 확인하는 것은 「좋은가」보다 「규칙을 다 지키는가」입니다 ([Durán et al. 2007](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf)). 그래서 결과 구간은 지켜야 할 규칙 목록과 위반 0건 표로 엽니다. 그다음에 같은 잣대로 잰 비교가 옵니다. 최적화 도구 Timefold의 문서는 점수를 규칙별·위반 건별로 쪼개 보여 주는 기능을 「사용자가 이해할 수 있게」 만든 것이라고 소개하고, 이 기능으로 **다른 사람이 만든 일정도 같은 기준으로 평가**할 수 있다고 적습니다 ([Timefold 1.4.0](https://timefold.ai/blog/timefold-solver-1-4-brings-explainable-score), [Timefold score analysis](https://docs.timefold.ai/job-scheduling/latest/user-guide/score-analysis)). 실제 2025 일정을 엔진과 같은 채점기로 재서 나란히 놓는 것이 바로 이 발상입니다.

비교 기준은 하나로 고정해야 합니다. Columbia 학생 발표는 연속 경기 35회 → 25회를 보여 줬지만 둘 다 자기 버전끼리의 비교였고, 실제 리그 일정과의 비교는 「이동거리가 조금 적다」 한 줄뿐이었습니다 ([Columbia slides](https://www1.columbia.edu/~cs2035/courses/ieor4405.S19/p21.pdf)). 「자기 버전끼리」와 「실제 대비」가 섞이면 오해를 삽니다. 모든 숫자 옆에 「실제 2025 KBO 일정 대비」라고 같은 기준을 적고, 계산 기준(직선거리인지, 우천 순연을 포함했는지)도 함께 적습니다. 매체마다 같은 구단의 이동거리가 8,798km와 9,130km로 다르게 보도된 것처럼, 기준이 없는 숫자는 반박 기사의 빌미가 됩니다 ([다음 뉴스 2024](https://v.daum.net/v/20240423171213919?f=p), [스포츠춘추 2022](http://www.spochoo.com/news/articleView.html?idxno=100519)).

### 잣대는 KBO 자신의 기준으로 고르고, 팀별로 펼칩니다

대표 숫자는 2~3개로 줄이되, KBO가 스스로 밝힌 원칙에서 고르면 공정성 시비가 적습니다. KBO 운영팀은 「지방 홈 → 수도권 원정 → 곧바로 지방 홈」을 가장 피해야 할 일정으로 꼽았고, 주말 홈경기 수 균등화를 조건으로 넣는다고 밝혔습니다 ([스포츠춘추 2022](http://www.spochoo.com/news/articleView.html?idxno=100519)). 따라서 총 이동거리, 구단 간 이동거리 격차, 주말·공휴일 홈경기 격차, 「피해야 할 일정」이 몇 번 나왔는가가 후보입니다. 이 값들은 사이트의 비교 결과에서 가져와야 하며, 이번 조사에서 확인한 숫자는 아닙니다. 총합만 보여 주면 안 되는 이유는 2013년 일정 논란에 있습니다. 롯데는 휴식 직후 팀을 12번 만난다는 팀별 지표로 「불공정」을 주장했고, KBO는 다른 지표로 반박했습니다 ([Korea JoongAng Daily 2012](https://www.koreajoongangdaily.com/sports/outrage-over-kbos-2013-schedule/10498322)). KBO 실무자는 숫자를 팀별로 읽습니다. 모든 지표를 10개 구단별로 펼치고, 어느 팀이 손해를 보는지 발표자가 먼저 말하는 편이 안전합니다. 표현도 조심해야 합니다. 국립국어원 길잡이의 공공성 점검은 지역 차별 표현을 삼가라고 하므로, 「남부 구단이 손해」 대신 「이동 부담의 공평함」으로 말합니다. 이동거리가 성적에 주는 효과는 연구상 작거나 약하므로 「피로 때문에 졌다」 같은 인과 주장도 피합니다 ([Bryant Univ.](https://digitalcommons.bryant.edu/cgi/viewcontent.cgi?article=1255&context=eeb)).

### 숫자 대신 「한 팀의 시즌」과 「한 장면」이 기억에 남습니다

Hoshino는 숫자를 늘어놓기 전에 지바 롯데 한 팀의 한 시즌 이동거리로 시작했고, Trick은 실제 일정의 이상한 원정 한 장면으로 질문을 던졌습니다. Heath 형제의 『Made to Stick』도 구체적인 말이 추상적인 말을 이기고, 이야기가 나머지를 묶는다고 정리합니다 ([Blinkist 요약](https://www.blinkist.com/magazine/posts/make-stick-success)). 「총 이동거리 몇 % 감소」보다 「이 팀의 선수단 버스가 한 시즌에 덜 달리는 거리」, 「이 팀이 지방–수도권–지방을 오가던 주가 몇 번 사라졌나」가 더 오래 남습니다. 슬라이드 형식은 Michael Alley의 주장-증거형이 맞습니다. 제목 자리에 결론 한 문장(두 줄 이하), 본문에 그림 하나(지도, 달력, 막대)를 두는 방식으로, 학회 논문은 이 형식이 복잡한 개념의 이해와 기억을 높인다고 보고합니다 ([assertion-evidence.com](https://www.assertion-evidence.com/), [ASEE PEER](https://peer.asee.org/assertion-evidence-slides-appear-to-lead-to-better-comprehension-and-recall-of-more-complex-concepts.pdf)). TEDx도 「한 장에 요점 하나」, 글자 42pt 이상, 글머리표 피하기를 요구합니다 ([TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)).

### 여러 안 중 고르게 하고, 「손대면 받쳐 주는」 장면을 시연합니다

칠레 연맹은 연구팀이 낸 여러 안 중에서 직접 골랐고, 공식 발표 한 달 전부터 3~4개 판을 주고받으며 새 조건을 넣었습니다 ([Durán et al. 2007](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf)). 그러니 KBO 앞에서는 「최적 일정 하나」가 아니라 규칙을 다 지키는 2~3개 안과 각 안의 성격(이동을 줄인 안, 주말 홈을 고르게 한 안)을 보여 주고, 고르는 것은 KBO이며 고른 안이 점수 1위가 아니어도 된다고 미리 말해 둡니다.

시연에서 보여 줄 장면은 알고리즘 회피 연구가 정해 줍니다. Dietvorst 등(2018)에 따르면 사람들은 알고리즘이 틀리는 것을 한 번 보면 그 알고리즘을 피하지만, 결과를 **아주 조금이라도 고칠 수 있게 하면** 쓰려는 의향, 만족도, 알고리즘이 낫다는 믿음이 모두 올라갑니다 ([Dietvorst et al. 2018](https://marketing.wharton.upenn.edu/wp-content/uploads/2020/07/Dietvorst-Overcoming-Algorithm-Aversion.pdf)). 칠레 사례에서는 일정을 발표한 날 한 구단이 홈경기가 지역 축제와 겹친다고 항의하자, 몇 시간 안에 그 경기만 다른 라운드로 옮기고 나머지는 최대한 원래대로 둔 일화가 있습니다 ([Durán et al. 2007](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf)). 스튜디오에는 이미 이 장면에 맞는 기능이 있습니다. 「결과 고치기」에서 연전 하나를 원하는 기간에 고정하거나 3연전의 홈 구단을 지정하면, 「나머지 자동 편성」이 고정한 것은 지키고 나머지를 다시 짭니다. (취소 경기 재편성은 지원 예정이라 시연에 쓸 수 없습니다.) 「기계가 다 짠다」가 아니라 **「편성자가 한 군데 손대면 기계가 나머지를 받쳐 준다」**는 구도가 KBO 실무자에게 가장 설득력 있는 시연입니다.

시연 순서는 Peter Cohan의 『Great Demo!』가 권하는 「마지막 것을 먼저」, 즉 완성된 일정과 비교표를 먼저 보이고 만드는 과정은 나중에 보이는 방식이 맞습니다. 다만 이것은 영업 시연용 방법이고 효과가 따로 검증되지는 않았습니다 ([SK Murphy](https://www.skmurphy.com/?p=4632)). 위험 관리도 필요합니다. 개발자 행사의 공통 관행은 시연을 미리 녹화해 두고, 행사장 인터넷을 믿지 않으며, 완성 상태의 화면을 따로 준비하고, 발표 화면과 시연 화면을 오가는 전환 자체를 연습하는 것입니다 ([Red Gate](https://www.red-gate.com/simple-talk/career/how-to-avoid-demo-fails-when-presenting-at-tech-conferences/), [localghost.dev](https://localghost.dev/blog/things-experienced-speakers-wish-they-d-known/), [Phil Haack](https://haacked.com/archive/2011/04/18/presentation-tips.aspx/)). 이 서버는 한 번에 한 작업만, 모든 계산 자원을 써서 돌리므로 발표 중 새로 계산을 걸면 다른 사람의 작업과 겹칠 수 있습니다. 그래서 녹화 영상과 미리 계산해 둔 결과 화면을 기본으로 두고, 실시간 조작은 덤으로 둡니다.

### 이미 있는 이동거리 사이트와의 차이를 한 줄로 준비합니다

Visual Baseball은 KBO 구단별 원정 이동거리를 2001년부터 시즌별로 보여 주고, 요약 카드·구단별 표·구장 간 거리표·이동 애니메이션 지도를 갖췄습니다 ([Visual Baseball](https://visualbaseball.com/distance)). 기자와 업계 청중은 「이것과 무엇이 다른가」를 물을 가능성이 높습니다. 답은 「보여 주기」가 아니라 **「다시 짜기」**입니다. 같은 조건에서 새 일정을 만들고, 규칙을 바꾸면 무엇이 달라지는지 보이며, 2027 일정을 누구나 만들어 볼 수 있다는 점을 한 줄로 질의응답 준비와 1쪽 요약에 넣습니다.

---

## 15분 본편은 앞뒤를 고정하고 가운데 묶음만 넣고 뺍니다

### 15분 본편 (제안)

한 발표를 길이별 판으로 나누는 방법을 직접 다룬 출처는 찾지 못했습니다. 아래 표는 TEDx의 「증거를 앞뒤 의존 순서로 놓고 논리가 무너지지 않는 선까지 잘라 내라」, Minto의 「답을 먼저 말했으니 시간이 줄면 아래 근거부터 잘라도 결론이 남는다」, 그리고 앞에서 본 사례들의 순서를 이 프로젝트에 맞춰 조합한 제안입니다 ([TEDx Speaker Guide](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf), [Think Insights](https://thinkinsights.net/strategy/pyramid-principle)). 슬라이드는 주장-증거형으로 1분에 1장 안팎, 15분이면 14~18장 정도로 봅니다. 장수 기준은 가이드마다 「1분에 1장」부터 「30분에 100장」까지 크게 갈리므로 정답은 없습니다 ([Gigazine: speaking.io 요약](https://gigazine.net/gsc_news/en/20140120-speaking-io/)).

| 구간 | 시간 | 내용 | 근거 |
| :--- | :--- | :--- | :--- |
| A. 여는 장면 | 1분 | 업계·언론판: 한 팀의 한 시즌이 어떤 길을 도는지(탓하지 않는 그림). KBO판: KBO가 스스로 밝힌 일정 원칙 | TEDx 친숙한 예, Hoshino의 동네 팀, Minto 동의하는 상황 |
| B. 한 문장 결론 + 자기소개 | 1분 | 「규칙을 숫자로 적으면 몇 분 안에 한 시즌을 짜고, 실제와 같은 잣대로 견줄 수 있다」 + 세 줄 자기소개 | TED 한 아이디어, Minto 답 먼저 |
| C. 문제의 크기와 지금 방식 | 2분 | 팀·경기·규칙 수, KBO는 2015년부터 프로그램으로 수백 개 안을 뽑아 고르고 격차를 줄였다 | NFL·MIT 규모 숫자, 스포츠춘추 |
| D. 어떻게 짜나 | 2분 | 규칙을 다 지키는 첫 일정 → 조금씩 바꿔 보며 나아지는 과정(재생 화면) | 그림 증거, 전문 용어 풀기 |
| E. 같은 잣대 비교 | 4분 | 규칙 위반 0건 → 대표 숫자 하나 → 10개 구단별 분포 → 한 팀의 시즌 | 칠레, Timefold, Hoshino, 2013 롯데 논란 |
| F. 틀릴 수 있는 이유 | 1분 | 엔진이 모르는 조건 목록, 「같은 잣대, 다른 조건」 | TEDx, 데이터 저널리즘 |
| G. 시연(녹화) | 2분 | 결과 고치기: 연전 하나를 고정하거나 홈을 지정하면 「나머지 자동 편성」이 나머지를 다시 맞추는 장면 | Dietvorst, 칠레 일화 |
| H. 초대 | 2분 | 청중에게 생기는 변화 한 문장 + 사이트 주소·QR + 청중별 요청 하나 + 연락처 | TEDx 결론, NHN 마무리 |

모든 판이 B·H를 그대로 공유해야 판이 달라도 같은 발표로 기억됩니다. A는 청중에 따라 바꿉니다. KBO 앞에서 실제 2025 일정의 결점 한 장면으로 열면 답에 닿기 전에 논쟁이 시작되므로, KBO판은 KBO가 밝힌 원칙과 2015년 이후의 성과로 엽니다. 각 묶음은 첫 장 제목만 읽어도 결론이 서도록 만들어, 빼더라도 앞뒤가 이어지게 합니다. Zach Holman이 구간마다 배경을 바꾸고 핵심 되짚기 장을 둔 것처럼 묶음 단위로 구분해 두면 넣고 빼기 쉽습니다 ([Zach Holman](https://zachholman.com/posts/slide-design-for-developers/)).

### KBO 관계자판: 발표 25분 + 시연 10분, 나머지 25분은 토의

1시간 회의에서 발표와 시연이 35분이면 약 25분이 토의로 남습니다. 이 시간이 사실상 본론이므로, 본 발표만큼 **예비 슬라이드**가 중요합니다. 규칙 전체 목록과 각 규칙의 정의, 점수 체계, 엔진을 여러 번 돌렸을 때의 결과 차이, 계산 시간을 뒤에 둡니다. 행사에서도 질의응답이 발표만큼 긴 경우(인프콘 2024의 40분 발표 + 40분 질의응답) 같은 준비가 필요하다고 봅니다 ([요즘IT](https://yozm.wishket.com/magazine/detail/2740/)).

| 넣는 묶음 | 더하는 시간 | 내용 |
| :--- | :--- | :--- |
| C 확장 | +2분 | KBO 공개 원칙(이동거리, 주말·공휴일·월별 홈 균등, 홈 73·원정 71)을 하나씩 짚고, 엔진이 그것을 어떻게 지키는지 |
| E 확장 | +4분 | 구단별·월별 표, 주말·공휴일 홈경기 격차, 「피해야 할 일정」 횟수 |
| 여러 안 비교 | +3분 | 규칙을 다 지키는 2~3개 안과 각 안의 성격, 고르는 것은 KBO |
| F 확장 | +1분 | 엔진이 모르는 조건을 넣는 방법(알려 주시면 넣어서 다시 돌린다) |
| 질문 받을 결과 화면 | +2분 | 본편의 G(2분 시연)는 뒤의 10분 시연으로 옮기고, 그 자리에 E의 결과 화면을 한 번 더 짚으며 질문을 받음 |

본편의 G를 시연 10분으로 옮기므로 발표는 15 − 2 + 12 = 25분이 됩니다. 시연 10분은 발표 뒤, 토의 바로 앞에 둡니다. 「이 경우는요?」라는 질문을 그 자리에서 돌려 볼 수 있기 때문입니다(이 배치는 근거 있는 관행이 아니라 추론입니다). 시연 안에서는 완성된 결과 화면부터 보이고, 정해 둔 시나리오(결과 고치기 → 나머지 자동 편성)를 녹화와 실제 화면으로 보인 뒤, 남은 시간에 실무자가 말하는 조건 하나를 바꿔 봅니다. 마지막 요청은 결정이 아니라 적합성 확인입니다. 빠진 규칙 알려 주기, 실무자가 직접 한 번 돌려 보기, 다음 시즌 일정이 나왔을 때 같은 잣대로 나란히 재 보기가 후보입니다. 미팅 뒤 남기는 자료의 관행은 찾지 못했지만, 칠레의 「조건 공개」와 한국 공공 조직의 1쪽 보고서 관행을 겹치면 한 장 요약, 규칙과 지표 정의를 담은 부록, 사이트 주소의 세 가지가 적당합니다(추론).

### 업계 행사판: 20~30분

| 넣는 묶음 | 더하는 시간 | 내용 |
| :--- | :--- | :--- |
| 재미있는 실제 조건 | +1~2분 | 공휴일, 잠실 구장 공유, 국제대회 휴식기 같은 KBO 일화 한 장 (MIT의 교황 방문 자리) |
| D 확장 | +3~4분 | 규칙을 하나도 어기지 않는 첫 일정을 만드는 방법, 나쁜 이동을 미리 거르는 방법 |
| 실험 | +2~3분 | 규칙을 바꾸면 무엇을 잃는가, 여러 번 돌렸을 때의 차이 |
| 만든 과정 회고 | +3~5분 | 혼자 엔진·스튜디오·공개 사이트를 만들며 배운 것 3가지 (NHN·인프런식 「배운 것 N가지」) |
| 긴 시연 | +2분 | 스튜디오에서 규칙을 직접 바꾸기 |

20분판은 「재미있는 실제 조건」과 「만든 과정 회고」만 넣고, 30분판은 다섯 묶음을 모두 넣습니다. 산업공학·최적화 청중이 많은 자리라면 Trick·Hoshino식으로 방법 설명(D)에 더 무게를 둡니다. 인프런 밋업의 사이드 프로젝트 발표가 운영 경험을 「배운 것」으로 묶었듯 ([인프런 퇴근길 밋업 04](https://www.inflearn.com/course/인프런-퇴근길-밋업-04-사이드프로젝트)), 개발자 행사에서는 혼자 만든 과정이 명성에 가장 직접 닿는 묶음입니다.

### 언론판: 7~10분 브리핑 + 1쪽 요약

A → B → E(대표 숫자 하나와 구단별 표) → F → H만 남기고, C·D는 「이만큼 복잡한 것을 몇 분 만에」라는 그림 한 장으로 합치며, 시연은 15~30초 영상 하나로 줄입니다. 그 위에 핵심 메시지 셋을 얹습니다. 「무엇을 만들었나(실제 일정을 같은 조건에서 다시 짜는 도구)」, 「무엇이 다른가(대표 숫자 하나)」, 「누구나 해 볼 수 있다(2027 일정 만들기)」입니다. 시간이 더 줄면 E의 숫자 하나와 H만 남겨도 결론이 유지됩니다. 보도 기사가 역피라미드 구조로 뒤에서부터 잘려도 핵심이 남는 것과 같은 원리입니다 ([브런치: 역피라미드](https://brunch.co.kr/@instinct/16)).

1쪽 요약은 국립국어원 길잡이 순서를 그대로 따릅니다. 맨 위에 보도 일시(정한 공개 시각 또는 「배포 즉시」)와 만든 사람·연락처, 대표 숫자를 담은 표제, 명사문 부제 하나, 누가·언제·무엇을·어떻게를 담은 리드, 비교 표 하나와 그림 하나, 발표자 인용 한 줄, 맨 아래 만든 사람 소개와 붙임(사실 정리표, 그림 내려받는 곳), 그리고 이용 허락 한 줄입니다. 해외 미디어 키트 조언은 사실 정리표가 게재용은 아니지만 기자가 가장 자주 가져다 쓰는 자료이니 정확하게 먼저 만들라고 합니다 ([ContentGrip](https://www.contentgrip.com/press-kit-examples/)). 숫자를 계산 기준과 함께 사실 정리표에 고정하고 인용문을 미리 써 주면 기자가 숫자를 바꿔 말할 여지가 줄어듭니다. 예상 질문 문서에는 「KBO 일정과 무엇이 다른가」, 「비교가 공정한가(같은 조건인가, 우천 순연은 어떻게 다뤘나)」, 「이미 있는 이동거리 사이트와 무엇이 다른가」, 「KBO와 협의했나」를 넣습니다.

기사 각도는 해설형(야구 일정은 왜 짜기 어려운가, Trick 기사 유형), 수치형(다시 짜 보니 이만큼 달랐다, 스포츠춘추·Yahoo 유형), 인물형(혼자 이걸 만든 엔지니어, Baseball-Reference의 Sean Forman 기사 유형) 가운데 하나가 될 가능성이 높으므로, 자료는 세 각도 모두에 재료를 줘야 합니다 ([Minnesota Daily](https://mndaily.com/232391/uncategorized/secrets-sports-scheduling), [WTOP 2018](https://wtop.com/mlb/2018/03/math-professor-created-information-center-sports-world)). 한 가지 구조적인 문제도 있습니다. PR 지침의 독점 제공과 보도 유예는 「아직 공개되지 않은 것」을 전제로 하는데 ([Muck Rack](https://muckrack.com/blog/2024/05/28/pitching-under-embargo)), 2025 비교는 이미 MLBPARK에 공개됐습니다. 언론판은 새 소재가 필요합니다. 2027 일정 만들기, 스튜디오의 결과 고치기(손대면 나머지를 다시 맞춤), 또는 KBO가 2027 일정을 발표하는 시점의 즉석 비교가 후보입니다. 언론이 일정 발표 당일에 이동 분석을 다루는 패턴은 Yahoo의 NBA 기사에서 확인됩니다 ([Yahoo Sports 2026](https://sports.yahoo.com/nba/article/nba-schedule-release-pelicans-and-spurs-will-fly-the-most-miles-in-2026-27-season-knicks-will-travel-the-least-021750216.html)). 어느 부서에 먼저 연락할지는 근거 자료가 없지만, 이동거리 기사를 이미 써 본 야구 담당 기자(스포츠춘추 2022)에게 먼저 독점을 제안하고, IT부는 「혼자 만든 엔지니어」라는 인물·기술 각도로 다음 순서에 두는 것이 「가장 맞는 매체 한 곳에 먼저 독점」이라는 PR 지침과 맞습니다(추론). 첫 연락 메일은 150단어 안팎으로 짧게, 가장 뉴스가 되는 숫자로 시작하고, 큰 파일은 붙이지 않는 것이 관행입니다 ([Y Combinator](https://blog.ycombinator.com/a-guide-to-pitching-funding-and-launch-stories/)).

---

## 근거는 얼마나 확실한가

가장 단단한 근거는 원문을 직접 읽은 1차 자료입니다. 칠레 리그 논문, TEDx 안내서, NHN 발표 슬라이드, Hoshino·Columbia·MIT 슬라이드, Trick의 강연 페이지, SSAC 규정, 국립국어원 길잡이, 스포츠춘추와 Yahoo 기사, Dietvorst 논문이 여기에 속합니다. 이들이 함께 보여 주는 것은 순서(규모 → 방법 → 실제 대비 결과 → 한계 → 다음 단계), 신뢰 장치(틀릴 수 있는 이유, 방법 공개, 여러 안 중 선택, 고칠 수 있게 하기), 언론 자료의 형식(메시지 셋, 표 하나, 1쪽)입니다.

반대로 다음은 관행이 아니라 이 보고서의 조합입니다. 15분 본편과 25·30·10분판의 시간 배분표, 14~18장이라는 장수 추정, KBO 미팅에서 시연을 발표 뒤에 두는 배치, 미팅 뒤 남기는 자료 세 가지, 스포츠부를 먼저 접촉하는 순서가 그렇습니다. 출처끼리 부딪히는 곳도 있습니다. TEDx는 구조를 드러내지 말라고 하고 영문 발표 가이드는 순서 안내를 넣으라고 합니다. NFL 규칙 수는 출처에 따라 2만 개와 2만 6천 개로 다르고, Hoshino의 기준 이동거리는 슬라이드와 논문이 다르며, MLB 외부 그룹의 시작 연도도 엇갈립니다. Duarte, Reynolds, Minto는 원저가 아니라 요약본으로 확인했습니다. 「18~20분이 지나면 집중력이 떨어진다」는 주장과 기자 대상 PR 통계 몇 가지는 근거를 찾지 못해 넣지 않았습니다. 재무 내용(매출 증가액, 중계권료, 절감액, 투자 유치)은 출처에 있었지만 요청대로 모두 뺐습니다. 가장 큰 공백은 한국 쪽입니다. KBO의 현재 편성 절차를 다룬 최근 1차 자료, 개인이 KBO에 자작 일정을 제안한 사례, 한국 기자가 개인 발신 보도자료를 받아들이는 방식은 찾지 못했습니다.

## 결론

이 발표의 핵심은 「더 잘 짰다」를 증명하는 것이 아니라 **「누구의 일정이든 같은 잣대로 잴 수 있게 만들었다」**를 보여 주는 데 있습니다. 칠레 리그와 Timefold 문서, KBO 자신의 「수백 개 안 중 고르기」 방식이 모두 같은 방향을 가리킵니다. 리그에게 필요한 것은 정답 하나가 아니라 비교하고 고를 수 있는 근거이고, 개인 발표자가 리그와 맞서지 않고 이름을 얻는 길도 거기에 있습니다. 그렇게 보면 KBO 앞에서의 성공은 채택이 아니라 「빠진 규칙 하나를 알려 받는 것」이고, 업계와 언론 앞에서의 성공은 「사이트에 들어가 직접 재 본 사람의 수」입니다.

두 번째로, 세 청중은 따로따로가 아니라 하나의 순서로 설계해야 합니다. 한 자리에서 공개한 소재는 다음 자리에서 새 소식이 아니게 되므로, 어느 청중을 먼저 만나느냐가 각 판의 가운데 묶음에 무엇을 넣을지까지 정합니다. KBO에서 들은 빠진 규칙을 반영한 결과가 업계 발표의 「실제 조건을 더 넣었더니」 묶음이 되고, 그 다음 언론판은 아직 아무 데도 내지 않은 새 결과로 여는 식입니다.

## 정할 것

1. **대표 숫자 하나**: 총 이동거리, 구단 간 이동 격차, 주말·공휴일 홈 격차, 「피해야 할 일정」 횟수 가운데 무엇을 표제와 E 구간 맨 앞에 둘지.
2. **세 청중의 순서**: KBO 먼저(조용히 의견을 듣고 고친 뒤 공개), 업계 행사 먼저, 언론 먼저 가운데 무엇으로 할지. 언론 독점 제공을 쓰려면 그 전에 새 소재를 커뮤니티에 올리지 않아야 합니다.
3. **언론판의 새 소재**: 2027 일정 만들기, 결과 고치기, KBO 2027 일정 발표 시점의 즉석 비교 가운데 무엇으로 할지.
4. **시연 방식**: 녹화 영상만 쓸지, 녹화를 기본으로 두고 실시간 조작을 덧붙일지. 실시간이라면 발표 시간에 다른 계산 작업을 막아 둘지.
5. **자기소개에 넣을 MLBPARK 근거**: 추천 수와 글 주소를 장에 그대로 넣을지, 「최다 추천」이라는 말로만 둘지.

## 출처

**일정 편성 사례와 학술 자료**
- [Durán et al. (2007), Scheduling the Chilean Soccer League by Integer Programming](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf)
- [Interfaces 42(3) 2012, 칠레 후속](https://econpapers.repec.org/RePEc:inm:orinte:v:42:y:2012:i:3:p:273-285)
- [Interfaces 47(1) 2017, 칠레 후속](https://econpapers.repec.org/RePEc:inm:orinte:v:47:y:2017:i:1:p:52-69)
- [INFORMS 2016 Edelman 결선 ANFP](https://www.informs.org/Resource-Center/Video-Library/Edelman-Competition-Videos/2016-Edelman-Award-Finalist-ANFP)
- [INFORMS 2023 Edelman Award](https://www.informs.org/Recognizing-Excellence/2023-Edelman-Award)
- [INFORMS Open Forum: Edelman 발표 형식](https://connect.informs.org/discussion/seeking-input-on-future-edelman-presentation-format)
- [Goossens & Spieksma (2009), Scheduling the Belgian Soccer League](https://econpapers.repec.org/RePEc:inm:orinte:v:39:y:2009:i:2:p:109-118)
- [Michael Trick, Adventures in Sports Scheduling (CMU)](https://www.cs.cmu.edu/~ACO/dimacs/trick.html)
- [Punk Rock OR 2014: 독일 OR 학회 기조강연 기록](https://punkrockor.com/2014/09/03/major-league-baseball-scheduling-at-the-german-or-society-conference/)
- [Punk Rock OR 2017: MLB 일정이 어려운 이유](https://punkrockor.com/2017/10/05/sports-scheduling-meetings-business-analytics-why-scheduling-major-league-baseball-is-really-hard/)
- [CMU News 2005: MLB 2005 마스터 일정](https://www.cmu.edu/cmnews/extra/050404_trick.html)
- [Daring Fireball: Trick 블로그 재인용](https://daringfireball.net/linked/2013/11/21/million-times-faster)
- [MIT 15.071x Sports Scheduling 슬라이드](https://courses.edx.org/assets/courseware/v1/7e48a98f026a5221928917fd7aef8b9a/asset-v1:MITx+15.071x+2T2017+type@asset+block/Unit9_SportsScheduling_AllSlides.pdf)
- [Hoshino & Kawarabayashi 발표 슬라이드 사본](https://api.sambuz.com/doc/richard-hoshino-and-ken-ichi-kawarabayashi-ppt-presentation-850389)
- [Hoshino 논문 PDF](https://www.khoury.northeastern.edu/home/rhoshino/papers/sc3.pdf)
- [Columbia IEOR 4405 NBA 일정 발표 (2019)](https://www1.columbia.edu/~cs2035/courses/ieor4405.S19/p21.pdf)
- [공경수·이영호 (2008), 최적화 기법을 활용한 프로야구 일정 계획](https://koreascience.kr/article/CFKO200811850424963.pdf)
- [AWS M&E Blog: NFL 일정 만들기](https://aws.amazon.com/blogs/media/a-look-inside-the-making-of-an-nfl-football-schedule)
- [AWS NFL schedule 페이지](https://aws.amazon.com/sports/nfl/schedule)
- [SSAC Research Paper Competition](https://sloansportsconference.com/research-paper-competition)
- [Timefold Solver 1.4.0 explainable score](https://timefold.ai/blog/timefold-solver-1-4-brings-explainable-score)
- [Timefold job scheduling: score analysis](https://docs.timefold.ai/job-scheduling/latest/user-guide/score-analysis)
- [Dietvorst, Simmons & Massey (2018), Overcoming Algorithm Aversion](https://marketing.wharton.upenn.edu/wp-content/uploads/2020/07/Dietvorst-Overcoming-Algorithm-Aversion.pdf)
- [Bryant Univ.: 이동 피로와 NBA 성적](https://digitalcommons.bryant.edu/cgi/viewcontent.cgi?article=1255&context=eeb)

**KBO 관련 보도와 공식 자료**
- [KBO 2026 정규시즌 경기 일정 발표](https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11794)
- [KBO 2024 정규시즌 경기 일정 확정 발표](https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=9926)
- [뉴스서울: 2025 KBO 일정 발표](https://newsseoul.co.kr/news/view/1065598825460638)
- [스포츠춘추 2022-01-10: KBO 팀별 이동거리 평준화](http://www.spochoo.com/news/articleView.html?idxno=100519)
- [OSEN 2011-06-14: 늘어나는 경기수, 그리고 이동거리](https://osen.co.kr/article/G1106140003)
- [Korea JoongAng Daily 2012-12-04: Outrage over KBO's 2013 schedule](https://www.koreajoongangdaily.com/sports/outrage-over-kbos-2013-schedule/10498322)
- [다음 뉴스 2024-04-23: 롯데 구단 버스기사 이야기](https://v.daum.net/v/20240423171213919?f=p)
- [Visual Baseball: KBO 팀 이동거리](https://visualbaseball.com/distance)

**발표 설계와 개인 프로젝트 발표**
- [TEDx Speaker Guide (PDF)](https://tedxbend.com/tedx/manuals/tedx_speaker_guide.pdf)
- [NHN FORWARD 2020: 오픈소스 메인테이너로 성장하기](https://speakerdeck.com/hanjung/opeunsoseu-meinteineoro-seongjanghagi-feat-dot-toast-ui)
- [인프런 퇴근길 밋업 04: 사이드 프로젝트](https://www.inflearn.com/course/인프런-퇴근길-밋업-04-사이드프로젝트)
- [요즘IT: 인프콘 관련 글](https://yozm.wishket.com/magazine/detail/2740/)
- [youngju.dev: 영문 기술 발표 가이드](https://www.youngju.dev/blog/english/2026-03-05-english-tech-presentation-conference-guide)
- [youngju.dev: 기술 발표 준비 가이드](https://www.youngju.dev/split/culture/2026-03-13-technical-presentation-preparation-delivery-storytelling)
- [Datopian handbook: SCQH](https://handbook.datopian.com/scqh)
- [Think Insights: Pyramid Principle](https://thinkinsights.net/strategy/pyramid-principle)
- [Blinkist: Made to Stick SUCCESs](https://www.blinkist.com/magazine/posts/make-stick-success)
- [assertion-evidence.com](https://www.assertion-evidence.com/)
- [ASEE PEER: 주장-증거형 슬라이드와 이해·기억](https://peer.asee.org/assertion-evidence-slides-appear-to-lead-to-better-comprehension-and-recall-of-more-complex-concepts.pdf)
- [Zach Holman: Slide Design for Developers](https://zachholman.com/posts/slide-design-for-developers/)
- [Gigazine: speaking.io 요약](https://gigazine.net/gsc_news/en/20140120-speaking-io/)
- [SK Murphy: Cohan, Great Demo!](https://www.skmurphy.com/?p=4632)
- [Red Gate Simple Talk: 시연 실패 피하기](https://www.red-gate.com/simple-talk/career/how-to-avoid-demo-fails-when-presenting-at-tech-conferences/)
- [localghost.dev: 경험 많은 발표자의 조언](https://localghost.dev/blog/things-experienced-speakers-wish-they-d-known/)
- [Phil Haack: Presentation tips](https://haacked.com/archive/2011/04/18/presentation-tips.aspx/)
- [FAR Subpart 15.6 Unsolicited Proposals](https://www.acquisition.gov/node/61755/printable/pdf)

**데이터 저널리즘·언론 자료**
- [GitHub propublica/compas-analysis](https://github.com/propublica/compas-analysis)
- [ProPublica: How We Analyzed the COMPAS Recidivism Algorithm](https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm/)
- [CivicHive Live Results](https://liveresults.civichive.org/)
- [국립국어원, 유형별로 알아보는 보도자료 작성 길잡이(재판)](https://korean.go.kr/common/download.do;front=B1ACE15E9BA7AD3FCE9AF48E7D08A9AB?c_file_name=e700a801-ced5-41ee-b69d-117b1973fd75.pdf&file_path=etcData&o_file_name=%EC%9C%A0%ED%98%95%EB%B3%84%EB%A1%9C+%EC%95%8C%EC%95%84%EB%B3%B4%EB%8A%94+%EB%B3%B4%EB%8F%84%EC%9E%90%EB%A3%8C+%EC%9E%91%EC%84%B1+%EA%B8%B8%EC%9E%A1%EC%9D%B4%28%EC%9E%AC%ED%8C%90%29.pdf)
- [브런치: 역피라미드](https://brunch.co.kr/@instinct/16)
- [PR News: Making Your Messages More Memorable for the Media](https://www.prnewsonline.com/making-your-messages-more-memorable-for-the-media/)
- [NCSU: Developing a message map](https://ncfreshproducesafety.ces.ncsu.edu/wp-content/uploads/2014/03/Developing-a-message-map.pdf?fwd=no)
- [mediamonitoringuk: press briefing checklist](https://mediamonitoringuk.pages.dev/press-briefing-checklist)
- [ContentGrip: Press kit examples](https://www.contentgrip.com/press-kit-examples/)
- [Muck Rack: Pitching under embargo](https://muckrack.com/blog/2024/05/28/pitching-under-embargo)
- [Y Combinator: A guide to pitching launch stories](https://blog.ycombinator.com/a-guide-to-pitching-funding-and-launch-stories/)
- [Yahoo Sports 2026-08-14: NBA 2026-27 이동거리](https://sports.yahoo.com/nba/article/nba-schedule-release-pelicans-and-spurs-will-fly-the-most-miles-in-2026-27-season-knicks-will-travel-the-least-021750216.html)
- [Minnesota Daily: Secrets of sports scheduling](https://mndaily.com/232391/uncategorized/secrets-sports-scheduling)
- [WTOP 2018: Sean Forman](https://wtop.com/mlb/2018/03/math-professor-created-information-center-sports-world)
