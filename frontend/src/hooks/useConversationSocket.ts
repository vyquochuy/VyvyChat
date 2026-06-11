import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { useToast } from '../components/Toast';
import { useSecretChatContext } from '../providers/SecretChatProvider';
import { isE2EEPayload } from './useE2EE';
import { API_ENDPOINTS } from '../config/api';
import { SOCKET_CONFIG } from '../config/constant';

export function useConversationSocket(
  token: string | null,
  user: any,
  currentPage: string
) {
  const activeFriendId = useChatStore((state) => state.activeFriendId);
  const conversations = useChatStore((state) => state.conversations);
  const friends = useChatStore((state) => state.friends);
  const setConversationId = useChatStore((state) => state.setConversationId);
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateAttachmentStatus = useChatStore((state) => state.updateAttachmentStatus);
  const setTyping = useChatStore((state) => state.setTyping);
  const { showToast } = useToast();

  // E2EE context
  const { e2eeState, encrypt, decrypt } = useSecretChatContext();

  const chatSocketRef = useRef<WebSocket | null>(null);
  const chatPingIntervalRef = useRef<any>(null);
  const activeFriendIdRef = useRef<string | null>(null);
  // Debounce timer cho typing indicator
  const typingTimerRef = useRef<any>(null);

  activeFriendIdRef.current = activeFriendId;

  // Lấy Public Key của bạn bè theo friendId
  const getFriendPublicKey = useCallback((friendId: string): string => {
    const friend = friends.find((f: any) => f.id === friendId);
    return friend?.publicKey || '';
  }, [friends]);

  const getFriendKeyVersion = useCallback((friendId: string): number => {
    const friend = friends.find((f: any) => f.id === friendId);
    return friend?.keyVersion ?? 1;
  }, [friends]);

  const fetchConversationMessages = async (convId: string, friendId: string) => {
    if (!token) return;
    try {
      const response = await fetch(API_ENDPOINTS.CONVERSATIONS.MESSAGES(convId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const friendPubKey = getFriendPublicKey(friendId);

        const decryptedMessages = await Promise.all(
          data.messages.map(async (m: any) => {
            // Cố gắng giải mã nội dung tin nhắn TEXT
            let content = m.content;
            if (m.type === 'TEXT' && isE2EEPayload(content)) {
              const isOutgoing = m.sender_id === user.id;
              content = await decrypt(content, friendId, friendPubKey, token, isOutgoing);
            }
            return {
              id: m.id,
              senderId: m.sender_id === user.id ? 'current-user' : friendId,
              content,
              timestamp: m.created_at,
              type: m.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM',
              attachments: m.attachments || []
            };
          })
        );

        setMessages(friendId, decryptedMessages.reverse());
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch sử tin nhắn:', err);
    }
  };

  const connectChatSocket = (convId: string, friendId: string, tokenVal: string) => {
    if (chatSocketRef.current) {
      chatSocketRef.current.close();
    }

    const ws = new WebSocket(API_ENDPOINTS.WS.CONVERSATION(convId, tokenVal));
    chatSocketRef.current = ws;

    let retryCount = 0;
    const baseDelay = SOCKET_CONFIG.RECONNECT_BASE_DELAY;

    ws.onopen = () => {
      console.log(`[ChatWS] Connected to conversation ${convId}.`);
      retryCount = 0;

      if (chatPingIntervalRef.current) clearInterval(chatPingIntervalRef.current);
      chatPingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, SOCKET_CONFIG.PING_INTERVAL);

      const friendMsgs = useChatStore.getState().messages[friendId] || [];
      const realMsgs = friendMsgs.filter(m => !m.id.includes('mock'));
      if (realMsgs.length > 0) {
        const lastMsg = realMsgs[realMsgs.length - 1];
        ws.send(JSON.stringify({
          type: 'sync',
          lastMessageCreatedAt: lastMsg.timestamp
        }));
      }
    };

    ws.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return;

        // ── Typing Indicator ──
        if (data.type === 'typing') {
          // sender_id là userId của đối phương; friendId là ID trong store
          setTyping(friendId, data.isTyping === true);
          // Tự động tắt sau 4 giây nếu không có sự kiện mới
          if (data.isTyping) {
            clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => setTyping(friendId, false), SOCKET_CONFIG.TYPING_TIMEOUT_MS);
          }
          return;
        }

        // ── Tin nhắn mới ──
        if (data.type === 'message') {
          const raw = data.message;
          const friendPubKey = getFriendPublicKey(friendId);

          let content = raw.content;
          if (raw.type === 'TEXT' && isE2EEPayload(content)) {
            const isOutgoing = raw.sender_id === user?.id;
            content = await decrypt(content, friendId, friendPubKey, token ?? undefined, isOutgoing);
          }

          const mapped = {
            id: raw.id,
            senderId: raw.sender_id === user?.id ? 'current-user' : friendId,
            content,
            timestamp: raw.created_at,
            type: raw.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM',
            attachments: raw.attachments || []
          };
          addMessage(friendId, mapped);
        }

        if (data.type === 'scan_status_update') {
          const { attachment_id, scan_status } = data;
          updateAttachmentStatus(friendId, attachment_id, scan_status);
        }

        if (data.type === 'sync_response') {
          const rawMsgs = data.messages || [];
          const friendPubKey = getFriendPublicKey(friendId);

          const decryptedMsgs = await Promise.all(
            rawMsgs.map(async (raw: any) => {
              let content = raw.content;
              if (raw.type === 'TEXT' && isE2EEPayload(content)) {
                const isOutgoing = raw.sender_id === user?.id;
                content = await decrypt(content, friendId, friendPubKey, token ?? undefined, isOutgoing);
              }
              return {
                id: raw.id,
                senderId: raw.sender_id === user?.id ? 'current-user' : friendId,
                content,
                timestamp: raw.created_at,
                type: raw.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM',
                attachments: raw.attachments || []
              };
            })
          );

          decryptedMsgs.forEach((msg: any) => addMessage(friendId, msg));
        }
      } catch (err) {
        console.error('[ChatWS] Message error:', err);
      }
    };

    ws.onclose = (e) => {
      console.log(`[ChatWS] Connection closed for conversation ${convId}:`, e.reason);
      if (chatPingIntervalRef.current) clearInterval(chatPingIntervalRef.current);

      if (activeFriendIdRef.current === friendId && currentPage === 'success') {
        const delay = baseDelay * Math.pow(2, Math.min(retryCount, SOCKET_CONFIG.RECONNECT_MAX_EXPONENT)) + Math.random() * 1000;
        retryCount++;
        setTimeout(() => {
          if (activeFriendIdRef.current === friendId && currentPage === 'success' && token) {
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

  useEffect(() => {
    if (!token || !activeFriendId || currentPage !== 'success') {
      if (chatSocketRef.current) {
        chatSocketRef.current.close();
        chatSocketRef.current = null;
      }
      return;
    }

    const initChatRoom = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.CONVERSATIONS.CREATE, {
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

          await fetchConversationMessages(convId, activeFriendId);
          connectChatSocket(convId, activeFriendId, token);
        } else {
          console.error('[ChatWS] Không thể kết nối cuộc trò chuyện. Phản hồi API không thành công.');
        }
      } catch (err) {
        console.error('[ChatWS] Lỗi kết nối cuộc trò chuyện:', err);
      }
    };

    initChatRoom();

    return () => {
      if (chatSocketRef.current) {
        chatSocketRef.current.close();
        chatSocketRef.current = null;
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [activeFriendId, token, currentPage, e2eeState.status]);

  // ── Gửi tin nhắn (mã hoá trước nếu E2EE đang bật) ──────────────────────

  const handleSendMessage = async (
    content: string,
    typeMsg: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT',
    attachments?: any[]
  ) => {
    if (!activeFriendId) return;
    const convId = conversations[activeFriendId];
    if (!chatSocketRef.current || chatSocketRef.current.readyState !== WebSocket.OPEN || !convId) {
      showToast('Không có kết nối mạng ổn định để gửi tin nhắn.', 'error');
      return;
    }

    let finalContent = content;

    // Mã hoá nếu là tin nhắn TEXT và E2EE đang active
    if (typeMsg === 'TEXT' && e2eeState.status === 'active') {
      const friendPubKey = getFriendPublicKey(activeFriendId);
      const friendKeyVersion = getFriendKeyVersion(activeFriendId);
      if (friendPubKey) {
        finalContent = await encrypt(content, activeFriendId, friendPubKey, friendKeyVersion);
      }
    }

    chatSocketRef.current.send(JSON.stringify({
      type: 'message',
      conversation_id: convId,
      content: finalContent,
      type_msg: typeMsg,
      attachments
    }));

    // Tắt typing indicator ngay sau khi gửi
    sendTypingStatus(false);
  };

  // ── Gửi tín hiệu đang gõ phím ──────────────────────────────────────────

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (chatSocketRef.current?.readyState === WebSocket.OPEN) {
      chatSocketRef.current.send(JSON.stringify({ type: 'typing', isTyping }));
    }
  }, []);

  return { handleSendMessage, sendTypingStatus };
}
