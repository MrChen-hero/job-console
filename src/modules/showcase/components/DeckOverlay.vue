<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElButton } from 'element-plus'
import { demoUrl, useDemoStore } from '../demoStore'
import { useProjectStore, type MergedProject } from '../projectStore'
import { attachDemoPages, clampIndex, swipeIntent, type DeckPage } from '../deck'

const emit = defineEmits<{ close: [] }>()

const demoStore = useDemoStore()
const projectStore = useProjectStore()
const hIdx = ref(0)
const vIdx = ref(0)

/** 项目清单来自 projectStore（内置 ∪ 自建，已滤隐藏） */
const projects = computed<MergedProject[]>(() => projectStore.visible)
const pageCount = computed(() => projects.value.length)
/** 渲染用的收敛索引：打开 Deck 期间项目被删导致 hIdx 越界时不至于渲染空白 */
const safeIdx = computed(() => clampIndex(hIdx.value, pageCount.value))
const project = computed<MergedProject>(() => projects.value[safeIdx.value]!)
const pages = computed<DeckPage[]>(() => attachDemoPages(project.value, demoStore.merged))

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
  // 层级 = 主面 + pages（要点页 + 交互 demo 页），vIdx 0 为主面
  vIdx.value = clampIndex(vIdx.value + delta, pages.value.length + 1)
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowRight': event.preventDefault(); next(); break
    case 'ArrowLeft': event.preventDefault(); prev(); break
    case 'ArrowDown': event.preventDefault(); goVertical(1); break
    case 'ArrowUp': event.preventDefault(); goVertical(-1); break
    case 'Escape': emit('close'); break
  }
}

/* 拖拽翻页（横向主导 + 阈值，逻辑在 deck.ts 已单测） */
let sx = 0
let sy = 0
let pressing = false

function onPointerDown(event: PointerEvent) {
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
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

const demoUrlFor = demoUrl

const accentColor: Record<string, string> = {
  violet: 'var(--violet)',
  teal: 'var(--teal)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
}
const accentSoft: Record<string, string> = {
  violet: 'var(--violet-soft)',
  teal: 'var(--teal-soft)',
  amber: 'var(--amber-soft)',
  rose: 'var(--rose-soft)',
}
</script>

<template>
  <div
    class="deck-overlay"
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
          :class="{ vertical: vIdx > 0 && p.id === project.id }"
        >
          <div class="deck-viewport">
            <!-- 主面 -->
            <div
              class="deck-face"
              :class="{ on: !(p.id === project.id && vIdx > 0) }"
            >
              <span
                class="df-eyebrow"
                :style="{ color: accentColor[p.accent], background: accentSoft[p.accent] }"
              >{{ p.eyebrow }}</span>
              <div
                class="df-media"
                :style="{ background: `linear-gradient(135deg, ${accentSoft[p.accent]}, transparent), var(--card2)`, color: accentColor[p.accent] }"
              >
                <span class="dfm-label">演示媒体位 · public/media</span>
              </div>
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
              <p class="df-hint">
                ↓ 查看演示页（{{ pages.length }} 个）
              </p>
            </div>
            <!-- 纵向演示页 -->
            <template v-if="p.id === project.id">
              <div
                v-for="(page, pi) in pages"
                :key="pi"
                class="deck-face demo"
                :class="{ on: p.id === project.id && vIdx === pi + 1 }"
              >
                <template v-if="page.kind === 'points'">
                  <span class="df-eyebrow muted">DEMO PAGE · 纵向演示页</span>
                  <h3 class="df-demo-title">
                    {{ page.title }}
                  </h3>
                  <!-- v-html 安全：内容为本机个人数据或自写 markdown（信任来源，见 src/shared/markdown/render.ts 注释） -->
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <ul class="df-points">
                    <li
                      v-for="(pt, i) in page.points"
                      :key="i"
                      v-html="pt"
                    />
                  </ul>
                </template>
                <template v-else>
                  <span class="df-eyebrow muted">交互演示 · {{ page.title }}</span>
                  <iframe
                    class="df-iframe"
                    :src="demoUrlFor(page.html)"
                    sandbox="allow-scripts"
                    :title="page.title"
                  />
                </template>
              </div>
            </template>
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
  padding: 40px 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.35s var(--ease), transform 0.35s var(--ease);
  pointer-events: none;
  visibility: hidden;
}
.deck-face.on {
  opacity: 1;
  transform: none;
  pointer-events: auto;
  visibility: visible;
}
.deck-face.demo {
  background: var(--card2);
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
.df-eyebrow.muted {
  color: var(--muted);
  background: var(--card);
  border: 1px solid var(--border);
}
.df-media {
  height: 150px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}
.dfm-label {
  position: absolute;
  left: 14px;
  bottom: 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text2);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 9px;
}
.df-title {
  font-size: 34px;
  font-weight: var(--fw-bold);
  letter-spacing: -.02em;
  margin-bottom: 12px;
}
.df-summary {
  font-size: 14.5px;
  color: var(--text2);
  max-width: 640px;
  margin-bottom: 16px;
}
.df-stack {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.df-hint {
  margin-top: 18px;
  font-size: 12px;
  color: var(--muted);
}
.df-demo-title {
  font-size: 26px;
  font-weight: var(--fw-bold);
  letter-spacing: -.02em;
  margin-bottom: 14px;
}
.df-points {
  font-size: 14px;
  color: var(--text2);
  max-width: 640px;
}
.df-points li {
  margin-bottom: 10px;
}
.df-iframe {
  flex: 1;
  width: 100%;
  max-width: 860px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: #fff;
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
    padding: 26px;
  }
  .df-title {
    font-size: 26px;
  }
  .deck-hint {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .deck-track,
  .deck-face {
    transition: none;
  }
}
</style>
