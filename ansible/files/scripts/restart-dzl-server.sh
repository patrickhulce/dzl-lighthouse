#!/bin/bash

for pid in $(ps aux | grep 'bin/dzl.js' | grep serve | awk '{ print $2 }'); do
  kill $pid;
done

exit 0
