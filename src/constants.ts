import type { AdminRight } from '@puregram/utils'
import type { TelegramBotCommand } from 'puregram'

export const KEY = {
  capability: (chatId: number) => `cap:${chatId}`,
  inlineWhisper: (id: string) => `whisper:${id}`,
  pendingRecall: (id: string) => `recall:${id}`,
  relay: (chatId: number, ephemeralMessageId: number) => `weph:${chatId}:${ephemeralMessageId}`,
  relayCandidates: (chatId: number, recipientId: number) => `weph:open:${chatId}:${recipientId}`,
  username: (username: string) => `uname:${username.replace(/^@/, '').toLowerCase()}`
}

export const TTL = {
  // a safety net only: my_chat_member keeps this fresh, so a stale entry means a missed update
  capability: 86_400,
  inlineWhisper: 10_800,
  recall: 5,
  relay: 60,
  username: 2_592_000
}

// telegram only allows replying to an ephemeral message within this window
export const EPHEMERAL_REPLY_WINDOW_SECONDS = 15

// a whisper is revealed through answerCallbackQuery, whose text telegram caps here
export const ALERT_TEXT_LIMIT = 200

export const WHISPER_TRIGGER = /^\/(?:w|whisper)(?:@(?<mention>\w+))?(?:\s+(?<rest>[\s\S]+))?$/i

export const GROUP_COMMANDS: TelegramBotCommand[] = [
  { command: 'w', description: 'whisper privately to a user', is_ephemeral: true },
  { command: 'whisper', description: 'whisper privately to a user', is_ephemeral: true }
]

// delete_messages powers the command scrub and, as an admin right, unlocks the ephemeral admin-path
export const INVITE_ADMIN_RIGHTS: AdminRight[] = ['delete_messages']
