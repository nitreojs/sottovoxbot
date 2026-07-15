import type { Formattable, MessageUpdate, User } from 'puregram'

import { html } from '@puregram/markup'

import { UserService } from '../services/index.js'

export interface Recipient {
  id: number
  label: string
}

export type WhisperParse =
  | { error: Formattable, ok: false }
  | { ok: true, recipient: Recipient, text: string }

const USAGE = html`usage: <code>/w &lt;reply | user id | @username&gt; your message</code>`

const UNKNOWN = html`couldn't find that user — reply to their message, use their numeric id, or an @username they've already used in this group.`

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

  const token = split.groups.token
  const text = split.groups.text ?? ''

  if (!allowEmpty && text.length === 0) {
    return { error: USAGE, ok: false }
  }

  if (/^\d+$/.test(token)) {
    return { ok: true, recipient: { id: Number(token), label: `user ${token}` }, text }
  }

  const username = token.replace(/^@/, '')
  const id = await UserService.resolve(username)

  if (id === undefined) {
    return { error: UNKNOWN, ok: false }
  }

  return { ok: true, recipient: { id, label: `@${username}` }, text }
}
