import type { CallbackQueryUpdate } from 'puregram'

import { WhisperService } from '../services/index.js'

export const handleCallbackQuery = async (update: CallbackQueryUpdate) => {
  if (!update.hasData()) {
    return
  }

  const result = await WhisperService.getInline(update.data)

  if (!result) {
    return update.answer()
  }

  const { message, senderId, userId, username } = result

  const isRecipient =
    update.from.id === senderId ||
    (userId !== undefined && update.from.id === userId) ||
    (username !== undefined && update.from.username?.toLowerCase() === username.toLowerCase())

  if (!isRecipient) {
    return update.answer({
      show_alert: true,
      text: '🔒 sorry, but this whisper is not for you. you can not read it.'
    })
  }

  return update.answer({
    show_alert: true,
    text: message
  })
}
