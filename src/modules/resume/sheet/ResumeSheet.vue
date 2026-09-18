<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResumeStore } from '../store'
import { buildBlocks } from './blocks'
import { paginate } from './paginate'
import SheetBlock from './SheetBlock.vue'
import './sheet.css'

const store = useResumeStore()

const blocks = computed(() => buildBlocks(store.profile, store.activeVersion))

/* 测量 → 分页 → 渲染。测量容器渲染全部块（隐藏、不可见但参与布局），
   每页只渲染分到自己名下的块，两者共用 SheetBlock，量的就是画的。 */
const measureEl = ref<HTMLElement | null>(null)
const probeEl = ref<HTMLElement | null>(null)
const heights = ref<Record<string, number>>({})
const pageHeight = ref(0)
let observer: ResizeObserver | null = null

const pages = computed(() => paginate(blocks.value, heights.value, pageHeight.value))

/**
 * 高度按「相邻块 offsetTop 差值」取，最后一块用容器高度收尾——这样块间外边距
 * （含折叠后的实际值）自然算进上一块，比逐块 offsetHeight + margin 准确。
 * 用 offsetTop/offsetHeight 而非 getBoundingClientRect：预览区带 scale 变换，
 * rect 会被缩放，offset 系列是布局值不受影响。
 */
function measure(): void {
  const el = measureEl.value
  if (!el) return
  const measuredHeight = probeEl.value?.offsetHeight ?? 0
  // 隐藏/卸载期间的零尺寸不是新的纸面几何，不能冲掉已测分页。
  if (!(measuredHeight > 0)) return
  pageHeight.value = measuredHeight
  const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-block-id]'))
  const total = el.offsetHeight
  const next: Record<string, number> = {}
  nodes.forEach((node, i) => {
    const id = node.dataset.blockId
    if (!id) return
    const bottom = i + 1 < nodes.length ? nodes[i + 1]!.offsetTop : total
    next[id] = Math.max(0, bottom - node.offsetTop)
  })
  heights.value = next
}

onMounted(() => {
  measure()
  // jsdom 没有 ResizeObserver / document.fonts，缺了就只做一次同步测量
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    if (measureEl.value) observer.observe(measureEl.value)
  }
  void document.fonts?.ready.then(measure)
})

watch(blocks, async () => {
  await nextTick()
  measure()
})

watch(measureEl, (el) => {
  if (!observer) return
  observer.disconnect()
  if (el) observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div
    v-if="!store.profile || !store.activeVersion"
    class="sheet-empty"
  >
    <p>完善资料池并创建简历版本后，这里会实时渲染 A4 预览。</p>
  </div>
  <template v-else>
    <div
      class="sheet-stack"
      data-testid="resume-sheet"
    >
      <template
        v-for="(page, index) in pages"
        :key="index"
      >
        <div class="sheet sheet-page">
          <SheetBlock
            v-for="block in page"
            :key="block.id"
            :block="block"
          />
        </div>
        <p class="sheet-page-label no-print mono">
          第 {{ index + 1 }} / {{ pages.length }} 页
        </p>
      </template>
    </div>

    <!-- 脱离窄屏编辑态的 display:none 与预览缩放，打印前也能测到完整内容。 -->
    <Teleport to="body">
      <div
        class="sheet-measure-wrap"
        aria-hidden="true"
      >
        <div class="sheet sheet-measure">
          <div
            ref="measureEl"
            class="sheet-measure-inner"
          >
            <SheetBlock
              v-for="block in blocks"
              :key="block.id"
              :data-block-id="block.id"
              :block="block"
            />
          </div>
        </div>
        <div
          ref="probeEl"
          class="sheet-probe"
        />
      </div>
    </Teleport>
  </template>
</template>

<style scoped>
.sheet-empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 60px 20px;
  border: 1px dashed var(--border);
  border-radius: var(--r-md);
}
</style>
