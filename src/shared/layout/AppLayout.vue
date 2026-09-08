<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import StorageBanner from '../StorageBanner.vue'

const route = useRoute()
const navOpen = ref(false)
const shell = ref<HTMLElement | null>(null)
let navTrigger: HTMLElement | null = null

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
  if (!showScrim.value || (event.target instanceof Element && event.target.closest('.el-overlay, .el-message-box__wrapper'))) return
  if (event.key === 'Escape') closeNav()
  if (event.key !== 'Tab') return
  const items = Array.from(shell.value?.querySelectorAll<HTMLElement>('.sidebar button:not([disabled]), .sidebar a[href]') ?? []).filter((el) => el.getClientRects().length > 0)
  const first = items[0]
  const last = items.at(-1)
  if (!first || !last) return
  if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus() }
}

const showScrim = computed(() => navOpen.value && isDrawer.value)
const sidebarHidden = computed(() => isDrawer.value && !navOpen.value)
watch(showScrim, async (open) => {
  if (open) navTrigger = document.activeElement as HTMLElement
  await nextTick()
  if (open) shell.value?.querySelector<HTMLElement>('.nav-item')?.focus()
  else navTrigger?.focus()
})

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
  <div
    ref="shell"
    class="app-shell"
  >
    <AppSidebar
      :open="navOpen"
      :hidden="sidebarHidden"
      @close="closeNav"
    />
    <div
      v-if="showScrim"
      class="scrim"
      @click="closeNav"
    />
    <div
      class="main-column"
      :inert="showScrim || undefined"
    >
      <StorageBanner />
      <AppTopbar
        :nav-open="navOpen"
        @toggle="navOpen = !navOpen"
      />
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
