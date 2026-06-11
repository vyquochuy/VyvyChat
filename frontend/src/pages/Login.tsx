import React, { useState } from 'react';
import { useToast } from '../components/Toast';
import { API_ENDPOINTS } from '../config/api';

interface LoginProps {
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
  onSuccess: (data: { token: string; user: any }) => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToRegister, onSwitchToForgot, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  
  const { showToast } = useToast();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setEmailError(true);
      showToast('Vui lòng nhập địa chỉ email hợp lệ.', 'error');
      return;
    }

    if (!password) {
      showToast('Vui lòng nhập mật khẩu.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Đăng nhập thành công!', 'success');
        onSuccess(data);
      } else {
        showToast(data.error || 'Đăng nhập không thành công.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối máy chủ. Vui lòng kiểm tra lại backend.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="verification-card">
      <section className="card-step">
        <div className="step-icon-header">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="step-title">Đăng Nhập VivyChat</h1>
        <p className="step-desc">Đăng nhập tài khoản của bạn để kết nối thời gian thực với bạn bè.</p>

        <form className="verification-form" onSubmit={handleSubmit} noValidate>
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
            <span className="btn-text">Đăng Nhập</span>
            {isLoading && <span className="btn-spinner"></span>}
          </button>
        </form>

        <div className="otp-actions flex flex-col gap-2">
          <button
            type="button"
            className="action-btn-resend"
            onClick={onSwitchToRegister}
            disabled={isLoading}
          >
            Chưa có tài khoản? Đăng ký ngay
          </button>
          <button
            type="button"
            className="action-btn-back !mt-1"
            onClick={onSwitchToForgot}
            disabled={isLoading}
          >
            Quên mật khẩu?
          </button>
        </div>
      </section>
    </main>
  );
};
