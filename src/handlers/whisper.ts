import type { Formattable, MessageUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { EPHEMERAL_REPLY_WINDOW_SECONDS } from '../constants.js'
import { ChatService, WhisperService } from '../services/index.js'
import { telegram } from '../shared/index.js'
import { deliveryHint, hasWhisperMedia, labelOf, parseWhisper, whisperSenderOf } from '../utils/index.js'
import { handleRecipientRequest } from './picker.js'

export const handleWhisperCommand = async (update: MessageUpdate, rest?: string) => {
  if (update.chat.type === 'private') {
    return handleRecipientRequest(update)
  }

  const capability = await ChatService.capability(update.chat.id)

  if (!capability.admin) {
    return update.reply('make me an admin here so i can deliver whispers privately.')
  }

  const senderId = update.senderId

  const notifySender = (text: Formattable | string) =>
    telegram.api.sendMessage({ chat_id: update.chat.id, receiver_user_id: senderId, suppress: true, text })

  const parsed = await parseWhisper(update, rest, hasWhisperMedia(update))

  if (!parsed.ok) {
    return notifySender(parsed.error)
  }

  const { recipient, text } = parsed
  const senderLabel = labelOf(update.from)

  const framed = html`🔒 <b>whisper from ${senderLabel}</b>${text ? `\n\n${text}` : ''}\n\n<i>reply within ${EPHEMERAL_REPLY_WINDOW_SECONDS}s to answer privately.</i>`
  const send = whisperSenderOf(update, framed)

  // the whisper is already in memory, so the command is scrubbed before delivery rather than after:
  // every round trip ordered ahead of the delete is another second the plaintext is readable by the chat
  const scrubbed = update.isEphemeral() || await update.delete().then(() => true).catch(() => false)

  const delivered = await WhisperService.deliver(update.chat.id, recipient.id, send, { id: senderId, label: senderLabel })

  if (!delivered.ok) {
    const hint = deliveryHint(delivered.description)

    // the command is gone by now, so the text goes back to its author rather than being lost with it
    return notifySender(text ? html`${hint}\n\nhere it is back:\n<code>${text}</code>` : hint)
  }

  if (!scrubbed) {
    return notifySender(html`✅ whispered to ${recipient.label}.\n\n⚠️ i could not delete your command, so everyone can still read it — give me the <b>delete messages</b> right.`)
  }

  return notifySender(html`✅ whispered to ${recipient.label}.`)
}
