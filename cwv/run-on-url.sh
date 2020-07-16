#!/bin/bash

set -euxo pipefail

URL=$1
JS_REPLACE=".replace(/[^a-z0-9]+/g, '_').replace(/^https?_/, '')"
SAFE_URL=$(node -e "console.log('$URL'$JS_REPLACE)")

whoami
export HOME="/home/lighthouse"

cd /home/lighthouse
mkdir -p ./data
cd ./data

# Import NUMBER_OF_RUNS vars
source /home/lighthouse/.env

LIGHTHOUSE_FLAGS="--output=json --output-path=lhr.json -GA"
for (( i = 0; i < $NUMBER_OF_RUNS; i++ ))
do
  FOLDER_NAME="$SAFE_URL/$i"
  echo "Run $i on $URL..."
  if [[ -f "$FOLDER_NAME" ]]; then
    echo "$FOLDER_NAME already exists, skipping"
    continue
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

ls "$SAFE_URL"/*
