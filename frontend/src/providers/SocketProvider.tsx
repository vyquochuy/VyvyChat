import React, { createContext, useContext } from 'react';
import { usePresenceSocket } from '../hooks/usePresenceSocket';
import { useConversationSocket } from '../hooks/useConversationSocket';

interface SocketContextType {
  handleSendMessage: (content: string, typeMsg?: 'TEXT' | 'IMAGE' | 'FILE', attachments?: any[]) => void;
  sendTypingStatus: (isTyping: boolean) => void;
  handleRecallMessage: (messageId: string) => void;
  handleForwardMessage: (targetFriendId: string, message: any, decryptedBuffer?: ArrayBuffer) => Promise<void>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{
  token: string | null;
  user: any;
  currentPage: string;
  children: React.ReactNode;
}> = ({ token, user, currentPage, children }) => {
  // Activate presence socket hook
  usePresenceSocket(token, user?.id, currentPage);

  // Activate conversation socket hook and get sendMessage + typing callbacks
  const { handleSendMessage, sendTypingStatus, handleRecallMessage, handleForwardMessage } = useConversationSocket(token, user, currentPage);

  return (
    <SocketContext.Provider value={{ handleSendMessage, sendTypingStatus, handleRecallMessage, handleForwardMessage }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
