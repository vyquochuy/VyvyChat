import React, { useEffect, useState } from 'react'
import { Avatar } from '../Avatar'
import { API_ENDPOINTS } from '../../config/api'
import { useChatStore } from '../../store/chatStore'

interface InfoPanelProps {
  friend: {
    id: string
    displayName: string
    uid: number | string
  }
  messages?: any[]
  onClose: () => void
  token: string | null
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

const InfoPanelImage: React.FC<{ storageKey: string; token: string | null }> = ({ storageKey, token }) => {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let isMounted = true

    fetch(API_ENDPOINTS.MEDIA.DOWNLOAD_URL(storageKey), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => {
        const payload = data as { download_url: string }
        if (isMounted) {
          setSrc(payload.download_url)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      })

    return () => { isMounted = false }
  }, [storageKey, token])

  if (loading) {
    return <div className="aspect-square bg-[var(--bg-input)] rounded-lg animate-pulse" />
  }

  if (error || !src) {
    return (
      <div className="aspect-square bg-[var(--bg-input)] rounded-lg flex items-center justify-center text-xs text-[var(--text-muted)]">
        ⚠
      </div>
    )
  }

  return (
    <img
      src={src}
      alt="attachment thumbnail"
      className="aspect-square w-full rounded-lg object-cover cursor-pointer hover:opacity-85 transition-opacity"
      onClick={() => window.open(src, '_blank')}
    />
  )
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  friend,
  messages = [],
  onClose,
  token,
  theme,
  setTheme
}) => {
  const [copied, setCopied] = useState(false)
  const onlineFriends = useChatStore((state) => state.onlineFriends)
  const status = onlineFriends[friend.id]?.status || 'offline'

  // Filter image attachments from chat messages
  const chatImages: string[] = []
  messages.forEach((msg) => {
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach((att: any) => {
        if (att.mime_type.startsWith('image/') && att.scan_status === 'CLEAN') {
          chatImages.push(att.storage_key)
        }
      })
    }
  })

  // Take the last 4 images to show
  const recentImages = chatImages.slice(-4).reverse()

  const handleCopyUid = () => {
    navigator.clipboard.writeText(friend.uid.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <aside className="w-full h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto chat-scroll border-l border-[var(--bg-card-border)] animate-fade-in">
      {/* Panel Header */}
      <div className="p-3.5 flex justify-between items-center border-b border-[var(--bg-card-border)] bg-[var(--bg-card)]">
        <span className="font-bold text-[14px] text-[var(--text-primary)]">Thông tin hội thoại</span>
        <button 
          onClick={onClose} 
          title="Đóng panel"
          className="bg-none border-none text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer p-1 rounded-full hover:bg-[var(--hover-chat-item)] transition-all flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Main Avatar & Status Info */}
      <div className="p-6 flex flex-col items-center border-b border-[var(--bg-card-border)] bg-[var(--bg-card)]">
        <Avatar uid={friend.id} status={status} sizeClass="w-20 h-20" />
        <h3 className="mt-3.5 text-[16px] font-bold text-[var(--text-primary)] m-0 leading-tight text-center">
          {friend.displayName}
        </h3>
        {status === 'online' ? (
        <span className="mt-1.5 text-[11px] text-[var(--color-success)] font-semibold bg-[var(--color-success-glow)] px-2.5 py-0.5 rounded-full select-none">
          Đang hoạt động
        </span>
        ) : (
          <span className="mt-1.5 text-[11px] text-[var(--color-danger)] font-semibold bg-[var(--color-danger-glow)] px-2.5 py-0.5 rounded-full select-none">
            Đang offline
          </span>
        )}

        {/* Action icons grid */}
        <div className="flex justify-center gap-4 mt-6 w-full">
          <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <button title="Trang cá nhân" className="w-10 h-10 rounded-full border border-[var(--bg-card-border)] bg-[var(--bg-input)] text-[var(--text-secondary)] group-hover:text-[var(--color-purple)] group-hover:border-[var(--color-purple)] transition-all flex items-center justify-center cursor-pointer shadow-sm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] font-medium">Cá nhân</span>
          </div>

          <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <button title="Tắt thông báo" className="w-10 h-10 rounded-full border border-[var(--bg-card-border)] bg-[var(--bg-input)] text-[var(--text-secondary)] group-hover:text-[var(--color-purple)] group-hover:border-[var(--color-purple)] transition-all flex items-center justify-center cursor-pointer shadow-sm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] font-medium">Tắt Thông báo</span>
          </div>

          <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <button title="Tìm kiếm" className="w-10 h-10 rounded-full border border-[var(--bg-card-border)] bg-[var(--bg-input)] text-[var(--text-secondary)] group-hover:text-[var(--color-purple)] group-hover:border-[var(--color-purple)] transition-all flex items-center justify-center cursor-pointer shadow-sm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] font-medium">Tìm kiếm</span>
          </div>

          <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <button title="Khác" className="w-10 h-10 rounded-full border border-[var(--bg-card-border)] bg-[var(--bg-input)] text-[var(--text-secondary)] group-hover:text-[var(--color-purple)] group-hover:border-[var(--color-purple)] transition-all flex items-center justify-center cursor-pointer shadow-sm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.2" /><circle cx="17" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
              </svg>
            </button>
            <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] font-medium">Khác</span>
          </div>
        </div>
      </div>

      {/* Information Cards Content Section */}
      <div className="p-4 flex flex-col gap-4">
        {/* Thông tin Section */}
        <div className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] rounded-2xl p-4 shadow-sm text-left">
          <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider m-0 mb-3.5">Thông tin</h4>
          
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-muted)]">UID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text-primary)] select-all">{friend.uid}</span>
                <button 
                  onClick={handleCopyUid}
                  className="bg-none border-none text-[var(--text-muted)] hover:text-[var(--color-purple)] cursor-pointer p-0.5 rounded transition-colors flex items-center"
                  title="Sao chép UID"
                >
                  {copied ? (
                    <span className="text-[9px] text-[var(--color-success)] font-medium">Đã sao chép!</span>
                  ) : (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-muted)]">Bạn bè từ</span>
              <span className="font-semibold text-[var(--text-primary)]">12/06/2025</span>
            </div>
          </div>
        </div>

        {/* File & Ảnh Section */}
        <div className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] rounded-2xl p-4 shadow-sm text-left">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider m-0">File & ảnh</h4>
            <span className="text-[11px] font-semibold text-[var(--color-purple)] hover:underline cursor-pointer select-none">Xem tất cả</span>
          </div>

          {recentImages.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {recentImages.map((storageKey, index) => (
                <InfoPanelImage key={index} storageKey={storageKey} token={token} />
              ))}
            </div>
          ) : (
            /* Premium visual mockup placeholders */
            <div className="grid grid-cols-4 gap-2">
              <div className="aspect-square w-full rounded-lg bg-gradient-to-tr from-sky-400 to-indigo-500 shadow-sm opacity-85 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div className="aspect-square w-full rounded-lg bg-gradient-to-tr from-purple-400 to-pink-500 shadow-sm opacity-85 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div className="aspect-square w-full rounded-lg bg-gradient-to-tr from-amber-400 to-emerald-500 shadow-sm opacity-85 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div className="aspect-square w-full rounded-lg bg-gradient-to-tr from-rose-400 to-amber-500 shadow-sm opacity-85 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Tùy chọn Section */}
        <div className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] rounded-2xl p-4 shadow-sm text-left">
          <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider m-0 mb-3">Tùy chọn</h4>
          
          <div 
            onClick={toggleTheme}
            className="flex justify-between items-center text-xs py-1.5 px-1 hover:bg-[var(--hover-chat-item)] rounded-lg transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-purple)]" />
              <span>Chủ đề</span>
            </div>
            <div className="flex items-center gap-1 text-[var(--text-muted)]">
              <span>{theme === 'light' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
