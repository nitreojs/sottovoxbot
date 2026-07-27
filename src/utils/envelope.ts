import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto'

import { Env } from '../env.js'

const IV_BYTES = 12
const MATERIAL_BYTES = 32
const TAG_BYTES = 16

export interface SealedWhisper {
  lookup: string
  material: string
  sealed: string
}

const derive = (material: Buffer, label: string) =>
  createHmac('sha256', Env.WHISPER_SECRET).update(label).update(material).digest()

export const lookupOf = (material: string): string | undefined => {
  const parsed = Buffer.from(material, 'base64url')

  return parsed.length === MATERIAL_BYTES ? derive(parsed, 'lookup').toString('hex') : undefined
}

export const seal = (payload: unknown): SealedWhisper => {
  const material = randomBytes(MATERIAL_BYTES)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', derive(material, 'cipher'), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])

  return {
    lookup: derive(material, 'lookup').toString('hex'),
    material: material.toString('base64url'),
    sealed: Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
  }
}

export const unseal = <T>(material: string, sealed: string): T | undefined => {
  const parsed = Buffer.from(material, 'base64url')

  if (parsed.length !== MATERIAL_BYTES) {
    return undefined
  }

  try {
    const blob = Buffer.from(sealed, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', derive(parsed, 'cipher'), blob.subarray(0, IV_BYTES))

    decipher.setAuthTag(blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))

    const body = Buffer.concat([decipher.update(blob.subarray(IV_BYTES + TAG_BYTES)), decipher.final()])

    return JSON.parse(body.toString('utf8')) as T
  } catch {
    return undefined
  }
}
