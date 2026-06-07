import React, { useState, useRef } from 'react'

interface MessageInputProps {
  onSendMessage: (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => void
  token: string | null
  backendUrl: string
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, token, backendUrl }) => {
  const [value, setValue] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    onSendMessage(value.trim())
    setValue('')
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

    const maxLimit = isImage ? 10 * 1024 * 1024 : isZip ? 100 * 1024 * 1024 : 50 * 1024 * 1024
    if (file.size > maxLimit) {
      const limitStr = isImage ? '10MB' : isZip ? '100MB' : '50MB'
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
      const response = await fetch(`${backendUrl}/api/media/upload-url`, {
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

      const { upload_url, r2_key } = (await response.json()) as { upload_url: string; r2_key: string }

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
              r2_key: r2_key,
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
      className="relative py-3 px-4 border-t border-[var(--bg-card-border)] flex gap-2 items-center bg-black/10"
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
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-purple)] to-[var(--color-cyan)] transition-all duration-150"
            style={{ width: `${uploadProgress}%` }}
          />
          <div className="absolute top-[3px] left-4 text-[10px] text-white/50 bg-black/80 px-2 py-0.5 rounded-b-md">
            Đang tải lên: {uploadFileName} ({uploadProgress}%)
          </div>
        </div>
      )}

      {/* Attachment Button */}
      <button
        type="button"
        onClick={handleAttachmentClick}
        disabled={uploadProgress !== null}
        className="bg-none border-none text-[var(--text-muted)] hover:text-white cursor-pointer p-1.5 flex items-center justify-center rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Gửi tệp đính kèm"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>

      {/* Input Field */}
      <input
        type="text"
        placeholder={uploadProgress !== null ? "Vui lòng đợi tải lên..." : "Nhập tin nhắn..."}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={uploadProgress !== null}
        className="flex-1 bg-[var(--bg-input)] 
        border border-white/5 rounded-[20px] px-[18px] py-[10px] text-white text-sm outline-none text-left 
        focus:border-[var(--color-cyan)] 
        focus:shadow-[0_0_0_2px_var(--color-cyan-glow)] 
        transition-all duration-200 disabled:opacity-50"
      />

      {/* Send Button */}
      <button
        type="submit"
        disabled={!value.trim() || uploadProgress !== null}
        className={`border-none px-4 py-2.5 rounded-[20px] text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${value.trim() && uploadProgress === null
          ? 'bg-gradient-to-r from-[var(--color-purple)] to-[#6366f1] text-white cursor-pointer hover:opacity-90'
          : 'bg-white/[0.03] text-[var(--text-muted)] cursor-not-allowed'
          }`}
      >
        <span>Gửi</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  )
}
