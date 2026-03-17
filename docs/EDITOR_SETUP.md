# 编辑器配置：RaccoonCal Server

## VS Code 推荐插件

- ESLint
- Prettier - Code formatter
- Prisma（语法高亮 + 格式化 `.prisma` 文件）
- TypeScript（内置，确保版本 >= 5）
- Error Lens（行内错误提示）
- GitLens
- REST Client（`.http` 文件调试 API）

## 推荐设置（`.vscode/settings.json`）

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 路径别名

项目配置了 `@/` 别名指向 `src/`，VS Code 会自动识别 `tsconfig.json` 中的 `paths`
配置：

```typescript
import { database } from '@/config/database'; // ✅
import { database } from '../../../config/database'; // ❌
```

## 调试配置（`.vscode/launch.json`）

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "server", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "outFiles": ["${workspaceFolder}/packages/server/dist/**/*.js"]
    }
  ]
}
```

## Git Hooks

项目使用 Husky + lint-staged，pre-commit 自动运行：

1. ESLint 检查并修复暂存文件
2. Prettier 格式化暂存文件

提交信息必须符合 Conventional Commits：

```
feat | fix | docs | style | refactor | perf | test | chore
```

示例：`feat: 添加食物识别接口`

跳过（不推荐）：`git commit --no-verify -m "message"`

## Prisma Studio

可视化查看和编辑数据库：

```bash
pnpm --filter server prisma studio
# 访问 http://localhost:5555
```
