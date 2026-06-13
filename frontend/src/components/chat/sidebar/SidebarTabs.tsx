import React from 'react'

interface SidebarTabsProps {
  activeTab: 'chats' | 'contacts' | 'search' | 'requests' | 'notifications' | 'security'
  setActiveTab: (tab: 'chats' | 'contacts' | 'search' | 'requests' | 'notifications' | 'security') => void
  setFilterQuery: (query: string) => void
  pendingRequestsCount: number
  unreadNotifsCount: number;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  activeTab,
  setActiveTab,
  setFilterQuery,
  pendingRequestsCount,
  unreadNotifsCount
}) => {
  const tabs = [
    { id: 'chats', label: 'Bạn bè' },
    { id: 'requests', label: 'Lời mời', count: pendingRequestsCount },
    { id: 'notifications', label: 'Thông báo', count: unreadNotifsCount }
  ]

  return (
    <div className="flex w-full border-b border-[var(--bg-card-border)] bg-transparent py-0.5 px-1 flex-shrink-0 select-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any)
              setFilterQuery('')
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 px-0.5 border-none bg-transparent ${
              isActive 
                ? 'text-[var(--color-purple)] font-bold border-b-2 border-[var(--color-purple)]' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            } text-[12.5px] font-medium cursor-pointer transition-all duration-150`}
          >
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="bg-[var(--color-purple)] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[15px] h-3.5 flex items-center justify-center flex-shrink-0">
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
