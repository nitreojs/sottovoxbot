import type { AdminRight } from '@puregram/utils'
import type { TelegramBotCommand } from 'puregram'

export const KEY = {
  capability: (chatId: number) => `cap:${chatId}`,
  inlineWhisper: (id: string) => `whisper:${id}`,
  lastTarget: (senderId: number) => `wto:${senderId}`,
  pendingRecall: (id: string) => `recall:${id}`,
  relay: (chatId: number, ephemeralMessageId: number) => `weph:${chatId}:${ephemeralMessageId}`,
  relayCandidates: (chatId: number, recipientId: number) => `weph:open:${chatId}:${recipientId}`,
  username: (username: string) => `uname:${username.replace(/^@/, '').toLowerCase()}`
}

export const TTL = {
  capability: 86_400,
  draft: 900,
  inlineWhisper: 10_800,
  lastTarget: 86_400,
  recall: 5,
  relay: 60,
  username: 2_592_000
}

// telegram only allows replying to an ephemeral message within this window
export const EPHEMERAL_REPLY_WINDOW_SECONDS = 15

export const ALERT_TEXT_LIMIT = 200

// icons render only on messages the bot sends itself — inline-query keyboards need a fragment username
export const ICON = {
  group: '5942877472163892475',
  pencil: '5879841310902324730',
  personAdd: '5814550759961793482'
}

export const WHISPER_TRIGGER = /^\/(?:w|whisper)(?:@(?<mention>\w+))?(?:\s+(?<rest>[\s\S]+))?$/i

export const GROUP_COMMANDS: TelegramBotCommand[] = [
  { command: 'w', description: 'whisper privately to a user', is_ephemeral: true },
  { command: 'whisper', description: 'whisper privately to a user', is_ephemeral: true }
]

// delete_messages powers the command scrub and, as an admin right, unlocks the ephemeral admin-path
export const INVITE_ADMIN_RIGHTS: AdminRight[] = ['delete_messages']
