<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElButton, ElCheckbox, ElInput, ElMessageBox } from 'element-plus'
import { useResumeStore, type EntrySection } from '../store'
import {
  BASIC_FIELDS,
  SECTION_DEFS,
  type FieldDef,
  type SectionKey,
} from '../profileSchema'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import EntryCard from './EntryCard.vue'
import EntryDialog from './EntryDialog.vue'

const store = useResumeStore()
const emit = defineEmits<{ 'save-state': [state: string] }>()

const TABS: Array<{ key: SectionKey; label: string }> = [
  { key: 'basic', label: '基本信息' },
  ...SECTION_DEFS.map((s) => ({ key: s.key, label: s.label })),
  { key: 'selfEvaluation', label: '自我评价' },
]

/* 手风琴单开：null = 全收起 */
const openGroup = ref<SectionKey | null>('basic')
const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogFields = ref<FieldDef[]>([])
const dialogInitial = ref<Record<string, unknown> | null>(null)
const editingSection = ref<EntrySection>('education')
const editingId = ref<string | null>(null)

const basicForm = reactive<Record<string, string>>({})
const basicError = ref('')
const selfEvalText = ref('')
const basicOriginal = ref('')
const selfOriginal = ref('')
const saving = ref(false)
const saveError = ref('')
const dirty = computed(() => JSON.stringify(basicForm) !== basicOriginal.value || selfEvalText.value !== selfOriginal.value)
watch([dirty, saving, saveError], () => emit('save-state', saving.value ? '正在保存…' : saveError.value ? '保存失败，修改已保留' : dirty.value ? '有未保存修改' : '已保存到本机'), { immediate: true })

const currentSection = computed(() => SECTION_DEFS.find((s) => s.key === openGroup.value))

function groupCount(key: SectionKey): number | null {
  if (key === 'basic' || key === 'selfEvaluation') return null
  if (!store.profile) return 0
  return ((store.profile[key] as unknown) as Array<Record<string, unknown>>).length
}

/** 计数补零到两位，与 demo 的 padStart(2, '0') 一致 */
function padCount(n: number | null): string {
  return n == null ? '' : String(n).padStart(2, '0')
}

/** 再点已展开的组则收起，对齐 demo 的 poolOpen === group ? '' : group */
function toggleGroup(key: SectionKey) {
  openGroup.value = openGroup.value === key ? null : key
}

/* ---------- 区块编排 ---------- */

/** basic 固定首位，既不渲染 grip 也拒绝落点 */
const PINNED_KEY: SectionKey = 'basic'

const arranging = ref(false)
const dragKey = ref<SectionKey | null>(null)
const active = computed(() => store.activeVersion)

/** 按当前版本的 order 排；没有版本时退回 TABS 的静态顺序 */
const orderedTabs = computed(() => {
  const sections = active.value?.sections
  if (!sections?.length) return TABS
  const rank = new Map(sections.map((s) => [s.type as SectionKey, s.order]))
  return [...TABS].sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0))
})

/** 把编排结果写回版本；order 按数组下标重排，避免出现空洞 */
function persistOrder(keys: SectionKey[]) {
  const version = active.value
  if (!version) return
  const byType = new Map(version.sections.map((s) => [s.type as SectionKey, s]))
  const reordered = keys
    .map((key, i) => {
      const section = byType.get(key)
      return section ? { ...section, order: i } : null
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
  void store.updateSections(version.id, reordered)
}

/** 换位。目标落在首位一律拒绝，basic 自身也不可移动。 */
function swap(from: number, to: number) {
  const keys = orderedTabs.value.map((t) => t.key)
  if (to <= 0 || to >= keys.length || from <= 0) return
  const next = [...keys]
  ;[next[from], next[to]] = [next[to]!, next[from]!]
  persistOrder(next)
}

function moveSection(key: SectionKey, dir: -1 | 1) {
  const index = orderedTabs.value.findIndex((t) => t.key === key)
  if (index < 0) return
  swap(index, index + dir)
}

function onDragStart(key: SectionKey) {
  if (key === PINNED_KEY) return
  dragKey.value = key
}

function onDrop(targetKey: SectionKey) {
  const from = dragKey.value
  dragKey.value = null
  if (!from || from === targetKey) return
  const keys = orderedTabs.value.map((t) => t.key)
  swap(keys.indexOf(from), keys.indexOf(targetKey))
}

/* ---------- 版本内条目排除 ---------- */

function listEntries(key: SectionKey): Array<{ id: string; label: string }> {
  if (!store.profile) return []
  const def = SECTION_DEFS.find((s) => s.key === key)
  if (!def) return []
  const list = (store.profile[key] as unknown) as Array<Record<string, unknown>>
  return list.map((e) => ({ id: String(e.id), label: def.titleOf(e) }))
}

function isExcluded(key: SectionKey, entryId: string): boolean {
  const section = active.value?.sections.find((s) => s.type === key)
  return section?.excludedIds?.includes(entryId) ?? false
}

function toggleExcluded(key: SectionKey, entryId: string, visible: boolean) {
  const version = active.value
  if (!version) return
  const sections = [...version.sections].sort((a, b) => a.order - b.order).map((s) => ({ ...s }))
  const section = sections.find((s) => s.type === key)
  if (!section) return
  const excluded = new Set(section.excludedIds ?? [])
  if (visible) excluded.delete(entryId)
  else excluded.add(entryId)
  section.excludedIds = [...excluded]
  void store.updateSections(version.id, sections)
}

const entries = computed<Array<Record<string, unknown>>>(() => {
  const key = openGroup.value
  if (!store.profile || key === null) return []
  if (key === 'basic' || key === 'selfEvaluation') return []
  return (store.profile[key] as unknown) as Array<Record<string, unknown>>
})

watch(
  () => store.profile?.id,
  () => {
    if (store.profile) {
      for (const f of BASIC_FIELDS) {
        const raw = store.profile.basic[f.key as keyof typeof store.profile.basic]
        basicForm[f.key] = raw != null ? String(raw) : ''
      }
    }
    if (store.profile) {
      selfEvalText.value = store.profile.selfEvaluation.join('\n')
    }
    basicOriginal.value = JSON.stringify(basicForm)
    selfOriginal.value = selfEvalText.value
    saveError.value = ''
  },
  { immediate: true },
)

function openCreate() {
  const def = currentSection.value
  if (!def) return
  editingSection.value = def.key as EntrySection
  editingId.value = null
  dialogTitle.value = `添加 · ${def.label}`
  dialogFields.value = def.fields
  dialogInitial.value = null
  dialogVisible.value = true
}

function openEdit(index: number) {
  const def = currentSection.value
  if (!def) return
  editingSection.value = def.key as EntrySection
  editingId.value = String(entries.value[index]!.id ?? '')
  dialogTitle.value = '编辑条目'
  dialogFields.value = def.fields
  dialogInitial.value = entries.value[index]!
  dialogVisible.value = true
}

async function onDialogSave(record: Record<string, unknown>) {
  if (editingId.value) record.id = editingId.value
  await store.upsertEntry(editingSection.value, record as never)
}

async function onRemove(index: number) {
  const def = currentSection.value
  if (!def) return
  const entry = entries.value[index]!
  try {
    await ElMessageBox.confirm(`确定删除「${def.titleOf(entry)}」？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await store.removeEntry(def.key as EntrySection, String(entry.id))
}

function onMove(index: number, dir: -1 | 1) {
  const def = currentSection.value
  if (!def) return
  const entry = entries.value[index]!
  void store.moveEntry(def.key as EntrySection, String(entry.id), dir)
}

async function saveBasic() {
  if (saving.value) return
  const record: Record<string, unknown> = {}
  for (const f of BASIC_FIELDS) {
    const value = (basicForm[f.key] ?? '').trim()
    if (f.required && value === '') {
      basicError.value = `请填写「${f.label}」`
      return
    }
    record[f.key] = value
  }
  basicError.value = ''
  saving.value = true
  saveError.value = ''
  try {
    await store.updateBasic(record as never)
    basicOriginal.value = JSON.stringify(basicForm)
  } catch { saveError.value = '保存失败，请重试'; basicError.value = saveError.value }
  finally { saving.value = false }
}

async function saveSelfEvaluation() {
  if (saving.value) return
  const items = selfEvalText.value.split('\n').map((s) => s.trim()).filter(Boolean)
  saving.value = true
  saveError.value = ''
  try {
    await store.setSelfEvaluation(items)
    selfOriginal.value = selfEvalText.value
  } catch { saveError.value = '保存失败，请重试' }
  finally { saving.value = false }
}
</script>

<template>
  <div class="profile-editor">
    <div
      v-if="active"
      class="pool-toolbar"
    >
      <span class="pool-hint">{{ arranging ? '拖动 :: 调整区块顺序，基本信息固定首位' : '资料池' }}</span>
      <ElButton
        size="small"
        :type="arranging ? 'primary' : undefined"
        class="pool-arrange"
        :aria-pressed="arranging ? 'true' : 'false'"
        @click="arranging = !arranging"
      >
        {{ arranging ? '完成编排' : '区块编排' }}
      </ElButton>
    </div>

    <!-- 编排态：扁平列表，可拖动换位并勾选参与本版本的条目 -->
    <div
      v-if="arranging && active"
      class="pool arrange"
    >
      <div
        v-for="(tab, i) in orderedTabs"
        :key="tab.key"
        class="section-row"
        :class="{ pinned: tab.key === PINNED_KEY, dragging: dragKey === tab.key }"
        :draggable="tab.key !== PINNED_KEY"
        @dragstart="onDragStart(tab.key)"
        @dragover.prevent
        @drop.prevent="onDrop(tab.key)"
      >
        <div class="section-head">
          <AppIcon
            v-if="tab.key !== PINNED_KEY"
            name="grip"
            :size="15"
            class="grip solid"
          />
          <span
            v-else
            class="grip-placeholder"
            aria-hidden="true"
          />
          <b>{{ tab.label }}</b>
          <span
            v-if="tab.key === PINNED_KEY"
            class="pin-tag"
          >固定首位</span>
          <span class="section-actions">
            <ElButton
              size="small"
              text
              :disabled="tab.key === PINNED_KEY || i <= 1"
              :aria-label="`上移 ${tab.label}`"
              @click="moveSection(tab.key, -1)"
            >↑</ElButton>
            <ElButton
              size="small"
              text
              :disabled="tab.key === PINNED_KEY || i === orderedTabs.length - 1"
              :aria-label="`下移 ${tab.label}`"
              @click="moveSection(tab.key, 1)"
            >↓</ElButton>
          </span>
        </div>
        <div
          v-if="listEntries(tab.key).length"
          class="section-entries"
        >
          <ElCheckbox
            v-for="entry in listEntries(tab.key)"
            :key="entry.id"
            :model-value="!isExcluded(tab.key, entry.id)"
            @update:model-value="(val: unknown) => toggleExcluded(tab.key, entry.id, Boolean(val))"
          >
            {{ entry.label }}
          </ElCheckbox>
        </div>
      </div>
    </div>

    <div
      v-else
      class="pool"
    >
      <div
        v-for="tab in orderedTabs"
        :key="tab.key"
        class="tab-row"
        :class="{ open: openGroup === tab.key }"
      >
        <div class="tab-head">
          <button
            class="tab-btn"
            :class="{ on: openGroup === tab.key }"
            :aria-expanded="openGroup === tab.key ? 'true' : 'false'"
            :aria-controls="`pool-${tab.key}`"
            @click="toggleGroup(tab.key)"
          >
            <AppIcon
              name="chev"
              :size="14"
              class="chev"
            />
            {{ tab.label }}
          </button>
          <span
            v-if="groupCount(tab.key) != null"
            class="pool-n mono"
          >{{ padCount(groupCount(tab.key)) }}</span>
        </div>

        <!-- 展开区落在本组内部，而不是整条列表的末尾 -->
        <div
          v-if="openGroup === tab.key"
          :id="`pool-${tab.key}`"
          class="pool-body"
        >
          <!-- 基本信息 -->
          <div
            v-if="tab.key === 'basic'"
            class="basic-form"
          >
            <div
              v-for="f in BASIC_FIELDS"
              :key="f.key"
              class="entry-field"
            >
              <label>
                {{ f.label }}<span
                  v-if="f.required"
                  class="req"
                > *</span>
              </label>
              <ElInput
                v-if="f.type === 'text'"
                v-model="basicForm[f.key]"
                :placeholder="f.placeholder"
                :data-field="f.key"
              />
              <ElInput
                v-else
                v-model="basicForm[f.key]"
                type="textarea"
                :rows="2"
                :placeholder="f.placeholder"
                :data-field="f.key"
              />
            </div>
            <p
              v-if="basicError"
              class="entry-error"
              role="alert"
            >
              {{ basicError }}
            </p>
            <ElButton
              type="primary"
              class="basic-save"
              :loading="saving"
              @click="saveBasic"
            >
              保存基本信息
            </ElButton>
          </div>

          <!-- 自我评价 -->
          <div
            v-else-if="tab.key === 'selfEvaluation'"
            class="section-body"
          >
            <div class="entry-field">
              <label>自我评价（每行一条）</label>
              <ElInput
                v-model="selfEvalText"
                type="textarea"
                :rows="8"
                data-field="selfEvaluation"
              />
            </div>
            <ElButton
              type="primary"
              class="self-save"
              :loading="saving"
              @click="saveSelfEvaluation"
            >
              保存自我评价
            </ElButton>
            <p
              v-if="saveError"
              class="form-alert"
              role="alert"
            >
              {{ saveError }}
            </p>
          </div>

          <!-- 列表类条目 -->
          <div
            v-else-if="currentSection"
            class="section-body"
          >
            <div class="section-toolbar">
              <span class="section-hint">{{ entries.length }} 条</span>
              <ElButton
                size="small"
                type="primary"
                class="add-entry"
                @click="openCreate"
              >
                ＋ 添加条目
              </ElButton>
            </div>
            <EntryCard
              v-for="(entry, i) in entries"
              :key="String(entry.id)"
              :title="currentSection.titleOf(entry)"
              :subtitle="String(entry.time ?? '')"
              :first="i === 0"
              :last="i === entries.length - 1"
              @edit="openEdit(i)"
              @remove="onRemove(i)"
              @move-up="onMove(i, -1)"
              @move-down="onMove(i, 1)"
            />
            <p
              v-if="entries.length === 0"
              class="empty-hint"
            >
              暂无条目，点击「添加条目」开始。
            </p>
          </div>
        </div>
      </div>
    </div>

    <EntryDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :fields="dialogFields"
      :initial="dialogInitial"
      @save="onDialogSave"
    />
  </div>
</template>

<style scoped>
.profile-editor {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  padding: 10px 0;
}
.pool-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 14px 8px;
}
.pool-hint {
  font-size: 11.5px;
  color: var(--muted);
}
.pool {
  display: flex;
  flex-direction: column;
}
.pool.arrange {
  gap: 8px;
  padding: 0 14px 8px;
}
/* 编排态的一行区块：grip + 标题 + 上下移 + 本版本条目勾选 */
.section-row {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--card2);
}
.section-row[draggable='true'] {
  cursor: grab;
}
.section-row.dragging {
  opacity: 0.5;
}
.section-row.pinned {
  background: var(--card);
  border-style: dashed;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.grip,
.grip-placeholder {
  flex-shrink: 0;
  width: 15px;
}
.grip {
  color: var(--muted);
  cursor: grab;
}
.pin-tag {
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--muted);
  font-size: 10.5px;
}
.section-actions {
  margin-left: auto;
  flex-shrink: 0;
}
.section-entries {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
}
.section-entries :deep(.el-checkbox) {
  max-width: 100%;
  margin-right: 0;
  height: auto;
  align-items: flex-start;
}
.section-entries :deep(.el-checkbox__label) {
  white-space: normal;
  word-break: break-word;
  line-height: 1.5;
}
/* 每个 .tab-row 是一组：组头 + 本组展开区，展开区不再落到整条列表末尾 */
.tab-row {
  display: flex;
  flex-direction: column;
}
.tab-row + .tab-row {
  border-top: 1px solid var(--border);
}
/* 展开的组整体下沉，边界比相邻组头更明确 */
.tab-row.open {
  background: var(--card2);
}
.tab-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tab-head .pool-n {
  pointer-events: none;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-height: 46px;
  padding: 0 19px;
  font-size: 13px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
  text-align: left;
  transition: color .16s, background .16s;
}
.tab-btn:hover {
  color: var(--text);
}
.tab-btn.on {
  color: var(--text);
}
.chev {
  flex-shrink: 0;
  color: var(--muted);
  transform: rotate(-90deg);
  transition: transform .18s var(--ease);
}
.tab-btn.on .chev {
  transform: rotate(90deg);
}
.pool-n {
  margin-right: 19px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--muted);
  font-size: 11px;
  font-weight: var(--fw-normal);
  font-variant-numeric: tabular-nums;
}
.pool-body {
  padding: 0 5px 10px;
}
.section-body {
  padding: 4px 0 4px;
}
.section-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 14px 10px;
}
.section-hint {
  font-size: 12px;
  color: var(--muted);
}
.entry-field {
  margin-bottom: 14px;
}
.entry-field label {
  display: block;
  font-size: 12px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
  margin-bottom: 6px;
}
.req {
  color: var(--danger);
}
.entry-error {
  color: var(--danger);
  font-size: 12px;
  margin-bottom: 10px;
}
.empty-hint {
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
  padding: 20px 0;
}
.basic-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
  padding: 10px 14px 6px;
}
.basic-form .entry-field:first-child {
  grid-column: span 2;
}
.basic-form .basic-save {
  grid-column: span 2;
  justify-self: start;
}
@media (max-width: 860px) {
  .basic-form {
    grid-template-columns: 1fr;
  }
  .basic-form .entry-field:first-child,
  .basic-form .basic-save {
    grid-column: span 1;
  }
}
</style>
