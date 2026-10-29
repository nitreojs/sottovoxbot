import type { MessageUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { deepLink } from '@puregram/utils'
import { InlineKeyboard } from 'puregram'

import { EPHEMERAL_REPLY_WINDOW_SECONDS, ICON, INVITE_ADMIN_RIGHTS, MAX_TARGETS, TTL } from '../constants.js'
import { BotService } from '../services/index.js'

export const handleHelp = (update: MessageUpdate) =>
  update.send(html`
    hi! i'm ${BotService.describe()}. with me you can send a private message in the <b>chat</b> (also called "whispering") to a certain user and no one except them will be able to read it.

    <b>inline</b> — in any chat, type ${BotService.describe()} then the recipient (<code>@username</code> or <code>id:123456789</code>) followed by your message, then pick one of the two results: a regular whisper, or a <b>🔥 one-time</b> one that burns the moment they read it.

    <b>example</b>: <code>@${BotService.primary} @starkow hello! how are you doing?</code> or <code>@${BotService.primary} id:398859857 hello!</code>

    <b>several people</b> — name up to ${MAX_TARGETS} of them before the message: <code>@${BotService.primary} @alice @bob see you at 8</code>. each of them can open it; a one-time whisper burns after the last one reads it.

    <b>everyone but someone</b> — put a minus before the name: <code>@${BotService.primary} -@alice her birthday is friday</code>. anyone who taps it can read it except them, and they don't get pinged. i need to have seen them before (or use <code>-id:123456789</code>), and there's no one-time version.

    <b>shortcuts</b> — once you've whispered someone, just type the message and i'll offer them again. <code>@me</code> whispers yourself, which makes a burn-after-read note in Saved Messages.

    <b>your own whispers</b> — tap one you sent to see whether it's been read yet, and tap it again within ${TTL.recall}s to recall it. mistyped the @username? that's how you take it back.

    <b>in groups</b> — add me as an <b>admin</b>, then whisper with a command: reply to someone (or name up to ${MAX_TARGETS} people with <code>@username</code> / <code>id:123456789</code>) and send <code>/w your secret message</code>. only they can read it, and they can reply within ${EPHEMERAL_REPLY_WINDOW_SECONDS}s to answer you back privately.

    <b>no @username?</b> — tap their name from the composer's suggestions after <code>/w</code> and i'll pick up who they are. or send me <code>/w</code> right here and choose up to ${MAX_TARGETS} of them from your contacts.
  `, {
    reply_markup: InlineKeyboard.keyboard([
      InlineKeyboard.urlButton({
        iconCustomEmojiId: ICON.group,
        text: 'add me to a group',
        url: deepLink.startGroup({ admin: INVITE_ADMIN_RIGHTS, bot: BotService.primary })
      })
    ])
  })
