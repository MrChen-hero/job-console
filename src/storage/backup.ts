import type { Table } from 'dexie'
import type { JobConsoleDb } from './db'
import { createSnapshot } from './snapshots'
import { LEGACY_TRACKS } from './types'
import { validateBackupDetails } from './backupValidation'
import type {
  Application,
  CompanyPoolEntry,
  DeletedDocRow,
  LibraryCategoryRow,
  LibraryDoc,
  Milestone,
  Profile,
  ResumeVersion,
  RuntimeDemo,
  RuntimeProject,
} from './types'

export const BACKUP_SCHEMA_VERSION = 4

export interface BackupData {
  profile: Profile[]
  resumeVersions: ResumeVersion[]
  applications: Application[]
  companyPool: CompanyPoolEntry[]
  libraryDocs: LibraryDoc[]
  milestones: Milestone[]
  /** v2：运行时上传的交互式 HTML 演示页 */
  runtimeDemos: RuntimeDemo[]
  /** v3：材料库自定义分类 */
  libraryCategories: LibraryCategoryRow[]
  /** v3：演示站运行时项目（含内置项目的覆盖行与隐藏墓碑） */
  runtimeProjects: RuntimeProject[]
  /** v4：已删除内置文档的墓碑 */
  deletedDocs: DeletedDocRow[]
}

export interface BackupFile {
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export async function exportBackup(db: JobConsoleDb): Promise<BackupFile> {
  const [profile, resumeVersions, applications, companyPool, libraryDocs, milestones, runtimeDemos, libraryCategories, runtimeProjects, deletedDocs] =
    await Promise.all([
      db.profile.toArray(),
      db.resumeVersions.toArray(),
      db.applications.toArray(),
      db.companyPool.toArray(),
      db.libraryDocs.toArray(),
      db.milestones.toArray(),
      db.runtimeDemos.toArray(),
      db.libraryCategories.toArray(),
      db.runtimeProjects.toArray(),
      db.deletedDocs.toArray(),
    ])
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { profile, resumeVersions, applications, companyPool, libraryDocs, milestones, runtimeDemos, libraryCategories, runtimeProjects, deletedDocs },
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
  const tableKeys = ['profile', 'resumeVersions', 'applications', 'companyPool', 'libraryDocs', 'milestones', 'runtimeDemos', 'libraryCategories', 'runtimeProjects', 'deletedDocs'] as const
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
      // html 只校验类型不校验非空：删除内置演示的墓碑行 html 恒为空串（见 RuntimeDemo.hidden），
      // 链接式演示的内容也在 url 而非 html。非墓碑行要求「html 与 url 至少有一个有内容」。
      // 不升 BACKUP_SCHEMA_VERSION：升了会让用户手里的旧 v4 备份反而导不进来。
      if (typeof rec.html !== 'string') issues.push({ path: `${path}.html`, message: '必须是字符串' })
      if (rec.url !== undefined && typeof rec.url !== 'string') {
        issues.push({ path: `${path}.url`, message: '必须是字符串' })
      }
      if (rec.points !== undefined) requireStringArray(rec, 'points', path, issues)
      if (rec.hidden !== true) {
        const html = typeof rec.html === 'string' ? rec.html.trim() : ''
        const url = typeof rec.url === 'string' ? rec.url.trim() : ''
        if (html === '' && url === '') {
          issues.push({ path, message: 'html 与 url 至少要有一个' })
        }
      }
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
  if (Array.isArray(rows.profile)) {
    rows.profile.forEach((profile, i) => {
      const path = `$.data.profile[${i}]`
      if (!isRecord(profile as unknown)) {
        issues.push({ path, message: '必须是对象' })
        return
      }
      const rec = profile as unknown as Record<string, unknown>
      requireString(rec, 'id', path, issues)
      if (!isRecord(rec.basic)) issues.push({ path: `${path}.basic`, message: '必须是对象' })
      // 五类条目与自评必须是数组：简历渲染直接遍历它们，缺字段会让简历页崩在渲染期
      for (const key of ['education', 'skills', 'experiences', 'projects', 'awards', 'selfEvaluation']) {
        if (!Array.isArray(rec[key])) issues.push({ path: `${path}.${key}`, message: '必须是数组' })
      }
    })
  }
  if (Array.isArray(rows.resumeVersions)) {
    rows.resumeVersions.forEach((version, i) => {
      const path = `$.data.resumeVersions[${i}]`
      if (!isRecord(version as unknown)) {
        issues.push({ path, message: '必须是对象' })
        return
      }
      const rec = version as unknown as Record<string, unknown>
      requireString(rec, 'id', path, issues)
      requireString(rec, 'name', path, issues)
      if (!Array.isArray(rec.sections)) issues.push({ path: `${path}.sections`, message: '必须是数组' })
    })
  }
  if (Array.isArray(rows.runtimeProjects)) {
    rows.runtimeProjects.forEach((proj, i) => {
      const path = `$.data.runtimeProjects[${i}]`
      if (!isRecord(proj as unknown)) {
        issues.push({ path, message: '必须是对象' })
        return
      }
      const rec = proj as unknown as Record<string, unknown>
      requireString(rec, 'id', path, issues)
      requireString(rec, 'title', path, issues)
    })
  }
  validateBackupDetails(data, issues)
  if (issues.length) return { ok: false, issues }
  return { ok: true, file: raw as unknown as BackupFile }
}

/* ---------- 导入 ---------- */

export type ImportMode = 'merge' | 'overwrite'

/**
 * 旧投向名归一（保底 → 次投、机会型 → 尝试）。Dexie v6 只升级本机库，
 * 导入的旧备份与旧快照仍带旧名，落库后会指向不存在的投向（筛选选不到），故在导入这一层改写。
 * 不改 BACKUP_SCHEMA_VERSION：投向不参与 validateBackup，旧备份仍应导得进来。
 */
function withMigratedTracks(data: BackupData): BackupData {
  return {
    ...data,
    applications: data.applications.map((app) => {
      const next = app.track ? LEGACY_TRACKS[app.track] : undefined
      return next ? { ...app, track: next } : app
    }),
    companyPool: data.companyPool.map((entry) => {
      const next = LEGACY_TRACKS[entry.track]
      return next ? { ...entry, track: next } : entry
    }),
  }
}

/**
 * merge：按主键逐表 put（id/name 冲突时整条以导入方为准，不合并字段；已有但未出现在导入中的记录保留）。
 * overwrite：清空数据表后整体灌入；snapshots 表不被清空，仅追加一条导入前自动快照。
 */
export async function importBackup(db: JobConsoleDb, file: BackupFile, mode: ImportMode): Promise<void> {
  const result = validateBackup(file)
  if (!result.ok) throw new Error(result.issues.map((issue) => `${issue.path}：${issue.message}`).join('\n'))
  const data = withMigratedTracks(file.data)
  const tables = [
    db.profile,
    db.resumeVersions,
    db.applications,
    db.companyPool,
    db.libraryDocs,
    db.milestones,
    db.runtimeDemos,
    db.libraryCategories,
    db.runtimeProjects,
    db.deletedDocs,
  ] as const
  const rows = [
    data.profile,
    data.resumeVersions,
    data.applications,
    data.companyPool,
    data.libraryDocs,
    data.milestones,
    data.runtimeDemos,
    data.libraryCategories,
    data.runtimeProjects,
    data.deletedDocs,
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

/** 各表与其行数组的运行期配对；运行时表-数据总是同序，此处仅做类型层面的放宽。 */
function pairTables(
  tables: readonly Table<unknown, string>[],
  rows: readonly (readonly unknown[])[],
): Array<[Table<unknown, string>, readonly unknown[]]> {
  return tables.map((table, i) => [table, rows[i]!] as const)
}
