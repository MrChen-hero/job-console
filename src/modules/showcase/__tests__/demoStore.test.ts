import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../storage/db'
import { demoUrl, useDemoStore } from '../demoStore'

describe('demoStore', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('合并清单：内置 demo + runtime demo', async () => {
    const store = useDemoStore()
    await store.load()
    expect(store.merged.some((d) => d.source === 'local' && d.id === 'campus-market--review-flow')).toBe(true)
    await store.addDemo({ projectId: 'campus-market', title: '我的交互页', html: '<p>x</p>' })
    expect(store.merged.filter((d) => d.source === 'runtime')).toHaveLength(1)
    expect(store.byProject('campus-market').map((d) => d.title)).toContain('我的交互页')
    expect(store.byProject('campus-market').some((d) => d.source === 'local')).toBe(true) // 内置 demo 属于 campus-market 前缀
    expect(store.byProject('organs-system')).toHaveLength(0)
  })

  it('删除 runtime demo', async () => {
    const store = useDemoStore()
    await store.load()
    const row = await store.addDemo({ projectId: 'campus-market', title: '临时', html: '<p>y</p>' })
    await store.removeDemo(row.id)
    expect(store.merged.filter((d) => d.source === 'runtime')).toHaveLength(0)
  })

  it('demoUrl：同内容复用同一 Blob URL', () => {
    const a = demoUrl('<p>same</p>')
    const b = demoUrl('<p>same</p>')
    expect(a).toBe(b)
    expect(a.startsWith('blob:')).toBe(true)
  })
})
