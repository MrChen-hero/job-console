import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { db } from '../db'
import { exportBackup, importBackup, validateBackup, type BackupFile } from '../backup'
import { useTrackerStore } from '../../modules/tracker/store'
import { useResumeStore } from '../../modules/resume/store'
import { makeApp } from './fixtures'

beforeEach(async () => {
  vi.restoreAllMocks()
  localStorage.clear()
  await db.delete()
  await db.open()
  setActivePinia(createPinia())
})
afterEach(() => vi.restoreAllMocks())

describe('备份入口', () => {
  it.each([
    ['缺状态', (file: BackupFile) => { delete (file.data.applications[0] as Partial<typeof file.data.applications[0]>)!.status }],
    ['阶段不一致', (file: BackupFile) => { file.data.applications[0]!.status = 'Offer' }],
    ['不存在的日期', (file: BackupFile) => { file.data.applications[0]!.appliedAt = '2026-02-30' }],
    ['重复记录', (file: BackupFile) => { file.data.applications.push(file.data.applications[0]!) }],
    ['嵌套空条目', (file: BackupFile) => { (file.data.applications[0]!.interviews as unknown[]).push(null) }],
    ['空候选公司', (file: BackupFile) => { (file.data.companyPool as unknown[]).push(null) }],
    ['危险演示链接', (file: BackupFile) => { file.data.runtimeDemos.push({ id: 'd1', projectId: 'p1', title: '演示', html: '', url: 'javascript:void(0)', createdAt: '2026-09-08', updatedAt: '2026-09-08' }) }],
  ])('%s 在覆盖前被拒绝，原数据与快照不变', async (_, corrupt) => {
    await db.applications.put(makeApp({ company: '保留记录' }))
    const file = await exportBackup(db)
    corrupt(file)
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]!.path).toMatch(/^\$\.data\./)
    await expect(importBackup(db, file, 'overwrite')).rejects.toThrow()
    expect((await db.applications.toArray())[0]!.company).toBe('保留记录')
    expect(await db.snapshots.count()).toBe(0)
  })
  it('拒绝非法简历区块和悬空资料池', async () => {
    const store = useResumeStore()
    await store.ensureProfile('示例用户')
    const file = await exportBackup(db)
    expect(validateBackup(file).ok).toBe(true)
    ;(file.data.resumeVersions[0]!.sections as unknown[]).push(null)
    expect(validateBackup(file).ok).toBe(false)
    file.data.resumeVersions = []
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.message.includes('所属简历版本'))).toBe(true)
  })
})

describe('保存失败时的数据一致性', () => {
  it('投递阶段、编辑与面试记录写入失败均不改变页面状态', async () => {
    await db.applications.put(makeApp({ id: 'a1' }))
    const store = useTrackerStore()
    await store.load()
    const before = JSON.stringify(store.applications)
    vi.spyOn(db.applications, 'put').mockRejectedValue(new Error('write failed'))
    await expect(store.changeStage('a1', '一面')).rejects.toThrow()
    await expect(store.updateApplication('a1', { company: '未保存' })).rejects.toThrow()
    await expect(store.addInterview('a1', { round: '一面', date: '2026-09-08', questions: [] })).rejects.toThrow()
    expect(JSON.stringify(store.applications)).toBe(before)
    expect((await db.applications.get('a1'))!.status).toBe('已投递')
  })
  it('简历写入失败保留已保存资料，重试成功后才更新', async () => {
    const store = useResumeStore()
    await store.ensureProfile('已保存姓名')
    const fail = vi.spyOn(db.profile, 'put').mockRejectedValue(new Error('write failed'))
    await expect(store.saveText({ name: '新姓名' }, ['新自评'])).rejects.toThrow()
    await expect(store.upsertEntry('awards', { id: 'award', text: '新奖项' })).rejects.toThrow()
    expect(store.profile!.basic.name).toBe('已保存姓名')
    expect(store.profile!.awards).toEqual([])
    fail.mockRestore()
    await store.saveText({ name: '新姓名' }, ['新自评'])
    expect(store.profile!.basic.name).toBe('新姓名')
    expect((await db.profile.get(store.activeVersionId))!.selfEvaluation).toEqual(['新自评'])
  })
  it.each(['create', 'duplicate'] as const)('%s 的资料池写入失败时，版本记录一起回滚', async (action) => {
    const store = useResumeStore()
    await store.ensureProfile('示例用户')
    const id = store.activeVersionId
    vi.spyOn(db.profile, 'put').mockRejectedValue(new Error('write failed'))
    await expect(action === 'create' ? store.createVersion('新版本', '') : store.duplicateVersion(id)).rejects.toThrow()
    expect(await db.resumeVersions.count()).toBe(1)
    expect(await db.profile.count()).toBe(1)
    expect(store.versions).toHaveLength(1)
    expect(store.activeVersionId).toBe(id)
  })
  it('删除失败保留版本及其资料池', async () => {
    const store = useResumeStore()
    await store.ensureProfile('示例用户')
    const id = store.activeVersionId
    vi.spyOn(db.profile, 'delete').mockRejectedValue(new Error('delete failed'))
    await expect(store.deleteVersion(id)).rejects.toThrow()
    expect(await db.resumeVersions.get(id)).toBeDefined()
    expect(await db.profile.get(id)).toBeDefined()
    expect(store.activeVersionId).toBe(id)
  })
  it('切换版本读取失败时不改变当前版本', async () => {
    const store = useResumeStore()
    await store.ensureProfile('示例用户')
    const id = store.activeVersionId
    vi.spyOn(db.profile, 'get').mockRejectedValue(new Error('read failed'))
    await expect(store.setActive('other')).rejects.toThrow()
    expect(store.activeVersionId).toBe(id)
    expect(store.profile!.id).toBe(id)
    expect(localStorage.getItem('jobconsole:active-version:v1')).toBe(id)
  })
})
