import type { Profile } from '../../storage/types'
import { useResumeStore } from './store'

/**
 * 内置示例资料：虚构的教程人设「王小明」，用于首次使用时一键生成，
 * 避免白屏无从下手。所有学校、公司、奖项均为演示用虚构内容，请替换为自己的资料。
 */
export const EXAMPLE_PROFILE: Omit<Profile, 'id' | 'updatedAt'> = {
  basic: {
    name: '王小明',
    gender: '男',
    degree: '硕士在读',
    school: '华东理工大学 · 软件工程',
    graduation: '2027 届',
    summary: 'Java 后端为底，重点投向 AI 应用开发 / 大模型应用落地',
  },
  education: [
    {
      id: 'edu-master',
      school: '华东理工大学 · 信息科学与工程学院',
      degree: '软件工程（硕士）',
      time: '2024.09 – 2027.06',
      courses: '机器学习、分布式系统、高级算法设计、云计算与大数据',
    },
    {
      id: 'edu-bachelor',
      school: '华东理工大学 · 信息科学与工程学院',
      degree: '软件工程（本科）',
      time: '2020.09 – 2024.06',
      courses: 'Java 程序设计、数据结构、数据库系统原理、软件工程、计算机网络',
    },
  ],
  skills: [
    { id: 'skill-backend', group: '后端开发', detail: '掌握 Java，熟悉 Spring Boot、MyBatis Plus、Spring Security + JWT 认证、Redis 缓存，有完整的后端项目开发经验。' },
    { id: 'skill-data', group: '数据与建模', detail: '熟悉 Python 数据分析与机器学习流程（NumPy、Pandas、scikit-learn、XGBoost），有特征工程和模型训练实战经验。' },
    { id: 'skill-frontend', group: '前端开发', detail: '熟悉 Vue + Element UI，能独立完成管理后台页面开发。' },
    { id: 'skill-ai', group: 'AI 工具使用', detail: '日常使用 Cursor、Claude Code 等 AI 编程工具辅助开发，能结合 AI 工具完成从页面搭建到接口实现的全流程。' },
    { id: 'skill-tools', group: '开发工具', detail: 'Git 版本管理、Swagger 接口文档、Maven 项目构建。' },
  ],
  experiences: [
    {
      id: 'exp-intern',
      org: '示例科技有限公司（虚构）',
      role: '后端开发实习生',
      time: '2024.09 – 2025.03',
      stack: 'Spring Boot / MyBatis Plus / Vue / Redis',
      bullets: [
        '需求分析与模块开发：参与业务平台的需求梳理与核心模块开发，推进数据口径与业务规则统一。',
        '前后端联调与数据可视化：基于 Vue + ECharts 完成数据看板页面开发，配合 WebSocket 实现实时推送展示。',
        '测试上线与问题跟踪：组织多轮联调测试，配合系统部署与试运行，跟踪上线后问题并协调修复。',
        'AI 辅助开发：使用 AI 编程工具辅助代码编写、接口排查与文档整理。',
      ],
    },
    {
      id: 'exp-lab',
      org: '校实验室课题组（虚构）',
      role: '研究助理',
      time: '2024.03 – 2024.09',
      stack: 'Python',
      bullets: [
        '算法开发与实验：基于 Python 实现图像前景分离算法，完成数据预处理与多场景对比实验。',
        '成果归纳：总结算法在不同场景下的适用性与改进方向。',
      ],
    },
  ],
  projects: [
    {
      id: 'proj-admin',
      name: '企业人事管理系统（示例项目）',
      role: '第二负责人',
      time: '2024.03 – 2024.09',
      stack: 'Spring Boot / MyBatis Plus / Spring Security + JWT / Vue / Redis',
      bullets: [
        '业务建模与模块开发：参与开发员工档案、履历、考核、任免记录等 10+ 业务模块。',
        '数据导入导出：基于 Apache POI 和 iText 实现 Excel 批量导入、Word/PDF 档案导出。',
        '权限与安全：基于 Spring Security + JWT 实现用户认证与角色权限控制。',
        '联调测试与上线保障：组织接口联调与功能验证，推动试运行问题修复闭环。',
      ],
    },
    {
      id: 'proj-market',
      name: '校园二手交易小程序（示例项目 · AI 辅助开发）',
      role: '独立开发',
      time: '2025.01 – 2025.02',
      stack: 'Spring Boot / uni-app / MySQL / Redis',
      bullets: [
        '全栈独立开发：独立完成小程序、管理后台与后端接口三端功能。',
        '内容治理：实现帖子审核流程与敏感词过滤机制，设计审核日志支撑内容回溯。',
        '微信生态对接：完成微信小程序 OAuth 授权登录，支持多端统一登录体验。',
        'AI 工具驱动开发：全程使用 AI 编程工具辅助开发，显著提升效率。',
      ],
    },
  ],
  awards: [
    { id: 'award-1', text: '全国大学生数学建模竞赛 · 国家级二等奖（2025）（示例荣誉）' },
    { id: 'award-2', text: '「挑战杯」大学生创新创业大赛 · 省级金奖（2022）（示例荣誉）' },
    { id: 'award-3', text: '本硕连续 4 年获学业奖学金（示例荣誉）' },
    { id: 'award-4', text: '校级三好学生、社会工作奖（2023）（示例荣誉）' },
  ],
  selfEvaluation: [
    'AI 开发实践者：日常使用 AI 编程工具辅助开发，有独立完成完整项目的经验。',
    '全栈落地能力：后端接口、前端页面、小程序三端开发经验，参与过从需求到上线全流程交付。',
    '快速学习与团队推进：本硕连续 4 年奖学金，多次带队参赛获奖。',
  ],
}

/** 一键灌入示例资料（写入当前激活版本的资料池；无版本时先建「AI 岗版」）；重复调用会以示例内容覆盖同名条目（UI 仅在空资料态提供入口）。 */
export async function applyExampleProfile(store: ReturnType<typeof useResumeStore>): Promise<void> {
  if (store.versions.length === 0) {
    await store.createVersion('AI 岗版', 'AI 应用开发 / 大模型应用落地')
  }
  await store.ensureProfile(EXAMPLE_PROFILE.basic.name)
  await store.updateBasic(EXAMPLE_PROFILE.basic)
  for (const key of ['education', 'skills', 'experiences', 'projects', 'awards'] as const) {
    for (const entry of EXAMPLE_PROFILE[key]) {
      await store.upsertEntry(key, entry as never)
    }
  }
  await store.setSelfEvaluation(EXAMPLE_PROFILE.selfEvaluation)
}
