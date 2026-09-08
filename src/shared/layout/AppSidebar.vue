<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { NAV_ITEMS } from '../../app/nav'
import { db } from '../../storage/db'
import { exportBackup, importBackup, validateBackup, type BackupFile, type ImportMode } from '../../storage/backup'
import { backupFileName, downloadJson } from '../downloadJson'
import AppIcon from '../ui/AppIcon.vue'
import SnapshotDialog from '../SnapshotDialog.vue'
import ImportDialog from '../ImportDialog.vue'

defineProps<{ open?: boolean; hidden?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const route = useRoute()

/** 路由名 → 图标名 */
const NAV_ICONS: Record<string, string> = {
  dashboard: 'grid',
  tracker: 'case',
  resume: 'file',
  library: 'layers',
  showcase: 'play',
}

/** 导出全库为 JSON 备份（与工作台磁贴同一 exportBackup，全量十表） */
async function onExport() {
  try {
    downloadJson(backupFileName(), await exportBackup(db))
    ElMessage.success('备份已导出')
  } catch {
    ElMessage.error('导出失败，请重试')
  }
}

const fileInput = ref<HTMLInputElement | null>(null)
const snapshotOpen = ref(false)
const snapshotCount = ref(0)
// 备份要交给 IndexedDB 结构化克隆，保持解析结果为普通对象。
const incomingBackup = shallowRef<BackupFile | null>(null)
const currentBackup = shallowRef<BackupFile | null>(null)

async function refreshSnapshotCount() {
  try {
    snapshotCount.value = await db.snapshots.count()
  } catch {
    snapshotCount.value = 0
  }
}

onMounted(() => {
  void refreshSnapshotCount()
})

function onImportClick() {
  fileInput.value?.click()
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    ElMessage.error('文件不是有效的 JSON')
    return
  }
  const result = validateBackup(raw)
  if (!result.ok) {
    const first = result.issues[0]
    ElMessage.error(`备份文件校验失败${first ? `：${first.path} ${first.message}` : ''}`)
    return
  }
  try {
    currentBackup.value = await exportBackup(db)
    incomingBackup.value = result.file
    emit('close')
  } catch {
    ElMessage.error('读取本机数据失败，请重试')
  }
}

async function executeImport(mode: ImportMode) {
  if (!incomingBackup.value) throw new Error('No backup selected')
  await importBackup(db, incomingBackup.value, mode)
  ElMessage.success('导入完成，正在刷新…')
  setTimeout(() => window.location.reload(), 900)
}

async function openSnapshots() {
  await refreshSnapshotCount()
  snapshotOpen.value = true
}
</script>

<template>
  <aside
    id="main-sidebar"
    class="sidebar"
    :class="{ open }"
    aria-label="主导航"
    :aria-hidden="hidden ? 'true' : undefined"
    :inert="hidden || undefined"
  >
    <button
      class="nav-close"
      aria-label="关闭导航"
      @click="emit('close')"
    >
      关闭导航 ×
    </button>
    <div class="brand">
      <div
        class="brand-mark"
        aria-hidden="true"
      >
        职
      </div>
      <div class="brand-text">
        <div class="brand-name">
          求职工作台
        </div>
        <div class="brand-sub">
          Job Quest Console
        </div>
      </div>
    </div>
    <div class="hr" />
    <nav class="nav">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.name"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.name === item.name }"
      >
        <AppIcon :name="NAV_ICONS[item.name] ?? 'grid'" />
        <span>{{ item.title }}</span>
      </RouterLink>
    </nav>
    <div class="spacer" />
    <div class="hr" />
    <div class="data-actions">
      <button
        type="button"
        class="data-btn"
        @click="onExport"
      >
        <AppIcon
          name="download"
          :size="15"
        />
        导出数据
      </button>
      <button
        type="button"
        class="data-btn"
        @click="onImportClick"
      >
        <AppIcon
          name="upload"
          :size="15"
        />
        导入数据
      </button>
      <button
        v-if="snapshotCount > 0"
        type="button"
        class="data-btn snap-btn"
        @click="openSnapshots"
      >
        <AppIcon
          name="history"
          :size="15"
        />
        数据快照（{{ snapshotCount }}）
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        class="file-input"
        aria-label="选择备份文件"
        @change="onImportFile"
      >
    </div>
    <SnapshotDialog v-model="snapshotOpen" />
    <ImportDialog
      :incoming="incomingBackup"
      :current="currentBackup"
      :persist="executeImport"
      @close="incomingBackup = null; currentBackup = null"
    />
    <div class="sidebar-foot">
      <span class="sync-dot" />
      <span class="foot-note">数据仅存本机浏览器</span>
    </div>
  </aside>
</template>

<style scoped>
.nav-close { display: none; }
.sidebar {
  width: var(--sidebar-w);
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  padding: 20px 16px 16px;
  background: var(--card2);
  border-right: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 4px 18px;
}
.brand-mark {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: var(--r-lg);
  background: var(--primary);
  color: var(--primary-fg);
  font-size: 17px;
  font-weight: var(--fw-bold);
}
.brand-text {
  min-width: 0;
}
.brand-name {
  font-size: 15px;
  font-weight: var(--fw-bold);
}
.brand-sub {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11.5px;
}
.hr {
  height: 1px;
  background: var(--border);
}
.nav {
  display: grid;
  gap: 6px;
  padding: 18px 0 0;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--card);
  color: var(--text2);
  font-size: 13.5px;
  text-decoration: none;
  transition: color 0.16s var(--ease), background 0.16s var(--ease), border-color 0.16s var(--ease);
}
.nav-item:hover {
  color: var(--text);
  border-color: var(--border2);
}
.nav-item.active {
  color: var(--primary-text);
  background: var(--primary-soft);
  border-color: var(--primary-border);
  font-weight: var(--fw-semibold);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--primary);
}
.spacer {
  flex: 1;
}
.data-actions {
  display: grid;
  gap: 6px;
  padding: 12px 5px 0;
}
.data-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--card);
  color: var(--text2);
  font-size: 12.5px;
  font-weight: var(--fw-semibold);
  transition: color 0.16s, border-color 0.16s, background 0.16s;
}
.data-btn:hover {
  color: var(--primary-text);
  border-color: var(--primary-border);
  background: var(--primary-soft);
}
.file-input {
  display: none;
}
.sidebar-foot {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px 5px 2px;
}
.sync-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--success-vivid);
  box-shadow: 0 0 0 3px var(--success-soft);
}
.foot-note {
  color: var(--muted);
  font-size: 11.5px;
}
@media (max-width: 1024px) {
  .nav-close { display: block; min-height: 40px; align-self: flex-end; color: var(--text2); margin-bottom: 8px; }
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.22s var(--ease);
    box-shadow: var(--shadow-lg);
  }
  .sidebar.open {
    transform: none;
  }
}
</style>
