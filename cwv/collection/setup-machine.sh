#!/bin/bash

set -euxo pipefail

# GCloud apt-key
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] http://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -

# Chrome apt-key
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee -a /etc/apt/sources.list.d/google.list
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -

# Node apt-key
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -

# Install dependencies
sudo apt-get update
sudo apt-get install -y xvfb nodejs google-chrome-stable google-cloud-sdk git zip golang-go
sudo npm install -g yarn lighthouse

# Add a lighthouse user
sudo useradd -m -s $(which bash) -G sudo lighthouse || echo "Lighthouse user already exists!"
sudo mv /tmp/lhenv /home/lighthouse/.env
sudo mv /tmp/urls.txt /home/lighthouse/urls.txt
sudo mv /tmp/blocked-patterns.txt /home/lighthouse/blocked-patterns.txt
sudo mv /tmp/run.sh /home/lighthouse/run.sh
sudo mv /tmp/run-on-url.sh /home/lighthouse/run-on-url.sh
sudo chown lighthouse.lighthouse /home/lighthouse/*
sudo chmod +x /home/lighthouse/run.sh
sudo chmod +x /home/lighthouse/run-on-url.sh

# Install WPRGO
cd /home/lighthouse
sudo -i -u lighthouse bash -euxo pipefail << EOF
export HOME="/home/lighthouse"
go get github.com/urfave/cli
go get golang.org/x/net/http2
go get github.com/catapult-project/catapult/web_page_replay_go || echo "Expected failure"
ls go/src/github.com/catapult-project/catapult/web_page_replay_go/src/wpr.go
EOF
