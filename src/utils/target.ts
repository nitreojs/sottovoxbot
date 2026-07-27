import type { Formattable } from 'puregram'

import { html } from '@puregram/markup'

import { UserService } from '../services/index.js'
import { RedisMessage } from '../types.js'

export type Target = Pick<RedisMessage, 'userId' | 'username'>

export interface TargetedQuery {
  message: string
  target: Target
}

// every way of naming a recipient lives here: one whitespace-free token, first match wins.
// adding a form (t.me links, phone numbers, roles, …) is a row — nothing else needs to know
const FORMS: Array<[RegExp, (token: RegExpMatchArray) => Promise<Target>]> = [
  // telegram usernames have to start with a letter, so a numeric handle can only ever mean an id
  [/^(?:id:|@)(?<userId>\d+)$/i, async ({ groups }) => ({ userId: Number(groups!.userId) })],
  // 4-32 characters starting with a letter: shorter or digit-led handles can't be real people,
  // and matching them anyway builds a whisper addressed to nobody
  [/^@(?<username>[a-z]\w{3,31})$/i, async ({ groups }) => ({ userId: await UserService.resolve(groups!.username), username: groups!.username })]
]

export const targetOf = async (token: string): Promise<Target | undefined> => {
  for (const [pattern, resolve] of FORMS) {
    const match = token.match(pattern)

    if (match !== null) {
      return resolve(match)
    }
  }

  return undefined
}

// the recipient goes first, like /w. a trailing one is still read for the old inline format, but
// only a token that names a recipient can be one — plain words and bare numbers stay message text
export const parseTargetedQuery = async (query: string): Promise<TargetedQuery | undefined> => {
  const candidates = [
    query.match(/^(?<token>\S+)(?:\s+(?<rest>[\s\S]+))?$/),
    query.match(/^(?<rest>[\s\S]+)\s+(?<token>\S+)$/)
  ]

  for (const candidate of candidates) {
    const target = candidate === null ? undefined : await targetOf(candidate.groups!.token)

    if (target !== undefined) {
      return { message: (candidate!.groups!.rest ?? '').trim(), target }
    }
  }

  return undefined
}

export const targetLabel = (target: Target): string =>
  target.username === undefined ? `user ${target.userId}` : `@${target.username}`

export const targetMention = (target: Target): Formattable | string =>
  target.username === undefined
    ? html`<a href="tg://user?id=${target.userId}">user</a> id=${target.userId}`
    : `@${target.username}`
