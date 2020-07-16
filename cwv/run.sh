#!/bin/bash

set -euxo pipefail

whoami
export HOME="/home/lighthouse"
cd /home/lighthouse

for url in $(cat urls.txt)
do
  echo "---------------------------------"
  echo "----- $url -----"
  echo "---------------------------------"
  bash ./run-on-url.sh "$url"
done

tar -czf trace-data.tar.gz data/
