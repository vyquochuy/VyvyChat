export type Env = {
  OTP_KV: KVNamespace
  DB: D1Database
  GAS_WEBHOOK_URL: string
  JWT_SECRET?: string
  CONVERSATION_DO: DurableObjectNamespace
  USER_PRESENCE_DO: DurableObjectNamespace
  ENVIRONMENT?: string
  MEDIA_BUCKET: R2Bucket
  VIRUS_SCAN_QUEUE: Queue<any>
}

export type Variables = {
  user: {
    id: string
    email: string
  }
}
