import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../../storage/db'
import { useTrackerStore } from '../../store'
import ApplicationBoard from '../ApplicationBoard.vue'

function fakeDataTransfer() {
  return {
    setData: vi.fn(),
    getData: vi.fn(() => dragId),
    effectAllowed: '',
  }
}
let dragId = ''

describe('ApplicationBoard', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    dragId = ''
    setActivePinia(createPinia())
  })
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 25))
  })

  async function seed() {
    const store = useTrackerStore()
    await store.load()
    const a = await store.addApplication({ company: '南方电网', position: '数字化研发', batch: '提前批', channel: '官网', appliedAt: '2026-08-30' })
    const b = await store.addApplication({ company: '亚信科技', position: 'Java 开发', batch: '实习', channel: '内推', appliedAt: '2026-08-29' })
    await store.changeStage(b.id, '挂')
    const wrapper = mount(ApplicationBoard, { global: { plugins: [] } })
    return { store, wrapper, a, b }
  }

  it('渲染 7 列与列内卡片，终止列合并挂/无消息', async () => {
    const { wrapper } = await seed()
    const cols = wrapper.findAll('.board-col')
    expect(cols).toHaveLength(7)
    expect(cols[6]!.find('.col-title').text()).toBe('挂 / 无消息')
    expect(cols[6]!.findAll('.board-card')).toHaveLength(1)
    expect(cols[6]!.find('.board-card').text()).toContain('亚信科技')
  })

  it('拖拽卡片到目标列更换阶段', async () => {
    const { store, wrapper, a } = await seed()
    const card = wrapper.find('.board-card')
    const dt = fakeDataTransfer()
    dragId = a.id
    await card.trigger('dragstart', { dataTransfer: dt })
    const targetCol = wrapper.findAll('.board-col').find((c) => c.attributes('data-column') === '笔试')!
    await targetCol.trigger('drop', { dataTransfer: dt })
    await vi.waitFor(() => expect(store.find(a.id)!.status).toBe('笔试'))
  })

  it('同列 drop 不产生变化', async () => {
    const { store, wrapper, a } = await seed()
    const card = wrapper.find('.board-card')
    const dt = fakeDataTransfer()
    dragId = a.id
    await card.trigger('dragstart', { dataTransfer: dt })
    const targetCol = wrapper.findAll('.board-col').find((c) => c.attributes('data-column') === '已投递')!
    await targetCol.trigger('drop', { dataTransfer: dt })
    await new Promise((r) => setTimeout(r, 25))
    expect(store.find(a.id)!.status).toBe('已投递')
    expect(store.find(a.id)!.stageHistory).toHaveLength(1)
  })

  it('卡片点击与回车打开详情', async () => {
    const { wrapper, a } = await seed()
    const card = wrapper.find('.board-card')
    await card.trigger('click')
    expect(wrapper.emitted('open')![0]).toEqual([a.id])
    await card.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('open')!.length).toBeGreaterThanOrEqual(2)
  })
})
