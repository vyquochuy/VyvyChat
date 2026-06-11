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
          border border-white/5 
          rounded-lg px-3 py-2 
          text-white text-[13px] 
          outline-none text-left 
          focus:border-[var(--color-cyan)] 
          focus:shadow-[0_0_0_2px_var(--color-cyan-glow)] 
          transition-all"
        />
        <button
          type="submit"
          disabled={isLoadingData}
          className="bg-gradient-to-r from-[var(--color-purple)] to-[#6366f1] border-none text-white px-3 py-2 
          rounded-lg text-xs font-bold cursor-pointer 
          disabled:opacity-50 transition-all hover:opacity-90"
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
              className="bg-white/[0.02] border border-white/[0.05] px-3 py-2.5 rounded-xl flex justify-between items-center"
            >
              <div className="text-left">
                <div className="font-bold text-[13px]">{r.displayName}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">UID: {r.uid}</div>
              </div>
              <div>
                {r.relationStatus === 'NONE' && (
                  <button
                    onClick={() => onSendFriendRequest(r.id)}
                    className="bg-gradient-to-r from-[var(--color-purple)] to-[#6366f1] border-none text-white px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all hover:opacity-90"
                  >
                    Kết bạn
                  </button>
                )}
                {r.relationStatus === 'PENDING_SENT' && (
                  <button
                    disabled
                    className="bg-white/5 border border-white/10 text-[var(--text-muted)] px-2 py-1 rounded-md text-[11px] font-bold cursor-not-allowed"
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
                    className="bg-gradient-to-r from-[var(--color-success)] to-[#059669] border-none text-white px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all hover:opacity-90"
                  >
                    Chấp nhận
                  </button>
                )}
                {r.relationStatus === 'ACCEPTED' && (
                  <span className="bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[var(--color-success)] text-[10px] font-bold px-1.5 py-0.5 rounded">
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
