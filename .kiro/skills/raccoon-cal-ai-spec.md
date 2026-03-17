# 浣熊卡路里 AI 开发规范

## 项目概述

浣熊卡路里是一款 iOS 原生卡路里管理应用，通过 AI 拍照识别和游戏化养成体验，让健康管理变得有趣。

## 技术栈

- iOS 前端：Swift + SwiftUI（iOS 15+）
- 后端：Express.js + TypeScript
- 数据库：MySQL 8 + Prisma ORM
- 缓存：Redis 7
- 图片处理：Sharp
- 食物识别：LogMeal AI API
- 定时任务：node-cron
- 认证：JWT
- 包管理：pnpm（monorepo）
- 部署：Docker

## 项目结构

```
raccoon-cal-server/
└── packages/server/src/
    ├── controllers/    # 路由处理层
    ├── services/       # 业务逻辑层
    ├── routes/         # 路由注册
    ├── middleware/     # 认证/限流/错误处理
    ├── jobs/           # Cron 定时任务
    ├── utils/          # 工具函数
    └── config/         # 配置

raccoon-cal-app/RaccoonCal/
├── Models/             # Codable 数据模型
├── Services/           # APIService / UserManager / GamificationManager
├── Views/              # SwiftUI 视图
└── Theme/              # AppTheme 颜色/字体/间距
```

## 代码生成规范

### 1. 通用规则

- 所有服务端代码使用 TypeScript，禁止 `any`，用 `unknown` 替代
- iOS 代码使用 Swift 5.9+，SwiftUI
- 函数单一职责，保持简洁
- 所有异步操作必须有错误处理
- 为公共函数添加 JSDoc（服务端）或 `///`（Swift）注释

### 2. 服务端规范

#### 控制器模板

```typescript
import type { Request, Response, NextFunction } from 'express';
import { FoodService } from '@/services/food.service';

export class FoodController {
  static async saveRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id as number;
      const result = await FoodService.saveRecord(userId, req.body);
      return res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}
```

#### 服务层模板

```typescript
import { database } from '@/config/database';
import { GamificationService } from '@/services/gamification.service';

const prisma = database.client;

export class FoodService {
  /**
   * 保存饮食记录，并触发 XP 授予、HP 检查、饱食度更新
   */
  static async saveRecord(userId: number, dto: CreateFoodRecordDto) {
    const record = await prisma.foodRecord.create({
      data: { userId, ...dto },
    });
    // 触发游戏化副作用
    await GamificationService.onFoodRecordSaved(userId, record);
    return record;
  }
}
```

#### Prisma 数据操作

```typescript
// ✅ 用 Prisma Client，不用原生 SQL
const record = await prisma.foodRecord.findFirst({
  where: { userId, id },
});

// ✅ 事务
await prisma.$transaction([
  prisma.gamificationStatus.update({
    where: { userId },
    data: { totalXp: { increment: 10 } },
  }),
  prisma.xpTransaction.create({
    data: {
      userId,
      amount: 10,
      reason: 'food_record',
      refId: String(recordId),
    },
  }),
]);

// ✅ 索引字段查询（userId + recordedAt 已建索引）
const records = await prisma.foodRecord.findMany({
  where: { userId, recordedAt: { gte: startOfDay, lte: endOfDay } },
  orderBy: { recordedAt: 'desc' },
});
```

#### Redis 操作

```typescript
import { redis } from '@/config/redis';

// 缓存（TTL 秒）
await redis.set(
  `user:gamification:${userId}`,
  JSON.stringify(status),
  'EX',
  300
);
const cached = await redis.get(`user:gamification:${userId}`);

// 联盟排行榜 Sorted Set
await redis.zadd(
  `league:ranking:${tier}:${weekStart}`,
  weeklyXp,
  String(userId)
);
const top10 = await redis.zrevrange(
  `league:ranking:${tier}:${weekStart}`,
  0,
  9,
  'WITHSCORES'
);
```

#### 错误处理

```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

// 在服务层抛出
if (!record) throw new AppError('NOT_FOUND', 'Food record not found', 404);

// 控制器统一 next(error)，由 errorHandler 中间件处理
```

#### API 响应格式

```typescript
// 成功
res.json({ success: true, data: result, timestamp: new Date().toISOString() });

// 错误（由 errorHandler 统一处理）
// { success: false, error: { code, message }, timestamp }
```

### 3. iOS 规范

#### 数据模型

```swift
// ✅ struct + Codable，字段名与服务端 JSON 一致（camelCase）
struct FoodRecord: Codable, Identifiable {
    let id: Int
    let foodName: String
    let calories: Double
    let mealType: String
    let recordedAt: String
}

// ✅ 枚举用 String rawValue
enum PetMood: String, Codable {
    case happy, satisfied, normal, hungry, sad, missing
}
```

#### SwiftUI View

```swift
struct HomeView: View {
    @EnvironmentObject var gamificationManager: GamificationManager
    @State private var errorMessage: String?

    var body: some View {
        ScrollView { /* ... */ }
        .task {
            do {
                try await gamificationManager.refreshStatus()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
```

#### APIService 调用

```swift
// ✅ async/await，统一通过 APIService.shared 调用
func getFoodRecords(date: String) async throws -> [MealGroup] {
    return try await APIService.shared.request("/food/records?date=\(date)")
}

// ✅ 并发请求
async let status = APIService.shared.getGamificationStatus()
async let tasks = APIService.shared.getDailyTasks()
let (s, t) = try await (status, tasks)
```

#### AppTheme 使用

```swift
// ✅ 所有颜色/字体/间距通过 AppTheme 引用
Text("今日卡路里")
    .font(AppTheme.Fonts.body)
    .foregroundColor(AppTheme.Colors.textSecondary)

// ❌ 不硬编码颜色和字号
```

### 4. 命名规范

| 类型      | 服务端             | iOS                     |
| --------- | ------------------ | ----------------------- |
| 文件      | `food.service.ts`  | `FoodRecord.swift`      |
| 类/接口   | PascalCase         | PascalCase              |
| 变量/函数 | camelCase          | camelCase               |
| 常量      | `UPPER_SNAKE_CASE` | camelCase（Swift 惯例） |

### 5. 安全规范

- 密码：bcrypt 哈希，禁止明文存储
- JWT：`Authorization: Bearer <token>`，7 天有效期
- 输入验证：服务端用 Joi 或 Zod 验证所有请求体
- 排行榜：只返回 nickname/petAvatarMood/weeklyXp，不含 email/phone
- 图片：不保存原图，仅保存压缩后缩略图 URL

### 6. 测试规范

```typescript
// 服务端属性测试（fast-check）
import fc from 'fast-check';
import { calcLevel } from '@/utils/gamificationEngine';

test('等级公式正确性', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 250000 }), totalXp => {
      const level = calcLevel(totalXp);
      return level >= 1 && level <= 50;
    }),
    { numRuns: 1000 }
  );
});
```

```swift
// iOS 属性测试（SwiftCheck）
property("HP 心形数量有界性") <- forAll { (hp: Int) in
    let displayed = max(0, min(hp, 5))
    return displayed >= 0 && displayed <= 5
}
```

### 7. Git 提交规范

```
feat: 添加食物识别接口
fix: 修复 XP 幂等判断逻辑
docs: 更新 API 文档
refactor: 重构游戏化引擎
test: 添加等级公式属性测试
chore: 升级 Prisma 版本
```

## AI 生成代码注意事项

1. 服务端数据库操作一律使用 Prisma Client，不用 Mongoose 或原生 SQL
2. iOS 网络请求一律通过 `APIService.swift` 封装，不直接使用 URLSession
3. 游戏化计算逻辑（等级/XP/HP/心情）服务端和 iOS 端公式必须保持一致
4. 新增 API 接口后同步更新 `raccoon-cal-server/docs/API.md`
5. 浣熊展示当前使用静态图片（Assets.xcassets），3D 动画标记 `[DEFERRED]`
6. 所有 XP 授予必须通过 `awardXp(userId, reason, refId, amount)` 保证幂等
