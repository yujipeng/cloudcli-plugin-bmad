# Sprint Retrospective: 当前工作区与历史版本归档

## Sprint 概览

- 日期：2026-04-28
- 分支：feature/sprint-v2-team-run
- 目标：为 bmad-flow 插件增加"当前工作区 + 历史版本归档"的版本管理能力

## 交付成果

### 6 个 Epic，14 个 Story，全部完成

| Epic | Stories | 状态 |
|------|---------|------|
| Epic 1: 扩展版本数据模型 | 1-1, 1-2 | done |
| Epic 2: 后端版本发现与归档建议 | 2-1 ~ 2-5 | done |
| Epic 3: 前端展示 current/archived | 3-1 ~ 3-3 | done |
| Epic 4: 后端归档写接口 | 4-1 ~ 4-3 | done |
| Epic 5: 前端归档交互闭环 | 5-1 ~ 5-2 | done |
| Epic 6: 回归验证 | 6-1 | done |

### 测试结果

- 单元测试：44 个全绿
- E2E 测试：5 个全绿
- TypeScript 编译：无错误
- 构建：成功（index.js 30.0kb, server.js 29.4kb）

### 新增文件

- `src/versionDiscovery.ts` — 版本发现模块（current + archived 并存）
- `src/archiveSuggestion.ts` — 归档建议检测
- `src/archiveExecutor.ts` — 归档执行器（迁移 + 回滚 + 重建）
- `tests/server/archiveCurrentVersion.test.ts` — 归档执行器测试
- `playwright.config.ts` + `e2e/` — E2E 测试基础设施

### 修改文件

- `src/types.ts` — 新增 VersionKind, ArchiveSuggestion
- `src/server.ts` — 使用新模块，新增 POST /version/archive-current
- `src/index.ts` — 版本页签、空状态、归档卡片、确认交互
- `tests/server/flowStatus.test.ts` — 解耦仓库状态依赖
- `tests/server/versionDiscovery.test.ts` — 适配新版本发现模型

## 做得好的地方

1. 模块拆分清晰：versionDiscovery / archiveSuggestion / archiveExecutor 各司其职
2. 读写分离严格：/versions 只读，/version/archive-current 只写
3. 测试先行：基线修复后再开始开发，每个 Epic 完成后立即验证
4. 回滚策略明确：部分迁移失败时尝试回滚，完整迁移后重建失败只报错不回滚

## 需要改进的地方

1. 团队模式被会话边界多次中断，最终改为 TeamLeader 直接执行更高效
2. 基线测试耦合了仓库可变状态，应在 v1 时就用受控夹具
3. archiveSuggestion 的"空工作区"判定目前基于 phase 全 pending，后续可能需要更精确的产物检测

## 技术债务

1. `src/server.ts` 仍然偏大（~520 行），后续可考虑把 YAML 解析和 phase 计算也拆出去
2. `index.ts` 中 `renderMethodologySkeleton` 未使用（pre-existing）
3. E2E harness 使用 stub PluginAPI，未覆盖真实 CloudCLI 宿主环境

## 下一步建议

1. 合并 feature 分支到 main
2. 在真实 CloudCLI 环境中手动验证归档流程
3. 考虑把 v1 的 docs 产物迁移到 docs/v1/ 并测试归档后的版本切换体验
