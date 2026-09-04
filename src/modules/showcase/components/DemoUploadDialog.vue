<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElOption, ElSelect } from 'element-plus'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useDemoStore } from '../demoStore'
import { useProjectStore } from '../projectStore'

const store = useDemoStore()
const projectStore = useProjectStore()
const open = defineModel<boolean>({ default: false })

const form = reactive({
  projectId: '',
  title: '',
})
const error = ref('')
const fileName = ref('')
const fileSize = ref(0)
const dragging = ref(false)
let pendingHtml = ''

const HTML_EXT = /\.html?$/i

/** 放置区两行文案：拖入中 / 已选文件 / 空闲三态，主行副行分开给，避免模板里拼串 */
const dropLabel = computed(() => {
  if (dragging.value) return '松手即可上传'
  return fileName.value ? `已选择：${fileName.value}` : '把 .html 文件拖到这里'
})

const dropSub = computed(() => {
  if (dragging.value) return '仅接受 .html / .htm'
  return fileName.value ? `${sizeText(fileSize.value)} · 点击可重新选择` : '或点击选择 · 单文件、自包含'
})

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
    pendingHtml = text
    fileName.value = file.name
    fileSize.value = file.size
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

/** 打开弹窗时校准默认项目：首个可见项目 */
function onOpenPanel() {
  form.projectId = projectStore.visible[0]?.id ?? ''
  error.value = ''
  dragging.value = false
}

async function save() {
  if (!pendingHtml) {
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
  await store.addDemo({ projectId: form.projectId, title: form.title.trim(), html: pendingHtml })
  open.value = false
  reset()
}

function reset() {
  pendingHtml = ''
  fileName.value = ''
  fileSize.value = 0
  form.title = ''
  error.value = ''
  dragging.value = false
}
</script>

<template>
  <!-- 居中与移动端宽度自适应由 global.css 的 .el-overlay-dialog 规则统一提供 -->
  <ElDialog
    v-model="open"
    width="520px"
    @open="onOpenPanel"
  >
    <!-- 说明文字进标题区：正文只剩「放置区 + 两个字段」，主次一眼分明。
         不传 title prop 时 EP 才会把 aria-labelledby 指到 titleId，故标题必须自己挂这个 id -->
    <template #header="{ titleId, titleClass }">
      <div class="du-head">
        <h2
          :id="titleId"
          :class="titleClass"
          class="du-h"
        >
          上传交互式演示页
        </h2>
        <p class="du-lede">
          单文件、自包含的 HTML；保存后成为该项目的纵向演示页，以沙箱 iframe 呈现。
        </p>
      </div>
    </template>
    <div class="du-body">
      <label
        class="du-file"
        :class="{ 'is-drag': dragging, 'is-picked': !!fileName && !dragging }"
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
            :name="fileName && !dragging ? 'file' : 'upload'"
            :size="20"
          />
        </span>
        <b class="du-main">{{ dropLabel }}</b>
        <span class="du-sub">{{ dropSub }}</span>
      </label>
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
      <p
        v-if="error"
        class="du-error form-alert"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
    <template #footer>
      <ElButton @click="open = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="du-save"
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
/* 两个字段都短，并排放，弹窗高度让给放置区 */
.du-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  margin-top: 16px;
}
.du-field {
  min-width: 0;
}
.du-field label {
  display: block;
  font-size: 12px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
  margin-bottom: 6px;
}
.req {
  color: var(--danger);
}
.du-error {
  margin-top: 14px;
}
@media (max-width: 560px) {
  .du-grid {
    grid-template-columns: 1fr;
  }
}
</style>
