import { readTx } from '../db'
import type { Activity } from '@/domain/types'

export async function listRecentActivity(limit = 20): Promise<Activity[]> {
  return readTx(['activity'], async (tx) => {
    const out: Activity[] = []
    let cursor = await tx.objectStore('activity').index('at').openCursor(null, 'prev')
    while (cursor && out.length < limit) {
      out.push(cursor.value)
      cursor = await cursor.continue()
    }
    return out
  })
}

export async function listActivityForMember(memberId: string, limit = 50): Promise<Activity[]> {
  return readTx(['activity'], async (tx) => {
    const all = await tx.objectStore('activity').getAll()
    return all
      .filter((a) => a.memberId === memberId)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, limit)
  })
}
