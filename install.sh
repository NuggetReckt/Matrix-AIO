#!/usr/bin/env bash

#                             _|                _|                          _|
# _|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
# _|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
# _|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
# _|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|
#
# Trimaran VFX 2026 - Corto Morrow
# install.sh - MatrixAIO production-ready installation script

PREFIX="\033[90m[\033[36mMatrixAIO\033[90m]\033[0m"

PACKAGES_LIST=(
    mkcert
    ca-certificates
    curl
    wget
)

DOCKER_PKGS_LIST=(
    docker-ce
    docker-ce-cli
    containerd.io
    docker-buildx-plugin
    docker-compose-plugin
)

PRODUCTION=false

CLIENT_DOMAIN="element.local"
OIDC_DOMAIN="auth.local"
SYNAPSE_DOMAIN="synapse.local"

SYNAPSE_SERVER_NAME=$SYNAPSE_DOMAIN

set -e

docker_install() {
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo apt remove $(dpkg --get-selections docker.io docker-compose docker-doc podman-docker containerd runc | cut -f1)
    sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

    sudo apt update
    sudo apt install ${DOCKER_PKGS_LIST[@]}
}

prompt_user_confirm() {
    if [[ -z $2 ]]; then
        log "ERROR" "No command provided for execution on confirmation."
        return 1
    fi
    if [[ -z $4 ]]; then
        done_msg="Done."
    else
        done_msg=$4
    fi

    while true; do
        read -p "$1 (Y/N): " choice
        case $choice in
            [Yy]* ) $2; log "$done_msg" ; break;;
            [Nn]* ) if [[ -n $3 ]]; then log "$3"; fi; break;;
            * ) log "WARN" "Please answer yes (Y) or no (N).";;
        esac
    done
}

log() {
    if [[ -z $2 ]]; then
        message=$1
        level="INFO"
    else
        message=$2
        level=$1
    fi

    if [[ -n $level ]]; then
        case $level in
            "INFO" ) color="\033[0m";;  # Default
            "WARN" ) color="\033[33m";;  # Yellow
            "ERROR" ) color="\033[31m";; # Red
            * ) color="\033[0m";;         # Default
        esac
    else
        color="\033[0m"  # Default
    fi
    echo -e "$PREFIX \033[90m[${color}$level\033[90m] ${color}$message\033[0m"
}

set_production() {
    PRODUCTION=true
}

configure_hostnames() {
    read -p "Enter base domain: " client_domain
    read -p "Enter OIDC domain: " oidc_domain
    read -p "Enter Synapse domain: " synapse_domain

    CLIENT_DOMAIN=$client_domain
    OIDC_DOMAIN=$oidc_domain
    SYNAPSE_DOMAIN=$synapse_domain
}

setup_hostnames() {
    log "Updating /etc/hosts with the following entries:"
    log " - Client Domain: \033[32m$CLIENT_DOMAIN\033[0m"
    log " - OIDC Domain: \033[32m$OIDC_DOMAIN\033[0m"
    log " - Synapse Domain: \033[32m$SYNAPSE_DOMAIN\033[0m"

    # TODO: Ask user if correct, if not run configure_hostnames function again

    # Backup the original /etc/hosts file
    file="/etc/hosts.bak"

    if [ -f "$file" ]; then
        log "Backup file $file already exists. Skipping backup."
    else
        sudo cp /etc/hosts /etc/hosts.bak
    fi

    # Add host entries for the domains
    local domains=("$CLIENT_DOMAIN" "$OIDC_DOMAIN" "$SYNAPSE_DOMAIN")

    for domain in "${domains[@]}"; do
        if grep -qF "$domain" /etc/hosts; then
            log "WARN" "Domain '$domain' already exists in /etc/hosts, skipping."
        else
            echo "127.0.0.1 $domain" | sudo tee -a /etc/hosts > /dev/null
            log "Added: 127.0.0.1 $domain"
        fi
    done
}

setup_mkcert() {
    log "Setting up mkcert for local development with self-signed certificates..."

    mkcert -install
    mkdir -p certs
    mkcert \
        -cert-file certs/fullchain.pem \
        -key-file certs/privkey.pem \
        "$CLIENT_DOMAIN" "$OIDC_DOMAIN" "$SYNAPSE_DOMAIN"

    log "Copying mkcert root CA certificate to certs/ and synapse/ directories..."
    cp $HOME/.local/share/mkcert/rootCA.pem certs/
    cp certs/rootCA.pem synapse
}

setup_certbot() {
    log "Setting up Certbot for production deployment with Let's Encrypt certificates..."
   
    log "Installing Certbot..."
    sudo apt install -y certbot

    log "Obtaining SSL certificates..."
    sudo certbot certonly --standalone \
        -d $CLIENT_DOMAIN \
        -d $OIDC_DOMAIN \
        -d $SYNAPSE_DOMAIN

    log "Setting up certificate symlinks..."
    mkdir -p certs
    sudo cp /etc/letsencrypt/live/$CLIENT_DOMAIN/fullchain.pem certs/fullchain.pem
    sudo cp /etc/letsencrypt/live/$CLIENT_DOMAIN/privkey.pem certs/privkey.pem
    sudo cp /etc/letsencrypt/live/$CLIENT_DOMAIN/chain.pem synapse/rootCA.pem

    sudo chmod -r certs/fullchain.pem certs/privkey.pem synapse/rootCA.pem
}

update_synapse_server_name() {
    read -p "Enter new Synapse server name: " server_name

    SYNAPSE_SERVER_NAME=$server_name
}

echo "
                            _|                _|                          _|
_|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
_|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
_|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
_|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|

Trimaran VFX 2026 - Corto Morrow
MatrixAIO production-ready installation script
"

log "Starting MatrixAIO installation..."
sudo apt update
sudo apt install -y ${PACKAGES_LIST[@]}

# Docker installation
if command -v docker &> /dev/null; then
    log "Docker is already installed: \033[32m$(docker --version)\033[0m"
    prompt_user_confirm "Do you want to reinstall it?" docker_install "" "Docker installed successfully."
else
    log "Docker is not installed. Installing..."
    docker_install
    log "Docker installed successfully."
fi

# Host resolution
log "Here's the default hostnames configuration for MatrixAIO services:"
log " - Client domain: \033[32m$CLIENT_DOMAIN\033[0m"
log " - OIDC domain: \033[32m$OIDC_DOMAIN\033[0m"
log " - Synapse domain: \033[32m$SYNAPSE_DOMAIN\033[0m"
prompt_user_confirm "Do you want to configure hostnames for MatrixAIO services?" configure_hostnames "" "Hostnames configured successfully."
setup_hostnames

# Certificate setup
prompt_user_confirm "Setup MatrixAIO certificates for production-ready deployment?" set_production "Certbot will not be set up. It will use self-signed certificates." "Production deployment selected. Certbot setup will be included in the installation process."
if [ "$PRODUCTION" = true ]; then
    # Certbot setup for production deployment
    setup_certbot
else
    # Self-signed certificates setup for development deployment
    setup_mkcert
fi

# TODO: Find a way to automate synapse configuration keys setup for config file

# Pull latest images
log "Pulling latest images..."
docker compose pull

log "Current Synapse server name is set to \033[32m$SYNAPSE_SERVER_NAME\033[0m."
prompt_user_confirm "Would you like to change it?" update_synapse_server_name "" ""
log "Synapse server name updated to \033[32m$SYNAPSE_SERVER_NAME\033[0m."

# Generate Synapse configuration files
log "Generating Synapse configuration files..."
docker run -it --rm \
    --mount type=volume,src=matrix-aio_synapse_data,dst=/data \
    -e SYNAPSE_SERVER_NAME=$SYNAPSE_SERVER_NAME \
    -e SYNAPSE_REPORT_STATS=no \
    matrixdotorg/synapse:latest generate

# Build stack
log "Building MatrixAIO stack..."
docker compose build

# Generate OIDC provider keys
log "Generating OIDC provider keys..."
docker compose run --no-deps --rm \
    oidc node generate-keys.js

# Create systemd service file for MatrixAIO
log "Creating systemd service file for MatrixAIO..."
sudo cp matrixaio.service /etc/systemd/system/matrixaio.service
sudo systemctl daemon-reload
enable_cmd="sudo systemctl enable matrixaio.service"
prompt_user_confirm "Would you like to enable MatrixAIO service in order to start it at boot?" "$enable_cmd" "You can enable it later with '$enable_cmd'" "MatrixAIO service now enabled at boot startup."

# Start the MatrixAIO service
log "Starting MatrixAIO service..."
start_cmd="sudo systemctl start matrixaio.service"
prompt_user_confirm "Do you want to start the MatrixAIO service now?" "$start_cmd" "You can start it later with '$start_cmd'" "Service started successfully."

# TODO: Post install setup:
# - Add admin user for synapse with custom password
# - ?

log "MatrixAIO installation completed successfully!"