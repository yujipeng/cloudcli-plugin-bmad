---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/planning-artifacts/bmad-flow-当前工作区与历史版本归档方案.md
workflowType: 'architecture'
project_name: 'bmad-flow'
user_name: 'Engineer'
date: '2026-04-28'
lastStep: 8
status: 'complete'
completedAt: '2026-04-28'
---

# Architecture Decision Document

## Project Context Analysis

### Requirements Overview

**Functional Requirements**

本次变更可以归纳为 5 个架构能力域：

1. **Current workspace discovery**
   - 识别顶层 `docs/planning-artifacts` 与 `docs/implementation-artifacts`
   - 将其建模为特殊版本 `__current__`
   - 即使当前工作区为空，也能以合法工作区呈现

2. **Archived version discovery**
   - 继续扫描 `docs/vN/` 历史版本目录
   - 与 current workspace 并存展示，而不是二选一回退
   - 按版本号倒序组织历史版本标签

3. **Archive suggestion detection**
   - 根据 retrospective 完成状态、目录完整性与目标版本可用性判断是否可归档
   - 只返回建议与原因，不执行任何副作用操作
   - 归档建议只对 current workspace 生效

4. **Archive execution workflow**
   - 提供显式写接口 `POST /version/archive-current`
   - 将 current workspace 迁移到下一个可用 `docs/vN/`
   - 重建空的顶层工作区，供下一轮继续推进

5. **UI rendering and interaction**
   - 在现有版本标签体系中加入 `当前` 标签
   - 为 current workspace 增加空状态表达
   - 为 archiveSuggestion 增加特殊系统动作卡片与确认交互

**Non-Functional Requirements**

- **Safety**: 页面刷新与只读接口不能触发目录迁移
- **Correctness**: 归档只能在 retrospective 完成后执行
- **Backward compatibility**: 已有多版本与多 Sprint 展示能力不能回退
- **Maintainability**: 不让 `server.ts` 继续膨胀，归档逻辑必须拆分为独立纯函数和执行器
- **Recoverability**: 迁移失败时尽量回滚或至少暴露明确失败状态
- **User clarity**: current workspace 与 archived 版本在 UI 上语义明确，不混淆为同一种对象

### Scale & Complexity

- **Primary domain**: developer tool / IDE plugin
- **Complexity level**: medium
- **Estimated architectural components**: 6 个粗粒度组件

复杂度为 **medium**，原因如下：

- 这不是纯展示增强，而是首次引入“读写分离”的结构性版本管理能力
- 需要同时兼顾本地文件系统迁移安全、版本发现、UI 语义转换和测试回归
- 现有实现以 `server.ts` 为中心，若不拆分将迅速变得难以维护

### Technical Constraints & Dependencies

- 宿主环境仍是 **CloudCLI UI plugin runtime**，必须沿用纯 DOM + Node HTTP server + `api.rpc()` 模型
- 现有版本扫描逻辑已经支持 `docs/vN/`，新方案必须在此基础上扩展 current workspace，而不是重写版本系统
- 顶层 current workspace 与历史版本共用同一套阶段计算、Sprint 解析与 next action 推断逻辑
- 文件系统操作必须限制在 `safePath()` 安全边界之内
- 当前前端没有状态管理框架，交互设计必须维持简单状态对象与全量重渲染模式

### Cross-Cutting Concerns Identified

1. **Filesystem safety** — 目录迁移必须防止覆盖、半迁移与路径逃逸
2. **State semantics** — current workspace 与 archived 版本必须共享数据模型但保留不同语义
3. **Read/write separation** — `/versions` 和 `/version/archive-current` 必须严格分层
4. **Recovery behavior** — 迁移失败后的回滚与错误反馈必须在执行器中集中处理
5. **UI clarity** — current 空状态、archiveSuggestion、普通 nextAction 三者不能混淆
6. **Test isolation** — 只读逻辑与写入逻辑要能分别测试

## Architecture Goals

本架构的目标不是重构整个插件，而是在当前 V2 多版本基础上，增加一层安全、低侵入的 current workspace 生命周期管理能力。

### Architecture Goals

1. **Preserve current BMad working habit**
   - 用户继续在顶层 `docs/planning-artifacts` / `docs/implementation-artifacts` 工作
   - 不要求把当前开发迁入 `docs/v2/` 等目录

2. **Model current and archived versions explicitly**
   - `__current__` 作为特殊版本对象进入 `/versions`
   - `vN` 继续作为归档版本对象存在

3. **Introduce explicit archive workflow**
   - 页面只检测、不迁移
   - 用户确认后执行归档接口

4. **Contain complexity through module boundaries**
   - 将 current/archive 发现、归档建议判定、归档执行逻辑从 `server.ts` 主流程中拆分出去

## Proposed Component Architecture

建议把后端与前端都做最小拆分，不追求抽象过度，但要避免所有逻辑继续塞进现有文件主函数中。

```mermaid
flowchart TD
    A[resolveBmadPaths] --> B[discoverVersionEntries]
    B --> C[buildVersionFlowData]
    C --> D[/versions]

    C --> E[detectArchiveSuggestion]
    E --> D

    F[POST /version/archive-current] --> G[validateArchiveRequest]
    G --> H[computeNextArchiveVersion]
    H --> I[archiveCurrentWorkspace]
    I --> J[rebuildCurrentWorkspace]
    J --> D

    D --> K[index.ts state]
    K --> L[renderVersionTabs]
    K --> M[renderCurrentWorkspaceState]
    K --> N[renderArchiveSuggestionCard]
```

### Backend Components

#### 1. `discoverVersionEntries()`
职责：
- 扫描顶层 current workspace
- 扫描 `docs/vN/` 历史版本
- 返回统一的 `VersionInfo[]`

该函数只负责发现目录，不负责阶段计算与归档建议。

#### 2. `buildVersionFlowData()`
职责：
- 对每个 `VersionInfo` 复用现有 artifacts 检测、phase 计算、Sprint 解析逻辑
- 产出 `VersionFlowData`

这层的原则是：current 与 archived 共用同一条派生数据链。

#### 3. `detectArchiveSuggestion()`
职责：
- 仅对 current workspace 计算 archiveSuggestion
- 判定 retrospective 是否完成
- 判定 current workspace 是否为空
- 判定目标版本号是否可用
- 返回 `{ enabled, targetVersion, reason }`

其中，`isWorkspaceEmpty()` 的判断标准应为：`planning-artifacts` 与 `implementation-artifacts` 中都不存在任何被 `detectArtifacts()` 或 `parseMultiSprint()` 识别的有效产物，而不是简单依据目录是否完全无文件。

该函数必须保持纯函数风格，便于测试。

#### 4. `archiveCurrentWorkspace()`
职责：
- 作为唯一执行迁移副作用的后端执行器
- 接收已校验通过的 current workspace 路径与目标版本号
- 负责迁移、重建空目录、异常处理与回滚尝试

### Frontend Components

#### 1. `renderVersionTabs()` 扩展
- current 版本显示为 `当前`
- archived 版本继续显示 `vN`
- current 永远第一，历史版本倒序

#### 2. `renderCurrentWorkspaceState()`
- 当 current workspace 为空时，渲染“当前迭代尚未开始”
- 默认 nextAction 固定为 `/bmad-product-brief`
- `/bmad-create-prd` 仅作为备选入口说明

#### 3. `renderArchiveSuggestionCard()`
- 当 `archiveSuggestion.enabled === true` 时显示
- 与普通 nextAction 卡片分离，强调其是系统结构操作

#### 4. `confirmArchiveAndRefresh()`
- 点击确认后调用 `POST /version/archive-current`
- 成功后重新加载 `/versions`
- 失败时显示错误并保持原状态

## Data Structure Recommendations

### Type Extensions

```ts
export type VersionKind = 'current' | 'archived';

export interface ArchiveSuggestion {
  enabled: boolean;
  targetVersion?: string;
  reason?: string;
}

export interface VersionInfo {
  id: string; // '__current__' | 'v1' | 'v2'
  label: string; // '当前' | 'v1' | 'v2'
  kind: VersionKind;
  planningDir: string;
  implementationDir: string;
}

export interface VersionFlowData extends FlowData {
  version: VersionInfo;
  sprints: SprintEntry[];
  activeSprint: number;
  archiveSuggestion?: ArchiveSuggestion;
}
```

### Why This Shape

- `kind` 避免前端依赖 `id === '__current__'` 做分支判断
- `archiveSuggestion` 放在 `VersionFlowData` 内，而不是顶层响应对象，能让建议与具体版本绑定
- current 与 archived 共用一份 `VersionFlowData`，能最大化复用现有渲染与测试逻辑

## server.ts Module Split Recommendation

当前 `server.ts` 已经承担：
- YAML 解析
- config resolution
- artifacts 检测
- phase 计算
- sprint 解析
- version discovery
- methodology endpoint
- HTTP routing

继续加入 current/archive 归档后会进一步膨胀。建议按最小可接受粒度拆分：

### 推荐拆分

#### `src/versionDiscovery.ts`
负责：
- `discoverVersionEntries()`
- `getNextArchiveVersion()`
- `hasCurrentWorkspace()`

#### `src/archiveSuggestion.ts`
负责：
- `isWorkspaceEmpty()`
- `detectArchiveSuggestion()`

#### `src/archiveExecutor.ts`
负责：
- `validateArchiveRequest()`
- `archiveCurrentWorkspace()`
- `rebuildCurrentWorkspace()`
- `rollbackArchiveIfPossible()`

#### `src/server.ts`
保留：
- 路由入口
- request parsing
- 调用编排
- JSON response shaping

### Why Not Over-Split Further

项目规模还不需要引入复杂 service layer。以上拆分已经足以：
- 控制 `server.ts` 体积
- 隔离纯函数与副作用函数
- 让测试文件有清晰归属

## API Contract Recommendation

### `POST /version/archive-current`

请求体建议固定为：

```json
{
  "path": "/abs/project/path"
}
```

响应语义建议固定为：

- `200`：归档成功，返回最新 `VersionedResponse`
- `400`：请求体缺失、格式错误或 `path` 非法
- `404`：项目路径不存在
- `409`：current workspace 状态不允许归档，或目标历史版本已存在
- `500`：归档执行失败

采用这套最小契约可以让前端、路由层和测试层共享同一套错误语义。

## Archive Execution and Rollback Strategy

### Execution Sequence

1. 重新校验 current workspace 状态
2. 计算目标 `vN`
3. 创建目标父目录 `docs/vN/`
4. 移动 `planning-artifacts`
5. 移动 `implementation-artifacts`
6. 重建空的 current workspace 目录
7. 返回最新 `/versions`

### Rollback Strategy

如果在步骤 4-6 之间失败：

- 若 `planning-artifacts` 已迁移但 `implementation-artifacts` 未迁移，则尝试把 `planning-artifacts` 移回顶层
- 若发生部分迁移成功、部分失败，则优先尝试回滚到迁移前状态
- 若两个目录都已迁移且历史版本已完整落盘，但重建 current workspace 失败，则不回滚历史版本，只返回明确错误，要求用户手动恢复或重试创建空目录

### Rationale

完全事务化文件系统操作在这里不现实，因此采用“预检查 + 有序迁移 + 尽量回滚 + 明确暴露失败状态”的策略。

## Frontend Rendering Integration

### Rendering Priority Within Current Tab

current workspace 页签下的内容优先级建议为：

1. `archiveSuggestion` 卡片
2. 当前版本 phase bar
3. 普通 nextAction
4. Sprint 面板
5. methodology 导航

这样用户完成一个版本后，会首先看到“归档当前版本为 vN”，而不是被普通 next action 淹没。

### Empty Current Workspace Rendering

当 current workspace 被识别为空时：
- phase bar 仍可显示早期阶段为 pending/active
- 专用空状态文案优先于“未检测到 BMad 项目”
- nextAction 应回到初始化当前迭代的首步

### Interaction Model

- 页签切换：只切换选中版本
- 归档确认：单次确认即可，不引入复杂 modal framework
- 成功后：重新调用 `load()`，不做局部 patch

## Testing Strategy

测试应分成三层。

### 1. Pure Function Tests

文件建议：
- `tests/server/versionDiscovery.test.ts`
- `tests/server/archiveSuggestion.test.ts`

覆盖：
- current workspace 存在/缺失
- current + archived 混合发现
- next archive version 计算
- 空工作区检测
- retrospective 完成/未完成的归档建议

### 2. Archive Execution Tests

文件建议：
- `tests/server/archiveCurrentVersion.test.ts`

覆盖：
- 成功迁移 current 到 `v1`
- 已有 `v1` 时迁移到 `v2`
- 目标目录存在时报错
- 只迁移一半时的回滚尝试
- 重建 current workspace 目录

### 3. Frontend Integration Checks

覆盖：
- `当前` 页签在最前显示
- empty current workspace 的专用状态
- archiveSuggestion 卡片显示条件
- 归档成功后重新加载后的页签顺序

## Implementation Sequence

### Phase 1
扩展 `types.ts`，引入 `VersionKind` 与 `ArchiveSuggestion`

### Phase 2
拆出 `versionDiscovery` 与 `archiveSuggestion` 只读逻辑，稳定 `/versions` 响应结构

### Phase 3
前端接入 current workspace / archived 语义与 archiveSuggestion 展示

### Phase 4
实现 `POST /version/archive-current` 与回滚逻辑

### Phase 5
补归档交互与测试回归

## Final Decision Summary

本架构选择了“统一版本模型 + 分层读写逻辑 + 明确 current/archive 语义”的实现路径：

- current workspace 和 archived 版本共用一套派生数据模型
- 只读发现、归档建议判定、归档执行器分别拆层
- 页面刷新只读，归档动作显式执行
- 文件系统迁移以安全优先，采用预检查与尽量回滚策略
- 前端通过当前页签、空状态与 archiveSuggestion 卡片表达新语义

这套设计能够在不打破现有插件架构的前提下，把版本管理从“仅可读历史版本”扩展成“可读当前 + 可归档历史 + 可继续下一轮”的完整生命周期闭环。