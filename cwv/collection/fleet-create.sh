#!/bin/bash

set -euxo pipefail

DIRNAME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIRNAME

node create-script-fleet.js

cd .tmp/

for instance in $(ls)
do
  cd "$instance"
  bash create-and-run.sh "$instance" &
  cd ..
done

wait
