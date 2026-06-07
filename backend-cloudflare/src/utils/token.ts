async function getHMACKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Signs a JSON payload using HMAC-SHA256 and returns a URL-safe token.
 */
export async function signToken(payload: any, secret: string): Promise<string> {
  const dataStr = JSON.stringify(payload);
  const key = await getHMACKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(dataStr)
  );
  
  const sigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  const payloadB64 = btoa(unescape(encodeURIComponent(dataStr)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  return `${payloadB64}.${sigHex}`;
}

/**
 * Verifies a URL-safe token using HMAC-SHA256 and returns the decoded payload if valid.
 */
export async function verifyToken(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    
    const [payloadB64, sigHex] = parts;
    
    // Decode base64url
    const dataStr = decodeURIComponent(escape(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))));
    const payload = JSON.parse(dataStr);
    
    // Check expiration
    if (payload.expires && Date.now() > payload.expires) {
      return null;
    }
    
    // Verify signature
    const key = await getHMACKey(secret);
    const encoder = new TextEncoder();
    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(dataStr)
    );
    const expectedSigHex = Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    if (sigHex !== expectedSigHex) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}
