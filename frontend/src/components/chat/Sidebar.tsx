import React, { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { SidebarTabs } from './sidebar/SidebarTabs'
import { ChatList } from './sidebar/ChatList'
import { ContactList } from './sidebar/ContactList'
import { SearchTab } from './sidebar/SearchTab'
import { RequestList } from './sidebar/RequestList'
import { NotificationList } from './sidebar/NotificationList'
import { SecuritySettings } from './sidebar/SecuritySettings'
import { Avatar } from '../Avatar'

interface SidebarProps {
  currentUser: any
  token: string | null
  pendingRequests: any[]
  notifications: any[]
  activeTab: 'chats' | 'contacts' | 'search' | 'requests' | 'notifications' | 'security'
  setActiveTab: (tab: 'chats' | 'contacts' | 'search' | 'requests' | 'notifications' | 'security') => void
  onRespondRequest: (friendshipId: string, action: 'ACCEPT' | 'DECLINE') => void
  onMarkRead: (id: string) => void
  onLogout: () => void

  // Search props
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: any[]
  onSearchSubmit: (e: React.FormEvent) => void
  onSendFriendRequest: (targetUserId: string) => void
  isLoadingData: boolean
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  token,
  pendingRequests,
  notifications,
  activeTab,
  setActiveTab,
  onRespondRequest,
  onMarkRead,
  onLogout,
  searchQuery,
  setSearchQuery,
  searchResults,
  onSearchSubmit,
  onSendFriendRequest,
  isLoadingData,
  theme,
  setTheme
}) => {
  const { friends, activeFriendId, setActiveFriendId, messages, onlineFriends } = useChatStore()
  const [filterQuery, setFilterQuery] = useState('')

  const filteredFriends = friends.filter((f) =>
    f.displayName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    f.uid.toString().includes(filterQuery)
  )

  const chatFriends = friends.filter((f) => {
    const friendMsgs = messages[f.id]
    return friendMsgs && friendMsgs.length > 0
  })

  const filteredChatFriends = chatFriends.filter((f) =>
    f.displayName.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length

  return (
    <aside className="w-full h-full flex flex-col border-r border-[var(--bg-card-border)] bg-sidebar-custom">
      {/* Brand Header Logo */}
      <div className="p-3.5 border-b border-[var(--bg-card-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="logo-icon !w-7 !h-7 !rounded-lg bg-[var(--color-purple)] shadow-sm flex justify-center items-center text-white">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="logo-text !text-[16px] font-bold text-[var(--text-primary)]">VivyChat</span>
        </div>
      </div>

      {/* Filter Friends Input */}
      {(activeTab === 'chats' || activeTab === 'contacts') && (
        <div className="py-3 px-4">
          <input
            type="text"
            placeholder="Tìm nhanh..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-[var(--bg-input)] border border-[var(--bg-card-border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-[13px] outline-none text-left focus:border-[var(--color-purple)] focus:shadow-[0_0_0_3px_var(--color-purple-glow)] transition-all"
          />
        </div>
      )}

      {/* Navigation Tabs */}
      <SidebarTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setFilterQuery={setFilterQuery}
        pendingRequestsCount={pendingRequests.length}
        unreadNotifsCount={unreadNotifsCount}
      />

      {/* List content area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'chats' && (
          <ChatList
            filteredChatFriends={filteredChatFriends}
            messages={messages}
            activeFriendId={activeFriendId}
            setActiveFriendId={setActiveFriendId}
            onlineFriends={onlineFriends}
            filterQuery={filterQuery}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactList
            filteredFriends={filteredFriends}
            activeFriendId={activeFriendId}
            setActiveFriendId={setActiveFriendId}
            onlineFriends={onlineFriends}
            filterQuery={filterQuery}
          />
        )}

        {activeTab === 'search' && (
          <SearchTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSearchSubmit={onSearchSubmit}
            onSendFriendRequest={onSendFriendRequest}
            pendingRequests={pendingRequests}
            onRespondRequest={onRespondRequest}
            isLoadingData={isLoadingData}
          />
        )}

        {activeTab === 'requests' && (
          <RequestList
            pendingRequests={pendingRequests}
            onRespondRequest={onRespondRequest}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationList
            notifications={notifications}
            onMarkRead={onMarkRead}
          />
        )}

        {/* ── Tab Bảo mật ── */}
        {activeTab === 'security' && (
          <SecuritySettings token={token} />
        )}
      </div>

      {/* Discord-style User Profile Footer */}
      <div className="p-3 border-t border-[var(--bg-card-border)] flex items-center gap-2 bg-transparent">
        <Avatar uid={currentUser?.id || ''} status="online" sizeClass="w-9 h-9" />
        <div className="flex-1 min-w-0 text-left">
          <h4 className="text-[13px] font-bold text-[var(--text-primary)] m-0 truncate">{currentUser?.displayName}</h4>
          <p className="text-[10px] text-[var(--text-muted)] m-0 truncate">UID: {currentUser?.uid}</p>
        </div>

        {/* Theme Switcher Toggle */}
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
          className="p-1.5 rounded-lg border border-[var(--bg-card-border)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--color-purple)] hover:bg-[var(--hover-chat-item)] transition-all cursor-pointer flex items-center justify-center"
        >
          {theme === 'light' ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        <button
          onClick={onLogout}
          title="Đăng xuất"
          className="p-1.5 rounded-lg border border-[var(--bg-card-border)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-glow)] hover:border-[var(--color-error)]/20 transition-all cursor-pointer flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
