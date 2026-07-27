import type { Formattable, MessageUpdate, User } from 'puregram'

import { html } from '@puregram/markup'

import { targetLabel, targetOf } from './target.js'

export interface Recipient {
  id: number
  label: string
}

export type WhisperParse =
  | { error: Formattable, ok: false }
  | { ok: true, recipient: Recipient, text: string }

const USAGE = html`usage: <code>/w &lt;reply | @username | id:123456789&gt; your message</code>`

const UNKNOWN = html`couldn't find that user — reply to their message, use <code>id:123456789</code>, or an @username they've already used in this group.`

const COMMAND_ONLY = /^\/(?:w|whisper)(?:@\w+)?$/i

export const labelOf = (user?: Pick<User, 'firstName' | 'username'>): string =>
  user?.username === undefined ? (user?.firstName ?? 'someone') : `@${user.username}`

// a name picked from the composer arrives as a text_mention entity carrying the whole user object.
// it is the only identifier telegram hands over directly, and the only way to name someone who has
// no @username at all — so it outranks both the reply target and whatever token was typed
const mentionedIn = (update: MessageUpdate): undefined | { recipient: Recipient, text: string } => {
  const content = update.text ?? update.caption
  const entity = (update.entities ?? update.captionEntities)?.find(candidate => candidate.type === 'text_mention')
  const user = entity?.user

  if (content === undefined || entity === undefined || user === undefined) {
    return undefined
  }

  return COMMAND_ONLY.test(content.slice(0, entity.offset).trim())
    ? { recipient: { id: user.id, label: labelOf(user) }, text: content.slice(entity.offset + entity.length).trim() }
    : undefined
}

export const parseWhisper = async (update: MessageUpdate, rest: string | undefined, allowEmpty: boolean): Promise<WhisperParse> => {
  const mentioned = mentionedIn(update)

  if (mentioned !== undefined) {
    if (!allowEmpty && mentioned.text.length === 0) {
      return { error: html`mention the user and add some text: <code>/w @them your message</code>`, ok: false }
    }

    return { ok: true, ...mentioned }
  }

  const replyTarget = update.replyToMessage?.from

  if (replyTarget !== undefined && !replyTarget.isBot) {
    const text = rest ?? ''

    if (!allowEmpty && text.length === 0) {
      return { error: html`reply to the user with some text: <code>/w your message</code>`, ok: false }
    }

    return { ok: true, recipient: { id: replyTarget.id, label: labelOf(replyTarget) }, text }
  }

  if (rest === undefined || rest.length === 0) {
    return { error: USAGE, ok: false }
  }

  const split = rest.match(/^(?<token>\S+)(?:\s+(?<text>[\s\S]+))?$/)

  if (split?.groups === undefined) {
    return { error: USAGE, ok: false }
  }

  const text = split.groups.text ?? ''

  if (!allowEmpty && text.length === 0) {
    return { error: USAGE, ok: false }
  }

  const target = await targetOf(split.groups.token, { senderId: update.senderId, senderUsername: update.from?.username })

  // /w delivers straight away, so a recipient the bot can't put a number to is no recipient at all
  if (target?.userId === undefined) {
    return { error: UNKNOWN, ok: false }
  }

  return { ok: true, recipient: { id: target.userId, label: targetLabel(target) }, text }
}
