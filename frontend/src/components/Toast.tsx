import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [closingIds, setClosingIds] = useState<string[]>([]);

  const removeToast = useCallback((id: string) => {
    setClosingIds((prev) => [...prev, id]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setClosingIds((prev) => prev.filter((cid) => cid !== id));
    }, 300); // match slide-out animation duration
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          const isClosing = closingIds.includes(t.id);
          return (
            <div key={t.id} className={`toast toast-${t.type} ${isClosing ? 'slide-out' : ''}`}>
              <span className="toast-message">{t.message}</span>
              <button
                className="toast-close"
                aria-label="Close message"
                onClick={() => removeToast(t.id)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
