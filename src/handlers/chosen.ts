import type { ChosenInlineResultUpdate } from 'puregram'

import { WhisperService } from '../services/index.js'

const LOOKUP = /^[0-9a-f]{64}$/

export const handleChosenInlineResult = (update: ChosenInlineResultUpdate) => {
  if (!LOOKUP.test(update.resultId)) {
    return
  }

  return WhisperService.promote(update.resultId)
}
