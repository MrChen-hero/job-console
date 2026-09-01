import { marked } from 'marked'

/** 渲染 markdown 为 HTML；内容为本机个人数据，信任来源（导入/上传均为用户自身文件）。 */
export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false }) as string
}
