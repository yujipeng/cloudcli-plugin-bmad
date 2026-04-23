# Bmad Flow

Bmad 方法论流程看板与引导插件，适用于 [CloudCLI UI](https://cloudcli.ai)。

扫描项目 `_bmad/` 产物，可视化呈现 5 阶段流程状态、智能推荐下一步操作、追踪 Sprint 进度。

## 功能

- 极简阶段条：Discovery → Planning → Design → Development → Retrospective，当前阶段高亮
- 下一步建议卡片：带 agent 口吻台词 + 一键复制命令
- Sprint 只读列表：Epic/Story 状态徽章 + 进度条
- 空状态引导：未检测到 `_bmad/` 时提示初始化
- 主题适配：跟随 CloudCLI UI 深色/浅色主题

## 安装

在 CloudCLI UI 中打开 Settings > Plugins，粘贴仓库地址安装：

```
http://gitlab.tcredit.com/bmp/bmad-flow.git
```

或手动安装：

```bash
git clone http://gitlab.tcredit.com/bmp/bmad-flow.git ~/.claude-code-ui/plugins/bmad-flow
cd ~/.claude-code-ui/plugins/bmad-flow
npm install
npm run build
```

## 开发

```bash
npm run dev    # TypeScript watch 模式
npm run build  # 编译 src/ → dist/
```

## 项目结构

```
bmad-flow/
  manifest.json       # 插件元数据
  src/
    types.ts          # 类型定义（Plugin API + Bmad Flow 业务类型）
    server.ts         # 后端：YAML 解析 + 产物扫描 + 阶段推断 + HTTP 路由
    index.ts          # 前端：阶段条 + 建议卡片 + Sprint 面板 + 主题适配
  dist/               # 编译产物（自动生成）
  icon.svg            # Tab 图标
```

## License

MIT
