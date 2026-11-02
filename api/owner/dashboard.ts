import { db, json, requireOwner } from '../_lib/firebaseAdmin.js'
import { Timestamp } from 'firebase-admin/firestore'
import { decryptKey } from '../_lib/bulkEncryption.js'

type NextApiRequest = { method?: string; headers: Record<string, string | string[] | undefined> }
type NextApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'MÉTODO_NÃO_PERMITIDO' })
  try {
    if (!db) throw new Error('BACKEND_NOT_CONFIGURED')
    const actor = await requireOwner(req)
    const [adminsSnap, licensesSnap, eventsSnap, flagsSnap, bindingsSnap, blockedDevicesSnap, blockedIPsSnap, bulkSnap] = await Promise.all([
      db.collection('adminAccess').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('licenses').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('auditEvents').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('systemFlags').doc('global').get(),
      db.collection('licenseDevices').limit(1000).get(),
      db.collection('blockedDevices').limit(1000).get(),
      db.collection('blockedIPs').limit(1000).get(),
      db.collection('bulkKeyBatches').where('ownerType', '==', 'owner').where('ownerId', '==', actor.uid).limit(100).get().catch(() => ({ docs: [] as never[] })),
    ])
    const dateValue = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : value ?? null
    const bindingsByLicense = new Map<string, FirebaseFirestore.DocumentData[]>()
    const blockedDeviceHashes = new Set(blockedDevicesSnap.docs.map(doc => doc.id))
    const blockedIPHashes = new Set(blockedIPsSnap.docs.map(doc => doc.id))
    bindingsSnap.docs.forEach(doc => {
      const data = doc.data()
      const list = bindingsByLicense.get(String(data.licenseId)) ?? []
      list.push(data)
      bindingsByLicense.set(String(data.licenseId), list)
    })
    const clean = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map(doc => {
      const data = doc.data()
      const bindings = bindingsByLicense.get(doc.id) ?? []
      const firstBinding = bindings[0] ?? {}
      return {
        ...data,
        id: doc.id,
        key: data.encryptedKey ? decryptKey(String(data.encryptedKey)) : data.key ?? data.keyPreview ?? '••••',
        createdAt: dateValue(data.createdAt),
        expiresAt: dateValue(data.expiresAt),
        activatedAt: dateValue(data.activatedAt),
        pausedAt: dateValue(data.pausedAt),
        lastUsedAt: dateValue(data.lastUsedAt ?? firstBinding.lastUsedAt),
        deviceId: data.deviceId ?? firstBinding.deviceHash ?? null,
        devicePreview: data.devicePreview ?? firstBinding.devicePreview ?? null,
        deviceBlocked: Boolean((data.deviceId ?? firstBinding.deviceHash) && blockedDeviceHashes.has(String(data.deviceId ?? firstBinding.deviceHash))),
        ip: data.ip ?? firstBinding.ip ?? null,
        ipBlocked: Boolean((data.ipHash ?? firstBinding.ipHash) && blockedIPHashes.has(String(data.ipHash ?? firstBinding.ipHash))),
        deviceCount: bindings.length,
      }
    })
    const bulkHistory = bulkSnap.docs.map(doc => { const value = doc.data(); return { id: doc.id, count: Number(value.count ?? 0), durationDays: Number(value.durationDays ?? 0), devices: Number(value.devices ?? 1), createdAt: String(dateValue(value.createdAt) ?? '') } }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return json(res, 200, { connected: true, admins: clean(adminsSnap), licenses: clean(licensesSnap), events: clean(eventsSnap), bulkHistory, globalPaused: Boolean(flagsSnap.data()?.globalPaused) })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return json(res, code === 'FORBIDDEN' ? 403 : code === 'UNAUTHORIZED' ? 401 : 500, { error: code })
  }
}
