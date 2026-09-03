import Dexie, { type Table } from 'dexie'
import { LEGACY_TRACKS } from './types'
import type {
  Application,
  CompanyPoolEntry,
  DeletedDocRow,
  LibraryCategoryRow,
  LibraryDoc,
  Milestone,
  Profile,
  ResumeVersion,
  RuntimeDemo,
  RuntimeProject,
} from './types'

export interface SnapshotRow {
  id?: number
  createdAt: string
  label: string
  /** JSON 序列化的 BackupData */
  data: string
}

export class JobConsoleDb extends Dexie {
  profile!: Table<Profile, string>
  resumeVersions!: Table<ResumeVersion, string>
  applications!: Table<Application, string>
  companyPool!: Table<CompanyPoolEntry, string>
  libraryDocs!: Table<LibraryDoc, string>
  libraryCategories!: Table<LibraryCategoryRow, string>
  deletedDocs!: Table<DeletedDocRow, string>
  milestones!: Table<Milestone, string>
  runtimeDemos!: Table<RuntimeDemo, string>
  runtimeProjects!: Table<RuntimeProject, string>
  snapshots!: Table<SnapshotRow, number>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      profile: 'id',
      resumeVersions: 'id, updatedAt',
      applications: 'id, status, appliedAt, nextActionAt',
      companyPool: 'id, track',
      libraryDocs: 'id, category, updatedAt',
      milestones: 'id, date',
      snapshots: '++id, createdAt',
    })
    this.version(2)
      .stores({
        runtimeDemos: 'id, projectId, updatedAt',
      })
      .upgrade(() => {
        /* v2 仅新增表，无数据迁移 */
      })
    this.version(3)
      .stores({
        libraryCategories: 'name',
        runtimeProjects: 'id, updatedAt',
      })
      .upgrade(() => {
        /* v3 仅新增表，无数据迁移 */
      })
    this.version(4)
      .stores({
        deletedDocs: 'id',
      })
      .upgrade(async (tx) => {
        /* v4：资料池从全局唯一 'main' 改为按版本独立（Profile.id = versionId）；
           deletedDocs 新表无需迁移。 */
        const profile = await tx.table('profile').get('main')
        if (!profile) return
        const versions = await tx.table('resumeVersions').toArray()
        if (versions.length === 0) {
          // 无版本时造一个默认版本承接资料，避免数据悬空
          const now = new Date().toISOString()
          const id = crypto.randomUUID()
          await tx.table('resumeVersions').put({
            id,
            name: '默认版本',
            targetRole: '',
            sections: [
              { type: 'basic', title: '基本信息', order: 0 },
              { type: 'education', title: '教育背景', order: 1 },
              { type: 'skills', title: '专业技能', order: 2 },
              { type: 'experiences', title: '实习经历', order: 3 },
              { type: 'projects', title: '项目经历', order: 4 },
              { type: 'awards', title: '竞赛与荣誉', order: 5 },
              { type: 'selfEvaluation', title: '自我评价', order: 6 },
            ],
            createdAt: now,
            updatedAt: now,
          })
          await tx.table('profile').put({ ...profile, id })
        } else {
          for (const v of versions) {
            await tx.table('profile').put({ ...profile, id: v.id })
          }
        }
        await tx.table('profile').delete('main')
      })
    this.version(5).upgrade(async (tx) => {
      /* v5：内置分类「八股」更名为「八股面经」。内置分类名是编译期常量，
         改名后库里遗留的 category 字符串会指向不存在的分类（文档只剩「全部」可见），
         故把文档归属与内置覆盖行一并迁移。 */
      const FROM = '八股'
      const TO = '八股面经'
      await tx.table('libraryDocs').where('category').equals(FROM).modify({ category: TO })
      const legacy = await tx.table('libraryCategories').get(FROM)
      // 目标名已被自定义分类占用时不迁移覆盖行，避免主键冲突覆盖用户数据
      if (legacy?.builtin && !(await tx.table('libraryCategories').get(TO))) {
        await tx.table('libraryCategories').delete(FROM)
        await tx.table('libraryCategories').put({ ...legacy, name: TO })
      }
    })
    this.version(6).upgrade(async (tx) => {
      /* v6：投向由「主投/保底/机会型」改为四档（见 LEGACY_TRACKS）。同 v5 的道理，
         库里遗留的旧投向名会指向不存在的投向，故把投递与候选池两表一并改写。
         applications.track 未建索引，用 toCollection().modify 全表过一遍。 */
      const remap = (row: { track?: string }) => {
        const next = row.track ? LEGACY_TRACKS[row.track] : undefined
        if (next) row.track = next
      }
      await tx.table('applications').toCollection().modify(remap)
      await tx.table('companyPool').toCollection().modify(remap)
    })
  }
}

/** 测试与多实例场景使用；生产代码使用下方单例。 */
export function createDb(name: string): JobConsoleDb {
  return new JobConsoleDb(name)
}

export const db = createDb('job-console')
