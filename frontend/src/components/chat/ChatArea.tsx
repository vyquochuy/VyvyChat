import React from 'react'
import { useChatStore } from '../../store/chatStore'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

interface ChatAreaProps {
  onSendMessage?: (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => void
  token: string | null
  backendUrl: string
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onSendMessage, token, backendUrl }) => {
  const { activeFriendId, friends, messages, addMessage, setActiveFriendId, onlineFriends, typingFriends } = useChatStore()

  // Find selected friend details
  const activeFriend = friends.find((f) => f.id === activeFriendId)

  if (!activeFriendId || !activeFriend) {
    // Welcome Screen
    return (
      <div className="flex-1 h-full flex flex-col justify-center items-center p-6 text-[var(--text-secondary)]">
        <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.06] rounded-[24px] flex justify-center items-center text-[var(--color-purple)] mb-5 shadow-[0_8px_32px_rgba(138,43,226,0.15)]">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3 className="text-[18px] font-bold text-white mb-2">
          Chào mừng đến với VivyChat!
        </h3>
        <p className="text-[13.5px] text-[var(--text-muted)] max-w-[280px] leading-[1.5] m-0">
          Chọn một người bạn trong danh bạ để bắt đầu nhắn tin trò chuyện thử nghiệm.
        </p>
      </div>
    )
  }

  // Get active messages or fallback to empty array
  const friendMsgs = messages[activeFriendId] || []

  const handleSend = (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => {
    if (onSendMessage) {
      onSendMessage(content, typeMsg, attachments)
    } else {
      addMessage(activeFriendId, content, 'current-user')
    }
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-black/[0.05]">
      {/* Header bar */}
      <div className="py-3.5 px-4 border-b border-[var(--bg-card-border)] flex items-center gap-3">
        {/* Mobile Back Button */}
        <button aria-label="Mobile Back Button"
          onClick={() => setActiveFriendId(null)}
          className="md:hidden bg-none border-none text-[var(--text-secondary)] cursor-pointer p-1 flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Friend Details */}
        <div className="text-left">
          <h3 className="text-[15px] font-bold text-white m-0">
            {activeFriend.displayName}
          </h3>
          {/* Typing Indicator – hiuển thị khi bạn bè đang gõ phím */}
          {typingFriends[activeFriendId] ? (
            <span className="text-[11px] text-[var(--color-cyan)] flex items-center gap-1.5 mt-0.5">
              <span className="flex gap-[3px] items-center">
                <span className="w-1 h-1 bg-[var(--color-cyan)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-[var(--color-cyan)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-[var(--color-cyan)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              Đang nhập...
            </span>
          ) : onlineFriends[activeFriendId]?.status === 'online' ? (
            <span className="text-[11px] text-[var(--color-success)] flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-[var(--color-success)] rounded-full" />
              Trực tuyến
            </span>
          ) : (
            <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
              Ngoại tuyến {onlineFriends[activeFriendId]?.lastSeen ? `(Hoạt động cuối: ${new Date(onlineFriends[activeFriendId].lastSeen!).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Message List area */}
      <MessageList messages={friendMsgs} token={token} />

      {/* Input area */}
      <MessageInput onSendMessage={handleSend} token={token} backendUrl={backendUrl} />
    </div>
  )
}
