<script setup lang="ts">
import { cropStyle } from '../components/avatarCrop'
import type { SheetBlock } from './blocks'

/** 单块渲染。测量容器与每一页共用本组件，保证「量的就是画的」。 */
defineProps<{ block: SheetBlock }>()
</script>

<template>
  <div
    v-if="block.kind === 'head'"
    class="r-head"
  >
    <div>
      <div class="r-name">
        {{ block.name }}
      </div>
      <div class="r-meta">
        {{ block.meta }}
      </div>
    </div>
    <div class="r-contact">
      <div>{{ block.targetRole }}</div>
      <div>{{ block.contact }}</div>
    </div>
    <div
      v-if="block.avatar"
      class="r-photo"
    >
      <img
        :src="block.avatar"
        :style="cropStyle(block.avatarCrop)"
        alt="证件照"
      >
    </div>
  </div>

  <div
    v-else-if="block.kind === 'title'"
    class="r-sec-title"
  >
    {{ block.title }}<em v-if="block.subtitle">{{ block.subtitle }}</em>
  </div>

  <div
    v-else-if="block.kind === 'edu'"
    class="r-item"
  >
    <div class="r-edu">
      <b>{{ block.entry.school }} · {{ block.entry.degree }}</b><span class="r-time">{{ block.entry.time }}</span>
    </div>
    <div
      v-if="block.entry.courses"
      class="r-courses"
    >
      {{ block.entry.courses }}
    </div>
  </div>

  <div
    v-else-if="block.kind === 'skill'"
    class="r-skill-row"
  >
    <b>{{ block.entry.group }}</b><span>{{ block.entry.detail }}</span>
  </div>

  <div
    v-else-if="block.kind === 'exp'"
    class="r-item"
  >
    <div class="r-item-hd">
      <b>{{ block.entry.org }}</b>
      <span class="r-role">{{ block.entry.role }}</span>
      <span class="r-time">{{ block.entry.time }}</span>
    </div>
    <div
      v-if="block.entry.stack"
      class="r-stack"
    >
      技术栈：{{ block.entry.stack }}
    </div>
    <ul>
      <li
        v-for="(b, i) in block.entry.bullets"
        :key="i"
      >
        {{ b }}
      </li>
    </ul>
  </div>

  <div
    v-else-if="block.kind === 'proj'"
    class="r-item"
  >
    <div class="r-item-hd">
      <b>{{ block.entry.name }}</b>
      <span class="r-role">{{ block.entry.role }}</span>
      <span class="r-time">{{ block.entry.time }}</span>
    </div>
    <div
      v-if="block.entry.stack"
      class="r-stack"
    >
      技术栈：{{ block.entry.stack }}
    </div>
    <ul>
      <li
        v-for="(b, i) in block.entry.bullets"
        :key="i"
      >
        {{ b }}
      </li>
    </ul>
  </div>

  <!-- v-else 而非 v-else-if：分支链必须保证任何 kind 都有一个根节点，否则透传属性会丢 -->
  <ul
    v-else
    class="r-list"
  >
    <li>{{ block.text }}</li>
  </ul>
</template>
