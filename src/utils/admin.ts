import { Telegram } from 'puregram'

import { telegram } from '../shared/index.js'

export const isBotAdmin = async (chatId: number): Promise<boolean> => {
  const member = await telegram.api.getChatMember({
    chat_id: chatId,
    user_id: telegram.bot.id,
    suppress: true
  })

  if (Telegram.isErrorResponse(member)) {
    return false
  }

  return member.status === 'administrator'
}
