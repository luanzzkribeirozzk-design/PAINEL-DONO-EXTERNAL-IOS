import { db, json, requireOwner } from '../_lib/firebaseAdmin.js'
import { Timestamp } from 'firebase-admin/firestore'

type NextApiRequest = { method?: string; headers: Record<string, string | string[] | undefined> }
type NextApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'MÉTODO_NÃO_PERMITIDO' })
  try {
    await requireOwner(req)
    if (!db) throw new Error('BACKEND_NOT_CONFIGURED')
    const [adminsSnap, licensesSnap, eventsSnap, flagsSnap, bindingsSnap, blockedDevicesSnap, blockedIPsSnap] = await Promise.all([
      db.collection('adminAccess').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('licenses').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('auditEvents').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('systemFlags').doc('global').get(),
      db.collection('licenseDevices').limit(1000).get(),
      db.collection('blockedDevices').limit(1000).get(),
      db.collection('blockedIPs').limit(1000).get(),
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
        key: data.keyPreview ?? data.key ?? '••••',
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
    return json(res, 200, { connected: true, admins: clean(adminsSnap), licenses: clean(licensesSnap), events: clean(eventsSnap), globalPaused: Boolean(flagsSnap.data()?.globalPaused) })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return json(res, code === 'FORBIDDEN' ? 403 : code === 'UNAUTHORIZED' ? 401 : 500, { error: code })
  }
}
