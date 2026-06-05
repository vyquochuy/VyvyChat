import { create } from 'zustand'

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: number
  type: 'TEXT' | 'IMAGE' | 'FILE'
}

interface ChatState {
  activeFriendId: string | null
  messages: Record<string, Message[]>
  friends: any[]
  addMessage: (friendId: string, content: string, senderId: string) => void
  setFriends: (friends: any[]) => void
  setActiveFriendId: (friendId: string | null) => void
  clearStore: () => void
}

// Generate some mock initial messages for a friendly user onboarding experience
export const getMockInitialMessages = (friendId: string): Message[] => {
  return [
    {
      id: `${friendId}-mock-1`,
      senderId: friendId,
      content: 'Chào cậu! Chúc cậu một ngày tốt lành.',
      timestamp: Date.now() - 3600000 * 2, // 2 hours ago
      type: 'TEXT'
    },
    {
      id: `${friendId}-mock-2`,
      senderId: 'current-user',
      content: 'Chào cậu nhé! Cảm ơn cậu.',
      timestamp: Date.now() - 3600000, // 1 hour ago
      type: 'TEXT'
    },
    {
      id: `${friendId}-mock-3`,
      senderId: friendId,
      content: 'Tụi mình nhắn tin thử nghiệm ở giao diện Phase 3 này nhé!',
      timestamp: Date.now() - 1800000, // 30 mins ago
      type: 'TEXT'
    }
  ]
}

export const useChatStore = create<ChatState>((set) => ({
  activeFriendId: null,
  messages: {},
  friends: [],

  addMessage: (friendId, content, senderId) =>
    set((state) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        senderId,
        content,
        timestamp: Date.now(),
        type: 'TEXT'
      }

      const friendMessages = state.messages[friendId] || getMockInitialMessages(friendId)
      
      return {
        messages: {
          ...state.messages,
          [friendId]: [...friendMessages, newMessage]
        }
      }
    }),

  setFriends: (friends) => set({ friends }),

  setActiveFriendId: (activeFriendId) => set({ activeFriendId }),

  clearStore: () => set({ activeFriendId: null, messages: {}, friends: [] })
}))
