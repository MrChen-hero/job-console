<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ElButton, ElDatePicker, ElInput, ElMessage, ElMessageBox } from 'element-plus'
import { db } from '../../../storage/db'
import { exportBackup } from '../../../storage/backup'
import { backupFileName, downloadJson } from '../../../shared/downloadJson'
import { useDashboardStore } from '../store'
import { useTrackerStore } from '../../tracker/store'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import Sparkline from '../../../shared/ui/Sparkline.vue'
import SectionCard from '../../../shared/ui/SectionCard.vue'
import StatusBadge from '../../tracker/components/StatusBadge.vue'

const dashboard = useDashboardStore()
const tracker = useTrackerStore()
const router = useRouter()
const preparing = ref(true)
const loadError = ref('')
const todos = computed(() => {
  const today = localToday()
  return dashboard.todos.map((todo) => ({
    ...todo,
    tone: todo.date < today ? 'overdue' : todo.date === today ? 'today' : 'later',
    dateLabel: todo.date < today ? '已逾期' : todo.date === today ? '今天' : '后续',
    dateText: todo.date.slice(0, 4) === today.slice(0, 4) ? todo.date.slice(5) : todo.date,
  }))
})

async function load() {
  preparing.value = true
  loadError.value = ''
  try { await dashboard.load() }
  catch { loadError.value = '工作台数据加载失败，请重试。' }
  finally { preparing.value = false }
}
onMounted(load)

function go(path: string) {
  void router.push(path)
}

const newMilestoneDate = ref('')
const newMilestoneLabel = ref('')
const showMsForm = ref(false)
const msFootEl = ref<HTMLElement | null>(null)

/** 收起并清空新增表单。用 v-show 而非 v-if 保留 DOM——dashboard.test.ts 直接对隐藏输入 setValue */
function closeMsForm() {
  showMsForm.value = false
  newMilestoneDate.value = ''
  newMilestoneLabel.value = ''
}

/* 表单的三条退出路径：点击卡片外部、Esc、「取消」按钮 */
function onDocClick(event: MouseEvent) {
  if (!showMsForm.value) return
  const target = event.target as Node | null
  if (target && msFootEl.value && !msFootEl.value.contains(target)) closeMsForm()
}

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showMsForm.value) closeMsForm()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKeydown)
  void stampMsDateField()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKeydown)
})

/**
 * ElDatePicker 不转发任意属性，data-field 需在渲染后补写到内层 input，
 * 保住测试在用的 `input[data-field="ms-date"]` 选择器。
 * 在表单容器内查而不是走 document：本视图可游离挂载（attach=false），那种情况下
 * 组件不在 document 里，全局查询拿不到（ApplicationDialog 是 teleport 到 body 的，
 * 所以那边能用 document）。表单里日期框排在事项框之前，第一个 input 即日期。
 */
async function stampMsDateField() {
  await nextTick()
  const input = msFootEl.value?.querySelector('input')
  if (input && input.getAttribute('data-field') !== 'ms-date') {
    input.setAttribute('data-field', 'ms-date')
  }
}

watch(showMsForm, (open) => {
  if (open) void stampMsDateField()
})

const MS_PER_DAY = 86400000
/** 几天内算「临近」，用强调色提示 */
const MS_SOON_DAYS = 3

/** 本地日期；不用 store 的 today()——它取 UTC，东八区清晨会算成前一天 */
function localToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type MsTone = 'overdue' | 'soon' | 'next' | 'future' | 'done'
interface MsItem {
  id: string
  date: string
  label: string
  done: boolean
  /** 同年省掉年份，跨年补全，避免 2027 的日期看起来像今年 */
  dateText: string
  countdown: string
  tone: MsTone
}

/**
 * 未完成在前、已完成沉底。未完成按日期升序——过期的日期最早，自然顶到最前，
 * 不至于被未来的条目盖住。第一个「暂不紧急」的项标为 next，给蓝环做视线落点。
 */
const msItems = computed<MsItem[]>(() => {
  const today = localToday()
  const year = today.slice(0, 4)
  const pending: MsItem[] = []
  const finished: MsItem[] = []

  for (const m of tracker.milestones) {
    const item: MsItem = {
      id: m.id,
      date: m.date,
      label: m.label,
      done: m.done === 1,
      dateText: m.date.slice(0, 4) === year ? m.date.slice(5) : m.date,
      countdown: '',
      tone: 'future',
    }
    if (item.done) {
      item.countdown = '已完成'
      item.tone = 'done'
      finished.push(item)
      continue
    }
    // 两端都按本地 00:00 解析，差值即自然日差；境内无夏令时，不必考虑 DST
    const diff = Math.round(
      (Date.parse(`${m.date}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / MS_PER_DAY,
    )
    if (!Number.isFinite(diff)) {
      item.countdown = '日期无效'
    } else if (diff < 0) {
      item.countdown = `已过 ${-diff} 天`
      item.tone = 'overdue'
    } else if (diff === 0) {
      item.countdown = '今天'
      item.tone = 'soon'
    } else {
      item.countdown = `还有 ${diff} 天`
      item.tone = diff <= MS_SOON_DAYS ? 'soon' : 'future'
    }
    pending.push(item)
  }

  const byDate = (a: MsItem, b: MsItem) => a.date.localeCompare(b.date)
  pending.sort(byDate)
  finished.sort(byDate)
  const next = pending.find((i) => i.tone === 'future')
  if (next) next.tone = 'next'
  return [...pending, ...finished]
})

async function addMilestone() {
  const date = newMilestoneDate.value.trim()
  const label = newMilestoneLabel.value.trim()
  if (date === '' || label === '') {
    ElMessage.warning('日期和事项都要填')
    return
  }
  const row = await tracker.addMilestone(date, label)
  if (!row) {
    ElMessage.error('日期无效，请重新选择')
    return
  }
  newMilestoneDate.value = ''
  newMilestoneLabel.value = ''
}

/** 导出全库为 JSON 备份文件；复用既有 exportBackup 与共享下载工具，不新增序列化逻辑 */
async function exportData() {
  try {
    downloadJson(backupFileName(), await exportBackup(db))
    ElMessage.success('备份已导出')
  } catch {
    ElMessage.error('导出失败，请重试')
  }
}

async function removeMilestone(id: string, label: string) {
  try {
    await ElMessageBox.confirm(`删除里程碑「${label}」？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await tracker.removeMilestone(id)
}

/** KPI 增量：末桶 − 4 周前那桶；基数为 0 时只显示绝对增量，不显示百分比（spec §6.4） */
const KPIS = computed(() => {
  const s = dashboard.series
  const delta = (key: 'total' | 'inFlight' | 'interviewing' | 'offers') => {
    const now = s[key][11] ?? 0
    const then = s[key][7] ?? 0
    const abs = now - then
    return { abs, text: then === 0 ? `${abs >= 0 ? '+' : ''}${abs}` : `${abs >= 0 ? '+' : ''}${abs} (${((abs / then) * 100).toFixed(1)}%)` }
  }
  return [
    { label: '累计投递', key: 'total' as const, testid: 'stat-total' },
    { label: '进行中', key: 'inFlight' as const, testid: 'stat-inflight' },
    { label: '面试中', key: 'interviewing' as const, testid: 'stat-interviewing' },
    { label: 'Offer', key: 'offers' as const, testid: 'stat-offers' },
  ].map((k) => ({ ...k, value: dashboard.stats[k.key], delta: delta(k.key) }))
})

/** 漏斗条形色阶：六档由深到浅，暗色下同样成立（设计图即如此） */
const SHADES = ['#2f6bff', '#4f80ff', '#6c95ff', '#8aabff', '#a8c0ff', '#c5d6ff']

/** 六格快捷入口（2×3）。path 型跳路由，action 型执行本地操作 */
const QUICK: Array<{ key: string; icon: string; title: string; path?: string; action?: () => void }> = [
  { key: 'new', path: '/tracker', icon: 'case', title: '记一笔投递' },
  { key: 'board', path: '/tracker?mode=board', icon: 'grid', title: '打开看板' },
  { key: 'resume', path: '/resume', icon: 'file', title: '打磨简历' },
  { key: 'library', path: '/library', icon: 'book', title: '背材料' },
  { key: 'showcase', path: '/showcase', icon: 'play', title: '项目演示' },
  { key: 'export', action: () => void exportData(), icon: 'download', title: '导出数据' },
]

function onQuick(item: (typeof QUICK)[number]) {
  if (item.action) item.action()
  else if (item.path) go(item.path)
}
</script>

<template>
  <div
    v-loading="preparing"
    class="dashboard"
  >
    <div
      v-if="loadError"
      class="form-alert"
      role="alert"
    >
      {{ loadError }}<ElButton @click="load">
        重新加载
      </ElButton>
    </div>
    <!-- KPI 行 -->
    <div class="kpi-row">
      <article
        v-for="kpi in KPIS"
        :key="kpi.key"
        class="card kpi"
      >
        <div class="kpi-label">
          {{ kpi.label }}
        </div>
        <div
          class="kpi-value tnum"
          :data-testid="kpi.testid"
        >
          {{ kpi.value }}
        </div>
        <div
          class="kpi-delta mono"
          :class="{ up: kpi.delta.abs > 0, down: kpi.delta.abs < 0 }"
          title="较四周前"
        >
          {{ kpi.delta.abs === 0 ? '暂无变化' : `${kpi.delta.abs > 0 ? '▲' : '▼'} ${kpi.delta.text}` }}
        </div>
        <Sparkline
          class="kpi-spark"
          :values="dashboard.series[kpi.key]"
        />
      </article>
    </div>

    <!-- 漏斗 + 待办 -->
    <div class="row-a">
      <SectionCard
        title="投递漏斗"
        class="funnel-card"
        sub="各阶段转化情况"
      >
        <div class="funnel">
          <div
            v-for="(row, i) in dashboard.funnel.rows"
            :key="row.stage"
            class="f-row"
          >
            <span class="f-name">{{ row.stage }}</span>
            <div class="f-plot">
              <div
                class="f-bar"
                :style="{ width: `${(row.pct * 100).toFixed(1)}%`, background: SHADES[i] }"
              />
            </div>
            <strong class="f-num tnum">{{ row.count }}</strong><span class="f-pct tnum">{{ (row.pct * 100).toFixed(1) }}%</span>
          </div>
          <div class="f-axis">
            <span />
            <div class="f-ticks mono">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
            <span /><span />
          </div>
          <p
            v-if="dashboard.staleCount > 0"
            class="stale-note"
          >
            {{ dashboard.staleCount }} 条「无消息」已超 1 个月，建议清理或重开
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="待办清单"
        sub="下一步动作"
        class="todo-card"
      >
        <div
          class="todo-list"
          role="region"
          aria-label="待办清单，按日期从早到晚排列"
          :tabindex="todos.length ? 0 : undefined"
        >
          <RouterLink
            v-for="todo in todos"
            :key="todo.id"
            :to="{ path: '/tracker', query: { applicationId: todo.id } }"
            :aria-label="`${todo.dateLabel}，${todo.date}，${todo.label}，${todo.sub}，查看投递详情`"
            class="todo"
          >
            <span
              class="pill mono todo-date"
              :class="todo.tone"
              :title="`${todo.dateLabel} · ${todo.date}`"
            >{{ todo.dateText }}</span>
            <span class="todo-text">
              {{ todo.label }}
              <span class="todo-sub">{{ todo.sub }}</span>
            </span>
            <StatusBadge :stage="todo.status" />
          </RouterLink>
          <p
            v-if="dashboard.todos.length === 0"
            class="card-empty"
          >
            暂无带日期的待办；在投递详情里填写「下一步」后会出现在这里。
          </p>
        </div>
      </SectionCard>
    </div>

    <!-- 里程碑 + 快捷操作 -->
    <div class="row-b">
      <SectionCard
        title="求职里程碑"
        sub="关键时间节点"
      >
        <ol class="ms-list">
          <li
            v-for="m in msItems"
            :key="m.id"
            class="ms"
            :class="[`is-${m.tone}`, { done: m.done }]"
          >
            <span
              class="ms-dot"
              aria-hidden="true"
            /><span class="pill mono">{{ m.dateText }}</span>
            <span class="ms-text">{{ m.label }}</span>
            <span class="ms-count mono">{{ m.countdown }}</span>
            <span class="ms-actions">
              <ElButton
                size="small"
                text
                @click="tracker.toggleMilestone(m.id)"
              >{{ m.done ? '重开' : '完成' }}</ElButton>
              <ElButton
                size="small"
                text
                type="danger"
                class="ms-delete"
                @click="removeMilestone(m.id, m.label)"
              >删除</ElButton>
            </span>
          </li>
        </ol>
        <p
          v-if="tracker.milestones.length === 0"
          class="card-empty"
        >
          暂无里程碑，例如添加「软考 2026-10-24」。
        </p>
        <div
          ref="msFootEl"
          class="ms-foot"
        >
          <ElButton
            v-show="!showMsForm"
            size="small"
            class="ms-toggle"
            @click="showMsForm = true"
          >
            ＋ 添加里程碑
          </ElButton>
          <div
            v-show="showMsForm"
            class="ms-form"
          >
            <ElDatePicker
              id="ms-date"
              v-model="newMilestoneDate"
              class="ms-date-input"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              clearable
              data-field="ms-date"
              placeholder="选择日期"
            />
            <ElInput
              v-model="newMilestoneLabel"
              data-field="ms-label"
              placeholder="事项，如：软考·软件设计师"
            />
            <ElButton
              type="primary"
              class="ms-add"
              @click="addMilestone"
            >
              添加
            </ElButton>
            <ElButton
              class="ms-cancel"
              @click="closeMsForm"
            >
              取消
            </ElButton>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="快捷操作">
        <div class="act-grid">
          <button
            v-for="q in QUICK"
            :key="q.key"
            class="quick"
            @click="onQuick(q)"
          >
            <AppIcon
              :name="q.icon"
              :size="26"
            />
            <span>{{ q.title }}</span>
          </button>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 14px;
}
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.kpi {
  padding: 17px 18px 14px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
}
.kpi-label {
  color: var(--text2);
  font-size: 12.5px;
}
.kpi-value {
  margin-top: 9px;
  font-size: 34px;
  font-weight: var(--fw-bold);
  line-height: 1.05;
  letter-spacing: -.02em;
}
.kpi-delta {
  color: var(--muted);
  margin-top: 9px;
  font-size: 12px;
}
.kpi-delta.up {
  color: var(--success);
}
.kpi-delta.down {
  color: var(--danger);
}
.kpi-spark {
  margin-top: 12px;
}
.row-a {
  display: grid;
  grid-template-columns: minmax(0, 1.34fr) minmax(300px, 1fr);
  gap: 14px;
}
.row-b {
  display: grid;
  grid-template-columns: minmax(0, .62fr) minmax(0, 1fr);
  gap: 14px;
}
.funnel {
  padding: 12px 19px 18px;
}
.f-row,
.f-axis {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) 42px 54px;
  gap: 14px;
  align-items: center;
}
.f-row {
  height: 40px;
}
.f-name {
  color: var(--text2);
  font-size: 12.5px;
}
.f-plot {
  position: relative;
  height: 22px;
  border-right: 1px solid var(--border);
  background-image: linear-gradient(to right, var(--border) 1px, transparent 1px);
  background-size: 25% 100%;
}
.f-bar {
  height: 100%;
  min-width: 3px;
  border-radius: 2px;
}
.f-num {
  font-size: 13px;
  font-weight: var(--fw-semibold);
  text-align: right;
}
.f-pct {
  color: var(--muted);
  font-size: 12px;
  text-align: right;
}
.f-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}
.stale-note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--danger);
}
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
.todo-list:focus-within {
  scrollbar-color: var(--border2) transparent;
}
.todo-list:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -3px;
}
.todo-list::-webkit-scrollbar {
  width: 6px;
}
.todo-list::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: var(--r-sm);
}
.todo-list:hover::-webkit-scrollbar-thumb,
.todo-list:focus-within::-webkit-scrollbar-thumb {
  background: var(--border2);
}
.todo-date.overdue {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: var(--danger-border);
}
.todo-date.today {
  color: var(--primary-text);
  background: var(--primary-soft);
  border-color: var(--primary-border);
}
.todo {
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
.todo:focus-visible {
  background: var(--primary-soft);
  color: var(--primary-text);
}
.todo:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}
.todo-text {
  font-size: 13px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.todo-sub {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--muted);
}
.pill {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card2);
  color: var(--text2);
  font-size: 12px;
  white-space: nowrap;
}
.ms-list {
  list-style: none;
  display: grid;
  margin: 0;
  padding: 15px 19px 6px;
}
.ms {
  position: relative;
  display: grid;
  grid-template-columns: 20px auto minmax(0, 1fr) auto auto;
  grid-template-areas: 'dot date text count actions';
  gap: 12px;
  align-items: center;
  padding: 7px 0;
}
.ms::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
}
.ms:first-child::before {
  top: 50%;
}
.ms:last-child::before {
  bottom: 50%;
}
.ms-dot {
  grid-area: dot;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 11px;
  margin: 0 auto;
  border: 1.5px solid var(--border2);
  border-radius: 2px;
  background: var(--card);
  transition: background .16s var(--ease), border-color .16s var(--ease);
}
/* 过期与临近共用强调色：这两类才是真正需要立刻看一眼的 */
.ms.is-overdue .ms-dot,
.ms.is-soon .ms-dot {
  border-color: var(--danger-vivid);
  background: var(--danger-vivid);
}
.ms.is-next .ms-dot {
  width: 12px;
  height: 12px;
  border-color: var(--primary);
  background: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.ms.done .ms-dot {
  width: 13px;
  height: 13px;
  border-color: var(--success-vivid);
  background: var(--success-vivid);
}
.ms.done .ms-dot::after {
  content: '';
  width: 5px;
  height: 2px;
  border-left: 1.5px solid var(--card);
  border-bottom: 1.5px solid var(--card);
  transform: rotate(-45deg) translate(0.5px, -1px);
}
.ms > .pill {
  grid-area: date;
}
.ms-text {
  grid-area: text;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.ms.done .ms-text {
  color: var(--muted);
  text-decoration: line-through;
}
.ms-count {
  grid-area: count;
  font-size: 12px;
  white-space: nowrap;
  color: var(--muted);
}
.ms.is-overdue .ms-count,
.ms.is-soon .ms-count {
  color: var(--danger);
  font-weight: var(--fw-medium);
}
.ms.is-next .ms-count {
  color: var(--text2);
}
.ms-actions {
  grid-area: actions;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity .16s var(--ease);
}
/* 操作按需浮现；focus-within 保证键盘用户同样能拿到这两个按钮 */
.ms:hover .ms-actions,
.ms-actions:focus-within {
  opacity: 1;
}
/* 触屏没有 hover，不做常驻就永远点不到 */
@media (hover: none) {
  .ms-actions {
    opacity: 1;
  }
}
.ms-foot {
  padding: 6px 19px 19px;
}
.ms-form {
  display: flex;
  gap: 8px;
}
/* 日期选择器比原文本框更占地方：前缀图标 + 清除图标，130px 会把日期挤成省略号 */
.ms-date-input {
  width: 152px;
  flex-shrink: 0;
}
.card-empty {
  color: var(--muted);
  font-size: 12.5px;
  padding: 8px 19px 12px;
}
.act-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 15px 19px 19px;
}
.quick {
  display: grid;
  justify-items: center;
  gap: 11px;
  padding: 21px 10px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--card);
  color: var(--text2);
  transition: color .16s, background .16s, border-color .16s;
}
.quick:hover {
  color: var(--primary-text);
  background: var(--primary-soft);
  border-color: var(--primary-border);
}
.quick span {
  font-size: 12.5px;
  font-weight: var(--fw-semibold);
}
@media (max-width: 1360px) {
  .todo-card { order: -1; }
  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .row-a,
  .row-b {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 720px) {
  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .kpi { padding: 12px; }
  .kpi-value { font-size: 28px; }
  .kpi-spark { display: none; }
  .todo { gap: 8px; }
  /* 磁贴保持 2 列：3 列在窄屏会把图标与文案挤成两行 */
  .act-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ms-form {
    flex-wrap: wrap;
  }
  /* 窄屏塞不下一行五列：操作换到第二行，并常驻（小屏多是触屏） */
  .ms {
    grid-template-columns: 20px auto minmax(0, 1fr) auto;
    grid-template-areas:
      'dot date text count'
      'actions actions actions actions';
    row-gap: 6px;
  }
  .ms-actions {
    justify-self: end;
    opacity: 1;
  }
}
/* 视图入场：级联 fade-up */
.dashboard > * {
  animation: fadeUp 0.5s var(--ease) both;
}
.dashboard > *:nth-child(2) { animation-delay: 0.05s; }
.dashboard > *:nth-child(3) { animation-delay: 0.1s; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dashboard > * {
    animation: none;
  }
}
</style>
