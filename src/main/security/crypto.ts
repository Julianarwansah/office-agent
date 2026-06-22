import { randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { hostname, userInfo } from 'node:os';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

const PREFIX_SAFE = 'enc:v1:safeStorage:';
const PREFIX_FALLBACK = 'enc:v1:fallback:';

function getSafeStorage(): { isEncryptionAvailable: () => boolean; encryptString: (s: string) => Buffer; decryptString: (b: Buffer) => string } | null {
  try {
    // Lazy require so this module can also be imported from contexts where Electron isn't available
    // (e.g. unit tests, build scripts).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    if (electron && electron.safeStorage && typeof electron.safeStorage.encryptString === 'function') {
      return electron.safeStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

function deriveKey(salt: Buffer): Buffer {
  const machineId = createHash('sha256')
    .update(hostname())
    .update('|')
    .update(userInfo().username || 'anonymous')
    .digest('hex');
  return scryptSync(machineId, salt, KEY_LEN, SCRYPT_PARAMS);
}

export class FallbackCrypto {
  encrypt(plaintext: string): string {
    const salt = randomBytes(16);
    const iv = randomBytes(IV_LEN);
    const key = deriveKey(salt);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX_FALLBACK + salt.toString('base64') + ':' + iv.toString('base64') + ':' + enc.toString('base64') + ':' + tag.toString('base64');
  }

  decrypt(ciphertext: string): string {
    const payload = ciphertext.startsWith(PREFIX_FALLBACK) ? ciphertext.slice(PREFIX_FALLBACK.length) : ciphertext;
    const parts = payload.split(':');
    if (parts.length !== 4) throw new Error('FallbackCrypto: invalid ciphertext format');
    const [saltB64, ivB64, encB64, tagB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const key = deriveKey(salt);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }
}

let fallbackSingleton: FallbackCrypto | null = null;
function getFallback(): FallbackCrypto {
  if (!fallbackSingleton) fallbackSingleton = new FallbackCrypto();
  return fallbackSingleton;
}

export function isEncryptionAvailable(): boolean {
  const ss = getSafeStorage();
  if (ss) {
    try { return ss.isEncryptionAvailable(); } catch { return false; }
  }
  return false;
}

export function encrypt(plaintext: string): string {
  if (plaintext == null) return '';
  const ss = getSafeStorage();
  if (ss) {
    try {
      if (ss.isEncryptionAvailable()) {
        const buf = ss.encryptString(String(plaintext));
        return PREFIX_SAFE + buf.toString('base64');
      }
    } catch {
      // fall through to fallback
    }
  }
  return getFallback().encrypt(String(plaintext));
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  if (ciphertext.startsWith(PREFIX_SAFE)) {
    const ss = getSafeStorage();
    const raw = Buffer.from(ciphertext.slice(PREFIX_SAFE.length), 'base64');
    if (ss) {
      try {
        return ss.decryptString(raw);
      } catch {
        // try fallback if safeStorage decryption fails (e.g. different machine)
      }
    }
    // Safe storage ciphertext but safeStorage not available — cannot decrypt safely
    throw new Error('SafeStorage ciphertext present but safeStorage is not available');
  }
  if (ciphertext.startsWith(PREFIX_FALLBACK)) {
    return getFallback().decrypt(ciphertext);
  }
  // Backwards compat: assume plaintext was stored unencrypted
  return ciphertext;
}

export const cryptoUtils = {
  encrypt,
  decrypt,
  isEncryptionAvailable,
  FallbackCrypto,
};