import { create } from 'zustand'

export interface Attachment {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_key: string
  sha256?: string
  thumbnail_key?: string
  scan_status: 'PENDING' | 'CLEAN' | 'INFECTED'
}

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: number
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
  attachments?: Attachment[]
}

interface ChatState {
  activeFriendId: string | null
  conversations: Record<string, string> // friendId -> conversationId
  messages: Record<string, Message[]> // friendId -> Message[]
  onlineFriends: Record<string, { status: string; lastSeen?: number }> // friendId -> presence
  typingFriends: Record<string, boolean> // friendId -> isTyping
  friends: any[]
  addMessage: (friendId: string, messageOrContent: Message | string, senderId?: string) => void
  setMessages: (friendId: string, messages: Message[]) => void
  setFriends: (friends: any[]) => void
  setActiveFriendId: (friendId: string | null) => void
  setConversationId: (friendId: string, conversationId: string) => void
  updatePresence: (friendId: string, status: string, lastSeen?: number) => void
  setOnlineFriends: (presenceMap: Record<string, { status: string; lastSeen?: number }>) => void
  updateAttachmentStatus: (friendId: string, attachmentId: string, status: string) => void
  setTyping: (friendId: string, isTyping: boolean) => void
  clearStore: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeFriendId: null,
  conversations: {},
  messages: {},
  onlineFriends: {},
  typingFriends: {},
  friends: [],

  addMessage: (friendId, messageOrContent, senderId) =>
    set((state) => {
      let newMessage: Message
      if (typeof messageOrContent === 'string') {
        newMessage = {
          id: crypto.randomUUID(),
          senderId: senderId || 'current-user',
          content: messageOrContent,
          timestamp: Date.now(),
          type: 'TEXT',
          attachments: []
        }
      } else {
        newMessage = messageOrContent
      }

      const friendMessages = state.messages[friendId] || []
      
      // Tránh trùng lặp tin nhắn dựa trên ID
      if (friendMessages.some(m => m.id === newMessage.id)) {
        return {}
      }

      return {
        messages: {
          ...state.messages,
          [friendId]: [...friendMessages, newMessage]
        }
      }
    }),

  setMessages: (friendId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [friendId]: messages
      }
    })),

  setFriends: (friends) => set({ friends }),

  setActiveFriendId: (activeFriendId) => set({ activeFriendId }),

  setConversationId: (friendId, conversationId) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [friendId]: conversationId
      }
    })),

  updatePresence: (friendId, status, lastSeen) =>
    set((state) => ({
      onlineFriends: {
        ...state.onlineFriends,
        [friendId]: { status, lastSeen }
      }
    })),

  setOnlineFriends: (presenceMap) =>
    set((state) => ({
      onlineFriends: {
        ...state.onlineFriends,
        ...presenceMap
      }
    })),

  updateAttachmentStatus: (friendId, attachmentId, status) =>
    set((state) => {
      const friendMessages = state.messages[friendId] || []
      const updatedMessages = friendMessages.map((msg) => {
        if (msg.attachments && msg.attachments.length > 0) {
          const updatedAttachments = msg.attachments.map((att) => {
            if (att.id === attachmentId) {
              return { ...att, scan_status: status as any }
            }
            return att
          })
          return { ...msg, attachments: updatedAttachments }
        }
        return msg
      })
      return {
        messages: {
          ...state.messages,
          [friendId]: updatedMessages
        }
      }
    }),

  setTyping: (friendId, isTyping) =>
    set((state) => ({
      typingFriends: {
        ...state.typingFriends,
        [friendId]: isTyping
      }
    })),

  clearStore: () =>
    set({
      activeFriendId: null,
      conversations: {},
      messages: {},
      onlineFriends: {},
      typingFriends: {},
      friends: []
    })
}))
