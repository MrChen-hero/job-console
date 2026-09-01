<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElButton, ElInput, ElOption, ElSelect } from 'element-plus'
import { useDemoStore } from '../demoStore'
import { useProjectStore } from '../projectStore'

const emit = defineEmits<{ close: [] }>()

const store = useDemoStore()
const projectStore = useProjectStore()
const open = defineModel<boolean>({ default: false })

const form = reactive({
  projectId: '',
  title: '',
})

/** 打开面板时校准默认项目：首个可见项目；清单变化（如删除）后落到有效值 */
watch(open, (v) => {
  if (v) form.projectId = projectStore.visible[0]?.id ?? ''
})
watch(() => projectStore.visible.map((p) => p.id).join('|'), (ids) => {
  if (form.projectId && !ids.split('|').includes(form.projectId)) {
    form.projectId = projectStore.visible[0]?.id ?? ''
  }
})
const error = ref('')
const fileName = ref('')
let pendingHtml = ''

function onFileChange(event: Event) {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  void file.text().then((text) => {
    pendingHtml = text
    fileName.value = file.name
    if (!form.title) {
      const match = /<title>([^<]*)<\/title>/i.exec(text)
      form.title = match?.[1]?.trim() ?? file.name.replace(/\.html?$/i, '')
    }
    inputEl.value = ''
  })
}

async function save() {
  if (!pendingHtml) {
    error.value = '请先选择 .html 文件'
    return
  }
  if (!form.projectId) {
    error.value = '没有可选的项目，请先创建项目'
    return
  }
  if (form.title.trim() === '') {
    error.value = '请填写演示标题'
    return
  }
  await store.addDemo({ projectId: form.projectId, title: form.title.trim(), html: pendingHtml })
  open.value = false
  reset()
  emit('close')
}

function reset() {
  pendingHtml = ''
  fileName.value = ''
  form.title = ''
  error.value = ''
}
</script>

<template>
  <!-- 内联面板：与 DocEditor 同策略，避开 ElDialog 在 jsdom 的限制 -->
  <div
    v-if="open"
    class="demo-upload"
    data-testid="demo-upload"
  >
    <div class="du-head">
      <h3>上传交互式演示页</h3>
      <button
        class="du-close"
        aria-label="关闭上传面板"
        @click="emit('close'); open = false"
      >
        ✕
      </button>
    </div>
    <p class="du-hint">
      上传本地写好的交互式 HTML 页面（单文件、自包含），保存后作为对应项目的纵向演示页，以沙箱 iframe 呈现。
    </p>
    <label
      class="du-file"
      data-testid="demo-file-label"
    >
      <input
        type="file"
        accept=".html,.htm"
        class="du-input"
        @change="onFileChange"
      >
      <span>{{ fileName ? `已选择：${fileName}` : '点击选择 .html 文件' }}</span>
    </label>
    <div class="du-field">
      <label for="du-project">所属项目</label>
      <ElSelect
        id="du-project"
        v-model="form.projectId"
        data-field="du-project"
      >
        <ElOption
          v-for="p in projectStore.visible"
          :key="p.id"
          :label="p.title"
          :value="p.id"
        />
      </ElSelect>
    </div>
    <div class="du-field">
      <label for="du-title">演示标题 <span class="req">*</span></label>
      <ElInput
        id="du-title"
        v-model="form.title"
        data-field="du-title"
        placeholder="自动读取 &lt;title&gt;，可修改"
      />
    </div>
    <p
      v-if="error"
      class="du-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="du-actions">
      <ElButton @click="emit('close'); open = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="du-save"
        @click="save"
      >
        保存演示
      </ElButton>
    </div>
  </div>
</template>

<script lang="ts">
export default {}
</script>

<style scoped>
.demo-upload {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 16px 18px;
  margin-bottom: 20px;
}
.du-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.du-head h3 {
  font-size: 14px;
}
.du-close {
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
}
.du-hint {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 12px;
}
.du-file {
  display: block;
  border: 1px dashed var(--border2);
  border-radius: var(--r-sm);
  padding: 14px;
  text-align: center;
  font-size: 13px;
  color: var(--text2);
  cursor: pointer;
  margin-bottom: 14px;
  transition: border-color 0.18s;
}
.du-file:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.du-input {
  display: none;
}
.du-field {
  margin-bottom: 14px;
}
.du-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 6px;
}
.req {
  color: var(--danger);
}
.du-error {
  color: var(--danger);
  font-size: 12px;
  margin-bottom: 10px;
}
.du-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
