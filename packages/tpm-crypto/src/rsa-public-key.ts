// packages/tpm-crypto/src/rsa-public-key.ts
import { createPublicKey } from 'node:crypto';

// CNG's BCRYPT_RSAPUBLIC_BLOB yields big-endian modulus/exponent bytes. JWK
// expects unsigned big-endian base64url, so strip any leading zero padding
// before encoding.
const toUnsignedBase64Url = (bytes: Buffer): string => {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  return bytes.subarray(start).toString('base64url');
};

// Rebuilds an SPKI PEM public key from the raw RSA modulus and exponent the
// TPM exports. The private half stays sealed in the TPM; only the public key
// is reconstructed here.
export const rsaComponentsToSpkiPem = (modulus: Buffer, exponent: Buffer): string => {
  const key = createPublicKey({
    key: { kty: 'RSA', n: toUnsignedBase64Url(modulus), e: toUnsignedBase64Url(exponent) },
    format: 'jwk',
  });
  return key.export({ type: 'spki', format: 'pem' }).toString();
};
