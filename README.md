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

# 数据库迁移
pnpm --filter server prisma migrate dev

# 写入初始数据
pnpm --filter server prisma db seed

# 启动开发服务器
pnpm --filter server dev
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
pnpm --filter server dev          # 开发模式
pnpm --filter server build        # 编译 TypeScript
pnpm --filter server start        # 生产模式
pnpm --filter server test         # 运行测试
pnpm --filter server lint         # 代码检查
pnpm --filter server prisma studio  # 数据库可视化
```

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
