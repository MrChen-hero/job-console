import { reactive, ref } from 'vue'
import type { Application } from '../../storage/types'

export interface ApplicationFormInput {
  company: string
  position: string
  batch: Application['batch']
  channel: string
  appliedAt: string
  location?: string
  url?: string
  jobDesc?: string
  track?: Application['track']
  nextStep?: string
  nextActionAt?: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 表单内部状态全部是字符串（ElInput 绑定友好），submit 时才收窄为领域类型。 */
interface FormShape {
  company: string
  position: string
  batch: string
  channel: string
  appliedAt: string
  location: string
  url: string
  jobDesc: string
  track: string
  nextStep: string
  nextActionAt: string
}

/**
 * 投递表单状态与校验；与 ElDialog 解耦以便单测。
 * open() 时按 initial/presetCompany 重置，submit() 校验必填并产出有效载荷。
 */
export function useApplicationForm() {
  const form = reactive<FormShape>({
    company: '',
    position: '',
    batch: '正式批',
    channel: '官网',
    appliedAt: today(),
    location: '',
    url: '',
    jobDesc: '',
    track: '',
    nextStep: '',
    nextActionAt: '',
  })
  const error = ref('')

  function open(initial?: Application | null, presetCompany?: string) {
    error.value = ''
    form.company = initial?.company ?? presetCompany ?? ''
    form.position = initial?.position ?? ''
    form.batch = initial?.batch ?? '正式批'
    form.channel = initial?.channel ?? '官网'
    form.appliedAt = initial?.appliedAt ?? today()
    form.location = initial?.location ?? ''
    form.url = initial?.url ?? ''
    form.jobDesc = initial?.jobDesc ?? ''
    form.track = initial?.track ?? ''
    form.nextStep = initial?.nextStep ?? ''
    form.nextActionAt = initial?.nextActionAt ?? ''
  }

  function submit(): ApplicationFormInput | null {
    if (form.company.trim() === '') {
      error.value = '请填写公司'
      return null
    }
    if (form.position.trim() === '') {
      error.value = '请填写岗位'
      return null
    }
    error.value = ''
    return {
      company: form.company.trim(),
      position: form.position.trim(),
      batch: form.batch as Application['batch'],
      channel: form.channel.trim(),
      appliedAt: form.appliedAt,
      location: form.location.trim() || undefined,
      url: form.url.trim() || undefined,
      jobDesc: form.jobDesc.trim() || undefined,
      track: (form.track || undefined) as Application['track'] | undefined,
      nextStep: form.nextStep.trim() || undefined,
      nextActionAt: form.nextActionAt || undefined,
    }
  }

  return { form, error, open, submit }
}
