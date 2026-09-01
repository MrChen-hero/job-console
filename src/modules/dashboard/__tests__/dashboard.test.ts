import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { db } from '../../../storage/db'
import { useDashboardStore } from '../store'
import { useTrackerStore } from '../../tracker/store'
import DashboardView from '../views/DashboardView.vue'

describe('dashboard store', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('统计派生：累计/进行中/面试中/Offer', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    const first = await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await tracker.addApplication({ company: 'C', position: 'D', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    const third = await tracker.addApplication({ company: 'E', position: 'F', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await tracker.changeStage(first.id, '一面')
    await tracker.markDropped(third.id)
    expect(dashboard.stats.total).toBe(3)
    expect(dashboard.stats.inFlight).toBe(2)
    expect(dashboard.stats.interviewing).toBe(1)
    expect(dashboard.stats.offers).toBe(0)
  })

  it('漏斗按 STAGE_DONE 索引：挂掉的投递不计入其后各层', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    const app = await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    await tracker.changeStage(app.id, '笔试')
    await tracker.changeStage(app.id, '一面')
    await tracker.markDropped(app.id)
    const at = (stage: string) => dashboard.funnel.rows.find((r) => r.stage === stage)!.count
    expect(at('已投递')).toBe(1)
    expect(at('一面')).toBe(1)
    expect(at('二面')).toBe(0)
    expect(at('Offer')).toBe(0)   // 按 STAGES 索引会错成 1
  })

  it('漏斗单调递减且百分比以总投递为基数', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    for (const c of ['A', 'B', 'C', 'D']) {
      await tracker.addApplication({ company: c, position: 'P', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    }
    await tracker.changeStage(tracker.applications[0]!.id, '笔试')
    const counts = dashboard.funnel.rows.map((r) => r.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(dashboard.funnel.base).toBe(4)
    expect(dashboard.funnel.rows[0]!.pct).toBeCloseTo(1)
  })

  it('走势图 12 桶；空数据全 0 且不含 NaN', async () => {
    const dashboard = useDashboardStore()
    await dashboard.load()
    for (const key of ['total', 'inFlight', 'interviewing', 'offers'] as const) {
      expect(dashboard.series[key]).toHaveLength(12)
      expect(dashboard.series[key].every((n) => n === 0)).toBe(true)
      expect(dashboard.series[key].some((n) => Number.isNaN(n))).toBe(false)
    }
  })

  it('走势图按 stageHistory 日期回放：末桶反映当前状态', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    const app = await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: new Date().toISOString().slice(0, 10) })
    await tracker.changeStage(app.id, 'Offer')
    expect(dashboard.series.total.at(-1)).toBe(1)
    expect(dashboard.series.offers.at(-1)).toBe(1)
    expect(dashboard.series.total[0]).toBe(0)   // 11 周前还没投
  })

  it('待办带上阶段，供徽章渲染', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    const app = await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01', nextStep: '等通知', nextActionAt: '2026-09-05' })
    await tracker.changeStage(app.id, '笔试')
    expect(dashboard.todos[0]!.status).toBe('笔试')
  })

  it('漏斗计数与待办排序', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30', nextStep: '等通知', nextActionAt: '2026-09-12' })
    await tracker.addApplication({ company: 'C', position: 'D', batch: '正式批', channel: '官网', appliedAt: '2026-08-30', nextStep: '复习笔试', nextActionAt: '2026-09-05' })
    expect(dashboard.funnel.rows.find((r) => r.stage === '已投递')!.count).toBe(2)
    expect(dashboard.todos).toHaveLength(2)
    expect(dashboard.todos[0]!.label).toBe('复习笔试')
  })
})

describe('DashboardView', () => {
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

  /**
   * attach=true 时挂载到 document.body。
   * 里程碑表单的收起依赖 document 级监听（外部点击 / Esc），且 isVisible() 对游离节点
   * 判读不准，因此这三条交互用例必须真实挂载。
   */
  async function mountView(attach = false) {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<p>x</p>' } },
        { path: '/tracker', component: { template: '<p>x</p>' } },
        { path: '/resume', component: { template: '<p>x</p>' } },
        { path: '/library', component: { template: '<p>x</p>' } },
        { path: '/showcase', component: { template: '<p>x</p>' } },
      ],
    })
    const store = useTrackerStore()
    await store.load()
    const wrapper = mount(DashboardView, {
      global: { plugins: [pinia, router] },
      ...(attach ? { attachTo: document.body } : {}),
    })
    await flushPromises()
    return { store, wrapper }
  }

  /** 相对今天的日期，避免用例随时间推移而失效 */
  function shiftDays(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() + days)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  it('渲染统计卡数值', async () => {
    const { store, wrapper } = await mountView()
    await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await flushPromises()
    expect(wrapper.find('[data-testid="stat-total"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="stat-inflight"]').text()).toBe('1')
  })

  it('添加与删除里程碑', async () => {
    const { store, wrapper } = await mountView()
    await wrapper.find('input[data-field="ms-date"]').setValue('2026-10-24')
    await wrapper.find('input[data-field="ms-label"]').setValue('软考·软件设计师')
    await wrapper.find('.ms-add').trigger('click')
    await vi.waitFor(() => expect(store.milestones).toHaveLength(1))
    expect(store.milestones[0]!.label).toBe('软考·软件设计师')
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    await wrapper.find('.ms-delete').trigger('click')
    await vi.waitFor(() => expect(store.milestones).toHaveLength(0))
  })

  it('里程碑完成切换', async () => {
    const { store, wrapper } = await mountView()
    await store.addMilestone('2026-10-24', '软考')
    await flushPromises()
    const toggleBtn = wrapper.findAll('.ms-actions button')[0]!
    expect(toggleBtn.text()).toBe('完成')
    await toggleBtn.trigger('click')
    await vi.waitFor(() => expect(store.milestones[0]!.done).toBe(1))
  })

  it('里程碑按紧迫度排序：过期顶到最前、已完成沉底，并给出倒计时', async () => {
    const { store, wrapper } = await mountView()
    await store.addMilestone(shiftDays(-3), '已过期的网申')
    await store.addMilestone(shiftDays(10), '十天后的笔试')
    const done = await store.addMilestone(shiftDays(1), '明天要做的事')
    await store.toggleMilestone(done!.id)
    await flushPromises()

    const items = wrapper.findAll('.ms')
    expect(items).toHaveLength(3)
    expect(items[0]!.text()).toContain('已过 3 天')
    expect(items[1]!.text()).toContain('还有 10 天')
    expect(items[2]!.text()).toContain('已完成')
  })

  it('倒计时：今天与三日内都算临近，用强调态标出', async () => {
    const { store, wrapper } = await mountView()
    await store.addMilestone(shiftDays(2), '两天后的事')
    await store.addMilestone(shiftDays(60), '两个月后的事')
    await flushPromises()

    const items = wrapper.findAll('.ms')
    expect(items[0]!.text()).toContain('还有 2 天')
    expect(items[0]!.classes()).toContain('is-soon')
    // 第一个「暂不紧急」的项作为视线落点
    expect(items[1]!.classes()).toContain('is-next')
  })

  it('日期显示：同年省掉年份，跨年补全年份', async () => {
    const { store, wrapper } = await mountView()
    await store.addMilestone(shiftDays(5), '本年事项')
    await store.addMilestone(`${new Date().getFullYear() + 1}-03-15`, '明年的事')
    await flushPromises()

    const pills = wrapper.findAll('.ms .pill').map((p) => p.text())
    expect(pills[0]).toBe(shiftDays(5).slice(5))
    expect(pills[1]).toBe(`${new Date().getFullYear() + 1}-03-15`)
  })

  it('快捷操作六格，含打开看板与导出数据', async () => {
    const { wrapper } = await mountView()
    const tiles = wrapper.findAll('.quick')
    expect(tiles).toHaveLength(6)
    const labels = tiles.map((t) => t.text())
    expect(labels).toContain('打开看板')
    expect(labels).toContain('导出数据')
  })

  it('里程碑表单：「取消」收起并清空输入', async () => {
    const { wrapper } = await mountView(true)
    await wrapper.find('.ms-toggle').trigger('click')
    expect(wrapper.find('.ms-form').isVisible()).toBe(true)
    await wrapper.find('input[data-field="ms-label"]').setValue('临时内容')
    await wrapper.find('.ms-cancel').trigger('click')
    expect(wrapper.find('.ms-form').isVisible()).toBe(false)
    expect((wrapper.find('input[data-field="ms-label"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('里程碑表单：Esc 收起', async () => {
    const { wrapper } = await mountView(true)
    await wrapper.find('.ms-toggle').trigger('click')
    expect(wrapper.find('.ms-form').isVisible()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('.ms-form').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('里程碑表单：点击外部收起', async () => {
    const { wrapper } = await mountView(true)
    await wrapper.find('.ms-toggle').trigger('click')
    expect(wrapper.find('.ms-form').isVisible()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.ms-form').isVisible()).toBe(false)
    wrapper.unmount()
  })
})
