<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton } from 'element-plus'
import type { Application, Stage } from '../../../storage/types'
import { STAGES } from '../../../storage/types'
import { STAGE_BADGE, isStale } from '../constants'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import '../badges.css'

const props = withDefaults(defineProps<{
  applications: Application[]
  stageFilter: Stage | '全部'
  query: string
  channelFilter?: string
  /** 投向筛选；空串 = 所有投向（未填投向的记录只在这一档出现） */
  trackFilter?: string
  starredOnly?: boolean
}>(), { channelFilter: '', trackFilter: '', starredOnly: false })

const emit = defineEmits<{
  open: [id: string]
  'toggle-star': [id: string]
}>()

const filtered = computed(() => {
  const q = props.query.trim().toLowerCase()
  return props.applications.filter((a) => {
    if (props.stageFilter !== '全部' && a.status !== props.stageFilter) return false
    if (props.channelFilter && a.channel !== props.channelFilter) return false
    if (props.trackFilter && a.track !== props.trackFilter) return false
    if (props.starredOnly && !a.starred) return false
    if (q && !`${a.company} ${a.position} ${a.nextStep ?? ''} ${a.notes ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
})

/* ---------- 表头排序：null（原序）→ 升 → 降 → null 三态循环 ---------- */
type SortKey = 'company' | 'position' | 'batch' | 'appliedAt' | 'status'
const sortKey = ref<SortKey | null>(null)
const sortDir = ref<1 | -1>(1)

const SORTABLE: { key: SortKey; label: string }[] = [
  { key: 'company', label: '公司' },
  { key: 'position', label: '职位' },
  { key: 'batch', label: '批次' },
  { key: 'appliedAt', label: '投递日' },
  { key: 'status', label: '状态' },
]

function sortBy(key: SortKey) {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = 1
  } else if (sortDir.value === 1) {
    sortDir.value = -1
  } else {
    sortKey.value = null
    sortDir.value = 1
  }
}

function ariaSort(key: SortKey): 'none' | 'ascending' | 'descending' {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 1 ? 'ascending' : 'descending'
}

const sorted = computed(() => {
  if (sortKey.value === null) return filtered.value
  const key = sortKey.value
  const dir = sortDir.value
  return [...filtered.value].sort((a, b) => {
    const cmp = key === 'status'
      ? STAGES.indexOf(a.status) - STAGES.indexOf(b.status)
      : String(a[key]).localeCompare(String(b[key]), 'zh')
    return cmp * dir
  })
})

function lastDate(app: Application): string {
  return app.stageHistory[app.stageHistory.length - 1]?.date ?? app.appliedAt
}

function interviews(app: Application): number {
  return app.interviews.length
}

/* ---------- 分页：每页 12 条，筛选/排序变化回第 1 页 ---------- */
const PER = 12
const page = ref(1)

watch(
  [() => props.stageFilter, () => props.query, () => props.channelFilter, () => props.trackFilter, () => props.starredOnly, sortKey, sortDir],
  () => {
    page.value = 1
  },
)

const pageCount = computed(() => Math.ceil(sorted.value.length / PER))
const paged = computed(() => sorted.value.slice((page.value - 1) * PER, page.value * PER))

const pageNumbers = computed(() => Array.from({ length: pageCount.value }, (_, i) => i + 1))
</script>

<template>
  <div class="table-card">
    <table
      class="app-table"
      data-testid="app-table"
    >
      <thead>
        <tr>
          <th
            v-for="col in SORTABLE"
            :key="col.key"
            :aria-sort="ariaSort(col.key)"
          >
            <button
              type="button"
              class="th-sort"
              @click="sortBy(col.key)"
            >
              {{ col.label }}
              <span
                class="sort-ic"
                :class="{ desc: sortKey === col.key && sortDir === -1, on: sortKey === col.key }"
              ><AppIcon
                name="chev"
                :size="12"
              /></span>
            </button>
          </th>
          <th>渠道</th>
          <th>下一步</th>
          <th>面试</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="app in paged"
          :key="app.id"
          class="app-row"
          @click="emit('open', app.id)"
        >
          <td>
            <b class="t-company">{{ app.company }}</b>
          </td>
          <td
            class="dim clip-cell pos-cell"
            :title="app.position"
          >
            {{ app.position }}
          </td>
          <td><span class="mini-tag">{{ app.batch }}</span></td>
          <td class="dim date">
            {{ app.appliedAt }}
          </td>
          <td>
            <span
              class="stage-badge"
              :class="STAGE_BADGE[app.status]"
            ><span class="dot" />{{ app.status }}</span>
            <span
              v-if="isStale(app.status, lastDate(app))"
              class="stale-hint"
            >超1月视为挂</span>
          </td>
          <td class="dim clip-cell chan-cell">
            {{ app.channel }}
          </td>
          <td class="dim clip-cell next-cell">
            {{ app.nextStep || '—' }}
          </td>
          <td>
            <span
              v-if="interviews(app)"
              class="mini-tag"
            >{{ interviews(app) }} 条</span>
            <span
              v-else
              class="dim"
            >—</span>
          </td>
          <td>
            <div class="t-ops">
              <ElButton
                size="small"
                text
                type="primary"
                class="row-open"
                @click.stop="emit('open', app.id)"
              >
                详情
              </ElButton>
              <button
                type="button"
                class="star-btn"
                :class="{ starred: app.starred }"
                :aria-pressed="app.starred ? 'true' : 'false'"
                aria-label="收藏"
                @click.stop="emit('toggle-star', app.id)"
              >
                <AppIcon
                  name="star"
                  :size="15"
                />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p
      v-if="filtered.length === 0"
      class="table-empty"
    >
      没有符合条件的投递记录
    </p>
    <div
      v-if="pageCount > 1"
      class="table-foot"
    >
      <span class="table-count mono">已筛选 {{ sorted.length }} / {{ props.applications.length }}</span>
      <div class="pager">
        <button
          type="button"
          class="pg"
          :disabled="page === 1"
          aria-label="首页"
          @click="page = 1"
        >
          <AppIcon
            name="first"
            :size="14"
          />
        </button>
        <button
          type="button"
          class="pg"
          :disabled="page === 1"
          aria-label="上一页"
          @click="page--"
        >
          <AppIcon
            name="left"
            :size="14"
          />
        </button>
        <button
          v-for="n in pageNumbers"
          :key="n"
          type="button"
          class="pg"
          :class="{ on: n === page }"
          :aria-current="n === page ? 'page' : undefined"
          @click="page = n"
        >
          {{ n }}
        </button>
        <button
          type="button"
          class="pg"
          :disabled="page === pageCount"
          aria-label="下一页"
          @click="page++"
        >
          <AppIcon
            name="right"
            :size="14"
          />
        </button>
        <button
          type="button"
          class="pg"
          :disabled="page === pageCount"
          aria-label="末页"
          @click="page = pageCount"
        >
          <AppIcon
            name="last"
            :size="14"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  /* 横向 + 纵向滚动：内容区撑满后，行多时纵向滚动而不是溢出 */
  overflow: auto;
}
.app-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1080px;
}
th {
  text-align: left;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.th-sort:hover {
  color: var(--text);
}
.sort-ic {
  display: inline-grid;
  opacity: .45;
  transition: opacity .15s;
}
.sort-ic.on {
  opacity: 1;
  color: var(--primary-text);
}
.sort-ic :deep(svg) {
  transform: rotate(-90deg);
}
.sort-ic.desc :deep(svg) {
  transform: rotate(90deg);
}
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  vertical-align: middle;
}
tbody tr {
  cursor: pointer;
  transition: background 0.15s;
}
tbody tr:hover {
  background: var(--card2);
}
tbody tr:last-child td {
  border-bottom: none;
}
.t-company {
  font-weight: var(--fw-semibold);
  white-space: nowrap;
}
.t-ops {
  display: flex;
  align-items: center;
  gap: 7px;
}
.star-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--muted);
  transition: color .16s, background .16s, border-color .16s;
}
.star-btn:hover {
  color: var(--warn);
  border-color: var(--warn-border);
}
.star-btn.starred {
  color: var(--warn);
  background: var(--warn-soft);
  border-color: var(--warn-border);
}
.star-btn.starred :deep(svg path) {
  fill: currentColor;
}
.dim {
  color: var(--text2);
  font-size: 12.5px;
}
.date {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mini-tag {
  font-size: 11px;
  color: var(--text2);
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.5px 8px;
  white-space: nowrap;
}
/*
 * 单行 + 省略号的三列：中文可在任意字符间断行，列宽被其他列一压就折成竖排把整行撑高
 * （长职位名如「…-2027届校招（某市分公司）(J00001)」最明显）。职位/渠道/下一步都是
 * 长度不可控的自由文本，统一裁剪；职位的完整名称挂在 title 上，鼠标悬停可看全。
 */
.clip-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/*
 * 职位列固定 168px：约 11 个汉字后收「…」（如「示例集团-某省分公司-…」），完整名称看 title。
 * width 与 max-width 都写不是冗余：auto 表格布局在有富余宽度时会把余量按比例摊给各列，
 * 只写 max-width 时 ≥1450px 的视口会把这列摊到 225px（一行显示 24 字，同列的短职位名
 * 后面还拖 140px 空白）；写上 width 才真正钉住。
 * 上限不跟视口伸缩也是刻意的——列宽由最长的那条决定，放宽只会让短名字后面的空白更大。
 */
.pos-cell {
  width: 168px;
  max-width: 168px;
}
/* 渠道多为 2–4 字，但列宽被挤到 51px 时「官网」会断成两行、把整行撑高 10px */
.chan-cell {
  max-width: 140px;
}
.next-cell {
  max-width: 220px;
}
.stale-hint {
  margin-left: 6px;
  font-size: 10.5px;
  color: var(--danger);
}
.table-empty {
  padding: 32px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}
.table-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 18px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
}
.pager {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pg {
  display: grid;
  place-items: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--text2);
  font-size: 12px;
}
.pg:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--border2);
}
.pg:disabled {
  opacity: .4;
  cursor: not-allowed;
}
.pg.on {
  background: var(--primary-strong);
  border-color: var(--primary-strong);
  color: #fff;
}
</style>
