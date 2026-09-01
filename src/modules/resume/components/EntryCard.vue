<script setup lang="ts">
import AppIcon from '../../../shared/ui/AppIcon.vue'

defineProps<{
  title: string
  subtitle?: string
  first?: boolean
  last?: boolean
}>()

const emit = defineEmits<{
  edit: []
  remove: []
  'move-up': []
  'move-down': []
}>()
</script>

<template>
  <div class="entry-card">
    <AppIcon
      name="grip"
      :size="15"
      class="entry-grip"
    />
    <div class="entry-info">
      <b class="entry-title">{{ title }}</b>
      <span
        v-if="subtitle"
        class="entry-subtitle"
      >{{ subtitle }}</span>
    </div>
    <div class="entry-actions">
      <button
        type="button"
        class="entry-ic"
        :disabled="first"
        aria-label="上移"
        @click="emit('move-up')"
      >
        <AppIcon
          name="chev"
          :size="14"
          class="ic-up"
        />
      </button>
      <button
        type="button"
        class="entry-ic"
        :disabled="last"
        aria-label="下移"
        @click="emit('move-down')"
      >
        <AppIcon
          name="chev"
          :size="14"
          class="ic-down"
        />
      </button>
      <button
        type="button"
        class="entry-ic"
        aria-label="编辑"
        @click="emit('edit')"
      >
        <AppIcon
          name="edit"
          :size="14"
        />
      </button>
      <button
        type="button"
        class="entry-ic entry-delete"
        aria-label="删除"
        @click="emit('remove')"
      >
        <AppIcon
          name="trash"
          :size="14"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.entry-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 38px);
  min-height: 46px;
  margin: 0 19px;
  padding: 6px 10px 6px 8px;
  border-radius: var(--r-sm);
  color: var(--text);
  transition: background .16s;
}
.entry-card:hover {
  background: var(--card2);
}
.entry-grip {
  flex-shrink: 0;
  color: var(--muted);
}
.entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.entry-title {
  font-size: 13px;
  font-weight: var(--fw-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-subtitle {
  font-size: 11.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-actions {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
}
.entry-ic {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: none;
  color: var(--muted);
  transition: color .16s, background .16s, border-color .16s;
}
.entry-ic:hover:not(:disabled) {
  color: var(--primary-text);
  background: var(--primary-soft);
  border-color: var(--primary-border);
}
.entry-ic:disabled {
  opacity: .35;
  cursor: not-allowed;
}
.entry-delete:hover:not(:disabled) {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: var(--danger-border);
}
.ic-up {
  transform: rotate(-90deg);
}
.ic-down {
  transform: rotate(90deg);
}
</style>
