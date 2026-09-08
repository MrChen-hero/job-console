<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElMessage, ElOption, ElSelect } from 'element-plus'
import type { Application, CompanyPoolEntry, Stage, Track } from '../../../storage/types'
import { TRACKS } from '../../../storage/types'
import { useTrackerStore } from '../store'
import type { ApplicationFormInput } from '../applicationForm'
import ApplicationDialog from '../components/ApplicationDialog.vue'
import ApplicationTable from '../components/ApplicationTable.vue'
import ApplicationBoard from '../components/ApplicationBoard.vue'
import CompanyPoolView from '../components/CompanyPoolView.vue'
import ApplicationDrawer from '../components/ApplicationDrawer.vue'
import AppIcon from '../../../shared/ui/AppIcon.vue'

const store = useTrackerStore()
const route = useRoute()
const router = useRouter()
const mode = ref<'table' | 'board' | 'pool'>('table')
const stageFilter = ref<Stage | '全部'>('全部')
const channelFilter = ref('')
/** 投向筛选（主投 / 次投 / 尝试 / 练手）；空串 = 所有投向，含未填投向的记录 */
const trackFilter = ref<Track | ''>('')
const starredOnly = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
function clearSearch() {
  query.value = ''
  searchInput.value?.focus()
}
const filtersOpen = ref(false)
const filterCount = computed(() => [stageFilter.value !== '全部', Boolean(channelFilter.value), Boolean(trackFilter.value), starredOnly.value].filter(Boolean).length)
function clearFilters() {
  stageFilter.value = '全部'
  channelFilter.value = ''
  trackFilter.value = ''
  starredOnly.value = false
}
const dialogVisible = ref(false)
const editing = ref<Application | null>(null)
const presetCompany = ref('')
const drawerId = ref('')
const loadError = ref('')

/** 渠道列表来自现有数据动态聚合 */
const channels = computed(() => [...new Set(store.applications.map((a) => a.channel))].sort((a, b) => a.localeCompare(b, 'zh')))

async function load() {
  loadError.value = ''
  // 支持从工作台磁贴直达看板：/tracker?mode=board
  const wanted = route.query.mode
  if (wanted === 'board' || wanted === 'pool' || wanted === 'table') mode.value = wanted
  try {
    await store.load()
    openDrawerFromRoute()
  } catch { loadError.value = '投递数据加载失败，请重试。' }
}
onMounted(load)

async function toggleStar(id: string) {
  try { await store.toggleStar(id) }
  catch { ElMessage.error('收藏保存失败，请重试') }
}

/** 等投递加载后再打开，刷新直达链接时也能显示完整详情。 */
function openDrawerFromRoute() {
  const id = route.query.applicationId
  drawerId.value = typeof id === 'string' && store.find(id) ? id : ''
}

watch(() => route.query.applicationId, openDrawerFromRoute)
watch(drawerId, (id) => {
  if (id !== '' || !('applicationId' in route.query)) return
  const query = { ...route.query }
  delete query.applicationId
  void router.replace({ query })
})

function openCreate() {
  editing.value = null
  presetCompany.value = ''
  dialogVisible.value = true
}

function openEdit(app: Application) {
  editing.value = app
  presetCompany.value = ''
  dialogVisible.value = true
}

async function onDialogSave(input: ApplicationFormInput) {
  if (editing.value) {
    await store.updateApplication(editing.value.id, input)
  } else {
    await store.addApplication(input)
  }
  ElMessage.success(editing.value ? '已更新投递' : `已记录投递：${input.company}`)
}

function openDrawer(id: string) {
  drawerId.value = id
}

function onConvert(entry: CompanyPoolEntry) {
  editing.value = null
  presetCompany.value = entry.company
  dialogVisible.value = true
}

function editFromDrawer(id: string) {
  const app = store.find(id)
  if (app) openEdit(app)
}

const STAGES_FOR_FILTER = ['已投递', '笔试', '一面', '二面', 'HR面', 'Offer', '挂', '无消息'] as const
</script>

<template>
  <div class="tracker-view">
    <div
      v-if="loadError"
      class="form-alert"
      role="alert"
    >
      {{ loadError }}<ElButton @click="load">
        重新加载
      </ElButton>
    </div>
    <div class="tracker-toolbar">
      <div
        class="mode-seg"
        role="tablist"
      >
        <button
          v-for="m in [
            { key: 'table', label: '表格' },
            { key: 'board', label: '看板' },
            { key: 'pool', label: '候选池' },
          ]"
          :key="m.key"
          class="mode-btn"
          :class="{ on: mode === m.key }"
          role="tab"
          :aria-selected="mode === m.key"
          @click="mode = m.key as typeof mode"
        >
          {{ m.label }}
        </button>
      </div>

      <template v-if="mode === 'table'">
        <button
          class="filter-toggle"
          :aria-expanded="filtersOpen"
          aria-controls="tracker-filters"
          @click="filtersOpen = !filtersOpen"
        >
          筛选{{ filterCount ? `（${filterCount}）` : '' }}
        </button>
        <div
          id="tracker-filters"
          class="tracker-filters"
          :class="{ expanded: filtersOpen }"
        >
          <ElSelect
            v-model="stageFilter"
            class="filter-select"
            aria-label="筛选状态"
          >
            <ElOption
              value="全部"
              label="全部状态"
            />
            <ElOption
              v-for="s in STAGES_FOR_FILTER"
              :key="s"
              :value="s"
              :label="s"
            />
          </ElSelect>
          <ElSelect
            v-model="channelFilter"
            class="filter-select"
            aria-label="筛选渠道"
            placeholder="所有渠道"
          >
            <ElOption
              value=""
              label="所有渠道"
            />
            <ElOption
              v-for="c in channels"
              :key="c"
              :value="c"
              :label="c"
            />
          </ElSelect>
          <ElSelect
            v-model="trackFilter"
            class="filter-select"
            data-field="track-filter"
            aria-label="筛选投向"
            placeholder="所有投向"
          >
            <ElOption
              value=""
              label="所有投向"
            />
            <ElOption
              v-for="t in TRACKS"
              :key="t"
              :value="t"
              :label="t"
            />
          </ElSelect>
          <button
            type="button"
            class="star-toggle"
            :class="{ on: starredOnly }"
            :aria-pressed="starredOnly ? 'true' : 'false'"
            @click="starredOnly = !starredOnly"
          >
            <AppIcon
              name="star"
              :size="15"
            />
            只看收藏
          </button>
          <button
            v-if="filterCount"
            class="clear-filters"
            @click="clearFilters"
          >
            清空筛选
          </button>
        </div>
        <div class="search-field">
          <input
            ref="searchInput"
            v-model="query"
            class="search-input"
            placeholder="搜索公司 / 职位 / 备注"
            aria-label="搜索投递"
            data-field="search"
          >
          <button
            v-if="query"
            type="button"
            class="search-clear"
            aria-label="清空搜索"
            title="清空搜索"
            @click="clearSearch"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </template>

      <div class="toolbar-right">
        <ElButton
          v-if="mode !== 'pool'"
          type="primary"
          class="add-app"
          @click="openCreate"
        >
          ＋ 新增投递
        </ElButton>
      </div>
    </div>

    <ApplicationTable
      v-if="mode === 'table'"
      :applications="store.applications"
      :stage-filter="stageFilter"
      :query="query"
      :channel-filter="channelFilter"
      :track-filter="trackFilter"
      :starred-only="starredOnly"
      @open="openDrawer"
      @toggle-star="toggleStar"
    />
    <ApplicationBoard
      v-else-if="mode === 'board'"
      @open="openDrawer"
    />
    <CompanyPoolView
      v-else
      @convert="onConvert"
    />

    <ApplicationDialog
      v-model="dialogVisible"
      :initial="editing"
      :preset-company="presetCompany"
      :persist="onDialogSave"
    />

    <ApplicationDrawer
      v-model:id="drawerId"
      @edit="editFromDrawer"
    />
  </div>
</template>

<style scoped>
/* 内容区占满可用高度：工具栏固定，表格/看板/候选池 flex:1 撑满并各自滚动 */
.tracker-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.tracker-view > :deep(.app-board),
.tracker-view > :deep(.table-card),
.tracker-view > :deep(.pool-view) {
  flex: 1;
  min-height: 0;
}
.tracker-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 13px 14px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
}
.tracker-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.filter-toggle { display: none; }
.clear-filters { min-height: 36px; color: var(--primary-text); }
/* 滑块切换：凹槽 + 白色滑块，对齐 demo .seg / .seg-btn */
.mode-seg {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--surface-muted);
}
.mode-btn {
  min-height: 32px;
  padding: 0 15px;
  border-radius: var(--r-sm);
  color: var(--muted);
  font-size: 13px;
  font-weight: var(--fw-semibold);
  transition: color .16s, background .16s, box-shadow .16s;
}
.mode-btn:hover {
  color: var(--text);
}
.mode-btn.on {
  background: var(--card);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
.filter-select {
  width: 132px;
}
.star-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--text2);
  font-size: 12.5px;
  font-weight: 600;
  transition: color .16s, background .16s, border-color .16s;
}
.star-toggle:hover {
  color: var(--text);
  border-color: var(--border2);
}
.star-toggle.on {
  color: var(--warn);
  background: var(--warn-soft);
  border-color: var(--warn-border);
}
.toolbar-right {
  margin-left: auto;
  display: flex;
  gap: 10px;
  align-items: center;
}
.search-field {
  position: relative;
  width: 220px;
  min-width: 0;
}
.search-input {
  padding: 7px 32px 7px 12px;
  border: 1px solid var(--control);
  border-radius: var(--r-sm);
  background: var(--card);
  width: 100%;
  outline: none;
  font-size: 13px;
}
.search-input::placeholder {
  color: var(--muted);
}
.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  font-size: 18px;
  line-height: 1;
  border-radius: var(--r-sm);
  color: var(--muted);
}
.search-clear:hover {
  color: var(--text);
  background: var(--surface-muted);
}
.search-clear:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
@media (max-width: 1024px) {
  .toolbar-right {
    margin-left: 0;
    width: 100%;
  }
  .search-field {
    flex: 1;
    width: auto;
  }
}
@media (max-width: 720px) {
  .filter-toggle { display: block; min-height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--r-sm); }
  .tracker-filters { display: none; width: 100%; order: 4; padding-top: 10px; border-top: 1px solid var(--border); }
  .tracker-filters.expanded { display: flex; }
  .search-field { flex-basis: 100%; }
  .tracker-toolbar .toolbar-right { width: auto; margin-left: auto; }
  .mode-btn { padding: 0 10px; }
}
</style>
