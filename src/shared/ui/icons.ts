/**
 * 线性图标表 —— 全站唯一图标来源。
 *
 * 每个图标是一组 SVG 图元描述；AppIcon 按 tag + attrs 逐个渲染，不用 v-html，
 * 因此不需要放宽 vue/no-v-html。描边由 AppIcon 统一设定（stroke: currentColor /
 * fill: none），图标颜色跟随文字色。
 * 图元取自视觉基准 design-demo/cool-slate-light-demo.html，已在该原型中验证渲染效果。
 */
export interface IconPart {
  tag: 'path' | 'circle' | 'rect'
  attrs: Record<string, string>
}

export const ICONS: Record<string, IconPart[]> = {
  grid: [{tag:'rect',attrs:{x:'3',y:'3',width:'7.5',height:'7.5',rx:'1.5'}},{tag:'rect',attrs:{x:'13.5',y:'3',width:'7.5',height:'7.5',rx:'1.5'}},{tag:'rect',attrs:{x:'3',y:'13.5',width:'7.5',height:'7.5',rx:'1.5'}},{tag:'rect',attrs:{x:'13.5',y:'13.5',width:'7.5',height:'7.5',rx:'1.5'}}],
  case: [{tag:'rect',attrs:{x:'3',y:'7',width:'18',height:'13',rx:'2'}},{tag:'path',attrs:{d:'M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18'}}],
  file: [{tag:'path',attrs:{d:'M6 3h9l4 4v14H6z'}},{tag:'path',attrs:{d:'M14 3v5h5M9 13h6M9 17h6'}}],
  layers: [{tag:'path',attrs:{d:'m12 3 8 4.5-8 4.5-8-4.5z'}},{tag:'path',attrs:{d:'m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5'}}],
  play: [{tag:'rect',attrs:{x:'3',y:'4',width:'18',height:'14',rx:'2'}},{tag:'path',attrs:{d:'m10 8.5 5 2.5-5 2.5zM8 21h8'}}],
  menu: [{tag:'path',attrs:{d:'M4 7h16M4 12h16M4 17h16'}}],
  sun: [{tag:'circle',attrs:{cx:'12',cy:'12',r:'4.2'}},{tag:'path',attrs:{d:'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4'}}],
  moon: [{tag:'path',attrs:{d:'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5'}}],
  search: [{tag:'circle',attrs:{cx:'11',cy:'11',r:'7'}},{tag:'path',attrs:{d:'m20 20-4.2-4.2'}}],
  plus: [{tag:'path',attrs:{d:'M12 5v14M5 12h14'}}],
  export: [{tag:'rect',attrs:{x:'3',y:'3',width:'18',height:'18',rx:'2'}},{tag:'path',attrs:{d:'M12 8v8M8 12h8'}}],
  edit: [{tag:'path',attrs:{d:'M4 20h4l10-10-4-4L4 16z'}},{tag:'path',attrs:{d:'m14.5 5.5 4 4'}}],
  star: [{tag:'path',attrs:{d:'m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.8-5 2.8 1-5.6-4-3.9 5.5-.8z'}}],
  trash: [{tag:'path',attrs:{d:'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6'}}],
  grip: [{tag:'circle',attrs:{cx:'9',cy:'6',r:'1.3'}},{tag:'circle',attrs:{cx:'15',cy:'6',r:'1.3'}},{tag:'circle',attrs:{cx:'9',cy:'12',r:'1.3'}},{tag:'circle',attrs:{cx:'15',cy:'12',r:'1.3'}},{tag:'circle',attrs:{cx:'9',cy:'18',r:'1.3'}},{tag:'circle',attrs:{cx:'15',cy:'18',r:'1.3'}}],
  chev: [{tag:'path',attrs:{d:'m9 5 7 7-7 7'}}],
  left: [{tag:'path',attrs:{d:'m14 6-6 6 6 6'}}],
  right: [{tag:'path',attrs:{d:'m10 6 6 6-6 6'}}],
  first: [{tag:'path',attrs:{d:'m16 6-6 6 6 6M7 5v14'}}],
  last: [{tag:'path',attrs:{d:'m8 6 6 6-6 6M17 5v14'}}],
  download: [{tag:'path',attrs:{d:'M12 4v10m0 0 4-4m-4 4-4-4M4 19h16'}}],
  upload: [{tag:'path',attrs:{d:'M12 16V6m0 0 4 4m-4-4-4 4M4 19h16'}}],
  printer: [{tag:'path',attrs:{d:'M7 9V4h10v5M7 18H5v-6h14v6h-2M8 14h8v6H8z'}}],
  share: [{tag:'path',attrs:{d:'M12 15V4m0 0-4 4m4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5'}}],
  copy: [{tag:'rect',attrs:{x:'8',y:'8',width:'12',height:'12',rx:'2'}},{tag:'path',attrs:{d:'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'}}],
  user: [{tag:'circle',attrs:{cx:'12',cy:'8',r:'4'}},{tag:'path',attrs:{d:'M4.5 20a7.5 7.5 0 0 1 15 0'}}],
  help: [{tag:'circle',attrs:{cx:'12',cy:'12',r:'8.5'}},{tag:'path',attrs:{d:'M9.7 9.5a2.4 2.4 0 1 1 3.5 2.2c-.8.5-1.2 1-1.2 1.8M12 17h.01'}}],
  target: [{tag:'circle',attrs:{cx:'12',cy:'12',r:'8.5'}},{tag:'circle',attrs:{cx:'12',cy:'12',r:'4'}},{tag:'path',attrs:{d:'M12 12h.01'}}],
  book: [{tag:'path',attrs:{d:'M6 4h13v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'}},{tag:'path',attrs:{d:'M9 4v16'}}],
  mark: [{tag:'path',attrs:{d:'M7 4h10v17l-5-4-5 4z'}}],
  phone: [{tag:'path',attrs:{d:'M6 4h4l1.5 4-2 1.5a10 10 0 0 0 5 5L16 12.5 20 14v4a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z'}}],
  mail: [{tag:'rect',attrs:{x:'3',y:'5',width:'18',height:'14',rx:'2'}},{tag:'path',attrs:{d:'m3.5 6.5 8.5 6 8.5-6'}}],
  pin: [{tag:'path',attrs:{d:'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z'}},{tag:'circle',attrs:{cx:'12',cy:'10',r:'2.6'}}],
  link: [{tag:'path',attrs:{d:'M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.5 6'}},{tag:'path',attrs:{d:'M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L12.5 18'}}],
  history: [{tag:'path',attrs:{d:'M4 12a8 8 0 1 0 3-6.2M4 4v4h4'}},{tag:'path',attrs:{d:'M12 8v4.5l3 2'}}],
}

export const ICON_NAMES = Object.keys(ICONS)
