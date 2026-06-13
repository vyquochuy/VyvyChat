import React, { useState, useRef } from 'react'
import { API_ENDPOINTS } from '../../config/api'
import { FILE_LIMITS, SOCKET_CONFIG } from '../../config/constant'
import { useSocket } from '../../providers/SocketProvider'

interface MessageInputProps {
  onSendMessage: (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => void
  token: string | null
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, token }) => {
  const [value, setValue] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimerRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Lấy sendTypingStatus từ context Socket
  const { sendTypingStatus } = useSocket()

  const handleSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault()
    if (!value.trim()) return
    // Tắt typing indicator ngay khi gửi
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTypingStatus(false)
    onSendMessage(value.trim())
    setValue('')

    // Reset height of textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // Gửi tín hiệu đang gõ phím
    sendTypingStatus(true)
    // Debounce 3 giây: sau 3s không gõ thì gửi typing: false
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      sendTypingStatus(false)
    }, SOCKET_CONFIG.TYPING_DEBOUNCE_MS)

    // Auto-grow height up to 120px
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleAttachmentClick = () => {
    if (!token) {
      alert('Vui lòng đăng nhập để gửi tệp tin.')
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Kiểm tra kích thước giới hạn
    const isImage = file.type.startsWith('image/')
    const isZip = file.type.includes('zip') ||
      file.type.includes('x-zip-compressed') ||
      file.name.endsWith('.zip') ||
      file.name.endsWith('.rar') ||
      file.name.endsWith('.7z')

    const maxLimit = isImage ? FILE_LIMITS.IMAGE : isZip ? FILE_LIMITS.ZIP : FILE_LIMITS.DEFAULT
    if (file.size > maxLimit) {
      const limitStr = isImage ? '10MB' : '15MB'
      alert(`Kích thước tệp tin vượt quá giới hạn cho phép (${limitStr}).`)
      return
    }

    setUploadFileName(file.name)
    setUploadProgress(0)

    try {
      // 2. Tính SHA-256 của file bằng Web Crypto API
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // 3. Yêu cầu upload URL từ Hono API
      const response = await fetch(API_ENDPOINTS.MEDIA.UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          sha256
        })
      })

      if (!response.ok) {
        const errData = (await response.json()) as { error?: string }
        throw new Error(errData.error || 'Yêu cầu tải lên thất bại.')
      }

      const { upload_url, storage_key } = (await response.json()) as { upload_url: string; storage_key: string }

      // 4. Upload file bằng XHR để theo dõi tiến trình
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', upload_url, true)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          setUploadProgress(null)
          setUploadFileName('')

          // Gửi tin nhắn chứa thông tin đính kèm
          const typeMsg = isImage ? 'IMAGE' : 'FILE'
          onSendMessage(
            `Đã gửi tệp đính kèm: ${file.name}`,
            typeMsg,
            [{
              file_name: file.name,
              file_size: file.size,
              mime_type: file.type || 'application/octet-stream',
              storage_key: storage_key,
              sha256
            }]
          )
        } else {
          try {
            const err = JSON.parse(xhr.responseText)
            alert('Tải lên thất bại: ' + (err.error || xhr.statusText))
          } catch {
            alert('Tải lên thất bại: ' + xhr.statusText)
          }
          setUploadProgress(null)
          setUploadFileName('')
        }
      }

      xhr.onerror = () => {
        alert('Lỗi kết nối khi tải tệp lên.')
        setUploadProgress(null)
        setUploadFileName('')
      }

      xhr.send(file)

    } catch (err: any) {
      alert(err.message)
      setUploadProgress(null)
      setUploadFileName('')
    }

    // Reset value của file input để cho phép chọn lại cùng một file
    e.target.value = ''
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative py-3 px-4 border-t border-[var(--bg-card-border)] flex gap-2.5 items-end bg-[var(--bg-primary)]"
    >
      {/* Hidden File Input */}
      <input
        title="chọn tệp tin đính kèm"
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className='hidden'
      />

      {/* Progress Bar Overlay */}
      {uploadProgress !== null && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--bg-card-border)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-purple)] transition-all duration-150"
            style={{ width: `${uploadProgress}%` }}
          />
          <div className="absolute top-[3px] left-4 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--bg-card-border)] px-2.5 py-0.5 rounded-b-md shadow-sm">
            Đang tải lên: {uploadFileName} ({uploadProgress}%)
          </div>
        </div>
      )}

      {/* Attachment Button */}
      <button
        type="button"
        onClick={handleAttachmentClick}
        disabled={uploadProgress !== null}
        className="bg-none border-none text-[var(--text-muted)] hover:text-[var(--color-purple)] cursor-pointer p-1.5 flex items-center justify-center rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mb-[3px]"
        title="Gửi tệp đính kèm"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>

      {/* Text Area Input */}
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder={uploadProgress !== null ? "Vui lòng đợi tải lên..." : "Nhập tin nhắn..."}
        value={value}
        onChange={handleTextAreaChange}
        onKeyDown={handleKeyDown}
        disabled={uploadProgress !== null}
        className="flex-1 bg-[var(--bg-input)] min-w-0 max-h-[120px] resize-none overflow-y-auto
        border border-[var(--bg-card-border)] rounded-[20px] px-[18px] py-[10px] text-[var(--text-primary)] text-sm outline-none text-left 
        focus:border-[var(--color-purple)] 
        focus:shadow-[0_0_0_3px_var(--color-purple-glow)] 
        transition-all duration-200 disabled:opacity-50"
        style={{ height: 'auto' }}
      />

      {/* Redesigned Circular Send Button */}
      <button
        type="submit"
        disabled={!value.trim() || uploadProgress !== null}
        className={`border-none w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          value.trim() && uploadProgress === null
            ? 'bg-[var(--bg-message-outgoing)] text-[var(--text-message-outgoing)] cursor-pointer hover:opacity-90 active:scale-95'
            : 'bg-[var(--bg-input)] border border-[var(--bg-card-border)] text-[var(--text-muted)] cursor-not-allowed'
        }`}
        title="Gửi tin nhắn"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-[1px] mt-[0.5px]">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  )
}
