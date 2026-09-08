<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { ElButton, ElDatePicker, ElDialog, ElInput, ElOption, ElSelect } from 'element-plus'
import type { Application } from '../../../storage/types'
import { BATCHES, TRACKS } from '../../../storage/types'
import { useApplicationForm, type ApplicationFormInput } from '../applicationForm'

const props = defineProps<{
  initial?: Application | null
  presetCompany?: string
  persist: (input: ApplicationFormInput) => Promise<void>
}>()

const emit = defineEmits<{
  save: [input: ApplicationFormInput]
}>()

const visible = defineModel<boolean>({ default: false })
const { form, error, open, submit } = useApplicationForm()
const saving = ref(false)

/**
 * ElDatePicker 不转发任意属性，只有声明过的 prop（如 id）能到内层 input，
 * 因此 data-field 需在渲染后补写，保持 `input[data-field="…"]` 选择器不变。
 * id 是内层 input 上唯一可靠的锚点，弹窗 teleport 到 body 后仍能定位。
 */
const DATE_FIELDS: Array<[id: string, field: string]> = [
  ['af-date', 'appliedAt'],
  ['af-nextat', 'nextActionAt'],
]

async function stampDateFields() {
  await nextTick()
  for (const [id, field] of DATE_FIELDS) {
    const input = document.getElementById(id)
    if (input instanceof HTMLInputElement && input.getAttribute('data-field') !== field) {
      input.setAttribute('data-field', field)
    }
  }
}

onMounted(() => {
  void stampDateFields()
})

function onOpen() {
  open(props.initial, props.presetCompany)
  void stampDateFields()
}

async function onSave() {
  if (saving.value) return
  const payload = submit()
  if (!payload) return
  saving.value = true
  try {
    await props.persist(payload)
    emit('save', payload)
    visible.value = false
  } catch { error.value = '保存失败，输入已保留，请重试' }
  finally { saving.value = false }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="initial ? '编辑投递' : '新增投递'"
    width="560px"
    :show-close="!saving"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    @open="onOpen"
  >
    <div
      class="app-form"
      :inert="saving"
    >
      <section class="form-group">
        <h3 class="group-title">
          <span>基本信息</span>
        </h3>
        <div class="form-row">
          <div class="form-field">
            <label for="af-company">公司 <span class="req">*</span></label>
            <ElInput
              id="af-company"
              v-model="form.company"
              data-field="company"
              placeholder="如：字节跳动 / 腾讯"
            />
          </div>
          <div class="form-field">
            <label for="af-position">岗位 <span class="req">*</span></label>
            <ElInput
              id="af-position"
              v-model="form.position"
              data-field="position"
              placeholder="如：AI 应用开发工程师"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="af-batch">批次</label>
            <ElSelect
              id="af-batch"
              v-model="form.batch"
              data-field="batch"
            >
              <ElOption
                v-for="b in BATCHES"
                :key="b"
                :label="b"
                :value="b"
              />
            </ElSelect>
          </div>
          <div class="form-field">
            <label for="af-channel">渠道</label>
            <ElInput
              id="af-channel"
              v-model="form.channel"
              data-field="channel"
              placeholder="官网 / 内推 / Boss直聘"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="af-date">投递日期</label>
            <ElDatePicker
              id="af-date"
              v-model="form.appliedAt"
              class="date-field"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              clearable
              data-field="appliedAt"
              placeholder="选择日期"
            />
          </div>
          <div class="form-field">
            <label for="af-loc">工作地点</label>
            <ElInput
              id="af-loc"
              v-model="form.location"
              data-field="location"
              placeholder="上海"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="af-track">投向</label>
            <ElSelect
              id="af-track"
              v-model="form.track"
              data-field="track"
              clearable
              placeholder="主投 / 次投 / 尝试 / 练手"
            >
              <ElOption
                v-for="t in TRACKS"
                :key="t"
                :label="t"
                :value="t"
              />
            </ElSelect>
          </div>
          <div class="form-field">
            <label for="af-url">岗位链接</label>
            <ElInput
              id="af-url"
              v-model="form.url"
              data-field="url"
              placeholder="https://…"
            />
          </div>
        </div>
      </section>
      <section class="form-group">
        <h3 class="group-title">
          <span>跟进</span>
        </h3>
        <div class="form-row">
          <div class="form-field">
            <label for="af-next">下一步</label>
            <ElInput
              id="af-next"
              v-model="form.nextStep"
              data-field="nextStep"
              placeholder="等笔试通知"
            />
          </div>
          <div class="form-field">
            <label for="af-nextat">下一步日期</label>
            <ElDatePicker
              id="af-nextat"
              v-model="form.nextActionAt"
              class="date-field"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              clearable
              data-field="nextActionAt"
              placeholder="选择日期"
            />
          </div>
        </div>
      </section>
      <section class="form-group">
        <h3 class="group-title">
          <span>岗位信息</span>
        </h3>
        <div class="form-field full">
          <ElInput
            id="af-jd"
            v-model="form.jobDesc"
            type="textarea"
            :rows="4"
            data-field="jobDesc"
            placeholder="粘贴岗位要求 / JD 原文，面试前对照准备"
          />
        </div>
      </section>
      <p
        v-if="error"
        class="form-error"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
    <template #footer>
      <ElButton
        :disabled="saving"
        @click="visible = false"
      >
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="app-save"
        :loading="saving"
        @click="onSave"
      >
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
/* 字段两列排布；必填行在最上，日期与「下一步」成对，扫读顺序与录入顺序一致 */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.form-field {
  margin-bottom: 16px;
}
/* 长表单按「基本信息 / 跟进 / 岗位信息」分区，扫读时能定位，节奏不糊成一团 */
.form-group + .form-group {
  margin-top: 20px;
}
.group-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  font-size: 11px;
  font-weight: var(--fw-semibold);
  letter-spacing: 0.1em;
  color: var(--muted);
}
.group-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
/* 岗位信息全宽多行，行高放宽便于通读 JD */
.form-field.full {
  margin-bottom: 0;
}
.form-field.full :deep(.el-textarea__inner) {
  line-height: 1.6;
}
/* 日期是只读输入，用等宽数字与文本字段区分开 */
.date-field :deep(.el-input__inner) {
  font-family: var(--mono);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 11.5px;
  font-weight: var(--fw-semibold);
  letter-spacing: 0.02em;
  color: var(--text2);
}
.req {
  color: var(--danger);
}
/* ElDatePicker 固定 220px、ElSelect 是 inline-block，都不撑满列宽；实测这些子组件
   根元素只有 class、没有本组件的 data-v（scoped 选择器打不到），故用 :deep 穿透，
   统一与 ElInput 对齐为 100% 列宽；date editor 宽度由其 --el-date-editor-width 控制 */
.app-form :deep(.el-date-editor),
.app-form :deep(.el-select) {
  width: 100%;
}
.app-form :deep(.el-date-editor) {
  --el-date-editor-width: 100%;
}
.form-error {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--danger);
  background: var(--danger-soft);
  border-radius: var(--r-sm);
}
@media (max-width: 560px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
