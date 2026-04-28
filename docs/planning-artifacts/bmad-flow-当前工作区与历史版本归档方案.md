# bmad-flow 当前工作区与历史版本归档方案

## 背景与目标

`bmad-flow` 目前已经支持按 `docs/vN/` 目录扫描多个历史版本，并可展示每个版本独立的阶段状态与 Sprint 进展。但这套能力仍缺少一个完整的版本生命周期闭环：当当前迭代完成后，用户仍需要手动把顶层产物移动到历史目录，再手动准备下一轮工作区。

本方案的目标，是在不改变 BMad 原生单版本工作习惯的前提下，为 `bmad-flow` 增加“当前工作区 + 历史版本归档”的版本管理策略。

设计目标如下：

1. 顶层 `docs/planning-artifacts` 与 `docs/implementation-artifacts` 始终代表当前正在推进的版本。
2. `docs/vN/` 仅用于保存已经完成并封版的历史版本。
3. 当当前工作区完成一个完整 BMad 生命周期后，系统能自动检测“可归档”状态。
4. 归档必须由用户显式确认执行，页面刷新不能直接修改目录结构。
5. 归档完成后，重建空的顶层当前工作区，供下一轮继续推进。

## 版本模型

系统同时维护两类版本对象：当前工作区与历史归档版本。

### 当前工作区

当前工作区固定使用顶层目录：

- `docs/planning-artifacts`
- `docs/implementation-artifacts`

这两个目录永远代表当前正在进行中的版本，不绑定 `v1`、`v2` 等显式版本号。这样可以保持 BMad 现有的单版本配置和工作习惯不变。

### 历史归档版本

历史版本使用以下目录结构：

- `docs/v1/`
- `docs/v2/`
- `docs/v3/`

每个 `docs/vN/` 目录都包含：

- `planning-artifacts`
- `implementation-artifacts`

这些目录只承载已经完成的版本快照，不再参与当前开发。

### 版本语义

- 顶层 `docs/...-artifacts` = 当前工作区
- `docs/vN/...` = 历史归档版本

因此，系统中的“版本”不再只是多个平级的 `vN` 目录，而是一个“当前 + 历史”的混合模型。

## 当前工作区与历史版本语义

### 当前版本的定义

当前版本是用户下一步继续工作的唯一入口。只要顶层工作区存在，它就应在 UI 中表现为一个特殊版本标签，例如：

- `当前`

当前版本即使为空，也仍应被识别为一个合法工作区。空当前工作区表示“下一轮尚未开始”，而不是系统异常。

在实现层，`isWorkspaceEmpty()` 应以“是否存在可识别的有效产物”为准，而不是简单以目录是否完全无文件为准。推荐规则为：只要 `planning-artifacts` 与 `implementation-artifacts` 中都不存在任何被 `detectArtifacts()` 或 `parseMultiSprint()` 识别的有效产物，就判定为 empty current workspace。

### 历史版本的定义

历史版本表示已经封版的开发周期结果。它们用于：

- 查看过去版本的阶段状态
- 查看某一历史版本对应的 Sprint 与故事完成情况
- 对比不同版本迭代节奏

历史版本不接受新的写入动作，也不应触发归档逻辑。

### UI 展示建议

版本页签建议按以下顺序展示：

1. `当前`
2. `vN`
3. `vN-1`
4. ...

其中：

- `当前` 永远在最前
- 历史版本按版本号倒序排列

## 归档触发条件

归档动作不是任意时刻都开放，必须满足明确条件。

### 允许归档的条件

1. 顶层当前工作区存在：
   - `docs/planning-artifacts`
   - `docs/implementation-artifacts`
2. 当前工作区的 BMad 流程已完成 retrospective 阶段。
3. 当前工作区不是空目录。
4. 下一个历史版本号可用，例如目标 `docs/vN/` 尚不存在。

### 必须拒绝归档的情况

1. retrospective 尚未完成。
2. 当前工作区目录缺失。
3. 当前工作区目录存在但处于结构异常状态。
4. 目标历史版本目录已存在。
5. 当前选中的版本不是 current，而是 archived。

### 页面刷新时的行为

页面刷新只做两件事：

- 检测当前是否满足归档条件
- 如果满足，则提示“归档当前版本为 vN”

页面刷新不得直接迁移目录、创建版本目录或重建工作区。

## 后端只读接口设计

后端需要在现有 `versions` 响应基础上扩展当前工作区与归档建议信息。

### 版本发现逻辑

系统应同时扫描：

1. 顶层当前工作区
2. `docs/vN/` 历史版本目录

若顶层工作区存在，则生成一个特殊版本对象：

```ts
{
  id: "__current__",
  label: "当前",
  kind: "current",
  planningDir: "docs/planning-artifacts",
  implementationDir: "docs/implementation-artifacts"
}
```

若存在历史目录，则生成：

```ts
{
  id: "v1",
  label: "v1",
  kind: "archived",
  planningDir: "docs/v1/planning-artifacts",
  implementationDir: "docs/v1/implementation-artifacts"
}
```

### 归档建议字段

建议在版本数据中增加只读字段：

```ts
archiveSuggestion?: {
  enabled: boolean;
  targetVersion?: string;
  reason?: string;
}
```

含义如下：

- `enabled=true`：当前版本满足归档条件
- `targetVersion`：建议归档到的下一个版本号
- `reason`：当不可归档时说明原因

## 后端写接口设计

为保持读写分离，归档动作必须使用单独的写接口。

### 推荐接口

```http
POST /version/archive-current
```

### 输入

```json
{
  "path": "/abs/project/path"
}
```

前端不传入 `v1` / `v2`，由后端自行计算下一个可用历史版本号。

### 最小请求/响应契约

```http
POST /version/archive-current
```

```json
{
  "path": "/abs/project/path"
}
```

建议响应语义：

- `200`：归档成功，返回最新 `VersionedResponse`
- `400`：请求体缺失或 `path` 非法
- `404`：项目路径不存在
- `409`：current workspace 状态不允许归档，或目标历史版本已存在
- `500`：归档执行失败

### 执行流程

1. 重新校验当前工作区状态。
2. 计算下一个可用历史版本号。
3. 创建目标目录 `docs/vN/`。
4. 移动：
   - `docs/planning-artifacts` → `docs/vN/planning-artifacts`
   - `docs/implementation-artifacts` → `docs/vN/implementation-artifacts`
5. 重建空的：
   - `docs/planning-artifacts`
   - `docs/implementation-artifacts`
6. 返回最新版本状态数据。

### 版本号分配规则

- 没有历史版本时，归档到 `v1`
- 已有 `v1` 时，归档到 `v2`
- 已有 `v1`、`v2` 时，归档到 `v3`

## 前端交互设计

前端需要将“归档”视为一种结构性系统动作，而不是普通命令复制行为。

### 当前版本页签

当前版本页签显示为：

- `当前`

与历史版本页签的样式应有明显区分，以强调其为工作区而非历史快照。

### 当前工作区空状态

当顶层目录存在但为空时，应显示：

- 当前迭代尚未开始
- 默认 nextAction 为 `/bmad-product-brief`
- `/bmad-create-prd` 可作为备选入口说明

这不应被视为“未检测到 BMad 项目”。

### 归档建议卡片

当 `archiveSuggestion.enabled === true` 时，在当前版本页签中显示特殊卡片，例如：

- 标题：`当前版本已完成`
- 说明：`可归档为 vN`
- 主按钮：`归档为 vN`

### 确认交互

点击归档按钮后，应先进行确认。确认文案需清楚说明：

- 当前顶层工作区将被迁移到 `docs/vN/`
- 系统会重建空的顶层工作区
- 历史版本不会被覆盖

确认后再调用写接口执行归档。

### 执行成功后的前端行为

归档成功后，前端应重新拉取版本数据并刷新 UI。此时版本页签结构会变为：

- `当前`
- `vN`
- 其他历史版本...

其中：

- `当前` 是新重建的空工作区
- `vN` 是刚完成归档的历史版本

## 失败处理与边界条件

### 设计原则

归档动作必须尽量满足“完整成功或保持原状”。

### 最低保障

1. 所有目录迁移前先做完整校验。
2. 不覆盖已有 `docs/vN/`。
3. 迁移失败时返回明确错误信息。
4. 若发生部分迁移成功、部分失败，后端应尝试回滚。
5. 若历史版本已完整落盘，但 current workspace 重建失败，则不回滚历史版本，只返回错误并提示用户恢复或重试创建 current workspace。

### 典型边界条件

1. 当前工作区为空：不可归档。
2. 当前工作区只存在一个 artifacts 目录：结构异常，不可归档。
3. `docs/vN/` 已存在：拒绝归档。
4. 当前版本 retrospective 未完成：拒绝归档。
5. 历史版本页签永远不出现 archiveSuggestion。

## 里程碑与实施顺序

### Milestone 1：扩展类型模型

涉及：

- `src/types.ts`

目标：

- 增加 `current` / `archived` 版本语义
- 增加 `archiveSuggestion`

### Milestone 2：改造后端只读版本发现

涉及：

- `src/server.ts`

目标：

- 同时发现当前工作区与历史版本
- 输出归档建议状态

### Milestone 3：前端展示 current / archived

涉及：

- `src/index.ts`

目标：

- 当前页签
- 历史页签
- 当前工作区空状态
- 归档建议卡片（只展示）

### Milestone 4：后端归档写接口

涉及：

- `src/server.ts`
- 服务端测试

目标：

- 提供 `POST /version/archive-current`
- 完成目录迁移与重建空工作区

### Milestone 5：前端归档交互闭环

涉及：

- `src/index.ts`

目标：

- 确认归档
- 调用归档接口
- 刷新版本视图

### Milestone 6：测试与回归验证

涉及：

- `tests/server/versionDiscovery.test.ts`
- 新增归档测试文件

目标：

- 保证新旧版本逻辑兼容
- 保证多 Sprint 行为不回退

## 验收标准

### 功能验收

1. 仅有顶层工作区时，显示单个 `当前` 页签。
2. 顶层 current 与历史版本并存时，版本页签正确展示。
3. 当前版本 retrospective 完成后，显示归档建议。
4. 归档成功后，历史版本页签新增，当前工作区被重建为空。
5. 当前工作区为空时，显示“尚未开始当前迭代”的空状态提示。

### 安全验收

1. 刷新页面不会触发目录迁移。
2. 只读接口不产生副作用。
3. 已存在的历史版本目录不会被覆盖。
4. retrospective 未完成时不能归档。
5. 当前目录结构异常时拒绝归档。

### 兼容性验收

1. 已有多版本展示能力不被破坏。
2. 现有多 Sprint 展示能力不被破坏。
3. 无历史版本项目可正常工作。
4. 旧项目在未归档前仍能正常显示当前工作区。

## 总结

本方案为 `bmad-flow` 增加了一套清晰、低侵入、可演进的版本管理策略：顶层工作区始终承载当前开发，`docs/vN/` 始终保存历史归档。系统负责自动检测可归档状态，但真正归档必须由用户显式确认执行。归档成功后，顶层工作区被重建为空目录，继续作为下一轮的工作入口。这一设计既保持了 BMad 单版本工作流的自然习惯，也为 `bmad-flow` 提供了完整的版本生命周期闭环。