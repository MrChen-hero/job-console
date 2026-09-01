<script setup lang="ts">
import type { Stage } from '../../../storage/types'
import { STAGE_BADGE } from '../constants'
import '../badges.css'

defineProps<{ stage: Stage }>()
</script>

<template>
  <span
    class="stage-badge"
    :class="STAGE_BADGE[stage]"
  >
    <span class="dot" />{{ stage }}
  </span>
</template>
