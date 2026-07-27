import { Telegram } from 'puregram'

import { KEY, TTL } from '../constants.js'
import { redis } from '../shared/index.js'
import { DeliveryResult, EphemeralSend, RedisMessage, RelayResolution, SealedRecord, Target, WhisperRelay } from '../types.js'
import { lookupOf, seal, unseal } from '../utils/envelope.js'

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

    return lookup !== undefined && await redis.del(KEY.inlineWhisper(lookup)) === 1
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

    // read state lives outside the envelope so marking a whisper read never touches its ciphertext
    return payload === undefined ? undefined : { ...payload, readAt: stored.record.readAt }
  }

  // the last person this sender whispered, so a query that names nobody still has a candidate
  static async lastTarget (senderId: number): Promise<Target | undefined> {
    const raw = await redis.get(KEY.lastTarget(senderId))

    return raw === null ? undefined : JSON.parse(raw) as Target
  }

  static async markRead (material: string) {
    const stored = await WhisperService.sealedOf(material)

    if (stored === undefined || stored.record.readAt !== undefined) {
      return
    }

    stored.record.readAt = Math.floor(Date.now() / 1000)

    await redis.set(KEY.inlineWhisper(stored.lookup), JSON.stringify(stored.record), 'KEEPTTL')
  }

  // a draft only earns the full lifetime once it has actually been sent; expire never shortens,
  // so calling this on an already-promoted record is harmless
  static async promote (lookup: string) {
    await redis.expire(KEY.inlineWhisper(lookup), TTL.inlineWhisper)
  }

  static async promoteMaterial (material: string) {
    const lookup = lookupOf(material)

    if (lookup !== undefined) {
      await WhisperService.promote(lookup)
    }
  }

  static async remember (chatId: number, ephemeralMessageId: number, record: WhisperRelay) {
    const candidates = KEY.relayCandidates(chatId, record.recipientId)

    await Promise.all([
      redis.set(KEY.relay(chatId, ephemeralMessageId), JSON.stringify(record), 'EX', TTL.relay),
      redis.sadd(candidates, String(ephemeralMessageId)),
      redis.expire(candidates, TTL.relay)
    ])
  }

  static async rememberTarget (senderId: number, target: Target) {
    await redis.set(KEY.lastTarget(senderId), JSON.stringify(target), 'EX', TTL.lastTarget)
  }

  static async resolveReply (chatId: number, replierId: number, ephemeralMessageId?: number): Promise<RelayResolution> {
    if (ephemeralMessageId !== undefined) {
      const record = await WhisperService.relayOf(chatId, ephemeralMessageId)

      return record === undefined ? { kind: 'none' } : { kind: 'record', record }
    }

    // without the reply's own ephemeral id, only a single open whisper identifies itself; picking
    // between several by recency would hand a private reply to someone who was never part of it
    const candidates = await redis.smembers(KEY.relayCandidates(chatId, replierId))
    const records = await Promise.all(candidates.map(candidate => WhisperService.relayOf(chatId, Number(candidate))))
    const live = records.filter(record => record !== undefined)

    if (live.length === 1) {
      return { kind: 'record', record: live[0]! }
    }

    return live.length === 0 ? { kind: 'none' } : { kind: 'ambiguous' }
  }

  // the material is the only copy of the key and goes into the button; the lookup is safe to hand
  // telegram as the result id, which is how chosen_inline_result later tells us this one was sent
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
