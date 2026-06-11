export const FILE_LIMITS = {
  IMAGE: 10 * 1024 * 1024,   // 10MB
  ZIP: 100 * 1024 * 1024,    // 100MB
  DEFAULT: 50 * 1024 * 1024, // 50MB
};

export const SOCKET_CONFIG = {
  PING_INTERVAL: 15000,             // 15s
  RECONNECT_BASE_DELAY: 1000,       // 1s
  RECONNECT_MAX_EXPONENT: 5,        // max retry = baseDelay * 2^5
  TYPING_DEBOUNCE_MS: 3000,         // 3s (MessageInput check)
  TYPING_TIMEOUT_MS: 4000,          // 4s (ConversationSocket check)
  PRESENCE_POLLING_INTERVAL: 15000, // 15s
};
