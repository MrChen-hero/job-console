<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElButton, ElMessage } from 'element-plus'
import { useResumeStore } from '../store'
import { applyExampleProfile } from '../exampleProfile'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import ProfileEditor from '../components/ProfileEditor.vue'
import VersionManager from '../components/VersionManager.vue'
import ResumeSheet from '../sheet/ResumeSheet.vue'

const store = useResumeStore()
const preparing = ref(true)

async function initStore() {
  await store.load()
  preparing.value = false
}
void initStore()

/* A4 等比缩放预览：纸面固定 210mm，容器装不下时按宽度等比缩小。
   previewEl 位于 v-else 分支，需 watch 其挂载后再测量与观察。 */
const previewEl = ref<HTMLElement | null>(null)
const sheetScale = ref(1)
let previewObserver: ResizeObserver | null = null

const A4_WIDTH_PX = 794 // 210mm 在 96dpi 下的像素值

function measurePreview(): void {
  const el = previewEl.value
  if (!el) return
  const available = el.clientWidth
  sheetScale.value = available > 0 ? Math.min(1, available / A4_WIDTH_PX) : 1
}

watch(previewEl, (el) => {
  previewObserver?.disconnect()
  previewObserver = null
  if (!el) return
  measurePreview()
  previewObserver = new ResizeObserver(measurePreview)
  previewObserver.observe(el)
})

onBeforeUnmount(() => {
  previewObserver?.disconnect()
  previewObserver = null
})

function printResume() {
  window.print()
}

async function fillExample() {
  await applyExampleProfile(store)
  ElMessage.success('已生成示例资料，可继续在下方编辑')
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
        <ElButton @click="store.ensureProfile('你的姓名')">
          从空白开始
        </ElButton>
      </div>
    </div>

    <div
      v-else
      class="resume-layout"
    >
      <div class="resume-side no-print">
        <VersionManager />
        <ProfileEditor />
      </div>
      <div class="resume-main">
        <div class="resume-toolbar no-print">
          <span class="resume-hint">左侧编辑，右侧实时预览；打印时仅输出 A4 纸面。</span>
          <ElButton
            type="primary"
            class="print-btn"
            @click="printResume"
          >
            <AppIcon
              name="printer"
              :size="15"
              class="btn-ic"
            />
            打印 / 导出 PDF
          </ElButton>
        </div>
        <div
          ref="previewEl"
          class="resume-preview paper-stage"
        >
          <div
            class="sheet-scaler"
            :style="{ width: `calc(210mm * ${sheetScale})` }"
          >
            <div :style="{ transform: `scale(${sheetScale})` }">
              <ResumeSheet />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  }
  .sheet-scaler {
    width: auto !important;
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
