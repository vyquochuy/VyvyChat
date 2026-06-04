import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';

interface RegisterProps {
  onSwitchToLogin: () => void;
  onSuccess: (data: { token: string; user: any }) => void;
  backendUrl: string;
}

type Step = 'form' | 'otp' | 'locked';

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin, onSuccess, backendUrl }) => {
  // Form States
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // OTP States
  const [step, setStep] = useState<Step>('form');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [secondsRemaining, setSecondsRemaining] = useState(300); // 5 mins
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputsRef = useRef<HTMLInputElement[]>([]);
  const { showToast } = useToast();

  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      setIsTimerRunning(false);
      showToast('Mã OTP đã hết hạn. Vui lòng bấm gửi lại!', 'error');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  // Resend Cooldown Effect
  useEffect(() => {
    let interval: any;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const validateEmail = (val: string) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(val.trim());
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(false);
  };

  const handleClearEmail = () => {
    setEmail('');
    setEmailError(false);
  };

  // Step 1: Send OTP request
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setEmailError(true);
      showToast('Vui lòng nhập địa chỉ email hợp lệ.', 'error');
      return;
    }

    if (!displayName.trim() || !password) {
      showToast('Vui lòng điền đầy đủ thông tin.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Gửi OTP thành công! Vui lòng kiểm tra email.', 'success');
        setStep('otp');
        setOtp(Array(6).fill(''));
        setSecondsRemaining(300);
        setIsTimerRunning(true);
        setResendCooldown(300);
        setTimeout(() => otpInputsRef.current[0]?.focus(), 400);
      } else {
        showToast(data.error || 'Gửi OTP thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối. Không thể gửi mã OTP.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Register user with OTP
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');

    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      showToast('Vui lòng nhập đầy đủ mã OTP 6 chữ số.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpCode,
          password,
          displayName: displayName.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Đăng ký tài khoản thành công!', 'success');
        setIsTimerRunning(false);
        onSuccess(data);
      } else {
        if (data.code === 'OTP_LOCKED') {
          setStep('locked');
          setIsTimerRunning(false);
        }
        showToast(data.error || 'Đăng ký thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối. Không thể hoàn tất đăng ký.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (response.ok) {
        showToast('Mã OTP mới đã được gửi thành công!', 'success');
        setOtp(Array(6).fill(''));
        setSecondsRemaining(300);
        setIsTimerRunning(true);
        setResendCooldown(300);
        setTimeout(() => otpInputsRef.current[0]?.focus(), 400);
      } else {
        const data = await response.json();
        showToast(data.error || 'Gửi lại OTP thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối. Không thể gửi lại OTP.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (val: string, index: number) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = cleanVal.substring(cleanVal.length - 1);
    setOtp(newOtp);

    if (cleanVal.length > 0 && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (otp[index] === '') {
        if (index > 0) {
          const newOtp = [...otp];
          newOtp[index - 1] = '';
          setOtp(newOtp);
          otpInputsRef.current[index - 1]?.focus();
        }
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const digits = pasteData.replace(/[^0-9]/g, '').slice(0, 6);

    if (digits.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < digits.length; i++) {
        newOtp[i] = digits[i];
      }
      setOtp(newOtp);
      const nextFocus = Math.min(digits.length, 5);
      otpInputsRef.current[nextFocus]?.focus();
    }
  };

  const formatTimer = () => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const maskEmail = (emailStr: string) => {
    const [name, domain] = emailStr.split('@');
    if (name.length <= 3) {
      return `${name[0]}***@${domain}`;
    }
    return `${name.substring(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  return (
    <main className="verification-card">
      {step === 'form' ? (
        <section className="card-step">
          <div className="step-icon-header">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <h1 className="step-title">Tạo Tài Khoản Mới</h1>
          <p className="step-desc">Đăng ký VivyChat để bắt đầu kết nối không giới hạn.</p>

          <form className="verification-form" onSubmit={handleSendOtp} noValidate>
            <div className="input-group">
              <label htmlFor="name-input" className="input-label">Tên hiển thị</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  id="name-input"
                  className="glass-input"
                  placeholder="Tên của bạn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="email-input" className="input-label">Địa chỉ Email</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  type="email"
                  id="email-input"
                  className="glass-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  autoComplete="email"
                  spellCheck="false"
                  required
                />
                {email.trim().length > 0 && !isLoading && (
                  <button
                    type="button"
                    className="input-clear-btn"
                    onClick={handleClearEmail}
                    aria-label="Clear email input"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              {emailError && (
                <span className="error-message">Vui lòng nhập địa chỉ email hợp lệ.</span>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="password-input" className="input-label">Mật khẩu</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type="password"
                  id="password-input"
                  className="glass-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              <span className="btn-text">Gửi Mã Xác Nhận</span>
              {isLoading && <span className="btn-spinner"></span>}
            </button>
          </form>

          <div className="otp-actions">
            <button
              type="button"
              className="action-btn-resend"
              onClick={onSwitchToLogin}
              disabled={isLoading}
            >
              Đã có tài khoản? Đăng nhập ngay
            </button>
          </div>
        </section>
      ) : step === 'otp' ? (
        <section className="card-step">
          <div className="step-icon-header">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="step-title">Xác Nhận OTP</h1>
          <p className="step-desc">
            Chúng tôi đã gửi mã xác thực gồm 6 chữ số đến email <span className="highlight-email">{maskEmail(email)}</span>. 
            Mã sẽ hết hạn trong <span className={`countdown-timer ${secondsRemaining < 60 ? 'warning' : ''}`}>{formatTimer()}</span>.
          </p>

          <form className="verification-form" onSubmit={handleRegisterSubmit} noValidate>
            <div className="otp-inputs-container">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="otp-input"
                  value={digit}
                  disabled={isLoading || secondsRemaining <= 0}
                  ref={(el) => {
                    if (el) otpInputsRef.current[idx] = el;
                  }}
                  onChange={(e) => handleOtpChange(e.target.value, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  onPaste={handleOtpPaste}
                  aria-label={`Digit ${idx + 1}`}
                  required
                />
              ))}
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading || secondsRemaining <= 0}>
              <span className="btn-text">Xác Thực & Đăng Ký</span>
              {isLoading && <span className="btn-spinner"></span>}
            </button>
          </form>

          <div className="otp-actions">
            <button
              type="button"
              className="action-btn-resend"
              onClick={handleResendOtp}
              disabled={isLoading || resendCooldown > 0}
            >
              Gửi lại mã {resendCooldown > 0 && `(${resendCooldown}s)`}
            </button>
            <button
              type="button"
              className="action-btn-back"
              onClick={() => {
                setStep('form');
                setIsTimerRunning(false);
              }}
              disabled={isLoading}
            >
              Chỉnh sửa thông tin đăng ký
            </button>
          </div>
        </section>
      ) : (
        <section className="card-step">
          <div className="locked-icon-wrapper">
            <div className="locked-icon-ring"></div>
            <div className="locked-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <line x1="12" y1="15" x2="12" y2="17" />
                <circle cx="12" cy="16" r="1" />
              </svg>
            </div>
          </div>
          <h1 className="step-title text-red-500">Mã OTP Đã Bị Khóa</h1>
          <p className="step-desc">
            Chủ nhân đã nhập sai mã OTP quá 5 lần liên tiếp. Vì lý do bảo mật, mã OTP hiện tại cho email <span className="highlight-email">{maskEmail(email)}</span> đã bị vô hiệu hóa hoàn toàn. Vui lòng quay lại trang đăng nhập để tiếp tục.
          </p>
          <button type="button" className="submit-btn locked-btn" onClick={onSwitchToLogin}>
            Quay lại Đăng Nhập
          </button>
        </section>
      )}
    </main>
  );
};
