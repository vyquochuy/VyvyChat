import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import { API_ENDPOINTS } from '../config/api';

interface ForgotPasswordProps {
  onSwitchToLogin: () => void;
}

type Step = 'email' | 'otp' | 'locked';

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onSwitchToLogin }) => {
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // OTP States
  const [step, setStep] = useState<Step>('email');
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
      showToast('Mã OTP xác thực đã hết hạn. Vui lòng bấm gửi lại!', 'error');
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

  // Step 1: Request OTP for password reset
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setEmailError(true);
      showToast('Vui lòng nhập địa chỉ email hợp lệ.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SEND_OTP_RESET, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Mã OTP khôi phục mật khẩu đã được gửi đến email của bạn!', 'success');
        setStep('otp');
        setOtp(Array(6).fill(''));
        setSecondsRemaining(300);
        setIsTimerRunning(true);
        setResendCooldown(300);
        setTimeout(() => otpInputsRef.current[0]?.focus(), 400);
      } else {
        showToast(data.error || 'Gửi yêu cầu thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối. Không thể gửi mã OTP khôi phục.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Reset password with OTP
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');

    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      showToast('Vui lòng nhập đầy đủ mã OTP 6 chữ số.', 'error');
      return;
    }

    if (!password) {
      showToast('Vui lòng nhập mật khẩu mới.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpCode,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.', 'success');
        setIsTimerRunning(false);
        onSwitchToLogin();
      } else {
        if (data.code === 'OTP_LOCKED') {
          setStep('locked');
          setIsTimerRunning(false);
        }
        showToast(data.error || 'Đặt lại mật khẩu thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối. Không thể đặt lại mật khẩu.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SEND_OTP_RESET, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (response.ok) {
        showToast('Mã OTP khôi phục mật khẩu mới đã được gửi!', 'success');
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
      {step === 'email' ? (
        <section className="card-step">
          <div className="step-icon-header">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <circle cx="12" cy="11" r="3" />
              <line x1="12" y1="14" x2="12" y2="17" />
            </svg>
          </div>
          <h1 className="step-title">Quên Mật Khẩu?</h1>
          <p className="step-desc">Nhập email của chủ nhân để nhận mã xác thực đặt lại mật khẩu.</p>

          <form className="verification-form" onSubmit={handleRequestOtp} noValidate>
            <div className="input-group">
              <label htmlFor="email-input" className="input-label">Địa chỉ Email đã đăng ký</label>
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
              Quay lại Đăng nhập
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
          <h1 className="step-title">Đặt Lại Mật Khẩu</h1>
          <p className="step-desc">
            Mã xác thực gồm 6 chữ số đã được gửi đến email <span className="highlight-email">{maskEmail(email)}</span>.
            Mã hết hạn trong <span className={`countdown-timer ${secondsRemaining < 60 ? 'warning' : ''}`}>{formatTimer()}</span>.
          </p>

          <form className="verification-form" onSubmit={handleResetSubmit} noValidate>
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

            <div className="input-group mt-5">
              <label htmlFor="new-password-input" className="input-label">Mật khẩu mới</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type="password"
                  id="new-password-input"
                  className="glass-input"
                  placeholder="Nhập mật khẩu mới của chủ nhân"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || secondsRemaining <= 0}
                  required
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading || secondsRemaining <= 0}>
              <span className="btn-text">Đặt lại Mật khẩu</span>
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
                setStep('email');
                setIsTimerRunning(false);
              }}
              disabled={isLoading}
            >
              Thay đổi địa chỉ email
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
          <h1 className="step-title text-red-500">Mã Xác Thực Bị Khóa</h1>
          <p className="step-desc">
            Chủ nhân đã nhập sai mã OTP quá 5 lần liên tiếp. Để đảm bảo an toàn, mã OTP hiện tại cho email <span className="highlight-email">{maskEmail(email)}</span> đã bị vô hiệu hóa. Vui lòng thử lại.
          </p>
          <button type="button" className="submit-btn locked-btn" onClick={onSwitchToLogin}>
            Quay lại Đăng nhập
          </button>
        </section>
      )}
    </main>
  );
};
