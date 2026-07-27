import type { ChosenInlineResultUpdate } from 'puregram'

import { WhisperService } from '../services/index.js'

// whisper results carry their redis lookup as the result id; the hint articles carry random hex,
// so anything of the wrong shape is somebody picking a usage note rather than sending a whisper
const LOOKUP = /^[0-9a-f]{64}$/

export const handleChosenInlineResult = (update: ChosenInlineResultUpdate) => {
  if (!LOOKUP.test(update.resultId)) {
    return
  }

  return WhisperService.promote(update.resultId)
}
