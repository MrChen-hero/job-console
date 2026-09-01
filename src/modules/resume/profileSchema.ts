import type { AwardEntry, EducationEntry, ExperienceEntry, ProjectEntry, SkillGroup } from '../../storage/types'

export type FieldType = 'text' | 'textarea' | 'bullets'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
}

export type SectionKey = 'basic' | 'education' | 'skills' | 'experiences' | 'projects' | 'awards' | 'selfEvaluation'

export interface SectionDef {
  key: SectionKey
  label: string
  /** 列表条目的标题行渲染 */
  titleOf: (entry: Record<string, unknown>) => string
  fields: FieldDef[]
}

export const BASIC_FIELDS: FieldDef[] = [
  { key: 'name', label: '姓名', type: 'text', required: true },
  { key: 'gender', label: '性别', type: 'text' },
  { key: 'degree', label: '学历', type: 'text', placeholder: '硕士在读' },
  { key: 'school', label: '学校', type: 'text' },
  { key: 'graduation', label: '毕业时间', type: 'text', placeholder: '2027 届' },
  { key: 'phone', label: '电话', type: 'text' },
  { key: 'email', label: '邮箱', type: 'text' },
  { key: 'summary', label: '一句话定位', type: 'textarea', placeholder: '如：Java 后端为底，AI 应用落地方向' },
]

export const SECTION_DEFS: SectionDef[] = [
  {
    key: 'education',
    label: '教育背景',
    titleOf: (e) => `${String(e.school ?? '')} · ${String(e.degree ?? '')}`,
    fields: [
      { key: 'school', label: '学校', type: 'text', required: true },
      { key: 'degree', label: '专业 / 学位', type: 'text', required: true },
      { key: 'time', label: '时间段', type: 'text', required: true, placeholder: '2024.09 – 2027.06' },
      { key: 'courses', label: '核心课程', type: 'textarea', placeholder: '每行一门课程' },
    ],
  },
  {
    key: 'skills',
    label: '专业技能',
    titleOf: (e) => String(e.group ?? ''),
    fields: [
      { key: 'group', label: '分类', type: 'text', required: true, placeholder: '如：后端开发' },
      { key: 'detail', label: '描述', type: 'textarea', required: true },
    ],
  },
  {
    key: 'experiences',
    label: '实习经历',
    titleOf: (e) => `${String(e.org ?? '')} · ${String(e.role ?? '')}`,
    fields: [
      { key: 'org', label: '单位', type: 'text', required: true },
      { key: 'role', label: '职位', type: 'text', required: true },
      { key: 'time', label: '时间段', type: 'text', required: true },
      { key: 'stack', label: '技术栈', type: 'text' },
      { key: 'bullets', label: '工作内容', type: 'bullets', required: true, placeholder: '每行一条' },
    ],
  },
  {
    key: 'projects',
    label: '项目经历',
    titleOf: (e) => String(e.name ?? ''),
    fields: [
      { key: 'name', label: '项目名', type: 'text', required: true },
      { key: 'role', label: '角色', type: 'text', placeholder: '如：第二负责人 / 独立开发' },
      { key: 'time', label: '时间段', type: 'text', required: true },
      { key: 'stack', label: '技术栈', type: 'text' },
      { key: 'bullets', label: '要点', type: 'bullets', required: true, placeholder: '每行一条' },
    ],
  },
  {
    key: 'awards',
    label: '竞赛与荣誉',
    titleOf: (e) => String(e.text ?? ''),
    fields: [{ key: 'text', label: '内容', type: 'text', required: true }],
  },
]

export function sectionDef(key: SectionKey): SectionDef | undefined {
  return SECTION_DEFS.find((s) => s.key === key)
}

/** 条目类型到具体 TS 类型的映射（供组件做类型收窄） */
export type EntryOfType<K extends SectionKey> = K extends 'education'
  ? EducationEntry
  : K extends 'skills'
    ? SkillGroup
    : K extends 'experiences'
      ? ExperienceEntry
      : K extends 'projects'
        ? ProjectEntry
        : K extends 'awards'
          ? AwardEntry
          : never
