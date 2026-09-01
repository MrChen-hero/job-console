<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from '../../app/stores/theme'
import AppIcon from '../ui/AppIcon.vue'

const emit = defineEmits<{ toggle: [] }>()

const route = useRoute()
const theme = useThemeStore()
const title = computed(() => (route.meta.title as string) ?? '')
const crumb = computed(() => (route.meta.crumb as string) ?? '')
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button
        class="icon-btn menu-btn"
        aria-label="打开导航"
        @click="emit('toggle')"
      >
        <AppIcon name="menu" />
      </button>
      <div class="page-heading">
        <div class="page-title">
          {{ title }}
        </div>
        <div class="page-crumb">
          {{ crumb }}
        </div>
      </div>
    </div>
    <div class="topbar-right">
      <button
        class="icon-btn theme-toggle"
        :aria-label="theme.dark ? '切换浅色主题' : '切换深色主题'"
        @click="theme.toggle()"
      >
        <AppIcon :name="theme.dark ? 'moon' : 'sun'" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  min-height: var(--topbar-h);
  /* 不透明底 + 无分隔线：对齐设计图，也省掉 backdrop-filter 的合成开销 */
  background: var(--bg);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 28px;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.page-heading {
  min-width: 0;
}
.page-title {
  font-size: 21px;
  font-weight: var(--fw-bold);
  letter-spacing: -0.01em;
}
.page-crumb {
  margin-top: 5px;
  font-size: 12.5px;
  color: var(--muted);
}
.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text2);
  transition: color 0.16s var(--ease), border-color 0.16s var(--ease);
}
.icon-btn:hover {
  color: var(--text);
  border-color: var(--border2);
}
/* 必须带 .icon-btn 前缀提升特异度：裸 .menu-btn 会被上面同特异度且靠后的
   .icon-btn { display: grid } 覆盖，桌面端会漏出汉堡按钮 */
.icon-btn.menu-btn {
  display: none;
}
@media (max-width: 1024px) {
  .icon-btn.menu-btn {
    display: grid;
    place-items: center;
  }
  .topbar {
    padding: 0 16px;
  }
}
</style>
