import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../../storage/db'
import { useTrackerStore } from '../../store'
import CompanyPoolView from '../CompanyPoolView.vue'

describe('CompanyPoolView', () => {
  // 与 ApplicationTable.test.ts 同策略：ElDialog 在 jsdom 下依赖真实浏览器过渡钩子，
  // 对话框表单交互（openCreate/openEdit/save）不直接单测，留待 Plan 5 Playwright E2E 覆盖。
  // 本文件覆盖：列表渲染、空态、转投递 emit、删除确认双分支。
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 25))
  })

  async function seed() {
    const store = useTrackerStore()
    await store.load()
    await store.addPoolEntry({ company: '招商银行', city: '上海', track: '主投', priority: 2 })
    const wrapper = mount(CompanyPoolView)
    await vi.waitFor(() => expect(wrapper.findAll('.pool-card')).toHaveLength(1))
    return { store, wrapper }
  }

  it('渲染候选池列表', async () => {
    const { wrapper } = await seed()
    expect(wrapper.text()).toContain('招商银行')
    expect(wrapper.text()).toContain('上海')
    expect(wrapper.text()).toContain('优先级 2')
    expect(wrapper.find('.track-main').text()).toBe('主投')
  })

  it('空态提示', async () => {
    const store = useTrackerStore()
    await store.load()
    const wrapper = mount(CompanyPoolView)
    await vi.waitFor(() => expect(wrapper.text()).toContain('候选池为空'))
  })

  it('点击「转投递」emit 条目', async () => {
    const { wrapper } = await seed()
    await wrapper.find('.pool-convert').trigger('click')
    const emitted = wrapper.emitted('convert')
    expect(emitted).toHaveLength(1)
    expect((emitted![0]![0] as { company: string }).company).toBe('招商银行')
  })

  it('移除需确认，确认后删除', async () => {
    const { store, wrapper } = await seed()
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
    await wrapper.find('.pool-remove').trigger('click')
    await new Promise((r) => setTimeout(r, 25))
    expect(store.companyPool).toHaveLength(1)
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    await wrapper.find('.pool-remove').trigger('click')
    await vi.waitFor(() => expect(store.companyPool).toHaveLength(0))
  })
})
