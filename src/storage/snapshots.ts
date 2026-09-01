import { exportBackup, type BackupData } from './backup'
import type { JobConsoleDb } from './db'

export const KEEP_SNAPSHOTS = 5

export async function createSnapshot(db: JobConsoleDb, label: string): Promise<void> {
  const file = await exportBackup(db)
  await db.snapshots.add({ createdAt: file.exportedAt, label, data: JSON.stringify(file.data) })
  const all = await db.snapshots.orderBy('id').toArray()
  const excess = all.length - KEEP_SNAPSHOTS
  if (excess > 0) {
    await db.snapshots.bulkDelete(all.slice(0, excess).map((s) => s.id!))
  }
}

export async function listSnapshots(
  db: JobConsoleDb,
): Promise<Array<{ id: number; createdAt: string; label: string; data: BackupData }>> {
  const rows = await db.snapshots.orderBy('id').reverse().toArray()
  return rows.map((r) => ({
    id: r.id!,
    createdAt: r.createdAt,
    label: r.label,
    data: JSON.parse(r.data) as BackupData,
  }))
}
