import Dexie, { type Table } from 'dexie'
import type {
  Application,
  CompanyPoolEntry,
  LibraryDoc,
  Milestone,
  Profile,
  ResumeVersion,
  RuntimeDemo,
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
  milestones!: Table<Milestone, string>
  runtimeDemos!: Table<RuntimeDemo, string>
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
  }
}

/** 测试与多实例场景使用；生产代码使用下方单例。 */
export function createDb(name: string): JobConsoleDb {
  return new JobConsoleDb(name)
}

export const db = createDb('job-console')
