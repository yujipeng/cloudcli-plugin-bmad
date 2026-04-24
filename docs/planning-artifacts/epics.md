---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/architecture.md
  - docs/planning-artifacts/prd-validation-report.md
---

# cloudcli-plugin-starter - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for cloudcli-plugin-starter, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: 后端新增 `GET /methodology` 端点，接受 `path` 查询参数（项目路径）
FR2: `path` 参数必须通过安全校验，拒绝路径穿越和符号链接逃逸
FR3: 读取 `{path}/_bmad/_config/bmad-help.csv` 并解析为结构化数据，仅支持 UTF-8
FR4: 过滤 `_meta` 行，不返回给前端
FR5: 按 `phase` 字段分组返回条目
FR6: 每个条目包含 `skill`、`displayName`、`menuCode`、`description`、`required`、`category`
FR7: `anytime` 阶段单独分组为“通用工具”
FR8: 分组按 1-analysis → 2-planning → 3-solutioning → 4-implementation → anytime 排序
FR9: 后端对文件不存在、权限拒绝、格式损坏、非 UTF-8、重复 menuCode 提供明确降级/错误策略
FR10: 在 Sprint 面板或空状态引导下方渲染方法论导航区域
FR11: 栏目标题支持 zh-CN/en 国际化
FR12: 每个阶段渲染为可折叠/展开的分组
FR13: 分组标题包含阶段图标、阶段名称、条目数量
FR14: 点击分组标题切换折叠/展开状态
FR15: 当前活跃阶段默认展开，并遵守首次加载/手动折叠/多 active 的明确规则
FR16: 通用工具区域始终展开，不可折叠
FR17: 仅在 `bmadDetected === true` 时渲染导航区域
FR18: 数据加载中显示骨架屏
FR19: 某阶段无条目时显示“暂无可用操作”
FR20: 数据加载失败时静默降级，不影响 V1 功能
FR21: 条目单行显示 `[菜单代码] + 显示名称`
FR22: `required === true` 条目显示左侧 2px 高亮竖线，并带 `data-required="true"`
FR23: agent 类条目与 workflow/tool 视觉区分
FR24: 条目 hover 时有背景变化
FR25: 桌面端 hover 300ms 后显示 tooltip
FR26: Tooltip 显示技能全称与描述
FR27: Tooltip 跟随主题配色且不超出容器边界
FR28: 移动端/H5 通过 tap 显示 tooltip，再 tap 或点其他区域关闭
FR29: 移动端 tooltip 显示在条目下方，宽度自适应容器
FR30: 桌面端点击条目复制技能全称到剪贴板
FR31: 复制成功后显示“✓ 已复制/✓ Copied”反馈，1.5 秒后消失
FR32: 复用现有 `copyToClipboard()` 与 fallback 机制
FR33: 复制失败时提示失败并选中文本便于手动复制
FR34: click 触发时关闭 tooltip，复制反馈优先于 hover
FR35: 移动端支持再次 tap 复制或 long-press（≥500ms）直接复制
FR36: 移动端复制反馈使用底部 toast
FR37: 阶段名称复用现有 `I18N.phases` 映射
FR38: 新增 `methodologyGuide`、`required` 等 i18n key
FR39: CSV 的 `displayName` 和 `description` 保持原始语言透传
FR40: 所有新增 UI 使用 `tc()` 主题令牌
FR41: 刷新按钮与 projectPath 变化时重新加载 methodology 数据
FR42: 前端 methodology 数据按 projectPath 会话缓存并在刷新/project change 时失效
FR43: 容器宽度 < 400px 进入紧凑模式
FR44: 移动端点击热区扩大到 44x44px
FR45: 通过 touch capability 检测决定 mouse/touch 交互模式
FR46: 移动端默认全部折叠，仅当前活跃阶段展开

### NonFunctional Requirements

NFR1: `/methodology` 接口 P95 响应时间 < 200ms，测量点为后端收到请求到返回响应，前提 CSV < 1MB
NFR2: 前端方法论导航渲染不阻塞主线程；预期数据量 < 100 行，无需虚拟滚动
NFR3: Tooltip 显示/隐藏延迟 < 150ms
NFR4: 兼容 BMad Method 6.x 的 `bmad-help.csv` 格式
NFR5: CSV 列数变化时优雅降级，缺失列使用默认值
NFR6: 无 `_bmad/_config/bmad-help.csv` 时静默降级
NFR7: 新增代码遵循 TypeScript strict、纯 DOM、无框架约束
NFR8: 类型定义集中在 `src/types.ts`
NFR9: CSV 解析逻辑独立为可测试纯函数
NFR10: 折叠/展开、复制等交互支持键盘操作
NFR11: Tooltip 与复制反馈满足 `aria-describedby` / `aria-live` 无障碍要求
NFR12: 颜色对比度满足 WCAG AA 标准

### Additional Requirements

- 必须沿用现有 CloudCLI plugin starter 基线，不引入新 starter 或框架迁移
- 保持现有三文件骨架（`src/server.ts` / `src/index.ts` / `src/types.ts`）并做增量扩展
- methodology 数据读取采用 request-time parse + process cache，不引入数据库
- `/methodology` 与 `/flow` 保持分离接口，避免缓存语义混乱
- 桌面与 H5 共用一套前端渲染代码，通过 `interaction adapter` 区分 mouse/touch 行为
- 前端状态拆分为 `flowData`、`methodologyData`、`uiState`
- tooltip / toast / copied 状态由独立 UI state machine 驱动
- 所有 JSON 字段统一使用 `camelCase`
- methodology 功能失败必须静默降级，绝不影响 V1 页面核心功能
- 新增模块建议：`src/methodologyParser.ts`、`src/methodologyViewModel.ts`、`src/interactionMode.ts`、`src/methodologyRender.ts`、`src/methodologyState.ts`
- 测试按 `tests/server`、`tests/ui`、`tests/e2e` 三层组织
- 推荐实现顺序：parser → API endpoint → shared types → render → interaction adapter → tests

### UX Design Requirements

无单独 UX Design 文档。
UX 相关要求已体现在 PRD 的 FR25-FR46 与用户旅程中，后续 stories 直接承接这些交互与响应式要求。

### FR Coverage Map

**Epic 1 — 发现与理解方法论**
- FR1-FR8: methodology 数据接口、分组、字段、排序
- FR10-FR24: 导航栏目、分组、视觉标记、标题、空态/加载态
- FR37-FR40: i18n、主题与展示一致性

**Epic 2 — 执行与跨端连续体验**
- FR25-FR36: 桌面 tooltip/copy、H5 tap/long-press、toast 与反馈链路
- FR41-FR46: 刷新、缓存失效、紧凑模式、触控检测、移动端默认折叠

**Epic 3 — 信任、可达性与质量门禁**
- FR9, FR18-FR20, FR33: 错误处理、失败回退、静默降级
- NFR1-NFR12: 性能、安全、兼容性、可维护性、无障碍
- Architecture additional requirements: 分层边界、测试分层、实现顺序

## Epic List

### Epic 1: 发现与理解方法论
用户可以在插件中发现方法论导航、按阶段浏览可用操作，并快速理解每个条目的意义。
**FRs covered:** FR1-FR8, FR10-FR24, FR37-FR40

### Epic 2: 执行与跨端连续体验
用户可以在桌面端与 H5 端顺畅查看详情、复制命令，并获得一致、可靠的操作反馈。
**FRs covered:** FR25-FR36, FR41-FR46

### Epic 3: 信任、可达性与质量门禁
用户获得稳定、可访问、可验证的方法论导航体验，即使在错误、降级或多平台差异场景下也能安心使用。
**FRs covered:** FR9, FR18-FR20, FR33, NFR1-NFR12

## Epic 1: 发现与理解方法论

用户可以在插件中发现方法论导航、按阶段浏览可用操作，并快速理解每个条目的意义。

### Story 1.1: 建立 methodology 数据契约与共享类型

As a user,
I want methodology data to be normalized into a stable model,
So that the navigation can reliably represent my project's BMad configuration.

**Acceptance Criteria:**

**Given** 项目中存在合法的 `_bmad/_config/bmad-help.csv`
**When** 后端读取并解析文件
**Then** 系统生成统一的 methodology item 数据结构
**And** 每个条目包含 `skill`、`displayName`、`menuCode`、`description`、`required`、`category`

**Given** CSV 中存在 `_meta` 行或缺失字段
**When** 解析器处理输入
**Then** `_meta` 行被过滤
**And** 缺失字段使用默认值填充

**Given** story 完成
**When** 运行 `tests/server`
**Then** 至少覆盖正常解析与缺列输入两个场景
**And** 共享类型定义已更新到 `src/types.ts`

### Story 1.2: 暴露安全的 methodology 只读接口

As a user,
I want the plugin to safely load methodology data from my current project,
So that I can browse guidance without exposing my filesystem to unsafe access.

**Acceptance Criteria:**

**Given** 前端传入合法项目路径
**When** 调用 `GET /methodology?path=...`
**Then** 后端返回按 phase 分组的 JSON 结果
**And** 分组顺序为 `1-analysis -> 2-planning -> 3-solutioning -> 4-implementation -> anytime`

**Given** 传入路径包含路径穿越或符号链接逃逸风险
**When** 后端执行路径校验
**Then** 请求被拒绝
**And** 返回明确错误响应

**Given** story 完成
**When** 运行接口契约测试
**Then** 成功响应与错误响应结构都被验证
**And** 不允许前端直接读取 CSV 原文

### Story 1.3: 渲染方法论导航基础分组与条目列表

As a user,
I want to see methodology navigation grouped by phase under the existing Bmad Flow panels,
So that I can browse available workflows in the same place where I already track flow state.

**Acceptance Criteria:**

**Given** `bmadDetected === true` 且 methodology 数据加载成功
**When** 页面渲染完成
**Then** 方法论导航显示在 Sprint 面板或空状态引导下方
**And** 每个阶段以可折叠分组形式展示

**Given** 某分组已渲染
**When** 用户查看分组标题和条目
**Then** 标题显示阶段图标、名称与条目数量
**And** 条目单行显示 `[菜单代码] + 显示名称`

**Given** story 完成
**When** 运行前端渲染测试
**Then** methodology 区块不会破坏现有阶段条、建议卡片与 Sprint 面板的显示

### Story 1.4: 提供加载态、空态与视觉语义

As a user,
I want the methodology area to explain what is happening even before I interact,
So that I can trust the navigation and understand each item's role.

**Acceptance Criteria:**

**Given** methodology 数据正在加载
**When** 页面渲染该区域
**Then** 显示骨架屏
**And** 不阻塞 V1 现有区块显示

**Given** 某阶段没有条目
**When** 用户展开该阶段
**Then** 显示“暂无可用操作”提示
**And** 页面布局保持稳定

**Given** 某条目为 `required === true` 或 `category === 'agent'`
**When** 条目渲染
**Then** required 条目显示左侧 2px 高亮竖线
**And** agent 条目具有与 workflow/tool 不同的视觉区分

### Story 1.5: 让导航与现有主题和国际化系统一致

As a user,
I want the methodology area to look and read like the rest of Bmad Flow,
So that the new navigation feels native rather than bolted on.

**Acceptance Criteria:**

**Given** 当前 locale 为 `zh-CN` 或 `en`
**When** 栏目渲染
**Then** 栏目标题、阶段名称与必需标记使用现有 i18n 系统输出
**And** CSV 的 `displayName` 与 `description` 保持原始语言透传

**Given** 当前主题切换为浅色或深色
**When** 方法论导航重新渲染
**Then** 分组、条目、tooltip、标记都使用现有 `tc()` 主题令牌
**And** 不引入新的样式系统或 CSS framework

## Epic 2: 执行与跨端连续体验

用户可以在桌面端与 H5 端顺畅查看详情、复制命令，并获得一致、可靠的操作反馈。

### Story 2.1: 建立统一的交互模式检测与状态机基础

As a user,
I want the navigation to respond correctly to mouse and touch input,
So that I can use the same feature naturally across devices.

**Acceptance Criteria:**

**Given** 插件运行在支持 mouse 或 touch 的环境中
**When** 前端初始化交互模式
**Then** 系统识别当前交互模式并写入统一状态
**And** 后续 tooltip/copy 行为都通过该状态机分流

**Given** story 完成
**When** 运行 `tests/ui`
**Then** 至少覆盖 mouse 与 touch 两种模式切换
**And** 交互状态不直接耦合到具体 DOM 事件实现细节

### Story 2.2: 桌面端查看详情并复制命令

As a desktop user,
I want to hover a methodology item for details and click it to copy the command,
So that I can quickly understand and execute the right BMad skill.

**Acceptance Criteria:**

**Given** 用户在桌面端将鼠标悬停在条目上
**When** 停留超过 300ms
**Then** tooltip 显示技能全称与描述
**And** tooltip 不超出插件容器边界

**Given** tooltip 已显示
**When** 用户点击该条目
**Then** 技能全称被复制到剪贴板
**And** tooltip 立即关闭并显示“✓ 已复制/✓ Copied”反馈

**Given** story 完成
**When** 运行桌面端交互测试
**Then** hover、click、copied feedback 的行为都可重复验证

### Story 2.3: H5 端预览条目详情

As a touch user,
I want to tap a methodology item to preview its full skill name and description,
So that I can understand the command before deciding to copy it.

**Acceptance Criteria:**

**Given** 用户在 H5/触屏端点击某个条目一次
**When** 当前没有该条目的 tooltip 打开
**Then** 该条目下方显示 tooltip
**And** tooltip 内容包含技能全称与描述

**Given** tooltip 已打开
**When** 用户点击其他区域或再次点击同一条目
**Then** tooltip 关闭
**And** 不触发复制行为

**Given** story 完成
**When** 运行 H5 预览交互测试
**Then** tap 预览和 dismiss 行为都被验证

### Story 2.4: H5 端执行复制与反馈闭环

As a touch user,
I want to copy a command using second tap or long-press and receive clear feedback,
So that I can complete the action confidently on mobile devices.

**Acceptance Criteria:**

**Given** 某条目的 tooltip 已在 H5 端显示
**When** 用户再次点击同一条目
**Then** 技能全称被复制到剪贴板
**And** 底部显示 toast 反馈

**Given** 用户长按条目超过 500ms
**When** long-press 被识别
**Then** 系统直接执行复制操作
**And** 不需要先显示 tooltip

**Given** 复制失败
**When** H5 端无法写入剪贴板
**Then** 显示复制失败提示
**And** 提供可手动复制的文本内容

### Story 2.5: 在桌面端与 H5 端保持布局连续性

As a user,
I want the navigation layout to adapt to my device without losing context,
So that I can continue browsing and copying commands regardless of screen size.

**Acceptance Criteria:**

**Given** 容器宽度小于 400px
**When** 方法论导航渲染
**Then** 页面进入紧凑模式
**And** 条目字号与内边距按紧凑规格调整

**Given** 页面在移动端首次加载
**When** 方法论导航初始化
**Then** 仅当前 active phase 默认展开
**And** 其他阶段默认折叠

**Given** 用户点击分组标题
**When** 在移动端切换展开状态
**Then** 点击热区至少为 44x44px
**And** 不会误触相邻条目

## Epic 3: 信任、可达性与质量门禁

用户获得稳定、可访问、可验证的方法论导航体验，即使在错误、降级或多平台差异场景下也能安心使用。

### Story 3.1: 处理数据错误并保证静默降级

As a user,
I want methodology navigation failures to stay contained,
So that I can still use the existing Bmad Flow core features even when methodology data is unavailable.

**Acceptance Criteria:**

**Given** CSV 文件不存在、权限不足、格式损坏或编码非法
**When** 后端处理 methodology 请求
**Then** 返回符合约定的 error/warning/partialFailure 响应
**And** 不导致 server 崩溃

**Given** 前端接收到失败或 warning 响应
**When** methodology 区块渲染
**Then** 该区块静默降级或展示局部失败状态
**And** 现有阶段条、建议卡片和 Sprint 面板保持可用

### Story 3.2: 提供复制失败的用户回退路径

As a user,
I want a graceful fallback when copy fails,
So that I can still retrieve and use the command manually.

**Acceptance Criteria:**

**Given** Clipboard API 与 fallback copy 都失败
**When** 用户尝试复制条目
**Then** 系统显示“复制失败”提示
**And** 自动提供可选中文本供手动复制

**Given** 用户再次尝试复制同一条目
**When** 第二次触发复制
**Then** 系统允许重试
**And** 不因前一次失败进入不可恢复状态

### Story 3.3: 支持键盘与读屏的完整无障碍路径

As a keyboard or screen-reader user,
I want the methodology navigation to be fully operable and announced accessibly,
So that I can use the feature without relying on mouse or touch.

**Acceptance Criteria:**

**Given** 用户使用 Tab 键在页面中导航
**When** 焦点进入方法论导航区域
**Then** 焦点顺序为阶段标题 → 条目 → 下一阶段标题
**And** 用户可通过 Enter/Space 展开或折叠阶段

**Given** 条目获得键盘焦点
**When** 需要显示辅助信息
**Then** tooltip 通过 `aria-describedby` 关联到条目
**And** 屏幕阅读器可读取其内容

**Given** 用户触发复制动作
**When** 复制成功或失败
**Then** 系统通过 `aria-live` 区域播报结果
**And** 不重复播报过期状态

### Story 3.4: 建立服务端契约与解析测试门禁

As a developer,
I want parser and API contracts covered by automated tests,
So that future changes do not silently break methodology data handling.

**Acceptance Criteria:**

**Given** 后端解析与接口实现完成
**When** 运行 `tests/server`
**Then** 覆盖 CSV 解析、缺列默认值、错误处理、分组排序与接口响应结构
**And** 所有解析与契约相关测试通过

**Given** 项目存在新的字段或格式变化
**When** 更新解析逻辑
**Then** 契约测试能暴露破坏性变更
**And** 需要显式更新测试样例才能通过

### Story 3.5: 建立跨模态 UI 与发布前质量门禁

As a developer,
I want interaction, a11y, smoke, and performance checks integrated into the delivery process,
So that methodology navigation remains stable across desktop and H5 releases.

**Acceptance Criteria:**

**Given** 前端交互逻辑完成
**When** 运行 `tests/ui`
**Then** 覆盖桌面 hover/click、H5 tap/long-press、copied state、tooltip state、紧凑模式与焦点路径
**And** 关键交互都可自动验证

**Given** 项目执行构建与 smoke 测试
**When** 验证 methodology 导航功能
**Then** 记录 `/methodology` 接口耗时基线
**And** 验证其满足 P95 < 200ms 的目标前提

**Given** 发布前执行质量门禁
**When** 运行 a11y 与 smoke 检查
**Then** 无障碍关键路径通过
**And** methodology 功能失败不会影响 V1 主路径
