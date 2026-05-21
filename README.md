```
                                      _|                _|                          _|
          _|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
          _|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
          _|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
          _|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|

                                    Trimaran VFX 2026 - Corto Morrow
         A fully integrated, ready-to-deploy internal messaging system tailored for Trimaran VFX.
```

# Introduction

This project provides a fully integrated internal messaging platform designed for Trimaran VFX. It combines a Matrix Synapse homeserver, a custom OpenID Connect (OIDC) provider, and a web client interface, all packaged for secure and controlled deployment within a private infrastructure.

# Getting Started
## 1. Host Resolution

Ensure the required domains resolve correctly on your machine and within your network.

Edit your `/etc/hosts` file (or equivalent on Windows):
```bash
127.0.0.1 auth.local
127.0.0.1 matrix.local
127.0.0.1 element.local
```

> [!IMPORTANT]  
> If you update the hostnames in the /etc/hosts file, do not forget to also update:
> - network aliases in docker compose
> - Nginx server names in nginx/nginx.conf
> - Element base-url for the synapse matrix server in element/config.json
> - Synapse public_baseurl and issuer URL for the oidc provider

## 2. Certificates

1. Generate certificates using mkcert:
  ```bash
  mkcert -install
  mkcert auth.local matrix.local element.local
  ```

  This will produce:
  - `matrix.local+2.pem` to be renamed to `fullchain.pem`
  - `matrix.local+2-key.pem` to be rename to `privkey.pem`

2. Create a directory and move those files into:
  ```bash
  mkdir certs
  mv *.pem certs/
  ```

3. Finally, copy the rootCA certificate into the `certs` directory and `synapse`:
  ```bash
  cp /home/<user>/.local/share/mkcert/rootCA.pem certs/
  cp certs/rootCA.pem synapse
  ```

> [!WARNING]  
> This setup relies on locally trusted certificates. It means that this is not recommanded for a production-ready setup. For a production setup, please consider using Certbot (Let's encrypt) or Cloudflare.

## 3. Configuration

1. Adjust configuration files as needed:
  - Synapse configuration (homeserver.yaml)
  - OIDC provider environment variables (synapse URL, provider base-URL) in docker-compose.yml
  - Reverse proxy configuration (NGINX)

2. Ensure consistency across:
  - Domain names
  - HTTPS endpoints
  - Redirect URIs

3. Generate JWKs for the OIDC provider:
  - in the `oidc/` directory, run the following command:
    ```bash
    node generate-keys.js
    ```
  - And copy/paste the returned values in the oidc configuration:
    ```js
    const configuration = {
        // [...]
        jwks: {
            keys: [
                {
                    kty: 'RSA',
                    n: '',
                    e: '',
                    d: '',
                    p: '',
                    q: '',
                    dp: '',
                    dq: '',
                    qi: '',
                    alg: 'RS256',
                    kid: 'key-1',
                    use: 'sig'
                }
            ]
        }
    };
    ```

4. Generate synapse configuration files:
  ```bash
  docker run -it --rm \
    --mount type=volume,src=matrix-aio_synapse_data,dst=/data \
    -e SYNAPSE_SERVER_NAME=matrix.local \
    -e SYNAPSE_REPORT_STATS=no \
    matrixdotorg/synapse:latest generate
  ```

5. Copy/paste the `registration_shared_secret`, `macaroon_secret_key`, `form_secret` values of the generated config file into your homeserver.yaml:
  ```bash
  grep -E "macaroon_secret_key|form_secret|registration_shared_secret" /var/lib/docker/volumes/matrix-aio_synapse_data/_data/homeserver.yaml
  ```

## 4. Start the Stack

Run the full environment:

```bash
docker compose up --build -d
```

Services included:
- Synapse (Matrix homeserver)
- OIDC Provider (authentication service)
- NGINX (reverse proxy with HTTPS)
- Element Web (client interface)

# Project Structure
```
.
├── docker-compose.yml
├── synapse/
│   ├── Dockerfile
│   ├── homeserver.yaml
│   ├── rootCA.pem
│   ├── modules/
│   │   └── on_register.py
├── oidc/
│   ├── Dockerfile
│   ├── index.js
├── nginx/
│   ├── auth.conf
│   ├── matrix.conf
├── element/
│   └── config.json
└── certs/
    ├── fullchain.pem
    ├── privkey.pem
    └── rootCA.pem
```

**docker-compose.yml**<br>
Defines and orchestrates all services in a shared network.

**synapse/**<br>
Contains the Matrix Synapse server configuration and Docker build context.

**oidc/**<br>
Custom OpenID Connect provider implementation using Node.js.

**nginx/**<br>
Reverse proxy configuration for routing and TLS termination.

**element/**<br>
Configuration for the Element Web client.

**certs/**<br>
Shared certificate authority and TLS-related files.

# Useful Resources
- Synapse docs: https://element-hq.github.io/synapse/latest
- Node OIDC Provider docs: https://github.com/panva/node-oidc-provider/blob/HEAD/docs

# Credits
The Synapse/Element/Matrix Team

Made by Corto Morrow for Trimaran VFX