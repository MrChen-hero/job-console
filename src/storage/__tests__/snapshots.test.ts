import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../backup'
import { createDb } from '../db'
import { newId } from '../types'
import { makeApp } from './fixtures'
import { KEEP_SNAPSHOTS, createSnapshot, listSnapshots } from '../snapshots'

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
})
