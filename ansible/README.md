## Getting Started

```sh
# Install ansible
brew install ansible
# Download the wprgo archive
wget https://drive.google.com/file/d/1uZc2YklSM8aaOx9ye7XMjhxfmGJG72VG/view?usp=sharing
# Move the archive to the correct place
mv <location of archive> files/agent-official-archive.wprgo
# Run ansible and configure the machines!
ansible-playbook -u <user from gcloud console> -i inventory.ini site.yml
```

### Manual Steps to Run

```bash
# Need to accept host keys
ssh <server-ip>
# Fill in tokens
cat /dzl/conf/tokens.sh <<EOF
export PSI_TOKEN=<psi token>
export GH_TOKEN=<github token>
EOF
# Login to surge
surge login
# Turn off dzl when necessary
touch /dzl/log/dzl-off
```
