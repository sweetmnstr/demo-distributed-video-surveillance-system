import { env } from '../lib/env';

const BASE = env.serverBHttp;

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

// Fetches the server public key once and returns a function that encrypts a
// command string to a base64 RSA-OAEP ciphertext for the 'encrypted' message.
export const createEncryptor = async (): Promise<(plaintext: string) => Promise<string>> => {
  const pem = await (await fetch(`${BASE}/publicKey`)).text();
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  return async (plaintext) => {
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(plaintext));
    return btoa(String.fromCharCode(...new Uint8Array(cipher)));
  };
};
