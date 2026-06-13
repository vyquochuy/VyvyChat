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
    { id: 'chats', label: 'Chat' },
    { id: 'contacts', label: 'Bạn bè' },
    { id: 'search', label: 'Tìm' },
    { id: 'requests', label: 'Lời mời', count: pendingRequestsCount },
    { id: 'notifications', label: 'Báo', count: unreadNotifsCount },
    { id: 'security', label: '🔒' }
  ]

  return (
    <div className="flex border-b border-[var(--bg-card-border)] bg-transparent py-0.5 px-1 overflow-x-auto whitespace-nowrap">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any)
              setFilterQuery('')
            }}
            className={`flex-1 py-2.5 px-1.5 border-none bg-transparent ${isActive ? 'text-[var(--color-cyan)] border-b-2 border-b-[var(--color-cyan)]' : 'text-[var(--text-secondary)] border-b-2 border-b-transparent'} text-xs font-semibold cursor-pointer relative`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`absolute top-[1px] right-[1px] ${tab.id === 'notifications' ? 'bg-[var(--color-cyan)]' : 'bg-[var(--color-error)]'} text-[var(--color-counter-text)] text-[8px] font-bold rounded-full w-[13px] h-[13px] flex items-center justify-center`}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
