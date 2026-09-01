<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTrackerStore } from '../store'
import { BOARD_COLUMNS, columnOf } from '../constants'
import type { BoardColumn } from '../constants'

const store = useTrackerStore()

const emit = defineEmits<{ open: [id: string] }>()

const dragId = ref('')

/** 列配色：色相沿用徽章表（info/violet/warn/success/danger），经 --kc* 变量下发给卡片 */
const COLUMN_COLOR: Record<BoardColumn, string> = {
  '已投递': 'info',
  '笔试': 'violet',
  '一面': 'warn',
  '二面': 'warn',
  'HR面': 'warn',
  'Offer': 'success',
  '挂 / 无消息': 'danger',
}

function colVars(col: BoardColumn): Record<string, string> {
  const c = COLUMN_COLOR[col]
  return {
    '--kc': `var(--${c}-vivid)`,
    '--kc-text': `var(--${c})`,
    '--kc-soft': `var(--${c}-soft)`,
    '--kc-border': `var(--${c}-border)`,
  }
}

const columns = computed(() =>
  BOARD_COLUMNS.map((col) => ({
    col,
    items: store.applications.filter((a) => columnOf(a.status) === col),
  })),
)

function onDragStart(event: DragEvent, id: string) {
  dragId.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event: DragEvent, col: (typeof BOARD_COLUMNS)[number]) {
  event.preventDefault()
  const id = dragId.value || event.dataTransfer?.getData('text/plain') || ''
  dragId.value = ''
  if (!id) return
  const app = store.find(id)
  if (!app) return
  const target = col === '挂 / 无消息' ? '挂' : col
  if (app.status === target) return
  void store.changeStage(id, target)
}
</script>

<template>
  <div
    class="app-board"
    data-testid="app-board"
  >
    <div
      v-for="group in columns"
      :key="group.col"
      class="board-col"
      :data-column="group.col"
      :style="colVars(group.col)"
      @dragover.prevent
      @drop="onDrop($event, group.col)"
    >
      <div class="col-head">
        <span class="col-title">{{ group.col }}</span>
        <span class="col-count mono">{{ String(group.items.length).padStart(2, '0') }}</span>
      </div>
      <div class="col-stack">
        <div
          v-for="app in group.items"
          :key="app.id"
          class="board-card"
          draggable="true"
          tabindex="0"
          role="button"
          :aria-label="`${app.company} ${app.position}，状态 ${app.status}，回车查看详情，拖拽到其他列更换阶段`"
          @dragstart="onDragStart($event, app.id)"
          @keydown.enter.prevent="emit('open', app.id)"
          @keydown.space.prevent="emit('open', app.id)"
          @click="emit('open', app.id)"
        >
          <b class="card-company">{{ app.company }}</b>
          <span class="card-position">{{ app.position }}</span>
          <div class="card-tags">
            <span class="card-tag">{{ app.channel }}</span>
            <span class="card-tag">{{ app.batch }}</span>
          </div>
          <div class="card-foot mono">
            <span>{{ app.appliedAt }}</span>
            <span class="kdot" />
          </div>
        </div>
        <p
          v-if="group.items.length === 0"
          class="col-empty"
        >
          暂无记录
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-board {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(254px, 1fr);
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  align-items: stretch;
}
.board-col {
  display: flex;
  flex-direction: column;
  min-width: 254px;
  /* 不再固定 520px：由 grid stretch 撑满看板高度，列随可用高度伸缩 */
  min-height: 0;
  border: 1px solid var(--border);
  border-top: 3px solid var(--kc);
  border-radius: var(--r-lg);
  background: var(--card2);
  transition: border-color 0.15s, background 0.15s;
}
.board-col:hover {
  border-color: var(--border2);
}
.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 11px;
  font-size: 13px;
  font-weight: var(--fw-bold);
}
.col-count {
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--muted);
  font-size: 11px;
}
.col-stack {
  display: grid;
  gap: 9px;
  padding: 0 12px 12px;
  align-content: start;
  /* 占满列内剩余高度，卡片超出时列内纵向滚动 */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.board-card {
  width: 100%;
  padding: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  transition: box-shadow 0.18s var(--ease), transform 0.18s var(--ease), border-color .16s;
}
.board-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--border2);
}
.board-card:active {
  cursor: grabbing;
}
.board-card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.card-company {
  font-size: 13px;
  font-weight: var(--fw-bold);
}
.card-position {
  font-size: 12px;
  color: var(--text2);
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.card-tag {
  font-size: 11px;
  color: var(--kc-text);
  background: var(--kc-soft);
  border: 1px solid var(--kc-border);
  border-radius: 6px;
  padding: 1.5px 8px;
  white-space: nowrap;
}
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  color: var(--muted);
  font-size: 11px;
}
.kdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--kc);
}
.col-empty {
  padding: 20px 4px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}
</style>
