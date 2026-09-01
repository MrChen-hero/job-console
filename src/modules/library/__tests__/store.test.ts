import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../storage/db'
import { useLibraryStore, filterByCategory } from '../store'

describe('library store（双通道合并）', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('内置 md 经编译时清单出现，标记 local', async () => {
    const store = useLibraryStore()
    await store.load()
    const aiIntro = store.docs.find((d) => d.id === 'self-intro-ai')
    expect(aiIntro).toBeDefined()
    expect(aiIntro!.kind).toBe('local')
    expect(aiIntro!.category).toBe('自我介绍')
    expect(aiIntro!.body).toContain('华东理工大学软件工程专业硕士')
    expect(store.docs.length).toBeGreaterThanOrEqual(5)
  })

  it('runtime 覆盖同 id 内置：显示 runtime 并可重置', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.upsertDoc({
      id: 'self-intro-ai',
      category: '自我介绍',
      title: '自我介绍 · AI 岗版（改）',
      body: '我的修改版',
      tags: [],
    })
    const overridden = store.docs.find((d) => d.id === 'self-intro-ai')!
    expect(overridden.kind).toBe('runtime')
    expect(overridden.overridden).toBe(true)
    expect(overridden.body).toBe('我的修改版')
    await store.removeDoc('self-intro-ai') // 重置为内置
    const restored = store.docs.find((d) => d.id === 'self-intro-ai')!
    expect(restored.kind).toBe('local')
    expect(restored.body).toContain('面试官您好')
  })

  it('runtime 新建文档出现在清单并按分类过滤', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.upsertDoc({ category: '八股', title: 'Redis 持久化', body: 'RDB 与 AOF', tags: ['Redis'] })
    const doc = store.docs.find((d) => d.title === 'Redis 持久化')!
    expect(doc.kind).toBe('runtime')
    expect(filterByCategory(store.docs, '八股').map((d) => d.title)).toContain('Redis 持久化')
    expect(filterByCategory(store.docs, '自我介绍').map((d) => d.title)).not.toContain('Redis 持久化')
  })

  it('上传 md 解析：frontmatter → 结构化文档', async () => {
    const store = useLibraryStore()
    await store.load()
    const parsed = store.parseUploaded(
      `---\ntitle: 复盘 · 某公司一面\ncategory: 高频问题\ntags: [复盘]\n---\n问到了 Redis 持久化，答得不好。`,
      '未命名',
    )
    expect(parsed.title).toBe('复盘 · 某公司一面')
    expect(parsed.category).toBe('高频问题')
    expect(parsed.tags).toEqual(['复盘'])
    await store.upsertDoc({ ...parsed, id: undefined })
    expect(store.docs.some((d) => d.title === '复盘 · 某公司一面')).toBe(true)
  })

  it('删除 runtime 新建文档后从清单消失', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.upsertDoc({ category: '八股', title: '临时文档', body: 'x', tags: [] })
    const doc = store.docs.find((d) => d.title === '临时文档')!
    await store.removeDoc(doc.id)
    expect(store.docs.some((d) => d.title === '临时文档')).toBe(false)
  })
})
