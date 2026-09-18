import type {
  AvatarCrop,
  EducationEntry,
  ExperienceEntry,
  Profile,
  ProjectEntry,
  ResumeSectionType,
  ResumeVersion,
  SkillGroup,
} from '../../../storage/types'
import { isImageDataUrl } from '../../../shared/safeUrl'
import { subtitleOf } from '../profileSchema'

/**
 * 纸面的最小排版单位。一块要么整块落在某一页，要么整块进下一页；
 * 分页只在块之间发生，不会把一块从中间切开。
 */
export type SheetBlock =
  | { id: string; kind: 'head'; name: string; meta: string; targetRole: string; contact: string; avatar: string; avatarCrop: AvatarCrop | null }
  | { id: string; kind: 'title'; title: string; subtitle: string }
  | { id: string; kind: 'edu'; entry: EducationEntry }
  | { id: string; kind: 'skill'; entry: SkillGroup }
  | { id: string; kind: 'exp'; entry: ExperienceEntry }
  | { id: string; kind: 'proj'; entry: ProjectEntry }
  | { id: string; kind: 'line'; text: string }

/** 区块标题必须与其后第一块同页，否则会出现标题落在页尾、内容在下一页的孤行 */
export function keepsWithNext(block: SheetBlock): boolean {
  return block.kind === 'title'
}

function join(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' · ')
}

/**
 * 把资料池 + 版本编排展开成一维块序列。顺序与排除规则完全由 version.sections 决定，
 * 与旧版模板逐区块渲染的结果一一对应。
 */
export function buildBlocks(
  profile: Profile | null | undefined,
  version: ResumeVersion | null | undefined,
): SheetBlock[] {
  if (!profile || !version) return []
  const blocks: SheetBlock[] = []
  const excludedOf = (type: ResumeSectionType): Set<string> =>
    new Set(version.sections.find((s) => s.type === type)?.excludedIds ?? [])
  const keep = <T extends { id: string }>(type: ResumeSectionType, list: T[] | undefined): T[] => {
    if (!list) return []
    const hidden = excludedOf(type)
    return list.filter((item) => !hidden.has(item.id))
  }

  const basic = profile.basic
  if (!excludedOf('basic').has('main')) {
    blocks.push({
      id: 'head',
      kind: 'head',
      name: basic.name,
      meta: join([basic.gender, basic.degree, basic.school]),
      targetRole: version.targetRole,
      contact: join([basic.phone, basic.email, basic.graduation]),
      // 导入的备份不可信：头像非法就当作没有，不影响其余内容渲染
      avatar: isImageDataUrl(basic.avatar) ? basic.avatar : '',
      avatarCrop: basic.avatarCrop ?? null,
    })
  }

  for (const section of [...version.sections].sort((a, b) => a.order - b.order)) {
    if (section.type === 'basic') continue
    const start = blocks.length
    blocks.push({
      id: `title:${section.type}`,
      kind: 'title',
      title: section.title,
      subtitle: subtitleOf(section),
    })
    switch (section.type) {
      case 'education':
        for (const entry of keep('education', profile.education)) {
          blocks.push({ id: `edu:${entry.id}`, kind: 'edu', entry })
        }
        break
      case 'skills':
        for (const entry of keep('skills', profile.skills)) {
          blocks.push({ id: `skill:${entry.id}`, kind: 'skill', entry })
        }
        break
      case 'experiences':
        for (const entry of keep('experiences', profile.experiences)) {
          blocks.push({ id: `exp:${entry.id}`, kind: 'exp', entry })
        }
        break
      case 'projects':
        for (const entry of keep('projects', profile.projects)) {
          blocks.push({ id: `proj:${entry.id}`, kind: 'proj', entry })
        }
        break
      case 'awards':
        for (const entry of keep('awards', profile.awards)) {
          blocks.push({ id: `award:${entry.id}`, kind: 'line', text: entry.text })
        }
        break
      case 'selfEvaluation':
        // 自评是纯字符串数组，没有 id，因此不参与条目排除（与改造前一致）
        profile.selfEvaluation.forEach((text, i) => {
          blocks.push({ id: `self:${i}`, kind: 'line', text })
        })
        break
    }
    // 空区块不占用纸面，编排与标题仍保存在版本中，新增条目后自动恢复展示。
    if (blocks.length === start + 1) blocks.pop()
  }
  return blocks
}
