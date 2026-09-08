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
