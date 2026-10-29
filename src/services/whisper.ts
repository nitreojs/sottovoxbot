import { Telegram } from 'puregram'

import { KEY, TTL } from '../constants.js'
import { redis } from '../shared/index.js'
import { Audience, DeliveryResult, EphemeralSend, RedisMessage, RelayResolution, SealedRecord, WhisperRelay } from '../types.js'
import { lookupOf, readerTagOf, seal, unseal } from '../utils/envelope.js'

interface WhisperAuthor {
  id: number
  label: string
}

export class WhisperService {
  static async armRecall (material: string) {
    const lookup = lookupOf(material)

    if (lookup !== undefined) {
      await redis.set(KEY.pendingRecall(lookup), '1', 'EX', TTL.recall)
    }
  }

  static async burnInline (material: string): Promise<boolean> {
    const lookup = lookupOf(material)

    if (lookup === undefined) {
      return false
    }

    const [burnt] = await Promise.all([
      redis.del(KEY.inlineWhisper(lookup)),
      redis.del(KEY.inlineReaders(lookup))
    ])

    return burnt === 1
  }

  static async deliver (chatId: number, recipientId: number, send: EphemeralSend, author: WhisperAuthor): Promise<DeliveryResult> {
    const sent = await send({ chat_id: chatId, receiver_user_id: recipientId })

    if (Telegram.isErrorResponse(sent)) {
      return { description: sent.description, ok: false }
    }

    if (sent.ephemeral_message_id !== undefined) {
      await WhisperService.remember(chatId, sent.ephemeral_message_id, { authorId: author.id, authorLabel: author.label, recipientId })
    }

    return { ok: true }
  }

  static async disarmRecall (material: string): Promise<boolean> {
    const lookup = lookupOf(material)

    return lookup !== undefined && await redis.del(KEY.pendingRecall(lookup)) === 1
  }

  static async getInline (material: string): Promise<RedisMessage | undefined> {
    const stored = await WhisperService.sealedOf(material)

    if (stored === undefined) {
      return undefined
    }

    const payload = unseal<RedisMessage>(material, stored.record.sealed)

    return payload === undefined ? undefined : { ...payload, readAt: stored.record.readAt }
  }

  static async hasRead (material: string, readerId: number): Promise<boolean> {
    const lookup = lookupOf(material)
    const tag = readerTagOf(material, readerId)

    return lookup !== undefined && tag !== undefined && await redis.sismember(KEY.inlineReaders(lookup), tag) === 1
  }

  static async lastAudience (senderId: number): Promise<Audience | undefined> {
    const raw = await redis.get(KEY.lastAudience(senderId))

    return raw === null ? undefined : JSON.parse(raw) as Audience
  }

  static async markRead (material: string, readerId: number): Promise<number> {
    const stored = await WhisperService.sealedOf(material)
    const tag = readerTagOf(material, readerId)

    if (stored === undefined || tag === undefined) {
      return 0
    }

    const readers = KEY.inlineReaders(stored.lookup)
    const counted = await redis.multi().sadd(readers, tag).expire(readers, TTL.inlineWhisper).scard(readers).exec()

    if (stored.record.readAt === undefined) {
      stored.record.readAt = Math.floor(Date.now() / 1000)

      await redis.set(KEY.inlineWhisper(stored.lookup), JSON.stringify(stored.record), 'KEEPTTL')
    }

    return Number(counted?.[2]?.[1] ?? 0)
  }

  static async promote (lookup: string) {
    await redis.expire(KEY.inlineWhisper(lookup), TTL.inlineWhisper)
  }

  static async promoteMaterial (material: string) {
    const lookup = lookupOf(material)

    if (lookup !== undefined) {
      await WhisperService.promote(lookup)
    }
  }

  static async readerCount (material: string): Promise<number> {
    const lookup = lookupOf(material)

    return lookup === undefined ? 0 : redis.scard(KEY.inlineReaders(lookup))
  }

  static async remember (chatId: number, ephemeralMessageId: number, record: WhisperRelay) {
    const candidates = KEY.relayCandidates(chatId, record.recipientId)

    await Promise.all([
      redis.set(KEY.relay(chatId, ephemeralMessageId), JSON.stringify(record), 'EX', TTL.relay),
      redis.sadd(candidates, String(ephemeralMessageId)),
      redis.expire(candidates, TTL.relay)
    ])
  }

  static async rememberAudience (senderId: number, audience: Audience) {
    await redis.set(KEY.lastAudience(senderId), JSON.stringify(audience), 'EX', TTL.lastAudience)
  }

  static async resolveReply (chatId: number, replierId: number, ephemeralMessageId?: number): Promise<RelayResolution> {
    if (ephemeralMessageId !== undefined) {
      const record = await WhisperService.relayOf(chatId, ephemeralMessageId)

      return record === undefined ? { kind: 'none' } : { kind: 'record', record }
    }

    const candidates = await redis.smembers(KEY.relayCandidates(chatId, replierId))
    const records = await Promise.all(candidates.map(candidate => WhisperService.relayOf(chatId, Number(candidate))))
    const live = records.filter(record => record !== undefined)

    if (live.length === 1) {
      return { kind: 'record', record: live[0]! }
    }

    return live.length === 0 ? { kind: 'none' } : { kind: 'ambiguous' }
  }

  static async saveInline (payload: RedisMessage): Promise<{ lookup: string, material: string }> {
    const { lookup, material, sealed } = seal(payload)

    await redis.set(KEY.inlineWhisper(lookup), JSON.stringify({ sealed }), 'EX', TTL.draft)

    return { lookup, material }
  }

  private static async relayOf (chatId: number, ephemeralMessageId: number): Promise<undefined | WhisperRelay> {
    const raw = await redis.get(KEY.relay(chatId, ephemeralMessageId))

    return raw === null ? undefined : JSON.parse(raw) as WhisperRelay
  }

  private static async sealedOf (material: string): Promise<undefined | { lookup: string, record: SealedRecord }> {
    const lookup = lookupOf(material)

    if (lookup === undefined) {
      return undefined
    }

    const raw = await redis.get(KEY.inlineWhisper(lookup))

    return raw === null ? undefined : { lookup, record: JSON.parse(raw) as SealedRecord }
  }
}
