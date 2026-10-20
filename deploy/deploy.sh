#!/usr/bin/env bash
# 개발 PC에서 실행: VM 의 저장소를 당겨 다시 빌드하고 서비스를 재시작한다.
#   bash deploy/deploy.sh            (NAME·ZONE 은 gcloud-create.sh 와 같은 기본값)
set -euo pipefail
ZONE="${ZONE:-asia-northeast3-a}"
NAME="${NAME:-kbo-scheduler}"
BRANCH="${BRANCH:-main}"
gcloud compute ssh "$NAME" --zone "$ZONE" --command "
  set -e
  cd /opt/kbo-scheduler/app
  sudo -u kbo git fetch --all -q && sudo -u kbo git checkout -q $BRANCH && sudo -u kbo git pull -q
  sudo -u kbo bash deploy/build.sh
  sudo systemctl restart kbo-scheduler
  sleep 4
  curl -fsS http://127.0.0.1:8080/api/v1/info && echo
"
