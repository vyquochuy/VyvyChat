import React, { useState, useRef } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Sidebar } from './components/chat/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { useChatStore } from './store/chatStore';

const BACKEND_URL = 'http://localhost:8787';

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'forgot' | 'success'>('login');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Tab state for Phase 3/4 Dashboard
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'search' | 'requests' | 'notifications'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const {
    friends,
    setFriends,
    activeFriendId,
    setConversationId,
    conversations,
    setMessages,
    setOnlineFriends,
    clearStore
  } = useChatStore();

  const { showToast } = useToast();

  // WebSockets and heartbeats refs
  const presenceSocketRef = useRef<WebSocket | null>(null);
  const chatSocketRef = useRef<WebSocket | null>(null);
  const presencePingIntervalRef = useRef<any>(null);
  const chatPingIntervalRef = useRef<any>(null);
  const currentConvIdRef = useRef<string | null>(null);
  const activeFriendIdRef = useRef<string | null>(null);
  activeFriendIdRef.current = activeFriendId;

  // 1. Fetch Danh sách Bạn bè & Trạng thái Online
  const fetchFriends = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data);

        // Fetch trạng thái online ban đầu
        if (data.length > 0) {
          const ids = data.map((f: any) => f.id).join(',');
          await fetchPresenceStatus(ids);
        }
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách bạn bè:', err);
    }
  };

  const fetchPresenceStatus = async (idsString: string) => {
    if (!token || !idsString) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/presence?ids=${idsString}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const presenceMap = await response.json();
        setOnlineFriends(presenceMap);
      }
    } catch (err) {
      console.error('Lỗi khi tải trạng thái trực tuyến:', err);
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

  // Tải lịch sử tin nhắn từ cơ sở dữ liệu (Cursor Pagination)
  const fetchConversationMessages = async (convId: string, friendId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const mapped = data.messages.map((m: any) => ({
          id: m.id,
          senderId: m.sender_id === user.id ? 'current-user' : friendId,
          content: m.content,
          timestamp: m.created_at,
          type: m.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
        })).reverse(); // Đảo thứ tự để hiển thị từ cũ đến mới
        setMessages(friendId, mapped);
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch sử tin nhắn:', err);
    }
  };

  // 2. Thiết lập kết nối Presence WS (Toàn cục)
  const connectPresenceSocket = (tokenVal: string) => {
    if (presenceSocketRef.current) {
      presenceSocketRef.current.close();
    }

    const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
    // Trình duyệt không hỗ trợ Header custom cho WS, nên token được truyền an toàn qua Query Param
    const ws = new WebSocket(`${wsUrl}/ws/presence?token=${encodeURIComponent(tokenVal)}`);
    presenceSocketRef.current = ws;

    let retryCount = 0;
    const baseDelay = 1000;

    ws.onopen = () => {
      console.log('[PresenceWS] Connected successfully.');
      retryCount = 0;

      // Nhịp tim Heartbeat định kỳ 15s để giữ DO không bị tắt
      if (presencePingIntervalRef.current) clearInterval(presencePingIntervalRef.current);
      presencePingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return;
      } catch (err) {
        console.error('[PresenceWS] Parse error:', err);
      }
    };

    ws.onclose = (e) => {
      console.log('[PresenceWS] Connection closed:', e.reason);
      if (presencePingIntervalRef.current) clearInterval(presencePingIntervalRef.current);

      // Tự động kết nối lại bằng Exponential Backoff + Jitter ngẫu nhiên
      if (currentPage === 'success') {
        const delay = baseDelay * Math.pow(2, Math.min(retryCount, 5)) + Math.random() * 1000;
        retryCount++;
        console.log(`[PresenceWS] Reconnecting in ${Math.round(delay)}ms... (Attempt ${retryCount})`);
        setTimeout(() => connectPresenceSocket(tokenVal), delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[PresenceWS] Error:', err);
      ws.close();
    };
  };

  // 3. Thiết lập kết nối Conversation WS
  const connectChatSocket = (convId: string, friendId: string, tokenVal: string) => {
    if (chatSocketRef.current) {
      chatSocketRef.current.close();
    }

    const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/conversation/${convId}?token=${encodeURIComponent(tokenVal)}`);
    chatSocketRef.current = ws;

    let retryCount = 0;
    const baseDelay = 1000;

    ws.onopen = () => {
      console.log(`[ChatWS] Connected to conversation ${convId}.`);
      retryCount = 0;

      // Ping duy trì heartbeat
      if (chatPingIntervalRef.current) clearInterval(chatPingIntervalRef.current);
      chatPingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000);

      // Gửi yêu cầu đồng bộ (sync) tin nhắn bị thiếu dựa trên timestamp tin nhắn cuối cùng
      const friendMsgs = useChatStore.getState().messages[friendId] || [];
      const realMsgs = friendMsgs.filter(m => !m.id.includes('mock'));
      if (realMsgs.length > 0) {
        const lastMsg = realMsgs[realMsgs.length - 1];
        console.log(`[ChatWS] Sending sync request since timestamp: ${lastMsg.timestamp}`);
        ws.send(JSON.stringify({
          type: 'sync',
          lastMessageCreatedAt: lastMsg.timestamp
        }));
      }
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return;

        if (data.type === 'message') {
          const raw = data.message;
          const mapped = {
            id: raw.id,
            senderId: raw.sender_id === user?.id ? 'current-user' : friendId,
            content: raw.content,
            timestamp: raw.created_at,
            type: raw.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
          };
          useChatStore.getState().addMessage(friendId, mapped);
        }

        if (data.type === 'sync_response') {
          const rawMsgs = data.messages || [];
          console.log(`[ChatWS] Synced ${rawMsgs.length} messages.`);
          rawMsgs.forEach((raw: any) => {
            const mapped = {
              id: raw.id,
              senderId: raw.sender_id === user?.id ? 'current-user' : friendId,
              content: raw.content,
              timestamp: raw.created_at,
              type: raw.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
            };
            useChatStore.getState().addMessage(friendId, mapped);
          });
        }
      } catch (err) {
        console.error('[ChatWS] Message error:', err);
      }
    };

    ws.onclose = (e) => {
      console.log(`[ChatWS] Connection closed for conversation ${convId}:`, e.reason);
      if (chatPingIntervalRef.current) clearInterval(chatPingIntervalRef.current);

      // Reconnect với Exponential Backoff + Jitter nếu phòng chat này vẫn đang được mở
      if (activeFriendIdRef.current === friendId && currentPage === 'success') {
        const delay = baseDelay * Math.pow(2, Math.min(retryCount, 5)) + Math.random() * 1000;
        retryCount++;
        console.log(`[ChatWS] Reconnecting in ${Math.round(delay)}ms... (Attempt ${retryCount})`);
        setTimeout(() => {
          if (activeFriendIdRef.current === friendId) {
            connectChatSocket(convId, friendId, tokenVal);
          }
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[ChatWS] Error:', err);
      ws.close();
    };
  };

  // Hàm gửi tin nhắn qua WebSocket
  const handleSendMessage = (content: string) => {
    if (!activeFriendId) return;
    const convId = conversations[activeFriendId];

    if (chatSocketRef.current && chatSocketRef.current.readyState === WebSocket.OPEN && convId) {
      chatSocketRef.current.send(JSON.stringify({
        type: 'message',
        conversation_id: convId,
        content: content,
        type_msg: 'TEXT'
      }));
    } else {
      showToast('Không có kết nối mạng ổn định để gửi tin nhắn.', 'error');
    }
  };

  // Quản lý kết nối/hủy kết nối Presence Socket toàn cục
  React.useEffect(() => {
    if (currentPage === 'success' && token) {
      connectPresenceSocket(token);

      // Polling định kỳ 15 giây lấy trạng thái online của bạn bè
      const interval = setInterval(() => {
        if (friends.length > 0) {
          const ids = friends.map((f: any) => f.id).join(',');
          fetchPresenceStatus(ids);
        }
      }, 15000);

      return () => {
        clearInterval(interval);
        if (presenceSocketRef.current) {
          presenceSocketRef.current.close();
          presenceSocketRef.current = null;
        }
      };
    }
  }, [currentPage, token, friends]);

  // Quản lý việc chuyển phòng chat và khởi tạo kết nối WebSocket tương ứng
  React.useEffect(() => {
    if (!token || !activeFriendId || currentPage !== 'success') {
      if (chatSocketRef.current) {
        chatSocketRef.current.close();
        chatSocketRef.current = null;
      }
      return;
    }

    const initChatRoom = async () => {
      try {
        // 1. Lấy hoặc Tạo mới cuộc hội thoại ở D1
        const response = await fetch(`${BACKEND_URL}/api/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ targetUserId: activeFriendId })
        });

        if (response.ok) {
          const data = await response.json();
          const convId = data.id;
          setConversationId(activeFriendId, convId);
          currentConvIdRef.current = convId;

          // 2. Load lịch sử tin nhắn
          await fetchConversationMessages(convId, activeFriendId);

          // 3. Kết nối WebSocket phòng chat
          connectChatSocket(convId, activeFriendId, token);
        } else {
          showToast('Không thể kết nối phòng chat.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Lỗi kết nối phòng chat.', 'error');
      }
    };

    initChatRoom();

    return () => {
      if (chatSocketRef.current) {
        chatSocketRef.current.close();
        chatSocketRef.current = null;
      }
    };
  }, [activeFriendId, token, currentPage]);

  // Sync định kỳ các thông báo và yêu cầu kết bạn
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
            onSwitchToForgot={() => setCurrentPage('forgot')}
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

        {currentPage === 'forgot' && (
          <ForgotPassword
            backendUrl={BACKEND_URL}
            onSwitchToLogin={() => setCurrentPage('login')}
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
              <ChatArea onSendMessage={handleSendMessage} />
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
