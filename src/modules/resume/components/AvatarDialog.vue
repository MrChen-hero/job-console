<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import type { AvatarCrop } from '../../../storage/types'
import { isImageDataUrl } from '../../../shared/safeUrl'
import AppIcon from '../../../shared/ui/AppIcon.vue'
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
const dragging = ref(false)
let requestId = 0
onBeforeUnmount(() => { requestId += 1 })

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
  const request = ++requestId
  busy.value = false
  dragging.value = false
  dragId = null
  if (!open) return
  error.value = ''
  if (!props.initialSrc) {
    src.value = ''
    imgW.value = 0
    imgH.value = 0
    view.value = { scale: 1, x: 0, y: 0 }
    return
  }
  src.value = ''
  busy.value = true
  try {
    const image = await loadImage(props.initialSrc)
    if (request !== requestId) return
    src.value = props.initialSrc
    imgW.value = image.naturalWidth
    imgH.value = image.naturalHeight
    view.value = fromCrop(props.initialCrop, imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT)
  } catch {
    if (request !== requestId) return
    error.value = '原图读取失败，请重新选择图片'
    src.value = ''
  } finally {
    if (request === requestId) busy.value = false
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
  // JPEG 没有透明通道，透明 PNG 的空白部分按证件照白底处理。
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', SOURCE_QUALITY)
}

async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许连续选同一个文件
  if (!file) return
  await processFile(file)
}

async function onDrop(event: DragEvent) {
  dragging.value = false
  const files = event.dataTransfer?.files
  if (!files?.length) return
  if (files.length !== 1) {
    error.value = '请每次上传一张图片'
    return
  }
  await processFile(files[0]!)
}

async function processFile(file: File) {
  if (busy.value) return
  error.value = ''
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    error.value = '请选择 PNG / JPEG / WebP 格式的图片'
    return
  }
  if (file.size > MAX_FILE_BYTES) {
    error.value = '图片超过 10MB，请换一张更小的图片'
    return
  }
  busy.value = true
  const request = ++requestId
  try {
    const raw = await readFile(file)
    if (request !== requestId) return
    const image = await loadImage(raw)
    if (request !== requestId) return
    const scaled = downscale(image)
    if (!isImageDataUrl(scaled)) {
      error.value = '图片处理失败，请重试'
      return
    }
    const next = await loadImage(scaled)
    if (request !== requestId) return
    src.value = scaled
    imgW.value = next.naturalWidth
    imgH.value = next.naturalHeight
    view.value = defaultView(imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT)
  } catch {
    if (request !== requestId) return
    error.value = '图片读取失败，请确认是 PNG / JPEG / WebP 格式'
  } finally {
    if (request === requestId) busy.value = false
  }
}

function resetView() {
  view.value = defaultView(imgW.value, imgH.value, BOX_WIDTH, BOX_HEIGHT)
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
  if (busy.value) return
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
    width="660px"
    append-to-body
    class="avatar-dialog"
  >
    <p class="avatar-intro">
      选一张清晰的正面照片，调整到合适的位置。
    </p>
    <div
      class="avatar-body"
      :aria-busy="busy"
    >
      <div class="avatar-workspace">
        <div class="avatar-workspace-label">
          <span>裁剪预览</span><span class="mono">25 × 35 mm</span>
        </div>
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
          <div
            v-else
            class="avatar-empty"
          >
            <AppIcon
              name="user"
              :size="44"
            />
            <span>一寸证件照</span>
          </div>
        </div>
        <p class="avatar-caption">
          {{ src ? '拖动照片调整位置' : '上传后在这里调整构图' }}
        </p>
      </div>
      <div class="avatar-side">
        <button
          type="button"
          class="avatar-upload"
          :class="{ dragging }"
          :disabled="busy"
          @click="fileInput?.click()"
          @dragover.prevent="dragging = !busy"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <span class="avatar-upload-icon"><AppIcon
            name="upload"
            :size="24"
          /></span>
          <strong>{{ busy ? '正在处理图片…' : dragging ? '松开即可上传' : src ? '点击或拖入新照片' : '点击上传或拖入照片' }}</strong>
          <span>PNG / JPEG / WebP · 不超过 10MB</span>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="avatar-file"
          @change="onPick"
        >
        <div class="avatar-adjust">
          <label class="avatar-zoom">
            <span class="avatar-zoom-label">照片缩放 <output class="mono">{{ Math.round(view.scale * 100) }}%</output></span>
            <input
              type="range"
              :min="MIN_SCALE"
              :max="MAX_SCALE"
              step="0.01"
              :value="view.scale"
              :disabled="!src || busy"
              @input="onSlide"
            >
          </label>
          <div class="avatar-scale-range">
            <span>100%</span><span>400%</span>
          </div>
          <ElButton
            size="small"
            :disabled="!src || busy"
            class="avatar-reset"
            @click="resetView"
          >
            恢复居中
          </ElButton>
        </div>
        <p class="avatar-hint">
          也可使用滚轮缩放；聚焦照片后，方向键调整位置，＋ / − 调整大小。
        </p>
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
.avatar-intro { margin: 0 0 18px; color: var(--text2); font-size: 13px; }
.avatar-body { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 24px; }
.avatar-workspace { padding: 14px 19px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--card2); }
.avatar-workspace-label { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 14px; font-size: 11px; color: var(--muted); }
/* box-sizing 保证内部实际取景区域为 210 × 294，与裁剪计算保持一致。 */
.avatar-stage { position: relative; width: 210px; height: 294px; box-sizing: content-box; overflow: hidden; outline: 1px solid var(--control); border-radius: 2px; background: var(--surface-muted); cursor: grab; touch-action: none; }
.avatar-stage:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
.avatar-stage:active { cursor: grabbing; }
.avatar-stage.empty { cursor: default; display: grid; place-items: center; }
.avatar-img { position: absolute; top: 0; left: 0; transform-origin: top left; user-select: none; -webkit-user-drag: none; }
.avatar-empty { display: grid; justify-items: center; gap: 12px; color: var(--muted); font-size: 12px; }
.avatar-caption { text-align: center; margin-top: 12px; color: var(--muted); font-size: 11px; }
.avatar-side { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.avatar-upload { display: grid; justify-items: center; gap: 9px; width: 100%; padding: 22px 12px; border: 1px dashed var(--control); border-radius: var(--r-md); background: var(--card); text-align: center; transition: background .16s, border-color .16s; }
.avatar-upload > * { pointer-events: none; }
.avatar-upload:hover, .avatar-upload.dragging { border-color: var(--primary); background: var(--primary-soft); }
.avatar-upload:disabled { cursor: wait; opacity: .65; }
.avatar-upload-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: var(--r-lg); background: var(--primary-soft); color: var(--primary-text); }
.avatar-upload strong { font-size: 13px; font-weight: var(--fw-semibold); color: var(--text); }
.avatar-upload > span:last-child { font-size: 11px; color: var(--muted); }
.avatar-adjust { padding-top: 2px; }
.avatar-zoom { display: grid; gap: 14px; font-size: 12px; color: var(--text2); }
.avatar-zoom-label { display: flex; justify-content: space-between; align-items: baseline; }
.avatar-zoom output { color: var(--primary-text); font-weight: var(--fw-semibold); }
.avatar-zoom input { width: 100%; accent-color: var(--primary); }
.avatar-scale-range { display: flex; justify-content: space-between; margin: 5px 0 14px; color: var(--muted); font-size: 10px; }
.avatar-hint { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; line-height: 1.7; }
.avatar-file { display: none; }
.avatar-error { margin-top: 16px; }
@media (max-width: 560px) {
  .avatar-body { grid-template-columns: 1fr; gap: 16px; }
  .avatar-workspace { display: grid; justify-items: center; padding: 12px; }
  .avatar-workspace-label { width: 210px; }
  .avatar-upload { padding: 14px; }
  .avatar-side { gap: 14px; }
  .avatar-hint { display: none; }
}
</style>
