#!/bin/bash

export DZL_PATH="/dzl/src/dzl/cli"
export DZL_CONFIG_FILE="/dzl/conf/agent-ondemand.config.js"

if [ -e /dzl/log/dzl-off ]; then
  echo "DZL is off, remove /dzl/log/dzl-off to turn back on."
  exit 1
fi

# Update Lighthouse checkout
cd "$LH_PATH" || exit 1
git checkout -f origin/master || exit 1
git pull origin master || exit 1

# Update DZL checkout
cd "$DZL_PATH" || exit 1
git checkout -f master
git pull origin master
yarn install || exit 1

# Fetch the next request
node ./bin/dzl.js requests --action=get --config=$DZL_CONFIG_FILE > /tmp/ondemand.opts
cat /tmp/ondemand.opts
source /tmp/ondemand.opts

if [ $HAS_NEXT -eq 0 ]; then
  echo "No next request, exiting."
  exit 0;
fi

/dzl/scripts/run-once-ondemand.sh "$LH_HASH_A"
DZL_EXIT_CODE=$?
if [ $DZL_EXIT_CODE -ne 0 ]; then
  echo "Failed, exiting with error code 1"
  node ./bin/dzl.js requests --action=update --status=failed --config=$DZL_CONFIG_FILE
  exit 1
fi

/dzl/scripts/run-once-ondemand.sh "$LH_HASH_B"
DZL_EXIT_CODE=$?
if [ $DZL_EXIT_CODE -ne 0 ]; then
  echo "Failed, exiting with error code 1"
  node ./bin/dzl.js requests --action=update --status=failed --config=$DZL_CONFIG_FILE
  exit 1
fi

node ./bin/dzl.js requests --action=update --status=finished --config=$DZL_CONFIG_FILE




