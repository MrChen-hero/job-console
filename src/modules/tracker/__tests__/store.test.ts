import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../storage/db'
import type { CompanyPoolEntry } from '../../../storage/types'
import { newId } from '../../../storage/types'
import { useTrackerStore } from '../store'

function makePool(overrides: Partial<CompanyPoolEntry> = {}): CompanyPoolEntry {
  return {
    id: newId(),
    company: '招商银行',
    city: '上海',
    track: '主投',
    createdAt: '2026-08-30',
    ...overrides,
  }
}

describe('tracker store', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('addApplication 落库并刷新列表', async () => {
    const store = useTrackerStore()
    await store.load()
    await store.addApplication({ company: '南方电网', position: '数字化研发', batch: '提前批', channel: '官网', appliedAt: '2026-08-30' })
    expect(store.applications).toHaveLength(1)
    expect(store.applications[0]!.status).toBe('已投递')
    expect(store.applications[0]!.stageHistory).toHaveLength(1)
  })

  it('toggleStar 落库且可再次切换', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    expect(app.starred).toBeUndefined()
    await store.toggleStar(app.id)
    expect(store.find(app.id)!.starred).toBe(true)
    await store.load()
    expect(store.find(app.id)!.starred).toBe(true)   // 确认是落库不是内存
    await store.toggleStar(app.id)
    expect(store.find(app.id)!.starred).toBe(false)
  })

  it('toggleStar 不改写 status 与 stageHistory', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    await store.changeStage(app.id, '笔试')
    const before = store.find(app.id)!
    const historyLength = before.stageHistory.length
    await store.toggleStar(app.id)
    const after = store.find(app.id)!
    expect(after.status).toBe('笔试')
    expect(after.stageHistory).toHaveLength(historyLength)
    expect(after.status).toBe(after.stageHistory.at(-1)!.stage)   // 不变量
  })

  it('changeStage 同步 status 与 history 尾项（不变量）', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await store.changeStage(app.id, '笔试', '2026-09-05')
    const row = store.applications.find((a) => a.id === app.id)!
    expect(row.status).toBe('笔试')
    expect(row.stageHistory[row.stageHistory.length - 1]!.stage).toBe('笔试')
    expect(row.status).toBe(row.stageHistory[row.stageHistory.length - 1]!.stage)
  })

  it('advance 按主流程推进，到 Offer 后不再前进', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    for (const expected of ['笔试', '一面', '二面', 'HR面', 'Offer']) {
      await store.advance(app.id)
      expect(store.applications.find((a) => a.id === app.id)!.status).toBe(expected)
    }
    await store.advance(app.id)
    expect(store.applications.find((a) => a.id === app.id)!.status).toBe('Offer')
  })

  it('markDropped 置挂；reopen 重开为已投递且追加历史', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await store.markDropped(app.id)
    expect(store.applications.find((a) => a.id === app.id)!.status).toBe('挂')
    await store.reopen(app.id)
    const row = store.applications.find((a) => a.id === app.id)!
    expect(row.status).toBe('已投递')
    expect(row.stageHistory[row.stageHistory.length - 1]!.stage).toBe('已投递')
    expect(row.stageHistory).toHaveLength(3) // 已投递 → 挂 → 已投递：追加不删历史
  })

  it('面试记录：添加、更新、删除', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await store.addInterview(app.id, { round: '一面', date: '2026-09-01', format: '线上', questions: ['Q1'], weak: 'w', followUp: 'f' })
    expect(store.applications[0]!.interviews).toHaveLength(1)
    const iv = store.applications[0]!.interviews[0]!
    await store.updateInterview(app.id, { ...iv, questions: ['Q1', 'Q2'] })
    expect(store.applications[0]!.interviews[0]!.questions).toEqual(['Q1', 'Q2'])
    await store.removeInterview(app.id, iv.id)
    expect(store.applications[0]!.interviews).toHaveLength(0)
  })

  it('updateApplication 编辑基本信息', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await store.updateApplication(app.id, { position: 'B2', nextStep: '等通知', nextActionAt: '2026-09-12' })
    const row = store.applications.find((a) => a.id === app.id)!
    expect(row.position).toBe('B2')
    expect(row.nextActionAt).toBe('2026-09-12')
  })

  it('removeApplication 删除', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-30' })
    await store.removeApplication(app.id)
    expect(store.applications).toHaveLength(0)
  })

  it('候选池 CRUD + 转投递', async () => {
    const store = useTrackerStore()
    await store.load()
    const entry = await store.addPoolEntry(makePool())
    expect(store.companyPool).toHaveLength(1)
    await store.updatePoolEntry({ ...entry, priority: 1 })
    expect(store.companyPool[0]!.priority).toBe(1)
    const app = await store.convertToApplication(entry.id, { position: '数据岗', appliedAt: '2026-09-01' })
    expect(app.company).toBe('招商银行')
    expect(app.position).toBe('数据岗')
    expect(store.applications).toHaveLength(1) // 转投递不移除候选池条目
    await expect(store.convertToApplication('不存在', { position: 'x' })).rejects.toThrow()
    await store.removePoolEntry(entry.id)
    expect(store.companyPool).toHaveLength(0)
  })

  it('里程碑 CRUD', async () => {
    const store = useTrackerStore()
    await store.load()
    const m = await store.addMilestone('2026-10-24', '软考·软件设计师')
    expect(m).toBeDefined()
    expect(store.milestones).toHaveLength(1)
    await store.toggleMilestone(m!.id)
    expect(store.milestones[0]!.done).toBe(1)
    await store.removeMilestone(m!.id)
    expect(store.milestones).toHaveLength(0)
  })

  it('addMilestone 拒绝非法日期，脏数据不落库', async () => {
    const store = useTrackerStore()
    await store.load()
    // 格式不对 / 日期不存在 / 没补零——这类数据会把升序排序与倒计时算成 NaN
    expect(await store.addMilestone('abc', '乱填的')).toBeUndefined()
    expect(await store.addMilestone('2026-13-45', '不存在的日期')).toBeUndefined()
    expect(await store.addMilestone('2026-2-3', '没补零')).toBeUndefined()
    expect(await store.addMilestone('', '空日期')).toBeUndefined()
    expect(store.milestones).toHaveLength(0)
    expect(await store.addMilestone('2026-02-03', '补零的合法日期')).toBeDefined()
    expect(store.milestones).toHaveLength(1)
  })

  it('isStale：无消息超 30 天为真', async () => {
    const { isStale } = await import('../constants')
    const staleDate = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    expect(isStale('无消息', staleDate)).toBe(true)
    expect(isStale('已投递', staleDate)).toBe(false)
    expect(isStale('无消息', '2026-08-28')).toBe(false)
  })
})
