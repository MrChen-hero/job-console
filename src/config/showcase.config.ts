export interface ShowcaseDemoPage {
  title: string
  points: string[]
}

export interface ShowcaseProject {
  id: string
  title: string
  eyebrow: string
  accent: 'violet' | 'teal' | 'amber' | 'rose'
  summary: string
  stack: string[]
  /** 纵向第一页（要点式演示页）；上传的交互式 HTML demo 追加其后 */
  demo: ShowcaseDemoPage
}

/**
 * 演示站项目内容：全部为虚构的教程示例（公司/项目均为演示用途，请替换为自己的项目）。
 * projectId 同时关联 runtime/local demo 附件。
 */
export const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  {
    id: 'organs-system',
    title: '企业人事管理系统',
    eyebrow: '示例公司 · 第二负责人（虚构示例）',
    accent: 'violet',
    summary: '员工信息全生命周期管理：10+ 业务模块、Excel 批量导入与 Word/PDF 档案导出、Spring Security + JWT 权限体系，完成交付上线。',
    stack: ['Spring Boot', 'MyBatis Plus', 'Vue', 'Redis'],
    demo: {
      title: '演示页 · 权限与数据流转',
      points: [
        'RBAC 模型：角色–菜单–数据范围三层关联，不同层级用户各见其数据',
        '批量导入：POI 字段映射 + 校验规则，错误行定位回显',
        '档案导出：iText 模板化生成 Word / PDF 员工档案',
      ],
    },
  },
  {
    id: 'campus-market',
    title: '校园二手交易小程序',
    eyebrow: '三端全栈 · AI 辅助开发（虚构示例）',
    accent: 'teal',
    summary: '独立完成微信小程序、管理后台与后端接口三端：帖子、评论、点赞收藏、关注与消息通知，内置审核流程与敏感词过滤。',
    stack: ['uni-app', 'Spring Boot', 'MySQL', 'Cursor / Claude Code'],
    demo: {
      title: '演示页 · 内容治理设计',
      points: [
        '审核状态机：待审核 → 通过 / 拒绝，动作全量落审核日志',
        '敏感词过滤：发布时后端校验，命中拦截并留痕',
        '微信 OAuth：code 换 openid 关联系统用户，多端统一登录',
      ],
    },
  },
  {
    id: 'motor-platform',
    title: '设备监控数据平台',
    eyebrow: '示例科技公司 · 开发实习生（虚构示例）',
    accent: 'rose',
    summary: '参与需求梳理与核心模块开发，对接运维、经营、信息化多业务方；ECharts 数据看板 + WebSocket 实时推送，组织联调测试与上线。',
    stack: ['Spring Boot', 'Vue', 'ECharts', 'WebSocket'],
    demo: {
      title: '演示页 · 实时看板',
      points: [
        '数据看板：ECharts 多维图表展示经营与设备数据',
        '实时推送：WebSocket 设备数据实时更新',
        '上线闭环：多轮联调 → 部署试运行 → 问题跟踪修复',
      ],
    },
  },
]
