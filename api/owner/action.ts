import { createHash, randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { db, FieldValue, json, requireOwner } from '../_lib/firebaseAdmin.js'

type NextApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body: unknown }
type NextApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }

type Payload = Record<string, unknown>

const hashKey = (value: string) => {
  const pepper = process.env.LICENSE_PEPPER
  if (!pepper) throw new Error('LICENSE_PEPPER_NOT_CONFIGURED')
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex')
}
const hashIP = (value: string) => createHash('sha256').update(`ip:${value}`).digest('hex')
const makeKey = (prefix: string) => `${prefix.replace(/[^A-Z0-9-]/gi, '').toUpperCase() || 'EXTERNAL'}-${randomBytes(6).toString('hex').toUpperCase()}`
const parseBody = (body: unknown): { action?: string; payload: Payload } => {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body
  if (!parsed || typeof parsed !== 'object') return { payload: {} }
  const value = parsed as { action?: unknown; payload?: unknown }
  return { action: typeof value.action === 'string' ? value.action : undefined, payload: value.payload && typeof value.payload === 'object' ? value.payload as Payload : {} }
}

async function requireDocument(ref: FirebaseFirestore.DocumentReference) {
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new Error('NOT_FOUND')
  return snapshot
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'MÉTODO_NÃO_PERMITIDO' })
  try {
    const actor = await requireOwner(req)
    if (!db) throw new Error('BACKEND_NOT_CONFIGURED')
    const { action, payload } = parseBody(req.body)
    if (!action) return json(res, 400, { error: 'AÇÃO_OBRIGATÓRIA' })
    const now = Timestamp.now()
    const audit = (target: string, result = 'success') => db!.collection('auditEvents').add({ action, actor: actor.uid, target, result, createdAt: FieldValue.serverTimestamp() })

    if (action === 'toggleGlobal') {
      const ref = db.collection('systemFlags').doc('global')
      const current = await ref.get()
      const next = !Boolean(current.data()?.globalPaused)
      await ref.set({ globalPaused: next, updatedAt: now, updatedBy: actor.uid }, { merge: true })
      const active = await db.collection('licenses').where('status', '==', next ? 'active' : 'paused').limit(500).get()
      const batch = db.batch()
      active.docs.forEach(item => {
        const data = item.data()
        if (next) {
          const remaining = data.expiresAt?.toMillis ? Math.max(0, data.expiresAt.toMillis() - now.toMillis()) : null
          batch.update(item.ref, { status: 'paused', pauseReason: 'global', pausedAt: now, pausedRemainingMs: remaining, updatedAt: now })
        } else if (data.pauseReason === 'global') {
          const remaining = Number(data.pausedRemainingMs ?? 0)
          batch.update(item.ref, remaining > 0 ? { status: 'active', pauseReason: null, pausedAt: null, pausedRemainingMs: null, expiresAt: Timestamp.fromMillis(now.toMillis() + remaining), updatedAt: now } : { status: 'expired', pauseReason: null, pausedAt: null, pausedRemainingMs: null, updatedAt: now })
        }
      })
      if (active.size) await batch.commit()
      await audit('systemFlags/global')
      return json(res, 200, { ok: true, globalPaused: next })
    }

    if (action === 'addDaysAll' || action === 'removeDaysAll') {
      const amount = Math.max(1, Math.abs(Number(payload.days ?? payload.amount ?? 0)))
      const direction = action === 'addDaysAll' ? 1 : -1
      const licenses = await db.collection('licenses').where('status', 'in', ['ready', 'active', 'paused']).limit(500).get()
      const batch = db.batch()
      licenses.docs.forEach(item => {
        const data = item.data()
        const updates: Record<string, unknown> = { durationDays: Math.max(1, Number(data.durationDays ?? 1) + direction * amount), updatedAt: now }
        const delta = direction * amount * 86400000
        if (data.status === 'active' && data.expiresAt?.toMillis) updates.expiresAt = Timestamp.fromMillis(Math.max(now.toMillis(), data.expiresAt.toMillis() + delta))
        if (data.status === 'paused' && data.pausedRemainingMs != null) updates.pausedRemainingMs = Math.max(0, Number(data.pausedRemainingMs) + delta)
        batch.update(item.ref, updates)
      })
      if (licenses.size) await batch.commit()
      await audit('licenses/all')
      return json(res, 200, { ok: true, count: licenses.size })
    }

    if (action === 'addDaysActiveOverOne') {
      const amount = Math.max(1, Math.abs(Number(payload.days ?? payload.amount ?? 0)))
      const licenses = await db.collection('licenses').where('status', '==', 'active').limit(500).get()
      const batch = db.batch()
      let count = 0
      licenses.docs.forEach(item => {
        const data = item.data()
        if (Number(data.durationDays ?? 0) <= 1) return
        count += 1
        const delta = amount * 86400000
        const updates: Record<string, unknown> = { durationDays: Number(data.durationDays ?? 1) + amount, updatedAt: now }
        if (data.expiresAt?.toMillis) updates.expiresAt = Timestamp.fromMillis(data.expiresAt.toMillis() + delta)
        batch.update(item.ref, updates)
      })
      if (count) await batch.commit()
      await audit('licenses/active-over-one-day')
      return json(res, 200, { ok: true, count })
    }

    if (action === 'generateLicenseBulk') {
      const quantity = Math.min(100, Math.max(1, Number(payload.quantity ?? 1)))
      const days = Math.max(1, Number(payload.days ?? 30))
      const devices = Math.min(10, Math.max(1, Number(payload.devices ?? 1)))
      const prefix = String(payload.prefix ?? 'EXTERNAL')
      const refs: FirebaseFirestore.DocumentReference[] = []
      const keys: string[] = []
      for (let index = 0; index < quantity; index += 1) {
        const rawKey = makeKey(prefix)
        keys.push(rawKey)
        refs.push(db.collection('licenses').doc())
      }
      const batch = db.batch()
      refs.forEach((ref, index) => batch.set(ref, { keyHash: hashKey(keys[index]), keyPreview: `${keys[index].slice(0, 6)}•••${keys[index].slice(-4)}`, createdBy: actor.uid, createdByRole: 'owner', status: 'ready', credits: 0, durationDays: days, devices, devicesUsed: 0, activatedAt: null, expiresAt: null, pausedRemainingMs: null, createdAt: now, updatedAt: now }))
      await batch.commit()
      await audit(`licenses/${quantity}-bulk`)
      return json(res, 200, { ok: true, ids: refs.map(ref => ref.id), keys })
    }

    if (action === 'generateAdmin' || action === 'generateLicense') {
      const collection = action === 'generateAdmin' ? 'adminAccess' : 'licenses'
      const prefix = String(payload.prefix ?? (action === 'generateAdmin' ? 'KEY' : 'EXTERNAL'))
      let rawKey = ''
      let keyHash = ''
      let ref: FirebaseFirestore.DocumentReference | undefined
      for (let attempt = 0; attempt < 5; attempt += 1) {
        rawKey = makeKey(prefix)
        keyHash = hashKey(rawKey)
        const existing = await db.collection(collection).where('keyHash', '==', keyHash).limit(1).get()
        if (existing.empty) { ref = db.collection(collection).doc(); break }
      }
      if (!ref) throw new Error('KEY_COLLISION')
      const isAdmin = action === 'generateAdmin'
      await ref.set({
        keyHash,
        keyPreview: `${rawKey.slice(0, 6)}•••${rawKey.slice(-4)}`,
        createdBy: actor.uid,
        status: isAdmin ? 'active' : 'ready',
        credits: isAdmin ? Math.max(0, Number(payload.credits ?? 0)) : 0,
        durationDays: Math.max(1, Number(payload.days ?? 30)),
        devices: Math.min(10, Math.max(1, Number(payload.devices ?? 1))),
        devicesUsed: 0,
        activatedAt: null,
        expiresAt: null,
        pausedRemainingMs: null,
        createdAt: now,
      })
      await audit(ref.id)
      return json(res, 200, { ok: true, key: rawKey, id: ref.id })
    }

    const id = String(payload.id ?? '')
    if (!id) return json(res, 400, { error: 'ID_OBRIGATÓRIO' })
    const adminActions = new Set(['pauseAdmin', 'unpauseAdmin', 'blockAdmin', 'unblockAdmin', 'deleteAdmin', 'addCredits', 'removeCredits'])
    const collection = adminActions.has(action) ? 'adminAccess' : 'licenses'
    const ref = db.collection(collection).doc(id)

    if (action === 'pauseLicense' || action === 'unpauseLicense') {
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref)
        if (!snapshot.exists) throw new Error('NOT_FOUND')
        const item = snapshot.data() ?? {}
        if (action === 'pauseLicense') {
          const remaining = item.status === 'active' && item.expiresAt?.toMillis ? Math.max(0, item.expiresAt.toMillis() - now.toMillis()) : null
          transaction.update(ref, { status: 'paused', pausedAt: now, pausedRemainingMs: remaining, updatedAt: now })
        } else {
          const remaining = Number(item.pausedRemainingMs ?? 0)
          if (item.activatedAt && remaining > 0) transaction.update(ref, { status: 'active', expiresAt: Timestamp.fromMillis(now.toMillis() + remaining), pausedAt: null, pausedRemainingMs: null, updatedAt: now })
          else transaction.update(ref, { status: item.activatedAt ? 'expired' : 'ready', pausedAt: null, pausedRemainingMs: null, updatedAt: now })
        }
      })
    } else if (action === 'blockLicense' || action === 'unblockLicense') {
      const snapshot = await requireDocument(ref)
      const item = snapshot.data() ?? {}
      await ref.update(action === 'blockLicense'
        ? { status: 'blocked', blockedFromStatus: item.status ?? 'ready', blockedAt: now, updatedAt: now }
        : { status: item.blockedFromStatus ?? 'ready', blockedFromStatus: FieldValue.delete(), blockedAt: null, updatedAt: now })
    } else if (action === 'deleteLicense') {
      await requireDocument(ref)
      const bindings = await db.collection('licenseDevices').where('licenseId', '==', id).get()
      await audit(id, 'deleted')
      const batch = db.batch()
      bindings.docs.forEach(binding => batch.delete(binding.ref))
      batch.delete(ref)
      await batch.commit()
      return json(res, 200, { ok: true, deleted: true, id })
    } else if (action === 'addDays' || action === 'removeDays') {
      const amount = Math.max(1, Math.abs(Number(payload.days ?? payload.amount ?? 0)))
      const delta = (action === 'addDays' ? 1 : -1) * amount * 86400000
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref)
        if (!snapshot.exists) throw new Error('NOT_FOUND')
        const item = snapshot.data() ?? {}
        const updates: Record<string, unknown> = { durationDays: Math.max(1, Number(item.durationDays ?? 1) + (action === 'addDays' ? amount : -amount)), updatedAt: now }
        if (item.status === 'active' && item.expiresAt?.toMillis) updates.expiresAt = Timestamp.fromMillis(Math.max(now.toMillis(), item.expiresAt.toMillis() + delta))
        if (item.status === 'paused' && item.pausedRemainingMs != null) updates.pausedRemainingMs = Math.max(0, Number(item.pausedRemainingMs) + delta)
        transaction.update(ref, updates)
      })
    } else if (action === 'resetDevice') {
      await requireDocument(ref)
      const bindings = await db.collection('licenseDevices').where('licenseId', '==', id).get()
      const batch = db.batch()
      bindings.docs.forEach(binding => batch.delete(binding.ref))
      batch.update(ref, { devicesUsed: 0, deviceResetAt: now, updatedAt: now })
      await batch.commit()
    } else if (action === 'pauseAdmin' || action === 'unpauseAdmin') {
      await requireDocument(ref)
      await ref.update({ status: action === 'pauseAdmin' ? 'paused' : 'active', updatedAt: now })
    } else if (action === 'blockAdmin' || action === 'unblockAdmin') {
      const snapshot = await requireDocument(ref)
      const item = snapshot.data() ?? {}
      await ref.update(action === 'blockAdmin'
        ? { status: 'blocked', blockedFromStatus: item.status ?? 'active', blockedAt: now, updatedAt: now }
        : { status: item.blockedFromStatus ?? 'active', blockedFromStatus: FieldValue.delete(), blockedAt: null, updatedAt: now })
    } else if (action === 'deleteAdmin') {
      await requireDocument(ref)
      await audit(id, 'deleted')
      await ref.delete()
      return json(res, 200, { ok: true, deleted: true, id })
    } else if (action === 'addCredits' || action === 'removeCredits') {
      await requireDocument(ref)
      const amount = Math.max(1, Math.abs(Number(payload.amount ?? 0)))
      await ref.update({ credits: FieldValue.increment((action === 'addCredits' ? 1 : -1) * amount), updatedAt: now })
    } else if (action === 'blockDevice' || action === 'unblockDevice') {
      const deviceId = String(payload.deviceId ?? '')
      const deviceHash = String(payload.deviceHash ?? (deviceId ? createHash('sha256').update(`device:${deviceId}`).digest('hex') : ''))
      if (!deviceHash) return json(res, 400, { error: 'DISPOSITIVO_OBRIGATÓRIO' })
      const deviceRef = db.collection('blockedDevices').doc(deviceHash)
      if (action === 'blockDevice') await deviceRef.set({ deviceHash, reason: 'Bloqueado pelo Dono', createdBy: actor.uid, createdAt: now, status: 'blocked' })
      else await deviceRef.delete()
    } else if (action === 'blockIP' || action === 'unblockIP') {
      const ip = String(payload.ip ?? '')
      if (!ip) return json(res, 400, { error: 'IP_OBRIGATÓRIO' })
      const ipRef = db.collection('blockedIPs').doc(hashIP(ip))
      if (action === 'blockIP') await ipRef.set({ ipHash: hashIP(ip), reason: 'Bloqueado pelo Dono', createdBy: actor.uid, createdAt: now, status: 'blocked' })
      else await ipRef.delete()
    } else {
      return json(res, 400, { error: 'AÇÃO_DESCONHECIDA' })
    }

    await audit(id)
    return json(res, 200, { ok: true, id })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    console.error('owner_action_failed', code)
    const status = code === 'FORBIDDEN' ? 403 : code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : 500
    return json(res, status, { error: code })
  }
}
