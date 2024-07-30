import { Color, Logger } from '@starkow/logger'
import { stripIndent } from 'common-tags'
import { randomBytes } from 'crypto'
import { InlineKeyboard, InlineQueryResult, InputMessageContent, Telegram } from 'puregram'

import { Env } from './env'
import { redis } from './shared'

const telegram = Telegram.fromToken(Env.TOKEN)

telegram.updates.on('message', (context) => {
  if (!context.isPM()) {
    return
  }

  return context.send(
    stripIndent`
      hi! i'm @sottovoxbot. with me you can send a private message in the <b>chat</b> (also called "whispering") to a certain user and no one except them will be able to read it.

      <b>how?</b> in the group, type @sottovoxbot message @username and click on the button that appears.

      <b>example</b>: <code>@sottovoxbot hello! how are you doing? @starkow</code>
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

  const { message, username, senderId } = JSON.parse(result)

  if (context.senderId !== senderId && context.from.username !== username) {
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

  const match = context.query.match(/(?<message>.+)\s+@(?<username>\w+)$/)

  if (!match) {
    return context.answer([
      InlineQueryResult.article({
        id: randomBytes(16).toString('hex'),
        title: 'whisper',
        description: stripIndent`
          message format should be like this:
          @sottovoxbot message @username
        `,
        input_message_content: InputMessageContent.text('message format should be like this: <code>@sottovoxbot message @username</code>', {
          parse_mode: 'html'
        })
      })
    ], { button, cache_time: 0, is_personal: true })
  }

  const { message, username } = match!.groups!

  const resultId = randomBytes(16).toString('hex')

  await redis.set(`whisper:${resultId}`, JSON.stringify({ message, username, senderId: context.senderId }), 'EX', 10_800 /* 3 hours */)

  return context.answer([
    InlineQueryResult.article({
      id: resultId,
      title: `🔒 whisper to @${username}`,
      description: 'only they can open it.',
      input_message_content: InputMessageContent.text(`🔒 a whisper message to @${username}`, {
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
