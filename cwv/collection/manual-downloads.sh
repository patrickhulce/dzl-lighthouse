#!/bin/bash

set -euxo pipefail

DIRNAME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIRNAME

CLOUDSDK_CORE_PROJECT=lighthouse-infrastructure
ZONE=us-central1-a

for instanceid in $@
do
  instance="cwv-collect-instance${instanceid}"
  printf "Collecting from $instance..."

  DATA_DEST="./data/trace-data-$instance.tar.gz"
  LHR_DEST="./data/lhr-data-$instance.tar.gz"
  mkdir -p data/
  if [[ -f "$LHR_DEST" ]]; then
    echo "Data already downloaded, skipping..."
  else
    printf "Dowloading data..."
    gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp lighthouse@$instance:/home/lighthouse/trace-data.tar.gz "$DATA_DEST" --zone="$ZONE" --verbosity=debug
    gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp lighthouse@$instance:/home/lighthouse/lhr-data.tar.gz "$LHR_DEST" --zone="$ZONE" --verbosity=debug
    printf "done!\n"
  fi

  printf "Killing $instance...\n"
  gcloud --project="$CLOUDSDK_CORE_PROJECT" compute instances delete "$instance" --zone="$ZONE" --verbosity=debug
  printf "done!\n"
done
