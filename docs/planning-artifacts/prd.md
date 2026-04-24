---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments: ['docs/planning-artifacts/product-brief.md', 'src/server.ts', 'src/index.ts', 'src/types.ts']
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 3
classification:
  projectType: 'developer_tool'
  domain: 'general'
  complexity: 'low'
  projectContext: 'brownfield'
---

# 产品需求文档 — Bmad Flow V2

**作者：** TCXY Engineer
**日期：** 2026-04-24
**版本：** 2.1（验证修订版）

---

## 执行摘要

Bmad Flow 是 CloudCLI UI 的侧边栏插件，为使用 BMad Method 的开发团队提供流程可视化与操作引导。V1（MVP）通过阶段条、下一步建议卡片和 Sprint 面板解决了"我在哪"的问题。V2 在此基础上新增**方法论速查导航**栏目，按阶段展示全部工作流、智能体和命令，支持 hover 查看全称、click 复制命令，将插件从状态看板升级为**认知工作台与操作引导平台**。

### 产品特色

- **数据驱动导航**：从 `bmad-help.csv` 动态读取方法论结构，不硬编码，随 BMad 版本自动更新
- **上下文感知**：当前活跃阶段自动展开，引导用户关注最相关的操作
- **零摩擦操作**：hover 查看 → click 复制 → 粘贴执行，三步完成任意 BMad 命令
- **嵌入式认知**：用户无需离开 IDE 即可获得 BMad 方法论全貌

### 项目分类

| 维度 | 值 |
|------|-----|
| 项目类型 | developer_tool（IDE 插件） |
| 领域 | general（开发者工具） |
| 复杂度 | 低 |
| 项目背景 | 棕地迭代（V1 MVP 已上线） |
| 检测信号 | SDK, library, package, npm, IDE integration |
| 关键问题 | 语言支持、包管理、IDE 集成、文档、示例 |

## 成功标准

### 用户成功

| ID | 指标 | 基线 | 目标 | 测量方式 |
|----|------|------|------|----------|
| US-1 | 命令查找时间 | 待 V1 数据采集（预估 > 30 秒，需查文档） | < 5 秒找到当前阶段可用命令 | 用户测试计时 |
| US-2 | 方法论认知覆盖 | V1 用户需查阅外部文档 | 无需查阅外部文档即可了解全貌 | 用户访谈 |
| US-3 | 命令复制成功率 | N/A（V1 无此功能） | > 95% | 前端埋点 |

### 业务成功

| ID | 指标 | 基线 | 目标 | 测量方式 |
|----|------|------|------|----------|
| BS-1 | 导航栏目使用率 | N/A（新功能） | 日活用户中 > 40% 使用（上线 2 周后校准） | 插件使用统计 |
| BS-2 | 首次命令执行时间 | 待 V1 数据采集 | 从安装到首次使用缩短 50% | 漏斗分析 |
| BS-3 | 导航栏目 7 日留存 | N/A | > 40%（第 7 天仍在使用导航栏目的用户占比） | 留存分析 |

### 技术成功

| ID | 指标 | 目标 | 测量方式 |
|----|------|------|----------|
| TS-1 | 数据加载时间 | < 200ms | 性能监控 |
| TS-2 | CSV 兼容性 | BMad Method 6.x | 集成测试 |
| TS-3 | 架构一致性 | 无框架依赖，纯 DOM | 代码审查 |

### 可测量成果

- 方法论导航栏目上线后 2 周内，用户查阅外部 BMad 文档的频率下降
- 新用户从安装到执行第一个 BMad 命令的平均时间缩短

## 产品范围

### MVP（V2 本次迭代）

- 方法论速查导航栏目（按阶段分组、折叠/展开）
- 后端 `/methodology` 接口（CSV 解析 + 阶段分组）
- 条目 hover tooltip（技能全称 + 描述）
- 条目 click 复制命令到剪贴板
- 当前活跃阶段默认展开
- 通用工具区域始终可见
- i18n 支持（zh-CN / en）
- 深色/浅色主题适配

### 增长功能（Post-MVP）

- 条目点击直接在 Claude Code 中执行命令（需 Plugin API 扩展）
- 搜索/过滤功能
- 自定义收藏常用命令

### 愿景（Future）

- 工作流依赖关系可视化（DAG 图）
- 智能推荐：基于项目状态推荐最相关的工作流组合
- 多模块支持：同时展示 BMM、GDS、CIS 等不同模块的方法论

## 用户旅程

### 旅程 1：新手首次探索方法论

**角色：** 刚接触 BMad Method 的初级开发者
**触发：** 安装了 BMad 模块，打开 Bmad Flow 插件，不知道该从哪里开始
**情感弧线：** 迷茫 → 发现导航 → 理解流程 → 自信操作

小张刚加入团队，被告知项目使用 BMad 方法论。他打开 CloudCLI UI 侧边栏的 Bmad Flow 插件，看到阶段条显示 Discovery 阶段高亮。向下滚动，一个新的"方法论导航"区域映入眼帘，Discovery 阶段已经展开，列出了几个选项。

他看到"产品简报 [CB]"，鼠标悬停，一个 tooltip 弹出显示 `bmad-product-brief` 和"Expert guided experience to nail down your product idea in a brief"。他点击这个条目，底部出现"✓ 已复制"的提示。切换到终端，Ctrl+V 粘贴，回车执行，产品简报的引导流程就启动了。

小张心想："原来这么简单，不用翻文档就知道该做什么。"

**揭示的能力需求：**
- 阶段分组展示 + 当前阶段自动展开
- Hover tooltip 显示全称和描述
- Click 复制到剪贴板

### 旅程 2：老手快速查找命令

**角色：** 熟悉 BMad 方法论的资深开发者
**触发：** 知道要做代码审查，但忘了具体命令名
**情感弧线：** 需要 → 快速找到 → 完成

老李正在做 code review，他知道 BMad 有个代码审查的命令但记不清全称。打开 Bmad Flow，展开 Development 阶段，一眼看到"代码审查 [CR]"，点击复制 `bmad-code-review`，粘贴执行。整个过程不到 3 秒。

**揭示的能力需求：**
- 折叠/展开交互（快速定位目标阶段）
- 菜单代码标签辅助识别

### 旅程 3：项目负责人评估流程

**角色：** 技术负责人
**触发：** 想了解整个 BMad 流程有哪些环节，评估团队工作量
**情感弧线：** 好奇 → 全面了解 → 规划信心

王总监打开 Bmad Flow，逐个展开各阶段浏览。他注意到某些条目带有"必需"标记，理解了关键路径。通用工具区域始终可见，让他了解到审查、文档等辅助能力随时可用。他截图发给团队："这就是我们的工作流全景图。"

**揭示的能力需求：**
- 必需/可选视觉区分
- 通用工具区域始终可见
- 全阶段浏览能力

### 旅程 4：移动端/H5 快速查找命令

**角色：** 使用 iPad 或 H5 页面查看插件内容的开发者
**触发：** 在触屏设备上需要快速查找某个 BMad 命令
**情感弧线：** 试探 → 发现触控逻辑 → 熟练使用

小陈在 iPad 上打开 CloudCLI UI 的 H5 页面，Bmad Flow 以紧凑模式展示。因为屏幕较窄，只有当前活跃阶段展开，其他阶段折叠。他 tap 了一下某个条目，tooltip 出现在条目下方，显示完整技能名和描述。再 tap 一次，命令被复制，底部弹出 toast："✓ 已复制"。后来他发现 long-press 也可以直接复制，变得更熟练了。

**揭示的能力需求：**
- Tap 显示 tooltip
- Long-press 直接复制
- 响应式紧凑布局
- 移动端 toast 反馈

### 旅程需求汇总

| 能力 | 旅程 1 | 旅程 2 | 旅程 3 | 旅程 4 |
|------|--------|--------|--------|--------|
| 阶段分组展示 | ✓ | ✓ | ✓ | ✓ |
| 当前阶段自动展开 | ✓ | | | ✓ |
| 折叠/展开交互 | | ✓ | ✓ | ✓ |
| Hover tooltip | ✓ | | | |
| Tap tooltip（H5） | | | | ✓ |
| Click 复制 | ✓ | ✓ | | |
| Long-press 复制（H5） | | | | ✓ |
| 必需/可选标记 | | | ✓ | |
| 通用工具始终可见 | | | ✓ | |
| 响应式紧凑模式 | | | | ✓ |

## 领域特定需求

本项目属于 general 领域（低复杂度），无特殊合规或监管要求。以下为开发者工具领域的标准约束：

### 插件 API 约束
- 前端仅允许纯 DOM 操作，禁止引入 React/Vue 等框架（CloudCLI UI 插件规范）
- 后端通过 HTTP RPC 与前端通信，遵循 `api.rpc(method, path, body?)` 协议
- 数据来源限于项目本地文件系统（`_bmad/` 和 `.claude/skills/`）

### BMad Method 兼容性
- 必须兼容 `bmad-help.csv` 当前 16 列格式
- 阶段名称映射：`1-analysis` → Discovery、`2-planning` → Planning、`3-solutioning` → Design、`4-implementation` → Development
- `anytime` 阶段需特殊处理为"通用工具"分组
- `_meta` 行为模块元数据，不展示给用户

### 棕地约束
- 必须保持 V1 所有功能不变（阶段条、建议卡片、Sprint 面板、空状态引导）
- 新增代码复用现有基础设施（主题系统、i18n、剪贴板）
- 类型定义集中在 `types.ts`，后端接口风格与 `/flow` 一致

### 平台约束
- V2 同时支持桌面端（鼠标交互）和移动端/H5（触屏交互）
- 桌面端：hover 显示 tooltip，click 复制命令
- 移动端：tap 显示 tooltip，再次 tap 或 long-press 复制命令（详见 FR-4 和 FR-5）
- 响应式布局：侧边栏宽度 < 400px 时切换为紧凑模式

### 信息架构设计决策
- 按阶段分组是 V2 的设计选择，理由：与 V1 阶段条形成认知一致性，用户在阶段条看到当前阶段后，自然向下查看该阶段的可用操作。替代方案（按频率排序、搜索过滤）需要使用数据支撑，留到 Post-MVP 根据实际使用数据决定

## 创新与新颖模式

### 检测到的创新领域

**嵌入式方法论导航**（新范式）：将软件开发方法论从"外部文档查阅"转变为"IDE 内交互式导航"。这在开发者工具领域是一个新的交互模式 — 现有工具要么提供静态文档，要么提供命令行帮助，没有将方法论知识以可视化、可交互的形式嵌入 IDE 侧边栏。

### 市场背景

- 现有 BMad 方法论的使用依赖用户记忆命令或查阅文档
- IDE 插件市场中没有类似的方法论导航产品
- 最接近的竞品是 CLI 的 `--help` 输出和静态文档站点

### 验证方法

- 内部团队试用 2 周，收集命令查找时间和使用频率数据
- 对比 V1 和 V2 的用户首次命令执行时间

### 风险缓解

- 数据驱动设计降低了硬编码风险 — CSV 格式变化时优雅降级
- 渐进式展示（折叠/展开）避免信息过载

## 开发者工具特定需求

### 项目类型概览

Bmad Flow 是一个 IDE 插件（developer_tool 子类），运行在 CloudCLI UI 的侧边栏中。它不是独立应用，而是宿主环境的扩展。

### 技术架构考量

```
前端 (index.ts)              后端 (server.ts)
┌──────────────────┐        ┌────────────────────────┐
│ 阶段条 (V1)       │        │ GET /flow (V1)         │
│ 建议卡片 (V1)     │  RPC   │ GET /methodology (V2)  │
│ Sprint 面板 (V1)  │◄──────►│   ├ CSV 解析            │
│ 方法论导航 (V2)   │        │   ├ 阶段分组            │
│   ├ 折叠/展开     │        │   └ 条目结构化          │
│   ├ Tooltip       │        └────────────────────────┘
│   └ Click 复制    │
└──────────────────┘
```

### 数据流

1. 前端 `mount()` 时调用 `api.rpc('GET', 'methodology?path=...')`
2. 后端读取 `{projectPath}/_bmad/_config/bmad-help.csv`
3. 解析 CSV，过滤 `_meta` 行，按 `phase` 字段分组
4. 每个条目提取：`skill`（技能名）、`display-name`、`menu-code`、`description`、`required`
5. 返回 JSON 结构给前端
6. 前端渲染折叠/展开分组，绑定 hover/click 事件

### 安装与分发

- 通过 CloudCLI UI Settings > Plugins 安装（git 仓库地址）
- 或手动 clone + npm install + npm run build
- 无需额外配置，自动检测 `_bmad/` 目录

### 实现考量

- CSV 解析：无需第三方库，bmad-help.csv 格式简单，可用正则或 split 处理
- 前端状态：方法论数据在 `load()` 时获取，与 flow 数据一起缓存
- 事件绑定：每次 `render()` 后重新绑定（与 V1 模式一致）

## 项目范围与分阶段开发

### MVP 策略

采用"最小可用导航"策略：优先实现核心的阶段分组展示 + hover/click 交互，确保用户能完成"查找 → 了解 → 复制"的完整闭环。视觉打磨和高级功能留到后续迭代。

### MVP 功能集（Phase 1）

| 优先级 | 功能 | 理由 |
|--------|------|------|
| P0 | 后端 `/methodology` 接口 | 数据基础，所有前端功能依赖 |
| P0 | 阶段分组展示 | 核心导航结构 |
| P0 | 折叠/展开交互 | 信息密度管理 |
| P0 | 当前阶段自动展开 | 上下文感知的关键体验 |
| P0 | Click 复制命令 | 核心操作闭环 |
| P1 | Hover tooltip | 信息补充，降低学习曲线 |
| P1 | 必需/可选标记 | 关键路径可视化 |
| P1 | 通用工具始终可见 | 辅助工具可达性 |
| P1 | i18n 支持 | 国际化一致性 |
| P1 | 主题适配 | 视觉一致性 |

### Post-MVP 功能

| 功能 | 触发条件 |
|------|----------|
| 搜索/过滤 | 用户反馈命令数量过多时 |
| 收藏常用命令 | 用户使用模式稳定后 |
| 直接执行命令 | Plugin API 支持 executeCommand 后 |

### 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| CSV 格式变化 | 列缺失时使用默认值，不硬编码列索引 |
| 信息过载（40+ 条目） | 折叠/展开 + 阶段分组 + 通用工具独立区域 |
| 性能（文件系统扫描） | CSV 文件 < 10KB，一次性读取，会话内缓存 |

## 功能需求

### 方法论数据接口

- **FR-1.1**: 后端新增 `GET /methodology` 端点，接受 `path` 查询参数（项目路径）
- **FR-1.2**: `path` 参数安全约束：必须通过 `path.resolve()` 规范化后校验为已知合法项目路径（与 `/flow` 接口复用同一 `safePath()` 校验逻辑），拒绝路径穿越（`../`）和符号链接逃逸
- **FR-1.3**: 读取 `{path}/_bmad/_config/bmad-help.csv`，解析为结构化数据。仅支持 UTF-8 编码
- **FR-1.4**: 过滤 `_meta` 行（模块元数据），不返回给前端
- **FR-1.5**: 按 `phase` 字段分组，每组包含条目数组
- **FR-1.6**: 每个条目包含字段：`skill`（技能全称）、`displayName`（显示名）、`menuCode`（菜单代码）、`description`（描述）、`required`（是否必需）、`category`（分类：workflow / agent / tool）
- **FR-1.7**: `anytime` 阶段单独分组，命名为"通用工具"
- **FR-1.8**: 分组按阶段顺序排列：1-analysis → 2-planning → 3-solutioning → 4-implementation → anytime
- **FR-1.9**: 错误处理矩阵：

| 场景 | 响应 |
|------|------|
| 路径不存在或无 `_bmad/` 目录 | 返回 `{ groups: [], warning: "no bmad directory" }` |
| CSV 文件不存在 | 返回 `{ groups: [], warning: "methodology file not found" }` |
| 文件权限拒绝 | 返回 HTTP 403 + `{ error: "permission denied" }` |
| CSV 格式损坏（列数不对） | 跳过损坏行，返回成功解析的行 + `{ partialFailure: true, skippedRows: number }` |
| 非 UTF-8 编码 | 返回 HTTP 400 + `{ error: "unsupported encoding, UTF-8 required" }` |
| 重复 menuCode | 保留全部，不去重（不同模块可能有相同 menuCode） |

### 方法论导航栏目

- **FR-2.1**: 在 Sprint 面板（或空状态引导）下方渲染方法论导航区域
- **FR-2.2**: 区域标题："方法论导航"（zh-CN）/ "Methodology Guide"（en）
- **FR-2.3**: 每个阶段渲染为可折叠/展开的分组
- **FR-2.4**: 分组标题包含：阶段图标 + 阶段名称（i18n）+ 条目数量
- **FR-2.5**: 点击分组标题切换折叠/展开状态
- **FR-2.6**: 当前活跃阶段（与阶段条 `active` 状态联动）默认展开。具体行为：首次加载时展开第一个 `active` 阶段；用户手动折叠后，刷新不自动重新展开（尊重用户选择）；多阶段同时 `active` 时仅展开第一个
- **FR-2.7**: 通用工具区域始终展开，不可折叠
- **FR-2.8**: 仅在 `bmadDetected === true` 时渲染
- **FR-2.9**: 数据加载中显示骨架屏（复用 V1 的 `bf-skel` 动画样式）
- **FR-2.10**: 某阶段无条目时，折叠面板内显示"暂无可用操作"提示文案
- **FR-2.11**: 方法论数据加载失败时，不渲染导航栏目（静默降级，不影响 V1 功能）

### 条目渲染

- **FR-3.1**: 每个条目单行显示：`[菜单代码]` + 显示名称
- **FR-3.2**: `required === true` 的条目带左侧 2px 竖线高亮（使用 `accent` 色），通过 `data-required="true"` 属性标识
- **FR-3.3**: 智能体类型条目（`category === 'agent'`）使用不同颜色或图标区分
- **FR-3.4**: 条目 hover 时背景色变化，提示可交互

### Hover Tooltip

- **FR-4.1**: 桌面端：鼠标悬停条目 300ms 后显示 tooltip
- **FR-4.2**: Tooltip 内容第一行：技能全称（如 `bmad-create-prd`）
- **FR-4.3**: Tooltip 内容第二行：描述文本（来自 CSV `description` 字段）
- **FR-4.4**: Tooltip 跟随主题配色（深色/浅色）
- **FR-4.5**: 鼠标移出条目后 tooltip 消失
- **FR-4.6**: Tooltip 不超出插件容器边界（自动调整位置）
- **FR-4.7**: 移动端/H5：tap 条目显示 tooltip（替代 hover）；tap 其他区域或再次 tap 同一条目关闭 tooltip
- **FR-4.8**: 移动端 tooltip 显示在条目下方（避免手指遮挡），宽度自适应容器

### Click 复制

- **FR-5.1**: 桌面端：点击条目将 `skill` 字段值（技能全称）复制到系统剪贴板
- **FR-5.2**: 复制成功后在条目旁显示"✓ 已复制"（zh-CN）/ "✓ Copied"（en）反馈
- **FR-5.3**: 反馈文本 1.5 秒后自动消失
- **FR-5.4**: 复用现有 `copyToClipboard()` 函数（含 fallback）
- **FR-5.5**: 复制失败时（剪贴板权限被拒），显示"复制失败"提示并选中技能全称文本，便于用户手动 Ctrl+C
- **FR-5.6**: click 触发时立即关闭已显示的 tooltip，显示复制反馈（click 优先级高于 hover）
- **FR-5.7**: 移动端/H5：tooltip 显示状态下，再次 tap 同一条目触发复制；或 long-press（≥ 500ms）条目直接复制（跳过 tooltip）
- **FR-5.8**: 移动端复制反馈使用 toast 提示（底部居中，1.5 秒自动消失），避免遮挡条目内容

### 国际化

- **FR-6.1**: 阶段名称复用现有 `I18N.phases` 映射
- **FR-6.2**: 新增 i18n 键：`methodologyGuide`（栏目标题）、`required`（必需标记文本）
- **FR-6.3**: 条目的 `displayName` 和 `description` 保持 CSV 原始语言
- **FR-6.4**: 折叠/展开状态文本无需 i18n（使用箭头图标 ▸/▾）

### 主题适配

- **FR-7.1**: 所有新增 UI 元素使用 `tc()` 返回的主题色对象（类型 `TC`）
- **FR-7.2**: 分组标题背景使用 `c.surface`，边框使用 `c.border`（对应 `TC.surface` / `TC.border` 属性）
- **FR-7.3**: Tooltip 背景使用 `c.surface`，文字使用 `c.text`
- **FR-7.4**: 条目 hover 背景使用 `c.dim`
- **FR-7.5**: 必需标记竖线使用 `c.accent`

### 数据刷新

- **FR-8.1**: 点击现有"↻ 刷新"按钮时，同时重新加载方法论数据
- **FR-8.2**: 项目切换时（`onContextChange` 中 `project.path` 变化）重新加载
- **FR-8.3**: 同一 project path 下，方法论数据在会话内缓存。失效条件：projectPath 变化时强制失效；用户点击刷新按钮时失效。后端建议基于文件 mtime 做进程内内存缓存，mtime 变化时自动失效

### 响应式布局（H5 适配）

- **FR-9.1**: 容器宽度 < 400px 时进入紧凑模式：条目字号缩小至 0.58rem，内边距减半
- **FR-9.2**: 折叠/展开的点击热区在移动端扩大至 44x44px（满足触屏最小触控目标）
- **FR-9.3**: 移动端检测方式：通过 `'ontouchstart' in window` 或 `navigator.maxTouchPoints > 0` 判断，决定使用 hover 还是 tap 交互模式
- **FR-9.4**: 移动端阶段分组默认全部折叠（屏幕空间有限），仅当前活跃阶段展开

## 非功能需求

### 性能

- **NFR-1.1**: `/methodology` 接口 P95 响应时间 < 200ms，测量点为后端收到请求到返回响应（不含网络传输），前提条件：CSV 文件 < 1MB。测量工具：服务端计时日志或 k6 基准测试
- **NFR-1.2**: 前端方法论导航渲染不阻塞主线程。预期数据量 < 100 行，不需要虚拟滚动；若未来数据量超过 200 行，需引入虚拟化方案
- **NFR-1.3**: Tooltip 显示/隐藏无可感知延迟（CSS transition < 150ms）

### 兼容性

- **NFR-2.1**: 兼容 BMad Method 6.x 的 bmad-help.csv 格式
- **NFR-2.2**: CSV 列数变化时优雅降级（缺失列使用空字符串默认值）
- **NFR-2.3**: 无 `_bmad/_config/bmad-help.csv` 文件时不渲染导航栏目（静默降级）

### 可维护性

- **NFR-3.1**: 新增代码遵循现有项目风格（TypeScript strict、纯 DOM、无框架）
- **NFR-3.2**: 新增类型定义集中在 `types.ts`
- **NFR-3.3**: 后端新接口与 `/flow` 接口代码风格一致
- **NFR-3.4**: CSV 解析逻辑独立为可测试的纯函数

### 可访问性

- **NFR-4.1**: 折叠/展开支持键盘操作（Tab 聚焦 + Enter/Space 切换）。Tab 顺序：阶段标题 → 该阶段内条目 → 下一阶段标题。提供"跳到下一阶段"快捷键（Escape 从条目跳回阶段标题）
- **NFR-4.2**: 条目支持键盘触发复制（Tab 聚焦 + Enter）
- **NFR-4.3**: Tooltip 内容通过 `aria-describedby` 关联到条目元素，键盘 focus 时等效触发 tooltip 显示。复制操作通过 `aria-live="polite"` 区域播报"已复制 {skill 名称}"
- **NFR-4.4**: 颜色对比度满足 WCAG AA 标准（4.5:1 文本、3:1 UI 组件）
