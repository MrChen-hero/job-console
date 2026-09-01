import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useTrackerStore } from '../tracker/store'
import type { Application, Stage } from '../../storage/types'
import { isStale, STAGE_DONE } from '../tracker/constants'

/** 某投递在 date 时刻的阶段：取 stageHistory 中 date <= 该日的最后一条 */
function stageAt(app: Application, date: string): Stage | null {
  let result: Stage | null = null
  for (const h of app.stageHistory) {
    if (h.date <= date) result = h.stage
  }
  return result
}

export const useDashboardStore = defineStore('dashboard', () => {
  const tracker = useTrackerStore()

  const stats = computed(() => {
    const apps = tracker.applications
    const stageOf = (s: string) => apps.filter((a) => a.status === s).length
    const interviewing = stageOf('一面') + stageOf('二面') + stageOf('HR面')
    const inFlight = ['已投递', '笔试', '一面', '二面', 'HR面'].reduce((n, s) => n + stageOf(s), 0)
    return {
      total: apps.length,
      inFlight,
      interviewing,
      offers: stageOf('Offer'),
    }
  })

  /** 投递漏斗：累计到达语义——各层计数是「曾经到达该层及以后」的投递数，挂/无消息不计入其后各层 */
  const funnel = computed(() => {
    const apps = tracker.applications
    const rows = STAGE_DONE.map((stage, layer) => {
      const count = apps.filter((a) => a.stageHistory.some((h) => STAGE_DONE.indexOf(h.stage) >= layer)).length
      return { stage, count, pct: apps.length ? count / apps.length : 0 }
    })
    const base = apps.length
    return { rows, base }
  })

  /** 近 12 周走势：桶 i 截止日 = 今天 − (11−i)×7 天，按 stageHistory 回放后套用与 stats 相同的谓词 */
  const series = computed(() => {
    const today = new Date()
    const cutoffs = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (11 - i) * 7)
      // 本地时区 YYYY-MM-DD；toISOString 是 UTC，东八区 00:00–08:00 会把「今天」算成昨天，
      // 末桶回放时 changeStage 落库的本地日期就落不进桶内（与 tracker 的 today() 同因）。
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    })
    const at = (date: string) => {
      const apps = tracker.applications
      const stageOf = (s: string) => apps.filter((a) => stageAt(a, date) === s).length
      return {
        total: apps.filter((a) => a.appliedAt <= date).length,
        inFlight: ['已投递', '笔试', '一面', '二面', 'HR面'].reduce((n, s) => n + stageOf(s), 0),
        interviewing: stageOf('一面') + stageOf('二面') + stageOf('HR面'),
        offers: stageOf('Offer'),
      }
    }
    const buckets = cutoffs.map(at)
    return {
      total: buckets.map((b) => b.total),
      inFlight: buckets.map((b) => b.inFlight),
      interviewing: buckets.map((b) => b.interviewing),
      offers: buckets.map((b) => b.offers),
    }
  })

  /** 本周待办：有下一步日期的投递，按日期升序 */
  const todos = computed(() =>
    tracker.applications
      .filter((a) => a.nextStep && a.nextActionAt)
      .map((a) => ({ id: a.id, date: a.nextActionAt!, label: a.nextStep!, sub: `${a.company} · ${a.position}`, status: a.status }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  )

  /** 终止态标注：无消息超 1 个月 */
  const staleCount = computed(() =>
    tracker.applications.filter((a) => {
      const last = a.stageHistory[a.stageHistory.length - 1]
      return isStale(a.status, last?.date ?? a.appliedAt)
    }).length,
  )

  async function load() {
    await tracker.load()
  }

  return { stats, funnel, series, todos, staleCount, load }
})

