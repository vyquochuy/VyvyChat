import React, { useEffect, useRef, useState } from 'react'
import { Message } from '../../store/chatStore'
import { API_ENDPOINTS } from '../../config/api'

interface MessageListProps {
  messages: Message[]
  token: string | null
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Component phụ hiển thị ảnh đính kèm (sau khi đã scan an toàn)
const AttachmentImage: React.FC<{ r2Key: string; token: string | null }> = ({ r2Key, token }) => {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!token) return
    let isMounted = true

    fetch(API_ENDPOINTS.MEDIA.DOWNLOAD_URL(r2Key), {
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
  }, [r2Key, token])

  if (loading) {
    return (
      <div className="w-40 h-40 bg-white/5 border border-white/10 rounded-lg flex flex-col items-center justify-center gap-2 text-xs text-white/40">
        <svg className="animate-spin h-5 w-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Đang tải ảnh...</span>
      </div>
    )
  }

  if (error || !src) {
    return (
      <div className="w-40 h-20 bg-red-950/20 border border-red-500/30 rounded-lg flex items-center justify-center text-xs text-red-400 p-2 text-center">
        Lỗi tải hình ảnh
      </div>
    )
  }

  return (
    <img
      src={src}
      alt="Đính kèm"
      className="max-w-xs max-h-60 rounded-lg shadow-md hover:scale-[1.02] transition-transform duration-200 object-cover mt-1 cursor-zoom-in"
      onClick={() => window.open(src, '_blank')}
    />
  )
}

export const MessageList: React.FC<MessageListProps> = ({ messages, token }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const handleDownload = async (r2Key: string, fileName: string) => {
    if (!token) {
      alert('Vui lòng đăng nhập để tải xuống.')
      return
    }
    try {
      const response = await fetch(API_ENDPOINTS.MEDIA.DOWNLOAD_URL(r2Key), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) {
        const err = (await response.json()) as { error?: string }
        alert(err.error || 'Tải xuống thất bại.')
        return
      }
      const data = (await response.json()) as { download_url: string }

      // Tạo trigger tải file
      const a = document.createElement('a')
      a.href = data.download_url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message)
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] italic">
          Chưa có tin nhắn nào. Gửi tin nhắn đầu tiên để bắt đầu!
        </div>
      ) : (
        messages.map((msg) => {
          const isMe = msg.senderId === 'current-user'

          return (
            <div
              key={msg.id}
              className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Text Message Content */}
                {msg.content && msg.type === 'TEXT' && (
                  <div
                    className={`px-3.5 py-2.5 text-sm leading-[1.4] text-left break-words ${isMe
                      ? 'bg-gradient-to-r from-[var(--color-purple)] to-[#6366f1] border-none rounded-[16px_16px_2px_16px] shadow-[0_4px_12px_rgba(99,102,241,0.15)]'
                      : 'bg-white/5 border border-white/10 rounded-[16px_16px_16px_2px]'
                      } text-white`}
                  >
                    {msg.content}
                  </div>
                )}

                {/* Attachments rendering */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    {msg.attachments.map((att) => {
                      const isImage = att.mime_type.startsWith('image/')
                      const isPending = att.scan_status === 'PENDING'
                      const isInfected = att.scan_status === 'INFECTED'
                      const isClean = att.scan_status === 'CLEAN'

                      // Nếu là ảnh sạch thì hiển thị inline image
                      if (isImage && isClean) {
                        return (
                          <AttachmentImage
                            key={att.id}
                            r2Key={att.r2_key}
                            token={token}
                          />
                        )
                      }

                      // Mặc định hoặc file thường hoặc ảnh đang quét / bị nhiễm độc
                      return (
                        <div
                          key={att.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left min-w-[240px] max-w-sm transition-all duration-200 ${isInfected
                            ? 'bg-red-950/20 border-red-500/30'
                            : isPending
                              ? 'bg-yellow-950/10 border-yellow-500/20'
                              : 'bg-white/5 border-white/10'
                            }`}
                        >
                          {/* File Icon */}
                          <div className={`p-2 rounded ${isInfected ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/60'
                            }`}>
                            {isImage ? (
                              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            )}
                          </div>

                          {/* File Details */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate m-0">
                              {att.file_name}
                            </p>
                            <p className="text-[11px] text-white/40 m-0 mt-0.5">
                              {formatSize(att.file_size)}
                            </p>

                            {/* Scan Status Badges */}
                            <div className="mt-1.5 flex items-center">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 font-medium">
                                  <svg className="animate-spin h-3.5 w-3.5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Đang kiểm tra an toàn...
                                </span>
                              )}
                              {isInfected && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                  Tệp bị chặn (Mã độc)
                                </span>
                              )}
                              {isClean && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-success)] font-medium">
                                  An toàn
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          {isClean && (
                            <button
                              onClick={() => handleDownload(att.r2_key, att.file_name)}
                              className="bg-white/5 border-none text-[var(--text-secondary)] hover:text-white cursor-pointer p-1.5 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                              title="Tải tệp xuống"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Timestamp */}
                <span className="text-[10px] text-[var(--text-muted)] mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
