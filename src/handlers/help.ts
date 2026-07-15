import type { MessageUpdate } from 'puregram'

import { html } from '@puregram/markup'
import { deepLink } from '@puregram/utils'
import { InlineKeyboard } from 'puregram'

import { EPHEMERAL_REPLY_WINDOW_SECONDS, INVITE_ADMIN_RIGHTS } from '../constants.js'
import { telegram } from '../shared/index.js'

export const handleHelp = (update: MessageUpdate) =>
  update.send(html`hi! i'm @sottovoxbot. with me you can send a private message in the <b>chat</b> (also called "whispering") to a certain user and no one except them will be able to read it.

<b>inline</b> — in any chat, type @sottovoxbot message @username (or user id) and click on the button that appears.

<b>example</b>: <code>@sottovoxbot hello! how are you doing? @starkow</code> or <code>@sottovoxbot hello! 398859857</code>

<b>in groups</b> — add me as an <b>admin</b>, then whisper with a command: reply to someone (or pass their id / @username) and send <code>/w your secret message</code>. only they can read it, and they can reply within ${EPHEMERAL_REPLY_WINDOW_SECONDS}s to answer you back privately.`, {
    reply_markup: InlineKeyboard.keyboard([
      InlineKeyboard.urlButton({
        text: '➕ add me to a group',
        url: deepLink.startGroup({ admin: INVITE_ADMIN_RIGHTS, bot: telegram.bot.username! })
      })
    ])
  })
