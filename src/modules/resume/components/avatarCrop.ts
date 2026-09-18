import type { AvatarCrop } from '../../../storage/types'

/* 一寸证件照 25mm × 35mm。取景框比例固定，"调整裁剪框大小"一律用缩放图片实现。 */
export const CROP_RATIO_W = 5
export const CROP_RATIO_H = 7
/** 弹窗取景框尺寸（CSS px），5:7 */
export const BOX_WIDTH = 210
export const BOX_HEIGHT = 294

export const MIN_SCALE = 1
export const MAX_SCALE = 4

/** 存进库的原图长边上限：4× 最大缩放时仍留约 250×350 源像素喂给 25×35mm 打印框 */
export const MAX_SOURCE_EDGE = 1400
export const SOURCE_QUALITY = 0.85
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export interface ViewState {
  scale: number
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** scale = 1 时的图片显示尺寸：恰好铺满取景框，四边不留白 */
export function coverSize(imgW: number, imgH: number, boxW: number, boxH: number): { width: number; height: number } {
  if (!(imgW > 0) || !(imgH > 0)) return { width: boxW, height: boxH }
  const factor = Math.max(boxW / imgW, boxH / imgH)
  return { width: imgW * factor, height: imgH * factor }
}

/** 钳制缩放区间与平移边界，任何时刻取景框内都不会露出空白 */
export function clampView(imgW: number, imgH: number, boxW: number, boxH: number, view: ViewState): ViewState {
  const scale = clamp(view.scale, MIN_SCALE, MAX_SCALE)
  const { width, height } = coverSize(imgW, imgH, boxW, boxH)
  const dw = width * scale
  const dh = height * scale
  return {
    scale,
    // 下界可能因浮点误差略大于 0，先取 min(0, …) 兜住
    x: clamp(view.x, Math.min(0, boxW - dw), 0),
    y: clamp(view.y, Math.min(0, boxH - dh), 0),
  }
}

/** 初始取景：居中 cover */
export function defaultView(imgW: number, imgH: number, boxW: number, boxH: number): ViewState {
  const { width, height } = coverSize(imgW, imgH, boxW, boxH)
  return clampView(imgW, imgH, boxW, boxH, { scale: 1, x: (boxW - width) / 2, y: (boxH - height) / 2 })
}

/** 以取景框中心为锚点缩放，避免滑杆一动构图就整体跑偏 */
export function zoomTo(imgW: number, imgH: number, boxW: number, boxH: number, view: ViewState, nextScale: number): ViewState {
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
  if (!(view.scale > 0)) return clampView(imgW, imgH, boxW, boxH, { ...view, scale })
  const ratio = scale / view.scale
  const cx = boxW / 2
  const cy = boxH / 2
  return clampView(imgW, imgH, boxW, boxH, {
    scale,
    x: cx - (cx - view.x) * ratio,
    y: cy - (cy - view.y) * ratio,
  })
}

/** 取景状态 → 归一化裁剪框（原图的 0–1 比例）。结果恒满足 w·imgW : h·imgH = 5 : 7 */
export function toCrop(imgW: number, imgH: number, boxW: number, boxH: number, view: ViewState): AvatarCrop {
  const { width, height } = coverSize(imgW, imgH, boxW, boxH)
  const dw = width * view.scale
  const dh = height * view.scale
  if (!(dw > 0) || !(dh > 0)) return { x: 0, y: 0, w: 1, h: 1 }
  return {
    x: clamp(-view.x / dw, 0, 1),
    y: clamp(-view.y / dh, 0, 1),
    w: clamp(boxW / dw, 0, 1),
    h: clamp(boxH / dh, 0, 1),
  }
}

/** 裁剪框 → 取景状态，重裁时用来还原上次构图 */
export function fromCrop(crop: AvatarCrop | null | undefined, imgW: number, imgH: number, boxW: number, boxH: number): ViewState {
  if (!crop || !(crop.w > 0) || !(crop.h > 0)) return defaultView(imgW, imgH, boxW, boxH)
  const { width } = coverSize(imgW, imgH, boxW, boxH)
  const dw = boxW / crop.w
  const dh = boxH / crop.h
  const scale = width > 0 ? dw / width : 1
  return clampView(imgW, imgH, boxW, boxH, { scale, x: -crop.x * dw, y: -crop.y * dh })
}

/** 裁剪框 → 定位样式。纯百分比相对容器解析，因此分辨率无关：
 * 预览缩放态、100% 态与打印态共用同一套参数，构图完全一致。
 */
export function cropStyle(crop: AvatarCrop | null | undefined): Record<string, string> {
  if (!crop || !(crop.w > 0) || !(crop.h > 0)) {
    // 没有裁剪参数（旧数据或导入数据）：退回居中 cover，与首次上传的默认取景等价
    return { width: '100%', height: '100%', left: '0', top: '0', objectFit: 'cover' }
  }
  return {
    width: `${100 / crop.w}%`,
    height: `${100 / crop.h}%`,
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
    objectFit: 'fill',
  }
}
