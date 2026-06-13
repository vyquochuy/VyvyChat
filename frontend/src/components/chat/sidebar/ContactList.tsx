import React from 'react'
import { Avatar } from '../../Avatar'

interface ContactListProps {
  filteredFriends: any[]
  activeFriendId: string | null
  setActiveFriendId: (friendId: string | null) => void
  onlineFriends: Record<string, { status: string; lastSeen?: number }>
  filterQuery: string;
}

export const ContactList: React.FC<ContactListProps> = ({
  filteredFriends,
  activeFriendId,
  setActiveFriendId,
  onlineFriends,
  filterQuery
}) => {
  if (filteredFriends.length === 0) {
    return (
      <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
        {filterQuery ? 'Không tìm thấy bạn bè.' : 'Chưa có bạn bè nào.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {filteredFriends.map((f) => {
        const isActive = activeFriendId === f.id
        const status = onlineFriends[f.id]?.status || 'offline'
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
              <span className="font-bold text-[13.5px] truncate block text-[var(--text-active-chat-name)]">
                {f.displayName}
              </span>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                UID: {f.uid}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
