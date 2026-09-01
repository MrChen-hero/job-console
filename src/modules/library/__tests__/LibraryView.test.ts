import { flushPromises, mount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../storage/db'
import { useLibraryStore } from '../store'
import LibraryView from '../views/LibraryView.vue'

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
    expect(titles.join()).not.toContain('八股')
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

  it('覆盖内置并重置', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    // 覆盖内置
    const target = store.docs.find((d) => d.id === 'java-notes')!
    await store.upsertDoc({ id: target.id, category: target.category, title: 'Java 基础（改）', body: target.body, tags: target.tags })
    await store.load()
    await flushPromises()
    // 默认选中首篇（zh 排序为八股题库），覆盖后应出现重置按钮
    const item = wrapper.findAll('.lib-item').find((i) => i.text().includes('Java 基础（改）'))!
    await item.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('已修改 · 可重置')
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    await wrapper.find('.reset-btn').trigger('click')
    await vi.waitFor(() => expect(store.docs.find((d) => d.id === 'java-notes')!.kind).toBe('local'))
    expect(store.docs.find((d) => d.id === 'java-notes')!.title).toBe('八股题库 · Java 基础（节选）')
  })

  it('内置文档编辑入口为「另存并编辑副本」且保存产生 runtime 覆盖', async () => {
    const store = useLibraryStore()
    const wrapper = mount(LibraryView)
    await flushPromises()
    const item = wrapper.findAll('.lib-item').find((i) => i.text().includes('八股题库'))!
    await item.trigger('click')
    await flushPromises()
    expect(wrapper.find('.edit-btn').text()).toBe('编辑（保存后覆盖内置）')
    await wrapper.find('.edit-btn').trigger('click')
    const editor = wrapper.find('[data-testid="doc-editor"]')
    await editor.find('input[data-field="title"]').setValue('八股题库 · 我的版本')
    await editor.find('.editor-save').trigger('click')
    await vi.waitFor(() => expect(store.docs.find((d) => d.id === 'java-notes')?.title).toBe('八股题库 · 我的版本'))
    const doc = store.docs.find((d) => d.id === 'java-notes')!
    expect(doc.kind).toBe('runtime')
  })
})
