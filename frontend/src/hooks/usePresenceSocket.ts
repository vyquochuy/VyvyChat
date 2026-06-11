import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useToast } from '../components/Toast';
import { useSecretChatContext } from '../providers/SecretChatProvider';
import { isE2EEPayload } from './useE2EE';
import { API_ENDPOINTS } from '../config/api';
import { SOCKET_CONFIG } from '../config/constant';

export function usePresenceSocket(token: string | null, currentPage: string) {
  const friends = useChatStore((state) => state.friends);
  const activeFriendId = useChatStore((state) => state.activeFriendId);
  const setOnlineFriends = useChatStore((state) => state.setOnlineFriends);
  const addMessage = useChatStore((state) => state.addMessage);
  const { showToast } = useToast();
  const { e2eeState, decrypt } = useSecretChatContext();

  const presenceSocketRef = useRef<WebSocket | null>(null);
  const presencePingIntervalRef = useRef<any>(null);

  // Refs để closures trong onmessage luôn đọc giá trị mới nhất
  const activeFriendIdRef = useRef<string | null>(null);
  const friendsRef = useRef<any[]>([]);
  activeFriendIdRef.current = activeFriendId;
  friendsRef.current = friends;

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

  useEffect(() => {
    if (currentPage !== 'success' || !token) {
      if (presenceSocketRef.current) {
        presenceSocketRef.current.close();
        presenceSocketRef.current = null;
      }
      return;
    }

    let retryCount = 0;
    const baseDelay = SOCKET_CONFIG.RECONNECT_BASE_DELAY;

    const connectPresenceSocket = (tokenVal: string) => {
      if (presenceSocketRef.current) {
        presenceSocketRef.current.close();
      }

      const ws = new WebSocket(API_ENDPOINTS.WS.PRESENCE(tokenVal));
      presenceSocketRef.current = ws;

      ws.onopen = () => {
        console.log('[PresenceWS] Connected successfully.');
        retryCount = 0;

        if (presencePingIntervalRef.current) clearInterval(presencePingIntervalRef.current);
        presencePingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, SOCKET_CONFIG.PING_INTERVAL);
      };

      ws.onmessage = async (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'pong') return;

          // ── Toast Notification khi nhận tin nhắn mới từ phòng chat khác ──
          if (data.type === 'new_message') {
            const senderId = data.sender_id;
            const message = data.message;

            // Chỉ hiển thị Toast nếu đây KHÔNG phải phòng đang mở
            if (activeFriendIdRef.current !== senderId) {
              // Tìm tên người gửi từ danh sách bạn bè
              const senderFriend = friendsRef.current.find((f: any) => f.id === senderId);
              const senderName = senderFriend?.displayName || 'Ai đó';

              // Cố gắng giải mã nội dung để hiển thị preview trong Toast
              let previewText = message.content;
              if (message.type === 'TEXT' && isE2EEPayload(previewText) && e2eeState.status === 'active') {
                try {
                  const friendPubKey = senderFriend?.publicKey || '';
                  previewText = await decrypt(previewText, senderId, friendPubKey, tokenVal);
                } catch {
                  previewText = '🔒 Tin nhắn mã hóa';
                }
              } else if (message.type !== 'TEXT') {
                previewText = `Đã gửi ${message.type === 'IMAGE' ? 'một ảnh' : 'một tệp tin'}`;
              }

              // Giới hạn độ dài preview
              if (previewText.length > 50) previewText = previewText.slice(0, 47) + '...';

              showToast(`💬 ${senderName}: ${previewText}`, 'info');

              // Thêm tin nhắn vào store để realtime kể cả khi không mở phòng chat
              if (senderFriend) {
                const friendPubKey = senderFriend.publicKey || '';
                let decryptedContent = message.content;
                if (message.type === 'TEXT' && isE2EEPayload(decryptedContent) && e2eeState.status === 'active') {
                  try {
                    decryptedContent = await decrypt(decryptedContent, senderId, friendPubKey, tokenVal);
                  } catch { /* giữ nguyên nếu không giải mã được */ }
                }

                addMessage(senderId, {
                  id: message.id,
                  senderId: senderId,
                  content: decryptedContent,
                  timestamp: message.created_at,
                  type: message.type,
                  attachments: message.attachments || []
                });
              }
            }
          }
        } catch (err) {
          console.error('[PresenceWS] Parse error:', err);
        }
      };

      ws.onclose = (e) => {
        console.log('[PresenceWS] Connection closed:', e.reason);
        if (presencePingIntervalRef.current) clearInterval(presencePingIntervalRef.current);

        if (currentPage === 'success') {
          const delay = baseDelay * Math.pow(2, Math.min(retryCount, SOCKET_CONFIG.RECONNECT_MAX_EXPONENT)) + Math.random() * 1000;
          retryCount++;
          setTimeout(() => {
            if (currentPage === 'success' && token) {
              connectPresenceSocket(tokenVal);
            }
          }, delay);
        }
      };

      ws.onerror = (err) => {
        console.error('[PresenceWS] Error:', err);
        ws.close();
      };
    };

    connectPresenceSocket(token);

    // Initial presence check
    if (friends.length > 0) {
      const ids = friends.map((f: any) => f.id).join(',');
      fetchPresenceStatus(ids);
    }

    // Polling presence status every 15s
    const interval = setInterval(() => {
      if (friendsRef.current.length > 0) {
        const ids = friendsRef.current.map((f: any) => f.id).join(',');
        fetchPresenceStatus(ids);
      }
    }, SOCKET_CONFIG.PRESENCE_POLLING_INTERVAL);

    return () => {
      clearInterval(interval);
      if (presencePingIntervalRef.current) clearInterval(presencePingIntervalRef.current);
      if (presenceSocketRef.current) {
        presenceSocketRef.current.close();
        presenceSocketRef.current = null;
      }
    };
  }, [currentPage, token, friends]);
}
