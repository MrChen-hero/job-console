<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElMessage } from 'element-plus'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useLibraryStore } from '../store'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ initial?: { name: string; icon: string } | null }>()
const emit = defineEmits<{ saved: [name: string] }>()
const store = useLibraryStore()
const name = ref('')
const icon = ref('layers')
const error = ref('')
const saving = ref(false)
const icons = [
  { name: 'layers', label: '分类' },
  { name: 'book', label: '书本' },
  { name: 'file', label: '文档' },
  { name: 'user', label: '人物' },
  { name: 'case', label: '工作' },
  { name: 'target', label: '目标' },
  { name: 'star', label: '星标' },
  { name: 'mark', label: '书签' },
  { name: 'help', label: '问题' },
  { name: 'history', label: '复盘' },
  { name: 'play', label: '演示' },
  { name: 'link', label: '链接' },
]

function reset() {
  name.value = props.initial?.name ?? ''
  icon.value = props.initial?.icon ?? 'layers'
  error.value = ''
}

async function save() {
  if (saving.value) return
  error.value = ''
  if (!name.value.trim()) { error.value = '请填写分类名称'; return }
  saving.value = true
  try {
    const saved = props.initial
      ? await store.renameCategory(props.initial.name, name.value, icon.value)
      : await store.addCategory(name.value, icon.value)
    if (!saved) {
      error.value = '分类名称已存在或原分类已不存在，请检查后重试'
      return
    }
    ElMessage.success(`已${props.initial ? '更新' : '新增'}分类「${name.value.trim()}」`)
    emit('saved', name.value.trim())
    open.value = false
  } catch {
    error.value = '保存失败，输入已保留，请重试'
  } finally { saving.value = false }
}
</script>

<template>
  <ElDialog
    v-model="open"
    :title="initial ? '编辑分类' : '新增分类'"
    width="440px"
    append-to-body
    :show-close="!saving"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    @open="reset"
  >
    <form
      class="category-create-form"
      :inert="saving"
      @submit.prevent="save"
    >
      <label for="new-category-name">分类名称</label>
      <ElInput
        id="new-category-name"
        v-model="name"
        placeholder="如：行为面 / 复盘"
        autofocus
        @input="error = ''"
      />
      <span
        id="category-icon-label"
        class="category-icon-label"
      >分类图标</span>
      <div
        class="category-icon-grid"
        role="group"
        aria-labelledby="category-icon-label"
      >
        <button
          v-for="item in icons"
          :key="item.name"
          type="button"
          class="category-icon-choice"
          :class="{ selected: icon === item.name }"
          :aria-pressed="icon === item.name"
          :aria-label="`图标：${item.label}`"
          @click="icon = item.name"
        >
          <AppIcon
            :name="item.name"
            :size="20"
          />
          <span>{{ item.label }}</span>
        </button>
      </div>
      <p
        v-if="error"
        class="form-alert"
        role="alert"
      >
        {{ error }}
      </p>
    </form>
    <template #footer>
      <ElButton
        :disabled="saving"
        @click="open = false"
      >
        取消
      </ElButton>
      <ElButton
        class="category-save"
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.category-create-form { display: grid; gap: 10px; }
.category-create-form > label,
.category-icon-label { font-size: 13px; color: var(--text2); font-weight: var(--fw-semibold); }
.category-icon-label { margin-top: 8px; }
.category-icon-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.category-icon-choice { display: grid; justify-items: center; gap: 7px; padding: 10px 4px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--card2); color: var(--text2); font-size: 11px; }
.category-icon-choice:hover { border-color: var(--primary); }
.category-icon-choice.selected { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-text); }
@media (max-width: 480px) {
  .category-icon-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
