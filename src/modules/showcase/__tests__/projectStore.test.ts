import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../storage/db'
import { useProjectStore, validateProjectInput } from '../projectStore'
import type { ProjectInput } from '../projectStore'

function input(over: Partial<ProjectInput> = {}): ProjectInput {
  return {
    title: '我的新项目',
    eyebrow: '独立开发',
    accent: 'teal',
    summary: '一句话简介',
    stack: ['Vue', 'Pinia'],
    demoTitle: '演示页 · 核心流程',
    demoPoints: ['要点一', '要点二'],
    ...over,
  }
}

describe('showcase projectStore', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('默认状态：内置 3 个示例项目全部可见', async () => {
    const store = useProjectStore()
    await store.load()
    expect(store.visible).toHaveLength(3)
    expect(store.visible.every((p) => p.source === 'local')).toBe(true)
    expect(store.hasBuiltinChanges).toBe(false)
  })

  it('新建项目：进入清单且标记我的', async () => {
    const store = useProjectStore()
    await store.load()
    const row = await store.addProject(input())
    expect(store.visible).toHaveLength(4)
    const mine = store.find(row.id)!
    expect(mine.source).toBe('runtime')
    expect(mine.overridden).toBe(false)
    expect(mine.demo.points).toEqual(['要点一', '要点二'])
  })

  it('编辑内置项目：写覆盖行，可重置', async () => {
    const store = useProjectStore()
    await store.load()
    const builtinId = store.visible[0]!.id
    await store.updateProject(builtinId, input({ title: '改名后的示例' }))
    const merged = store.find(builtinId)!
    expect(merged.source).toBe('runtime')
    expect(merged.overridden).toBe(true)
    expect(merged.title).toBe('改名后的示例')
    expect(store.hasBuiltinChanges).toBe(true)
    await store.resetBuiltins()
    expect(store.find(builtinId)!.source).toBe('local')
    expect(store.find(builtinId)!.title).toBe('企业人事管理系统')
    expect(store.hasBuiltinChanges).toBe(false)
  })

  it('删除内置项目：隐藏墓碑，visible 滤除，恢复可找回', async () => {
    const store = useProjectStore()
    await store.load()
    const builtinId = store.visible[0]!.id
    await store.removeProject(builtinId)
    expect(store.visible).toHaveLength(2)
    expect(store.visible.some((p) => p.id === builtinId)).toBe(false)
    expect(store.hasBuiltinChanges).toBe(true)
    await store.resetBuiltins()
    expect(store.visible).toHaveLength(3)
  })

  it('删除自建项目：直接删行；挂在项目上的演示页不动', async () => {
    const store = useProjectStore()
    await store.load()
    const row = await store.addProject(input())
    await db.runtimeDemos.put({ id: 'demo-1', projectId: row.id, title: '交互页', html: '<p>x</p>', createdAt: '2026-09-02', updatedAt: '2026-09-02' })
    await store.removeProject(row.id)
    expect(store.visible).toHaveLength(3)
    expect(await db.runtimeDemos.get('demo-1')).toBeDefined()
  })

  it('编辑隐藏中的内置项目：不意外复活', async () => {
    const store = useProjectStore()
    await store.load()
    const builtinId = store.visible[0]!.id
    await store.removeProject(builtinId)
    await store.updateProject(builtinId, input({ title: '编辑隐藏项目' }))
    expect(store.visible.some((p) => p.id === builtinId)).toBe(false)
  })

  it('输入校验：标题必填、accent 合法（9 色板，旧值 amber/rose 已退役）', () => {
    expect(validateProjectInput(input({ title: '  ' }))).toBe('请填写项目名称')
    expect(validateProjectInput(input({ accent: 'pink' as ProjectInput['accent'] }))).toBe('主题色不合法')
    expect(validateProjectInput(input({ accent: 'amber' as ProjectInput['accent'] }))).toBe('主题色不合法')
    for (const a of ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'black', 'gray'] as const) {
      expect(validateProjectInput(input({ accent: a }))).toBe('')
    }
  })
})
