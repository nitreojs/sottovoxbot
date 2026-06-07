import { Color, Logger } from '@starkow/logger'
import { stripIndent } from 'common-tags'
import { randomBytes } from 'crypto'
import { InlineKeyboard, InlineQueryResult, InputMessageContent, Telegram } from 'puregram'

import { Env } from './env.js'
import { redis } from './shared/index.js'
import { RedisMessage } from './types.js'

const telegram = Telegram.fromToken(Env.TOKEN)

telegram.onMessage((message) => {
  if (message.chat.type !== 'private') {
    return
  }

  return message.send(
    stripIndent`
      hi! i'm @sottovoxbot. with me you can send a private message in the <b>chat</b> (also called "whispering") to a certain user and no one except them will be able to read it.

      <b>how?</b> in the group, type @sottovoxbot message @username (or user id) and click on the button that appears.

      <b>example</b>: <code>@sottovoxbot hello! how are you doing? @starkow</code> or <code>@sottovoxbot hello! 398859857</code>
    `,
    { parse_mode: 'html' }
  )
})

telegram.onCallbackQuery(async (callbackQuery) => {
  if (!callbackQuery.hasData()) {
    return
  }

  const result = await redis.get(`whisper:${callbackQuery.data}`)

  if (!result) {
    return callbackQuery.answer()
  }

  const { message, username, userId, senderId } = JSON.parse(result) as RedisMessage

  const isRecipient =
    callbackQuery.from.id === senderId ||
    (userId !== undefined && callbackQuery.from.id === userId) ||
    (username !== undefined && callbackQuery.from.username?.toLowerCase() === username.toLowerCase())

  if (!isRecipient) {
    return callbackQuery.answer({
      show_alert: true,
      text: '🔒 sorry, but this whisper is not for you. you can not read it.'
    })
  }

  return callbackQuery.answer({
    show_alert: true,
    text: message
  })
})

telegram.onInlineQuery(async (inlineQuery) => {
  const button = InlineQueryResult.button('how to whisper?', {
    startParameter: 'how'
  })

  if (!inlineQuery.query) {
    return inlineQuery.answer({ results: [], button, cache_time: 0, is_personal: true })
  }

  const match = inlineQuery.query.match(/(?<message>.+)\s+(?:@(?<username>\w+)|(?<userId>\d+))$/)

  if (!match) {
    return inlineQuery.answer({
      results: [
        InlineQueryResult.article({
          id: randomBytes(16).toString('hex'),
          title: 'whisper',
          description: stripIndent`
            message format should be like this:
            @sottovoxbot message @username (or user id)
          `,
          content: InputMessageContent.text('message format should be like this: <code>@sottovoxbot message @username</code> or <code>@sottovoxbot message 123456789</code>', {
            parseMode: 'html'
          })
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
  const recipientMention = username ? `@${username}` : `<a href="tg://user?id=${recipientUserId}">user</a> id=${recipientUserId}`

  const resultId = randomBytes(16).toString('hex')

  const payload: RedisMessage = {
    message,
    senderId: inlineQuery.from.id,
    username,
    userId: recipientUserId
  }

  await redis.set(`whisper:${resultId}`, JSON.stringify(payload), 'EX', 10_800 /* 3 hours */)

  return inlineQuery.answer({
    results: [
      InlineQueryResult.article({
        id: resultId,
        title: `🔒 whisper to ${recipientLabel}`,
        description: 'only they can open it.',
        content: InputMessageContent.text(`🔒 a whisper message to ${recipientMention}`, {
          parseMode: 'html'
        }),
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
