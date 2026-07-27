import { Telegram } from 'puregram'

import { KEY, TTL } from '../constants.js'
import { redis, telegram } from '../shared/index.js'
import { ChatCapability } from '../types.js'

export class ChatService {
  static async capability (chatId: number): Promise<ChatCapability> {
    const raw = await redis.get(KEY.capability(chatId))

    if (raw !== null) {
      return JSON.parse(raw) as ChatCapability
    }

    const member = await telegram.api.getChatMember({
      chat_id: chatId,
      suppress: true,
      user_id: telegram.bot.id
    })

    const capability = Telegram.isErrorResponse(member)
      ? { admin: false, canDelete: false }
      : ChatService.of(member.status, member.status === 'administrator' && member.can_delete_messages)

    await ChatService.remember(chatId, capability)

    return capability
  }

  static of (status: string, canDelete: boolean): ChatCapability {
    return { admin: status === 'administrator', canDelete: status === 'administrator' && canDelete }
  }

  static async remember (chatId: number, capability: ChatCapability) {
    await redis.set(KEY.capability(chatId), JSON.stringify(capability), 'EX', TTL.capability)
  }
}
