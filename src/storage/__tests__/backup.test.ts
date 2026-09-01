import { describe, expect, it } from 'vitest'
import {
  BACKUP_SCHEMA_VERSION,
  exportBackup,
  importBackup,
  validateBackup,
} from '../backup'
import { createDb } from '../db'
import { newId } from '../types'
import { makeApp } from './fixtures'

describe('exportBackup', () => {
  it('导出包含 schemaVersion 与各表数据', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      const app = makeApp()
      await db.applications.add(app)
      const file = await exportBackup(db)
      expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
      expect(file.exportedAt).toBeTruthy()
      expect(file.data.applications).toHaveLength(1)
      expect(file.data.applications[0]).toEqual(app)
      expect(file.data.profile).toEqual([])
      expect(file.data.resumeVersions).toEqual([])
      expect(file.data.companyPool).toEqual([])
      expect(file.data.libraryDocs).toEqual([])
      expect(file.data.milestones).toEqual([])
      expect(file.data.runtimeDemos).toEqual([])
    } finally {
      await db.delete()
    }
  })
})

describe('importBackup', () => {
  it('merge：导入记录按 id 覆盖，已有其他记录保留', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      const kept = makeApp({ company: '保留的公司' })
      const replaced = makeApp({ company: '旧值' })
      await db.applications.bulkAdd([kept, replaced])
      const incoming = makeApp({ id: replaced.id, company: '导入的新值' })
      const empty = createDb(`empty-${newId()}`)
      const file = await exportBackup(empty)
      await empty.delete()
      file.data.applications = [incoming]
      await importBackup(db, file, 'merge')
      const all = await db.applications.toArray()
      expect(all).toHaveLength(2)
      expect(all.find((a) => a.id === replaced.id)?.company).toBe('导入的新值')
      expect(all.find((a) => a.id === kept.id)?.company).toBe('保留的公司')
    } finally {
      await db.delete()
    }
  })

  it('overwrite：清空后整表灌入', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.bulkAdd([makeApp(), makeApp()])
      const seed = createDb(`seed-${newId()}`)
      const file = await exportBackup(seed)
      await seed.delete()
      file.data.applications = [makeApp({ company: '唯一记录' })]
      await importBackup(db, file, 'overwrite')
      const all = await db.applications.toArray()
      expect(all).toHaveLength(1)
      expect(all[0]!.company).toBe('唯一记录')
      // overwrite 创建快照的断言在 Task 10 补充（快照逻辑在 Task 10 实现）
    } finally {
      await db.delete()
    }
  })

  it('非法备份被拒绝并给出字段路径', () => {
    const result = validateBackup({
      schemaVersion: 99,
      data: {
        profile: [], resumeVersions: [], applications: [{ company: '' }],
        companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path)
      expect(paths).toContain('$.schemaVersion')
      expect(paths.some((p) => p.startsWith('$.data.applications[0]'))).toBe(true)
    }
  })

  it('exportedAt 缺失时被拒绝', () => {
    const result = validateBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      data: {
        profile: [], resumeVersions: [], applications: [],
        companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((i) => i.path)).toContain('$.exportedAt')
    }
  })

  it('starred 字段在导出与导入之间往返', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.add(makeApp({ starred: true }))
      const file = await exportBackup(db)
      expect(validateBackup(file).ok).toBe(true)
      expect(file.data.applications[0]!.starred).toBe(true)
      await db.applications.clear()
      await importBackup(db, file, 'overwrite')
      const restored = await db.applications.toArray()
      expect(restored).toHaveLength(1)
      expect(restored[0]!.starred).toBe(true)
    } finally {
      await db.delete()
    }
  })

  it('旧备份缺 starred 字段仍可导入', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      const legacy = makeApp()
      delete (legacy as Partial<typeof legacy>).starred
      const seed = createDb(`seed-${newId()}`)
      const file = await exportBackup(seed)
      await seed.delete()
      file.data.applications = [legacy]
      expect(validateBackup(file).ok).toBe(true)
      await importBackup(db, file, 'overwrite')
      const restored = await db.applications.toArray()
      expect(restored).toHaveLength(1)
      expect(restored[0]!.starred).toBeUndefined()
    } finally {
      await db.delete()
    }
  })
})
