import { onBeforeUnmount, onMounted, ref } from 'vue'

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 午夜刷新；从后台返回时再校准，避免浏览器暂停计时器后日期过时。 */
export function useLocalDate() {
  const today = ref(formatDate(new Date()))
  let timer: ReturnType<typeof setTimeout> | undefined
  function refresh() {
    const now = new Date()
    today.value = formatDate(now)
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    clearTimeout(timer)
    timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 20)
  }
  onMounted(() => {
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  })
  return today
}
