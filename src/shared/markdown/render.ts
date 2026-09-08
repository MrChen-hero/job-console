import { marked } from 'marked'
import DOMPurify from 'dompurify'

/** 上传与导入内容也可能来自他人，所有主站 HTML 展示都经过清理。 */
export function sanitizeHtml(source: string): string {
  return DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
  })
}

export function renderMarkdown(source: string): string {
  return sanitizeHtml(marked.parse(source, { async: false }) as string)
}
