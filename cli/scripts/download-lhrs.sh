#!/bin/bash

BATCH_ID=$1
URL=$2
BATCH_ID="official-ci-2019-02-26T01:13:45.295Z"
URL="http://www.netflix.com/"
SQL="select lhr from lhrs where batchId = '$BATCH_ID' and url = '$URL'"

ssh -t dzl-master "echo \"$SQL\" > query.sql"
ssh -t dzl-master "mysql dzl_lighthouse -u dzl --password=lighthouse < query.sql > result.txt"

mkdir -p ./downloads
scp dzl-master:result.txt ./downloads/result.txt
node ./scripts/extract-screenshots.js
