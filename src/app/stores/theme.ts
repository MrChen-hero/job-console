import { defineStore } from 'pinia'

const STORAGE_KEY = 'jobconsole:theme:v1'

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark'
  } catch {
    return false
  }
}

function apply(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', dark)
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ dark: readInitial() }),
  actions: {
    init() {
      apply(this.dark)
    },
    toggle() {
      this.dark = !this.dark
      try {
        localStorage.setItem(STORAGE_KEY, this.dark ? 'dark' : 'light')
      } catch {
        /* 隐私模式等存储不可用时忽略 */
      }
      apply(this.dark)
    },
  },
})
