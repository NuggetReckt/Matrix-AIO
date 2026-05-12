//                              _|                _|                          _|
//  _|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
//  _|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
//  _|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
//  _|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|
//
// Trimaran VFX 2026 - Corto Morrow
// fileAdapter.js - Simple file-based adapter to persist data

const path = require('path');
const fs = require('fs');

const DIR = '../data';

class FileAdapter {
    constructor(name) {
        this.name = name;

        if (!fs.existsSync(path.join(__dirname, DIR))) {
            fs.mkdirSync(path.join(__dirname, DIR));
        }
        this.file = path.join(__dirname, DIR, `${name}.json`);
    }

    async upsert(id, payload, expiresIn) {
        const data = this._read();
        data[id] = { payload, expiresIn: expiresIn ? Date.now() + expiresIn * 1000 : null };

        this._write(data);
    }

    async find(id) {
        const data = this._read();
        const item = data[id];

        if (!item) return undefined;
        if (item.expiresIn && Date.now() > item.expiresIn) {
            delete data[id];
            this._write(data);
            return undefined;
        }
        return item.payload;
    }

    async findByUserCode(userCode) {
        const data = this._read();

        for (const [id, item] of Object.entries(data)) {
            if (item.expiresIn && Date.now() > item.expiresIn) {
                delete data[id];
                continue;
            }
            if (item.payload && item.payload.userCode === userCode) {
                this._write(data);
                return item.payload;
            }
        }
        this._write(data);
        return undefined;
    }

    async findByUid(uid) {
        const data = this._read();

        for (const [id, item] of Object.entries(data)) {
            if (item.expiresIn && Date.now() > item.expiresIn) {
                delete data[id];
                continue;
            }
            if (item.payload && item.payload.uid === uid) {
                this._write(data);
                return item.payload;
            }
        }
        this._write(data);
        return undefined;
    }

    async consume(id) {
        const data = this._read();
        const item = data[id];

        if (item) {
            delete data[id];
            this._write(data);
        }
        return item ? item.payload : undefined;
    }

    async destroy(id) {
        const data = this._read();

        delete data[id];
        this._write(data);
    }

    async revokeByGrantId(grantId) {
        const data = this._read();

        for (const [id, item] of Object.entries(data)) {
            if (item.payload && item.payload.grantId === grantId) {
                delete data[id];
            }
        }
        this._write(data);
    }

    _read() {
        try {
            return JSON.parse(fs.readFileSync(this.file, 'utf8'));
        } catch {
            return {};
        }
    }

    _write(data) {
        fs.writeFileSync(this.file, JSON.stringify(data, null, 2));
    }
}

module.exports = FileAdapter;