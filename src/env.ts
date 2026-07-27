import 'dotenv/config'
import env from 'env-var'

export class Env {
  static TOKEN = env.get('TELEGRAM_BOT_TOKEN').required().asString()
  static REDIS_URL = env.get('REDIS_URL').required().asString()
  // every whisper's encryption key is derived from this and the pressed button; losing it or
  // rotating it makes every whisper still in redis unreadable
  static WHISPER_SECRET = env.get('WHISPER_SECRET').required().asString()
}
