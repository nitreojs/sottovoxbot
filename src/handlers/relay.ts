import type { Formattable, MessageUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { EPHEMERAL_REPLY_WINDOW_SECONDS } from '../constants.js'
import { WhisperService } from '../services/index.js'
import { telegram } from '../shared/index.js'
import { deliveryHint, hasWhisperMedia, labelOf, whisperSenderOf } from '../utils/index.js'

export const handleRelay = async (update: MessageUpdate) => {
  const content = update.text ?? update.caption

  if (content === undefined && !hasWhisperMedia(update)) {
    return
  }

  const notifyReplier = (text: Formattable | string) =>
    telegram.api.sendMessage({ chat_id: update.chat.id, receiver_user_id: update.senderId, suppress: true, text })

  const resolution = await WhisperService.resolveReply(
    update.chat.id,
    update.senderId,
    update.replyToMessage?.ephemeralMessageId
  )

  if (resolution.kind === 'none') {
    return
  }

  if (resolution.kind === 'ambiguous') {
    return notifyReplier('more than one whisper is open for you here — reply directly to the one you want to answer.')
  }

  const { record } = resolution
  const replierLabel = labelOf(update.from)

  const framed = html`↩️ <b>${replierLabel} replied</b>${content ? `\n\n${content}` : ''}\n\n<i>reply within ${EPHEMERAL_REPLY_WINDOW_SECONDS}s to continue.</i>`

  const delivered = await WhisperService.deliver(update.chat.id, record.authorId, whisperSenderOf(update, framed), { id: update.senderId, label: replierLabel })

  await notifyReplier(
    delivered.ok
      ? html`✅ replied back to ${record.authorLabel}.`
      : deliveryHint(delivered.description)
  )
}
