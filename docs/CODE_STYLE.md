# 代码规范：RaccoonCal Server

## 工具链

- TypeScript 5+（严格模式）
- ESLint + `@typescript-eslint`
- Prettier
- Husky + lint-staged（pre-commit 自动检查）

## TypeScript 规范

```typescript
// ✅ 用 interface 定义对象类型
interface FoodRecord {
  id: number;
  userId: number;
  foodName: string;
  calories: number;
}

// ✅ 用 type 定义联合类型
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type PetMood = 'happy' | 'satisfied' | 'normal' | 'hungry' | 'sad' | 'missing';

// ❌ 禁止 any，用 unknown 替代
const data: unknown = response.data;

// ✅ 明确函数参数和返回值类型
async function awardXp(
  userId: number,
  reason: string,
  refId: string,
  amount: number
): Promise<void> {}

// ✅ 用 type 关键字导入类型
import type { Request, Response, NextFunction } from 'express';
```

## 文件命名

```
food.controller.ts      # 控制器
food.service.ts         # 服务
food.routes.ts          # 路由
gamificationEngine.ts   # 工具函数（camelCase）
dailyReset.job.ts       # 定时任务
```

## 控制器规范

```typescript
export class FoodController {
  static async saveRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
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

## 服务层规范

```typescript
export class FoodService {
  static async saveRecord(
    userId: number,
    dto: CreateFoodRecordDto
  ): Promise<FoodRecord> {
    const record = await prisma.foodRecord.create({ data: { userId, ...dto } });
    // 触发副作用（XP、HP、饱食度）
    await GamificationService.onFoodRecordSaved(userId, record);
    return record;
  }
}
```

## 错误处理

```typescript
// 自定义错误类
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

## 命名规范

| 类型         | 规范                    | 示例                                       |
| ------------ | ----------------------- | ------------------------------------------ |
| 变量/函数    | camelCase               | `totalCalories`, `awardXp`                 |
| 类/接口/类型 | PascalCase              | `FoodService`, `MealType`                  |
| 常量         | UPPER_SNAKE_CASE        | `MAX_HP`, `XP_RULES`                       |
| 文件         | kebab-case 或 camelCase | `food.service.ts`, `gamificationEngine.ts` |

## 注释规范

```typescript
/**
 * 授予 XP，幂等：同一 reason+refId 只授予一次
 * @param userId - 用户 ID
 * @param reason - XP 来源类型（food_record / daily_goal / task / streak / achievement）
 * @param refId  - 关联业务 ID，用于幂等去重
 * @param amount - XP 数量
 */
async function awardXp(
  userId: number,
  reason: string,
  refId: string,
  amount: number
): Promise<void> {}

// 解释为什么，不解释做什么
// 使用 Redis 去重缓存作为第一道防线，DB 唯一约束作为兜底
const cached = await redis.get(`user:xp_dedup:${userId}:${reason}:${refId}`);
```

## 导入顺序

```typescript
// 1. Node.js 内置
import path from 'path';

// 2. 第三方库
import express from 'express';
import { PrismaClient } from '@prisma/client';

// 3. 项目内部（用 @/ 别名）
import { database } from '@/config/database';
import { FoodService } from '@/services/food.service';

// 4. 类型
import type { Request, Response } from 'express';
```

## Prettier 配置（`.prettierrc`）

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

## 常用命令

```bash
pnpm --filter server lint        # 检查
pnpm --filter server lint:fix    # 自动修复
pnpm --filter server format      # Prettier 格式化
```
