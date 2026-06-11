const PBKDF2_ITERATIONS = 260_000;

export interface E2EEPayload {
  encrypted: true;
  ciphertext: string;
  iv: string;
  senderKeyVersion: number;
  recipientKeyVersion: number;
}

export function isE2EEPayload(content: string): E2EEPayload | null {
  try {
    const obj = JSON.parse(content);
    if (obj && obj.encrypted === true && obj.ciphertext && obj.iv) {
      return obj as E2EEPayload;
    }
  } catch { /* not JSON */ }
  return null;
}

export function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/** Dẫn xuất khoá AES-256-GCM từ Recovery Password và muối ngẫu nhiên (PBKDF2). */
export async function deriveKeyFromPassword(password: string, saltHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBuf(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Mã hoá Private Key (JWK string) bằng Recovery Password + AES-256-GCM. */
export async function encryptPrivateKeyJwk(jwkStr: string, password: string): Promise<{ encrypted: string; salt: string; iv: string }> {
  const salt = bufToHex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveKeyFromPassword(password, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, aesKey, enc.encode(jwkStr).buffer as ArrayBuffer);
  return {
    encrypted: bufToHex(cipherBuf),
    salt,
    iv: bufToHex(iv.buffer as ArrayBuffer)
  };
}

/** Giải mã Private Key JWK từ bản mã và Recovery Password. */
export async function decryptPrivateKeyJwk(encryptedHex: string, ivHex: string, saltHex: string, password: string): Promise<string> {
  const aesKey = await deriveKeyFromPassword(password, saltHex);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBuf(ivHex) },
    aesKey,
    hexToBuf(encryptedHex)
  );
  return new TextDecoder().decode(plainBuf);
}

/** Thoả thuận Shared Secret từ Private Key của mình và Public Key của đối phương → AES-256-GCM. */
export async function deriveSharedKey(myPrivateKey: CryptoKey, theirPublicKeyJwk: string): Promise<CryptoKey> {
  const theirPubKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(theirPublicKeyJwk),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPubKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
