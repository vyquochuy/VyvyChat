import React, { createContext, useContext } from 'react';
import { useSecretChat } from '../hooks/useE2EE';

type SecretChatContextType = ReturnType<typeof useSecretChat>;

const SecretChatContext = createContext<SecretChatContextType | null>(null);

export const SecretChatProvider: React.FC<{ userId: string; children: React.ReactNode }> = ({ userId, children }) => {
  const secretChatValue = useSecretChat(userId);

  return (
    <SecretChatContext.Provider value={secretChatValue}>
      {children}
    </SecretChatContext.Provider>
  );
};

export const useSecretChatContext = () => {
  const context = useContext(SecretChatContext);
  if (!context) {
    throw new Error('useSecretChatContext must be used within a SecretChatProvider');
  }
  return context;
};
