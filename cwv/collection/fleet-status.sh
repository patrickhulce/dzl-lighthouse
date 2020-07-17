#!/bin/bash

set -euo pipefail

DIRNAME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIRNAME

CLOUDSDK_CORE_PROJECT=lighthouse-infrastructure
ZONE=us-central1-a

EXTRA_ARG=${1:-nokill}

echo "Fetching instances..."
INSTANCES=$(gcloud --project=$CLOUDSDK_CORE_PROJECT compute instances list | grep cwv-collect | awk '{print $1}')
for instance in $INSTANCES
do
  printf "Checking status of $instance..."
  COMMAND="bash -c 'tail collect.log | grep \"Run complete\"'"
  if gcloud --project="$CLOUDSDK_CORE_PROJECT" compute ssh lighthouse@$instance "--command=$COMMAND" --zone="$ZONE" > /dev/null ; then
    printf "Done!\n"

    DATA_DEST="./data/trace-data-$instance.tar.gz"
    mkdir -p data/
    if [[ -f "$DATA_DEST" ]]; then
      echo "Data already downloaded, skipping..."
    else
      printf "Dowloading data..."
      gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp $instance:/home/lighthouse/trace-data.tar.gz "$DATA_DEST" --zone="$ZONE"
      printf "done!\n"
    fi

    if [[ "$EXTRA_ARG" == "--kill" ]]; then
      printf "Killing $instance...\n"
      gcloud --project="$CLOUDSDK_CORE_PROJECT" compute instances delete "$instance" --zone="$ZONE"
      printf "done!\n"
    fi
  else
    printf "still running :(\n"
  fi
done
