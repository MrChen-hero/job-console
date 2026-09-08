import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import DocEditor from './DocEditor.vue'

describe('DocEditor persistence', () => {
  it('保存失败时保留输入和 dirty，重试成功才结束编辑', async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValue(undefined)
    const wrapper = mount(DocEditor, { props: { initial: { title: '原题', body: '正文', category: '高频问题' }, persist }, global: { plugins: [createPinia()] } })
    await wrapper.find('input[data-field="title"]').setValue('新题')
    await wrapper.find('.editor-save').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('内容已保留')
    expect(wrapper.vm.dirty).toBe(true)
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.find('.editor-save').trigger('click')
    await flushPromises()
    expect(persist).toHaveBeenCalledTimes(2)
    expect(persist.mock.calls[1]![0].title).toBe('新题')
    expect(wrapper.vm.dirty).toBe(false)
    expect(wrapper.emitted('save')).toHaveLength(1)
    wrapper.unmount()
  })
})
