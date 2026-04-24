---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/planning-artifacts/product-brief.md
  - docs/planning-artifacts/prd.md
workflowType: 'architecture'
project_name: 'cloudcli-plugin-starter'
user_name: 'TCXY Engineer'
date: '2026-04-24'
lastStep: 8
status: 'complete'
completedAt: '2026-04-24'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements**

该项目的功能需求可以归纳为 5 个架构能力域：

1. **Methodology data ingestion**
   - 读取 `_bmad/_config/bmad-help.csv`
   - 解析、过滤 `_meta` 行、按阶段分组、识别 required/tool/agent/workflow
   - 处理错误、权限、编码、缺列、无文件等降级场景

2. **UI rendering and interaction orchestration**
   - 在现有阶段条、建议卡片、Sprint 面板之后追加方法论导航栏目
   - 桌面端支持 hover tooltip / click copy
   - H5 端支持 tap tooltip / second-tap copy / long-press copy
   - 支持折叠/展开、当前阶段自动展开、空态、加载态、失败静默降级

3. **Cross-platform interaction adaptation**
   - 同一份前端逻辑需兼容 mouse 与 touch 事件模型
   - tooltip、toast、copied feedback、tight layout 要根据容器宽度与触屏能力切换

4. **State and refresh coordination**
   - methodology 数据与现有 flow 数据并列加载
   - 共享 projectPath、refresh、theme、locale、project context 变化
   - 需要明确缓存失效条件与用户刷新行为

5. **Accessibility and i18n support**
   - 键盘可操作、aria-describedby、aria-live
   - 新栏目需复用现有 zh-CN / en i18n 能力与主题系统

**Non-Functional Requirements**

影响架构决策的 NFR 主要有：

- **Performance**: `/methodology` 接口 P95 < 200ms；前端渲染不阻塞主线程
- **Security**: `path` 参数必须经过安全校验，禁止路径穿越和符号链接逃逸
- **Compatibility**: 兼容 BMad Method 6.x 的 CSV 格式变化
- **Maintainability**: 纯 DOM、TypeScript strict、CSV 解析逻辑独立成纯函数
- **Accessibility**: 键盘焦点、屏幕阅读器描述、颜色对比度达 WCAG AA
- **Responsive/H5**: 容器宽度 < 400px 紧凑模式，touch/mouse 双事件模型

### Scale & Complexity

- **Primary domain**: developer tool / IDE plugin
- **Complexity level**: medium
- **Estimated architectural components**: 7 个粗粒度组件

复杂度虽然在业务域上属于 low/general，但从实现角度提升到 **medium**，原因是：
- 需要在既有 V1 插件架构上做棕地增量扩展
- 同时兼容桌面端与 H5 触屏端交互
- 需要处理本地文件系统、CSV 兼容、安全校验、缓存、无障碍、国际化等横切需求

### Technical Constraints & Dependencies

- 宿主环境是 **CloudCLI UI plugin runtime**，前端不能引入 React/Vue 等框架
- 当前插件采用 **纯 DOM + Node HTTP server + api.rpc()** 模式，V2 必须沿用
- 现有可复用基础设施包括：
  - `tc()` 主题色系统
  - `getI18n()` 国际化映射
  - `copyToClipboard()` 与 fallback copy
  - `load()` / `render()` / `api.onContextChange()` 生命周期模式
  - `safePath()` 路径校验思想（当前 `/flow` 已有）
- 输入依赖：`bmad-help.csv`、`_bmad/*/config.yaml`、项目路径上下文
- 输出依赖：新增 `/methodology` 接口返回结构化 JSON，供前端渲染

### Cross-Cutting Concerns Identified

1. **Path security** — 本地文件读取必须统一走安全边界
2. **Parsing resilience** — CSV 容错策略必须集中管理，不能散落在 UI 层
3. **Interaction abstraction** — mouse/touch 事件不应直接写死在视图代码中
4. **Progressive degradation** — methodology 加载失败不能影响 V1 主流程
5. **Caching coherence** — flow 与 methodology 要共享刷新语义，但缓存策略不同
6. **Visual consistency** — 新栏目必须复用现有 theme/i18n/animation token
7. **Testability** — 解析、映射、interaction state machine 需要独立可测

## Starter Template Evaluation

### Primary Technology Domain

CloudCLI UI tab plugin（TypeScript + Node.js + browser DOM mixed runtime）

该项目不是传统 web app，也不是通用 npm library，而是已经建立在 **CloudCLI plugin starter** 之上的棕地插件扩展。其 primary domain 是 **plugin UI + local server** 双运行时架构，以 TypeScript 为主语言，前后端通过本地 HTTP server + `api.rpc()` 协作。

### Starter Options Considered

1. **沿用当前 CloudCLI plugin starter 基线**
   - 优点：与现有代码完全一致；零迁移成本；保留当前插件运行模型与发布方式
   - 风险：需要手工补齐 methodology 导航与 H5 适配能力

2. **切换到通用 Vite/React starter**
   - 优点：前端生态丰富、组件开发效率高
   - 风险：与当前纯 DOM 架构冲突；破坏宿主约束；迁移成本高；不符合棕地最小变更原则

3. **切换到其他 Node/TypeScript boilerplate**
   - 优点：可获得更多工程化预设
   - 风险：对当前项目价值有限，因为现有 repo 已完成 starter 初始化并有可工作的 V1 架构

### Selected Starter: Existing CloudCLI Plugin Starter Baseline

**Rationale for Selection**

Team Leader 决策：**不引入新的 starter，沿用现有 CloudCLI plugin starter 基线作为架构起点**。

原因：
- 当前仓库已经是稳定运行的 V1 插件，starter 选择事实上已完成
- V2 的目标是增量扩展方法论导航，不是重建基础设施
- 保持现有三文件骨架（`index.ts` / `server.ts` / `types.ts`）能让后续 AI agent 在一致模式下实施
- 避免为获取前端便利而引入 React/Vite 迁移成本和运行时偏差

**Initialization Command**

```bash
# No new starter initialization required.
# Continue from the existing CloudCLI plugin starter baseline.
npm install
npm run build
```

**Architectural Decisions Provided by Starter**

**Language & Runtime:**
- TypeScript 作为统一语言
- Node.js 承载后端 server
- 浏览器 DOM 承载前端渲染

**Styling Solution:**
- 无 CSS framework；使用 inline style + theme token 模式

**Build Tooling:**
- TypeScript 编译 `src/ -> dist/`
- 插件通过 manifest + dist 产物交付

**Testing Framework:**
- starter 本身未固定测试框架；V2 需后续自行补齐 parser / interaction / regression test 方案

**Code Organization:**
- `src/server.ts`: 后端 API 与文件解析
- `src/index.ts`: 前端 mount/render 与交互
- `src/types.ts`: 前后端共享类型

**Development Experience:**
- 已具备插件构建、刷新、主题适配、i18n 基础
- 新能力应复用既有 `load()` / `render()` / `onContextChange()` 模式

**Note:** 第一个实现 story 不应是初始化新工程，而应是围绕现有 starter 基线扩展 methodology 数据链路与前端交互层。

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- 保持现有 **单仓三文件骨架**（`server.ts` / `index.ts` / `types.ts`）并在其上增量扩展
- methodology 数据读取采用 **request-time parse + process cache** 模式，不引入数据库
- 桌面与 H5 共用一套前端渲染代码，但通过 **interaction adapter** 区分 mouse/touch 行为
- `/methodology` 继续走 **本地只读 HTTP + JSON** 接口，与 `/flow` 平行存在，不合并
- `path` 校验、安全边界、UTF-8 解析容错作为后端统一入口责任

**Important Decisions (Shape Architecture):**
- 前端状态按 `flow data` / `methodology data` / `interaction UI state` 三层拆分
- tooltip / toast / copied 状态由独立 UI state machine 驱动，不散落在 DOM 事件回调中
- 颜色、i18n、动画统一复用现有 token，不单独引入样式系统
- 测试按 parser / mapping / interaction / render 四层切分

**Deferred Decisions (Post-MVP):**
- 搜索与过滤
- 直接执行命令而非仅复制
- 多模块聚合展示（BMM/GDS/CIS）
- 虚拟滚动或大量条目性能优化

### Data Architecture

- **Persistent Storage:** 无新增数据库。methodology 数据来源是项目内 `_bmad/_config/bmad-help.csv`
- **Primary Model:** `CSV row -> normalized item -> phase group -> UI view model`
- **Validation Strategy:** 后端解析层负责：列缺失默认值、UTF-8 校验、`_meta` 过滤、phase/category 推断
- **Cache Strategy:** 
  - 服务端：基于 `projectPath + file mtime` 的进程内缓存
  - 客户端：基于 `projectPath` 的会话缓存，refresh 或 project change 失效
- **Rationale:** 数据规模小、只读、派生型强，不需要数据库或复杂状态存储

### Authentication & Security

- **End-user Authentication:** 不新增鉴权层，沿用宿主 CloudCLI plugin 环境
- **Authorization Boundary:** 仅允许读取当前项目内合法路径，禁止越界文件访问
- **Security Middleware:** `/methodology` 与 `/flow` 共享 `safePath()` 风格安全边界
- **Input Hardening:** 仅接受项目路径；解析文件仅限 `_bmad/_config/bmad-help.csv`
- **Rationale:** 本插件不暴露公网接口，不涉及多租户认证；核心风险在本地路径访问与文件解析边界

### API & Communication Patterns

- **API Shape:** 保持 REST-like 本地只读 GET 接口
  - `GET /flow?path=...`
  - `GET /methodology?path=...`
- **Response Pattern:** 成功返回结构化 JSON；失败返回 `{ error }` 或 `{ warning }`，与现有 `/flow` 风格兼容
- **Why not merge `/flow` + `/methodology`:**
  - `flow` 是实时项目状态
  - `methodology` 是半静态参考数据
  - 两者缓存周期不同、职责不同、失败隔离价值高
- **Error Handling Standard:** 不抛前端异常；后端返回可降级结果，前端决定静默隐藏或展示空态

### Frontend Architecture

- **Rendering Model:** 继续使用纯 DOM string render + event rebinding 模式
- **State Partition:**
  - `flowData` — 阶段条/建议/Sprint
  - `methodologyData` — phase groups + items
  - `uiState` — expanded phases / tooltip target / copied target / touch mode
- **Interaction Adapter:**
  - desktop: hover → tooltip, click → copy
  - touch: tap → tooltip, second-tap / long-press → copy
- **Layout Mode:**
  - regular mode: desktop / 宽容器
  - compact mode: `< 400px`
- **Performance Strategy:** methodology 渲染晚于基础页头，失败时不阻塞 V1 核心内容

### Infrastructure & Deployment

- **Hosting Strategy:** 无独立部署，继续作为 CloudCLI UI 插件分发
- **Runtime Requirements:** Node.js 18+（CloudCLI plugin docs 要求）；TypeScript 当前生态最新稳定版本可参考 6.0.3，但本项目遵循仓库锁定版本，升级作为独立 story 处理
- **CI/CD Approach:** 至少包含 TypeScript build、lint、parser 单测、基础 UI smoke test
- **Environment Configuration:** 无新增环境变量为默认方案；如后续需要 feature switches，优先通过 config file 而不是 env 注入
- **Monitoring Strategy:** 以开发期日志和测试为主；若宿主支持，可后续追加 lightweight telemetry

### Decision Impact Analysis

**Implementation Sequence:**
1. 提取并实现 CSV 解析/归一化纯函数
2. 增加 `/methodology` 服务端接口与缓存层
3. 扩展 `types.ts` 定义 methodology 数据模型
4. 在 `index.ts` 中插入 methodology 渲染区块
5. 抽象桌面/触屏交互适配层
6. 增加 tooltip / toast / copy feedback UI 状态机
7. 补充 parser / interaction / render 测试

**Cross-Component Dependencies:**
- parser 决定前端 view model 结构
- `/methodology` 接口设计决定前端状态拆分方式
- interaction adapter 决定 tooltip/toast 的 DOM 组织方式
- cache 失效语义必须与 `load()` / refresh / context-change 保持一致

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 6 个最可能导致多 AI agent 实现冲突的区域

### Naming Patterns

**API Naming Conventions:**
- 端点命名：使用小写英文单词，资源型路径使用 kebab-free plain segment，例如 `/flow`、`/methodology`
- Query 参数：前端传 `path`，后端内部再解析，不扩展额外 query 命名分支
- JSON 字段：统一使用 `camelCase`
- phase/status 原始值保留数据源命名（如 `ready-for-dev`），显示层再做 i18n

**Code Naming Conventions:**
- Type/interface/type alias：`PascalCase`
- function/variable：`camelCase`
- 文件名：沿用现有 `index.ts` / `server.ts` / `types.ts` 风格；新增 helper 文件用 `camelCase.ts`
- 常量：`UPPER_SNAKE_CASE` 仅用于 module-level immutable constants

### Structure Patterns

**Project Organization:**
- 后端解析与 RPC handler 仅放在 `src/server.ts` 或其后续拆分出的 server-side helper 中
- 前端 DOM render / event binding 仅放在 `src/index.ts` 或其前端 helper 中
- 共享数据结构统一放在 `src/types.ts`
- 若新增辅助文件，优先按 runtime 归属拆分，而不是按 feature 建新层级

**Test Structure Patterns:**
- parser / mapper 单测：`tests/server/`
- 前端 interaction / rendering 测试：`tests/ui/`
- 端到端 smoke：`tests/e2e/`
- 测试命名使用 `*.test.ts`

### Format Patterns

**API Response Formats:**
- 成功响应：直接返回业务 JSON 对象，不额外包裹 `data`
- 失败响应：返回 `{ error: string }` 或 `{ warning: string }`，与现有 `/flow` 风格兼容
- partial failure：附加 `partialFailure: true` 与 `skippedRows`

**Data Exchange Formats:**
- 时间：统一 ISO string
- 布尔值：原生 `true/false`
- 空数组优于 `null`
- 前端 view model 与 raw parsed rows 分离，禁止在 UI 层直接操作原始 CSV row

### Communication Patterns

**Event / UI State Patterns:**
- 不引入全局 event bus
- 使用局部 UI state + render 后重绑事件
- 触屏与桌面差异通过 `interactionMode: 'mouse' | 'touch'` 抽象，而不是散布条件判断

**State Management Patterns:**
- `flowData`、`methodologyData`、`uiState` 分离
- 任何用户交互后都通过单一 `render()` 重新反映状态，不做局部 DOM patch 的隐式分叉
- copied/tooltip/expanded 等短期状态集中管理，避免多个定时器互相覆盖

### Process Patterns

**Error Handling Patterns:**
- 后端负责识别并分类文件/编码/权限错误
- 前端只处理三种显示策略：正常渲染 / 空态渲染 / 静默降级
- methodology 失败绝不阻塞 V1 核心 flow 功能

**Loading State Patterns:**
- 统一使用骨架屏样式 `bf-skel`
- methodology 区块加载失败时不显示红色全局错误，避免喧宾夺主
- copy 成功/失败反馈统一使用 1.5s 消退策略

### Enforcement Guidelines

**All AI Agents MUST:**
- 保持 `server.ts` 与 `index.ts` 的 runtime 边界清晰，不跨层引入 DOM / fs 依赖
- 新增 JSON 字段一律使用 `camelCase`
- 任何解析逻辑优先抽成纯函数并配套测试
- H5 与桌面端交互必须走统一 interaction adapter 抽象
- methodology 功能出错时必须降级，而不是影响 V1 页面可用性

**Pattern Enforcement:**
- 代码评审检查 runtime boundary、naming、response format、state ownership
- 测试覆盖 parser / interaction / degraded path
- 如模式需要更新，先更新 architecture.md，再改实现

### Pattern Examples

**Good Examples:**
- `parseMethodologyCsv(rawText): MethodologyItem[]`
- `detectInteractionMode(window): 'mouse' | 'touch'`
- `renderMethodology(groups, uiState, theme, i18n)`
- `{ error: 'permission denied' }`

**Anti-Patterns:**
- 在前端直接解析 CSV 文本
- 在多个 click/hover handler 中各自维护 tooltip 状态
- 新增 snake_case JSON 字段
- methodology 加载失败后清空整个插件页面

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
cloudcli-plugin-starter/
├── manifest.json
├── package.json
├── package-lock.json / pnpm-lock.yaml
├── tsconfig.json
├── README.md
├── icon.svg
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── types.ts
│   ├── methodologyParser.ts            # 新增：CSV 解析与归一化纯函数
│   ├── methodologyViewModel.ts         # 新增：phase 分组与 UI view model 映射
│   ├── interactionMode.ts              # 新增：mouse/touch 模式检测
│   ├── methodologyRender.ts            # 新增：导航栏目渲染 helper
│   └── methodologyState.ts             # 新增：expanded/tooltip/copied 状态管理
├── tests/
│   ├── server/
│   │   ├── methodologyParser.test.ts
│   │   └── methodologyViewModel.test.ts
│   ├── ui/
│   │   ├── interactionMode.test.ts
│   │   ├── methodologyState.test.ts
│   │   └── methodologyRender.test.ts
│   └── e2e/
│       └── methodology-nav.smoke.test.ts
├── docs/
│   └── planning-artifacts/
│       ├── product-brief.md
│       ├── prd.md
│       ├── prd-validation-report.md
│       └── architecture.md
└── dist/
    ├── index.js
    ├── server.js
    └── *.js (compiled helpers)
```

### Architectural Boundaries

**API Boundaries:**
- `server.ts` 对外暴露 `/flow` 与 `/methodology`
- `methodologyParser.ts` / `methodologyViewModel.ts` 只被 `server.ts` 调用
- 前端永远不直接触碰文件系统路径或 CSV 原文

**Component Boundaries:**
- `index.ts` 负责页面整体 mount、load、context 变更
- `methodologyRender.ts` 只负责生成导航区 DOM/HTML
- `methodologyState.ts` 只负责 UI 状态转移，不发请求
- `interactionMode.ts` 只负责判定事件模式，不持有业务状态

**Service Boundaries:**
- 服务端：path 校验 → 文件读取 → parser → view model → JSON response
- 客户端：RPC load → state merge → render → bind events

**Data Boundaries:**
- Raw CSV row
- Normalized methodology item
- Grouped methodology section
- UI transient state（expanded / tooltip / copied）

### Requirements to Structure Mapping

**Feature Mapping:**
- FR-1 方法论数据接口 → `src/server.ts` + `src/methodologyParser.ts` + `src/methodologyViewModel.ts`
- FR-2/FR-3 导航栏目与条目渲染 → `src/index.ts` + `src/methodologyRender.ts` + `src/types.ts`
- FR-4/FR-5 tooltip/copy/touch → `src/interactionMode.ts` + `src/methodologyState.ts` + `src/index.ts`
- FR-6/FR-7 i18n/theme → 继续复用 `src/index.ts` 现有 I18N/TC 结构
- FR-8/FR-9 刷新与 H5 响应式 → `src/index.ts` + `src/interactionMode.ts`

**Cross-Cutting Concerns:**
- path security → `src/server.ts`
- cache invalidation → `src/server.ts` + `src/index.ts`
- accessibility → `src/methodologyRender.ts` + `src/index.ts`
- testing → `tests/server|ui|e2e`

### Integration Points

**Internal Communication:**
- `index.ts` 通过 `api.rpc()` 获取 methodology JSON
- `index.ts` 调用 `methodologyRender` 生成区块
- 交互事件通过 `methodologyState` 更新后触发重新渲染

**External Integrations:**
- CloudCLI plugin runtime
- 本地项目 `_bmad/_config/bmad-help.csv`
- 浏览器 Clipboard API / fallback execCommand

**Data Flow:**
1. context 提供 `project.path`
2. `load()` 请求 `/methodology`
3. server 解析 CSV 并返回 grouped sections
4. client 合并 `uiState`
5. render 输出 methodology 区块
6. 用户 hover/tap/click 更新状态并重渲染

### File Organization Patterns

**Configuration Files:**
- 插件配置与构建配置保留在根目录
- 不新增复杂配置层；如必须新增，优先根目录单文件配置

**Source Organization:**
- 先保持平铺；只有当 helper 增长明显时再考虑 `src/methodology/` 子目录

**Test Organization:**
- 运行时分层：server / ui / e2e
- 测试文件与目标模块一一映射，避免大而全测试文件

**Asset Organization:**
- 不新增大型静态资源
- tooltip/toast/indicator 全用 CSS/inline style 绘制

### Development Workflow Integration

**Development Server Structure:**
- 继续使用现有 TypeScript build/watch 方式
- methodology helpers 与主入口共同编译到 `dist/`

**Build Process Structure:**
- parser / render / state helper 必须为普通 TS 模块，避免运行时动态导入复杂度

**Deployment Structure:**
- 插件发布产物仍是 manifest + dist + icon + README
- 无新增部署目标，无新增后端服务

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- 所有技术选择彼此兼容：TypeScript + Node.js + DOM runtime + local HTTP RPC 是现有 V1 已验证的组合
- methodology 数据链路保持只读、无数据库、无额外服务，符合项目规模与宿主约束
- H5 适配通过 interaction adapter 实现，不需要引入第二套前端框架

**Pattern Consistency:**
- 命名、返回格式、状态分层、错误处理与现有 `/flow` 风格兼容
- parser / view model / UI state machine 的拆分与“纯函数 + 可测试”目标一致

**Structure Alignment:**
- 新增 helper 文件都挂靠在现有 `src/` 平铺结构内，边界清晰
- requirements 到文件位置映射明确，可直接驱动 story 拆分

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
- FR-1 到 FR-9 均有明确归属模块
- 安全约束、缓存、桌面/H5 双交互、tooltip、copy、紧凑模式均被架构承接

**Non-Functional Requirements Coverage:**
- 性能：服务端缓存 + 小文件解析 + 轻量渲染
- 安全：safePath 风格边界 + 本地路径白名单
- 可维护性：helper 模块化 + 纯函数测试
- 可访问性：aria、键盘焦点、状态播报均有落点

### Implementation Readiness Validation ✅

**Decision Completeness:**
- 关键决策已明确：接口拆分、数据模型、交互适配、缓存、错误处理、测试层次

**Structure Completeness:**
- 目标目录树、模块边界、集成点、测试位置已完整定义

**Pattern Completeness:**
- 最容易冲突的 naming / state / response / error / touch 交互已被约束

### Gap Analysis Results

**Critical Gaps:**
- 无阻塞性缺口

**Important Gaps:**
- 如未来要支持多模块聚合（BMM/GDS/CIS），需引入更通用的数据归一化层
- 如条目数量远超预期，需增加虚拟滚动或搜索优先策略

**Nice-to-Have Gaps:**
- 可补充 Storybook/visual regression 支持
- 可补充 runtime telemetry 观察真实使用模式

### Validation Issues Addressed

- 将 H5 适配纳入统一 interaction adapter，而不是单独实现一套移动页面
- 将 methodology 失败路径定义为静默降级，避免伤害 V1 主流程
- 明确 `/flow` 与 `/methodology` 分离，避免缓存语义混乱

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- 完全基于现有稳定基线增量演进，迁移风险低
- 桌面/H5 双端交互通过统一适配层收敛，不引入双实现分叉
- 数据链路、状态层、测试层边界清晰，适合后续 AI agent 协同开发

**Areas for Future Enhancement:**
- 搜索/过滤与多模块聚合
- 更丰富的可观察性与行为埋点
- 如果宿主开放执行能力，可把 copy 升级为 direct execute

### Implementation Handoff

**AI Agent Guidelines:**
- 严格遵守 server/client runtime 边界
- 先做 parser，再做 API，再做渲染，再做交互适配与测试
- 所有新增 JSON 字段保持 `camelCase`
- methodology 相关异常不得影响 V1 现有功能

**First Implementation Priority:**
1. `src/methodologyParser.ts`
2. `src/methodologyViewModel.ts`
3. `/methodology` endpoint in `src/server.ts`
4. methodology section render in `src/index.ts`
5. `src/interactionMode.ts` + `src/methodologyState.ts`
