#!/bin/bash

export LH_PATH="/dzl/src/lighthouse"
export DZL_PATH="/dzl/src/dzl/cli"
export DZL_CONFIG_FILE="/dzl/conf/agent-psi.config.js"

if [ -e /dzl/log/dzl-off ]; then
  echo "DZL is off, remove /dzl/log/dzl-off to turn back on."
  exit 1
fi

if [ -e /dzl/conf/tokens.sh ]; then
  source /dzl/conf/tokens.sh
  echo "PSI Token is $(echo $PSI_TOKEN | head -c 4)..."
else
  echo "No PSI Token is set, cannot continue."
  exit 1
fi

cd "$LH_PATH" || exit 1
git checkout -f origin/master || exit 1
git pull origin master || exit 1

cd "$DZL_PATH" || exit 1
git checkout -f master || exit 1
git pull origin master || exit 1
yarn install || exit 1

node ./bin/dzl.js collect --limit=1 --label="continuous-psi" --concurrency=1 --child-process-concurrency=15 --config=$DZL_CONFIG_FILE
DZL_EXIT_CODE=$?

if [ $DZL_EXIT_CODE -eq 0 ]; then
  echo "Success!"
  export LABEL="official-psi"
  /dzl/scripts/static-ify.sh || exit 1
  exit 0
else
  echo "Failed, exiting with error code 1"
  exit 1
fi


