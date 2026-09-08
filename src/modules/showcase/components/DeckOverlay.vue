<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElButton } from 'element-plus'
import { demoUrl, useDemoStore } from '../demoStore'
import { useProjectStore, type MergedProject } from '../projectStore'
import { clampIndex, deckLayers, swipeIntent, type DeckLayer } from '../deck'
import { sanitizeHtml } from '../../../shared/markdown/render'
import { isHttpUrl } from '../../../shared/safeUrl'

const emit = defineEmits<{ close: [] }>()

const props = defineProps<{ startIndex?: number; startVertical?: number }>()

const demoStore = useDemoStore()
const projectStore = useProjectStore()
const hIdx = ref(0)
const vIdx = ref(0)
/** 网页全屏：演示区铺满浏览器视口（藏顶栏/底栏/信息区），不进系统全屏，Esc 退出 */
const pageFs = ref(false)

/** 项目清单来自 projectStore（内置 ∪ 自建，已滤隐藏） */
const projects = computed<MergedProject[]>(() => projectStore.visible)
const pageCount = computed(() => projects.value.length)
/** 渲染用的收敛索引：打开 Deck 期间项目被删导致 hIdx 越界时不至于渲染空白 */
const safeIdx = computed(() => clampIndex(hIdx.value, pageCount.value))
const project = computed<MergedProject>(() => projects.value[safeIdx.value]!)
const layers = computed<DeckLayer[]>(() => deckLayers(project.value, demoStore.merged))
const safeV = computed(() => clampIndex(vIdx.value, layers.value.length))

/** 非当前项目只渲染一层封面：同时挂 N 个 sandbox iframe 既吃内存，也会让 N 份 demo 一起跑 */
const COVER: DeckLayer[] = [{ kind: 'cover' }]

function facesOf(p: MergedProject): DeckLayer[] {
  return p.id === project.value.id ? layers.value : COVER
}

function isOn(p: MergedProject, li: number): boolean {
  return p.id === project.value.id ? li === safeV.value : li === 0
}

/** 封面媒体位文案：该项目有演示页（非当前项目才会走到封面）时说明进去能看到几个 */
function coverLabel(p: MergedProject): string {
  const n = demoStore.merged.filter((d) => d.projectId === p.id).length
  return n > 0 ? `${n} 个交互演示 · 进入项目查看` : '暂无交互演示 · 上传 .html 或填演示链接后在此展示'
}

/**
 * 演示媒体位的 src：链接式直接用外部地址，上传式转 Blob URL。
 * sandbox 两者不同——Blob URL 继承本站源，给 allow-same-origin 等于把本站的
 * localStorage/IndexedDB 交给演示页；外部地址本就是别的源，同源特权只作用于它自己，
 * 放开才能让自部署演示正常用自己的存储与接口。
 */
function demoSrc(layer: Extract<DeckLayer, { kind: 'demo' }>): string {
  return layer.url ? (isHttpUrl(layer.url) ? layer.url : 'about:blank') : demoUrl(layer.html)
}

function demoSandbox(layer: Extract<DeckLayer, { kind: 'demo' }>): string {
  // 同站地址不能获得 scripts + same-origin 的组合权限。
  return isHttpUrl(layer.url) && new URL(layer.url).origin !== window.location.origin
    ? 'allow-scripts allow-same-origin allow-forms allow-popups'
    : 'allow-scripts'
}

/**
 * 信息区侧栏的要点：优先该演示页自己的 points（每页各讲自己的事），
 * 没填时回落到项目的封面要点 demo.points（内置项目与老数据都靠这条）。
 */
function sidePoints(p: MergedProject, layer: DeckLayer): string[] {
  if (layer.kind === 'demo' && layer.points.length > 0) return layer.points
  return p.demo.points
}

function sideTitle(p: MergedProject, layer: DeckLayer): string {
  if (layer.kind === 'demo' && layer.points.length > 0) return layer.title
  return p.demo.title
}

/** 纵向层提示：兼作当前演示页的标签（旧版是演示页顶部的 eyebrow），封面层不提示 */
function layerHint(p: MergedProject, layer: DeckLayer, li: number): string {
  if (p.id !== project.value.id || layer.kind !== 'demo') return ''
  const n = layers.value.length
  if (n <= 1) return `交互演示 · ${layer.title}`
  return `交互演示 · ${layer.title}（${li + 1} / ${n}）· ↓↑ 切换演示页`
}

/** 屏幕全屏：对 iframe 元素 requestFullscreen（iframe 带 allowfullscreen），退出交给浏览器 */
function screenFullscreen(event: MouseEvent) {
  const iframe = (event.currentTarget as HTMLElement)
    .closest('.df-media')
    ?.querySelector<HTMLIFrameElement>('iframe')
  if (!iframe || typeof iframe.requestFullscreen !== 'function') return
  if (document.fullscreenElement) {
    void document.exitFullscreen()
    return
  }
  void iframe.requestFullscreen()
}

function goHorizontal(index: number) {
  hIdx.value = clampIndex(index, pageCount.value)
  vIdx.value = 0
}

function next() {
  goHorizontal(hIdx.value + 1)
}

function prev() {
  goHorizontal(hIdx.value - 1)
}

function goVertical(delta: number) {
  // 层级 = 该项目的演示页；无演示页时只有一层封面，vIdx 0 即第一个演示页
  vIdx.value = clampIndex(safeV.value + delta, layers.value.length)
}

function onKeydown(event: KeyboardEvent) {
  // Esc 先退网页全屏再关 Deck；网页全屏期间不翻页——演示铺满视口时翻页会让人不知道翻到了哪
  if (event.key === 'Escape') {
    if (pageFs.value) pageFs.value = false
    else emit('close')
    return
  }
  if (pageFs.value) return
  switch (event.key) {
    case 'ArrowRight': event.preventDefault(); next(); break
    case 'ArrowLeft': event.preventDefault(); prev(); break
    case 'ArrowDown': event.preventDefault(); goVertical(1); break
    case 'ArrowUp': event.preventDefault(); goVertical(-1); break
  }
}

/* 拖拽翻页（横向主导 + 阈值，逻辑在 deck.ts 已单测） */
let sx = 0
let sy = 0
let pressing = false

function onPointerDown(event: PointerEvent) {
  if (pageFs.value) return
  sx = event.clientX
  sy = event.clientY
  pressing = true
}

function onPointerUp(event: PointerEvent) {
  if (!pressing) return
  pressing = false
  const intent = swipeIntent(event.clientX - sx, event.clientY - sy)
  if (intent === 1) next()
  else if (intent === -1) prev()
}

onMounted(async () => {
  await Promise.all([demoStore.load(), projectStore.load()])
  // 初始定位须等 load 完成：点击的卡片/演示行可能是库里的自建项目，加载前不在 visible 清单中
  hIdx.value = clampIndex(props.startIndex ?? 0, pageCount.value)
  vIdx.value = clampIndex(props.startVertical ?? 0, layers.value.length)
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  // 关 Deck 时顺手退掉系统全屏：否则 iframe 卸载后浏览器会留在全屏空屏
  if (document.fullscreenElement) void document.exitFullscreen()
})

/* accent → 令牌映射（黑/灰等中性色同样有令牌）；amber/rose 是旧数据值，映射到黄/红 */
const accentColor: Record<string, string> = {
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
const accentSoft: Record<string, string> = {
  red: 'var(--accent-red-soft)',
  orange: 'var(--accent-orange-soft)',
  yellow: 'var(--accent-yellow-soft)',
  green: 'var(--accent-green-soft)',
  teal: 'var(--accent-teal-soft)',
  blue: 'var(--accent-blue-soft)',
  violet: 'var(--accent-violet-soft)',
  black: 'var(--accent-black-soft)',
  gray: 'var(--accent-gray-soft)',
  amber: 'var(--accent-yellow-soft)',
  rose: 'var(--accent-red-soft)',
}
</script>

<template>
  <div
    class="deck-overlay"
    :class="{ 'page-fs': pageFs }"
    data-testid="deck-overlay"
  >
    <div class="deck-top">
      <span class="dt-eyebrow">PROJECT {{ String(hIdx + 1).padStart(2, '0') }} / {{ String(pageCount).padStart(2, '0') }}</span>
      <span class="dt-title">{{ project.title }}</span>
      <span class="dt-eyebrow">{{ project.eyebrow }}</span>
      <button
        class="dt-close"
        aria-label="关闭演示"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div
      class="deck-stage"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    >
      <div
        class="deck-track"
        :style="{ transform: `translateX(-${safeIdx * 100}%)` }"
      >
        <section
          v-for="p in projects"
          :key="p.id"
          class="deck-slide"
          :class="{ current: p.id === project.id }"
        >
          <div class="deck-viewport">
            <!-- 每层 = 演示媒体位（demo 的 iframe，无演示页时为占位）+ 项目基础信息 -->
            <div
              v-for="(layer, li) in facesOf(p)"
              :key="layer.kind === 'demo' ? layer.demoId : 'cover'"
              class="deck-face"
              :class="{ on: isOn(p, li), cover: layer.kind !== 'demo' }"
            >
              <div
                class="df-media"
                :class="layer.kind === 'demo' ? 'is-demo' : 'is-cover'"
              >
                <template v-if="layer.kind === 'demo'">
                  <p
                    v-if="layer.url && !isHttpUrl(layer.url)"
                    role="alert"
                  >
                    演示链接无效，请编辑为完整的 http / https 地址。
                  </p>
                  <iframe
                    v-else
                    class="df-iframe"
                    :src="demoSrc(layer)"
                    :sandbox="demoSandbox(layer)"
                    referrerpolicy="no-referrer"
                    allowfullscreen
                    allow="fullscreen"
                    :title="layer.title"
                  />
                  <!-- 控制条浮在演示底部（类视频播放器）：hover / 聚焦浮现，网页全屏时常驻 -->
                  <div class="dfm-bar">
                    <span class="dfm-name">{{ layer.title }}</span>
                    <!-- 链接式演示：对方站点禁止嵌入（X-Frame-Options / CSP）时，这是唯一能看的路 -->
                    <a
                      v-if="isHttpUrl(layer.url)"
                      class="dfm-btn df-open-tab"
                      :href="layer.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      :aria-label="`在新标签打开：${layer.title}`"
                    >↗ 新标签打开</a>
                    <button
                      class="dfm-btn df-page-fs"
                      type="button"
                      :aria-label="pageFs ? '退出网页全屏' : `网页全屏：${layer.title}`"
                      @click="pageFs = !pageFs"
                    >
                      {{ pageFs ? '⤡ 退出网页全屏 (Esc)' : '⤢ 网页全屏' }}
                    </button>
                    <button
                      class="dfm-btn df-screen-fs"
                      type="button"
                      :aria-label="`屏幕全屏：${layer.title}`"
                      @click="screenFullscreen"
                    >
                      ⛶ 屏幕全屏
                    </button>
                  </div>
                </template>
                <span
                  v-else
                  class="dfm-label"
                >{{ coverLabel(p) }}</span>
              </div>

              <div class="df-info">
                <div class="dfi-main">
                  <span
                    class="df-eyebrow"
                    :style="{ color: accentColor[p.accent], background: accentSoft[p.accent] }"
                  >{{ p.eyebrow }}</span>
                  <h2 class="df-title">
                    {{ p.title }}
                  </h2>
                  <p class="df-summary">
                    {{ p.summary }}
                  </p>
                  <div class="df-stack">
                    <span
                      v-for="s in p.stack"
                      :key="s"
                      class="tag"
                    >{{ s }}</span>
                  </div>
                  <p
                    v-if="layerHint(p, layer, li)"
                    class="df-hint"
                  >
                    {{ layerHint(p, layer, li) }}
                  </p>
                </div>
                <div
                  v-if="sidePoints(p, layer).length > 0"
                  class="dfi-side"
                >
                  <p class="df-points-title">
                    {{ sideTitle(p, layer) }}
                  </p>
                  <!-- 演示要点与材料正文共用 HTML 清理入口。 -->
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <ul class="df-points">
                    <li
                      v-for="(pt, i) in sidePoints(p, layer)"
                      :key="i"
                      v-html="sanitizeHtml(pt)"
                    />
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div class="deck-foot">
      <ElButton
        size="small"
        :disabled="safeIdx === 0"
        @click="prev"
      >
        ← 上一项目
      </ElButton>
      <div class="deck-dots">
        <button
          v-for="(p, i) in projects"
          :key="p.id"
          class="deck-dot"
          :class="{ on: i === safeIdx }"
          :aria-label="`第 ${i + 1} 个项目：${p.title}`"
          @click="goHorizontal(i)"
        />
      </div>
      <ElButton
        size="small"
        :disabled="safeIdx === pageCount - 1"
        @click="next"
      >
        下一项目 →
      </ElButton>
      <span class="deck-hint"><kbd>←</kbd><kbd>→</kbd> 切换项目 · <kbd>↓</kbd><kbd>↑</kbd> 演示页 · <kbd>Esc</kbd> 退出</span>
    </div>
  </div>
</template>

<style scoped>
.deck-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}
.deck-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}
.dt-eyebrow {
  font-size: 11.5px;
  color: var(--muted);
  letter-spacing: 1px;
}
.dt-title {
  font-weight: 700;
  font-size: 15px;
}
.dt-close {
  margin-left: auto;
  width: 34px;
  height: 34px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text2);
}
.dt-close:hover {
  color: var(--text);
}
.deck-stage {
  flex: 1;
  overflow: hidden;
}
.deck-track {
  display: flex;
  height: 100%;
  transition: transform 0.45s var(--ease);
}
.deck-slide {
  min-width: 100%;
  height: 100%;
  overflow: hidden;
}
.deck-viewport {
  position: relative;
  height: 100%;
}
.deck-face {
  position: absolute;
  inset: 0;
  padding: 26px 48px 30px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow-y: auto;
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.35s var(--ease), transform 0.35s var(--ease);
  pointer-events: none;
  visibility: hidden;
}
/* 无演示页的封面内容短，居中更好看；演示层从顶部排（媒体位 flex:1 自然铺满） */
.deck-face.cover {
  justify-content: center;
}
.deck-face.on {
  opacity: 1;
  transform: none;
  pointer-events: auto;
  visibility: visible;
}
/* 媒体位：演示层放 iframe 并占满剩余高度，封面层是一条 150px 占位 */
.df-media {
  position: relative;
  display: flex;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--card2);
  overflow: hidden;
}
.df-media.is-demo {
  flex: 1 1 auto;
  min-height: 260px;
  margin-bottom: 18px;
}
.df-media.is-cover {
  flex: 0 0 auto;
  height: 150px;
  align-items: flex-end;
  margin-bottom: 20px;
}
.dfm-label {
  font-size: 11px;
  font-weight: var(--fw-bold);
  color: var(--text2);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 9px;
  margin: 0 14px 12px;
}
.df-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 2px;
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  margin-bottom: 14px;
}
/* 控制条浮在演示底部：默认隐形不遮挡演示，hover / 键盘聚焦 / 触屏时可见 */
.dfm-bar {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 24px);
  padding: 5px 8px 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  box-shadow: var(--shadow-md);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s var(--ease);
}
.df-media.is-demo:hover .dfm-bar,
.df-media.is-demo:focus-within .dfm-bar {
  opacity: 1;
  pointer-events: auto;
}
/* 触屏无 hover：常驻可点 */
@media (hover: none) {
  .dfm-bar {
    opacity: 1;
    pointer-events: auto;
  }
}
.dfm-name {
  font-size: 11.5px;
  color: var(--muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dfm-btn {
  /* 「新标签打开」是 <a>，与两个 <button> 同外观：inline-flex 居中 + 去下划线 */
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text2);
  font-size: 12px;
  font-weight: var(--fw-semibold);
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.16s var(--ease), background 0.16s var(--ease), border-color 0.16s var(--ease);
}
.dfm-btn:hover {
  color: var(--primary-text);
  background: var(--primary-soft);
  border-color: var(--primary-border);
}
.dfm-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
/* 信息区：每层都有，恒在媒体位之下。宽屏分两列（左信息、右要点），把省下的高度让给演示 */
.df-info {
  flex: 0 0 auto;
  display: grid;
  gap: 12px 36px;
}
.dfi-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dfi-side {
  min-width: 0;
}
@media (min-width: 1025px) {
  .df-info {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr);
    align-items: start;
  }
}
.df-title {
  font-size: 28px;
  font-weight: var(--fw-bold);
  letter-spacing: -.02em;
  margin-bottom: 10px;
}
.df-summary {
  font-size: 14px;
  color: var(--text2);
  max-width: 720px;
  margin-bottom: 12px;
}
.df-stack {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
/* 技术栈 chip：与 ShowcaseView 卡片上的取值一致（scoped 不跨组件，各自声明） */
.tag {
  font-size: 11px;
  color: var(--text2);
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.5px 8px;
}
.df-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--muted);
}
/* 演示要点：宽屏在右列，窄屏落到信息区下方；小标题取项目配置里的「演示页标题」 */
.df-points-title {
  font-size: 12.5px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
}
.df-points {
  margin-top: 6px;
  padding-left: 18px;
  font-size: 13px;
  color: var(--text2);
  max-width: 720px;
}
.df-points li {
  margin-bottom: 4px;
}
.df-iframe {
  flex: 1;
  width: 100%;
  border: 0;
  background: #fff;
}
/* 网页全屏：藏掉 Deck 上下栏与信息区，媒体位铺满视口（Esc 或控制条退出） */
.deck-overlay.page-fs .deck-top,
.deck-overlay.page-fs .deck-foot,
.deck-overlay.page-fs .df-info {
  display: none;
}
.deck-overlay.page-fs .deck-face {
  padding: 0;
}
.deck-overlay.page-fs .df-media.is-demo {
  min-height: 0;
  margin-bottom: 0;
  border: 0;
  border-radius: 0;
}
.deck-overlay.page-fs .dfm-bar {
  opacity: 1;
  pointer-events: auto;
}
.deck-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 28px;
  border-top: 1px solid var(--border);
  background: var(--card);
}
.deck-dots {
  display: flex;
  gap: 8px;
  margin: 0 auto;
}
.deck-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border2);
  transition: all 0.2s var(--ease);
  padding: 0;
}
.deck-dot.on {
  background: var(--primary);
  width: 22px;
  border-radius: 999px;
}
.deck-hint {
  font-size: 11.5px;
  color: var(--muted);
}
.deck-hint kbd {
  font-family: var(--font);
  background: var(--card2);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 0 5px;
  font-size: 11px;
}
@media (max-width: 860px) {
  .deck-face {
    padding: 18px 20px 22px;
  }
  .df-media.is-demo {
    min-height: 180px;
  }
  .df-title {
    font-size: 22px;
  }
  .deck-hint {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .deck-track,
  .deck-face,
  .dfm-bar {
    transition: none;
  }
}
</style>
