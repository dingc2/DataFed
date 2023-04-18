#!/bin/bash

set -euf -o pipefail

SCRIPT=$(realpath "$0")
SOURCE=$(dirname "$SCRIPT")
PROJECT_ROOT=$(realpath ${SOURCE}/..)
source ${PROJECT_ROOT}/config/datafed.sh

# Make sure paths exist
mkdir -p ${DATAFED_INSTALL_PATH}/repo
mkdir -p ${DATAFED_INSTALL_PATH}/keys
mkdir -p ${DATAFED_DEFAULT_LOG_PATH}

# Copy configuration files
cp "$PROJECT_ROOT/config/datafed-repo.cfg" ${DATAFED_INSTALL_PATH}/repo

# Generate keys only if they do not exist
if [ ! -f ${DATAFED_INSTALL_PATH}/keys/datafed-repo-key.priv ]
then
  ${DATAFED_INSTALL_PATH}/repo/datafed-repo --gen-keys --cred-dir ${DATAFED_INSTALL_PATH}/keys
fi

# Copy services
cp "$PROJECT_ROOT/services/datafed-repo.service" /etc/systemd/system


systemctl_exists=$( which systemctl )
if [[ ! -z $systemctl_exists ]]
then
  sudo systemctl daemon-reload

  echo "The Globus service should be installed before you use this command"
  if [ ! -f "${DATAFED_INSTALL_PATH}/keys/datafed-core-key.pub" ]
  then
    echo "Missing ${DATAFED_INSTALL_PATH}/keys/datafed-core-key.pub you will not be able to run the repo service until the public key is provided"
  else
    sudo systemctl restart datafed-repo.service
    sudo systemctl status datafed-repo.service
  fi

  # Enable services on reboot
  sudo systemctl enable datafed-repo.service
else
  echo "Not starting systemctl service because did not find systemctl."
fi
