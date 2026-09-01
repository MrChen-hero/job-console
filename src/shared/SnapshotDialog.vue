<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import { db } from '../storage/db'
import { KEEP_SNAPSHOTS, listSnapshots, restoreSnapshot, summarizeSnapshot, type SnapshotEntry } from '../storage/snapshots'

const visible = defineModel<boolean>({ default: false })

const rows = ref<SnapshotEntry[]>([])
const busy = ref(false)

async function onOpen() {
  rows.value = await listSnapshots(db)
}

function fmt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function onRestore(row: SnapshotEntry) {
  try {
    await ElMessageBox.confirm(
      `回退到「${row.label}」（${fmt(row.createdAt)}）？当前数据会被这份快照整体替换——替换前会再存一份当前数据的快照，仍可回退。`,
      '回退确认',
      { confirmButtonText: '回退', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await restoreSnapshot(db, row.id)
  } catch {
    ElMessage.error('回退失败，请重试')
    busy.value = false
    return
  }
  ElMessage.success('已回退，正在刷新…')
  setTimeout(() => window.location.reload(), 900)
}
</script>

<template>
  <!-- 居中与移动端宽度自适应由 global.css 的 .el-overlay-dialog 规则统一提供 -->
  <ElDialog
    v-model="visible"
    title="数据快照"
    width="520px"
    @open="onOpen"
  >
    <div
      v-loading="busy"
      class="snap-body"
      data-testid="snapshot-list"
    >
      <p class="snap-hint">
        覆盖导入与回退操作前会自动存一份当前数据，最多保留 {{ KEEP_SNAPSHOTS }} 份。回退是整库替换。
      </p>
      <p
        v-if="rows.length === 0"
        class="snap-empty"
      >
        还没有快照。执行「覆盖导入」时会自动生成。
      </p>
      <div
        v-for="row in rows"
        :key="row.id"
        class="snap-row"
      >
        <span class="snap-main">
          <b class="snap-label">{{ row.label }}</b>
          <span class="snap-sum">{{ summarizeSnapshot(row.data) }}</span>
        </span>
        <span class="snap-time mono">{{ fmt(row.createdAt) }}</span>
        <ElButton
          size="small"
          class="snap-restore"
          :aria-label="`回退到 ${row.label} ${fmt(row.createdAt)}`"
          @click="onRestore(row)"
        >
          回退
        </ElButton>
      </div>
    </div>
    <template #footer>
      <ElButton @click="visible = false">
        关闭
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.snap-hint {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 12px;
}
.snap-empty {
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
  padding: 20px 0;
}
.snap-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--border);
}
.snap-row:last-child {
  border-bottom: none;
}
.snap-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.snap-label {
  font-size: 13px;
  font-weight: var(--fw-semibold);
}
.snap-sum {
  color: var(--muted);
  font-size: 11.5px;
}
.snap-time {
  color: var(--text2);
  font-size: 11.5px;
  white-space: nowrap;
}
@media (max-width: 560px) {
  .snap-time {
    display: none;
  }
}
</style>
