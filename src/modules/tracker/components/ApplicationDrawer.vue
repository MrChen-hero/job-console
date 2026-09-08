<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElButton, ElDialog, ElDrawer, ElInput, ElMessageBox } from 'element-plus'
import { useTrackerStore } from '../store'
import { useStageChange } from '../useStageChange'
import { STAGE_BADGE, STAGE_DONE } from '../constants'
import type { InterviewRecord } from '../../../storage/types'
import '../badges.css'

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ 'update:id': [value: string]; edit: [id: string] }>()

const store = useTrackerStore()
const changeStage = useStageChange()
const app = computed(() => store.find(props.id))
const visible = computed({
  get: () => props.id !== '',
  set: (v) => {
    if (!v) emit('update:id', '')
  },
})

// 投递被外部删除时自动关闭，避免空内容抽屉停留
watch(
  () => store.find(props.id),
  (row) => {
    if (!row && props.id !== '') emit('update:id', '')
  },
)

const nextStage = computed(() => {
  if (!app.value) return undefined
  const index = STAGE_DONE.indexOf(app.value.status)
  return index >= 0 && index < STAGE_DONE.length - 1 ? STAGE_DONE[index + 1] : undefined
})
const isTerminal = computed(() => app.value?.status === '挂' || app.value?.status === '无消息')

/* ---------- 面试记录对话框 ---------- */
const ivVisible = ref(false)
const ivEditingId = ref<string | null>(null)
const ivError = ref('')
const saving = ref(false)
const actionError = ref('')

async function runAction(action: () => Promise<unknown>): Promise<boolean> {
  if (saving.value) return false
  saving.value = true
  actionError.value = ''
  try { await action(); return true }
  catch { actionError.value = '操作失败，请重试'; return false }
  finally { saving.value = false }
}
const ivForm = reactive({ round: '', date: '', format: '', questions: '', weak: '', followUp: '' })

watch(ivVisible, (open) => {
  if (!open) return
  ivError.value = ''
  const editing = app.value?.interviews.find((iv) => iv.id === ivEditingId.value)
  ivForm.round = editing?.round ?? ''
  ivForm.date = editing?.date ?? new Date().toISOString().slice(0, 10)
  ivForm.format = editing?.format ?? '线上'
  ivForm.questions = editing?.questions.join('\n') ?? ''
  ivForm.weak = editing?.weak ?? ''
  ivForm.followUp = editing?.followUp ?? ''
})

function openIvCreate() {
  ivEditingId.value = null
  ivVisible.value = true
}

function openIvEdit(record: InterviewRecord) {
  ivEditingId.value = record.id
  ivVisible.value = true
}

async function saveInterview() {
  if (!app.value || saving.value) return
  if (ivForm.round.trim() === '' || ivForm.date.trim() === '') {
    ivError.value = '请填写轮次与日期'
    return
  }
  const payload = {
    round: ivForm.round.trim(),
    date: ivForm.date.trim(),
    format: ivForm.format.trim() || undefined,
    questions: ivForm.questions.split('\n').map((s) => s.trim()).filter(Boolean),
    weak: ivForm.weak.trim() || undefined,
    followUp: ivForm.followUp.trim() || undefined,
  }
  const id = app.value.id
  const interviewId = ivEditingId.value
  const saved = await runAction(() => interviewId
    ? store.updateInterview(id, { ...payload, id: interviewId })
    : store.addInterview(id, payload))
  if (saved) ivVisible.value = false
  else ivError.value = '保存失败，输入已保留，请重试'
}

async function removeInterview(record: InterviewRecord) {
  if (!app.value) return
  try {
    await ElMessageBox.confirm(`删除「${record.round}」面试记录？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const id = app.value.id
  await runAction(() => store.removeInterview(id, record.id))
}

async function removeCurrent() {
  if (!app.value) return
  try {
    await ElMessageBox.confirm(`确定删除「${app.value.company} · ${app.value.position}」的投递记录？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const id = app.value.id
  if (await runAction(() => store.removeApplication(id))) emit('update:id', '')
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    :title="app ? `${app.company} · ${app.position}` : ''"
    size="520px"
    class="app-drawer"
  >
    <template v-if="app">
      <dl class="kv">
        <dt>当前状态</dt>
        <dd>
          <span
            class="stage-badge"
            :class="STAGE_BADGE[app.status]"
          ><span class="dot" />{{ app.status }}</span>
        </dd>
        <dt>批次 / 渠道</dt>
        <dd>
          <span class="mini-tag">{{ app.batch }}</span> <span class="mini-tag">{{ app.channel }}</span> <span
            v-if="app.location"
            class="mini-tag"
          >{{ app.location }}</span><span
            v-if="app.track"
            class="mini-tag"
          >{{ app.track }}</span>
        </dd>
        <dt>投递日期</dt>
        <dd class="date">
          {{ app.appliedAt }}
        </dd>
        <dt>下一步</dt>
        <dd>
          {{ app.nextStep || '—' }}<span
            v-if="app.nextActionAt"
            class="mini-tag"
            style="margin-left:6px"
          >{{ app.nextActionAt }}</span>
        </dd>
        <template v-if="app.notes">
          <dt>备注</dt>
          <dd class="dim">
            {{ app.notes }}
          </dd>
        </template>
        <template v-if="app.jobDesc">
          <dt>岗位信息</dt>
          <dd class="dim jd">
            {{ app.jobDesc }}
          </dd>
        </template>
      </dl>

      <h4 class="sec-title">
        阶段流转
      </h4>
      <ol class="tl">
        <li
          v-for="(h, i) in app.stageHistory"
          :key="i"
          class="tl-item"
        >
          <span class="tl-date">{{ h.date }}</span>
          <b class="tl-stage">{{ h.stage }}</b>
          <span
            v-if="h.note"
            class="tl-note"
          >{{ h.note }}</span>
        </li>
      </ol>

      <div class="sec-head">
        <h4 class="sec-title">
          面试记录（{{ app.interviews.length }}）
        </h4>
        <ElButton
          size="small"
          type="primary"
          class="iv-add"
          @click="openIvCreate"
        >
          ＋ 添加面试记录
        </ElButton>
      </div>
      <div
        v-for="iv in app.interviews"
        :key="iv.id"
        class="iv-card"
      >
        <div class="iv-head">
          <b>{{ iv.round }}</b>
          <span class="iv-meta">{{ iv.date }}<template v-if="iv.format"> · {{ iv.format }}</template></span>
          <span class="iv-actions">
            <ElButton
              size="small"
              text
              type="primary"
              @click="openIvEdit(iv)"
            >编辑</ElButton>
            <ElButton
              size="small"
              text
              type="danger"
              class="iv-delete"
              @click="removeInterview(iv)"
            >删除</ElButton>
          </span>
        </div>
        <ul
          v-if="iv.questions.length"
          class="iv-questions"
        >
          <li
            v-for="(q, i) in iv.questions"
            :key="i"
          >
            {{ q }}
          </li>
        </ul>
        <p
          v-if="iv.weak"
          class="iv-weak"
        >
          答得不好：{{ iv.weak }}
        </p>
        <p
          v-if="iv.followUp"
          class="iv-follow"
        >
          要补：{{ iv.followUp }}
        </p>
      </div>
      <p
        v-if="app.interviews.length === 0"
        class="iv-empty"
      >
        暂无面试记录。
      </p>

      <p
        v-if="actionError"
        class="form-alert"
        role="alert"
      >
        {{ actionError }}
      </p>
      <div class="drawer-actions">
        <ElButton
          v-if="nextStage"
          class="advance-btn"
          :disabled="saving"
          @click="runAction(() => store.advance(id))"
        >
          推进到{{ nextStage }}
        </ElButton>
        <ElButton
          v-if="!isTerminal"
          class="drop-btn"
          :disabled="saving"
          @click="runAction(() => changeStage(id, '挂'))"
        >
          标记挂
        </ElButton>
        <ElButton
          v-if="isTerminal"
          class="reopen-btn"
          :disabled="saving"
          @click="runAction(() => store.reopen(id))"
        >
          重新投递
        </ElButton>
        <ElButton
          class="edit-btn"
          @click="emit('edit', app.id)"
        >
          编辑信息
        </ElButton>
        <ElButton
          type="danger"
          text
          class="remove-btn"
          @click="removeCurrent"
        >
          删除投递
        </ElButton>
      </div>
    </template>

    <!-- 面试记录编辑对话框 -->
    <ElDialog
      v-model="ivVisible"
      :title="ivEditingId ? '编辑面试记录' : '添加面试记录'"
      width="480px"
      append-to-body
    >
      <div class="iv-field">
        <label for="iv-round">轮次 <span class="req">*</span></label>
        <ElInput
          id="iv-round"
          v-model="ivForm.round"
          data-field="iv-round"
          placeholder="一面 / 二面 / HR面"
        />
      </div>
      <div class="iv-field">
        <label for="iv-date">日期 <span class="req">*</span></label>
        <ElInput
          id="iv-date"
          v-model="ivForm.date"
          data-field="iv-date"
          placeholder="YYYY-MM-DD"
        />
      </div>
      <div class="iv-field">
        <label for="iv-format">形式</label>
        <ElInput
          id="iv-format"
          v-model="ivForm.format"
          data-field="iv-format"
          placeholder="线上 · 45min"
        />
      </div>
      <div class="iv-field">
        <label for="iv-questions">问到的题（每行一条）</label>
        <ElInput
          id="iv-questions"
          v-model="ivForm.questions"
          type="textarea"
          :rows="5"
          data-field="iv-questions"
        />
      </div>
      <div class="iv-field">
        <label for="iv-weak">答得不好的地方</label>
        <ElInput
          id="iv-weak"
          v-model="ivForm.weak"
          type="textarea"
          :rows="2"
          data-field="iv-weak"
        />
      </div>
      <div class="iv-field">
        <label for="iv-follow">要补的知识点</label>
        <ElInput
          id="iv-follow"
          v-model="ivForm.followUp"
          type="textarea"
          :rows="2"
          data-field="iv-follow"
        />
      </div>
      <p
        v-if="ivError"
        class="iv-error"
        role="alert"
      >
        {{ ivError }}
      </p>
      <template #footer>
        <ElButton @click="ivVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          class="iv-save"
          @click="saveInterview"
        >
          保存
        </ElButton>
      </template>
    </ElDialog>
  </ElDrawer>
</template>

<style scoped>
/* 抽屉标题分量提到与内容层级相称，并与 body 之间加一条分隔线 */
.app-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-size: 15px;
  font-weight: var(--fw-bold);
}
.app-drawer :deep(.el-drawer__body) {
  display: flex;
  flex-direction: column;
  padding: 20px 24px 0;
}
/* 概览块：下沉为内嵌面板，与下方各分组卡片形成「参考信息 / 可操作内容」的层次 */
.kv {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 8px 16px;
  align-items: baseline;
  font-size: 13px;
  margin: 0 0 24px;
  padding: 16px;
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: var(--r);
}
.kv dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: var(--fw-medium);
}
.kv dd {
  margin: 0;
  min-width: 0;
}
/* 面板内的标签在 --card2 上，底色改用 --card 才有对比 */
.mini-tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text2);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
}
.date {
  font-family: var(--mono);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.dim {
  color: var(--text2);
}
/* JD 原文保留换行，便于对照岗位要求逐条准备 */
.jd {
  white-space: pre-line;
}
/* 分组标题：小字号大写眉标 + 贯穿细线，把长抽屉切成可扫读的段 */
.sec-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 11.5px;
  font-weight: var(--fw-bold);
  letter-spacing: 0.06em;
  color: var(--muted);
  text-transform: uppercase;
  white-space: nowrap;
}
.sec-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}
.sec-head .sec-title {
  flex: 1;
  margin-bottom: 0;
}
/* 「阶段流转」紧随概览面板，其上边距已由 .kv 的 margin-bottom 提供 */
.kv + .sec-title {
  margin-top: 0;
}
.tl {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tl-item {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 0 0 14px 22px;
}
/* 最新一条在最后：加重排版，让「现在到哪了」不用数就能看出来 */
.tl-item:last-child .tl-stage {
  color: var(--primary-text);
}
.tl-item::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 5px;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--primary);
}
.tl-item::after {
  content: '';
  position: absolute;
  left: 7px;
  top: 18px;
  bottom: 0;
  width: 1px;
  background: var(--border);
}
.tl-item:last-child::after {
  display: none;
}
.tl-date {
  flex-shrink: 0;
  width: 72px;
  font-family: var(--mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.tl-stage {
  font-size: 13px;
  font-weight: var(--fw-semibold);
}
.tl-note {
  min-width: 0;
  font-size: 11.5px;
  color: var(--muted);
}
/* 面试记录卡：白底 + 左侧强调条，读作一条条独立记录而非连续文本 */
.iv-card {
  position: relative;
  margin-bottom: 10px;
  padding: 14px 16px 14px 18px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.iv-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--primary-border);
}
.iv-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.iv-head b {
  font-size: 13.5px;
  font-weight: var(--fw-semibold);
}
.iv-meta {
  font-family: var(--mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.iv-actions {
  margin-left: auto;
}
.iv-questions {
  margin: 0 0 0 18px;
  padding: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text2);
}
/* 「答得不好 / 要补」是复盘要点，用软底色块提示，不只靠文字颜色 */
.iv-weak,
.iv-follow {
  margin: 8px 0 0;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: var(--r-sm);
}
.iv-weak {
  color: var(--warn);
  background: var(--warn-soft);
}
.iv-follow {
  color: var(--info);
  background: var(--info-soft);
}
.iv-empty {
  margin: 0;
  padding: 20px 0;
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
}
/* 操作条吸底：长抽屉滚到底部时「推进到…」仍然可达 */
.drawer-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
  padding: 16px 0 0;
  background: var(--card);
  border-top: 1px solid var(--border);
}
.drawer-actions .remove-btn {
  margin-left: auto;
}
/* 浅色语义按钮：--*-soft 底 + 同色深色字，淡雅但靠色相区分。warning/success 的浅色
   Element 未桥接（只有 primary 有 --el-color-*-light-*），故统一用 Cool Slate 的
   --*-soft/border/text 令牌自定义，保证三色同套、亮暗协调；hover 仅加深边框 */
.drawer-actions .el-button.advance-btn {
  --el-button-bg-color: var(--primary-soft);
  --el-button-border-color: var(--primary-border);
  --el-button-text-color: var(--primary-text);
  --el-button-hover-bg-color: var(--primary-soft);
  --el-button-hover-border-color: var(--primary);
  --el-button-hover-text-color: var(--primary-text);
  --el-button-active-bg-color: var(--primary-soft);
  --el-button-active-border-color: var(--primary);
}
.drawer-actions .el-button.drop-btn {
  --el-button-bg-color: var(--warn-soft);
  --el-button-border-color: var(--warn-border);
  --el-button-text-color: var(--warn);
  --el-button-hover-bg-color: var(--warn-soft);
  --el-button-hover-border-color: var(--warn-vivid);
  --el-button-hover-text-color: var(--warn);
  --el-button-active-bg-color: var(--warn-soft);
  --el-button-active-border-color: var(--warn-vivid);
}
.drawer-actions .el-button.edit-btn {
  --el-button-bg-color: var(--success-soft);
  --el-button-border-color: var(--success-border);
  --el-button-text-color: var(--success);
  --el-button-hover-bg-color: var(--success-soft);
  --el-button-hover-border-color: var(--success-vivid);
  --el-button-hover-text-color: var(--success);
  --el-button-active-bg-color: var(--success-soft);
  --el-button-active-border-color: var(--success-vivid);
}
.iv-field {
  margin-bottom: 16px;
}
.iv-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 11.5px;
  font-weight: var(--fw-semibold);
  letter-spacing: 0.02em;
  color: var(--text2);
}
.req {
  color: var(--danger);
}
.iv-error {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--danger);
  background: var(--danger-soft);
  border-radius: var(--r-sm);
}
</style>
