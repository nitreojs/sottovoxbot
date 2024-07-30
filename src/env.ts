import 'dotenv/config'
import env from 'env-var'

export class Env {
  static TOKEN = env.get('TELEGRAM_BOT_TOKEN').required().asString()
  static REDIS_URL = env.get('REDIS_URL').required().asString()
}
