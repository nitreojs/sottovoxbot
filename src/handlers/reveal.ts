import type { CallbackQueryUpdate } from 'puregram'

import { html } from '@puregram/markup'

import { ALERT_TEXT_LIMIT, TTL } from '../constants.js'
import { WhisperService } from '../services/index.js'
import { RedisMessage } from '../types.js'
import { targetMention } from '../utils/index.js'

const agoLabel = (readAt: number): string => {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - readAt)

  if (seconds < 60) {
    return 'just now'
  }

  return seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`
}

// the author's own press is the only surface an inline whisper has for its sender: telegram never
// tells them anything else about it, and the message can't be deleted once posted
const authorPanel = (record: RedisMessage): string => {
  const status = record.readAt === undefined ? '◌ not read yet' : `✓ read ${agoLabel(record.readAt)}`
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

  const { message, once, senderId, userId, username } = record

  const isAuthor = update.from.id === senderId

  // the pinned id wins outright when there is one; a username match is the weaker fallback for a
  // recipient the bot had never seen at compose time
  const isRecipient = userId === undefined
    ? username !== undefined && update.from.username?.toLowerCase() === username.toLowerCase()
    : update.from.id === userId

  if (!isAuthor && !isRecipient) {
    return update.answer({
      show_alert: true,
      text: '🔒 sorry, but this whisper is not for you. you can not read it.'
    })
  }

  // a press proves the whisper was sent, so it earns the full lifetime even if telegram never
  // delivered the chosen_inline_result that normally promotes it
  await WhisperService.promoteMaterial(material)

  if (isAuthor && !isRecipient) {
    if (await WhisperService.disarmRecall(material)) {
      await WhisperService.burnInline(material)
      await update.answer({ show_alert: true, text: '🗑 recalled — nobody can open it now.' })

      return update.edit(html`🗑 this whisper was recalled by its author.`).catch(() => {})
    }

    await WhisperService.armRecall(material)

    return update.answer({ show_alert: true, text: authorPanel(record) })
  }

  await update.answer({
    show_alert: true,
    text: message
  })

  // burning only after a delivered alert: doing it first would destroy a whisper telegram refused to show
  if (once) {
    if (await WhisperService.burnInline(material)) {
      // inline messages can't be deleted, so the burnt whisper is tombstoned in place
      return update.edit(html`🔥 a one-time whisper to ${targetMention(record)} — read and burnt.`).catch(() => {})
    }

    return
  }

  await WhisperService.markRead(material)
}
