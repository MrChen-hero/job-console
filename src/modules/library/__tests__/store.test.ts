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

  it('runtime 覆盖同 id 内置：显示 runtime 且标注已修改', async () => {
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
  })

  it('删除内置文档：写墓碑，彻底从清单消失（含其 runtime 覆盖行）', async () => {
    const store = useLibraryStore()
    await store.load()
    expect(store.docs.some((d) => d.id === 'java-notes')).toBe(true)
    await store.upsertDoc({ id: 'java-notes', category: '八股面经', title: '改过的内置', body: 'x', tags: [] })
    await store.removeDoc('java-notes')
    expect(store.docs.some((d) => d.id === 'java-notes')).toBe(false)
    expect(await db.libraryDocs.get('java-notes')).toBeUndefined()
    expect(await db.deletedDocs.get('java-notes')).toBeDefined()
    // 清掉墓碑后内置文档回来（等价于「恢复内置」，供测试与数据修复用）
    await db.deletedDocs.delete('java-notes')
    await store.load()
    expect(store.docs.some((d) => d.id === 'java-notes')).toBe(true)
  })

  it('runtime 新建文档出现在清单并按分类过滤', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.upsertDoc({ category: '八股面经', title: 'Redis 持久化', body: 'RDB 与 AOF', tags: ['Redis'] })
    const doc = store.docs.find((d) => d.title === 'Redis 持久化')!
    expect(doc.kind).toBe('runtime')
    expect(filterByCategory(store.docs, '八股面经').map((d) => d.title)).toContain('Redis 持久化')
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
    await store.upsertDoc({ category: '八股面经', title: '临时文档', body: 'x', tags: [] })
    const doc = store.docs.find((d) => d.title === '临时文档')!
    await store.removeDoc(doc.id)
    expect(store.docs.some((d) => d.title === '临时文档')).toBe(false)
  })
})

describe('library 自定义分类', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('分类清单：内置 ∪ 自定义（zh 排序）', async () => {
    const store = useLibraryStore()
    await store.load()
    expect(store.categories).toEqual(['自我介绍', '高频问题', '项目深挖', '八股面经'])
    await store.addCategory('行为面')
    await store.addCategory('复盘')
    expect(store.categories).toEqual(['自我介绍', '高频问题', '项目深挖', '八股面经', '复盘', '行为面'])
    expect(store.customCategories).toEqual(['复盘', '行为面'])
  })

  it('新增：空名与重名被拒绝', async () => {
    const store = useLibraryStore()
    await store.load()
    expect(await store.addCategory('  ')).toBe(false)
    expect(await store.addCategory('八股面经')).toBe(false) // 撞内置名
    await store.addCategory('行为面')
    expect(await store.addCategory('行为面')).toBe(false) // 撞自定义名
  })

  it('重命名：迁移该分类下的文档', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.addCategory('行为面')
    await store.upsertDoc({ category: '行为面', title: '宝洁八大问', body: 'x', tags: [] })
    expect(await store.renameCategory('行为面', '行为面试')).toBe(true)
    expect(store.customCategories).toEqual(['行为面试'])
    const doc = store.docs.find((d) => d.title === '宝洁八大问')!
    expect(doc.category).toBe('行为面试')
    expect(await store.renameCategory('行为面试', '八股面经')).toBe(false) // 目标撞内置
  })

  it('重命名内置分类：覆盖行映射，内置/运行时文档读取时跟随新名', async () => {
    const store = useLibraryStore()
    await store.load()
    expect(await store.renameCategory('八股面经', '基础知识')).toBe(true)
    expect(store.categories).toContain('基础知识')
    expect(store.categories).not.toContain('八股面经')
    // 内置 java-notes 的 frontmatter 是编译期产物，读取时映射到新名
    const javaNotes = store.docs.find((d) => d.id === 'java-notes')!
    expect(javaNotes.category).toBe('基础知识')
    // 运行时文档同样映射
    await store.upsertDoc({ category: '八股面经', title: '老分类文档', body: 'x', tags: [] })
    expect(store.docs.find((d) => d.title === '老分类文档')!.category).toBe('基础知识')
    expect(await store.renameCategory('不存在的分类', '任意')).toBe(false)
    expect(await store.renameCategory('基础知识', '自我介绍')).toBe(false) // 目标撞内置
  })

  it('重命名内置分类：再次改名与改回原名（清理覆盖行）', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.renameCategory('八股面经', '基础知识')
    expect(await store.renameCategory('基础知识', '计算机基础')).toBe(true)
    expect(store.docs.find((d) => d.id === 'java-notes')!.category).toBe('计算机基础')
    expect(await store.renameCategory('计算机基础', '八股面经')).toBe(true)
    expect(store.categories).toContain('八股面经')
    expect(store.hasBuiltinOverrides).toBe(false) // 改回原名即清理覆盖行
    expect(store.docs.find((d) => d.id === 'java-notes')!.category).toBe('八股面经')
  })

  it('删除：非空分类被拒绝（含内置文档），清空后可删', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.addCategory('行为面')
    await store.upsertDoc({ category: '行为面', title: '宝洁八大问', body: 'x', tags: [] })
    expect(await store.removeCategory('行为面')).toBe(false)
    await store.removeDoc(store.docs.find((d) => d.title === '宝洁八大问')!.id)
    expect(await store.removeCategory('行为面')).toBe(true)
    expect(store.categories).not.toContain('行为面')
    // 内置分类下有内置文档（java-notes 在八股面经）同样拒绝
    expect(await store.removeCategory('八股面经')).toBe(false)
  })

  it('删除内置分类：文档移走后可删（隐藏覆盖行），恢复默认可找回', async () => {
    const store = useLibraryStore()
    await store.load()
    // 把内置文档挪到别的分类（编辑产生 runtime 覆盖）
    const javaNotes = store.docs.find((d) => d.id === 'java-notes')!
    await store.upsertDoc({ id: javaNotes.id, category: '高频问题', title: javaNotes.title, body: javaNotes.body, tags: javaNotes.tags })
    expect(await store.removeCategory('八股面经')).toBe(true)
    expect(store.categories).not.toContain('八股面经')
    expect(store.hasBuiltinOverrides).toBe(true)
    await store.restoreDefaultCategories()
    expect(store.categories).toContain('八股面经')
    expect(store.hasBuiltinOverrides).toBe(false)
    // 文档本身的编辑是独立的 runtime 覆盖：恢复默认只还原分类清单，不回滚文档
    expect(store.docs.find((d) => d.id === 'java-notes')!.category).toBe('高频问题')
    await db.libraryDocs.delete('java-notes') // 撤销文档编辑（等价旧「重置为内置」）
    await store.load()
    expect(store.docs.find((d) => d.id === 'java-notes')!.category).toBe('八股面经')
  })

  it('恢复默认：改名期间归到新名的文档迁回原名', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.renameCategory('八股面经', '基础知识')
    // 改名后新建的文档落在新名下（编辑器只见过生效名）
    await store.upsertDoc({ category: '基础知识', title: '新分类文档', body: 'x', tags: [] })
    await store.restoreDefaultCategories()
    expect(store.categories).toEqual(['自我介绍', '高频问题', '项目深挖', '八股面经'])
    expect(store.docs.find((d) => d.title === '新分类文档')!.category).toBe('八股面经')
    expect(store.hasBuiltinOverrides).toBe(false)
  })

  it('上传 md：自定义分类被识别，未知分类回落高频问题', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.addCategory('行为面')
    const ok = store.parseUploaded('---\ntitle: t\ncategory: 行为面\n---\nb', 'f')
    expect(ok.category).toBe('行为面')
    const unknown = store.parseUploaded('---\ntitle: t\ncategory: 不存在\n---\nb', 'f')
    expect(unknown.category).toBe('高频问题')
  })
})
