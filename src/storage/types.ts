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
/** 资料池按简历版本独立存放：id = 所属 ResumeVersion 的 id（v4 起不再有全局 'main'） */
export interface Profile {
  id: string
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
/**
 * 材料库分类：内置默认集（LIBRARY_CATEGORIES，编译时固定）∪ 运行时自定义（libraryCategories 表）。
 * category 在文档上存字符串；内置分类不可删改，自定义分类支持增删改。
 */
export const LIBRARY_CATEGORIES = ['自我介绍', '高频问题', '项目深挖', '八股'] as const
export type LibraryCategory = string
/**
 * 材料库分类行（libraryCategories 表，name 即主键）：
 * - 自定义分类：{ name }，重命名 = 换主键并迁移文档的 category 字段；
 * - 内置分类的覆盖行：{ name: 原始内置名, builtin: true, renamedTo?: 新名, hidden?: true }。
 *   内置 md 的 frontmatter 是编译期产物，运行时改不动——改名/删除以覆盖行表达，
 *   文档归类在读取时经映射生效（等价于改写 frontmatter，且可整体恢复默认）。
 */
export interface LibraryCategoryRow {
  name: string
  builtin?: true
  renamedTo?: string
  hidden?: true
}
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
/** 已删除内置文档的墓碑行（deletedDocs 表）：内置 md 是编译期产物删不掉源文件，删除以墓碑表达 */
export interface DeletedDocRow {
  id: string
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

/**
 * 运行时项目（演示站）：
 * - 用户新建项目：普通行，删除即删行；
 * - 与内置项目同 id 的行是「覆盖」——不带 hidden 表示编辑过的内置项目，带 hidden:true 表示已删除（墓碑），
 *   删行即恢复内置原样（showcase 模块 projectStore 负责 merged/visible 合并视图）。
 */
/** 项目主题色（showcase 色板）：渲染走 --accent-<id> 令牌，暗色自动适配 */
export type ProjectAccent = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'violet' | 'black' | 'gray'

export interface RuntimeProject {
  id: string
  title: string
  eyebrow: string
  accent: ProjectAccent
  summary: string
  stack: string[]
  demo: { title: string; points: string[] }
  /** 仅对内置 id 有意义：true = 隐藏（删除）该内置项目 */
  hidden?: boolean
  createdAt: string
  updatedAt: string
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
