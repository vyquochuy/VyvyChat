import React from 'react'
import { useChatStore } from '../../store/chatStore'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { Avatar } from '../Avatar'

interface ChatAreaProps {
  onSendMessage?: (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => void
  token: string | null
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onSendMessage, token }) => {
  const { activeFriendId, friends, messages, addMessage, setActiveFriendId, onlineFriends, typingFriends } = useChatStore()

  // Find selected friend details
  const activeFriend = friends.find((f) => f.id === activeFriendId)

  if (!activeFriendId || !activeFriend) {
    // Redesigned Telegram-style Empty State
    return (
      <div className="flex-1 h-full flex flex-col justify-center items-center p-6 text-[var(--text-secondary)] bg-chat-custom">
        <div className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] p-8 rounded-2xl shadow-sm text-center max-w-[280px] flex flex-col items-center">
          <div className="text-4xl mb-4 animate-bounce select-none">💬</div>
          <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-2">
            Chọn cuộc trò chuyện
          </h3>
          <p className="text-[12px] text-[var(--text-muted)] leading-[1.6] text-center m-0">
            Bắt đầu nhắn tin với bạn bè hoặc tạo cuộc trò chuyện mới.
          </p>
        </div>
      </div>
    )
  }

  // Get active messages or fallback to empty array
  const friendMsgs = messages[activeFriendId]

  const handleSend = (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => {
    if (onSendMessage) {
      onSendMessage(content, typeMsg, attachments)
    } else {
      addMessage(activeFriendId, content, 'current-user')
    }
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-chat-custom">
      {/* Header bar */}
      <div className="py-2.5 px-4 chat-header-glass flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          <button aria-label="Mobile Back Button"
            onClick={() => setActiveFriendId(null)}
            className="md:hidden bg-none border-none text-[var(--text-secondary)] cursor-pointer p-1 flex items-center justify-center animate-pulse"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Circular Pixel Avatar with Presence Indicator */}
          <Avatar uid={activeFriend.id} status={onlineFriends[activeFriendId]?.status || 'offline'} sizeClass="w-9 h-9" />

          {/* Friend Details */}
          <div className="text-left">
            <h3 className="text-[14px] font-bold text-[var(--text-primary)] m-0 leading-tight">
              {activeFriend.displayName}
            </h3>
            {/* Typing Indicator */}
            {typingFriends[activeFriendId] ? (
              <span className="text-[11px] text-[var(--color-purple)] flex items-center gap-1.5 mt-0.5 font-medium">
                <span className="flex gap-[3px] items-center">
                  <span className="w-1.5 h-1.5 bg-[var(--color-purple)] rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-[var(--color-purple)] rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-[var(--color-purple)] rounded-full typing-dot" />
                </span>
                Đang nhập...
              </span>
            ) : onlineFriends[activeFriendId]?.status === 'online' ? (
              <span className="text-[11px] text-[var(--color-success)] flex items-center gap-1 mt-0.5 font-medium">
                Đang hoạt động
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                Ngoại tuyến {onlineFriends[activeFriendId]?.lastSeen ? `(Hoạt động cuối: ${new Date(onlineFriends[activeFriendId].lastSeen!).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Action icons (Disabled for complete UI look) */}
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <button title="Cuộc gọi thoại (Chưa khả dụng)" disabled className="bg-none border-none text-[var(--text-muted)] opacity-30 cursor-not-allowed p-1.5 hover:text-[var(--text-primary)] transition-all">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button title="Cuộc gọi video (Chưa khả dụng)" disabled className="bg-none border-none text-[var(--text-muted)] opacity-30 cursor-not-allowed p-1.5 hover:text-[var(--text-primary)] transition-all">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message List area */}
      <MessageList messages={friendMsgs} token={token} />

      {/* Input area */}
      <MessageInput onSendMessage={handleSend} token={token} />
    </div>
  )
}
