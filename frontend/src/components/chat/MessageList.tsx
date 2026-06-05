import React, { useEffect, useRef } from 'react'
import { Message } from '../../store/chatStore'

interface MessageListProps {
  messages: Message[]
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
    >
      {messages.map((msg) => {
        const isMe = msg.senderId === 'current-user'
        
        return (
          <div
            key={msg.id}
            className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {/* Message Bubble */}
              <div
                className={`px-3.5 py-2.5 text-sm leading-[1.4] text-left break-words ${
                  isMe
                    ? 'bg-gradient-to-r from-[var(--color-purple)] to-[#6366f1] border-none rounded-[16px_16px_2px_16px] shadow-[0_4px_12px_rgba(99,102,241,0.15)]'
                    : 'bg-white/5 border border-white/10 rounded-[16px_16px_16px_2px]'
                } text-white`}
              >
                {msg.content}
              </div>

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
      })}
    </div>
  )
}
