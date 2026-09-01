/**
 * 触发浏览器下载一段 JSON。
 *
 * Blob URL 的释放必须延后到下载真正开始之后：紧跟 a.click() 同步 revoke 在
 * 部分浏览器会让下载拿到已失效的 URL 而静默失败，故用 setTimeout 让出一轮事件循环。
 */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 备份文件名：jobconsole-backup-YYYY-MM-DD.json（本地日期，与用户看到的“今天”一致） */
export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `jobconsole-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}
