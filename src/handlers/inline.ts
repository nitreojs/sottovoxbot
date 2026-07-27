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

  const context = { senderId: update.from.id, senderUsername: update.from.username }

  if (!update.query) {
    const recent = await WhisperService.lastTarget(context.senderId)

    return recent === undefined
      ? update.answer({ button, cache_time: 0, is_personal: true, results: [] })
      : hint(`🔒 whisper to ${targetLabel(recent)}`, 'the last person you whispered — now type your message')
  }

  const parsed = await parseTargetedQuery(update.query, context)

  // naming nobody is not a mistake once you've whispered before: the message is the whole query
  // and the recipient is whoever you last picked, spelled out in the title before you tap it
  const target = parsed?.target ?? await WhisperService.lastTarget(context.senderId)

  if (target === undefined) {
    return hint('whisper', 'name the recipient first: @username or id:123456789')
  }

  const sticky = parsed === undefined
  const message = parsed?.message ?? update.query.trim()
  const recipientLabel = `${targetLabel(target)}${sticky ? ' (last)' : ''}`

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
    : sticky
      ? 'the last person you whispered — name someone else to change that.'
      : 'only they can open it.'

  const payload: RedisMessage = {
    ...target,
    message,
    senderId: update.from.id
  }

  // the material is the decryption key and exists only in the button from here on; the lookup
  // doubles as the result id so chosen_inline_result can promote whichever of the two was sent
  const [regular, once] = await Promise.all([
    WhisperService.saveInline(payload),
    WhisperService.saveInline({ ...payload, once: true }),
    WhisperService.rememberTarget(context.senderId, target)
  ])

  return update.answer({
    button,
    cache_time: 0,
    is_personal: true,
    results: [
      InlineQueryResult.article({
        content: InputMessageContent.text(html`🔒 a whisper message to ${recipientMention}`),
        description,
        id: regular.lookup,
        replyMarkup: InlineKeyboard.keyboard([
          InlineKeyboard.textButton({
            payload: regular.material,
            text: 'show message 🔐'
          })
        ]),
        title: `🔒 whisper to ${recipientLabel}`
      }),
      InlineQueryResult.article({
        content: InputMessageContent.text(html`🔥 a one-time whisper to ${recipientMention}`),
        description: `${description} it burns once they read it.`,
        id: once.lookup,
        replyMarkup: InlineKeyboard.keyboard([
          InlineKeyboard.textButton({
            payload: once.material,
            text: 'read once 🔥'
          })
        ]),
        title: `🔥 one-time whisper to ${recipientLabel}`
      })
    ]
  })
}
