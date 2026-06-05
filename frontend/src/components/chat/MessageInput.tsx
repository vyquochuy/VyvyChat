import React, { useState } from 'react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    onSendMessage(value.trim())
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="py-3 px-4 border-t border-[var(--bg-card-border)] flex gap-2 items-center bg-black/10"
    >
      {/* Attachment Button Placeholder */}
      <button aria-label="Attachment Button Placeholder"
        type="button"
        className="bg-none border-none text-[var(--text-muted)] hover:text-white cursor-pointer p-1.5 flex items-center justify-center rounded-full transition-all duration-200"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>

      {/* Input Field */}
      <input
        type="text"
        placeholder="Nhập tin nhắn..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 bg-[var(--bg-input)] 
        border border-white/5 rounded-[20px] px-[18px] py-[10px] text-white text-sm outline-none text-left 
        focus:border-[var(--color-cyan)] 
        focus:shadow-[0_0_0_2px_var(--color-cyan-glow)] 
        transition-all duration-200"
      />

      {/* Send Button */}
      <button
        type="submit"
        disabled={!value.trim()}
        className={`border-none px-4 py-2.5 rounded-[20px] text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${value.trim()
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
