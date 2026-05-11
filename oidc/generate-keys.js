const { exportJWK, generateKeyPair } = require('jose');

async function generate() {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJWK = await exportJWK(publicKey);
  const privateJWK = await exportJWK(privateKey);

  console.log('Public JWK:', JSON.stringify(publicJWK, null, 2));
  console.log('Private JWK:', JSON.stringify(privateJWK, null, 2));
}

generate();