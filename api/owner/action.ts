import { createHash, randomBytes } from 'node:crypto'
import { db, FieldValue, json, requireOwner } from '../_lib/firebaseAdmin'

type NextApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body: unknown }
type NextApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }

const hashKey = (value: string) => createHash('sha256').update(`${process.env.LICENSE_PEPPER ?? 'configure-me'}:${value}`).digest('hex')
const makeKey = (prefix: string) => `${prefix.replace(/[^A-Z0-9-]/gi, '').toUpperCase()}-${randomBytes(6).toString('hex').toUpperCase()}`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' })
  try {
    const actor = await requireOwner(req)
    if (!db) throw new Error('BACKEND_NOT_CONFIGURED')
    const { action, payload = {} } = req.body as { action?: string; payload?: Record<string, unknown> }
    const now = FieldValue.serverTimestamp()
    const audit = (target: string, result = 'success') => db!.collection('auditEvents').add({ action, actor: actor.uid, target, result, createdAt: now })
    if (action === 'toggleGlobal') {
      const ref = db.collection('systemFlags').doc('global')
      const current = await ref.get()
      await ref.set({ globalPaused: !Boolean(current.data()?.globalPaused), updatedAt: now }, { merge: true })
      await audit('systemFlags/global')
      return json(res, 200, { ok: true })
    }
    const collection = ['pauseAdmin', 'unpauseAdmin', 'deleteAdmin', 'addCredits'].includes(action ?? '') ? 'adminAccess' : 'licenses'
    const id = String(payload.id ?? '')
    if (!id && action !== 'generateAdmin' && action !== 'generateLicense') return json(res, 400, { error: 'ID obrigatório.' })
    if (action === 'generateAdmin' || action === 'generateLicense') {
      const rawKey = makeKey(String(payload.prefix ?? (action === 'generateAdmin' ? 'ADMIN' : 'EXTERNAL')))
      const isAdmin = action === 'generateAdmin'
      const ref = await db.collection(isAdmin ? 'adminAccess' : 'licenses').add({ keyHash: hashKey(rawKey), keyPreview: `${rawKey.slice(0, 6)}•••${rawKey.slice(-4)}`, createdBy: actor.uid, status: 'active', credits: isAdmin ? Number(payload.credits ?? 0) : 0, durationDays: Number(payload.days ?? 30), devices: Number(payload.devices ?? 1), devicesUsed: 0, createdAt: now })
      await audit(ref.id)
      return json(res, 200, { ok: true, key: rawKey, id: ref.id })
    }
    const ref = db.collection(collection).doc(id)
    if (action === 'pauseAdmin' || action === 'unpauseAdmin' || action === 'pauseLicense' || action === 'unpauseLicense') await ref.update({ status: action.includes('pause') && !action.includes('unpause') ? 'paused' : 'active', updatedAt: now })
    else if (action === 'deleteAdmin' || action === 'deleteLicense') await ref.update({ status: 'deleted', deletedAt: now, updatedAt: now })
    else if (action === 'addCredits') await ref.update({ credits: FieldValue.increment(Number(payload.amount ?? 0)), updatedAt: now })
    else if (action === 'blockDevice') await db.collection('blockedDevices').doc(String(payload.deviceId)).set({ reason: 'Bloqueado pelo Dono', createdBy: actor.uid, createdAt: now })
    else return json(res, 400, { error: 'Ação desconhecida.' })
    await audit(id)
    return json(res, 200, { ok: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return json(res, code === 'FORBIDDEN' ? 403 : code === 'UNAUTHORIZED' ? 401 : 500, { error: code })
  }
}
