import type { MyChatMemberUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { ChatService } from '../services/index.js'
import { telegram } from '../shared/index.js'

export const handleMyChatMember = async (update: MyChatMemberUpdate) => {
  if (update.chat.type === 'private') {
    return
  }

  const member = update.newChatMember.raw

  const from = update.oldChatMember.raw.status
  const to = member.status

  const capability = ChatService.of(to, member.status === 'administrator' && member.can_delete_messages)

  await ChatService.remember(update.chat.id, capability)

  if (to === 'administrator' && from !== 'administrator') {
    if (!capability.canDelete) {
      return telegram.send(update.chat.id, html`✅ i'm an admin now — but without the <b>delete messages</b> right i can't remove the <code>/w</code> command itself, so whatever you type after it stays visible to everyone.`)
    }

    return telegram.send(update.chat.id, html`✅ i'm an admin now — anyone can whisper privately: reply to a user or use <code>/w &lt;@username | id:123456789&gt; message</code>. only the recipient sees it.`)
  }

  if (to === 'member' && from !== 'member' && from !== 'administrator') {
    return telegram.send(update.chat.id, html`👋 thanks for adding me! please make me an <b>admin</b> so i can deliver private whispers, then use <code>/whisper</code>.`)
  }
}
