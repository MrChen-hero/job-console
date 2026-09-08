import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ImportDialog from './ImportDialog.vue'
import type { BackupFile } from '../storage/backup'

const backup: BackupFile = { schemaVersion: 4, exportedAt: '2026-09-08', data: { profile: [], resumeVersions: [], applications: [], companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [], libraryCategories: [], runtimeProjects: [], deletedDocs: [] } }

describe('ImportDialog', () => {
  it('取消不导入；失败保留弹窗，重试成功后关闭', async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')).mockResolvedValue(undefined)
    const wrapper = mount(ImportDialog, { props: { incoming: backup, current: backup, persist } })
    await wrapper.findAll('button').find((b) => b.text() === '取消')!.trigger('click')
    expect(persist).not.toHaveBeenCalled()
    const priorCloses = wrapper.emitted('close')!.length
    await wrapper.findAll('button').find((b) => b.text() === '确认合并导入')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('导入失败')
    expect(wrapper.emitted('close')).toHaveLength(priorCloses)
    await wrapper.findAll('button').find((b) => b.text() === '确认合并导入')!.trigger('click')
    await flushPromises()
    expect(persist).toHaveBeenLastCalledWith('merge')
    expect(wrapper.emitted('close')).toHaveLength(priorCloses + 1)
    wrapper.unmount()
  })

  it('覆盖必须确认，切换方式后必须重新确认', async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(ImportDialog, { props: { incoming: backup, current: backup, persist } })
    await wrapper.find('input[value="overwrite"]').setValue(true)
    const submit = () => wrapper.findAll('button').find((b) => b.text() === '确认覆盖导入')!
    expect(submit().attributes('disabled')).toBeDefined()
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(submit().attributes('disabled')).toBeUndefined()
    await wrapper.find('input[value="merge"]').setValue(true)
    await wrapper.find('input[value="overwrite"]').setValue(true)
    expect(submit().attributes('disabled')).toBeDefined()
    expect(persist).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
