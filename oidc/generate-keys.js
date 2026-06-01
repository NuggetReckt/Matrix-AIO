const { exportJWK, generateKeyPair } = require('jose');
const path = require('path');
const fs = require('fs');

async function generate() {
    const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
    const publicJWK = await exportJWK(publicKey);
    const privateJWK = await exportJWK(privateKey);

    const file = path.join(__dirname, './data', 'secrets.json');

    if (fs.existsSync(file)) {
        console.warn(`Warning: ${file} already exists. Skipping.`);
        return;
    }

    fs.writeFileSync(file, JSON.stringify({ public: publicJWK, private: privateJWK }, null, 2));
    console.log(`Keys generated and saved to ${file}`);
}

generate();