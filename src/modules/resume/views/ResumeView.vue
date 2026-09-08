<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElButton, ElDialog, ElMessage } from 'element-plus'
import { useResumeStore } from '../store'
import { applyExampleProfile } from '../exampleProfile'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import ProfileEditor from '../components/ProfileEditor.vue'
import VersionManager from '../components/VersionManager.vue'
import ResumeSheet from '../sheet/ResumeSheet.vue'

const store = useResumeStore()
const preparing = ref(true)
const viewMode = ref<'edit' | 'preview'>('edit')
const saveState = ref('已保存到本机')
const loadError = ref('')
const editor = ref<InstanceType<typeof ProfileEditor> | null>(null)
const leaveOpen = ref(false)
const leaveSaving = ref(false)
const leaveKind = ref<'leave' | 'print'>('leave')
let resolveLeave: ((value: boolean) => void) | null = null

function finishLeave(value: boolean) {
  leaveOpen.value = false
  resolveLeave?.(value)
  resolveLeave = null
}

function discardAndContinue() {
  // 打印已保存内容时保留表单草稿；只有离开/切换才放弃草稿。
  if (leaveKind.value === 'leave') editor.value?.discard()
  finishLeave(true)
}

async function saveAndContinue() {
  leaveSaving.value = true
  try {
    if (await editor.value?.save()) finishLeave(true)
    else {
      finishLeave(false)
      viewMode.value = 'edit'
    }
  } finally { leaveSaving.value = false }
}

async function mayContinue(kind: 'leave' | 'print' = 'leave'): Promise<boolean> {
  if (editor.value?.saving || resolveLeave) return false
  if (!editor.value?.dirty) return true
  leaveKind.value = kind
  leaveOpen.value = true
  return new Promise((resolve) => { resolveLeave = resolve })
}
onBeforeRouteLeave(() => mayContinue())
function beforeUnload(event: BeforeUnloadEvent) {
  if (!editor.value?.dirty && !editor.value?.saving) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))

async function initStore() {
  preparing.value = true
  loadError.value = ''
  try { await store.load() }
  catch { loadError.value = '简历加载失败，请重试。' }
  finally { preparing.value = false }
}
void initStore()

/* A4 等比缩放预览：纸面固定 210mm，容器装不下时按宽度等比缩小。
   previewEl 位于 v-else 分支，需 watch 其挂载后再测量与观察。 */
const previewEl = ref<HTMLElement | null>(null)
const sheetScale = ref(1)
const sheetHeight = ref(0)
const sheetWidth = ref(794)
let previewObserver: ResizeObserver | null = null
let measureFrame = 0

const A4_WIDTH_PX = 794 // 210mm 在 96dpi 下的像素值

function measurePreview(): void {
  const el = previewEl.value
  if (!el) return
  const paper = el.querySelector<HTMLElement>('.sheet')
  if (!paper || !el.clientWidth) return
  const style = getComputedStyle(el)
  const available = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  sheetWidth.value = paper.offsetWidth || A4_WIDTH_PX
  sheetHeight.value = paper.offsetHeight
  sheetScale.value = Math.min(1, Math.max(0, available) / sheetWidth.value)
}

watch(previewEl, (el) => {
  previewObserver?.disconnect()
  previewObserver = null
  if (!el) return
  measurePreview()
  // 尺寸通知后下一帧再写布局，避免观察器同步写回自身尺寸形成循环。
  previewObserver = new ResizeObserver(() => {
    cancelAnimationFrame(measureFrame)
    measureFrame = requestAnimationFrame(measurePreview)
  })
  previewObserver.observe(el)
  const paper = el.querySelector('.sheet')
  if (paper) previewObserver.observe(paper)
})
watch(viewMode, async () => { await nextTick(); measurePreview() })

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  resolveLeave?.(false)
  cancelAnimationFrame(measureFrame)
  previewObserver?.disconnect()
  previewObserver = null
})

async function printResume() {
  if (!await mayContinue('print')) return
  await nextTick()
  window.print()
}

async function fillExample() {
  try {
    await applyExampleProfile(store)
    ElMessage.success('已生成示例资料，可继续在下方编辑')
  } catch { ElMessage.error('示例资料保存失败，请重试') }
}
async function startBlank() {
  try { await store.ensureProfile('你的姓名') }
  catch { ElMessage.error('创建失败，请重试') }
}
</script>

<template>
  <div
    class="resume-view"
    :class="{ preparing }"
  >
    <div
      v-if="preparing"
      class="resume-loading"
    >
      加载中…
    </div>

    <div
      v-else-if="loadError"
      class="resume-empty"
      role="alert"
    >
      <p>{{ loadError }}</p>
      <ElButton @click="initStore">
        重新加载
      </ElButton>
    </div>
    <div
      v-else-if="!store.profile"
      class="resume-empty no-print"
    >
      <h3>开始建立你的简历</h3>
      <p>可以一键填入虚构的示例资料，再逐条修改成自己的内容；也可以从空白开始。</p>
      <div class="resume-empty-actions">
        <ElButton
          type="primary"
          class="example-btn"
          @click="fillExample"
        >
          一键填入示例资料
        </ElButton>
        <ElButton @click="startBlank">
          从空白开始
        </ElButton>
      </div>
    </div>

    <div
      v-else
      class="resume-layout"
      :class="`mode-${viewMode}`"
    >
      <div class="resume-controls no-print">
        <div class="resume-current">
          <strong>{{ store.activeVersion?.name }}</strong><span role="status">{{ saveState }}</span>
        </div>
        <div
          class="resume-switch"
          role="group"
          aria-label="简历视图"
        >
          <button
            :aria-pressed="viewMode === 'edit'"
            @click="viewMode = 'edit'"
          >
            编辑
          </button>
          <button
            :aria-pressed="viewMode === 'preview'"
            @click="viewMode = 'preview'"
          >
            预览
          </button>
        </div>
        <ElButton
          type="primary"
          class="print-btn"
          @click="printResume"
        >
          <AppIcon
            name="printer"
            :size="15"
            class="btn-ic"
          />打印 / 导出 PDF
        </ElButton>
        <span class="resume-hint">预览和导出使用已保存的内容。</span>
      </div>
      <div class="resume-side no-print">
        <VersionManager :before-change="() => mayContinue()" />
        <ProfileEditor
          ref="editor"
          @save-state="saveState = $event"
        />
      </div>
      <div class="resume-main">
        <div
          ref="previewEl"
          class="resume-preview paper-stage"
        >
          <div
            class="sheet-scaler"
            :style="{ width: `${sheetWidth * sheetScale}px`, height: `${sheetHeight * sheetScale}px` }"
          >
            <div :style="{ transform: `scale(${sheetScale})` }">
              <ResumeSheet />
            </div>
          </div>
        </div>
      </div>
    </div>
    <ElDialog
      :model-value="leaveOpen"
      :title="leaveKind === 'print' ? '打印前有未保存修改' : '保存简历修改？'"
      append-to-body
      width="420px"
      :show-close="!leaveSaving"
      :close-on-click-modal="!leaveSaving"
      :close-on-press-escape="!leaveSaving"
      @update:model-value="(open: boolean) => { if (!open) finishLeave(false) }"
    >
      <p>{{ leaveKind === 'print' ? '可以先保存修改再打印，也可以打印已保存的内容。' : '当前简历有未保存修改，请选择如何处理。' }}</p>
      <template #footer>
        <ElButton
          :disabled="leaveSaving"
          @click="finishLeave(false)"
        >
          继续编辑
        </ElButton>
        <ElButton
          :disabled="leaveSaving"
          @click="discardAndContinue"
        >
          {{ leaveKind === 'print' ? '打印已保存内容' : '放弃修改' }}
        </ElButton>
        <ElButton
          type="primary"
          :loading="leaveSaving"
          @click="saveAndContinue"
        >
          {{ leaveKind === 'print' ? '保存后打印' : '保存并继续' }}
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.resume-controls { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--card); }
.resume-current { display: grid; gap: 2px; margin-right: auto; }
.resume-current span { color: var(--muted); font-size: 12px; }
.resume-controls .resume-hint { width: 100%; }
.resume-switch { display: none; gap: 4px; padding: 3px; border-radius: var(--r-sm); background: var(--surface-muted); }
.resume-switch button { min-height: 38px; padding: 0 16px; border-radius: var(--r-sm); }
.resume-switch button[aria-pressed='true'] { background: var(--card); color: var(--primary-text); }
.resume-main {
  min-width: 0;
  display: grid;
  gap: 0;
}
.resume-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 14px;
}
.resume-hint {
  margin-right: auto;
  font-size: 12px;
  color: var(--muted);
}
.btn-ic {
  margin-right: 6px;
}
.resume-loading,
.resume-empty {
  color: var(--text2);
  padding: 48px;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: var(--r-lg);
  background: var(--card);
}
.resume-empty h3 {
  color: var(--text);
  margin-bottom: 8px;
}
.resume-empty-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 18px;
}
.resume-layout {
  display: grid;
  grid-template-columns: minmax(0, 480px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.resume-side {
  /* 隐式 auto 列会被 nowrap 标题的 min-content 撑破轨道导致左右重叠，
     显式单列 minmax(0,1fr) 强制卡片收缩到轨道内 */
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
}
.resume-preview {
  display: flex;
  justify-content: center;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: var(--surface-muted);
  overflow: auto;
}
.sheet-scaler {
  flex-shrink: 0;
  overflow: hidden;
  /* transform 缩放后不改变布局占位，需手动给包裹层设定 A4 等比宽度与高度 */
  transform-origin: top left;
}
.sheet-scaler > div {
  width: 210mm;
  transform-origin: top left;
}
.sheet-scaler :deep(.sheet) {
  box-shadow: var(--shadow-md);
}
@media (max-width: 1180px) {
  .resume-switch { display: flex; }
  .mode-edit .resume-main, .mode-preview .resume-side { display: none; }
  .resume-layout {
    grid-template-columns: 1fr;
  }
}

/* 打印：仅输出 A4 纸面 */
@media print {
  :global(.sidebar),
  :global(.topbar),
  .no-print {
    display: none !important;
  }
  :global(.main-column) {
    margin-left: 0 !important;
  }
  :global(.content) {
    padding: 0 !important;
    max-width: none !important;
  }
  .resume-toolbar,
  .resume-loading,
  .resume-empty {
    display: none !important;
  }
  .resume-layout {
    display: block !important;
  }
  .resume-preview {
    display: block !important;
    padding: 0 !important;
    border: 0 !important;
    overflow: visible !important;
  }
  .resume-main { display: block !important; }
  .sheet-scaler {
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }
  .sheet-scaler > div {
    transform: none !important;
    width: auto !important;
  }
  .sheet {
    width: auto !important;
    min-height: auto !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
}
</style>

<style>
@media print {
  @page {
    size: A4;
    margin: 12mm;
  }
  body {
    background: #fff !important;
  }
}
</style>
