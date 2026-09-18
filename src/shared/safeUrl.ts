/** 演示链接只接受完整的 HTTP(S) 地址；表单、导入和展示使用同一规则。 */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * 头像只接受内联位图 data URL。导入的备份不可信，非法值一律按「没有头像」处理，
 * 上传表单、备份校验与纸面渲染共用这一条规则。
 */
export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
}
