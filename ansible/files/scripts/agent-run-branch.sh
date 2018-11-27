#!/bin/bash

export LH_PATH="/dzl/src/lighthouse"
export DZL_PATH="/dzl/src/dzl/cli"
export DISPLAY=:98.0
export CHROME_PATH="$(which google-chrome-stable)"
export DZL_CONFIG_FILE="/dzl/conf/agent-branch.config.js"

if [ -e /dzl/log/dzl-off ]; then
  echo "DZL is off, remove /dzl/log/dzl-off to turn back on."
  exit 1
fi

if [ -e /dzl/conf/gh-token.sh ]; then
  source /dzl/conf/gh-token.sh
  echo "GH Token is $(echo $GH_TOKEN | head -c 4)..."
else
  echo "No GH Token is set, comments will not be posted."
fi

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
  git checkout -f "branch$pullid"
  export LH_HASH=$(git rev-parse HEAD)

  if grep -q "$LH_HASH" "last-processed-hash-branch-$pullid.artifacts.log"; then
    echo "Hash has not changed since last processing, skipping..."
    continue
  fi

  PR_HTML_FILE="pull-$pullid.report.html"
  curl https://github.com/GoogleChrome/lighthouse/pull/$pullid > $PR_HTML_FILE

  if ! grep 'DZL, do a barrel roll' $PR_HTML_FILE ; then
    echo "PR #$pullid makes no mention of DZL, skipping..."
    continue
  fi

  echo "PR #$pullid needs a DZL run, running..."
  yarn install || exit 1

  cd "$DZL_PATH" || exit 1

  node ./bin/dzl.js collect --limit=1 --label="branch-$pullid" --hash="$LH_HASH" --concurrency=1 --config=$DZL_CONFIG_FILE
  DZL_EXIT_CODE=$?

  if [ $DZL_EXIT_CODE -eq 0 ]; then
    echo "Success!"
    echo "$LH_HASH" > "$LH_PATH/last-processed-hash-branch-$pullid.artifacts.log"

    if [[ -n $GH_TOKEN ]]; then
      curl -H "Authorization: token $GH_TOKEN" \
        -H "Content-Type: application/json" \
        -H "Accept: application/vnd.github.v3+json" \
        -X POST \
        https://api.github.com/repos/patrickhulce/saas-starter-kit/issues/33/comments \
        --data "{\"body\": \"DZL is done! Go check it https://url-tbd.com/compare?branch-$pullid\"}" || exit 1
    fi
  else
    echo "Failed, exiting with error code 1"
    exit 1
  fi
done

echo "Done with all PR checks!"
