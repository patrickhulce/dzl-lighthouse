#!/bin/bash

set -euxo pipefail

URL=$1
BLOCKED_PATTERNS_FLAGS=$2
JS_REPLACE=".replace(/[^a-z0-9]+/g, '_').replace(/^https?_/, '')"
SAFE_URL=$(node -e "console.log('$URL'$JS_REPLACE)")

whoami
export HOME="/home/lighthouse"

cd /home/lighthouse
mkdir -p ./data
cd ./data

# Import NUMBER_OF_RUNS vars
source /home/lighthouse/.env

EXTRA_LIGHTHOUSE_FLAGS=${BASE_LIGHTHOUSE_FLAGS:-}

for (( i = 0; i < $NUMBER_OF_RUNS; i++ ))
do
  for RUN_TYPE in regular blocked ; do
    FOLDER_NAME="$SAFE_URL/$i-$RUN_TYPE"
    echo "Run $i on $URL..."
    if [[ -f "$FOLDER_NAME" ]]; then
      echo "$FOLDER_NAME already exists, skipping"
      continue
    fi

    LIGHTHOUSE_FLAGS="$EXTRA_LIGHTHOUSE_FLAGS --output=json --output-path=lhr.json -GA"
    if [[ "$RUN_TYPE" == "blocked" ]]; then
      LIGHTHOUSE_FLAGS="$BLOCKED_PATTERNS_FLAGS $LIGHTHOUSE_FLAGS"
    fi

    xvfb-run lighthouse "$URL" $LIGHTHOUSE_FLAGS ||
      xvfb-run lighthouse "$URL" $LIGHTHOUSE_FLAGS ||
      xvfb-run lighthouse "$URL" $LIGHTHOUSE_FLAGS

    mv lhr.json ./latest-run
    mkdir -p "$SAFE_URL"
    mv ./latest-run "$FOLDER_NAME"

    if [ "$i" -gt "0" ]; then
      echo "{}" > "$FOLDER_NAME/artifacts.json"
    fi
  done
done

ls "$SAFE_URL"/*
