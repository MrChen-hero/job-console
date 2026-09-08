import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ElMessageBox } from 'element-plus'
import { db } from '../../../storage/db'
import { useDashboardStore } from '../../dashboard/store'
import { useTrackerStore } from '../store'
import { useStageChange } from '../useStageChange'

const input = { company: '测试企业', position: '研发', batch: '正式批', channel: '官网', appliedAt: '2026-09-01', nextStep: '准备面试', nextActionAt: '2026-09-09' } as const

describe('next action', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

  it('完成、撤销均落库且不改变投递阶段与历史', async () => {
    const store = useTrackerStore()
    const app = await store.addApplication(input)
    await store.changeStage(app.id, '一面')
    const history = structuredClone((await db.applications.get(app.id))!.stageHistory)
    const completed = await store.completeNextAction(app.id)
    expect((await db.applications.get(app.id))!.nextStep).toBeUndefined()
    expect((await db.applications.get(app.id))!.nextActionAt).toBeUndefined()
    expect(useDashboardStore().todos).toHaveLength(0)
    await store.restoreNextAction(completed)
    await store.load()
    expect(store.find(app.id)).toMatchObject({ nextStep: input.nextStep, nextActionAt: input.nextActionAt, status: '一面', stageHistory: history })
  })

  it('编辑和延期重新排序；未排期待办沉底，空动作不显示', async () => {
    const store = useTrackerStore()
    const first = await store.addApplication(input)
    const second = await store.addApplication({ ...input, company: '第二企业', nextActionAt: '2026-09-10' })
    await store.addApplication({ ...input, nextStep: '  ' })
    await store.saveNextAction(first.id, '  联系面试官  ', '2026-09-12')
    expect(useDashboardStore().todos.map((t) => t.id)).toEqual([second.id, first.id])
    await store.saveNextAction(second.id, '未安排日期')
    expect(useDashboardStore().todos.map((t) => t.id)).toEqual([first.id, second.id])
    await store.load()
    expect(store.find(first.id)!.nextStep).toBe('联系面试官')
    expect(store.find(second.id)!.nextActionAt).toBeUndefined()
    await expect(store.saveNextAction(first.id, ' ')).rejects.toThrow('请填写')
    await expect(store.saveNextAction(first.id, '面试', '2026-02-30')).rejects.toThrow('有效日期')
  })

  it('写入失败时保留原待办，可重试；撤销不会覆盖新动作', async () => {
    const store = useTrackerStore()
    const app = await store.addApplication(input)
    vi.spyOn(db.applications, 'put').mockRejectedValueOnce(new Error('write failed'))
    await expect(store.completeNextAction(app.id)).rejects.toThrow('write failed')
    expect(store.find(app.id)!.nextStep).toBe(input.nextStep)
    const completed = await store.completeNextAction(app.id)
    await store.saveNextAction(app.id, '新动作')
    await expect(store.restoreNextAction(completed)).rejects.toThrow('未覆盖')
    expect((await db.applications.get(app.id))!.nextStep).toBe('新动作')
  })

  it.each(['挂', '无消息'] as const)('结束阶段 %s 可清除或保留待办，阶段与历史保持一致', async (stage) => {
    const store = useTrackerStore()
    const app = await store.addApplication(input)
    await store.changeStage(app.id, stage)
    expect(store.find(app.id)!.nextStep).toBe(input.nextStep)
    await store.changeStage(app.id, '已投递')
    await store.changeStage(app.id, stage, undefined, undefined, true)
    const saved = (await db.applications.get(app.id))!
    expect(saved.nextStep).toBeUndefined()
    expect(saved.nextActionAt).toBeUndefined()
    expect(saved.status).toBe(stage)
    expect(saved.stageHistory.at(-1)!.stage).toBe(stage)
  })

  it('Offer 保留待办且无清理提示', async () => {
    const store = useTrackerStore()
    const app = await store.addApplication(input)
    const confirm = vi.spyOn(ElMessageBox, 'confirm')
    await useStageChange()(app.id, 'Offer')
    expect(confirm).not.toHaveBeenCalled()
    expect(store.find(app.id)!.nextStep).toBe(input.nextStep)
  })

  it.each(['confirm', 'cancel', 'close'] as const)('结束状态弹窗 %s 正确执行清除、保留或取消', async (choice) => {
    const store = useTrackerStore()
    const app = await store.addApplication(input)
    const confirm = vi.spyOn(ElMessageBox, 'confirm')
    if (choice === 'confirm') confirm.mockResolvedValue('confirm' as never)
    else confirm.mockRejectedValue(choice)
    await useStageChange()(app.id, '挂')
    const saved = (await db.applications.get(app.id))!
    expect(saved.status).toBe(choice === 'close' ? '已投递' : '挂')
    expect(saved.nextStep).toBe(choice === 'confirm' ? undefined : input.nextStep)
  })
})
