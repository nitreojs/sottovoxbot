import { html, markup } from '@puregram/markup'
import { Color, Logger } from '@starkow/logger'
import { randomBytes } from 'crypto'
import { InlineKeyboard, InlineQueryResult, InputMessageContent, Telegram } from 'puregram'

import { Env } from './env.js'
import { redis } from './shared/index.js'
import { RedisMessage } from './types.js'

const telegram = Telegram.fromToken(Env.TOKEN).extend(markup())

telegram.onMessage((update) => {
  if (update.chat.type !== 'private') {
    return
  }

  return update.send(html`hi! i'm @sottovoxbot. with me you can send a private message in the <b>chat</b> (also called "whispering") to a certain user and no one except them will be able to read it.

<b>how?</b> in the group, type @sottovoxbot message @username (or user id) and click on the button that appears.

<b>example</b>: <code>@sottovoxbot hello! how are you doing? @starkow</code> or <code>@sottovoxbot hello! 398859857</code>`)
})

telegram.onCallbackQuery(async (update) => {
  if (!update.hasData()) {
    return
  }

  const result = await redis.get(`whisper:${update.data}`)

  if (!result) {
    return update.answer()
  }

  const { message, username, userId, senderId } = JSON.parse(result) as RedisMessage

  const isRecipient =
    update.from.id === senderId ||
    (userId !== undefined && update.from.id === userId) ||
    (username !== undefined && update.from.username?.toLowerCase() === username.toLowerCase())

  if (!isRecipient) {
    return update.answer({
      show_alert: true,
      text: '🔒 sorry, but this whisper is not for you. you can not read it.'
    })
  }

  return update.answer({
    show_alert: true,
    text: message
  })
})

telegram.onInlineQuery(async (update) => {
  const button = InlineQueryResult.button('how to whisper?', {
    startParameter: 'how'
  })

  if (!update.query) {
    return update.answer({ results: [], button, cache_time: 0, is_personal: true })
  }

  const match = update.query.match(/(?<message>.+)\s+(?:@(?<username>\w+)|(?<userId>\d+))$/)

  if (!match) {
    return update.answer({
      results: [
        InlineQueryResult.article({
          id: randomBytes(16).toString('hex'),
          title: 'whisper',
          description: 'message format should be like this:\n@sottovoxbot message @username (or user id)',
          content: InputMessageContent.text(html`message format should be like this: <code>@sottovoxbot message @username</code> or <code>@sottovoxbot message 123456789</code>`)
        })
      ],
      button,
      cache_time: 0,
      is_personal: true
    })
  }

  const { message, username, userId } = match.groups!

  const recipientUserId = userId ? Number(userId) : undefined
  const recipientLabel = username ? `@${username}` : `user ${recipientUserId}`
  const recipientMention = username
    ? `@${username}`
    : html`<a href="tg://user?id=${recipientUserId}">user</a> id=${recipientUserId}`

  const resultId = randomBytes(16).toString('hex')

  const payload: RedisMessage = {
    message,
    senderId: update.from.id,
    username,
    userId: recipientUserId
  }

  await redis.set(`whisper:${resultId}`, JSON.stringify(payload), 'EX', 10_800 /* 3 hours */)

  return update.answer({
    results: [
      InlineQueryResult.article({
        id: resultId,
        title: `🔒 whisper to ${recipientLabel}`,
        description: 'only they can open it.',
        content: InputMessageContent.text(html`🔒 a whisper message to ${recipientMention}`),
        replyMarkup: InlineKeyboard.keyboard([
          InlineKeyboard.textButton({
            text: 'show message 🔐',
            payload: resultId
          })
        ])
      })
    ],
    button,
    cache_time: 0,
    is_personal: true
  })
})

const main = async () => {
  await telegram.startPolling()

  Logger.create(`@${telegram.bot.username}`)('started')
}

main().catch(Logger.create('error!', Color.Red).error)
