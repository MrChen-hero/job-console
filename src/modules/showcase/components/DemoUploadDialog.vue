<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElOption, ElSelect } from 'element-plus'
import { useDemoStore } from '../demoStore'
import { useProjectStore } from '../projectStore'

const store = useDemoStore()
const projectStore = useProjectStore()
const open = defineModel<boolean>({ default: false })

const form = reactive({
  projectId: '',
  title: '',
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

/** 打开弹窗时校准默认项目：首个可见项目 */
function onOpenPanel() {
  form.projectId = projectStore.visible[0]?.id ?? ''
  error.value = ''
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
}

function reset() {
  pendingHtml = ''
  fileName.value = ''
  form.title = ''
  error.value = ''
}
</script>

<template>
  <!-- 居中与移动端宽度自适应由 global.css 的 .el-overlay-dialog 规则统一提供 -->
  <ElDialog
    v-model="open"
    title="上传交互式演示页"
    width="480px"
    @open="onOpenPanel"
  >
    <div class="du-body">
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
    </div>
    <template #footer>
      <ElButton @click="open = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="du-save"
        @click="save"
      >
        保存演示
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
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
  font-weight: var(--fw-semibold);
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
</style>
