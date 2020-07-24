#!/bin/bash

set -euxo pipefail

DIRNAME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIRNAME

cd ../collection/data

rm -rf data/

for f in lhr-*.tar.gz ;
do
  TARGET_DIR="${f%.tar.gz}"
  if [[ -d "$TARGET_DIR" ]]; then
    echo "Data for $f already extracted."
  else
    tar -xzf "$f"
    mv data/ "$TARGET_DIR"
  fi
done
