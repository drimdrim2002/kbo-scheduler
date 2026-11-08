# 스포츠 리그 일정 편성·스포츠 분석 프로젝트 발표의 구성 관행

조사일: 2026-11-08. 원문 슬라이드를 직접 읽은 사례는 4편이다: Columbia 학생 NBA 발표(2019), Hoshino·Kawarabayashi NPB 발표(2011), MIT 15.071x 강의 슬라이드, 고려대 2008 학회 논문. 나머지는 기사, 블로그, 공식 규정 페이지를 읽었다. INFORMS 공식 페이지 여러 곳은 403으로 막혀 원문을 읽지 못했다(각 질문의 Gaps에 적음).

---

## 1. NFL·MLB·NBA·NHL·MLS·유럽 축구 리그 일정 편성 발표는 이야기를 어떤 순서로 짜는가

### Takeaway
리그와 업체 쪽 발표는 대체로 다음 순서를 따른다. ① 규모·난이도 숫자로 시작한다(경기 수, 가능한 일정 수, 제약 수). ② "옛날엔 손으로 짰다"는 이전 이야기. ③ 계산으로 바꾼 방법. ④ 공정성·이동·휴식·방송 같은 결과. ⑤ 앞으로 할 일. 학자 발표는 여기에 수학 모델 설명을 길게 넣고, 실제 일정과 나란히 놓고 비교하는 표를 핵심 그림으로 쓴다. 조사한 사례 가운데 실시간 시연을 한 경우는 하나도 없었다.

### Cited Findings
**NFL + AWS (AWS for M&E Blog, 2023-05-11, 글쓴이 Ari Entin)**
- 글의 순서: 도입(12월에 무엇을 볼지 예측) → "The scheduling sweet spot: A season within the season"(art와 science의 결합, 코르크판 수작업에서 클라우드 자동화로) → "Where it all begins"(슈퍼볼 직후 시작, 규칙 집합, 경쟁 공정성과 시청률 사이의 긴장) → "Predicting the unpredictable"(Brady 이적, Rodgers 트레이드 같은 돌발 변수) → "What's next"(데이터와 예측 분석 확대) — [AWS blog](https://aws.amazon.com/blogs/media/a-look-inside-the-making-of-an-nfl-football-schedule)
- 등장인물은 리그 실무자이고 직함까지 소개한다: Charlotte Carey(NFL director of broadcasting), Howard Katz(SVP, "art" 쪽), Mike North(VP, "science" 쪽) — [AWS blog](https://aws.amazon.com/blogs/media/a-look-inside-the-making-of-an-nfl-football-schedule)
- 핵심 숫자: 18주, 272경기, 576개 경기 시간대, 약 3개월 작업, 20,000개 넘는 규칙, 컴퓨터 약 100대에서 4,000대로, 32개 팀, 7개 방송사 — [AWS blog](https://aws.amazon.com/blogs/media/a-look-inside-the-making-of-an-nfl-football-schedule)
- 재무 외 영향으로 든 것: 팀 간 "competitive inequities" 최소화, 원정 3연속과 월요일 원정 직후 원정 피하기, 건강·안전 규칙, 지구 라이벌전과 빅매치 배치 — [AWS blog](https://aws.amazon.com/blogs/media/a-look-inside-the-making-of-an-nfl-football-schedule)
- AWS 소개 페이지는 "1 quadrillion" 가능한 일정, "over 26,000 factors", 약 10년 전까지 화이트보드 수작업이었다는 이야기를 내세운다(수치가 블로그의 20,000개와 다르다. 연도마다 다르게 표기된 것으로 보인다) — [AWS NFL schedule page](https://aws.amazon.com/sports/nfl/schedule); [About Amazon 2021](https://www.aboutamazon.com/md/news/aws/the-nfl-teams-up-with-aws-to-create-2021-schedule)
- NFL은 일정 발표를 방송 행사로 만든다("Schedule Release '25", NFL+ 독점 "Secrets of the Schedule") — [NFL.com 2025](https://www.nfl.com/_amp/release-2025-nfl-schedule-powered-by-aws-nfl-network-schedule-release-25); [NFL 2024](https://amp.nfl.com/news/2024-nfl-schedule-to-be-released-may-15)

**MLB: Michael Trick (CMU, Sports Scheduling Group)**
- "Adventures in Sports Scheduling"(CMU 페이지, 날짜 표기 없음, 1997~1998년 일정을 다루므로 1998년 무렵으로 추정). 순서: ① 실제 일정의 이상한 사례로 질문을 던짐(1998 Pirates-Braves, Texas Rangers 원정, Duke-UNC 마지막 경기) ② 3단계 알고리즘(패턴 집합 → 시간표 → 일정)과 4팀 예제 ③ ACC 농구: 요구사항(슬라이드 3~4) → 1997년 첫 성공 → TV·팀 제약이 추가됨 → 1998 일정(슬라이드 5) ④ MLB: ACC 방법이 왜 그대로 안 통하는지, 제약(슬라이드 6~7), 정수계획 모델 규모, 1998 제출안이 Brewers의 리그 이동으로 채택되지 않은 실패담, 1997 일정의 전반부(슬라이드 8)와 남은 결점(semi-repeater, 긴 시카고 원정) ⑤ 결론과 열린 질문 4개(슬라이드 9) — [CMU page](https://www.cs.cmu.edu/~ACO/dimacs/trick.html)
- 같은 발표에서 결과는 숫자 비교표가 아니었다. 일정표 그림 위에서 장점과 결점을 말로 짚었고, "현재 일정과 견줄 만하다"는 정도로 정리했다 — [CMU page](https://www.cs.cmu.edu/~ACO/dimacs/trick.html)
- 2014 독일 OR 학회 기조강연(Aachen, 2014-09-03 블로그 기록. 다른 사람이 쓴 2차 자료이고 Trick의 슬라이드가 아니다). 두 부분으로 나뉜다: "Getting the job"(솔버 발전, 경기 단위 대신 시리즈 단위 변수, 한 달치를 버리고 다시 푸는 개선법)과 "Keeping the job"(예측 모델을 입력으로 쓰는 business analytics, 마케팅 직원 교육) — [Punk Rock OR](https://punkrockor.com/2014/09/03/major-league-baseball-scheduling-at-the-german-or-society-conference/)
  - 같은 강연의 "MLB 매출 약 $50M 증가" 수치는 **재무 내용이라 우리 발표에는 해당하지 않는다** — [Punk Rock OR](https://punkrockor.com/2014/09/03/major-league-baseball-scheduling-at-the-german-or-society-conference/)
- 그밖에 2015 Pitt 세미나 "The Mathematics of Scheduling Major League Baseball", 2017 UW-Madison "Sports scheduling meets business analytics", IJCAI 2011 "Adventures in Scheduling"(VideoLectures에 영상과 슬라이드 있음) — [Pitt](https://www.mathematics.pitt.edu/seminar-colloquia-event/mathematics-scheduling-major-league-baseball); [Punk Rock OR 2017](https://punkrockor.com/2017/10/05/sports-scheduling-meetings-business-analytics-why-scheduling-major-league-baseball-is-really-hard/); [VideoLectures](https://videolectures.net/ijcai2011_trick_scheduling)

**MIT 15.071x "Sports Scheduling" 강의 슬라이드(2017, 22장): 교육용 표준 이야기 구조**
- 순서: 1 제목 → 2 일정의 영향(산업 규모, 방송 중계권료) → 3 다른 이유(이동 피로, 주말 관중, 시즌 막판 같은 지구 경기) → 4 전통 방식("MLB는 부부 한 쌍이 1981~2005년 24년 동안 자석판으로 2,430경기를 짰다", 10팀이면 1조 가지) → 5 재미있는 제약(2008년 대선 후보 전당대회, 교황 방문으로 양키스타디움 사용 불가) → 6 분석적 접근(1996년 Sports Scheduling Group 설립) → 7~20 4팀 예제 정수계획 모델 → 21 실제 문제 풀기(몇 달 걸림, 제약 우선순위, 여러 번 반복) → 22 "The Analytics Edge"(새 제약을 넣어도 쉽게 다시 만든다) — [MIT 15.071x slides](https://courses.edx.org/assets/courseware/v1/7e48a98f026a5221928917fd7aef8b9a/asset-v1:MITx+15.071x+2T2017+type@asset+block/Unit9_SportsScheduling_AllSlides.pdf)
  - 2번 슬라이드의 산업 규모와 중계권료 금액은 **재무 내용이라 해당하지 않는다** — 같은 출처

**NBA·NHL·MLS: Fastbreak.ai(업체)**
- NBA, WNBA, NHL, MLS, NWSL, SEC, AHL, Serie A 등 65곳이 넘는 리그의 일정 도구로 소개된다. 실시간 최적화와 "제약을 바꿔 보며 일정을 조정하는 시각화 도구"를 내세운다 — [AHL 발표](https://theahl.com/news/ahl-fastbreak-announce-partnership); [Sports Travel Magazine](https://sportstravelmagazine.com/fastbreak-ai-launches-new-ai-schedule-engine); [Front Office Sports 영상 2026-06](https://frontofficesports.com/videos/the-hidden-ai-technology-building-pro-sports-schedules/)
- 업체 자료에는 투자 유치(Series A $40M 등)와 NBA의 지분 투자가 자주 들어간다. **재무·사업 내용이라 해당하지 않는다** — [Pulse 2.0](https://pulse2.com/fastbreak-ai-40-million-series-a-closed-to-accelerate-growth-in-professional-and-youth-sports); [Bloomberg Law](https://news.bloomberglaw.com/artificial-intelligence/nba-invests-in-startup-using-ai-to-make-scheduling-games-easier)

**유럽 축구: 벨기에·이탈리아**
- Goossens·Spieksma, "Scheduling the Belgian Soccer League"(Interfaces 39(2), 2009). 벨기에 1부 리그 일정을 짠 경험담이다. Goossens는 Spieksma와 함께 2006년부터 Belgian Pro League의 공식 일정을 계산해 왔다고 밝힌다 — [EconPapers](https://econpapers.repec.org/RePEc:inm:orinte:v:39:y:2009:i:2:p:109-118); [core.ac.uk 후속 논문](https://core.ac.uk/download/188620717.pdf)
- 벨기에 리그 후속 연구가 고려 요소로 드는 것: 관중, 상업적 이해, 경찰 경비 비용. 일정이 관중 수와 TV 시청에 미치는 영향은 discrete choice 실험으로 따로 측정했다 — [core.ac.uk](https://core.ac.uk/download/188620717.pdf)
- 이 사례는 교육 자료로도 쓰였다: "Teaching Integer Programming by Scheduling the Belgian Soccer League"(INFORMS Transactions on Education, 2022) — [INFORMS](https://pubsonline.informs.org/doi/10.1287/ited.2022.0269)
- Rosati(WU Wien)의 세미나 "How complex is to schedule the Italian Serie A?"(나폴리, 2025-05-15, 2시간): 순서는 이중 리그전 소개 → 많이 연구된 문제의 제약과 목표 → 풀이 방법 → 수학적 표현(완전그래프의 1-factorization) → ITC2021 결과 분석. 발표자 소개는 약력 문단으로 따로 붙였다 — [UniNA 세미나 공지](https://itee.dieti.unina.it/images/Seminari/2025/SportsTimetabling_.pdf)

**KBO(한국): 리그 쪽 설명**
- KBO 일정 발표 보도자료는 매년 "구단별 이동 거리 최소화, 주말·공휴일 홈 경기 수와 월별 홈 경기 수 균등"을 원칙으로 적는다(검색 요약으로 확인. 해당 연도의 원문 문장은 직접 대조하지 못함) — [뉴스서울 2025 일정 발표](https://newsseoul.co.kr/news/view/1065598825460638); [데일리안 2026 일정](https://www.dailian.co.kr/news/view/1588486/)
- 2009-01-14 OSEN 기사는 정금조 KBO 운영부 팀장의 설명을 간접 인용한다. 월요일 경기 조건은 "경기수 확대에 따른 경기 진행과 이동거리 단축을 위한 것", 504경기까지는 홈·원정 수를 맞춘다는 내용 — [OSEN 2009](https://osen.co.kr/article/G0901140009)

### Inferences
- 리그·업체 발표의 공통 뼈대는 다음 다섯 단계다: **규모 숫자 → 손으로 짜던 시절 → 계산 방식 → 공정성·이동·휴식·방송 결과 → 다음 단계**. NFL 블로그, MIT 강의, Trick 발표가 모두 이 순서다.
- "재미있는 실제 제약" 일화(교황 방문, 대선 전당대회, Brewers 리그 이동, Brady 이적)는 거의 모든 발표에 한 장씩 들어간다. 일반 청중에게 문제가 왜 어려운지 보여주는 장치로 쓰인다. KBO로 옮기면 공휴일, 구장 보수, 국제대회 휴식기, 잠실 구장 공유(2008 논문의 O2) 같은 일화가 같은 자리에 들어갈 수 있다.
- 학자 발표(Trick, Hoshino)는 결과를 "실제 일정표와 우리 일정표를 나란히" 보여주고, 결점도 스스로 짚는다. 정직하게 한계를 말하는 장면이 신뢰를 주는 장치로 쓰인다.
- 우리 발표의 표준 순서 후보(재무 내용 제외): ① 자기소개와 계기(한 장) ② 질문 던지기: 실제 KBO 일정의 한 장면(예: 어느 팀의 긴 원정) ③ 규모·난이도 숫자 ④ 지금은 어떻게 짜나(KBO 공개 원칙) ⑤ 접근 방법(엔진을 쉬운 말로, 모델 설명은 최소) ⑥ 결과: 실제 2025 일정과 나란히 비교(이동거리, 휴식, 공정성, 규칙 위반 0) ⑦ 시연 또는 화면 녹화(스튜디오, schedulelab.kr) ⑧ 한계와 남은 결점 ⑨ 다음 단계와 부탁(조언, 협업).

### Gaps
- NFL 일정 편성을 다룬 AWS re:Invent 세션은 찾지 못했다. 블로그, 소개 페이지, NFL 영상만 확인했다. 영상(NFL Explained "Making of the NFL schedule")의 길이와 구성은 열어 보지 못했다 — [NFL video](https://amp.nfl.com/videos/nfl-explained-making-of-the-nfl-schedule-powered-by-aws)
- Optimal Planning Solutions(NHL 등), Gurobi·Hexaly의 스포츠 사례 발표는 이번에 원문을 확인하지 못했다.
- Fastbreak.ai의 실제 발표나 웨비나의 구성(슬라이드 순서, 길이)은 찾지 못했다. 보도자료와 영상 제목만 확인했다.
- "KBO 운영팀장: 일정을 기계로 짜기 어렵다, 미국·일본처럼 수작업, 5개월 걸린다"는 인용은 검색 요약에만 나왔고 원문 URL에서 확인하지 못했다. OSEN 2009 기사에는 이 문장이 없었다. 발표에 쓰려면 원문을 따로 확인해야 한다.

---

## 2. MIT Sloan Sports Analytics Conference(SSAC) 연구 논문 발표와 대회 발표는 어떻게 구성되는가

### Takeaway
SSAC 연구 논문 대회는 초록 단계에서 이미 **서론(질문과 업계에 왜 중요한가) → 방법 → 결과(약속이 아닌 실제 결과) → 결론(업계 영향)**의 네 부분을 요구한다. 결선에서는 발표에 더 무게를 두고, 심사위원(학계와 업계 임원)은 "흥미와 영향"을 추가로 본다. 발표 시간 제한은 공식 페이지에 적혀 있지 않았다.

### Cited Findings
- 초록은 500단어 미만(제목 포함)이고 표·그림은 합쳐 2개까지. 필수 구성은 Introduction(연구 질문과 업계에 왜 중요한지), Methods(통계 방법과 데이터 출처), Results(약속이 아닌 실제 결과와 통계), Conclusion(핵심 메시지와 업계 영향) — [SSAC Research Paper Competition](https://sloansportsconference.com/research-paper-competition)
- 심사 기준: 새로움, 학문적 엄밀성과 모델의 타당성, 재현 가능성, 적용 가능성. 결선 발표에서는 "interest and impact"가 더해진다. 공식 페이지는 "more weight will be given to the final presentation"이라고 적는다 — [SSAC](https://sloansportsconference.com/research-paper-competition)
- 모든 논문은 GitHub 저장소 링크를 내야 하고 사용한 데이터 링크도 낸다(개인정보는 익명화) — [SSAC](https://sloansportsconference.com/research-paper-competition)
- 종목 트랙마다 1편, 와일드카드 1편이 결선 발표를 한다. 2025년 트랙은 Basketball, Baseball, Soccer, Football, Business of Sports, Other Sports. 포스터 부문은 따로 있고, 포스터는 결선에 올라가지 않는다 — [SSAC](https://sloansportsconference.com/research-paper-competition)
- SSAC27 일정: 초록 마감 2026-10-01, 전문 마감 12-01, 결선 발표 2027년 1월 말, 발표 파일 제출 2월 중순, 발표는 대회 당일 — [SSAC](https://sloansportsconference.com/research-paper-competition)
- 과거(2016)에는 준결선 8팀이 금요일에 발표하고 결선 3팀이 토요일에 다시 발표했다 — [Soccermetrics 2016 preview](https://soccermetrics.net/?p=3350)
- 2025 결선 발표 세션은 3월 7일 오전 9시, Research Papers 방에서 열렸다 — [SSAC event](https://www.sloansportsconference.com/event/research-paper-competition-presentation)

### Inferences
- SSAC의 네 부분 구조(질문의 업계 중요성 → 방법 → 실제 결과 → 업계 영향)는 업계 청중 앞에서 하는 15~20분 발표의 최소 뼈대로 그대로 쓸 수 있다. 우리 발표의 "왜 중요한가"는 선수 이동과 휴식, 팬과 방송으로 채우면 된다(재무 제외).
- "약속이 아닌 실제 결과"를 요구하는 규정은 우리 발표에서도 "할 수 있을 것"보다 "실제 2025 일정과 비교한 숫자"를 앞세우라는 근거로 쓸 수 있다.
- 재현 가능성(공개 저장소, 데이터)이 심사 기준이므로, 공개 사이트 schedulelab.kr에서 누구나 결과를 열어 보고 다시 계산할 수 있다는 점이 같은 역할을 한다.

### Gaps
- 결선 발표 1편당 시간 제한(분)은 공식 페이지와 검색 결과 어디에도 없었다.
- SSAC 결선 발표의 실제 슬라이드 순서 예시(특히 일정 편성 주제)는 찾지 못했다.

---

## 3. OR 학회(INFORMS, MathSport, PATAT, ITC2021)의 일정 편성 발표와 Franz Edelman 결선 발표는 어떻게 구성되는가

### Takeaway
Edelman은 **40분 발표 + 심사위원 질의 10분** 형식이고, 결선 전에 심사위원회 위원이 작업 내용과 분석 기법을 검증한다. 스포츠 분야 결선 사례로는 칠레 프로축구연맹(ANFP)의 2016년 결선이 있다. 학회 발표는 짧은 논문(MathSport는 6쪽)에 맞춘 병렬 세션 발표다. 학자 발표의 전형은 Hoshino 사례처럼 **동기 → 문제 정의 → 이론·알고리즘 → 실제 리그 적용 숫자 → 구현 과제와 조언 요청**의 순서다.

### Cited Findings
**Franz Edelman Award**
- 한 INFORMS 페이지(연도 표기 없음)는 Analytics+ Conference에서 하는 대면 "40 minute overview"와 심사위원 질의 10분을 적는다(검색 요약으로 확인. 원문 페이지는 403) — [INFORMS Edelman Award](https://www.informs.org/Recognizing-Excellence/Edelman-Award)
- 2023-06-09 Edelman 대회 위원장 Rajesh Tyagi의 글: 팬데믹 전에는 결선 팀이 대회장에서 직접 발표했다. 최근 4회(2020~2023)는 팀이 직접 만든 40분 영상으로 심사했다. Practice Section 이사회는 대면 발표로 돌아가는 방안을 잠정 검토 중이었다 — [INFORMS Open Forum](https://connect.informs.org/discussion/seeking-input-on-future-edelman-presentation-format)
- 2025 대회는 2025-04-07 Indianapolis의 Analytics+ Conference에서 열렸다. 2025년 3월 뉴스레터는 각 팀이 심사위원 9명 앞에서 발표한다고 적는다 — [IJAA 2025 intro](https://pubsonline.informs.org/doi/pdf/10.1287/inte.2025.ed.v56.n1); [Practice Section Newsletter 2025-03](https://email.informs.org/hubfs/INFORMS%20Practice%20Section%20Newsletter%20March%202025.pdf)
- 준결선 팀은 사용한 분석 기법 설명을 포함한 작업 내용을 제출하고, 심사위원회 위원이 이를 검증한다. 결선 팀은 INFORMS Journal on Applied Analytics에 15~25쪽 논문을 쓴다. 우승팀은 다음 날 발표를 다시 하고 가을 연차 대회에서도 다시 한다(2023 페이지, 검색 요약) — [INFORMS 2023 Edelman](https://www.informs.org/Recognizing-Excellence/2023-Edelman-Award)
- 2005년 기록에는 검증자가 각 결선 팀의 코치 역할도 한다고 적혀 있다(오래된 자료) — [OR/MS Today 2005](https://pubsonline.informs.org/do/10.1287/orms.2005.02.17/full/)
- 스포츠 결선 사례: 2016 Edelman 결선 "Operations Research Transforms the Scheduling of Chilean Soccer Leagues and South American World Cup Qualifiers"(ANFP, Durán, Guajardo 외). 초록은 ANFP가 그 전 12년 동안 OR로 칠레 리그 일정을 짰다고 적는다. 그 전 단계 논문은 "Scheduling the Chilean Soccer League by Integer Programming"(Interfaces 37(6), 2007, 2005년부터 사용) — [INFORMS 2016 finalist video](https://www.informs.org/Resource-Center/Video-Library/Edelman-Competition-Videos/2016-Edelman-Award-Finalist-ANFP); [SIU record](https://bdu.siu.edu.ar/bdu/Record/todo:paper_00922102_v47_n1_p52_Alarcon); [UChile PDF 2007](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf)

**MathSport International / PATAT / ITC2021**
- MathSport International 2025(제11회, 룩셈부르크, 6월 4~6일)는 주제별 병렬 세션으로 열렸고, "Sports Scheduling 3"처럼 일정 편성 세션이 여러 개 있었다. 프로그램에는 발표 시간이 적혀 있지 않다 — [MathSport 2025 program](https://math.uni.lu/midas/events/mathsports2025/program/)
- 2021~2023년 MathSport 논문집은 6쪽 짧은 논문이고, 2023년 초록은 1,000자 제한이었다(검색 요약) — [EURO OR in Sports](https://www.euro-online.org/websites/orinsports/?p=830)
- ITC2021(스포츠 시간표 경연): PATAT 2021 특별 트랙. 제출 마감 2021-04-30, 결선 발표 2021년 5월, 우승 발표 8월. 상금 1,000/500/250 EUR. 늦게 공개된 문제에 더 큰 가중치. 학회는 연기되어 2022-08-23~26 Bruges에서 열렸다. 공식 정리 논문은 Van Bulck·Goossens, EJOR 308(3), 2023 — [ORBEL newsletter](https://www.orbel.be/news-letter-display.php?id=472); [arXiv 참가 논문](https://arxiv.org/pdf/2309.03229); [IDEAS](https://ideas.repec.org/a/eee/ejores/v308y2023i3p1249-1267.html)

**학회 발표 실례: Hoshino·Kawarabayashi, COPLAS 2011(Freiburg, 2011년 6월, 51장)**
- 순서: 1 제목(이름, 소속 National Institute of Informatics) → 2 목차(맥락과 동기 / 리그 내 일정 "cut 60,000 km" / 리그 간 일정 "cut 8,000km" / 구현 / 조언 요청) → 3~8 맥락과 동기(마쿠하리에 사는 집, 대학, 지바 마린 스타디움 사진 → 지바 롯데 2010 일정, 총 이동 23,266 km) → 9~10 리그 내 일정(다른 세션 발표 홍보 "Shameless plug") → 11~18 리그 간 일정(2010 실제 교류전 표 → 매칭 개념 → 우리 일정) → 19~37 정리·증명·NP-완전성 → 38 NPB 적용 숫자(51,134 km → 43,285 km, 약 7,700 km 감소 / 비균일 42,950 km, 약 8,000 km 감소) → 39~49 하한과의 차이(최종 187 km) → 50~51 구현(구장 사용 가능 여부, 고정 라이벌전 날짜)과 조언 요청 — [Sambuz 슬라이드 사본](https://api.sambuz.com/doc/richard-hoshino-and-ken-ichi-kawarabayashi-ppt-presentation-850389)
- 주의: 슬라이드의 기준값 51,134 km에는 "2010 실제 일정"이라는 표시가 없다. 같은 연구의 논문 쪽 요약은 2010 실제 교류전 이동을 약 50,828 km, 감소율을 15.3%(7,849 km)·16.0%(8,184 km)로 적는다. 두 값이 다르므로 합치지 말고 각각 출처와 함께 써야 한다 — [Sambuz 슬라이드](https://api.sambuz.com/doc/richard-hoshino-and-ken-ichi-kawarabayashi-ppt-presentation-850389); [Hoshino 논문 PDF](https://www.khoury.northeastern.edu/home/rhoshino/papers/sc3.pdf)

### Inferences
- Edelman의 요구를 재무 부분을 빼고 옮기면 "문제가 실제 조직에 있었다 → 분석 기법 → 실제로 쓰였다 → 영향이 검증되었다"의 흐름이 된다. 개인 프로젝트에는 "실제로 쓰였다"가 없으므로, 그 자리를 **"누구나 확인할 수 있는 공개 비교"**(실제 2025 일정과 같은 기준으로 매긴 점수)로 채우는 것이 가장 가까운 대체물이다.
- Hoshino 발표의 구조, 특히 "내가 사는 동네 팀의 실제 이동거리 → 실제 일정표 → 우리 일정 → 몇 km 줄었나 → 아직 못 푼 현실 제약 → 조언 부탁"은 개인·학자가 리그 밖에서 발표할 때 그대로 쓸 수 있는 모범 순서다. 증명 부분(19~37장)은 일반 청중 발표에서는 빼야 할 부분이다.
- 학회 발표는 대개 숫자를 "이론 하한과의 차이"로도 보여준다(Hoshino의 187 km). 우리 발표에서는 "실제 일정 대비"와 함께 "엔진을 여러 번 돌렸을 때의 편차" 같은 신뢰도 숫자를 보조로 쓸 수 있다.

### Gaps
- Edelman 공식 심사 기준 문구(예: 문제, 모델, 영향, 검증 항목의 정확한 표현)는 공식 페이지가 403이라 원문을 읽지 못했다. 기억으로 재구성하지 않았다.
- 현재(2026년) Edelman 결선이 대면인지 영상인지, 40분 규칙이 지금도 유지되는지는 확정하지 못했다.
- ANFP 2016 결선 영상의 길이와 구성(누가 발표했는지: 연맹 임원인지 학자인지)은 페이지가 403이라 확인하지 못했다.
- MathSport, PATAT 발표 1편당 시간 슬롯은 확인하지 못했다(별개 대회인 호주 학회 2008년에는 질의 포함 약 30분).
- ITC2021 최종 순위와 PATAT 2022 특별 트랙 세션의 발표 형식은 찾지 못했다.
- INFORMS 연차 학회의 스포츠 일정 세션 발표 시간(보통 20분 안팎으로 알려졌으나 이번에 출처로 확인하지 못함).

---

## 4. 재무 외 영향(공정성, 이동, 선수 휴식, 팬 경험, 방송사 요구)은 발표에서 어떻게 다루는가

### Takeaway
재무를 빼도 발표의 결과 부분은 충분히 채워진다. 사례들이 실제로 쓴 재무 외 지표는 **팀 간 공정성(competitive equity), 총 이동거리(km), 연속 원정 길이, 연전·이틀 연속 경기 수, 홈·원정 균형, 주말·공휴일 홈 배분, 라이벌전 시점, 방송사 요구 충족**이다. 다만 업체와 학생 발표 상당수는 결과 요약에 매출 숫자를 넣었으므로 우리 발표에서는 그 자리를 이 지표들로 바꿔야 한다.

### Cited Findings
- NFL: 경쟁 불평등 최소화가 중심 목표, 원정 3연속과 월요일 원정 뒤 원정 피하기, 건강·안전 규칙, 지구 라이벌전과 7개 방송사의 요구 — [AWS blog](https://aws.amazon.com/blogs/media/a-look-inside-the-making-of-an-nfl-football-schedule)
- Trick의 ACC·MLB: 긴 홈·원정 연속 피하기, 주말 원정 몰림 피하기, Duke·UNC 경기를 시즌 후반에, 여름 주말에 라이벌전, TV 선호, 이동 줄이기(먼 원정 Boston-Seattle을 피함), 팬이 싫어하는 semi-repeater 줄이기 — [CMU page](https://www.cs.cmu.edu/~ACO/dimacs/trick.html)
- MIT 강의: "Extensive traveling causes player fatigue", 주말 관중, 시즌 막판 같은 지구 경기 — [MIT 15.071x](https://courses.edx.org/assets/courseware/v1/7e48a98f026a5221928917fd7aef8b9a/asset-v1:MITx+15.071x+2T2017+type@asset+block/Unit9_SportsScheduling_AllSlides.pdf)
- Hoshino: 결과를 순수하게 km로 보여주고, 이점으로 돈, 시간, 온실가스 감소를 든다 — [Sambuz 슬라이드](https://api.sambuz.com/doc/richard-hoshino-and-ken-ichi-kawarabayashi-ppt-presentation-850389); [Hoshino 논문](https://www.khoury.northeastern.edu/home/rhoshino/papers/sc3.pdf)
- Columbia 학생 NBA 발표(2019-05-02, 14장): 서론에서 비효율의 피해를 "Lost Revenue / Player dissatisfaction / Fan dissatisfaction" 셋으로 나눈다. 평가 슬라이드(11장)에서 back-to-back 35회는 **자기들의 첫 버전**이고, back-to-back 벌점을 넣은 새 버전에서 25회로 줄었다. 두 수치 모두 자기 버전끼리의 비교이며, 리그의 실제 back-to-back 수는 슬라이드에 없다. 실제 일정과의 비교는 이동거리 "Slightly less total travel distance as real schedule"뿐이다 — [Columbia slides](https://www1.columbia.edu/~cs2035/courses/ieor4405.S19/p21.pdf)
  - 같은 슬라이드의 TV 매출 +7%/+5%, "$180M/$130M improvement"는 **재무 내용이라 해당하지 않는다** — 같은 출처
  - 결론 슬라이드: "Tradeoff between revenue and player comfortability", "NBA likely not optimizing for revenue" — 같은 출처
- Bean·Birge(Interfaces, 1980), "Reducing Travelling Costs and Player Fatigue in the NBA": 제목부터 선수 피로를 내세운다. 절감액 $757,000(20.4%)은 **재무 내용이라 해당하지 않는다** — [INFORMS](https://pubsonline.informs.org/doi/fpi/10.1287/inte.10.3.98); [EconPapers](https://econpapers.repec.org/RePEc:inm:orinte:v:10:y:1980:i:3:p:98-102)
- 벨기에 리그: 관중, 경찰 경비, TV 시청이 고려 요소이고, 일정이 관중과 시청에 미치는 영향을 실험으로 따로 측정했다 — [core.ac.uk](https://core.ac.uk/download/188620717.pdf)
- 고려대 2008 논문은 KBO의 현실 제약을 Bartsch 외(2006)의 틀에 따라 운영 요구(구장 사용 가능 여부, 홈구장 공유), 선호 요구(관중·TV·구단이 바라는 일정), 형평성 요구(어느 팀도 유리하거나 불리하지 않게)의 세 가지로 나눈다 — [공경수·이영호 2008](https://koreascience.kr/article/CFKO200811850424963.pdf)
- KBO 공식 원칙: 이동거리 최소화, 주말·공휴일 홈 경기와 월별 홈 경기 균등(보도자료, 검색 요약) — [뉴스서울](https://newsseoul.co.kr/news/view/1065598825460638)

### Inferences
- 재무를 빼면 결과 부분은 "선수(이동, 휴식) / 팀 간 공정(홈·원정, 주말·공휴일 배분) / 팬·방송(라이벌전 시점, 주말 경기) / 규칙(위반 0)"의 네 묶음으로 나누는 것이 사례들과 가장 잘 맞는다. 고려대 논문과 Bartsch의 세 분류(운영·선호·형평성)를 쉬운 말로 바꿔 쓸 수도 있다.
- 비교의 기준을 분명히 해야 한다. Columbia 사례처럼 "자기 버전끼리 비교"와 "실제 일정과 비교"가 섞이면 오해를 산다. 우리 발표에서는 모든 숫자 옆에 "실제 2025 KBO 일정 대비"라고 같은 기준을 적는 것이 좋다.
- 숫자만 늘어놓지 않고 "한 팀의 시즌을 따라가 보기"(Hoshino의 지바 롯데 23,266 km)로 시작하면 일반 청중이 바로 이해한다. KBO에서는 이동이 가장 긴 팀(예: 남부 지역 구단) 하나를 골라 같은 장면을 만들 수 있다.

### Gaps
- 리그가 직접 발표한 재무 외 지표의 공식 수치(예: NFL의 시즌 총 이동거리 감소량, 휴식일 차이)는 찾지 못했다. NFL 블로그도 휴식일 수치를 내지 않았다.
- 팬 경험을 숫자로 보여준 발표 예시는 벨기에의 관중·시청 실험 말고는 찾지 못했다.

---

## 5. 업체가 아닌 개인이나 학자가 자기가 만든 일정을 들고 리그에 접근해 발표한 사례가 있는가, 어떻게 틀을 잡았나 (한국 사례 포함)

### Takeaway
있다. Bean·Birge(Stanford, 1980, NBA), Trick·Nemhauser(ACC 1997, MLB 1997~98 제출과 거절, 2005년부터 MLB 공식), Goossens·Spieksma(2006년부터 벨기에 공식), Hoshino·Kawarabayashi(NPB 교류전, 리그 접촉 기록 없음), 칠레 ANFP(학자와 연맹의 공동 작업, 2016 Edelman 결선)가 있다. 공통된 틀은 **"현재 실제 일정을 같은 기준으로 매겨 보니 이렇고, 우리 일정은 리그 규칙을 모두 지키면서 이만큼 낫다, 남은 현실 제약은 함께 풀자"**이다. 한국에서는 고려대 2008 학회 논문이 KBO 제약을 정리했지만 리그에 제안했다는 기록은 없다.

### Cited Findings
- Bean·Birge(Stanford OR학과, 1980): 리그 제약을 만족하는 일정을 만들었고, "The NBA is considering our proposal to schedule the 1980–1981 and 1981–1982 seasons"라고 적었다 — [INFORMS](https://pubsonline.informs.org/doi/fpi/10.1287/inte.10.3.98)
- Trick: ACC에서 1997년 첫 일정이 성공하자 리그가 TV·팀 제약을 더 얹었다. MLB에는 Bureman과 함께 1997 일정을 만들었고, 1998 제출안은 Brewers의 내셔널리그 이동으로 채택되지 않았다. 발표에서 이 실패를 그대로 이야기한다 — [CMU page](https://www.cs.cmu.edu/~ACO/dimacs/trick.html)
- Trick과 동료들은 2005 MLB 시즌 마스터 일정을 만들었다(CMU 보도, 2005-04-04). Sports Scheduling Group은 1996년 설립, 대학 스포츠는 1999년부터, MLB는 2005년부터 — [CMU news 2005](https://www.cmu.edu/cmnews/extra/050404_trick.html); [MIT 15.071x](https://courses.edx.org/assets/courseware/v1/7e48a98f026a5221928917fd7aef8b9a/asset-v1:MITx+15.071x+2T2017+type@asset+block/Unit9_SportsScheduling_AllSlides.pdf)
- Goossens·Spieksma: 2006년부터 Belgian Pro League 공식 일정을 계산한다. 이들이 리그에 먼저 접근했는지, 리그가 요청했는지는 확인하지 못했다 — [core.ac.uk](https://core.ac.uk/download/188620717.pdf)
- Hoshino·Kawarabayashi(NII 도쿄, 2011): 자기소개는 이름과 소속, 그리고 "지바 마린 스타디움 근처에 산다"는 개인적인 계기로 시작한다. 마지막 장은 구현 과제와 청중에게 하는 조언 요청이고, NPB에 연락했다거나 리그가 반응했다는 내용은 슬라이드에 없다 — [Sambuz 슬라이드](https://api.sambuz.com/doc/richard-hoshino-and-ken-ichi-kawarabayashi-ppt-presentation-850389)
- NPB 센트럴리그는 이후 짧은 2연전 형식의 잦은 이동을 이유로 교류전 형식을 바꿨다(2015, Wikipedia 기술. 2차 자료) — [Wikipedia Interleague play (NPB)](https://en.wikipedia.org/wiki/Interleague_play_(NPB))
- 칠레: ANFP가 2005년부터 정수계획 일정 시스템을 썼고, 2016년 Edelman 결선에는 연맹과 학자(Durán, Guajardo 외)가 함께 이름을 올렸다 — [UChile 2007](https://www.dii.uchile.cl/wp-content/uploads/2015/09/2007-Scheduling-the-Chilean-Soccer-League-by-integer-programming.pdf); [INFORMS 2016](https://www.informs.org/Resource-Center/Video-Library/Edelman-Competition-Videos/2016-Edelman-Award-Finalist-ANFP)
- 학생 프로젝트: Columbia(2019, NBA, 14장. 제목 슬라이드에 이름 4명만 적고 따로 자기소개를 하지 않음. 순서는 서론 → 처음 아이디어 → 모델 → 탐욕 알고리즘 → 흥미로운 발견(개막일·크리스마스 매치업을 실제와 나란히, 실제와 똑같이 맞은 25경기) → 평가 → 결론 → 더 해볼 것 → Q&A). 리그에 제출한 기록은 없다 — [Columbia slides](https://www1.columbia.edu/~cs2035/courses/ieor4405.S19/p21.pdf)
- 2025년 가을 학생 프로젝트(Hebert·Khan): NBA 전체 모델이 너무 커서 Atlantic 지구만 다뤘다 — [Quarto post](https://jrhebert.quarto.pub/jacob-hebert/posts/NBA%20Optimization/)
- 한국: 공경수·이영호(고려대 정보경영공학부), "최적화 기법을 활용한 프로야구 일정 계획", 2008 한국경영과학회 추계학술대회. 구성은 1 서론(TTP 선행 연구) → 2 한국 프로야구 리그(당시 8팀, 126경기, 3연전, 월요일 휴무) → 3 현실 제약(운영·선호·형평성) → 4 해법(진화 전략, Swap Periods/Teams 등 이웃 연산) → 5 결론. 결론은 "실제 한국 프로야구 일정 계획 수립에 도움을 준다". 초록이 말하는 "better results"는 기존 방법 대비이고, 실제 KBO 일정과 비교했는지는 읽은 부분에서 확인하지 못했다. KBO에 발표했다는 기록도 없다 — [koreascience PDF](https://koreascience.kr/article/CFKO200811850424963.pdf)
- K리그: 2009년 기사에 따르면 당시 정규리그 일정은 실무위원회의 추첨 방식으로 정했다(검색 요약) — [경향 2009](https://sports.khan.co.kr/article/200904222032393/amp)

### Inferences
- 리그 밖 개인이나 학자의 발표에서 반복되는 틀은 다음과 같다. ① 개인적인 계기(Hoshino의 동네 팀) ② 현재 일정의 구체적인 결점 한 장면(Trick의 이상한 원정) ③ "리그 규칙은 모두 지킨다"는 전제 ④ 같은 기준으로 매긴 실제 대비 숫자 ⑤ 아직 반영 못 한 현실 제약을 솔직하게 나열 ⑥ 협업이나 조언 요청. "리그보다 잘했다"고 단정하기보다 "리그가 무엇을 최적화하는지 모른다"(Columbia: "NBA likely not optimizing for revenue")는 겸손한 표현을 쓴다.
- 우리 프로젝트는 공개 사이트로 누구나 결과를 볼 수 있다는 점에서 Bean·Birge나 Hoshino보다 검증 가능성이 높다. 이 점을 Edelman의 "검증" 단계를 대신하는 장치로 내세울 수 있다.
- 자기소개는 사례 대부분이 짧다(제목 슬라이드의 이름과 소속). 개인 프로젝트라면 "왜 이걸 만들었나" 한 장이 Hoshino 방식의 계기 역할을 한다.
- 실시간 시연은 조사한 어떤 사례에도 없었다(NFL 블로그, Trick, MIT, Hoshino, Columbia 모두 정적인 일정표나 표). 우리 발표에서 스튜디오나 사이트를 시연하면 차별점이 되지만, 선례가 없으니 녹화 영상을 예비로 두는 것이 안전하다(추론).

### Gaps
- Goossens·Spieksma가 벨기에 리그에 먼저 제안했는지는 논문 전문을 읽지 못해 확인하지 못했다.
- Bean·Birge 제안을 NBA가 실제로 채택했는지는 찾지 못했다.
- 개인 개발자(학자나 업체가 아닌 사람)가 KBO나 K리그에 자작 일정을 제안하거나 공개 발표한 사례는 찾지 못했다.
- 고려대 2008 논문의 4장(실험 결과)에 실제 KBO 일정과의 비교가 있는지는 끝까지 확인하지 못했다(추출한 본문의 결과 표 부분이 불완전했다).
