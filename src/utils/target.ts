import type { Formattable } from 'puregram'

import { html } from '@puregram/markup'

import { UserService } from '../services/index.js'
import { Target } from '../types.js'

export interface TargetContext {
  senderId: number
  senderUsername?: string
}

export interface TargetedQuery {
  message: string
  target: Target
}

const FORMS: Array<[RegExp, (token: RegExpMatchArray, context: TargetContext) => Promise<Target>]> = [
  [/^@me$/i, async (_token, context) => ({ userId: context.senderId, username: context.senderUsername })],
  [/^(?:id:|@)(?<userId>\d+)$/i, async ({ groups }) => ({ userId: Number(groups!.userId) })],
  [/^@(?<username>[a-z]\w{3,31})$/i, async ({ groups }) => ({ userId: await UserService.resolve(groups!.username), username: groups!.username })]
]

export const targetOf = async (token: string, context: TargetContext): Promise<Target | undefined> => {
  for (const [pattern, resolve] of FORMS) {
    const match = token.match(pattern)

    if (match !== null) {
      return resolve(match, context)
    }
  }

  return undefined
}

export const parseTargetedQuery = async (query: string, context: TargetContext): Promise<TargetedQuery | undefined> => {
  const candidates = [
    query.match(/^(?<token>\S+)(?:\s+(?<rest>[\s\S]+))?$/),
    query.match(/^(?<rest>[\s\S]+)\s+(?<token>\S+)$/)
  ]

  for (const candidate of candidates) {
    const target = candidate === null ? undefined : await targetOf(candidate.groups!.token, context)

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
