import { markup } from '@puregram/markup'
import { Telegram } from 'puregram'

import { Env } from '../env.js'

export const telegram = Telegram.fromToken(Env.TOKEN).extend(markup())
