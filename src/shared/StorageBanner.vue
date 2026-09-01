<script setup lang="ts">
import { onMounted, ref } from 'vue'

const unavailable = ref(false)

onMounted(async () => {
  try {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
      unavailable.value = true
      return
    }
    // 探针库：隐私模式（如 Safari 无痕）可能允许引用但拒绝打开
    await new Promise<void>((resolve, reject) => {
      const probe = indexedDB.open('jobconsole-probe', 1)
      probe.onsuccess = () => {
        probe.result.close()
        void indexedDB.deleteDatabase('jobconsole-probe')
        resolve()
      }
      probe.onerror = () => reject(new Error('indexeddb unavailable'))
      probe.onblocked = () => reject(new Error('indexeddb blocked'))
    })
  } catch {
    unavailable.value = true
  }
})
</script>

<template>
  <div
    v-if="unavailable"
    class="storage-banner"
    role="alert"
  >
    ⚠️ 浏览器存储（IndexedDB）不可用：当前处于隐私模式或存储被禁用。页面可以浏览，但保存的数据会在关闭后丢失——请换用普通窗口使用。
  </div>
</template>

<style scoped>
.storage-banner {
  background: var(--warn-soft);
  color: var(--warn);
  border-bottom: 1px solid var(--warn-border);
  font-size: 12.5px;
  padding: 8px 28px;
}
@media (max-width: 860px) {
  .storage-banner {
    padding: 8px 16px;
  }
}
</style>
