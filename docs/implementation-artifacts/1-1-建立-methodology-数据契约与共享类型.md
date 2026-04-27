# Story 1.1: 建立 methodology 数据契约与共享类型

Status: done

## Story

As a user,
I want methodology data to be normalized into a stable model,
so that the navigation can reliably represent my project's BMad configuration.

## Acceptance Criteria

1. **Given** 项目中存在合法的 `_bmad/_config/bmad-help.csv`
   **When** 后端读取并解析文件
   **Then** 系统生成统一的 methodology item 数据结构
   **And** 每个条目包含 `skill`、`displayName`、`menuCode`、`description`、`required`、`category`

2. **Given** CSV 中存在 `_meta` 行或缺失字段
   **When** 解析器处理输入
   **Then** `_meta` 行被过滤
   **And** 缺失字段使用默认值填充

3. **Given** story 完成
   **When** 运行 `tests/server`
   **Then** 至少覆盖正常解析与缺列输入两个场景
   **And** 共享类型定义已更新到 `src/types.ts`

## Tasks / Subtasks

- [x] Task 1: 定义共享类型 (AC: #1)
  - [x] 在 `src/types.ts` 中新增 `MethodologyItem`、`MethodologyGroup`、`MethodologyResponse` 接口
- [x] Task 2: 实现 CSV 解析纯函数 (AC: #1, #2)
  - [x] 创建 `src/methodologyParser.ts`
  - [x] 实现 `parseMethodologyCsv(csvContent: string): MethodologyItem[]`
  - [x] 过滤 `_meta` 行
  - [x] 缺失字段使用默认值：`displayName` → `""`、`description` → `""`、`required` → `false`、`category` → `"tool"`
  - [x] 仅支持 UTF-8 编码
- [x] Task 3: 实现分组与排序 ViewModel (AC: #1)
  - [x] 创建 `src/methodologyViewModel.ts`
  - [x] 实现 `groupByPhase(items: MethodologyItem[]): MethodologyGroup[]`
  - [x] 排序：`1-analysis` → `2-planning` → `3-solutioning` → `4-implementation` → `anytime`
  - [x] `anytime` 阶段标记为"通用工具"
- [x] Task 4: 编写单元测试 (AC: #3)
  - [x] 创建 `tests/server/methodologyParser.test.ts`
  - [x] 创建 `tests/server/methodologyViewModel.test.ts`
  - [x] 覆盖场景：正常解析、`_meta` 过滤、缺列默认值、分组排序

## Dev Notes

### 技术栈约束

- TypeScript strict mode，Node.js 18+
- 纯 DOM，无框架（React/Vue 等禁止）
- 复用现有三文件骨架 `src/server.ts` / `src/index.ts` / `src/types.ts` 做增量扩展
- 所有 JSON 字段统一 `camelCase`

### 数据模型定义

```typescript
// src/types.ts 新增
interface MethodologyItem {
  skill: string;
  displayName: string;
  menuCode: string;
  description: string;
  required: boolean;
  category: 'workflow' | 'agent' | 'tool';
  phase: string;
}

interface MethodologyGroup {
  phase: string;
  displayName: string;
  items: MethodologyItem[];
}

interface MethodologyResponse {
  groups: MethodologyGroup[];
  warning?: string;
  error?: string;
  partialFailure?: boolean;
  skippedRows?: number;
}
```

### CSV 格式参考

源文件：`{projectPath}/_bmad/_config/bmad-help.csv`，16 列格式：
```
module,phase,name,code,sequence,workflow-file,command,required,agent-name,agent-command,agent-display-name,agent-title,options,description,output-location,outputs
```

字段映射：
- `name` → `displayName`
- `workflow-file`（去掉前缀 `bmad-`）→ `skill`
- `code` → `menuCode`
- `description` → `description`
- `required`（字符串 `"true"` → boolean）→ `required`
- `category` 由 `agent-name` 是否非空推断：非空 → `"agent"`，否则根据 `workflow-file` 判断 `"workflow"` 或 `"tool"`
- `phase` → `phase`

`_meta` 行特征：`phase` 列值为 `_meta`。

### 分组排序规则

固定顺序数组：`['1-analysis', '2-planning', '3-solutioning', '4-implementation', 'anytime']`
不在此列表中的 phase 追加到末尾。

### 错误处理矩阵（Story 1.1 仅定义类型，实际处理在 Story 1.2/3.1）

| 场景 | 响应结构 |
|------|----------|
| 路径不存在 | `{ groups: [], warning: "no bmad directory" }` |
| CSV 不存在 | `{ groups: [], warning: "methodology file not found" }` |
| 权限拒绝 | `{ error: "permission denied" }` |
| 格式损坏 | `{ partialFailure: true, skippedRows: N }` |
| 非 UTF-8 | `{ error: "unsupported encoding, UTF-8 required" }` |

### 安全约束

- 路径校验：`path.resolve()` 规范化 + 拒绝 `../` 穿越 + 拒绝符号链接逃逸
- 复用现有 `/flow` 接口的 `safePath()` 逻辑（如存在）
- 仅允许读取指定 CSV 文件

### 性能约束

- `/methodology` P95 < 200ms（CSV < 1MB 前提）
- 服务端缓存：基于 `projectPath + file mtime` 的进程内缓存

### 依赖关系

- Story 1.1 是数据基础层，被 Story 1.2-1.5、2.x、3.x 全部依赖
- 无前置依赖

### Project Structure Notes

- 沿用现有三文件骨架做增量扩展
- 新增模块：`src/methodologyParser.ts`、`src/methodologyViewModel.ts`
- 测试按 `tests/server/` 组织
- 类型集中在 `src/types.ts`

### References

- [Source: docs/planning-artifacts/prd.md — FR1-FR8, NFR4-NFR9]
- [Source: docs/planning-artifacts/architecture.md — 技术栈、文件结构、缓存策略]
- [Source: docs/planning-artifacts/epics.md#Story 1.1]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- 在 src/types.ts 新增 MethodologyItem、MethodologyCategory、MethodologyGroup、MethodologyResponse 类型
- 创建 src/methodologyParser.ts：CSV 解析纯函数，支持引号字段、_meta 过滤、缺列默认值
- 创建 src/methodologyViewModel.ts：按 phase 分组并排序，anytime 显示为"通用工具"
- 14 个单元测试全部通过（8 parser + 6 viewModel）
- TypeScript strict 编译无错误

### File List

- src/types.ts (modified)
- src/methodologyParser.ts (created)
- src/methodologyViewModel.ts (created)
- tests/server/methodologyParser.test.ts (created)
- tests/server/methodologyViewModel.test.ts (created)
- package.json (modified - added vitest, test script)
