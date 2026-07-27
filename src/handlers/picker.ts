import type { MessageUpdate, UsersSharedUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { InlineKeyboard, Keyboard } from 'puregram'

import { UserService } from '../services/index.js'

// telegram only offers the native user picker in private chats, and it hands back real ids —
// which is what makes it the one way to address someone who has no @username at all
const REQUEST_ID = 1

export const handleRecipientRequest = (update: MessageUpdate) =>
  update.send('who do you want to whisper to? pick them below — this works even if they have no @username.', {
    reply_markup: Keyboard.keyboard([
      Keyboard.requestUsersButton('👤 pick a recipient', {
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

  // the picker is authoritative about the id/username pair, so the cache learns from it too
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
        text: `✍️ whisper to ${label}`
      })
    ])
  })
}
