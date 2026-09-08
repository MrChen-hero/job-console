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

/**
 * 资料池按版本独立（v4 起 Profile.id = versionId）：
 * state.profile 始终是当前激活版本的资料池；切换版本时随 setActive 换载。
 */
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
      const versions = await db.resumeVersions.toArray()
      let activeId = ''
      try {
        activeId = localStorage.getItem(ACTIVE_KEY) ?? ''
      } catch {
        /* 当前浏览器可能禁用了 localStorage。 */
      }
      versions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      if (!versions.some((v) => v.id === activeId)) activeId = versions[0]?.id ?? ''
      const profile = activeId ? ((await db.profile.get(activeId)) ?? null) : null
      this.versions = versions
      this.activate(activeId, profile)
      this.loaded = true
    },

    activate(id: string, profile: Profile | null) {
      this.activeVersionId = id
      this.profile = profile
      try {
        localStorage.setItem(ACTIVE_KEY, id)
      } catch {
        /* 存储不可用时忽略 */
      }
    },

    /** 读取成功后才切换版本，失败时保留原版本与资料。 */
    async setActive(id: string) {
      const profile = id ? ((await db.profile.get(id)) ?? null) : null
      this.activate(id, profile)
    },

    /** 确保当前版本有资料池；无版本时先建一个默认版本承接（资料池必须挂在版本上） */
    async ensureProfile(name: string): Promise<Profile> {
      if (!this.activeVersionId) {
        await this.createVersion('默认版本', '')
      }
      if (!this.profile) {
        const profile: Profile = {
          id: this.activeVersionId,
          basic: { name },
          education: [],
          skills: [],
          experiences: [],
          projects: [],
          awards: [],
          selfEvaluation: [],
          updatedAt: nowIso(),
        }
        await this.persistProfile(profile)
      }
      return this.profile!
    },

    async persistProfile(input?: Profile) {
      const profile = input ?? this.profile
      if (!profile) return
      const saved = plain({ ...profile, updatedAt: nowIso() })
      await db.profile.put(saved)
      if (this.activeVersionId === saved.id) this.profile = saved
    },

    async updateBasic(basic: Profile['basic']) {
      if (!this.profile) return
      await this.persistProfile({ ...this.profile, basic: { ...basic } })
    },

    /** 离开前同时保存基本信息和自评，避免一部分成功、一部分失败。 */
    async saveText(basic: Profile['basic'], selfEvaluation: string[]) {
      if (!this.profile) return
      await this.persistProfile({ ...this.profile, basic, selfEvaluation })
    },

    async upsertEntry(section: EntrySection, entry: EntryItem) {
      if (!this.profile) return
      const draft = plain(this.profile)
      const list = draft[section] as EntryItem[]
      const item = plain({ ...entry, id: entry.id || newId() })
      const index = list.findIndex((x) => x.id === item.id)
      if (index >= 0) list[index] = item
      else list.push(item)
      await this.persistProfile(draft)
    },

    async removeEntry(section: EntrySection, id: string) {
      if (!this.profile) return
      const draft = plain(this.profile)
      const list = draft[section] as Array<{ id: string }>
      const index = list.findIndex((x) => x.id === id)
      if (index < 0) return
      list.splice(index, 1)
      await this.persistProfile(draft)
    },

    async moveEntry(section: EntrySection, id: string, dir: -1 | 1) {
      if (!this.profile) return
      const draft = plain(this.profile)
      const list = draft[section] as Array<{ id: string }>
      const index = list.findIndex((x) => x.id === id)
      const target = index + dir
      if (index < 0 || target < 0 || target >= list.length) return
      ;[list[index], list[target]] = [list[target]!, list[index]!]
      await this.persistProfile(draft)
    },

    async setSelfEvaluation(items: string[]) {
      if (!this.profile) return
      await this.persistProfile({ ...this.profile, selfEvaluation: [...items] })
    },

    /** 新建版本：以当前资料池为起点复制一份（此后各自独立），并激活新版本 */
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
      const profile = this.profile ? plain({ ...this.profile, id: version.id, updatedAt: now }) : null
      await db.transaction('rw', db.resumeVersions, db.profile, async () => {
        await db.resumeVersions.put(plain(version))
        if (profile) await db.profile.put(profile)
      })
      this.versions = [version, ...this.versions]
      this.activate(version.id, profile)
      return version
    },

    /** 复制版本：区块与资料池一并复制，从此互不影响 */
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
      const profile = await db.transaction('rw', db.resumeVersions, db.profile, async () => {
        const sourceProfile = await db.profile.get(id)
        const cloned = sourceProfile ? plain({ ...sourceProfile, id: copy.id, updatedAt: now }) : null
        await db.resumeVersions.put(plain(copy))
        if (cloned) await db.profile.put(cloned)
        return cloned
      })
      this.versions = [copy, ...this.versions]
      this.activate(copy.id, profile)
      return copy
    },

    async renameVersion(id: string, name: string) {
      const version = this.versions.find((v) => v.id === id)
      if (!version) return
      const saved = plain({ ...version, name, updatedAt: nowIso() })
      await db.resumeVersions.put(saved)
      this.versions = this.versions.map((v) => v.id === id ? saved : v).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async updateSections(id: string, sections: ResumeSection[]) {
      const version = this.versions.find((v) => v.id === id)
      if (!version) return
      const saved = plain({ ...version, sections, updatedAt: nowIso() })
      await db.resumeVersions.put(saved)
      this.versions = this.versions.map((v) => v.id === id ? saved : v).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    /** 删除版本：其资料池一并删除（各版本资料池独立，删除即彻底清理） */
    async deleteVersion(id: string) {
      const versions = this.versions.filter((v) => v.id !== id)
      const nextId = this.activeVersionId === id ? (versions[0]?.id ?? '') : this.activeVersionId
      const profile = await db.transaction('rw', db.resumeVersions, db.profile, async () => {
        await db.resumeVersions.delete(id)
        await db.profile.delete(id)
        return nextId ? ((await db.profile.get(nextId)) ?? null) : null
      })
      this.versions = versions
      this.activate(nextId, profile)
    },
  },
})
