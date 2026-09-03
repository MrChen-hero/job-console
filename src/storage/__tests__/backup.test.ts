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
      expect(file.data.libraryCategories).toEqual([])
      expect(file.data.runtimeProjects).toEqual([])
      expect(file.data.deletedDocs).toEqual([])
    } finally {
      await db.delete()
    }
  })

  it('v3 新表（自定义分类 / 运行时项目）在导出与导入之间往返', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.libraryCategories.bulkPut([{ name: '行为面' }, { name: '复盘' }])
      await db.runtimeProjects.put({
        id: 'proj-1', title: '我的项目', eyebrow: '独立开发', accent: 'teal',
        summary: '简介', stack: ['Vue'], demo: { title: '演示页', points: ['要点'] },
        createdAt: '2026-09-02', updatedAt: '2026-09-02',
      })
      await db.runtimeProjects.put({
        id: 'organs-system', title: '隐藏的内置项目', eyebrow: 'x', accent: 'violet',
        summary: 'x', stack: [], demo: { title: 'x', points: [] }, hidden: true,
        createdAt: '2026-09-02', updatedAt: '2026-09-02',
      })
      const file = await exportBackup(db)
      expect(validateBackup(file).ok).toBe(true)
      expect(file.data.libraryCategories).toHaveLength(2)
      expect(file.data.runtimeProjects).toHaveLength(2)
      await db.deletedDocs.bulkPut([{ id: 'java-notes' }])
      const withDeleted = await exportBackup(db)
      expect(validateBackup(withDeleted).ok).toBe(true)
      expect(withDeleted.data.deletedDocs).toEqual([{ id: 'java-notes' }])
      const restored2 = createDb(`restore2-${newId()}`)
      await importBackup(restored2, withDeleted, 'overwrite')
      expect(await restored2.deletedDocs.get('java-notes')).toBeDefined()
      await restored2.delete()
      const restored = createDb(`restore-${newId()}`)
      await importBackup(restored, file, 'overwrite')
      expect(await restored.libraryCategories.toArray()).toEqual(
        expect.arrayContaining([{ name: '行为面' }, { name: '复盘' }]),
      )
      const projects = await restored.runtimeProjects.toArray()
      expect(projects.find((p) => p.id === 'organs-system')?.hidden).toBe(true)
      await restored.delete()
    } finally {
      await db.delete()
    }
  })

  it('删除内置演示的墓碑行（html 为空串）能通过校验并往返', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.runtimeDemos.put({
        id: 'campus-market--review-flow', projectId: 'campus-market', title: '审核状态机',
        html: '', hidden: true, createdAt: '2026-09-03', updatedAt: '2026-09-03',
      })
      const file = await exportBackup(db)
      // 导出产物必须能被自己的校验接受，否则「删过内置演示」的用户导不回自己的备份
      expect(validateBackup(file).ok).toBe(true)
      const restored = createDb(`restore-${newId()}`)
      await importBackup(restored, file, 'overwrite')
      expect((await restored.runtimeDemos.get('campus-market--review-flow'))?.hidden).toBe(true)
      await restored.delete()
    } finally {
      await db.delete()
    }
  })

  it('非墓碑的演示行仍要求 html 非空', () => {
    const result = validateBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-09-03T00:00:00.000Z',
      data: {
        profile: [], resumeVersions: [], applications: [], companyPool: [], libraryDocs: [],
        milestones: [],
        runtimeDemos: [{ id: 'd1', projectId: 'p1', title: '空演示', html: '' }],
        libraryCategories: [], runtimeProjects: [], deletedDocs: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((i) => i.path)).toContain('$.data.runtimeDemos[0].html')
    }
  })

  it('profile 行缺条目数组时被拒绝（否则简历页渲染期崩）', () => {
    const result = validateBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-09-02T00:00:00.000Z',
      data: {
        profile: [{ id: 'v1', basic: { name: '王小明' } }],
        resumeVersions: [], applications: [],
        companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [],
        libraryCategories: [], runtimeProjects: [], deletedDocs: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path)
      expect(paths).toContain('$.data.profile[0].education')
      expect(paths).toContain('$.data.profile[0].selfEvaluation')
    }
  })

  it('resumeVersions 行缺 sections/name 时被拒绝', () => {
    const result = validateBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-09-02T00:00:00.000Z',
      data: {
        profile: [],
        resumeVersions: [{ id: 'v1' }],
        applications: [], companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [],
        libraryCategories: [], runtimeProjects: [], deletedDocs: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path)
      expect(paths).toContain('$.data.resumeVersions[0].name')
      expect(paths).toContain('$.data.resumeVersions[0].sections')
    }
  })

  it('导出产物自身恒能通过校验（含资料池与版本）', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.resumeVersions.put({
        id: 'v1', name: 'AI 岗版', targetRole: '', sections: [],
        createdAt: '2026-09-02', updatedAt: '2026-09-02',
      })
      await db.profile.put({
        id: 'v1', basic: { name: '王小明' }, education: [], skills: [], experiences: [],
        projects: [], awards: [], selfEvaluation: [], updatedAt: '2026-09-02',
      })
      await db.applications.add(makeApp())
      const file = await exportBackup(db)
      const result = validateBackup(file)
      expect(result.ok).toBe(true)
    } finally {
      await db.delete()
    }
  })

  it('runtimeProjects 缺 id/title 时被校验拒绝', () => {
    const result = validateBackup({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-09-02T00:00:00.000Z',
      data: {
        profile: [], resumeVersions: [], applications: [],
        companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [],
        libraryCategories: [],
        runtimeProjects: [{ title: '缺 id' }],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((i) => i.path)).toContain('$.data.runtimeProjects[0].id')
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

  it('旧备份里的旧投向名在导入时归一为新四档', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      const seed = createDb(`seed-${newId()}`)
      const file = await exportBackup(seed)
      await seed.delete()
      // 旧备份的形态：投向存的是已从 TRACKS 删掉的旧名，类型上不再存在
      file.data.applications = [
        { ...makeApp({ id: 'a1' }), track: '保底' },
        { ...makeApp({ id: 'a2' }), track: '机会型' },
        { ...makeApp({ id: 'a3' }), track: '主投' },
        makeApp({ id: 'a4' }),
      ] as unknown as typeof file.data.applications
      file.data.companyPool = [
        { id: 'p1', company: '甲公司', track: '保底', createdAt: '2026-09-01' },
      ] as unknown as typeof file.data.companyPool
      // 投向不参与校验，旧名不该让旧备份导不进来
      expect(validateBackup(file).ok).toBe(true)
      await importBackup(db, file, 'overwrite')
      expect((await db.applications.get('a1'))?.track).toBe('次投')
      expect((await db.applications.get('a2'))?.track).toBe('尝试')
      expect((await db.applications.get('a3'))?.track).toBe('主投')
      expect((await db.applications.get('a4'))?.track).toBeUndefined()
      expect((await db.companyPool.get('p1'))?.track).toBe('次投')
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
