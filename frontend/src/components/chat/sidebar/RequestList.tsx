import React from 'react'

interface RequestListProps {
  pendingRequests: any[]
  onRespondRequest: (friendshipId: string, action: 'ACCEPT' | 'DECLINE') => void;
}

export const RequestList: React.FC<RequestListProps> = ({
  pendingRequests,
  onRespondRequest
}) => {
  if (pendingRequests.length === 0) {
    return (
      <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
        Không có yêu cầu kết bạn nào.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {pendingRequests.map((req) => (
        <div
          key={req.friendshipId}
          className="bg-white/[0.03] border border-[var(--bg-card-border)] px-3 py-2.5 rounded-xl flex flex-col gap-2 text-left"
        >
          <div>
            <div className="font-bold text-[13px]">{req.displayName}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">UID: {req.uid}</div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onRespondRequest(req.friendshipId, 'ACCEPT')}
              className="flex-1 bg-gradient-to-r from-[var(--color-success)] to-[#059669] border-none text-white px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all hover:opacity-90"
            >
              Chấp nhận
            </button>
            <button
              onClick={() => onRespondRequest(req.friendshipId, 'DECLINE')}
              className="flex-1 bg-white/5 border border-white/10 text-[var(--text-secondary)] px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all hover:bg-white/10"
            >
              Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
