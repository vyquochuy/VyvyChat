import React, { useState, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useSecretChatContext } from '../../providers/SecretChatProvider'

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
}

// ──────────────────────────────────────────────────────────────────────────────
// Security Tab Component
// ──────────────────────────────────────────────────────────────────────────────

const SecurityTab: React.FC<{ token: string | null }> = ({ token }) => {
  const { e2eeState, checkE2EEStatus, setupEncryption, recoverKeys, resetEncryption } = useSecretChatContext()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    if (token && e2eeState.status === 'loading') {
      checkE2EEStatus(token)
    }
  }, [token, e2eeState.status])

  const handleSetup = async () => {
    if (!token) return
    if (password.length < 8) {
      setFeedback({ msg: 'Recovery Password phải có ít nhất 8 ký tự.', type: 'error' })
      return
    }
    if (password !== confirmPassword) {
      setFeedback({ msg: 'Mật khẩu xác nhận không khớp.', type: 'error' })
      return
    }
    setIsLoading(true)
    setFeedback(null)
    const ok = await setupEncryption(token, password)
    setIsLoading(false)
    if (ok) {
      setFeedback({ msg: 'Mã hóa đầu cuối đã được kích hoạt thành công!', type: 'success' })
      setPassword('')
      setConfirmPassword('')
    } else {
      setFeedback({ msg: 'Thiết lập thất bại. Vui lòng thử lại.', type: 'error' })
    }
  }

  const handleRecover = async () => {
    if (!token) return
    if (!password.trim()) {
      setFeedback({ msg: 'Vui lòng nhập Recovery Password.', type: 'error' })
      return
    }
    setIsLoading(true)
    setFeedback(null)
    const ok = await recoverKeys(token, password)
    setIsLoading(false)
    if (ok) {
      setFeedback({ msg: 'Khôi phục khóa thành công! Tin nhắn cũ đã có thể giải mã.', type: 'success' })
      setPassword('')
    } else {
      setFeedback({ msg: 'Recovery Password không đúng hoặc có lỗi xảy ra.', type: 'error' })
    }
  }

  const handleReset = async () => {
    if (!token) return
    if (password.length < 8) {
      setFeedback({ msg: 'Recovery Password mới phải có ít nhất 8 ký tự.', type: 'error' })
      return
    }
    setIsLoading(true)
    setFeedback(null)
    const ok = await resetEncryption(token, password)
    setIsLoading(false)
    setShowResetConfirm(false)
    if (ok) {
      setFeedback({ msg: 'Đã xoay vòng khóa thành công. Bạn có thể gửi và nhận tin nhắn mã hóa mới.', type: 'success' })
      setPassword('')
    } else {
      setFeedback({ msg: 'Xoay vòng khóa thất bại. Vui lòng thử lại.', type: 'error' })
    }
  }

  const inputCls = "w-full bg-[var(--bg-input)] border border-white/5 rounded-lg px-3 py-2 text-white text-[13px] outline-none text-left focus:border-[var(--color-cyan)] focus:shadow-[0_0_0_2px_var(--color-cyan-glow)] transition-all"
  const btnPrimary = "w-full bg-gradient-to-r from-[var(--color-purple)] to-[#6366f1] border-none text-white px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-50 transition-all hover:opacity-90"
  const btnSecondary = "w-full bg-white/5 border border-white/10 text-[var(--text-secondary)] px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer transition-all hover:bg-white/10"
  const btnDanger = "w-full bg-[rgba(255,51,102,0.08)] border border-[rgba(255,51,102,0.2)] text-[var(--color-error)] px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer transition-all hover:bg-[rgba(255,51,102,0.15)]"

  if (e2eeState.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-[var(--text-muted)] text-[13px]">
        <svg className="animate-spin h-5 w-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Đang kiểm tra trạng thái mã hóa...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={e2eeState.status === 'active' ? 'var(--color-success)' : 'var(--text-muted)'} strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h4 className="text-[14px] font-bold text-white m-0">End-to-End Encryption</h4>
        </div>

        {e2eeState.status === 'active' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--color-success)] rounded-full shadow-[0_0_6px_var(--color-success)]" />
              <span className="text-[12px] text-[var(--color-success)] font-semibold">Active</span>
            </div>
            <div className="text-[11.5px] text-[var(--text-muted)] mt-1 space-y-0.5">
              <div>Key Version: <span className="text-white font-mono">{e2eeState.keyVersion}</span></div>
              <div>Backup: <span className="text-[var(--color-success)]">Available</span></div>
            </div>
          </div>
        )}

        {e2eeState.status === 'not_configured' && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white/20 rounded-full" />
            <span className="text-[12px] text-[var(--text-muted)]">Not configured</span>
          </div>
        )}

        {e2eeState.status === 'new_device' && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
            <span className="text-[12px] text-yellow-400 font-semibold">Encryption detected</span>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-[12px] px-3 py-2 rounded-lg ${feedback.type === 'success' ? 'bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[var(--color-success)]' : 'bg-[rgba(255,51,102,0.08)] border border-[rgba(255,51,102,0.2)] text-[var(--color-error)]'}`}>
          {feedback.msg}
        </div>
      )}

      {/* ── Trạng thái: Chưa thiết lập ── */}
      {e2eeState.status === 'not_configured' && (
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-[var(--text-muted)] leading-[1.5] m-0">
            Thiết lập mã hóa đầu cuối để bảo vệ toàn bộ tin nhắn của bạn. Chỉ bạn và người nhận mới có thể đọc nội dung.
          </p>
          <input className={inputCls} type="password" placeholder="Recovery Password (≥8 ký tự)" value={password} onChange={e => setPassword(e.target.value)} />
          <input className={inputCls} type="password" placeholder="Xác nhận Recovery Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          <button className={btnPrimary} onClick={handleSetup} disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : 'Setup Encryption'}
          </button>
        </div>
      )}

      {/* ── Trạng thái: Thiết bị mới ── */}
      {e2eeState.status === 'new_device' && !showResetConfirm && (
        <div className="flex flex-col gap-3">
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5 text-[12px] text-yellow-200 leading-[1.5]">
            ⚠️ Thiết bị này không có Private Key của bạn. Nhập Recovery Password để khôi phục khóa và giải mã tin nhắn cũ.
          </div>
          <input className={inputCls} type="password" placeholder="Recovery Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className={btnPrimary} onClick={handleRecover} disabled={isLoading}>
            {isLoading ? 'Đang khôi phục...' : 'Recover With Recovery Password'}
          </button>
          <button className={btnDanger} onClick={() => setShowResetConfirm(true)}>
            Reset Encryption
          </button>
        </div>
      )}

      {/* ── Trạng thái: Đang hoạt động ── */}
      {e2eeState.status === 'active' && !showResetConfirm && (
        <div className="flex flex-col gap-2.5">
          <button className={btnSecondary} onClick={() => { setShowResetConfirm(false); setPassword(''); setFeedback(null) }}>
            Recover Keys
          </button>
          <button className={btnDanger} onClick={() => setShowResetConfirm(true)}>
            Reset Encryption
          </button>
        </div>
      )}

      {/* ── Xác nhận Reset / Xoay vòng khóa ── */}
      {showResetConfirm && (
        <div className="flex flex-col gap-3">
          <div className="bg-[rgba(255,51,102,0.05)] border border-[rgba(255,51,102,0.2)] rounded-lg px-3 py-2.5 text-[12px] text-[var(--color-error)] leading-[1.5]">
            ⚠️ Cảnh báo: Sau khi xoay vòng khóa, bạn sẽ không thể giải mã các tin nhắn cũ được mã hóa bằng khóa cũ (trừ khi thiết bị này vẫn giữ khóa đó).
          </div>
          <input className={inputCls} type="password" placeholder="New Recovery Password (≥8 ký tự)" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className={`flex-1 ${btnDanger}`} onClick={handleReset} disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Xác nhận Reset'}
            </button>
            <button className="flex-1 bg-white/5 border border-white/10 text-[var(--text-secondary)] px-3 py-2 rounded-lg text-[13px] font-bold cursor-pointer" onClick={() => { setShowResetConfirm(false); setPassword('') }}>
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Sidebar
// ──────────────────────────────────────────────────────────────────────────────

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

  const tabs = [
    { id: 'chats', label: 'Chat' },
    { id: 'contacts', label: 'Bạn bè' },
    { id: 'search', label: 'Tìm' },
    { id: 'requests', label: 'Lời mời', count: pendingRequests.length },
    { id: 'notifications', label: 'Báo', count: unreadNotifsCount },
    { id: 'security', label: '🔒' }
  ]

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
      <div className="flex border-b border-[var(--bg-card-border)] bg-black/10 py-0.5 px-1 overflow-x-auto whitespace-nowrap">
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
                <span className={`absolute top-[1px] right-[1px] ${tab.id === 'notifications' ? 'bg-[var(--color-cyan)]' : 'bg-[var(--color-error)]'} text-[#070813] text-[8px] font-bold rounded-full w-[13px] h-[13px] flex items-center justify-center`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* List content area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'chats' && (
          <div>
            {filteredChatFriends.length === 0 ? (
              <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
                {filterQuery ? 'Không tìm thấy cuộc trò chuyện.' : 'Chưa có cuộc trò chuyện nào. Hãy mở một cuộc trò chuyện trong tab Bạn bè.'}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filteredChatFriends.map((f) => {
                  const msgs = messages[f.id] || []
                  const lastMsg = msgs[msgs.length - 1]
                  const isActive = activeFriendId === f.id
                  const isOnline = onlineFriends[f.id]?.status === 'online'

                  return (
                    <div
                      key={f.id}
                      onClick={() => setActiveFriendId(f.id)}
                      className={`${isActive ? 'bg-[rgba(138,43,226,0.15)] border-[rgba(138,43,226,0.3)]' : 'bg-white/[0.02] border-white/[0.05]'} border px-3 py-2.5 rounded-xl cursor-pointer text-left transition-all duration-200 hover:bg-white/[0.05]`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-bold text-[13.5px] ${isActive ? 'text-[var(--color-cyan)]' : 'text-white'} flex items-center gap-1.5`}>
                          {f.displayName}
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]' : 'bg-white/20'}`} />
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {lastMsg ? `${lastMsg.senderId === 'current-user' ? 'Bạn: ' : ''}${lastMsg.content}` : 'Bắt đầu cuộc trò chuyện...'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div>
            {filteredFriends.length === 0 ? (
              <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
                {filterQuery ? 'Không tìm thấy bạn bè.' : 'Chưa có bạn bè nào.'}
              </div>
            ) : (
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
            )}
          </div>
        )}

        {activeTab === 'search' && (
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
        )}

        {activeTab === 'requests' && (
          <div>
            {pendingRequests.length === 0 ? (
              <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
                Không có yêu cầu kết bạn nào.
              </div>
            ) : (
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
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            {notifications.length === 0 ? (
              <div className="text-center p-6 text-[var(--text-muted)] text-[13px]">
                Không có thông báo.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[350px]">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && onMarkRead(n.id)}
                    className={`${n.is_read ? 'bg-white/[0.02] border-white/[0.05] cursor-default' : 'bg-[rgba(138,43,226,0.05)] border-[rgba(138,43,226,0.2)] cursor-pointer'} border px-3 py-2.5 rounded-xl flex justify-between items-start text-left`}
                  >
                    <div className="flex-1">
                      <h5 className={`text-[12.5px] font-bold ${n.is_read ? 'text-[var(--text-secondary)]' : 'text-white'} m-0`}>
                        {n.title}
                      </h5>
                      <p className="text-[11.5px] text-[var(--text-secondary)] mt-[3px] m-0 leading-[1.4]">
                        {n.body}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 bg-[var(--color-cyan)] rounded-full mt-1 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Bảo mật ── */}
        {activeTab === 'security' && (
          <SecurityTab token={token} />
        )}
      </div>
    </aside>
  )
}
