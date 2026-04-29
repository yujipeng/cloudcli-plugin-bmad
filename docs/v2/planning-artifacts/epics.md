---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/planning-artifacts/bmad-flow-当前工作区与历史版本归档方案.md
  - docs/planning-artifacts/architecture.md
---

# bmad-flow 当前工作区与历史版本归档 - Epic Breakdown

## Overview

本文档将《bmad-flow 当前工作区与历史版本归档方案》和架构设计拆分为可实施的 epics 和 stories，按最小可交付增量组织。

## Requirements Inventory

### Functional Requirements

FR1: 版本发现同时识别顶层 current workspace 与 `docs/vN/` 历史版本
FR2: current workspace 建模为 `__current__`，kind = `current`
FR3: 历史版本建模为 `vN`，kind = `archived`
FR4: current 永远排在版本列表第一位，历史版本按版本号倒序
FR5: 对 current workspace 计算 archiveSuggestion（retrospective done + 非空 + 目标可用）
FR6: archiveSuggestion 仅对 current 生效，archived 版本不出现
FR7: 新增 `POST /version/archive-current` 写接口
FR8: 归档执行：移动 current → `docs/vN/`，重建空顶层目录
FR9: 归档前重新校验，目标已存在时拒绝
FR10: 迁移失败时尝试回滚
FR11: 前端 `当前` 页签与历史版本页签样式区分
FR12: current workspace 为空时显示专用空状态
FR13: archiveSuggestion 卡片独立于普通 nextAction
FR14: 归档按钮点击后需确认交互
FR15: 归档成功后自动刷新版本列表
FR16: 页面刷新只检测，不执行迁移

### Non-Functional Requirements

NFR1: `/versions` 只读接口无副作用
NFR2: 已有多版本与多 Sprint 展示能力不回退
NFR3: `server.ts` 归档逻辑拆分为独立模块

---

## Epic 1: 扩展版本数据模型

### 目标
为 current/archived 语义和 archiveSuggestion 提供类型基础。

### Story 1-1: 扩展 VersionInfo 增加 kind 字段

**AC:**
- `VersionInfo` 增加 `kind: VersionKind` 字段
- `VersionKind = 'current' | 'archived'`
- 现有代码中所有 `VersionInfo` 构造点都补上 kind
- TypeScript 编译通过

**涉及文件:** `src/types.ts`, `src/server.ts`
**覆盖:** FR2, FR3

### Story 1-2: 新增 ArchiveSuggestion 类型与 VersionFlowData 扩展

**AC:**
- 新增 `ArchiveSuggestion` interface（enabled, targetVersion, reason）
- `VersionFlowData` 增加 `archiveSuggestion?: ArchiveSuggestion`
- TypeScript 编译通过
- 现有测试不回退

**涉及文件:** `src/types.ts`
**覆盖:** FR5

---

## Epic 2: 改造后端版本发现与归档建议

### 目标
让 `/versions` 同时返回 current workspace 与 archived 版本，并输出归档建议。

### Story 2-1: 拆出 versionDiscovery 模块

**AC:**
- 新建 `src/versionDiscovery.ts`
- 将 `discoverVersions()` 从 `server.ts` 迁移并重命名为 `discoverVersionEntries()`
- 新增 `hasCurrentWorkspace(planBase, implBase)` 函数
- 新增 `getNextArchiveVersion(existingVersions)` 函数
- `server.ts` 改为 import 调用
- 现有测试通过

**涉及文件:** `src/versionDiscovery.ts`（新建）, `src/server.ts`
**覆盖:** FR1, NFR3

### Story 2-2: 改造版本发现支持 current + archived 并存

**AC:**
- `discoverVersionEntries()` 同时扫描顶层 current workspace 和 `docs/vN/`
- 顶层存在时返回 `{ id: '__current__', kind: 'current', ... }`
- 历史版本返回 `{ id: 'vN', kind: 'archived', ... }`
- current 排第一，历史版本按版本号倒序
- 无顶层工作区时不返回 current 条目
- 仅有顶层工作区、无历史版本时返回单个 current

**涉及文件:** `src/versionDiscovery.ts`
**覆盖:** FR1, FR2, FR3, FR4

### Story 2-3: 实现 archiveSuggestion 检测

**AC:**
- 新建 `src/archiveSuggestion.ts`
- 实现 `isWorkspaceEmpty(planDir, implDir)` 纯函数
- 实现 `detectArchiveSuggestion(currentVersion, phases, archivedVersions)` 纯函数
- 仅对 kind=current 返回 enabled
- retrospective 未完成 → disabled + reason
- 工作区为空 → disabled + reason
- 目标版本已存在 → disabled + reason
- 全部满足 → enabled + targetVersion

**涉及文件:** `src/archiveSuggestion.ts`（新建）
**覆盖:** FR5, FR6

### Story 2-4: 集成到 /versions 端点

**AC:**
- `getVersionedData()` 使用新的 `discoverVersionEntries()`
- 对 current 版本附加 `archiveSuggestion`
- `/versions` 响应结构包含 current + archived + archiveSuggestion
- 现有 `/flow` 端点行为不变
- 现有多版本测试不回退

**涉及文件:** `src/server.ts`
**覆盖:** FR1, FR5, NFR1, NFR2

### Story 2-5: 版本发现与归档建议单元测试

**AC:**
- 更新 `tests/server/versionDiscovery.test.ts`：
  - 仅顶层 current → 返回单个 current
  - current + v1 → 返回 current 在前、v1 在后
  - current + v1 + v2 → current, v2, v1 顺序
  - 无顶层工作区、仅有 v1 → 只返回 v1
- 新建 `tests/server/archiveSuggestion.test.ts`：
  - retrospective done + 非空 + 目标可用 → enabled
  - retrospective 未完成 → disabled
  - 工作区为空 → disabled
  - 目标版本已存在 → disabled
  - archived 版本 → 不返回 suggestion

**涉及文件:** `tests/server/versionDiscovery.test.ts`, `tests/server/archiveSuggestion.test.ts`（新建）
**覆盖:** FR1-FR6

---

## Epic 3: 前端展示 current workspace 与归档建议

### 目标
让前端正确展示 current/archived 语义、空状态与归档建议卡片。

### Story 3-1: 版本页签支持 current/archived 语义

**AC:**
- `renderVersionTabs()` 识别 `kind` 字段
- current 版本显示为 `当前`（zh-CN）/ `Current`（en）
- current 页签样式与 archived 有明显区分
- current 永远排在第一位
- 无版本项目（unversioned）行为不变

**涉及文件:** `src/index.ts`
**覆盖:** FR4, FR11

### Story 3-2: current workspace 空状态渲染

**AC:**
- 当 current workspace 存在但无产物时，显示专用空状态
- 空状态文案：`当前迭代尚未开始`
- 空状态 nextAction 指向 `/bmad-product-brief` 或 `/bmad-create-prd`
- 不与"未检测到 BMad 项目"混淆
- i18n 支持 zh-CN / en

**涉及文件:** `src/index.ts`
**覆盖:** FR12

### Story 3-3: archiveSuggestion 卡片渲染

**AC:**
- 当 `archiveSuggestion.enabled === true` 时显示归档建议卡片
- 卡片标题：`当前版本已完成`
- 卡片说明：`可归档为 vN`
- 卡片包含主按钮：`归档为 vN`
- 卡片渲染优先级高于普通 nextAction
- archiveSuggestion 不存在或 disabled 时不显示
- i18n 支持 zh-CN / en

**涉及文件:** `src/index.ts`
**覆盖:** FR13

---

## Epic 4: 后端归档写接口

### 目标
提供安全的归档执行能力，包含校验、迁移、重建与回滚。

### Story 4-1: 实现归档执行器

**AC:**
- 新建 `src/archiveExecutor.ts`
- 实现 `validateArchiveRequest(projectPath)` — 重新校验 current workspace 状态
- 实现 `archiveCurrentWorkspace(planDir, implDir, targetDir)` — 执行目录迁移
- 实现 `rebuildCurrentWorkspace(planDir, implDir)` — 重建空目录
- 实现 `rollbackArchiveIfPossible(planDir, implDir, targetDir)` — 部分迁移时回滚
- 目标目录已存在时抛出明确错误
- 迁移失败时尝试回滚并返回错误信息

**涉及文件:** `src/archiveExecutor.ts`（新建）
**覆盖:** FR7, FR8, FR9, FR10, NFR3

### Story 4-2: 新增 POST /version/archive-current 路由

**AC:**
- `server.ts` 新增 `POST /version/archive-current` 路由
- 解析请求体中的 `path` 参数
- 调用 `validateArchiveRequest()` → `archiveCurrentWorkspace()` → `rebuildCurrentWorkspace()`
- 成功后返回最新 `VersionedResponse`
- 失败返回 4xx + 错误信息
- `safePath()` 校验适用

**涉及文件:** `src/server.ts`
**覆盖:** FR7, FR16, NFR1

### Story 4-3: 归档执行器单元测试

**AC:**
- 新建 `tests/server/archiveCurrentVersion.test.ts`
- 测试用例：
  - 成功归档 current → v1
  - 已有 v1 时归档 → v2
  - 目标目录已存在 → 报错
  - planning 迁移成功但 implementation 失败 → 回滚 planning
  - 归档后顶层目录被重建为空
  - retrospective 未完成时拒绝归档

**涉及文件:** `tests/server/archiveCurrentVersion.test.ts`（新建）
**覆盖:** FR7-FR10

---

## Epic 5: 前端归档交互闭环

### 目标
让用户能在 UI 内完成归档确认与执行。

### Story 5-1: 归档确认交互

**AC:**
- 点击归档按钮后显示确认提示
- 确认文案说明：
  - 当前工作区将迁移到 `docs/vN/`
  - 系统会重建空的顶层工作区
  - 历史版本不会被覆盖
- 确认后调用 `POST /version/archive-current`
- 取消则不执行任何操作

**涉及文件:** `src/index.ts`
**覆盖:** FR14

### Story 5-2: 归档成功后刷新版本视图

**AC:**
- 归档接口返回成功后，重新调用 `load()` 刷新版本数据
- 刷新后版本页签显示：`当前`（空）+ `vN`（刚归档）+ 其他历史版本
- 归档接口返回失败时，显示错误信息，保持原状态不变

**涉及文件:** `src/index.ts`
**覆盖:** FR15

---

## Epic 6: 回归验证与兼容性保障

### 目标
确保新功能不破坏已有能力。

### Story 6-1: 现有多版本与多 Sprint 回归测试

**AC:**
- 现有 `tests/server/versionDiscovery.test.ts` 中的多版本测试全部通过
- 现有 `tests/server/flowStatus.test.ts` 中的 `/flow` 测试全部通过
- 现有 `tests/server/methodologyViewModel.test.ts` 等测试全部通过
- `npm run build` 编译通过
- `npm run test` 全部通过

**涉及文件:** 所有现有测试文件
**覆盖:** NFR2

---

## Implementation Order

建议按 Epic 顺序实施，每个 Epic 内按 Story 编号顺序执行：

1. **Epic 1** — 类型基础（无功能变化，纯类型扩展）
2. **Epic 2** — 后端只读能力（版本发现 + 归档建议）
3. **Epic 3** — 前端展示（current 页签 + 空状态 + 归档卡片）
4. **Epic 4** — 后端写接口（归档执行器 + 路由）
5. **Epic 5** — 前端交互闭环（确认 + 刷新）
6. **Epic 6** — 回归验证

每个 Epic 完成后都可以独立验证，不依赖后续 Epic。
