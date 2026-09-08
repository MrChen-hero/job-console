import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocalDate } from './useLocalDate'

afterEach(() => vi.useRealTimers())

it('本地午夜自动更新，返回页面重新校准，卸载清理计时器', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 8, 23, 59, 59))
  const wrapper = mount({ setup: () => ({ today: useLocalDate() }), template: '<p>{{ today }}</p>' })
  expect(wrapper.text()).toBe('2026-09-08')
  await vi.advanceTimersByTimeAsync(1100)
  expect(wrapper.text()).toBe('2026-09-09')
  vi.setSystemTime(new Date(2026, 8, 11, 9))
  window.dispatchEvent(new Event('focus'))
  await wrapper.vm.$nextTick()
  expect(wrapper.text()).toBe('2026-09-11')
  vi.setSystemTime(new Date(2026, 8, 12, 9))
  document.dispatchEvent(new Event('visibilitychange'))
  await wrapper.vm.$nextTick()
  expect(wrapper.text()).toBe('2026-09-12')
  wrapper.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
