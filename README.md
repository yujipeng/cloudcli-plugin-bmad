# Bmad Flow

Bmad 方法论流程看板与引导插件，适用于 [CloudCLI UI](https://cloudcli.ai)。

扫描项目 `_bmad/` 产物，可视化呈现 5 阶段流程状态、智能推荐下一步操作、追踪 Sprint 进度，并提供方法论导航功能。

## 功能

- 极简阶段条：Discovery → Planning → Design → Development → Retrospective，当前阶段高亮
- 下一步建议卡片：带 agent 口吻台词 + 一键复制命令
- Sprint 只读列表：Epic/Story 状态徽章 + 进度条
- 方法论导航：交互式方法论文档浏览与渲染
- 空状态引导：未检测到 `_bmad/` 时提示初始化
- 主题适配：跟随 CloudCLI UI 深色/浅色主题

## 安装

在 CloudCLI UI 中打开 Settings > Plugins，粘贴仓库地址安装：

```
https://github.com/yujipeng/cloudcli-plugin-bmad.git
```

或手动安装：

```bash
git clone https://github.com/yujipeng/cloudcli-plugin-bmad.git ~/.claude-code-ui/plugins/bmad-flow
cd ~/.claude-code-ui/plugins/bmad-flow
npm install
npm run build
```

## 开发

```bash
npm run dev    # TypeScript watch 模式
npm run build  # esbuild 打包 src/ → dist/
npm run test   # vitest 运行测试
```

## 项目结构

```
bmad-flow/
  manifest.json              # 插件元数据
  src/
    types.ts                 # 类型定义（Plugin API + Bmad Flow 业务类型）
    server.ts                # 后端：产物扫描 + 阶段推断 + HTTP 路由
    index.ts                 # 前端：阶段条 + 建议卡片 + Sprint 面板 + 主题适配
    interactionMode.ts       # 交互模式管理
    methodologyParser.ts     # 方法论文档解析
    methodologyViewModel.ts  # 方法论视图模型
    methodologyRender.ts     # 方法论渲染
    methodologyState.ts      # 方法论状态管理
  tests/
    server/
      flowStatus.test.ts           # 流程状态测试
      methodologyParser.test.ts    # 方法论解析测试
      methodologyViewModel.test.ts # 方法论视图模型测试
      methodologyEndpoint.test.ts  # 方法论端点测试
  dist/                      # 编译产物（自动生成）
  icon.svg                   # Tab 图标
```

## License

MIT
