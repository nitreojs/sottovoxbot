import type { CallbackQueryUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { ALERT_TEXT_LIMIT, TTL } from '../constants.js'
import { WhisperService } from '../services/index.js'
import { RedisMessage } from '../types.js'
import { audienceMention, isTarget } from '../utils/index.js'

const agoLabel = (readAt: number): string => {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - readAt)

  if (seconds < 60) {
    return 'just now'
  }

  return seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`
}

const authorPanel = (record: RedisMessage, readers: number): string => {
  const { audience, readAt } = record

  const status = readAt === undefined
    ? '◌ not read yet'
    : audience.kind === 'except'
      ? `✓ read by ${readers} · first ${agoLabel(readAt)}`
      : audience.targets.length === 1
        ? `✓ read ${agoLabel(readAt)}`
        : `✓ ${readers}/${audience.targets.length} read · first ${agoLabel(readAt)}`

  const hint = `press again within ${TTL.recall}s to recall it`
  const room = ALERT_TEXT_LIMIT - status.length - hint.length - 4
  const body = record.message.length > room ? `${record.message.slice(0, room - 1)}…` : record.message

  return `${status}\n\n${body}\n\n${hint}`
}

export const handleCallbackQuery = async (update: CallbackQueryUpdate) => {
  if (!update.hasData()) {
    return
  }

  const material = update.data
  const record = await WhisperService.getInline(material)

  if (record === undefined) {
    return update.answer({
      show_alert: true,
      text: '🔥 this whisper is gone — it either expired, was recalled, or was a one-time one that has already been read.'
    })
  }

  const { audience, message, once, senderId } = record

  const isAuthor = update.from.id === senderId
  const isListed = audience.targets.some((target) => isTarget(target, update.from))
  const isRecipient = audience.kind === 'only' ? isListed : !isListed && !isAuthor

  if (!isAuthor && !isRecipient) {
    return update.answer({
      show_alert: true,
      text: '🔒 sorry, but this whisper is not for you. you can not read it.'
    })
  }

  await WhisperService.promoteMaterial(material)

  if (isAuthor && !isRecipient) {
    if (await WhisperService.disarmRecall(material)) {
      await WhisperService.burnInline(material)
      await update.answer({ show_alert: true, text: '🗑 recalled — nobody can open it now.' })

      return update.edit(html`🗑 this whisper was recalled by its author.`).catch(() => {})
    }

    await WhisperService.armRecall(material)

    return update.answer({ show_alert: true, text: authorPanel(record, await WhisperService.readerCount(material)) })
  }

  if (once && await WhisperService.hasRead(material, update.from.id)) {
    return update.answer({ show_alert: true, text: '🔥 you have already read this one-time whisper.' })
  }

  await update.answer({
    show_alert: true,
    text: message
  })

  const readers = await WhisperService.markRead(material, update.from.id)

  // burning only after a delivered alert: doing it first would destroy a whisper telegram refused to show
  if (once && audience.kind === 'only' && readers >= audience.targets.length && await WhisperService.burnInline(material)) {
    return update.edit(html`🔥 a one-time whisper to ${audienceMention(audience)} — read and burnt.`).catch(() => {})
  }
}
