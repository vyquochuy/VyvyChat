import React from 'react'

interface SearchTabProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: any[]
  onSearchSubmit: (e: React.FormEvent) => void
  onSendFriendRequest: (targetUserId: string) => void
  pendingRequests: any[]
  onRespondRequest: (friendshipId: string, action: 'ACCEPT' | 'DECLINE') => void
  isLoadingData: boolean;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  onSearchSubmit,
  onSendFriendRequest,
  pendingRequests,
  onRespondRequest,
  isLoadingData
}) => {
  return (
    <div>
      <form onSubmit={onSearchSubmit} className="flex gap-1.5 mb-3">
        <input
          type="text"
          placeholder="Tìm UID, Email, Tên..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-[var(--bg-input)] 
          border border-[var(--bg-card-border)] 
          rounded-xl px-3 py-2 
          text-[var(--text-primary)] text-[13px] 
          outline-none text-left 
          focus:border-[var(--color-purple)] 
          focus:shadow-[0_0_0_3px_var(--color-purple-glow)] 
          transition-all"
        />
        <button
          type="submit"
          disabled={isLoadingData}
          className="bg-[var(--color-purple)] border-none text-white px-3.5 py-2 
          rounded-xl text-xs font-bold cursor-pointer 
          disabled:opacity-50 transition-all hover:bg-[var(--color-cyan)] duration-150 active:scale-95"
        >
          {isLoadingData ? '...' : 'Tìm'}
        </button>
      </form>

      <div className="flex flex-col gap-1.5">
        {searchResults.length === 0 ? (
          <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
            {searchQuery ? 'Không tìm thấy kết quả.' : 'Nhập thông tin tìm kiếm.'}
          </div>
        ) : (
          searchResults.map((r) => (
            <div
              key={r.id}
              className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] px-3 py-2.5 rounded-xl flex justify-between items-center shadow-sm"
            >
              <div className="text-left">
                <div className="font-bold text-[13px] text-[var(--text-primary)]">{r.displayName}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">UID: {r.uid}</div>
              </div>
              <div>
                {r.relationStatus === 'NONE' && (
                  <button
                    onClick={() => onSendFriendRequest(r.id)}
                    className="bg-[var(--color-purple)] border-none text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all hover:bg-[var(--color-cyan)] hover:translate-y-[-1px] duration-150"
                  >
                    Kết bạn
                  </button>
                )}
                {r.relationStatus === 'PENDING_SENT' && (
                  <button
                    disabled
                    className="bg-[var(--bg-input)] border border-[var(--bg-card-border)] text-[var(--text-muted)] px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-not-allowed"
                  >
                    Đã gửi
                  </button>
                )}
                {r.relationStatus === 'PENDING_RECEIVED' && (
                  <button
                    onClick={() => {
                      const req = pendingRequests.find((pr: any) => pr.id === r.id)
                      if (req) {
                        onRespondRequest(req.friendshipId, 'ACCEPT')
                      }
                    }}
                    className="bg-[var(--color-success)] border-none text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all hover:opacity-90 hover:translate-y-[-1px] duration-150"
                  >
                    Chấp nhận
                  </button>
                )}
                {r.relationStatus === 'ACCEPTED' && (
                  <span className="bg-[var(--color-success-glow)] border border-[var(--color-success)]/20 text-[var(--color-success)] text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    Bạn bè
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
