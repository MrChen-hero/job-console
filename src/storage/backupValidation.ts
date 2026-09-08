import { BATCHES, LEGACY_TRACKS, RESUME_SECTION_TYPES, STAGES, TRACKS } from './types'
import { isHttpUrl } from '../shared/safeUrl'
import type { ConfigIssue } from './backup'

type Row = Record<string, unknown>
const isRow = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v)

/** 补充实际读取所依赖的字段与关联；不约束未知字段，兼容旧 v4 的可选字段。 */
export function validateBackupDetails(data: Row, issues: ConfigIssue[]): void {
  const issue = (path: string, message: string) => issues.push({ path, message })
  function strings(row: Row, path: string, required: string[], optional: string[] = []) {
    for (const key of required) {
      if (typeof row[key] !== 'string') issue(`${path}.${key}`, '必须是字符串')
    }
    for (const key of optional) {
      if (row[key] !== undefined && typeof row[key] !== 'string') issue(`${path}.${key}`, '必须是字符串')
    }
  }
  function stringArray(value: unknown, path: string) {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) issue(path, '必须是字符串数组')
  }
  function oneOf(value: unknown, values: readonly unknown[], path: string) {
    if (!values.includes(value)) issue(path, `必须是：${values.join('、')}`)
  }
  function date(value: unknown, path: string, optional = false) {
    if (optional && (value === undefined || value === '')) return
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      issue(path, '必须是 YYYY-MM-DD 日期')
      return
    }
    const parsed = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) issue(path, '日期不存在')
  }
  function rows(value: unknown, path: string, check: (row: Row, path: string) => void, key: string | null = 'id') {
    if (!Array.isArray(value)) { issue(path, '必须是数组'); return }
    const seen = new Set<string>()
    value.forEach((row, i) => {
      const itemPath = `${path}[${i}]`
      if (!isRow(row)) { issue(itemPath, '必须是对象'); return }
      if (key) {
        const id = row[key]
        if (typeof id !== 'string' || !id.trim()) issue(`${itemPath}.${key}`, '缺少必填字符串')
        else if (seen.has(id)) issue(`${itemPath}.${key}`, '标识重复')
        else seen.add(id)
      }
      check(row, itemPath)
    })
  }
  const tracks = [...TRACKS, ...Object.keys(LEGACY_TRACKS)]
  rows(data.applications, '$.data.applications', (row, path) => {
    strings(row, path, ['channel', 'createdAt', 'updatedAt'], ['location', 'url', 'jobDesc', 'nextStep', 'notes'])
    oneOf(row.batch, BATCHES, `${path}.batch`)
    oneOf(row.status, STAGES, `${path}.status`)
    if (row.track !== undefined) oneOf(row.track, tracks, `${path}.track`)
    if (row.starred !== undefined) oneOf(row.starred, [true, false], `${path}.starred`)
    date(row.appliedAt, `${path}.appliedAt`)
    date(row.nextActionAt, `${path}.nextActionAt`, true)
    rows(row.stageHistory, `${path}.stageHistory`, (stage, stagePath) => {
      oneOf(stage.stage, STAGES, `${stagePath}.stage`)
      date(stage.date, `${stagePath}.date`)
      strings(stage, stagePath, [], ['note'])
    }, null)
    if (Array.isArray(row.stageHistory)) {
      const last = row.stageHistory.at(-1)
      if (!isRow(last) || last.stage !== row.status) issue(`${path}.status`, '必须与阶段历史的最后一项一致，历史不能为空')
    }
    rows(row.interviews, `${path}.interviews`, (iv, ivPath) => {
      strings(iv, ivPath, ['round'], ['format', 'weak', 'followUp'])
      date(iv.date, `${ivPath}.date`)
      stringArray(iv.questions, `${ivPath}.questions`)
    })
  })
  rows(data.profile, '$.data.profile', (row, path) => {
    strings(row, path, ['updatedAt'])
    if (isRow(row.basic)) strings(row.basic, `${path}.basic`, ['name'], ['gender', 'degree', 'school', 'graduation', 'phone', 'email', 'summary'])
    const entryFields: Record<string, [string[], string[]]> = {
      education: [['school', 'degree', 'time'], ['courses']],
      skills: [['group', 'detail'], []],
      experiences: [['org', 'role', 'time'], ['stack']],
      projects: [['name', 'time'], ['role', 'stack']],
      awards: [['text'], []],
    }
    for (const [key, [required, optional]] of Object.entries(entryFields)) {
      rows(row[key], `${path}.${key}`, (entry, entryPath) => {
        strings(entry, entryPath, required, optional)
        if (key === 'experiences' || key === 'projects') stringArray(entry.bullets, `${entryPath}.bullets`)
      })
    }
    stringArray(row.selfEvaluation, `${path}.selfEvaluation`)
  })
  rows(data.resumeVersions, '$.data.resumeVersions', (row, path) => {
    strings(row, path, ['targetRole', 'createdAt', 'updatedAt'])
    rows(row.sections, `${path}.sections`, (section, sectionPath) => {
      oneOf(section.type, RESUME_SECTION_TYPES, `${sectionPath}.type`)
      strings(section, sectionPath, ['title'])
      if (!Number.isInteger(section.order) || Number(section.order) < 0) issue(`${sectionPath}.order`, '必须是非负整数')
      if (section.excludedIds !== undefined) stringArray(section.excludedIds, `${sectionPath}.excludedIds`)
    }, 'type')
  })
  // 空版本是正常状态；资料池存在时必须有所属版本。演示页允许保留已删除项目的引用。
  if (Array.isArray(data.profile) && Array.isArray(data.resumeVersions)) {
    const versionIds = new Set(data.resumeVersions.filter(isRow).map((v) => v.id))
    data.profile.forEach((row, i) => {
      if (isRow(row) && !versionIds.has(row.id)) issue(`$.data.profile[${i}].id`, '找不到所属简历版本')
    })
  }
  rows(data.companyPool, '$.data.companyPool', (row, path) => {
    strings(row, path, ['company', 'createdAt'], ['city', 'category', 'jdBrief'])
    oneOf(row.track, tracks, `${path}.track`)
    if (row.priority !== undefined && (typeof row.priority !== 'number' || !Number.isFinite(row.priority))) issue(`${path}.priority`, '必须是数字')
  })
  rows(data.libraryDocs, '$.data.libraryDocs', (row, path) => {
    strings(row, path, ['category', 'updatedAt'])
    if (row.source !== undefined) oneOf(row.source, ['runtime'], `${path}.source`)
  })
  rows(data.milestones, '$.data.milestones', (row, path) => {
    strings(row, path, ['label'])
    date(row.date, `${path}.date`)
    if (row.done !== undefined) oneOf(row.done, [0, 1], `${path}.done`)
  })
  rows(data.libraryCategories, '$.data.libraryCategories', (row, path) => {
    strings(row, path, [], ['renamedTo', 'icon'])
    for (const key of ['builtin', 'hidden']) if (row[key] !== undefined) oneOf(row[key], [true], `${path}.${key}`)
  }, 'name')
  rows(data.deletedDocs, '$.data.deletedDocs', () => {})
  rows(data.runtimeDemos, '$.data.runtimeDemos', (row, path) => {
    strings(row, path, [], ['createdAt', 'updatedAt'])
    if (row.hidden !== undefined) oneOf(row.hidden, [true, false], `${path}.hidden`)
    if (row.url !== undefined && row.url !== '' && !isHttpUrl(row.url)) issue(`${path}.url`, '只支持完整的 http / https 链接')
  })
  rows(data.runtimeProjects, '$.data.runtimeProjects', (row, path) => {
    strings(row, path, ['eyebrow', 'summary', 'createdAt', 'updatedAt'])
    // amber/rose 是旧项目主题值，展示层已有对应映射。
    oneOf(row.accent, ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'black', 'gray', 'amber', 'rose'], `${path}.accent`)
    stringArray(row.stack, `${path}.stack`)
    if (row.hidden !== undefined) oneOf(row.hidden, [true, false], `${path}.hidden`)
    if (!isRow(row.demo)) issue(`${path}.demo`, '必须是对象')
    else {
      strings(row.demo, `${path}.demo`, ['title'])
      stringArray(row.demo.points, `${path}.demo.points`)
    }
  })
}
