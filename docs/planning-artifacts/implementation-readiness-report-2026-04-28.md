# bmad-flow 当前工作区与历史版本归档 - Implementation Readiness Report

## 结论

**总体结论：基本就绪（Conditionally Ready）**

当前产物链已经具备进入实现阶段的主要条件：

- 方案文档已明确问题背景、目标、边界与验收标准
- 架构文档已明确数据结构、模块拆分、接口设计、执行与回滚策略
- Epics / Stories 已按最小可交付增量拆分，并与架构层大体对齐

因此，这一主题已经**接近 implementation ready**。在补齐少量关键澄清后，可以安全进入实现。

---

## 已对齐项

### 1. 目标与版本模型一致
三份文档一致认定：

- 顶层 `docs/planning-artifacts` 与 `docs/implementation-artifacts` 代表 current workspace
- `docs/vN/` 仅保存 archived versions
- 页面刷新只检测，不执行迁移
- 归档需要显式确认
- 归档后重建空的 current workspace

### 2. 架构与 Epic 切分基本匹配
架构中的主要组件都在 Epics 中找到了承接：

- `VersionKind` / `ArchiveSuggestion` → Epic 1
- `discoverVersionEntries()` / `detectArchiveSuggestion()` → Epic 2
- current tab / empty state / archiveSuggestion card → Epic 3
- `POST /version/archive-current` / rollback → Epic 4
- 确认交互与刷新闭环 → Epic 5
- 回归验证 → Epic 6

### 3. 实施顺序合理
当前的 Epic 顺序符合风险递增顺序：

1. 类型层
2. 后端只读能力
3. 前端展示
4. 后端写接口
5. 前端执行闭环
6. 回归验证

这个顺序适合逐步落地和分阶段验证。

---

## 发现的缺口与需要澄清的点

以下问题不大，但如果不先收口，实施时容易产生返工。

### Gap 1：empty current workspace 的判定标准还不够具体
当前文档多次提到“current workspace 为空”，但没有统一定义空的判断方式。

建议明确为以下其一：

**推荐定义：**
只要 `planning-artifacts` 与 `implementation-artifacts` 中都不存在任何被 `detectArtifacts()` / `parseMultiSprint()` 识别的有效产物，就判定为空。

这样比“目录里完全没有文件”更稳，因为后续可能出现非核心辅助文件。

**影响范围：**
- `isWorkspaceEmpty()`
- current empty state
- archiveSuggestion 判定

### Gap 2：current 空状态下的 nextAction 还存在二选一歧义
方案与架构都写了：
- 可从 `/bmad-product-brief` 或 `/bmad-create-prd` 开始

但实现层最好只选一个默认动作，否则会在 UI 和测试里出现分叉逻辑。

**建议：**
统一默认到 `/bmad-product-brief`，把 `/bmad-create-prd` 作为备选说明，不作为默认 nextAction。

### Gap 3：归档接口的请求契约还缺少一层明确说明
文档已经定义 `POST /version/archive-current`，但没有明确：

- `api.rpc()` 是否携带 JSON body
- `server.ts` 如何解析 body
- body 为空或 path 缺失时返回什么错误码

**建议：**
在实现前补一个最小 API contract：

```ts
POST /version/archive-current
body: { path: string }
400: invalid payload / missing path
404: project path not found
409: archive target exists or workspace state invalid
500: archive execution failed
```

### Gap 4：回滚策略与“重建空工作区失败”的最终状态需要统一
架构文档中提到：
- 若两个目录都已迁移但重建 current workspace 失败，则保留历史版本已落盘状态，并返回明确错误

但 Epic 4-1 里写的是：
- 实现 `rollbackArchiveIfPossible()`

这两个说法并不完全冲突，但需要统一成：

- **仅对“部分迁移”做回滚尝试**
- **若历史版本已完整归档成功，仅 current workspace 重建失败，则不回滚历史版本，只返回错误并提示用户恢复 current 目录**

否则 Story AC 会被误解成“任何失败都必须完全回滚”。

### Gap 5：Implementation Readiness 的前置文档链与标准 BMad 产物不完全一致
标准 BMad 常见链路是：
- PRD
- UX（可选）
- Architecture
- Epics/Stories
- Readiness Check

本次使用的是：
- 方案文档（替代 PRD 作用）
- Architecture
- Epics

这对一个 brownfield 的插件增量改动是可接受的，但应在 readiness 结论里明确：

**本次 readiness 基于“方案文档替代 PRD”的轻量链路。**

否则从严格流程视角看会被认为缺 PRD。

---

## 建议修正动作

进入实现前，建议只补以下 4 个澄清，不需要重做文档：

1. 在方案或架构文档中明确 `isWorkspaceEmpty()` 的判断标准
2. 统一 current 空状态下默认的 nextAction（建议 `/bmad-product-brief`）
3. 在架构文档中补充 `POST /version/archive-current` 的最小请求/响应契约
4. 在架构文档中明确回滚边界：
   - 部分迁移失败 → 尝试回滚
   - 历史版本已完整落盘但重建 current 失败 → 不回滚历史版本，只报错

---

## Readiness Verdict

### Verdict
**Conditionally Ready**

### Why not fully Green yet
不是因为方向有问题，而是因为还有几处实现级边界尚未单点收口。它们会直接影响：

- `archiveSuggestion` 判定
- current empty state 的 UI 与测试
- `POST /version/archive-current` 的路由与错误码
- 归档执行失败时的预期行为

### What upgrades this to Ready
只要把上面的 4 个澄清补进文档，当前主题就可以视为 **Ready for Implementation**。

---

## 总结

这套“当前工作区 + 历史版本归档”方案已经完成了从问题定义、方案设计、架构决策到 Epic 拆分的大部分工作。当前不是“方向不清”，而是“边界再压实一点会更稳”。

因此建议：

- 先用一次小修订把关键边界补齐
- 补齐后即可进入 story 级实施与开发循环
