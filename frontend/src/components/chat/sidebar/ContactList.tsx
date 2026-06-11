import React from 'react'

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
        const isOnline = onlineFriends[f.id]?.status === 'online'
        return (
          <div
            key={f.id}
            onClick={() => setActiveFriendId(f.id)}
            className={`${isActive ? 'bg-[rgba(138,43,226,0.15)] border-[rgba(138,43,226,0.3)]' : 'bg-white/[0.02] border-white/[0.05]'} border px-3 py-2.5 rounded-xl cursor-pointer text-left transition-all duration-200 hover:bg-white/[0.05]`}
          >
            <div className={`font-bold text-[13.5px] ${isActive ? 'text-[var(--color-cyan)]' : 'text-white'} flex items-center gap-1.5`}>
              {f.displayName}
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]' : 'bg-white/20'}`} />
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              UID: {f.uid}
            </div>
          </div>
        )
      })}
    </div>
  )
}
