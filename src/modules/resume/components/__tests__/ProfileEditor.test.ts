import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../../storage/db'
import { useResumeStore } from '../../store'
import ProfileEditor from '../ProfileEditor.vue'

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useResumeStore()
  await store.load()
  await store.ensureProfile('王小明')
  const wrapper = mount(ProfileEditor, { global: { plugins: [pinia] } })
  return { store, wrapper }
}

function fillInput(wrapper: ReturnType<typeof mount>, selector: string, value: string) {
  const input = wrapper.find(selector)
  return input.setValue(value)
}

describe('ProfileEditor', () => {
  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.className = ''
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  // 编排态的 store 写入是 void 化的发后即忘；等在途 IndexedDB 写落定，
  // 否则会被下一用例的 db.delete() 切断成 DatabaseClosedError
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25))
  })

  it('基本信息表单回显并可保存', async () => {
    const { store, wrapper } = await setup()
    await fillInput(wrapper, 'input[data-field="name"]', '王小明')
    await fillInput(wrapper, 'input[data-field="email"]', 'c@example.com')
    await wrapper.find('.basic-save').trigger('click')
    expect(store.profile?.basic.email).toBe('c@example.com')
  })

  it('基本信息必填校验：姓名为空时提示', async () => {
    const { store, wrapper } = await setup()
    await wrapper.find('input[data-field="name"]').setValue('')
    await wrapper.find('.basic-save').trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(store.profile?.basic.name).toBe('王小明')
  })

  it('教育条目：添加 → 列表出现', async () => {
    const { store, wrapper } = await setup()
    await wrapper.findAll('.tab-btn').find((b) => b.text() === '教育背景')!.trigger('click')
    await wrapper.find('.add-entry').trigger('click')
    await fillInput(wrapper, '.entry-dialog input[data-field="school"]', '云南大学')
    await fillInput(wrapper, '.entry-dialog input[data-field="degree"]', '软件工程（本科）')
    await fillInput(wrapper, '.entry-dialog input[data-field="time"]', '2020.09 – 2024.06')
    await wrapper.find('.entry-save').trigger('click')
    expect(store.profile?.education).toHaveLength(1)
    expect(store.profile?.education[0]!.school).toBe('云南大学')
    expect(wrapper.text()).toContain('云南大学')
  })

  it('教育条目：编辑回显并更新', async () => {
    const { store, wrapper } = await setup()
    await wrapper.findAll('.tab-btn').find((b) => b.text() === '教育背景')!.trigger('click')
    await wrapper.find('.add-entry').trigger('click')
    await fillInput(wrapper, '.entry-dialog input[data-field="school"]', '华东理工大学')
    await fillInput(wrapper, '.entry-dialog input[data-field="degree"]', '硕士')
    await fillInput(wrapper, '.entry-dialog input[data-field="time"]', '2024-2027')
    await wrapper.find('.entry-save').trigger('click')
    await wrapper.find('.entry-card .entry-actions button:nth-child(3)').trigger('click')
    await fillInput(wrapper, '.entry-dialog input[data-field="degree"]', '计算机技术（硕士）')
    await wrapper.find('.entry-save').trigger('click')
    expect(store.profile?.education).toHaveLength(1)
    expect(store.profile?.education[0]!.degree).toBe('计算机技术（硕士）')
  })

  it('实习条目 bullets 多行文本解析为字符串数组', async () => {
    const { store, wrapper } = await setup()
    await wrapper.findAll('.tab-btn').find((b) => b.text() === '实习经历')!.trigger('click')
    await wrapper.find('.add-entry').trigger('click')
    await fillInput(wrapper, '.entry-dialog input[data-field="org"]', '示例科技有限公司')
    await fillInput(wrapper, '.entry-dialog input[data-field="role"]', '研发工程师助理')
    await fillInput(wrapper, '.entry-dialog input[data-field="time"]', '2024.09 – 2025.03')
    await fillInput(wrapper, '.entry-dialog textarea[data-field="bullets"]', '第一条\n第二条')
    await wrapper.find('.entry-save').trigger('click')
    expect(store.profile?.experiences[0]!.bullets).toEqual(['第一条', '第二条'])
  })

  it('自我评价按行保存', async () => {
    const { store, wrapper } = await setup()
    await wrapper.findAll('.tab-btn').find((b) => b.text() === '自我评价')!.trigger('click')
    await fillInput(wrapper, 'textarea[data-field="selfEvaluation"]', '第一句\n第二句\n')
    await wrapper.find('.self-save').trigger('click')
    expect(store.profile?.selfEvaluation).toEqual(['第一句', '第二句'])
  })

  /** 组头是可收起的手风琴，重复调用时不能盲点，否则第二次会把本组收起 */
  async function openGroup(wrapper: ReturnType<typeof mount>, label: string) {
    const head = wrapper.findAll('.tab-btn').find((b) => b.text() === label)!
    if (head.attributes('aria-expanded') !== 'true') await head.trigger('click')
  }

  async function addEducation(wrapper: ReturnType<typeof mount>, school: string) {
    await openGroup(wrapper, '教育背景')
    await wrapper.find('.add-entry').trigger('click')
    await fillInput(wrapper, '.entry-dialog input[data-field="school"]', school)
    await fillInput(wrapper, '.entry-dialog input[data-field="degree"]', '硕士')
    await fillInput(wrapper, '.entry-dialog input[data-field="time"]', '2024-2027')
    await wrapper.find('.entry-save').trigger('click')
  }

  it('删除条目：确认后生效', async () => {
    const { store, wrapper } = await setup()
    await addEducation(wrapper, '华东理工大学')
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    await wrapper.find('.entry-delete').trigger('click')
    expect(store.profile?.education).toHaveLength(0)
  })

  it('删除条目：取消分支不删除', async () => {
    const { store, wrapper } = await setup()
    await addEducation(wrapper, '华东理工大学')
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
    await wrapper.find('.entry-delete').trigger('click')
    expect(store.profile?.education).toHaveLength(1)
  })

  it('排序交换：点击下移后顺序互换', async () => {
    const { store, wrapper } = await setup()
    await addEducation(wrapper, '甲学校')
    await addEducation(wrapper, '乙学校')
    const cards = wrapper.findAll('.entry-card')
    await cards[0]!.findAll('button')[1]!.trigger('click') // 下移
    expect(store.profile!.education.map((e) => e.school)).toEqual(['乙学校', '甲学校'])
  })

  it('组头是手风琴按钮，带 aria-expanded 与 aria-controls', async () => {
    const { wrapper } = await setup()
    const head = wrapper.findAll('.tab-btn').find((b) => b.text().includes('教育背景'))!
    expect(head.attributes('aria-expanded')).toBe('false')
    expect(head.attributes('aria-controls')).toBeTruthy()
    await head.trigger('click')
    expect(head.attributes('aria-expanded')).toBe('true')
  })

  it('单开：展开新组时前一组收起', async () => {
    const { wrapper } = await setup()
    const edu = wrapper.findAll('.tab-btn').find((b) => b.text().includes('教育背景'))!
    await edu.trigger('click')
    const exp = wrapper.findAll('.tab-btn').find((b) => b.text().includes('实习经历'))!
    await exp.trigger('click')
    expect(edu.attributes('aria-expanded')).toBe('false')
    expect(exp.attributes('aria-expanded')).toBe('true')
  })

  it('默认展开基本信息', async () => {
    const { wrapper } = await setup()
    expect(wrapper.find('input[data-field="name"]').exists()).toBe(true)
  })

  it('展开区落在本组内部，而不是整条列表末尾', async () => {
    const { wrapper } = await setup()
    const rows = wrapper.findAll('.tab-row')
    const eduRow = rows.find((r) => r.find('.tab-btn').text() === '教育背景')!
    await eduRow.find('.tab-btn').trigger('click')
    // 展开区必须是本组的后代节点
    expect(eduRow.find('.pool-body').exists()).toBe(true)
    expect(eduRow.find('.add-entry').exists()).toBe(true)
    // 其余组不得含展开区
    for (const r of rows) {
      if (r.find('.tab-btn').text() === '教育背景') continue
      expect(r.find('.pool-body').exists()).toBe(false)
    }
  })

  it('aria-controls 指向本组展开区的真实 id', async () => {
    const { wrapper } = await setup()
    const head = wrapper.findAll('.tab-btn').find((b) => b.text() === '教育背景')!
    await head.trigger('click')
    const id = head.attributes('aria-controls')!
    expect(wrapper.find(`#${id}`).exists()).toBe(true)
  })

  it('再点已展开的组则收起', async () => {
    const { wrapper } = await setup()
    const head = wrapper.findAll('.tab-btn').find((b) => b.text() === '教育背景')!
    await head.trigger('click')
    expect(head.attributes('aria-expanded')).toBe('true')
    await head.trigger('click')
    expect(head.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.pool-body').exists()).toBe(false)
  })

  /* ---------- 区块编排（自 VersionManager 迁入） ---------- */

  async function setupArranging() {
    const { store, wrapper } = await setup()
    await store.createVersion('V', '')
    await flushPromises()
    await wrapper.find('.pool-arrange').trigger('click')
    return { store, wrapper }
  }

  it('无版本时不显示区块编排入口', async () => {
    const { wrapper } = await setup()
    expect(wrapper.find('.pool-arrange').exists()).toBe(false)
  })

  it('开启编排：七行区块，基本信息在首位且无 grip', async () => {
    const { wrapper } = await setupArranging()
    const rows = wrapper.findAll('.section-row')
    expect(rows).toHaveLength(7)
    expect(rows[0]!.text()).toContain('基本信息')
    expect(rows[0]!.find('.grip').exists()).toBe(false)
    expect(rows[0]!.attributes('draggable')).not.toBe('true')
    expect(rows[1]!.find('.grip').exists()).toBe(true)
    expect(rows[1]!.attributes('draggable')).toBe('true')
  })

  it('区块排序：下移后与相邻区块交换 order', async () => {
    const { store, wrapper } = await setupArranging()
    const rows = wrapper.findAll('.section-row')
    // 第二行（教育背景）下移，与专业技能互换
    await rows[1]!.find('.section-actions').findAll('button')[1]!.trigger('click')
    await vi.waitFor(() => expect(store.versions[0]!.sections.find((s) => s.type === 'education')!.order).toBe(2))
    expect(store.versions[0]!.sections.find((s) => s.type === 'skills')!.order).toBe(1)
    // basic 始终留在首位
    expect(store.versions[0]!.sections.find((s) => s.type === 'basic')!.order).toBe(0)
  })

  it('基本信息不可移动：其上移/下移按钮均禁用', async () => {
    const { wrapper } = await setupArranging()
    const buttons = wrapper.findAll('.section-row')[0]!.find('.section-actions').findAll('button')
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
    expect(buttons[1]!.attributes('disabled')).toBeDefined()
  })

  it('拖拽落到首位被拒绝，basic 仍在 order 0', async () => {
    const { store, wrapper } = await setupArranging()
    const rows = wrapper.findAll('.section-row')
    await rows[1]!.trigger('dragstart')
    await rows[0]!.trigger('drop')
    await flushPromises()
    expect(store.versions[0]!.sections.find((s) => s.type === 'basic')!.order).toBe(0)
    expect(store.versions[0]!.sections.find((s) => s.type === 'education')!.order).toBe(1)
  })

  it('拖拽换位：把项目经历拖到教育背景上', async () => {
    const { store, wrapper } = await setupArranging()
    const rows = wrapper.findAll('.section-row')
    const projects = rows.find((r) => r.text().includes('项目经历'))!
    const education = rows.find((r) => r.text().includes('教育背景'))!
    await projects.trigger('dragstart')
    await education.trigger('drop')
    await vi.waitFor(() => expect(store.versions[0]!.sections.find((s) => s.type === 'projects')!.order).toBe(1))
    expect(store.versions[0]!.sections.find((s) => s.type === 'education')!.order).toBe(4)
  })

  it('条目勾选排除生效', async () => {
    const { store, wrapper } = await setup()
    await store.createVersion('V', '')
    await store.upsertEntry('education', {
      id: 'edu-1', school: '甲', degree: '硕士', time: 't',
    })
    await store.load()
    await flushPromises()
    await wrapper.find('.pool-arrange').trigger('click')
    const checkbox = wrapper.find('.section-entries .el-checkbox')
    expect(checkbox.text()).toContain('甲 · 硕士')
    await checkbox.find('input').setValue(false)
    await flushPromises()
    expect(store.versions[0]!.sections.find((s) => s.type === 'education')?.excludedIds).toContain('edu-1')
    await checkbox.find('input').setValue(true)
    await flushPromises()
    expect(store.versions[0]!.sections.find((s) => s.type === 'education')?.excludedIds).toEqual([])
  })

  it('编排态与手风琴态互斥切换', async () => {
    const { wrapper } = await setupArranging()
    expect(wrapper.find('.tab-btn').exists()).toBe(false)
    await wrapper.find('.pool-arrange').trigger('click')
    expect(wrapper.find('.tab-btn').exists()).toBe(true)
    expect(wrapper.find('.section-row').exists()).toBe(false)
  })
})
