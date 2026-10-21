#!/usr/bin/env bash
# 개발 PC에서 실행: VM·고정 IP·방화벽을 만든다. gcloud 로그인과 프로젝트가 먼저 있어야 한다.
#   PROJECT=<gcp-project-id> bash deploy/gcloud-create.sh
# 기본: asia-northeast3(서울) e2-standard-4(4 vCPU·16GB) Debian 12. 8시드를 쓰려면 MACHINE=e2-standard-8.
set -euo pipefail
PROJECT="${PROJECT:?PROJECT=<gcp-project-id> 를 주세요}"
ZONE="${ZONE:-asia-northeast3-a}"
REGION="${ZONE%-*}"
NAME="${NAME:-kbo-scheduler}"
MACHINE="${MACHINE:-e2-standard-4}"

gcloud config set project "$PROJECT"
gcloud services enable compute.googleapis.com
gcloud compute addresses describe "$NAME-ip" --region "$REGION" >/dev/null 2>&1 \
  || gcloud compute addresses create "$NAME-ip" --region "$REGION"
IP=$(gcloud compute addresses describe "$NAME-ip" --region "$REGION" --format='value(address)')
gcloud compute firewall-rules describe allow-web-80-443 >/dev/null 2>&1 \
  || gcloud compute firewall-rules create allow-web-80-443 --allow tcp:80,tcp:443 --target-tags web --description "HTTP/HTTPS"
gcloud compute instances describe "$NAME" --zone "$ZONE" >/dev/null 2>&1 \
  || gcloud compute instances create "$NAME" --zone "$ZONE" --machine-type "$MACHINE" \
       --image-family debian-12 --image-project debian-cloud --boot-disk-size 30GB \
       --address "$IP" --tags web
echo "VM $NAME @ $IP ($ZONE, $MACHINE)"
echo "다음: gcloud compute ssh $NAME --zone $ZONE"
echo "VM 안에서: sudo REPO_URL=<git 주소> bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/drimdrim2002/kbo-scheduler/main/deploy/setup-vm.sh)\""
