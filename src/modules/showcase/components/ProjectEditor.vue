<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElPopover } from 'element-plus'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import type { MergedProject, ProjectInput } from '../projectStore'
import { ACCENT_OPTIONS, validateProjectInput } from '../projectStore'

const props = defineProps<{
  /** 编辑目标；为 null 时是新建 */
  initial?: MergedProject | null
}>()

const emit = defineEmits<{
  save: [input: ProjectInput]
}>()

const visible = defineModel<boolean>({ default: false })

const form = reactive({
  title: '',
  eyebrow: '',
  accent: 'violet' as MergedProject['accent'],
  summary: '',
  stack: '',
})
const error = reactive({ value: '' })
const accentOpen = ref(false)

const accentLabel = computed(() => ACCENT_OPTIONS.find((a) => a.id === form.accent)?.label ?? form.accent)

/** 技术栈实时解析结果：既喂给 save()，也在输入框下方以 chip 回显，让「逗号分隔」的规则可见 */
const stackList = computed(() => form.stack.split(/[,，]/).map((s) => s.trim()).filter(Boolean))

/** 色板下拉收起态外观与 ElSelect 一致；旧数据 accent 不在色板内时仍显示原名与色点（令牌缺省回落 violet） */
function pickAccent(id: MergedProject['accent']) {
  form.accent = id
  accentOpen.value = false
}

/** 弹窗打开时从 initial 同步表单（组件常驻，不能只在 setup 取一次初值） */
function onOpen() {
  form.title = props.initial?.title ?? ''
  form.eyebrow = props.initial?.eyebrow ?? ''
  form.accent = props.initial?.accent ?? 'violet'
  form.summary = props.initial?.summary ?? ''
  form.stack = props.initial?.stack.join(', ') ?? ''
  error.value = ''
}

function save() {
  const input: ProjectInput = {
    title: form.title,
    eyebrow: form.eyebrow,
    accent: form.accent,
    summary: form.summary,
    stack: stackList.value,
  }
  error.value = validateProjectInput(input)
  if (error.value) return
  visible.value = false
  emit('save', input)
}
</script>

<template>
  <!-- 居中与移动端宽度自适应由 global.css 的 .el-overlay-dialog 规则统一提供 -->
  <ElDialog
    v-model="visible"
    width="580px"
    @open="onOpen"
  >
    <!-- 标题区两行；不传 title prop 时 EP 才把 aria-labelledby 指到 titleId，故标题自己挂 id -->
    <template #header="{ titleId, titleClass }">
      <div class="pe-head">
        <h2
          :id="titleId"
          :class="titleClass"
          class="pe-h"
        >
          {{ initial ? '编辑项目' : '新增项目' }}
        </h2>
        <p class="pe-lede">
          Deck 里横向翻页的一张项目卡。演示页与其要点在「上传交互演示」里按页单独填。
        </p>
      </div>
    </template>
    <!-- 顶部色条取当前主题色：与项目卡顶部色条同源，选色即时可见（accent 是装饰令牌，不做文字色） -->
    <div class="proj-form">
      <div
        class="pe-rail"
        :style="{ background: `var(--accent-${form.accent}, var(--accent-violet))` }"
        aria-hidden="true"
      />
      <div class="pe-row">
        <div class="pe-field">
          <label for="pe-title">项目名称 <span class="req">*</span></label>
          <ElInput
            id="pe-title"
            v-model="form.title"
            data-field="title"
            placeholder="如：校园二手交易小程序"
          />
        </div>
        <div class="pe-field">
          <label id="pe-accent-label">主题色</label>
          <ElPopover
            v-model:visible="accentOpen"
            trigger="click"
            :width="228"
            placement="bottom-start"
            :popper-style="{ padding: '8px' }"
          >
            <template #reference>
              <button
                type="button"
                class="accent-select"
                aria-label="选择主题色"
                aria-haspopup="true"
                :aria-expanded="accentOpen"
                data-field="accent"
              >
                <span
                  class="swatch-dot"
                  :style="{ background: `var(--accent-${form.accent}, var(--accent-violet))` }"
                />
                <span class="accent-name">{{ accentLabel }}</span>
                <AppIcon
                  name="chev"
                  :size="13"
                  class="accent-caret"
                />
              </button>
            </template>
            <div
              class="swatches"
              role="group"
              aria-label="主题色"
            >
              <button
                v-for="a in ACCENT_OPTIONS"
                :key="a.id"
                type="button"
                class="swatch"
                :class="{ on: form.accent === a.id }"
                :style="{ '--sw': `var(--accent-${a.id})`, '--sw-soft': `var(--accent-${a.id}-soft)` }"
                :aria-pressed="form.accent === a.id"
                :aria-label="`主题色 ${a.label}`"
                :title="a.label"
                @click="pickAccent(a.id)"
              >
                <span
                  class="swatch-dot"
                  :style="{ background: `var(--accent-${a.id})` }"
                />
                <span class="swatch-name">{{ a.label }}</span>
              </button>
            </div>
          </ElPopover>
        </div>
      </div>
      <div class="pe-row two">
        <div class="pe-field">
          <label for="pe-eyebrow">眉头标签</label>
          <ElInput
            id="pe-eyebrow"
            v-model="form.eyebrow"
            data-field="eyebrow"
            placeholder="如：三端全栈 · 独立开发"
          />
        </div>
        <div class="pe-field">
          <label for="pe-stack">技术栈<span class="pe-tip">逗号分隔</span></label>
          <ElInput
            id="pe-stack"
            v-model="form.stack"
            data-field="stack"
            placeholder="Spring Boot, Vue, Redis"
          />
          <!-- 解析结果回显：中英文逗号都算分隔符，chip 一出来就知道断没断对 -->
          <ul
            v-if="stackList.length"
            class="pe-chips"
          >
            <li
              v-for="s in stackList"
              :key="s"
              class="pe-chip"
            >
              {{ s }}
            </li>
          </ul>
        </div>
      </div>
      <div class="pe-field">
        <label for="pe-summary">项目简介</label>
        <ElInput
          id="pe-summary"
          v-model="form.summary"
          type="textarea"
          :rows="3"
          data-field="summary"
          placeholder="一句话讲清项目做了什么、用了什么、结果如何"
        />
      </div>
      <p
        v-if="error.value"
        class="pe-error form-alert"
        role="alert"
      >
        {{ error.value }}
      </p>
    </div>
    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="pe-save"
        @click="save"
      >
        保存项目
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
/* 标题区：主标题 + 一句话说明，右侧留出 EP 绝对定位的关闭按钮 */
.pe-head {
  padding-right: 22px;
}
.pe-h {
  font-size: 16px;
  font-weight: var(--fw-semibold);
  color: var(--text);
  line-height: 1.4;
}
.pe-lede {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
}
/* 顶部主题色条：与 showcase 项目卡顶部色条同构，选色即时可见 */
.pe-rail {
  height: 3px;
  border-radius: 999px;
  margin-bottom: 16px;
  transition: background 0.16s var(--ease);
}
/* 首行：项目名称 + 主题色（148px 够放「紫」「橙」等一字色名 + 色点 + 箭头） */
.pe-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 148px;
  gap: 14px;
}
/* 次行：两个短字段等分，比原来五个字段竖着排短一半 */
.pe-row.two {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}/* 下拉触发器：外观对齐 EP 输入控件（--control 描边、等高、圆角） */
.accent-select {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--control);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.16s;
}
.accent-select:hover {
  border-color: var(--border2);
}
.accent-select:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.accent-name {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 收起箭头改用图标系统的 chev（默认朝右，转 90° 朝下），不再用 ▾ 字面量 */
.accent-caret {
  color: var(--muted);
  transform: rotate(90deg);
}
/* 弹出层内的 3×3 色板：色块即选项，选中态主色描边 */
.swatches {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.swatch {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--card);
  cursor: pointer;
  transition: border-color 0.16s, background 0.16s;
}
.swatch:hover {
  border-color: var(--border2);
  background: var(--card2);
}
.swatch:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
/* 选中态用该色自己的描边与浅底：直接预览这档主题色，而不是统一蓝框
   （色值本身不做文字色——accent 是装饰令牌，不保证 4.5:1） */
.swatch.on {
  border-color: var(--sw);
  background: var(--sw-soft);
}
.swatch-dot {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(23, 32, 51, 0.08);
}
.swatch-name {
  font-size: 12px;
  color: var(--text2);
}
.swatch.on .swatch-name {
  color: var(--text);
  font-weight: var(--fw-semibold);
}
.pe-field {
  margin-bottom: 14px;
  min-width: 0;
}
.pe-field label {
  display: block;
  font-size: 12px;
  font-weight: var(--fw-semibold);
  color: var(--text2);
  margin-bottom: 6px;
}
/* 标签里的格式提示（逗号分隔）：常规字重的次要说明，不与字段名抢注意力 */
.pe-tip {
  margin-left: 6px;
  font-weight: var(--fw-normal);
  font-size: 11px;
  color: var(--muted);
}
.pe-tip::before {
  content: '· ';
}
.pe-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
  list-style: none;
}
.pe-chip {
  padding: 1.5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card2);
  color: var(--text2);
  font-size: 11px;
  line-height: 1.7;
}
.req {
  color: var(--danger);
}
.pe-error {
  margin-bottom: 2px;
}
@media (max-width: 640px) {
  .pe-row,
  .pe-row.two {
    grid-template-columns: 1fr;
  }
}
</style>
