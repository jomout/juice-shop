import path from 'path'
import { readFile } from 'fs/promises'
import { safeLoad } from 'js-yaml'
import logger from '../lib/logger'
import dotenv from 'dotenv';
dotenv.config();

export async function loadStaticData (file: string) {
  if (file.includes('..')){
    throw new Error('Path contains invalid traversal characters!')
  }
  const sanitizedFile = path.basename(file);
  const allowedDir = path.resolve('./data/static/');
  const filePath = path.resolve( allowedDir, sanitizedFile + '.yml');
  if (!filePath.startsWith(allowedDir)) {
    logger.error(`Invalid file path attempt: "${filePath}"`);
    return;
  }
  return await readFile(filePath, 'utf8')
    .then(safeLoad)
    .catch(() => logger.error('Could not open file: "' + filePath + '"'))
}

export interface StaticUser {
  email: string
  password: string
  key: string
  role: 'admin' | 'customer' | 'deluxe' | 'accounting'

  username?: string
  profileImage?: string
  walletBalance?: number
  lastLoginIp?: string
  deletedFlag?: boolean
  totpSecret?: string
  customDomain?: boolean
  securityQuestion?: StaticUserSecurityQuestion
  feedback?: StaticUserFeedback
  address?: StaticUserAddress[]
  card?: StaticUserCard[]
}
export interface StaticUserSecurityQuestion {
  id: number
  answer: string
}
export interface StaticUserFeedback {
  comment: string
  rating: 1 | 2 | 3 | 4 | 5
}
export interface StaticUserAddress {
  fullName: string
  mobileNum: number
  zipCode: string
  streetAddress: string
  city: string
  state: string
  country: string
}
export interface StaticUserCard {
  fullName: string
  cardNum: number
  expMonth: number
  expYear: number
}
export async function loadStaticUserData (): Promise<StaticUser[]> {
  const users = await loadStaticData('users') as StaticUser[];
  return users.map(user => {
    if (user.totpSecret) {
      user.totpSecret = process.env.TOTP_SECRET || user.totpSecret; // Look for environment variable, fallback to YAML value if not set
    }
    return user;
  });
}

export interface StaticChallenge {
  name: string
  category: string
  tags?: string[]
  description: string
  difficulty: number
  hint: string
  hintUrl: string
  mitigationUrl: string
  key: string
  disabledEnv?: string[]
  tutorial?: {
    order: number
  }
}
export async function loadStaticChallengeData (): Promise<StaticChallenge[]> {
  return await loadStaticData('challenges') as StaticChallenge[]
}

export interface StaticDelivery {
  name: string
  price: number
  deluxePrice: number
  eta: number
  icon: string
}
export async function loadStaticDeliveryData (): Promise<StaticDelivery[]> {
  return await loadStaticData('deliveries') as StaticDelivery[]
}

export interface StaticSecurityQuestions {
  question: string
}
export async function loadStaticSecurityQuestionsData (): Promise<StaticSecurityQuestions[]> {
  return await loadStaticData('securityQuestions') as StaticSecurityQuestions[]
}
