import { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { useToast } from '../components/Toast';

const BACKEND_URL = 'http://localhost:8787';

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

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends`, {
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

  // Synchronize notifications and requests periodically
  useEffect(() => {
    if (currentPage === 'success' && token) {
      loadDashboardData();

      const interval = setInterval(() => {
        fetchRequests();
        fetchNotifications();
      }, 8000);

      // Refresh friends list mỗi 30 giây để cập nhật publicKey mới nhất
      // (quan trọng cho E2EE: khi bạn bè xoay khóa, cần publicKey mới để encrypt đúng)
      const friendsInterval = setInterval(() => {
        fetchFriends();
      }, 30000);

      return () => {
        clearInterval(interval);
        clearInterval(friendsInterval);
      };
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
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      }
    } catch (err) {
      console.error(err);
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
