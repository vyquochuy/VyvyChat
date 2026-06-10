/**
 * useSecretChat – E2EE Core Hook (Phase 6)
 *
 * Kiến trúc:
 *   - Thuật toán: ECDH (P-256) để thoả thuận Shared Secret → deriveKey → AES-256-GCM
 *   - Lưu trữ: Private Key được import với extractable: false và lưu vào IndexedDB
 *     để ngăn chặn rủi ro bị đọc qua XSS tấn công.
 *   - Sao lưu: Private Key (JWK) được mã hoá bằng PBKDF2 (256k rounds) +
 *     AES-256-GCM trước khi gửi lên server. Máy chủ không thể đọc được.
 *   - Key Versioning: Mỗi cặp khóa có key_version. Mỗi tin nhắn ghi nhận
 *     senderKeyVersion + recipientKeyVersion để hỗ trợ giải mã sau khi xoay khóa.
 *   - Định dạng tin nhắn mã hoá (lưu trong D1):
 *     { "encrypted": true, "ciphertext": "...", "iv": "...", "senderKeyVersion": 1, "recipientKeyVersion": 1 }
 */

import { useState, useCallback, useRef } from 'react'

const BACKEND_URL = 'http://localhost:8787'
const IDB_NAME = 'vivychat_e2ee'
const IDB_VERSION = 1
const IDB_STORE = 'keys'
// Số vòng PBKDF2 — 260,000 đảm bảo chi phí brute-force đủ cao
const PBKDF2_ITERATIONS = 260_000

// ──────────────────────────────────────────────────────────────────────────────
// IndexedDB Helpers
// ──────────────────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Crypto Utilities
// ──────────────────────────────────────────────────────────────────────────────

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes.buffer
}

/** Dẫn xuất khoá AES-256-GCM từ Recovery Password và muối ngẫu nhiên (PBKDF2). */
async function deriveKeyFromPassword(password: string, saltHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
    const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  )
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
  )
}

/** Mã hoá Private Key (JWK string) bằng Recovery Password + AES-256-GCM. */
async function encryptPrivateKeyJwk(jwkStr: string, password: string): Promise<{ encrypted: string; salt: string; iv: string }> {
  const salt = bufToHex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await deriveKeyFromPassword(password, salt)
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, aesKey, enc.encode(jwkStr).buffer as ArrayBuffer)
  return {
    encrypted: bufToHex(cipherBuf),
    salt,
    iv: bufToHex(iv.buffer as ArrayBuffer)
  }
}

/** Giải mã Private Key JWK từ bản mã và Recovery Password. */
async function decryptPrivateKeyJwk(encryptedHex: string, ivHex: string, saltHex: string, password: string): Promise<string> {
  const aesKey = await deriveKeyFromPassword(password, saltHex)
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBuf(ivHex) },
    aesKey,
    hexToBuf(encryptedHex)
  )
  return new TextDecoder().decode(plainBuf)
}

/** Thoả thuận Shared Secret từ Private Key của mình và Public Key của đối phương → AES-256-GCM. */
async function deriveSharedKey(myPrivateKey: CryptoKey, theirPublicKeyJwk: string): Promise<CryptoKey> {
  const theirPubKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(theirPublicKeyJwk),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPubKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Kiểu dữ liệu tin nhắn E2EE
// ──────────────────────────────────────────────────────────────────────────────

export interface E2EEPayload {
  encrypted: true
  ciphertext: string
  iv: string
  senderKeyVersion: number
  recipientKeyVersion: number
}

export function isE2EEPayload(content: string): E2EEPayload | null {
  try {
    const obj = JSON.parse(content)
    if (obj && obj.encrypted === true && obj.ciphertext && obj.iv) return obj as E2EEPayload
  } catch { /* not JSON */ }
  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook chính
// ──────────────────────────────────────────────────────────────────────────────

export interface E2EEState {
  status: 'loading' | 'not_configured' | 'new_device' | 'active'
  keyVersion: number
}

export interface StoredKeyData {
  privateKey: CryptoKey
  publicKeyJwk: string
  keyVersion: number
}

export function useSecretChat(userId: string) {
  const [e2eeState, setE2EEState] = useState<E2EEState>({ status: 'loading', keyVersion: 1 })

  // Cache khóa chia sẻ với từng người bạn: "friendId:keyVersion" → AES CryptoKey
  const sharedKeyCache = useRef<Map<string, CryptoKey>>(new Map())

  // Cache lịch sử public key của bạn bè (fetch từ server): friendId → { key_version, public_key }[]
  const publicKeyHistoryCache = useRef<Map<string, { key_version: number; public_key: string }[]>>(new Map())

  // ── Kiểm tra trạng thái E2EE khi khởi động ──────────────────────────────

  const checkE2EEStatus = useCallback(async (token: string) => {
    try {
      // Kiểm tra xem thiết bị này có Private Key chưa
      const keyData = await idbGet<StoredKeyData>(`e2ee:${userId}`)

      // Kiểm tra xem tài khoản đã đăng ký khoá trên server chưa
      const res = await fetch(`${BACKEND_URL}/api/auth/keys`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const serverKeyData = await res.json() as { hasKeys: boolean; keyVersion?: number }

      if (!serverKeyData.hasKeys) {
        setE2EEState({ status: 'not_configured', keyVersion: 1 })
      } else if (!keyData || keyData.keyVersion !== serverKeyData.keyVersion) {
        setE2EEState({ status: 'new_device', keyVersion: serverKeyData.keyVersion ?? 1 })
      } else {
        setE2EEState({ status: 'active', keyVersion: serverKeyData.keyVersion ?? 1 })
      }
    } catch (err) {
      console.error('[E2EE] checkE2EEStatus failed:', err)
      setE2EEState({ status: 'not_configured', keyVersion: 1 })
    }
  }, [userId])

  // ── Tạo mới cặp khoá và đăng ký lên server ─────────────────────────────

  const setupEncryption = useCallback(async (token: string, recoveryPassword: string): Promise<boolean> => {
    try {
      // 1. Sinh cặp khoá ECDH P-256
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,                    // Cần extractable = true để xuất JWK lần đầu sao lưu
        ['deriveKey']
      )

      // 2. Xuất Public Key thành JWK để gửi lên server
      const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
      const pubJwkStr = JSON.stringify(pubJwk)

      // 3. Xuất Private Key JWK rồi mã hoá bằng Recovery Password
      const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
      const privJwkStr = JSON.stringify(privJwk)
      const { encrypted, salt, iv } = await encryptPrivateKeyJwk(privJwkStr, recoveryPassword)

      // Đóng gói encryptedPrivateKey = "<ciphertext>:<iv>" để dễ parse
      const encryptedPrivateKey = `${encrypted}:${iv}`

      // 4. Đăng ký lên server
      const serverKeyVersion = e2eeState.keyVersion === 0 ? 1 : (e2eeState.status === 'active' ? e2eeState.keyVersion + 1 : 1)
      const setupRes = await fetch(`${BACKEND_URL}/api/auth/keys/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          publicKey: pubJwkStr,
          encryptedPrivateKey,
          recoverySalt: salt,
          keyVersion: serverKeyVersion
        })
      })
      if (!setupRes.ok) throw new Error('Setup key API failed')

      // 5. Reimport Private Key với extractable: false để lưu vào IndexedDB an toàn
      const safePrivKey = await crypto.subtle.importKey(
        'jwk',
        privJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,                   // extractable: false — JS không thể đọc thô được
        ['deriveKey']
      )

      // 6. Lưu vào IndexedDB
      await idbSet(`e2ee:${userId}`, {
        privateKey: safePrivKey,
        publicKeyJwk: pubJwkStr,
        keyVersion: serverKeyVersion
      })

      // 7. Xoá cache shared key cũ (nếu xoay vòng khóa)
      sharedKeyCache.current.clear()
      publicKeyHistoryCache.current.clear()

      setE2EEState({ status: 'active', keyVersion: serverKeyVersion })
      return true
    } catch (err) {
      console.error('[E2EE] setupEncryption failed:', err)
      return false
    }
  }, [userId, e2eeState])

  // ── Khôi phục khóa trên thiết bị mới từ Recovery Password ──────────────

  const recoverKeys = useCallback(async (token: string, recoveryPassword: string): Promise<boolean> => {
    try {
      // 1. Lấy dữ liệu khoá từ server
      const res = await fetch(`${BACKEND_URL}/api/auth/keys`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Fetch keys failed')
      const data = await res.json() as {
        hasKeys: boolean
        publicKey?: string
        encryptedPrivateKey?: string
        recoverySalt?: string
        keyVersion?: number
      }
      if (!data.hasKeys || !data.encryptedPrivateKey || !data.recoverySalt) {
        throw new Error('No keys on server')
      }

      // 2. Parse encryptedPrivateKey = "<ciphertext>:<iv>"
      const [encHex, ivHex] = data.encryptedPrivateKey.split(':')

      // 3. Giải mã Private Key JWK bằng Recovery Password
      const privJwkStr = await decryptPrivateKeyJwk(encHex, ivHex, data.recoverySalt, recoveryPassword)
      const privJwk = JSON.parse(privJwkStr)

      // 4. Import với extractable: false để lưu an toàn vào IndexedDB
      const safePrivKey = await crypto.subtle.importKey(
        'jwk',
        privJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      )

      await idbSet(`e2ee:${userId}`, {
        privateKey: safePrivKey,
        publicKeyJwk: data.publicKey ?? '',
        keyVersion: data.keyVersion ?? 1
      })
      sharedKeyCache.current.clear()
      publicKeyHistoryCache.current.clear()

      setE2EEState({ status: 'active', keyVersion: data.keyVersion ?? 1 })
      return true
    } catch (err) {
      console.error('[E2EE] recoverKeys failed:', err)
      return false
    }
  }, [userId])

  // ── Reset / Xoay vòng khóa ─────────────────────────────────────────────

  const resetEncryption = useCallback(async (token: string, newRecoveryPassword: string): Promise<boolean> => {
    // Xóa khóa cũ trong IndexedDB trước khi tạo mới
    await idbDelete(`e2ee:${userId}`)
    sharedKeyCache.current.clear()
    publicKeyHistoryCache.current.clear()

    // Đặt lại state để setupEncryption tính key_version mới = cũ + 1
    const oldVersion = e2eeState.keyVersion
    setE2EEState({ status: 'active', keyVersion: oldVersion })

    return setupEncryption(token, newRecoveryPassword)
  }, [userId, e2eeState.keyVersion, setupEncryption])

  // ── Lấy hoặc tính Shared Key với một người bạn ─────────────────────────
  // keyVersion: phiên bản public key của friend đang dùng (để cache đúng)

  const getSharedKey = useCallback(async (
    friendId: string,
    friendPublicKeyJwk: string,
    token?: string,
    friendKeyVersion?: number
  ): Promise<CryptoKey | null> => {
    // Cache theo friendId + keyVersion để tránh dùng shared key sai sau khi xoay khóa
    const cacheKey = `${friendId}:${friendKeyVersion ?? 'default'}`
    if (sharedKeyCache.current.has(cacheKey)) {
      return sharedKeyCache.current.get(cacheKey)!
    }

    const keyData = await idbGet<StoredKeyData>(`e2ee:${userId}`)
    const myPrivKey = keyData?.privateKey
    if (!myPrivKey || !friendPublicKeyJwk) return null

    try {
      let pubJwkStr = friendPublicKeyJwk
      // Nếu chưa có publicKey, thử fetch từ server
      if (!pubJwkStr && token) {
        const res = await fetch(`${BACKEND_URL}/api/users/${friendId}/public-keys`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const keys = await res.json() as { key_version: number; public_key: string }[]
          if (keys.length > 0) pubJwkStr = keys[0].public_key
        }
      }
      if (!pubJwkStr) return null

      const sharedKey = await deriveSharedKey(myPrivKey, pubJwkStr)
      sharedKeyCache.current.set(cacheKey, sharedKey)
      return sharedKey
    } catch (err) {
      console.error('[E2EE] getSharedKey failed:', err)
      return null
    }
  }, [userId])

  // ── Mã hoá một tin nhắn văn bản ────────────────────────────────────────

  const encrypt = useCallback(async (
    text: string,
    friendId: string,
    friendPublicKeyJwk: string,
    recipientKeyVersion: number
  ): Promise<string> => {
    if (e2eeState.status !== 'active') return text

    // Truyền recipientKeyVersion vào getSharedKey để cache đúng version
    const sharedKey = await getSharedKey(friendId, friendPublicKeyJwk, undefined, recipientKeyVersion)
    if (!sharedKey) return text

    try {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const enc = new TextEncoder()
      const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, sharedKey, enc.encode(text).buffer as ArrayBuffer)

      const payload: E2EEPayload = {
        encrypted: true,
        ciphertext: bufToHex(cipherBuf),
        iv: bufToHex(iv.buffer as ArrayBuffer),
        senderKeyVersion: e2eeState.keyVersion,
        recipientKeyVersion
      }
      return JSON.stringify(payload)
    } catch (err) {
      console.error('[E2EE] encrypt failed:', err)
      return text
    }
  }, [e2eeState, getSharedKey])

  // ── Giải mã một tin nhắn ───────────────────────────────────────────────

  const decrypt = useCallback(async (
    content: string,
    friendId: string,
    friendPublicKeyJwk: string,
    token?: string,
    isOutgoing = false
  ): Promise<string> => {
    const payload = isE2EEPayload(content)
    if (!payload) return content
    const keyData = await idbGet<StoredKeyData>(`e2ee:${userId}`)
    
    if (e2eeState.status === 'loading') {
      if (keyData) {
        return 'đang tải tin nhắn'
      }
      return '🔒 Tin nhắn được mã hóa – chưa kích hoạt E2EE trên thiết bị này'
    }

    if (e2eeState.status !== 'active') return '🔒 Tin nhắn được mã hóa – chưa kích hoạt E2EE trên thiết bị này'

    const myKeyVersion = keyData?.keyVersion ?? 1

    // Xác định phiên bản khóa cần dùng
    const myNeededKeyVersion = isOutgoing ? payload.senderKeyVersion : payload.recipientKeyVersion
    const friendNeededKeyVersion = isOutgoing ? payload.recipientKeyVersion : payload.senderKeyVersion

    // Kiểm tra nếu phiên bản khóa cần của tôi khác với khóa hiện tại tôi đang giữ
    if (myNeededKeyVersion !== myKeyVersion) {
      return '🔒 Tin nhắn này được mã hóa bằng khóa cũ – không thể giải mã trên thiết bị này'
    }

    let pubJwkToUse = friendPublicKeyJwk
    let friendKeyVersionToUse = friendNeededKeyVersion

    // Fetch public key history của friend (dùng cache để tránh gọi API lặp lại)
    if (token) {
      try {
        let keys = publicKeyHistoryCache.current.get(friendId)
        if (!keys) {
          const res = await fetch(`${BACKEND_URL}/api/users/${friendId}/public-keys`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            keys = await res.json() as { key_version: number; public_key: string }[]
            publicKeyHistoryCache.current.set(friendId, keys)
          }
        }
        if (keys) {
          // Ưu tiên lấy đúng version mà friend dùng khi encrypt/decrypt
          const match = keys.find(k => k.key_version === friendNeededKeyVersion)
          if (match) {
            pubJwkToUse = match.public_key
            friendKeyVersionToUse = match.key_version
          }
        }
      } catch { /* bỏ qua, dùng pubKey hiện tại */ }
    }

    // Truyền friendKeyVersionToUse vào cache key để tránh dùng shared key sai
    const sharedKey = await getSharedKey(friendId, pubJwkToUse, token, friendKeyVersionToUse)
    if (!sharedKey) return '🔒 Không thể giải mã – thiếu khóa'

    try {
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBuf(payload.iv) },
        sharedKey,
        hexToBuf(payload.ciphertext)
      )
      return new TextDecoder().decode(plainBuf)
    } catch (err) {
      console.error('[E2EE] decrypt failed:', err)
      return '🔒 Không thể giải mã tin nhắn này'
    }
  }, [userId, e2eeState, getSharedKey])

  return {
    e2eeState,
    checkE2EEStatus,
    setupEncryption,
    recoverKeys,
    resetEncryption,
    encrypt,
    decrypt,
    getSharedKey,
    isE2EEPayload
  }
}
