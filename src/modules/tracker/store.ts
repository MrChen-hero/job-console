import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type {
  Application,
  CompanyPoolEntry,
  InterviewRecord,
  Milestone,
  Stage,
} from '../../storage/types'
import { newId } from '../../storage/types'
import { STAGE_DONE } from './constants'

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 本地「今天」YYYY-MM-DD。不用 nowIso().slice(0,10)——那是 UTC，
 * 东八区 00:00–08:00 会把默认投递/阶段/重投日期记成前一天。
 */
function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * YYYY-MM-DD 且是真实存在的日期：挡掉「格式合规但日期不存在」的 2026-13-45。
 * 用 Date(y, m-1, d) 回读比对，全程本地时区，不受 UTC 偏移影响。
 */
function isValidIsoDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const probe = new Date(y, mo - 1, d)
  return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d
}

/** Pinia state 是响应式 Proxy；写库前转纯对象。 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export interface NewApplicationInput {
  company: string
  position: string
  batch: Application['batch']
  channel: string
  appliedAt: string
  location?: string
  url?: string
  jobDesc?: string
  track?: Application['track']
  nextStep?: string
  nextActionAt?: string
}

export const useTrackerStore = defineStore('tracker', {
  state: () => ({
    applications: [] as Application[],
    companyPool: [] as CompanyPoolEntry[],
    milestones: [] as Milestone[],
    loaded: false,
  }),

  actions: {
    async load() {
      const [applications, companyPool, milestones] = await Promise.all([
        db.applications.toArray(),
        db.companyPool.toArray(),
        db.milestones.toArray(),
      ])
      this.applications = applications.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
      this.companyPool = companyPool.sort((a, b) => a.company.localeCompare(b.company, 'zh'))
      this.milestones = milestones.sort((a, b) => a.date.localeCompare(b.date))
      this.loaded = true
    },

    find(id: string): Application | undefined {
      return this.applications.find((a) => a.id === id)
    },

    /** 在副本上编辑，写入失败时页面仍显示已保存的数据。 */
    draft(id: string): Application | undefined {
      const app = this.find(id)
      return app ? plain(app) : undefined
    },

    async persistApplication(app: Application) {
      const saved = plain({ ...app, updatedAt: nowIso() })
      await db.applications.put(saved)
      this.applications = [...this.applications.filter((a) => a.id !== saved.id), saved]
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
    },

    async addApplication(input: NewApplicationInput): Promise<Application> {
      const app: Application = {
        id: newId(),
        ...input,
        status: '已投递',
        stageHistory: [{ stage: '已投递', date: input.appliedAt || today() }],
        interviews: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      await this.persistApplication(app)
      return this.find(app.id)!
    },

    async updateApplication(id: string, patch: Partial<Omit<Application, 'id' | 'status' | 'stageHistory' | 'interviews' | 'createdAt'>>) {
      const app = this.draft(id)
      if (!app) return
      Object.assign(app, patch)
      await this.persistApplication(app)
    },

    async removeApplication(id: string) {
      await db.applications.delete(id)
      this.applications = this.applications.filter((app) => app.id !== id)
    },

    /** 状态机唯一写路径：不变量 status === stageHistory 末项 stage */
    async changeStage(id: string, stage: Stage, date?: string, note?: string) {
      const app = this.draft(id)
      if (!app) return
      app.stageHistory.push({ stage, date: date ?? today(), note })
      app.status = stage
      await this.persistApplication(app)
    },

    async advance(id: string) {
      const app = this.find(id)
      if (!app) return
      const index = STAGE_DONE.indexOf(app.status)
      if (index < 0 || index >= STAGE_DONE.length - 1) return
      await this.changeStage(id, STAGE_DONE[index + 1]!)
    },

    async markDropped(id: string, note?: string) {
      await this.changeStage(id, '挂', undefined, note)
    },

    /** 收藏切换：走 updateApplication，不经 changeStage，status 不变量不受影响 */
    async toggleStar(id: string) {
      const app = this.find(id)
      if (!app) return
      await this.updateApplication(id, { starred: !app.starred })
    },

    async reopen(id: string) {
      await this.changeStage(id, '已投递', today(), '重新投递')
    },

    async addInterview(id: string, input: Omit<InterviewRecord, 'id'>) {
      const app = this.draft(id)
      if (!app) return
      app.interviews.push({ ...input, id: newId() })
      await this.persistApplication(app)
    },

    async updateInterview(id: string, record: InterviewRecord) {
      const app = this.draft(id)
      if (!app) return
      const index = app.interviews.findIndex((iv) => iv.id === record.id)
      if (index < 0) return
      app.interviews[index] = { ...record }
      await this.persistApplication(app)
    },

    async removeInterview(id: string, interviewId: string) {
      const app = this.draft(id)
      if (!app) return
      app.interviews = app.interviews.filter((iv) => iv.id !== interviewId)
      await this.persistApplication(app)
    },

    /* ---------- 候选池 ---------- */

    async addPoolEntry(entry: Omit<CompanyPoolEntry, 'id' | 'createdAt'>): Promise<CompanyPoolEntry> {
      const row: CompanyPoolEntry = { ...entry, id: newId(), createdAt: nowIso() }
      await db.companyPool.put(plain(row))
      await this.load()
      return this.companyPool.find((x) => x.id === row.id)!
    },

    async updatePoolEntry(entry: CompanyPoolEntry) {
      await db.companyPool.put(plain({ ...entry }))
      await this.load()
    },

    async removePoolEntry(id: string) {
      await db.companyPool.delete(id)
      await this.load()
    },

    /** store 级直转 API（UI 走「转投递 → 预填对话框」链路，不经此方法）；供脚本化/测试场景使用。 */
    async convertToApplication(poolId: string, input: { position: string; appliedAt?: string; channel?: string }): Promise<Application> {
      const entry = this.companyPool.find((x) => x.id === poolId)
      if (!entry) throw new Error(`候选池条目不存在: ${poolId}`)
      return this.addApplication({
        company: entry.company,
        position: input.position,
        batch: '正式批',
        channel: input.channel ?? '官网',
        appliedAt: input.appliedAt ?? today(),
        location: entry.city,
        track: entry.track,
      })
    },

    /* ---------- 里程碑 ---------- */

    /** 非法日期直接拒绝落库（返回 undefined），避免脏数据把排序与倒计时算成 NaN */
    async addMilestone(date: string, label: string): Promise<Milestone | undefined> {
      if (!isValidIsoDate(date)) return undefined
      const row: Milestone = { id: newId(), date, label }
      await db.milestones.put(plain(row))
      await this.load()
      return row
    },

    async toggleMilestone(id: string) {
      const row = this.milestones.find((m) => m.id === id)
      if (!row) return
      const saved: Milestone = { ...row, done: row.done ? 0 : 1 }
      await db.milestones.put(plain(saved))
      this.milestones = this.milestones.map((m) => m.id === id ? saved : m)
    },

    async removeMilestone(id: string) {
      await db.milestones.delete(id)
      await this.load()
    },
  },
})
