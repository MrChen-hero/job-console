<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { useDemoStore, type MergedDemo } from '../demoStore'
import { useProjectStore, type MergedProject, type ProjectInput } from '../projectStore'
import { verticalIndexOf } from '../deck'
import DeckOverlay from '../components/DeckOverlay.vue'
import DemoUploadDialog from '../components/DemoUploadDialog.vue'
import ProjectEditor from '../components/ProjectEditor.vue'

const demoStore = useDemoStore()
const projectStore = useProjectStore()
const deckOpen = ref(false)
const deckStart = ref(0)
const deckVStart = ref(0)
const uploadOpen = ref(false)
const uploadInitial = ref<MergedDemo | null>(null)
const preparing = ref(true)
const loadError = ref('')
const editorOpen = ref(false)
const editorInitial = ref<MergedProject | null>(null)

async function load() {
  preparing.value = true
  loadError.value = ''
  try { await Promise.all([demoStore.load(), projectStore.load()]) }
  catch { loadError.value = '项目演示加载失败，请重试。' }
  finally { preparing.value = false }
}
onMounted(load)

/** 演示页清单只列可见项目下的；隐藏项目的演示页保留在库中但不出列 */
const visibleDemos = computed(() =>
  demoStore.merged.filter((d) => projectStore.visible.some((p) => p.id === d.projectId)),
)

function projectNameOf(projectId: string): string {
  return projectStore.merged.find((p) => p.id === projectId)?.title ?? projectId
}
function demoCount(projectId: string): number {
  return visibleDemos.value.filter((demo) => demo.projectId === projectId).length
}

/** 顶部色条颜色：走 accent 令牌（黑/灰中性色令牌同样存在）；旧数据值映射到黄/红 */
function accentVar(accent: string): string {
  const map: Record<string, string> = {
    red: 'var(--accent-red)',
    orange: 'var(--accent-orange)',
    yellow: 'var(--accent-yellow)',
    green: 'var(--accent-green)',
    teal: 'var(--accent-teal)',
    blue: 'var(--accent-blue)',
    violet: 'var(--accent-violet)',
    black: 'var(--accent-black)',
    gray: 'var(--accent-gray)',
    amber: 'var(--accent-yellow)',
    rose: 'var(--accent-red)',
  }
  return map[accent] ?? 'var(--accent-violet)'
}

/** 打开 Deck 并定位：index 为横向项目序，vertical 为纵向层（0 为主面） */
function openDeck(index: number, vertical = 0) {
  deckStart.value = index
  deckVStart.value = vertical
  deckOpen.value = true
}

/** 演示行「查看」：定位到所属项目，并直接落在该演示页所在的纵向层 */
function openDemoDeck(demo: MergedDemo) {
  const index = projectStore.visible.findIndex((p) => p.id === demo.projectId)
  if (index < 0) return
  openDeck(index, verticalIndexOf(projectStore.visible[index]!, demoStore.merged, demo.id))
}

function openCreate() {
  editorInitial.value = null
  editorOpen.value = true
}

/** 添加演示：新建态（清掉上一次的编辑目标，否则弹窗会回填上次那条） */
function openDemoCreate() {
  uploadInitial.value = null
  uploadOpen.value = true
}

/** 所有演示共用编辑入口。 */
function openDemoEdit(demo: MergedDemo) {
  uploadInitial.value = demo
  uploadOpen.value = true
}

function openEdit(project: MergedProject) {
  editorInitial.value = project
  editorOpen.value = true
}

async function onSaveProject(input: ProjectInput) {
  if (editorInitial.value) {
    await projectStore.updateProject(editorInitial.value.id, input)
    ElMessage.success('项目已更新')
  } else {
    await projectStore.addProject(input)
    ElMessage.success('项目已创建')
  }
}

async function onRemoveProject(project: MergedProject) {
  try {
    await ElMessageBox.confirm(`删除项目「${project.title}」？关联演示页将不再显示。`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await projectStore.removeProject(project.id)
  ElMessage.success('已删除')
}

async function removeDemo(demo: MergedDemo) {
  // 内置演示与上传演示一视同仁：内置走 runtimeDemos 墓碑行，runtime 直接删行
  try {
    await ElMessageBox.confirm(`删除交互演示「${demo.title}」？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await demoStore.removeDemo(demo.id)
  ElMessage.success('已删除')
}
</script>

<template>
  <div
    v-loading="preparing"
    class="showcase-view"
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
    <div class="showcase-hero">
      <h1 class="hero-title">
        把项目讲成一个可以翻页的故事
      </h1>
      <p class="hero-sub">
        选择项目查看演示，支持上传网页或添加链接。左右切换项目，上下查看同一项目的不同演示。
      </p>
      <div class="hero-actions">
        <ElButton
          type="primary"
          size="large"
          class="deck-open"
          :disabled="projectStore.visible.length === 0"
          @click="openDeck(0)"
        >
          ▶ 进入项目演示
        </ElButton>
        <ElButton
          size="large"
          class="upload-open"
          @click="openDemoCreate"
        >
          ＋ 添加交互演示
        </ElButton>
        <ElButton
          size="large"
          class="proj-add"
          @click="openCreate"
        >
          ＋ 新增项目
        </ElButton>
      </div>
    </div>

    <ProjectEditor
      v-model="editorOpen"
      :initial="editorInitial"
      @save="onSaveProject"
    />

    <DemoUploadDialog
      v-model="uploadOpen"
      :initial="uploadInitial"
    />

    <!-- 交互演示清单（含编辑/删除）；隐藏项目的演示页不在此列 -->
    <div
      v-if="visibleDemos.length > 0"
      class="demo-list"
      data-testid="demo-list"
    >
      <div class="demo-list-head">
        <h3>交互演示页</h3>
        <span class="demo-list-sub">选择“查看”即可打开对应演示，也可以添加网页文件或演示链接。</span>
      </div>
      <div
        v-for="demo in visibleDemos"
        :key="demo.id"
        class="demo-row"
      >
        <span class="demo-title">{{ demo.title }}</span>
        <span class="demo-proj">{{ projectNameOf(demo.projectId) }}</span>
        <span
          class="src-tag"
          :class="demo.source"
        >{{ demo.source === 'local' ? '内置' : '我的' }}</span>
        <!-- 来源一眼可辨：链接页点「查看」进 Deck 后可能被对方站点拒绝嵌入 -->
        <span
          class="kind-tag"
          :class="demo.source === 'runtime' && demo.url ? 'is-link' : 'is-html'"
        >{{ demo.source === 'runtime' && demo.url ? '链接' : 'HTML' }}</span>
        <span class="demo-actions">
          <ElButton
            size="small"
            text
            @click="openDemoDeck(demo)"
          >查看</ElButton>
          <ElButton
            size="small"
            text
            class="demo-edit"
            @click="openDemoEdit(demo)"
          >编辑</ElButton>
          <ElButton
            size="small"
            text
            type="danger"
            class="demo-remove"
            @click="removeDemo(demo)"
          >删除</ElButton>
        </span>
      </div>
    </div>

    <div
      v-if="projectStore.visible.length === 0"
      class="proj-empty"
    >
      还没有可展示的项目。点「＋ 新增项目」创建一个。
    </div>

    <div class="proj-grid">
      <div
        v-for="(p, i) in projectStore.visible"
        :key="p.id"
        class="card proj"
        role="button"
        tabindex="0"
        :style="{ '--proj-accent': accentVar(p.accent) }"
        @click="openDeck(i)"
        @keydown.enter.self.prevent="openDeck(i)"
        @keydown.space.self.prevent="openDeck(i)"
      >
        <div class="proj-top">
          <span class="proj-heading">
            <b class="proj-name">{{ p.title }}</b>
            <span
              class="src-tag"
              :class="p.source"
            >{{ p.source === 'local' ? '示例' : '我的' }}</span>
          </span>
          <span class="proj-acts">
            <ElButton
              size="small"
              text
              class="proj-edit"
              :aria-label="`编辑项目 ${p.title}`"
              @click.stop="openEdit(p)"
            >
              编辑
            </ElButton>
            <ElButton
              size="small"
              text
              type="danger"
              class="proj-remove"
              :aria-label="`删除项目 ${p.title}`"
              @click.stop="onRemoveProject(p)"
            >
              删除
            </ElButton>
          </span>
        </div>
        <p class="proj-desc">
          {{ p.summary }}
        </p>
        <div class="proj-tags">
          <span
            v-for="s in p.stack"
            :key="s"
            class="tag"
          >{{ s }}</span>
        </div>
        <div class="proj-foot">
          <span>{{ demoCount(p.id) ? `${demoCount(p.id)} 个交互演示 · 点击查看` : '暂无交互演示 · 查看项目介绍' }}</span>
          <span>→</span>
        </div>
      </div>
    </div>

    <DeckOverlay
      v-if="deckOpen"
      :start-index="deckStart"
      :start-vertical="deckVStart"
      @close="deckOpen = false"
    />
  </div>
</template>

<style scoped>
.showcase-hero {
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background:
    radial-gradient(circle at 88% -20%, var(--primary-soft), transparent 55%),
    var(--card);
  padding: 34px 32px;
  margin-bottom: 14px;
}
.hero-title {
  font-size: 26px;
  font-weight: var(--fw-bold);
  letter-spacing: -.02em;
  line-height: 1.3;
}
.hero-sub {
  font-size: 13.5px;
  color: var(--text2);
  max-width: 560px;
  margin-top: 8px;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}
.demo-list {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  padding: 14px 16px;
  margin-bottom: 14px;
}
.demo-list-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.demo-list-head h3 {
  font-size: 13.5px;
  font-weight: var(--fw-bold);
}
.demo-list-sub {
  font-size: 11.5px;
  color: var(--muted);
}
.demo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border);
  font-size: 13px;
}
.demo-row:last-child {
  border-bottom: none;
}
.demo-title {
  font-weight: var(--fw-semibold);
}
.demo-proj {
  color: var(--muted);
  font-size: 12px;
}
.src-tag {
  font-size: 10.5px;
  font-weight: var(--fw-bold);
  border-radius: var(--r-sm);
  padding: 2px 7px;
}
.src-tag.local,
.src-tag.badge-style {
  color: var(--text2);
  background: var(--card2);
  border: 1px solid var(--border);
}
.src-tag.runtime {
  color: var(--primary-text);
  background: var(--primary-soft);
}
/* 演示来源标记（HTML / 链接）：与 src-tag 同尺寸，用描边区分而不再加一种底色 */
.kind-tag {
  font-size: 10.5px;
  font-weight: var(--fw-bold);
  border-radius: var(--r-sm);
  padding: 2px 7px;
  border: 1px solid var(--border);
  color: var(--muted);
}
.kind-tag.is-link {
  border-color: var(--info-border);
  color: var(--info);
}
.proj-empty {
  background: var(--card);
  border: 1px dashed var(--border2);
  border-radius: var(--r-lg);
  padding: 28px 24px;
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}
/* 来源标签紧跟标题，编辑/删除独立靠右。 */
.proj-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.proj-heading .src-tag {
  flex-shrink: 0;
  white-space: nowrap;
}
.proj-acts {
  display: inline-flex;
  flex-shrink: 0;
}
/* 悬停类设备：默认隐藏，卡片 hover / 焦点进入时浮现 */
@media (hover: hover) {
  .proj-acts {
    opacity: 0;
    pointer-events: none;
  }
  .proj:hover .proj-acts,
  .proj:focus-within .proj-acts {
    opacity: 1;
    pointer-events: auto;
  }
}
.proj-acts :deep(.el-button) {
  margin: 0;
  padding: 4px 9px;
  border-radius: var(--r-sm);
  font-weight: var(--fw-medium);
}
.proj-acts :deep(.el-button + .el-button) {
  margin-left: 4px;
}
/* 编辑：主色淡底；删除：危险色淡底——一眼可区分，不与卡片语义色打架 */
.proj-acts :deep(.el-button.proj-edit) {
  color: var(--primary-text);
  background: var(--primary-soft);
  border: 1px solid var(--primary-border);
}
.proj-acts :deep(.el-button.proj-edit:hover) {
  color: var(--primary-text);
  background: var(--primary-border);
}
.proj-acts :deep(.el-button.proj-remove) {
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid var(--danger-border);
}
.proj-acts :deep(.el-button.proj-remove:hover) {
  color: var(--danger);
  background: var(--danger-border);
}
.demo-actions {
  margin-left: auto;
}
.proj-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
/*
 * .card 只存在于 SectionCard.vue 的 scoped 样式里，scoped 不跨组件生效，
 * 所以 class="card proj" 这里拿不到任何表面样式——底色/描边/阴影需自己声明。
 */
.proj {
  position: relative;
  padding: 21px 18px 18px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  overflow: hidden;
  transition: box-shadow 0.2s var(--ease), transform 0.2s var(--ease), border-color 0.2s;
}
/* 顶部 3px 色条：项目自身的主题色（accent 令牌经内联 --proj-accent 传入） */
.proj::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--proj-accent, var(--accent-violet));
}
.proj:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--border2);
}
.proj:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.proj-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.proj-name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 15px;
  font-weight: var(--fw-bold);
  letter-spacing: -.02em;
}
.proj-desc {
  min-height: 66px;
  margin-top: 10px;
  color: var(--text2);
  font-size: 12.5px;
  line-height: 1.7;
}
.proj-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 13px;
}
.tag {
  font-size: 11px;
  color: var(--text2);
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.5px 8px;
}
.proj-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 15px;
  padding-top: 13px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
}
@media (max-width: 1360px) {
  .proj-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .demo-list-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .demo-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    padding: 14px 0;
  }
  .demo-title {
    grid-column: 1 / -1;
    overflow-wrap: anywhere;
  }
  .demo-proj {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .src-tag,
  .kind-tag {
    white-space: nowrap;
  }
  .demo-actions {
    grid-column: 1 / -1;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 8px;
    margin-left: 0;
    margin-top: 4px;
  }
  .demo-actions :deep(.el-button) {
    min-width: 0;
    height: 44px;
    margin: 0;
    background: var(--card2);
  }
  .proj-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .proj-desc {
    min-height: 0;
  }
  .showcase-hero {
    padding: 24px 20px;
  }
  .hero-title {
    font-size: 22px;
  }
}
</style>
