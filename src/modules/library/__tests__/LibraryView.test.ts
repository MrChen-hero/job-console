import { flushPromises, mount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../storage/db'
import { useLibraryStore } from '../store'
import LibraryView from '../views/LibraryView.vue'
import { enableAutoUnmount } from '@vue/test-utils'
enableAutoUnmount(afterEach)
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))

describe('LibraryView', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('渲染内置文档列表与阅读视图', async () => {
    const wrapper = mount(LibraryView)
    await flushPromises()
    expect(wrapper.findAll('.lib-item').length).toBeGreaterThanOrEqual(5)
    // 默认选中 zh 排序首篇「八股题库」
    expect(wrapper.find('[data-testid="doc-body"]').html()).toContain('HashMap')
    expect(wrapper.find('.src-tag.local').exists()).toBe(true)
  })

  it('分类筛选生效', async () => {
    const wrapper = mount(LibraryView)
    await flushPromises()
    await wrapper.findAll('.chip').find((c) => c.text() === '自我介绍')!.trigger('click')
    const titles = wrapper.findAll('.lib-item').map((i) => i.text())
    expect(titles.length).toBe(2)
    expect(titles.join()).toContain('AI 岗版')
    expect(titles.join()).not.toContain('八股题库')
    expect(wrapper.find('.reader-title').text()).toContain('自我介绍')
  })

  it('搜索覆盖正文和标签，无匹配时清空阅读区', async () => {
    const wrapper = mount(LibraryView)
    await flushPromises()
    await wrapper.find('.library-search').setValue('HashMap')
    expect(wrapper.findAll('.lib-item')).toHaveLength(1)
    expect(wrapper.find('.reader-title').text()).toContain('Java')
    await wrapper.find('.library-search').setValue('no-match-unique')
    expect(wrapper.find('.reader-title').exists()).toBe(false)
    expect(wrapper.find('.lib-empty').text()).toContain('未找到匹配文档')
  })

  it('新建文档：编辑器保存后进入列表（runtime）', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    await wrapper.find('.create-btn').trigger('click')
    const editor = wrapper.find('[data-testid="doc-editor"]')
    expect(editor.exists()).toBe(true)
    await editor.find('input[data-field="title"]').setValue('复盘 · 状态机设计')
    await editor.find('textarea[data-field="body"]').setValue('正文内容')
    await editor.find('.editor-save').trigger('click')
    await vi.waitFor(() => expect(store.docs.some((d) => d.title === '复盘 · 状态机设计')).toBe(true))
    const doc = store.docs.find((d) => d.title === '复盘 · 状态机设计')!
    expect(doc.kind).toBe('runtime')
    await flushPromises()
    expect(wrapper.text()).toContain('我的文档')
  })

  it('内置文档与普通文档一样可删除（墓碑）', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    const item = wrapper.findAll('.lib-item').find((i) => i.text().includes('八股题库'))!
    await item.trigger('click')
    await flushPromises()
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    await wrapper.find('.delete-btn').trigger('click')
    await vi.waitFor(() => expect(store.docs.some((d) => d.id === 'java-notes')).toBe(false))
    expect(wrapper.text()).not.toContain('八股题库')
  })

  it('内置文档编辑入口为「另存并编辑副本」且保存产生 runtime 覆盖', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    const item = wrapper.findAll('.lib-item').find((i) => i.text().includes('八股题库'))!
    await item.trigger('click')
    await flushPromises()
    expect(wrapper.find('.edit-btn').text()).toBe('编辑')
    await wrapper.find('.edit-btn').trigger('click')
    const editor = wrapper.find('[data-testid="doc-editor"]')
    await editor.find('input[data-field="title"]').setValue('八股题库 · 我的版本')
    await editor.find('.editor-save').trigger('click')
    await vi.waitFor(() => expect(store.docs.find((d) => d.id === 'java-notes')?.title).toBe('八股题库 · 我的版本'))
    const doc = store.docs.find((d) => d.id === 'java-notes')!
    expect(doc.kind).toBe('runtime')
  })
})

describe('LibraryView 分类管理', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('新增分类：出现在左侧清单并可筛选文档', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    const prompt = vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({ value: '行为面' } as never)
    await wrapper.find('.cat-add').trigger('click')
    await vi.waitFor(() => expect(store.customCategories).toContain('行为面'))
    await flushPromises()
    expect(wrapper.findAll('.chip').map((c) => c.text())).toContain('行为面')
    prompt.mockRestore()
  })

  it('新增分类：重名时提示已存在', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    const prompt = vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({ value: '八股面经' } as never)
    const message = vi.spyOn(vi.mocked(await import('element-plus')).ElMessage, 'warning').mockImplementation(() => ({}) as never)
    await wrapper.find('.cat-add').trigger('click')
    await vi.waitFor(() => expect(message).toHaveBeenCalled())
    expect(store.customCategories).not.toContain('八股面经')
    prompt.mockRestore()
    message.mockRestore()
  })

  it('删除分类：有文档时拒绝，清空后成功', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    await store.addCategory('行为面')
    await store.upsertDoc({ category: '行为面', title: '宝洁八大问', body: 'x', tags: [] })
    await flushPromises()
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    const row = wrapper.findAll('.category-manage-row').find((r) => r.text().includes('行为面'))!
    await row.find('button[aria-label="删除分类 行为面"]').trigger('click')
    await vi.waitFor(() => expect(store.customCategories).toContain('行为面')) // 仍存在：非空被拒
    await store.removeDoc(store.docs.find((d) => d.title === '宝洁八大问')!.id)
    await row.find('button[aria-label="删除分类 行为面"]').trigger('click')
    await vi.waitFor(() => expect(store.customCategories).not.toContain('行为面'))
    confirm.mockRestore()
  })

  it('重命名分类：文档随迁移', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    await store.addCategory('行为面')
    await store.upsertDoc({ category: '行为面', title: '宝洁八大问', body: 'x', tags: [] })
    await flushPromises()
    const prompt = vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({ value: '行为面试' } as never)
    const row = wrapper.findAll('.category-manage-row').find((r) => r.text().includes('行为面'))!
    await row.find('button[aria-label="重命名分类 行为面"]').trigger('click')
    await vi.waitFor(() => expect(store.customCategories).toEqual(['行为面试']))
    expect(store.docs.find((d) => d.title === '宝洁八大问')!.category).toBe('行为面试')
    prompt.mockRestore()
  })
})
