import { createHash, randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { db, FieldValue, json, requireOwner } from '../_lib/firebaseAdmin.js'

type NextApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body: unknown }
type NextApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }

const hashKey = (value: string) => createHash('sha256').update(`${process.env.LICENSE_PEPPER ?? 'configure-me'}:${value}`).digest('hex')
const makeKey = (prefix: string) => `${prefix.replace(/[^A-Z0-9-]/gi, '').toUpperCase()}-${randomBytes(6).toString('hex').toUpperCase()}`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' })
  try {
    const actor = await requireOwner(req)
    if (!db) throw new Error('BACKEND_NOT_CONFIGURED')
    const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body && typeof req.body === 'object' ? req.body : {})
    const { action, payload = {} } = parsedBody as { action?: string; payload?: Record<string, unknown> }
    const now = Timestamp.now()
    const audit = (target: string, result = 'success') => db!.collection('auditEvents').add({ action, actor: actor.uid, target, result, createdAt: FieldValue.serverTimestamp() })
    if (action === 'toggleGlobal') {
      const ref = db.collection('systemFlags').doc('global')
      const current = await ref.get()
      await ref.set({ globalPaused: !Boolean(current.data()?.globalPaused), updatedAt: now }, { merge: true })
      await audit('systemFlags/global')
      return json(res, 200, { ok: true })
    }
    if (action === 'generateAdmin' || action === 'generateLicense') {
      const rawKey = makeKey(String(payload.prefix ?? (action === 'generateAdmin' ? 'ADMIN' : 'EXTERNAL')))
      const isAdmin = action === 'generateAdmin'
      const ref = await db.collection(isAdmin ? 'adminAccess' : 'licenses').add({ keyHash: hashKey(rawKey), keyPreview: `${rawKey.slice(0, 6)}•••${rawKey.slice(-4)}`, createdBy: actor.uid, status: isAdmin ? 'active' : 'ready', credits: isAdmin ? Number(payload.credits ?? 0) : 0, durationDays: Number(payload.days ?? 30), devices: Number(payload.devices ?? 1), devicesUsed: 0, activatedAt: null, expiresAt: null, pausedRemainingMs: null, createdAt: now })
      await audit(ref.id)
      return json(res, 200, { ok: true, key: rawKey, id: ref.id })
    }
    const id = String(payload.id ?? '')
    if (!id) return json(res, 400, { error: 'ID obrigatório.' })
    const isAdminAction = ['pauseAdmin', 'unpauseAdmin', 'deleteAdmin', 'addCredits'].includes(action ?? '')
    const collection = isAdminAction ? 'adminAccess' : 'licenses'
    const ref = db.collection(collection).doc(id)
    if (action === 'pauseLicense' || action === 'unpauseLicense') {
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref)
        const item = snap.data() ?? {}
        if (action === 'pauseLicense') {
          const remaining = item.status === 'active' && item.expiresAt?.toMillis ? Math.max(0, item.expiresAt.toMillis() - now.toMillis()) : null
          transaction.update(ref, { status: 'paused', pausedAt: now, pausedRemainingMs: remaining, updatedAt: now })
        } else {
          const remaining = Number(item.pausedRemainingMs ?? 0)
          if (item.activatedAt && remaining > 0) transaction.update(ref, { status: 'active', expiresAt: Timestamp.fromMillis(now.toMillis() + remaining), pausedAt: null, pausedRemainingMs: null, updatedAt: now })
          else transaction.update(ref, { status: item.activatedAt ? 'expired' : 'ready', pausedAt: null, pausedRemainingMs: null, updatedAt: now })
        }
      })
    } else if (action === 'resetDevice') {
      const bindings = await db.collection('licenseDevices').where('licenseId', '==', id).get()
      const batch = db.batch()
      bindings.docs.forEach(binding => batch.delete(binding.ref))
      batch.update(ref, { devicesUsed: 0, deviceResetAt: now, updatedAt: now })
      await batch.commit()
    } else if (action === 'pauseAdmin' || action === 'unpauseAdmin') await ref.update({ status: action === 'pauseAdmin' ? 'paused' : 'active', updatedAt: now })
    else if (action === 'deleteAdmin' || action === 'deleteLicense') await ref.update({ status: 'deleted', deletedAt: now, updatedAt: now })
    else if (action === 'addCredits') await ref.update({ credits: FieldValue.increment(Number(payload.amount ?? 0)), updatedAt: now })
    else if (action === 'blockDevice') await db.collection('blockedDevices').doc(String(payload.deviceId)).set({ reason: 'Bloqueado pelo Dono', createdBy: actor.uid, createdAt: now })
    else return json(res, 400, { error: 'Ação desconhecida.' })
    await audit(id)
    return json(res, 200, { ok: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    console.error('owner_action_failed', code)
    return json(res, code === 'FORBIDDEN' ? 403 : code === 'UNAUTHORIZED' ? 401 : 500, { error: code })
  }
}
