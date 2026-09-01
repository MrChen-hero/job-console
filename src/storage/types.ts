/* 资料池 */
export interface BasicInfo {
  name: string
  gender?: string
  degree?: string
  school?: string
  graduation?: string
  phone?: string
  email?: string
  summary?: string
}
export interface EducationEntry {
  id: string
  school: string
  degree: string
  time: string
  courses?: string
}
export interface SkillGroup {
  id: string
  group: string
  detail: string
}
export interface ExperienceEntry {
  id: string
  org: string
  role: string
  time: string
  stack?: string
  bullets: string[]
}
export interface ProjectEntry {
  id: string
  name: string
  role?: string
  time: string
  stack?: string
  bullets: string[]
}
export interface AwardEntry {
  id: string
  text: string
}
export interface Profile {
  id: 'main'
  basic: BasicInfo
  education: EducationEntry[]
  skills: SkillGroup[]
  experiences: ExperienceEntry[]
  projects: ProjectEntry[]
  awards: AwardEntry[]
  selfEvaluation: string[]
  updatedAt: string
}

/* 投递 */
export const STAGES = ['已投递', '笔试', '一面', '二面', 'HR面', 'Offer', '挂', '无消息'] as const
export type Stage = (typeof STAGES)[number]
export const BATCHES = ['提前批', '正式批', '补录', '实习'] as const
export type Batch = (typeof BATCHES)[number]
export const TRACKS = ['主投', '保底', '机会型'] as const
export type Track = (typeof TRACKS)[number]

export interface StageChange {
  stage: Stage
  date: string
  note?: string
}
export interface InterviewRecord {
  id: string
  round: string
  date: string
  format?: string
  questions: string[]
  weak?: string
  followUp?: string
}
export interface Application {
  id: string
  company: string
  position: string
  batch: Batch
  channel: string
  appliedAt: string
  location?: string
  url?: string
  /** 岗位信息 / JD 原文；非索引可选字段，备份为全量 JSON，无需升 BACKUP_SCHEMA_VERSION */
  jobDesc?: string
  /** 当前阶段；不变量：恒等于 stageHistory 最后一条的 stage，由更新逻辑保证，UI 从 stageHistory 推导时间线 */
  status: Stage
  stageHistory: StageChange[]
  nextStep?: string
  nextActionAt?: string
  notes?: string
  /** 行内收藏标记；未索引字段，无需 Dexie 版本升级 */
  starred?: boolean
  track?: Track
  interviews: InterviewRecord[]
  createdAt: string
  updatedAt: string
}

/* 简历版本：版本 = 资料池条目的选择与排序 */
export const RESUME_SECTION_TYPES = [
  'basic',
  'education',
  'skills',
  'experiences',
  'projects',
  'awards',
  'selfEvaluation',
] as const
export type ResumeSectionType = (typeof RESUME_SECTION_TYPES)[number]
export interface ResumeSection {
  type: ResumeSectionType
  title: string
  excludedIds?: string[]
  order: number
}
export interface ResumeVersion {
  id: string
  name: string
  targetRole: string
  sections: ResumeSection[]
  createdAt: string
  updatedAt: string
}

/* 候选池 / 材料库 / 里程碑 */
export interface CompanyPoolEntry {
  id: string
  company: string
  city?: string
  category?: string
  track: Track
  priority?: number
  jdBrief?: string
  createdAt: string
}
export const LIBRARY_CATEGORIES = ['自我介绍', '高频问题', '项目深挖', '八股'] as const
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number]
export interface LibraryDoc {
  id: string
  category: LibraryCategory
  title: string
  body: string
  tags: string[]
  updatedAt: string
  /** 运行时创建/覆盖的文档标记；内置编译时文档不入库 */
  source?: 'runtime'
}

/** 运行时上传的交互式 HTML 演示页 */
export interface RuntimeDemo {
  id: string
  projectId: string
  title: string
  html: string
  createdAt: string
  updatedAt: string
}

/** 编译时内置演示页（import.meta.glob 产出，不入库） */
export interface LocalDemo {
  id: string
  projectId: string
  title: string
  html: string
}
/** done 用 0|1 而非 boolean：Dexie 不索引布尔值 */
export interface Milestone {
  id: string
  date: string
  label: string
  done?: 0 | 1
}

export function newId(): string {
  return crypto.randomUUID()
}
