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
          className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] px-3 py-2.5 rounded-xl flex flex-col gap-2 text-left shadow-sm"
        >
          <div>
            <div className="font-bold text-[13px] text-[var(--text-primary)]">{req.displayName}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">UID: {req.uid}</div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onRespondRequest(req.friendshipId, 'ACCEPT')}
              className="flex-1 bg-[var(--color-success)] border-none text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all hover:opacity-90 hover:translate-y-[-1px] duration-150"
            >
              Chấp nhận
            </button>
            <button
              onClick={() => onRespondRequest(req.friendshipId, 'DECLINE')}
              className="flex-1 bg-[var(--bg-input)] border border-[var(--bg-card-border)] text-[var(--text-secondary)] px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all hover:bg-[var(--hover-chat-item)] hover:translate-y-[-1px] duration-150"
            >
              Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
