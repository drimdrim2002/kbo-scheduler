#!/usr/bin/env bash
# 개발 PC에서 실행: 서버의 저장소를 당겨 다시 빌드하고 서비스를 재시작한다.
#   HOST=<서버 IP> bash deploy/deploy.sh        (Hetzner 기본: root 로 ssh)
#   GCP VM이면: SSH="gcloud compute ssh kbo-scheduler --zone asia-northeast3-a" bash deploy/deploy.sh
set -euo pipefail
BRANCH="${BRANCH:-main}"
if [ -n "${SSH:-}" ]; then
  read -r -a SSH_CMD <<< "$SSH"
else
  SSH_CMD=(ssh "root@${HOST:?HOST=<서버 IP> 를 주세요}")
fi
"${SSH_CMD[@]}" -- "
  set -e
  cd /opt/kbo-scheduler/app
  sudo -u kbo git fetch --all -q && sudo -u kbo git checkout -q $BRANCH && sudo -u kbo git pull -q
  sudo -u kbo bash deploy/build.sh
  sudo systemctl restart kbo-scheduler
  sleep 4
  curl -fsS http://127.0.0.1:8080/api/v1/info && echo
"
