<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElOption, ElSelect } from 'element-plus'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { isHttpUrl } from '../../../shared/safeUrl'
import { useDemoStore, type MergedDemo } from '../demoStore'
import { useProjectStore } from '../projectStore'

const props = defineProps<{
  /** 编辑目标；为 null 时是新建 */
  initial?: MergedDemo | null
}>()

const store = useDemoStore()
const projectStore = useProjectStore()
const open = defineModel<boolean>({ default: false })

/** 演示来源：上传单文件 HTML，或指向自部署站点的链接 */
type Source = 'file' | 'link'

const form = reactive({
  projectId: '',
  title: '',
  url: '',
  points: '',
})
const source = ref<Source>('file')
const error = ref('')
const saving = ref(false)
const fileName = ref('')
const dragging = ref(false)
const pendingHtml = ref('')

const HTML_EXT = /\.html?$/i

const pointList = computed(() => form.points.split('\n').map((s) => s.trim()).filter(Boolean))

/** 已有 HTML 的体积：编辑态没重新选文件也要能显示，故一律按内容的 UTF-8 字节数算 */
const htmlBytes = computed(() => new TextEncoder().encode(pendingHtml.value).length)

/** 放置区两行文案：拖入中 / 刚选中 / 编辑态沿用原内容 / 空闲四态 */
const dropLabel = computed(() => {
  if (dragging.value) return '松手即可上传'
  if (fileName.value) return `已选择：${fileName.value}`
  if (pendingHtml.value) return '沿用原有 HTML 内容'
  return '把 .html 文件拖到这里'
})

const dropSub = computed(() => {
  if (dragging.value) return '仅接受 .html / .htm'
  if (fileName.value || pendingHtml.value) return `${sizeText(htmlBytes.value)} · 点击可重新选择`
  return '或点击选择 · 单文件、自包含'
})

/** 面板下方的注意事项：两种来源各有各的坑，位置固定在面板外，切来源不跳版 */
const sourceNote = computed(() => (
  source.value === 'link'
    ? '只支持 http / https 地址。本站以 https 部署时 http 链接会被按混合内容拦掉；对方站点设了 X-Frame-Options 时只能走「新标签打开」。'
    : '页面须是单文件自包含（样式与脚本内联），以 Blob URL + 沙箱 iframe 渲染，拿不到本站数据。'
))

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 点击选择与拖入共用：扩展名自己校验（accept 只约束文件选择器，管不到拖拽） */
function readFile(file: File) {
  if (!HTML_EXT.test(file.name)) {
    error.value = '只支持 .html / .htm 文件'
    return
  }
  void file.text().then((text) => {
    pendingHtml.value = text
    fileName.value = file.name
    error.value = ''
    if (!form.title) {
      const match = /<title>([^<]*)<\/title>/i.exec(text)
      form.title = match?.[1]?.trim() ?? file.name.replace(HTML_EXT, '')
    }
  })
}

function onFileChange(event: Event) {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (file) readFile(file)
  // 立刻清空：不清的话同一个文件二次选择不触发 change。File 引用已交给 readFile，不受影响
  inputEl.value = ''
}

function onDragOver(event: DragEvent) {
  // 模板上的 .prevent 是必须的：不拦默认行为，浏览器会直接用新页面打开这个文件而不触发 drop
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  dragging.value = true
}

function onDragLeave(event: DragEvent) {
  // 移到内部元素上也会冒泡出 dragleave，落点仍在放置区内时不算离开
  const next = event.relatedTarget as Node | null
  if (next && (event.currentTarget as HTMLElement).contains(next)) return
  dragging.value = false
}

function onDrop(event: DragEvent) {
  dragging.value = false
  // 拖入多个只取第一个
  const file = event.dataTransfer?.files?.[0]
  if (file) readFile(file)
}

/** 打开弹窗时回填：编辑态取 initial，新建态默认落到首个可见项目 */
function onOpenPanel() {
  const init = props.initial
  reset()
  form.projectId = init?.projectId ?? projectStore.visible[0]?.id ?? ''
  form.title = init?.title ?? ''
  if (init && init.source === 'runtime') {
    form.url = init.url ?? ''
    form.points = (init.points ?? []).join('\n')
    pendingHtml.value = init.url ? '' : init.html
    source.value = init.url ? 'link' : 'file'
  } else if (init) {
    pendingHtml.value = init.html
  }
}

/** http/https 之外一律拒掉：javascript: 这类伪协议不能进 iframe src */
function urlError(raw: string): string {
  if (raw === '') return '请填写演示链接'
  if (!isHttpUrl(raw)) return '只支持 http / https 链接，需填写完整地址，如 https://demo.example.com'
  return ''
}

async function save() {
  if (saving.value) return
  const url = form.url.trim()
  if (source.value === 'link') {
    error.value = urlError(url)
    if (error.value) return
  } else if (!pendingHtml.value) {
    error.value = '请先选择 .html 文件'
    return
  }
  if (!form.projectId) {
    error.value = '没有可选的项目，请先创建项目'
    return
  }
  if (form.title.trim() === '') {
    error.value = '请填写演示标题'
    return
  }
  const isLink = source.value === 'link'
  const input = {
    projectId: form.projectId,
    title: form.title.trim(),
    // 两种来源互斥：存链接时 html 置空，存文件时 url 给 undefined（入库前 plain() 会丢掉该键）
    html: isLink ? '' : pendingHtml.value,
    url: isLink ? url : undefined,
    points: pointList.value,
  }
  saving.value = true
  try {
    if (props.initial) await store.updateDemo(props.initial.id, input)
    else await store.addDemo(input)
    open.value = false
    reset()
  } catch {
    error.value = '保存失败，输入已保留，请重试'
  } finally { saving.value = false }
}

function reset() {
  pendingHtml.value = ''
  fileName.value = ''
  form.title = ''
  form.url = ''
  form.points = ''
  error.value = ''
  dragging.value = false
  source.value = 'file'
}
</script>

<template>
  <!-- 居中与移动端宽度自适应由 global.css 的 .el-overlay-dialog 规则统一提供 -->
  <ElDialog
    v-model="open"
    width="520px"
    :show-close="!saving"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    @open="onOpenPanel"
  >
    <!-- 说明文字进标题区：正文只剩「来源面板 + 字段」，主次一眼分明。
         不传 title prop 时 EP 才会把 aria-labelledby 指到 titleId，故标题必须自己挂这个 id -->
    <template #header="{ titleId, titleClass }">
      <div class="du-head">
        <h2
          :id="titleId"
          :class="titleClass"
          class="du-h"
        >
          {{ initial ? '编辑交互演示' : '添加交互演示' }}
        </h2>
        <p class="du-lede">
          Deck 里项目下方的一层纵向页：可上传单文件自包含 HTML（沙箱 iframe 渲染），也可填自部署演示站点的链接。
        </p>
      </div>
    </template>
    <div class="du-body">
      <!-- 来源切换：两态共用同一高度的面板，切换不跳版（虚线=可拖放，实线=手填） -->
      <div
        class="du-modes"
        role="group"
        aria-label="演示来源"
      >
        <button
          type="button"
          class="du-mode"
          :class="{ on: source === 'file' }"
          :aria-pressed="source === 'file'"
          data-field="src-file"
          @click="source = 'file'"
        >
          <AppIcon
            name="upload"
            :size="14"
          />上传 HTML 文件
        </button>
        <button
          type="button"
          class="du-mode"
          :class="{ on: source === 'link' }"
          :aria-pressed="source === 'link'"
          data-field="src-link"
          @click="source = 'link'"
        >
          <AppIcon
            name="link"
            :size="14"
          />填演示链接
        </button>
      </div>
      <label
        v-if="source === 'file'"
        class="du-file"
        :class="{ 'is-drag': dragging, 'is-picked': !!(fileName || pendingHtml) && !dragging }"
        data-testid="demo-file-label"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <input
          type="file"
          accept=".html,.htm"
          class="du-input"
          @change="onFileChange"
        >
        <span class="du-badge">
          <AppIcon
            :name="(fileName || pendingHtml) && !dragging ? 'file' : 'upload'"
            :size="20"
          />
        </span>
        <b class="du-main">{{ dropLabel }}</b>
        <span class="du-sub">{{ dropSub }}</span>
      </label>
      <div
        v-else
        class="du-link"
        data-testid="demo-link-panel"
      >
        <span class="du-badge">
          <AppIcon
            name="link"
            :size="20"
          />
        </span>
        <ElInput
          v-model="form.url"
          class="du-url"
          data-field="du-url"
          placeholder="https://demo.example.com/my-project"
          @keyup.enter="save"
        />
      </div>
      <!-- 注意事项放面板外：两种来源都有这一行，切换时面板高度不变，弹窗不跳版 -->
      <p class="du-note">
        {{ sourceNote }}
      </p>
      <div class="du-grid">
        <div class="du-field">
          <label for="du-project">所属项目</label>
          <ElSelect
            id="du-project"
            v-model="form.projectId"
            data-field="du-project"
          >
            <ElOption
              v-for="p in projectStore.visible"
              :key="p.id"
              :label="p.title"
              :value="p.id"
            />
          </ElSelect>
        </div>
        <div class="du-field">
          <label for="du-title">演示标题 <span class="req">*</span></label>
          <ElInput
            id="du-title"
            v-model="form.title"
            data-field="du-title"
            placeholder="自动读取 &lt;title&gt;，可修改"
          />
        </div>
      </div>
      <div class="du-field">
        <label for="du-points">
          演示要点<span class="du-tip">每行一条，跟着这一页走</span>
          <span
            v-if="pointList.length"
            class="du-count tnum"
          >{{ pointList.length }} 条</span>
        </label>
        <ElInput
          id="du-points"
          v-model="form.points"
          type="textarea"
          :rows="3"
          data-field="du-points"
          placeholder="审核状态机：待审核 → 通过 / 拒绝，动作全量落日志&#10;敏感词过滤：发布时后端校验，命中拦截并留痕"
        />
      </div>
      <p
        v-if="error"
        class="du-error form-alert"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
    <template #footer>
      <ElButton
        :disabled="saving"
        @click="open = false"
      >
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="du-save"
        :loading="saving"
        @click="save"
      >
        保存演示
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
/* 标题区：主标题 + 副说明两行，右侧留出 EP 绝对定位的关闭按钮 */
.du-head {
  padding-right: 22px;
}
.du-h {
  font-size: 16px;
  font-weight: var(--fw-semibold);
  color: var(--text);
  line-height: 1.4;
}
.du-lede {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
}
/* 来源切换：一条分段控件，选中态用主色浅底 + 主色描边，与 EP 的 text 按钮区分开 */
.du-modes {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.du-mode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--text2);
  font-size: 12.5px;
  transition: color 0.16s var(--ease), border-color 0.16s var(--ease), background 0.16s var(--ease);
}
.du-mode:hover {
  color: var(--primary-text);
  border-color: var(--border2);
}
.du-mode.on {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-text);
  font-weight: var(--fw-semibold);
}
/*
 * 放置区是这个弹窗的主体，给足高度才像个「能往里扔东西」的靶子（原来是一行 14px 内边距的窄条）。
 * 三态共用同一 min-height，切换时不跳版：空闲（虚线 + card2 底）、拖入中（实线主色 + primary-soft）、
 * 已选（实线成功色 + success-soft，图标换成文件图标）。
 */
.du-file {
  display: grid;
  /* 单列显式定为 minmax(0,1fr)：auto 列会被 max-content 撑破容器，长文件名就顶出弹窗 */
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  justify-items: center;
  gap: 7px;
  position: relative;
  min-height: 152px;
  padding: 22px 20px;
  border: 1.5px dashed var(--border2);
  border-radius: var(--r-md);
  background: var(--card2);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.16s var(--ease), background 0.16s var(--ease);
}
.du-file:hover,
.du-file:focus-within {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.du-file.is-drag {
  border-style: solid;
  border-color: var(--primary);
  background: var(--primary-soft);
}
.du-file.is-picked {
  border-style: solid;
  border-color: var(--success-border);
  background: var(--success-soft);
}
/* 已选态仍要有可点的暗示：hover 时描边加深 */
.du-file.is-picked:hover {
  border-color: var(--success);
}
.du-badge {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 3px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--card);
  color: var(--muted);
  transition: color 0.16s var(--ease), border-color 0.16s var(--ease),
    background 0.16s var(--ease), transform 0.16s var(--ease);
}
.du-file:hover .du-badge,
.du-file:focus-within .du-badge {
  color: var(--primary-text);
  border-color: var(--primary-border);
}
/* 拖到区域上方：图标块填成主色并微抬 2px（动效上限见 DESIGN.md） */
.du-file.is-drag .du-badge {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-fg);
  transform: translateY(-2px);
}
.du-file.is-picked .du-badge {
  border-color: var(--success-border);
  background: var(--card);
  color: var(--success);
}
.du-main {
  max-width: 100%;
  font-size: 13.5px;
  font-weight: var(--fw-semibold);
  color: var(--text);
  /* 文件名可能很长，单行裁剪，不把放置区顶高 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.du-sub {
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}
.du-input {
  /* 不用 display:none：那样 input 不在焦点序列里，键盘用户打不开文件选择器 */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
/* 链接面板与放置区同高，切来源不跳版；实线描边表示「这里是手填的」而非可拖放 */
.du-link {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  justify-items: center;
  gap: 10px;
  min-height: 152px;
  padding: 22px 20px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--card2);
  text-align: center;
}
.du-link .du-badge {
  color: var(--primary-text);
  border-color: var(--primary-border);
}
.du-url {
  max-width: 340px;
}
.du-note {
  margin-top: 9px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--muted);
}
/* 两个字段都短，并排放，弹窗高度让给来源面板 */
.du-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  margin-top: 16px;
}
.du-field {
  min-width: 0;
  margin-bottom: 14px;
}
.du-grid .du-field {
  margin-bottom: 0;
}
.du-field label {
  display: block;
  font-size: 12px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
  margin-bottom: 6px;
}
/* 标签里的格式提示与实时计数：常规字重的次要信息，不与字段名抢注意力 */
.du-tip {
  margin-left: 6px;
  font-weight: var(--fw-normal);
  font-size: 11px;
  color: var(--muted);
}
.du-tip::before {
  content: '· ';
}
.du-count {
  float: right;
  font-weight: var(--fw-normal);
  font-size: 11px;
  color: var(--muted);
}
.req {
  color: var(--danger);
}
.du-error {
  margin-top: 2px;
}
@media (max-width: 560px) {
  .du-grid {
    grid-template-columns: 1fr;
  }
}
</style>
