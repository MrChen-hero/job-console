<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElButton, ElDialog, ElInput } from 'element-plus'
import type { FieldDef } from '../profileSchema'

const props = defineProps<{
  title: string
  fields: FieldDef[]
  initial?: Record<string, unknown> | null
  persist: (record: Record<string, unknown>) => Promise<void>
}>()

const emit = defineEmits<{
  save: [record: Record<string, unknown>]
}>()

const visible = defineModel<boolean>({ default: false })
const form = reactive<Record<string, string>>({})
const error = ref('')
const saving = ref(false)
const original = ref('')
const dirty = computed(() => visible.value && JSON.stringify(form) !== original.value)

watch(visible, (open) => {
  if (!open) return
  error.value = ''
  for (const key of Object.keys(form)) delete form[key]
  for (const f of props.fields) {
    const raw = props.initial?.[f.key]
    form[f.key] = Array.isArray(raw) ? (raw as string[]).join('\n') : raw != null ? String(raw) : ''
  }
  original.value = JSON.stringify(form)
})

async function save(): Promise<boolean> {
  if (saving.value) return false
  const record: Record<string, unknown> = {}
  for (const f of props.fields) {
    const value = form[f.key] ?? ''
    if (f.required && value.trim() === '') {
      error.value = `请填写「${f.label}」`
      return false
    }
    record[f.key] = f.type === 'bullets'
      ? value.split('\n').map((s) => s.trim()).filter(Boolean)
      : value.trim()
  }
  if (props.initial?.id) record.id = props.initial.id
  saving.value = true
  error.value = ''
  try {
    await props.persist(record)
    emit('save', record)
    visible.value = false
    return true
  } catch { error.value = '保存失败，输入已保留，请重试'; return false }
  finally { saving.value = false }
}
defineExpose({ dirty, saving, save })
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="560px"
    class="entry-dialog"
    :show-close="!saving"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
  >
    <div
      v-for="f in fields"
      :key="f.key"
      class="entry-field"
    >
      <label :for="`dlg-${f.key}`">{{ f.label }}<span
        v-if="f.required"
        class="req"
      > *</span></label>
      <ElInput
        v-if="f.type === 'text'"
        :id="`dlg-${f.key}`"
        v-model="form[f.key]"
        :disabled="saving"
        :placeholder="f.placeholder"
        :data-field="f.key"
      />
      <ElInput
        v-else
        :id="`dlg-${f.key}`"
        v-model="form[f.key]"
        type="textarea"
        :disabled="saving"
        :rows="f.type === 'bullets' ? 5 : 3"
        :placeholder="f.placeholder ?? (f.type === 'bullets' ? '每行一条' : '')"
        :data-field="f.key"
      />
    </div>
    <p
      v-if="error"
      class="entry-error"
      role="alert"
    >
      {{ error }}
    </p>
    <template #footer>
      <ElButton
        :disabled="saving"
        @click="visible = false"
      >
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="entry-save"
        :loading="saving"
        @click="save"
      >
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.entry-field {
  margin-bottom: 14px;
}
.entry-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 6px;
}
.req {
  color: var(--danger);
}
.entry-error {
  color: var(--danger);
  font-size: 12px;
}
</style>
