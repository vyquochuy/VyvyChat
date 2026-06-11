import React, { useState } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Sidebar } from './components/chat/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { useChatStore } from './store/chatStore';
import { useNotifications } from './hooks/useNotifications';
import { SocketProvider, useSocket } from './providers/SocketProvider';
import { SecretChatProvider } from './providers/SecretChatProvider';

const DashboardContent: React.FC<{
  user: any;
  token: string;
  onLogout: () => void;
  currentPage: string;
}> = ({ user, token, onLogout, currentPage }) => {
  const activeFriendId = useChatStore((state) => state.activeFriendId);
  const { handleSendMessage } = useSocket();
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'search' | 'requests' | 'notifications' | 'security'>('chats');

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    pendingRequests,
    notifications,
    isLoadingData,
    handleMarkRead,
    handleRespondRequest,
    handleSendFriendRequest,
    handleSearchSubmit
  } = useNotifications(token, currentPage);

  return (
    <main className="verification-card !p-0 flex h-[600px] w-full overflow-hidden">
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
            isLoadingData={isLoadingData}
          />
      </div>

      {/* Right Column (Chat Area) */}
      <div className={`${activeFriendId ? 'block' : 'hidden md:block'} flex-1 h-full`}>
        <ChatArea
          onSendMessage={handleSendMessage}
          token={token}
        />
      </div>
    </main>
  );
};

const Dashboard: React.FC<{
  user: any;
  token: string;
  currentPage: string;
  onLogout: () => void;
}> = ({ user, token, currentPage, onLogout }) => {
  return (
    <SecretChatProvider userId={user.id}>
      <SocketProvider token={token} user={user} currentPage={currentPage}>
        <DashboardContent user={user} token={token} onLogout={onLogout} currentPage={currentPage} />
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
    <div className="min-h-screen w-full flex items-center justify-center relative py-12 px-4">
      {/* Ambient background glow particles */}
      <div className="glow-bg">
        <div className="glow-circle glow-circle-1" id="glow-1"></div>
        <div className="glow-circle glow-circle-2" id="glow-2"></div>
      </div>

      <div className={`app-container ${currentPage === 'success' ? '!max-w-[960px]' : ''}`}>
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
          />
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
