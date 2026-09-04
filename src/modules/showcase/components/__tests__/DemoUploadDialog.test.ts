import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../../storage/db'
import type { MergedDemo } from '../../demoStore'
import DemoUploadDialog from '../DemoUploadDialog.vue'

/** jsdom 没有 DataTransfer 构造器，测试只用到 files 一项，按需伪造 */
function dropWith(name: string, html = '<html><title>拖来的演示</title></html>') {
  return { dataTransfer: { files: [new File([html], name, { type: 'text/html' })] } }
}

function mountDialog(initial: MergedDemo | null = null) {
  // ElDialog 由 src/test/setup.ts 全局 stub 成透传容器并照发 open 事件（表单回填挂在 @open 上）。
  // 回填发生在 stub 的 mounted 里，落到 DOM 要等一次 tick，故编辑态的断言前都先 flushPromises。
  return mount(DemoUploadDialog, { props: { modelValue: true, initial } })
}

const runtimeDemo = (over: Partial<MergedDemo> = {}): MergedDemo => ({
  source: 'runtime',
  id: 'demo-1',
  projectId: 'campus-market',
  title: '自部署演示',
  html: '',
  url: 'https://demo.example.com',
  points: ['要点一', '要点二'],
  createdAt: '2026-09-04',
  updatedAt: '2026-09-04',
  ...over,
} as MergedDemo)

describe('DemoUploadDialog', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
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
    await zone.trigger('dragleave', { relatedTarget: zone.get('.du-main').element })
    expect(zone.classes()).toContain('is-drag')
    await zone.trigger('dragleave', { relatedTarget: null })
    expect(zone.classes()).not.toContain('is-drag')
  })

  it('上传式保存：html 入库、要点按行拆分、url 不落库', async () => {
    const wrapper = mountDialog()
    await wrapper.get('[data-testid="demo-file-label"]').trigger('drop', dropWith('a.html', '<html><title>状态机</title>x</html>'))
    await flushPromises()
    await wrapper.get('textarea[data-field="du-points"]').setValue('要点一\n \n要点二')
    expect(wrapper.get('.du-count').text()).toBe('2 条')
    await wrapper.get('.du-save').trigger('click')
    await flushPromises()
    const rows = await db.runtimeDemos.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.html).toContain('状态机')
    expect(rows[0]!.points).toEqual(['要点一', '要点二'])
    expect(rows[0]!.url).toBeUndefined()
    // 首个可见项目（内置示例）作为默认归属
    expect(rows[0]!.projectId).toBe('organs-system')
  })
})

describe('DemoUploadDialog 链接来源', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    setActivePinia(createPinia())
  })

  it('切到链接来源：放置区换成链接面板', async () => {
    const wrapper = mountDialog()
    expect(wrapper.find('[data-testid="demo-file-label"]').exists()).toBe(true)
    await wrapper.get('[data-field="src-link"]').trigger('click')
    expect(wrapper.find('[data-testid="demo-file-label"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="demo-link-panel"]').exists()).toBe(true)
  })

  it('链接校验：空、非 http/https、格式错都拒掉且不落库', async () => {
    const wrapper = mountDialog()
    await wrapper.get('[data-field="src-link"]').trigger('click')
    await wrapper.get('.du-save').trigger('click')
    expect(wrapper.get('.du-error').text()).toContain('请填写演示链接')
    await wrapper.get('input[data-field="du-url"]').setValue('javascript:alert(1)')
    await wrapper.get('.du-save').trigger('click')
    expect(wrapper.get('.du-error').text()).toContain('只支持 http / https')
    await wrapper.get('input[data-field="du-url"]').setValue('demo.example.com')
    await wrapper.get('.du-save').trigger('click')
    expect(wrapper.get('.du-error').text()).toContain('链接格式不对')
    await flushPromises()
    expect(await db.runtimeDemos.count()).toBe(0)
  })

  it('链接式保存：url 入库、html 置空', async () => {
    const wrapper = mountDialog()
    await wrapper.get('[data-field="src-link"]').trigger('click')
    await wrapper.get('input[data-field="du-url"]').setValue('https://demo.example.com/app')
    await wrapper.get('input[data-field="du-title"]').setValue('自部署演示')
    await wrapper.get('textarea[data-field="du-points"]').setValue('自部署：Nginx + Docker')
    await wrapper.get('.du-save').trigger('click')
    await flushPromises()
    const rows = await db.runtimeDemos.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.url).toBe('https://demo.example.com/app')
    expect(rows[0]!.html).toBe('')
    expect(rows[0]!.points).toEqual(['自部署：Nginx + Docker'])
  })

  it('编辑态：按 initial 回填并切到对应来源，保存改本行而不新增', async () => {
    await db.runtimeDemos.put({
      id: 'demo-1',
      projectId: 'campus-market',
      title: '自部署演示',
      html: '',
      url: 'https://demo.example.com',
      points: ['要点一', '要点二'],
      createdAt: '2026-09-04',
      updatedAt: '2026-09-04',
    })
    const wrapper = mountDialog(runtimeDemo())
    await flushPromises()
    // 有 url 的行按链接来源打开，三项都回显
    expect(wrapper.find('[data-testid="demo-link-panel"]').exists()).toBe(true)
    expect((wrapper.get('input[data-field="du-url"]').element as HTMLInputElement).value).toBe('https://demo.example.com')
    expect((wrapper.get('textarea[data-field="du-points"]').element as HTMLTextAreaElement).value).toBe('要点一\n要点二')
    expect((wrapper.get('input[data-field="du-title"]').element as HTMLInputElement).value).toBe('自部署演示')

    await wrapper.get('input[data-field="du-title"]').setValue('自部署演示（改）')
    await wrapper.get('.du-save').trigger('click')
    await flushPromises()
    const rows = await db.runtimeDemos.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('demo-1')
    expect(rows[0]!.title).toBe('自部署演示（改）')
    expect(rows[0]!.createdAt).toBe('2026-09-04')
  })

  it('编辑态：上传式的行沿用原 HTML，不必重新选文件', async () => {
    await db.runtimeDemos.put({
      id: 'demo-2',
      projectId: 'campus-market',
      title: '原上传页',
      html: '<html><body>原内容</body></html>',
      createdAt: '2026-09-04',
      updatedAt: '2026-09-04',
    })
    const wrapper = mountDialog(runtimeDemo({ id: 'demo-2', title: '原上传页', html: '<html><body>原内容</body></html>', url: undefined, points: undefined }))
    await flushPromises()
    const zone = wrapper.get('[data-testid="demo-file-label"]')
    expect(zone.text()).toContain('沿用原有 HTML 内容')
    expect(zone.classes()).toContain('is-picked')
    await wrapper.get('.du-save').trigger('click')
    await flushPromises()
    const row = await db.runtimeDemos.get('demo-2')
    expect(row!.html).toBe('<html><body>原内容</body></html>')
  })
})
