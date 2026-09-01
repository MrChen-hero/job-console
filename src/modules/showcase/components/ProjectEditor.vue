<script setup lang="ts">
import { reactive } from 'vue'
import { ElButton, ElInput, ElOption, ElSelect } from 'element-plus'
import type { MergedProject, ProjectInput } from '../projectStore'
import { validateProjectInput } from '../projectStore'

const props = defineProps<{
  /** 编辑目标；为 null 时是新建 */
  initial?: MergedProject | null
}>()

const emit = defineEmits<{
  save: [input: ProjectInput]
  cancel: []
}>()

const form = reactive({
  title: props.initial?.title ?? '',
  eyebrow: props.initial?.eyebrow ?? '',
  accent: (props.initial?.accent ?? 'violet') as NonNullable<MergedProject['accent']>,
  summary: props.initial?.summary ?? '',
  stack: props.initial?.stack.join(', ') ?? '',
  demoTitle: props.initial?.demo.title ?? '',
  demoPoints: props.initial?.demo.points.join('\n') ?? '',
})
const error = reactive({ value: '' })

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
  emit('save', input)
}
</script>

<template>
  <!-- 内联面板：与 DocEditor/DemoUploadDialog 同策略，避开 ElDialog 在 jsdom 的限制 -->
  <div
    class="proj-editor"
    data-testid="proj-editor"
  >
    <div class="pe-head">
      <h3>{{ initial ? '编辑项目' : '新增项目' }}</h3>
    </div>
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
    <div class="pe-actions">
      <ElButton @click="emit('cancel')">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="pe-save"
        @click="save"
      >
        保存项目
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.proj-editor {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 16px 18px;
  margin-bottom: 14px;
}
.pe-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.pe-head h3 {
  font-size: 14px;
}
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
.pe-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
@media (max-width: 860px) {
  .pe-row {
    grid-template-columns: 1fr;
  }
}
</style>
