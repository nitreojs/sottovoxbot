import { telegram } from '../shared/index.js'
import { handleInlineQuery } from './inline.js'
import { handleMyChatMember } from './membership.js'
import { handleMessage } from './message.js'
import { handleUsersShared } from './picker.js'
import { handleCallbackQuery } from './reveal.js'

export const registerHandlers = () => {
  telegram.onCallbackQuery(handleCallbackQuery)
  telegram.onInlineQuery(handleInlineQuery)
  telegram.onMessage(handleMessage)
  telegram.onMyChatMember(handleMyChatMember)
  telegram.onUsersShared(handleUsersShared)
}
