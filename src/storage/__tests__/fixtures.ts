import type { Application } from '../types'
import { newId } from '../types'

export function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: newId(),
    company: '南方电网',
    position: '数字化研发工程师',
    batch: '提前批',
    channel: '官网',
    appliedAt: '2026-08-30',
    status: '已投递',
    stageHistory: [{ stage: '已投递', date: '2026-08-30' }],
    interviews: [],
    createdAt: '2026-08-30',
    updatedAt: '2026-08-30',
    ...overrides,
  }
}
