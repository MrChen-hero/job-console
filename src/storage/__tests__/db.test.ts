import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { createDb } from '../db'
import { newId } from '../types'
import { makeApp } from './fixtures'

/** 用旧版 schema 建一个 v3 库并写入数据（模拟升级前用户） */
async function createV3Db(name: string, profileMain: boolean, versionCount: number) {
  const legacy = new Dexie(name)
  legacy.version(3).stores({
    profile: 'id',
    resumeVersions: 'id, updatedAt',
    applications: 'id, status, appliedAt, nextActionAt',
    companyPool: 'id, track',
    libraryDocs: 'id, category, updatedAt',
    libraryCategories: 'name',
    deletedDocs: 'id',
    milestones: 'id, date',
    runtimeDemos: 'id, projectId, updatedAt',
    runtimeProjects: 'id, updatedAt',
    snapshots: '++id, createdAt',
  })
  await legacy.open()
  try {
    if (profileMain) {
      await legacy.table('profile').put({
        id: 'main',
        basic: { name: '王小明' },
        education: [{ id: 'e1', school: '华东理工大学', degree: '硕士', time: '2024-2027' }],
        skills: [],
        experiences: [],
        projects: [],
        awards: [],
        selfEvaluation: [],
        updatedAt: '2026-09-01',
      })
    }
    for (let i = 0; i < versionCount; i++) {
      await legacy.table('resumeVersions').put({
        id: `v${i + 1}`,
        name: `版本${i + 1}`,
        targetRole: '',
        sections: [],
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      })
    }
  } finally {
    await legacy.close()
  }
}

describe('db', () => {
  it('可写入并按状态索引查询 Application', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.bulkAdd([makeApp(), makeApp({ status: '挂' })])
      const active = await db.applications.where('status').equals('已投递').toArray()
      expect(active.length).toBe(1)
      expect(active[0]!.company).toBe('南方电网')
    } finally {
      await db.delete()
    }
  })

  it('v3 → v4 迁移：全局 main 资料池拆分为各版本独立资料池', async () => {
    const name = `test-${newId()}`
    await createV3Db(name, true, 2)
    const db = createDb(name)
    try {
      await db.open()
      expect(await db.profile.get('main')).toBeUndefined()
      expect((await db.profile.get('v1'))?.basic.name).toBe('王小明')
      expect((await db.profile.get('v2'))?.basic.name).toBe('王小明')
      expect((await db.profile.get('v1'))?.education).toHaveLength(1)
      expect(await db.resumeVersions.count()).toBe(2)
    } finally {
      await db.delete()
    }
  })

  it('v3 → v4 迁移：无版本但有资料时造默认版本承接', async () => {
    const name = `test-${newId()}`
    await createV3Db(name, true, 0)
    const db = createDb(name)
    try {
      await db.open()
      expect(await db.profile.get('main')).toBeUndefined()
      const versions = await db.resumeVersions.toArray()
      expect(versions).toHaveLength(1)
      expect(versions[0]!.name).toBe('默认版本')
      expect(versions[0]!.sections).toHaveLength(7)
      expect((await db.profile.get(versions[0]!.id))?.basic.name).toBe('王小明')
    } finally {
      await db.delete()
    }
  })

  it('v3 → v4 迁移：无资料时直接升级', async () => {
    const name = `test-${newId()}`
    await createV3Db(name, false, 1)
    const db = createDb(name)
    try {
      await db.open()
      expect(await db.profile.count()).toBe(0)
      expect(await db.resumeVersions.count()).toBe(1)
      expect(await db.deletedDocs.count()).toBe(0)
    } finally {
      await db.delete()
    }
  })

  it('profile 表按版本 id 存放各版本资料池', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.profile.put({
        id: 'some-version',
        basic: { name: '王小明' },
        education: [],
        skills: [],
        experiences: [],
        projects: [],
        awards: [],
        selfEvaluation: [],
        updatedAt: '2026-08-30',
      })
      const profile = await db.profile.get('some-version')
      expect(profile?.basic.name).toBe('王小明')
    } finally {
      await db.delete()
    }
  })
})
