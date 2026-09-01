import Dexie, { type Table } from 'dexie'
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
  }
}

/** 测试与多实例场景使用；生产代码使用下方单例。 */
export function createDb(name: string): JobConsoleDb {
  return new JobConsoleDb(name)
}

export const db = createDb('job-console')
