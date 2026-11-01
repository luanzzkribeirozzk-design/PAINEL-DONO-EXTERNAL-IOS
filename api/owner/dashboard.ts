import { db, json, requireOwner } from '../_lib/firebaseAdmin.js'
import { Timestamp } from 'firebase-admin/firestore'

type NextApiRequest = { method?: string; headers: Record<string, string | string[] | undefined> }
type NextApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' })
  try {
    await requireOwner(req)
    if (!db) throw new Error('BACKEND_NOT_CONFIGURED')
    const [adminsSnap, licensesSnap, eventsSnap, flagsSnap] = await Promise.all([
      db.collection('adminAccess').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('licenses').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('auditEvents').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('systemFlags').doc('global').get(),
    ])
    const dateValue = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : value ?? null
    const clean = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map(doc => {
      const data = doc.data()
      return { ...data, id: doc.id, key: data.keyPreview ?? data.key ?? '••••', createdAt: dateValue(data.createdAt), expiresAt: dateValue(data.expiresAt), activatedAt: dateValue(data.activatedAt), pausedAt: dateValue(data.pausedAt) }
    })
    return json(res, 200, { connected: true, admins: clean(adminsSnap), licenses: clean(licensesSnap), events: clean(eventsSnap), globalPaused: Boolean(flagsSnap.data()?.globalPaused) })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return json(res, code === 'FORBIDDEN' ? 403 : code === 'UNAUTHORIZED' ? 401 : 500, { error: code })
  }
}
