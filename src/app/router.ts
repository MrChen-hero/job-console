import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '../shared/layout/AppLayout.vue'

const views = {
  dashboard: () => import('../modules/dashboard/views/DashboardView.vue'),
  tracker: () => import('../modules/tracker/views/TrackerView.vue'),
  resume: () => import('../modules/resume/views/ResumeView.vue'),
  library: () => import('../modules/library/views/LibraryView.vue'),
  showcase: () => import('../modules/showcase/views/ShowcaseView.vue'),
} as const

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'dashboard', component: views.dashboard, meta: { title: '工作台', crumb: '求职进度总览' } },
        { path: 'tracker', name: 'tracker', component: views.tracker, meta: { title: '投递管理', crumb: '台账 · 看板 · 面试记录' } },
        { path: 'resume', name: 'resume', component: views.resume, meta: { title: '简历管理', crumb: '资料池 · 多版本 · A4 打印' } },
        { path: 'library', name: 'library', component: views.library, meta: { title: '材料库', crumb: '自我介绍 · 高频问题 · 深挖答案' } },
        { path: 'showcase', name: 'showcase', component: views.showcase, meta: { title: '项目演示', crumb: '对外展示的门户站点' } },
      ],
    },
  ],
})
