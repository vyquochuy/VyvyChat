import React from 'react'

interface NotificationListProps {
  notifications: any[]
  onMarkRead: (id: string) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onMarkRead
}) => {
  if (notifications.length === 0) {
    return (
      <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
        Không có thông báo.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 max-h-[350px]">
      {notifications.map((n) => (
        <div
          key={n.id}
          onClick={() => !n.is_read && onMarkRead(n.id)}
          className={`${n.is_read ? 'bg-[var(--bg-card)] border-[var(--bg-card-border)] cursor-default' : 'bg-[var(--color-purple-glow)] border-[var(--color-purple)]/[0.2] cursor-pointer'} border px-3 py-2.5 rounded-xl flex justify-between items-start text-left shadow-sm`}
        >
          <div className="flex-1">
            <h5 className={`text-[12.5px] font-bold ${n.is_read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'} m-0`}>
              {n.title}
            </h5>
            <p className="text-[11.5px] text-[var(--text-secondary)] mt-[3px] m-0 leading-[1.4]">
              {n.body}
            </p>
          </div>
          {!n.is_read && (
            <span className="w-1.5 h-1.5 bg-[var(--color-purple)] rounded-full mt-1.5 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}
