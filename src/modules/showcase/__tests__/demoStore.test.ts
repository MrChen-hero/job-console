import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../storage/db'
import { exportBackup, importBackup, validateBackup } from '../../../storage/backup'
import { demoUrl, useDemoStore } from '../demoStore'

describe('demoStore', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('合并清单：内置 demo + runtime demo', async () => {
    const store = useDemoStore()
    await store.load()
    expect(store.merged.some((d) => d.source === 'local' && d.id === 'campus-market--review-flow')).toBe(true)
    await store.addDemo({ projectId: 'campus-market', title: '我的交互页', html: '<p>x</p>' })
    expect(store.merged.filter((d) => d.source === 'runtime')).toHaveLength(1)
    expect(store.byProject('campus-market').map((d) => d.title)).toContain('我的交互页')
    expect(store.byProject('campus-market').some((d) => d.source === 'local')).toBe(true) // 内置 demo 属于 campus-market 前缀
    expect(store.byProject('organs-system')).toHaveLength(0)
  })

  it('删除 runtime demo', async () => {
    const store = useDemoStore()
    await store.load()
    const row = await store.addDemo({ projectId: 'campus-market', title: '临时', html: '<p>y</p>' })
    await store.removeDemo(row.id)
    expect(store.merged.filter((d) => d.source === 'runtime')).toHaveLength(0)
  })

  it('删除内置 demo：重新加载不再出现', async () => {
    const store = useDemoStore()
    await store.load()
    const builtinId = 'campus-market--review-flow'
    await store.removeDemo(builtinId)
    // 合并清单不再出现；runtime 清单也过滤墓碑行
    expect(store.merged.some((d) => d.id === builtinId)).toBe(false)
    // 墓碑行落在 runtimeDemos 表：html 置空、hidden 标记
    const row = await db.runtimeDemos.get(builtinId)
    expect(row?.hidden).toBe(true)
    expect(row?.html).toBe('')
    expect(row?.projectId).toBe('campus-market')
    await store.load()
    expect(store.merged.some((d) => d.id === builtinId)).toBe(false)
  })

  it('链接式演示：url 与要点入库，与上传式并存', async () => {
    const store = useDemoStore()
    await store.load()
    await store.addDemo({ projectId: 'campus-market', title: '自部署演示', html: '', url: 'https://demo.example.com', points: ['自部署：Nginx'] })
    await store.addDemo({ projectId: 'campus-market', title: '上传演示', html: '<p>x</p>', points: [] })
    const mine = store.merged.filter((d) => d.source === 'runtime')
    expect(mine).toHaveLength(2)
    const linked = mine.find((d) => d.title === '自部署演示')!
    expect(linked.source === 'runtime' && linked.url).toBe('https://demo.example.com')
    expect(linked.source === 'runtime' && linked.html).toBe('')
    expect(linked.source === 'runtime' && linked.points).toEqual(['自部署：Nginx'])
  })

  it('编辑演示页：改标题与要点，createdAt 不动；来源可从链接换回上传', async () => {
    const store = useDemoStore()
    await store.load()
    const row = await store.addDemo({ projectId: 'campus-market', title: '旧标题', html: '', url: 'https://demo.example.com', points: ['旧要点'] })
    await store.updateDemo(row.id, { projectId: 'campus-market', title: '新标题', html: '<p>新内容</p>', url: undefined, points: ['新要点一', '新要点二'] })
    const saved = await db.runtimeDemos.get(row.id)
    expect(saved!.title).toBe('新标题')
    expect(saved!.points).toEqual(['新要点一', '新要点二'])
    expect(saved!.createdAt).toBe(row.createdAt)
    // 换成上传式后 url 键不应残留，否则 Deck 仍按链接渲染
    expect(saved!.url).toBeUndefined()
    expect(saved!.html).toBe('<p>新内容</p>')
    expect(store.merged.filter((d) => d.source === 'runtime')).toHaveLength(1)
  })

  it('编辑内置演示：同 id 覆盖不重复，改归属后不留旧页，删除不复活', async () => {
    const store = useDemoStore()
    await store.load()
    await store.updateDemo('campus-market--review-flow', { projectId: 'organs-system', title: '我的演示', html: '<p>x</p>', points: ['我的要点'] })
    await store.load()
    expect(store.merged).toHaveLength(1)
    expect(store.byProject('campus-market')).toHaveLength(0)
    expect(store.byProject('organs-system')[0]).toMatchObject({ title: '我的演示', points: ['我的要点'] })
    await store.removeDemo('campus-market--review-flow')
    await store.load()
    expect(store.merged).toHaveLength(0)
  })

  it('编辑内置演示后备份往返，保留个人内容且不重复展示', async () => {
    const store = useDemoStore()
    await store.load()
    await store.updateDemo('campus-market--review-flow', { projectId: 'campus-market', title: '个人内容', html: '<p>个人内容</p>', points: ['个人要点'] })
    const file = await exportBackup(db)
    expect(validateBackup(file).ok).toBe(true)
    await db.runtimeDemos.clear()
    await importBackup(db, file, 'overwrite')
    await store.load()
    expect(store.merged).toHaveLength(1)
    expect(store.merged[0]).toMatchObject({ title: '个人内容', html: '<p>个人内容</p>', points: ['个人要点'] })
  })

  it('demoUrl：同内容复用同一 Blob URL', () => {
    const a = demoUrl('<p>same</p>')
    const b = demoUrl('<p>same</p>')
    expect(a).toBe(b)
    expect(a.startsWith('blob:')).toBe(true)
  })
})
