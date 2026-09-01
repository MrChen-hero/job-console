import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../storage/db'
import type { EducationEntry, SkillGroup } from '../../../storage/types'
import { newId } from '../../../storage/types'
import { useResumeStore } from '../store'

function edu(overrides: Partial<EducationEntry> = {}): EducationEntry {
  return { id: newId(), school: '华东理工大学', degree: '计算机技术（硕士）', time: '2024.09 – 2027.06', ...overrides }
}

function skill(overrides: Partial<SkillGroup> = {}): SkillGroup {
  return { id: newId(), group: '后端开发', detail: '掌握 Java', ...overrides }
}

describe('resume store', () => {
  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.className = ''
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('空库 load 后 profile 为 null、versions 为空', async () => {
    const store = useResumeStore()
    await store.load()
    expect(store.profile).toBeNull()
    expect(store.versions).toHaveLength(0)
    expect(store.loaded).toBe(true)
  })

  it('ensureProfile 无版本时先建默认版本，资料池挂在版本上', async () => {
    const store = useResumeStore()
    await store.load()
    await store.ensureProfile('王小明')
    expect(store.versions).toHaveLength(1)
    expect(store.versions[0]!.name).toBe('默认版本')
    expect(store.profile?.id).toBe(store.activeVersionId)
    expect(store.profile?.basic.name).toBe('王小明')
    await store.updateBasic({ name: '王小明', email: 'c@example.com' })
    expect(store.profile?.basic.email).toBe('c@example.com')
    const row = await db.profile.get(store.activeVersionId)
    expect(row?.basic.email).toBe('c@example.com')
    expect(await db.profile.get('main')).toBeUndefined()
  })

  it('upsertEntry 新增与更新五类条目，removeEntry 删除', async () => {
    const store = useResumeStore()
    await store.load()
    await store.ensureProfile('王小明')
    await store.upsertEntry('education', edu())
    expect(store.profile?.education).toHaveLength(1)
    const item = store.profile!.education[0]!
    await store.upsertEntry('education', { ...item, school: '云南大学' })
    expect(store.profile?.education).toHaveLength(1)
    expect(store.profile?.education[0]!.school).toBe('云南大学')
    await store.removeEntry('education', item.id)
    expect(store.profile?.education).toHaveLength(0)
  })

  it('moveEntry 交换同区条目顺序', async () => {
    const store = useResumeStore()
    await store.load()
    await store.ensureProfile('王小明')
    const a = skill({ group: 'A' })
    const b = skill({ group: 'B' })
    await store.upsertEntry('skills', a)
    await store.upsertEntry('skills', b)
    await store.moveEntry('skills', b.id, -1)
    expect(store.profile!.skills.map((s) => s.group)).toEqual(['B', 'A'])
    // 边界：首条上移、末条下移不变
    await store.moveEntry('skills', b.id, -1)
    await store.moveEntry('skills', b.id, -1)
    expect(store.profile!.skills.map((s) => s.group)).toEqual(['B', 'A'])
    await store.moveEntry('skills', a.id, 1)
    await store.moveEntry('skills', a.id, 1)
    expect(store.profile!.skills.map((s) => s.group)).toEqual(['B', 'A'])
  })

  it('setSelfEvaluation 覆盖自评列表', async () => {
    const store = useResumeStore()
    await store.load()
    await store.ensureProfile('王小明')
    await store.setSelfEvaluation(['第一条', '第二条'])
    expect(store.profile?.selfEvaluation).toEqual(['第一条', '第二条'])
  })

  it('资料池按版本独立：新建复制起点，修改互不影响，删除连带清理', async () => {
    const store = useResumeStore()
    await store.load()
    await store.ensureProfile('王小明')
    await store.upsertEntry('skills', skill({ group: '共有技能' }))
    const v1 = store.activeVersionId
    // 新建版本以当前资料池为起点复制
    const v2 = await store.createVersion('开发岗版', '')
    expect(store.profile?.id).toBe(v2.id)
    expect(store.profile?.skills.map((s) => s.group)).toContain('共有技能')
    // 修改 v2 不影响 v1
    await store.upsertEntry('skills', skill({ group: 'v2 新增' }))
    await store.removeEntry('skills', store.profile!.skills.find((s) => s.group === '共有技能')!.id)
    await store.setActive(v1)
    expect(store.profile?.id).toBe(v1)
    expect(store.profile?.skills.map((s) => s.group)).toEqual(['共有技能'])
    // 删除版本连带删除其资料池
    await store.deleteVersion(v2.id)
    expect(await db.profile.get(v2.id)).toBeUndefined()
    expect(store.profile?.id).toBe(v1)
    expect(store.profile?.skills).toHaveLength(1)
  })

  it('duplicateVersion 连资料池一并复制', async () => {
    const store = useResumeStore()
    await store.load()
    await store.ensureProfile('王小明')
    await store.upsertEntry('skills', skill({ group: '独有技能' }))
    const v1 = store.activeVersionId
    const v2 = await store.duplicateVersion(v1)
    expect(await db.profile.get(v2!.id)).toBeDefined()
    expect(store.profile?.id).toBe(v2!.id)
    await store.setActive(v1)
    expect(store.profile?.skills.map((s) => s.group)).toEqual(['独有技能'])
  })

  it('createVersion/duplicateVersion/renameVersion/deleteVersion', async () => {
    const store = useResumeStore()
    await store.load()
    const v1 = await store.createVersion('AI 岗版', 'AI 应用开发')
    expect(store.versions).toHaveLength(1)
    expect(store.activeVersionId).toBe(v1.id)
    const v2 = await store.duplicateVersion(v1.id)
    expect(v2).toBeDefined()
    expect(store.versions).toHaveLength(2)
    expect(v2!.name).toBe('AI 岗版 副本')
    expect(v2!.sections).toEqual(v1.sections)
    expect(v2!.id).not.toBe(v1.id)
    await store.renameVersion(v2!.id, '开发岗版')
    expect(store.versions.find((v) => v.id === v2!.id)?.name).toBe('开发岗版')
    await store.deleteVersion(v1.id)
    expect(store.versions).toHaveLength(1)
    expect(store.activeVersionId).toBe(v2!.id)
    await store.deleteVersion(v2!.id)
    expect(store.activeVersionId).toBe('')
  })

  it('activeVersionId 持久化并在 load 时恢复', async () => {
    const store = useResumeStore()
    await store.load()
    const v = await store.createVersion('AI 岗版', 'AI 应用开发')
    expect(localStorage.getItem('jobconsole:active-version:v1')).toBe(v.id)
    setActivePinia(createPinia())
    const store2 = useResumeStore()
    await store2.load()
    expect(store2.activeVersionId).toBe(v.id)
  })

  it('updateSections 更新区块编排', async () => {
    const store = useResumeStore()
    await store.load()
    const v = await store.createVersion('AI 岗版', 'AI 应用开发')
    const sections = v.sections.map((s) => ({ ...s, order: 6 - s.order }))
    await store.updateSections(v.id, sections)
    expect(store.versions.find((x) => x.id === v.id)?.sections[0]!.order).toBe(6)
  })
})
