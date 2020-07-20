#!/bin/bash

set -euxo pipefail

whoami
export HOME="/home/lighthouse"
cd /home/lighthouse

BLOCKED_PATTERNS=$(cat blocked-patterns.txt)
echo "Blocked patterns are..."
echo "$BLOCKED_PATTERNS"

for url in $(cat urls.txt)
do
  echo "---------------------------------"
  echo "----- $url -----"
  echo "---------------------------------"
  bash ./run-on-url.sh "$url" "$BLOCKED_PATTERNS" || echo "Run on $url failed :("
done

cp entity.txt data/
cp urls.txt data/
cp blocked-patterns.txt data/
tar -czf trace-data.tar.gz data/

echo "Run complete!"
