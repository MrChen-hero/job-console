import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../../storage/db'
import { useResumeStore } from '../../store'
import { applyExampleProfile } from '../../exampleProfile'
import ResumeSheet from '../ResumeSheet.vue'

async function setupWithExample() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useResumeStore()
  await store.load()
  await applyExampleProfile(store)
  const wrapper = mount(ResumeSheet, { global: { plugins: [pinia] } })
  return { store, wrapper }
}

describe('ResumeSheet', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
  })

  it('空状态渲染引导文案', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useResumeStore()
    await store.load()
    const wrapper = mount(ResumeSheet, { global: { plugins: [pinia] } })
    expect(wrapper.find('.sheet-empty').exists()).toBe(true)
  })

  it('按示例数据渲染全部区块', async () => {
    const { wrapper } = await setupWithExample()
    const sheet = wrapper.find('[data-testid="resume-sheet"]')
    expect(sheet.exists()).toBe(true)
    const text = sheet.text()
    expect(text).toContain('王小明')
    expect(text).toContain('华东理工大学')
    expect(text).toContain('校园二手交易小程序')
    expect(text).toContain('数学建模竞赛')
    expect(text).toContain('AI 应用开发 / 大模型应用落地')
  })

  it('excludedIds 过滤条目', async () => {
    const { store, wrapper } = await setupWithExample()
    const version = store.versions[0]!
    const sections = [...version.sections].map((s) => ({ ...s }))
    const education = sections.find((s) => s.type === 'education')!
    education.excludedIds = ['edu-bachelor']
    await store.updateSections(version.id, sections)
    await wrapper.vm.$nextTick()
    const text = wrapper.find('[data-testid="resume-sheet"]').text()
    expect(text).toContain('软件工程（硕士）')
    expect(text).not.toContain('软件工程（本科）')
  })

  it('排除 basic 区块时隐藏头部', async () => {
    const { store, wrapper } = await setupWithExample()
    const version = store.versions[0]!
    const sections = [...version.sections].map((s) => ({ ...s }))
    const basic = sections.find((s) => s.type === 'basic')!
    basic.excludedIds = ['main']
    await store.updateSections(version.id, sections)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.r-head').exists()).toBe(false)
  })

  it('区块 order 决定渲染顺序', async () => {
    const { store, wrapper } = await setupWithExample()
    const version = store.versions[0]!
    const sections = [...version.sections]
      .map((s) => ({ ...s }))
      .map((s) => ({ ...s, order: s.type === 'skills' ? -1 : s.order }))
    await store.updateSections(version.id, sections)
    await wrapper.vm.$nextTick()
    const html = wrapper.find('[data-testid="resume-sheet"]').html()
    expect(html.indexOf('专业技能')).toBeLessThan(html.indexOf('教育背景'))
  })
})
