import type { Table } from 'dexie'
import type { JobConsoleDb } from './db'
import { createSnapshot } from './snapshots'
import type {
  Application,
  CompanyPoolEntry,
  LibraryDoc,
  Milestone,
  Profile,
  ResumeVersion,
  RuntimeDemo,
} from './types'

export const BACKUP_SCHEMA_VERSION = 2

export interface BackupData {
  profile: Profile[]
  resumeVersions: ResumeVersion[]
  applications: Application[]
  companyPool: CompanyPoolEntry[]
  libraryDocs: LibraryDoc[]
  milestones: Milestone[]
  /** v2：运行时上传的交互式 HTML 演示页 */
  runtimeDemos: RuntimeDemo[]
}

export interface BackupFile {
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export async function exportBackup(db: JobConsoleDb): Promise<BackupFile> {
  const [profile, resumeVersions, applications, companyPool, libraryDocs, milestones, runtimeDemos] =
    await Promise.all([
      db.profile.toArray(),
      db.resumeVersions.toArray(),
      db.applications.toArray(),
      db.companyPool.toArray(),
      db.libraryDocs.toArray(),
      db.milestones.toArray(),
      db.runtimeDemos.toArray(),
    ])
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { profile, resumeVersions, applications, companyPool, libraryDocs, milestones, runtimeDemos },
  }
}

/* ---------- 校验 ---------- */

export interface ConfigIssue {
  path: string
  message: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function requireString(rec: Record<string, unknown>, key: string, path: string, issues: ConfigIssue[]): void {
  if (typeof rec[key] !== 'string' || (rec[key] as string).trim() === '') {
    issues.push({ path: `${path}.${key}`, message: '缺少必填字符串' })
  }
}

function requireStringArray(rec: Record<string, unknown>, key: string, path: string, issues: ConfigIssue[]): void {
  const v = rec[key]
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    issues.push({ path: `${path}.${key}`, message: '必须是字符串数组' })
  }
}

export function validateBackup(
  raw: unknown,
): { ok: true; file: BackupFile } | { ok: false; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = []
  if (!isRecord(raw)) return { ok: false, issues: [{ path: '$', message: '备份文件必须是 JSON 对象' }] }
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    issues.push({ path: '$.schemaVersion', message: `仅支持 schemaVersion ${BACKUP_SCHEMA_VERSION}` })
  }
  if (typeof raw.exportedAt !== 'string') {
    issues.push({ path: '$.exportedAt', message: '缺少导出时间' })
  }
  if (!isRecord(raw.data)) {
    issues.push({ path: '$.data', message: '缺少 data 对象' })
    return { ok: false, issues }
  }
  const data = raw.data as Record<string, unknown>
  const tableKeys = ['profile', 'resumeVersions', 'applications', 'companyPool', 'libraryDocs', 'milestones', 'runtimeDemos'] as const
  for (const key of tableKeys) {
    if (!Array.isArray(data[key])) issues.push({ path: `$.data.${key}`, message: '必须是数组' })
  }

  const rows = data as unknown as BackupData
  if (Array.isArray(rows.applications)) {
    rows.applications.forEach((app, i) => {
      const path = `$.data.applications[${i}]`
      if (!isRecord(app as unknown)) {
        issues.push({ path, message: '必须是对象' })
        return
      }
      const rec = app as unknown as Record<string, unknown>
      requireString(rec, 'id', path, issues)
      requireString(rec, 'company', path, issues)
      requireString(rec, 'position', path, issues)
      requireString(rec, 'appliedAt', path, issues)
      if (!Array.isArray(rec.stageHistory)) issues.push({ path: `${path}.stageHistory`, message: '必须是数组' })
      if (!Array.isArray(rec.interviews)) issues.push({ path: `${path}.interviews`, message: '必须是数组' })
    })
  }
  if (Array.isArray(rows.runtimeDemos)) {
    rows.runtimeDemos.forEach((demo, i) => {
      const path = `$.data.runtimeDemos[${i}]`
      if (!isRecord(demo as unknown)) {
        issues.push({ path, message: '必须是对象' })
        return
      }
      const rec = demo as unknown as Record<string, unknown>
      requireString(rec, 'id', path, issues)
      requireString(rec, 'projectId', path, issues)
      requireString(rec, 'title', path, issues)
      requireString(rec, 'html', path, issues)
    })
  }
  if (Array.isArray(rows.libraryDocs)) {
    rows.libraryDocs.forEach((doc, i) => {
      const path = `$.data.libraryDocs[${i}]`
      if (!isRecord(doc as unknown)) {
        issues.push({ path, message: '必须是对象' })
        return
      }
      const rec = doc as unknown as Record<string, unknown>
      requireString(rec, 'id', path, issues)
      requireString(rec, 'title', path, issues)
      requireString(rec, 'body', path, issues)
      requireStringArray(rec, 'tags', path, issues)
    })
  }
  if (issues.length) return { ok: false, issues }
  return { ok: true, file: raw as unknown as BackupFile }
}

/* ---------- 导入 ---------- */

export type ImportMode = 'merge' | 'overwrite'

/**
 * merge：按 id 逐表 put（id 冲突时整条以导入方为准，不合并字段；已有但未出现在导入中的记录保留）。
 * overwrite：清空六张数据表后整体灌入；snapshots 表不被清空，仅追加一条导入前自动快照。
 */
export async function importBackup(db: JobConsoleDb, file: BackupFile, mode: ImportMode): Promise<void> {
  const { data } = file
  const tables = [
    db.profile,
    db.resumeVersions,
    db.applications,
    db.companyPool,
    db.libraryDocs,
    db.milestones,
    db.runtimeDemos,
  ] as const
  const rows = [
    data.profile,
    data.resumeVersions,
    data.applications,
    data.companyPool,
    data.libraryDocs,
    data.milestones,
    data.runtimeDemos,
  ] as const

  if (mode === 'overwrite') {
    await db.transaction('rw', [...tables, db.snapshots], async () => {
      await createSnapshot(db, '导入前自动快照')
      for (const table of tables) await table.clear()
      for (const [table, list] of pairTables(tables, rows)) await table.bulkPut(list)
    })
    return
  }
  await db.transaction('rw', tables, async () => {
    for (const [table, list] of pairTables(tables, rows)) await table.bulkPut(list)
  })
}

/** 六张表与各自行数组的运行期配对；运行时表-数据总是同序，此处仅做类型层面的放宽。 */
function pairTables(
  tables: readonly Table<unknown, string>[],
  rows: readonly (readonly unknown[])[],
): Array<[Table<unknown, string>, readonly unknown[]]> {
  return tables.map((table, i) => [table, rows[i]!] as const)
}
