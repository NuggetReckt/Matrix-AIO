#                             _|                _|                          _|
# _|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
# _|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
# _|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
# _|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|
#
# Trimaran VFX 2026 - Corto Morrow
# Dockerfile - Custom Dockerfile for synapse setup with custom CA certificate for internal services communication

FROM matrixdotorg/synapse:latest

USER root

RUN apt-get update && apt-get install -y ca-certificates
COPY rootCA.pem /usr/local/share/ca-certificates/mkcert.crt
RUN update-ca-certificates

USER 991