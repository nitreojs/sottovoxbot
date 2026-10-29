import type { Formatted } from '@puregram/markup'

import { html, join } from '@puregram/markup'

import { MAX_TARGETS } from '../constants.js'
import { UserService } from '../services/index.js'
import { Audience, Target } from '../types.js'

export interface TargetContext {
  senderId: number
  senderUsername?: string
}

export type AudienceParse =
  | { audience: Audience, message: string, ok: true }
  | { error: string, ok: false }

interface Filter {
  except: boolean
  target: Target
}

interface Edge {
  take: (text: string) => undefined | { rest: string, token: string }
  trailing: boolean
}

const FORMS: Array<[RegExp, (token: RegExpMatchArray, context: TargetContext) => Promise<Target>]> = [
  [/^@me$/i, async (_token, context) => ({ userId: context.senderId, username: context.senderUsername })],
  [/^(?:id:|@)(?<userId>\d+)$/i, async ({ groups }) => ({ userId: Number(groups!.userId) })],
  [/^@(?<username>[a-z]\w{3,31})$/i, async ({ groups }) => ({ userId: await UserService.resolve(groups!.username), username: groups!.username })]
]

const EDGES: Edge[] = [
  {
    take: (text) => {
      const match = text.match(/^\s*(?<token>\S+)/)

      return match === null ? undefined : { rest: text.slice(match[0].length), token: match.groups!.token }
    },
    trailing: false
  },
  {
    take: (text) => {
      const match = text.match(/(?<token>\S+)\s*$/)

      return match === null ? undefined : { rest: text.slice(0, match.index), token: match.groups!.token }
    },
    trailing: true
  }
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

export const sameTarget = (left: Target, right: Target): boolean =>
  left.userId !== undefined || right.userId !== undefined
    ? left.userId === right.userId
    : left.username?.toLowerCase() === right.username?.toLowerCase()

export const isTarget = (target: Target, user: { id: number, username?: string }): boolean =>
  target.userId === undefined
    ? target.username !== undefined && user.username?.toLowerCase() === target.username.toLowerCase()
    : user.id === target.userId

const filterOf = async (token: string, context: TargetContext): Promise<Filter | undefined> => {
  const except = token.startsWith('-')
  const target = await targetOf(except ? token.slice(1) : token, context)

  return target === undefined ? undefined : { except, target }
}

const collect = async (query: string, edge: Edge, context: TargetContext) => {
  const filters: Filter[] = []

  let message = query

  while (filters.length <= MAX_TARGETS) {
    const taken = edge.take(message)
    const filter = taken === undefined ? undefined : await filterOf(taken.token, context)

    if (taken === undefined || filter === undefined) {
      break
    }

    if (!filters.some((known) => known.except === filter.except && sameTarget(known.target, filter.target))) {
      if (edge.trailing) {
        filters.unshift(filter)
      } else {
        filters.push(filter)
      }
    }

    message = taken.rest
  }

  return { filters, message: message.trim() }
}

const audienceOf = (filters: Filter[], context: TargetContext): Audience | string => {
  if (filters.length > MAX_TARGETS) {
    return `a whisper can name up to ${MAX_TARGETS} people.`
  }

  const targets = filters.map((filter) => filter.target)
  const excluded = filters.filter((filter) => filter.except).length

  if (excluded === 0) {
    return { kind: 'only', targets }
  }

  if (excluded < filters.length) {
    return 'name either who can read it or who can not — not both at once.'
  }

  const unknown = targets.find((target) => target.userId === undefined)

  if (unknown !== undefined) {
    return `i have not seen @${unknown.username} yet, so i can not tell it is them — use their id:123456789 instead.`
  }

  if (targets.some((target) => target.userId === context.senderId)) {
    return 'you can not hide a whisper from yourself.'
  }

  return { kind: 'except', targets }
}

export const parseAudienceQuery = async (query: string, context: TargetContext): Promise<AudienceParse | undefined> => {
  for (const edge of EDGES) {
    const { filters, message } = await collect(query, edge, context)

    if (filters.length > 0) {
      const audience = audienceOf(filters, context)

      return typeof audience === 'string' ? { error: audience, ok: false } : { audience, message, ok: true }
    }
  }

  return undefined
}

export const targetLabel = (target: Target): string =>
  target.username === undefined ? `user ${target.userId}` : `@${target.username}`

export const listLabel = (labels: string[], shown = 3): string =>
  labels.length <= shown ? labels.join(', ') : `${labels.slice(0, shown).join(', ')} +${labels.length - shown}`

export const audienceLabel = (audience: Audience): string => {
  const names = listLabel(audience.targets.map(targetLabel))

  return audience.kind === 'only' ? names : `everyone but ${names}`
}

export const targetMention = (target: Target): Formatted | string =>
  target.username === undefined
    ? html`<a href="tg://user?id=${target.userId}">user</a> id=${target.userId}`
    : `@${target.username}`

export const audienceMention = (audience: Audience): Formatted =>
  join(audience.targets.map(targetMention), ', ')
