import React from 'react'
import { Message } from '../../../store/chatStore'
import { Avatar } from '../../Avatar'
import { isE2EEPayload } from '../../../hooks/useE2EE'

interface ChatListProps {
  filteredChatFriends: any[]
  messages: Record<string, Message[]>
  activeFriendId: string | null
  setActiveFriendId: (friendId: string | null) => void
  onlineFriends: Record<string, { status: string; lastSeen?: number }>
  filterQuery: string;
}

export const ChatList: React.FC<ChatListProps> = ({
  filteredChatFriends,
  messages,
  activeFriendId,
  setActiveFriendId,
  onlineFriends,
  filterQuery
}) => {
  if (filteredChatFriends.length === 0) {
    return (
      <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
        {filterQuery ? 'Không tìm thấy cuộc trò chuyện.' : 'Chưa có cuộc trò chuyện nào. Hãy mở một cuộc trò chuyện trong tab Bạn bè.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {filteredChatFriends.map((f) => {
        const msgs = messages[f.id] || []
        const lastMsg = msgs[msgs.length - 1]
        const isActive = activeFriendId === f.id
        const status = onlineFriends[f.id]?.status || 'offline'

        // Trích xuất text preview và lọc mã hóa E2EE nếu chưa giải mã
        let previewText = 'Bắt đầu cuộc trò chuyện...'
        if (lastMsg) {
          if (lastMsg.type === 'TEXT') {
            previewText = isE2EEPayload(lastMsg.content) ? '🔒 Tin nhắn mã hóa' : lastMsg.content
          } else {
            previewText = `Đã gửi ${lastMsg.type === 'IMAGE' ? 'một ảnh' : 'một tệp tin'}`
          }
        }

        return (
          <div
            key={f.id}
            onClick={() => setActiveFriendId(f.id)}
            className={`flex items-center gap-3 border p-3 rounded-xl cursor-pointer text-left transition-all duration-150 ease-out active:scale-[0.99] hover:bg-[var(--hover-chat-item)] ${
              isActive 
                ? 'bg-[var(--bg-active-chat)] border-[var(--border-active-chat)] shadow-[var(--shadow-active-chat)]' 
                : 'bg-[var(--bg-inactive-chat)] border-[var(--border-inactive-chat)]'
            }`}
          >
            {/* Circular Pixel Avatar with Presence Overlay */}
            <Avatar uid={f.id} status={status} sizeClass="w-9 h-9" />

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-[13.5px] truncate text-[var(--text-active-chat-name)]">
                  {f.displayName}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 ml-1">
                  {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                {lastMsg && lastMsg.senderId === 'current-user' ? 'Bạn: ' : ''}{previewText}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
