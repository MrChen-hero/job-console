<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { useResumeStore } from '../store'

const store = useResumeStore()
const props = defineProps<{ beforeChange?: () => Promise<boolean> }>()
const busy = ref(false)

async function change(action: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  try {
    if (props.beforeChange && !await props.beforeChange()) return
    await action()
  } catch { ElMessage.error('版本操作失败，请重试') }
  finally { busy.value = false }
}

async function select(id: string) {
  if (id === store.activeVersionId) return
  await change(() => store.setActive(id))
}

const active = computed(() => store.activeVersion)

function fmtTime(iso: string): string {
  return iso.slice(0, 10)
}

async function create() {
  let value: string | undefined
  try {
    ;({ value } = await ElMessageBox.prompt('输入版本名称，如「AI 岗版」', '新建简历版本', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    }))
  } catch {
    return // 用户取消
  }
  await change(() => store.createVersion(value!.trim(), ''))
}

async function rename(id: string, current: string) {
  let value: string | undefined
  try {
    ;({ value } = await ElMessageBox.prompt('修改版本名称', '重命名', {
      inputValue: current,
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    }))
  } catch {
    return // 用户取消
  }
  try { await store.renameVersion(id, value!.trim()) }
  catch { ElMessage.error('重命名失败，请重试') }
}

async function duplicate(id: string) {
  await change(() => store.duplicateVersion(id))
}

async function remove(id: string, name: string) {
  try {
    await ElMessageBox.confirm(`确定删除版本「${name}」？该操作不可恢复。`, '删除版本', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await change(() => store.deleteVersion(id))
}

</script>

<template>
  <div class="version-manager">
    <div class="vm-toolbar">
      <span class="vm-title">简历版本</span>
      <span class="vm-hint">点击切换当前版本</span>
    </div>

    <div class="ver-chips">
      <button
        v-for="v in store.versions"
        :key="v.id"
        type="button"
        class="vm-card ver"
        :class="{ active: v.id === store.activeVersionId }"
        role="button"
        tabindex="0"
        :aria-pressed="v.id === store.activeVersionId"
        :disabled="busy"
        @click="select(v.id)"
        @keydown.enter.prevent="select(v.id)"
        @keydown.space.prevent="select(v.id)"
      >
        {{ v.name }}
      </button>
      <button
        type="button"
        class="ver ver-new vm-create"
        @click="create"
      >
        ＋ 新建
      </button>
    </div>
    <p
      v-if="store.versions.length === 0"
      class="vm-empty"
    >
      还没有简历版本，点击「＋ 新建」开始。
    </p>
    <p
      v-else
      class="ver-meta mono"
    >
      {{ active?.name }} · 最后更新 {{ fmtTime(active?.updatedAt ?? '') }}{{ active?.targetRole ? ` · ${active.targetRole}` : '' }}
      <span
        class="vm-card-actions"
        @click.stop
      >
        <ElButton
          size="small"
          class="rename-btn"
          @click="rename(active!.id, active!.name)"
        >
          重命名
        </ElButton>
        <ElButton
          size="small"
          class="dup-btn"
          @click="duplicate(active!.id)"
        >
          复制
        </ElButton>
        <ElButton
          size="small"
          class="vm-delete delete-btn"
          @click="remove(active!.id, active!.name)"
        >
          删除
        </ElButton>
      </span>
    </p>
  </div>
</template>

<style scoped>
.version-manager {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px;
}
.vm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.vm-title {
  font-size: 13.5px;
  font-weight: var(--fw-bold);
}
.vm-hint {
  font-size: 11.5px;
  color: var(--muted);
}
.ver-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
.ver {
  min-height: 36px;
  padding: 0 15px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--card);
  color: var(--text2);
  font-family: var(--mono);
  font-size: 13px;
  font-weight: var(--fw-semibold);
  transition: color .16s, border-color .16s, background .16s;
}
.ver:hover {
  color: var(--text);
  border-color: var(--border2);
}
.ver.active {
  color: var(--primary-text);
  background: var(--primary-soft);
  border-color: var(--primary);
}
.ver-new {
  border-style: dashed;
  color: var(--muted);
}
.ver-new:hover {
  color: var(--primary-text);
  border-color: var(--primary);
  background: var(--primary-soft);
}
.ver-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 13px 0 0;
  color: var(--muted);
  font-size: 11.5px;
}
.vm-card-actions {
  margin-left: auto;
  display: inline-flex;
  gap: 8px;
  flex-wrap: nowrap; /* 三个按钮固定一排，不随宽度换行 */
}
/* element 相邻按钮自带 margin-left，改用 gap 统一间距 */
.vm-card-actions .el-button + .el-button {
  margin-left: 0;
}
/* 浅色区分：重命名=蓝、复制=绿、删除=红；与抽屉操作同一套 --*-soft 令牌语言 */
.vm-card-actions .el-button.rename-btn {
  --el-button-bg-color: var(--primary-soft);
  --el-button-border-color: var(--primary-border);
  --el-button-text-color: var(--primary-text);
  --el-button-hover-bg-color: var(--primary-soft);
  --el-button-hover-border-color: var(--primary);
  --el-button-hover-text-color: var(--primary-text);
  --el-button-active-bg-color: var(--primary-soft);
  --el-button-active-border-color: var(--primary);
}
.vm-card-actions .el-button.dup-btn {
  --el-button-bg-color: var(--success-soft);
  --el-button-border-color: var(--success-border);
  --el-button-text-color: var(--success);
  --el-button-hover-bg-color: var(--success-soft);
  --el-button-hover-border-color: var(--success-vivid);
  --el-button-hover-text-color: var(--success);
  --el-button-active-bg-color: var(--success-soft);
  --el-button-active-border-color: var(--success-vivid);
}
.vm-card-actions .el-button.delete-btn {
  --el-button-bg-color: var(--danger-soft);
  --el-button-border-color: var(--danger-border);
  --el-button-text-color: var(--danger);
  --el-button-hover-bg-color: var(--danger-soft);
  --el-button-hover-border-color: var(--danger-vivid);
  --el-button-hover-text-color: var(--danger);
  --el-button-active-bg-color: var(--danger-soft);
  --el-button-active-border-color: var(--danger-vivid);
}
.vm-empty {
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
  padding: 16px 0;
}
</style>
