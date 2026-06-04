import React, { useState } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

const BACKEND_URL = 'http://localhost:8787';

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'success'>('login');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  const { showToast } = useToast();

  React.useEffect(() => {
    if (token) {
      console.log('VivyChat token active: session secured.');
    }
  }, [token]);

  const handleAuthSuccess = (data: { token: string; user: any }) => {
    setToken(data.token);
    setUser(data.user);
    setCurrentPage('success');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setCurrentPage('login');
    showToast('Đã đăng xuất tài khoản thành công.', 'info');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative py-12 px-4">
      {/* Ambient background glow particles */}
      <div className="glow-bg">
        <div className="glow-circle glow-circle-1" id="glow-1"></div>
        <div className="glow-circle glow-circle-2" id="glow-2"></div>
      </div>

      <div className="app-container">
        {/* Brand Header */}
        <header className="app-header">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="logo-text">VivyChat</span>
          </div>
        </header>

        {/* Auth routing */}
        {currentPage === 'login' && (
          <Login
            backendUrl={BACKEND_URL}
            onSwitchToRegister={() => setCurrentPage('register')}
            onSuccess={handleAuthSuccess}
          />
        )}

        {currentPage === 'register' && (
          <Register
            backendUrl={BACKEND_URL}
            onSwitchToLogin={() => setCurrentPage('login')}
            onSuccess={handleAuthSuccess}
          />
        )}

        {currentPage === 'success' && (
          <main className="verification-card">
            <section className="card-step">
              <div className="success-icon-wrapper">
                <div className="success-icon-ring"></div>
                <div className="success-icon">
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <h1 className="step-title">Xác Thực Thành Công!</h1>
              <p className="step-desc">
                Chào mừng, <span className="highlight-email">{user?.displayName}</span> ({user?.email})!<br />
                Tài khoản của bạn đã được khởi tạo và đăng nhập thành công qua Token bảo mật.
              </p>

              <button
                type="button"
                className="submit-btn success-btn"
                onClick={handleLogout}
              >
                Đăng xuất / Trở lại Demo
              </button>
            </section>
          </main>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <p>&copy; 2026 VivyChat. Built with premium design standards.</p>
        </footer>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
};
