#!/bin/bash

set -euo pipefail

CLOUDSDK_CORE_PROJECT=lighthouse-infrastructure
ZONE=us-central1-a

echo "Fetching instances..."
INSTANCES=$(gcloud --project=$CLOUDSDK_CORE_PROJECT compute instances list | grep cwv-collect | awk '{print $1}')
for instance in $INSTANCES
do
  printf "Checking status of $instance..."
  COMMAND='bash -c "tail collect.log | grep Run\ complete"'
  if gcloud --project="$CLOUDSDK_CORE_PROJECT" compute ssh lighthouse@$instance "--command=$COMMAND" --zone=$ZONE ; then
    printf "Done!\n"
  else
    printf "still running :(\n"
  fi
done
