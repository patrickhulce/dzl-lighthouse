#!/bin/bash

STALLED_PIDS=$(ps -eo comm,pid,etimes,command | awk '/agent-run/ {if ($3 >= 21600) { print $2 }}')
LOG_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [[ -n "$STALLED_PIDS" ]]; then
  echo "$LOG_TS Found stalled jobs $STALLED_PIDS..."

  kill $STALLED_PIDS
  rm /dzl/log/.lockfile-branch-and-ondemand
  rm /dzl/log/.lockfile-official
  rm /dzl/log/.lockfile-psi
else
  echo "$LOG_TS No stalled jobs found!"
fi

exit 0
