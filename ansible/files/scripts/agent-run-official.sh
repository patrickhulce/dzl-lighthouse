#!/bin/bash

export LH_PATH="/dzl/src/lighthouse"
export DZL_PATH="/dzl/src/dzl"
export DISPLAY=:99.0
export CHROME_PATH="$(which google-chrome-stable)"
export DZL_CONFIG_FILE="/dzl/conf/agent-official.config.js"

xdpyinfo -display $DISPLAY > /dev/null || Xvfb $DISPLAY -screen 0 1024x768x16 &

cd "$LH_PATH" || exit 1

git checkout -f origin/master || exit 1
git pull origin master || exit 1
export LH_HASH=$(git rev-parse HEAD)

export LABEL_PREFIX="official-ci"
if grep -q "$LH_HASH" last-processed-hash-official.artifacts.log; then
  echo "Hash has not changed since last processing, will be a continuous run."
  export LABEL_PREFIX="official-continuous"
else
  yarn install || exit 1
fi

cd "$DZL_PATH" || exit 1
yarn install || exit 1

node ./bin/dzl.js collect --limit=1 --label="$LABEL_PREFIX" --hash="$LH_HASH" --concurrency=1 --config=$DZL_CONFIG_FILE
DZL_EXIT_CODE=$?

if [ $DZL_EXIT_CODE -eq 0 ]; then
  echo "Success!"
  echo "$LH_HASH" > "$LH_PATH/last-processed-hash-official.artifacts.log"
else
  echo "Failed, exiting with error code 1"
  exit 1
fi


