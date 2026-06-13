import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Sidebar } from './components/chat/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { InfoPanel } from './components/chat/InfoPanel';
import { useChatStore } from './store/chatStore';
import { useNotifications } from './hooks/useNotifications';
import { SocketProvider, useSocket } from './providers/SocketProvider';
import { SecretChatProvider } from './providers/SecretChatProvider';

const DashboardContent: React.FC<{
  user: any;
  token: string;
  onLogout: () => void;
  currentPage: string;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}> = ({ user, token, onLogout, currentPage, theme, setTheme }) => {
  const activeFriendId = useChatStore((state) => state.activeFriendId);
  const friends = useChatStore((state) => state.friends);
  const messages = useChatStore((state) => state.messages);
  const { handleSendMessage } = useSocket();
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'search' | 'requests' | 'notifications' | 'security'>('chats');
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  const activeFriend = friends.find((f) => f.id === activeFriendId);
  const friendMsgs = activeFriendId ? messages[activeFriendId] : [];

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    pendingRequests,
    notifications,
    handleMarkRead,
    handleRespondRequest,
    handleSendFriendRequest,
    handleSearchSubmit
  } = useNotifications(token, currentPage);

  return (
    <main className="verification-card !p-0 flex h-full md:h-[85vh] md:min-h-[550px] md:max-h-[850px] w-full md:rounded-[24px] rounded-none border-none md:border-solid overflow-hidden bg-[var(--bg-primary)]">
      {/* Left Column (Sidebar) */}
      <div className={`${activeFriendId ? 'hidden md:block' : 'block'} w-full md:w-80 h-full flex-shrink-0`}>
        <Sidebar
            currentUser={user}
            token={token}
            pendingRequests={pendingRequests}
            notifications={notifications}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onRespondRequest={handleRespondRequest}
            onMarkRead={handleMarkRead}
            onLogout={onLogout}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSearchSubmit={handleSearchSubmit}
            onSendFriendRequest={handleSendFriendRequest}
            theme={theme}
            setTheme={setTheme}
          />
      </div>

      {/* Center Column (Chat Area) */}
      <div className={`${activeFriendId ? 'block' : 'hidden md:block'} flex-1 h-full`}>
        <ChatArea
          onSendMessage={handleSendMessage}
          token={token}
          onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
          showInfoPanel={showInfoPanel}
        />
      </div>

      {/* Right Column (Info Panel) */}
      {activeFriendId && activeFriend && showInfoPanel && (
        <div className="hidden lg:block w-72 h-full flex-shrink-0">
          <InfoPanel
            friend={activeFriend}
            messages={friendMsgs}
            onClose={() => setShowInfoPanel(false)}
            token={token}
            theme={theme}
            setTheme={setTheme}
          />
        </div>
      )}
    </main>
  );
};

const Dashboard: React.FC<{
  user: any;
  token: string;
  currentPage: string;
  onLogout: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}> = ({ user, token, currentPage, onLogout, theme, setTheme }) => {
  return (
    <SecretChatProvider userId={user.id}>
      <SocketProvider token={token} user={user} currentPage={currentPage}>
        <DashboardContent user={user} token={token} onLogout={onLogout} currentPage={currentPage} theme={theme} setTheme={setTheme} />
      </SocketProvider>
    </SecretChatProvider>
  );
};

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'forgot' | 'success'>('login');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const { showToast } = useToast();
  const clearStore = useChatStore((state) => state.clearStore);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('vivychat-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vivychat-theme', theme);
  }, [theme]);

  const handleAuthSuccess = (data: { token: string; user: any }) => {
    setToken(data.token);
    setUser(data.user);
    setCurrentPage('success');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setCurrentPage('login');
    clearStore();
    showToast('Đã đăng xuất tài khoản thành công.', 'info');
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center relative ${currentPage === 'success' ? 'p-0 md:py-12 md:px-4' : 'py-12 px-4'}`}>
      {/* Ambient background glow particles */}
      <div className="glow-bg">
        <div className="glow-circle glow-circle-1" id="glow-1"></div>
        <div className="glow-circle glow-circle-2" id="glow-2"></div>
      </div>

      <div className={`app-container ${currentPage === 'success' ? '!max-w-none md:!max-w-[1440px] !w-full md:!w-[95vw] !p-0 !h-[100dvh] md:!h-[85vh]' : ''}`}>
        {/* Brand Header (Hidden when logged in) */}
        {currentPage !== 'success' && (
          <header className="app-header w-full flex justify-between items-center mb-6">
            <div className="logo-wrapper flex items-center gap-2">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="logo-text">VivyChat</span>
            </div>

            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--bg-card-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center shadow-sm"
              title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
            >
              {theme === 'light' ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
          </header>
        )}

        {/* Auth routing */}
        {currentPage === 'login' && (
          <Login
            onSwitchToRegister={() => setCurrentPage('register')}
            onSwitchToForgot={() => setCurrentPage('forgot')}
            onSuccess={handleAuthSuccess}
          />
        )}

        {currentPage === 'register' && (
          <Register
            onSwitchToLogin={() => setCurrentPage('login')}
            onSuccess={handleAuthSuccess}
          />
        )}

        {currentPage === 'forgot' && (
          <ForgotPassword
            onSwitchToLogin={() => setCurrentPage('login')}
          />
        )}

        {currentPage === 'success' && token && (
          <Dashboard
            user={user}
            token={token}
            currentPage={currentPage}
            onLogout={handleLogout}
            theme={theme}
            setTheme={setTheme}
          />
        )}

        {/* Footer (Hidden when logged in) */}
        {currentPage !== 'success' && (
          <footer className="app-footer">
            <p>&copy; 2026 VivyChat. Built with premium design standards.</p>
          </footer>
        )}
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
