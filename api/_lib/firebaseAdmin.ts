import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

export const adminReady = Boolean(projectId && clientEmail && privateKey)
const app = adminReady ? (getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })) : null
export const adminAuth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export { FieldValue }

export async function requireOwner(req: { headers: Record<string, string | string[] | undefined> }) {
  if (!adminAuth || !db) throw new Error('BACKEND_NOT_CONFIGURED')
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
