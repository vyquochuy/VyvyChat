export type Env = {
  OTP_KV: KVNamespace
  DB: D1Database
  GAS_WEBHOOK_URL: string
  JWT_SECRET?: string
  CONVERSATION_DO: DurableObjectNamespace
  USER_PRESENCE_DO: DurableObjectNamespace
  ENVIRONMENT?: string
}

export type Variables = {
  user: {
    id: string
    email: string
  }
}
