<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElPopover } from 'element-plus'
import type { MergedProject, ProjectInput } from '../projectStore'
import { ACCENT_OPTIONS, validateProjectInput } from '../projectStore'

const props = defineProps<{
  /** 编辑目标；为 null 时是新建 */
  initial?: MergedProject | null
}>()

const emit = defineEmits<{
  save: [input: ProjectInput]
}>()

const visible = defineModel<boolean>({ default: false })

const form = reactive({
  title: '',
  eyebrow: '',
  accent: 'violet' as MergedProject['accent'],
  summary: '',
  stack: '',
  demoTitle: '',
  demoPoints: '',
})
const error = reactive({ value: '' })
const accentOpen = ref(false)

const accentLabel = computed(() => ACCENT_OPTIONS.find((a) => a.id === form.accent)?.label ?? form.accent)

/** 色板下拉收起态外观与 ElSelect 一致；旧数据 accent 不在色板内时仍显示原名与色点（令牌缺省回落 violet） */
function pickAccent(id: MergedProject['accent']) {
  form.accent = id
  accentOpen.value = false
}

/** 弹窗打开时从 initial 同步表单（组件常驻，不能只在 setup 取一次初值） */
function onOpen() {
  form.title = props.initial?.title ?? ''
  form.eyebrow = props.initial?.eyebrow ?? ''
  form.accent = props.initial?.accent ?? 'violet'
  form.summary = props.initial?.summary ?? ''
  form.stack = props.initial?.stack.join(', ') ?? ''
  form.demoTitle = props.initial?.demo.title ?? ''
  form.demoPoints = props.initial?.demo.points.join('\n') ?? ''
  error.value = ''
}

function save() {
  const input: ProjectInput = {
    title: form.title,
    eyebrow: form.eyebrow,
    accent: form.accent,
    summary: form.summary,
    stack: form.stack.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    demoTitle: form.demoTitle,
    demoPoints: form.demoPoints.split('\n').map((s) => s.trim()).filter(Boolean),
  }
  error.value = validateProjectInput(input)
  if (error.value) return
  visible.value = false
  emit('save', input)
}
</script>

<template>
  <!-- 居中与移动端宽度自适应由 global.css 的 .el-overlay-dialog 规则统一提供 -->
  <ElDialog
    v-model="visible"
    :title="initial ? '编辑项目' : '新增项目'"
    width="560px"
    @open="onOpen"
  >
    <div class="proj-form">
      <div class="pe-row">
        <div class="pe-field grow">
          <label for="pe-title">项目名称 <span class="req">*</span></label>
          <ElInput
            id="pe-title"
            v-model="form.title"
            data-field="title"
            placeholder="如：校园二手交易小程序"
          />
        </div>
        <div class="pe-field">
          <label for="pe-eyebrow">眉头标签</label>
          <ElInput
            id="pe-eyebrow"
            v-model="form.eyebrow"
            data-field="eyebrow"
            placeholder="如：三端全栈 · 独立开发"
          />
        </div>
        <div class="pe-field">
          <label id="pe-accent-label">主题色</label>
          <ElPopover
            v-model:visible="accentOpen"
            trigger="click"
            :width="228"
            placement="bottom-start"
            :popper-style="{ padding: '8px' }"
          >
            <template #reference>
              <button
                type="button"
                class="accent-select"
                aria-label="选择主题色"
                aria-haspopup="true"
                :aria-expanded="accentOpen"
                data-field="accent"
              >
                <span
                  class="swatch-dot"
                  :style="{ background: `var(--accent-${form.accent}, var(--accent-violet))` }"
                />
                <span class="accent-name">{{ accentLabel }}</span>
                <span class="accent-caret">▾</span>
              </button>
            </template>
            <div
              class="swatches"
              role="group"
              aria-label="主题色"
            >
              <button
                v-for="a in ACCENT_OPTIONS"
                :key="a.id"
                type="button"
                class="swatch"
                :class="{ on: form.accent === a.id }"
                :aria-pressed="form.accent === a.id"
                :aria-label="`主题色 ${a.label}`"
                :title="a.label"
                @click="pickAccent(a.id)"
              >
                <span
                  class="swatch-dot"
                  :style="{ background: `var(--accent-${a.id})` }"
                />
                <span class="swatch-name">{{ a.label }}</span>
              </button>
            </div>
          </ElPopover>
        </div>
      </div>
      <div class="pe-field">
        <label for="pe-summary">项目简介</label>
        <ElInput
          id="pe-summary"
          v-model="form.summary"
          type="textarea"
          :rows="3"
          data-field="summary"
          placeholder="一句话讲清项目做了什么、用了什么、结果如何"
        />
      </div>
      <div class="pe-field">
        <label for="pe-stack">技术栈（逗号分隔）</label>
        <ElInput
          id="pe-stack"
          v-model="form.stack"
          data-field="stack"
          placeholder="Spring Boot, Vue, Redis"
        />
      </div>
      <div class="pe-field">
        <label for="pe-demo-title">演示页标题</label>
        <ElInput
          id="pe-demo-title"
          v-model="form.demoTitle"
          data-field="demoTitle"
          placeholder="如：演示页 · 核心流程"
        />
      </div>
      <div class="pe-field">
        <label for="pe-demo-points">演示页要点（每行一条）</label>
        <ElInput
          id="pe-demo-points"
          v-model="form.demoPoints"
          type="textarea"
          :rows="4"
          data-field="demoPoints"
          placeholder="要点一&#10;要点二"
        />
      </div>
      <p
        v-if="error.value"
        class="pe-error"
        role="alert"
      >
        {{ error.value }}
      </p>
    </div>
    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="pe-save"
        @click="save"
      >
        保存项目
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.pe-row {
  display: grid;
  grid-template-columns: 1.4fr 1.2fr 132px;
  gap: 14px;
}
/* 下拉触发器：外观对齐 EP 输入控件（--control 描边、等高、圆角） */
.accent-select {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--control);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.16s;
}
.accent-select:hover {
  border-color: var(--border2);
}
.accent-select:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.accent-name {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.accent-caret {
  color: var(--muted);
  font-size: 11px;
}
/* 弹出层内的 3×3 色板：色块即选项，选中态主色描边 */
.swatches {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.swatch {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card);
  cursor: pointer;
  transition: border-color 0.16s, background 0.16s;
}
.swatch:hover {
  border-color: var(--border2);
  background: var(--card2);
}
.swatch:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.swatch.on {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.swatch-dot {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(23, 32, 51, 0.08);
}
.swatch-name {
  font-size: 12px;
  color: var(--text2);
}
.swatch.on .swatch-name {
  color: var(--primary-text);
  font-weight: var(--fw-semibold);
}
.pe-field {
  margin-bottom: 14px;
  min-width: 0;
}
.pe-field label {
  display: block;
  font-size: 12px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
  margin-bottom: 6px;
}
.req {
  color: var(--danger);
}
.pe-error {
  color: var(--danger);
  font-size: 12px;
  margin-bottom: 10px;
}
@media (max-width: 640px) {
  .pe-row {
    grid-template-columns: 1fr;
  }
}
</style>
