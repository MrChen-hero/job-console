<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElMessageBox, ElOption, ElSelect } from 'element-plus'
import type { CompanyPoolEntry } from '../../../storage/types'
import { TRACKS } from '../../../storage/types'
import { useTrackerStore } from '../store'

const emit = defineEmits<{
  convert: [entry: CompanyPoolEntry]
}>()

const store = useTrackerStore()
const loaded = ref(true)

onMounted(async () => {
  await store.load()
  loaded.value = false
})

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const editingCreatedAt = ref('')
const error = ref('')
const form = reactive({ company: '', city: '', category: '', track: '主投', priority: '', jdBrief: '' })

function openCreate() {
  editingId.value = null
  error.value = ''
  form.company = ''
  form.city = ''
  form.category = ''
  form.track = '主投'
  form.priority = ''
  form.jdBrief = ''
  dialogVisible.value = true
}

function openEdit(entry: CompanyPoolEntry) {
  editingId.value = entry.id
  editingCreatedAt.value = entry.createdAt
  error.value = ''
  form.company = entry.company
  form.city = entry.city ?? ''
  form.category = entry.category ?? ''
  form.track = entry.track
  form.priority = entry.priority != null ? String(entry.priority) : ''
  form.jdBrief = entry.jdBrief ?? ''
  dialogVisible.value = true
}

async function save() {
  if (form.company.trim() === '') {
    error.value = '请填写公司'
    return
  }
  if (form.priority.trim() !== '' && !Number.isFinite(Number(form.priority))) {
    error.value = '优先级必须是数字'
    return
  }
  const payload = {
    company: form.company.trim(),
    city: form.city.trim() || undefined,
    category: form.category.trim() || undefined,
    track: form.track as CompanyPoolEntry['track'],
    priority: form.priority.trim() === '' ? undefined : Number(form.priority),
    jdBrief: form.jdBrief.trim() || undefined,
  }
  if (editingId.value) {
    await store.updatePoolEntry({ ...payload, id: editingId.value, createdAt: editingCreatedAt.value })
  } else {
    await store.addPoolEntry(payload)
  }
  dialogVisible.value = false
}

async function remove(entry: CompanyPoolEntry) {
  try {
    await ElMessageBox.confirm(`从候选池移除「${entry.company}」？`, '删除确认', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await store.removePoolEntry(entry.id)
}
</script>

<template>
  <div
    v-loading="loaded"
    class="pool-view"
    data-testid="pool-view"
  >
    <div class="pool-toolbar">
      <span class="pool-hint">目标公司池：{{ store.companyPool.length }} 家。转投递会预填公司名打开新增表单（池条目保留，便于再次投递）。</span>
      <ElButton
        size="small"
        type="primary"
        class="pool-add"
        @click="openCreate"
      >
        ＋ 加入候选池
      </ElButton>
    </div>

    <div
      v-for="entry in store.companyPool"
      :key="entry.id"
      class="pool-card"
    >
      <div class="pool-main">
        <b class="pool-company">
          {{ entry.company }}
          <span
            class="pool-track"
            :class="entry.track === '主投' ? 'track-main' : 'track-other'"
          >{{ entry.track }}</span>
        </b>
        <span class="pool-meta">
          {{ [entry.city, entry.category, entry.priority != null ? `优先级 ${entry.priority}` : ''].filter(Boolean).join(' · ') || '—' }}
        </span>
        <span
          v-if="entry.jdBrief"
          class="pool-brief"
        >{{ entry.jdBrief }}</span>
      </div>
      <div class="pool-actions">
        <ElButton
          size="small"
          type="primary"
          text
          class="pool-convert"
          @click="emit('convert', entry)"
        >
          转投递
        </ElButton>
        <ElButton
          size="small"
          text
          @click="openEdit(entry)"
        >
          编辑
        </ElButton>
        <ElButton
          size="small"
          text
          type="danger"
          class="pool-remove"
          @click="remove(entry)"
        >
          移除
        </ElButton>
      </div>
    </div>
    <p
      v-if="store.companyPool.length === 0"
      class="pool-empty"
    >
      候选池为空，点击「加入候选池」添加目标公司。
    </p>

    <ElDialog
      v-model="dialogVisible"
      :title="editingId ? '编辑候选公司' : '加入候选池'"
      width="480px"
    >
      <div class="pool-field">
        <label for="pf-company">公司 <span class="req">*</span></label>
        <ElInput
          id="pf-company"
          v-model="form.company"
          data-field="company"
          placeholder="如：招商银行"
        />
      </div>
      <div class="pool-field-row">
        <div class="pool-field">
          <label for="pf-city">城市</label>
          <ElInput
            id="pf-city"
            v-model="form.city"
            data-field="city"
            placeholder="上海"
          />
        </div>
        <div class="pool-field">
          <label for="pf-category">类型</label>
          <ElInput
            id="pf-category"
            v-model="form.category"
            data-field="category"
            placeholder="国企 / 银行 / 运营商 / 民企"
          />
        </div>
      </div>
      <div class="pool-field-row">
        <div class="pool-field">
          <label for="pf-track">投向</label>
          <ElSelect
            id="pf-track"
            v-model="form.track"
            data-field="track"
          >
            <ElOption
              v-for="t in TRACKS"
              :key="t"
              :label="t"
              :value="t"
            />
          </ElSelect>
        </div>
        <div class="pool-field">
          <label for="pf-priority">优先级</label>
          <ElInput
            id="pf-priority"
            v-model="form.priority"
            data-field="priority"
            placeholder="数字越大越优先"
          />
        </div>
      </div>
      <div class="pool-field">
        <label for="pf-brief">JD 摘要</label>
        <ElInput
          id="pf-brief"
          v-model="form.jdBrief"
          type="textarea"
          :rows="3"
          data-field="jdBrief"
        />
      </div>
      <p
        v-if="error"
        class="pool-error"
        role="alert"
      >
        {{ error }}
      </p>
      <template #footer>
        <ElButton @click="dialogVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          class="pool-save"
          @click="save"
        >
          保存
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* 内容区占满高度（由 TrackerView flex:1 给），卡片超出时纵向滚动 */
.pool-view {
  overflow-y: auto;
}
.pool-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.pool-hint {
  font-size: 12px;
  color: var(--muted);
}
.pool-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 12px 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.18s var(--ease), box-shadow 0.18s var(--ease);
}
.pool-card:hover {
  border-color: var(--border2);
  box-shadow: var(--shadow-md);
}
.pool-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pool-company {
  font-size: 13.5px;
  font-weight: var(--fw-semibold);
  display: flex;
  align-items: center;
  gap: 8px;
}
.pool-track {
  font-size: 10.5px;
  font-weight: var(--fw-bold);
  border-radius: 999px;
  padding: 0 8px;
}
.track-main {
  color: var(--primary-text);
  background: var(--primary-soft);
  border: 1px solid var(--primary-border);
}
.track-other {
  color: var(--text2);
  background: var(--card2);
  border: 1px solid var(--border);
}
.pool-meta {
  font-size: 11.5px;
  color: var(--muted);
}
.pool-brief {
  font-size: 12px;
  color: var(--text2);
}
.pool-actions {
  flex-shrink: 0;
}
.pool-empty {
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
  padding: 24px 0;
}
.pool-field {
  margin-bottom: 14px;
}
.pool-field label {
  display: block;
  font-size: 12px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
  margin-bottom: 6px;
}
.pool-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}
.req {
  color: var(--danger);
}
.pool-error {
  color: var(--danger);
  font-size: 12px;
}
@media (max-width: 480px) {
  .pool-card {
    flex-direction: column;
    align-items: stretch;
  }
  .pool-actions {
    align-self: flex-end;
  }
}
</style>
