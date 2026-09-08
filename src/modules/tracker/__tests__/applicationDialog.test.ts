import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../storage/db'
import ApplicationDialog from '../components/ApplicationDialog.vue'

async function openDialog() {
  setActivePinia(createPinia())
  const wrapper = mount(ApplicationDialog, {
    attachTo: document.body,
    props: { modelValue: true, persist: async () => {} },
  })
  await flushPromises()
  return wrapper
}

describe('ApplicationDialog', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('日期字段用 ElDatePicker，data-field 仍落在内层 input 上', async () => {
    const wrapper = await openDialog()
    for (const field of ['appliedAt', 'nextActionAt']) {
      const input = document.querySelector(`input[data-field="${field}"]`)
      expect(input, `${field} 应有内层 input`).not.toBeNull()
      expect((input as HTMLInputElement).tagName).toBe('INPUT')
    }
    // 日期选择器是只读输入 + 弹层，不应退化成手输文本框
    expect(document.querySelectorAll('.el-date-editor').length).toBe(2)
    wrapper.unmount()
  })

  it('文本字段的 data-field 未受影响', async () => {
    const wrapper = await openDialog()
    for (const field of ['company', 'position', 'channel', 'location', 'url', 'nextStep']) {
      expect(document.querySelector(`input[data-field="${field}"]`), field).not.toBeNull()
    }
    // 岗位信息是多行 textarea，与单行 input 分开断言
    expect(document.querySelector('textarea[data-field="jobDesc"]'), 'jobDesc').not.toBeNull()
    wrapper.unmount()
  })

  it('填写必填项后 save 带出 payload', async () => {
    const wrapper = await openDialog()
    const company = document.querySelector('input[data-field="company"]') as HTMLInputElement
    const position = document.querySelector('input[data-field="position"]') as HTMLInputElement
    company.value = '南方电网'
    company.dispatchEvent(new Event('input'))
    position.value = '数字化研发'
    position.dispatchEvent(new Event('input'))
    const jd = document.querySelector('textarea[data-field="jobDesc"]') as HTMLTextAreaElement
    jd.value = '熟悉 Spring Boot / MySQL，有分布式经验优先'
    jd.dispatchEvent(new Event('input'))
    await flushPromises()
    await wrapper.find('.app-save').trigger('click')
    await flushPromises()
    const saved = wrapper.emitted('save')
    expect(saved).toBeTruthy()
    expect(saved![0]![0]).toMatchObject({
      company: '南方电网',
      position: '数字化研发',
      jobDesc: '熟悉 Spring Boot / MySQL，有分布式经验优先',
    })
    wrapper.unmount()
  })
})
