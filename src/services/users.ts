import { KEY, TTL } from '../constants.js'
import { redis } from '../shared/index.js'

interface LearnableUser {
  id: number
  isBot?: boolean
  username?: string
}

export class UserService {
  static async learn (user?: LearnableUser) {
    if (user?.username === undefined || user.isBot === true) {
      return
    }

    await redis.set(KEY.username(user.username), String(user.id), 'EX', TTL.username)
  }

  static async resolve (username: string): Promise<number | undefined> {
    const raw = await redis.get(KEY.username(username))

    return raw === null ? undefined : Number(raw)
  }
}
