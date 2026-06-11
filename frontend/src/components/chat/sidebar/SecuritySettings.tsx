import React, { useState, useEffect } from 'react'
import { useSecretChatContext } from '../../../providers/SecretChatProvider'

interface SecuritySettingsProps {
  token: string | null;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ token }) => {
  const { e2eeState, checkE2EEStatus, setupEncryption, recoverKeys, resetEncryption } = useSecretChatContext()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    if (token && e2eeState.status === 'loading') {
      checkE2EEStatus(token)
    }
  }, [token, e2eeState.status, checkE2EEStatus])

  const handleSetup = async () => {
    if (!token) return
    if (password.length < 8) {
      setFeedback({ msg: 'Recovery Password phải có ít nhất 8 ký tự.', type: 'error' })
      return
    }
    if (password !== confirmPassword) {
      setFeedback({ msg: 'Mật khẩu xác nhận không khớp.', type: 'error' })
      return
    }
    setIsLoading(true)
    setFeedback(null)
    const ok = await setupEncryption(token, password)
    setIsLoading(false)
    if (ok) {
      setFeedback({ msg: 'Mã hóa đầu cuối đã được kích hoạt thành công!', type: 'success' })
      setPassword('')
      setConfirmPassword('')
    } else {
      setFeedback({ msg: 'Thiết lập thất bại. Vui lòng thử lại.', type: 'error' })
    }
  }

  const handleRecover = async () => {
    if (!token) return
    if (!password.trim()) {
      setFeedback({ msg: 'Vui lòng nhập Recovery Password.', type: 'error' })
      return
    }
    setIsLoading(true)
    setFeedback(null)
    const ok = await recoverKeys(token, password)
    setIsLoading(false)
    if (ok) {
      setFeedback({ msg: 'Khôi phục khóa thành công! Tin nhắn cũ đã có thể giải mã.', type: 'success' })
      setPassword('')
    } else {
      setFeedback({ msg: 'Recovery Password không đúng hoặc có lỗi xảy ra.', type: 'error' })
    }
  }

  const handleReset = async () => {
    if (!token) return
    if (password.length < 8) {
      setFeedback({ msg: 'Recovery Password mới phải có ít nhất 8 ký tự.', type: 'error' })
      return
    }
    setIsLoading(true)
    setFeedback(null)
    const ok = await resetEncryption(token, password)
    setIsLoading(false)
    setShowResetConfirm(false)
    if (ok) {
      setFeedback({ msg: 'Đã xoay vòng khóa thành công. Bạn có thể gửi và nhận tin nhắn mã hóa mới.', type: 'success' })
      setPassword('')
    } else {
      setFeedback({ msg: 'Xoay vòng khóa thất bại. Vui lòng thử lại.', type: 'error' })
    }
  }

  const inputCls = "w-full bg-[var(--bg-input)] border border-white/5 rounded-lg px-3 py-2 text-white text-[13px] outline-none text-left focus:border-[var(--color-cyan)] focus:shadow-[0_0_0_2px_var(--color-cyan-glow)] transition-all"
  const btnPrimary = "w-full bg-gradient-to-r from-[var(--color-purple)] to-[#6366f1] border-none text-white px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-50 transition-all hover:opacity-90"
  const btnSecondary = "w-full bg-white/5 border border-white/10 text-[var(--text-secondary)] px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer transition-all hover:bg-white/10"
  const btnDanger = "w-full bg-[rgba(255,51,102,0.08)] border border-[rgba(255,51,102,0.2)] text-[var(--color-error)] px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer transition-all hover:bg-[rgba(255,51,102,0.15)]"

  if (e2eeState.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-[var(--text-muted)] text-[13px]">
        <svg className="animate-spin h-5 w-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Đang kiểm tra trạng thái mã hóa...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={e2eeState.status === 'active' ? 'var(--color-success)' : 'var(--text-muted)'} strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h4 className="text-[14px] font-bold text-white m-0">End-to-End Encryption</h4>
        </div>

        {e2eeState.status === 'active' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--color-success)] rounded-full shadow-[0_0_6px_var(--color-success)]" />
              <span className="text-[12px] text-[var(--color-success)] font-semibold">Active</span>
            </div>
            <div className="text-[11.5px] text-[var(--text-muted)] mt-1 space-y-0.5">
              <div>Key Version: <span className="text-white font-mono">{e2eeState.keyVersion}</span></div>
              <div>Backup: <span className="text-[var(--color-success)]">Available</span></div>
            </div>
          </div>
        )}

        {e2eeState.status === 'not_configured' && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white/20 rounded-full" />
            <span className="text-[12px] text-[var(--text-muted)]">Not configured</span>
          </div>
        )}

        {e2eeState.status === 'new_device' && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
            <span className="text-[12px] text-yellow-400 font-semibold">Encryption detected</span>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-[12px] px-3 py-2 rounded-lg ${feedback.type === 'success' ? 'bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[var(--color-success)]' : 'bg-[rgba(255,51,102,0.08)] border border-[rgba(255,51,102,0.2)] text-[var(--color-error)]'}`}>
          {feedback.msg}
        </div>
      )}

      {/* ── Trạng thái: Chưa thiết lập ── */}
      {e2eeState.status === 'not_configured' && (
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-[var(--text-muted)] leading-[1.5] m-0">
            Thiết lập mã hóa đầu cuối để bảo vệ toàn bộ tin nhắn của bạn. Chỉ bạn và người nhận mới có thể đọc nội dung.
          </p>
          <input className={inputCls} type="password" placeholder="Recovery Password (≥8 ký tự)" value={password} onChange={e => setPassword(e.target.value)} />
          <input className={inputCls} type="password" placeholder="Xác nhận Recovery Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          <button className={btnPrimary} onClick={handleSetup} disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : 'Setup Encryption'}
          </button>
        </div>
      )}

      {/* ── Trạng thái: Thiết bị mới ── */}
      {e2eeState.status === 'new_device' && !showResetConfirm && (
        <div className="flex flex-col gap-3">
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5 text-[12px] text-yellow-200 leading-[1.5]">
            ⚠️ Thiết bị này không có Private Key của bạn. Nhập Recovery Password để khôi phục khóa và giải mã tin nhắn cũ.
          </div>
          <input className={inputCls} type="password" placeholder="Recovery Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className={btnPrimary} onClick={handleRecover} disabled={isLoading}>
            {isLoading ? 'Đang khôi phục...' : 'Recover With Recovery Password'}
          </button>
          <button className={btnDanger} onClick={() => setShowResetConfirm(true)}>
            Reset Encryption
          </button>
        </div>
      )}

      {/* ── Trạng thái: Đang hoạt động ── */}
      {e2eeState.status === 'active' && !showResetConfirm && (
        <div className="flex flex-col gap-2.5">
          <button className={btnSecondary} onClick={() => { setShowResetConfirm(false); setPassword(''); setFeedback(null) }}>
            Recover Keys
          </button>
          <button className={btnDanger} onClick={() => setShowResetConfirm(true)}>
            Reset Encryption
          </button>
        </div>
      )}

      {/* ── Xác nhận Reset / Xoay vòng khóa ── */}
      {showResetConfirm && (
        <div className="flex flex-col gap-3">
          <div className="bg-[rgba(255,51,102,0.05)] border border-[rgba(255,51,102,0.2)] rounded-lg px-3 py-2.5 text-[12px] text-[var(--color-error)] leading-[1.5]">
            ⚠️ Cảnh báo: Sau khi xoay vòng khóa, bạn sẽ không thể giải mã các tin nhắn cũ được mã hóa bằng khóa cũ (trừ khi thiết bị này vẫn giữ khóa đó).
          </div>
          <input className={inputCls} type="password" placeholder="New Recovery Password (≥8 ký tự)" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className={`flex-1 ${btnDanger}`} onClick={handleReset} disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Xác nhận Reset'}
            </button>
            <button className="flex-1 bg-white/5 border border-white/10 text-[var(--text-secondary)] px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer" onClick={() => { setShowResetConfirm(false); setPassword('') }}>
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
