import { useEffect, useRef, useCallback } from 'react';
import { Message, useChatStore } from '../store/chatStore';
import { useToast } from '../components/Toast';
import { useSecretChatContext } from '../providers/SecretChatProvider';
import { isE2EEPayload } from './useE2EE';
import { decryptString, encryptBuffer, encryptString } from '../utils/crypto';
import { idbGet } from '../utils/idb';
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
  const { e2eeState, encrypt, decrypt, getSharedKey } = useSecretChatContext();

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
            let content = m.content;
            const isE2EE = isE2EEPayload(content);
            let attachments = m.attachments || [];

            if (isE2EE) {
              const isOutgoing = m.sender_id === user.id;
              content = await decrypt(content, friendId, friendPubKey, token, isOutgoing);

              if (attachments.length > 0) {
                try {
                  const keyData = await idbGet<any>(`e2ee:${user.id}`);
                  const payload = isE2EEPayload(m.content)!;
                  const myKeyVersion = keyData?.keyVersion ?? 1;
                  const myNeededKeyVersion = isOutgoing ? payload.senderKeyVersion : payload.recipientKeyVersion;

                  if (myNeededKeyVersion === myKeyVersion) {
                    const friendNeededKeyVersion = isOutgoing ? payload.recipientKeyVersion : payload.senderKeyVersion;
                    
                    let friendPubKeyToUse = friendPubKey;
                    if (token) {
                      try {
                        const res = await fetch(API_ENDPOINTS.USERS.PUBLIC_KEYS(friendId), {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (res.ok) {
                          const keys = await res.json() as { key_version: number; public_key: string }[];
                          const match = keys.find((k: any) => k.key_version === friendNeededKeyVersion);
                          if (match) {
                            friendPubKeyToUse = match.public_key;
                          }
                        }
                      } catch {}
                    }

                    const sharedKey = await getSharedKey(friendId, friendPubKeyToUse, token, friendNeededKeyVersion);
                    if (sharedKey) {
                      attachments = await Promise.all(attachments.map(async (att: any) => {
                        const file_name = await decryptString(att.file_name, sharedKey);
                        const mime_type = await decryptString(att.mime_type, sharedKey);
                        return { ...att, file_name, mime_type };
                      }));
                    }
                  }
                } catch (err) {
                  console.error('Failed to decrypt attachments metadata:', err);
                }
              }
            }
            return {
              id: m.id,
              senderId: m.sender_id === user.id ? 'current-user' : friendId,
              content,
              timestamp: m.created_at,
              type: m.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM',
              attachments,
              isE2EE: isE2EE ? true : undefined,
              message_state: m.message_state
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

    ws.onopen = async () => {
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

      // Check for pending forward message
      const pending = useChatStore.getState().pendingForwardMessage;
      if (pending) {
        try {
          let finalContent = pending.content;
          let attachments = pending.attachments || [];
          const isE2EE = e2eeState.status === 'active';

          if (isE2EE) {
            const friendPubKey = getFriendPublicKey(friendId);
            const friendKeyVersion = getFriendKeyVersion(friendId);
            const sharedKey = await getSharedKey(friendId, friendPubKey, tokenVal, friendKeyVersion);

            if (sharedKey) {
              // 1. Encrypt text content
              finalContent = await encrypt(pending.content, friendId, friendPubKey, friendKeyVersion);

              // 2. Encrypt attachments metadata and upload if file buffer exists
              if (pending.decryptedFileBuffer) {
                const sha256Buffer = await crypto.subtle.digest('SHA-256', pending.decryptedFileBuffer);
                const hashArray = Array.from(new Uint8Array(sha256Buffer));
                const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                const encFileName = await encryptString(pending.originalFileName || 'file', sharedKey);
                const encMimeType = await encryptString(pending.originalMimeType || 'application/octet-stream', sharedKey);

                const encryptedFileBuffer = await encryptBuffer(pending.decryptedFileBuffer, sharedKey);
                const uploadSize = encryptedFileBuffer.byteLength;

                const upRes = await fetch(API_ENDPOINTS.MEDIA.UPLOAD_URL, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenVal}`
                  },
                  body: JSON.stringify({
                    file_name: encFileName,
                    file_size: uploadSize,
                    mime_type: encMimeType,
                    sha256
                  })
                });
                if (!upRes.ok) throw new Error('Yêu cầu tải lên thất bại.');
                const { upload_url, storage_key } = await upRes.json() as { upload_url: string; storage_key: string };

                const uploadRes = await fetch(upload_url, {
                  method: 'PUT',
                  body: encryptedFileBuffer
                });
                if (!uploadRes.ok) throw new Error('Không thể tải tệp mã hóa lên.');

                attachments = [{
                  id: crypto.randomUUID(),
                  file_name: encFileName,
                  file_size: uploadSize,
                  mime_type: encMimeType,
                  storage_key: storage_key,
                  sha256,
                  scan_status: 'PENDING'
                }];
              }
            }
          } else {
            // For non-E2EE destinations, if we have a decrypted buffer, upload it in plain text
            if (pending.decryptedFileBuffer) {
              const sha256Buffer = await crypto.subtle.digest('SHA-256', pending.decryptedFileBuffer);
              const hashArray = Array.from(new Uint8Array(sha256Buffer));
              const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

              const upRes = await fetch(API_ENDPOINTS.MEDIA.UPLOAD_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${tokenVal}`
                },
                body: JSON.stringify({
                  file_name: pending.originalFileName || 'file',
                  file_size: pending.decryptedFileBuffer.byteLength,
                  mime_type: pending.originalMimeType || 'application/octet-stream',
                  sha256
                })
              });
              if (!upRes.ok) throw new Error('Yêu cầu tải lên thất bại.');
              const { upload_url, storage_key } = await upRes.json() as { upload_url: string; storage_key: string };

              const uploadRes = await fetch(upload_url, {
                method: 'PUT',
                body: pending.decryptedFileBuffer
              });
              if (!uploadRes.ok) throw new Error('Không thể tải tệp lên.');

              attachments = [{
                id: crypto.randomUUID(),
                file_name: pending.originalFileName || 'file',
                file_size: pending.decryptedFileBuffer.byteLength,
                mime_type: pending.originalMimeType || 'application/octet-stream',
                storage_key: storage_key,
                sha256,
                scan_status: 'PENDING'
              }];
            }
          }

          // Gửi tin nhắn chuyển tiếp
          ws.send(JSON.stringify({
            type: 'message',
            conversation_id: convId,
            content: finalContent,
            type_msg: pending.type,
            attachments
          }));

          useChatStore.getState().setPendingForwardMessage(null);
          showToast('Đã chuyển tiếp tin nhắn thành công!', 'success');
        } catch (err: any) {
          console.error('[Forward] Error:', err);
          showToast('Chuyển tiếp thất bại: ' + err.message, 'error');
          useChatStore.getState().setPendingForwardMessage(null);
        }
      }
    };

    ws.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return;

        // ── Message Recalled ──
        if (data.type === 'message_recalled') {
          const { messageId } = data;
          useChatStore.getState().recallMessage(friendId, messageId);
          return;
        }

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
          const isE2EE = isE2EEPayload(content);
          let attachments = raw.attachments || [];

          if (isE2EE) {
            const isOutgoing = raw.sender_id === user?.id;
            content = await decrypt(content, friendId, friendPubKey, token ?? undefined, isOutgoing);

            if (attachments.length > 0) {
              try {
                const keyData = await idbGet<any>(`e2ee:${user?.id}`);
                const payload = isE2EEPayload(raw.content)!;
                const myKeyVersion = keyData?.keyVersion ?? 1;
                const myNeededKeyVersion = isOutgoing ? payload.senderKeyVersion : payload.recipientKeyVersion;

                if (myNeededKeyVersion === myKeyVersion) {
                  const friendNeededKeyVersion = isOutgoing ? payload.recipientKeyVersion : payload.senderKeyVersion;
                  const sharedKey = await getSharedKey(friendId, friendPubKey, token ?? undefined, friendNeededKeyVersion);
                  if (sharedKey) {
                    attachments = await Promise.all(attachments.map(async (att: any) => {
                      const file_name = await decryptString(att.file_name, sharedKey);
                      const mime_type = await decryptString(att.mime_type, sharedKey);
                      return { ...att, file_name, mime_type };
                    }));
                  }
                }
              } catch (err) {
                console.error('Failed to decrypt attachments metadata on message:', err);
              }
            }
          }

          const mapped = {
            id: raw.id,
            senderId: raw.sender_id === user?.id ? 'current-user' : friendId,
            content,
            timestamp: raw.created_at,
            type: raw.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM',
            attachments,
            isE2EE: isE2EE ? true : undefined,
            message_state: raw.message_state
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
              const isE2EE = isE2EEPayload(content);
              let attachments = raw.attachments || [];

              if (isE2EE) {
                const isOutgoing = raw.sender_id === user?.id;
                content = await decrypt(content, friendId, friendPubKey, token ?? undefined, isOutgoing);

                if (attachments.length > 0) {
                  try {
                    const keyData = await idbGet<any>(`e2ee:${user?.id}`);
                    const payload = isE2EEPayload(raw.content)!;
                    const myKeyVersion = keyData?.keyVersion ?? 1;
                    const myNeededKeyVersion = isOutgoing ? payload.senderKeyVersion : payload.recipientKeyVersion;

                    if (myNeededKeyVersion === myKeyVersion) {
                      const friendNeededKeyVersion = isOutgoing ? payload.recipientKeyVersion : payload.senderKeyVersion;
                      const sharedKey = await getSharedKey(friendId, friendPubKey, token ?? undefined, friendNeededKeyVersion);
                      if (sharedKey) {
                        attachments = await Promise.all(attachments.map(async (att: any) => {
                          const file_name = await decryptString(att.file_name, sharedKey);
                          const mime_type = await decryptString(att.mime_type, sharedKey);
                          return { ...att, file_name, mime_type };
                        }));
                      }
                    }
                  } catch (err) {
                    console.error('Failed to decrypt attachments metadata on sync:', err);
                  }
                }
              }

              return {
                id: raw.id,
                senderId: raw.sender_id === user?.id ? 'current-user' : friendId,
                content,
                timestamp: raw.created_at,
                type: raw.type as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM',
                attachments,
                isE2EE: isE2EE ? true : undefined,
                message_state: raw.message_state
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

    // Mã hoá nếu E2EE đang active (hỗ trợ TEXT, IMAGE, FILE)
    if ((typeMsg === 'TEXT' || typeMsg === 'IMAGE' || typeMsg === 'FILE') && e2eeState.status === 'active') {
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

  // ── Thu hồi tin nhắn ───────────────────────────────────────────

  const handleRecallMessage = useCallback((messageId: string) => {
    if (!activeFriendId) return;
    const convId = conversations[activeFriendId];
    if (chatSocketRef.current?.readyState === WebSocket.OPEN && convId) {
      chatSocketRef.current.send(JSON.stringify({
        type: 'recall_message',
        messageId,
        conversation_id: convId
      }));
    }
  }, [activeFriendId, conversations]);

  // ── Gửi tín hiệu đang gõ phím ──────────────────────────────────────────

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (chatSocketRef.current?.readyState === WebSocket.OPEN) {
      chatSocketRef.current.send(JSON.stringify({ type: 'typing', isTyping }));
    }
  }, []);

  // ── Chuyển tiếp tin nhắn ─────────────────────────────────────────

  const handleForwardMessage = async (
    targetFriendId: string,
    message: Message,
    decryptedBuffer?: ArrayBuffer
  ) => {
    const isE2EE = e2eeState.status === 'active';
    let originalFileName = '';
    let originalMimeType = '';
    
    if (message.attachments && message.attachments.length > 0) {
      originalFileName = message.attachments[0].file_name;
      originalMimeType = message.attachments[0].mime_type;
    }

    const forwardPayload: Message = {
      ...message,
      decryptedFileBuffer: decryptedBuffer,
      originalFileName,
      originalMimeType
    };

    if (targetFriendId === activeFriendId) {
      // Gửi trực tiếp nếu đang ở trong cùng cuộc hội thoại và socket đang mở
      const convId = conversations[activeFriendId];
      if (!chatSocketRef.current || chatSocketRef.current.readyState !== WebSocket.OPEN || !convId) {
        showToast('Không có kết nối mạng ổn định để gửi tin nhắn.', 'error');
        return;
      }

      try {
        let finalContent = message.content;
        let attachments = message.attachments || [];

        if (isE2EE) {
          const friendPubKey = getFriendPublicKey(activeFriendId);
          const friendKeyVersion = getFriendKeyVersion(activeFriendId);
          const sharedKey = await getSharedKey(activeFriendId, friendPubKey, token ?? undefined, friendKeyVersion);

          if (sharedKey) {
            finalContent = await encrypt(message.content, activeFriendId, friendPubKey, friendKeyVersion);

            if (decryptedBuffer) {
              const sha256Buffer = await crypto.subtle.digest('SHA-256', decryptedBuffer);
              const hashArray = Array.from(new Uint8Array(sha256Buffer));
              const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

              const encFileName = await encryptString(originalFileName || 'file', sharedKey);
              const encMimeType = await encryptString(originalMimeType || 'application/octet-stream', sharedKey);

              const encryptedFileBuffer = await encryptBuffer(decryptedBuffer, sharedKey);
              const uploadSize = encryptedFileBuffer.byteLength;

              const upRes = await fetch(API_ENDPOINTS.MEDIA.UPLOAD_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  file_name: encFileName,
                  file_size: uploadSize,
                  mime_type: encMimeType,
                  sha256
                })
              });
              if (!upRes.ok) throw new Error('Yêu cầu tải lên thất bại.');
              const { upload_url, storage_key } = await upRes.json() as { upload_url: string; storage_key: string };

              const uploadRes = await fetch(upload_url, {
                method: 'PUT',
                body: encryptedFileBuffer
              });
              if (!uploadRes.ok) throw new Error('Không thể tải tệp mã hóa lên.');

              attachments = [{
                id: crypto.randomUUID(),
                file_name: encFileName,
                file_size: uploadSize,
                mime_type: encMimeType,
                storage_key: storage_key,
                sha256,
                scan_status: 'PENDING'
              }];
            }
          }
        } else {
          if (decryptedBuffer) {
            const sha256Buffer = await crypto.subtle.digest('SHA-256', decryptedBuffer);
            const hashArray = Array.from(new Uint8Array(sha256Buffer));
            const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const upRes = await fetch(API_ENDPOINTS.MEDIA.UPLOAD_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                file_name: originalFileName || 'file',
                file_size: decryptedBuffer.byteLength,
                mime_type: originalMimeType || 'application/octet-stream',
                sha256
              })
            });
            if (!upRes.ok) throw new Error('Yêu cầu tải lên thất bại.');
            const { upload_url, storage_key } = await upRes.json() as { upload_url: string; storage_key: string };

            const uploadRes = await fetch(upload_url, {
              method: 'PUT',
              body: decryptedBuffer
            });
            if (!uploadRes.ok) throw new Error('Không thể tải tệp lên.');

            attachments = [{
              id: crypto.randomUUID(),
              file_name: originalFileName || 'file',
              file_size: decryptedBuffer.byteLength,
              mime_type: originalMimeType || 'application/octet-stream',
              storage_key: storage_key,
              sha256,
              scan_status: 'PENDING'
            }];
          }
        }

        chatSocketRef.current.send(JSON.stringify({
          type: 'message',
          conversation_id: convId,
          content: finalContent,
          type_msg: message.type,
          attachments
        }));

        showToast('Đã chuyển tiếp tin nhắn thành công!', 'success');
      } catch (err: any) {
        console.error('[Forward] Error:', err);
        showToast('Chuyển tiếp thất bại: ' + err.message, 'error');
      }
    } else {
      // Thiết lập tin nhắn chờ và chuyển đổi chat
      useChatStore.getState().setPendingForwardMessage(forwardPayload);
      useChatStore.getState().setActiveFriendId(targetFriendId);
    }
  };

  return { handleSendMessage, sendTypingStatus, handleRecallMessage, handleForwardMessage };
}
