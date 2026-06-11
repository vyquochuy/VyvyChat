import React from 'react'
import { Message } from '../../../store/chatStore'

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
        const isOnline = onlineFriends[f.id]?.status === 'online'

        return (
          <div
            key={f.id}
            onClick={() => setActiveFriendId(f.id)}
            className={`${isActive ? 'bg-[rgba(138,43,226,0.15)] border-[rgba(138,43,226,0.3)]' : 'bg-white/[0.02] border-white/[0.05]'} border px-3 py-2.5 rounded-xl cursor-pointer text-left transition-all duration-200 hover:bg-white/[0.05]`}
          >
            <div className="flex justify-between items-center">
              <span className={`font-bold text-[13.5px] ${isActive ? 'text-[var(--color-cyan)]' : 'text-white'} flex items-center gap-1.5`}>
                {f.displayName}
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]' : 'bg-white/20'}`} />
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {lastMsg ? `${lastMsg.senderId === 'current-user' ? 'Bạn: ' : ''}${lastMsg.content}` : 'Bắt đầu cuộc trò chuyện...'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
