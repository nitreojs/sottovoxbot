import { Color, Logger } from '@starkow/logger'
import { BotCommands, Telegram } from 'puregram'

import { GROUP_COMMANDS } from './constants.js'
import { registerHandlers } from './handlers/index.js'
import { telegram } from './shared/index.js'

registerHandlers()

telegram.catch((error, context) => {
  Logger.create('dispatch error', Color.Red).error(context.raw.update_id, error)
})

const main = async () => {
  // best-effort: /w is handled by the message router regardless, so a rejected payload must not block startup
  const commands = await telegram.api.setMyCommands({
    commands: GROUP_COMMANDS,
    scope: BotCommands.scope.allGroupChats(),
    suppress: true
  })

  if (Telegram.isErrorResponse(commands)) {
    Logger.create('setMyCommands failed', Color.Yellow).warn(commands.description)
  }

  await telegram.startPolling({
    allowedUpdates: ['callback_query', 'inline_query', 'message', 'my_chat_member']
  })

  Logger.create(`@${telegram.bot.username}`)('started')
}

main().catch((error) => {
  Logger.create('startup failed', Color.Red).error(error)
  process.exit(1)
})
