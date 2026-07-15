import { Telegram } from 'puregram'

import { KEY, TTL } from '../constants.js'
import { redis } from '../shared/index.js'
import { EphemeralSend, RedisMessage, WhisperRelay } from '../types.js'

interface WhisperAuthor {
  id: number
  label: string
}

export class WhisperService {
  static async deliver (chatId: number, recipientId: number, send: EphemeralSend, author: WhisperAuthor): Promise<boolean> {
    const sent = await send({ chat_id: chatId, receiver_user_id: recipientId })

    if (Telegram.isErrorResponse(sent)) {
      return false
    }

    if (sent.ephemeral_message_id !== undefined) {
      await WhisperService.remember(chatId, sent.ephemeral_message_id, { authorId: author.id, authorLabel: author.label, recipientId })
    }

    return true
  }

  static async getInline (id: string): Promise<RedisMessage | undefined> {
    const raw = await redis.get(KEY.inlineWhisper(id))

    return raw === null ? undefined : JSON.parse(raw) as RedisMessage
  }

  static async remember (chatId: number, ephemeralMessageId: number, record: WhisperRelay) {
    const payload = JSON.stringify(record)

    await Promise.all([
      redis.set(KEY.relay(chatId, ephemeralMessageId), payload, 'EX', TTL.relay),
      redis.set(KEY.lastWhisper(chatId, record.recipientId), String(ephemeralMessageId), 'EX', TTL.relay)
    ])
  }

  static async resolveReply (chatId: number, replierId: number, ephemeralMessageId?: number): Promise<WhisperRelay | undefined> {
    const ids: number[] = []

    if (ephemeralMessageId !== undefined) {
      ids.push(ephemeralMessageId)
    }

    const last = await redis.get(KEY.lastWhisper(chatId, replierId))

    if (last !== null) {
      ids.push(Number(last))
    }

    for (const id of ids) {
      const raw = await redis.get(KEY.relay(chatId, id))

      if (raw !== null) {
        return JSON.parse(raw) as WhisperRelay
      }
    }

    return undefined
  }

  static async saveInline (id: string, payload: RedisMessage) {
    await redis.set(KEY.inlineWhisper(id), JSON.stringify(payload), 'EX', TTL.inlineWhisper)
  }
}
