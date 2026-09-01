import { describe, expect, it } from 'vitest'
import { createDb } from '../db'
import { newId } from '../types'
import { makeApp } from './fixtures'

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

  it('profile 表以固定 id 存放主数据', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.profile.put({
        id: 'main',
        basic: { name: '王小明' },
        education: [],
        skills: [],
        experiences: [],
        projects: [],
        awards: [],
        selfEvaluation: [],
        updatedAt: '2026-08-30',
      })
      const profile = await db.profile.get('main')
      expect(profile?.basic.name).toBe('王小明')
    } finally {
      await db.delete()
    }
  })
})
