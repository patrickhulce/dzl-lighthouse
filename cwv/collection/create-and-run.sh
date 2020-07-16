#!/bin/bash

set -euxo pipefail

INSTANCE_SUFFIX=${1:-instance0}
INSTANCE_NAME="cwv-collect-$INSTANCE_SUFFIX"
CLOUDSDK_CORE_PROJECT=lighthouse-infrastructure
ZONE=us-central1-a

gcloud --project="$CLOUDSDK_CORE_PROJECT" compute instances create $INSTANCE_NAME \
  --image-family=ubuntu-1804-lts --image-project=ubuntu-os-cloud \
  --zone="$ZONE" \
  --boot-disk-size=200GB \
  --machine-type=n1-standard-2

cat > .tmp_env <<EOF
export NUMBER_OF_RUNS=9
EOF
# Instance needs time to start up.
until gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp ./.tmp_env $INSTANCE_NAME:/tmp/lhenv --zone="$ZONE"
do
  echo "Waiting for start up ..."
  sleep 10
done
rm .tmp_env

gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp ./setup-machine.sh $INSTANCE_NAME:/tmp/setup-machine.sh --zone="$ZONE"
gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp ./urls.txt $INSTANCE_NAME:/tmp/urls.txt --zone="$ZONE"
gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp ./blocked-patterns.txt $INSTANCE_NAME:/tmp/blocked-patterns.txt --zone="$ZONE"
gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp ./run.sh $INSTANCE_NAME:/tmp/run.sh --zone="$ZONE"
gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp ./run-on-url.sh $INSTANCE_NAME:/tmp/run-on-url.sh --zone="$ZONE"
gcloud --project="$CLOUDSDK_CORE_PROJECT" compute ssh $INSTANCE_NAME --command="bash /tmp/setup-machine.sh" --zone="$ZONE"
gcloud --project="$CLOUDSDK_CORE_PROJECT" compute ssh lighthouse@$INSTANCE_NAME --command="sh -c 'nohup /home/lighthouse/run.sh > /home/lighthouse/collect.log 2>&1 < /dev/null &'" --zone="$ZONE"

set +x

echo "Collection has started."
echo "Check-in on progress anytime by running..."
echo "  $ gcloud --project="$CLOUDSDK_CORE_PROJECT" compute ssh lighthouse@$INSTANCE_NAME --command='tail -f collect.log' --zone=$ZONE"

echo "When complete run..."
echo "  $ gcloud --project="$CLOUDSDK_CORE_PROJECT" compute scp $INSTANCE_NAME:/home/lighthouse/trace-data.tar.gz ./trace-data.tar.gz"
echo "  $ gcloud --project="$CLOUDSDK_CORE_PROJECT" compute instances delete $INSTANCE_NAME"
