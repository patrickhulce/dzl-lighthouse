#!/bin/bash

set -euo pipefail

cd /home/dzl/go/src/github.com/catapult-project/catapult/web_page_replay_go/

/usr/bin/go run src/wpr.go replay --http_port=8780 --https_port=8781 /dzl/data/archive.wprgo
