# 贡献指南

欢迎提交可复现的问题和范围明确的改进。先浏览 README、AGENTS.md 和 docs/tech-debt.md，避免重复已知限制。

1. Fork 仓库并创建功能分支，使用 Node.js 24.x 和 `npm ci`。
2. 大改动先通过 Issue 说明目标与兼容影响；小修复可直接提交 PR（合并请求）。
3. 按现有模块边界修改，有业务行为变化时补对应测试。
4. 运行 `npm run lint`、`npm run test:run`、`npm run build`；涉及界面或数据流程时运行 `npm run test:e2e -- --workers=2`。首次需 `npx playwright install chromium`。
5. 用 `git diff --check` 检查补丁，说明实际运行的验证及未验证项。

提交仅使用虚构数据，不附带真实简历、备份、密钥或浏览器用户目录。新文本使用 UTF-8 无 BOM。截图通过 `npm run shots` 更新，不手工修改产品界面来制造截图效果。

遇到 4173 端口占用时，先核对进程是否为自己启动的测试服务器；等待正在执行的测试结束，不要结束其他用户进程或复用未知服务器。
