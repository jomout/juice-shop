/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import path from 'path'
import { type Request, type Response } from 'express'
import { challenges } from '../data/datacache'

import challengeUtils = require('../lib/challengeUtils')

export function servePrivacyPolicyProof () {
  return (req: Request, res: Response) => {
    challengeUtils.solveIf(challenges.privacyPolicyProofChallenge, () => { return true })
    res.sendFile(path.resolve('frontend/dist/frontend/assets/private/thank-you.jpg'))
  }
}
