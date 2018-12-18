## Getting Started

```
brew install ansible
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
