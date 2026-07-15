import type { InlineQueryUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { randomBytes } from 'crypto'
import { InlineKeyboard, InlineQueryResult, InputMessageContent } from 'puregram'

import { UserService, WhisperService } from '../services/index.js'
import { RedisMessage } from '../types.js'

export const handleInlineQuery = async (update: InlineQueryUpdate) => {
  UserService.learn(update.from).catch(() => {})

  const button = InlineQueryResult.button('how to whisper?', {
    startParameter: 'how'
  })

  if (!update.query) {
    return update.answer({ button, cache_time: 0, is_personal: true, results: [] })
  }

  const match = update.query.match(/(?<message>.+)\s+(?:@(?<username>\w+)|(?<userId>\d+))$/)

  if (!match) {
    return update.answer({
      button,
      cache_time: 0,
      is_personal: true,
      results: [
        InlineQueryResult.article({
          content: InputMessageContent.text(html`message format should be like this: <code>@sottovoxbot message @username</code> or <code>@sottovoxbot message 123456789</code>`),
          description: 'message format should be like this:\n@sottovoxbot message @username (or user id)',
          id: randomBytes(16).toString('hex'),
          title: 'whisper'
        })
      ]
    })
  }

  const { message, userId, username } = match.groups!

  const recipientUserId = userId ? Number(userId) : undefined
  const recipientLabel = username ? `@${username}` : `user ${recipientUserId}`
  const recipientMention = username
    ? `@${username}`
    : html`<a href="tg://user?id=${recipientUserId}">user</a> id=${recipientUserId}`

  const resultId = randomBytes(16).toString('hex')

  const payload: RedisMessage = {
    message,
    senderId: update.from.id,
    userId: recipientUserId,
    username
  }

  await WhisperService.saveInline(resultId, payload)

  return update.answer({
    button,
    cache_time: 0,
    is_personal: true,
    results: [
      InlineQueryResult.article({
        content: InputMessageContent.text(html`🔒 a whisper message to ${recipientMention}`),
        description: 'only they can open it.',
        id: resultId,
        replyMarkup: InlineKeyboard.keyboard([
          InlineKeyboard.textButton({
            payload: resultId,
            text: 'show message 🔐'
          })
        ]),
        title: `🔒 whisper to ${recipientLabel}`
      })
    ]
  })
}
