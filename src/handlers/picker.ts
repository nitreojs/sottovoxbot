import type { MessageUpdate, UsersSharedUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { InlineKeyboard, Keyboard } from 'puregram'

import { ICON } from '../constants.js'
import { UserService } from '../services/index.js'

const REQUEST_ID = 1

export const handleRecipientRequest = (update: MessageUpdate) =>
  update.send('who do you want to whisper to? pick them below — this works even if they have no @username.', {
    reply_markup: Keyboard.keyboard([
      Keyboard.requestUsersButton('pick a recipient', {
        iconCustomEmojiId: ICON.personAdd,
        request_id: REQUEST_ID,
        request_name: true,
        request_username: true,
        user_is_bot: false
      })
    ]).resize().oneTime()
  })

export const handleUsersShared = async (update: UsersSharedUpdate) => {
  const [shared] = update.usersShared?.users ?? []

  if (shared === undefined) {
    return
  }

  await UserService.learn({ id: shared.user_id, username: shared.username }).catch(() => {})

  const label = shared.username === undefined ? (shared.first_name ?? `user ${shared.user_id}`) : `@${shared.username}`

  return update.send(html`✅ <b>${label}</b> it is. now pick the chat to whisper in — i'll fill the recipient in for you, just type your message after it.`, {
    reply_markup: InlineKeyboard.keyboard([
      InlineKeyboard.switchToChosenChatButton({
        allowBotChats: false,
        allowChannelChats: false,
        allowGroupChats: true,
        allowUserChats: true,
        query: `id:${shared.user_id} `,
        iconCustomEmojiId: ICON.pencil,
        text: `whisper to ${label}`
      })
    ])
  })
}
