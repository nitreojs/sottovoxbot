import type { Formattable, MessageUpdate, User } from 'puregram'

import { html } from '@puregram/markup'

import { MAX_TARGETS, WHISPER_TRIGGER } from '../constants.js'
import { BotService } from '../services/index.js'
import { TargetContext, targetLabel, targetOf } from './target.js'

export interface Recipient {
  id: number
  label: string
}

export type WhisperParse =
  | { error: Formattable, ok: false }
  | { ok: true, recipients: Recipient[], text: string }

type NamedStep =
  | { end: number, recipient: Recipient }
  | { error: Formattable }
  | undefined

const USAGE = html`usage: <code>/w &lt;reply | @username | id:123456789&gt; your message</code> — name up to ${MAX_TARGETS} people to whisper them all at once.`

const EMPTY = html`add some text after the recipients: <code>/w @them your message</code>`

const TOO_MANY = html`a whisper can name up to ${MAX_TARGETS} people.`

export const labelOf = (user?: Pick<User, 'firstName' | 'username'>): string =>
  user?.username === undefined ? (user?.firstName ?? 'someone') : `@${user.username}`

const namedAt = async (update: MessageUpdate, content: string, start: number, tokens: boolean, context: TargetContext): Promise<NamedStep> => {
  const mention = (update.entities ?? update.captionEntities)?.find((entity) => entity.type === 'text_mention' && entity.offset === start)

  if (mention?.user !== undefined) {
    return { end: start + mention.length, recipient: { id: mention.user.id, label: labelOf(mention.user) } }
  }

  const token = tokens ? content.slice(start).match(/^\S+/)?.[0] : undefined

  if (token === undefined) {
    return undefined
  }

  if (token.startsWith('-') && await targetOf(token.slice(1), context) !== undefined) {
    return { error: html`hiding a whisper from someone only works inline — type <code>@${BotService.primary} -@them your message</code> in the chat.` }
  }

  const target = await targetOf(token, context)

  if (target === undefined) {
    return undefined
  }

  if (target.userId === undefined) {
    return { error: html`couldn't find ${token} — reply to their message, use <code>id:123456789</code>, or an @username they've already used in this group.` }
  }

  return { end: start + token.length, recipient: { id: target.userId, label: targetLabel(target) } }
}

export const parseWhisper = async (update: MessageUpdate, allowEmpty: boolean): Promise<WhisperParse> => {
  const content = update.text ?? update.caption ?? ''
  const replyTarget = update.replyToMessage?.from
  const replying = replyTarget !== undefined && !replyTarget.isBot
  const context = { senderId: update.senderId, senderUsername: update.from?.username }

  const recipients: Recipient[] = []

  let cursor = content.match(WHISPER_TRIGGER)?.[0].length ?? 0

  for (;;) {
    const step = await namedAt(update, content, cursor + content.slice(cursor).search(/\S|$/), !replying, context)

    if (step === undefined) {
      break
    }

    if ('error' in step) {
      return { error: step.error, ok: false }
    }

    if (!recipients.some((known) => known.id === step.recipient.id)) {
      if (recipients.length === MAX_TARGETS) {
        return { error: TOO_MANY, ok: false }
      }

      recipients.push(step.recipient)
    }

    cursor = step.end
  }

  if (recipients.length === 0) {
    if (!replying) {
      return { error: USAGE, ok: false }
    }

    recipients.push({ id: replyTarget.id, label: labelOf(replyTarget) })
  }

  const text = content.slice(cursor).trim()

  if (!allowEmpty && text.length === 0) {
    return { error: EMPTY, ok: false }
  }

  return { ok: true, recipients, text }
}
