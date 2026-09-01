import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusBadge from '../StatusBadge.vue'
import { STAGE_BADGE } from '../../constants'
import { STAGES } from '../../../../storage/types'

describe('StatusBadge', () => {
  it('每个阶段都映射到既有色调类并渲染圆点', () => {
    for (const stage of STAGES) {
      const badge = mount(StatusBadge, { props: { stage } }).find('.stage-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.classes()).toContain(STAGE_BADGE[stage])
      expect(badge.text()).toContain(stage)
      expect(badge.find('.dot').exists()).toBe(true)
    }
  })
})
