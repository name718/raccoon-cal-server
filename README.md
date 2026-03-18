# RaccoonCal Server

浣熊卡路里后端服务，为 iOS App 提供 REST API。

## 技术栈

- Node.js 18+ / Express.js / TypeScript
- MySQL + Prisma ORM
- Redis（缓存 + 排行榜 Sorted Set）
- node-cron（定时任务）
- Sharp（图片预处理）
- LogMeal AI（食物识别）
- JWT 认证

## 项目结构

```
packages/server/
├── src/
│   ├── controllers/       # 路由处理层
│   ├── services/          # 业务逻辑层
│   ├── routes/            # 路由注册
│   ├── middleware/        # 认证/限流/错误处理
│   ├── jobs/              # Cron 定时任务
│   ├── utils/             # 工具函数（游戏化引擎/卡路里计算）
│   ├── config/            # 配置（数据库/Redis/环境变量）
│   └── app.ts             # 入口
├── prisma/
│   ├── schema.prisma      # 数据库模型
│   └── seed.ts            # 初始数据
└── package.json
```

## 快速开始

```bash
pnpm install

# 配置环境变量
cp packages/server/.env.example packages/server/.env

# 一键重建开发数据库（清空现有数据、重建全部表、自动写入 seed）
pnpm db:setup

# 启动开发服务器
pnpm dev
```

## 环境变量

```env
NODE_ENV=development
PORT=3000
HOST=localhost

DATABASE_URL=mysql://user:password@localhost:3306/raccoon_cal
REDIS_URL=redis://localhost:6379

JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

AI_API_KEY=your-logmeal-api-key
AI_API_URL=https://api.logmeal.es

CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

## 常用命令

```bash
pnpm db:setup                     # 一键重建开发数据库并写入种子数据
pnpm dev                          # 开发模式
pnpm --filter @raccoon-cal/server run build   # 编译 TypeScript
pnpm --filter @raccoon-cal/server run start   # 生产模式
pnpm --filter @raccoon-cal/server run test    # 运行测试
pnpm --filter @raccoon-cal/server run lint    # 代码检查
pnpm --filter @raccoon-cal/server run db:studio  # 数据库可视化
```

`pnpm db:setup` 会执行 Prisma 的
`migrate reset --force`，按迁移文件重建完整表结构，并自动运行 `prisma/seed.ts`。

## Docker

```bash
docker-compose up -d   # 启动 MySQL + Redis
docker-compose down    # 停止
```

## 文档

- [API 接口文档](docs/API.md)
- [技术设计文档](docs/TECH_DESIGN.md)
- [开发指南](docs/DEVELOPMENT.md)
- [代码规范](docs/CODE_STYLE.md)
- [编辑器配置](docs/EDITOR_SETUP.md)
