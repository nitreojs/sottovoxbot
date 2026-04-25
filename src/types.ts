export interface RedisMessage {
  message: string
  username?: string
  userId?: number
  senderId: number
}
