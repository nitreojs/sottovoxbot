import type { MyChatMemberUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { telegram } from '../shared/index.js'

export const handleMyChatMember = (update: MyChatMemberUpdate) => {
  if (update.chat.type === 'private') {
    return
  }

  const from = update.oldChatMember.raw.status
  const to = update.newChatMember.raw.status

  if (to === 'administrator' && from !== 'administrator') {
    return telegram.send(update.chat.id, html`✅ i'm an admin now — anyone can whisper privately: reply to a user or use <code>/w &lt;id | @username&gt; message</code>. only the recipient sees it.`)
  }

  if (to === 'member' && from !== 'member' && from !== 'administrator') {
    return telegram.send(update.chat.id, html`👋 thanks for adding me! please make me an <b>admin</b> so i can deliver private whispers, then use <code>/whisper</code>.`)
  }
}
