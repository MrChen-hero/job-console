import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../backup'
import { createDb } from '../db'
import { newId } from '../types'
import { makeApp } from './fixtures'
import { KEEP_SNAPSHOTS, createSnapshot, listSnapshots, restoreSnapshot, summarizeSnapshot } from '../snapshots'

describe('snapshots', () => {
  it('超过保留数时仅留最新 N 份', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      for (let i = 0; i < KEEP_SNAPSHOTS + 2; i++) {
        await createSnapshot(db, `快照 ${i}`)
      }
      const snaps = await listSnapshots(db)
      expect(snaps).toHaveLength(KEEP_SNAPSHOTS)
      expect(snaps[0]!.label).toBe(`快照 ${KEEP_SNAPSHOTS + 1}`) // 最新在前
    } finally {
      await db.delete()
    }
  })

  it('importBackup overwrite 自动创建导入前快照', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.add(makeApp({ company: '导入前数据' }))
      const seed = createDb(`seed-${newId()}`)
      const file = await exportBackup(seed)
      await seed.delete()
      file.data.applications = []
      await importBackup(db, file, 'overwrite')
      const snaps = await db.snapshots.toArray()
      expect(snaps).toHaveLength(1)
      const restored = JSON.parse(snaps[0]!.data) as { applications: Array<{ company: string }> }
      expect(restored.applications).toHaveLength(1)
      expect(restored.applications[0]!.company).toBe('导入前数据')
    } finally {
      await db.delete()
    }
  })

  it('restoreSnapshot 整库回退，并为回退本身再存一份快照', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.add(makeApp({ company: '原始数据' }))
      await createSnapshot(db, '手动快照')
      const [snap] = await listSnapshots(db)
      // 回退前先把数据改成别的样子
      await db.applications.clear()
      await db.applications.add(makeApp({ company: '后来的数据' }))
      expect(await restoreSnapshot(db, snap!.id)).toBe(true)
      const apps = await db.applications.toArray()
      expect(apps).toHaveLength(1)
      expect(apps[0]!.company).toBe('原始数据')
      // 回退动作自身留下「导入前自动快照」，可再回退回「后来的数据」
      const snaps = await listSnapshots(db)
      const auto = snaps.find((x) => x.label === '导入前自动快照')!
      expect(auto).toBeDefined()
      expect(auto.data.applications[0]!.company).toBe('后来的数据')
    } finally {
      await db.delete()
    }
  })

  it('restoreSnapshot：不存在的 id 返回 false，不动数据', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.add(makeApp({ company: '不该被动' }))
      expect(await restoreSnapshot(db, 9999)).toBe(false)
      expect(await db.applications.count()).toBe(1)
      expect(await db.snapshots.count()).toBe(0)
    } finally {
      await db.delete()
    }
  })

  it('旧版快照缺少新增表时仍可回退（缺失表补空数组）', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      // 模拟 v2 时代写入的快照：没有 libraryCategories / runtimeProjects / deletedDocs
      await db.snapshots.add({
        createdAt: '2026-08-31T00:00:00.000Z',
        label: '旧版快照',
        data: JSON.stringify({
          profile: [], resumeVersions: [], applications: [makeApp({ company: '旧库数据' })],
          companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [],
        }),
      })
      const [snap] = await listSnapshots(db)
      expect(snap!.data.deletedDocs).toEqual([])
      expect(await restoreSnapshot(db, snap!.id)).toBe(true)
      const apps = await db.applications.toArray()
      expect(apps[0]!.company).toBe('旧库数据')
    } finally {
      await db.delete()
    }
  })

  it('summarizeSnapshot 概览非空表；全空时给出空数据', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.bulkAdd([makeApp(), makeApp()])
      await createSnapshot(db, 'x')
      const [snap] = await listSnapshots(db)
      expect(summarizeSnapshot(snap!.data)).toBe('投递 2')
      const empty = createDb(`empty-${newId()}`)
      await createSnapshot(empty, 'y')
      const [emptySnap] = await listSnapshots(empty)
      expect(summarizeSnapshot(emptySnap!.data)).toBe('空数据')
      await empty.delete()
    } finally {
      await db.delete()
    }
  })
})
