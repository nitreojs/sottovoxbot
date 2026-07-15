import type { ApiResponseError, TelegramMessage } from 'puregram'

export interface RedisMessage {
  message: string
  username?: string
  userId?: number
  senderId: number
}

export interface WhisperRelay {
  authorId: number
  authorLabel: string
  recipientId: number
}

export type EphemeralSend = (base: { chat_id: number, receiver_user_id: number }) => Promise<ApiResponseError | TelegramMessage>
