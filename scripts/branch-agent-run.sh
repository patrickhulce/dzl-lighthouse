#!/bin/bash

export LH_PATH="$HOME/lighthouse"
export DZL_PATH="$HOME/dzl"
export DISPLAY=:99.0
export CHROME_PATH="$(which google-chrome-stable)"

xdpyinfo -display $DISPLAY > /dev/null || Xvfb $DISPLAY -screen 0 1024x768x16 &

cd "$LH_PATH" || exit 1

# If `pulls.html` is more than an hour old or not there, fetch a new one
if ! [ -e pulls.html ] || test `find pulls.html -mmin +60`; then
  curl https://github.com/GoogleChrome/lighthouse/pulls > pulls.html
fi

PULL_IDS=$(grep 'pull.[0-9]' pulls.html | sed -e 's/.*pull.\([0-9]\+\).*/\1/g' | uniq)

for pullid in $PULL_IDS; do
  git fetch origin "pull/$pullid/head:branch$pullid"

  if git log "branch$pullid" --not origin/master --no-merges | grep DZL ; then
    echo "PR #$pullid needs a DZL run, running..."
    git checkout -f "branch$pullid"
    export LH_HASH=$(git rev-parse HEAD)

    if grep -q "$LH_HASH" "last-processed-hash-$pullid.report.json"; then
      echo "Hash has not changed since last processing, skipping..."
      continue
    fi

    cd "$DZL_PATH" || exit 1

    node ./bin/dzl.js collect --limit=1 --label="branch-$pullid" --hash="$LH_HASH" --concurrency=1 --config=./agent.branch.config.js
    DZL_EXIT_CODE=$?

    if [ $DZL_EXIT_CODE -eq 0 ]; then
      echo "Success!"
      echo "$LH_HASH" > "$LH_PATH/last-processed-hash-$pullid.report.json"
    else
      echo "Failed, exiting with error code 1"
      exit 1
    fi

  else
    echo "PR #$pullid makes no mention of DZL, skipping..."
  fi
done

