import { Env } from '@/env'
import { Redis } from 'ioredis'

export const redis = new Redis(Env.REDIS_URL)
