import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useThemeStore } from '../theme'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    setActivePinia(createPinia())
  })

  it('默认亮色', () => {
    const store = useThemeStore()
    expect(store.dark).toBe(false)
  })

  it('toggle 后写入 data-theme、dark class 与 localStorage', () => {
    const store = useThemeStore()
    store.toggle()
    expect(store.dark).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('jobconsole:theme:v1')).toBe('dark')
  })

  it('初始化时恢复已存偏好', () => {
    localStorage.setItem('jobconsole:theme:v1', 'dark')
    setActivePinia(createPinia())
    const store = useThemeStore()
    store.init()
    expect(store.dark).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
