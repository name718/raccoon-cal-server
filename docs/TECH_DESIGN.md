# 技术设计文档：RaccoonCal Server

## 架构概览

```
iOS App (SwiftUI)
    │ HTTPS / REST + Bearer JWT
Express.js API Server
    ├── Prisma ORM → MySQL（持久化）
    ├── Redis（缓存 + 联盟排行榜 Sorted Set）
    └── LogMeal AI（食物识别）

Cron Jobs（node-cron）
    ├── 每日零点：重置 HP/饱食度/生成任务/检查 Streak
    ├── 每日 19:00：Streak 断裂风险检查
    └── 每周日 23:59：联盟结算
```

## 技术栈

| 层级     | 选型                    |
| -------- | ----------------------- |
| 运行时   | Node.js 18+             |
| 框架     | Express.js + TypeScript |
| ORM      | Prisma                  |
| 数据库   | MySQL 8                 |
| 缓存     | Redis 7                 |
| 图片处理 | Sharp                   |
| 食物识别 | LogMeal API             |
| 定时任务 | node-cron               |
| 认证     | JWT（jsonwebtoken）     |
| 验证码   | svg-captcha + Redis     |
| 包管理   | pnpm（monorepo）        |

## 项目结构

```
packages/server/src/
├── controllers/
│   ├── auth.controller.ts
│   ├── captcha.controller.ts
│   ├── food.controller.ts
│   ├── gamification.controller.ts
│   ├── pet.controller.ts
│   ├── task.controller.ts
│   ├── achievement.controller.ts
│   ├── league.controller.ts
│   └── profile.controller.ts
├── services/
│   ├── food.service.ts
│   ├── logmeal.service.ts
│   ├── gamification.service.ts
│   ├── pet.service.ts
│   ├── task.service.ts
│   ├── achievement.service.ts
│   ├── league.service.ts
│   └── profile.service.ts
├── routes/
│   ├── auth.routes.ts
│   ├── captcha.routes.ts
│   ├── food.routes.ts
│   ├── gamification.routes.ts
│   ├── pet.routes.ts
│   ├── task.routes.ts
│   ├── achievement.routes.ts
│   ├── league.routes.ts
│   └── profile.routes.ts
├── jobs/
│   ├── dailyReset.job.ts
│   ├── leagueSettlement.job.ts
│   └── streakCheck.job.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── errorHandler.ts
│   ├── notFoundHandler.ts
│   └── requestLogger.ts
├── utils/
│   ├── gamificationEngine.ts   # XP/等级/HP/Streak 计算
│   └── calorieCalculator.ts    # Harris-Benedict 公式
├── config/
│   ├── index.ts
│   └── database.ts
└── app.ts
```

## 数据库设计（Prisma Schema）

### 现有表

- `users`：用户账户（username/email/phone/passwordHash）

### 新增表

| 表名                  | 说明                                               |
| --------------------- | -------------------------------------------------- |
| `user_profiles`       | 健康档案（身高/体重/目标/每日卡路里目标）          |
| `weight_records`      | 体重历史                                           |
| `food_records`        | 饮食记录（含餐次/营养素/图片URL）                  |
| `gamification_status` | 游戏化状态（XP/等级/HP/Streak/保护盾），每用户一条 |
| `xp_transactions`     | XP 流水，`UNIQUE(userId, reason, refId)` 保证幂等  |
| `pets`                | 浣熊宠物（饱食度/装扮槽位）                        |
| `pet_level_history`   | 浣熊升级历史                                       |
| `daily_tasks`         | 每日任务，`UNIQUE(userId, taskKey, taskDate)`      |
| `achievement_defs`    | 成就定义（静态，seed 写入）                        |
| `user_achievements`   | 用户已解锁成就，`UNIQUE(userId, achievementKey)`   |
| `leagues`             | 联盟分组（tier + weekStart）                       |
| `league_members`      | 联盟成员（weeklyXp/rank/promoted）                 |

## Redis 缓存设计

| 键模式                                    | 用途                     | TTL        |
| ----------------------------------------- | ------------------------ | ---------- |
| `user:gamification:{userId}`              | 游戏化状态缓存           | 5 分钟     |
| `user:daily_cal:{userId}:{date}`          | 当日卡路里汇总           | 至次日零点 |
| `user:daily_tasks:{userId}:{date}`        | 当日任务列表             | 至次日零点 |
| `league:ranking:{tier}:{weekStart}`       | 联盟排行榜（Sorted Set） | 7 天       |
| `user:xp_dedup:{userId}:{reason}:{refId}` | XP 幂等去重              | 24 小时    |
| `pet:status:{userId}`                     | 浣熊状态缓存             | 10 分钟    |
| `checkin:flag:{userId}:{date}`            | 当日打卡标记             | 至次日零点 |

联盟排行榜使用 Redis Sorted
Set：`ZADD league:ranking:{tier}:{weekStart} {weeklyXp} {userId}`，用户获得 XP 时
`ZINCRBY` 实时更新，`ZREVRANGE` 获取 Top 10。

## 游戏化引擎

### XP 规则

| 行为               | XP                       |
| ------------------ | ------------------------ |
| 完成一次饮食记录   | +10                      |
| 达成当日卡路里目标 | +30                      |
| 完成每日任务       | +20～50（按任务配置）    |
| Streak 加成        | +min(5 × streakDays, 50) |
| 成就解锁           | 按成就配置               |

XP 幂等：先查 Redis 去重缓存，未命中则写
`XpTransaction`（DB 唯一约束兜底），重复触发静默忽略。

### 等级公式

```
Level N 所需累计 XP = 100 × N²，最高 50 级
calcLevel(xp) = min(floor(sqrt(xp / 100)), 50)
```

### HP 机制

- 每日 5 点，零点重置
- 当日累计卡路里超出目标 10% 时扣 1 点，下限 0
- 完成"恢复 HP"任务可恢复 1 点，上限 5

### Streak 机制

- 每日至少一次饮食记录即打卡
- 零点 cron 检查昨日是否打卡：未打卡且有保护盾则消耗保护盾，否则重置为 0
- 保护盾上限 2 个

### 浣熊心情（6 态）

| 条件                 | 心情      |
| -------------------- | --------- |
| 连续 3 天无记录      | missing   |
| 摄入 > 目标 × 1.2    | sad       |
| 摄入在目标 90%～110% | happy     |
| 记录 ≥ 2 餐          | satisfied |
| 记录 1 餐            | normal    |
| 当日无记录           | hungry    |

## LogMeal AI 集成

```
iOS → POST /api/food/recognize (multipart/form-data)
     → Sharp 压缩（800px 宽，质量 80%）
     → LogMeal POST /v2/image/segmentation/complete/v1.0
     → 解析结果，置信度 < 0.3 返回 { foods: [], confidence: 0 }
     → 返回 iOS
```

超时 10s 返回 503，App 显示降级入口（手动输入）。

## 通用响应格式

```typescript
interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code: string; message: string; details?: any };
  timestamp: string;
}
```

## 错误处理

| 场景             | 状态码 | 错误码                |
| ---------------- | ------ | --------------------- |
| 未登录           | 401    | `AUTH_REQUIRED`       |
| Token 无效/过期  | 401    | `INVALID_TOKEN`       |
| 权限不足         | 403    | `PERMISSION_DENIED`   |
| 资源不存在       | 404    | `NOT_FOUND`           |
| 参数验证失败     | 400    | `VALIDATION_ERROR`    |
| 请求频率超限     | 429    | `RATE_LIMIT_EXCEEDED` |
| LogMeal 超时     | 503    | `AI_TIMEOUT`          |
| 图片格式不支持   | 400    | `INVALID_IMAGE`       |
| XP 幂等冲突      | 200    | — 静默忽略            |
| 联盟已满（30人） | 200    | — 自动创建新分组      |

## 安全

- 密码：bcrypt 哈希存储
- JWT：7 天有效期，`Authorization: Bearer <token>`
- 请求限流：express-rate-limit（默认 100 次/15 分钟）
- 排行榜隐私：只返回 nickname/petAvatarMood/weeklyXp，不含 email/phone
- 图片：不保存原图，仅保存识别结果和压缩后的缩略图 URL
