import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Application } from '../../../../storage/types'
import { newId } from '../../../../storage/types'
import ApplicationTable from '../ApplicationTable.vue'

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: newId(),
    company: '南方电网',
    position: '数字化研发工程师',
    batch: '提前批',
    channel: '官网',
    appliedAt: '2026-08-30',
    status: '已投递',
    stageHistory: [{ stage: '已投递', date: '2026-08-30' }],
    interviews: [],
    createdAt: '2026-08-30',
    updatedAt: '2026-08-30',
    ...overrides,
  }
}

describe('ApplicationTable', () => {
  it('渲染行并支持点击打开', async () => {
    const apps = [makeApp(), makeApp({ company: '亚信科技', status: '无消息' })]
    const wrapper = mount(ApplicationTable, {
      props: { applications: apps, stageFilter: '全部', query: '' },
    })
    expect(wrapper.findAll('.app-row')).toHaveLength(2)
    await wrapper.find('.app-row').trigger('click')
    expect(wrapper.emitted('open')![0]).toEqual([apps[0]!.id])
  })

  it('状态筛选与搜索', () => {
    const apps = [makeApp(), makeApp({ company: '亚信科技', status: '无消息' })]
    const filtered = mount(ApplicationTable, {
      props: { applications: apps, stageFilter: '无消息', query: '' },
    })
    expect(filtered.findAll('.app-row')).toHaveLength(1)
    const searched = mount(ApplicationTable, {
      props: { applications: apps, stageFilter: '全部', query: '亚信' },
    })
    expect(searched.findAll('.app-row')).toHaveLength(1)
    const none = mount(ApplicationTable, {
      props: { applications: apps, stageFilter: '全部', query: '不存在' },
    })
    expect(none.text()).toContain('没有符合条件的投递记录')
  })

  it('无消息超 30 天标注启发式', () => {
    const staleDate = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const apps = [makeApp({ status: '无消息', stageHistory: [{ stage: '无消息', date: staleDate }] })]
    const wrapper = mount(ApplicationTable, {
      props: { applications: apps, stageFilter: '全部', query: '' },
    })
    expect(wrapper.text()).toContain('超1月视为挂')
  })

  it('默认不排序，保持传入顺序', () => {
    const apps = [makeApp({ company: '乙公司' }), makeApp({ company: '甲公司' })]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('乙公司')
  })

  it('点表头三态循环：升序 → 降序 → 恢复原序', async () => {
    const apps = [makeApp({ company: '乙公司' }), makeApp({ company: '甲公司' })]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    const th = wrapper.findAll('th').find((t) => t.text().includes('公司'))!
    await th.find('button').trigger('click')
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('甲公司')
    expect(th.attributes('aria-sort')).toBe('ascending')
    await th.find('button').trigger('click')
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('乙公司')
    expect(th.attributes('aria-sort')).toBe('descending')
    await th.find('button').trigger('click')
    expect(th.attributes('aria-sort')).toBe('none')
  })

  it('状态列按 STAGES 顺序排序而非字典序', async () => {
    const apps = [makeApp({ company: 'X', status: 'Offer' }), makeApp({ company: 'Y', status: '已投递' })]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    const th = wrapper.findAll('th').find((t) => t.text().includes('状态'))!
    await th.find('button').trigger('click')
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('Y')   // 已投递(0) 在 Offer(5) 之前
  })

  it('每页 12 条，翻页显示其余记录', async () => {
    const apps = Array.from({ length: 14 }, (_, i) => makeApp({ company: `公司${String(i).padStart(2, '0')}` }))
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    expect(wrapper.findAll('.app-row')).toHaveLength(12)
    const pager = wrapper.find('.pager')
    expect(pager.exists()).toBe(true)
    await pager.findAll('button').find((b) => b.text() === '2')!.trigger('click')
    expect(wrapper.findAll('.app-row')).toHaveLength(2)
    expect(wrapper.find('.pg.on').text()).toBe('2')
  })

  it('12 条及以内不显示分页条', () => {
    const apps = Array.from({ length: 12 }, () => makeApp())
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    expect(wrapper.find('.pager').exists()).toBe(false)
  })

  it('筛选变化时回到第 1 页', async () => {
    // 20 条：14 条已投递 + 6 条无消息。筛成「已投递」后仍有 14 条（>12），分页条依然存在
    const apps = [
      ...Array.from({ length: 14 }, (_, i) => makeApp({ company: `甲${String(i).padStart(2, '0')}`, status: '已投递' })),
      ...Array.from({ length: 6 }, (_, i) => makeApp({ company: `乙${String(i).padStart(2, '0')}`, status: '无消息' })),
    ]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    await wrapper.find('.pager').findAll('button').find((b) => b.text() === '2')!.trigger('click')
    expect(wrapper.find('.pg.on').text()).toBe('2')
    await wrapper.setProps({ stageFilter: '已投递' })
    expect(wrapper.find('.pg.on').text()).toBe('1')
    expect(wrapper.findAll('.app-row')).toHaveLength(12)
  })

  it('★ 按钮发出 toggle-star 事件且不冒泡为打开详情', async () => {
    const apps = [makeApp()]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    await wrapper.find('.star-btn').trigger('click')
    expect(wrapper.emitted('toggle-star')![0]).toEqual([apps[0]!.id])
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('已收藏行的 ★ 按钮为按下态', () => {
    const wrapper = mount(ApplicationTable, { props: { applications: [makeApp({ starred: true })], stageFilter: '全部', query: '' } })
    expect(wrapper.find('.star-btn').attributes('aria-pressed')).toBe('true')
  })

  it('渠道筛选与只看收藏可叠加', () => {
    const apps = [makeApp({ company: 'A', channel: '内推', starred: true }), makeApp({ company: 'B', channel: '官网', starred: true }), makeApp({ company: 'C', channel: '内推' })]
    const byChannel = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '', channelFilter: '内推' } })
    expect(byChannel.findAll('.app-row')).toHaveLength(2)
    const both = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '', channelFilter: '内推', starredOnly: true } })
    expect(both.findAll('.app-row')).toHaveLength(1)
  })

  it('投向筛选：未填投向的记录只出现在「所有投向」，可与渠道叠加', () => {
    const apps = [
      makeApp({ company: 'A', track: '主投', channel: '内推' }),
      makeApp({ company: 'B', track: '次投', channel: '内推' }),
      makeApp({ company: 'C', channel: '官网' }),
    ]
    const all = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '', trackFilter: '' } })
    expect(all.findAll('.app-row')).toHaveLength(3)
    const main = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '', trackFilter: '主投' } })
    expect(main.findAll('.app-row')).toHaveLength(1)
    expect(main.text()).toContain('A')
    // 与渠道叠加：次投 + 官网 无交集
    const both = mount(ApplicationTable, {
      props: { applications: apps, stageFilter: '全部', query: '', trackFilter: '次投', channelFilter: '官网' },
    })
    expect(both.text()).toContain('没有符合条件的投递记录')
  })

  it('投向筛选变化时回到第 1 页', async () => {
    const apps = [
      ...Array.from({ length: 14 }, (_, i) => makeApp({ company: `甲${String(i).padStart(2, '0')}`, track: '主投' })),
      ...Array.from({ length: 4 }, (_, i) => makeApp({ company: `乙${String(i).padStart(2, '0')}`, track: '次投' })),
    ]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    await wrapper.find('.pager').findAll('button').find((b) => b.text() === '2')!.trigger('click')
    expect(wrapper.find('.pg.on').text()).toBe('2')
    // 不回第 1 页的话，筛出的 4 条会落在 slice(12, 24) 之外，表格会空
    await wrapper.setProps({ trackFilter: '次投' })
    expect(wrapper.findAll('.app-row')).toHaveLength(4)
    expect(wrapper.find('.pager').exists()).toBe(false)
  })

  it('搜索覆盖备注与下一步', () => {
    const apps = [makeApp({ company: 'A', nextStep: '等笔试通知' }), makeApp({ company: 'B', notes: '内推人老王' })]
    expect(mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '笔试通知' } }).findAll('.app-row')).toHaveLength(1)
    expect(mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '老王' } }).findAll('.app-row')).toHaveLength(1)
  })
})

describe('applicationForm', () => {
  // ElDialog 在 jsdom 下的开箱依赖真实浏览器过渡钩子，表单逻辑抽到 useApplicationForm 单测；
  // 对话框交互留待 Plan 5 的 Playwright E2E 覆盖。
  it('必填校验：公司/岗位为空时给出错误且不产出载荷', async () => {
    const { useApplicationForm } = await import('../../applicationForm')
    const { form, error, submit } = useApplicationForm()
    expect(submit()).toBeNull()
    expect(error.value).toBe('请填写公司')
    form.company = '字节跳动'
    expect(submit()).toBeNull()
    expect(error.value).toBe('请填写岗位')
    form.position = '数字化研发'
    const payload = submit()
    expect(payload).not.toBeNull()
    expect(payload!.company).toBe('字节跳动')
    expect(payload!.batch).toBe('正式批')
  })

  it('open 按 initial 回显、空值字段裁剪为 undefined', async () => {
    const { useApplicationForm } = await import('../../applicationForm')
    const { form, open, submit } = useApplicationForm()
    open(makeApp({ company: '亚信科技', position: 'Java 开发', track: '次投', nextStep: '等通知' }), '预填公司')
    expect(form.company).toBe('亚信科技')
    expect(form.nextStep).toBe('等通知')
    open(null, '招商银行')
    expect(form.company).toBe('招商银行')
    expect(form.batch).toBe('正式批')
    form.position = '数据岗'
    form.location = '  '
    const payload = submit()
    expect(payload!.location).toBeUndefined()
  })
})
