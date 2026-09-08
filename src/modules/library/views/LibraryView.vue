<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElButton, ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import type { LibraryCategory } from '../../../storage/types'
import { useLibraryStore, filterByCategory, type MergedDoc } from '../store'
import { renderMarkdown } from '../../../shared/markdown/render'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import DocEditor from '../components/DocEditor.vue'
import { markdownPreview } from '../../../shared/markdown/preview'
import { newId } from '../../../storage/types'

const store = useLibraryStore()
const activeTab = ref<LibraryCategory | '全部'>('全部')
const activeId = ref('')
const editorOpen = ref(false)
const editorInitial = ref<MergedDoc | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const search = ref('')
const loadError = ref('')
const categoryManager = ref(false)
const editor = ref<InstanceType<typeof DocEditor> | null>(null)
const leaveOpen = ref(false)
const leaveSaving = ref(false)
let resolveLeave: ((value: boolean) => void) | null = null

function finishLeave(value: boolean) {
  leaveOpen.value = false
  resolveLeave?.(value)
  resolveLeave = null
}
async function saveAndLeave() {
  leaveSaving.value = true
  try {
    if (await editor.value?.save()) finishLeave(true)
    else finishLeave(false)
  } finally { leaveSaving.value = false }
}
async function mayLeave(): Promise<boolean> {
  if (editor.value?.saving || resolveLeave) return false
  if (!editor.value?.dirty) return true
  leaveOpen.value = true
  return new Promise((resolve) => { resolveLeave = resolve })
}
async function closeEditor() {
  if (await mayLeave()) editorOpen.value = false
}
onBeforeRouteLeave(mayLeave)
function beforeUnload(event: BeforeUnloadEvent) {
  if (!editor.value?.dirty) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  resolveLeave?.(false)
})

async function load() {
  loadError.value = ''
  try {
    await store.load()
    if (store.docs.length > 0) activeId.value = store.docs[0]!.id
  } catch { loadError.value = '材料加载失败，请重试。' }
}
onMounted(load)

const tabs = computed<Array<LibraryCategory | '全部'>>(() => ['全部', ...store.categories])
const visibleDocs = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return filterByCategory(store.docs, activeTab.value).filter((doc) => !query || `${doc.title} ${doc.body} ${doc.tags.join(' ')}`.toLocaleLowerCase().includes(query))
})
const excerpts = computed(() => new Map(store.docs.map((doc) => [doc.id, markdownPreview(doc.body).slice(0, 100)])))
watch(visibleDocs, (docs) => {
  if (!docs.some((doc) => doc.id === activeId.value)) activeId.value = docs[0]?.id ?? ''
})
async function selectCategory(tab: string) {
  if (!await mayLeave()) return
  editorOpen.value = false
  activeTab.value = tab
}
async function selectDoc(id: string) {
  if (!await mayLeave()) return
  editorOpen.value = false
  activeId.value = id
}
const activeDoc = computed(() => store.docs.find((d) => d.id === activeId.value))
const activeHtml = computed(() => (activeDoc.value ? renderMarkdown(activeDoc.value.body) : ''))

/** 分类图标与计数：'.chip' 类名保留（测试靠它切换分类） */
const CATEGORY_ICONS: Record<string, string> = {
  全部: 'layers',
  自我介绍: 'user',
  高频问题: 'help',
  项目深挖: 'mark',
  八股面经: 'book',
}

function catCount(tab: string): number {
  return tab === '全部' ? store.docs.length : filterByCategory(store.docs, tab).length
}

async function addCategory() {
  let name: string
  try {
    ;({ value: name } = await ElMessageBox.prompt('分类名称将用于文档归属，保存后可在文档编辑中选用。', '新增分类', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputPlaceholder: '如：行为面 / 复盘',
      inputPattern: /\S+/,
      inputErrorMessage: '分类名称不能为空',
    }))
  } catch {
    return
  }
  if (await store.addCategory(name)) {
    ElMessage.success(`已新增分类「${name.trim()}」`)
  } else {
    ElMessage.warning('该分类已存在')
  }
}

async function renameCategory(name: string) {
  let target: string
  try {
    ;({ value: target } = await ElMessageBox.prompt(`将「${name}」重命名为：`, '重命名分类', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: name,
      inputPattern: /\S+/,
      inputErrorMessage: '分类名称不能为空',
    }))
  } catch {
    return
  }
  if (await store.renameCategory(name, target)) {
    if (activeTab.value === name) activeTab.value = target.trim()
    ElMessage.success('已重命名，该分类下的文档已同步迁移')
  } else {
    ElMessage.warning('目标分类名已存在')
  }
}

async function restoreDefaults() {
  try {
    await ElMessageBox.confirm('恢复默认分类？内置分类的改名与删除会被撤销，自定义分类不受影响。', '恢复确认', {
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  await store.restoreDefaultCategories()
  activeTab.value = '全部'
  ElMessage.success('已恢复默认分类')
}

async function removeCategory(name: string) {
  try {
    await ElMessageBox.confirm(`删除分类「${name}」？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  if (await store.removeCategory(name)) {
    if (activeTab.value === name) activeTab.value = '全部'
    ElMessage.success(`已删除分类「${name}」`)
  } else {
    ElMessage.warning('该分类下还有文档，请先移动或删除它们')
  }
}

function sourceLabel(doc: MergedDoc): string {
  if (doc.kind === 'runtime') return doc.overridden ? '已修改' : '我的文档'
  return '内置'
}

async function openCreate() {
  if (!await mayLeave()) return
  editorOpen.value = false
  await nextTick()
  editorInitial.value = null
  editorOpen.value = true
}

function openEdit(doc: MergedDoc) {
  editorInitial.value = doc
  editorOpen.value = true
}

async function persistDoc(input: { id?: string; category: LibraryCategory; title: string; body: string; tags: string[] }) {
  const id = input.id ?? newId()
  await store.upsertDoc({ ...input, id })
  activeTab.value = input.category
  search.value = ''
  activeId.value = id
  ElMessage.success('已保存')
}

async function onRemove(doc: MergedDoc) {
  try {
    await ElMessageBox.confirm(`确定删除「${doc.title}」？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await store.removeDoc(doc.id)
  if (activeId.value === doc.id) activeId.value = store.docs[0]?.id ?? ''
  ElMessage.success('已删除')
}

function pickFile() {
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  try {
    const raw = await file.text()
    const parsed = store.parseUploaded(raw, file.name.replace(/\.md$/i, ''))
    await store.upsertDoc({ ...parsed, id: undefined })
    ElMessage.success(`已导入「${parsed.title}」`)
  } finally {
    inputEl.value = ''
  }
}
</script>

<template>
  <div class="library-view">
    <div
      v-if="loadError"
      class="form-alert"
      role="alert"
    >
      {{ loadError }}<ElButton @click="load">
        重新加载
      </ElButton>
    </div>
    <div class="library-toolbar">
      <input
        v-model="search"
        class="library-search"
        aria-label="搜索材料"
        placeholder="搜索标题、正文或标签"
        :disabled="editorOpen"
      >
      <ElButton
        class="upload-btn"
        @click="pickFile"
      >
        上传文档
      </ElButton>
      <ElButton
        type="primary"
        class="create-btn"
        @click="openCreate"
      >
        新建文档
      </ElButton>
      <ElButton
        class="manage-categories"
        @click="categoryManager = true"
      >
        管理分类
      </ElButton>
    </div>
    <ElDialog
      v-model="categoryManager"
      title="管理分类"
      width="480px"
    >
      <div
        v-for="category in store.categories"
        :key="category"
        class="category-manage-row"
      >
        <span>{{ category }} <small>（{{ catCount(category) }}）</small></span>
        <button
          class="cat-act"
          :aria-label="`重命名分类 ${category}`"
          @click="renameCategory(category)"
        >
          重命名
        </button>
        <button
          class="cat-act"
          :aria-label="`删除分类 ${category}`"
          @click="removeCategory(category)"
        >
          删除
        </button>
      </div>
      <template #footer>
        <ElButton
          class="cat-add"
          @click="addCategory"
        >
          新增分类
        </ElButton>
        <ElButton
          v-if="store.hasBuiltinOverrides"
          @click="restoreDefaults"
        >
          恢复默认分类
        </ElButton>
        <ElButton @click="categoryManager = false">
          完成
        </ElButton>
      </template>
    </ElDialog>
    <ElDialog
      :model-value="leaveOpen"
      title="保存文档修改？"
      append-to-body
      width="420px"
      :show-close="!leaveSaving"
      :close-on-click-modal="!leaveSaving"
      :close-on-press-escape="!leaveSaving"
      @update:model-value="(open: boolean) => { if (!open) finishLeave(false) }"
    >
      <p>当前文档有未保存的修改，请选择如何处理。</p>
      <template #footer>
        <ElButton
          :disabled="leaveSaving"
          @click="finishLeave(false)"
        >
          继续编辑
        </ElButton>
        <ElButton
          :disabled="leaveSaving"
          @click="finishLeave(true)"
        >
          放弃修改
        </ElButton>
        <ElButton
          type="primary"
          :loading="leaveSaving"
          @click="saveAndLeave"
        >
          保存并继续
        </ElButton>
      </template>
    </ElDialog>
    <input
      ref="fileInput"
      type="file"
      accept=".md,.markdown,text/markdown"
      class="file-input"
      @change="onFileChange"
    >

    <div class="lib">
      <!-- 左栏：分类 -->
      <div class="lib-cats">
        <div class="lib-label">
          CATEGORY
        </div>
        <div
          v-for="tab in tabs"
          :key="tab"
          class="cat-row"
        >
          <button
            class="cat chip"
            :class="{ on: activeTab === tab }"
            @click="selectCategory(tab)"
          >
            <AppIcon
              :name="CATEGORY_ICONS[tab] ?? 'layers'"
              :size="15"
            />
            <span>{{ tab }}</span>
          </button>
          <span class="cat-n mono">{{ catCount(tab) }}</span>
        </div>
      </div>

      <!-- 中栏：文档列表 -->
      <div class="lib-docs">
        <div class="doc-list">
          <button
            v-for="doc in visibleDocs"
            :key="doc.id"
            class="lib-item"
            :class="{ on: doc.id === activeId }"
            @click="selectDoc(doc.id)"
          >
            <span class="doc-top">
              <b class="doc-item-title">{{ doc.title }}</b>
              <span
                class="src-tag"
                :class="doc.kind"
              >{{ sourceLabel(doc) }}</span>
            </span>
            <span class="doc-ex">{{ excerpts.get(doc.id) }}</span>
            <span class="doc-foot">
              <span class="doc-tags">
                <span
                  v-for="t in doc.tags"
                  :key="t"
                  class="tag"
                ># {{ t }}</span>
              </span>
            </span>
          </button>
          <p
            v-if="visibleDocs.length === 0"
            class="lib-empty"
          >
            {{ search ? '未找到匹配文档，试试其他关键词。' : '该分类暂无文档。' }}
          </p>
        </div>
      </div>

      <!-- 右栏：阅读区 -->
      <div class="reader">
        <template v-if="editorOpen">
          <DocEditor
            ref="editor"
            :initial="editorInitial"
            :persist="persistDoc"
            @save="editorOpen = false"
            @cancel="closeEditor"
          />
        </template>
        <template v-else-if="activeDoc">
          <div class="reader-head">
            <h3 class="reader-title">
              {{ activeDoc.title }}
            </h3>
            <div class="reader-acts doc-actions">
              <ElButton
                size="small"
                type="primary"
                class="edit-btn"
                @click="openEdit(activeDoc)"
              >
                编辑
              </ElButton>
              <ElButton
                size="small"
                text
                type="danger"
                class="delete-btn"
                @click="onRemove(activeDoc)"
              >
                删除
              </ElButton>
            </div>
          </div>
          <!-- activeHtml 已由 renderMarkdown 清理。 -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            class="doc-body"
            data-testid="doc-body"
            v-html="activeHtml"
          />
        </template>
        <div
          v-else
          class="lib-empty-main"
        >
          选择左侧文档阅读。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 14px; }
.library-toolbar .el-button { margin: 0; min-height: 40px; }
.library-search { flex: 1; min-width: 180px; padding: 9px 12px; border: 1px solid var(--control); border-radius: var(--r-sm); background: var(--card); }
.category-manage-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.category-manage-row > span { flex: 1; overflow-wrap: anywhere; }
.category-manage-row .cat-act { width: auto; min-width: 60px; min-height: 40px; font-size: 13px; }
.library-view {
  min-width: 0;
}
.file-input {
  display: none;
}
.lib {
  display: grid;
  grid-template-columns: 208px 358px minmax(0, 1fr);
  min-height: 680px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.lib-cats {
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  border-right: 1px solid var(--border);
}
.lib-label {
  padding: 0 8px 11px;
  color: var(--muted);
  font-size: 11px;
  font-weight: var(--fw-bold);
  letter-spacing: .12em;
}
.cat-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cat-row .cat-n {
  pointer-events: none;
}
.cat {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--r);
  color: var(--text2);
  font-size: 13px;
  font-weight: var(--fw-normal);
  text-align: left;
  transition: color .16s, background .16s, border-color .16s;
}
.cat:hover {
  color: var(--text);
  background: var(--card2);
}
.cat.on {
  color: var(--primary-text);
  background: var(--primary-soft);
  border-color: var(--primary-border);
  font-weight: var(--fw-semibold);
}
.cat-n {
  color: var(--muted);
  font-size: 11px;
}
.cat-row:has(.cat.on) .cat-n {
  color: var(--primary-text);
}
/* 自定义分类行内管理按钮：hover 才浮现，避免常驻噪音 */
.cat-acts {
  display: none;
  gap: 2px;
}
.cat-row:hover .cat-acts,
.cat-row:focus-within .cat-acts {
  display: inline-flex;
}
.cat-act {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: var(--r-sm);
  background: none;
  color: var(--muted);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.cat-act:hover {
  color: var(--text);
  background: var(--surface-muted);
}
.cat-manage {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 4px;
}
.cat-manage :deep(.el-button + .el-button) {
  margin-left: 0;
  margin-top: 2px;
}
.cat-add,
.cat-restore {
  justify-content: flex-start;
  padding: 0 10px;
  color: var(--muted);
}
.cat-add:hover,
.cat-restore:hover {
  color: var(--primary-text);
}
.lib-cats-foot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding: 12px 8px 4px;
}
.lib-cats-foot :deep(.el-button) {
  width: 100%;
  margin: 0;
}
.lib-docs {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--border);
}
.doc-list {
  flex: 1;
  padding: 8px 8px 10px;
  overflow-y: auto;
}
.lib-item {
  position: relative;
  display: block;
  width: 100%;
  padding: 13px 12px;
  border: 1px solid transparent;
  border-radius: var(--r);
  text-align: left;
  transition: background .16s, border-color .16s;
}
.lib-item:hover {
  background: var(--card2);
}
.lib-item.on {
  background: var(--primary-soft);
  border-color: var(--primary-border);
}
.lib-item.on::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 11px;
  bottom: 11px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--primary);
}
.doc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.doc-item-title {
  color: var(--text);
  font-size: 13px;
  font-weight: var(--fw-semibold);
  line-height: 1.45;
}
.doc-ex {
  display: -webkit-box;
  margin-top: 6px;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.doc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}
.doc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  font-size: 10.5px;
  color: var(--text2);
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 6px;
}
.src-tag {
  flex: 0 0 auto;
  font-size: 10.5px;
  font-weight: var(--fw-bold);
  border-radius: var(--r-sm);
  padding: 2px 7px;
  white-space: nowrap;
}
.src-tag.local {
  color: var(--text2);
  background: var(--card2);
  border: 1px solid var(--border);
}
.src-tag.runtime {
  color: var(--primary-text);
  background: var(--primary-soft);
}
.lib-empty,
.lib-empty-main {
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
  padding: 24px 0;
}
.lib-empty-main {
  padding: 48px 26px;
}
.reader {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.reader-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.reader-title {
  font-size: 14.5px;
  font-weight: var(--fw-bold);
}
.reader-acts {
  display: flex;
  gap: 8px;
}
.doc-body {
  max-width: 780px;
  padding: 24px 26px 44px;
  color: var(--text2);
  font-size: 13.5px;
  line-height: 1.9;
}
.doc-body :deep(h2) {
  margin: 22px 0 8px;
  color: var(--text);
  font-size: 17px;
  font-weight: var(--fw-bold);
}
.doc-body :deep(h2:first-child) {
  margin-top: 0;
}
.doc-body :deep(p) {
  margin: 9px 0;
}
.doc-body :deep(ul) {
  display: grid;
  gap: 7px;
  margin: 11px 0;
  list-style: none;
}
.doc-body :deep(li) {
  position: relative;
  padding-left: 17px;
}
.doc-body :deep(li)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 6px;
  height: 6px;
  background: var(--primary);
}
.doc-body :deep(blockquote) {
  margin: 15px 0;
  padding: 12px 16px;
  border-left: 3px solid var(--primary);
  background: var(--primary-soft);
  border-radius: 0 var(--r) var(--r) 0;
}
.doc-body :deep(pre) {
  margin: 16px 0;
  padding: 17px 18px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--card2);
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.75;
}
.doc-body :deep(code) {
  font-family: var(--mono);
}
.doc-body :deep(pre code) {
  background: none;
  padding: 0;
}
.doc-body :deep(:not(pre) > code) {
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card2);
  font-size: 12.5px;
}
@media (max-width: 1024px) {
  .lib {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .lib-cats {
    flex-direction: row;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 10px 12px;
  }
  .lib-label {
    display: none;
  }
  .cat-row {
    flex-shrink: 0;
  }
  .cat {
    white-space: nowrap;
  }
  .cat-n {
    display: none;
  }
  /* 窄屏分类横滚：管理按钮常驻可点（无 hover） */
  .cat-acts {
    display: inline-flex;
  }
  .cat-manage {
    flex-direction: row;
    flex-shrink: 0;
    margin: 0 0 0 auto;
  }
  .cat-add,
  .cat-restore {
    padding: 0 6px;
  }
  .lib-cats-foot {
    flex-direction: row;
    margin: 0 0 0 auto;
    padding: 0;
  }
  .lib-cats-foot :deep(.el-button) {
    width: auto;
  }
  .lib-docs {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .doc-list {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  .lib-item {
    width: 240px;
    flex-shrink: 0;
  }
}
</style>
