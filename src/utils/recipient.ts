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

export const labelOf = (user?: Pick<User, 'firstName' | 'username'>): string =>
  user?.username === undefined ? (user?.firstName ?? 'someone') : `@${user.username}`

export const parseWhisper = async (update: MessageUpdate, rest: string | undefined, allowEmpty: boolean): Promise<WhisperParse> => {
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

  const target = await targetOf(split.groups.token)

  // /w delivers straight away, so a recipient the bot can't put a number to is no recipient at all
  if (target?.userId === undefined) {
    return { error: UNKNOWN, ok: false }
  }

  return { ok: true, recipient: { id: target.userId, label: targetLabel(target) }, text }
}
