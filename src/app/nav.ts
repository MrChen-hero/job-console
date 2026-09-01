export interface NavItem {
  name: string
  path: string
  title: string
  crumb: string
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'dashboard', path: '/', title: '工作台', crumb: '求职进度总览' },
  { name: 'tracker', path: '/tracker', title: '投递管理', crumb: '台账 · 看板 · 面试记录' },
  { name: 'resume', path: '/resume', title: '简历管理', crumb: '资料池 · 多版本 · A4 打印' },
  { name: 'library', path: '/library', title: '材料库', crumb: '自我介绍 · 高频问题 · 深挖答案' },
  { name: 'showcase', path: '/showcase', title: '项目演示', crumb: '对外展示的门户站点' },
]
