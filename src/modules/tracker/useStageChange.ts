import { ElMessageBox } from 'element-plus'
import type { Stage } from '../../storage/types'
import { useTrackerStore } from './store'

/** 详情操作和看板拖动共用结束状态提示，界面选择不进入 store。 */
export function useStageChange() {
  const store = useTrackerStore()
  return async (id: string, stage: Stage) => {
    const app = store.find(id)
    if (!app || app.status === stage) return
    let clearNextAction = false
    if ((stage === '挂' || stage === '无消息') && (app.nextStep || app.nextActionAt)) {
      try {
        await ElMessageBox.confirm(`将「${app.company}」标记为「${stage}」时，是否同时清除待办「${app.nextStep || '已安排日期的动作'}」？`, '处理待办', {
          confirmButtonText: '同时清除待办',
          cancelButtonText: '保留待办',
          distinguishCancelAndClose: true,
          type: 'warning',
        })
        clearNextAction = true
      } catch (reason) {
        // “保留待办”继续改变阶段；关闭弹窗或 Esc 则取消整个操作。
        if (reason !== 'cancel') return
      }
    }
    await store.changeStage(id, stage, undefined, undefined, clearNextAction)
  }
}
