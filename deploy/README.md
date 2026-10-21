# 배포 절차 — 서버 1대(Hetzner 싱가포르) + Caddy + Cloudflare (kbo-scheduler.ai)

> 구성: Hetzner Cloud CPX32(싱가포르, 4 vCPU·8GB, Debian 12) 한 대에 Java 25 서버(`BaseballWebServer`, 8080)와 Caddy(80/443, 자동 HTTPS). DNS와 캐시·방어는 Cloudflare 프록시. 결과 파일은 `/var/lib/kbo-scheduler/results`.
> 비용: CPX32 월 €49.49(IPv4·트래픽 2TB 포함, 부가세 별도, 시간 단위 과금에 월 상한). 시드 8개를 원하면 콘솔에서 CPX42(8 vCPU·16GB, 월 €93.99)로 올린다(재시작 한 번).
> 고른 이유(2026-10-21): GCP 서울 e2-standard-4는 월 약 $138(약 ₩19만)인데 쓸 수 있는 크레딧이 월 ₩1.4만뿐이다. 한국에서 응답 시간은 싱가포르 약 0.1초, 독일 약 0.25초. GCP로 할 때는 `gcloud-create.sh`를 쓴다.

## 0. 준비물
- Hetzner Cloud 계정(결제 수단 등록), 개발 PC의 SSH 공개 키(`~/.ssh/id_ed25519.pub`)
- 도메인 kbo-scheduler.ai 구입(.ai는 2년 단위)
- Cloudflare 무료 계정
- 이 저장소가 git 원격(GitHub 등)에 있어야 서버가 clone 한다

## 1. 서버 만들기 (Hetzner 콘솔)
1. 프로젝트 만들기(`kbo-scheduler`) → **Add Server**.
2. Location **Singapore**, Image **Debian 12**, Type **Shared vCPU · x86 · CPX32**.
3. Networking: Public IPv4·IPv6 둘 다 켠다.
4. SSH keys: `~/.ssh/id_ed25519.pub` 내용을 붙여 넣는다(비밀번호 로그인은 쓰지 않는다).
5. Firewalls: 새로 만들기 → Inbound TCP 22, 80, 443과 ICMP 허용(나머지는 막힘).
6. Backups·Volumes 끔, Name `kbo-scheduler` → Create & Buy.
7. 만들어진 IPv4를 적어 둔다. 서버를 지워도 주소를 지키려면 Primary IP의 auto delete를 끈다.

## 2. 서버 안 설치 (한 번)
```bash
ssh root@<서버 IP>
# 서버 안에서
sudo REPO_URL=https://github.com/drimdrim2002/kbo-scheduler.git bash -c "$(curl -fsSL https://raw.githubusercontent.com/drimdrim2002/kbo-scheduler/main/deploy/setup-vm.sh)"
```
`setup-vm.sh`가 하는 일: Temurin JDK 25·Maven·git·Caddy·한글 폰트(Noto CJK, OG 이미지용) 설치, 시스템 사용자 `kbo`, `/opt/kbo-scheduler/app`에 clone, `deploy/build.sh`, systemd 유닛과 Caddyfile 복사, 서비스 시작. 끝에 `/api/v1/info`가 찍히면 성공. 첫 시작 때 기본 결과(30초)를 만든다.

## 3. Cloudflare·DNS
1. Cloudflare에 사이트 추가 → 등록기관의 네임서버를 Cloudflare 것으로 바꾼다(반영 수 분~수 시간).
2. DNS: `A kbo-scheduler.ai → <서버 IP>`, `A www → <서버 IP>`, 둘 다 **Proxied(주황 구름)**.
3. SSL/TLS: 모드 **Full (strict)**. Caddy가 Let's Encrypt 인증서를 받는다(80 포트 필요).
4. Caching: 기본값. SSE(`/api/v1/solve/*/events`)와 API는 Cloudflare가 캐시하지 않는다. OG 이미지는 서버가 `Cache-Control: public, max-age=86400`을 주므로 캐시된다.
5. Web Analytics(무료, 쿠키 배너 불필요): 사이트 추가 → 스니펫을 `ui/show/index.html`에 넣는다.
6. 확인: `https://kbo-scheduler.ai/api/v1/info`, `https://kbo-scheduler.ai/og/default.png`.
7. 방문자 주소 확인(IP당 동시 1작업): Caddy가 Cloudflare 대역에서 온 요청만 `CF-Connecting-IP`를 방문자 주소로 받아 `X-Real-IP`로 넘기고, 서버는 루프백에서 온 `X-Real-IP`만 믿는다(`deploy/Caddyfile` 맨 위 대역 목록). 휴대폰(LTE)과 PC(Wi-Fi)에서 동시에 「편성 시작」 → 둘 다 진행(하나는 "대기 1번째")이면 정상. 같은 기기에서 두 번 → 두 번째만 429 안내.

## 4. 갱신 배포 (개발 PC)
```bash
HOST=<서버 IP> bash deploy/deploy.sh
```
서버에서 `git pull` → 빌드 → 서비스 재시작 → `/api/v1/info` 확인. 다른 브랜치는 `BRANCH=<이름>`.
`deploy/Caddyfile`을 바꿨으면 서버에서 따로 반영한다: `sudo cp /opt/kbo-scheduler/app/deploy/Caddyfile /etc/caddy/Caddyfile && sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`.

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
| `setup-vm.sh` | 서버 초기 설치(서버 안, root. Debian 12) |
| `build.sh` | 컴파일 + 의존성 jar → `target/lib` |
| `run.sh` | 서버 실행 명령(환경 변수 PORT·DATA_DIR·MAX_SECONDS·SEEDS·JAVA_XMX) |
| `kbo-scheduler.service` | systemd 유닛 |
| `Caddyfile` | HTTPS·리버스 프록시(SSE 무버퍼) |
| `deploy.sh` | 갱신 배포(개발 PC) |

## 7. 아직 안 한 것
- 백업: 결과 파일은 재계산 가능하므로 백업하지 않는다. `default.json`은 저장소에 있다.
- 모니터링·알림: 론칭 직후에는 Cloudflare Analytics와 `journalctl`로 본다. 필요하면 Uptime 체크(무료)를 `/api/v1/info`에 건다.
- 다운타임 없는 배포: 재시작 5초 안팎. 편성 중인 사용자는 "이벤트 스트림 연결이 끊어졌습니다"를 본다. 트래픽이 적은 시간에 배포한다.
