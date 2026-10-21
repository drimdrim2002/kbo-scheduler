#!/usr/bin/env bash
# VM 안에서 root 로 한 번 실행: Java 25(Temurin)·Maven·git·Caddy 설치, kbo 사용자, 디렉터리, 저장소 clone, 빌드, 서비스 등록.
#   sudo REPO_URL=https://github.com/drimdrim2002/kbo-scheduler.git bash setup-vm.sh
set -euo pipefail
REPO_URL="${REPO_URL:?REPO_URL=<git 주소> 를 주세요}"
BRANCH="${BRANCH:-main}"
APP_DIR=/opt/kbo-scheduler/app
DATA_DIR=/var/lib/kbo-scheduler/results

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y sudo curl git gnupg ca-certificates apt-transport-https fonts-noto-cjk maven debian-keyring debian-archive-keyring

# Java 25 (Eclipse Temurin)
if ! java -version 2>&1 | grep -q '"25'; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg
  echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(. /etc/os-release && echo "$VERSION_CODENAME") main" > /etc/apt/sources.list.d/adoptium.list
  apt-get update -y
  apt-get install -y temurin-25-jdk
fi

# Caddy (공식 저장소)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

id -u kbo >/dev/null 2>&1 || useradd --system --home /opt/kbo-scheduler --shell /usr/sbin/nologin kbo
mkdir -p "$APP_DIR" "$DATA_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R kbo:kbo /opt/kbo-scheduler /var/lib/kbo-scheduler

# 빌드는 kbo 사용자로 (maven 캐시도 그 홈에)
sudo -u kbo -H bash -c "cd '$APP_DIR' && bash deploy/build.sh"

cp "$APP_DIR/deploy/kbo-scheduler.service" /etc/systemd/system/kbo-scheduler.service
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
# Cloudflare 대역 신뢰(client_ip_headers)는 Caddy 2.7 이상. 설정이 틀리면 재시작 전에 멈춘다
caddy version
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl daemon-reload
systemctl enable --now kbo-scheduler
systemctl restart caddy
sleep 3
curl -fsS http://127.0.0.1:8080/api/v1/info && echo
echo "done. 상태: systemctl status kbo-scheduler caddy"
