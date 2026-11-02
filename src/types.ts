export type Status = 'ready' | 'active' | 'paused' | 'blocked' | 'expired' | 'deleted'
export type KeyKind = 'admin' | 'snapchat'

export interface AdminAccess {
  id: string
  key: string
  credits: number
  devices: number
  devicesUsed: number
  status: Status
  createdAt: string
  lastUsedAt?: string
}

export interface SnapchatKey {
  id: string
  key: string
  createdBy: string
  durationDays: number
  devices: number
  devicesUsed: number
  status: Status
  expiresAt: string | null
  createdAt: string
  activatedAt?: string
  pausedRemainingMs?: number
  lastUsedAt?: string
  devicePreview?: string
  deviceBlocked?: boolean
  ip?: string
  ipBlocked?: boolean
  deviceId?: string
}

export interface AuditEvent {
  id: string
  action: string
  actor: string
  target: string
  createdAt: string
  result: 'success' | 'warning' | 'blocked'
}

export interface BulkHistoryEntry {
  id: string
  count: number
  durationDays: number
  devices: number
  createdAt: string
}

export interface DashboardData {
  admins: AdminAccess[]
  licenses: SnapchatKey[]
  events: AuditEvent[]
  bulkHistory: BulkHistoryEntry[]
  globalPaused: boolean
  connected: boolean
}
