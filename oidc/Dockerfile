#                             _|                _|                          _|
# _|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
# _|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
# _|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
# _|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|
#
# Trimaran VFX 2026 - Corto Morrow
# Dockerfile - Dockerfile for building the OIDC provider

FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]