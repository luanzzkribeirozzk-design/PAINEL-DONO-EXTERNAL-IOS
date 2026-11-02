import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function key() {
  const session = process.env.ADMIN_SESSION_SECRET ?? process.env.LICENSE_PEPPER
  const pepper = process.env.LICENSE_PEPPER
  if (!session || !pepper) throw new Error('BULK_ENCRYPTION_NOT_CONFIGURED')
  return createHash('sha256').update(`${session}:${pepper}:bulk-key-history`).digest()
}

export function encryptBulkKeys(keys: string[]) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(keys), 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptBulkKeys(value: string) {
  const [ivText, tagText, encryptedText] = value.split('.')
  if (!ivText || !tagText || !encryptedText) throw new Error('BULK_HISTORY_INVALID')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8')
  const keys = JSON.parse(decrypted)
  if (!Array.isArray(keys) || keys.some(value => typeof value !== 'string')) throw new Error('BULK_HISTORY_INVALID')
  return keys as string[]
}

export const encryptKey = (value: string) => encryptBulkKeys([value])
export const decryptKey = (value: string) => decryptBulkKeys(value)[0]
export const decryptKeyOr = (value: string, fallback: string) => {
  try { return decryptKey(value) } catch { return fallback }
}
