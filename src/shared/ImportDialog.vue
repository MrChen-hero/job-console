<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import type { BackupData, BackupFile, ImportMode } from '../storage/backup'

const props = defineProps<{
  incoming: BackupFile | null
  current: BackupFile | null
  persist: (mode: ImportMode) => Promise<void>
}>()
const emit = defineEmits<{ close: [] }>()
const mode = ref<ImportMode>('merge')
const confirmed = ref(false)
const busy = ref(false)
const error = ref('')
const labels: Record<keyof BackupData, string> = {
  applications: '投递记录', companyPool: '候选公司', milestones: '里程碑',
  profile: '简历资料', resumeVersions: '简历版本', libraryDocs: '自建及已修改文档',
  libraryCategories: '分类设置', runtimeProjects: '项目设置', runtimeDemos: '演示页设置', deletedDocs: '文档删除记录',
}
const rows = computed(() => (Object.keys(labels) as Array<keyof BackupData>).map((key) => ({
  key, label: labels[key], current: props.current?.data[key].length ?? 0, incoming: props.incoming?.data[key].length ?? 0,
})))
watch(() => props.incoming, () => { mode.value = 'merge'; confirmed.value = false; error.value = '' })
watch(mode, () => { confirmed.value = false })
async function submit() {
  if (busy.value || !props.incoming || (mode.value === 'overwrite' && !confirmed.value)) return
  busy.value = true
  error.value = ''
  try { await props.persist(mode.value); emit('close') }
  catch { error.value = '导入失败，尚未完成。请重试或取消。' }
  finally { busy.value = false }
}
</script>

<template>
  <ElDialog
    :model-value="Boolean(incoming)"
    title="导入数据"
    width="560px"
    append-to-body
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @update:model-value="(open: boolean) => { if (!open && !busy) emit('close') }"
  >
    <p class="import-intro">
      核对数据数量，再选择导入方式。内置示例不计入数量。
    </p>
    <table class="import-summary">
      <thead><tr><th>数据类型</th><th>当前本机</th><th>备份文件</th></tr></thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.key"
        >
          <td>{{ row.label }}</td><td>{{ row.current }}</td><td>{{ row.incoming }}</td>
        </tr>
      </tbody>
    </table>
    <fieldset
      class="import-modes"
      :disabled="busy"
    >
      <legend>导入方式</legend>
      <label><input
        v-model="mode"
        type="radio"
        value="merge"
        name="import-mode"
      ><span><strong>合并导入</strong><small>保留备份中没有的本机记录；同一条记录以备份内容为准。</small></span></label>
      <label><input
        v-model="mode"
        type="radio"
        value="overwrite"
        name="import-mode"
      ><span><strong>覆盖导入</strong><small>替换上表中的全部本机数据。执行前自动保存快照，可从“数据快照”回退。</small></span></label>
    </fieldset>
    <label
      v-if="mode === 'overwrite'"
      class="overwrite-confirm"
    ><input
      v-model="confirmed"
      type="checkbox"
      :disabled="busy"
    >我确认用备份替换现有数据</label>
    <p
      v-if="error"
      role="alert"
      class="form-alert"
    >
      {{ error }}
    </p>
    <template #footer>
      <ElButton
        :disabled="busy"
        @click="emit('close')"
      >
        取消
      </ElButton>
      <ElButton
        type="primary"
        :loading="busy"
        :disabled="mode === 'overwrite' && !confirmed"
        @click="submit"
      >
        {{ mode === 'merge' ? '确认合并导入' : '确认覆盖导入' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.import-intro { color: var(--muted); margin-bottom: 12px; }
.import-summary { width: 100%; border-collapse: collapse; font-size: 12px; }
.import-summary th, .import-summary td { padding: 6px 8px; border-bottom: 1px solid var(--border); text-align: right; font-variant-numeric: tabular-nums; }
.import-summary th:first-child, .import-summary td:first-child { text-align: left; }
.import-modes { border: 0; padding: 0; margin: 18px 0; }
.import-modes legend { font-weight: var(--fw-semibold); margin-bottom: 8px; }
.import-modes label { display: flex; align-items: start; gap: 10px; padding: 12px; margin-bottom: 8px; border: 1px solid var(--border); border-radius: var(--r-sm); cursor: pointer; }
.import-modes label:has(input:checked) { border-color: var(--primary); background: var(--primary-soft); }
.import-modes input { margin-top: 5px; accent-color: var(--primary); }
.import-modes small { display: block; color: var(--text2); margin-top: 4px; }
.overwrite-confirm { display: flex; align-items: center; gap: 8px; min-height: 40px; margin-bottom: 12px; max-width: 100%; cursor: pointer; }
.overwrite-confirm input { width: 18px; height: 18px; accent-color: var(--primary); }
.overwrite-confirm :deep(.el-checkbox__label) { white-space: normal; }
</style>
