<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ElButton, ElDatePicker, ElDialog, ElDropdown, ElDropdownItem, ElDropdownMenu, ElInput, ElMessage } from 'element-plus'
import { useDashboardStore } from '../store'
import { useTrackerStore, type CompletedNextAction } from '../../tracker/store'
import StatusBadge from '../../tracker/components/StatusBadge.vue'

const props = defineProps<{ today: string }>()
const dashboard = useDashboardStore()
const tracker = useTrackerStore()
const busy = reactive(new Set<string>())
const undoItems = ref<CompletedNextAction[]>([])
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const todos = computed(() => dashboard.todos.map((todo) => ({
  ...todo,
  tone: !todo.date ? 'unscheduled' : todo.date < props.today ? 'overdue' : todo.date === props.today ? 'today' : 'later',
  dateLabel: !todo.date ? '未排期' : todo.date < props.today ? '已逾期' : todo.date === props.today ? '今天' : '后续',
  dateText: !todo.date ? '未排期' : todo.date.slice(0, 4) === props.today.slice(0, 4) ? todo.date.slice(5) : todo.date,
})))

function forgetUndo(id: string) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  undoItems.value = undoItems.value.filter((item) => item.id !== id)
}
onBeforeUnmount(() => { for (const timer of timers.values()) clearTimeout(timer) })

async function complete(id: string) {
  if (busy.has(id)) return
  busy.add(id)
  try {
    const item = await tracker.completeNextAction(id)
    forgetUndo(id)
    undoItems.value.push(item)
    timers.set(id, setTimeout(() => forgetUndo(id), 10000))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '完成失败，请重试')
  } finally { busy.delete(id) }
}

async function undo(item: CompletedNextAction) {
  if (busy.has(item.id)) return
  busy.add(item.id)
  // 重试期间保留入口，不让倒计时把正在执行的撤销按钮移走。
  clearTimeout(timers.get(item.id))
  try {
    await tracker.restoreNextAction(item)
    forgetUndo(item.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '撤销失败，请重试')
    timers.set(item.id, setTimeout(() => forgetUndo(item.id), 10000))
  } finally { busy.delete(item.id) }
}

const editorOpen = ref(false)
const editorMode = ref<'edit' | 'postpone'>('edit')
const editingId = ref('')
const label = ref('')
const date = ref('')
const formError = ref('')
const saving = ref(false)

function command(id: string, action: string) {
  if (action === 'complete') { void complete(id); return }
  const app = tracker.find(id)
  if (!app) return
  editorMode.value = action === 'postpone' ? 'postpone' : 'edit'
  editingId.value = id
  label.value = app.nextStep ?? ''
  date.value = app.nextActionAt ?? ''
  formError.value = ''
  editorOpen.value = true
}

async function save() {
  if (saving.value) return
  if (editorMode.value === 'postpone' && !date.value) {
    formError.value = '请选择延期日期'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await tracker.saveNextAction(editingId.value, label.value, date.value || undefined)
    forgetUndo(editingId.value)
    editorOpen.value = false
    ElMessage.success('下一步动作已更新')
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '保存失败，请重试'
  } finally { saving.value = false }
}
</script>

<template>
  <div
    class="todo-list"
    role="region"
    aria-label="待办清单，按日期从早到晚排列"
    :tabindex="todos.length ? 0 : undefined"
  >
    <div
      v-for="todo in todos"
      :key="todo.id"
      class="todo-row"
    >
      <RouterLink
        :to="{ path: '/tracker', query: { applicationId: todo.id } }"
        :aria-label="`${todo.dateLabel}，${todo.date}，${todo.label}，${todo.sub}，查看投递详情`"
        class="todo"
      >
        <span
          class="pill mono todo-date"
          :class="todo.tone"
          :title="`${todo.dateLabel}${todo.date ? ` · ${todo.date}` : ''}`"
        >{{ todo.dateText }}</span>
        <span class="todo-text">{{ todo.label }}<span class="todo-sub">{{ todo.sub }}</span></span>
        <StatusBadge :stage="todo.status" />
      </RouterLink>
      <ElDropdown
        trigger="click"
        placement="bottom-end"
        @command="command(todo.id, $event)"
      >
        <button
          class="todo-menu-trigger"
          :aria-label="`操作待办：${todo.label}`"
          :disabled="busy.has(todo.id)"
        >
          <span aria-hidden="true">⋯</span>
        </button>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="complete">
              完成待办
            </ElDropdownItem>
            <ElDropdownItem command="postpone">
              延期
            </ElDropdownItem>
            <ElDropdownItem command="edit">
              编辑下一步
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>
    <p
      v-if="!todos.length"
      class="todo-empty"
    >
      暂无待办；在投递详情中填写「下一步」后会出现在这里。
    </p>
  </div>
  <div
    v-for="item in undoItems"
    :key="item.id"
    class="todo-undo"
    role="status"
  >
    <span>已完成：{{ item.nextStep }}<small>10 秒内可撤销</small></span>
    <ElButton
      text
      type="primary"
      :loading="busy.has(item.id)"
      @click="undo(item)"
    >
      撤销
    </ElButton>
  </div>
  <ElDialog
    v-model="editorOpen"
    :title="editorMode === 'postpone' ? '延期待办' : '编辑下一步'"
    append-to-body
    width="420px"
    :show-close="!saving"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
  >
    <div
      class="todo-form"
      :inert="saving"
    >
      <label for="todo-action-label">下一步动作</label>
      <ElInput
        id="todo-action-label"
        v-model="label"
        :disabled="editorMode === 'postpone'"
        placeholder="如：准备技术面试"
      />
      <label for="todo-action-date">{{ editorMode === 'postpone' ? '延期至' : '动作日期（可不填）' }}</label>
      <ElDatePicker
        id="todo-action-date"
        v-model="date"
        type="date"
        value-format="YYYY-MM-DD"
        format="YYYY-MM-DD"
        placeholder="未排期"
        :clearable="editorMode === 'edit'"
      />
      <p
        v-if="formError"
        class="form-alert"
        role="alert"
      >
        {{ formError }}
      </p>
    </div>
    <template #footer>
      <ElButton
        :disabled="saving"
        @click="editorOpen = false"
      >
        取消
      </ElButton>
      <ElButton
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
.todo-list {
  display: grid;
  gap: 9px;
  max-height: 360px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  padding: 15px 19px 18px;
}
.todo-list:hover,
.todo-list:focus-within { scrollbar-color: var(--border2) transparent; }
.todo-list:focus-visible { outline: 2px solid var(--primary); outline-offset: -3px; }
.todo-list::-webkit-scrollbar { width: 6px; }
.todo-list::-webkit-scrollbar-thumb { background: transparent; border-radius: var(--r-sm); }
.todo-list:hover::-webkit-scrollbar-thumb,
.todo-list:focus-within::-webkit-scrollbar-thumb { background: var(--border2); }
.todo-row { display: flex; align-items: center; gap: 4px; min-width: 0; }
.todo {
  flex: 1;
  min-width: 0;
  display: grid;
  min-height: 48px;
  padding: 4px 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  color: var(--text);
  text-decoration: none;
  border-radius: var(--r-sm);
}
.todo:hover,
.todo:focus-visible { background: var(--primary-soft); color: var(--primary-text); }
.todo:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
.todo-text { font-size: 13px; min-width: 0; overflow-wrap: anywhere; }
.todo-sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--muted); }
.pill { display: inline-flex; align-items: center; height: 28px; padding: 0 9px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--card2); color: var(--text2); font-size: 12px; white-space: nowrap; }
.todo-date.overdue { color: var(--danger); background: var(--danger-soft); border-color: var(--danger-border); }
.todo-date.today { color: var(--primary-text); background: var(--primary-soft); border-color: var(--primary-border); }
.todo-menu-trigger { width: 32px; min-height: 44px; border-radius: var(--r-sm); font-size: 22px; color: var(--muted); opacity: 0; }
.todo-row:hover .todo-menu-trigger,
.todo-row:focus-within .todo-menu-trigger { opacity: 1; }
.todo-menu-trigger:hover,
.todo-menu-trigger:focus-visible { color: var(--primary-text); background: var(--primary-soft); }
.todo-empty { color: var(--muted); font-size: 12.5px; padding: 8px 0; }
.todo-undo { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 19px 12px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--success-soft); color: var(--text2); font-size: 12px; }
.todo-undo > span { min-width: 0; overflow-wrap: anywhere; }
.todo-undo small { display: block; color: var(--muted); margin-top: 2px; }
.todo-form { display: grid; gap: 10px; }
.todo-form label { font-size: 13px; color: var(--text2); }
.todo-form :deep(.el-date-editor) { width: 100%; }
@media (hover: none), (max-width: 720px) {
  .todo-menu-trigger { opacity: 1; width: 40px; }
}
@media (max-width: 720px) {
  .todo { gap: 8px; }
  .todo-list { padding-inline: 12px; }
}
</style>
