// Unit tests for api/encrypt.ts
// Mocks: globalThis.fetch, crypto.subtle (importKey + encrypt), ../lib/env

jest.mock('../lib/env', () => ({
  env: { serverBHttp: 'http://test-server', serverBWs: 'ws://test', serverAWs: 'ws://test-a' },
}));

import { createEncryptor } from './encrypt';

// A minimal valid base64 string for the PEM body (importKey is mocked so the bytes don't matter).
const FAKE_PEM =
  '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----';

describe('createEncryptor', () => {
  let originalCrypto: typeof globalThis.crypto;

  beforeEach(() => {
    originalCrypto = globalThis.crypto;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  it('fetches the public key and returns a function that produces base64 ciphertext', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      text: async () => FAKE_PEM,
    }) as never;

    const fakeKey = {};
    const cipherBuffer = new Uint8Array([1, 2, 3]).buffer;
    const importKey = jest.fn().mockResolvedValue(fakeKey);
    const encrypt = jest.fn().mockResolvedValue(cipherBuffer);

    Object.defineProperty(globalThis, 'crypto', {
      value: { subtle: { importKey, encrypt } },
      writable: true,
      configurable: true,
    });

    const encryptor = await createEncryptor();

    expect(typeof encryptor).toBe('function');
    expect(globalThis.fetch).toHaveBeenCalledWith('http://test-server/publicKey');
    expect(importKey).toHaveBeenCalledWith(
      'spki',
      expect.any(ArrayBuffer),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );

    const result = await encryptor('GET_STATUS');

    expect(typeof result).toBe('string');
    // btoa([1, 2, 3]) === 'AQID'
    expect(result).toBe('AQID');
    // Verify encrypt was called with the correct algorithm and key; the plaintext
    // is passed as a Uint8Array (the exact bytes are an implementation detail).
    expect(encrypt).toHaveBeenCalledTimes(1);
    const encryptArgs = (encrypt as jest.Mock).mock.calls[0] as unknown[];
    expect(encryptArgs[0]).toEqual({ name: 'RSA-OAEP' });
    expect(encryptArgs[1]).toBe(fakeKey);
  });
});
