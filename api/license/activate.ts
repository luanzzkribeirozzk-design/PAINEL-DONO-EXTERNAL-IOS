import { createHash } from 'node:crypto'
import { db, FieldValue, json } from '../_lib/firebaseAdmin.js'
import { Timestamp } from 'firebase-admin/firestore'

type Request = { method?: string; body: unknown; headers?: Record<string, string | string[] | undefined> }
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }

const hash = (value: string) => {
  const pepper = process.env.LICENSE_PEPPER
  if (!pepper) throw new Error('LICENSE_PEPPER_NOT_CONFIGURED')
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex')
}
const deviceHash = (value: string) => createHash('sha256').update(`device:${value}`).digest('hex')
const ipHash = (value: string) => createHash('sha256').update(`ip:${value}`).digest('hex')
const firstHeader = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return json(res, 405, { error: 'MÉTODO_NÃO_PERMITIDO' })
  try {
    if (!db) return json(res, 503, { error: 'BACKEND_NÃO_CONFIGURADO' })
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { key?: unknown; deviceId?: unknown }
    const rawKey = typeof body?.key === 'string' ? body.key.trim() : ''
    const rawDevice = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
    if (!rawKey || rawKey.length > 160 || !rawDevice || rawDevice.length > 200) return json(res, 400, { error: 'DADOS_INVÁLIDOS' })
    const ip = (firstHeader(req.headers?.['x-forwarded-for']) ?? firstHeader(req.headers?.['x-real-ip']) ?? '').split(',')[0].trim()
    const hashedDevice = deviceHash(rawDevice)
    const hashedIP = ip ? ipHash(ip) : ''
    const blockedDevice = await db.collection('blockedDevices').doc(hashedDevice).get()
    if (blockedDevice.exists) return json(res, 403, { error: 'DISPOSITIVO_BLOQUEADO' })
    if (hashedIP && (await db.collection('blockedIPs').doc(hashedIP).get()).exists) return json(res, 403, { error: 'IP_BLOQUEADO' })
    const matches = await db.collection('licenses').where('keyHash', '==', hash(rawKey)).limit(1).get()
    if (matches.empty) return json(res, 404, { error: 'KEY_INVÁLIDA' })
    const licenseRef = matches.docs[0].ref
    const bindingRef = db.collection('licenseDevices').doc(`${licenseRef.id}_${hashedDevice}`)
    const now = Timestamp.now()
    const result = await db.runTransaction(async transaction => {
      const licenseSnap = await transaction.get(licenseRef)
      const license = licenseSnap.data() ?? {}
      const global = await transaction.get(db!.collection('systemFlags').doc('global'))
      if (global.data()?.globalPaused) throw new Error('SISTEMA_PAUSADO')
      if (['deleted', 'blocked', 'expired'].includes(String(license.status))) throw new Error('KEY_INDISPONÍVEL')
      if (license.status === 'paused') throw new Error('KEY_PAUSADA')
      if (license.status === 'active' && license.expiresAt?.toMillis?.() <= now.toMillis()) {
        transaction.update(licenseRef, { status: 'expired', updatedAt: now })
        throw new Error('KEY_EXPIRADA')
      }
      const binding = await transaction.get(bindingRef)
      if (!binding.exists && Number(license.devicesUsed ?? 0) >= Number(license.devices ?? 1)) throw new Error('LIMITE_DE_DISPOSITIVOS')
      const updates: Record<string, unknown> = { lastUsedAt: now, updatedAt: now, deviceId: hashedDevice, devicePreview: `${rawDevice.slice(0, 4)}•••${rawDevice.slice(-4)}`, ip: ip || null, ipHash: hashedIP || null }
      if (license.status === 'ready') {
        const durationMs = Math.max(1, Number(license.durationDays ?? 1)) * 86400000
        updates.status = 'active'
        updates.activatedAt = now
        updates.expiresAt = Timestamp.fromMillis(now.toMillis() + durationMs)
      }
      transaction.update(licenseRef, updates)
      if (!binding.exists) transaction.set(bindingRef, { licenseId: licenseRef.id, deviceHash: hashedDevice, devicePreview: `${rawDevice.slice(0, 4)}•••${rawDevice.slice(-4)}`, ip: ip || null, ipHash: hashedIP || null, firstUsedAt: now, lastUsedAt: now })
      else transaction.update(bindingRef, { lastUsedAt: now, ip: ip || null, ipHash: hashedIP || null })
      if (!binding.exists) transaction.update(licenseRef, { devicesUsed: FieldValue.increment(1) })
      const activatedAt = updates.activatedAt ?? license.activatedAt ?? license.lastUsedAt
      const expiresAt = updates.expiresAt ?? license.expiresAt
      return {
        licenseId: licenseRef.id,
        status: updates.status ?? license.status,
        activatedAt: activatedAt?.toMillis?.() ?? null,
        expiresAt: expiresAt?.toMillis?.() ?? null,
      }
    })
    return json(res, 200, { ok: true, ...result })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ERRO_INTERNO'
    const status = ['SISTEMA_PAUSADO', 'KEY_PAUSADA', 'KEY_INDISPONÍVEL', 'KEY_EXPIRADA', 'LIMITE_DE_DISPOSITIVOS', 'DISPOSITIVO_BLOQUEADO', 'IP_BLOQUEADO'].includes(code) ? 403 : 500
    return json(res, status, { error: code })
  }
}
