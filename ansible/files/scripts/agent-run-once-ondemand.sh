#!/bin/bash

set -euo pipefail

export LH_PATH="/dzl/src/lighthouse"
export DZL_PATH="/dzl/src/dzl/cli"
export DISPLAY=:99.0
export CHROME_PATH="$(which google-chrome-stable)"
export DZL_CONFIG_FILE="/dzl/conf/agent-ondemand.config.js"

xdpyinfo -display $DISPLAY > /dev/null || Xvfb $DISPLAY -screen 0 1024x768x16 &

LH_HASH="$1"

if [[ "${#LH_HASH}" != "40" ]]; then
  echo "'$LH_HASH' was not a valid Lighthouse hash";
  exit 1;
fi

# Update Lighthouse checkout
cd "$LH_PATH"
git checkout -f origin/master
git pull origin master
# Checkout our specific testing hash
git checkout -f "$LH_HASH"
yarn install

# Run DZL on the hash
cd "$DZL_PATH"
echo "Prepping run on $LH_HASH on $LH_URL..."
node ./bin/dzl.js collect --limit=1 --label="ondemand-$REQUEST_ID" --hash="$LH_HASH" --concurrency=1 --config=$DZL_CONFIG_FILE
