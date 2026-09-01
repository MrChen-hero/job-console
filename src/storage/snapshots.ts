import { BACKUP_SCHEMA_VERSION, exportBackup, importBackup, type BackupData, type BackupFile } from './backup'
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

export interface SnapshotEntry {
  id: number
  createdAt: string
  label: string
  data: BackupData
}

export async function listSnapshots(db: JobConsoleDb): Promise<SnapshotEntry[]> {
  const rows = await db.snapshots.orderBy('id').reverse().toArray()
  return rows.map((r) => ({
    id: r.id!,
    createdAt: r.createdAt,
    label: r.label,
    data: normalizeData(JSON.parse(r.data) as Partial<BackupData>),
  }))
}

/**
 * 补齐快照缺失的表：旧版本写入的快照没有后续新增的表（如 v3 快照无 deletedDocs），
 * 直接喂给 bulkPut 会抛错。快照是内部数据不走 validateBackup，故在此兜底。
 */
function normalizeData(data: Partial<BackupData>): BackupData {
  return {
    profile: data.profile ?? [],
    resumeVersions: data.resumeVersions ?? [],
    applications: data.applications ?? [],
    companyPool: data.companyPool ?? [],
    libraryDocs: data.libraryDocs ?? [],
    milestones: data.milestones ?? [],
    runtimeDemos: data.runtimeDemos ?? [],
    libraryCategories: data.libraryCategories ?? [],
    runtimeProjects: data.runtimeProjects ?? [],
    deletedDocs: data.deletedDocs ?? [],
  }
}

/**
 * 回退到指定快照（整库覆盖）。importBackup 的 overwrite 会先自动存一份当前数据快照，
 * 因此「回退」本身也可再回退。快照不存在时返回 false。
 */
export async function restoreSnapshot(db: JobConsoleDb, id: number): Promise<boolean> {
  const row = await db.snapshots.get(id)
  if (!row) return false
  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: row.createdAt,
    data: normalizeData(JSON.parse(row.data) as Partial<BackupData>),
  }
  await importBackup(db, file, 'overwrite')
  return true
}

/** 快照内容摘要：给回退确认用的「有多少东西」概览 */
export function summarizeSnapshot(data: BackupData): string {
  const parts: Array<[string, number]> = [
    ['投递', data.applications.length],
    ['简历版本', data.resumeVersions.length],
    ['材料', data.libraryDocs.length],
    ['候选公司', data.companyPool.length],
    ['里程碑', data.milestones.length],
  ]
  const shown = parts.filter(([, n]) => n > 0).map(([label, n]) => `${label} ${n}`)
  return shown.length > 0 ? shown.join(' · ') : '空数据'
}
