#!/bin/bash

export DZL_PATH="$HOME/dzl"
# cd "$DZL_PATH" || exit 1

nohup node ./bin/dzl.js serve &
SERVER_PID=$!

rm -rf dist/
mkdir dist/

QS="label=official-continuous"

if [[ -n "${PR_ID}" ]]; then
  QS="${QS}&comparison=branch-$PR_ID"
fi

echo "Query string is $QS"

curl http://localhost:8088/ > dist/index.html
curl "http://localhost:8088/dashboard-data.json?$QS" > dist/dashboard-data.json
curl http://localhost:8088/dashboard > dist/dashboard.html
curl http://localhost:8088/dashboard-by-url > dist/dashboard-by-url.html
curl http://localhost:8088/dashboard-comparison > dist/dashboard-comparison.html
curl http://localhost:8088/styles.css > dist/styles.css
curl http://localhost:8088/utils.js > dist/utils.js
curl http://localhost:8088/by-url.js > dist/by-url.js
curl http://localhost:8088/comparison.js > dist/comparison.js
curl http://localhost:8088/dashboard.js > dist/dashboard.js

echo "lh-dzl-${PR_ID:-master}.surge.sh" > dist/CNAME

if which surge; then
  cd dist && surge
fi

kill $SERVER_PID
