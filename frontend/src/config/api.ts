import BACKEND_URL from './env';

export const API_ENDPOINTS = {
  AUTH: {
    SEND_OTP: `${BACKEND_URL}/api/auth/send-otp`,
    REGISTER: `${BACKEND_URL}/api/auth/register`,
    LOGIN: `${BACKEND_URL}/api/auth/login`,
    SEND_OTP_RESET: `${BACKEND_URL}/api/auth/send-otp-reset`,
    RESET_PASSWORD: `${BACKEND_URL}/api/auth/reset-password`,
    KEYS: `${BACKEND_URL}/api/auth/keys`,
    KEYS_SETUP: `${BACKEND_URL}/api/auth/keys/setup`,
  },
  USERS: {
    PRESENCE: (idsString: string) => `${BACKEND_URL}/api/users/presence?ids=${idsString}`,
    SEARCH: (query: string) => `${BACKEND_URL}/api/users/search?query=${encodeURIComponent(query)}`,
    PUBLIC_KEYS: (friendId: string) => `${BACKEND_URL}/api/users/${friendId}/public-keys`,
  },
  FRIENDS: {
    LIST: `${BACKEND_URL}/api/friends`,
    REQUESTS: `${BACKEND_URL}/api/friends/requests`,
    RESPOND: `${BACKEND_URL}/api/friends/respond`,
    REQUEST: `${BACKEND_URL}/api/friends/request`,
  },
  NOTIFICATIONS: {
    LIST: `${BACKEND_URL}/api/notifications`,
    MARK_READ: (id: string) => `${BACKEND_URL}/api/notifications/${id}/read`,
  },
  CONVERSATIONS: {
    CREATE: `${BACKEND_URL}/api/conversations`,
    MESSAGES: (convId: string) => `${BACKEND_URL}/api/conversations/${convId}/messages`,
  },
  MEDIA: {
    UPLOAD_URL: `${BACKEND_URL}/api/media/upload-url`,
    DOWNLOAD_URL: (r2Key: string) => `${BACKEND_URL}/api/media/download-url?r2Key=${encodeURIComponent(r2Key)}`,
  },
  WS: {
    PRESENCE: (token: string) => {
      const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
      return `${wsUrl}/ws/presence?token=${encodeURIComponent(token)}`;
    },
    CONVERSATION: (convId: string, token: string) => {
      const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
      return `${wsUrl}/ws/conversation/${convId}?token=${encodeURIComponent(token)}`;
    }
  }
};
