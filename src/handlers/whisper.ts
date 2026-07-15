import type { Formattable, MessageUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { EPHEMERAL_REPLY_WINDOW_SECONDS } from '../constants.js'
import { WhisperService } from '../services/index.js'
import { telegram } from '../shared/index.js'
import { hasWhisperMedia, isBotAdmin, labelOf, parseWhisper, whisperSenderOf } from '../utils/index.js'

export const handleWhisperCommand = async (update: MessageUpdate, rest?: string) => {
  if (update.chat.type === 'private') {
    return update.send('whispering works in groups where i\'m an admin. add me to one first!')
  }

  if (!(await isBotAdmin(update.chat.id))) {
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

  const delivered = await WhisperService.deliver(update.chat.id, recipient.id, whisperSenderOf(update, framed), { id: senderId, label: senderLabel })

  // if the client didn't send the command ephemerally, scrub it so the secret isn't left in the open
  if (!update.isEphemeral()) {
    await update.delete().catch(() => {})
  }

  if (!delivered) {
    return notifySender('couldn\'t deliver — the recipient may be offline or has never been active in a group with me.')
  }

  return notifySender(html`✅ whispered to ${recipient.label}.`)
}
