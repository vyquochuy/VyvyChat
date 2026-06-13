import React from 'react'
import { useChatStore } from '../../store/chatStore'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { Avatar } from '../Avatar'

interface ChatAreaProps {
  onSendMessage?: (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => void
  token: string | null
  onToggleInfoPanel?: () => void
  showInfoPanel?: boolean
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onSendMessage, token, onToggleInfoPanel, showInfoPanel }) => {
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
      <div className="py-2.5 px-4 chat-header-glass flex items-center justify-between border-b border-[var(--bg-card-border)]">
        <div 
          onClick={onToggleInfoPanel}
          className="flex items-center gap-3 cursor-pointer select-none hover:opacity-90 transition-opacity"
        >
          {/* Mobile Back Button */}
          <button aria-label="Mobile Back Button"
            onClick={(e) => {
              e.stopPropagation()
              setActiveFriendId(null)
            }}
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
                ● Đang hoạt động
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                Ngoại tuyến {onlineFriends[activeFriendId]?.lastSeen ? `(Hoạt động cuối: ${new Date(onlineFriends[activeFriendId].lastSeen!).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})` : ''}
              </span>
            )}
            {/* Encryption status */}
            <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5 font-medium select-none">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline mr-0.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Mã hóa đầu cuối</span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button title="Tìm kiếm tin nhắn" className="bg-none border-none text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer p-1.5 transition-all rounded-full hover:bg-[var(--hover-chat-item)]">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button title="Cuộc gọi thoại" className="bg-none border-none text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer p-1.5 transition-all rounded-full hover:bg-[var(--hover-chat-item)]">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button title="Cuộc gọi video" className="bg-none border-none text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer p-1.5 transition-all rounded-full hover:bg-[var(--hover-chat-item)]">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
          <div className="w-[1px] h-4 bg-[var(--bg-card-border)] mx-1" />
          <button 
            onClick={onToggleInfoPanel} 
            title="Thông tin cuộc trò chuyện" 
            className={`bg-none border-none ${showInfoPanel ? 'text-[var(--color-purple)] bg-[var(--color-purple-glow)]' : 'text-[var(--text-muted)]'} hover:text-[var(--text-primary)] cursor-pointer p-1.5 transition-all rounded-full hover:bg-[var(--hover-chat-item)]`}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="19" r="1.2" />
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
