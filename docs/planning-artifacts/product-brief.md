# Bmad Flow V2 产品简报

## 产品愿景

将 Bmad Flow 从"流程状态看板"升级为 **Bmad 认知工作台与操作引导平台**。用户在插件界面中不仅能看到"我在哪"，还能清晰了解"能做什么、怎么做"，实现方法论的可视化认知与一键操作引导。

## 目标用户

使用 CloudCLI UI 的开发者和产品团队成员，已安装或即将安装 BMad Method 模块，需要在 IDE 侧边栏中快速查阅方法论流程并执行操作。

## 问题陈述

MVP 版本提供了阶段条、下一步建议和 Sprint 面板，解决了"当前在哪"的问题。但用户仍然需要：

- 查阅文档才能知道每个阶段有哪些可用工作流和方法
- 记忆智能体名称和对应命令才能发起操作
- 缺乏对 BMad 方法论全貌的直观认知

## V2 核心功能：方法论导航栏目

在现有页面下方新增**方法论速查导航**区域，数据驱动，从 `_bmad/_config/bmad-help.csv` 和 `.claude/skills/` 动态读取。

### 内容结构（按阶段分组）

#### 1. 分析阶段 (Discovery)
| 分类 | 内容 |
|------|------|
| 工作流 | 产品简报 [CB] `bmad-product-brief`、PRFAQ 挑战 [WB] `bmad-prfaq`、头脑风暴 [BP] `bmad-brainstorming` |
| 研究方法 | 领域研究 [DR] `bmad-domain-research`、市场研究 [MR] `bmad-market-research`、技术研究 [TR] `bmad-technical-research` |
| 智能体 | Mary（业务分析师）`bmad-agent-analyst` |

#### 2. 规划阶段 (Planning)
| 分类 | 内容 |
|------|------|
| 工作流 | 创建 PRD [CP] `bmad-create-prd`（必需）、创建 UX 设计 [CU] `bmad-create-ux-design` |
| 辅助方法 | 验证 PRD [VP] `bmad-validate-prd`、编辑 PRD [EP] `bmad-edit-prd` |
| 智能体 | John（产品经理）`bmad-agent-pm`、Sally（UX 设计师）`bmad-agent-ux-designer` |

#### 3. 方案设计阶段 (Design)
| 分类 | 内容 |
|------|------|
| 工作流 | 创建架构 [CA] `bmad-create-architecture`（必需）、创建史诗和故事 [CE] `bmad-create-epics-and-stories`（必需） |
| 质量关卡 | 检查实现就绪 [IR] `bmad-check-implementation-readiness`（必需） |
| 智能体 | Winston（系统架构师）`bmad-agent-architect` |

#### 4. 开发阶段 (Development)
| 分类 | 内容 |
|------|------|
| 核心循环 | Sprint 规划 [SP] `bmad-sprint-planning`（必需）→ 创建故事 [CS] `bmad-create-story` → 验证故事 [VS] `bmad-create-story:validate` → 开发故事 [DS] `bmad-dev-story` → 代码审查 [CR] `bmad-code-review` |
| 辅助工具 | QA 自动化测试 [QA] `bmad-qa-generate-e2e-tests`、检查点预览 [CK] `bmad-checkpoint-preview`、Sprint 状态 [SS] `bmad-sprint-status` |
| 智能体 | Amelia（开发工程师）`bmad-agent-dev` |

#### 5. 复盘阶段 (Retrospective)
| 分类 | 内容 |
|------|------|
| 工作流 | 回顾 [ER] `bmad-retrospective` |
| 决策 | 进入下一个 Epic 或触发纠正方向 [CC] `bmad-correct-course` |

#### 通用工具（任意阶段可用）
| 分类 | 内容 |
|------|------|
| 智能体 | Paige（技术文档专家）`bmad-agent-tech-writer` |
| 文档工具 | 文档化项目 [DP] `bmad-document-project`、生成项目上下文 [GPC] `bmad-generate-project-context`、索引文档 [ID] `bmad-index-docs` |
| 审查工具 | 对抗性审查 [AR] `bmad-review-adversarial-general`、边界情况猎手 [ECH] `bmad-review-edge-case-hunter`、编辑审查-散文 [EP] `bmad-editorial-review-prose`、编辑审查-结构 [ES] `bmad-editorial-review-structure` |
| 高级工具 | 快速开发 [QQ] `bmad-quick-dev`、深度启发 `bmad-advanced-elicitation`、蒸馏器 [DG] `bmad-distillator`、分片文档 [SD] `bmad-shard-doc`、派对模式 [PM] `bmad-party-mode` |
| 导航 | 纠正方向 [CC] `bmad-correct-course`、BMad 帮助 [BH] `bmad-help` |

### 数据源

- 主数据：`_bmad/_config/bmad-help.csv` — 包含阶段、技能名、菜单代码、描述、依赖关系、是否必需
- 补充数据：`.claude/skills/bmad-*/SKILL.md` — 技能详细描述和元数据
- 智能体数据：`_bmad/_config/agent-manifest.csv` — 智能体角色信息

### 交互设计要点

- 嵌入现有页面底部，作为阶段条和 Sprint 面板的补充
- 按阶段分组折叠/展开，当前活跃阶段默认展开
- 每个条目显示：菜单代码标签 `[XX]`、显示名称、简短描述
- **Hover 显示全称**：鼠标悬停在命令/智能体条目上时，tooltip 显示技能全称（如 `bmad-create-prd`）和完整描述
- **Click 复制命令**：点击任意命令/智能体条目，自动将技能全称复制到剪贴板，并显示"✓ 已复制"反馈（复用 MVP 的 `copyToClipboard` 能力）
- 跟随 CloudCLI UI 深色/浅色主题
- 通用工具区域始终可见

### 技术约束

- 前端渲染：纯 DOM 操作（与 MVP 一致，无框架依赖）
- 后端数据：server.ts 新增 CSV 解析和技能目录扫描接口
- 数据格式：复用 bmad-help.csv 的 phase/required/after/before 字段做分组和排序

## MVP 保留功能

- 阶段条（5 阶段高亮）
- 下一步建议卡片（agent 口吻 + 一键复制）
- Sprint 只读列表（Epic/Story 状态 + 进度条）
- 空状态引导
- 主题适配 + i18n

## 成功指标

- 用户无需离开插件界面即可了解 BMad 方法论全貌
- 每个阶段的可用操作一目了然，降低学习曲线
- 命令一键复制，减少手动输入错误

## 风险与约束

- CSV 结构可能随 BMad 版本升级变化，需要做好兼容处理
- 技能数量较多（40+），需要合理的折叠/分组避免信息过载
- 插件 API 的 RPC 调用需确认对文件系统扫描的性能影响
