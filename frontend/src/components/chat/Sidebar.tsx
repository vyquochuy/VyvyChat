import React, { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { SidebarTabs } from './sidebar/SidebarTabs'
import { ChatList } from './sidebar/ChatList'
import { ContactList } from './sidebar/ContactList'
import { SearchTab } from './sidebar/SearchTab'
import { RequestList } from './sidebar/RequestList'
import { NotificationList } from './sidebar/NotificationList'
import { SecuritySettings } from './sidebar/SecuritySettings'

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
  isLoadingData: boolean;
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
  isLoadingData
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
    <aside className="w-full h-full flex flex-col border-r border-[var(--bg-card-border)]">
      {/* User Info Header */}
      <div className="p-4 border-b border-[var(--bg-card-border)] flex justify-between items-center">
        <div className="text-left">
          <h3 className="text-[15px] font-bold text-white m-0">
            {currentUser?.displayName}
          </h3>
          <span className="countdown-timer text-[11px] px-[5px] py-[1px] !border-none inline-block mt-0.5">
            UID: {currentUser?.uid}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="bg-[rgba(255,51,102,0.08)] border border-[rgba(255,51,102,0.2)] text-[var(--color-error)] px-2.5 py-1 rounded-md text-xs cursor-pointer hover:bg-[rgba(255,51,102,0.15)] transition-all"
        > Đăng xuất
        </button>
      </div>

      {/* Filter Friends Input */}
      {(activeTab === 'chats' || activeTab === 'contacts') && (
        <div className="py-3 px-4">
          <input
            type="text"
            placeholder="Tìm nhanh..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-[var(--bg-input)] border border-white/5 rounded-lg px-3 py-2 text-white text-[13px] outline-none text-left focus:border-[var(--color-cyan)] focus:shadow-[0_0_0_2px_var(--color-cyan-glow)] transition-all"
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
    </aside>
  )
}
