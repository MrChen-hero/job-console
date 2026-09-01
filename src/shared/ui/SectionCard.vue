<script setup lang="ts">
defineProps<{ title: string; sub?: string }>()
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div class="card-head-text">
        <h3 class="card-title">
          {{ title }}
        </h3>
        <p
          v-if="sub"
          class="card-sub"
        >
          {{ sub }}
        </p>
      </div>
      <div class="card-actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 17px 19px 0;
}
.card-head-text {
  min-width: 0;
}
.card-title {
  margin: 0;
  font-size: 14.5px;
  font-weight: var(--fw-bold);
}
.card-sub {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
</style>
