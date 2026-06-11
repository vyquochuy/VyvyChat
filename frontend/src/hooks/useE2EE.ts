import { useState, useCallback, useRef } from 'react'
import { API_ENDPOINTS } from '../config/api'
import { idbGet, idbSet, idbDelete } from '../utils/idb'
import {
  bufToHex,
  hexToBuf,
  isE2EEPayload,
  encryptPrivateKeyJwk,
  decryptPrivateKeyJwk,
  deriveSharedKey
} from '../utils/crypto'
import type { E2EEPayload } from '../utils/crypto'

export { isE2EEPayload }
export type { E2EEPayload }


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
      const res = await fetch(API_ENDPOINTS.AUTH.KEYS, {
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
      const setupRes = await fetch(API_ENDPOINTS.AUTH.KEYS_SETUP, {
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
      const res = await fetch(API_ENDPOINTS.AUTH.KEYS, {
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
        const res = await fetch(API_ENDPOINTS.USERS.PUBLIC_KEYS(friendId), {
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
          const res = await fetch(API_ENDPOINTS.USERS.PUBLIC_KEYS(friendId), {
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
