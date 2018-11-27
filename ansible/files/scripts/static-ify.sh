#!/bin/bash

export DZL_PATH="/dzl/src/dzl/cli"
cd "$DZL_PATH" || exit 1

if nc -z 127.0.0.1 8088 ; then
  echo "Server is already up, skipping..."
else
  nohup node ./bin/dzl.js serve --config=/dzl/conf/agent-official.config.js &
  SERVER_PID=$!
fi

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

if [[ -n $SERVER_PID ]]; then
  kill $SERVER_PID
fi

echo "lh-dzl-${PR_ID:-master}.surge.sh" > dist/CNAME

if which surge; then
  surge ./dist
fi

