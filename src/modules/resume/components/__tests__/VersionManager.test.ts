import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../../storage/db'
import { useResumeStore } from '../../store'
import VersionManager from '../VersionManager.vue'

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useResumeStore()
  await store.load()
  const wrapper = mount(VersionManager, { global: { plugins: [pinia] } })
  return { store, wrapper }
}

describe('VersionManager', () => {
  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.className = ''
    await db.delete()
    await db.open()
    vi.restoreAllMocks()
  })

  // 组件内 void 化的 store 写入是发后即忘；等在途 IndexedDB 写落定，避免被下一用例的 db.delete() 切断成 unhandled rejection
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25))
  })

  it('空态提示与新建版本', async () => {
    const { store, wrapper } = await setup()
    expect(wrapper.text()).toContain('还没有简历版本')
    vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({ value: 'AI 岗版' } as never)
    await wrapper.find('.vm-create').trigger('click')
    await vi.waitFor(() => expect(store.versions).toHaveLength(1))
    expect(store.versions[0]!.name).toBe('AI 岗版')
    expect(store.activeVersionId).toBe(store.versions[0]!.id)
  })

  it('点击版本卡切换激活', async () => {
    const { store, wrapper } = await setup()
    await store.createVersion('V1', '')
    await store.createVersion('V2', '')
    const cards = wrapper.findAll('.vm-card')
    expect(cards).toHaveLength(2)
    const v1Card = cards.find((c) => c.text().includes('V1'))!
    await v1Card.trigger('click')
    expect(store.activeVersionId).toBe(store.versions.find((v) => v.name === 'V1')!.id)
  })

  it('重命名生效', async () => {
    const { store, wrapper } = await setup()
    await store.createVersion('旧名', '')
    vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({ value: '新名' } as never)
    await wrapper.find('.vm-card-actions button').trigger('click') // 第一个按钮 = 重命名
    await vi.waitFor(() => expect(store.versions[0]!.name).toBe('新名'))
  })

  it('复制生成副本并激活', async () => {
    const { store, wrapper } = await setup()
    await store.createVersion('原版', '')
    const buttons = wrapper.find('.vm-card-actions').findAll('button')
    await buttons[1]!.trigger('click') // 复制
    await vi.waitFor(() => expect(store.versions).toHaveLength(2))
    expect(store.versions.find((v) => v.name === '原版 副本')).toBeDefined()
    expect(store.activeVersionId).not.toBe(store.versions.find((v) => v.name === '原版')!.id)
  })

  it('删除需确认，确认后移除', async () => {
    const { store, wrapper } = await setup()
    await store.createVersion('待删版', '')
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
    await wrapper.find('.vm-delete').trigger('click')
    await flushPromises()
    expect(store.versions).toHaveLength(1)
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    await wrapper.find('.vm-delete').trigger('click')
    await vi.waitFor(() => expect(store.versions).toHaveLength(0))
    expect(store.activeVersionId).toBe('')
  })

  // 区块编排与条目勾选已迁至资料池（ProfileEditor），对应用例见 ProfileEditor.test.ts
  it('不再承载区块编排', async () => {
    const { store, wrapper } = await setup()
    await store.createVersion('V', '')
    expect(wrapper.find('.section-row').exists()).toBe(false)
    expect(wrapper.find('.section-entries').exists()).toBe(false)
  })
})
