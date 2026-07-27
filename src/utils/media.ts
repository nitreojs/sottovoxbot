import type { Formattable, MessageUpdate } from 'puregram'

import { MediaSource } from 'puregram'

import { telegram } from '../shared/index.js'
import { EphemeralSend } from '../types.js'

// live photos come before photos and animation before document — telegram sets both of each pair.
// video notes and stickers take no caption
const mediaSenderOf = (update: MessageUpdate, caption: Formattable | string): EphemeralSend | undefined => {
  if (update.hasLivePhoto() && update.livePhoto.photo !== undefined) {
    const livePhoto = MediaSource.fileId(update.livePhoto.fileId)
    const photo = MediaSource.fileId(update.livePhoto.photo.biggest.fileId)

    return (base) => telegram.api.sendLivePhoto({ ...base, caption, live_photo: livePhoto, photo, suppress: true })
  }

  if (update.hasPhoto()) {
    const photo = MediaSource.fileId(update.photo.biggest.fileId)

    return (base) => telegram.api.sendPhoto({ ...base, caption, photo, suppress: true })
  }

  if (update.hasAnimation()) {
    const animation = MediaSource.fileId(update.animation.fileId)

    return (base) => telegram.api.sendAnimation({ ...base, animation, caption, suppress: true })
  }

  if (update.hasVideo()) {
    const video = MediaSource.fileId(update.video.fileId)

    return (base) => telegram.api.sendVideo({ ...base, caption, video, suppress: true })
  }

  if (update.hasAudio()) {
    const audio = MediaSource.fileId(update.audio.fileId)

    return (base) => telegram.api.sendAudio({ ...base, audio, caption, suppress: true })
  }

  if (update.hasVoice()) {
    const voice = MediaSource.fileId(update.voice.fileId)

    return (base) => telegram.api.sendVoice({ ...base, caption, suppress: true, voice })
  }

  if (update.hasVideoNote()) {
    const videoNote = MediaSource.fileId(update.videoNote.fileId)

    return (base) => telegram.api.sendVideoNote({ ...base, suppress: true, video_note: videoNote })
  }

  if (update.hasSticker()) {
    const sticker = MediaSource.fileId(update.sticker.fileId)

    return (base) => telegram.api.sendSticker({ ...base, sticker, suppress: true })
  }

  if (update.hasDocument()) {
    const document = MediaSource.fileId(update.document.fileId)

    return (base) => telegram.api.sendDocument({ ...base, caption, document, suppress: true })
  }

  return undefined
}

export const hasWhisperMedia = (update: MessageUpdate): boolean =>
  mediaSenderOf(update, '') !== undefined

export const whisperSenderOf = (update: MessageUpdate, content: Formattable | string): EphemeralSend =>
  mediaSenderOf(update, content) ?? ((base) => telegram.api.sendMessage({ ...base, suppress: true, text: content }))
