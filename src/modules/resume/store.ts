import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type {
  AwardEntry,
  EducationEntry,
  ExperienceEntry,
  Profile,
  ProjectEntry,
  ResumeSection,
  ResumeVersion,
  SkillGroup,
} from '../../storage/types'
import { newId } from '../../storage/types'

const ACTIVE_KEY = 'jobconsole:active-version:v1'

/** 五类带 id 的资料池条目；basic/selfEvaluation 走专用 action。 */
export type EntryItem = EducationEntry | SkillGroup | ExperienceEntry | ProjectEntry | AwardEntry
export type EntrySection = 'education' | 'skills' | 'experiences' | 'projects' | 'awards'
export const ENTRY_SECTIONS: EntrySection[] = ['education', 'skills', 'experiences', 'projects', 'awards']

function nowIso(): string {
  return new Date().toISOString()
}

/** Pinia state 是响应式 Proxy；写库前转纯对象（IndexedDB 结构化克隆对 Proxy 不友好）。 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function defaultSections(): ResumeSection[] {
  return [
    { type: 'basic', title: '基本信息', order: 0 },
    { type: 'education', title: '教育背景', order: 1 },
    { type: 'skills', title: '专业技能', order: 2 },
    { type: 'experiences', title: '实习经历', order: 3 },
    { type: 'projects', title: '项目经历', order: 4 },
    { type: 'awards', title: '竞赛与荣誉', order: 5 },
    { type: 'selfEvaluation', title: '自我评价', order: 6 },
  ]
}

export const useResumeStore = defineStore('resume', {
  state: () => ({
    profile: null as Profile | null,
    versions: [] as ResumeVersion[],
    activeVersionId: '',
    loaded: false,
  }),

  getters: {
    activeVersion(state): ResumeVersion | undefined {
      return state.versions.find((v) => v.id === state.activeVersionId)
    },
  },

  actions: {
    async load() {
      const [profile, versions] = await Promise.all([db.profile.get('main'), db.resumeVersions.toArray()])
      this.profile = profile ?? null
      this.versions = versions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      try {
        this.activeVersionId = localStorage.getItem(ACTIVE_KEY) ?? ''
      } catch {
        this.activeVersionId = ''
      }
      if (!this.activeVersionId || !this.versions.some((v) => v.id === this.activeVersionId)) {
        this.setActive(this.versions[0]?.id ?? '')
      }
      this.loaded = true
    },

    async ensureProfile(name: string): Promise<Profile> {
      if (!this.profile) {
        const profile: Profile = {
          id: 'main',
          basic: { name },
          education: [],
          skills: [],
          experiences: [],
          projects: [],
          awards: [],
          selfEvaluation: [],
          updatedAt: nowIso(),
        }
        this.profile = profile
        await this.persistProfile()
      }
      return this.profile
    },

    async persistProfile() {
      if (!this.profile) return
      this.profile.updatedAt = nowIso()
      await db.profile.put(plain(this.profile))
    },

    async updateBasic(basic: Profile['basic']) {
      if (!this.profile) return
      this.profile.basic = { ...basic }
      await this.persistProfile()
    },

    async upsertEntry(section: EntrySection, entry: EntryItem) {
      if (!this.profile) return
      const list = this.profile[section] as Array<{ id: string }>
      const item = entry as { id: string }
      if (!item.id) {
        item.id = newId()
        list.push(item)
      } else {
        const index = list.findIndex((x) => x.id === item.id)
        if (index >= 0) list[index] = item
        else list.push(item)
      }
      await this.persistProfile()
    },

    async removeEntry(section: EntrySection, id: string) {
      if (!this.profile) return
      const list = this.profile[section] as Array<{ id: string }>
      const index = list.findIndex((x) => x.id === id)
      if (index < 0) return
      list.splice(index, 1)
      await this.persistProfile()
    },

    async moveEntry(section: EntrySection, id: string, dir: -1 | 1) {
      if (!this.profile) return
      const list = this.profile[section] as Array<{ id: string }>
      const index = list.findIndex((x) => x.id === id)
      const target = index + dir
      if (index < 0 || target < 0 || target >= list.length) return
      ;[list[index], list[target]] = [list[target]!, list[index]!]
      await this.persistProfile()
    },

    async setSelfEvaluation(items: string[]) {
      if (!this.profile) return
      this.profile.selfEvaluation = [...items]
      await this.persistProfile()
    },

    setActive(id: string) {
      this.activeVersionId = id
      try {
        localStorage.setItem(ACTIVE_KEY, id)
      } catch {
        /* 存储不可用时忽略 */
      }
    },

    async createVersion(name: string, targetRole: string): Promise<ResumeVersion> {
      const now = nowIso()
      const version: ResumeVersion = {
        id: newId(),
        name,
        targetRole,
        sections: defaultSections(),
        createdAt: now,
        updatedAt: now,
      }
      await db.resumeVersions.put(plain(version))
      await this.load()
      this.setActive(version.id)
      return version
    },

    async duplicateVersion(id: string): Promise<ResumeVersion | undefined> {
      const source = this.versions.find((v) => v.id === id)
      if (!source) return undefined
      const now = nowIso()
      // Pinia state 是响应式 Proxy，structuredClone 无法克隆；数据均为纯 JSON 值，用 JSON 深拷贝
      const copy: ResumeVersion = {
        ...(JSON.parse(JSON.stringify(source)) as ResumeVersion),
        id: newId(),
        name: `${source.name} 副本`,
        createdAt: now,
        updatedAt: now,
      }
      await db.resumeVersions.put(plain(copy))
      await this.load()
      this.setActive(copy.id)
      return copy
    },

    async renameVersion(id: string, name: string) {
      const version = this.versions.find((v) => v.id === id)
      if (!version) return
      version.name = name
      version.updatedAt = nowIso()
      await db.resumeVersions.put(plain(version))
      await this.load()
    },

    async updateSections(id: string, sections: ResumeSection[]) {
      const version = this.versions.find((v) => v.id === id)
      if (!version) return
      version.sections = sections
      version.updatedAt = nowIso()
      await db.resumeVersions.put(plain(version))
      await this.load()
    },

    async deleteVersion(id: string) {
      await db.resumeVersions.delete(id)
      await this.load()
      if (this.activeVersionId === id) {
        this.setActive(this.versions[0]?.id ?? '')
      }
    },
  },
})
