import React, { useState, useEffect } from 'react'
import { useSecretChatContext } from '../../../providers/SecretChatProvider'
import { API_ENDPOINTS } from '../../../config/api'

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
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

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

  const handleSendOtp = async () => {
    if (!token) return
    setIsLoading(true)
    setFeedback(null)
    try {
      const res = await fetch(API_ENDPOINTS.AUTH.KEYS_SEND_OTP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const data = await res.json() as { message?: string; error?: string }
      if (res.ok) {
        setOtpSent(true)
        setFeedback({ msg: data.message || 'Mã OTP xác thực đã được gửi về email của bạn.', type: 'success' })
      } else {
        setFeedback({ msg: data.error || 'Gửi OTP thất bại. Vui lòng thử lại.', type: 'error' })
      }
    } catch (err: any) {
      setFeedback({ msg: 'Lỗi kết nối khi gửi OTP.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    if (!token) return
    if (password.length < 8) {
      setFeedback({ msg: 'Recovery Password mới phải có ít nhất 8 ký tự.', type: 'error' })
      return
    }
    if (!otp) {
      setFeedback({ msg: 'Vui lòng nhập mã OTP xác thực.', type: 'error' })
      return
    }
    setIsLoading(true)
    setFeedback(null)
    const ok = await resetEncryption(token, password, otp)
    setIsLoading(false)
    if (ok) {
      setShowResetConfirm(false)
      setOtpSent(false)
      setOtp('')
      setFeedback({ msg: 'Đã xoay vòng khóa thành công. Bạn có thể gửi và nhận tin nhắn mã hóa mới.', type: 'success' })
      setPassword('')
    } else {
      setFeedback({ msg: 'Xoay vòng khóa thất bại. Vui lòng thử lại.', type: 'error' })
    }
  }

  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--bg-card-border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-[13px] outline-none text-left focus:border-[var(--color-purple)] focus:shadow-[0_0_0_3px_var(--color-purple-glow)] transition-all"
  const btnPrimary = "w-full bg-[var(--color-purple)] border-none text-white px-3 py-2 rounded-xl text-[13px] font-bold cursor-pointer disabled:opacity-50 transition-all hover:bg-[var(--color-cyan)] hover:translate-y-[-1px] duration-150"
  const btnSecondary = "bg-[var(--bg-card)] border border-[var(--bg-card-border)] text-[var(--text-secondary)] px-3 py-2 rounded-xl text-[13px] font-bold cursor-pointer transition-all hover:bg-[var(--hover-chat-item)] hover:translate-y-[-1px] duration-150 shadow-sm"
  const btnDanger = "w-full bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] px-3 py-2 rounded-xl text-[13px] font-bold cursor-pointer transition-all hover:bg-[var(--color-error)]/25 hover:translate-y-[-1px] duration-150"

  if (e2eeState.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-[var(--text-muted)] text-[13px]">
        <svg className="animate-spin h-5 w-5 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Đang kiểm tra trạng thái mã hóa...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Header */}
      <div className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={e2eeState.status === 'active' ? 'var(--color-success)' : 'var(--text-muted)'} strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h4 className="text-[14px] font-bold text-[var(--text-primary)] m-0">End-to-End Encryption</h4>
        </div>

        {e2eeState.status === 'active' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[var(--color-success)] rounded-full" />
              <span className="text-[12px] text-[var(--color-success)] font-semibold">Active</span>
            </div>
            <div className="text-[11.5px] text-[var(--text-muted)] mt-1 space-y-0.5">
              <div>Key Version: <span className="text-[var(--text-primary)] font-mono">{e2eeState.keyVersion}</span></div>
              <div>Backup: <span className="text-[var(--color-success)]">Available</span></div>
            </div>
          </div>
        )}

        {e2eeState.status === 'not_configured' && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-slate-300 dark:bg-white/20 rounded-full" />
            <span className="text-[12px] text-[var(--text-muted)]">Not configured</span>
          </div>
        )}

        {e2eeState.status === 'new_device' && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-[12px] text-yellow-600 dark:text-yellow-400 font-semibold">Encryption detected</span>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-[12px] px-3 py-2 rounded-xl ${feedback.type === 'success' ? 'bg-[var(--color-success-glow)] border border-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-[var(--color-error-glow)] border border-[var(--color-error)]/20 text-[var(--color-error)]'}`}>
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
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-[12px] text-amber-800 dark:text-amber-200 leading-[1.5]">
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
          <button className={'w-full ' + btnSecondary} onClick={() => { setShowResetConfirm(false); setPassword(''); setFeedback(null) }}>
            Recover Keys
          </button>
          <button className={'w-full ' + btnDanger} onClick={() => setShowResetConfirm(true)}>
            Reset Encryption
          </button>
        </div>
      )}

      {/* ── Xác nhận Reset / Xoay vòng khóa ── */}
      {showResetConfirm && (
        <div className="flex flex-col gap-3 w-full">
          <div className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-xl px-3 py-2.5 text-[12px] text-[var(--color-error)] leading-[1.5] w-full">
            ⚠️ Cảnh báo: Sau khi xoay vòng khóa, bạn sẽ không thể giải mã các tin nhắn cũ được mã hóa bằng khóa cũ (trừ khi thiết bị này vẫn giữ khóa đó).
          </div>
          <input className={inputCls} type="password" placeholder="New Recovery Password (≥8 ký tự)" value={password} onChange={e => setPassword(e.target.value)} />
          
          <div className="flex gap-2 w-full">
            <input className={`${inputCls} flex-1 min-w-0`} type="text" placeholder="Mã OTP xác thực" value={otp} onChange={e => setOtp(e.target.value)} />
            <button type="button" className={`w-28 ${btnSecondary}`} onClick={handleSendOtp} disabled={isLoading}>
              {otpSent ? 'Gửi lại mã' : 'Lấy mã OTP'}
            </button>
          </div>

          <div className="flex gap-2 w-full">
            <button className={`flex-1 ${btnDanger}`} onClick={handleReset} disabled={isLoading || !otpSent || !otp}>
              {isLoading ? 'Đang xử lý...' : 'Xác nhận Reset'}
            </button>
            <button className="flex-1 bg-[var(--bg-card)] border border-[var(--bg-card-border)] text-[var(--text-secondary)] hover:bg-[var(--hover-chat-item)] px-3 py-2 rounded-xl text-[13px] font-bold cursor-pointer" onClick={() => { setShowResetConfirm(false); setPassword(''); setOtp(''); setOtpSent(false); }}>
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
