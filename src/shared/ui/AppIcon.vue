<script setup lang="ts">
import { computed } from 'vue'
import { ICONS } from './icons'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })

/** 未知图标名返回空数组：缺一个图标不应把整页打挂 */
const shape = computed(() => ICONS[props.name] ?? [])
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    aria-hidden="true"
    focusable="false"
  >
    <component
      :is="part.tag"
      v-for="(part, index) in shape"
      :key="index"
      v-bind="part.attrs"
    />
  </svg>
</template>

<style scoped>
.app-icon {
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* 实心图标（收藏态、拖拽手柄圆点）由使用方追加 .solid */
.app-icon.solid {
  fill: currentColor;
  stroke: none;
}
</style>
