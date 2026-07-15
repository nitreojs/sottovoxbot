import type { MessageUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { EPHEMERAL_REPLY_WINDOW_SECONDS } from '../constants.js'
import { WhisperService } from '../services/index.js'
import { telegram } from '../shared/index.js'
import { hasWhisperMedia, labelOf, whisperSenderOf } from '../utils/index.js'

export const handleRelay = async (update: MessageUpdate) => {
  const content = update.text ?? update.caption

  if (content === undefined && !hasWhisperMedia(update)) {
    return
  }

  const record = await WhisperService.resolveReply(
    update.chat.id,
    update.senderId,
    update.replyToMessage?.ephemeralMessageId
  )

  if (record === undefined) {
    return
  }

  const replierLabel = labelOf(update.from)

  const framed = html`↩️ <b>${replierLabel} replied</b>${content ? `\n\n${content}` : ''}\n\n<i>reply within ${EPHEMERAL_REPLY_WINDOW_SECONDS}s to continue.</i>`

  const delivered = await WhisperService.deliver(update.chat.id, record.authorId, whisperSenderOf(update, framed), { id: update.senderId, label: replierLabel })

  const note = delivered
    ? html`✅ replied back to ${record.authorLabel}.`
    : html`couldn't deliver your reply — ${record.authorLabel} may be offline.`

  await telegram.api.sendMessage({ chat_id: update.chat.id, receiver_user_id: update.senderId, suppress: true, text: note })
}
