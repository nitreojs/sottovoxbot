import { Color, Logger } from '@starkow/logger'

const logger = Logger.create('undelivered', Color.Yellow)

const HINTS: Array<[RegExp, string]> = [
  [/not enough rights|administrator|CHAT_ADMIN_REQUIRED/i, 'i lost the rights i need in this chat — make me an admin again.'],
  [/blocked|USER_IS_BLOCKED|deactivated/i, 'they blocked me, so i can not reach them.'],
  [/not found|invalid|participant|not a member/i, 'i could not find that user in this chat — they may have never spoken here.'],
  [/too many requests|flood/i, 'telegram is rate-limiting me — give it a moment and try again.'],
  [/not supported|unsupported/i, 'this chat does not support private whispers.']
]

export const deliveryHint = (description: string): string => {
  const hint = HINTS.find(([pattern]) => pattern.test(description))

  if (hint === undefined) {
    logger.warn(description)

    return 'could not deliver — the recipient may be offline or has never been active in a group with me.'
  }

  return hint[1]
}
