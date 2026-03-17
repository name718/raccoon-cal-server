# 开发指南：RaccoonCal Server

## 环境要求

- Node.js 18+
- pnpm 8+
- MySQL 8
- Redis 7
- Docker（可选，用于本地数据库）

## 初始化

```bash
# 克隆项目
git clone https://github.com/name718/raccoon-cal.git
cd raccoon-cal/raccoon-cal-server

# 安装依赖
pnpm install

# 配置环境变量
cp packages/server/.env.example packages/server/.env
# 编辑 .env，填写 DATABASE_URL、REDIS_URL、JWT_SECRET、AI_API_KEY

# 启动本地数据库（Docker）
docker-compose up -d

# 数据库迁移
pnpm --filter server prisma migrate dev

# 写入初始数据（成就定义、任务池）
pnpm --filter server prisma db seed

# 启动开发服务器
pnpm --filter server dev
```

## 环境变量说明

```env
NODE_ENV=development
PORT=3000
HOST=localhost

# MySQL 连接字符串
DATABASE_URL=mysql://root:password@localhost:3306/raccoon_cal

# Redis 连接字符串
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d

# LogMeal AI
AI_API_KEY=your-logmeal-api-key
AI_API_URL=https://api.logmeal.es

# CORS（iOS 模拟器本地调试时填 *）
CORS_ORIGIN=*

# 限流
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

## 常用命令

```bash
pnpm --filter server dev              # 开发模式（ts-node-dev 热重载）
pnpm --filter server build            # 编译 TypeScript → dist/
pnpm --filter server start            # 生产模式（需先 build）
pnpm --filter server test             # 运行测试
pnpm --filter server test:coverage    # 测试覆盖率
pnpm --filter server lint             # ESLint 检查
pnpm --filter server lint:fix         # ESLint 自动修复
pnpm --filter server format           # Prettier 格式化
pnpm --filter server prisma studio    # 数据库可视化管理
pnpm --filter server prisma migrate dev   # 创建并应用迁移
pnpm --filter server prisma generate  # 重新生成 Prisma Client
```

## 开发流程

### 新增 API 接口

1. 在 `prisma/schema.prisma` 添加/修改模型，执行 `prisma migrate dev`
2. 在 `src/services/` 实现业务逻辑
3. 在 `src/controllers/` 实现请求处理
4. 在 `src/routes/` 注册路由
5. 在 `src/app.ts` 挂载路由
6. 更新 `docs/API.md`

### 新增定时任务

在 `src/jobs/` 创建 job 文件，在 `src/app.ts` 的 `startServer()` 中注册：

```typescript
import cron from 'node-cron';
import { myJob } from '@/jobs/myJob';

cron.schedule('0 0 * * *', myJob); // 每日零点
```

### 数据库操作

```typescript
import { database } from '@/config/database';
const prisma = database.client;

// 查询示例
const user = await prisma.user.findUnique({ where: { id: userId } });

// 事务示例
await prisma.$transaction([
  prisma.gamificationStatus.update({ ... }),
  prisma.xpTransaction.create({ ... }),
]);
```

### Redis 操作

```typescript
import { redis } from '@/config/redis';

await redis.set('key', 'value', 'EX', 300); // TTL 5 分钟
await redis.get('key');
await redis.zadd('leaderboard', score, member);
await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');
```

## 测试

```bash
# 单元测试
pnpm --filter server test

# 属性测试（fast-check）
pnpm --filter server test -- --testPathPattern=properties

# 单次运行（不进入 watch 模式）
pnpm --filter server test -- --runInBand
```

测试文件结构：

```
packages/server/src/__tests__/
├── unit/
│   ├── gamificationEngine.test.ts
│   ├── calorieCalculator.test.ts
│   └── ...
├── properties/
│   ├── xp.property.test.ts
│   ├── level.property.test.ts
│   └── ...
└── integration/
    ├── auth.test.ts
    └── food.test.ts
```

## Git 提交规范

使用 Conventional Commits，Husky pre-commit 会自动检查：

```bash
git commit -m "feat: 添加食物识别接口"
git commit -m "fix: 修复 XP 幂等判断逻辑"
git commit -m "docs: 更新 API 文档"
git commit -m "refactor: 重构游戏化引擎"
git commit -m "test: 添加等级公式属性测试"
git commit -m "chore: 升级 Prisma 版本"
```

## 健康检查

服务启动后访问 `GET /health` 验证数据库连接状态：

```json
{
  "status": "ok",
  "timestamp": "2026-03-17T00:00:00.000Z",
  "uptime": 123.456,
  "database": "connected"
}
```

## Docker 部署

```bash
# 构建镜像
docker build -t raccoon-cal-server packages/server/

# 运行
docker run -d -p 3000:3000 --env-file packages/server/.env raccoon-cal-server

# 或使用 docker-compose（含 MySQL + Redis）
docker-compose up -d
```

## 常见问题

**Prisma Client 未生成**

```bash
pnpm --filter server prisma generate
```

**Redis 连接失败**

```bash
redis-cli ping  # 应返回 PONG
brew services restart redis  # macOS
```

**MySQL 连接失败**

```bash
docker-compose up -d  # 用 Docker 启动
# 或检查 DATABASE_URL 格式是否正确
```

**TypeScript 路径别名不生效**

```bash
# 确认 tsconfig.json 中 paths 配置正确
# 开发模式用 ts-node-dev，生产模式用 tsc-alias 处理路径
```
