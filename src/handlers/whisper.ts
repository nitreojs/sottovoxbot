import type { Formattable, MessageUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { EPHEMERAL_REPLY_WINDOW_SECONDS } from '../constants.js'
import { ChatService, WhisperService } from '../services/index.js'
import { telegram } from '../shared/index.js'
import { deliveryHint, hasWhisperMedia, labelOf, parseWhisper, whisperSenderOf } from '../utils/index.js'
import { handleRecipientRequest } from './picker.js'

export const handleWhisperCommand = async (update: MessageUpdate) => {
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

  const parsed = await parseWhisper(update, hasWhisperMedia(update))

  if (!parsed.ok) {
    return notifySender(parsed.error)
  }

  const { recipients, text } = parsed
  const senderLabel = labelOf(update.from)

  // scrubbed before delivery: every round trip ahead of the delete leaves the plaintext readable
  const scrubbed = update.isEphemeral() || await update.delete().then(() => true).catch(() => false)

  const delivered: string[] = []
  const failures: string[] = []

  for (const recipient of recipients) {
    const others = recipients.filter((other) => other.id !== recipient.id).map((other) => other.label)
    const cc = others.length > 0 ? html`\n<i>also to ${others.join(', ')}</i>` : ''
    const framed = html`🔒 <b>whisper from ${senderLabel}</b>${cc}${text ? `\n\n${text}` : ''}\n\n<i>reply within ${EPHEMERAL_REPLY_WINDOW_SECONDS}s to answer privately.</i>`
    const result = await WhisperService.deliver(update.chat.id, recipient.id, whisperSenderOf(update, framed), { id: senderId, label: senderLabel })

    if (result.ok) {
      delivered.push(recipient.label)
    } else {
      failures.push(recipients.length === 1 ? deliveryHint(result.description) : `⚠️ ${recipient.label}: ${deliveryHint(result.description)}`)
    }
  }

  const failed = failures.join('\n')

  if (delivered.length === 0) {
    return notifySender(text ? html`${failed}\n\nhere it is back:\n<code>${text}</code>` : failed)
  }

  const warning = scrubbed ? '' : html`\n\n⚠️ i could not delete your command, so everyone can still read it — give me the <b>delete messages</b> right.`

  return notifySender(html`✅ whispered to ${delivered.join(', ')}.${failed ? `\n${failed}` : ''}${warning}`)
}
