import { Color, Logger } from '@starkow/logger'
import { Redis } from 'ioredis'

import { Env } from '../env.js'

export const redis = new Redis(Env.REDIS_URL)

redis.on('error', (error: Error) => Logger.create('redis', Color.Red).error(error.message))
