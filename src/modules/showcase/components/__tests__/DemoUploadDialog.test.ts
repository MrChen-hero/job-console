import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import DemoUploadDialog from '../DemoUploadDialog.vue'

/** jsdom 没有 DataTransfer 构造器，测试只用到 files 一项，按需伪造 */
function dropWith(name: string, html = '<html><title>拖来的演示</title></html>') {
  return { dataTransfer: { files: [new File([html], name, { type: 'text/html' })] } }
}

function mountDialog() {
  // ElDialog 由 src/test/setup.ts 全局 stub 成透传容器，弹窗内容直接可见
  return mount(DemoUploadDialog, { props: { modelValue: true } })
}

describe('DemoUploadDialog 拖拽上传', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('拖入 .html：读出内容并按 <title> 回填标题', async () => {
    const wrapper = mountDialog()
    const zone = wrapper.get('[data-testid="demo-file-label"]')
    await zone.trigger('drop', dropWith('审核状态机.html'))
    await flushPromises()
    expect(zone.text()).toContain('已选择：审核状态机.html')
    expect((wrapper.get('input[data-field="du-title"]').element as HTMLInputElement).value).toBe('拖来的演示')
  })

  it('拖入非 html 文件：报错且不接受，保存时仍提示先选文件', async () => {
    const wrapper = mountDialog()
    const zone = wrapper.get('[data-testid="demo-file-label"]')
    await zone.trigger('drop', dropWith('截图.png'))
    await flushPromises()
    expect(wrapper.get('.du-error').text()).toContain('只支持 .html / .htm 文件')
    expect(zone.text()).toContain('点击选择')
    await wrapper.get('.du-save').trigger('click')
    expect(wrapper.get('.du-error').text()).toContain('请先选择')
  })

  it('拖到区域上方高亮、移出撤销；落在内部子元素上不算移出', async () => {
    const wrapper = mountDialog()
    const zone = wrapper.get('[data-testid="demo-file-label"]')
    await zone.trigger('dragover')
    expect(zone.classes()).toContain('is-drag')
    // relatedTarget 仍在放置区内（拖过内部文案）：保持高亮
    await zone.trigger('dragleave', { relatedTarget: zone.get('span').element })
    expect(zone.classes()).toContain('is-drag')
    await zone.trigger('dragleave', { relatedTarget: null })
    expect(zone.classes()).not.toContain('is-drag')
  })
})
