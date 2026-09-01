<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ values: number[]; height?: number }>(), { height: 40 })

/* 视口盒固定 100×32，靠 preserveAspectRatio="none" 横向铺满容器；
   描边加 vector-effect="non-scaling-stroke"，否则横向拉伸会把线拉粗。 */
const W = 100
const H = 32
const PAD = 2

const points = computed<[number, number][]>(() => {
  const values = props.values
  if (values.length === 0) return []
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min
  // 常量序列落在中线；单点序列画成贯穿的横线，避免只画出一个不可见的 M 点
  const y = (value: number) => (span === 0 ? H / 2 : H - PAD - ((value - min) / span) * (H - PAD * 2))
  if (values.length === 1) return [[0, y(values[0]!)], [W, y(values[0]!)]]
  return values.map((value, index) => [(index * W) / (values.length - 1), y(value)])
})

const line = computed(() =>
  points.value.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),
)
const area = computed(() => (line.value ? `${line.value} L${W} ${H} L0 ${H}Z` : ''))
</script>

<template>
  <svg
    class="spark"
    :viewBox="`0 0 ${W} ${H}`"
    :style="{ height: `${height}px` }"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-if="area"
      class="spark-area"
      :d="area"
    />
    <path
      v-if="line"
      class="spark-line"
      :d="line"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.spark {
  display: block;
  width: 100%;
}
.spark-area {
  fill: var(--primary-soft);
  stroke: none;
}
.spark-line {
  fill: none;
  stroke: var(--primary);
  stroke-width: 1.6;
  stroke-linejoin: round;
}
</style>
