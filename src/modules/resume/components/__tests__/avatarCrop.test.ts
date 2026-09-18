import { describe, expect, it } from 'vitest'
import {
  BOX_HEIGHT,
  BOX_WIDTH,
  MAX_SCALE,
  MIN_SCALE,
  clampView,
  coverSize,
  cropStyle,
  defaultView,
  fromCrop,
  isValidCrop,
  toCrop,
  zoomTo,
} from '../avatarCrop'

const BOX: [number, number] = [BOX_WIDTH, BOX_HEIGHT]
/** 裁剪框在原图像素上的宽高比，必须恒等于取景框的 5:7 */
function pixelRatio(crop: { w: number; h: number }, imgW: number, imgH: number): number {
  return (crop.w * imgW) / (crop.h * imgH)
}

describe('avatarCrop', () => {
  it('取景框是 5:7', () => {
    expect(BOX_WIDTH / BOX_HEIGHT).toBeCloseTo(5 / 7, 5)
  })

  it.each([
    ['横图', 1600, 900],
    ['竖图', 900, 1600],
    ['方图', 1000, 1000],
    ['正好 5:7', 500, 700],
  ])('coverSize 铺满取景框且不留白：%s', (_label, imgW, imgH) => {
    const { width, height } = coverSize(imgW, imgH, ...BOX)
    expect(width).toBeGreaterThanOrEqual(BOX_WIDTH - 1e-6)
    expect(height).toBeGreaterThanOrEqual(BOX_HEIGHT - 1e-6)
    // 等比：至少一边恰好贴合
    expect(Math.min(width - BOX_WIDTH, height - BOX_HEIGHT)).toBeCloseTo(0, 5)
    expect(width / height).toBeCloseTo(imgW / imgH, 5)
  })

  it('clampView 把缩放钳在区间内', () => {
    expect(clampView(1000, 1000, ...BOX, { scale: 0.2, x: 0, y: 0 }).scale).toBe(MIN_SCALE)
    expect(clampView(1000, 1000, ...BOX, { scale: 99, x: 0, y: 0 }).scale).toBe(MAX_SCALE)
  })

  it('clampView 保证四边不留白', () => {
    const { width, height } = coverSize(1600, 900, ...BOX)
    const view = clampView(1600, 900, ...BOX, { scale: 1, x: 500, y: 500 })
    expect(view.x).toBeLessThanOrEqual(0)
    expect(view.y).toBeLessThanOrEqual(0)
    const pulled = clampView(1600, 900, ...BOX, { scale: 1, x: -9999, y: -9999 })
    expect(pulled.x).toBeCloseTo(BOX_WIDTH - width, 5)
    expect(pulled.y).toBeCloseTo(BOX_HEIGHT - height, 5)
  })

  it.each([
    ['横图', 1600, 900],
    ['竖图', 900, 1600],
    ['方图', 1000, 1000],
  ])('toCrop 输出落在 0–1 且原图像素比恒为 5:7：%s', (_label, imgW, imgH) => {
    const crop = toCrop(imgW, imgH, ...BOX, defaultView(imgW, imgH, ...BOX))
    for (const v of [crop.x, crop.y, crop.w, crop.h]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(crop.x + crop.w).toBeLessThanOrEqual(1.0001)
    expect(crop.y + crop.h).toBeLessThanOrEqual(1.0001)
    expect(pixelRatio(crop, imgW, imgH)).toBeCloseTo(5 / 7, 5)
  })

  it('缩放后的裁剪框仍是 5:7 且更小', () => {
    const base = defaultView(1600, 900, ...BOX)
    const zoomed = zoomTo(1600, 900, ...BOX, base, 2)
    const a = toCrop(1600, 900, ...BOX, base)
    const b = toCrop(1600, 900, ...BOX, zoomed)
    expect(pixelRatio(b, 1600, 900)).toBeCloseTo(5 / 7, 5)
    expect(b.w).toBeLessThan(a.w)
    expect(b.h).toBeLessThan(a.h)
  })

  it('zoomTo 以取景框中心为锚点，中心对应的原图位置不变', () => {
    const before = toCrop(1600, 900, ...BOX, defaultView(1600, 900, ...BOX))
    const after = toCrop(1600, 900, ...BOX, zoomTo(1600, 900, ...BOX, defaultView(1600, 900, ...BOX), 2.5))
    expect(before.x + before.w / 2).toBeCloseTo(after.x + after.w / 2, 5)
    expect(before.y + before.h / 2).toBeCloseTo(after.y + after.h / 2, 5)
  })

  it.each([
    ['横图', 1600, 900],
    ['竖图', 900, 1600],
    ['方图', 1000, 1000],
  ])('toCrop → fromCrop 往返一致，重裁能还原现场：%s', (_label, imgW, imgH) => {
    const view = clampView(imgW, imgH, ...BOX, { scale: 2.3, x: -120, y: -260 })
    const crop = toCrop(imgW, imgH, ...BOX, view)
    const restored = fromCrop(crop, imgW, imgH, ...BOX)
    expect(restored.scale).toBeCloseTo(view.scale, 4)
    expect(restored.x).toBeCloseTo(view.x, 4)
    expect(restored.y).toBeCloseTo(view.y, 4)
  })

  it('fromCrop 对缺失或非法裁剪框退回居中 cover', () => {
    const fallback = fromCrop(null, 1600, 900, ...BOX)
    expect(fallback).toEqual(defaultView(1600, 900, ...BOX))
    expect(fromCrop({ x: 0, y: 0, w: 0, h: 0 }, 1600, 900, ...BOX)).toEqual(fallback)
  })

  it('cropStyle 把裁剪区映射成百分比定位', () => {
    // 方图默认取景：宽度方向裁掉两侧，w = 5/7
    const crop = toCrop(1000, 1000, ...BOX, defaultView(1000, 1000, ...BOX))
    const style = cropStyle(crop)
    expect(parseFloat(style.width!)).toBeCloseTo(140, 1) // 100 / (5/7)
    expect(parseFloat(style.height!)).toBeCloseTo(100, 1)
    expect(parseFloat(style.left!)).toBeCloseTo(-20, 1)
    expect(parseFloat(style.top!)).toBeCloseTo(0, 1)
    expect(style.objectFit).toBe('fill')
  })

  it('cropStyle 无裁剪参数时退回 object-fit: cover', () => {
    expect(cropStyle(null).objectFit).toBe('cover')
    expect(cropStyle({ x: 0, y: 0, w: 0, h: 1 }).objectFit).toBe('cover')
  })

  it('isValidCrop 拦截越界与非数值', () => {
    expect(isValidCrop({ x: 0, y: 0, w: 1, h: 1 })).toBe(true)
    expect(isValidCrop({ x: 0.5, y: 0, w: 0.6, h: 1 })).toBe(false) // x + w > 1
    expect(isValidCrop({ x: 0, y: 0, w: 0, h: 1 })).toBe(false)
    expect(isValidCrop({ x: -0.1, y: 0, w: 0.5, h: 0.5 })).toBe(false)
    expect(isValidCrop({ x: 0, y: 0, w: Number.NaN, h: 1 })).toBe(false)
    expect(isValidCrop('nope')).toBe(false)
    expect(isValidCrop(null)).toBe(false)
  })
})
