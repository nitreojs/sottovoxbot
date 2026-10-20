import type { MessageUpdate } from 'puregram'

import { WHISPER_TRIGGER } from '../constants.js'
import { BotService, UserService } from '../services/index.js'
import { handleHelp } from './help.js'
import { handleRelay } from './relay.js'
import { handleWhisperCommand } from './whisper.js'

export const handleMessage = async (update: MessageUpdate) => {
  UserService.learn(update.from).catch(() => {})

  if (update.replyToMessage?.from !== undefined) {
    UserService.learn(update.replyToMessage.from).catch(() => {})
  }

  const content = update.text ?? update.caption

  if (content !== undefined) {
    const match = content.match(WHISPER_TRIGGER)

    if (match !== null) {
      const mention = match.groups?.mention

      if (mention === undefined || BotService.owns(mention)) {
        return handleWhisperCommand(update, match.groups?.rest?.trim())
      }
    }
  }

  if (update.isEphemeral() && !content?.startsWith('/')) {
    return handleRelay(update)
  }

  if (update.chat.type === 'private') {
    return handleHelp(update)
  }
}
