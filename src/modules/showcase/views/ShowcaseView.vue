<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { SHOWCASE_PROJECTS } from '../../../config/showcase.config'
import { useDemoStore, type MergedDemo } from '../demoStore'
import DeckOverlay from '../components/DeckOverlay.vue'
import DemoUploadDialog from '../components/DemoUploadDialog.vue'

const demoStore = useDemoStore()
const deckOpen = ref(false)
const deckStart = ref(0)
const uploadOpen = ref(false)
const preparing = ref(true)

onMounted(async () => {
  await demoStore.load()
  preparing.value = false
})

function openDeck(index: number) {
  deckStart.value = index
  deckOpen.value = true
}

async function removeDemo(demo: MergedDemo) {
  if (demo.source !== 'runtime') return
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
    <div class="showcase-hero">
      <h1 class="hero-title">
        把项目讲成一个可以翻页的故事
      </h1>
      <p class="hero-sub">
        对外展示的门户站点：主页介绍 + 双轴幻灯片演示（横向翻项目、纵向看演示页）。个人信息自动取自简历模块，项目内容独立配置。
      </p>
      <div class="hero-actions">
        <ElButton
          type="primary"
          size="large"
          class="deck-open"
          @click="openDeck(0)"
        >
          ▶ 进入项目演示
        </ElButton>
        <ElButton
          size="large"
          class="upload-open"
          @click="uploadOpen = !uploadOpen"
        >
          ⬆ 上传交互演示
        </ElButton>
      </div>
    </div>

    <DemoUploadDialog v-model="uploadOpen" />

    <!-- 交互演示清单（含删除） -->
    <div
      v-if="demoStore.merged.length > 0"
      class="demo-list"
      data-testid="demo-list"
    >
      <div class="demo-list-head">
        <h3>交互演示页</h3>
        <span class="demo-list-sub">在 Deck 纵向页中查看；沙箱 iframe 渲染</span>
      </div>
      <div
        v-for="demo in demoStore.merged"
        :key="demo.id"
        class="demo-row"
      >
        <span class="demo-title">{{ demo.title }}</span>
        <span class="demo-proj">{{ SHOWCASE_PROJECTS.find((p) => p.id === demo.projectId)?.title ?? demo.projectId }}</span>
        <span
          class="src-tag"
          :class="demo.source"
        >{{ demo.source === 'local' ? '内置' : '我的' }}</span>
        <span class="demo-actions">
          <ElButton
            size="small"
            text
            @click="openDeck(SHOWCASE_PROJECTS.findIndex((p) => p.id === demo.projectId))"
          >查看</ElButton>
          <ElButton
            v-if="demo.source === 'runtime'"
            size="small"
            text
            type="danger"
            class="demo-remove"
            @click="removeDemo(demo)"
          >删除</ElButton>
        </span>
      </div>
    </div>

    <div class="proj-grid">
      <div
        v-for="(p, i) in SHOWCASE_PROJECTS"
        :key="p.id"
        class="card proj"
        role="button"
        tabindex="0"
        @click="openDeck(i)"
        @keydown.enter.prevent="openDeck(i)"
      >
        <div class="proj-top">
          <b class="proj-name">{{ p.title }}</b>
          <span
            class="src-tag"
            :class="p.stack.length ? 'badge-style' : ''"
          >{{ p.eyebrow }}</span>
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
          <span>点击进入演示</span>
          <span>→</span>
        </div>
      </div>
    </div>

    <DeckOverlay
      v-if="deckOpen"
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
/* 顶部 3px 色条按顺序轮转，给每个项目一个稳定的识别色 */
.proj::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--info-vivid);
}
.proj:nth-child(4n + 2)::before {
  background: var(--success-vivid);
}
.proj:nth-child(4n + 3)::before {
  background: var(--violet-vivid);
}
.proj:nth-child(4n + 4)::before {
  background: var(--warn-vivid);
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
