import { Redis } from 'ioredis'

import { Env } from '../env.js'

export const redis = new Redis(Env.REDIS_URL)
