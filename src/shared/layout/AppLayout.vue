<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import StorageBanner from '../StorageBanner.vue'

const route = useRoute()
const navOpen = ref(false)

/* 是否处于抽屉模式（≤1024）。jsdom 没有 window.matchMedia，探测不到时降级为
   抽屉模式：这样 inert / aria-hidden 在单测里成对可断言。桌面模式下这两个属性
   绝不能出现，否则键盘无法进入导航。 */
const drawerQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 1024px)')
  : null
const isDrawer = ref(drawerQuery ? drawerQuery.matches : true)

function onDrawerModeChange(event: MediaQueryListEvent): void {
  isDrawer.value = event.matches
  if (!event.matches) navOpen.value = false
}

function closeNav(): void {
  navOpen.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeNav()
}

const showScrim = computed(() => navOpen.value && isDrawer.value)
const sidebarHidden = computed(() => isDrawer.value && !navOpen.value)

watch(() => route.fullPath, closeNav)

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  drawerQuery?.addEventListener('change', onDrawerModeChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  drawerQuery?.removeEventListener('change', onDrawerModeChange)
})
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :open="navOpen"
      :hidden="sidebarHidden"
    />
    <div
      v-if="showScrim"
      class="scrim"
      @click="closeNav"
    />
    <div class="main-column">
      <StorageBanner />
      <AppTopbar @toggle="navOpen = !navOpen" />
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.main-column {
  flex: 1;
  margin-left: var(--sidebar-w);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100vh;
}
.content {
  flex: 1;
  padding: 4px 28px 44px;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 35;
  background: rgba(23, 32, 51, 0.3);
}
@media (max-width: 1024px) {
  .main-column {
    margin-left: 0;
  }
}
@media (max-width: 720px) {
  .content {
    padding: 4px 16px 32px;
  }
}
</style>
