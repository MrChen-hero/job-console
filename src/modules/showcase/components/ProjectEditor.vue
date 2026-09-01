<script setup lang="ts">
import { reactive } from 'vue'
import { ElButton, ElDialog, ElInput, ElOption, ElSelect } from 'element-plus'
import type { MergedProject, ProjectInput } from '../projectStore'
import { validateProjectInput } from '../projectStore'

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
          <label for="pe-accent">主题色</label>
          <ElSelect
            id="pe-accent"
            v-model="form.accent"
            data-field="accent"
          >
            <ElOption
              label="紫罗兰"
              value="violet"
            />
            <ElOption
              label="青色"
              value="teal"
            />
            <ElOption
              label="琥珀"
              value="amber"
            />
            <ElOption
              label="玫瑰"
              value="rose"
            />
          </ElSelect>
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
  grid-template-columns: 1.4fr 1.2fr 120px;
  gap: 14px;
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
