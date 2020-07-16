#!/bin/bash

set -euxo pipefail

node create-script-fleet.js

cd .tmp/

for instance in $(ls)
do
  cd "$instance"
  bash create-and-run.sh "$instance"
done
