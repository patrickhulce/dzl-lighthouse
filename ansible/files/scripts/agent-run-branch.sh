#!/bin/bash

export LH_PATH="/dzl/src/lighthouse"
export DZL_PATH="/dzl/src/dzl"
export DISPLAY=:98.0
export CHROME_PATH="$(which google-chrome-stable)"
export DZL_CONFIG_FILE="/dzl/conf/agent-branch.config.js"

xdpyinfo -display $DISPLAY > /dev/null || Xvfb $DISPLAY -screen 0 1024x768x16 &

cd "$DZL_PATH" || exit 1
git checkout -f master
git pull origin master
yarn install || exit 1

cd "$LH_PATH" || exit 1
yarn install || exit 1

# If `pulls.report.html` is more than 30 minutes old or not there, fetch a new one
if ! [ -e pulls.report.html ] || test `find pulls.report.html -mmin +30`; then
  curl https://github.com/GoogleChrome/lighthouse/pulls > pulls.report.html
fi

PULL_IDS=$(grep 'pull.[0-9]' pulls.report.html | sed -e 's/.*pull.\([0-9]\+\).*/\1/g' | uniq)

for pullid in $PULL_IDS; do
  cd "$LH_PATH" || exit 1

  # For some reason, very important to git that this is not quoted below
  git fetch origin pull/$pullid/head:branch$pullid

  if git log "branch$pullid" --not origin/master --no-merges | grep DZL ; then
    echo "PR #$pullid needs a DZL run, running..."
    git checkout -f "branch$pullid"
    export LH_HASH=$(git rev-parse HEAD)

    if grep -q "$LH_HASH" "last-processed-hash-branch-$pullid.artifacts.log"; then
      echo "Hash has not changed since last processing, skipping..."
      continue
    fi

    yarn install || exit 1

    cd "$DZL_PATH" || exit 1

    node ./bin/dzl.js collect --limit=1 --label="branch-$pullid" --hash="$LH_HASH" --concurrency=1 --config=$DZL_CONFIG_FILE
    DZL_EXIT_CODE=$?

    if [ $DZL_EXIT_CODE -eq 0 ]; then
      echo "Success!"
      echo "$LH_HASH" > "$LH_PATH/last-processed-hash-branch-$pullid.artifacts.log"
    else
      echo "Failed, exiting with error code 1"
      exit 1
    fi
  else
    echo "PR #$pullid makes no mention of DZL, skipping..."
  fi
done

