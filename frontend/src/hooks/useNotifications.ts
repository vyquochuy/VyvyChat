import { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { useToast } from '../components/Toast';
import { API_ENDPOINTS } from '../config/api';

export function useNotifications(token: string | null, currentPage: string) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const { showToast } = useToast();

  const setFriends = useChatStore((state) => state.setFriends);
  const setOnlineFriends = useChatStore((state) => state.setOnlineFriends);

  const fetchPresenceStatus = async (idsString: string) => {
    if (!token || !idsString) return;
    try {
      const response = await fetch(API_ENDPOINTS.USERS.PRESENCE(idsString), {
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

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const response = await fetch(API_ENDPOINTS.FRIENDS.LIST, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data);

        // Fetch online presence initially
        if (data.length > 0) {
          const ids = data.map((f: any) => f.id).join(',');
          await fetchPresenceStatus(ids);
        }
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách bạn bè:', err);
    }
  };

  const fetchRequests = async () => {
    if (!token) return [];
    try {
      const response = await fetch(API_ENDPOINTS.FRIENDS.REQUESTS, {
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
      const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.LIST, {
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

  // Synchronize notifications and requests periodically
  useEffect(() => {
    if (currentPage !== 'success' || !token) return;

    let intervalId: any = null;
    let friendsIntervalId: any = null;

    const startPolling = () => {
      fetchRequests();
      fetchNotifications();
      fetchFriends();

      intervalId = setInterval(() => {
        fetchRequests();
        fetchNotifications();
      }, 30000); // 30s for notifications/requests

      friendsIntervalId = setInterval(() => {
        fetchFriends();
      }, 60000); // 60s for friends public keys refresh
    };

    const stopPolling = () => {
      if (intervalId) clearInterval(intervalId);
      if (friendsIntervalId) clearInterval(friendsIntervalId);
    };

    // Initial load
    loadDashboardData();

    // Start polling if tab is active initially
    if (!document.hidden) {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentPage, token]);

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRespondRequest = async (friendshipId: string, action: 'ACCEPT' | 'DECLINE') => {
    if (!token) return;
    try {
      const response = await fetch(API_ENDPOINTS.FRIENDS.RESPOND, {
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

  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!token) return;
    try {
      const response = await fetch(API_ENDPOINTS.FRIENDS.REQUEST, {
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
        setSearchResults((prev) => prev.map((u) => (u.id === targetUserId ? { ...u, relationStatus: data.relationStatus } : u)));
        loadDashboardData();
      } else {
        showToast(data.error || 'Gửi lời mời thất bại.', 'error');
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
      const response = await fetch(API_ENDPOINTS.USERS.SEARCH(searchQuery.trim()), {
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

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    pendingRequests,
    notifications,
    isLoadingData,
    loadDashboardData,
    handleMarkRead,
    handleRespondRequest,
    handleSendFriendRequest,
    handleSearchSubmit,
    clearSearch
  };
}
