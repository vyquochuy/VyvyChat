import React, { useEffect, useRef, useState } from 'react'
import { Message, useChatStore } from '../../store/chatStore'
import { API_ENDPOINTS } from '../../config/api'
import { Avatar } from '../Avatar'
import { useSecretChatContext } from '../../providers/SecretChatProvider'
import { decryptBuffer } from '../../utils/crypto'
import { useSocket } from '../../providers/SocketProvider'

interface MessageListProps {
  messages: Message[] | undefined
  token: string | null
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Component phụ hiển thị ảnh đính kèm (sau khi đã scan an toàn)
const AttachmentImage: React.FC<{
  storageKey: string;
  token: string | null;
  isE2EE?: boolean;
  mimeType: string;
  friendId: string;
  getSharedKey: any;
  friends: any[];
}> = ({ storageKey, token, isE2EE, mimeType, friendId, getSharedKey, friends }) => {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!token) return
    let isMounted = true
    let objectUrl: string | null = null

    fetch(API_ENDPOINTS.MEDIA.DOWNLOAD_URL(storageKey), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(async (data) => {
        const payload = data as { download_url: string }
        if (!isMounted) return

        if (isE2EE) {
          try {
            const fileRes = await fetch(payload.download_url)
            if (!fileRes.ok) throw new Error()
            const encryptedBuffer = await fileRes.arrayBuffer()

            const activeFriend = friends.find(f => f.id === friendId)
            const friendPubKey = activeFriend?.publicKey || ''
            const friendKeyVersion = activeFriend?.keyVersion ?? 1
            const sharedKey = await getSharedKey(friendId, friendPubKey, token, friendKeyVersion)
            if (!sharedKey) throw new Error()

            const decryptedBuffer = await decryptBuffer(encryptedBuffer, sharedKey)
            const blob = new Blob([decryptedBuffer], { type: mimeType })
            const url = URL.createObjectURL(blob)
            objectUrl = url

            if (isMounted) {
              setSrc(url)
              setLoading(false)
            }
          } catch (err) {
            console.error('[AttachmentImage] E2EE decrypt image error:', err)
            throw err
          }
        } else {
          if (isMounted) {
            setSrc(payload.download_url)
            setLoading(false)
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [storageKey, token, isE2EE, mimeType, friendId, friends, getSharedKey])

  if (loading) {
    return (
      <div className="w-40 h-40 bg-[var(--bg-input)] border border-[var(--bg-card-border)] rounded-xl flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)] animate-pulse">
        <svg className="animate-spin h-5 w-5 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Đang tải ảnh...</span>
      </div>
    )
  }

  if (error || !src) {
    return (
      <div className="w-40 h-20 bg-[var(--color-error-glow)] border border-[var(--color-error)]/20 rounded-xl flex items-center justify-center text-xs text-[var(--color-error)] p-2 text-center">
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

export function getFriendlyDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dYear = date.getFullYear();
  const dMonth = date.getMonth();
  const dDay = date.getDate();

  const tYear = today.getFullYear();
  const tMonth = today.getMonth();
  const tDay = today.getDate();

  const yYear = yesterday.getFullYear();
  const yMonth = yesterday.getMonth();
  const yDay = yesterday.getDate();

  if (dYear === tYear && dMonth === tMonth && dDay === tDay) {
    return 'Hôm nay';
  }
  if (dYear === yYear && dMonth === yMonth && dDay === yDay) {
    return 'Hôm qua';
  }

  // Check if it's within the last 7 days
  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return daysOfWeek[date.getDay()];
  }

  // Format as DD/MM/YYYY
  const dayStr = String(dDay).padStart(2, '0');
  const monthStr = String(dMonth + 1).padStart(2, '0');
  return `${dayStr}/${monthStr}/${dYear}`;
}

const isSameDay = (t1: number, t2: number) => {
  const d1 = new Date(t1);
  const d2 = new Date(t2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

interface MessageGroup {
  senderId: string;
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages, token }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { activeFriendId, friends, onlineFriends, pinMessage } = useChatStore()
  const activeFriend = friends.find(f => f.id === activeFriendId)
  const activeFriendPresence = onlineFriends[activeFriendId || '']?.status || 'offline'

  const { getSharedKey } = useSecretChatContext()
  const { handleRecallMessage, handleForwardMessage } = useSocket()

  // Dropdown & Forward States
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null)
  const [isPreparingForward, setIsPreparingForward] = useState(false)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [forwardBuffer, setForwardBuffer] = useState<ArrayBuffer | undefined>(undefined)
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [searchFriendQuery, setSearchFriendQuery] = useState('')

  // Global click listener to close dropdown when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.msg-menu-container')) {
        setActiveMenuMsgId(null)
      }
    }
    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [])

  const handleInitiateForward = async (msg: Message) => {
    if (msg.attachments && msg.attachments.length > 0) {
      setIsPreparingForward(true)
      try {
        const att = msg.attachments[0]
        if (!token) throw new Error('Vui lòng đăng nhập.')

        const response = await fetch(API_ENDPOINTS.MEDIA.DOWNLOAD_URL(att.storage_key), {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!response.ok) throw new Error('Không thể lấy liên kết tải xuống.')
        const data = (await response.json()) as { download_url: string }

        let buffer: ArrayBuffer
        if (msg.isE2EE && activeFriendId) {
          const fileRes = await fetch(data.download_url)
          if (!fileRes.ok) throw new Error('Không thể tải tệp đã mã hóa.')
          const encryptedBuffer = await fileRes.arrayBuffer()

          const friendPubKey = activeFriend?.publicKey || ''
          const friendKeyVersion = activeFriend?.keyVersion ?? 1
          const sharedKey = await getSharedKey(activeFriendId, friendPubKey, token, friendKeyVersion)
          if (!sharedKey) throw new Error('Không thể giải mã - thiếu khóa.')

          buffer = await decryptBuffer(encryptedBuffer, sharedKey)
        } else {
          const fileRes = await fetch(data.download_url)
          if (!fileRes.ok) throw new Error('Không thể tải tệp tin.')
          buffer = await fileRes.arrayBuffer()
        }

        setForwardBuffer(buffer)
        setForwardMsg(msg)
        setShowForwardModal(true)
      } catch (err: any) {
        alert('Lỗi chuẩn bị tệp chuyển tiếp: ' + err.message)
      } finally {
        setIsPreparingForward(false)
      }
    } else {
      setForwardBuffer(undefined)
      setForwardMsg(msg)
      setShowForwardModal(true)
    }
  }

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const handleDownload = async (storageKey: string, fileName: string, mimeType: string, isE2EE?: boolean) => {
    if (!token) {
      alert('Vui lòng đăng nhập để tải xuống.')
      return
    }
    try {
      const response = await fetch(API_ENDPOINTS.MEDIA.DOWNLOAD_URL(storageKey), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) {
        const err = (await response.json()) as { error?: string }
        alert(err.error || 'Tải xuống thất bại.')
        return
      }
      const data = (await response.json()) as { download_url: string }

      if (isE2EE && activeFriendId) {
        const fileRes = await fetch(data.download_url)
        if (!fileRes.ok) throw new Error('Không thể tải tệp tin đã mã hóa.')
        const encryptedBuffer = await fileRes.arrayBuffer()

        const friendPubKey = activeFriend?.publicKey || ''
        const friendKeyVersion = activeFriend?.keyVersion ?? 1
        const sharedKey = await getSharedKey(activeFriendId, friendPubKey, token, friendKeyVersion)
        if (!sharedKey) throw new Error('Không thể giải mã - thiếu khóa.')

        const decryptedBuffer = await decryptBuffer(encryptedBuffer, sharedKey)
        const blob = new Blob([decryptedBuffer], { type: mimeType })
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const a = document.createElement('a')
        a.href = data.download_url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch (err: any) {
      alert('Lỗi tải xuống: ' + err.message)
    }
  }

  // 1. Loading Skeleton Shimmer
  if (messages === undefined) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 animate-pulse select-none bg-chat-custom chat-scroll">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 w-full">
            <div className="w-9 h-9 rounded-full bg-slate-200/50 dark:bg-white/10 flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-3 bg-slate-200/50 dark:bg-white/10 rounded w-24" />
              <div className="h-8 bg-slate-100/50 dark:bg-white/5 rounded-[20px] rounded-tl-none w-3/4 max-w-[400px]" />
              {i % 2 === 0 && (
                <div className="h-7 bg-slate-100/50 dark:bg-white/5 rounded-[20px] rounded-tl-none w-1/2 max-w-[280px]" />
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 2. Empty state
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] italic bg-chat-custom">
        Chưa có tin nhắn nào. Gửi tin nhắn đầu tiên để bắt đầu!
      </div>
    )
  }

  // 3. Message Grouping algorithm
  const groups: MessageGroup[] = []
  messages.forEach((msg, idx) => {
    const prevMsg = idx > 0 ? messages[idx - 1] : null

    let shouldStartNewGroup = false
    if (!prevMsg) {
      shouldStartNewGroup = true
    } else if (msg.type === 'SYSTEM' || prevMsg.type === 'SYSTEM') {
      shouldStartNewGroup = true
    } else if (msg.senderId !== prevMsg.senderId) {
      shouldStartNewGroup = true
    } else if (msg.timestamp - prevMsg.timestamp > 10 * 60 * 1000) { // 10 minutes gap
      shouldStartNewGroup = true
    } else if (!isSameDay(msg.timestamp, prevMsg.timestamp)) { // Date separator change
      shouldStartNewGroup = true
    } else if ((msg.attachments && msg.attachments.length > 0) || (prevMsg.attachments && prevMsg.attachments.length > 0)) {
      shouldStartNewGroup = true
    }

    if (shouldStartNewGroup) {
      groups.push({
        senderId: msg.senderId,
        messages: [msg]
      })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  })

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-chat-custom chat-scroll"
    >
      {groups.map((group, groupIdx) => {
        const firstMsg = group.messages[0]
        const isSystem = firstMsg.type === 'SYSTEM'
        const isMe = firstMsg.senderId === 'current-user'
        const prevGroup = groupIdx > 0 ? groups[groupIdx - 1] : null

        // Render Date Separator if calendar day changed
        const showDateSeparator = !prevGroup || !isSameDay(firstMsg.timestamp, prevGroup.messages[0].timestamp)

        if (isSystem) {
          return (
            <React.Fragment key={firstMsg.id}>
              {showDateSeparator && (
                <div className="flex items-center justify-center my-5 select-none">
                  <div className="h-[1px] bg-[var(--bg-card-border)] flex-1" />
                  <span className="mx-4 text-[11px] font-medium text-[var(--text-muted)] px-2.5 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--bg-card-border)] shadow-sm">
                    {getFriendlyDateString(firstMsg.timestamp)}
                  </span>
                  <div className="h-[1px] bg-[var(--bg-card-border)] flex-1" />
                </div>
              )}
              <div className="flex justify-center w-full my-2">
                <div className="bg-[var(--bg-input)] border border-[var(--bg-card-border)] px-3.5 py-1.5 rounded-full text-[11px] text-[var(--text-secondary)] text-center max-w-[80%]">
                  {firstMsg.content}
                </div>
              </div>
            </React.Fragment>
          )
        }

        return (
          <React.Fragment key={firstMsg.id}>
            {showDateSeparator && (
              <div className="flex items-center justify-center my-5 select-none">
                <div className="h-[1px] bg-[var(--bg-card-border)] flex-1" />
                <span className="mx-4 text-[11px] font-medium text-[var(--text-muted)] px-2.5 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--bg-card-border)] shadow-sm">
                  {getFriendlyDateString(firstMsg.timestamp)}
                </span>
                <div className="h-[1px] bg-[var(--bg-card-border)] flex-1" />
              </div>
            )}

            <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start`}>
                
                {/* Sender Avatar (only if not Me) */}
                {!isMe && activeFriend && (
                  <Avatar uid={activeFriend.id} status={activeFriendPresence} sizeClass="w-9 h-9 flex-shrink-0 mt-0.5" />
                )}

                <div className={`flex-1 flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0`}>
                  
                  {/* Sender Name (only once per group, above the first bubble, only if not Me) */}
                  {!isMe && activeFriend && (
                    <span className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 ml-1 select-none">
                      {activeFriend.displayName}
                    </span>
                  )}

                  {/* Bubbles Stack */}
                  <div className={`flex flex-col gap-1 w-full ${isMe ? 'items-end' : 'items-start'}`}>
                    {group.messages.map((msg, msgIdx) => {
                      const isRecent = Date.now() - msg.timestamp < 3000
                      const isSingle = group.messages.length === 1
                      const isFirst = msgIdx === 0
                      const isLast = msgIdx === group.messages.length - 1

                      // Compute custom border radius
                      let radiusClass = ''
                      if (isMe) {
                        if (isSingle) radiusClass = 'rounded-[20px_20px_4px_20px]'
                        else if (isFirst) radiusClass = 'rounded-[20px_20px_4px_20px]'
                        else if (isLast) radiusClass = 'rounded-[20px_4px_20px_20px]'
                        else radiusClass = 'rounded-[20px_4px_4px_20px]'
                      } else {
                        if (isSingle) radiusClass = 'rounded-[20px_20px_20px_4px]'
                        else if (isFirst) radiusClass = 'rounded-[20px_20px_20px_4px]'
                        else if (isLast) radiusClass = 'rounded-[4px_20px_20px_20px]'
                        else radiusClass = 'rounded-[4px_20px_20px_4px]'
                      }

                      const isRecalled = msg.message_state === 'RECALLED'

                      if (isRecalled) {
                        return (
                          <div
                            key={msg.id}
                            id={`msg-${msg.id}`}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full mt-1`}
                          >
                            <div
                              className={`px-3.5 py-2 text-[13px] italic select-none ${radiusClass} bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--bg-card-border)]`}
                            >
                              Tin nhắn đã bị thu hồi
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full relative`}
                        >
                          {/* CONTAINER GỐC: Điều hướng hướng hiển thị (Trái/Phải) bằng flex-row hoặc flex-row-reverse */}
                          <div className={`relative flex items-center gap-3 group/btn max-w-[100%] ${isMe ? 'flex-row-reverse ml-auto' : 'flex-row mr-auto'}`}>
                            
                            {/* 1. KHỐI NỘI DUNG TIN NHẮN (TEXT / ATTACHMENTS) */}
                            <div className={`flex flex-col min-w-0 w-fit max-w-[100%-40pt] ${isMe ? 'items-end' : 'items-start'}`}>
                              
                              {/* Text Content */}
                              {msg.content && msg.type === 'TEXT' && (
                                <div
                                className={`px-3.5 py-2.5 text-[13.5px] leading-[1.45] text-left break-words w-full shadow-sm select-text ${radiusClass} ${
                                  isMe
                                  ? 'bg-[var(--bg-message-outgoing)] text-[var(--text-message-outgoing)]'
                                  : 'bg-[var(--bg-message-incoming)] text-[var(--text-message-incoming)] border border-[var(--border-message-incoming)]'
                                } ${isRecent ? 'animate-[popIn_150ms_ease-out_forwards]' : ''}`}
                                
                                style={isMe ? { background: 'var(--bg-message-outgoing)' } : {}}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    {/* Thuộc tính break-all hoặc break-words để tự động xuống hàng khi chuỗi ký tự liền nhau quá dài (như "aaaaaaaaaaaa") */}
                                    <div className="break-all whitespace-pre-wrap">{msg.content}</div>
                                    <div className={`text-[9px] text-right mt-1 opacity-75 select-none flex items-center justify-end gap-1 ${
                                      isMe ? 'text-[var(--text-message-outgoing)]' : 'text-[var(--text-secondary)]'
                                    }`}>
                                      <span>
                                        {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {isMe && (
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-85">
                                          <path d="M17 6L8.5 14.5L5 11M22 6L13.5 14.5" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Attachments rendering */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-col gap-2 mt-1 w-full">
                                  {msg.attachments.map((att) => {
                                    const isImage = att.mime_type.startsWith('image/')
                                    const isPending = att.scan_status === 'PENDING'
                                    const isInfected = att.scan_status === 'INFECTED'
                                    const isClean = att.scan_status === 'CLEAN'

                                    if (isImage && isClean) {
                                      return (
                                        <AttachmentImage
                                          key={att.id}
                                          storageKey={att.storage_key}
                                          token={token}
                                          isE2EE={msg.isE2EE}
                                          mimeType={att.mime_type}
                                          friendId={activeFriendId || ''}
                                          getSharedKey={getSharedKey}
                                          friends={friends}
                                        />
                                      )
                                    }

                                    return (
                                      <div
                                        key={att.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left min-w-[240px] max-w-sm transition-all duration-200 ${
                                          isInfected
                                            ? 'bg-[var(--color-error-glow)] border-[var(--color-error)]/20'
                                            : isPending
                                              ? 'bg-amber-500/10 border-amber-500/20'
                                              : 'bg-[var(--bg-input)] border-[var(--bg-card-border)]'
                                        }`}
                                      >
                                        <div className={`p-2 rounded-lg ${isInfected ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' : 'bg-[var(--bg-card)] border border-[var(--bg-card-border)] text-[var(--text-secondary)]'}`}>
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

                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate m-0">
                                            {att.file_name}
                                          </p>
                                          <p className="text-[11px] text-[var(--text-muted)] m-0 mt-0.5">
                                            {formatSize(att.file_size)}
                                          </p>

                                          <div className="mt-1.5 flex items-center">
                                            {isPending && (
                                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-yellow-400 font-medium">
                                                <svg className="animate-spin h-3.5 w-3.5 text-amber-600 dark:text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Đang kiểm tra an toàn...
                                              </span>
                                            )}
                                            {isInfected && (
                                              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-error)] font-semibold bg-[var(--color-error)]/10 px-1.5 py-0.5 rounded border border-[var(--color-error)]/20">
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

                                        {isClean && (
                                          <button
                                            onClick={() => handleDownload(att.storage_key, att.file_name, att.mime_type, msg.isE2EE)}
                                            className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer p-1.5 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-[var(--hover-chat-item)]"
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
                            </div>

                            {/* 2. NÚT 3 CHẤM (OPTION DOTS & DROPDOWN) - ĐỨNG RIÊNG BIỆT NGOÀI TIN NHẮN */}
                            <div className="msg-menu-container relative flex items-center flex-shrink-0">
                              <button
                                onClick={() => setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id)}
                                className="opacity-70 md:opacity-0 md:group-hover/btn:opacity-100 transition-opacity bg-[var(--bg-card)] hover:bg-[var(--hover-chat-item)] text-[var(--text-secondary)] border border-[var(--bg-card-border)] p-1.5 rounded-full cursor-pointer flex items-center justify-center shadow-sm z-10"
                                title="Lựa chọn"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="1.5"/>
                                  <circle cx="12" cy="5" r="1.5"/>
                                  <circle cx="12" cy="19" r="1.5"/>
                                </svg>
                              </button>

                              {/* Dropdown Menu */}
                              {activeMenuMsgId === msg.id && (
                                <div className={`absolute z-50 min-w-[125px] bg-[var(--bg-card)] border border-[var(--bg-card-border)] rounded-xl shadow-lg py-1.5 text-[13px] text-[var(--text-primary)] ${isMe ? 'left-0' : 'right-0'} bottom-8 animate-[scaleIn_150ms_ease-out]`}>
                                  {isMe && (
                                    <button
                                      onClick={() => {
                                        setActiveMenuMsgId(null);
                                        if (confirm('Bạn có chắc chắn muốn thu hồi tin nhắn này?')) {
                                          handleRecallMessage(msg.id);
                                        }
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-[var(--hover-chat-item)] text-red-500 transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer font-medium"
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                      <span>Thu hồi</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActiveMenuMsgId(null);
                                      pinMessage(activeFriendId || '', msg);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[var(--hover-chat-item)] transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer font-medium"
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 2v8M18 10H6M16 10v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8" />
                                    </svg>
                                    <span>Ghim</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuMsgId(null);
                                      handleInitiateForward(msg);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[var(--hover-chat-item)] transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer font-medium"
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="15 3 21 3 21 9"></polyline>
                                      <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    <span>Chuyển tiếp</span>
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Spacing below bubble group */}
                  <div className="h-1" />

                </div>
              </div>
            </div>
          </React.Fragment>
        )
      })}

      {/* Forward modal */}
      {showForwardModal && forwardMsg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-[scaleIn_200ms_ease-out]">
            <div className="p-4 border-b border-[var(--bg-card-border)] flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[var(--text-primary)] m-0">Chuyển tiếp tin nhắn</h3>
              <button
                title='Đóng'
                onClick={() => {
                  setShowForwardModal(false)
                  setForwardMsg(null)
                  setForwardBuffer(undefined)
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer p-1 rounded-full hover:bg-[var(--hover-chat-item)]"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="p-3 bg-[var(--bg-input)] border-b border-[var(--bg-card-border)] flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm bạn bè..."
                value={searchFriendQuery}
                onChange={(e) => setSearchFriendQuery(e.target.value)}
                className="bg-transparent border-none text-[13px] text-[var(--text-primary)] focus:outline-none w-full"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 chat-scroll">
              {friends
                .filter((f) => f.displayName.toLowerCase().includes(searchFriendQuery.toLowerCase()))
                .map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--hover-chat-item)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar uid={friend.id} status="offline" sizeClass="w-9 h-9" />
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {friend.displayName}
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        await handleForwardMessage(friend.id, forwardMsg, forwardBuffer);
                        setShowForwardModal(false);
                        setForwardMsg(null);
                        setForwardBuffer(undefined);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-purple)] hover:bg-[var(--color-purple)]/90 text-white text-xs font-semibold border-none cursor-pointer transition-colors"
                    >
                      Gửi
                    </button>
                  </div>
                ))}
              {friends.filter((f) => f.displayName.toLowerCase().includes(searchFriendQuery.toLowerCase())).length === 0 && (
                <div className="text-center py-6 text-xs text-[var(--text-muted)] italic">
                  Không tìm thấy bạn bè nào
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prepare Forward attachment progress spinner overlay */}
      {isPreparingForward && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex flex-col items-center justify-center gap-3">
          <div className="bg-[var(--bg-card)] border border-[var(--bg-card-border)] p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-[var(--color-purple)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">Đang tải và giải mã tệp đính kèm...</span>
          </div>
        </div>
      )}
    </div>
  )
}

