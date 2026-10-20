import { telegram } from '../shared/index.js'

export class BotService {
  private static usernames: string[] = []

  static async load () {
    const primary = telegram.bot.username!
    const self = await telegram.api.getChat({ chat_id: telegram.bot.id })
    const aliases = (self.active_usernames ?? []).filter((username) => username.toLowerCase() !== primary.toLowerCase())

    BotService.usernames = [primary, ...aliases]
  }

  static get primary (): string {
    return BotService.usernames[0]
  }

  static get all (): readonly string[] {
    return BotService.usernames
  }

  static owns (username: string): boolean {
    const needle = username.replace(/^@/, '').toLowerCase()

    return BotService.usernames.some((own) => own.toLowerCase() === needle)
  }

  static describe (): string {
    const [primary, ...aliases] = BotService.usernames.map((username) => `@${username}`)

    return aliases.length === 0 ? primary : `${primary} (also ${aliases.join(', ')})`
  }
}
