import { Color, Logger } from '@starkow/logger'
import { stripIndent } from 'common-tags'
import { randomBytes } from 'crypto'
import { InlineKeyboard, InlineQueryResult, InputMessageContent, Telegram } from 'puregram'

import { Env } from './env'
import { redis } from './shared'
import { RedisMessage } from './types'

const telegram = Telegram.fromToken(Env.TOKEN)

telegram.updates.on('message', (context) => {
  if (!context.isPM()) {
    return
  }

  return context.send(
    stripIndent`
      hi! i'm @sottovoxbot. with me you can send a private message in the <b>chat</b> (also called "whispering") to a certain user and no one except them will be able to read it.

      <b>how?</b> in the group, type @sottovoxbot message @username (or user id) and click on the button that appears.

      <b>example</b>: <code>@sottovoxbot hello! how are you doing? @starkow</code> or <code>@sottovoxbot hello! 398859857</code>
    `,
    { parse_mode: 'html' }
  )
})

telegram.updates.on('callback_query', async (context) => {
  if (!context.hasQueryPayload()) {
    return
  }

  const result = await redis.get(`whisper:${context.queryPayload}`)

  if (!result) {
    return context.answer()
  }

  const { message, username, userId, senderId } = JSON.parse(result) as RedisMessage

  const isRecipient =
    context.senderId === senderId ||
    (userId !== undefined && context.senderId === userId) ||
    (username !== undefined && context.from.username?.toLowerCase() === username.toLowerCase())

  if (!isRecipient) {
    return context.answer({
      show_alert: true,
      text: '🔒 sorry, but this whisper is not for you. you can not read it.'
    })
  }

  return context.answer({
    show_alert: true,
    text: message
  })
})

telegram.updates.on('inline_query', async (context) => {
  const button = InlineQueryResult.button('how to whisper?', {
    start_parameter: 'how'
  })

  if (!context.query) {
    return context.answer([], { button, cache_time: 0, is_personal: true })
  }

  const match = context.query.match(/(?<message>.+)\s+(?:@(?<username>\w+)|(?<userId>\d+))$/)

  if (!match) {
    return context.answer([
      InlineQueryResult.article({
        id: randomBytes(16).toString('hex'),
        title: 'whisper',
        description: stripIndent`
          message format should be like this:
          @sottovoxbot message @username (or user id)
        `,
        input_message_content: InputMessageContent.text('message format should be like this: <code>@sottovoxbot message @username</code> or <code>@sottovoxbot message 123456789</code>', {
          parse_mode: 'html'
        })
      })
    ], { button, cache_time: 0, is_personal: true })
  }

  const { message, username, userId } = match!.groups!

  const recipientUserId = userId ? Number(userId) : undefined
  const recipientLabel = username ? `@${username}` : `user ${recipientUserId}`
  const recipientMention = username ? `@${username}` : `<a href="tg://user?id=${recipientUserId}">user</a> id=${recipientUserId}`

  const resultId = randomBytes(16).toString('hex')

  const payload: RedisMessage = {
    message,
    senderId: context.senderId,
    username,
    userId: recipientUserId
  }

  await redis.set(`whisper:${resultId}`, JSON.stringify(payload), 'EX', 10_800 /* 3 hours */)

  return context.answer([
    InlineQueryResult.article({
      id: resultId,
      title: `🔒 whisper to ${recipientLabel}`,
      description: 'only they can open it.',
      input_message_content: InputMessageContent.text(`🔒 a whisper message to ${recipientMention}`, {
        parse_mode: 'html'
      }),
      reply_markup: InlineKeyboard.keyboard([
        InlineKeyboard.textButton({
          text: 'show message 🔐',
          payload: resultId
        })
      ])
    })
  ], { button, cache_time: 0, is_personal: true })
})

const main = async () => {
  await telegram.updates.startPolling()

  Logger.create(`@${telegram.bot.username}`)('started')
}

main().catch(Logger.create('error!', Color.Red).error)
