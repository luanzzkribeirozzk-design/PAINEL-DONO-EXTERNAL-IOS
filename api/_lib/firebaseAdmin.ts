import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()

let app: ReturnType<typeof initializeApp> | null = null
let initializationError = ''
if (projectId && clientEmail && privateKey) {
  try {
    app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  } catch (error) {
    initializationError = error instanceof Error ? error.name : 'INVALID_FIREBASE_CREDENTIALS'
  }
}
export const adminReady = Boolean(app)
export const adminAuth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export { FieldValue }

export async function requireOwner(req: { headers: Record<string, string | string[] | undefined> }) {
  if (!adminAuth || !db) throw new Error(initializationError ? `BACKEND_INIT_FAILED:${initializationError}` : 'BACKEND_NOT_CONFIGURED')
  const header = req.headers.authorization ?? req.headers.Authorization
  const token = Array.isArray(header) ? header[0] : header
  if (!token?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED')
  const decoded = await adminAuth.verifyIdToken(token.slice(7))
  if (!process.env.OWNER_UID || decoded.uid !== process.env.OWNER_UID) throw new Error('FORBIDDEN')
  return decoded
}

export function json(res: { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void }, status: number, body: unknown) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json(body)
}
