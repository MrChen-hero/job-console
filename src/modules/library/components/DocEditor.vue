<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElButton, ElInput, ElOption, ElSelect } from 'element-plus'
import type { LibraryCategory } from '../../../storage/types'
import { renderMarkdown } from '../../../shared/markdown/render'
import { useLibraryStore } from '../store'

/** 编辑目标字段宽松化：可承接合并文档（local/runtime）或新建空表单 */
export interface DocEditorInitial {
  id?: string
  title?: string
  category?: LibraryCategory
  tags?: string[]
  body?: string
}

const props = defineProps<{
  /** 编辑目标；为 null 时是新建 */
  initial?: DocEditorInitial | null
  persist: (input: { id?: string; category: LibraryCategory; title: string; body: string; tags: string[] }) => Promise<void>
}>()

const emit = defineEmits<{
  save: [input: { id?: string; category: LibraryCategory; title: string; body: string; tags: string[] }]
  cancel: []
}>()

const showPreview = ref(false)
const store = useLibraryStore()
const form = reactive({
  title: props.initial?.title ?? '',
  category: (props.initial?.category ?? '高频问题') as LibraryCategory,
  tags: props.initial?.tags?.join(', ') ?? '',
  body: props.initial?.body ?? '',
})
const error = ref('')
const saving = ref(false)
const original = ref(JSON.stringify(form))
const dirty = computed(() => JSON.stringify(form) !== original.value)
const preview = computed(() => renderMarkdown(form.body))

async function save(): Promise<boolean> {
  if (saving.value) return false
  if (form.title.trim() === '') {
    error.value = '请填写标题'
    return false
  }
  if (form.body.trim() === '') {
    error.value = '正文不能为空'
    return false
  }
  const input = {
    id: props.initial?.id,
    category: form.category,
    title: form.title.trim(),
    body: form.body,
    tags: form.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
  }
  saving.value = true
  error.value = ''
  try {
    await props.persist(input)
    original.value = JSON.stringify(form)
    emit('save', input)
    return true
  } catch {
    error.value = '保存失败，内容已保留，请重试'
    return false
  } finally {
    saving.value = false
  }
}
defineExpose({ dirty, save, saving })
</script>

<template>
  <div
    class="doc-editor"
    data-testid="doc-editor"
  >
    <div class="editor-row">
      <div class="editor-field grow">
        <label for="de-title">标题 <span class="req">*</span></label>
        <ElInput
          id="de-title"
          v-model="form.title"
          data-field="title"
          placeholder="文档标题"
        />
      </div>
      <div class="editor-field">
        <label for="de-category">分类</label>
        <ElSelect
          id="de-category"
          v-model="form.category"
          data-field="category"
        >
          <ElOption
            v-for="c in store.categories"
            :key="c"
            :label="c"
            :value="c"
          />
        </ElSelect>
      </div>
    </div>
    <div class="editor-field">
      <label for="de-tags">标签（逗号分隔）</label>
      <ElInput
        id="de-tags"
        v-model="form.tags"
        data-field="tags"
        placeholder="面试, 复盘"
      />
    </div>
    <div class="editor-field">
      <div class="body-head">
        <label for="de-body">正文（Markdown） <span class="req">*</span></label>
        <ElButton
          size="small"
          text
          class="preview-toggle"
          @click="showPreview = !showPreview"
        >
          {{ showPreview ? '返回编辑' : '预览' }}
        </ElButton>
      </div>
      <ElInput
        v-if="!showPreview"
        id="de-body"
        v-model="form.body"
        type="textarea"
        :rows="14"
        data-field="body"
      />
      <!-- preview 经 renderMarkdown 清理后再展示。 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-else
        class="md-preview doc-body"
        data-testid="md-preview"
        v-html="preview"
      />
    </div>
    <p
      v-if="error"
      class="editor-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="editor-actions">
      <ElButton
        :disabled="saving"
        @click="emit('cancel')"
      >
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="editor-save"
        :loading="saving"
        @click="save"
      >
        保存
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.doc-editor {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 16px;
}
.editor-row {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: 14px;
}
.editor-field {
  margin-bottom: 14px;
  min-width: 0;
}
.editor-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 6px;
}
.req {
  color: var(--danger);
}
.body-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.md-preview {
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 12px 14px;
  min-height: 200px;
  background: var(--card2);
}
.editor-error {
  color: var(--danger);
  font-size: 12px;
  margin-bottom: 10px;
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
@media (max-width: 640px) {
  .editor-row {
    grid-template-columns: 1fr;
  }
}
</style>
