import type { ApiResponseError, TelegramMessage } from 'puregram'

export interface ChatCapability {
  admin: boolean
  canDelete: boolean
}

export interface RedisMessage {
  message: string
  once?: boolean
  readAt?: number
  username?: string
  userId?: number
  senderId: number
}

export interface SealedRecord {
  readAt?: number
  sealed: string
}

export type Target = Pick<RedisMessage, 'userId' | 'username'>

export interface WhisperRelay {
  authorId: number
  authorLabel: string
  recipientId: number
}

export type DeliveryResult =
  | { description: string, ok: false }
  | { ok: true }

export type RelayResolution =
  | { kind: 'ambiguous' }
  | { kind: 'none' }
  | { kind: 'record', record: WhisperRelay }

export type EphemeralSend = (base: { chat_id: number, receiver_user_id: number }) => Promise<ApiResponseError | TelegramMessage>
