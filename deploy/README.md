# 배포 절차 — 서버 1대(Akamai 도쿄) + Caddy + Cloudflare (schedulelab.kr)

> 구성: Akamai Cloud(옛 Linode) Dedicated 4 vCPU·8GB(도쿄 2, Ubuntu 26.04 LTS) 한 대에 Java 25 서버(`BaseballWebServer`, 8080)와 Caddy(80/443, 자동 HTTPS). DNS와 캐시·방어는 Cloudflare 프록시. 결과 파일은 `/var/lib/kbo-scheduler/results`.
> 비용: Dedicated 8GB(`g6-dedicated-4`) 월 $72(IPv4·디스크 160GB·트래픽 5TB 포함, 시간 단위 과금에 월 상한). CPU를 다른 고객과 나누지 않아 4코어를 10~30초씩 꽉 쓰는 엔진에 맞다.
> 고른 이유(2026-10-21, 4 vCPU·8GB 한 대 기준 월 비용): Akamai 도쿄 Shared $48, Dedicated $72 / Hetzner 싱가포르 CPX32 €49.49 / Vultr 서울 $40~80 / DigitalOcean 싱가포르 $48~84 / GCP 서울 e2 약 $117(쓸 수 있는 크레딧은 월 ₩1.4만). 한국(이 개발 PC)에서 응답 시간은 도쿄 2 약 0.04초, 싱가포르 0.09~0.11초, Vultr 서울은 해외를 돌아 0.14초. GCP로 할 때는 `gcloud-create.sh`를 쓴다.

## 0. 준비물
- Akamai Cloud(Linode) 계정(결제 카드 등록), 개발 PC의 SSH 공개 키(`~/.ssh/id_ed25519.pub`)
- 도메인 schedulelab.kr(가비아 등록, 2026-10-21)
- Cloudflare 무료 계정
- 이 저장소(공개: https://github.com/drimdrim2002/kbo-scheduler)가 GitHub에 push 되어 있어야 서버가 clone 한다

## 1. 서버 만들기 (Akamai Cloud Manager)
1. https://cloud.linode.com → **Create → Linode**.
2. Region **Tokyo 2, JP**(`ap-northeast`), Image **Ubuntu 26.04 LTS**(Akamai 지원 종료 2031-05. Ubuntu 24.04·Debian 12·13도 된다. Temurin 25 저장소가 resolute·noble·bookworm·trixie를 모두 지원, 2026-10-21 확인).
3. Plan: **Dedicated CPU → Dedicated 8 GB**(4 CPU·160GB, $72/월).
4. Linode Label `kbo-scheduler`, Root Password는 길게 아무 값(로그인은 SSH 키로 한다), SSH Keys에 `~/.ssh/id_ed25519.pub`를 추가하고 체크.
5. Backups·Private IP 끔 → **Create Linode**.
6. Cloud Firewall: **Firewalls → Create Firewall**(`kbo-web`), Inbound 기본 정책 **Drop**, 규칙 Accept TCP 22·80·443과 ICMP, Outbound 기본 **Accept** → Linode `kbo-scheduler`에 연결.
7. Linode 화면의 **IPv4 주소**를 적어 둔다(서버를 지우지 않는 한 바뀌지 않는다).

## 2. 서버 안 설치 (한 번)
```bash
ssh root@<서버 IP>
# 서버 안에서
sudo REPO_URL=https://github.com/drimdrim2002/kbo-scheduler.git bash -c "$(curl -fsSL https://raw.githubusercontent.com/drimdrim2002/kbo-scheduler/main/deploy/setup-vm.sh)"
```
`setup-vm.sh`가 하는 일: Temurin JDK 25·Maven·git·Caddy·한글 폰트(Noto CJK, OG 이미지용) 설치, 시스템 사용자 `kbo`, `/opt/kbo-scheduler/app`에 clone, `deploy/build.sh`, systemd 유닛과 Caddyfile 복사, 서비스 시작. 끝에 `/api/v1/info`가 찍히면 성공. 기본 결과는 저장소의 `data/results/default.json`(시드 8개, 소개 쪽 문구의 근거)을 결과 폴더에 복사해 쓴다. 그 파일이 없을 때만 서버가 30초 동안 새로 만든다(서버 코어 수만큼 시드라 숫자가 달라진다).

## 3. Cloudflare·DNS
1. Cloudflare에 사이트 추가(Free) → 가져온 DNS 레코드 중 가비아 기본값(파킹 등)은 지운다 → Cloudflare가 주는 네임서버 2개를 가비아(My가비아 → 도메인 관리 → 네임서버 설정)에 1·2차로 넣고 나머지 칸은 비운다. 가비아에서 DNSSEC를 켰다면 먼저 끈다. 반영은 수 분~수 시간, 끝나면 Cloudflare가 "Active" 메일을 보낸다.
2. DNS: `A schedulelab.kr → <서버 IP>`, `A www → <서버 IP>`. **처음에는 DNS only(회색 구름)**로 두고 서버에서 `systemctl start caddy` → Caddy가 Let's Encrypt 인증서를 받는다(`journalctl -u caddy`에 "certificate obtained successfully" 두 번). 그다음 둘 다 **Proxied(주황 구름)**로 바꾼다. 처음부터 주황이면 Full (strict)에서 서버 인증서가 아직 없어 525/526이 난다.
3. SSL/TLS: 모드 **Full (strict)**. 인증서 갱신은 Caddy가 HTTP-01(80 포트)로 알아서 한다.
4. Caching: 기본값. SSE(`/api/v1/solve/*/events`)와 API는 Cloudflare가 캐시하지 않는다. OG 이미지는 서버가 `Cache-Control: public, max-age=86400`을 주므로 캐시된다.
5. Web Analytics(무료, 쿠키 배너 불필요): 사이트 추가 → 스니펫을 `ui/show/index.html`에 넣는다.
6. 확인: `https://schedulelab.kr/api/v1/info`, `https://schedulelab.kr/og/default.png`.
7. 방문자 주소 확인(IP당 동시 1작업): Caddy가 Cloudflare 대역에서 온 요청만 `CF-Connecting-IP`를 방문자 주소로 받아 `X-Real-IP`로 넘기고, 서버는 루프백에서 온 `X-Real-IP`만 믿는다(`deploy/Caddyfile` 맨 위 대역 목록). 휴대폰(LTE)과 PC(Wi-Fi)에서 동시에 「편성 시작」 → 둘 다 진행(하나는 "대기 1번째")이면 정상. 같은 기기에서 두 번 → 두 번째만 429 안내.

## 4. 갱신 배포 (개발 PC)
```bash
HOST=<서버 IP> bash deploy/deploy.sh
```
서버에서 `git pull` → 빌드 → 서비스 재시작 → `/api/v1/info` 확인. 다른 브랜치는 `BRANCH=<이름>`.
`deploy/Caddyfile`을 바꿨으면 서버에서 따로 반영한다: `sudo cp /opt/kbo-scheduler/app/deploy/Caddyfile /etc/caddy/Caddyfile && sudo caddy validate --config /etc/caddy/Caddyfile && sudo chown -R caddy:caddy /var/log/caddy && sudo systemctl reload caddy`.

## 5. 운영
| 할 일 | 명령 |
| :--- | :--- |
| 상태·로그 | `systemctl status kbo-scheduler` · `journalctl -u kbo-scheduler -f` · `/var/log/caddy/kbo-scheduler.log` |
| 한도 조정 | `/etc/systemd/system/kbo-scheduler.service`의 `MAX_SECONDS`·`SEEDS`·`JAVA_XMX` → `systemctl daemon-reload && systemctl restart kbo-scheduler` |
| 결과 파일 | `/var/lib/kbo-scheduler/results/<id>.json`·`.png`. `default.json`을 지우면 다음 시작 때 다시 만든다 |
| 부하 | 한 번에 작업 1개(큐), IP당 1개. 4 vCPU에서 10초 요청은 시드 4개 병렬. 실사용 힙은 1~2GB라 `JAVA_XMX=5g`. 동시 10명이면 마지막 사람은 약 100초 대기 |

## 6. 파일
| 파일 | 역할 |
| :--- | :--- |
| `gcloud-create.sh` | GCP로 할 때만: VM·고정 IP·방화벽 생성(개발 PC) |
| `setup-vm.sh` | 서버 초기 설치(서버 안, root. Ubuntu 24.04 이상·Debian 12 이상) |
| `build.sh` | 컴파일 + 의존성 jar → `target/lib` |
| `run.sh` | 서버 실행 명령(환경 변수 PORT·DATA_DIR·MAX_SECONDS·SEEDS·JAVA_XMX) |
| `kbo-scheduler.service` | systemd 유닛 |
| `Caddyfile` | HTTPS·리버스 프록시(SSE 무버퍼) |
| `deploy.sh` | 갱신 배포(개발 PC) |

## 7. 아직 안 한 것
- 백업: 결과 파일은 재계산 가능하므로 백업하지 않는다. `default.json`은 저장소에 있다.
- 모니터링·알림: 론칭 직후에는 Cloudflare Analytics와 `journalctl`로 본다. 필요하면 Uptime 체크(무료)를 `/api/v1/info`에 건다.
- 다운타임 없는 배포: 재시작 5초 안팎. 편성 중인 사용자는 "이벤트 스트림 연결이 끊어졌습니다"를 본다. 트래픽이 적은 시간에 배포한다.
