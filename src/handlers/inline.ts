import type { Formattable, InlineQueryUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { randomBytes } from 'crypto'
import { InlineKeyboard, InlineQueryResult, InputMessageContent } from 'puregram'

import { ALERT_TEXT_LIMIT } from '../constants.js'
import { UserService, WhisperService } from '../services/index.js'
import { RedisMessage } from '../types.js'
import { parseTargetedQuery, targetLabel, targetMention } from '../utils/index.js'

const FORMAT = html`message format should be like this: <code>@sottovoxbot @username message</code> or <code>@sottovoxbot id:123456789 message</code>`

export const handleInlineQuery = async (update: InlineQueryUpdate) => {
  UserService.learn(update.from).catch(() => {})

  const button = InlineQueryResult.button('how to whisper?', {
    startParameter: 'how'
  })

  const hint = (title: string, description: string, content: Formattable = FORMAT) =>
    update.answer({
      button,
      cache_time: 0,
      is_personal: true,
      results: [
        InlineQueryResult.article({
          content: InputMessageContent.text(content),
          description,
          id: randomBytes(16).toString('hex'),
          title
        })
      ]
    })

  if (!update.query) {
    return update.answer({ button, cache_time: 0, is_personal: true, results: [] })
  }

  const parsed = await parseTargetedQuery(update.query)

  if (parsed === undefined) {
    return hint('whisper', 'name the recipient first: @username or id:123456789')
  }

  const { message, target } = parsed
  const recipientLabel = targetLabel(target)

  if (!message) {
    return hint(`🔒 whisper to ${recipientLabel}`, 'now type your message')
  }

  if (message.length > ALERT_TEXT_LIMIT) {
    return hint(
      '⚠️ whisper is too long',
      `too long by ${message.length - ALERT_TEXT_LIMIT} characters — the popup only fits ${ALERT_TEXT_LIMIT}.`,
      html`a whisper is shown in a popup, so it can not be longer than ${ALERT_TEXT_LIMIT} characters. yours is ${message.length}.`
    )
  }

  const recipientMention = targetMention(target)

  const description = target.userId === undefined
    ? `i have not seen @${target.username} yet, so i will match them by their @username.`
    : 'only they can open it.'

  const payload: RedisMessage = {
    ...target,
    message,
    senderId: update.from.id
  }

  // the returned material is the decryption key; it exists only in the button from here on
  const [key, onceKey] = await Promise.all([
    WhisperService.saveInline(payload),
    WhisperService.saveInline({ ...payload, once: true })
  ])

  return update.answer({
    button,
    cache_time: 0,
    is_personal: true,
    results: [
      InlineQueryResult.article({
        content: InputMessageContent.text(html`🔒 a whisper message to ${recipientMention}`),
        description,
        id: randomBytes(16).toString('hex'),
        replyMarkup: InlineKeyboard.keyboard([
          InlineKeyboard.textButton({
            payload: key,
            text: 'show message 🔐'
          })
        ]),
        title: `🔒 whisper to ${recipientLabel}`
      }),
      InlineQueryResult.article({
        content: InputMessageContent.text(html`🔥 a one-time whisper to ${recipientMention}`),
        description: `${description} it burns once they read it.`,
        id: randomBytes(16).toString('hex'),
        replyMarkup: InlineKeyboard.keyboard([
          InlineKeyboard.textButton({
            payload: onceKey,
            text: 'read once 🔥'
          })
        ]),
        title: `🔥 one-time whisper to ${recipientLabel}`
      })
    ]
  })
}
