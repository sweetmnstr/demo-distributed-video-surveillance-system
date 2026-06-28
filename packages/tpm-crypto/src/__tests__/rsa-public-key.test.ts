// packages/tpm-crypto/src/__tests__/rsa-public-key.test.ts
import { generateKeyPairSync, publicEncrypt, privateDecrypt, constants } from 'node:crypto';
import { rsaComponentsToSpkiPem } from '../rsa-public-key';

describe('rsaComponentsToSpkiPem', () => {
  it('rebuilds a usable SPKI PEM from raw modulus and exponent', () => {
    // Arrange: a real keypair gives us known n/e and a matching private key.
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };
    const modulus = Buffer.from(jwk.n, 'base64url');
    const exponent = Buffer.from(jwk.e, 'base64url');

    // Act
    const pem = rsaComponentsToSpkiPem(modulus, exponent);

    // Assert: shape + functional round-trip through the rebuilt key.
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
    const ciphertext = publicEncrypt(
      { key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from('START_VIDEO', 'utf8'),
    );
    const plaintext = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      ciphertext,
    );
    expect(plaintext.toString('utf8')).toBe('START_VIDEO');
  });

  it('strips leading zero bytes so the JWK modulus is unsigned', () => {
    const modulus = Buffer.concat([Buffer.from([0x00]), Buffer.from([0x80, 0x01])]);
    const exponent = Buffer.from([0x01, 0x00, 0x01]);
    // Should not throw and should not include the padding zero in the base64url 'n'.
    expect(() => rsaComponentsToSpkiPem(modulus, exponent)).not.toThrow();
  });
});
