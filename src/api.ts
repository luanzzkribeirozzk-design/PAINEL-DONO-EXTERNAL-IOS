import type { DashboardData } from './types'

const mock: DashboardData = {
  connected: false,
  globalPaused: false,
  admins: [
    { id: 'adm-01', key: 'KEY-LN8Q2M4P7X', credits: 42, devices: 1, devicesUsed: 1, status: 'active', createdAt: '2026-10-31T18:40:00Z', lastUsedAt: '2026-10-31T21:10:00Z' },
    { id: 'adm-02', key: 'KEY-R4D9K2V6T', credits: 8, devices: 2, devicesUsed: 0, status: 'paused', createdAt: '2026-10-29T12:20:00Z' },
  ],
  licenses: [
    { id: 'lic-01', key: 'EXTERNAL-4FQ8A2L9ZC', createdBy: 'Admin LN', durationDays: 30, devices: 2, devicesUsed: 1, status: 'active', expiresAt: '2026-11-30T12:00:00Z', createdAt: '2026-10-31T21:30:00Z', ip: '177.•••.•••.42', deviceId: 'inst_9f2•••' },
    { id: 'lic-02', key: 'EXTERNAL-7K3M1P8QWD', createdBy: 'Dono', durationDays: 7, devices: 1, devicesUsed: 0, status: 'paused', expiresAt: '2026-11-07T09:15:00Z', createdAt: '2026-10-31T20:55:00Z' },
    { id: 'lic-03', key: 'EXTERNAL-2J8V5N0RLA', createdBy: 'Admin LN', durationDays: 120, devices: 3, devicesUsed: 2, status: 'active', expiresAt: '2027-02-28T08:00:00Z', createdAt: '2026-10-31T19:40:00Z' },
  ],
  events: [
    { id: 'evt-01', action: 'Key Snapchat gerada', actor: 'Dono', target: 'EXTERNAL-4FQ8A2L9ZC', createdAt: '2026-10-31T21:30:00Z', result: 'success' },
    { id: 'evt-02', action: 'Créditos adicionados', actor: 'Dono', target: 'Admin LN · +20', createdAt: '2026-10-31T20:42:00Z', result: 'success' },
    { id: 'evt-03', action: 'Acesso pausado', actor: 'Dono', target: 'KEY-R4D9K2V6T', createdAt: '2026-10-31T20:10:00Z', result: 'warning' },
  ],
  bulkHistory: [],
}

export function getMockData() { return structuredClone(mock) }

export async function fetchDashboard(token: string): Promise<DashboardData> {
  const response = await fetch('/api/owner/dashboard', { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `BACKEND_HTTP_${response.status}`)
  }
  return response.json() as Promise<DashboardData>
}

export async function runOwnerAction(token: string, action: string, payload: Record<string, unknown>) {
  const response = await fetch('/api/owner/action', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `BACKEND_HTTP_${response.status}`)
  }
  return response.json()
}
