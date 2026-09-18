<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import type { AvatarCrop } from '../../../storage/types'
import { isImageDataUrl } from '../../../shared/safeUrl'
import {
  BOX_HEIGHT,
  BOX_WIDTH,
  MAX_FILE_BYTES,
  MAX_SCALE,
  MAX_SOURCE_EDGE,
  MIN_SCALE,
  SOURCE_QUALITY,
  clampView,
  coverSize,
  defaultView,
  fromCrop,
  toCrop,
  zoomTo,
  type ViewState,
} from './avatarCrop'

const props = defineProps<{ initialSrc?: string; initialCrop?: AvatarCrop | null }>()
const emit = defineEmits<{ confirm: [value: { avatar: string; avatarCrop: AvatarCrop }] }>()
const visible = defineModel<boolean>({ default: false })

const fileInput = ref<HTMLInputElement | null>(null)
const src = ref('')
const imgW = ref(0)
const imgH = ref(0)
const view = ref<ViewState>({ scale: 1, x: 0, y: 0 })
const error = ref('')
const busy = ref(false)

const imgStyle = computed(() => {
  const { width, height } = coverSize(imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT)
  return {
    width: `${width * view.value.scale}px`,
    height: `${height * view.value.scale}px`,
    transform: `translate(${view.value.x}px, ${view.value.y}px)`,
  }
})

/** 打开时还原现场：已有头像直接载入原图并恢复上次构图，不必重新选文件 */
watch(visible, async (open) => {
  if (!open) return
  error.value = ''
  if (!props.initialSrc) {
    src.value = ''
    imgW.value = 0
    imgH.value = 0
    view.value = { scale: 1, x: 0, y: 0 }
    return
  }
  src.value = props.initialSrc
  try {
    const image = await loadImage(props.initialSrc)
    imgW.value = image.naturalWidth
    imgH.value = image.naturalHeight
    view.value = fromCrop(props.initialCrop, imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT)
  } catch {
    error.value = '原图读取失败，请重新选择图片'
    src.value = ''
  }
})

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('decode failed'))
    image.src = dataUrl
  })
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

/** 长边压到 MAX_SOURCE_EDGE 并统一转 JPEG：原图要进 IndexedDB，且会随版本复制 */
function downscale(image: HTMLImageElement): string {
  const edge = Math.max(image.naturalWidth, image.naturalHeight)
  const ratio = edge > MAX_SOURCE_EDGE ? MAX_SOURCE_EDGE / edge : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', SOURCE_QUALITY)
}

async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许连续选同一个文件
  if (!file) return
  error.value = ''
  if (file.size > MAX_FILE_BYTES) {
    error.value = '图片超过 10MB，请换一张更小的图片'
    return
  }
  busy.value = true
  try {
    const raw = await readFile(file)
    const image = await loadImage(raw)
    const scaled = downscale(image)
    if (!isImageDataUrl(scaled)) {
      error.value = '图片处理失败，请重试'
      return
    }
    const next = await loadImage(scaled)
    src.value = scaled
    imgW.value = next.naturalWidth
    imgH.value = next.naturalHeight
    view.value = defaultView(imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT)
  } catch {
    error.value = '图片读取失败，请确认是 PNG / JPEG / WebP 格式'
  } finally {
    busy.value = false
  }
}

/* ---------- 取景交互：拖拽 / 滚轮 / 滑杆 / 键盘 ---------- */

let dragId: number | null = null
let startX = 0
let startY = 0

function move(x: number, y: number) {
  view.value = clampView(imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT, { ...view.value, x, y })
}
function zoom(next: number) {
  view.value = zoomTo(imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT, view.value, next)
}

function onPointerDown(event: PointerEvent) {
  if (!src.value) return
  dragId = event.pointerId
  startX = event.clientX - view.value.x
  startY = event.clientY - view.value.y
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function onPointerMove(event: PointerEvent) {
  if (dragId !== event.pointerId) return
  move(event.clientX - startX, event.clientY - startY)
}
function onPointerUp(event: PointerEvent) {
  if (dragId !== event.pointerId) return
  dragId = null
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
}
function onWheel(event: WheelEvent) {
  if (!src.value) return
  zoom(view.value.scale * (event.deltaY > 0 ? 0.92 : 1.08))
}
function onSlide(event: Event) {
  zoom(Number((event.target as HTMLInputElement).value))
}
function onKeyDown(event: KeyboardEvent) {
  if (!src.value) return
  const step = 4
  const keys: Record<string, () => void> = {
    ArrowUp: () => move(view.value.x, view.value.y - step),
    ArrowDown: () => move(view.value.x, view.value.y + step),
    ArrowLeft: () => move(view.value.x - step, view.value.y),
    ArrowRight: () => move(view.value.x + step, view.value.y),
    '+': () => zoom(view.value.scale + 0.2),
    '=': () => zoom(view.value.scale + 0.2),
    '-': () => zoom(view.value.scale - 0.2),
  }
  const action = keys[event.key]
  if (!action) return
  event.preventDefault()
  action()
}

function confirm() {
  if (!src.value) {
    error.value = '请先选择一张图片'
    return
  }
  emit('confirm', {
    avatar: src.value,
    avatarCrop: toCrop(imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT, view.value),
  })
  visible.value = false
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="上传头像"
    width="420px"
    class="avatar-dialog"
  >
    <div class="avatar-body">
      <div
        class="avatar-stage"
        :class="{ empty: !src }"
        tabindex="0"
        role="group"
        aria-label="头像取景框，方向键平移，加减号缩放"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
        @keydown="onKeyDown"
      >
        <img
          v-if="src"
          :src="src"
          :style="imgStyle"
          class="avatar-img"
          alt="头像预览"
          draggable="false"
        >
        <p
          v-else
          class="avatar-empty"
        >
          尚未选择图片
        </p>
      </div>

      <div class="avatar-side">
        <p class="avatar-hint">
          取景框固定一寸证件照比例（25×35mm）。拖动图片调整位置，滚轮或下方滑杆缩放。
        </p>
        <label class="avatar-zoom">
          <span>缩放</span>
          <input
            type="range"
            :min="MIN_SCALE"
            :max="MAX_SCALE"
            step="0.01"
            :value="view.scale"
            :disabled="!src"
            @input="onSlide"
          >
        </label>
        <ElButton
          size="small"
          :loading="busy"
          class="avatar-pick"
          @click="fileInput?.click()"
        >
          {{ src ? '更换图片' : '选择图片' }}
        </ElButton>
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="avatar-file"
          @change="onPick"
        >
      </div>
    </div>
    <p
      v-if="error"
      class="form-alert avatar-error"
      role="alert"
    >
      {{ error }}
    </p>
    <template #footer>
      <ElButton @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        class="avatar-confirm"
        :disabled="!src || busy"
        @click="confirm"
      >
        确定
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.avatar-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
/* 取景框尺寸与 avatarCrop.ts 的 BOX_WIDTH / BOX_HEIGHT 一致（5:7），改一处要改两处 */
.avatar-stage {
  position: relative;
  flex-shrink: 0;
  width: 210px;
  height: 294px;
  overflow: hidden;
  border: 1px solid var(--control);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  cursor: grab;
  touch-action: none;
}
.avatar-stage:active {
  cursor: grabbing;
}
.avatar-stage.empty {
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-img {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  user-select: none;
  -webkit-user-drag: none;
}
.avatar-empty {
  color: var(--muted);
  font-size: 12.5px;
}
.avatar-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.avatar-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.avatar-zoom {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--text2);
}
.avatar-zoom input {
  width: 100%;
  accent-color: var(--primary);
}
.avatar-file {
  display: none;
}
.avatar-error {
  margin-top: 12px;
}
@media (max-width: 520px) {
  .avatar-body {
    flex-direction: column;
    align-items: stretch;
  }
  .avatar-stage {
    align-self: center;
  }
}
</style>
