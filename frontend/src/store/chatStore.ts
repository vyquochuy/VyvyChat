import { create } from 'zustand'

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: number
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
}

interface ChatState {
  activeFriendId: string | null
  conversations: Record<string, string> // friendId -> conversationId
  messages: Record<string, Message[]> // friendId -> Message[]
  onlineFriends: Record<string, { status: string; lastSeen?: number }> // friendId -> presence
  friends: any[]
  addMessage: (friendId: string, messageOrContent: Message | string, senderId?: string) => void
  setMessages: (friendId: string, messages: Message[]) => void
  setFriends: (friends: any[]) => void
  setActiveFriendId: (friendId: string | null) => void
  setConversationId: (friendId: string, conversationId: string) => void
  updatePresence: (friendId: string, status: string, lastSeen?: number) => void
  setOnlineFriends: (presenceMap: Record<string, { status: string; lastSeen?: number }>) => void
  clearStore: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeFriendId: null,
  conversations: {},
  messages: {},
  onlineFriends: {},
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
          type: 'TEXT'
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

  clearStore: () =>
    set({
      activeFriendId: null,
      conversations: {},
      messages: {},
      onlineFriends: {},
      friends: []
    })
}))
