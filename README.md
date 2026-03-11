# 浣熊卡路里服务端（RaccoonCal Server）

AI驱动的游戏化饮食管理应用后端服务

## 项目概述

浣熊卡路里服务端为移动端应用提供完整的后端API服务，包括用户管理、食物识别、卡路里计算、游戏化系统等核心功能。

## 核心功能

- 🔐 **用户认证**：JWT认证、用户注册登录
- 🍎 **食物识别**：AI拍照识别食物和卡路里计算
- 📊 **数据管理**：饮食记录、营养分析、统计报表
- 🦝 **游戏化系统**：虚拟宠物、任务系统、积分奖励
- 👥 **社交功能**：好友系统、排行榜、分享功能
- 📱 **API服务**：RESTful API、实时通知

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: MySQL + Redis
- **ORM**: Prisma / TypeORM
- **认证**: JWT + Passport
- **文件存储**: AWS S3 / 阿里云OSS
- **AI服务**: LogMeal API / CalorieNinja API
- **部署**: Docker + PM2

## 项目结构

```
raccoon-cal-server/
├── packages/
│   ├── server/          # Express 服务端
│   └── shared/          # 共享类型和工具
├── docs/               # 项目文档
├── scripts/            # 构建和部署脚本
└── package.json        # 根目录配置
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建项目
pnpm build

# 运行测试
pnpm test
```

## 环境配置

```bash
# 复制环境变量模板
cp packages/server/.env.example packages/server/.env

# 配置必要的环境变量
# - DATABASE_URL: MySQL连接字符串 (mysql://user:password@localhost:3306/raccoon_cal)
# - REDIS_URL: Redis连接字符串
# - JWT_SECRET: JWT密钥
# - AI_API_KEY: 食物识别API密钥
```

## 文档

- [产品需求文档](./docs/PRD.md)
- [技术设计文档](./docs/TECH_DESIGN.md)
- [API文档](./docs/API.md)
- [开发指南](./docs/DEVELOPMENT.md)

## 开发路线图

- [x] 项目初始化和架构设计
- [ ] 用户认证系统（第1周）
- [ ] 食物识别API集成（第2周）
- [ ] 数据管理和统计（第3周）
- [ ] 游戏化系统（第4周）
- [ ] 社交功能和优化（第5-6周）

## API文档

服务启动后访问 `http://localhost:3000/api-docs` 查看完整的API文档。

## 部署

```bash
# 使用Docker部署
docker-compose up -d

# 或使用PM2部署
pnpm build
pm2 start ecosystem.config.js
```

## 许可证

MIT License
