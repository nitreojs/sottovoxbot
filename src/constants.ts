import type { AdminRight } from '@puregram/utils'
import type { TelegramBotCommand } from 'puregram'

export const KEY = {
  inlineWhisper: (id: string) => `whisper:${id}`,
  lastWhisper: (chatId: number, recipientId: number) => `weph:last:${chatId}:${recipientId}`,
  relay: (chatId: number, ephemeralMessageId: number) => `weph:${chatId}:${ephemeralMessageId}`,
  username: (username: string) => `uname:${username.replace(/^@/, '').toLowerCase()}`
}

export const TTL = {
  inlineWhisper: 10_800,
  relay: 60,
  username: 2_592_000
}

// telegram only allows replying to an ephemeral message within this window
export const EPHEMERAL_REPLY_WINDOW_SECONDS = 15

export const WHISPER_TRIGGER = /^\/(?:w|whisper)(?:@(?<mention>\w+))?(?:\s+(?<rest>[\s\S]+))?$/i

export const GROUP_COMMANDS: TelegramBotCommand[] = [
  { command: 'w', description: 'whisper privately to a user', is_ephemeral: true },
  { command: 'whisper', description: 'whisper privately to a user', is_ephemeral: true }
]

// delete_messages powers the command scrub and, as an admin right, unlocks the ephemeral admin-path
export const INVITE_ADMIN_RIGHTS: AdminRight[] = ['delete_messages']
