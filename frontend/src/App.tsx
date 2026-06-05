import React, { useState } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Sidebar } from './components/chat/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { useChatStore } from './store/chatStore';

const BACKEND_URL = 'http://localhost:8787';

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'success'>('login');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Tab state for Phase 3 Dashboard
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'search' | 'requests' | 'notifications'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const { setFriends, activeFriendId, clearStore } = useChatStore();

  const { showToast } = useToast();

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách bạn bè:', err);
    }
  };

  const fetchRequests = async () => {
    if (!token) return [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
        return data;
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', err);
    }
    return [];
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách thông báo:', err);
    }
  };

  const loadDashboardData = async () => {
    setIsLoadingData(true);
    await Promise.all([fetchFriends(), fetchRequests(), fetchNotifications()]);
    setIsLoadingData(false);
  };

  React.useEffect(() => {
    if (currentPage === 'success' && token) {
      loadDashboardData();
      
      const interval = setInterval(() => {
        fetchRequests();
        fetchNotifications();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [currentPage, token]);

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });
      const data = await response.json();
      if (response.ok) {
        showToast(data.message || 'Đã gửi lời mời kết bạn thành công!', 'success');
        setSearchResults(prev => prev.map(u => u.id === targetUserId ? { ...u, relationStatus: data.relationStatus } : u));
        loadDashboardData();
      } else {
        showToast(data.error || 'Gửi lời mời thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối.', 'error');
    }
  };

  const handleRespondRequest = async (friendshipId: string, action: 'ACCEPT' | 'DECLINE') => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ friendshipId, action })
      });
      const data = await response.json();
      if (response.ok) {
        showToast(data.message || 'Thao tác thành công.', 'success');
        await loadDashboardData();
        setSearchResults([]);
        setSearchQuery('');
      } else {
        showToast(data.error || 'Thao tác thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối.', 'error');
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !token) return;
    setIsLoadingData(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/search?query=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        showToast('Tìm kiếm thất bại.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối khi tìm kiếm.', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleAuthSuccess = (data: { token: string; user: any }) => {
    setToken(data.token);
    setUser(data.user);
    setCurrentPage('success');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setCurrentPage('login');
    setSearchResults([]);
    setSearchQuery('');
    setActiveTab('chats');
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
          <main className="verification-card !p-0 flex h-[600px] w-full overflow-hidden">
            {/* Left Column (Sidebar) */}
            <div 
              className={`${activeFriendId ? 'hidden md:block' : 'block'} w-full md:w-80 h-full flex-shrink-0`}
            >
              <Sidebar
                currentUser={user}
                pendingRequests={pendingRequests}
                notifications={notifications}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onRespondRequest={handleRespondRequest}
                onMarkRead={handleMarkRead}
                onLogout={handleLogout}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                onSearchSubmit={handleSearchSubmit}
                onSendFriendRequest={handleSendFriendRequest}
                isLoadingData={isLoadingData}
              />
            </div>

            {/* Right Column (Chat Area) */}
            <div 
              className={`${activeFriendId ? 'block' : 'hidden md:block'} flex-1 h-full`}
            >
              <ChatArea />
            </div>
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
