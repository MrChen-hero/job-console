<script setup lang="ts">
import { computed } from 'vue'
import { useResumeStore } from '../store'
import type { ResumeSectionType } from '../../../storage/types'
import './sheet.css'

const store = useResumeStore()

const sortedSections = computed(() => {
  if (!store.activeVersion) return []
  return [...store.activeVersion.sections].sort((a, b) => a.order - b.order)
})

function excluded(sectionType: ResumeSectionType): Set<string> {
  return new Set(store.activeVersion?.sections.find((s) => s.type === sectionType)?.excludedIds ?? [])
}

function listFor<T extends { id: string }>(sectionType: ResumeSectionType, list: T[] | undefined): T[] {
  if (!list) return []
  const hidden = excluded(sectionType)
  return list.filter((item) => !hidden.has(item.id))
}

const contactLine = computed(() => {
  const b = store.profile?.basic
  if (!b) return ''
  return [b.phone, b.email, b.graduation].filter(Boolean).join(' · ')
})

const metaLine = computed(() => {
  const b = store.profile?.basic
  if (!b) return ''
  return [b.gender, b.degree, b.school].filter(Boolean).join(' · ')
})
</script>

<template>
  <div
    v-if="!store.profile || !store.activeVersion"
    class="sheet-empty"
  >
    <p>完善资料池并创建简历版本后，这里会实时渲染 A4 预览。</p>
  </div>
  <div
    v-else
    class="sheet"
    data-testid="resume-sheet"
  >
    <!-- 基本信息 -->
    <div
      v-if="!excluded('basic').has('main')"
      class="r-head"
    >
      <div>
        <div class="r-name">
          {{ store.profile.basic.name }}
        </div>
        <div class="r-meta">
          {{ metaLine }}
        </div>
      </div>
      <div class="r-contact">
        <div>{{ store.activeVersion.targetRole }}</div>
        <div>{{ contactLine }}</div>
      </div>
    </div>

    <template
      v-for="section in sortedSections"
      :key="section.type"
    >
      <!-- 教育 -->
      <div
        v-if="section.type === 'education'"
        class="r-section"
      >
        <div class="r-sec-title">
          {{ section.title }}<em>EDUCATION</em>
        </div>
        <div
          v-for="e in listFor('education', store.profile.education)"
          :key="e.id"
          class="r-item"
        >
          <div class="r-edu">
            <b>{{ e.school }} · {{ e.degree }}</b><span class="r-time">{{ e.time }}</span>
          </div>
          <div
            v-if="e.courses"
            class="r-courses"
          >
            {{ e.courses }}
          </div>
        </div>
      </div>

      <!-- 技能 -->
      <div
        v-else-if="section.type === 'skills'"
        class="r-section"
      >
        <div class="r-sec-title">
          {{ section.title }}<em>SKILLS</em>
        </div>
        <div class="r-skills">
          <template
            v-for="s in listFor('skills', store.profile.skills)"
            :key="s.id"
          >
            <b>{{ s.group }}</b><span>{{ s.detail }}</span>
          </template>
        </div>
      </div>

      <!-- 实习 -->
      <div
        v-else-if="section.type === 'experiences'"
        class="r-section"
      >
        <div class="r-sec-title">
          {{ section.title }}<em>INTERNSHIP</em>
        </div>
        <div
          v-for="x in listFor('experiences', store.profile.experiences)"
          :key="x.id"
          class="r-item"
        >
          <div class="r-item-hd">
            <b>{{ x.org }}</b>
            <span class="r-role">{{ x.role }}</span>
            <span class="r-time">{{ x.time }}</span>
          </div>
          <div
            v-if="x.stack"
            class="r-stack"
          >
            技术栈：{{ x.stack }}
          </div>
          <ul>
            <li
              v-for="(b, i) in x.bullets"
              :key="i"
            >
              {{ b }}
            </li>
          </ul>
        </div>
      </div>

      <!-- 项目 -->
      <div
        v-else-if="section.type === 'projects'"
        class="r-section"
      >
        <div class="r-sec-title">
          {{ section.title }}<em>PROJECTS</em>
        </div>
        <div
          v-for="p in listFor('projects', store.profile.projects)"
          :key="p.id"
          class="r-item"
        >
          <div class="r-item-hd">
            <b>{{ p.name }}</b>
            <span class="r-role">{{ p.role }}</span>
            <span class="r-time">{{ p.time }}</span>
          </div>
          <div
            v-if="p.stack"
            class="r-stack"
          >
            技术栈：{{ p.stack }}
          </div>
          <ul>
            <li
              v-for="(b, i) in p.bullets"
              :key="i"
            >
              {{ b }}
            </li>
          </ul>
        </div>
      </div>

      <!-- 荣誉 -->
      <div
        v-else-if="section.type === 'awards'"
        class="r-section"
      >
        <div class="r-sec-title">
          {{ section.title }}<em>HONORS</em>
        </div>
        <ul class="r-list">
          <li
            v-for="a in listFor('awards', store.profile.awards)"
            :key="a.id"
          >
            {{ a.text }}
          </li>
        </ul>
      </div>

      <!-- 自评 -->
      <div
        v-else-if="section.type === 'selfEvaluation'"
        class="r-section"
      >
        <div class="r-sec-title">
          {{ section.title }}<em>SUMMARY</em>
        </div>
        <ul class="r-list">
          <li
            v-for="(s, i) in store.profile.selfEvaluation"
            :key="i"
          >
            {{ s }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sheet-empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 60px 20px;
  border: 1px dashed var(--border);
  border-radius: var(--r-md);
}
</style>
