import type { MessageUpdate, UsersSharedUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { InlineKeyboard, Keyboard } from 'puregram'

import { ICON, MAX_TARGETS } from '../constants.js'
import { UserService } from '../services/index.js'
import { listLabel } from '../utils/index.js'

const REQUEST_ID = 1

export const handleRecipientRequest = (update: MessageUpdate) =>
  update.send(`who do you want to whisper to? pick up to ${MAX_TARGETS} people below — this works even if they have no @username.`, {
    reply_markup: Keyboard.keyboard([
      Keyboard.requestUsersButton('pick recipients', {
        iconCustomEmojiId: ICON.personAdd,
        max_quantity: MAX_TARGETS,
        request_id: REQUEST_ID,
        request_name: true,
        request_username: true,
        user_is_bot: false
      })
    ]).resize().oneTime()
  })

export const handleUsersShared = async (update: UsersSharedUpdate) => {
  const users = update.usersShared?.users ?? []

  if (users.length === 0) {
    return
  }

  await Promise.all(users.map((shared) => UserService.learn({ id: shared.user_id, username: shared.username }))).catch(() => {})

  const labels = users.map((shared) => shared.username === undefined ? (shared.first_name ?? `user ${shared.user_id}`) : `@${shared.username}`)

  return update.send(html`✅ <b>${labels.join(', ')}</b> it is. now pick the chat to whisper in — i'll fill ${users.length === 1 ? 'the recipient' : 'them all'} in for you, just type your message after it.`, {
    reply_markup: InlineKeyboard.keyboard([
      InlineKeyboard.switchToChosenChatButton({
        allowBotChats: false,
        allowChannelChats: false,
        allowGroupChats: true,
        allowUserChats: true,
        query: `${users.map((shared) => `id:${shared.user_id}`).join(' ')} `,
        iconCustomEmojiId: ICON.pencil,
        text: `whisper to ${listLabel(labels)}`
      })
    ])
  })
}
