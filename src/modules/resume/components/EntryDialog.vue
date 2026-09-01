<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElButton, ElDialog, ElInput } from 'element-plus'
import type { FieldDef } from '../profileSchema'

const props = defineProps<{
  title: string
  fields: FieldDef[]
  initial?: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  save: [record: Record<string, unknown>]
}>()

const visible = defineModel<boolean>({ default: false })
const form = reactive<Record<string, string>>({})
const error = ref('')

watch(visible, (open) => {
  if (!open) return
  error.value = ''
  for (const f of props.fields) {
    const raw = props.initial?.[f.key]
    form[f.key] = Array.isArray(raw) ? (raw as string[]).join('\n') : raw != null ? String(raw) : ''
  }
})

function save() {
  const record: Record<string, unknown> = {}
  for (const f of props.fields) {
    const value = form[f.key] ?? ''
    if (f.required && value.trim() === '') {
      error.value = `请填写「${f.label}」`
      return
    }
    record[f.key] = f.type === 'bullets'
      ? value.split('\n').map((s) => s.trim()).filter(Boolean)
      : value.trim()
  }
  if (props.initial?.id) record.id = props.initial.id
  emit('save', record)
  visible.value = false
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="560px"
    class="entry-dialog"
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
        :placeholder="f.placeholder"
        :data-field="f.key"
      />
      <ElInput
        v-else
        :id="`dlg-${f.key}`"
        v-model="form[f.key]"
        type="textarea"
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
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="entry-save"
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
