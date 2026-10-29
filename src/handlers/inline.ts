import type { Formattable, InlineQueryUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { randomBytes } from 'crypto'
import { ButtonStyle, InlineKeyboard, InlineQueryResult, InputMessageContent } from 'puregram'

import { ALERT_TEXT_LIMIT } from '../constants.js'
import { BotService, UserService, WhisperService } from '../services/index.js'
import { RedisMessage } from '../types.js'
import { audienceLabel, audienceMention, listLabel, parseAudienceQuery, targetLabel } from '../utils/index.js'

interface ArticleOptions {
  button: string
  content: Formattable
  description: string
  saved: { lookup: string, material: string }
  style?: ButtonStyle
  title: string
}

const format = () => html`message format should be like this: <code>@${BotService.primary} @username message</code> or <code>@${BotService.primary} id:123456789 message</code>`

const article = ({ button, content, description, saved, style, title }: ArticleOptions) =>
  InlineQueryResult.article({
    content: InputMessageContent.text(content),
    description,
    id: saved.lookup,
    replyMarkup: InlineKeyboard.keyboard([
      InlineKeyboard.textButton({ payload: saved.material, style, text: button })
    ]),
    title
  })

export const handleInlineQuery = async (update: InlineQueryUpdate) => {
  UserService.learn(update.from).catch(() => {})

  const button = InlineQueryResult.button('how to whisper?', {
    startParameter: 'how'
  })

  const hint = (title: string, description: string, content: Formattable = format()) =>
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
    const recent = await WhisperService.lastAudience(context.senderId)

    return recent === undefined
      ? update.answer({ button, cache_time: 0, is_personal: true, results: [] })
      : hint(`${recent.kind === 'only' ? '🔒' : '🙈'} whisper to ${audienceLabel(recent)}`, 'who you whispered last — now type your message')
  }

  const parsed = await parseAudienceQuery(update.query, context)

  if (parsed?.ok === false) {
    return hint('⚠️ can not whisper like that', parsed.error)
  }

  const audience = parsed?.audience ?? await WhisperService.lastAudience(context.senderId)

  if (audience === undefined) {
    return hint('whisper', 'name the recipient first: @username or id:123456789')
  }

  const sticky = parsed === undefined
  const message = parsed?.message ?? update.query.trim()
  const audienceTitle = `${audienceLabel(audience)}${sticky ? ' (last)' : ''}`

  if (!message) {
    return hint(`${audience.kind === 'only' ? '🔒' : '🙈'} whisper to ${audienceTitle}`, 'now type your message')
  }

  if (message.length > ALERT_TEXT_LIMIT) {
    return hint(
      '⚠️ whisper is too long',
      `too long by ${message.length - ALERT_TEXT_LIMIT} characters — the popup only fits ${ALERT_TEXT_LIMIT}.`,
      html`a whisper is shown in a popup, so it can not be longer than ${ALERT_TEXT_LIMIT} characters. yours is ${message.length}.`
    )
  }

  const payload: RedisMessage = {
    audience,
    message,
    senderId: update.from.id
  }

  if (audience.kind === 'except') {
    const [saved] = await Promise.all([
      WhisperService.saveInline(payload),
      WhisperService.rememberAudience(context.senderId, audience)
    ])

    return update.answer({
      button,
      cache_time: 0,
      is_personal: true,
      results: [
        article({
          button: 'show message 🔐',
          content: html`🙈 a whisper for everyone here except ${audience.targets.map((target) => target.username ?? `user ${target.userId}`).join(', ')}`,
          description: 'anyone who taps it can read it, except them — and they will not be pinged.',
          saved,
          title: `🙈 whisper to ${audienceTitle}`
        })
      ]
    })
  }

  const plural = audience.targets.length > 1
  const unknown = audience.targets.filter((target) => target.userId === undefined)
  const mention = audienceMention(audience)

  const description = unknown.length > 0
    ? `i have not seen ${listLabel(unknown.map(targetLabel))} yet, so i will match them by their @username.`
    : sticky
      ? `${plural ? 'the last people' : 'the last person'} you whispered — name someone else to change that.`
      : 'only they can open it.'

  const [regular, once] = await Promise.all([
    WhisperService.saveInline(payload),
    WhisperService.saveInline({ ...payload, once: true }),
    WhisperService.rememberAudience(context.senderId, audience)
  ])

  return update.answer({
    button,
    cache_time: 0,
    is_personal: true,
    results: [
      article({
        button: 'show message 🔐',
        content: html`🔒 a whisper message to ${mention}`,
        description,
        saved: regular,
        title: `🔒 whisper to ${audienceTitle}`
      }),
      article({
        button: 'read once 🔥',
        content: html`🔥 a one-time whisper to ${mention}`,
        description: `${description} ${plural ? 'each of them can read it once; it burns after the last one does.' : 'it burns once they read it.'}`,
        saved: once,
        style: ButtonStyle.Danger,
        title: `🔥 one-time whisper to ${audienceTitle}`
      })
    ]
  })
}
